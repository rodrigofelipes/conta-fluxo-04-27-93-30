import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Search, Filter, FolderOpen, User, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";

interface CoordinatorPhase {
  id: string;
  phase_name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  allocated_hours: number;
  executed_hours: number;
  assigned_to: string;
  supervised_by?: string;
  assigned_profile?: { name: string; };
  supervisor_profile?: { name: string; };
  project: {
    id: string;
    title: string;
    status: string;
    client: { name: string; };
  };
}

export default function CoordinatorPhases() {
  const { user } = useAuth();
  const [phases, setPhases] = useState<CoordinatorPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("in_progress");

  useEffect(() => {
    loadAllPhases();
  }, [user]);

  const loadAllPhases = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_phases')
        .select(`
          id, phase_name, description, status, allocated_hours, executed_hours, assigned_to, supervised_by,
          assigned_profile:profiles!assigned_to(name),
          supervisor_profile:profiles!supervised_by(name),
          project:projects(id, title, status, client:clients(name))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const phasesData = (data || []).map(phase => ({
        ...phase,
        status: phase.status as CoordinatorPhase['status'],
        project: Array.isArray(phase.project) ? phase.project[0] : phase.project
      }));

      setPhases(phasesData);
    } catch (error) {
      console.error('Erro ao carregar fases:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as etapas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPhases = phases.filter(phase => {
    const matchesSearch = phase.phase_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         phase.project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         phase.project.client.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || phase.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusCount = (status: string) => {
    if (status === "all") return phases.length;
    return phases.filter(p => p.status === status).length;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'in_progress': return 'Em Andamento';
      case 'cancelled': return 'Cancelada';
      default: return 'Pendente';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Etapas" subtitle="Carregando..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Etapas - Visão Geral" subtitle="Acompanhe todas as etapas em andamento dos projetos" />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por etapa, projeto ou cliente..."
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
                <SelectItem value="all">Todos ({getStatusCount("all")})</SelectItem>
                <SelectItem value="pending">Pendentes ({getStatusCount("pending")})</SelectItem>
                <SelectItem value="in_progress">Em Andamento ({getStatusCount("in_progress")})</SelectItem>
                <SelectItem value="completed">Concluídas ({getStatusCount("completed")})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Fases */}
      {filteredPhases.length > 0 ? (
        <div className="space-y-4">
          {filteredPhases.map((phase) => (
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
                  <Badge className={getStatusColor(phase.status)}>
                    {getStatusLabel(phase.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Responsável:</span>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {phase.assigned_profile?.name || 'Não atribuído'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Supervisor:</span>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {phase.supervisor_profile?.name || 'Não atribuído'}
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma etapa encontrada</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros para encontrar as etapas que procura.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}