import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Paperclip, X, FileText, Image, Video, Mic, File } from "lucide-react";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { uploadFileToDrive } from "@/integrations/googleDrive/storage";
import { createHash } from "@/utils/fileValidation";

interface FileUploadProps {
  onFileUploaded: (file: UploadedFileInfo) => void;
  disabled?: boolean;
  clientId?: string;
  clientName?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  id: string;
}

export interface UploadedFileInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  driveFileId: string;
  webViewLink: string | null;
  webContentLink: string | null;
}

export function FileUpload({ onFileUploaded, disabled, clientId, clientName }: FileUploadProps) {
  const { user } = useAuth();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType.startsWith('video/')) return Video;
    if (fileType.startsWith('audio/')) return Mic;
    if (fileType === 'application/pdf' || fileType.includes('document')) return FileText;
    return File;
  };

  const getFileTypeColor = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'bg-blue-100 text-blue-800';
    if (fileType.startsWith('video/')) return 'bg-purple-100 text-purple-800';
    if (fileType.startsWith('audio/')) return 'bg-green-100 text-green-800';
    if (fileType === 'application/pdf') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isAllowedFileType = (file: File) => {
    const allowedSpecificTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (file.type) {
      if (file.type.startsWith('image/')) return true;
      if (file.type.startsWith('video/')) return true;
      if (file.type.startsWith('audio/')) return true;
      if (allowedSpecificTypes.includes(file.type)) return true;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension) return false;

    const allowedExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp',
      'mp4', 'mov', 'webm',
      'mp3', 'mpeg', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac',
      'pdf', 'doc', 'docx', 'txt'
    ];

    return allowedExtensions.includes(extension);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !user) return;

    Array.from(files).forEach(file => {
      // Validate file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de 20MB.`,
          variant: "destructive"
        });
        return;
      }

      // Validate file type using MIME type and file extension fallback
      if (!isAllowedFileType(file)) {
        toast({
          title: "Tipo de arquivo não suportado",
          description: `${file.name} não é um tipo de arquivo válido.`,
          variant: "destructive"
        });
        return;
      }

      uploadFile(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File) => {
    const fileId = Math.random().toString(36).substring(2);
    const uploadingFile: UploadingFile = {
      file,
      progress: 0,
      id: fileId
    };

    setUploadingFiles(prev => [...prev, uploadingFile]);

    try {
      // Sanitizar nome do arquivo
      const sanitizedName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_');

      // Calcular hash do arquivo
      const hash = await createHash(file);

      // Upload para Google Drive (pasta Chat do cliente)
      const uploadResult = await uploadFileToDrive({
        file,
        clientId: clientId || 'chat-internal',
        clientName: clientName || 'Chat Interno',
        sanitizedName,
        hash,
        subfolder: 'Chat', // Pasta Chat dentro da pasta do cliente
        onProgress: (progress) => {
          setUploadingFiles(prev =>
            prev.map(f =>
              f.id === fileId ? { ...f, progress } : f
            )
          );
        }
      });

      // Notify parent component with Google Drive info
      onFileUploaded({
        id: fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        driveFileId: uploadResult.id,
        webViewLink: uploadResult.webViewLink ?? null,
        webContentLink: uploadResult.webContentLink ?? null,
      });

      // Remove from uploading list after short delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
      }, 1000);

      toast({
        title: "Upload concluído",
        description: `${file.name} foi enviado para o Google Drive com sucesso.`
      });

    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
      
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : `Não foi possível enviar ${file.name}.`,
        variant: "destructive"
      });
    }
  };

  const removeUploadingFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <div className="space-y-2">
      {/* Upload button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="gap-2"
        >
          <Paperclip className="h-4 w-4" />
          Anexar
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        />
        <span className="text-xs text-muted-foreground">
          Imagens, vídeos, áudios, documentos (máx. 20MB)
        </span>
      </div>

      {/* Uploading files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile) => {
            const Icon = getFileIcon(uploadingFile.file.type);
            return (
              <div key={uploadingFile.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {uploadingFile.file.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge className={getFileTypeColor(uploadingFile.file.type)}>
                        {uploadingFile.file.type.split('/')[0]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(uploadingFile.file.size)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUploadingFile(uploadingFile.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={uploadingFile.progress} className="h-2" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}