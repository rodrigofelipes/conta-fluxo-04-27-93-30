import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Calendar, User2, Trash2, Pencil, Tag, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/state/auth";
import { Switch } from "@/components/ui/switch";

interface ClientOption {
  id: string;
  name: string;
}

interface FinancialCategory {
  id: string;
  name: string;
  category_type: 'previsao_custo' | 'variavel' | 'fixo';
}

const CATEGORY_LABELS: Record<FinancialCategory['category_type'], string> = {
  previsao_custo: 'Previsão de Custo',
  variavel: 'Variável',
  fixo: 'Fixo',
};

type IncomeStatus = "pending" | "paid" | "overdue" | "cancelled";

interface IncomeFormState {
  description: string;
  amount: string;
  transaction_date: string;
  client_id?: string;
  status: IncomeStatus;
  category_id: string;
  isInstallment: boolean;
  installmentCount: string;
  recurrence_type: "none" | "monthly" | "quarterly" | "yearly";
}

interface IncomeRecord {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  status: IncomeStatus;
  client_id?: string | null;
  client_name?: string | null;
  category_id?: string | null;
  category?: FinancialCategory;
  recurrence_type?: string | null;
  created_at: string;
}

interface IncomeManagementProps {
  onDataChange?: () => void;
}

const STATUS_LABELS: Record<IncomeStatus, string> = {
  pending: "Pendente",
  paid: "Recebida",
  overdue: "Em Atraso",
  cancelled: "Cancelada",
};

const STATUS_VARIANTS: Record<IncomeStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
};

const normalizeStatus = (status?: string | null): IncomeStatus => {
  if (!status) return "pending";
  if (status === "completed") return "paid";
  if (status === "cancelled") return "cancelled";
  if (status === "paid" || status === "pending" || status === "overdue") {
    return status;
  }
  return "pending";
};

export function IncomeManagement({ onDataChange }: IncomeManagementProps) {
  const { user } = useAuth();
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [openInstallmentGroups, setOpenInstallmentGroups] = useState<Record<string, boolean>>({});

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    category_type: "fixo" as const
  });

  const createDefaultIncomeForm = (): IncomeFormState => ({
    description: "",
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    client_id: undefined,
    status: "pending" as IncomeStatus,
    category_id: "",
    isInstallment: false,
    installmentCount: "1",
    recurrence_type: "none",
  });

  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(createDefaultIncomeForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [incomesRes, clientsRes, categoriesRes] = await Promise.all([
        supabase
          .from("client_financials")
          .select(
            `id, description, amount, transaction_date, status, client_id, transaction_category, created_at, recurrence_type`,
          )
          .eq("transaction_type", "income")
          .order("transaction_date", { ascending: false }),
        supabase
          .from("clients")
          .select("id, name")
          .order("name"),
        supabase
          .from('financial_categories')
          .select('*')
          .order('category_type', { ascending: true })
      ]);

      if (incomesRes.error) throw incomesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const clientOptions: ClientOption[] = (clientsRes.data ?? []).map((client: any) => ({
        id: String(client.id),
        name: String(client.name),
      }));
      const clientMap = new Map(clientOptions.map(client => [client.id, client.name]));

      const categoriesData = (categoriesRes.data as FinancialCategory[] | null) ?? [];
      const categoriesMap = new Map(
        categoriesData.map((category) => [String(category.id), category]),
      );

      const normalizedIncomes: IncomeRecord[] = (incomesRes.data || []).map((income: any) => {
        const clientId = income.client_id ? String(income.client_id) : null;
        const categoryId = income.transaction_category ? String(income.transaction_category) : null;
        const incomeCategory = categoryId ? categoriesMap.get(categoryId) : undefined;
        return {
          id: String(income.id),
          description: String(income.description),
          amount: Number(income.amount) || 0,
          transaction_date: String(income.transaction_date),
          status: normalizeStatus(income.status),
          client_id: clientId,
          client_name: clientId ? clientMap.get(clientId) ?? null : null,
          category_id: categoryId,
          category: incomeCategory
            ? {
                id: incomeCategory.id,
                name: incomeCategory.name,
                category_type: incomeCategory.category_type,
              }
            : undefined,
          recurrence_type: income.recurrence_type ? String(income.recurrence_type) : null,
          created_at: String(income.created_at),
        };
      });

      setIncomes(normalizedIncomes);
      setClients(clientOptions);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Erro ao carregar receitas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as receitas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parseAmount = (value: string) => {
    if (!value) return NaN;
    const normalized = value.replace(/\./g, "").replace(",", ".");
    return Number(normalized);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingIncomeId(null);
      setIncomeForm(createDefaultIncomeForm());
    }
  };

  const startCreateIncome = () => {
    setEditingIncomeId(null);
    const defaultForm = createDefaultIncomeForm();
    setIncomeForm(defaultForm);
    setDialogOpen(true);
  };

  const startEditIncome = (income: IncomeRecord) => {
    setEditingIncomeId(income.id);
    const validCategoryId = income.category_id && categories.some(category => category.id === income.category_id)
      ? income.category_id
      : "";
    setIncomeForm({
      description: income.description,
      amount: income.amount.toString(),
      transaction_date: income.transaction_date.split("T")[0],
      client_id: income.client_id ?? undefined,
      status: income.status,
      category_id: validCategoryId,
      isInstallment: false,
      installmentCount: "1",
      recurrence_type: (income.recurrence_type as IncomeFormState["recurrence_type"]) || "none",
    });
    setDialogOpen(true);
  };

  const saveIncome = async () => {
    if (savingIncome) return;

    const amountValue = parseAmount(incomeForm.amount);
    if (!incomeForm.description.trim() || Number.isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "Erro",
        description: "Informe uma descrição e um valor válido.",
        variant: "destructive",
      });
      return;
    }

    if (!incomeForm.category_id) {
      toast({
        title: "Erro",
        description: "Selecione uma categoria para a receita.",
        variant: "destructive",
      });
      return;
    }

    if (!incomeForm.client_id) {
      toast({
        title: "Erro",
        description: "Selecione um cliente para a receita.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para cadastrar receitas.",
        variant: "destructive",
      });
      return;
    }

    const incomeDate = new Date(incomeForm.transaction_date);
    if (Number.isNaN(incomeDate.getTime())) {
      toast({
        title: "Erro",
        description: "Informe uma data válida.",
        variant: "destructive",
      });
      return;
    }

    const installmentCount = !editingIncomeId && incomeForm.isInstallment ? parseInt(incomeForm.installmentCount, 10) : 1;

    if (!editingIncomeId && incomeForm.isInstallment && (!installmentCount || installmentCount < 1)) {
      toast({
        title: "Erro",
        description: "Informe um número válido de parcelas.",
        variant: "destructive",
      });
      return;
    }

    const recurrenceTypeForInsert = !editingIncomeId && incomeForm.isInstallment && installmentCount > 1 ? "monthly" : "none";

    try {
      setSavingIncome(true);
      if (editingIncomeId) {
        const { error } = await supabase
          .from("client_financials")
          .update({
            description: incomeForm.description.trim(),
            amount: amountValue,
            transaction_date: incomeForm.transaction_date,
            status: incomeForm.status,
            client_id: incomeForm.client_id,
            transaction_category: incomeForm.category_id,
            recurrence_type: incomeForm.recurrence_type,
          })
          .eq("id", editingIncomeId);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Receita atualizada com sucesso!",
        });
      } else {
        const entries: {
          transaction_type: "income";
          description: string;
          amount: number;
          transaction_date: string;
          status: IncomeStatus;
          client_id: string;
          transaction_category: string;
          created_by: string;
          recurrence_type: IncomeFormState["recurrence_type"];
        }[] = [];

        if (incomeForm.isInstallment && installmentCount > 1 && incomeForm.client_id) {
          const totalInCents = Math.round(amountValue * 100);
          const baseAmountInCents = Math.floor(totalInCents / installmentCount);
          const remainder = totalInCents % installmentCount;

          for (let i = 0; i < installmentCount; i += 1) {
            const amountInCents = baseAmountInCents + (i < remainder ? 1 : 0);
            const dueDate = new Date(incomeDate);
            dueDate.setMonth(dueDate.getMonth() + i);

            entries.push({
              transaction_type: "income",
              description: incomeForm.description.trim(),
              amount: amountInCents / 100,
              transaction_date: dueDate.toISOString().split("T")[0],
              status: incomeForm.status,
              client_id: incomeForm.client_id,
              transaction_category: incomeForm.category_id,
              created_by: user.id,
              recurrence_type: recurrenceTypeForInsert,
            });
          }
        } else if (incomeForm.client_id) {
          entries.push({
            transaction_type: "income",
            description: incomeForm.description.trim(),
            amount: amountValue,
            transaction_date: incomeForm.transaction_date,
            status: incomeForm.status,
            client_id: incomeForm.client_id,
            transaction_category: incomeForm.category_id,
            created_by: user.id,
            recurrence_type: recurrenceTypeForInsert,
          });
        }

        const { error } = await supabase.from("client_financials").insert(entries);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description:
            incomeForm.isInstallment && installmentCount > 1
              ? `${installmentCount} parcelas criadas com sucesso!`
              : "Receita criada com sucesso!",
        });
      }

      setIncomeForm(createDefaultIncomeForm());
      setEditingIncomeId(null);
      setDialogOpen(false);
      await fetchData();
      onDataChange?.();
    } catch (error) {
      console.error("Erro ao salvar receita:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a receita.",
        variant: "destructive",
      });
    } finally {
      setSavingIncome(false);
    }
  };

  const deleteIncome = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("client_financials")
        .delete()
        .eq("id", id)
        .eq("transaction_type", "income")
        .select("id");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Erro",
          description: "Receita não encontrada ou você não tem permissão para excluir.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Receita excluída com sucesso!",
      });

      await fetchData();
      onDataChange?.();
    } catch (error) {
      console.error("Erro ao excluir receita:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a receita.",
        variant: "destructive",
      });
    }
  };

  const updateIncomeStatus = async (id: string, status: IncomeStatus) => {
    try {
      const { error } = await supabase
        .from("client_financials")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso!",
      });

      await fetchData();
      onDataChange?.();
    } catch (error) {
      console.error("Erro ao atualizar status da receita:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
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
      const { error } = await supabase.from('financial_categories').insert({
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

  const categoriesById = useMemo(
    () => new Map(categories.map(category => [category.id, category.name])),
    [categories],
  );

  const getIncomeCategoryLabel = useMemo(
    () =>
      (categoryId: string | null | undefined): string | null => {
        if (!categoryId) return null;
        const categoryName = categoriesById.get(categoryId);
        if (categoryName) {
          return categoryName;
        }
        return "Categoria removida";
      },
    [categoriesById]
  );

  const getCategoryTypeBadgeVariant = (type: FinancialCategory['category_type']) => {

    switch (type) {
      case 'previsao_custo':
        return 'default';
      case 'variavel':
        return 'secondary';
      case 'fixo':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const totalPending = useMemo(
    () => incomes.filter(income => income.status === "pending").reduce((sum, income) => sum + income.amount, 0),
    [incomes],
  );

  const totalReceived = useMemo(
    () => incomes.filter(income => income.status === "paid").reduce((sum, income) => sum + income.amount, 0),
    [incomes],
  );

  type StatusBadgeVariant = "default" | "secondary" | "destructive" | "outline";

  const getGroupStatusInfo = (installments: IncomeRecord[]): { label: string; variant: StatusBadgeVariant } => {
    const hasPending = installments.some(item => item.status === 'pending');
    const hasPaid = installments.some(item => item.status === 'paid');
    const hasOverdue = installments.some(item => item.status === 'overdue');
    const hasCancelled = installments.some(item => item.status === 'cancelled');

    if (hasPending && !hasPaid && !hasOverdue && !hasCancelled) {
      return { label: 'Pendente', variant: STATUS_VARIANTS['pending'] };
    }

    if (!hasPending && hasPaid && !hasOverdue && !hasCancelled) {
      return { label: 'Recebida', variant: STATUS_VARIANTS['paid'] };
    }

    if (!hasPending && !hasPaid && hasCancelled) {
      return { label: 'Cancelada', variant: STATUS_VARIANTS['cancelled'] };
    }

    if (hasPending && hasPaid) {
      return { label: 'Em andamento', variant: 'outline' };
    }

    if (hasOverdue) {
      return { label: 'Em Atraso', variant: STATUS_VARIANTS['overdue'] };
    }

    return { label: 'Parcelado', variant: 'outline' };
  };

  type IncomeListItem =
    | { type: 'single'; income: IncomeRecord }
    | {
        type: 'installment';
        key: string;
        description: string;
        incomes: IncomeRecord[];
        totalAmount: number;
        firstDueDate: string;
        lastDueDate: string;
        category?: FinancialCategory;
        client_name?: string | null;
        statusInfo: { label: string; variant: StatusBadgeVariant };
        pendingCount: number;
        paidCount: number;
        overdueCount: number;
        cancelledCount: number;
      };

  const incomeItems = useMemo<IncomeListItem[]>(() => {
    // Função para normalizar descrição removendo sufixo de parcela
    const normalizeDescription = (desc: string) => {
      return desc.replace(/\s*-\s*Parcela\s+\d+\/\d+\s*$/i, '').trim();
    };

    const groups = new Map<string, IncomeRecord[]>();

    incomes.forEach(income => {
      if (income.recurrence_type === 'monthly') {
        const normalizedDesc = normalizeDescription(income.description);
        const key = `${normalizedDesc}|${income.created_at}`;
        const existing = groups.get(key) ?? [];
        existing.push(income);
        groups.set(key, existing);
      }
    });

    const items: IncomeListItem[] = [];
    const seenGroups = new Set<string>();

    incomes.forEach(income => {
      if (income.recurrence_type === 'monthly') {
        const normalizedDesc = normalizeDescription(income.description);
        const key = `${normalizedDesc}|${income.created_at}`;
        if (seenGroups.has(key)) {
          return;
        }
        seenGroups.add(key);

        const installments = groups.get(key) ?? [income];
        const sortedInstallments = [...installments].sort(
          (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        );
        const totalAmount = sortedInstallments.reduce((sum, item) => sum + item.amount, 0);

        items.push({
          type: 'installment',
          key,
          description: normalizedDesc,
          incomes: sortedInstallments,
          totalAmount,
          firstDueDate: sortedInstallments[0]?.transaction_date ?? income.transaction_date,
          lastDueDate:
            sortedInstallments[sortedInstallments.length - 1]?.transaction_date ?? income.transaction_date,
          category: income.category,
          client_name: income.client_name,
          statusInfo: getGroupStatusInfo(sortedInstallments),
          pendingCount: sortedInstallments.filter(item => item.status === 'pending').length,
          paidCount: sortedInstallments.filter(item => item.status === 'paid').length,
          overdueCount: sortedInstallments.filter(item => item.status === 'overdue').length,
          cancelledCount: sortedInstallments.filter(item => item.status === 'cancelled').length,
        });
      } else {
        items.push({ type: 'single', income });
      }
    });

    return items;
  }, [incomes]);

  useEffect(() => {
    setOpenInstallmentGroups(prev => {
      const validKeys = new Set(
        incomeItems.filter(item => item.type === 'installment').map(item => item.key)
      );

      const next: Record<string, boolean> = {};
      validKeys.forEach(key => {
        if (prev[key]) {
          next[key] = true;
        }
      });

      return next;
    });
  }, [incomeItems]);

  const normalizedAmountPreview = parseAmount(incomeForm.amount);
  const installmentCountNumber = parseInt(incomeForm.installmentCount, 10);
  const showInstallmentPreview =
    incomeForm.isInstallment &&
    installmentCountNumber > 1 &&
    !Number.isNaN(normalizedAmountPreview) &&
    normalizedAmountPreview > 0;
  const perInstallment = showInstallmentPreview ? normalizedAmountPreview / installmentCountNumber : 0;

  const basePreviewDate = new Date(incomeForm.transaction_date);
  const hasValidPreviewDate = !Number.isNaN(basePreviewDate.getTime());
  const firstInstallmentDate = showInstallmentPreview && hasValidPreviewDate ? basePreviewDate : null;
  const lastInstallmentDate = showInstallmentPreview && hasValidPreviewDate ? new Date(basePreviewDate) : null;
  if (lastInstallmentDate) {
    lastInstallmentDate.setMonth(lastInstallmentDate.getMonth() + installmentCountNumber - 1);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-32 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receitas Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                <p className="text-sm font-medium text-muted-foreground">Receitas Recebidas</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {totalReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                <p className="text-sm font-medium text-muted-foreground">Clientes Relacionados</p>
                <p className="text-2xl font-bold text-primary">{clients.length}</p>
              </div>
              <User2 className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={startCreateIncome}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Receita
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIncomeId ? "Editar Receita" : "Criar Nova Receita"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="income_description">Descrição</Label>
                <Input
                  id="income_description"
                  value={incomeForm.description}
                  onChange={(event) => setIncomeForm(prev => ({ ...prev, description: event.target.value }))}
                  placeholder="Descrição da receita"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="income_amount">Valor</Label>
                  <Input
                    id="income_amount"
                    type="number"
                    step="0.01"
                    value={incomeForm.amount}
                    onChange={(event) => setIncomeForm(prev => ({ ...prev, amount: event.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="income_date">Data de recebimento</Label>
                  <Input
                    id="income_date"
                    type="date"
                    value={incomeForm.transaction_date}
                    onChange={(event) => setIncomeForm(prev => ({ ...prev, transaction_date: event.target.value }))}
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Recebimento parcelado</p>
                  <p className="text-xs text-muted-foreground">
                    Habilite para dividir o valor em parcelas mensais automáticas.
                  </p>
                </div>
                <Switch
                  disabled={Boolean(editingIncomeId)}
                  checked={incomeForm.isInstallment}
                  onCheckedChange={checked =>
                    setIncomeForm(prev => ({
                      ...prev,
                      isInstallment: checked,
                      recurrence_type: checked ? "monthly" : "none",
                      installmentCount: checked
                        ? prev.installmentCount === "1"
                          ? "2"
                          : prev.installmentCount
                        : "1",
                    }))
                  }
                />
              </div>
              {incomeForm.isInstallment && (
                <div>
                  <Label htmlFor="income_installment_count">Número de Parcelas</Label>
                  <Input
                    id="income_installment_count"
                    type="number"
                    min={1}
                    disabled={Boolean(editingIncomeId)}
                    value={incomeForm.installmentCount}
                    onChange={(event) =>
                      setIncomeForm(prev => ({
                        ...prev,
                        installmentCount: event.target.value,
                      }))
                    }
                    placeholder="2"
                  />
                </div>
              )}
              {showInstallmentPreview && firstInstallmentDate && lastInstallmentDate && (
                <div className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3">
                  <p>
                    Serão criadas <span className="font-medium text-foreground">{installmentCountNumber} parcelas</span> de
                    <span className="font-medium text-foreground">
                      {" "}R$ {perInstallment.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    .
                  </p>
                  <p>
                    Recebimentos de {firstInstallmentDate.toLocaleDateString("pt-BR")} até
                    {" "}
                    {lastInstallmentDate.toLocaleDateString("pt-BR")}.
                  </p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="income_category">Categoria</Label>
                  <Dialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Nova
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
                            onChange={e => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nome da categoria"
                          />
                        </div>
                        <div>
                          <Label htmlFor="category_type">Tipo</Label>
                          <Select
                            value={categoryForm.category_type}
                            onValueChange={(value: any) => setCategoryForm(prev => ({ ...prev, category_type: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="previsao_custo">Previsão de Custo</SelectItem>
                              <SelectItem value="variavel">Variável</SelectItem>
                              <SelectItem value="fixo">Fixo</SelectItem>
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
                <Select
                  value={incomeForm.category_id}
                  onValueChange={(value) => setIncomeForm(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger id="income_category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name} ({CATEGORY_LABELS[category.category_type]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select
                  value={incomeForm.client_id ?? undefined}
                  onValueChange={(value) =>
                    setIncomeForm(prev => ({
                      ...prev,
                      client_id: value,
                    }))
                  }
                  disabled={clients.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        clients.length === 0
                          ? "Nenhum cliente cadastrado"
                          : "Selecione um cliente"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 ? (
                      <SelectItem value="no-client" disabled>
                        Cadastre um cliente primeiro
                      </SelectItem>
                    ) : (
                      clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={incomeForm.status}
                  onValueChange={(value) => setIncomeForm(prev => ({ ...prev, status: value as IncomeStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Recebida</SelectItem>
                    <SelectItem value="overdue">Em atraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveIncome} className="w-full" disabled={savingIncome}>
                {savingIncome ? "Salvando..." : editingIncomeId ? "Salvar Alterações" : "Criar Receita"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receitas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {incomeItems.map(item => {
              if (item.type === 'single') {
                const income = item.income;
                return (
                  <div key={`single-${income.id}`} className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h4 className="font-medium">{income.description}</h4>
                        <Badge variant={STATUS_VARIANTS[income.status] || "outline"}>
                          {STATUS_LABELS[income.status]}
                        </Badge>
                        {income.client_name && (
                          <Badge variant="outline">{income.client_name}</Badge>
                        )}
                        {income.category && (
                          <Badge variant={getCategoryTypeBadgeVariant(income.category.category_type)}>
                            {income.category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span>R$ {income.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <span>{new Date(income.transaction_date).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEditIncome(income)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {income.status !== "paid" && income.status !== "cancelled" && (
                        <Button size="sm" onClick={() => updateIncomeStatus(income.id, "paid")}>
                          Marcar como Recebida
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => deleteIncome(income.id)}>
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
                            <Badge variant="outline">Parcelado ({item.incomes.length}x)</Badge>
                            <Badge variant={item.statusInfo.variant}>{item.statusInfo.label}</Badge>
                            {item.client_name && (
                              <Badge variant="outline">{item.client_name}</Badge>
                            )}
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
                          <span>Total: R$ {item.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          <span>
                            {new Date(item.firstDueDate).toLocaleDateString("pt-BR")} - {new Date(item.lastDueDate).toLocaleDateString("pt-BR")}
                          </span>
                          {item.pendingCount > 0 && <span>{item.pendingCount} pendente(s)</span>}
                          {item.paidCount > 0 && <span>{item.paidCount} recebida(s)</span>}
                          {item.overdueCount > 0 && <span>{item.overdueCount} em atraso</span>}
                          {item.cancelledCount > 0 && <span>{item.cancelledCount} cancelada(s)</span>}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 border-t p-4">
                      {item.incomes.map((installment, index) => (
                        <div
                          key={`${item.key}-${installment.id}`}
                          className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                Parcela {index + 1} de {item.incomes.length}
                              </p>
                              <Badge variant={STATUS_VARIANTS[installment.status]}>
                                {STATUS_LABELS[installment.status]}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span>R$ {installment.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              <span>{new Date(installment.transaction_date).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => startEditIncome(installment)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {installment.status === 'pending' && (
                              <Button size="sm" onClick={() => updateIncomeStatus(installment.id, 'paid')}>
                                Marcar como Recebida
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => deleteIncome(installment.id)}>
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
            {incomeItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma receita cadastrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
