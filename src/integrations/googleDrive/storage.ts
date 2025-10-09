import { googleDriveConfig } from '@/config/googleDrive';
import { supabase } from '@/integrations/supabase/client';

export interface DriveFileMetadata {
  id: string;
  name?: string;
  size?: string | number;
  webViewLink?: string | null;
  webContentLink?: string | null;
  appProperties?: Record<string, string> | null;
}

interface UploadOptions {
  file: File;
  clientId: string;
  clientName?: string;
  sanitizedName: string;
  hash: string;
  subfolder?: string;
  onProgress?: (progress: number) => void;
  onCreateRequest?: (xhr: XMLHttpRequest) => void;
}

interface UploadResult extends DriveFileMetadata {
  size: number;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';

let tokenCache: TokenCache | null = null;
let pendingTokenPromise: Promise<string> | null = null;

async function fetchServiceAccountToken(): Promise<{ access_token: string; expires_in: number }> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const { data, error } = await supabase.functions.invoke(googleDriveConfig.serviceAccountTokenFunction, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data.access_token !== 'string') {
    throw new Error('Resposta inválida ao solicitar token do Google Drive');
  }

  return {
    access_token: data.access_token,
    expires_in: Number(data.expires_in ?? 3600),
  };
}

export async function getDriveAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && tokenCache && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.token;
  }

  if (pendingTokenPromise) {
    return pendingTokenPromise;
  }

  pendingTokenPromise = (async () => {
    const response = await fetchServiceAccountToken();
    const expiresAt = Date.now() + response.expires_in * 1000;
    tokenCache = { token: response.access_token, expiresAt };
    pendingTokenPromise = null;
    return response.access_token;
  })().catch((error) => {
    pendingTokenPromise = null;
    throw error;
  });

  return pendingTokenPromise;
}

function buildMultipartRequestBody(file: File, metadata: Record<string, unknown>): { body: Blob; contentType: string } {
  const boundary = `-------314159${Math.random().toString(16).slice(2)}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileHeader = `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

  const body = new Blob([
    delimiter,
    metadataPart,
    delimiter,
    fileHeader,
    file,
    closeDelimiter,
  ], { type: `multipart/related; boundary=${boundary}` });

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

function escapeForDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

interface DriveErrorDetail {
  message?: string;
  reason?: string;
}

function parseDriveErrorPayload(payload: unknown): DriveErrorDetail[] {
  if (payload === null || payload === undefined) {
    return [];
  }

  if (typeof payload !== 'object') {
    if (typeof payload === 'string' && payload.trim().length > 0) {
      return [{ message: payload }];
    }
    return [];
  }

  const errorPayload = payload as {
    error?: { message?: string; errors?: Array<{ message?: string; reason?: string }> };
    message?: string;
  };

  const messages: DriveErrorDetail[] = [];

  if (Array.isArray(errorPayload.error?.errors)) {
    for (const error of errorPayload.error.errors) {
      messages.push({ message: error?.message, reason: error?.reason });
    }
  }

  if (errorPayload.error?.message) {
    messages.push({ message: errorPayload.error.message });
  }

  if (errorPayload.message) {
    messages.push({ message: errorPayload.message });
  }

  return messages;
}


function isSharedDriveAccessError(errors: DriveErrorDetail[]): boolean {
  return errors.some((error) =>
    (error.message ?? '').toLowerCase().includes('service accounts do not have access to shared drives'),

  );
}

const SHARED_DRIVE_GUIDE_URL =
  'https://developers.google.com/workspace/drive/api/guides/service-accounts#shared-drives';



function buildSharedDriveAccessErrorMessage(): string {
  return [
    'Não foi possível enviar o documento: a conta de serviço configurada não possui acesso à unidade compartilhada do Google Drive informada.',
    'Compartilhe a unidade com a conta de serviço e conceda permissão de Gerente ou configure OAuth delegation conforme a documentação oficial:',
    SHARED_DRIVE_GUIDE_URL,
  ].join(' ');
}


function formatDriveErrorMessage(baseMessage: string, payload: unknown): string {
  const driveErrors = parseDriveErrorPayload(payload);

  if (isSharedDriveAccessError(driveErrors)) {
    return buildSharedDriveAccessErrorMessage();
  }



  const detailedMessage = driveErrors.find((error) => Boolean(error.message))?.message;
  return detailedMessage ? `${baseMessage} - ${detailedMessage}` : baseMessage;
}

function parseDriveErrorFromText(text: string): unknown {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

async function ensureSubfolder(
  token: string,
  parentFolderId: string,
  subfolderName: string,
): Promise<string> {
  const escapedSubfolderName = escapeForDriveQuery(subfolderName);
  
  // Procurar subfolder existente
  const searchParams = new URLSearchParams({
    q: `name='${escapedSubfolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentFolderId}' in parents`,
    fields: 'files(id,name)',
    pageSize: '1',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const searchResponse = await fetch(`${DRIVE_API_BASE}?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!searchResponse.ok) {
    const errorPayload = parseDriveErrorFromText(await searchResponse.text());
    throw new Error(
      formatDriveErrorMessage('Não foi possível localizar subfolder no Google Drive', errorPayload),
    );
  }

  const searchData = await searchResponse.json();
  const existingFolder = searchData?.files?.[0];
  
  if (existingFolder?.id) {
    return existingFolder.id;
  }

  // Criar nova subfolder
  const createParams = new URLSearchParams({
    supportsAllDrives: 'true',
    fields: 'id,name',
  });

  const createResponse = await fetch(`${DRIVE_API_BASE}?${createParams.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      name: subfolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  if (!createResponse.ok) {
    const errorPayload = parseDriveErrorFromText(await createResponse.text());
    throw new Error(
      formatDriveErrorMessage('Não foi possível criar subfolder no Google Drive', errorPayload),
    );
  }

  const createData = await createResponse.json();
  return createData.id;
}

async function ensureClientFolder(
  token: string,
  clientId: string,
  clientName?: string,
): Promise<string | undefined> {
  if (!googleDriveConfig.rootFolderId) {
    return undefined;
  }

  const folderName = clientName?.trim() || clientId;
  const escapedFolderName = escapeForDriveQuery(folderName);
  const searchQueries = [
    `appProperties has { key='clientId' and value='${escapeForDriveQuery(clientId)}' } and mimeType='application/vnd.google-apps.folder' and trashed=false and '${googleDriveConfig.rootFolderId}' in parents`,
  ];

  if (clientName && clientName.trim().length > 0) {
    searchQueries.push(
      `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${googleDriveConfig.rootFolderId}' in parents`,
    );
  }

  // Fallback to previous behaviour to avoid duplicating folders that were created with the client ID
  searchQueries.push(
    `name='${escapeForDriveQuery(clientId)}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${googleDriveConfig.rootFolderId}' in parents`,
  );

  for (const query of searchQueries) {
    const searchParams = new URLSearchParams({
      q: query,
      fields: 'files(id,name)',
      pageSize: '1',
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
    });

    const searchResponse = await fetch(`${DRIVE_API_BASE}?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!searchResponse.ok) {
      const errorPayload = parseDriveErrorFromText(await searchResponse.text());
      throw new Error(
        formatDriveErrorMessage('Não foi possível localizar pasta do cliente no Google Drive', errorPayload),
      );
    }

    const searchData = await searchResponse.json();
    const existingFolder = searchData?.files?.[0];
    if (existingFolder?.id) {
      if (existingFolder.name !== folderName) {
        const updateParams = new URLSearchParams({
          supportsAllDrives: 'true',
          fields: 'id,name',
        });

        const updateResponse = await fetch(`${DRIVE_API_BASE}/${existingFolder.id}?${updateParams.toString()}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            name: folderName,
            appProperties: { clientId },
          }),
        });

        if (!updateResponse.ok) {
          const errorPayload = parseDriveErrorFromText(await updateResponse.text());
          throw new Error(
            formatDriveErrorMessage('Não foi possível atualizar pasta do cliente no Google Drive', errorPayload),
          );
        }
      } else {
        // Atualiza appProperties caso não esteja configurado
        await fetch(`${DRIVE_API_BASE}/${existingFolder.id}?supportsAllDrives=true&fields=id`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            appProperties: { clientId },
          }),
        }).catch(() => {
          // Silenciar erros ao tentar atualizar propriedades quando não é necessário
        });
      }

      return existingFolder.id as string;
    }
  }

  const createParams = new URLSearchParams({
    fields: 'id,name',
    supportsAllDrives: 'true',
  });

  const createResponse = await fetch(`${DRIVE_API_BASE}?${createParams.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [googleDriveConfig.rootFolderId],
      appProperties: { clientId },
    }),
  });

  if (!createResponse.ok) {
    const errorPayload = parseDriveErrorFromText(await createResponse.text());
    throw new Error(
      formatDriveErrorMessage('Não foi possível criar pasta do cliente no Google Drive', errorPayload),
    );
  }

  const createdData = await createResponse.json();
  return createdData?.id as string | undefined;
}

export async function uploadFileToDrive(options: UploadOptions): Promise<UploadResult> {
  const { file, clientId, clientName, sanitizedName, hash, subfolder, onProgress, onCreateRequest } = options;
  const token = await getDriveAccessToken();
  let folderId = await ensureClientFolder(token, clientId, clientName);
  
  // Se especificou subfolder, criar dentro da pasta do cliente
  if (subfolder && folderId) {
    folderId = await ensureSubfolder(token, folderId, subfolder);
  }

  const metadata: Record<string, unknown> = {
    name: sanitizedName,
    mimeType: file.type || 'application/octet-stream',
    appProperties: {
      clientId,
      sha256: hash,
    },
  };

  if (folderId) {
    metadata.parents = [folderId];
  } else if (googleDriveConfig.rootFolderId) {
    metadata.parents = [googleDriveConfig.rootFolderId];
  }

  const { body, contentType } = buildMultipartRequestBody(file, metadata);

  const uploadParams = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,name,size,webViewLink,webContentLink,appProperties',
    supportsAllDrives: 'true',
  });


  const buildErrorMessage = (xhr: XMLHttpRequest) => {
    const statusText = xhr.statusText || `${xhr.status}`;
    let details = '';
    try {
      const response = xhr.response ?? (xhr.responseText ? JSON.parse(xhr.responseText) : null);
      if (response && typeof response === 'object') {
        const message = (response as { error?: { message?: string }; message?: string }).error?.message
          ?? (response as { message?: string }).message;
        if (message) {
          details = ` - ${message}`;
        }
      }
    } catch (error) {
      // Ignorar erro ao parsear resposta
    }
    return `Falha ao enviar arquivo para o Google Drive: ${statusText}${details}`;
  };

  const attemptUpload = async (authToken: string, isRetry = false): Promise<UploadResult> => {
    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onCreateRequest) {
        onCreateRequest(xhr);
      }

      xhr.open('POST', `${DRIVE_UPLOAD_ENDPOINT}?${uploadParams.toString()}`, true);
      xhr.responseType = 'json';
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('Content-Type', contentType);



      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = xhr.response as DriveFileMetadata;
          resolve({
            id: response.id,
            name: response.name,
            size: Number(response.size ?? file.size),
            webViewLink: response.webViewLink,
            webContentLink: response.webContentLink,
            appProperties: response.appProperties ?? null,
          });
          return;
        }

        if (!isRetry && (xhr.status === 401 || xhr.status === 403)) {
          void (async () => {
            try {
              const refreshedToken = await getDriveAccessToken(true);
              const retryResult = await attemptUpload(refreshedToken, true);
              resolve(retryResult);
            } catch (retryError) {
              if (retryError instanceof Error) {
                reject(retryError);
              } else {
                reject(new Error('Falha ao renovar token do Google Drive'));
              }
            }
          })();
          return;
        }

        reject(new Error(buildErrorMessage(xhr)));
      };

      xhr.onerror = () => {
        reject(new Error('Erro de rede durante upload para o Google Drive'));
      };

      xhr.send(body);
    });
  };

  return attemptUpload(token);
}

export async function getDriveFileMetadata(fileId: string): Promise<DriveFileMetadata | null> {
  const token = await getDriveAccessToken();
  const metadataParams = new URLSearchParams({
    fields: 'id,name,size,webViewLink,webContentLink,appProperties',
    supportsAllDrives: 'true',
  });

  const response = await fetch(`${DRIVE_API_BASE}/${fileId}?${metadataParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorPayload = parseDriveErrorFromText(await response.text());
    throw new Error(
      formatDriveErrorMessage('Não foi possível obter metadados do Google Drive', errorPayload),
    );
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    size: data.size,
    webViewLink: data.webViewLink,
    webContentLink: data.webContentLink,
    appProperties: data.appProperties ?? null,
  };
}

export async function downloadDriveFile(fileId: string): Promise<Blob> {
  const token = await getDriveAccessToken();
  const downloadParams = new URLSearchParams({
    alt: 'media',
    supportsAllDrives: 'true',
  });

  const response = await fetch(`${DRIVE_API_BASE}/${fileId}?${downloadParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = parseDriveErrorFromText(await response.text());
    throw new Error(
      formatDriveErrorMessage('Não foi possível baixar o arquivo do Google Drive', errorPayload),
    );
  }

  return await response.blob();
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  const deleteParams = new URLSearchParams({
    supportsAllDrives: 'true',
  });

  const response = await fetch(`${DRIVE_API_BASE}/${fileId}?${deleteParams.toString()}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const errorPayload = parseDriveErrorFromText(await response.text());
    throw new Error(
      formatDriveErrorMessage('Não foi possível remover o arquivo do Google Drive', errorPayload),
    );
  }
}
