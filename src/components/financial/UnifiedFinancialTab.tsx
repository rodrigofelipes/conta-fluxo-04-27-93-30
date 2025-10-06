import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  AlertCircle,
  Plus,
  CreditCard,
  Filter,
  ChevronDown
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const installmentFormSchema = z.object({
  client_id: z.string().min(1, "Selecione um cliente"),
  amount: z.string().min(1, "Valor é obrigatório"),
  total_installments: z.string().min(1, "Número de parcelas é obrigatório"),
  first_due_date: z.string().min(1, "Data de vencimento é obrigatória"),
  description: z.string().min(2, "Descrição é obrigatória"),
});

interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  status: string;
  client?: string;
  transaction_category: string;
  transaction_type: string;
  recurrence_type?: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
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

interface UnifiedFinancialTabProps {
  transactions: FinancialTransaction[];
  clients: Client[];
  installments: Installment[];
  onInstallmentCreated: () => void;
}

type ViewFilter = 'receivables' | 'payables' | 'installments' | 'all';

export function UnifiedFinancialTab({ 
  transactions, 
  clients, 
  installments, 
  onInstallmentCreated 
}: UnifiedFinancialTabProps) {
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [isInstallmentDialogOpen, setIsInstallmentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openTransactionGroups, setOpenTransactionGroups] = useState<Record<string, boolean>>({});

  const installmentForm = useForm<z.infer<typeof installmentFormSchema>>({
    resolver: zodResolver(installmentFormSchema),
    defaultValues: {
      client_id: "",
      amount: "",
      total_installments: "",
      first_due_date: "",
      description: "",
    },
  });

  // Filter transactions based on type
  const receivables = transactions.filter(t => t.transaction_category === 'receivable');
  const payables = transactions.filter(t => 
    ['payable', 'fixed_expense', 'variable_expense'].includes(t.transaction_category)
  );

  // Calculate totals for receivables
  const totalReceivables = receivables
    .filter(t => t.status === 'pending')
    .reduce((acc, t) => acc + t.amount, 0);
  const paidReceivables = receivables
    .filter(t => t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);
  const overdueReceivables = receivables
    .filter(t => t.status === 'overdue')
    .reduce((acc, t) => acc + t.amount, 0);

  // Calculate totals for payables
  const totalPayables = payables
    .filter(t => t.status === 'pending')
    .reduce((acc, t) => acc + t.amount, 0);
  const paidPayables = payables
    .filter(t => t.status === 'paid')
    .reduce((acc, t) => acc + t.amount, 0);
  const overduePayables = payables
    .filter(t => t.status === 'overdue')
    .reduce((acc, t) => acc + t.amount, 0);

  const onInstallmentSubmit = async (values: z.infer<typeof installmentFormSchema>) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado.",
          variant: "destructive"
        });
        return;
      }

      const totalAmount = parseFloat(values.amount.replace(/[^\d,]/g, '').replace(',', '.'));
      const installmentCount = parseInt(values.total_installments);
      const installmentAmount = totalAmount / installmentCount;

      // Criar todas as parcelas
      const installmentsToCreate = [];
      for (let i = 1; i <= installmentCount; i++) {
        const dueDate = new Date(values.first_due_date);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));

        installmentsToCreate.push({
          client_id: values.client_id,
          installment_number: i,
          total_installments: installmentCount,
          amount: installmentAmount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending',
          created_by: userData.user.id
        });
      }

      const { error } = await supabase
        .from('payment_installments')
        .insert(installmentsToCreate);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `${installmentCount} parcelas criadas com sucesso.`,
      });

      setIsInstallmentDialogOpen(false);
      installmentForm.reset();
      onInstallmentCreated();
    } catch (error) {
      console.error('Erro ao criar parcelas:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar parcelas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Pago/Recebido';
      case 'pending': return 'Pendente';
      case 'overdue': return 'Atrasado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'receivable': return 'A Receber';
      case 'payable': return 'A Pagar';
      case 'fixed_expense': return 'Despesa Fixa';
      case 'variable_expense': return 'Despesa Variável';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'receivable': return 'bg-green-100 text-green-800';
      case 'payable': return 'bg-blue-100 text-blue-800';
      case 'fixed_expense': return 'bg-purple-100 text-purple-800';
      case 'variable_expense': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  type TransactionListItem =
    | { type: 'single'; transaction: FinancialTransaction }
    | {
        type: 'group';
        key: string;
        description: string;
        transactions: FinancialTransaction[];
        totalAmount: number;
        firstDate: string;
        lastDate: string;
        client?: string;
        transaction_category: string;
        transaction_type: string;
        statusInfo: { label: string; color: string };
        pendingCount: number;
        paidCount: number;
        overdueCount: number;
      };

  const groupTransactions = (transactionList: FinancialTransaction[]): TransactionListItem[] => {
    const groups = new Map<string, FinancialTransaction[]>();

    transactionList.forEach(transaction => {
      if (transaction.recurrence_type === 'monthly') {
        const key = `${transaction.description}|${transaction.created_at}`;
        const existing = groups.get(key) ?? [];
        existing.push(transaction);
        groups.set(key, existing);
      }
    });

    const items: TransactionListItem[] = [];
    const seenGroups = new Set<string>();

    transactionList.forEach(transaction => {
      if (transaction.recurrence_type === 'monthly') {
        const key = `${transaction.description}|${transaction.created_at}`;
        if (seenGroups.has(key)) {
          return;
        }
        seenGroups.add(key);

        const groupItems = groups.get(key) ?? [transaction];
        const sortedItems = [...groupItems].sort(
          (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        );
        const totalAmount = sortedItems.reduce((sum, item) => sum + item.amount, 0);

        const hasPending = sortedItems.some(item => item.status === 'pending');
        const hasPaid = sortedItems.some(item => item.status === 'paid');
        const hasOverdue = sortedItems.some(item => item.status === 'overdue');

        let statusLabel = 'Parcelado';
        let statusColor = getStatusColor('pending');
        if (hasPending && !hasPaid && !hasOverdue) {
          statusLabel = 'Pendente';
          statusColor = getStatusColor('pending');
        } else if (!hasPending && hasPaid && !hasOverdue) {
          statusLabel = 'Pago/Recebido';
          statusColor = getStatusColor('paid');
        } else if (hasPending && hasPaid) {
          statusLabel = 'Em andamento';
        } else if (hasOverdue) {
          statusLabel = 'Em Atraso';
          statusColor = getStatusColor('overdue');
        }

        items.push({
          type: 'group',
          key,
          description: transaction.description,
          transactions: sortedItems,
          totalAmount,
          firstDate: sortedItems[0]?.transaction_date ?? transaction.transaction_date,
          lastDate: sortedItems[sortedItems.length - 1]?.transaction_date ?? transaction.transaction_date,
          client: transaction.client,
          transaction_category: transaction.transaction_category,
          transaction_type: transaction.transaction_type,
          statusInfo: { label: statusLabel, color: statusColor },
          pendingCount: sortedItems.filter(item => item.status === 'pending').length,
          paidCount: sortedItems.filter(item => item.status === 'paid').length,
          overdueCount: sortedItems.filter(item => item.status === 'overdue').length,
        });
      } else {
        items.push({ type: 'single', transaction });
      }
    });

    return items;
  };

  const getFilteredData = () => {
    switch (viewFilter) {
      case 'receivables':
        return { transactions: receivables, title: 'Contas a Receber' };
      case 'payables':
        return { transactions: payables, title: 'Contas a Pagar' };
      case 'installments':
        return { transactions: [], title: 'Parcelas', showInstallments: true };
      default:
        return { transactions: [...receivables, ...payables], title: 'Todas as Contas' };
    }
  };

  const filteredData = getFilteredData();
  const groupedTransactions = groupTransactions(filteredData.transactions);

  const renderSummaryCards = () => {
    if (viewFilter === 'receivables' || viewFilter === 'all') {
      return (
        <>
          <Card className="card-elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">A Receber</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalReceivables)}
                  </p>
                </div>
                <TrendingUp className="size-8 text-green-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
          {viewFilter === 'all' && (
            <Card className="card-elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">A Pagar</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(totalPayables)}
                    </p>
                  </div>
                  <TrendingDown className="size-8 text-red-600 opacity-80" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      );
    }

    if (viewFilter === 'payables') {
      return (
        <>
          <Card className="card-elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">A Pagar</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(totalPayables)}
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
                  <p className="text-sm text-muted-foreground">Já Pago</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(paidPayables)}
                  </p>
                </div>
                <DollarSign className="size-8 text-green-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Atraso</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(overduePayables)}
                  </p>
                </div>
                <AlertCircle className="size-8 text-red-600 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Visualizar:</span>
          </div>
          <Select value={viewFilter} onValueChange={(value: ViewFilter) => setViewFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Contas</SelectItem>
              <SelectItem value="receivables">A Receber</SelectItem>
              <SelectItem value="payables">A Pagar</SelectItem>
              <SelectItem value="installments">Parcelas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {viewFilter === 'installments' && (
          <Dialog open={isInstallmentDialogOpen} onOpenChange={setIsInstallmentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-hero">
                <Plus className="w-4 h-4 mr-2" />
                Nova Cobrança Parcelada
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Cobrança Parcelada</DialogTitle>
              </DialogHeader>
              <Form {...installmentForm}>
                <form onSubmit={installmentForm.handleSubmit(onInstallmentSubmit)} className="space-y-4">
                  <FormField
                    control={installmentForm.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
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
                    control={installmentForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Projeto Casa de Campo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={installmentForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor Total</FormLabel>
                          <FormControl>
                            <Input placeholder="R$ 0,00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={installmentForm.control}
                      name="total_installments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nº Parcelas</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="6" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={installmentForm.control}
                    name="first_due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primeiro Vencimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsInstallmentDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 btn-hero-static" disabled={loading}>
                      {loading ? "Criando..." : "Criar Parcelas"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderSummaryCards()}
      </div>

      {/* Tabela principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {viewFilter === 'installments' ? (
              <CreditCard className="w-5 h-5" />
            ) : (
              <DollarSign className="w-5 h-5" />
            )}
            {filteredData.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.showInstallments ? (
            // Tabela de parcelas
            installments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((installment) => (
                    <TableRow key={installment.id}>
                      <TableCell className="font-medium">
                        {installment.client_name || 'Cliente não encontrado'}
                      </TableCell>
                      <TableCell>
                        {installment.installment_number}/{installment.total_installments}
                      </TableCell>
                      <TableCell>{formatCurrency(installment.amount)}</TableCell>
                      <TableCell>
                        {format(new Date(installment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(installment.status)}>
                          {getStatusLabel(installment.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div className="font-medium mb-2">Nenhuma parcela em aberto</div>
                <div className="text-sm">Clique em "Nova Cobrança Parcelada" para começar</div>
              </div>
            )
           ) : (
            // Tabela/Lista de transações
            groupedTransactions.length > 0 ? (
              <div className="space-y-4">
                {groupedTransactions.map((item) => {
                  if (item.type === 'single') {
                    const transaction = item.transaction;
                    return (
                      <div key={`single-${transaction.id}`} className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h4 className="font-medium">{transaction.description}</h4>
                            <Badge className={getStatusColor(transaction.status)}>
                              {getStatusLabel(transaction.status)}
                            </Badge>
                            <Badge className={getCategoryColor(transaction.transaction_category)}>
                              {getCategoryLabel(transaction.transaction_category)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className={transaction.transaction_type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {formatCurrency(transaction.amount)}
                            </span>
                            <span>{format(new Date(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            {transaction.client && <span>{transaction.client}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {transaction.status === 'pending' && (
                            <Button size="sm" variant="outline">
                              {transaction.transaction_type === 'income' ? 'Marcar Recebido' : 'Marcar Pago'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const isOpen = Boolean(openTransactionGroups[item.key]);

                  return (
                    <Collapsible
                      key={`group-${item.key}`}
                      open={isOpen}
                      onOpenChange={open =>
                        setOpenTransactionGroups(prev => ({
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
                                <Badge variant="outline">Parcelado ({item.transactions.length}x)</Badge>
                                <Badge className={item.statusInfo.color}>{item.statusInfo.label}</Badge>
                                <Badge className={getCategoryColor(item.transaction_category)}>
                                  {getCategoryLabel(item.transaction_category)}
                                </Badge>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? '-rotate-180' : 'rotate-0'}`}
                              />
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span className={item.transaction_type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                Total: {formatCurrency(item.totalAmount)}
                              </span>
                              <span>
                                {format(new Date(item.firstDate), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(item.lastDate), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              {item.pendingCount > 0 && <span>{item.pendingCount} pendente(s)</span>}
                              {item.paidCount > 0 && <span>{item.paidCount} pago(s)</span>}
                              {item.overdueCount > 0 && <span>{item.overdueCount} em atraso</span>}
                              {item.client && <span>{item.client}</span>}
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 border-t p-4">
                          {item.transactions.map((transaction, index) => (
                            <div
                              key={`${item.key}-${transaction.id}`}
                              className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">
                                    Parcela {index + 1} de {item.transactions.length}
                                  </p>
                                  <Badge className={getStatusColor(transaction.status)}>
                                    {getStatusLabel(transaction.status)}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                  <span className={transaction.transaction_type === 'income' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                    {formatCurrency(transaction.amount)}
                                  </span>
                                  <span>{format(new Date(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {transaction.status === 'pending' && (
                                  <Button size="sm" variant="outline">
                                    {transaction.transaction_type === 'income' ? 'Marcar Recebido' : 'Marcar Pago'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div className="font-medium mb-2">
                  {viewFilter === 'receivables' ? 'Nenhuma conta a receber' : 
                   viewFilter === 'payables' ? 'Nenhuma conta a pagar' : 
                   'Nenhuma transação encontrada'}
                </div>
                <div className="text-sm">Crie uma nova transação para começar</div>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}