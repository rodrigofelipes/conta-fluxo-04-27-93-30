import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Plus,
  Calendar,
  UserPlus,
  FileText,
  Settings,
  DollarSign
} from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { AgendaWidget } from "./widgets/AgendaWidget";
import { FinancialWidget } from "./widgets/FinancialWidget";

interface AdminDashboardProps {
  userName?: string;
}

export function AdminDashboard({ userName }: AdminDashboardProps) {
  const navigate = useNavigate();
  const { stats, upcomingMeetings, importantFinancials, loading } = useDashboardData();

  const quickActions = [
    {
      title: "Novo Cliente",
      description: "Cadastrar novo cliente no sistema",
      icon: Users,
      action: () => navigate('/clients'),
      variant: "default" as const
    },
    {
      title: "Agendar Compromisso",
      description: "Criar novo compromisso na agenda",
      icon: Calendar,
      action: () => navigate('/agenda'),
      variant: "outline" as const
    }
  ];

  return (
    <main className="space-y-4 sm:space-y-6">
      <PageHeader 
        title="Dashboard Administrativo" 
        subtitle={`Bem-vindo, ${userName}! Painel de controle administrativo.`}
      />

      {/* Estatísticas principais */}
      <div className="grid responsive-grid gap-3 sm:gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="responsive-padding">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Total de Clientes</p>
                <p className="responsive-text-xl font-bold text-primary">{stats.totalClients}</p>
              </div>
              <Users className="size-6 sm:size-8 text-primary opacity-80 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="responsive-padding">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Projetos Ativos</p>
                <p className="responsive-text-xl font-bold text-primary">{stats.activeProjects}</p>
              </div>
              <FileText className="size-6 sm:size-8 text-primary opacity-80 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="responsive-padding">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Total de Usuários</p>
                <p className="responsive-text-xl font-bold text-primary">{stats.totalUsers}</p>
              </div>
              <Users className="size-6 sm:size-8 text-blue-600 opacity-80 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="responsive-padding">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Receita Total</p>
                <p className="responsive-text-xl font-bold text-primary">R$ {stats.totalRevenue?.toLocaleString('pt-BR') || '0'}</p>
              </div>
              <DollarSign className="size-6 sm:size-8 text-green-600 opacity-80 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção principal com widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Agenda e Ações Rápidas */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <AgendaWidget meetings={upcomingMeetings} loading={loading} />
          
          {/* Ações rápidas */}
          <Card>
            <CardContent className="responsive-padding">
              <h3 className="responsive-text-lg font-semibold mb-3 sm:mb-4 flex items-center responsive-gap-sm">
                <Plus className="size-4 sm:size-5 flex-shrink-0" />
                Ações Rápidas
              </h3>
              <div className="grid responsive-grid-2 gap-2 sm:gap-3">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    onClick={action.action}
                    className="h-auto responsive-padding-sm border border-border/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all justify-start"
                  >
                    <action.icon className="mr-2 sm:mr-3 size-4 sm:size-5 flex-shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="font-medium text-xs sm:text-sm">{action.title}</p>
                      <p className="text-xs opacity-70 line-clamp-2">{action.description}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar com financeiro */}
        <div className="space-y-4 sm:space-y-6">
          <FinancialWidget transactions={importantFinancials} loading={loading} />
        </div>
      </div>
    </main>
  );
}