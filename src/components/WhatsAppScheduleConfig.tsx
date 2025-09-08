import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Save, History, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SettingsLog {
  id: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  description: string;
}

export const WhatsAppScheduleConfig = () => {
  const [currentSchedule, setCurrentSchedule] = useState('08:00');
  const [newSchedule, setNewSchedule] = useState('08:00');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState<SettingsLog[]>([]);
  const { toast } = useToast();
  const [brazilTime, setBrazilTime] = useState<string>('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastTriggeredKey, setLastTriggeredKey] = useState<string>('');

  useEffect(() => {
    fetchCurrentSchedule();
    fetchLogs();
  }, []);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(now);
      setBrazilTime(formatted);

      // Check if we should auto-trigger
      checkAutoTrigger(now);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [currentSchedule, lastTriggeredKey]);

  const checkAutoTrigger = (now: Date) => {
    if (!currentSchedule || isTriggering) return;

    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).formatToParts(now);

    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const currentHour = get('hour');
    const currentMinute = get('minute');
    const currentDate = `${get('day')}/${get('month')}/${get('year')}`;
    const key = `${currentDate}-${currentSchedule}`;
    
    // Check if current time matches schedule
    if (`${currentHour}:${currentMinute}` === currentSchedule) {
      // Avoid duplicate triggers for the same date+time
      if (lastTriggeredKey !== key) {
        setLastTriggeredKey(key);
        console.log('🕐 Auto-triggering at scheduled time:', currentSchedule);
        triggerInternalClock(true);
      }
    }
  };

  const fetchCurrentSchedule = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'whatsapp_agenda_schedule')
        .single();

      if (error) {
        console.warn('Could not fetch schedule setting:', error);
        // Set default if no setting exists
        const defaultTime = '08:00';
        setCurrentSchedule(defaultTime);
        setNewSchedule(defaultTime);
        return;
      }

      if (data?.setting_value) {
        // Convert cron format "0 8 * * *" to "08:00"
        const cronParts = data.setting_value.split(' ');
        if (cronParts.length >= 2) {
          const hour = cronParts[1].padStart(2, '0');
          const minute = cronParts[0].padStart(2, '0');
          const timeString = `${hour}:${minute}`;
          console.log('📅 Horário atual configurado:', timeString, '(cron:', data.setting_value, ')');
          setCurrentSchedule(timeString);
          setNewSchedule(timeString);
        }
      } else {
        // Set default if setting value is empty
        const defaultTime = '08:00';
        setCurrentSchedule(defaultTime);
        setNewSchedule(defaultTime);
      }
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a configuração atual",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings_log')
        .select('*')
        .eq('setting_key', 'whatsapp_agenda_schedule')
        .order('changed_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
    }
  };

  const convertTimeToCron = (timeString: string): string => {
    const [hour, minute] = timeString.split(':');
    return `${parseInt(minute)} ${parseInt(hour)} * * *`;
  };

  const convertCronToTime = (cronString: string): string => {
    const parts = cronString.split(' ');
    if (parts.length >= 2) {
      const hour = parts[1].padStart(2, '0');
      const minute = parts[0].padStart(2, '0');
      return `${hour}:${minute}`;
    }
    return '08:00';
  };

  const validateTime = (timeString: string): boolean => {
    const [hour, minute] = timeString.split(':').map(Number);
    return hour >= 6 && hour <= 22 && minute >= 0 && minute <= 59;
  };

  const saveSchedule = async () => {
    if (!validateTime(newSchedule)) {
      toast({
        title: "Horário Inválido",
        description: "O horário deve estar entre 06:00 e 22:00",
        variant: "destructive",
      });
      return;
    }

    if (newSchedule === currentSchedule) {
      toast({
        title: "Nenhuma Alteração",
        description: "O horário informado é igual ao atual",
        variant: "default",
      });
      return;
    }

    setIsSaving(true);
    try {
      const cronSchedule = convertTimeToCron(newSchedule);
      
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-schedule', {
        body: { newSchedule: cronSchedule }
      });

      if (error) throw error;

      if (!data?.ok) {
        throw new Error(data?.error || 'Erro desconhecido');
      }

      setCurrentSchedule(newSchedule);
      await fetchLogs(); // Refresh logs

      toast({
        title: "Sucesso!",
        description: data.message || `Horário alterado para ${newSchedule}`,
        variant: "default",
      });

      if (data.immediateJobCreated) {
        toast({
          title: "Envio Agendado para Hoje!",
          description: `Um envio foi agendado para hoje às ${newSchedule}`,
          variant: "default",
        });
      }

    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Erro ao Salvar",
        description: error.message || "Não foi possível alterar o horário",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const triggerInternalClock = async (isAutoTrigger = false) => {
    setIsTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke('internal-clock', {
        body: { manual: !isAutoTrigger, auto: isAutoTrigger }
      });
      if (error) throw error;

      const prefix = isAutoTrigger ? '🕐 Disparo automático' : 'Relógio executado';
      
      if (data?.executed) {
        toast({ title: prefix, description: 'Envio disparado conforme horário.' });
      } else if (data?.skipped) {
        const reason = data?.reason === 'already_executed' ? 'Já executado hoje.' : 'Sem correspondência com o horário agora.';
        if (!isAutoTrigger) {
          toast({ title: 'Verificação concluída', description: reason });
        }
      } else {
        if (!isAutoTrigger) {
          toast({ title: 'Relógio verificado', description: `Estado atual: ${data?.now || '—'}` });
        }
      }
      await fetchLogs();
    } catch (error: any) {
      console.error('Error triggering internal clock:', error);
      if (!isAutoTrigger) {
        toast({ title: 'Erro', description: error.message || 'Falha ao rodar verificação', variant: 'destructive' });
      }
    } finally {
      setIsTriggering(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configuração de Horário
          </CardTitle>
          <CardDescription>
            Configure o horário para envio automático da agenda da Débora via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="current-schedule">Horário Atual</Label>
              <div className="mt-1">
                <Badge variant="outline" className="text-sm">
                  {currentSchedule}
                </Badge>
              </div>
            </div>
            <div className="flex-1">
              <Label htmlFor="new-schedule">Novo Horário</Label>
              <Input
                id="new-schedule"
                type="time"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                min="06:00"
                max="22:00"
                className="mt-1"
              />
            </div>
          </div>

          {!validateTime(newSchedule) && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              O horário deve estar entre 06:00 e 22:00
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Relógio (Brasil)</Label>
              <div className="mt-1">
                <Badge variant="secondary">{brazilTime || '—'}</Badge>
              </div>
            </div>
            <Button onClick={() => triggerInternalClock()} disabled={isTriggering} variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              {isTriggering ? 'Verificando...' : 'Rodar verificação agora'}
            </Button>
          </div>

          <Button 
            onClick={saveSchedule} 
            disabled={isSaving || !validateTime(newSchedule) || newSchedule === currentSchedule}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Novo Horário'}
          </Button>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Alterações
            </CardTitle>
            <CardDescription>
              Últimas 5 alterações de horário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span>De {convertCronToTime(log.old_value)}</span>
                      <span>→</span>
                      <span className="font-medium">{convertCronToTime(log.new_value)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.description}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.changed_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};