import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Users, Edit2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";

interface ProjectPhase {
  id: string;
  project_id: string;
  phase_name: string;
  description: string;
  status: string;
  allocated_hours: number;
  executed_hours: number;
  value_percentage: number;
  order_index: number;
  assigned_to: string | null;
  supervised_by: string | null;
  project: {
    title: string;
    client: {
      name: string;
    };
  };
  assignedProfile?: {
    name: string;
  } | null;
  supervisorProfile?: {
    name: string;
  } | null;
}

interface Profile {
  id: string;
  name: string;
  role: string;
}

export default function CoordinatorPhasesView() {
  const { user } = useAuth();
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [supervisedBy, setSupervisedBy] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar fases de projetos com informações relacionadas
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select(`
          *,
          project:projects(
            title,
            client:clients(name)
          )
        `)
        .order('created_at', { ascending: false });

      // Carregar perfis de colaboradores associados às fases
      const assignedIds = [...new Set((phasesData || [])
        .map(phase => [phase.assigned_to, phase.supervised_by])
        .flat()
        .filter(Boolean) as string[])];

      let assignedProfiles: any[] = [];
      if (assignedIds.length > 0) {
        const { data: assignedProfilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', assignedIds);
        assignedProfiles = assignedProfilesData || [];
      }

      // Processar dados das fases com informações dos perfis
      const processedPhases = (phasesData || []).map(phase => ({
        ...phase,
        assignedProfile: phase.assigned_to 
          ? assignedProfiles.find(p => p.id === phase.assigned_to) 
          : null,
        supervisorProfile: phase.supervised_by 
          ? assignedProfiles.find(p => p.id === phase.supervised_by) 
          : null
      }));

      if (phasesError) throw phasesError;

      // Carregar perfis de colaboradores (usuários e supervisores)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['user', 'supervisor'])
        .order('name');

      if (profilesError) throw profilesError;

      setPhases(processedPhases);
      setProfiles(profilesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados das etapas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPhase = (phase: ProjectPhase) => {
    setSelectedPhase(phase);
    setAssignedTo(phase.assigned_to || "none");
    setSupervisedBy(phase.supervised_by || "none");
    setDialogOpen(true);
  };

  const handleSaveAssignments = async () => {
    if (!selectedPhase) return;

    try {
      const { error } = await supabase
        .from('project_phases')
        .update({
          assigned_to: assignedTo === "none" ? null : assignedTo,
          supervised_by: supervisedBy === "none" ? null : supervisedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPhase.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Colaboradores da etapa atualizados com sucesso!"
      });

      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os colaboradores.",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluída';
      case 'in_progress':
        return 'Em Andamento';
      default:
        return 'Pendente';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando etapas...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Gerenciar Etapas" 
        subtitle="Atribua colaboradores às etapas dos projetos"
      />

      <div className="grid gap-6">
        {phases.map((phase) => (
          <Card key={phase.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getStatusIcon(phase.status)}
                    {phase.phase_name}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {phase.project?.title} • {phase.project?.client?.name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(phase.status)}>
                    {getStatusLabel(phase.status)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPhase(phase)}
                    className="gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Editar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Responsável:</span>
                  <div className="text-muted-foreground">
                    {phase.assignedProfile?.name || 'Não atribuído'}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Supervisor:</span>
                  <div className="text-muted-foreground">
                    {phase.supervisorProfile?.name || 'Não atribuído'}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Horas Planejadas:</span>
                  <div className="text-muted-foreground">{phase.allocated_hours}h</div>
                </div>
                <div>
                  <span className="font-medium">Horas Executadas:</span>
                  <div className="text-muted-foreground">{phase.executed_hours || 0}h</div>
                </div>
              </div>
              {phase.description && (
                <div className="mt-3 pt-3 border-t">
                  <span className="font-medium text-sm">Descrição:</span>
                  <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog para editar colaboradores */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Atribuir Colaboradores
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">{selectedPhase?.phase_name}</h4>
              <p className="text-xs text-muted-foreground">
                {selectedPhase?.project?.title} • {selectedPhase?.project?.client?.name}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="assigned-to">Responsável pela Execução</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles
                    .filter(p => p.role === 'user')
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supervised-by">Supervisor da Etapa</Label>
              <Select value={supervisedBy} onValueChange={setSupervisedBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles
                    .filter(p => p.role === 'supervisor')
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAssignments}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}