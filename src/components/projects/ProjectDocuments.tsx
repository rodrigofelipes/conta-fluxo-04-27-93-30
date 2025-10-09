import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, FileText, Trash2, Image, FileVideo, FileArchive, FileAudio, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/state/auth';
import { uploadFileToDrive, getDriveFileMetadata, downloadDriveFile } from '@/integrations/googleDrive/storage';
import { createHash } from '@/utils/fileValidation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from '@/components/ui/progress';

interface ProjectDocument {
  id: string;
  project_id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

interface ProjectDocumentsProps {
  projectId: string;
}

export function ProjectDocuments({ projectId }: ProjectDocumentsProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ProjectDocument | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar documentos do projeto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Sanitizar nome do arquivo
      const sanitizedFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();

      // Calcular hash do arquivo
      const hash = await createHash(file);

      // Buscar nome do projeto para usar como nome da pasta
      const { data: projectData } = await supabase
        .from('projects')
        .select('title, client_id')
        .eq('id', projectId)
        .single();

      const projectName = projectData?.title || projectId;

      // Upload para Google Drive
      const uploadResult = await uploadFileToDrive({
        file,
        clientId: projectData?.client_id || projectId,
        clientName: `Projeto: ${projectName}`,
        sanitizedName: sanitizedFileName,
        hash,
        onProgress: (progress) => {
          setUploadProgress(Math.min(progress, 95));
        }
      });

      // Salvar metadados no banco
      const { data: docData, error: docError } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          document_name: file.name,
          document_type: getDocumentType(file.name),
          file_path: uploadResult.id, // ID do Google Drive
          file_size: file.size,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (docError) throw docError;

      // Adicionar documento à lista
      setDocuments(prev => [docData, ...prev]);
      event.target.value = '';

      setUploadProgress(100);

      toast({
        title: 'Upload concluído',
        description: `${file.name} foi enviado para o Google Drive com sucesso.`,
      });

      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
      }, 1000);

    } catch (error) {
      console.error('Erro no upload:', error);
      setUploading(false);
      setUploadProgress(0);

      toast({
        title: 'Erro no upload',
        description: error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
    }
  };

  const getDocumentType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return 'other';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(extension)) return 'document';
    if (['xls', 'xlsx'].includes(extension)) return 'spreadsheet';
    if (['mp4', 'avi', 'mov'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac'].includes(extension)) return 'audio';
    if (['zip', 'rar', '7z'].includes(extension)) return 'archive';

    return 'other';
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-5 w-5 text-green-600" />;
      case 'video':
        return <FileVideo className="h-5 w-5 text-purple-600" />;
      case 'audio':
        return <FileAudio className="h-5 w-5 text-amber-600" />;
      case 'archive':
        return <FileArchive className="h-5 w-5 text-orange-600" />;
      default:
        return <FileText className="h-5 w-5 text-blue-600" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      const fileId = doc.file_path;
      if (!fileId) throw new Error('Arquivo não disponível');
      
      const blob = await downloadDriveFile(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name || 'documento';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'Download concluído',
        description: `${doc.document_name} foi baixado do Google Drive com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast({
        title: 'Erro no download',
        description: error instanceof Error ? error.message : 'Não foi possível baixar o arquivo.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (document: ProjectDocument) => {
    try {
      // Deletar do banco
      const { error: dbError } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      // Nota: arquivos no Google Drive permanecem (não deletamos automaticamente)

      setDocuments(prev => prev.filter(doc => doc.id !== document.id));

      toast({
        title: 'Documento removido',
        description: 'O documento foi removido da lista com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir documento. Tente novamente.',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const openDeleteDialog = (document: ProjectDocument) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
    setDeleteLoading(false);
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;

    setDeleteLoading(true);
    try {
      await handleDelete(documentToDelete);
      closeDeleteDialog();
    } catch (error) {
      console.error('Erro ao confirmar exclusão:', error);
      setDeleteLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-center">Carregando documentos...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Documentos do Projeto
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            id="document-upload"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,.txt"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('document-upload')?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Enviando...' : 'Adicionar Documento'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(uploading || uploadProgress > 0) && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{uploadProgress === 100 ? 'Finalizando envio...' : 'Enviando para Google Drive...'}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}
        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    {getDocumentIcon(doc.document_type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{doc.document_name}</h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <span className="text-green-600">Google Drive</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    className="p-2"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(doc)}
                    className="p-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">Nenhum documento anexado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione documentos relacionados ao projeto. Serão armazenados no Google Drive.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('document-upload')?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Enviando...' : 'Adicionar Documento'}
            </Button>
          </div>
        )}
      </CardContent>
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          closeDeleteDialog();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir o documento{' '}
              <span className="font-semibold">{documentToDelete?.document_name}</span>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog} disabled={deleteLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDocument} disabled={deleteLoading}>
              {deleteLoading ? 'Excluindo...' : 'Excluir' }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}