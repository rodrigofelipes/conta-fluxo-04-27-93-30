import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Eye, 
  FileText, 
  Download, 
  Calendar, 
  MapPin, 
  User, 
  DollarSign,
  Clock,
  FolderOpen,
  MessageCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PhaseClientContacts } from "./PhaseClientContacts";

interface ProjectData {
  id: string;
  title: string;
  description?: string;
  status: string;
  address?: string;
  contracted_value: number;
  contracted_hours?: number;
  executed_hours?: number;
  created_at: string;
  client_id: string;
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
}

interface ProjectDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_size: number;
  created_at: string;
  uploaded_by: string;
  file_path?: string;
  uploader_name?: string;
}

interface ProjectObservationDialogProps {
  projectId: string;
  children: React.ReactNode;
}

export function ProjectObservationDialog({ projectId, children }: ProjectObservationDialogProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [contactsCount, setContactsCount] = useState(0);

  useEffect(() => {
    if (open && projectId) {
      loadProjectData();
    }
  }, [open, projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);

      // Carregar dados do projeto
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(id, name, email, phone)
        `)
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Carregar documentos do projeto
      const { data: documentsData, error: documentsError } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (documentsError) throw documentsError;

      // Buscar nomes dos uploaders
      const uploaderIds = [...new Set((documentsData || []).map(doc => doc.uploaded_by))];
      let uploaderNames: Record<string, string> = {};
      
      if (uploaderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', uploaderIds);
        
        uploaderNames = (profilesData || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const processedDocuments = (documentsData || []).map(doc => ({
        ...doc,
        uploader_name: uploaderNames[doc.uploaded_by] || 'Usuário desconhecido'
      }));

      setProject(projectData);
      setDocuments(processedDocuments);
      
      // Carregar contagem de contatos
      if (projectData.client_id) {
        const { count } = await supabase
          .from('client_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', projectData.client_id)
          .not('subject', 'ilike', '%Mensagem%via WhatsApp%');
        
        setContactsCount(count || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do projeto:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do projeto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return 'bg-blue-100 text-blue-800';
      case 'concluido':
        return 'bg-green-100 text-green-800';
      case 'pausado':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'orcamento':
        return 'Orçamento';
      case 'em_andamento':
        return 'Em Andamento';
      case 'concluido':
        return 'Concluído';
      case 'pausado':
        return 'Pausado';
      default:
        return status;
    }
  };

  const downloadDocument = async (document: ProjectDocument) => {
    try {
      if (!document.file_path) {
        toast({
          title: "Erro",
          description: "Caminho do arquivo não encontrado.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.storage
        .from('project-documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.document_name;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: `Download de "${document.document_name}" iniciado.`
      });
    } catch (error) {
      console.error('Erro ao baixar documento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar o documento.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Detalhes do Projeto
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : project ? (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="documents">
                Documentos ({documents.length})
              </TabsTrigger>
              <TabsTrigger value="contacts">
                Contatos ({contactsCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  {/* Informações básicas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {project.title}
                        <Badge className={getStatusColor(project.status)}>
                          {getStatusLabel(project.status)}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {project.description && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground">Descrição</h4>
                          <p className="text-sm">{project.description}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm font-medium">Cliente: </span>
                            <span className="text-sm">{project.client.name}</span>
                          </div>
                        </div>

                        {project.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="text-sm font-medium">Endereço: </span>
                              <span className="text-sm">{project.address}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm font-medium">Criado em: </span>
                            <span className="text-sm">{formatDate(project.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm font-medium">Valor: </span>
                            <span className="text-sm">{formatCurrency(project.contracted_value)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Informações de horas */}
                  {(project.contracted_hours || project.executed_hours) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Controle de Horas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {project.contracted_hours && (
                            <div>
                              <span className="text-sm font-medium">Horas Contratadas: </span>
                              <span className="text-sm">{project.contracted_hours}h</span>
                            </div>
                          )}
                          {project.executed_hours && (
                            <div>
                              <span className="text-sm font-medium">Horas Executadas: </span>
                              <span className="text-sm">{project.executed_hours}h</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Informações de contato */}
                  {(project.client.email || project.client.phone) && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Contato do Cliente</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {project.client.email && (
                            <div>
                              <span className="text-sm font-medium">Email: </span>
                              <span className="text-sm">{project.client.email}</span>
                            </div>
                          )}
                          {project.client.phone && (
                            <div>
                              <span className="text-sm font-medium">Telefone: </span>
                              <span className="text-sm">{project.client.phone}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="documents">
              <ScrollArea className="h-[60vh]">
                {documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((document) => (
                      <Card key={document.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-8 w-8 text-primary" />
                              <div>
                                <h4 className="font-medium text-sm">{document.document_name}</h4>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{document.document_type}</span>
                                  <span>•</span>
                                  <span>{formatFileSize(document.file_size)}</span>
                                  <span>•</span>
                                  <span>{formatDate(document.created_at)}</span>
                                </div>
                                {document.uploader_name && (
                                  <p className="text-xs text-muted-foreground">
                                    Enviado por: {document.uploader_name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadDocument(document)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Baixar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum documento encontrado</h3>
                    <p className="text-muted-foreground">
                      Este projeto ainda não possui documentos anexados.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="contacts">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Histórico de Contatos com {project.client.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {project.client_id ? (
                        <PhaseClientContacts clientId={project.client_id} />
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Informações do cliente não disponíveis.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Projeto não encontrado.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}