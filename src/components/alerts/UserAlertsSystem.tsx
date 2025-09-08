import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Plus, Clock, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";


const alertFormSchema = z.object({
  alert_type: z.enum(["daily_hours", "weekly_hours", "monthly_hours", "project_hours"]),
  threshold_value: z.string().min(1, "Insira um valor"),
  is_active: z.boolean().default(true)
});

interface UserAlert {
  id: string;
  alert_type: string;
  threshold_value: number;
  is_active: boolean;
  notification_sent_at?: string;
  created_at: string;
}

const alertTypeLabels = {
  daily_hours: "Horas Diárias",
  weekly_hours: "Horas Semanais",
  monthly_hours: "Horas Mensais",
  project_hours: "Horas por Projeto"
};

export function UserAlertsSystem() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof alertFormSchema>>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      alert_type: "daily_hours",
      threshold_value: "",
      is_active: true
    }
  });

  const loadAlerts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os alertas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [user]);

  const onSubmit = async (values: z.infer<typeof alertFormSchema>) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('user_alerts').insert({
        user_id: user.id,
        alert_type: values.alert_type,
        threshold_value: parseFloat(values.threshold_value),
        is_active: values.is_active
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Alerta criado com sucesso."
      });

      form.reset();
      setIsDialogOpen(false);
      loadAlerts();
    } catch (error) {
      console.error('Erro ao criar alerta:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar alerta.",
        variant: "destructive"
      });
    }
  };

  const toggleAlert = async (alertId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_alerts')
        .update({ is_active: !currentStatus })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, is_active: !currentStatus } : alert
      ));

      toast({
        title: "Sucesso!",
        description: `Alerta ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao alterar alerta:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do alerta.",
        variant: "destructive"
      });
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('user_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.filter(alert => alert.id !== alertId));

      toast({
        title: "Sucesso!",
        description: "Alerta removido com sucesso."
      });
    } catch (error) {
      console.error('Erro ao remover alerta:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover alerta.",
        variant: "destructive"
      });
    }
  };

  if (user?.role !== 'user') {
    return null; // Only show for users with role 'user'
  }

  if (loading) {
    return <div>Carregando alertas...</div>;
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle>Carregando alertas...</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <Tabs defaultValue="time-alerts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="time-alerts" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Alertas de Tempo
            </TabsTrigger>
            <TabsTrigger value="legacy-alerts" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alertas Simples
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="time-alerts">
            
          </TabsContent>
          
          <TabsContent value="legacy-alerts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Sistema de Alertas Simples
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure alertas básicos para controlar suas horas trabalhadas
                  </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Novo Alerta
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Alerta</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="alert_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Alerta</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily_hours">Horas Diárias</SelectItem>
                                  <SelectItem value="weekly_hours">Horas Semanais</SelectItem>
                                  <SelectItem value="monthly_hours">Horas Mensais</SelectItem>
                                  <SelectItem value="project_hours">Horas por Projeto</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="threshold_value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valor Limite (horas)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  placeholder="Ex: 8"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="is_active"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Alerta Ativo</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                  Receber notificações quando atingir o limite
                                </div>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit">
                            Criar Alerta
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum alerta configurado ainda.</p>
                    <p className="text-sm">Crie alertas para monitorar suas horas de trabalho.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={alert.is_active ? "default" : "secondary"}>
                              {alertTypeLabels[alert.alert_type as keyof typeof alertTypeLabels]}
                            </Badge>
                            <span className="text-sm font-medium">
                              {alert.threshold_value}h
                            </span>
                          </div>
                          {alert.notification_sent_at && (
                            <Badge variant="outline" className="text-xs">
                              Último alerta: {new Date(alert.notification_sent_at).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={alert.is_active}
                            onCheckedChange={() => toggleAlert(alert.id, alert.is_active)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAlert(alert.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}