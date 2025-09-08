import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Search, Filter, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { PhaseTimerCard } from "./PhaseTimerCard";

interface UserPhase {
  id: string;
  phase_name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  allocated_hours: number;
  executed_hours: number;
  assigned_to: string;
  supervised_by?: string;
  assigned_profile?: {
    name: string;
  };
  supervisor_profile?: {
    name: string;
  };
  project: {
    id: string;
    title: string;
    status: string;
  };
}

export function UserPhasesView() {
  const { user } = useAuth();
  const [phases, setPhases] = useState<UserPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTimers, setActiveTimers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUserPhases();
    checkActiveTimers();
  }, [user]);

  const loadUserPhases = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Buscar o profile do usuário atual
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!currentProfile) {
        console.warn('Perfil do usuário não encontrado');
        setPhases([]);
        return;
      }

      // Buscar fases atribuídas ao usuário
      const { data, error } = await supabase
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
          supervisor_profile:profiles!supervised_by(name),
          project:projects(id, title, status)
        `)
        .eq('assigned_to', currentProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const phasesData = (data || []).map(phase => ({
        ...phase,
        status: phase.status as UserPhase['status'],
        project: Array.isArray(phase.project) ? phase.project[0] : phase.project
      }));
      setPhases(phasesData);
    } catch (error) {
      console.error('Erro ao carregar fases do usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar suas etapas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkActiveTimers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('phase_id')
        .eq('user_id', user.id)
        .is('end_time', null);

      if (error) throw error;

      const activePhaseIds = new Set((data || []).map(entry => entry.phase_id).filter(Boolean));
      setActiveTimers(activePhaseIds);
    } catch (error) {
      console.error('Erro ao verificar timers ativos:', error);
    }
  };

  const handleHoursUpdate = () => {
    loadUserPhases();
    checkActiveTimers();
  };

  const filteredPhases = phases.filter(phase => {
    const matchesSearch = phase.phase_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         phase.project.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || phase.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusCount = (status: string) => {
    if (status === "all") return phases.length;
    return phases.filter(p => p.status === status).length;
  };

  const activePhasesCount = phases.filter(p => 
    ['pending', 'in_progress'].includes(p.status)
  ).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Minhas Etapas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
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
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Minhas Etapas
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Etapas atribuídas a você para execução
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="font-semibold text-primary">{activePhasesCount}</p>
                <p className="text-muted-foreground">Ativas</p>
              </div>
              <div className="text-center">
                <p className="font-semibold">{phases.length}</p>
                <p className="text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por etapa ou projeto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Todos ({getStatusCount("all")})
                </SelectItem>
                <SelectItem value="pending">
                  Pendentes ({getStatusCount("pending")})
                </SelectItem>
                <SelectItem value="in_progress">
                  Em Andamento ({getStatusCount("in_progress")})
                </SelectItem>
                <SelectItem value="completed">
                  Concluídas ({getStatusCount("completed")})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Phases Grid */}
      {filteredPhases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhases.map((phase) => (
            <PhaseTimerCard
              key={phase.id}
              phase={{...phase, assigned_to: phase.assigned_to || '', supervised_by: phase.supervised_by || ''}}
              onHoursUpdate={handleHoursUpdate}
              showProjectTitle={true}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <FolderOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || statusFilter !== "all" 
                ? "Nenhuma etapa encontrada" 
                : "Nenhuma etapa atribuída"
              }
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              {searchTerm || statusFilter !== "all" 
                ? "Tente ajustar os filtros para encontrar as etapas que procura."
                : "Você ainda não possui etapas atribuídas. Entre em contato com seu supervisor para obter atribuições."
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}