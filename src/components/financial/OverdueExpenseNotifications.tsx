import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OverdueNotification {
  id: string;
  client_id: string;
  expense_count: number;
  total_amount: number;
  notification_date: string;
  due_date: string;
  status: string;
  whatsapp_sent_at: string | null;
  email_sent_at: string | null;
  client: {
    name: string;
    email: string;
    phone: string;
  };
}

export function OverdueExpenseNotifications() {
  const [notifications, setNotifications] = useState<OverdueNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel('overdue_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'overdue_expense_notifications'
      }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('overdue_expense_notifications')
        .select(`
          *,
          client:clients!client_id(name, email, phone)
        `)
        .in('status', ['pending', 'whatsapp_sent', 'email_sent'])
        .order('notification_date', { ascending: false });

      if (error) throw error;
      setNotifications((data as any) || []);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async (
    notificationId: string, 
    sendWhatsApp: boolean, 
    sendEmail: boolean
  ) => {
    setSending(notificationId);

    try {
      const { error } = await supabase.functions.invoke('send-overdue-notification', {
        body: {
          notification_id: notificationId,
          send_whatsapp: sendWhatsApp,
          send_email: sendEmail
        }
      });

      if (error) throw error;

      toast({
        title: 'Notificação enviada',
        description: 'Cliente notificado com sucesso!'
      });

      loadNotifications();
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a notificação',
        variant: 'destructive'
      });
    } finally {
      setSending(null);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('overdue_expense_notifications')
        .update({ status: 'dismissed' })
        .eq('id', notificationId);

      if (error) throw error;
      loadNotifications();
    } catch (error) {
      console.error('Erro ao dispensar notificação:', error);
    }
  };

  if (loading) return null;
  if (notifications.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <Bell className="h-5 w-5" />
          Despesas Vencidas - Notificações Pendentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map(notif => (
          <div key={notif.id} className="flex items-center justify-between p-4 bg-background rounded-lg border">
            <div className="flex-1">
              <div className="font-medium">{notif.client.name}</div>
              <div className="text-sm text-muted-foreground">
                {notif.expense_count} {notif.expense_count > 1 ? 'despesas' : 'despesa'} vencida
                {notif.expense_count > 1 ? 's' : ''} • R$ {Number(notif.total_amount).toFixed(2).replace('.', ',')}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Vencimento: {new Date(notif.due_date).toLocaleDateString('pt-BR')}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={
                notif.status === 'both_sent' ? 'default' :
                notif.status === 'whatsapp_sent' ? 'secondary' :
                notif.status === 'email_sent' ? 'secondary' : 'outline'
              }>
                {notif.status === 'both_sent' && '✓ Enviado'}
                {notif.status === 'whatsapp_sent' && '📱 WhatsApp enviado'}
                {notif.status === 'email_sent' && '✉️ Email enviado'}
                {notif.status === 'pending' && 'Pendente'}
              </Badge>

              {notif.status !== 'both_sent' && (
                <>
                  {!notif.whatsapp_sent_at && notif.client.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendNotification(notif.id, true, false)}
                      disabled={sending === notif.id}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      WhatsApp
                    </Button>
                  )}

                  {!notif.email_sent_at && notif.client.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendNotification(notif.id, false, true)}
                      disabled={sending === notif.id}
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </Button>
                  )}

                  {notif.status === 'pending' && notif.client.phone && notif.client.email && (
                    <Button
                      size="sm"
                      onClick={() => handleSendNotification(notif.id, true, true)}
                      disabled={sending === notif.id}
                    >
                      Enviar Ambos
                    </Button>
                  )}
                </>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss(notif.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
