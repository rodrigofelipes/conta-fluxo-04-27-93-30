import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/page-header";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  FileText,
  Target,
  Calendar,
  BarChart3,
  Download,
  Printer,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamReports } from "@/hooks/useTeamReports";
import { calculateEfficiency, type EfficiencyStatus } from "@/utils/efficiency";

interface ClientPortfolioMetric {
  setor: string;
  count: number;
  percentage: number;
  plannedHours: number;
  executedHours: number;
  hoursBalance: number;
  efficiency: number;
  status: EfficiencyStatus;
}

interface ClientEfficiencyMetric {
  clientId: string;
  name: string;
  classification: string;
  projects: number;
  plannedHours: number;
  executedHours: number;
  hoursBalance: number;
  efficiency: number;
  status: EfficiencyStatus;
}

interface DashboardMetrics {
  totalClientes: number;
  clientesPorSetor: ClientPortfolioMetric[];
  clientesPorSituacao: Array<{ situacao: string; count: number }>;
  novosClientesMensal: Array<{ mes: string; clientes: number }>;
  documentosPorStatus: Array<{ status: string; count: number }>;
  tarefasPorStatus: Array<{ status: string; count: number }>;
  clientesEficiencia: ClientEfficiencyMetric[];
  clientesEfficiencyResumo: {
    plannedHours: number;
    executedHours: number;
    hoursBalance: number;
    efficiency: number;
    status: EfficiencyStatus;
  };
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#f97316', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

export default function Reports() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalClientes: 0,
    clientesPorSetor: [],
    clientesPorSituacao: [],
    novosClientesMensal: [],
    documentosPorStatus: [],
    tarefasPorStatus: [],
    clientesEficiencia: [],
    clientesEfficiencyResumo: {
      plannedHours: 0,
      executedHours: 0,
      hoursBalance: 0,
      efficiency: 0,
      status: 'no_data'
    }
  });
  const [loading, setLoading] = useState(true);
  const { teamStats, teamMembers, loading: teamLoading, refetch } = useTeamReports();

  const efficiencyStatusConfig: Record<EfficiencyStatus, { label: string; className: string }> = {
    on_track: { label: 'No prazo', className: 'bg-green-100 text-green-700 border-green-200' },
    attention: { label: 'Atenção', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    critical: { label: 'Crítico', className: 'bg-red-100 text-red-700 border-red-200' },
    no_data: { label: 'Sem dados', className: 'bg-slate-100 text-slate-600 border-slate-200' }
  };

  const getEfficiencyStatusConfig = (status: EfficiencyStatus) =>
    efficiencyStatusConfig[status] || efficiencyStatusConfig['no_data'];

  const formatHours = (value: number) =>
    Number.isFinite(value)
      ? value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : '0,0';

  const formatSignedHours = (value: number) => {
    if (!Number.isFinite(value)) {
      return '0,0';
    }
    const formatted = Math.abs(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };

  const formatPercentage = (value: number) =>
    Number.isFinite(value)
      ? value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : '0,0';

  const teamEfficiencyStatus = getEfficiencyStatusConfig(teamStats.efficiencySummary.status);
  const clientsEfficiencyStatus = getEfficiencyStatusConfig(metrics.clientesEfficiencyResumo.status);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      fetchMetrics();
    }, 30000); // Atualizar a cada 30 segundos

    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const [
        clientesResponse,
        documentosResponse,
        tarefasResponse,
        projectsResponse,
        phasesResponse
      ] = await Promise.all([
        supabase.from('clients').select('id, created_at, classification, name'),
        Promise.resolve({ data: [], error: null }), // Simular documents
        Promise.resolve({ data: [], error: null }), // Tasks removidas
        supabase.from('projects').select('id, client_id, contracted_hours, executed_hours'),
        supabase.from('project_phases').select('project_id, allocated_hours, executed_hours')
      ]);

      if (clientesResponse.error) throw clientesResponse.error;
      if (projectsResponse.error) throw projectsResponse.error;
      if (phasesResponse.error) throw phasesResponse.error;

      const clientsData = clientesResponse.data || [];
      const projectsData = projectsResponse.data || [];
      const phasesData = phasesResponse.data || [];

      const totalClientes = clientsData.length;

      const situacaoCounts = clientsData.reduce((acc, cliente) => {
        const classification = cliente.classification || 'cliente';
        acc[classification] = (acc[classification] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const clientesPorSituacao = Object.entries(situacaoCounts).map(([situacao, count]) => ({
        situacao,
        count
      }));

      const phasesByProject = new Map<string, { planned: number; executed: number }>();
      phasesData.forEach(phase => {
        if (!phase.project_id) return;
        const current = phasesByProject.get(phase.project_id) || { planned: 0, executed: 0 };
        current.planned += phase.allocated_hours || 0;
        current.executed += phase.executed_hours || 0;
        phasesByProject.set(phase.project_id, current);
      });

      const clientMetricsMap = new Map<string, { projects: number; planned: number; executed: number }>();
      projectsData.forEach(project => {
        const phaseMetrics = phasesByProject.get(project.id) || { planned: 0, executed: 0 };
        const plannedHours = phaseMetrics.planned > 0
          ? phaseMetrics.planned
          : (project.contracted_hours || 0);
        const executedHours = phaseMetrics.executed > 0
          ? phaseMetrics.executed
          : (project.executed_hours || 0);

        const existing = clientMetricsMap.get(project.client_id) || { projects: 0, planned: 0, executed: 0 };
        clientMetricsMap.set(project.client_id, {
          projects: existing.projects + 1,
          planned: existing.planned + plannedHours,
          executed: existing.executed + executedHours
        });
      });

      const clientesEficiencia = clientsData.map(client => {
        const metrics = clientMetricsMap.get(client.id) || { projects: 0, planned: 0, executed: 0 };
        const efficiency = calculateEfficiency(metrics.planned, metrics.executed);
        return {
          clientId: client.id,
          name: client.name,
          classification: client.classification || 'Sem classificação',
          projects: metrics.projects,
          plannedHours: efficiency.plannedHours,
          executedHours: efficiency.executedHours,
          hoursBalance: efficiency.hoursBalance,
          efficiency: efficiency.efficiency,
          status: efficiency.status
        };
      }).sort((a, b) => {
        if (a.status === 'no_data' && b.status !== 'no_data') return 1;
        if (b.status === 'no_data' && a.status !== 'no_data') return -1;
        return b.efficiency - a.efficiency;
      });

      const totalPlannedClients = clientesEficiencia.reduce((sum, client) => sum + client.plannedHours, 0);
      const totalExecutedClients = clientesEficiencia.reduce((sum, client) => sum + client.executedHours, 0);
      const clientesEfficiencyResumo = calculateEfficiency(totalPlannedClients, totalExecutedClients);

      const classificationMap = clientsData.reduce((acc, client) => {
        const classification = client.classification || 'Sem classificação';
        const metrics = clientMetricsMap.get(client.id) || { projects: 0, planned: 0, executed: 0 };
        const current = acc.get(classification) || { count: 0, planned: 0, executed: 0 };
        acc.set(classification, {
          count: current.count + 1,
          planned: current.planned + metrics.planned,
          executed: current.executed + metrics.executed
        });
        return acc;
      }, new Map<string, { count: number; planned: number; executed: number }>());

      const clientesPorSetor = Array.from(classificationMap.entries()).map(([setor, data]) => {
        const efficiency = calculateEfficiency(data.planned, data.executed);
        return {
          setor,
          count: data.count,
          percentage: totalClientes > 0 ? Math.round((data.count / totalClientes) * 100) : 0,
          plannedHours: efficiency.plannedHours,
          executedHours: efficiency.executedHours,
          hoursBalance: efficiency.hoursBalance,
          efficiency: efficiency.efficiency,
          status: efficiency.status
        };
      }).sort((a, b) => b.count - a.count);

      // Documentos por status
      const docCounts = documentosResponse.data?.reduce((acc: any, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      }, {}) || {};

      const documentosPorStatus = Object.entries(docCounts).map(([status, count]: [string, any]) => ({
        status,
        count
      }));

      // Tarefas por status
      const taskCounts = tarefasResponse.data?.reduce((acc: any, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {}) || {};

      const tarefasPorStatus = Object.entries(taskCounts).map(([status, count]: [string, any]) => ({
        status,
        count
      }));

      // Novos clientes por mês (simulado)
      const novosClientesMensal = [
        { mes: 'Jan', clientes: 32 },
        { mes: 'Fev', clientes: 45 },
        { mes: 'Mar', clientes: 38 },
        { mes: 'Abr', clientes: 52 },
        { mes: 'Mai', clientes: 41 },
        { mes: 'Jun', clientes: 36 },
        { mes: 'Jul', clientes: 48 },
        { mes: 'Ago', clientes: 55 },
        { mes: 'Set', clientes: 42 },
        { mes: 'Out', clientes: 39 },
        { mes: 'Nov', clientes: 44 },
        { mes: 'Dez', clientes: 38 }
      ];

      setMetrics({
        totalClientes,
        clientesPorSetor,
        clientesPorSituacao,
        novosClientesMensal,
        documentosPorStatus,
        tarefasPorStatus,
        clientesEficiencia,
        clientesEfficiencyResumo
      });
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const csv = useMemo(() => {
    const header = "Setor,Clientes,Percentual\n";
    const rows = metrics.clientesPorSetor.map(d => 
      `${d.setor},${d.count},${d.percentage}%`
    ).join("\n");
    return header + rows;
  }, [metrics]);

  const downloadCSV = () => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_gestao_contabil.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <PageHeader 
        title="Relatórios e Análises" 
        subtitle="Visão completa da gestão empresarial, colaboradores e indicadores"
      />

      {/* Botões de Ação */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={downloadCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
        <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                <p className="text-3xl font-bold text-primary">{metrics.totalClientes}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-4 text-sm">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600 font-medium">+8.2%</span>
              <span className="text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Documentos Ativos</p>
                <p className="text-3xl font-bold text-blue-600">{metrics.documentosPorStatus.reduce((acc, doc) => acc + doc.count, 0)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-4 text-sm">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-blue-600 font-medium">12</span>
              <span className="text-muted-foreground">pendentes hoje</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tarefas Concluídas</p>
                <p className="text-3xl font-bold text-green-600">
                  {metrics.tarefasPorStatus.find(t => t.status === 'DONE')?.count || 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-4 text-sm">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600 font-medium">94%</span>
              <span className="text-muted-foreground">taxa conclusão</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Eficiência Operacional</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold text-purple-600">
                    {formatPercentage(teamStats.efficiencySummary.efficiency)}%
                  </p>
                  <Badge variant="outline" className={`${teamEfficiencyStatus.className} border`}>
                    {teamEfficiencyStatus.label}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <Progress
              value={Math.min(teamStats.efficiencySummary.efficiency, 100)}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground">
              Planejado: {formatHours(teamStats.efficiencySummary.plannedHours)}h · Executado:{" "}
              {formatHours(teamStats.efficiencySummary.executedHours)}h · Variação:{" "}
              {formatSignedHours(teamStats.efficiencySummary.hoursBalance)}h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="collaborators" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collaborators">Colaboradores</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="collaborators" className="space-y-6">
          {teamLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <>
              {/* Stats Cards dos Colaboradores */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Colaboradores</p>
                        <p className="text-3xl font-bold text-primary">{teamStats.totalMembers}</p>
                      </div>
                      <Users className="h-8 w-8 text-primary opacity-80" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Ativos Agora</p>
                        <p className="text-3xl font-bold text-green-600">{teamStats.activeMembers}</p>
                      </div>
                      <Activity className="h-8 w-8 text-green-600 opacity-80" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Horas Hoje</p>
                        <p className="text-3xl font-bold text-blue-600">{teamStats.totalHoursToday}h</p>
                      </div>
                      <Calendar className="h-8 w-8 text-blue-600 opacity-80" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Eficiência Média</p>
                        <p className="text-3xl font-bold text-purple-600">{formatPercentage(teamStats.averageEfficiency)}%</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-600 opacity-80" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Como calculamos a eficiência dos colaboradores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Consideramos as horas planejadas em cada fase de projeto frente às horas
                    realmente executadas pelos colaboradores. Assim conseguimos medir se a entrega
                    está dentro do combinado ou se houve estouro de horas.
                  </p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <span className="font-medium text-foreground">Dentro do planejado:</span>{' '}
                      (horas executadas ÷ horas planejadas) × 100
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Com estouro de horas:</span>{' '}
                      100 − ((horas executadas − horas planejadas) ÷ horas planejadas) × 100
                    </li>
                    <li>
                      O status muda conforme o percentual: ≥ 90% “No prazo”, 75%–89% “Atenção” e
                      &lt; 75% “Crítico”.
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Horas por Colaborador */}
                <Card>
                  <CardHeader>
                    <CardTitle>Horas Trabalhadas por Colaborador</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={teamStats.hoursByMember}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="hours" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Distribuição por Cargo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição por Cargo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={teamStats.roleDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {teamStats.roleDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Lista detalhada dos colaboradores */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento por Colaborador</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {member.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold">{member.name}</h3>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <Badge 
                              variant={member.role === 'admin' ? 'default' : 'secondary'}
                            >
                              {member.role}
                            </Badge>
                            {member.active_timers > 0 && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Timer Ativo
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Horas Totais</span>
                            <p className="font-semibold">{formatHours(member.total_hours)}h</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Horas Planejadas</span>
                            <p className="font-semibold">{formatHours(member.planned_hours)}h</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Horas Executadas</span>
                            <p className="font-semibold">{formatHours(member.executed_hours)}h</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Variação</span>
                            <p className={`font-semibold ${member.hours_balance > 0 ? 'text-red-600' : member.hours_balance < 0 ? 'text-green-600' : ''}`}>
                              {formatSignedHours(member.hours_balance)}h
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Eficiência</span>
                            <p className="font-semibold">{formatPercentage(member.efficiency_score)}%</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status</span>
                            <Badge
                              variant="outline"
                              className={`${getEfficiencyStatusConfig(member.efficiency_status).className} border`}
                            >
                              {getEfficiencyStatusConfig(member.efficiency_status).label}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {member.efficiency_status === 'no_data'
                            ? 'Sem registros suficientes para calcular a eficiência deste colaborador.'
                            : member.hours_balance <= 0
                              ? `Eficiência = (${formatHours(member.executed_hours)}h ÷ ${formatHours(member.planned_hours)}h) × 100`
                              : `Eficiência = 100 − ((${formatHours(member.executed_hours)}h − ${formatHours(member.planned_hours)}h) ÷ ${formatHours(member.planned_hours)}h) × 100`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>Projetos ativos: {member.projects_count}</span>
                          <span>
                            Última atividade:{' '}
                            {member.last_activity
                              ? new Date(member.last_activity).toLocaleDateString('pt-BR')
                              : 'Nenhuma'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
        <TabsContent value="clients" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Resumo da carteira de clientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Eficiência média consolidada</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-3xl font-bold text-primary">
                        {formatPercentage(metrics.clientesEfficiencyResumo.efficiency)}%
                      </span>
                      <Badge variant="outline" className={`${clientsEfficiencyStatus.className} border`}>
                        {clientsEfficiencyStatus.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Clientes ativos</span>
                    <p className="font-semibold text-foreground">{metrics.totalClientes}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Horas planejadas</span>
                    <p className="font-semibold text-foreground">{formatHours(metrics.clientesEfficiencyResumo.plannedHours)}h</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Horas executadas</span>
                    <p className="font-semibold text-foreground">{formatHours(metrics.clientesEfficiencyResumo.executedHours)}h</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Variação total: {formatSignedHours(metrics.clientesEfficiencyResumo.hoursBalance)}h. Valores
                  consolidados considerando todos os projetos vinculados aos clientes.
                </p>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Como calculamos a eficiência dos clientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  A eficiência considera a soma das horas contratadas ou planejadas em projetos e a soma das
                  horas executadas nas fases correspondentes de cada cliente.
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    Quando o cliente consome até o limite contratado: (horas executadas ÷ horas planejadas) × 100
                  </li>
                  <li>
                    Quando há estouro de horas: 100 − ((horas executadas − horas planejadas) ÷ horas planejadas) × 100
                  </li>
                  <li>
                    O status segue o mesmo critério dos colaboradores para facilitar a leitura.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Distribuição por Classificação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={metrics.clientesPorSetor}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {metrics.clientesPorSetor.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 min-w-[180px]">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Classificações
                    </h4>
                    {metrics.clientesPorSetor.map((item, index) => (
                      <div key={item.setor} className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.setor}</span>
                            <span className="text-xs text-muted-foreground">{item.percentage}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{item.count} clientes</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Status dos Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.clientesPorSituacao}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="situacao" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Eficiência por Classificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {metrics.clientesPorSetor.map((setor, index) => {
                const status = getEfficiencyStatusConfig(setor.status);
                return (
                  <div key={setor.setor} className="p-4 rounded-lg bg-muted/20 border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-semibold text-lg">{setor.setor}</span>
                      </div>
                      <Badge variant="outline" className={`${status.className} border`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Clientes</span>
                        <p className="font-semibold">{setor.count} ({setor.percentage}%)</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Horas planejadas</span>
                        <p className="font-semibold">{formatHours(setor.plannedHours)}h</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Horas executadas</span>
                        <p className="font-semibold">{formatHours(setor.executedHours)}h</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Eficiência</span>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{formatPercentage(setor.efficiency)}%</p>
                          <Progress value={Math.min(setor.efficiency, 100)} className="flex-1 h-2" />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Variação de horas: {formatSignedHours(setor.hoursBalance)}h.
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Eficiência por Cliente</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lista consolidada com todos os clientes e os indicadores calculados a partir dos projetos e fases.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 font-medium">Cliente</th>
                      <th className="py-2 font-medium">Classificação</th>
                      <th className="py-2 font-medium">Projetos</th>
                      <th className="py-2 font-medium">Planejado</th>
                      <th className="py-2 font-medium">Executado</th>
                      <th className="py-2 font-medium">Variação</th>
                      <th className="py-2 font-medium">Eficiência</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.clientesEficiencia.map(cliente => {
                      const status = getEfficiencyStatusConfig(cliente.status);
                      return (
                        <tr key={cliente.clientId}>
                          <td className="py-2 font-medium text-foreground">{cliente.name}</td>
                          <td className="py-2 text-muted-foreground">{cliente.classification}</td>
                          <td className="py-2">{cliente.projects}</td>
                          <td className="py-2">{formatHours(cliente.plannedHours)}h</td>
                          <td className="py-2">{formatHours(cliente.executedHours)}h</td>
                          <td className={`py-2 ${cliente.hoursBalance > 0 ? 'text-red-600' : cliente.hoursBalance < 0 ? 'text-green-600' : ''}`}>
                            {formatSignedHours(cliente.hoursBalance)}h
                          </td>
                          <td className="py-2">{formatPercentage(cliente.efficiency)}%</td>
                          <td className="py-2">
                            <Badge variant="outline" className={`${status.className} border`}>{status.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {metrics.clientesEficiencia.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Ainda não há dados suficientes para calcular a eficiência dos clientes.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Crescimento de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metrics.novosClientesMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="clientes"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
