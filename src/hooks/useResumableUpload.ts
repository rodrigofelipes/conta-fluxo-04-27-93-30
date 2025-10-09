import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  validateStorageCapacity,
  sanitizePath,
  formatFileSize,
  type ValidationResult,
  type StorageConfig,
} from '@/utils/fileValidation';
import { useNumericFeatureFlag } from './useFeatureFlag';
import {
  uploadFileToDrive,
  getDriveFileMetadata,
  type DriveFileMetadata,
} from '@/integrations/googleDrive/storage';

interface UploadOptions {
  file: File;
  clientId: string;
  onProgress?: (progress: number) => void;
  onHashProgress?: (progress: number, estimatedTime?: number) => void;
  onComplete?: (documentId: string) => void;
  onError?: (error: Error) => void;
}

interface UploadState {
  uploading: boolean;
  paused: boolean;
  progress: number;
  hashProgress: number;
  calculatingHash: boolean;
  documentId: string | null;
  error: string | null;
}

export function useResumableUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    paused: false,
    progress: 0,
    hashProgress: 0,
    calculatingHash: false,
    documentId: null,
    error: null,
  });

  const uploadRef = useRef<XMLHttpRequest | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const metricsRef = useRef({
    hashStartTime: 0,
    hashEndTime: 0,
    uploadStartTime: 0,
    uploadEndTime: 0,
    retryCount: 0,
  });

  // Feature flags
  const maxFileSizeGB = useNumericFeatureFlag('max_file_size_gb', 5);
  const clientQuotaGB = useNumericFeatureFlag('storage_quota_per_client_gb', 10);

  /**
   * Log de evento no banco
   */
  const logEvent = useCallback(async (
    eventType: string,
    documentId: string | null,
    metadata?: Record<string, any>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('document_events_log').insert({
        document_id: documentId,
        user_id: user?.id,
        event_type: eventType,
        metadata: metadata || {},
      });
    } catch (error) {
      console.error('Error logging event:', error);
    }
  }, []);

  /**
   * Calcular hash usando Web Worker
   */
  const calculateHash = useCallback((
    file: File,
    onProgress: (progress: number, estimatedTime?: number) => void
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Criar worker
      const worker = new Worker(
        new URL('../workers/checksumWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      workerRef.current = worker;
      metricsRef.current.hashStartTime = Date.now();

      worker.onmessage = (e) => {
        const { type, progress, hash, error, estimatedTimeRemaining } = e.data;

        if (type === 'progress') {
          onProgress(progress, estimatedTimeRemaining);
        } else if (type === 'complete') {
          metricsRef.current.hashEndTime = Date.now();
          worker.terminate();
          workerRef.current = null;
          resolve(hash);
        } else if (type === 'error') {
          worker.terminate();
          workerRef.current = null;
          reject(new Error(error));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        workerRef.current = null;
        reject(error);
      };

      worker.postMessage({ file });
    });
  }, []);

  /**
   * Verificar arquivo após upload usando metadados do Storage
   */
  const verifyUploadedFile = useCallback(async (
    driveFileId: string,
    expectedSize: number,
    expectedHash: string,
    documentId: string,
    driveMetadata?: DriveFileMetadata | null,
  ): Promise<boolean> => {
    try {
      await logEvent('verification_started', documentId);

      const metadata = driveMetadata ?? await getDriveFileMetadata(driveFileId);
      if (!metadata) {
        await logEvent('verification_failed', documentId, {
          reason: 'file_not_found',
        });
        toast({
          title: 'Erro na verificação',
          description: 'Arquivo não encontrado no Google Drive.',
          variant: 'destructive',
        });
        return false;
      }

      const actualSize = Number(metadata.size ?? 0);
      if (Number.isNaN(actualSize) || Math.abs(actualSize - expectedSize) > 1024) {
        await logEvent('verification_failed', documentId, {
          reason: 'size_mismatch',
          expected: expectedSize,
          actual: actualSize,
        });

        toast({
          title: 'Erro na verificação',
          description: `Tamanho divergente. Esperado: ${formatFileSize(expectedSize)}, obtido: ${formatFileSize(actualSize)}`,
          variant: 'destructive',
        });

        return false;
      }

      const storedHash = metadata.appProperties?.sha256;
      if (storedHash && storedHash !== expectedHash) {
        await logEvent('verification_failed', documentId, {
          reason: 'hash_mismatch',
          expected: expectedHash,
          actual: storedHash,
        });

        toast({
          title: 'Erro na verificação',
          description: 'Hash divergente do arquivo enviado.',
          variant: 'destructive',
        });

        return false;
      }

      await supabase
        .from('client_documents')
        .update({
          upload_status: 'verified',
          verified_at: new Date().toISOString(),
          file_path: driveFileId,
          file_size: actualSize,
          verification_metadata: {
            storage_provider: 'google_drive',
            google_drive: {
              file_id: driveFileId,
              webViewLink: metadata.webViewLink ?? null,
              webContentLink: metadata.webContentLink ?? null,
              appProperties: metadata.appProperties ?? null,
            },
            expected_hash: expectedHash,
            verified_at: new Date().toISOString(),
            verified_method: 'google_drive_metadata',
          },
        })
        .eq('id', documentId);

      await logEvent('verification_completed', documentId, {
        size: actualSize,
        hash: storedHash ?? expectedHash,
        provider: 'google_drive',
      });

      return true;
    } catch (error) {
      console.error('Verification error:', error);
      await logEvent('verification_failed', documentId, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }, [logEvent]);

  /**
   * Registrar métricas de upload
   */
  const trackMetrics = useCallback(async (
    documentId: string,
    fileSize: number,
    method: 'resumable' | 'signed' | 'standard' | 'google_drive',
    success: boolean,
    errorMessage?: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: document } = await supabase
        .from('client_documents')
        .select('client_id')
        .eq('id', documentId)
        .single();

      const hashDuration = metricsRef.current.hashEndTime - metricsRef.current.hashStartTime;
      const uploadDuration = metricsRef.current.uploadEndTime - metricsRef.current.uploadStartTime;
      const speedMbps = uploadDuration > 0
        ? ((fileSize / (uploadDuration / 1000)) / (1024 * 1024)) * 8
        : 0;

      await supabase.from('upload_metrics').insert({
        user_id: user?.id,
        client_id: document?.client_id,
        document_id: documentId,
        file_size: fileSize,
        upload_method: method,
        hash_duration_ms: hashDuration,
        upload_duration_ms: uploadDuration,
        upload_speed_mbps: speedMbps,
        retry_count: metricsRef.current.retryCount,
        success,
        error_message: errorMessage,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error('Error tracking metrics:', error);
    }
  }, []);

  /**
   * Iniciar upload
   */
  const startUpload = useCallback(async (options: UploadOptions) => {
    const { file, clientId, onProgress, onHashProgress, onComplete, onError } = options;

    try {
      // 1. Validação pré-upload
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Obter configuração do sistema
      const { data: planConfig } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'supabase_plan')
        .maybeSingle();

      const plan = (planConfig?.config_value as 'free' | 'pro' | 'team') || 'pro';

      // Calcular uso atual do cliente
      const { data: usageData } = await supabase
        .rpc('calculate_client_storage_usage', { client_id_param: clientId });
      
      const currentUsage = usageData || 0;

      const config: StorageConfig = {
        plan,
        maxFileSize: maxFileSizeGB * 1024 * 1024 * 1024,
        clientQuota: clientQuotaGB * 1024 * 1024 * 1024,
      };

      const validation = await validateStorageCapacity(file, config, currentUsage);
      
      if (!validation.valid) {
        toast({
          title: 'Validação falhou',
          description: validation.error,
          variant: 'destructive',
        });
        onError?.(new Error(validation.error));
        return;
      }

      // 2. Calcular hash
      setState(prev => ({ ...prev, calculatingHash: true, hashProgress: 0 }));
      await logEvent('hash_started', null, { file_name: file.name, file_size: file.size });

      const hash = await calculateHash(file, (progress, estimatedTime) => {
        setState(prev => ({ ...prev, hashProgress: progress }));
        onHashProgress?.(progress, estimatedTime);
      });

      await logEvent('hash_completed', null, { hash });
      setState(prev => ({ ...prev, calculatingHash: false }));

      // 3. Criar registro no banco
      const sanitizedName = sanitizePath(file.name);

      const { data: document, error: dbError } = await supabase
        .from('client_documents')
        .insert({
          client_id: clientId,
          document_name: sanitizedName,
          document_type: file.type,
          file_size: file.size,
          file_path: sanitizedName,
          file_hash: hash,
          upload_status: 'uploading',
          upload_started_at: new Date().toISOString(),
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (dbError || !document) {
        throw new Error('Falha ao criar registro do documento');
      }

      setState(prev => ({ ...prev, documentId: document.id }));
      await logEvent('upload_started', document.id, { file_name: sanitizedName });

      metricsRef.current.uploadStartTime = Date.now();
      setState(prev => ({ ...prev, uploading: true, progress: 0 }));

      try {
        const uploadResult = await uploadFileToDrive({
          file,
          clientId,
          sanitizedName,
          hash,
          onProgress: (progress) => {
            setState(prev => ({ ...prev, progress, uploading: true }));
            onProgress?.(progress);

            if (progress % 10 === 0) {
              supabase
                .from('client_documents')
                .update({ upload_progress: progress })
                .eq('id', document.id)
                .then(() => {});
            }
          },
          onCreateRequest: (xhr) => {
            uploadRef.current = xhr;
          },
        });

        metricsRef.current.uploadEndTime = Date.now();
        uploadRef.current = null;

        await logEvent('upload_completed', document.id, { drive_file_id: uploadResult.id });
        await supabase
          .from('client_documents')
          .update({
            upload_status: 'verifying',
            upload_completed_at: new Date().toISOString(),
            upload_progress: 100,
          })
          .eq('id', document.id);

        const verified = await verifyUploadedFile(
          uploadResult.id,
          uploadResult.size,
          hash,
          document.id,
          uploadResult,
        );

        await trackMetrics(document.id, file.size, 'google_drive', verified);

        setState(prev => ({
          ...prev,
          uploading: false,
          progress: 100,
        }));

        if (verified) {
          toast({
            title: 'Upload concluído',
            description: 'Arquivo enviado e verificado com sucesso!',
          });
          onComplete?.(document.id);
        } else {
          toast({
            title: 'Erro na verificação',
            description: 'Arquivo enviado mas falhou na verificação de integridade.',
            variant: 'destructive',
          });
          onError?.(new Error('Verification failed'));
        }
      } catch (uploadError) {
        metricsRef.current.uploadEndTime = Date.now();
        uploadRef.current = null;

        const message = uploadError instanceof Error ? uploadError.message : 'Falha no upload para o Google Drive';

        await logEvent('upload_failed', document.id, { error: message });
        await trackMetrics(document.id, file.size, 'google_drive', false, message);

        setState(prev => ({
          ...prev,
          uploading: false,
          error: message,
        }));

        toast({
          title: 'Erro no upload',
          description: message,
          variant: 'destructive',
        });

        onError?.(uploadError instanceof Error ? uploadError : new Error(message));
        return;
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setState(prev => ({
        ...prev,
        uploading: false,
        calculatingHash: false,
        error: errorMessage,
      }));
      
      toast({
        title: 'Erro no upload',
        description: errorMessage,
        variant: 'destructive',
      });
      
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [
    calculateHash,
    logEvent,
    verifyUploadedFile,
    trackMetrics,
    maxFileSizeGB,
    clientQuotaGB,
  ]);

  /**
   * Pausar upload
   */
  const pauseUpload = useCallback(async () => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }

    setState(prev => ({ ...prev, paused: true, uploading: false }));

    if (state.documentId) {
      await logEvent('upload_paused', state.documentId, { progress: state.progress });
      await supabase
        .from('client_documents')
        .update({ upload_status: 'paused' })
        .eq('id', state.documentId);
    }

    toast({
      title: 'Upload pausado',
      description: 'Ao retomar será necessário reiniciar o envio do arquivo.',
    });
  }, [state.documentId, state.progress, logEvent]);

  /**
   * Retomar upload
   */
  const resumeUpload = useCallback(async () => {
    setState(prev => ({ ...prev, paused: false }));

    if (state.documentId) {
      await logEvent('upload_resumed', state.documentId, { progress: state.progress });
      await supabase
        .from('client_documents')
        .update({ upload_status: 'uploading' })
        .eq('id', state.documentId);
    }

    toast({
      title: 'Reinicie o envio',
      description: 'Selecione o arquivo novamente para continuar o upload ao Google Drive.',
    });
  }, [state.documentId, state.progress, logEvent]);

  /**
   * Cancelar upload
   */
  const cancelUpload = useCallback(async () => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    if (state.documentId) {
      await logEvent('upload_cancelled', state.documentId);
      await supabase
        .from('client_documents')
        .delete()
        .eq('id', state.documentId);
    }

    setState({
      uploading: false,
      paused: false,
      progress: 0,
      hashProgress: 0,
      calculatingHash: false,
      documentId: null,
      error: null,
    });
  }, [state.documentId, logEvent]);

  return {
    ...state,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
  };
}
