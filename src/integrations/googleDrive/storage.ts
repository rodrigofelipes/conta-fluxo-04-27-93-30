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
  sanitizedName: string;
  hash: string;
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
  const { data, error } = await supabase.functions.invoke(googleDriveConfig.serviceAccountTokenFunction, {
    method: 'POST',
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

async function ensureClientFolder(token: string, clientId: string): Promise<string | undefined> {
  if (!googleDriveConfig.rootFolderId) {
    return undefined;
  }

  const query = encodeURIComponent(
    `name='${clientId}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${googleDriveConfig.rootFolderId}' in parents`,
  );

  const searchResponse = await fetch(`${DRIVE_API_BASE}?q=${query}&fields=files(id,name)&pageSize=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!searchResponse.ok) {
    const error = await searchResponse.text();
    throw new Error(`Não foi possível localizar pasta do cliente no Google Drive: ${error}`);
  }

  const searchData = await searchResponse.json();
  const existingId = searchData?.files?.[0]?.id as string | undefined;
  if (existingId) {
    return existingId;
  }

  const createResponse = await fetch(`${DRIVE_API_BASE}?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      name: clientId,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [googleDriveConfig.rootFolderId],
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Não foi possível criar pasta do cliente no Google Drive: ${error}`);
  }

  const createdData = await createResponse.json();
  return createdData?.id as string | undefined;
}

export async function uploadFileToDrive(options: UploadOptions): Promise<UploadResult> {
  const { file, clientId, sanitizedName, hash, onProgress, onCreateRequest } = options;
  const token = await getDriveAccessToken();
  const folderId = await ensureClientFolder(token, clientId);

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

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onCreateRequest) {
      onCreateRequest(xhr);
    }
    xhr.open('POST', `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,size,webViewLink,webContentLink,appProperties`, true);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
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
      } else {
        reject(new Error(`Falha ao enviar arquivo para o Google Drive: ${xhr.statusText || xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Erro de rede durante upload para o Google Drive'));
    };

    xhr.send(body);
  });
}

export async function getDriveFileMetadata(fileId: string): Promise<DriveFileMetadata | null> {
  const token = await getDriveAccessToken();
  const response = await fetch(`${DRIVE_API_BASE}/${fileId}?fields=id,name,size,webViewLink,webContentLink,appProperties`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Não foi possível obter metadados do Google Drive: ${error}`);
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
  const response = await fetch(`${DRIVE_API_BASE}/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Não foi possível baixar o arquivo do Google Drive: ${error}`);
  }

  return await response.blob();
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  const response = await fetch(`${DRIVE_API_BASE}/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Não foi possível remover o arquivo do Google Drive: ${error}`);
  }
}
