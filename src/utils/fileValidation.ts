/**
 * Utilitários para validação e sanitização de arquivos
 */

// MIME types permitidos (whitelist)
export const ALLOWED_MIMES = new Set([
  // Imagens
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  
  // PDFs
  'application/pdf',
  
  // Microsoft Office
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // CAD
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'application/dwg',
  'application/x-dwg',
  'application/x-autocad',
  'application/dxf',
  
  // Arquivos compactados
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  
  // Vídeos
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  
  // Texto
  'text/plain',
  'text/csv',
]);

/**
 * Sanitiza o nome do arquivo removendo caracteres especiais e acentos
 */
export function sanitizePath(filename: string): string {
  // Separar nome e extensão
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
  
  // Remover acentos e diacríticos
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Substituir caracteres especiais por underscore
  const sanitized = normalized
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  // Limitar comprimento do nome (max 100 caracteres)
  const truncated = sanitized.substring(0, 100);
  
  // Retornar nome sanitizado + extensão original (em lowercase)
  return truncated + extension.toLowerCase();
}

/**
 * Valida o tipo MIME do arquivo contra a whitelist
 */
export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIMES.has(mimeType);
}

/**
 * Formata tamanho de arquivo em formato legível
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Valida capacidade de armazenamento antes do upload
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  action?: 'upgrade_required' | 'file_too_large' | 'quota_exceeded' | 'mime_not_allowed';
}

export interface StorageConfig {
  plan: 'free' | 'pro' | 'team';
  maxFileSize: number;
  clientQuota: number;
}

export async function validateStorageCapacity(
  file: File,
  config: StorageConfig,
  currentUsage: number
): Promise<ValidationResult> {
  // 1. Validar MIME type
  if (!validateMimeType(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido: ${file.type}. Consulte a lista de tipos aceitos.`,
      action: 'mime_not_allowed',
    };
  }
  
  // 2. Validar plano Supabase
  if (config.plan === 'free' && file.size > 50 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Plano Free limitado a 50MB por arquivo. Upgrade para Pro/Team é necessário para arquivos maiores.',
      action: 'upgrade_required',
    };
  }
  
  // 3. Validar limite global de arquivo
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `Arquivo excede o limite máximo de ${formatFileSize(config.maxFileSize)}.`,
      action: 'file_too_large',
    };
  }
  
  // 4. Validar cota do cliente
  if (currentUsage + file.size > config.clientQuota) {
    const available = config.clientQuota - currentUsage;
    return {
      valid: false,
      error: `Cota de armazenamento excedida. Disponível: ${formatFileSize(available)}, necessário: ${formatFileSize(file.size)}.`,
      action: 'quota_exceeded',
    };
  }
  
  return { valid: true };
}

/**
 * Calcula tempo estimado de upload baseado em velocidade média
 */
export function estimateUploadTime(
  fileSize: number,
  speedMbps: number = 10 // Velocidade padrão: 10 Mbps
): { seconds: number; formatted: string } {
  const speedBytesPerSecond = (speedMbps * 1024 * 1024) / 8;
  const seconds = Math.ceil(fileSize / speedBytesPerSecond);
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  let formatted = '';
  if (hours > 0) formatted += `${hours}h `;
  if (minutes > 0) formatted += `${minutes}min `;
  formatted += `${secs}s`;
  
  return { seconds, formatted };
}
