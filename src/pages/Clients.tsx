import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, Edit, Eye, Mail, Phone, MapPin, User, Gift } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { SearchInput } from "@/components/SearchInput";

// Função para formatar CPF ou CNPJ automaticamente
const formatCPFCNPJ = (value: string | null | undefined) => {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  
  // Se tem até 11 dígitos, trata como CPF
  if (cleaned.length <= 11) {
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    } else if (cleaned.length <= 9) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    } else {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
    }
  } 
  // Se tem mais de 11 dígitos, trata como CNPJ (até 14 dígitos)
  else {
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 5) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    } else if (cleaned.length <= 8) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
    } else if (cleaned.length <= 12) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
    } else {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
    }
  }
};

// Definir tipos
interface Cliente {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone?: string;
  residential_address: string;
  construction_address: string;
  indication: string;
  birth_date?: string;
  classification: 'cliente' | 'colaborador' | 'fornecedor';
  created_at: string;
  updated_at: string;
}

// Schema de validação sem setor
const clienteSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(11, "CPF é obrigatório"),
  phone: z.string().optional(),
  residential_address: z.string().min(1, "Endereço residencial é obrigatório"),
  construction_address: z.string().optional(),
  indication: z.string().optional(),
  birth_date: z.string().optional(),
  classification: z.enum(['cliente', 'colaborador', 'fornecedor']).default('cliente'),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

export default function Clients() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState("todos");

  // Debug logs
  console.log('Clients component render - user:', user?.name, 'clientes count:', clientes.length, 'loading:', loading);

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      name: "",
      email: "",
      cpf: "",
      phone: "",
      residential_address: "",
      construction_address: "",
      indication: "",
      birth_date: "",
      classification: "cliente",
    },
  });

  // Buscar clientes do Supabase
  const fetchClientes = useCallback(async () => {
    console.log('fetchClientes called, user:', user);
    if (!user) {
      console.log('No user, returning early');
      setClientes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('Fazendo query para buscar clientes...');
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      console.log('Resultado da query:', { data, error });
      
      if (error) {
        console.error('Erro ao buscar clientes:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar clientes",
          variant: "destructive"
        });
        return;
      }
      
      console.log('Definindo clientes:', data?.length || 0, 'clientes encontrados');
      setClientes(data || []);
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar clientes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Filtrar clientes por busca e aba ativa
  const filteredClientes = useMemo(() => {
    let result = clientes;

    // Filtrar por aba ativa
    if (activeTab !== "todos") {
      result = result.filter(cliente => cliente.classification === activeTab);
    }
    
    // Filtrar por busca
    if (searchTerm) {
      result = result.filter(cliente => 
        cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.cpf.includes(searchTerm) ||
        cliente.classification.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return result;
  }, [clientes, searchTerm, activeTab]);

  const handleSubmit = async (data: ClienteFormData) => {
    if (!user) return;

    try {
      let profileId: string | null = null;
      // Tenta obter o perfil do usuário (opcional). Se não existir, seguimos sem created_by
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('Não foi possível carregar perfil, continuando sem created_by', profileError);
      } else if (profileData?.id) {
        profileId = profileData.id;
      }

      const clienteData = {
        name: data.name,
        email: data.email,
        cpf: data.cpf.replace(/\D/g, ''), // Remove formatação do CPF
        phone: data.phone || '',
        residential_address: data.residential_address,
        construction_address: data.construction_address || '',
        indication: data.indication || '',
        birth_date: data.birth_date || null,
        classification: data.classification,
      };

      let result;
      if (editingCliente) {
        // Atualizar cliente existente
        result = await supabase
          .from('clients')
          .update(clienteData)
          .eq('id', editingCliente.id);
      } else {
        // Criar novo cliente
        result = await supabase
          .from('clients')
          .insert({
            ...clienteData,
            created_by: profileId ?? null,
          });
      }

      if (result.error) {
        throw result.error;
      }

      toast({
        title: "Sucesso",
        description: editingCliente ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!"
      });

      form.reset();
      setIsDialogOpen(false);
      setEditingCliente(null);
      fetchClientes();
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar cliente",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    form.reset({
      name: cliente.name,
      email: cliente.email,
      cpf: cliente.cpf,
      phone: cliente.phone || "",
      residential_address: cliente.residential_address,
      construction_address: cliente.construction_address || "",
      indication: cliente.indication || "",
      birth_date: cliente.birth_date || "",
      classification: cliente.classification,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente excluído com sucesso!"
      });
      
      fetchClientes();
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir cliente",
        variant: "destructive"
      });
    }
  };

  const getClassificationBadge = (classification: string) => {
    const variants = {
      cliente: 'bg-blue-100 text-blue-800',
      colaborador: 'bg-green-100 text-green-800',
      fornecedor: 'bg-purple-100 text-purple-800'
    };
    return variants[classification as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie seus clientes, colaboradores e fornecedores"
      />

      <div className="flex items-center justify-between gap-4">
        <SearchInput
          placeholder="Buscar clientes..."
          value={searchTerm}
          onChange={setSearchTerm}
          className="max-w-sm"
        />
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingCliente(null);
              form.reset();
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input placeholder="email@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="000.000.000-00 ou 00.000.000/0000-00"
                            {...field}
                            onChange={(e) => {
                              const formatted = formatCPFCNPJ(e.target.value);
                              field.onChange(formatted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div></div>
                </div>

                <FormField
                  control={form.control}
                  name="residential_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço Residencial *</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, bairro, cidade, estado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="construction_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço da Obra</FormLabel>
                      <FormControl>
                        <Input placeholder="Endereço onde será executado o projeto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="indication"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indicação</FormLabel>
                        <FormControl>
                          <Input placeholder="Como nos conheceu?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="classification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classificação *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a classificação" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cliente">Cliente</SelectItem>
                            <SelectItem value="colaborador">Colaborador</SelectItem>
                            <SelectItem value="fornecedor">Fornecedor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingCliente(null);
                      form.reset();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingCliente ? "Atualizar" : "Criar"} Cliente
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="todos" className="px-4">
            Todos
          </TabsTrigger>
          <TabsTrigger value="cliente" className="px-4">
            Cliente
          </TabsTrigger>
          <TabsTrigger value="fornecedor" className="px-4">
            Fornecedor
          </TabsTrigger>
          <TabsTrigger value="colaborador" className="px-4">
            Colaborador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p>Carregando clientes...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClientes.length > 0 ? (
                filteredClientes.map((cliente) => (
                  <Card key={cliente.id} className="group hover:shadow-lg hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5 bg-gradient-to-r from-card to-card/50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Avatar e nome */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                              {cliente.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center text-xs">
                              <Badge className={`${getClassificationBadge(cliente.classification)} w-2 h-2 rounded-full p-0`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {cliente.name}
                            </h3>
                            <Badge className={`${getClassificationBadge(cliente.classification)} capitalize text-xs`} variant="secondary">
                              {cliente.classification}
                            </Badge>
                          </div>
                        </div>

                        {/* Informações em coluna */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">CPF:</span> 
                            <span className="font-mono text-xs">{formatCPFCNPJ(cliente.cpf)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Email:</span> 
                            <span className="truncate text-xs">{cliente.email}</span>
                          </div>

                          {cliente.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Telefone:</span> 
                              <span className="text-xs">{cliente.phone}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Endereço:</span> 
                            <span className="truncate text-xs">{cliente.residential_address}</span>
                          </div>

                          {cliente.indication && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Gift className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Indicação:</span> 
                              <span className="truncate text-xs">{cliente.indication}</span>
                            </div>
                          )}

                          {cliente.birth_date && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="w-3 h-3 text-primary/70 flex items-center justify-center text-xs flex-shrink-0">🎂</div>
                              <span className="font-medium">Nascimento:</span> 
                              <span className="text-xs">{new Date(cliente.birth_date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex justify-end gap-1 pt-2 border-t opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button asChild variant="ghost" size="sm" className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:scale-110">
                            <Link to={`/clients/${cliente.id}`}>
                              <Eye className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                            className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 hover:scale-110"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:scale-110">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o cliente {cliente.name}? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cliente.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum cliente encontrado para sua busca." : "Nenhum cliente cadastrado ainda."}
                    </p>
                    {!searchTerm && (
                      <Button 
                        className="mt-4"
                        onClick={() => setIsDialogOpen(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Primeiro Cliente
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cliente" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p>Carregando clientes...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClientes.length > 0 ? (
                filteredClientes.map((cliente) => (
                  <Card key={cliente.id} className="group hover:shadow-lg hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5 bg-gradient-to-r from-card to-card/50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Avatar e nome */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                              {cliente.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center text-xs">
                              <Badge className={`${getClassificationBadge(cliente.classification)} w-2 h-2 rounded-full p-0`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {cliente.name}
                            </h3>
                            <Badge className={`${getClassificationBadge(cliente.classification)} capitalize text-xs`} variant="secondary">
                              {cliente.classification}
                            </Badge>
                          </div>
                        </div>

                        {/* Informações em coluna */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">CPF:</span> 
                            <span className="font-mono text-xs">{formatCPFCNPJ(cliente.cpf)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Email:</span> 
                            <span className="truncate text-xs">{cliente.email}</span>
                          </div>

                          {cliente.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Telefone:</span> 
                              <span className="text-xs">{cliente.phone}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Endereço:</span> 
                            <span className="truncate text-xs">{cliente.residential_address}</span>
                          </div>

                          {cliente.indication && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Gift className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Indicação:</span> 
                              <span className="truncate text-xs">{cliente.indication}</span>
                            </div>
                          )}

                          {cliente.birth_date && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="w-3 h-3 text-primary/70 flex items-center justify-center text-xs flex-shrink-0">🎂</div>
                              <span className="font-medium">Nascimento:</span> 
                              <span className="text-xs">{new Date(cliente.birth_date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex justify-end gap-1 pt-2 border-t opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button asChild variant="ghost" size="sm" className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:scale-110">
                            <Link to={`/clients/${cliente.id}`}>
                              <Eye className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                            className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 hover:scale-110"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:scale-110">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o cliente {cliente.name}? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cliente.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum cliente encontrado para sua busca." : "Nenhum cliente cadastrado ainda."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fornecedor" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p>Carregando fornecedores...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClientes.length > 0 ? (
                filteredClientes.map((cliente) => (
                  <Card key={cliente.id} className="group hover:shadow-lg hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5 bg-gradient-to-r from-card to-card/50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Avatar e nome */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                              {cliente.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center text-xs">
                              <Badge className={`${getClassificationBadge(cliente.classification)} w-2 h-2 rounded-full p-0`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {cliente.name}
                            </h3>
                            <Badge className={`${getClassificationBadge(cliente.classification)} capitalize text-xs`} variant="secondary">
                              {cliente.classification}
                            </Badge>
                          </div>
                        </div>

                        {/* Informações em coluna */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">CPF:</span> 
                            <span className="font-mono text-xs">{formatCPFCNPJ(cliente.cpf)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Email:</span> 
                            <span className="truncate text-xs">{cliente.email}</span>
                          </div>

                          {cliente.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Telefone:</span> 
                              <span className="text-xs">{cliente.phone}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Endereço:</span> 
                            <span className="truncate text-xs">{cliente.residential_address}</span>
                          </div>

                          {cliente.indication && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Gift className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Indicação:</span> 
                              <span className="truncate text-xs">{cliente.indication}</span>
                            </div>
                          )}

                          {cliente.birth_date && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="w-3 h-3 text-primary/70 flex items-center justify-center text-xs flex-shrink-0">🎂</div>
                              <span className="font-medium">Nascimento:</span> 
                              <span className="text-xs">{new Date(cliente.birth_date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex justify-end gap-1 pt-2 border-t opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button asChild variant="ghost" size="sm" className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:scale-110">
                            <Link to={`/clients/${cliente.id}`}>
                              <Eye className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                            className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 hover:scale-110"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:scale-110">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o cliente {cliente.name}? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cliente.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum fornecedor encontrado para sua busca." : "Nenhum fornecedor cadastrado ainda."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="colaborador" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p>Carregando colaboradores...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClientes.length > 0 ? (
                filteredClientes.map((cliente) => (
                  <Card key={cliente.id} className="group hover:shadow-lg hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5 bg-gradient-to-r from-card to-card/50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Avatar e nome */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                              {cliente.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center text-xs">
                              <Badge className={`${getClassificationBadge(cliente.classification)} w-2 h-2 rounded-full p-0`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {cliente.name}
                            </h3>
                            <Badge className={`${getClassificationBadge(cliente.classification)} capitalize text-xs`} variant="secondary">
                              {cliente.classification}
                            </Badge>
                          </div>
                        </div>

                        {/* Informações em coluna */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">CPF:</span> 
                            <span className="font-mono text-xs">{formatCPFCNPJ(cliente.cpf)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Email:</span> 
                            <span className="truncate text-xs">{cliente.email}</span>
                          </div>

                          {cliente.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Telefone:</span> 
                              <span className="text-xs">{cliente.phone}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-3 h-3 text-primary/70 flex-shrink-0" />
                            <span className="font-medium">Endereço:</span> 
                            <span className="truncate text-xs">{cliente.residential_address}</span>
                          </div>

                          {cliente.indication && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Gift className="w-3 h-3 text-primary/70 flex-shrink-0" />
                              <span className="font-medium">Indicação:</span> 
                              <span className="truncate text-xs">{cliente.indication}</span>
                            </div>
                          )}

                          {cliente.birth_date && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="w-3 h-3 text-primary/70 flex items-center justify-center text-xs flex-shrink-0">🎂</div>
                              <span className="font-medium">Nascimento:</span> 
                              <span className="text-xs">{new Date(cliente.birth_date).toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex justify-end gap-1 pt-2 border-t opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button asChild variant="ghost" size="sm" className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-all duration-200 hover:scale-110">
                            <Link to={`/clients/${cliente.id}`}>
                              <Eye className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                            className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 hover:scale-110"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:scale-110">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o cliente {cliente.name}? 
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cliente.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum colaborador encontrado para sua busca." : "Nenhum colaborador cadastrado ainda."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}