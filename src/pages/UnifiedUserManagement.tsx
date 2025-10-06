import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Shield, Search, Users, Building, UserCheck, Key, RefreshCw, Edit2, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth, Role, type Setor } from "@/state/auth";
import { getRoleLabel, getRoleBadgeVariant } from "@/lib/roleUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { UserStatusControl } from "@/components/users/UserStatusControl";

// Interfaces unificadas
interface UnifiedUser {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  telefone?: string;
  role: Role;
  created_at: string;
  type: 'system_user';
  active: boolean;
}

interface UnifiedClient {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cnpj?: string;
  cidade?: string;
  setor: Setor;
  admin_responsavel?: string;
  created_at: string;
  type: 'client';
}

type UnifiedEntity = UnifiedUser | UnifiedClient;

interface UnifiedUserManagementProps {
  showHeader?: boolean;
}

interface EntityStats {
  totalUsers: number;
  totalAdmins: number;
  totalClients: number;
  clientsBySetor: Record<string, number>;
}

export default function UnifiedUserManagement({ showHeader = true }: UnifiedUserManagementProps) {
  const { user, login, refreshUser } = useAuth();
  const { toast } = useToast();
  
  // Estados principais
  const [entities, setEntities] = useState<UnifiedEntity[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<UnifiedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "users" | "clients">("all");
  const [filterSetor, setFilterSetor] = useState<string>("all");
  const [stats, setStats] = useState<EntityStats>({
    totalUsers: 0,
    totalAdmins: 0,
    totalClients: 0,
    clientsBySetor: {}
  });
  
  // Estados de dialogs
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  
  // Formulários
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    username: "",
    fullName: "",
    telefone: "",
    role: "user" as Role
  });
  
  const [clientForm, setClientForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cpf: "",
    data_nascimento: "",
    endereco_residencial: "",
    endereco_obra: "",
    indicacao: "",
    classificacao: "cliente" as "cliente" | "colaborador" | "fornecedor"
  });
  
  const [resetForm, setResetForm] = useState({
    username: "",
    newPassword: ""
  });

  // Fetch unificado de dados
  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Buscar usuários do sistema (incluindo inativos) via Edge Function
      const { data: profilesResponse, error: profilesError } = await supabase
        .functions.invoke('list-system-users');

      if (profilesError) throw profilesError;
      if (!profilesResponse?.success) {
        throw new Error(profilesResponse?.error || 'Falha ao carregar usuários do sistema');
      }

      const profiles = (profilesResponse?.profiles ?? []) as Array<{
        id: string;
        user_id: string;
        name: string | null;
        email: string | null;
        telefone?: string | null;
        role: string;
        created_at: string;
        active: boolean | null;
      }>;

      // Buscar clientes
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Since user_roles table doesn't exist, use profiles.role directly
      const roleMap = new Map();
      profiles?.forEach(profile => {
        roleMap.set(profile.user_id, profile.role);
      });

      // Processar dados dos usuários
      const systemUsers: UnifiedUser[] = profiles?.map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        username: profile.name || 'Sem username',
        full_name: profile.name || 'Nome não informado',
        email: profile.email || 'Email não informado',
        telefone: '',
        role: profile.role as Role,
        created_at: profile.created_at,
        type: 'system_user' as const,
        active: profile.active ?? true
      })) || [];

      // Processar dados dos clientes
      const clientEntities: UnifiedClient[] = clients?.map(client => ({
        id: client.id,
        nome: client.name,
        email: client.email,
        telefone: client.phone || '',
        cnpj: client.cpf,
        cidade: client.residential_address,
        setor: client.classification?.toUpperCase() as Setor,
        admin_responsavel: client.created_by,
        created_at: client.created_at,
        type: 'client' as const
      })) || [];

      // Combinar dados
      const allEntities = [...systemUsers, ...clientEntities];
      setEntities(allEntities);

      // Calcular estatísticas
      const newStats: EntityStats = {
        totalUsers: systemUsers.length,
        totalAdmins: systemUsers.filter(u => ['admin', 'supervisor', 'coordenador'].includes(u.role)).length,
        totalClients: clientEntities.length,
        clientsBySetor: clientEntities.reduce((acc, client) => {
          acc[client.setor] = (acc[client.setor] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      setStats(newStats);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do sistema",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar se é master admin
  const checkMasterAdmin = async () => {
    if (!user?.id || user.role !== 'admin') {
      setIsMasterAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('master_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIsMasterAdmin(!!data);
    } catch (error) {
      console.error('Erro ao verificar master admin:', error);
      setIsMasterAdmin(false);
    }
  };

  // Filtros e busca
  useEffect(() => {
    let filtered = entities;

    // Filtro por tipo
    if (filterType === 'users') {
      filtered = filtered.filter(entity => entity.type === 'system_user');
    } else if (filterType === 'clients') {
      filtered = filtered.filter(entity => entity.type === 'client');
    }

    // Filtro por setor (apenas clientes)
    if (filterSetor !== 'all') {
      filtered = filtered.filter(entity => 
        entity.type === 'client' ? entity.setor === filterSetor : true
      );
    }

    // Busca por termo
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entity => {
        if (entity.type === 'system_user') {
          return (
            entity.username.toLowerCase().includes(term) ||
            entity.full_name.toLowerCase().includes(term) ||
            entity.email.toLowerCase().includes(term) ||
            entity.telefone?.toLowerCase().includes(term)
          );
        } else {
          return (
            entity.nome.toLowerCase().includes(term) ||
            entity.email?.toLowerCase().includes(term) ||
            entity.telefone?.toLowerCase().includes(term) ||
            entity.cnpj?.toLowerCase().includes(term) ||
            entity.cidade?.toLowerCase().includes(term)
          );
        }
      });
    }

    setFilteredEntities(filtered);
  }, [entities, searchTerm, filterType, filterSetor]);

  // Carregar dados na montagem
  useEffect(() => {
    fetchAllData();
    checkMasterAdmin();
  }, [user?.id]);

  // Criar usuário
  const createUser = async () => {
    if (!userForm.email || !userForm.password || !userForm.username) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      // Verificar se pode criar admin
      if (userForm.role === 'admin' && !isMasterAdmin) {
        toast({
          title: "Erro",
          description: "Apenas Master Admin pode criar outros administradores",
          variant: "destructive"
        });
        return;
      }

      // Use edge function to create user without affecting admin session
      const { data, error } = await supabase.functions.invoke('create-user-admin', {
        body: {
          email: userForm.email,
          password: userForm.password,
          username: userForm.username,
          fullName: userForm.fullName || userForm.username,
          telefone: userForm.telefone,
          role: userForm.role
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Sucesso",
        description: `Usuário ${userForm.username} criado com sucesso! Fazendo login automaticamente...`
      });

      // Login automático com o usuário criado
      try {
        // Primeiro fazer logout do admin atual
        toast({
          title: "Sucesso",
          description: `Usuário ${userForm.username} criado com sucesso! Fazendo logout e login automaticamente...`
        });
        
        // Limpar sessão atual
        await supabase.auth.signOut();
        
        // Aguardar um pouco para garantir que o logout foi processado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fazer login com as credenciais do usuário criado
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: userForm.email,
          password: userForm.password,
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

      setUserForm({ email: "", password: "", username: "", fullName: "", telefone: "", role: "user" });
      setCreateUserOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive"
      });
    }
  };

  // Criar cliente com usuário
  const createClientWithUser = async () => {
    if (!clientForm.nome || !clientForm.cpf || !clientForm.endereco_residencial) {
      toast({
        title: "Erro",
        description: "Nome, CPF/CNPJ e Endereço Residencial são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Primeiro criar o usuário
      const { data: authData, error: authError } = await supabase.functions.invoke('create-user-admin', {
        body: {
          email: clientForm.email || `${clientForm.nome.toLowerCase().replace(/\s+/g, '')}@cliente.com`,
          password: 'temp123', // Senha temporária
          username: clientForm.nome.toLowerCase().replace(/\s+/g, ''),
          fullName: clientForm.nome,
          telefone: clientForm.telefone,
          role: 'user'
        }
      });

      if (authError || (authData?.error && !authData?.userExists)) {
        console.error('Erro ao criar usuário:', authError || authData?.error);
        toast({
          title: "Erro",
          description: "Erro ao criar usuário de acesso",
          variant: "destructive"
        });
        return;
      }

      // Aguardar sincronização
      await new Promise(resolve => setTimeout(resolve, 500));

      // Criar cliente usando nova função
      const clientData = {
        nome: clientForm.nome,
        email: clientForm.email || null,
        telefone: clientForm.telefone || null,
        cpf: clientForm.cpf,
        data_nascimento: clientForm.data_nascimento || null,
        endereco_residencial: clientForm.endereco_residencial,
        endereco_obra: clientForm.endereco_obra || null,
        indicacao: clientForm.indicacao || null,
        classificacao: clientForm.classificacao,
        admin_responsavel: user?.id
      };

      const { data, error } = await supabase.from('clients').insert({
        name: clientData.nome,
        cpf: clientData.cpf,
        email: clientData.email,
        phone: clientData.telefone,
        birth_date: clientData.data_nascimento,
        residential_address: clientData.endereco_residencial,
        construction_address: clientData.endereco_obra,
        indication: clientData.indicacao,
        classification: clientData.classificacao,
        created_by: user?.id
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Cliente ${clientForm.nome} criado com sucesso!`
      });

      setClientForm({ 
        nome: "", 
        email: "", 
        telefone: "", 
        cpf: "", 
        data_nascimento: "",
        endereco_residencial: "",
        endereco_obra: "",
        indicacao: "",
        classificacao: "cliente"
      });
      setCreateClientOpen(false);
      fetchAllData();
    } catch (error: any) {
      console.error('Erro completo:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar cliente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Atualizar role de usuário
  const updateUserRole = async (userId: string, newRole: Role) => {
    try {
      console.log('Updating user role:', { userId, newRole });

      if (newRole === 'admin') {
        if (!isMasterAdmin) {
          toast({
            title: "Permissão negada",
            description: "Apenas Master Admin pode promover usuários a Administrador",
            variant: "destructive"
          });
          return;
        }
      }

      // First find the profile by user_id to get the correct id
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', userId)
        .single();

      if (findError || !profile) {
        console.error('Error finding profile:', findError);
        throw new Error('Usuário não encontrado');
      }

      // Update role using the profile id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Error updating role:', updateError);
        throw updateError;
      }

      // Atualizar entidade localmente para feedback imediato
      setEntities(prev => prev.map(entity => {
        if (entity.type === 'system_user' && entity.user_id === userId) {
          return { ...entity, role: newRole };
        }
        return entity;
      }));

      toast({
        title: "Sucesso",
        description: `Role do usuário atualizado para ${getRoleLabel(newRole)}`
      });

      // Refresh data to ensure consistency
      setTimeout(() => fetchAllData(), 1000);

      // If updating current user, refresh their session
      if (userId === user?.id) {
        await refreshUser();
      }
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar role do usuário",
        variant: "destructive"
      });
    }
  };


  // Resetar senha
  const resetPassword = async () => {
    if (!resetForm.username || !resetForm.newPassword) {
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
          username: resetForm.username,
          newPassword: resetForm.newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao resetar senha');
      }

      toast({
        title: "Sucesso",
        description: `Senha do usuário ${resetForm.username} foi alterada`
      });
      
      setResetForm({ username: "", newPassword: "" });
      setResetPasswordOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao resetar senha",
        variant: "destructive"
      });
    }
  };

  // Componente para renderizar entidade
  const renderEntity = (entity: UnifiedEntity) => {
    const isUser = entity.type === 'system_user';
    const isClient = entity.type === 'client';
    const isCurrentUser = isUser && entity.user_id === user?.id;
    const isAdminTarget = isUser && entity.role === 'admin';
    const viewerIsAdmin = user?.role === 'admin';
    const requiresMasterAdmin = isUser && !isCurrentUser && isAdminTarget && !isMasterAdmin;
    const canManageStatus = isUser && !isCurrentUser && viewerIsAdmin && (isMasterAdmin || !isAdminTarget);
    const canManageRoles = isUser && !isCurrentUser && viewerIsAdmin && (isMasterAdmin || !isAdminTarget);
    const statusDisabledReason = !canManageStatus
      ? isCurrentUser
        ? "Você não pode alterar o próprio status."
        : !viewerIsAdmin
          ? "Apenas administradores podem alterar status de usuários."
          : requiresMasterAdmin
            ? "Apenas Master Admin pode alterar o status de administradores."
            : undefined
      : undefined;

    return (
      <div key={entity.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {isUser ? (
                <Users className="h-5 w-5 text-blue-500" />
              ) : (
                <Building className="h-5 w-5 text-green-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium">
                  {isUser ? entity.full_name : entity.nome}
                </p>
                {isUser && (
                  <Badge variant={getRoleBadgeVariant(entity.role)}>
                    {getRoleLabel(entity.role)}
                  </Badge>
                )}
                {isClient && (
                  <Badge variant="outline" className="text-xs">
                    {entity.setor}
                  </Badge>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                {isUser && (
                  <>
                    <p>@{entity.username} • {entity.email}</p>
                    {entity.telefone && <p>📱 {entity.telefone}</p>}
                  </>
                )}
                {isClient && (
                  <>
                    <p>🏢 {entity.cnpj} • {entity.cidade}</p>
                    {entity.email && <p>📧 {entity.email}</p>}
                    {entity.telefone && <p>📱 {entity.telefone}</p>}
                  </>
                )}
                <p className="text-xs">
                  Criado em {new Date(entity.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isUser && canManageRoles && (
            <Select
              value={entity.role}
              onValueChange={(newRole: Role) => updateUserRole(entity.user_id, newRole)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Colaborador</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="coordenador">Coordenador</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isUser && isCurrentUser && (
            <Badge variant="outline">Você</Badge>
          )}
          {requiresMasterAdmin && (
            <Badge variant="outline" className="text-xs">
              Apenas Master Admin
            </Badge>
          )}

          {/* Controle de Status */}
          <UserStatusControl
            userId={isUser ? entity.user_id : entity.id}
            userType={entity.type}
            active={isUser ? entity.active : undefined} // Para clientes, não temos campo active
            name={isUser ? entity.full_name : entity.nome}
            onUpdate={fetchAllData}
            onStatusChange={(newStatus) => {
              if (entity.type !== 'system_user') return;

              setEntities(prev => prev.map(item => {
                if (item.type === 'system_user' && item.user_id === entity.user_id) {
                  return { ...item, active: newStatus };
                }
                return item;
              }));
            }}
            canToggleStatus={canManageStatus}
            disabledReason={statusDisabledReason}
            canDelete={isMasterAdmin && (isUser ? entity.user_id !== user?.id : true)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", !showHeader && "pt-2")}>
      {showHeader && (
        <PageHeader
          title="Gestão de Usuários e Clientes"
          subtitle="Gerencie usuários do sistema e clientes de forma centralizada"
        />
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Usuários Sistema</p>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <Shield className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Administradores</p>
              <p className="text-2xl font-bold">{stats.totalAdmins}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <Building className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Clientes</p>
              <p className="text-2xl font-bold">{stats.totalClients}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <UserCheck className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Entidades</p>
              <p className="text-2xl font-bold">{stats.totalUsers + stats.totalClients}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles e filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filtros e Ações</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchAllData} disabled={loading}>
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
                        value={resetForm.username}
                        onChange={(e) => setResetForm(f => ({ ...f, username: e.target.value }))}
                        placeholder="nome_usuario"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword">Nova senha *</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={resetForm.newPassword}
                        onChange={(e) => setResetForm(f => ({ ...f, newPassword: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setResetPasswordOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={resetPassword}>
                      Resetar Senha
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Busca */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, telefone, CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Filtro por tipo */}
            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="users">Usuários Sistema</SelectItem>
                <SelectItem value="clients">Clientes</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Filtro por setor */}
            <Select value={filterSetor} onValueChange={setFilterSetor}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos os Tipos</SelectItem>
                 <SelectItem value="CLIENTE">Cliente</SelectItem>
                 <SelectItem value="COLABORADOR">Colaborador</SelectItem>
                 <SelectItem value="FORNECEDOR">Fornecedor</SelectItem>
               </SelectContent>
            </Select>
          </div>

          {/* Botões de criação */}
          <div className="flex gap-2 mb-6">
            <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário do Sistema</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label htmlFor="userEmail">Email *</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="usuario@exemplo.com"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="userPassword">Senha *</Label>
                    <Input
                      id="userPassword"
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="userUsername">Nome de usuário *</Label>
                    <Input
                      id="userUsername"
                      value={userForm.username}
                      onChange={(e) => setUserForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="nome_usuario"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="userFullName">Nome completo</Label>
                    <Input
                      id="userFullName"
                      value={userForm.fullName}
                      onChange={(e) => setUserForm(f => ({ ...f, fullName: e.target.value }))}
                      placeholder="Nome Completo"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="userTelefone">Telefone</Label>
                    <Input
                      id="userTelefone"
                      value={userForm.telefone}
                      onChange={(e) => setUserForm(f => ({ ...f, telefone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nível de acesso</Label>
                    <Select
                      value={userForm.role}
                      onValueChange={(v) => setUserForm(f => ({ ...f, role: v as Role }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Colaborador</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="coordenador">Coordenador</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        {isMasterAdmin && <SelectItem value="admin">Administrador</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCreateUserOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={createUser}>
                    Criar Usuário
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={createClientOpen} onOpenChange={setCreateClientOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Cliente</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="clientNome">Nome *</Label>
                      <Input
                        id="clientNome"
                        value={clientForm.nome}
                        onChange={(e) => setClientForm(f => ({ ...f, nome: e.target.value }))}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="clientEmail">Email *</Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        value={clientForm.email}
                        onChange={(e) => setClientForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="clientCpf">CPF/CNPJ *</Label>
                      <Input
                        id="clientCpf"
                        value={clientForm.cpf}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          let formatted = value;
                          
                          // Se tem até 11 dígitos, trata como CPF
                          if (value.length <= 11) {
                            if (value.length >= 3) {
                              formatted = `${value.slice(0, 3)}.${value.slice(3)}`;
                            }
                            if (value.length >= 6) {
                              formatted = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
                            }
                            if (value.length >= 9) {
                              formatted = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9, 11)}`;
                            }
                          } else {
                            // Mais de 11 dígitos, trata como CNPJ
                            if (value.length >= 2) {
                              formatted = `${value.slice(0, 2)}.${value.slice(2)}`;
                            }
                            if (value.length >= 5) {
                              formatted = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5)}`;
                            }
                            if (value.length >= 8) {
                              formatted = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8)}`;
                            }
                            if (value.length >= 12) {
                              formatted = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12, 14)}`;
                            }
                          }
                          
                          setClientForm(f => ({ ...f, cpf: formatted }));
                        }}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="clientTelefone">Telefone</Label>
                      <Input
                        id="clientTelefone"
                        value={clientForm.telefone}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          let formatted = value;
                          
                          if (value.length >= 2) {
                            formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                          }
                          if (value.length >= 7) {
                            formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
                          }
                          
                          setClientForm(f => ({ ...f, telefone: formatted }));
                        }}
                        maxLength={15}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="clientDataNascimento">Data de Nascimento</Label>
                      <Input
                        id="clientDataNascimento"
                        type="date"
                        value={clientForm.data_nascimento}
                        onChange={(e) => setClientForm(f => ({ ...f, data_nascimento: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="clientClassificacao">Classificação *</Label>
                      <Select
                        value={clientForm.classificacao}
                        onValueChange={(v) => setClientForm(f => ({ ...f, classificacao: v as "cliente" | "colaborador" | "fornecedor" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a classificação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cliente">Cliente</SelectItem>
                          <SelectItem value="colaborador">Colaborador</SelectItem>
                          <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="clientEnderecoResidencial">Endereço Residencial *</Label>
                    <Input
                      id="clientEnderecoResidencial"
                      value={clientForm.endereco_residencial}
                      onChange={(e) => setClientForm(f => ({ ...f, endereco_residencial: e.target.value }))}
                      placeholder="Rua, número, bairro, cidade, estado"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="clientEnderecoObra">Endereço da Obra</Label>
                    <Input
                      id="clientEnderecoObra"
                      value={clientForm.endereco_obra}
                      onChange={(e) => setClientForm(f => ({ ...f, endereco_obra: e.target.value }))}
                      placeholder="Endereço onde será executado o projeto"
                    />
                  </div>
  
                  <div className="grid gap-2">
                    <Label htmlFor="clientIndicacao">Indicação</Label>
                    <Input
                      id="clientIndicacao"
                      value={clientForm.indicacao}
                      onChange={(e) => setClientForm(f => ({ ...f, indicacao: e.target.value }))}
                      placeholder="Como nos conheceu?"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCreateClientOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={createClientWithUser}>
                    Criar Cliente
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista unificada */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando dados...
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || filterType !== 'all' || filterSetor !== 'all'
                ? "Nenhum resultado encontrado com os filtros aplicados"
                : "Nenhum dado encontrado"
              }
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                Mostrando {filteredEntities.length} de {entities.length} registros
              </p>
              <div className="space-y-2">
                {filteredEntities.map(renderEntity)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}