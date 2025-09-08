import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Plus, Shield, UserX, RefreshCw, Key, ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth, Role } from "@/state/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  user_id: string;
  created_at: string;
  role?: Role;
}

export default function UserManagement() {
  const { user, login, refreshUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    fullName: "",
    role: "admin" as Role  // Padrão agora é admin para cadastramento em massa
  });
  const [resetPasswordForm, setResetPasswordForm] = useState({
    username: "",
    newPassword: ""
  });
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching users...');
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Profiles data:', profiles);
      console.log('Profiles error:', profilesError);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        console.log('No profiles found');
        setUsers([]);
        return;
      }

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id)
            .maybeSingle();
          
          if (roleError) {
            console.warn(`Error fetching role for user ${profile.user_id}:`, roleError);
          }
          
          console.log(`Role for user ${profile.user_id}:`, roleData);
          
          return {
            ...profile,
            role: roleData?.role || 'user'
          };
        })
      );

      console.log('Users with roles:', usersWithRoles);
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkMasterAdmin = async () => {
    if (!user?.id) return;
    
    try {
      const { data } = await supabase
        .from('master_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .single();
      
      setIsMasterAdmin(!!data);
    } catch (error) {
      console.error('Error checking master admin:', error);
      setIsMasterAdmin(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    checkMasterAdmin();
  }, [user?.id]);

  const createUser = async () => {
    if (!form.email || !form.password || !form.username) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Check if username already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', form.username);

    if (checkError) {
      toast({
        title: "Erro",
        description: "Erro ao verificar nome de usuário",
        variant: "destructive"
      });
      return;
    }

    if (existingUsers && existingUsers.length > 0) {
      toast({
        title: "Erro",
        description: "Nome de usuário já está em uso",
        variant: "destructive"
      });
      return;
    }

    try {
      // Verificar se pode criar admin
      console.log('🔍 [FRONTEND] Verificação de permissão:', {
        formRole: form.role,
        isMasterAdmin,
        canCreateAdmin: form.role !== 'admin' || isMasterAdmin
      });
      
      if (form.role === 'admin' && !isMasterAdmin) {
        toast({
          title: "Erro",
          description: "Apenas Master Admin pode criar outros administradores",
          variant: "destructive"
        });
        return;
      }

      // Criar via Edge Function (não afeta sessão atual e aplica role corretamente)
      console.log('🔧 [FRONTEND] Chamando create-user-admin com dados:', {
        email: form.email,
        password: '***',
        username: form.username,
        fullName: form.fullName || form.username,
        telefone: null,
        role: form.role
      });
      
      const { data, error } = await supabase.functions.invoke('create-user-admin', {
        body: {
          email: form.email,
          password: form.password,
          username: form.username,
          fullName: form.fullName || form.username,
          telefone: null,
          role: form.role
        }
      });
      
      console.log('📥 [FRONTEND] Resposta da edge function:', { data, error });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Sucesso",
        description: `Usuário ${form.username} criado com sucesso! Fazendo login automaticamente...`
      });

      // Login automático com o usuário criado
      try {
        // Primeiro fazer logout do admin atual
        toast({
          title: "Sucesso",
          description: `Usuário ${form.username} criado com sucesso! Fazendo logout e login automaticamente...`
        });
        
        // Limpar sessão atual
        await supabase.auth.signOut();
        
        // Aguardar um pouco para garantir que o logout foi processado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fazer login com as credenciais do usuário criado
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        
        if (loginError) {
          throw loginError;
        }
        
        // Redirecionar para dashboard
        window.location.href = '/dashboard';
        
      } catch (loginError) {
        console.error('Erro no login automático:', loginError);
        toast({
          title: "Aviso", 
          description: "Usuário criado, mas falha no login automático. Faça login manualmente.",
          variant: "destructive"
        });
        // Redirecionar para login se houve erro
        window.location.href = '/login';
      }

      setForm({ email: "", password: "", username: "", fullName: "", role: "admin" });
      setCreateOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive"
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: Role) => {
    try {
      console.log('Updating user role:', { userId, newRole });

      if (newRole === 'admin') {
        // Only Master Admins can promote to admin (enforced in DB too)
        if (!isMasterAdmin) {
          toast({
            title: "Permissão negada",
            description: "Apenas Master Admin pode promover usuários a Administrador",
            variant: "destructive"
          });
          return;
        }

        // Fetch target user's email to use RPC (security definer) promotion
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileError || !profile?.email) {
          throw new Error('Não foi possível obter o e-mail do usuário');
        }

        const { error: rpcError } = await supabase.rpc('promote_user_to_admin', {
          user_email: profile.email
        });

        if (rpcError) throw rpcError;
      } else {
        // Demote to user (allowed for admins; DB blocks master admin demotion)
        const { error } = await supabase
          .from('user_roles')
          .update({ role: 'user' })
          .eq('user_id', userId);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: `Role do usuário atualizado para ${newRole === 'admin' ? 'Administrador' : 'Usuário'}`
      });

      fetchUsers();

      if (userId === user?.id) {
        await refreshUser();
      }
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar role",
        variant: "destructive"
      });
    }
  };

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case 'admin': return 'destructive';
      default: return 'secondary';
    }
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      default: return 'Usuário';
    }
  };

  const resetUserPassword = async () => {
    if (!resetPasswordForm.username || !resetPasswordForm.newPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`https://xagbhvhqtgybmzfkcxoa.supabase.co/functions/v1/reset-user-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          username: resetPasswordForm.username,
          newPassword: resetPasswordForm.newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao resetar senha');
      }

      toast({
        title: "Sucesso",
        description: `Senha do usuário ${resetPasswordForm.username} foi alterada`
      });
      setResetPasswordForm({ username: "", newPassword: "" });
      setResetPasswordOpen(false);

    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao resetar senha",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <PageHeader 
          title="Gestão de Usuários" 
          subtitle="Gerencie usuários e suas permissões"
          className="flex-1"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="h-4 w-4 mr-2" />
                Resetar Senha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Resetar Senha de Usuário</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="resetUsername">Nome de usuário *</Label>
                  <Input
                    id="resetUsername"
                    value={resetPasswordForm.username}
                    onChange={(e) => setResetPasswordForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="nome_usuario"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">Nova senha *</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={resetPasswordForm.newPassword}
                    onChange={(e) => setResetPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setResetPasswordOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={resetUserPassword}>
                  Resetar Senha
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Nome de usuário *</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="nome_usuario"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
                    placeholder="Nome Completo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nível de acesso</Label>
                  {isMasterAdmin ? (
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm(f => ({ ...f, role: v as Role }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador (Padrão)</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-2 bg-muted rounded border">
                      <span className="text-sm text-muted-foreground">Usuário (apenas Master Admins podem criar outros admins)</span>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createUser}>
                  Criar Usuário
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Seção especial para Administradores */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            Controle de Administradores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Administradores atuais do sistema:
            </p>
            <div className="grid gap-2">
              {users.filter(u => u.role === 'admin').map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">{admin.full_name || admin.username}</p>
                      <p className="text-sm text-muted-foreground">@{admin.username}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Administrador
                    </Badge>
                  </div>
                  
                  {admin.user_id !== user?.id && isMasterAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <ShieldOff className="h-4 w-4 mr-1" />
                          Remover Admin
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover privilégios de administrador?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover os privilégios de administrador de {admin.full_name || admin.username}?
                            Esta ação pode ser revertida a qualquer momento.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => updateUserRole(admin.user_id, 'user')}>
                            Remover Admin
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {!isMasterAdmin && admin.user_id !== user?.id && (
                    <Badge variant="outline" className="text-xs">
                      Apenas Master Admin
                    </Badge>
                  )}
                </div>
              ))}
              
              {users.filter(u => u.role === 'admin').length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhum administrador encontrado.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista geral de usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Todos os Usuários do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((userProfile) => (
                <div key={userProfile.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{userProfile.full_name || userProfile.username}</p>
                        <p className="text-sm text-muted-foreground">@{userProfile.username}</p>
                      </div>
                      <Badge variant={getRoleBadgeVariant(userProfile.role || 'user')}>
                        {getRoleLabel(userProfile.role || 'user')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado em {new Date(userProfile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                   <div className="flex items-center gap-2">
                     {userProfile.user_id !== user?.id && isMasterAdmin && (
                       <Select
                         value={userProfile.role || 'user'}
                         onValueChange={(newRole: Role) => updateUserRole(userProfile.user_id, newRole)}
                       >
                         <SelectTrigger className="w-40">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="user">Usuário</SelectItem>
                           <SelectItem value="admin">Administrador</SelectItem>
                         </SelectContent>
                       </Select>
                     )}
                     {!isMasterAdmin && userProfile.user_id !== user?.id && (
                       <Badge variant="outline" className="text-xs">
                         Apenas Master Admin
                       </Badge>
                     )}
                     {userProfile.user_id === user?.id && (
                       <Badge variant="outline">Você</Badge>
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