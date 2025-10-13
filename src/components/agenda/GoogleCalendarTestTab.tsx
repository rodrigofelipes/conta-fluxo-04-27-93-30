import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { createGoogleCalendarEvent } from "@/integrations/googleCalendar/events";
import { updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "@/integrations/googleCalendar/sync";
import { CheckCircle2, XCircle, Loader2, Calendar, RefreshCw, Trash2 } from "lucide-react";

interface SyncLog {
  id: string;
  agenda_id: string;
  google_event_id: string;
  sync_direction: string;
  sync_status: string;
  operation: string;
  error_message: string | null;
  synced_at: string;
}

export function GoogleCalendarTestTab({ onAfterSync }: { onAfterSync?: () => void }) {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [testEventId, setTestEventId] = useState<string>("");
  const [googleEventId, setGoogleEventId] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    checkConfiguration();
    loadSyncLogs();
  }, []);

  const checkConfiguration = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-google-calendar-event', {
        body: { test: true }
      });

      if (error) {
        if (error.message?.includes('GOOGLE_SERVICE_ACCOUNT') || 
            error.message?.includes('GOOGLE_CALENDAR_ID')) {
          setIsConfigured(false);
        } else {
          setIsConfigured(true);
        }
      } else {
        setIsConfigured(true);
      }
    } catch (error) {
      setIsConfigured(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const { data, error } = await supabase
        .from('google_calendar_sync_log')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const testCreateEvent = async () => {
    setIsTesting(true);
    try {
      // Criar agendamento de teste
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const { data: agenda, error: agendaError } = await supabase
        .from('agenda')
        .insert({
          titulo: 'Teste Google Calendar',
          descricao: 'Evento de teste criado automaticamente',
          cliente: 'Teste',
          tipo: 'reuniao_cliente',
          data: dateStr,
          data_fim: dateStr,
          horario: '10:00:00',
          horario_fim: '11:00:00',
          local: 'Online',
          agenda_type: 'compartilhada',
          created_by: user.user.id,
        })
        .select()
        .single();

      if (agendaError) throw agendaError;

      // Tentar sincronizar com Google Calendar
      const calendarResponse = await createGoogleCalendarEvent({
        agendaId: agenda.id,
        title: 'Teste Google Calendar',
        description: 'Evento de teste criado automaticamente',
        startDate: dateStr,
        endDate: dateStr,
        startTime: '10:00:00',
        endTime: '11:00:00',
        location: 'Online',
        cliente: 'Teste',
        agendaType: 'compartilhada',
      });

      if (calendarResponse?.eventId) {
        setTestEventId(agenda.id);
        setGoogleEventId(calendarResponse.eventId);
        
        // Atualizar agenda com google_event_id
        await supabase
          .from('agenda')
          .update({ google_event_id: calendarResponse.eventId })
          .eq('id', agenda.id);

        toast({
          title: "✅ Teste de Criação: Sucesso!",
          description: `Evento criado no Google Calendar. Event ID: ${calendarResponse.eventId.substring(0, 20)}...`,
        });
      } else {
        toast({
          title: "⚠️ Aviso",
          description: "Evento criado localmente, mas não sincronizado com Google Calendar",
          variant: "default"
        });
      }

      loadSyncLogs();
      onAfterSync?.();
    } catch (error: any) {
      console.error('Erro no teste de criação:', error);
      toast({
        title: "❌ Erro no Teste de Criação",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testUpdateEvent = async () => {
    if (!testEventId || !googleEventId) {
      toast({
        title: "⚠️ Aviso",
        description: "Primeiro crie um evento de teste",
        variant: "default"
      });
      return;
    }

    setIsTesting(true);
    try {
      await updateGoogleCalendarEvent({
        agendaId: testEventId,
        googleEventId: googleEventId,
        title: 'Teste Google Calendar (ATUALIZADO)',
        description: 'Evento atualizado via teste',
      });

      await supabase
        .from('agenda')
        .update({ titulo: 'Teste Google Calendar (ATUALIZADO)' })
        .eq('id', testEventId);

      toast({
        title: "✅ Teste de Atualização: Sucesso!",
        description: "Evento atualizado no Google Calendar",
      });

      loadSyncLogs();
      onAfterSync?.();
    } catch (error: any) {
      console.error('Erro no teste de atualização:', error);
      toast({
        title: "❌ Erro no Teste de Atualização",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const syncFromGoogle = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');

      if (error) {
        if (error.message?.includes('credentials are not configured')) {
          toast({
            title: "⚠️ Configuração Necessária",
            description: "Configure GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY no Supabase",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }

      toast({
        title: "✅ Sincronização Concluída!",
        description: `Criados (Google → Sistema): ${data.results.created}, Atualizados: ${data.results.updated}, Enviados (Sistema → Google): ${data.results.system_created ?? 0}, Erros: ${(data.results.errors || 0) + (data.results.system_errors || 0)}`,
      });

      loadSyncLogs();
      onAfterSync?.();
    } catch (error: any) {
      console.error('Erro na sincronização:', error);
      toast({
        title: "❌ Erro na Sincronização",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testDeleteEvent = async () => {
    if (!testEventId || !googleEventId) {
      toast({
        title: "⚠️ Aviso",
        description: "Primeiro crie um evento de teste",
        variant: "default"
      });
      return;
    }

    setIsTesting(true);
    try {
      await deleteGoogleCalendarEvent({
        agendaId: testEventId,
        googleEventId: googleEventId,
      });

      await supabase
        .from('agenda')
        .delete()
        .eq('id', testEventId);

      toast({
        title: "✅ Teste de Exclusão: Sucesso!",
        description: "Evento deletado do Google Calendar",
      });

      setTestEventId("");
      setGoogleEventId("");
      loadSyncLogs();
      onAfterSync?.();
    } catch (error: any) {
      console.error('Erro no teste de exclusão:', error);
      toast({
        title: "❌ Erro no Teste de Exclusão",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status da Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Status da Integração Google Calendar
          </CardTitle>
          <CardDescription>
            Verifique se a integração está configurada corretamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Status da Configuração</p>
              <p className="text-sm text-muted-foreground">
                Secrets: GOOGLE_SERVICE_ACCOUNT, GOOGLE_CALENDAR_ID
              </p>
            </div>
            {isConfigured === null ? (
              <Badge variant="outline">
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Verificando...
              </Badge>
            ) : isConfigured ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Configurado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-4 w-4 mr-1" />
                Não Configurado
              </Badge>
            )}
          </div>

          {!isConfigured && isConfigured !== null && (
            <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                ⚠️ Configure os secrets necessários no Supabase:
              </p>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside mt-2">
                <li>GOOGLE_SERVICE_ACCOUNT - JSON da service account</li>
                <li>GOOGLE_CALENDAR_ID - ID do calendário (email)</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sincronização do Google */}
      <Card>
        <CardHeader>
          <CardTitle>Sincronização do Google Calendar</CardTitle>
          <CardDescription>
            Importar eventos criados no Google Calendar para o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={syncFromGoogle}
            disabled={isTesting || !isConfigured}
            className="w-full"
            size="lg"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar Eventos do Google Calendar
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Busca eventos dos últimos 7 dias e próximos 30 dias
          </p>
        </CardContent>
      </Card>

      {/* Testes de CRUD */}
      <Card>
        <CardHeader>
          <CardTitle>Testes de Sincronização</CardTitle>
          <CardDescription>
            Execute testes para verificar criar, atualizar e deletar eventos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={testCreateEvent}
              disabled={isTesting || !isConfigured}
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Criar Evento
            </Button>

            <Button
              onClick={testUpdateEvent}
              disabled={isTesting || !testEventId || !isConfigured}
              variant="outline"
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar Evento
            </Button>

            <Button
              onClick={testDeleteEvent}
              disabled={isTesting || !testEventId || !isConfigured}
              variant="destructive"
              className="w-full"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Deletar Evento
            </Button>
          </div>

          {testEventId && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Evento de Teste Ativo:</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Agenda ID: {testEventId}
              </p>
              {googleEventId && (
                <p className="text-xs text-muted-foreground font-mono">
                  Google Event ID: {googleEventId.substring(0, 30)}...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs de Sincronização */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logs de Sincronização</CardTitle>
              <CardDescription>Últimas 10 operações de sincronização</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSyncLogs}
              disabled={isLoadingLogs}
            >
              {isLoadingLogs ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum log de sincronização encontrado
            </p>
          ) : (
            <div className="space-y-2">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 border rounded-lg flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={log.sync_status === 'success' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {log.operation.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {log.sync_direction === 'system_to_google' ? '→ Google' : '← Google'}
                      </Badge>
                      <span className={`text-xs ${log.sync_status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {log.sync_status === 'success' ? '✓ Sucesso' : '✗ Falha'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      Event ID: {log.google_event_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.synced_at).toLocaleString('pt-BR')}
                    </p>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}