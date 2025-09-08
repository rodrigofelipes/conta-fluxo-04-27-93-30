import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Calendar, MessageSquare, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppLog {
  id: string;
  user_name: string;
  delivery_date: string;
  appointments_count: number;
  whatsapp_status: string;
  message_content: string | null;
  error_details: any;
  created_at: string;
}

export default function WhatsAppAgendaManager() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [currentScheduleTime, setCurrentScheduleTime] = useState('08:00');
  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('daily_whatsapp_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar histórico de envios",
        variant: "destructive"
      });
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchCurrentSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'whatsapp_agenda_schedule')
        .single();

      if (!error && data?.setting_value) {
        // Convert cron format "0 8 * * *" to "08:00"
        const cronParts = data.setting_value.split(' ');
        if (cronParts.length >= 2) {
          const hour = cronParts[1].padStart(2, '0');
          const minute = cronParts[0].padStart(2, '0');
          const timeString = `${hour}:${minute}`;
          setCurrentScheduleTime(timeString);
        }
      }
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchCurrentSchedule();
  }, []);

  const sendDailyAgenda = async () => {
    setLoading(true);
    
    try {
      console.log("Enviando agenda diária manualmente...");
      
      const { data, error } = await supabase.functions.invoke('daily-whatsapp-agenda', {
        body: { trigger: 'manual' }
      });

      if (error) {
        console.error("Erro da função:", error);
        throw error;
      }

      console.log("Resposta da função:", data);

      if (data.ok) {
        toast({
          title: "Sucesso",
          description: `Agenda enviada! ${data.appointmentsCount} compromissos encontrados.`,
        });
        
        // Refresh logs
        await fetchLogs();
      } else {
        toast({
          title: "Aviso",
          description: data.message || "Nenhum compromisso encontrado para hoje",
          variant: "default"
        });
      }
    } catch (error: any) {
      console.error("Erro ao enviar agenda:", error);
      toast({
        title: "Erro",
        description: `Erro ao enviar agenda: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const debugAndFixSystem = async () => {
    setLoading(true);
    
    try {
      console.log("Diagnosticando e corrigindo sistema WhatsApp...");
      
      const { data, error } = await supabase.functions.invoke('whatsapp-debug', {
        body: { action: 'diagnose_and_fix' }
      });

      if (error) {
        console.error("Erro na função de debug:", error);
        throw error;
      }

      console.log("Resultado do diagnóstico:", data);

      if (data.ok) {
        toast({
          title: "Sistema Corrigido",
          description: "O sistema foi diagnosticado e corrigido. O envio automático deve funcionar agora.",
        });
        
        // Refresh logs
        await fetchLogs();
      } else {
        toast({
          title: "Erro no Diagnóstico",
          description: data.error || "Erro desconhecido no diagnóstico",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Erro ao diagnosticar sistema:", error);
      toast({
        title: "Erro",
        description: `Erro ao diagnosticar sistema: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'sent': 'default',
      'sending': 'secondary',
      'failed': 'destructive',
      'pending': 'outline'
    } as const;

    const labels = {
      'sent': 'Enviado',
      'sending': 'Enviando',
      'failed': 'Falhou',
      'pending': 'Pendente'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            Agenda WhatsApp - Débora
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={sendDailyAgenda} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Enviar Agenda de Hoje
                </>
              )}
            </Button>
            
            <Button 
              onClick={debugAndFixSystem} 
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Diagnosticando...
                </>
              ) : (
                <>
                  <AlertCircle className="size-4" />
                  Diagnosticar Sistema
                </>
              )}
            </Button>
            
            <div className="text-sm text-muted-foreground">
              <Clock className="inline size-4 mr-1" />
              Envio automático configurado para {currentScheduleTime} diariamente
            </div>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <p><strong>Como funciona:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Busca compromissos da Débora na agenda do dia atual</li>
              <li>Inclui tanto compromissos pessoais quanto compartilhados</li>
              <li>Formata e envia via WhatsApp automaticamente</li>
              <li>Registra o histórico de envios para acompanhamento</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Histórico de Envios ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="size-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum envio registrado ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <strong>{log.user_name}</strong>
                      {getStatusBadge(log.whatsapp_status)}
                      <span className="text-sm text-muted-foreground">
                        {log.appointments_count} compromissos
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { 
                        locale: ptBR 
                      })}
                    </div>
                  </div>
                  
                  {log.whatsapp_status === 'failed' && log.error_details && (
                    <div className="flex items-start gap-2 bg-destructive/10 p-3 rounded text-sm">
                      <AlertCircle className="size-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Erro:</strong>
                        <pre className="mt-1 text-xs">
                          {JSON.stringify(log.error_details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {log.message_content && (
                    <details className="cursor-pointer">
                      <summary className="text-sm font-medium mb-2">
                        Ver mensagem enviada
                      </summary>
                      <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                        {log.message_content}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}