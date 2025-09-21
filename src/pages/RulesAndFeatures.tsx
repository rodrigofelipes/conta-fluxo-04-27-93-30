import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { 
  BookOpen, 
  Users, 
  Timer, 
  MessageSquare, 
  FileText, 
  TrendingUp,
  Shield,
  Clock,
  Target,
  Zap
} from "lucide-react";

export default function RulesAndFeatures() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Regras e Funcionalidades" 
        subtitle="Guia completo das funcionalidades do sistema e regras de negócio"
      />

      {/* Sistema de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sistema de Usuários e Permissões
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Tipos de Usuário:</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Admin</Badge>
                  <span className="text-sm">Acesso total ao sistema</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>Supervisor</Badge>
                  <span className="text-sm">Gestão de projetos e equipes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>Coordenador</Badge>
                  <span className="text-sm">Atribuição de tarefas e acompanhamento</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Colaborador</Badge>
                  <span className="text-sm">Execução de tarefas</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Regras:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Apenas Mara tem acesso à aba Financeiro</li>
                <li>• Coordenadores veem apenas tarefas em andamento</li>
                <li>• Admins podem ativar/desativar usuários</li>
                <li>• Usuários só veem projetos atribuídos a eles</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Projetos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Gestão de Projetos e Fases
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Status de Projetos:</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Orçamento</Badge>
                  <span className="text-sm">Em fase de orçamentação</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600">Em Andamento</Badge>
                  <span className="text-sm">Projeto ativo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600">Concluído</Badge>
                  <span className="text-sm">Projeto finalizado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Cancelado</Badge>
                  <span className="text-sm">Projeto cancelado</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Regras de Fases:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Fases são atribuídas a colaboradores específicos</li>
                <li>• Tempo é controlado automaticamente por timers</li>
                <li>• Status muda automaticamente ao iniciar timer</li>
                <li>• Horas executadas são calculadas automaticamente</li>
                <li>• Apenas responsáveis podem marcar como concluída</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Timer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Sistema de Controle de Tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Funcionalidades:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Timer rápido no dashboard para tarefas urgentes</li>
                <li>• Controle individual por fase de projeto</li>
                <li>• Histórico completo de tempo trabalhado</li>
                <li>• Relatórios automáticos de produtividade</li>
                <li>• Integração com análise de prejuízo por excesso</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Regras de Uso:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Apenas um timer ativo por usuário</li>
                <li>• Timer pode ser atribuído a colaboradores</li>
                <li>• Tempo é salvo automaticamente ao parar</li>
                <li>• Mudança de status automática ao iniciar</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sistema Financeiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sistema Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Acesso Restrito:</h4>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Apenas Mara tem acesso ao módulo financeiro
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Funcionalidades:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Fluxo de caixa com entradas e saídas</li>
                <li>• Categorização de despesas (Fixo, Variável, Previsão)</li>
                <li>• Controle de pagamentos por cliente</li>
                <li>• Relatórios financeiros detalhados</li>
                <li>• Integração com dados de projetos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Comunicação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Sistema de Comunicação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">WhatsApp Business:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Integração direta com clientes</li>
                <li>• Histórico de conversas</li>
                <li>• Envio de documentos, áudios e vídeos</li>
                <li>• Notificações em tempo real</li>
                <li>• Agenda automática via WhatsApp</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Chat Interno:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Comunicação entre colaboradores</li>
                <li>• Compartilhamento de arquivos</li>
                <li>• Histórico de mensagens</li>
                <li>• Status de leitura</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Relatórios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sistema de Relatórios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Relatórios Disponíveis:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <strong>Colaboradores:</strong> Performance e produtividade</li>
                <li>• <strong>Clientes:</strong> Distribuição e crescimento</li>
                <li>• <strong>Projetos:</strong> Status e análise financeira</li>
                <li>• <strong>Tempo:</strong> Horas trabalhadas e eficiência</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Exportação:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Exportação em CSV</li>
                <li>• Impressão direta</li>
                <li>• Atualização em tempo real</li>
                <li>• Filtros personalizáveis</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dicas de Uso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Dicas de Uso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Produtividade
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Use o timer rápido para tarefas de até 30 minutos</li>
                <li>• Monitore horas executadas vs. alocadas nos projetos</li>
                <li>• Revise relatórios semanalmente para ajustes</li>
                <li>• Configure notificações para não perder prazos</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Organização
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Mantenha fases bem definidas e objetivas</li>
                <li>• Use descrições claras nos projetos</li>
                <li>• Documente decisões importantes no histórico</li>
                <li>• Revise status dos projetos regularmente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}