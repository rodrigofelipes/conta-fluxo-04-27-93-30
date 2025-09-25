import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Calendar, User2, Trash2, Pencil, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/state/auth";

interface ClientOption {
  id: string;
  name: string;
}

type IncomeStatus = "pending" | "paid" | "overdue" | "cancelled";

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  receivable: "A Receber",
  payable: "A Pagar",
  project: "Projeto",
  fixed_expense: "Despesa Fixa",
  variable_expense: "Despesa Variável",
};

interface IncomeFormState {
  description: string;
  amount: string;
  transaction_date: string;
  client_id: string | null;
  status: IncomeStatus;
  category_id: string;
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

const NO_CLIENT_SELECT_VALUE = "no-client";

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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);

  const legacyCategories = useMemo(
    () =>
      Object.entries(LEGACY_CATEGORY_LABELS).map(([id, name]) => ({
        id,
        name,
      })),
    [],
  );

  const createDefaultIncomeForm = (): IncomeFormState => ({
    description: "",
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    client_id: null,
    status: "pending" as IncomeStatus,
    category_id: legacyCategories[0]?.id ?? "",
  });

  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(createDefaultIncomeForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [incomesRes, clientsRes] = await Promise.all([
        supabase
          .from("client_financials")
          .select("id, description, amount, transaction_date, status, client_id, transaction_category, created_at")
          .eq("transaction_type", "income")
          .order("transaction_date", { ascending: false }),
        supabase
          .from("clients")
          .select("id, name")
          .order("name"),
      ]);

      if (incomesRes.error) throw incomesRes.error;
      if (clientsRes.error) throw clientsRes.error;

      const clientOptions: ClientOption[] = (clientsRes.data ?? []).map((client: any) => ({
        id: String(client.id),
        name: String(client.name),
      }));
      const clientMap = new Map(clientOptions.map(client => [client.id, client.name]));

      const normalizedIncomes: IncomeRecord[] = (incomesRes.data || []).map((income: any) => {
        const clientId = income.client_id ? String(income.client_id) : null;
        const categoryId = income.transaction_category ? String(income.transaction_category) : null;
        return {
          id: String(income.id),
          description: String(income.description),
          amount: Number(income.amount) || 0,
          transaction_date: String(income.transaction_date),
          status: normalizeStatus(income.status),
          client_id: clientId,
          client_name: clientId ? clientMap.get(clientId) ?? null : null,
          category_id: categoryId,
          created_at: String(income.created_at),
        };
      });

      setIncomes(normalizedIncomes);
      setClients(clientOptions);
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
    const validCategoryId = income.category_id && legacyCategories.some(category => category.id === income.category_id)
      ? income.category_id
      : "";
    setIncomeForm({
      description: income.description,
      amount: income.amount.toString(),
      transaction_date: income.transaction_date.split("T")[0],
      client_id: income.client_id ?? null,
      status: income.status,
      category_id: validCategoryId,
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
            client_id: incomeForm.client_id || null,
            transaction_category: incomeForm.category_id,
          })
          .eq("id", editingIncomeId);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Receita atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase.from("client_financials").insert({
          transaction_type: "income",
          description: incomeForm.description.trim(),
          amount: amountValue,
          transaction_date: incomeForm.transaction_date,
          status: incomeForm.status,
          client_id: incomeForm.client_id || null,
          transaction_category: incomeForm.category_id,
          created_by: user.id,
        });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Receita criada com sucesso!",
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
      const { error, count } = await supabase
        .from("client_financials")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("transaction_type", "income");

      if (error) throw error;

      if (!count) {
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

  const categoriesById = useMemo(
    () => new Map(legacyCategories.map(category => [category.id, category.name])),
    [legacyCategories],
  );

  const getIncomeCategoryLabel = useMemo(
    () =>
      (categoryId: string | null | undefined): string | null => {
        if (!categoryId) return null;
        const categoryName = categoriesById.get(categoryId);
        if (categoryName) {
          return categoryName;
        }
        return LEGACY_CATEGORY_LABELS[categoryId] ?? "Categoria removida";
      },
    [categoriesById]
  );

  const totalPending = useMemo(
    () => incomes.filter(income => income.status === "pending").reduce((sum, income) => sum + income.amount, 0),
    [incomes],
  );

  const totalReceived = useMemo(
    () => incomes.filter(income => income.status === "paid").reduce((sum, income) => sum + income.amount, 0),
    [incomes],
  );

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
              <div>
                <Label htmlFor="income_category">Categoria</Label>
                <Select
                  value={incomeForm.category_id}
                  onValueChange={(value) => setIncomeForm(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger id="income_category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {legacyCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select
                  value={incomeForm.client_id ?? NO_CLIENT_SELECT_VALUE}
                  onValueChange={(value) =>
                    setIncomeForm(prev => ({
                      ...prev,
                      client_id: value === NO_CLIENT_SELECT_VALUE ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CLIENT_SELECT_VALUE}>Sem cliente associado</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
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
            {incomes.map(income => (
              <div key={income.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{income.description}</h4>
                    <Badge variant={STATUS_VARIANTS[income.status] || "outline"}>
                      {STATUS_LABELS[income.status]}
                    </Badge>
                    {income.client_name && (
                      <Badge variant="outline">{income.client_name}</Badge>
                    )}
                    {(() => {
                      const categoryLabel = getIncomeCategoryLabel(income.category_id);
                      if (!categoryLabel) return null;
                      return (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {categoryLabel}
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>R$ {income.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    <span>{new Date(income.transaction_date).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditIncome(income)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {income.status !== "paid" && income.status !== "cancelled" && (
                    <Button size="sm" onClick={() => updateIncomeStatus(income.id, "paid")}>
                      Marcar como Recebida
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteIncome(income.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {incomes.length === 0 && (
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
