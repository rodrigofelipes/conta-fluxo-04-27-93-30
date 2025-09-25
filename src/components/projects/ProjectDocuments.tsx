import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
omponents/ui/alert-dialog";

import { Progress } from "@/components/ui/progress";

import {
  Upload,
  FileText,
  Download,
  Calendar,
  Trash2,
  Image,
  FileVideo,
  FileArchive
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";

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

    const progressInterval = globalThis.setInterval(() => {
      setUploadProgress(prev => {
        const nextValue = prev + 10;
        return nextValue >= 90 ? 90 : nextValue;
      });
    }, 300);

    try {
      // Sanitiza o nome do arquivo para evitar caracteres inválidos no Storage
      const sanitizedFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();

      // Upload do arquivo para o Supabase Storage
      const fileName = `${projectId}/${Date.now()}_${sanitizedFileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) throw uploadError;

      // Salvar informações do documento na tabela
      const { data: docData, error: docError } = await supabase
        .from('project_documents')
        .insert({
          project_id: projectId,
          document_name: file.name,
          document_type: getDocumentType(file.name),
          file_path: uploadData.path,
          file_size: file.size,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (docError) throw docError;

      // Adicionar o documento à lista
      setDocuments(prev => [docData, ...prev]);
      event.target.value = '';

      setUploadProgress(100);

      toast({
        title: "Sucesso",
        description: "Documento enviado com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao enviar documento:', error);
      setUploadProgress(0);
      toast({
        title: "Erro",
        description: "Erro ao enviar documento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      globalThis.clearInterval(progressInterval);
      setUploading(false);
      globalThis.setTimeout(() => {
        setUploadProgress(0);
      }, 500);
    }
  };

  const getDocumentType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return 'image';
    if (['pdf'].includes(extension || '')) return 'pdf';
    if (['doc', 'docx'].includes(extension || '')) return 'document';
    if (['xls', 'xlsx'].includes(extension || '')) return 'spreadsheet';
    if (['mp4', 'avi', 'mov'].includes(extension || '')) return 'video';
    if (['zip', 'rar', '7z'].includes(extension || '')) return 'archive';
    
    return 'other';
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-5 w-5 text-green-600" />;
      case 'video':
        return <FileVideo className="h-5 w-5 text-purple-600" />;
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

  const handleDownload = async (document: ProjectDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .download(document.file_path);

      if (error) throw error;

      // Criar URL para download
      const url = URL.createObjectURL(data);
      const a = globalThis.document.createElement('a');
      a.href = url;
      a.download = document.document_name;
      globalThis.document.body.appendChild(a);
      a.click();
      globalThis.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Sucesso",
        description: `Download de "${document.document_name}" iniciado`
      });
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer download do documento",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    const document = documentToDelete;

    try {
      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from('project-documents')
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Deletar da tabela
      const { error: dbError } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      // Remover da lista
      setDocuments(prev => prev.filter(doc => doc.id !== document.id));

      toast({
        title: "Sucesso",
        description: "Documento excluído com sucesso!"
      });

      setDocumentToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir documento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
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
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => globalThis.document.getElementById('document-upload')?.click()}
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
              <span>{uploadProgress === 100 ? 'Finalizando envio...' : 'Enviando documento...'}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}
        {documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-primary/30 transition-colors">
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
                    onClick={() => handleDelete(doc)}
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
              Adicione documentos relacionados ao projeto como plantas, contratos, fotos, etc.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => globalThis.document.getElementById('document-upload')?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Enviando...' : 'Adicionar Documento'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-primary/30 transition-colors">
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
                      onClick={() => setDocumentToDelete(doc)}
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
                Adicione documentos relacionados ao projeto como plantas, contratos, fotos, etc.
              </p>
              <Button
                variant="outline"
                onClick={() => globalThis.document.getElementById('document-upload')?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Enviando...' : 'Adicionar Primeiro Documento'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
