import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  FolderOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { PhaseTimerCard } from "./PhaseTimerCard";
import { PhaseAssignmentDialog } from "./PhaseAssignmentDialog";

interface SupervisorPhase {
  id: string;
  phase_name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  allocated_hours: number;
  executed_hours: number;
  assigned_to?: string;
  supervised_by?: string;
  assigned_profile?: {
    name: string;
  };
  project: {
    id: string;
    title: string;
    status: string;
  };
}

interface TeamStats {
  total_phases: number;
  assigned_phases: number;
  unassigned_phases: number;
  overallocated_phases: number;
  completed_phases: number;
}

export function SupervisorPhasesView() {
  const { user } = useAuth();
  const [phases, setPhases] = useState<SupervisorPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [selectedPhase, setSelectedPhase] = useState<SupervisorPhase | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [teamStats, setTeamStats] = useState<TeamStats>({
    total_phases: 0,
    assigned_phases: 0,
    unassigned_phases: 0,
    overallocated_phases: 0,
    completed_phases: 0
  });

  useEffect(() => {
    loadSupervisorPhases();
  }, [user]);

  const loadSupervisorPhases = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Buscar o profile do usuário atual
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!currentProfile) {
        console.warn('Perfil do usuário não encontrado');
        setPhases([]);
        return;
      }

      let query = supabase
        .from('project_phases')
        .select(`
          id,
          phase_name,
          description,
          status,
          allocated_hours,
          executed_hours,
          assigned_to,
          supervised_by,
          assigned_profile:profiles!assigned_to(name),
          project:projects(id, title, status)
        `);

      // Se não for admin, filtrar apenas fases supervisionadas pelo usuário
      if (currentProfile.role !== 'admin') {
        query = query.eq('supervised_by', currentProfile.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const phasesData = (data || []).map(phase => ({
        ...phase,
        status: phase.status as SupervisorPhase['status'],
        project: Array.isArray(phase.project) ? phase.project[0] : phase.project
      }));
      setPhases(phasesData);

      // Calcular estatísticas
      const stats: TeamStats = {
        total_phases: phasesData.length,
        assigned_phases: phasesData.filter(p => p.assigned_to).length,
        unassigned_phases: phasesData.filter(p => !p.assigned_to).length,
        overallocated_phases: phasesData.filter(p => p.executed_hours > p.allocated_hours).length,
        completed_phases: phasesData.filter(p => p.status === 'completed').length
      };
      
      setTeamStats(stats);
    } catch (error) {
      console.error('Erro ao carregar fases supervisionadas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as etapas supervisionadas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentUpdate = () => {
    loadSupervisorPhases();
    setSelectedPhase(null);
  };

  const openAssignmentDialog = (phase: SupervisorPhase) => {
    setSelectedPhase(phase);
    setIsAssignmentDialogOpen(true);
  };

  const filteredPhases = phases.filter(phase => {
    const matchesSearch = phase.phase_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         phase.project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (phase.assigned_profile?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || phase.status === statusFilter;
    
    const matchesAssignment = assignmentFilter === "all" ||
                             (assignmentFilter === "assigned" && phase.assigned_to) ||
                             (assignmentFilter === "unassigned" && !phase.assigned_to) ||
                             (assignmentFilter === "overallocated" && phase.executed_hours > phase.allocated_hours);
    
    return matchesSearch && matchesStatus && matchesAssignment;
  });

  const unassignedPhases = filteredPhases.filter(p => !p.assigned_to);
  const assignedPhases = filteredPhases.filter(p => p.assigned_to);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Gestão de Etapas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 bg-muted rounded"></div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{teamStats.total_phases}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{teamStats.assigned_phases}</p>
            <p className="text-sm text-muted-foreground">Atribuídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <UserPlus className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{teamStats.unassigned_phases}</p>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{teamStats.overallocated_phases}</p>
            <p className="text-sm text-muted-foreground">Excedidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{teamStats.completed_phases}</p>
            <p className="text-sm text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por etapa, projeto ou responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Atribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="assigned">Atribuídas</SelectItem>
                <SelectItem value="unassigned">Não Atribuídas</SelectItem>
                <SelectItem value="overallocated">Horas Excedidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Phases Tabs */}
      <Tabs defaultValue="unassigned" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unassigned" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Não Atribuídas ({unassignedPhases.length})
          </TabsTrigger>
          <TabsTrigger value="assigned" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Atribuídas ({assignedPhases.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned" className="space-y-4">
          {unassignedPhases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unassignedPhases.map((phase) => (
                <Card key={phase.id} className="relative">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">
                          {phase.project.title}
                        </p>
                        <h3 className="font-semibold line-clamp-1">{phase.phase_name}</h3>
                        {phase.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {phase.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {phase.allocated_hours}h alocadas
                      </span>
                    </div>

                    <Button 
                      onClick={() => openAssignmentDialog(phase)}
                      className="w-full gap-2"
                      size="sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      Atribuir Responsável
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UserPlus className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Todas as etapas foram atribuídas</h3>
                <p className="text-muted-foreground text-center">
                  Excelente! Todas as etapas já possuem responsáveis designados.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assigned" className="space-y-4">
          {assignedPhases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedPhases.map((phase) => (
                <div key={phase.id} className="relative">
                  <PhaseTimerCard
                    phase={{...phase, assigned_to: phase.assigned_to || '', supervised_by: phase.supervised_by || ''}}
                    onHoursUpdate={loadSupervisorPhases}
                    showProjectTitle={true}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAssignmentDialog(phase)}
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma etapa atribuída</h3>
                <p className="text-muted-foreground text-center">
                  Ainda não há etapas com responsáveis atribuídos.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <PhaseAssignmentDialog
        isOpen={isAssignmentDialogOpen}
        onClose={() => {
          setIsAssignmentDialogOpen(false);
          setSelectedPhase(null);
        }}
        phase={selectedPhase ? {
          id: selectedPhase.id,
          phase_name: selectedPhase.phase_name,
          allocated_hours: selectedPhase.allocated_hours,
          executed_hours: selectedPhase.executed_hours,
          status: selectedPhase.status,
          assigned_to: selectedPhase.assigned_to || '',
          supervised_by: selectedPhase.supervised_by || ''
        } : null}
        onAssignmentUpdate={handleAssignmentUpdate}
      />
    </div>
  );
}