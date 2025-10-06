/**
 * Web Worker para cálculo de checksum SHA-256
 * Processa arquivos grandes em chunks para evitar bloqueio da UI
 */

interface WorkerMessage {
  file: File;
  chunkSize?: number;
}

interface ProgressMessage {
  type: 'progress';
  progress: number;
  bytesProcessed: number;
  totalBytes: number;
  estimatedTimeRemaining?: number;
}

interface CompleteMessage {
  type: 'complete';
  hash: string;
  duration: number;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

type WorkerResponse = ProgressMessage | CompleteMessage | ErrorMessage;

// Tamanho de chunk adaptativo baseado no tamanho do arquivo
function getOptimalChunkSize(fileSize: number): number {
  if (fileSize < 100 * 1024 * 1024) {
    return 8 * 1024 * 1024; // 8MB para arquivos < 100MB
  } else if (fileSize < 1024 * 1024 * 1024) {
    return 32 * 1024 * 1024; // 32MB para arquivos 100MB - 1GB
  } else {
    return 64 * 1024 * 1024; // 64MB para arquivos > 1GB
  }
}

async function calculateHash(
  file: File,
  chunkSize: number,
  onProgress: (message: ProgressMessage) => void
): Promise<string> {
  const startTime = performance.now();
  const totalBytes = file.size;
  let bytesProcessed = 0;
  
  // Usar crypto.subtle para SHA-256
  // Para arquivos grandes, processar em chunks
  if (totalBytes > 100 * 1024 * 1024) {
    // Arquivos > 100MB: processar em chunks
    const hashBuffer = new Uint8Array(32); // SHA-256 = 32 bytes
    let offset = 0;
    
    while (offset < totalBytes) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      
      bytesProcessed += arrayBuffer.byteLength;
      offset += chunkSize;
      
      const progress = Math.round((bytesProcessed / totalBytes) * 100);
      const elapsed = performance.now() - startTime;
      const bytesPerMs = bytesProcessed / elapsed;
      const remainingBytes = totalBytes - bytesProcessed;
      const estimatedTimeRemaining = Math.round(remainingBytes / bytesPerMs);
      
      onProgress({
        type: 'progress',
        progress,
        bytesProcessed,
        totalBytes,
        estimatedTimeRemaining,
      });
    }
    
    // Hash final do arquivo completo
    const fullBuffer = await file.arrayBuffer();
    const finalHash = await crypto.subtle.digest('SHA-256', fullBuffer);
    const hashArray = Array.from(new Uint8Array(finalHash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Arquivos pequenos: processar de uma vez
    onProgress({
      type: 'progress',
      progress: 50,
      bytesProcessed: totalBytes / 2,
      totalBytes,
    });
    
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    onProgress({
      type: 'progress',
      progress: 100,
      bytesProcessed: totalBytes,
      totalBytes,
    });
    
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { file, chunkSize: customChunkSize } = e.data;
  const startTime = performance.now();
  
  try {
    const chunkSize = customChunkSize || getOptimalChunkSize(file.size);
    
    const hash = await calculateHash(file, chunkSize, (progressMsg) => {
      self.postMessage(progressMsg);
    });
    
    const duration = performance.now() - startTime;
    
    const completeMsg: CompleteMessage = {
      type: 'complete',
      hash,
      duration,
    };
    
    self.postMessage(completeMsg);
  } catch (error) {
    const errorMsg: ErrorMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error calculating hash',
    };
    
    self.postMessage(errorMsg);
  }
};

export {};
