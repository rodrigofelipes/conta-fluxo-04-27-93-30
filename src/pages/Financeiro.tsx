import { Fragment, useState, useEffect, useMemo, useCallback } from "react";

import { useLocation, useNavigate } from "react-router-dom";

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
  BarChart3,
  ChevronDown,
  Mail,
  MessageCircle
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { differenceInCalendarDays, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ClientFinancialTab } from "@/components/financial/ClientFinancialTab";
import { ExpenseManagement } from "@/components/financial/ExpenseManagement";
import { IncomeManagement } from "@/components/financial/IncomeManagement";
import { PaymentLinkGenerator } from "@/components/payments/PaymentLinkGenerator";
import { PaymentLinksTable } from "@/components/payments/PaymentLinksTable";
import type { PaymentLinkRow } from "@/components/payments/PaymentLinksTable";
import { ClientFinancialEmailDialog } from "@/components/financial/ClientFinancialEmailDialog";


/** *********************************************
 *  FinancialCategoryManagement
 ********************************************* */
const isMissingTableError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "42P01";

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
  email?: string | null;
  phone?: string | null;
}

interface BankAccount {
  id: string;
  name: string;
  account_type: string;
  balance: number;
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
  recurrence_type?: "none" | "monthly" | "yearly" | null;
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
  recurrence_type?: "none" | "monthly" | "quarterly" | "yearly" | null;
  created_at?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  paymentMethod?: string | null;
}

type OverviewStatusKey = "pending" | "paid" | "overdue" | "cancelled";

type OverviewListItem =
  | {
      type: "single";
      record: OverviewRecord;
      sortDate: string;
    }
  | {
      type: "installment";
      key: string;
      description: string;
      typeValue: OverviewRecord["type"];
      origin: OverviewRecord["origin"];
      category?: string | null;
      categoryType?: ManualExpenseCategory["category_type"];
      totalAmount: number;
      firstDate: string;
      lastDate: string;
      records: OverviewRecord[];
      statusCounts: Record<OverviewStatusKey, number>;
      statusInfo: { label: string; variant: "default" | "secondary" | "destructive" | "outline" };
      sortDate: string;
    };

type OverviewTypeFilter = "all" | OverviewRecord["type"];
type OverviewStatusFilter = "all" | "paid" | "pending" | "overdue" | "cancelled";
type OverviewOriginFilter = "all" | OverviewRecord["origin"];

const normalizeExpenseStatus = (status?: string | null): ManualExpenseStatus => {
  if (status === "paid") return "paid";
  if (status === "cancelled") return "cancelled";
  return "pending";
};

const normalizeCategoryLabel = (label?: string | null) => {
  if (!label) return "Sem categoria";
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : "Sem categoria";
};

const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const installmentRecurrenceTypes = new Set(["monthly", "quarterly", "yearly"]);

const extractInstallmentMetadata = (description: string | null | undefined) => {
  const original = description?.trim() ?? "";
  if (!original) {
    return {
      baseDescription: "",
      hasInstallmentPattern: false,
      currentInstallment: null as number | null,
      totalInstallments: null as number | null,
    };
  }

  const pattern = /(.*?)(?:\s*[\-–—(\[]?\s*parc(?:ela|\.)\s*)(\d+)(?:\s*(?:\/|de)\s*)(\d+)[)\]\s]*$/i;
  const match = original.match(pattern);

  if (!match) {
    return {
      baseDescription: original,
      hasInstallmentPattern: false,
      currentInstallment: null,
      totalInstallments: null,
    };
  }

  const [, base = "", current, total] = match;
  return {
    baseDescription: base.trim() || original,
    hasInstallmentPattern: true,
    currentInstallment: Number.parseInt(current, 10) || null,
    totalInstallments: Number.parseInt(total, 10) || null,
  };
};

const getInstallmentGroupingKey = (record: OverviewRecord) => {
  const metadata = extractInstallmentMetadata(record.description);
  const recurrence = record.recurrence_type ?? "none";
  const isInstallmentRecord =
    metadata.hasInstallmentPattern || installmentRecurrenceTypes.has(recurrence);

  if (!isInstallmentRecord) {
    return null;
  }

  const baseDescription = metadata.baseDescription || record.description.trim();
  const ownerKey =
    record.origin === "client"
      ? record.clientId || record.clientName || ""
      : record.category || "";

  const createdAtKey = record.created_at
    ? new Date(record.created_at).toISOString().slice(0, 10)
    : "";

  const parts = [record.type, record.origin, baseDescription];
  if (ownerKey) {
    parts.push(ownerKey);
  }
  if (metadata.totalInstallments) {
    parts.push(`total:${metadata.totalInstallments}`);
  }
  if (createdAtKey) {
    parts.push(`created:${createdAtKey}`);
  }

  return {
    key: parts.join("|"),
    baseDescription,
  };
};

const manualCategoryTypeLabels: Record<ManualExpenseCategory["category_type"], string> = {
  previsao_custo: "Previsão de Custo",
  variavel: "Variável",
  fixo: "Fixo",
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

const FINANCE_TABS = ["overview", "clients", "fluxo", "relatorios", "cadastro"] as const;
type FinanceTab = (typeof FINANCE_TABS)[number];

type PaymentLinkRecord = PaymentLinkRow;

interface OnlinePaymentTransaction {
  id: string;
  client_id: string;
  payment_link_id: string | null;
  client_financial_id: string | null;
  installment_id: string | null;
  stripe_payment_id: string | null;
  stripe_session_id: string | null;
  amount: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  payment_method: string | null;
  payment_date: string | null;
  created_at: string;
  error_message: string | null;
}

interface PaymentInstallmentRecord {
  id: string;
  client_id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: string;
  status: string;
}

export default function Financeiro() {
  const location = useLocation();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [horasColaboradores, setHorasColaboradores] = useState<HorasColaborador[]>([]);
  const [manualExpenses, setManualExpenses] = useState<ManualExpense[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkRecord[]>([]);
  const [onlinePayments, setOnlinePayments] = useState<OnlinePaymentTransaction[]>([]);
  const [onlineInstallments, setOnlineInstallments] = useState<PaymentInstallmentRecord[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<OverviewTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<OverviewStatusFilter>("all");
  const [originFilter, setOriginFilter] = useState<OverviewOriginFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [openOverviewGroups, setOpenOverviewGroups] = useState<Record<string, boolean>>({});
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedEmailClientId, setSelectedEmailClientId] = useState<string | null>(null);

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(client => {
      map.set(client.id, client);
    });
    return map;
  }, [clients]);

  const selectedEmailClient = useMemo(() => {
    if (!selectedEmailClientId) {
      return null;
    }
    return clientsById.get(selectedEmailClientId) ?? null;
  }, [selectedEmailClientId, clientsById]);

  const openEmailDialogForClient = useCallback((clientId: string | null | undefined) => {
    if (!clientId) return;
    setSelectedEmailClientId(clientId);
    setIsEmailDialogOpen(true);
  }, []);

  const handleEmailDialogOpenChange = useCallback((open: boolean) => {
    setIsEmailDialogOpen(open);
    if (!open) {
      setSelectedEmailClientId(null);
    }
  }, []);

  const handleNotifyClientByWhatsApp = useCallback((clientId: string | null | undefined) => {
    if (!clientId) return;
    navigate(`/chat?clientId=${clientId}`);
  }, [navigate]);

  const shouldEnableClientNotification = useCallback((record: OverviewRecord) => {
    if (record.origin !== "client") return false;
    if (record.type !== "income") return false;
    if (record.status !== "overdue") return false;
    if (!record.clientId) return false;

    const dueDate = new Date(record.date);
    if (Number.isNaN(dueDate.getTime())) return false;

    return differenceInCalendarDays(new Date(), dueDate) >= 5;
  }, []);

  useEffect(() => {
    const state = location.state as { activeTab?: string } | null;

    if (state?.activeTab) {
      const tabFromState = state.activeTab;
      const isValidTab = (value: string): value is FinanceTab =>
        FINANCE_TABS.includes(value as FinanceTab);

      if (isValidTab(tabFromState)) {
        setActiveTab(currentTab => (tabFromState === currentTab ? currentTab : tabFromState));
        return;
      }
    }

    setActiveTab("overview");
  }, [location.state]);


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
        .select('id, name, email, phone')
        .order('name');
      if (clientsError) throw clientsError;

      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name');
      if (bankAccountsError) throw bankAccountsError;

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
          recurrence_type,
          category:financial_categories(id, name, category_type)
        `)
        .order('expense_date', { ascending: false });
      if (expensesError) throw expensesError;

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('financial_categories')
        .select('id, name, category_type, created_at, updated_at')
        .order('category_type', { ascending: true })
        .order('name', { ascending: true });
      if (categoriesError) throw categoriesError;

      let paymentLinksData: any[] = [];
      {
        const { data, error } = await (supabase as any)
          .from('payment_links')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) {
          const code = (error as any).code;
          if (code === 'PGRST205' || code === '42P01') {
            console.warn('Tabela payment_links ausente, ignorando...');
          } else {
            throw error;
          }
        } else {
          paymentLinksData = data ?? [];
        }
      }



      let onlinePaymentsData: any[] = [];
      {
        const { data, error } = await (supabase as any)
          .from('payment_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) {
          const code = (error as any).code;
          if (code === 'PGRST205' || code === '42P01') {
            console.warn('Tabela payment_transactions ausente, ignorando...');
          } else {
            throw error;
          }
        } else {
          onlinePaymentsData = data ?? [];
        }
      }



      const { data: installmentsData, error: installmentsError } = await supabase
        .from('payment_installments')
        .select('*')
        .order('due_date', { ascending: true })
        .limit(200);
      if (installmentsError) throw installmentsError;

      const normalizedClients: Client[] = (clientsData ?? []).map((client: any) => ({
        id: String(client.id),
        name: String(client.name),
        email: client.email ? String(client.email) : null,
        phone: client.phone ? String(client.phone) : null,
      }));

      const clientNameMap = new Map<string, string>();
      normalizedClients.forEach(client => clientNameMap.set(client.id, client.name));

      const processedTransactions = (transactionsData ?? []).map((t: any) => ({
        ...t,
        client: clientNameMap.get(t.client_id) || undefined,
        transaction_type: t.transaction_type as "income" | "expense",
        transaction_category: t.transaction_category as "receivable" | "payable" | "project" | "fixed_expense" | "variable_expense",
        status: t.status as "pending" | "paid" | "overdue",
        recurrence_type: (t.recurrence_type || "none") as "none" | "monthly" | "quarterly" | "yearly"
      }));

      const mappedExpenses: ManualExpense[] = (expensesData ?? []).map((expense: any) => ({
        id: String(expense.id),
        description: String(expense.description),
        amount: Number(expense.amount) || 0,
        expense_date: String(expense.expense_date),
        status: normalizeExpenseStatus(expense.status),
        payment_method: expense.payment_method ? String(expense.payment_method) : null,
        created_at: String(expense.created_at),
        recurrence_type: (expense.recurrence_type ?? "none") as ManualExpense["recurrence_type"],
        category: expense.category
          ? {
              id: String(expense.category.id),
              name: String(expense.category.name),
              category_type: expense.category.category_type as ManualExpenseCategory["category_type"],
            }
          : null,
      }));

      setTransactions(processedTransactions);
      setClients(normalizedClients);
      setBankAccounts(bankAccountsData || []);
      setManualExpenses(mappedExpenses);
      const mappedCategories: Category[] = (categoriesData ?? []).map((category: any) => ({
        id: String(category.id),
        name: String(category.name),
        type: category.category_type as Category['type'],
        created_at: String(category.created_at),
        updated_at: category.updated_at ? String(category.updated_at) : null,
      }));

      setCategories(mappedCategories);
      setPaymentLinks((paymentLinksData ?? []) as PaymentLinkRecord[]);
      setOnlinePayments((onlinePaymentsData ?? []) as OnlinePaymentTransaction[]);
      setOnlineInstallments((installmentsData ?? []) as PaymentInstallmentRecord[]);

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

  const activeOnlineLinks = useMemo(() => paymentLinks.filter(link => link.status === 'active').length, [paymentLinks]);
  const completedOnlineLinks = useMemo(() => paymentLinks.filter(link => link.status === 'completed').length, [paymentLinks]);
  const totalOnlineReceived = useMemo(
    () => onlinePayments
      .filter(payment => payment.status === 'succeeded')
      .reduce((acc, payment) => acc + payment.amount, 0),
    [onlinePayments]
  );

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

  const getOverviewGroupStatusInfo = useCallback((
    counts: Record<OverviewStatusKey, number>,
  ): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    const hasPending = counts.pending > 0;
    const hasPaid = counts.paid > 0;
    const hasOverdue = counts.overdue > 0;
    const hasCancelled = counts.cancelled > 0;

    if (hasOverdue && hasPending) {
      return { label: "Pendentes/Atrasadas", variant: "destructive" };
    }

    if (hasOverdue) {
      return { label: "Em atraso", variant: "destructive" };
    }

    if (hasPending && hasPaid) {
      return { label: "Pendentes/Pagas", variant: "secondary" };
    }

    if (hasPending) {
      return { label: "Pendente", variant: "secondary" };
    }

    if (hasCancelled && (hasPending || hasPaid || hasOverdue)) {
      return { label: "Parcialmente Cancelado", variant: "outline" };
    }

    if (hasCancelled) {
      return { label: "Cancelado", variant: "outline" };
    }

    return { label: "Pago", variant: "default" };
  }, []);

  const formatDateLabel = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }
    return format(parsed, "dd/MM/yyyy");
  };

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(category => {
      map.set(category.id, category.name);
    });
    return map;
  }, [categories]);

  const getTransactionCategoryLabel = useMemo(() => {
    const defaultLabels: Record<string, string> = {
      receivable: "A Receber",
      payable: "A Pagar",
      project: "Projeto",
      fixed_expense: "Despesa Fixa",
      variable_expense: "Despesa Variável",
      other: "Sem categoria",
    };

    return (categoryKey: string | null | undefined): string => {
      if (!categoryKey) return "Sem categoria";

      const normalizedKey = categoryKey.trim();
      if (!normalizedKey) return "Sem categoria";

      const categoryFromRegistry = categoryNameById.get(normalizedKey);
      if (categoryFromRegistry) return normalizeCategoryLabel(categoryFromRegistry);

      return normalizeCategoryLabel(defaultLabels[normalizedKey] ?? normalizedKey);
    };
  }, [categoryNameById]);

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
        category: getTransactionCategoryLabel(t.transaction_category),
        recurrence_type: t.recurrence_type ?? "none",
        created_at: t.created_at ?? null,
        clientId: t.client_id ?? null,
        clientName: t.client ?? null,
        paymentMethod: null,
      }));

      const expenseRecords = manualExpenses.map<OverviewRecord>(expense => ({
        id: expense.id,
        type: "expense",
        description: expense.description,
        amount: expense.amount,
        date: expense.expense_date,
        status: expense.status,
        origin: "operational",
        category: normalizeCategoryLabel(expense.category?.name),
        categoryType: expense.category?.category_type,
        recurrence_type: expense.recurrence_type ?? "none",
        created_at: expense.created_at,
        clientId: null,
        clientName: null,
        paymentMethod: expense.payment_method ?? null,
      }));

    return [...transactionRecords, ...expenseRecords].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions, manualExpenses, getTransactionCategoryLabel]);

  const overviewItems = useMemo<OverviewListItem[]>(() => {
    const groups = new Map<string, { records: OverviewRecord[]; description: string }>();
    const singles: OverviewRecord[] = [];

    overviewRecords.forEach(record => {
      const grouping = getInstallmentGroupingKey(record);

      if (!grouping) {
        singles.push(record);
        return;
      }

      const existing = groups.get(grouping.key);
      if (existing) {
        existing.records.push(record);
        if (!existing.description && grouping.baseDescription) {
          existing.description = grouping.baseDescription;
        }
        return;
      }

      groups.set(grouping.key, {
        records: [record],
        description: grouping.baseDescription || record.description,
      });
    });

    const items: OverviewListItem[] = singles.map(record => ({
      type: "single",
      record,
      sortDate: record.date,
    }));

    const statusKeys: OverviewStatusKey[] = ["pending", "paid", "overdue", "cancelled"];


    groups.forEach(({ records, description }, key) => {
      if (records.length <= 1) {
        const [record] = records;
        if (record) {
          items.push({ type: "single", record, sortDate: record.date });
        }
        return;
      }

      const sortedRecords = [...records].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      const totalAmount = sortedRecords.reduce((sum, item) => sum + item.amount, 0);
      const statusCounts: Record<OverviewStatusKey, number> = {
        pending: 0,
        paid: 0,
        overdue: 0,
        cancelled: 0,
      };

      sortedRecords.forEach(record => {
        const statusKey = statusKeys.includes(record.status as OverviewStatusKey)
          ? (record.status as OverviewStatusKey)
          : "pending";
        statusCounts[statusKey] += 1;
      });

      const firstRecord = sortedRecords[0];
      const lastRecord = sortedRecords[sortedRecords.length - 1] ?? firstRecord;

      items.push({
        type: "installment",
        key,
        description: description?.trim() || firstRecord?.description || "Parcelado",
        typeValue: firstRecord?.type ?? "expense",
        origin: firstRecord?.origin ?? "operational",
        category: firstRecord?.category ?? "Sem categoria",
        categoryType: firstRecord?.categoryType,
        totalAmount,
        firstDate: firstRecord?.date ?? new Date().toISOString(),
        lastDate: lastRecord?.date ?? firstRecord?.date ?? new Date().toISOString(),
        records: sortedRecords,
        statusCounts,
        statusInfo: getOverviewGroupStatusInfo(statusCounts),
        sortDate: lastRecord?.date ?? firstRecord?.date ?? new Date().toISOString(),
      });
    });

    return items.sort((a, b) => {
      const dateA = new Date(a.sortDate).getTime();
      const dateB = new Date(b.sortDate).getTime();
      return dateB - dateA;
    });
  }, [overviewRecords, getOverviewGroupStatusInfo]);

  useEffect(() => {
    setOpenOverviewGroups(prev => {
      const validKeys = new Set(
        overviewItems
          .filter(item => item.type === "installment")
          .map(item => item.key),
      );

      const next: Record<string, boolean> = {};
      validKeys.forEach(key => {
        if (prev[key]) {
          next[key] = true;
        }
      });

      return next;
    });
  }, [overviewItems]);

  const overviewCategories = useMemo(() => {
    const unique = new Set<string>();

    overviewRecords.forEach(record => {
      unique.add(normalizeCategoryLabel(record.category));
    });

    categories.forEach(category => {
      unique.add(normalizeCategoryLabel(category.name));
    });

    unique.add("Sem categoria");

    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [overviewRecords, categories]);

  const filteredOverviewItems = useMemo(() => {
    const rawTerm = searchTerm.trim();
    const normalizedTerm = normalizeSearchValue(rawTerm);

    return overviewItems.filter(item => {
      const typeValue = item.type === "single" ? item.record.type : item.typeValue;
      if (typeFilter !== "all" && typeValue !== typeFilter) {
        return false;
      }

      const originValue = item.type === "single" ? item.record.origin : item.origin;
      if (originFilter !== "all" && originValue !== originFilter) {
        return false;
      }

      const categoryLabel = normalizeCategoryLabel(
        item.type === "single" ? item.record.category : item.category,
      );
      if (categoryFilter !== "all" && categoryLabel !== categoryFilter) {
        return false;
      }

      const matchesStatus = (() => {
        if (statusFilter === "all") return true;
        if (item.type === "single") {
          return item.record.status === statusFilter;
        }

        switch (statusFilter) {
          case "pending":
            return item.statusCounts.pending > 0;
          case "paid":
            return (
              item.statusCounts.paid > 0 &&
              item.statusCounts.pending === 0 &&
              item.statusCounts.overdue === 0
            );
          case "overdue":
            return item.statusCounts.overdue > 0;
          case "cancelled":
            return (
              item.statusCounts.cancelled > 0 &&
              item.statusCounts.pending === 0 &&
              item.statusCounts.overdue === 0 &&
              item.statusCounts.paid === 0
            );
          default:
            return true;
        }
      })();

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedTerm) {
        return true;
      }

      const searchFields: string[] = [];

      if (item.type === "single") {
        const recordCategory = normalizeCategoryLabel(item.record.category);

        searchFields.push(
          item.record.description,
          recordCategory,
          item.record.status,
          getStatusLabel(item.record.status),
          item.record.origin,
          item.record.origin === "client" ? "clientes" : "operacional",
          item.record.type,
          item.record.type === "income" ? "receita" : "despesa",
          item.record.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          item.record.amount.toFixed(2),
          formatDateLabel(item.record.date),
        );

        if (item.record.categoryType) {
          searchFields.push(
            item.record.categoryType,
            manualCategoryTypeLabels[item.record.categoryType],
          );
        }

        if (item.record.clientName) {
          searchFields.push(item.record.clientName);
        }

        if (item.record.paymentMethod) {
          searchFields.push(item.record.paymentMethod);
        }
      } else {
        searchFields.push(
          item.description,
          categoryLabel,
          item.origin,
          item.origin === "client" ? "clientes" : "operacional",
          item.typeValue,
          item.typeValue === "income" ? "receita" : "despesa",
          item.statusInfo.label,
          `${item.records.length} parcelas`,
          "parcelado",
          "parcelas",
          formatDateLabel(item.firstDate),
          formatDateLabel(item.lastDate),
          item.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          item.totalAmount.toFixed(2),
        );


        if (item.categoryType) {
          searchFields.push(
            item.categoryType,
            manualCategoryTypeLabels[item.categoryType],
          );
        }

        item.records.forEach((installment, index) => {
          searchFields.push(
            installment.description,
            normalizeCategoryLabel(installment.category),
            installment.status,
            getStatusLabel(installment.status),
            formatDateLabel(installment.date),
            installment.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            installment.amount.toFixed(2),
            `parcela ${index + 1}`,
          );

          if (installment.clientName) {
            searchFields.push(installment.clientName);
          }

          if (installment.paymentMethod) {
            searchFields.push(installment.paymentMethod);
          }
        });
      }

      const matchesTerm = searchFields.some(field =>
        normalizeSearchValue(String(field ?? "")).includes(normalizedTerm),
      );

      return matchesTerm;
    });
  }, [
    overviewItems,
    searchTerm,
    typeFilter,
    statusFilter,
    originFilter,
    categoryFilter,
  ]);

  const resetOverviewFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setOriginFilter("all");
    setCategoryFilter("all");
    setSearchTerm("");
  };

  const hasActiveOverviewFilters =
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    originFilter !== "all" ||
    categoryFilter !== "all" ||
    searchTerm.trim().length > 0;

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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FinanceTab)} className="space-y-6">

        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
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
              <div>
                <CardTitle>Pagamentos Online</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gere links de cobrança e acompanhe o status sem sair do painel financeiro.
                </p>
              </div>
              <PaymentLinkGenerator
                receivables={transactions}
                installments={onlineInstallments}
                onCreated={() => loadData()}
              />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">Links Ativos</p>
                  <p className="text-2xl font-semibold">{activeOnlineLinks}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">Pagamentos Confirmados</p>
                  <p className="text-2xl font-semibold text-green-600">{completedOnlineLinks}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">Recebido Online</p>
                  <p className="text-2xl font-semibold text-green-600">{formatCurrency(totalOnlineReceived)}</p>
                </div>
              </div>

              <PaymentLinksTable
                data={paymentLinks}
                limit={5}
                onStatusUpdated={() => loadData()}
              />
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle>Movimentações Financeiras</CardTitle>
                <Input
                  placeholder="Buscar por descrição, status ou categoria"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full md:w-72"
                />
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                <Select value={typeFilter} onValueChange={value => setTypeFilter(value as OverviewTypeFilter)}>
                  <SelectTrigger className="w-full md:w-44">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="income">Receitas</SelectItem>
                    <SelectItem value="expense">Despesas</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={value => setStatusFilter(value as OverviewStatusFilter)}>
                  <SelectTrigger className="w-full md:w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="paid">Pagas</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="overdue">Em atraso</SelectItem>
                    <SelectItem value="cancelled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={originFilter} onValueChange={value => setOriginFilter(value as OverviewOriginFilter)}>
                  <SelectTrigger className="w-full md:w-44">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as origens</SelectItem>
                    <SelectItem value="client">Clientes</SelectItem>
                    <SelectItem value="operational">Operacional</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={value => setCategoryFilter(value)}>
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {overviewCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveOverviewFilters && (
                  <Button variant="ghost" size="sm" onClick={resetOverviewFilters} className="md:ml-auto">
                    Limpar filtros
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredOverviewItems.length > 0 ? (
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
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOverviewItems.map(item => {
                        if (item.type === "single") {
                          const record = item.record;
                          const recordClientId = record.clientId ?? null;
                          const clientInfo = recordClientId ? clientsById.get(recordClientId) ?? null : null;
                          const canNotify = shouldEnableClientNotification(record);
                          const canUseWhatsApp = Boolean(clientInfo?.phone);
                          const canUseEmail = Boolean(clientInfo?.email);
                          return (
                            <TableRow key={`single-${record.origin}-${record.id}`}>
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
                              <TableCell>{formatDateLabel(record.date)}</TableCell>
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
                              <TableCell className="min-w-[220px]">
                                {canNotify ? (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleNotifyClientByWhatsApp(recordClientId)}
                                      disabled={!canUseWhatsApp}
                                      title={
                                        !canUseWhatsApp
                                          ? "Cadastre um telefone WhatsApp para o cliente"
                                          : undefined
                                      }
                                    >
                                      <MessageCircle className="mr-2 h-4 w-4" />
                                      WhatsApp
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEmailDialogForClient(recordClientId)}
                                      disabled={!canUseEmail}
                                      title={
                                        !canUseEmail ? "Cadastre um email para o cliente" : undefined
                                      }
                                    >
                                      <Mail className="mr-2 h-4 w-4" />
                                      Email
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }

                        const isOpen = Boolean(openOverviewGroups[item.key]);
                        const notifiableRecords = item.records.filter(shouldEnableClientNotification);
                        const primaryRecord = notifiableRecords[0];
                        const primaryClientId = primaryRecord?.clientId ?? null;
                        const primaryClientInfo = primaryClientId
                          ? clientsById.get(primaryClientId) ?? null
                          : null;
                        const groupCanNotify = Boolean(primaryRecord);
                        const groupCanUseWhatsApp = Boolean(primaryClientInfo?.phone);
                        const groupCanUseEmail = Boolean(primaryClientInfo?.email);
                        const pendingLabel = item.statusCounts.pending > 0 ? `${item.statusCounts.pending} pendente(s)` : null;
                        const paidLabel = item.statusCounts.paid > 0 ? `${item.statusCounts.paid} pago(s)` : null;
                        const overdueLabel = item.statusCounts.overdue > 0 ? `${item.statusCounts.overdue} em atraso` : null;
                        const cancelledLabel = item.statusCounts.cancelled > 0 ? `${item.statusCounts.cancelled} cancelado(s)` : null;

                        return (
                          <Fragment key={`group-${item.key}`}>
                            <TableRow className="bg-muted/40">
                              <TableCell>
                                <Badge variant={item.typeValue === "income" ? "default" : "destructive"}>
                                  {item.typeValue === "income" ? "Receita" : "Despesa"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenOverviewGroups(prev => ({
                                          ...prev,
                                          [item.key]: !prev[item.key],
                                        }))
                                      }
                                      aria-expanded={isOpen}
                                      className="flex items-center gap-2 text-left font-medium text-foreground transition-colors hover:text-primary"
                                    >
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform ${isOpen ? "-rotate-180" : "rotate-0"}`}
                                      />
                                      <span>{item.description}</span>
                                    </button>
                                    <Badge variant="outline">Parcelado ({item.records.length}x)</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    {pendingLabel && <span>{pendingLabel}</span>}
                                    {paidLabel && <span>{paidLabel}</span>}
                                    {overdueLabel && <span>{overdueLabel}</span>}
                                    {cancelledLabel && <span>{cancelledLabel}</span>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{item.category ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {item.origin === "client" ? "Clientes" : "Operacional"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {formatDateLabel(item.firstDate)} - {formatDateLabel(item.lastDate)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(item.totalAmount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.statusInfo.variant}>{item.statusInfo.label}</Badge>
                              </TableCell>
                              <TableCell className="min-w-[220px]">
                                {groupCanNotify ? (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleNotifyClientByWhatsApp(primaryClientId)}
                                      disabled={!groupCanUseWhatsApp}
                                      title={
                                        !groupCanUseWhatsApp
                                          ? "Cadastre um telefone WhatsApp para o cliente"
                                          : undefined
                                      }
                                    >
                                      <MessageCircle className="mr-2 h-4 w-4" />
                                      WhatsApp
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEmailDialogForClient(primaryClientId)}
                                      disabled={!groupCanUseEmail}
                                      title={
                                        !groupCanUseEmail ? "Cadastre um email para o cliente" : undefined
                                      }
                                    >
                                      <Mail className="mr-2 h-4 w-4" />
                                      Email
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow className="bg-muted/20">
                                <TableCell colSpan={8}>
                                  <div className="space-y-3">
                                    {item.records.map((installment, index) => (
                                      <div
                                        key={`${item.key}-${installment.id}`}
                                        className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                                      >
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                              Parcela {index + 1} de {item.records.length}
                                            </span>
                                            <span
                                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(installment.status)}`}
                                            >
                                              {getStatusLabel(installment.status)}
                                            </span>
                                            {installment.clientName && (
                                              <Badge variant="outline">{installment.clientName}</Badge>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                            <span>Valor: {formatCurrency(installment.amount)}</span>
                                            <span>Data: {formatDateLabel(installment.date)}</span>
                                            {installment.paymentMethod && (
                                              <span>Pagamento: {installment.paymentMethod}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
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
      <ClientFinancialEmailDialog
        client={
          selectedEmailClient
            ? {
                id: selectedEmailClient.id,
                name: selectedEmailClient.name,
                email: selectedEmailClient.email,
              }
            : null
        }
        open={isEmailDialogOpen}
        onOpenChange={handleEmailDialogOpenChange}
      />
    </div>
  );
}
