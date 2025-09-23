import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  Download,
  AlertCircle,
  Timer,
  BarChart3
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedFinancialTab } from "@/components/financial/UnifiedFinancialTab";
import { ClientFinancialTab } from "@/components/financial/ClientFinancialTab";
import { ExpenseManagement } from "@/components/financial/ExpenseManagement";
import { IncomeManagement } from "@/components/financial/IncomeManagement";

/** *********************************************
 *  FinancialCategoryManagement
 ********************************************* */
const categorySchema = z.object({
  name: z.string().min(2, "Informe um nome com pelo menos 2 caracteres"),
  type: z.enum(["previsao_custo", "variavel", "fixo"], { required_error: "Selecione o tipo" })
});
type CategoryForm = z.infer<typeof categorySchema>;

type Category = {
  id: string;
  name: string;
  type: "previsao_custo" | "variavel" | "fixo";
  created_at: string;
  updated_at: string | null;
};

function FinancialCategoryManagement() {
  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "previsao_custo" }
  });

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("financial_categories")
        .select("id,name,category_type,parent_id,created_at,updated_at")
        .order("category_type", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const mapped: Category[] = rows.map((c: any) => ({
        id: String(c.id),
        name: String(c.name),
        type: c.category_type as Category["type"],
        created_at: String(c.created_at),
        updated_at: c.updated_at ? String(c.updated_at) : null,
      }));

      setCategories(mapped);
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as categorias.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const onCreateCategory = async (values: CategoryForm) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user?.id) {
        toast({
          title: "Sessão inválida",
          description: "Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      const payload = [{
        name: values.name.trim(),
        category_type: values.type,
        created_by: user.id, // remova se tiver DEFAULT auth.uid()
      }];

      const { data, error } = await supabase
        .from("financial_categories")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Categoria criada",
        description: `“${data.name}” foi adicionada.`,
      });

      form.reset({ name: "", type: values.type });
      loadCategories();
    } catch (err: any) {
      const msg =
        err?.code === "23505"
          ? "Já existe uma categoria com esse nome para este tipo."
          : err?.message || "Erro desconhecido ao salvar.";
      console.error("Erro ao salvar categoria:", err);
      toast({
        title: "Erro ao salvar",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const typeLabels: Record<Category["type"], string> = {
    previsao_custo: "Previsão de Custo",
    variavel: "Variável",
    fixo: "Fixo",
  };

  const groupedCategories: { type: Category["type"]; items: Category[] }[] = [
    { type: "previsao_custo", items: categories.filter(c => c.type === "previsao_custo") },
    { type: "variavel", items: categories.filter(c => c.type === "variavel") },
    { type: "fixo", items: categories.filter(c => c.type === "fixo") },
  ];

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return format(parsed, "dd/MM/yyyy");
  };

  return (
    <div className="space-y-6">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Cadastrar Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateCategory)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Aluguel, Consultoria, Software..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="previsao_custo">Previsão de Custo</SelectItem>
                        <SelectItem value="variavel">Variável</SelectItem>
                        <SelectItem value="fixo">Fixo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-3 flex justify-end">
                <Button type="submit" className="btn-hero-static" disabled={loading}>
                  <Plus className="w-4 h-4 mr-2" />
                  Salvar categoria
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {groupedCategories.map(({ type, items }) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{`Categorias - ${typeLabels[type]}`}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Criada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell>{formatDate(cat.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground">
                        Nenhuma categoria cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** *********************************************
 *  Página Financeiro
 ********************************************* */

const transactionFormSchema = z.object({
  transaction_type: z.enum(["income", "expense"]),
  description: z.string().min(2, "Descrição deve ter pelo menos 2 caracteres"),
  amount: z.string().min(1, "Valor é obrigatório"),
  transaction_category: z.enum(["receivable", "payable", "project", "fixed_expense", "variable_expense"]),
  transaction_date: z.string().min(1, "Data da transação é obrigatória"),
  client_id: z.string().optional(),
  recurrence_type: z.enum(["none", "monthly", "quarterly", "yearly"]).default("none"),
  recurrence_end_date: z.string().optional(),
  bank_account_id: z.string().optional(),
});

interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_type: "income" | "expense";
  transaction_category: "receivable" | "payable" | "project" | "fixed_expense" | "variable_expense";
  transaction_date: string;
  status: "pending" | "paid" | "overdue";
  client_id?: string;
  client?: string;
  recurrence_type?: "none" | "monthly" | "quarterly" | "yearly";
  recurrence_end_date?: string;
  bank_account_id?: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  name: string;
  account_type: string;
  balance: number;
}

interface Installment {
  id: string;
  client_id: string;
  client_name?: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  payment_date?: string;
  payment_method?: string;
}

interface HorasColaborador {
  id: string;
  nome: string;
  horas_semana: number;
  horas_mes: number;
  valor_hora: number;
  total_mes: number;
}

type ManualExpenseStatus = "pending" | "paid" | "cancelled";

interface ManualExpenseCategory {
  id: string;
  name: string;
  category_type: "previsao_custo" | "variavel" | "fixo";
}

interface ManualExpense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  status: ManualExpenseStatus;
  payment_method?: string | null;
  created_at: string;
  category?: ManualExpenseCategory | null;
}

interface OverviewRecord {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  status: string;
  origin: "client" | "operational";
  category?: string | null;
  categoryType?: ManualExpenseCategory["category_type"]; // only for expenses
}

const normalizeExpenseStatus = (status?: string | null): ManualExpenseStatus => {
  if (status === "paid") return "paid";
  if (status === "cancelled") return "cancelled";
  return "pending";
};

const categorias = {
  income: [
    "Honorários de Projeto",
    "Consultoria",
    "Acompanhamento de Obra",
    "Aprovação em Órgãos",
    "Outros Serviços"
  ],
  expense: [
    "Salários e Encargos",
    "Aluguel",
    "Energia Elétrica",
    "Telefone/Internet",
    "Material de Escritório",
    "Software/Licenças",
    "Marketing",
    "Transporte",
    "Alimentação",
    "Outros"
  ]
};

export default function Financeiro() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [horasColaboradores, setHorasColaboradores] = useState<HorasColaborador[]>([]);
  const [manualExpenses, setManualExpenses] = useState<ManualExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<z.infer<typeof transactionFormSchema>>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      transaction_type: "income",
      description: "",
      amount: "",
      transaction_category: "receivable",
      transaction_date: "",
      client_id: "",
      recurrence_type: "none",
    },
  });

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('client_financials')
        .select('*')
        .order('transaction_date', { ascending: false });
      if (transactionsError) throw transactionsError;

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (clientsError) throw clientsError;

      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name');
      if (bankAccountsError) throw bankAccountsError;

      const { data: installmentsData, error: installmentsError } = await supabase
        .from('payment_installments')
        .select('*')
        .order('due_date', { ascending: true });
      if (installmentsError) throw installmentsError;

      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          expense_date,
          status,
          payment_method,
          created_at,
          category:financial_categories(id, name, category_type)
        `)
        .order('expense_date', { ascending: false });
      if (expensesError) throw expensesError;

      const clientMap = new Map<string, string>();
      (clientsData ?? []).forEach(client => clientMap.set(client.id, client.name));

      const processedTransactions = (transactionsData ?? []).map((t: any) => ({
        ...t,
        client: clientMap.get(t.client_id) || undefined,
        transaction_type: t.transaction_type as "income" | "expense",
        transaction_category: t.transaction_category as "receivable" | "payable" | "project" | "fixed_expense" | "variable_expense",
        status: t.status as "pending" | "paid" | "overdue",
        recurrence_type: (t.recurrence_type || "none") as "none" | "monthly" | "quarterly" | "yearly"
      }));

      const processedInstallments = (installmentsData ?? []).map((i: any) => ({
        ...i,
        client_name: clientMap.get(i.client_id) || 'Cliente não encontrado',
        status: i.status as 'pending' | 'paid' | 'overdue' | 'cancelled'
      }));

      const mappedExpenses: ManualExpense[] = (expensesData ?? []).map((expense: any) => ({
        id: String(expense.id),
        description: String(expense.description),
        amount: Number(expense.amount) || 0,
        expense_date: String(expense.expense_date),
        status: normalizeExpenseStatus(expense.status),
        payment_method: expense.payment_method ? String(expense.payment_method) : null,
        created_at: String(expense.created_at),
        category: expense.category
          ? {
              id: String(expense.category.id),
              name: String(expense.category.name),
              category_type: expense.category.category_type as ManualExpenseCategory["category_type"],
            }
          : null,
      }));

      setTransactions(processedTransactions);
      setClients(clientsData || []);
      setBankAccounts(bankAccountsData || []);
      setInstallments(processedInstallments);
      setManualExpenses(mappedExpenses);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados financeiros.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleInstallmentCreated = () => { loadData(); };

  const onSubmit = async (values: z.infer<typeof transactionFormSchema>) => {
    try {
      const normalized = values.amount
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '');
      const { data, error } = await supabase
        .from('client_financials')
        .insert([{
          transaction_type: values.transaction_type,
          description: values.description,
          amount: parseFloat(normalized),
          transaction_category: values.transaction_category,
          transaction_date: values.transaction_date,
          client_id: values.client_id || null,
          recurrence_type: values.recurrence_type,
          recurrence_end_date: values.recurrence_end_date || null,
          bank_account_id: values.bank_account_id || null,
          status: "pending",
          created_by: (await supabase.auth.getUser()).data.user?.id || ''
        }])
        .select();

      if (error) throw error;
      
      toast({
        title: "Sucesso!",
        description: "Transação criada com sucesso.",
      });
      
      setIsDialogOpen(false);
      form.reset();
      loadData();
    } catch (error: any) {
      console.error('Erro ao criar transação:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao criar transação.",
        variant: "destructive",
      });
    }
  };

  const totalReceitas = transactions
    .filter(t => t.transaction_type === "income" && t.status === "paid")
    .reduce((acc, t) => acc + t.amount, 0);

  const manualExpensesPaid = manualExpenses
    .filter(expense => expense.status === "paid")
    .reduce((acc, expense) => acc + expense.amount, 0);

  const manualExpensesPending = manualExpenses
    .filter(expense => expense.status === "pending")
    .reduce((acc, expense) => acc + expense.amount, 0);

  const totalDespesas = transactions
    .filter(t => t.transaction_type === "expense" && t.status === "paid")
    .reduce((acc, t) => acc + t.amount, 0) + manualExpensesPaid;

  const receitasPendentes = transactions
    .filter(t => t.transaction_type === "income" && t.status === "pending")
    .reduce((acc, t) => acc + t.amount, 0);

  const despesasPendentes = transactions
    .filter(t => t.transaction_type === "expense" && t.status === "pending")
    .reduce((acc, t) => acc + t.amount, 0) + manualExpensesPending;

  const atrasados = transactions.filter(t => t.status === "overdue");
  const fluxoCaixa = totalReceitas - totalDespesas;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "text-green-600 bg-green-100";
      case "pending": return "text-yellow-600 bg-yellow-100";
      case "overdue": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid": return "Pago";
      case "pending": return "Pendente";
      case "overdue": return "Em atraso";
      case "cancelled": return "Cancelado";
      default: return status;
    }
  };

  const overviewRecords = useMemo<OverviewRecord[]>(() => {
    const transactionRecords = transactions
      .filter(t => t.transaction_type === "income" || t.transaction_type === "expense")
      .map<OverviewRecord>(t => ({
        id: t.id,
        type: t.transaction_type,
        description: t.description,
        amount: t.amount,
        date: t.transaction_date,
        status: t.status,
        origin: "client",
        category: t.transaction_category,
      }));

    const expenseRecords = manualExpenses.map<OverviewRecord>(expense => ({
      id: expense.id,
      type: "expense",
      description: expense.description,
      amount: expense.amount,
      date: expense.expense_date,
      status: expense.status,
      origin: "operational",
      category: expense.category?.name ?? null,
      categoryType: expense.category?.category_type,
    }));

    return [...transactionRecords, ...expenseRecords].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions, manualExpenses]);

  const filteredOverviewRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return overviewRecords;

    return overviewRecords.filter(record => {
      const searchFields = [
        record.description,
        record.category ?? "",
        record.status,
        record.origin === "client" ? "clientes" : "operacional",
        record.type === "income" ? "receita" : "despesa",
        record.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      ];

      return searchFields.some(field => field.toLowerCase().includes(term));
    });
  }, [overviewRecords, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Financeiro" subtitle="Carregando..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Financeiro"
        subtitle="Gestão financeira completa do escritório de arquitetura"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="unified">Contas e Parcelas</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="card-elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Receitas (Mês)</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalReceitas)}
                    </p>
                  </div>
                  <TrendingUp className="size-8 text-green-600 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Despesas (Mês)</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(totalDespesas)}
                    </p>
                  </div>
                  <TrendingDown className="size-8 text-red-600 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Fluxo de Caixa</p>
                    <p className={`text-2xl font-bold ${fluxoCaixa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(fluxoCaixa)}
                    </p>
                  </div>
                  <DollarSign className={`size-8 opacity-80 ${fluxoCaixa >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Valores em Atraso</p>
                    <p className="text-2xl font-bold text-red-600">
                      {atrasados.length}
                    </p>
                  </div>
                  <AlertCircle className="size-8 text-red-600 opacity-80" />
                </div>
          </CardContent>
        </Card>
      </div>

          <Card className="card-elevated">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle>Movimentações Financeiras</CardTitle>
              <Input
                placeholder="Buscar por descrição, status ou categoria"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full md:w-72"
              />
            </CardHeader>
            <CardContent className="p-0">
              {filteredOverviewRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOverviewRecords.map(record => (
                        <TableRow key={`${record.origin}-${record.id}`}>
                          <TableCell>
                            <Badge variant={record.type === "income" ? "default" : "destructive"}>
                              {record.type === "income" ? "Receita" : "Despesa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{record.description}</TableCell>
                          <TableCell>{record.category ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {record.origin === "client" ? "Clientes" : "Operacional"}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(record.date), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(record.amount)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(record.status)}`}
                            >
                              {getStatusLabel(record.status)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhuma movimentação encontrada para o filtro informado.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contas a Receber</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions
                    .filter(t => t.transaction_type === "income" && t.status === "pending")
                    .slice(0, 5)
                    .map(transaction => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            Vencimento: {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">
                            {formatCurrency(transaction.amount)}
                          </div>
                          <Badge variant="outline">Pendente</Badge>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contas a Pagar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions
                    .filter(t => t.transaction_type === "expense" && (t.status === "pending" || t.status === "overdue"))
                    .slice(0, 5)
                    .map(transaction => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-muted-foreground">
                            Vencimento: {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-red-600">
                            {formatCurrency(transaction.amount)}
                          </div>
                          <Badge variant={transaction.status === "overdue" ? "destructive" : "outline"}>
                            {transaction.status === "overdue" ? "Atrasado" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Unificado */}
        <TabsContent value="unified">
          <UnifiedFinancialTab 
            transactions={transactions}
            clients={clients}
            installments={installments}
            onInstallmentCreated={handleInstallmentCreated}
          />
        </TabsContent>

        {/* Clientes */}
        <TabsContent value="clients">
          <ClientFinancialTab />
        </TabsContent>

        {/* Fluxo */}
        <TabsContent value="fluxo">
          <Card>
            <CardContent className="py-8 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Fluxo de Caixa</h3>
              <p className="text-muted-foreground">
                Gráficos e projeções de fluxo de caixa em desenvolvimento
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios" className="space-y-6">
          <Card>
            <CardContent className="py-8 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Relatórios Detalhados</h3>
              <p className="text-muted-foreground">
                Relatórios mensais e anuais em desenvolvimento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle>Relatório de Horas por Colaborador</CardTitle>
              <div className="flex gap-2">
                <Select
                  value={format(selectedMonth, "yyyy-MM")}
                  onValueChange={(value) => {
                    const [year, month] = value.split("-").map(Number);
                    if (!Number.isNaN(year) && !Number.isNaN(month)) {
                      setSelectedMonth(new Date(year, month - 1, 1));
                    }
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={format(new Date(), "yyyy-MM")}>
                      {format(new Date(), "MMMM yyyy", { locale: ptBR })}
                    </SelectItem>
                    <SelectItem value={format(subMonths(new Date(), 1), "yyyy-MM")}>
                      {format(subMonths(new Date(), 1), "MMMM yyyy", { locale: ptBR })}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Horas/Semana</TableHead>
                    <TableHead>Horas/Mês</TableHead>
                    <TableHead>Valor/Hora</TableHead>
                    <TableHead className="text-right">Total Mensal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horasColaboradores.map((colaborador) => (
                    <TableRow key={colaborador.id}>
                      <TableCell className="font-medium">{colaborador.nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          {colaborador.horas_semana}h
                        </div>
                      </TableCell>
                      <TableCell>{colaborador.horas_mes}h</TableCell>
                      <TableCell>{formatCurrency(colaborador.valor_hora)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(colaborador.total_mes)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {horasColaboradores.length > 0 && (
                    <TableRow className="border-t-2">
                      <TableCell colSpan={4} className="font-semibold">Total Geral</TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(horasColaboradores.reduce((acc, c) => acc + c.total_mes, 0))}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cadastro — por último */}
        <TabsContent value="cadastro" className="space-y-6">
          <IncomeManagement onDataChange={loadData} />
          <ExpenseManagement onDataChange={loadData} />
          <FinancialCategoryManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
