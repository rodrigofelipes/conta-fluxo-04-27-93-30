import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, DollarSign, Calendar, Tag, Trash2, Pencil, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
interface FinancialCategory {
  id: string;
  name: string;
  category_type: 'previsao_custo' | 'variavel' | 'fixo';
}
const CATEGORY_LABELS: Record<FinancialCategory['category_type'], string> = {
  previsao_custo: 'Previsão de Custo',
  variavel: 'Variável',
  fixo: 'Fixo'
};
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
  created_at: string;
}
interface ExpenseManagementProps {
  onDataChange?: () => void;
}

type ExpenseFormState = {
  description: string;
  amount: string;
  expense_date: string;
  category_id: string;
  payment_method: string;
  status: Expense['status'];
  recurrence_type: NonNullable<Expense['recurrence_type']>;
  isInstallment: boolean;
  installmentCount: string;
};

const getInitialExpenseForm = (): ExpenseFormState => ({
  description: "",
  amount: "",
  expense_date: new Date().toISOString().split('T')[0],
  category_id: "",
  payment_method: "",
  status: "pending",
  recurrence_type: "none",
  isInstallment: false,
  installmentCount: "1"
});

export function ExpenseManagement({
  onDataChange
}: ExpenseManagementProps) {
  const {
    user
  } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(getInitialExpenseForm);
  const [openInstallmentGroups, setOpenInstallmentGroups] = useState<Record<string, boolean>>({});

  const resetExpenseDialog = () => {
    setIsEditingExpense(false);
    setEditingExpenseId(null);
    setExpenseForm(getInitialExpenseForm());
  };

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    category_type: "fixo" as const
  });
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      setLoading(true);
      const [expensesRes, categoriesRes] = await Promise.all([supabase.from('expenses').select(`
            *,
            category:financial_categories(id, name, category_type)
          `).order('expense_date', {
        ascending: false
      }), supabase.from('financial_categories').select('*').order('category_type', {
        ascending: true
      })]);
      if (expensesRes.error) throw expensesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      setExpenses(expensesRes.data as Expense[] || []);
      setCategories(categoriesRes.data as FinancialCategory[] || []);
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

  const handleExpenseDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      resetExpenseDialog();
    }
  };

  const startCreateExpense = () => {
    resetExpenseDialog();
    setCreateDialogOpen(true);
  };

  const startEditExpense = (expense: Expense) => {
    setIsEditingExpense(true);
    setEditingExpenseId(expense.id);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date.split('T')[0],
      category_id: expense.category_id || "",
      payment_method: expense.payment_method || "",
      status: expense.status,
      recurrence_type: expense.recurrence_type ?? "none",
      isInstallment: false,
      installmentCount: "1"
    });
    setCreateDialogOpen(true);
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
      const {
        error
      } = await supabase.from('financial_categories').insert({
        name: categoryForm.name,
        category_type: categoryForm.category_type,
        created_by: user?.id
      });
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso!"
      });
      setCategoryForm({
        name: "",
        category_type: "fixo"
      });
      setCreateCategoryOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a categoria.",
        variant: "destructive"
      });
    }
  };

  const saveExpense = async () => {
    if (savingExpense) return;
    const parseAmount = (value: string) => {
      if (!value) return NaN;
      const normalized = value.replace(/\./g, '').replace(',', '.');
      return Number(normalized);
    };

    const amountValue = parseAmount(expenseForm.amount);
    if (!expenseForm.description.trim() || Number.isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "Erro",
        description: "Informe uma descrição e um valor válido.",
        variant: "destructive"
      });
      return;
    }
    if (!user?.id) {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para cadastrar despesas.",
        variant: "destructive"
      });
      return;
    }
    const baseDate = new Date(expenseForm.expense_date);
    if (Number.isNaN(baseDate.getTime())) {
      toast({
        title: "Erro",
        description: "Informe uma data válida.",
        variant: "destructive"
      });
      return;
    }

    const installmentCount = !isEditingExpense && expenseForm.isInstallment ? parseInt(expenseForm.installmentCount, 10) : 1;
    if (!isEditingExpense && expenseForm.isInstallment && (!installmentCount || installmentCount < 1)) {
      toast({
        title: "Erro",
        description: "Informe um número válido de parcelas.",
        variant: "destructive"
      });
      return;
    }
    const recurrenceTypeForInsert = !isEditingExpense && expenseForm.isInstallment && installmentCount > 1
      ? 'monthly'
      : 'none';
    try {
      setSavingExpense(true);
      if (isEditingExpense && editingExpenseId) {
        const { error } = await supabase.from('expenses').update({
          description: expenseForm.description.trim(),
          amount: amountValue,
          expense_date: expenseForm.expense_date,
          category_id: expenseForm.category_id || null,
          payment_method: expenseForm.payment_method || null,
          status: expenseForm.status,
          recurrence_type: expenseForm.recurrence_type
        }).eq('id', editingExpenseId);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Despesa atualizada com sucesso!"
        });
      } else {
        const entries: Database['public']['Tables']['expenses']['Insert'][] = [];
        if (expenseForm.isInstallment && installmentCount > 1) {
          const totalInCents = Math.round(amountValue * 100);
          const baseAmountInCents = Math.floor(totalInCents / installmentCount);
          const remainder = totalInCents % installmentCount;
          for (let i = 0; i < installmentCount; i++) {
            const amountInCents = baseAmountInCents + (i < remainder ? 1 : 0);
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            entries.push({
              description: expenseForm.description.trim(),
              amount: amountInCents / 100,
              expense_date: dueDate.toISOString().split('T')[0],
              category_id: expenseForm.category_id || undefined,
              payment_method: expenseForm.payment_method || undefined,
              status: expenseForm.status,
              recurrence_type: recurrenceTypeForInsert,
              created_by: user.id
            });
          }

        } else {
          entries.push({
            description: expenseForm.description.trim(),
            amount: amountValue,
            expense_date: expenseForm.expense_date,
            category_id: expenseForm.category_id || undefined,
            payment_method: expenseForm.payment_method || undefined,
            status: expenseForm.status,
            recurrence_type: recurrenceTypeForInsert,
            created_by: user.id
          });
        }
        const { error } = await supabase.from('expenses').insert(entries);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: expenseForm.isInstallment && installmentCount > 1 ? `${installmentCount} parcelas criadas com sucesso!` : "Despesa criada com sucesso!"
        });
      }

      handleExpenseDialogOpenChange(false);
      await fetchData();
      onDataChange?.();
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a despesa.",
        variant: "destructive"
      });
    } finally {
      setSavingExpense(false);
    }
  };
  const deleteExpense = async (id: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('expenses').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({
          title: "Erro",
          description: "Despesa não encontrada ou você não tem permissão para excluir.",
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "Sucesso",
        description: "Despesa excluída com sucesso!"
      });
      await fetchData();
      onDataChange?.();
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
      const {
        error
      } = await supabase.from('expenses').update({
        status
      }).eq('id', id);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso!"
      });
      await fetchData();
      onDataChange?.();
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
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  const getCategoryTypeBadgeVariant = (type: FinancialCategory['category_type']) => {
    switch (type) {
      case 'fixo':
        return 'default';
      case 'variavel':
        return 'secondary';
      case 'previsao_custo':
        return 'outline';
      default:
        return 'outline';
    }
  };
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--';
    return parsed.toLocaleDateString('pt-BR');
  };

  type StatusBadgeVariant = ReturnType<typeof getStatusBadgeVariant>;

  const getGroupStatusInfo = (installments: Expense[]): { label: string; variant: StatusBadgeVariant } => {
    const hasPending = installments.some(item => item.status === 'pending');
    const hasPaid = installments.some(item => item.status === 'paid');
    const hasCancelled = installments.some(item => item.status === 'cancelled');

    if (hasPending && !hasPaid && !hasCancelled) {
      return { label: 'Pendente', variant: getStatusBadgeVariant('pending') };
    }

    if (!hasPending && hasPaid && !hasCancelled) {
      return { label: 'Pago', variant: getStatusBadgeVariant('paid') };
    }

    if (!hasPending && !hasPaid && hasCancelled) {
      return { label: 'Cancelado', variant: getStatusBadgeVariant('cancelled') };
    }

    if (hasPending && hasPaid) {
      return { label: 'Em andamento', variant: 'outline' };
    }

    if (hasCancelled && hasPaid) {
      return { label: 'Pago/Cancelado', variant: 'outline' };
    }

    return { label: 'Parcelado', variant: 'outline' };
  };

  type ExpenseListItem =
    | { type: 'single'; expense: Expense }
    | {
        type: 'installment';
        key: string;
        description: string;
        expenses: Expense[];
        totalAmount: number;
        firstDueDate: string;
        lastDueDate: string;
        category?: FinancialCategory;
        payment_method?: string;
        statusInfo: { label: string; variant: StatusBadgeVariant };
        pendingCount: number;
        paidCount: number;
        cancelledCount: number;
      };

  const expenseItems = useMemo<ExpenseListItem[]>(() => {
    const groups = new Map<string, Expense[]>();

    expenses.forEach(expense => {
      if (expense.recurrence_type === 'monthly') {
        const key = `${expense.description}|${expense.created_at}`;
        const existing = groups.get(key) ?? [];
        existing.push(expense);
        groups.set(key, existing);
      }
    });

    const items: ExpenseListItem[] = [];
    const seenGroups = new Set<string>();

    expenses.forEach(expense => {
      if (expense.recurrence_type === 'monthly') {
        const key = `${expense.description}|${expense.created_at}`;
        if (seenGroups.has(key)) {
          return;
        }
        seenGroups.add(key);

        const installments = groups.get(key) ?? [expense];
        const sortedInstallments = [...installments].sort(
          (a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
        );
        const totalAmount = sortedInstallments.reduce((sum, item) => sum + item.amount, 0);

        items.push({
          type: 'installment',
          key,
          description: expense.description,
          expenses: sortedInstallments,
          totalAmount,
          firstDueDate: sortedInstallments[0]?.expense_date ?? expense.expense_date,
          lastDueDate:
            sortedInstallments[sortedInstallments.length - 1]?.expense_date ?? expense.expense_date,
          category: expense.category,
          payment_method: expense.payment_method,
          statusInfo: getGroupStatusInfo(sortedInstallments),
          pendingCount: sortedInstallments.filter(item => item.status === 'pending').length,
          paidCount: sortedInstallments.filter(item => item.status === 'paid').length,
          cancelledCount: sortedInstallments.filter(item => item.status === 'cancelled').length,
        });
      } else {
        items.push({ type: 'single', expense });
      }
    });

    return items;
  }, [expenses]);

  useEffect(() => {
    setOpenInstallmentGroups(prev => {
      const validKeys = new Set(
        expenseItems.filter(item => item.type === 'installment').map(item => item.key)
      );

      const next: Record<string, boolean> = {};
      validKeys.forEach(key => {
        if (prev[key]) {
          next[key] = true;
        }
      });

      return next;
    });
  }, [expenseItems]);
  const totalPending = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
  const installmentCountNumber = parseInt(expenseForm.installmentCount, 10);

  const normalizedAmountPreview = expenseForm.amount ? Number(expenseForm.amount.replace(/\./g, '').replace(',', '.')) : NaN;
  const showInstallmentPreview = expenseForm.isInstallment && installmentCountNumber > 1 && !Number.isNaN(normalizedAmountPreview) && normalizedAmountPreview > 0;
  const perInstallment = showInstallmentPreview ? normalizedAmountPreview / installmentCountNumber : 0;

  const firstInstallmentDate = (() => {
    const date = new Date(expenseForm.expense_date);
    return Number.isNaN(date.getTime()) ? null : date;
  })();
  const lastInstallmentDate = (() => {
    if (!firstInstallmentDate || !showInstallmentPreview) return null;
    const last = new Date(firstInstallmentDate);
    last.setMonth(last.getMonth() + installmentCountNumber - 1);
    return last;
  })();
  if (loading) {
    return <div className="space-y-6">
        <div className="h-8 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded"></div>)}
        </div>
      </div>;
  }
  return <div className="space-y-6">
      {/* Header com resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pendente</p>
                <p className="text-2xl font-bold text-yellow-600">
                  R$ {totalPending.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2
                })}
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
                  R$ {totalPaid.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2
                })}
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
        <Dialog open={createDialogOpen} onOpenChange={handleExpenseDialogOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={startCreateExpense}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditingExpense ? 'Editar Despesa' : 'Criar Nova Despesa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" value={expenseForm.description} onChange={e => setExpenseForm(prev => ({
                ...prev,
                description: e.target.value
              }))} placeholder="Descrição da despesa" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Valor</Label>
                  <Input id="amount" type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(prev => ({
                  ...prev,
                  amount: e.target.value
                }))} placeholder="0,00" />
                </div>
                <div>
                  <Label htmlFor="expense_date">Data / Primeiro vencimento</Label>
                  <Input id="expense_date" type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(prev => ({
                  ...prev,
                  expense_date: e.target.value
                }))} />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Pagamento parcelado</p>
                  <p className="text-xs text-muted-foreground">
                    Habilite para dividir o valor em parcelas mensais automáticas.
                  </p>
                </div>
                <Switch
                  disabled={isEditingExpense}
                  checked={expenseForm.isInstallment}
                  onCheckedChange={checked => setExpenseForm(prev => ({
                    ...prev,
                    isInstallment: checked,
                    recurrence_type: checked ? 'monthly' : 'none',
                    installmentCount: checked
                      ? prev.installmentCount === "1"
                        ? "2"
                        : prev.installmentCount
                      : "1"
                  }))}
                />
              </div>
              {expenseForm.isInstallment && <div>
                  <Label htmlFor="installment_count">Número de Parcelas</Label>
                  <Input id="installment_count" type="number" min={1} disabled={isEditingExpense} value={expenseForm.installmentCount} onChange={e => setExpenseForm(prev => ({
                ...prev,
                installmentCount: e.target.value
              }))} placeholder="2" />
                </div>}
              {showInstallmentPreview && firstInstallmentDate && lastInstallmentDate && <div className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3">

                  <p>
                    Serão criadas <span className="font-medium text-foreground">{installmentCountNumber} parcelas</span> de
                    <span className="font-medium text-foreground"> R$ {perInstallment.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}</span>.
                  </p>
                  <p>
                    Vencimentos de {firstInstallmentDate.toLocaleDateString('pt-BR')} até {lastInstallmentDate.toLocaleDateString('pt-BR')}.
                  </p>
                </div>}
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select value={expenseForm.category_id} onValueChange={value => setExpenseForm(prev => ({
                ...prev,
                category_id: value
              }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => <SelectItem key={category.id} value={category.id}>
                        {category.name} ({CATEGORY_LABELS[category.category_type]})
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment_method">Forma de Pagamento</Label>
                <Select value={expenseForm.payment_method} onValueChange={value => setExpenseForm(prev => ({
                ...prev,
                payment_method: value
              }))}>
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
              <div>
                <Label htmlFor="expense_status">Status</Label>
                <Select value={expenseForm.status} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, status: value as Expense['status'] }))}>
                  <SelectTrigger id="expense_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveExpense} className="flex-1" disabled={savingExpense}>
                  {savingExpense ? "Salvando..." : isEditingExpense ? "Salvar Alterações" : "Criar Despesa"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen}>
          <DialogTrigger asChild>
            
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="category_name">Nome da Categoria</Label>
                <Input id="category_name" value={categoryForm.name} onChange={e => setCategoryForm(prev => ({
                ...prev,
                name: e.target.value
              }))} placeholder="Nome da categoria" />
              </div>
              <div>
                <Label htmlFor="category_type">Tipo</Label>
                <Select value={categoryForm.category_type} onValueChange={(value: any) => setCategoryForm(prev => ({
                ...prev,
                category_type: value
              }))}>
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
            {expenseItems.map(item => {
              if (item.type === 'single') {
                const expense = item.expense;
                return (
                  <div
                    key={`single-${expense.id}`}
                    className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{expense.description}</h4>
                        <Badge variant={getStatusBadgeVariant(expense.status)}>
                          {expense.status === 'pending'
                            ? 'Pendente'
                            : expense.status === 'paid'
                              ? 'Pago'
                              : 'Cancelado'}
                        </Badge>
                        {expense.category && (
                          <Badge variant={getCategoryTypeBadgeVariant(expense.category.category_type)}>
                            {expense.category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatCurrency(expense.amount)}</span>
                        <span>{formatDate(expense.expense_date)}</span>
                        {expense.payment_method && <span>{expense.payment_method}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEditExpense(expense)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {expense.status === 'pending' && (
                        <Button size="sm" onClick={() => updateExpenseStatus(expense.id, 'paid')}>
                          Marcar como Pago
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => deleteExpense(expense.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              }

              const isOpen = Boolean(openInstallmentGroups[item.key]);

              return (
                <Collapsible
                  key={`group-${item.key}`}
                  open={isOpen}
                  onOpenChange={open =>
                    setOpenInstallmentGroups(prev => ({
                      ...prev,
                      [item.key]: open,
                    }))
                  }
                >
                  <div className="rounded-lg border">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium">{item.description}</h4>
                            <Badge variant="outline">Parcelado ({item.expenses.length}x)</Badge>
                            <Badge variant={item.statusInfo.variant}>{item.statusInfo.label}</Badge>
                            {item.category && (
                              <Badge variant={getCategoryTypeBadgeVariant(item.category.category_type)}>
                                {item.category.name}
                              </Badge>
                            )}
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? '-rotate-180' : 'rotate-0'}`}
                          />
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>Total: {formatCurrency(item.totalAmount)}</span>
                          <span>
                            {formatDate(item.firstDueDate)} - {formatDate(item.lastDueDate)}
                          </span>
                          {item.pendingCount > 0 && <span>{item.pendingCount} pendente(s)</span>}
                          {item.paidCount > 0 && <span>{item.paidCount} pago(s)</span>}
                          {item.cancelledCount > 0 && <span>{item.cancelledCount} cancelado(s)</span>}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 border-t p-4">
                      {item.expenses.map((installment, index) => (
                        <div
                          key={`${item.key}-${installment.id}`}
                          className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                Parcela {index + 1} de {item.expenses.length}
                              </p>
                              <Badge variant={getStatusBadgeVariant(installment.status)}>
                                {installment.status === 'pending'
                                  ? 'Pendente'
                                  : installment.status === 'paid'
                                    ? 'Pago'
                                    : 'Cancelado'}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span>Valor: {formatCurrency(installment.amount)}</span>
                              <span>Vencimento: {formatDate(installment.expense_date)}</span>
                              {installment.payment_method && <span>{installment.payment_method}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => startEditExpense(installment)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {installment.status === 'pending' && (
                              <Button size="sm" onClick={() => updateExpenseStatus(installment.id, 'paid')}>
                                Marcar como Pago
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => deleteExpense(installment.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
            {expenseItems.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">Nenhuma despesa encontrada</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>;
}
