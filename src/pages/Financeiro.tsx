import { useState, useEffect } from "react";
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
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(new Date());

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

      // Carregar transações financeiras
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('client_financials')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Carregar clientes
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (clientsError) throw clientsError;

      // Carregar contas bancárias
      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name');

      if (bankAccountsError) throw bankAccountsError;

      // Carregar parcelas
      const { data: installmentsData, error: installmentsError } = await supabase
        .from('payment_installments')
        .select('*')
        .order('due_date', { ascending: true });

      if (installmentsError) throw installmentsError;

      // Buscar nomes dos clientes para as transações
      const clientMap = new Map();
      clientsData?.forEach(client => clientMap.set(client.id, client.name));

      // Processar dados das transações
      const processedTransactions = transactionsData?.map(t => ({
        ...t,
        client: clientMap.get(t.client_id) || undefined,
        transaction_type: t.transaction_type as "income" | "expense",
        transaction_category: t.transaction_category as "receivable" | "payable" | "project" | "fixed_expense" | "variable_expense",
        status: t.status as "pending" | "paid" | "overdue",
        recurrence_type: (t.recurrence_type || "none") as "none" | "monthly" | "quarterly" | "yearly"
      })) || [];

      // Processar dados das parcelas
      const processedInstallments = installmentsData?.map(i => ({
        ...i,
        client_name: clientMap.get(i.client_id) || 'Cliente não encontrado',
        status: i.status as 'pending' | 'paid' | 'overdue' | 'cancelled'
      })) || [];

      setTransactions(processedTransactions);
      setClients(clientsData || []);
      setBankAccounts(bankAccountsData || []);
      setInstallments(processedInstallments);

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

  useEffect(() => {
    loadData();
  }, []);

  const handleInstallmentCreated = () => {
    loadData(); // Recarregar dados quando uma nova parcela for criada
  };

  const onSubmit = async (values: z.infer<typeof transactionFormSchema>) => {
    try {
      const { data, error } = await supabase
        .from('client_financials')
        .insert([{
          transaction_type: values.transaction_type,
          description: values.description,
          amount: parseFloat(values.amount.replace(/[^\d,]/g, '').replace(',', '.')),
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
      loadData(); // Recarregar dados
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar transação.",
        variant: "destructive",
      });
    }
  };

  // Cálculos financeiros
  const totalReceitas = transactions
    .filter(t => t.transaction_type === "income" && t.status === "paid")
    .reduce((acc, t) => acc + t.amount, 0);

  const totalDespesas = transactions
    .filter(t => t.transaction_type === "expense" && t.status === "paid")
    .reduce((acc, t) => acc + t.amount, 0);

  const receitasPendentes = transactions
    .filter(t => t.transaction_type === "income" && t.status === "pending")
    .reduce((acc, t) => acc + t.amount, 0);

  const despesasPendentes = transactions
    .filter(t => t.transaction_type === "expense" && t.status === "pending")
    .reduce((acc, t) => acc + t.amount, 0);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
          <TabsTrigger value="horas">Relatório de Horas</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
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

        {/* Unified Financial Tab */}
        <TabsContent value="unified">
          <UnifiedFinancialTab 
            transactions={transactions}
            clients={clients}
            installments={installments}
            onInstallmentCreated={handleInstallmentCreated}
          />
        </TabsContent>

        {/* Client Financial Tab */}
        <TabsContent value="clients">
          <ClientFinancialTab />
        </TabsContent>

        <TabsContent value="horas" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Relatório de Horas por Colaborador</h3>
            <div className="flex gap-2">
              <Select value={format(selectedMonth, "yyyy-MM")}>
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
          </div>

          <Card>
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
          </Card>
        </TabsContent>

        {/* Contas a Pagar/Receber */}
        <TabsContent value="contas" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Gestão de Contas</h3>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Transação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Transação</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="transaction_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="income">Receita</SelectItem>
                              <SelectItem value="expense">Despesa</SelectItem>
                            </SelectContent>
                          </Select>
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
                            <Input placeholder="Ex: Projeto residencial..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor</FormLabel>
                          <FormControl>
                            <Input placeholder="R$ 0,00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="transaction_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma categoria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="receivable">Recebível</SelectItem>
                              <SelectItem value="payable">Pagável</SelectItem>
                              <SelectItem value="project">Projeto</SelectItem>
                              <SelectItem value="fixed_expense">Despesa Fixa</SelectItem>
                              <SelectItem value="variable_expense">Despesa Variável</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente (Opcional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients.map(client => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="transaction_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data da Transação</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                        Cancelar
                      </Button>
                      <Button type="submit" className="flex-1 btn-hero-static">
                        Salvar
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>
                      <Badge variant={transaction.transaction_type === "income" ? "default" : "secondary"}>
                        {transaction.transaction_type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {transaction.transaction_category}
                    </TableCell>
                    <TableCell className={transaction.transaction_type === "income" ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status === "paid" ? "Pago" : transaction.status === "pending" ? "Pendente" : "Atrasado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Outras tabs continuam... */}
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

        <TabsContent value="relatorios">
          <Card>
            <CardContent className="py-8 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Relatórios Detalhados</h3>
              <p className="text-muted-foreground">
                Relatórios mensais e anuais em desenvolvimento
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}