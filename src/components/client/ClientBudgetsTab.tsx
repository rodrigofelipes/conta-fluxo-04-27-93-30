import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, DollarSign, Calendar, Eye, Edit, FileText, Building } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { useGradientDatabase } from "@/hooks/useGradientDatabase";

const budgetFormSchema = z.object({
  title: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
  description: z.string().optional(),
  total_amount: z.string().min(1, "Insira o valor total"),
  valid_until: z.string().optional(),
  status: z.enum(["draft", "sent", "approved", "rejected", "expired"])
});

interface ClientBudget {
  id: string;
  title: string;
  description?: string;
  total_amount: number;
  status: "draft" | "sent" | "approved" | "rejected" | "expired";
  version: number;
  valid_until?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  title: string;
}

interface ClientBudgetsTabProps {
  clientId: string;
  onProjectCreated?: () => void;
}

const statusLabels = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  expired: "Expirado"
};

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800"
};

export function ClientBudgetsTab({ clientId, onProjectCreated }: ClientBudgetsTabProps) {
  const { user } = useAuth();
  const { selectedGradient, gradientOptions } = useGradientDatabase();
  const [budgets, setBudgets] = useState<ClientBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<ClientBudget | null>(null);

  const form = useForm<z.infer<typeof budgetFormSchema>>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      title: "",
      description: "",
      total_amount: "",
      valid_until: "",
      status: "draft"
    }
  });

  const editForm = useForm<z.infer<typeof budgetFormSchema>>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      title: "",
      description: "",
      total_amount: "",
      valid_until: "",
      status: "draft"
    }
  });

  const loadBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('client_budgets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBudgets((data || []) as ClientBudget[]);
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [clientId]);

  const onSubmit = async (values: z.infer<typeof budgetFormSchema>) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('client_budgets').insert({
        client_id: clientId,
        title: values.title,
        description: values.description,
        total_amount: parseFloat(values.total_amount),
        valid_until: values.valid_until || null,
        status: values.status,
        created_by: user.id
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Orçamento criado com sucesso."
      });

      form.reset();
      setIsDialogOpen(false);
      loadBudgets();
    } catch (error) {
      console.error('Erro ao criar orçamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar orçamento.",
        variant: "destructive"
      });
    }
  };

  const createProjectFromBudget = async (budget: ClientBudget) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('projects').insert({
        client_id: clientId,
        title: budget.title,
        description: budget.description || '',
        status: 'orçamento',
        contracted_value: budget.total_amount,
        contracted_hours: 0, // Será definido posteriormente
        created_by: user.id
      });

      if (error) throw error;

      // Atualizar o orçamento para indicar que foi convertido em projeto
      const { error: updateError } = await supabase
        .from('client_budgets')
        .update({ project_id: budget.project_id })
        .eq('id', budget.id);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso!",
        description: "Projeto criado com sucesso a partir do orçamento."
      });

      loadBudgets();
      onProjectCreated?.();
    } catch (error) {
      console.error('Erro ao criar projeto:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar projeto a partir do orçamento.",
        variant: "destructive"
      });
    }
  };

  const handleViewBudget = (budget: ClientBudget) => {
    setSelectedBudget(budget);
    setIsViewModalOpen(true);
  };

  const handleEditBudget = (budget: ClientBudget) => {
    setSelectedBudget(budget);
    editForm.reset({
      title: budget.title,
      description: budget.description || "",
      total_amount: budget.total_amount.toString(),
      valid_until: budget.valid_until || "",
      status: budget.status
    });
    setIsEditModalOpen(true);
  };

  const onEditSubmit = async (values: z.infer<typeof budgetFormSchema>) => {
    if (!user || !selectedBudget) return;

    try {
      const { error } = await supabase
        .from('client_budgets')
        .update({
          title: values.title,
          description: values.description,
          total_amount: parseFloat(values.total_amount),
          valid_until: values.valid_until || null,
          status: values.status
        })
        .eq('id', selectedBudget.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Orçamento atualizado com sucesso."
      });

      setIsEditModalOpen(false);
      setSelectedBudget(null);
      loadBudgets();
    } catch (error) {
      console.error('Erro ao atualizar orçamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar orçamento.",
        variant: "destructive"
      });
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return <div>Carregando orçamentos...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Orçamentos
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {budgets.length} {budgets.length === 1 ? 'orçamento registrado' : 'orçamentos registrados'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Orçamento</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do Orçamento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Projeto Casa - Orçamento Inicial" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes do orçamento..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="total_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valid_until"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Válido Até (Opcional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Rascunho</SelectItem>
                            <SelectItem value="sent">Enviado</SelectItem>
                            <SelectItem value="approved">Aprovado</SelectItem>
                            <SelectItem value="rejected">Rejeitado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Criar Orçamento
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {budgets.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum orçamento registrado ainda.</p>
            <p className="text-sm">Crie um orçamento para começar.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Válido Até</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((budget) => (
                <TableRow key={budget.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{budget.title}</div>
                      {budget.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {budget.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        v{budget.version}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatMoney(budget.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[budget.status]}>
                      {statusLabels[budget.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {budget.valid_until ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {formatDate(budget.valid_until)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(budget.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewBudget(budget)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditBudget(budget)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {budget.status === 'approved' && !budget.project_id && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => createProjectFromBudget(budget)}
                          className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                        >
                          <Building className="h-4 w-4 mr-1" />
                          Criar Projeto
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* View Budget Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent 
          className="max-w-2xl border-2"
          style={{
            borderImage: gradientOptions.find(g => g.name === selectedGradient)?.gradient + " 1",
            borderImageSlice: 1
          }}
        >
          <DialogHeader>
            <DialogTitle>Visualizar Orçamento</DialogTitle>
          </DialogHeader>
          {selectedBudget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Título</label>
                  <p className="font-medium">{selectedBudget.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge className={statusColors[selectedBudget.status]}>
                      {statusLabels[selectedBudget.status]}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                <p className="mt-1">{selectedBudget.description || "Sem descrição"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Valor Total</label>
                  <p className="text-lg font-semibold text-green-600">
                    {formatMoney(selectedBudget.total_amount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Versão</label>
                  <p className="font-medium">v{selectedBudget.version}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Válido Até</label>
                  <p className="font-medium">
                    {selectedBudget.valid_until ? formatDate(selectedBudget.valid_until) : "Sem prazo definido"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Criado em</label>
                  <p className="font-medium">{formatDate(selectedBudget.created_at)}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setIsViewModalOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Budget Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Orçamento</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título do Orçamento</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Projeto Casa - Orçamento Inicial" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalhes do orçamento..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="total_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Total (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Válido Até (Opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="sent">Enviado</SelectItem>
                          <SelectItem value="approved">Aprovado</SelectItem>
                          <SelectItem value="rejected">Rejeitado</SelectItem>
                          <SelectItem value="expired">Expirado</SelectItem>
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
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}