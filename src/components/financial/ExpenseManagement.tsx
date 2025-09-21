import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Calendar, Tag, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";

interface FinancialCategory {
  id: string;
  name: string;
  category_type: 'previsao_custo' | 'variavel' | 'fixo';
  parent_id?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category_id?: string;
  payment_method?: string;
  status: 'pending' | 'paid' | 'cancelled';
  recurrence_type?: 'none' | 'monthly' | 'yearly';
  category?: FinancialCategory;
}

export function ExpenseManagement() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split('T')[0],
    category_id: "",
    payment_method: "",
    status: "pending" as const,
    recurrence_type: "none" as const
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    category_type: "fixo" as const,
    parent_id: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [expensesRes, categoriesRes] = await Promise.all([
        supabase
          .from('expenses')
          .select(`
            *,
            category:financial_categories(id, name, category_type)
          `)
          .order('expense_date', { ascending: false }),
        supabase
          .from('financial_categories')
          .select('*')
          .order('category_type', { ascending: true })
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setExpenses((expensesRes.data as Expense[]) || []);
      setCategories((categoriesRes.data as FinancialCategory[]) || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados financeiros.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('financial_categories')
        .insert({
          name: categoryForm.name,
          category_type: categoryForm.category_type,
          parent_id: categoryForm.parent_id || null,
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso!"
      });

      setCategoryForm({ name: "", category_type: "fixo", parent_id: "" });
      setCreateCategoryOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a categoria.",
        variant: "destructive"
      });
    }
  };

  const createExpense = async () => {
    if (!expenseForm.description.trim() || !expenseForm.amount) {
      toast({
        title: "Erro",
        description: "Descrição e valor são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .insert({
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          expense_date: expenseForm.expense_date,
          category_id: expenseForm.category_id || null,
          payment_method: expenseForm.payment_method || null,
          status: expenseForm.status,
          recurrence_type: expenseForm.recurrence_type,
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa criada com sucesso!"
      });

      setExpenseForm({
        description: "",
        amount: "",
        expense_date: new Date().toISOString().split('T')[0],
        category_id: "",
        payment_method: "",
        status: "pending",
        recurrence_type: "none"
      });
      setCreateDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao criar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a despesa.",
        variant: "destructive"
      });
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa excluída com sucesso!"
      });

      fetchData();
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a despesa.",
        variant: "destructive"
      });
    }
  };

  const updateExpenseStatus = async (id: string, status: Expense['status']) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso!"
      });

      fetchData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadgeVariant = (status: Expense['status']) => {
    switch (status) {
      case 'paid': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getCategoryTypeBadgeVariant = (type: FinancialCategory['category_type']) => {
    switch (type) {
      case 'fixo': return 'default';
      case 'variavel': return 'secondary';
      case 'previsao_custo': return 'outline';
      default: return 'outline';
    }
  };

  const totalPending = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pendente</p>
                <p className="text-2xl font-bold text-yellow-600">
                  R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pago</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categorias</p>
                <p className="text-2xl font-bold text-primary">{categories.length}</p>
              </div>
              <Tag className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Despesa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição da despesa"
                />
              </div>
              <div>
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="expense_date">Data</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, expense_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select value={expenseForm.category_id} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} ({category.category_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment_method">Forma de Pagamento</Label>
                <Select value={expenseForm.payment_method} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, payment_method: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={createExpense} className="flex-1">
                  Criar Despesa
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Tag className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="category_name">Nome da Categoria</Label>
                <Input
                  id="category_name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome da categoria"
                />
              </div>
              <div>
                <Label htmlFor="category_type">Tipo</Label>
                <Select value={categoryForm.category_type} onValueChange={(value: any) => setCategoryForm(prev => ({ ...prev, category_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                    <SelectItem value="previsao_custo">Previsão de Custo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createCategory} className="w-full">
                Criar Categoria
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de despesas */}
      <Card>
        <CardHeader>
          <CardTitle>Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{expense.description}</h4>
                    <Badge variant={getStatusBadgeVariant(expense.status)}>
                      {expense.status === 'pending' ? 'Pendente' : 
                       expense.status === 'paid' ? 'Pago' : 'Cancelado'}
                    </Badge>
                    {expense.category && (
                      <Badge variant={getCategoryTypeBadgeVariant(expense.category.category_type)}>
                        {expense.category.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span>{new Date(expense.expense_date).toLocaleDateString('pt-BR')}</span>
                    {expense.payment_method && <span>{expense.payment_method}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {expense.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => updateExpenseStatus(expense.id, 'paid')}
                    >
                      Marcar como Pago
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteExpense(expense.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma despesa encontrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}