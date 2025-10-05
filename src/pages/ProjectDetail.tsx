import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Users, Eye, Clock, Settings, Edit, Save, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProjectPhases } from "@/components/projects/ProjectPhases";
import { ProjectDocuments } from "@/components/projects/ProjectDocuments";
import { ClientContactsCard } from "@/components/client/ClientContactsCard";
import { useAuth } from "@/state/auth";

interface Project {
  id: string;
  title: string;
  address: string;
  briefing_document?: string;
  description: string;
  contracted_hours: number;
  contracted_value: number;
  executed_hours: number;
  visits_count: number;
  meetings_count: number;
  status: "orçamento" | "aguardando_retorno" | "em_andamento" | "em_obra" | "concluído";
  created_at: string;
  updated_at: string;
  client_id: string;
  client?: { name: string; email?: string };
}

const statusLabel: Record<Project["status"], string> = {
  "orçamento": "Orçamento",
  aguardando_retorno: "Aguardando Retorno",
  em_andamento: "Em Andamento",
  em_obra: "Em Obra",
  concluído: "Concluído",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados para edição
  const [editData, setEditData] = useState({
    title: "",
    address: "",
    description: "",
    contracted_hours: 0,
    visits_count: 0,
    meetings_count: 0,
    briefing_document: ""
  });

  // Não redirecionar colaboradores - eles podem ver detalhes do projeto
  // Redirect users to their tasks page
  // useEffect(() => {
  //   if (user?.role === 'user') {
  //     // Redirect users to their phases page instead
  //     navigate('/user-projects', { replace: true });
  //     return;
  //   }
  // }, [user?.role, navigate]);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      
      setLoading(true);
      
      // Buscar dados do usuário atual
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', userData.user.id)
          .single();
        
        setCurrentUser(profileData);
      }

      // Buscar projeto
      const { data, error } = await supabase
        .from("projects")
        .select(`*, client:clients(name, email)`) 
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao carregar projeto:", error);
      } else {
        const projectData = data as unknown as Project;
        setProject(projectData);
        // Inicializar dados de edição
        setEditData({
          title: projectData.title || "",
          address: projectData.address || "",
          description: projectData.description || "",
          contracted_hours: projectData.contracted_hours || 0,
          visits_count: projectData.visits_count || 0,
          meetings_count: projectData.meetings_count || 0,
          briefing_document: projectData.briefing_document || ""
        });
        document.title = `Projeto: ${projectData.title}`;
      }
      
      setLoading(false);
    };

    loadData();
  }, [id]);

  // Não bloquear colaboradores de ver a página
  // if (user?.role === 'user') {
  //   return null;
  // }

  const handleStatusChange = async (newStatus: Project["status"]) => {
    if (!project || !currentUser || (currentUser.role !== 'supervisor' && currentUser.role !== 'admin')) return;
    
    setUpdatingStatus(true);
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);
      
      if (error) throw error;
      
      setProject({ ...project, status: newStatus });
      
      toast({
        title: "Status atualizado",
        description: `Status do projeto alterado para: ${statusLabel[newStatus]}`
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do projeto.",
        variant: "destructive"
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStartEdit = () => {
    if (!project) return;
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!project) return;
    // Restaurar dados originais
    setEditData({
      title: project.title || "",
      address: project.address || "",
      description: project.description || "",
      contracted_hours: project.contracted_hours || 0,
      visits_count: project.visits_count || 0,
      meetings_count: project.meetings_count || 0,
      briefing_document: project.briefing_document || ""
    });
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!project || !id) return;
    
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          title: editData.title,
          address: editData.address,
          description: editData.description,
          contracted_hours: editData.contracted_hours,
          visits_count: editData.visits_count,
          meetings_count: editData.meetings_count,
          briefing_document: editData.briefing_document
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Atualizar o projeto local
      setProject({
        ...project,
        title: editData.title,
        address: editData.address,
        description: editData.description,
        contracted_hours: editData.contracted_hours,
        visits_count: editData.visits_count,
        meetings_count: editData.meetings_count,
        briefing_document: editData.briefing_document
      });
      
      setIsEditing(false);
      
      toast({
        title: "Projeto atualizado",
        description: "As alterações foram salvas com sucesso."
      });
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const canChangeStatus = currentUser?.role === 'supervisor' || currentUser?.role === 'admin';

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projeto" subtitle="Carregando detalhes..." />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projeto não encontrado" subtitle="Verifique o link e tente novamente" />
        <Button asChild variant="outline">
          <Link to="/projects">Voltar aos Projetos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Projeto: ${project.title}`}
        subtitle={project.client?.name ? `Cliente: ${project.client.name}` : undefined}
      />

      <div className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link to="/projects">Voltar</Link>
        </Button>
        <Badge variant="secondary">{statusLabel[project.status]}</Badge>
        
        {/* Botões de edição */}
        {!isEditing ? (
          <Button onClick={handleStartEdit} variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Editar Projeto
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button 
              onClick={handleSaveEdit} 
              variant="default" 
              size="sm"
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button 
              onClick={handleCancelEdit} 
              variant="outline" 
              size="sm"
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações {isEditing && "(Editando)"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Título */}
            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="title">Título do Projeto</Label>
                <Input
                  id="title"
                  value={editData.title}
                  onChange={(e) => setEditData({...editData, title: e.target.value})}
                  placeholder="Digite o título do projeto"
                />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium mb-1">Título</p>
                <p className="text-sm text-muted-foreground">{project.title}</p>
              </div>
            )}

            {/* Endereço */}
            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={editData.address}
                  onChange={(e) => setEditData({...editData, address: e.target.value})}
                  placeholder="Digite o endereço do projeto"
                />
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className="text-sm text-muted-foreground">{project.address}</span>
              </div>
            )}

            {/* Descrição */}
            {isEditing ? (
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={editData.description}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  placeholder="Digite a descrição do projeto"
                  rows={4}
                />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium mb-1">Descrição</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {project.description || "Sem descrição"}
                </p>
              </div>
            )}

            {/* Briefing Document - apenas em modo de edição */}
            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="briefing">Documento de Briefing</Label>
                <Input
                  id="briefing"
                  value={editData.briefing_document}
                  onChange={(e) => setEditData({...editData, briefing_document: e.target.value})}
                  placeholder="Digite o briefing do projeto"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo {isEditing && "(Editando)"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Horas Contratadas */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" /> Horas Contratadas
              </span>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.contracted_hours}
                  onChange={(e) => setEditData({...editData, contracted_hours: Number(e.target.value)})}
                  className="w-20 h-8 text-right"
                  min="0"
                  step="0.1"
                />
              ) : (
                <span className="font-medium">{project.contracted_hours || 0}h</span>
              )}
            </div>
            
            {/* Visitas */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Eye className="w-4 h-4" /> Visitas
              </span>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.visits_count}
                  onChange={(e) => setEditData({...editData, visits_count: Number(e.target.value)})}
                  className="w-20 h-8 text-right"
                  min="0"
                />
              ) : (
                <span className="font-medium">{project.visits_count || 0}</span>
              )}
            </div>
            
            {/* Reuniões */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" /> Reuniões
              </span>
              {isEditing ? (
                <Input
                  type="number"
                  value={editData.meetings_count}
                  onChange={(e) => setEditData({...editData, meetings_count: Number(e.target.value)})}
                  className="w-20 h-8 text-right"
                  min="0"
                />
              ) : (
                <span className="font-medium">{project.meetings_count || 0}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fases do Projeto */}
      <ProjectPhases
        projectId={project.id}
        contractedValue={project.contracted_value || (project.contracted_hours || 0) * 150} // Assumindo R$ 150 por hora
        contractedHours={project.contracted_hours || 0}
        onPhasesChange={() => {
          // Callback opcional para quando as fases forem alteradas
          console.log('Fases do projeto foram alteradas');
        }}
      />

      {/* Documentos do Projeto */}
      <ProjectDocuments projectId={project.id} />

      {/* Contatos com o Cliente - Visível para todos incluindo colaboradores */}
      {project.client_id && (
        <ClientContactsCard clientId={project.client_id} />
      )}

      {/* Card de Status (apenas para supervisores e admins) */}
      {canChangeStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Alterar Status do Projeto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Status atual:</span>
                <Badge variant="secondary">{statusLabel[project.status]}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium min-w-fit">Novo status:</span>
                <Select 
                  value={project.status} 
                  onValueChange={handleStatusChange}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabel).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {updatingStatus && (
                <p className="text-sm text-muted-foreground">Atualizando...</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}