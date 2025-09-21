import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { UserAlertsSystem } from "@/components/alerts/UserAlertsSystem";
import { HolidaySyncDialog } from "@/components/agenda/HolidaySyncDialog";
import WhatsAppAgendaManager from "@/components/WhatsAppAgendaManager";
import { WhatsAppScheduleConfig } from "@/components/WhatsAppScheduleConfig";
import { useAuth } from "@/state/auth";
import { useToast } from "@/hooks/use-toast";
import { useThemeWithDatabase } from "@/hooks/useThemeWithDatabase";
import { useGradientDatabase } from "@/hooks/useGradientDatabase";
import { supabase } from "@/integrations/supabase/client";
import UnifiedUserManagement from "@/pages/UnifiedUserManagement";
import { 
  Monitor, 
  Sun, 
  Moon, 
  User, 
  Bell, 
  Shield, 
  Palette,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  MessageSquare,
  Download,
  Calendar
} from "lucide-react";

interface NotificationSettings {
  emailNotifications: boolean;
  taskReminders: boolean;
  clientUpdates: boolean;
  systemAlerts: boolean;
}

export default function Settings() {
  const { theme, setTheme } = useThemeWithDatabase();
  const { selectedGradient, applyGradient, gradientOptions } = useGradientDatabase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isHolidaySyncDialogOpen, setIsHolidaySyncDialogOpen] = useState(false);
  
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    taskReminders: true,
    clientUpdates: false,
    systemAlerts: true
  });
  
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    fullName: user?.name || "",
    email: user?.email || "",
    telefone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Atualizar perfil
  const updateProfile = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Atualizar email se foi alterado
      if (profileForm.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profileForm.email
        });
        if (emailError) throw emailError;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileForm.fullName,
          email: profileForm.email,
          telefone: profileForm.telefone
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso!"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar perfil",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Alterar senha
  const updatePassword = async () => {
    if (!profileForm.newPassword || !profileForm.confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos de senha",
        variant: "destructive"
      });
      return;
    }

    if (profileForm.newPassword !== profileForm.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    if (profileForm.newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: profileForm.newPassword
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso!"
      });

      // Limpar os campos de senha
      setProfileForm(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar senha",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Aplicar gradiente e paleta de cores selecionados
  const handleGradientChange = (gradientName: string) => {
    applyGradient(gradientName);
  };

  // Carregar dados do perfil do usuário
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('telefone')
          .eq('user_id', user.id)
          .single();
          
        setProfileForm({
          username: user?.username || "",
          fullName: user?.name || "",
          email: user?.email || "",
          telefone: profile?.telefone || "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      }
    };
    
    loadUserProfile();
  }, [user]);

  const themes = [
    { id: "light", name: "Claro", icon: Sun },
    { id: "dark", name: "Escuro Suave", icon: Moon }
  ];

  // Check if user is admin or Débora to show WhatsApp tab
  const showWhatsAppTab = user?.role === 'admin' || user?.name === 'Débora';
  const isAdmin = user?.role === 'admin';
  const totalTabs = 3 + (showWhatsAppTab ? 1 : 0) + (isAdmin ? 1 : 0);
  const gridColsClass = totalTabs === 5 ? 'grid-cols-5' : totalTabs === 4 ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Configurações" 
        subtitle="Gerencie suas preferências e configurações do sistema" 
      />
      
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className={`grid w-full ${gridColsClass}`}>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="size-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="size-4" />
            Aparência
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="size-4" />
            Notificações
          </TabsTrigger>
          {showWhatsAppTab && (
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="size-4" />
              WhatsApp
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Shield className="size-4" />
              Usuários
            </TabsTrigger>
          )}
        </TabsList>

        {/* Aba Perfil */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Atualize suas informações de perfil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Nome de usuário</Label>
                  <Input
                    id="username"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Digite seu nome de usuário"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Digite seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={profileForm.telefone}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email"
                    value={user?.email || ""} 
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Digite seu email"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={updateProfile} disabled={loading}>
                  {loading && <RefreshCw className="mr-2 size-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Alterar Senha
              </CardTitle>
              <CardDescription>
                Mantenha sua conta segura com uma senha forte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha atual</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPassword ? "text" : "password"}
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Digite sua senha atual"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Digite a nova senha"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirme a nova senha"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  disabled={loading || !profileForm.newPassword || !profileForm.confirmPassword}
                  onClick={updatePassword}
                >
                  {loading && <RefreshCw className="mr-2 size-4 animate-spin" />}
                  Alterar Senha
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Aparência */}
        <TabsContent value="appearance" className="space-y-4">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-5" />
                Tema do Sistema
              </CardTitle>
              <CardDescription>
                Escolha o tema que melhor se adapta ao seu estilo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {themes.map((themeOption) => (
                  <div
                    key={themeOption.id}
                    className={`relative p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                      theme === themeOption.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => setTheme(themeOption.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <themeOption.icon className="size-5" />
                      {theme === themeOption.id && (
                        <CheckCircle className="size-4 text-primary" />
                      )}
                    </div>
                    <h3 className="font-medium">{themeOption.name}</h3>
                     <div className="mt-3 flex gap-1">
                       <div className={`w-4 h-4 rounded-full ${
                         themeOption.id === "light" ? "bg-white border" : "bg-slate-800"
                       }`} />
                       <div className="w-4 h-4 rounded-full bg-primary" />
                       <div className="w-4 h-4 rounded-full bg-secondary" />
                     </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-5" />
                Gradientes do Sistema
              </CardTitle>
              <CardDescription>
                Personalize os gradientes e paletas de cores utilizados em botões, headers e elementos decorativos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {gradientOptions.map((gradientOption) => (
                  <div
                    key={gradientOption.name}
                    className={`relative p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                      selectedGradient === gradientOption.name ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => handleGradientChange(gradientOption.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Preview do gradiente */}
                        <div 
                          className="w-8 h-8 rounded-lg border shadow-sm"
                          style={{ background: gradientOption.gradient }}
                        />
                        <div>
                          <h4 className="font-medium">{gradientOption.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            Clique para aplicar gradiente e paleta de cores
                          </p>
                        </div>
                      </div>
                      {selectedGradient === gradientOption.name && (
                        <CheckCircle className="size-4 text-primary" />
                      )}
                    </div>
                    
                    {/* Barra de demonstração */}
                    <div 
                      className="mt-3 h-3 rounded-full"
                      style={{ background: gradientOption.gradient }}
                    />
                  </div>
                ))}
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Palette className="size-4" />
                  <span>Os gradientes e paletas são aplicados em botões, headers, cores primárias e elementos decorativos</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Notificações */}
        <TabsContent value="notifications" className="space-y-4">
          <UserAlertsSystem />
          
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                Sincronização de Feriados
              </CardTitle>
              <CardDescription>
                Importe feriados nacionais e mantenha sua agenda atualizada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Sincronizar Feriados Nacionais</p>
                  <p className="text-xs text-muted-foreground">
                    Baixe automaticamente os feriados nacionais para o ano selecionado
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setIsHolidaySyncDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Download className="size-4" />
                  Sincronizar
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-5" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>
                Configure quando e como você quer ser notificado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries({
                emailNotifications: "Notificações por email",
                taskReminders: "Lembretes de tarefas",
                clientUpdates: "Atualizações de clientes",
                systemAlerts: "Alertas do sistema"
              }).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">
                      {key === "emailNotifications" && "Receba notificações importantes por email"}
                      {key === "taskReminders" && "Seja lembrado sobre tarefas pendentes"}
                      {key === "clientUpdates" && "Notificações sobre mudanças nos clientes"}
                      {key === "systemAlerts" && "Alertas críticos do sistema"}
                    </p>
                  </div>
                  <Switch
                    checked={notifications[key as keyof NotificationSettings]}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, [key]: checked }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba WhatsApp */}
        {showWhatsAppTab && (
          <TabsContent value="whatsapp" className="space-y-4">
            <WhatsAppScheduleConfig />
            <WhatsAppAgendaManager />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            <UnifiedUserManagement showHeader={false} />
          </TabsContent>
        )}
      </Tabs>
      
      <HolidaySyncDialog 
        open={isHolidaySyncDialogOpen} 
        onOpenChange={setIsHolidaySyncDialogOpen} 
        onHolidaysSynced={() => {
          // Callback executado após sincronização bem-sucedida
          // Aqui você pode adicionar lógica adicional se necessário
        }} 
      />
    </div>
  );
}
