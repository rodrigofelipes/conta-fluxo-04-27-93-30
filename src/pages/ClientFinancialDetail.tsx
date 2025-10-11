import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DollarSign,
  CreditCard,
  TrendingUp,
  Calendar,
  AlertCircle,
  ArrowLeft,
  ChevronDown
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PaymentLinkGenerator } from "@/components/payments/PaymentLinkGenerator";
import { PaymentLinksTable } from "@/components/payments/PaymentLinksTable";


interface ClientFinancialData {
  client_id: string;
  client_name: string;
  total_receivables: number;
  paid_receivables: number;
  pending_receivables: number;
  overdue_receivables: number;
  total_installments: number;
  pending_installments: number;
  transactions: Array<{
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
    status: string;
    transaction_category: string;
    transaction_type: string;
    recurrence_type?: string | null;
    created_at: string;
    client_id?: string;
  }>;
  installments: Array<{
    id: string;
    installment_number: number;
    total_installments: number;
    amount: number;
    due_date: string;
    status: string;
    payment_date?: string;
    client_id?: string;
  }>;
}

interface PaymentLinkRecord {
  id: string;
  link_token: string;
  description: string;
  amount: number;
  status: 'active' | 'expired' | 'completed' | 'cancelled';
  expires_at: string;
  created_at: string;
  accessed_at: string | null;
  paid_at: string | null;
  checkout_url: string | null;
  stripe_checkout_session_id: string | null;
}

interface PaymentTransactionRecord {
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




export default function ClientFinancialDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const { clients } = useClients();
  const navigate = useNavigate();
  const [clientFinancialData, setClientFinancialData] = useState<ClientFinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTransactionGroups, setOpenTransactionGroups] = useState<Record<string, boolean>>({});
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkRecord[]>([]);
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransactionRecord[]>([]);

  const loadClientFinancialData = async (clientId: string) => {
    setLoading(true);
    try {
      // Buscar transações do cliente
      const { data: transactions, error: transactionsError } = await supabase
        .from('client_financials')
        .select('*')
        .eq('client_id', clientId)
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Buscar parcelas do cliente
      const { data: installments, error: installmentsError } = await supabase
        .from('payment_installments')
        .select('*')
        .eq('client_id', clientId)
        .order('due_date', { ascending: true });

      if (installmentsError) throw installmentsError;

      const { data: linksData, error: linksError } = await supabase
        .from('payment_links')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });



      if (linksError) throw linksError;



      const { data: paymentTransactionsData, error: paymentTransactionsError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });



      if (paymentTransactionsError) throw paymentTransactionsError;


      // Buscar nome do cliente
      const client = clients.find(c => c.id === clientId);
      const clientName = client?.name || 'Cliente não encontrado';

      // Calcular totais
      const receivableTransactions = transactions?.filter(t => t.transaction_category === 'receivable') || [];
      
      const total_receivables = receivableTransactions.reduce((acc, t) => acc + t.amount, 0);
      const paid_receivables = receivableTransactions.filter(t => t.status === 'paid').reduce((acc, t) => acc + t.amount, 0);
      const pending_receivables = receivableTransactions.filter(t => t.status === 'pending').reduce((acc, t) => acc + t.amount, 0);
      const overdue_receivables = receivableTransactions.filter(t => t.status === 'overdue').reduce((acc, t) => acc + t.amount, 0);

      const total_installments = installments?.length || 0;
      const pending_installments = installments?.filter(i => i.status === 'pending').length || 0;

      setClientFinancialData({
        client_id: clientId,
        client_name: clientName,
        total_receivables,
        paid_receivables,
        pending_receivables,
        overdue_receivables,
        total_installments,
        pending_installments,
        transactions: transactions || [],
        installments: installments || []
      });


ymentLinks((linksData ?? []) as PaymentLinkRecord[]);
      setPaymentTransactions((paymentTransactionsData ?? []) as PaymentTransactionRecord[]);



    } catch (error) {
      console.error('Erro ao carregar dados financeiros do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId && clients.length > 0) {
      loadClientFinancialData(clientId);
    }
  }, [clientId, clients]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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

  const activePaymentLinks = useMemo(() => paymentLinks.filter(link => link.status === 'active').length, [paymentLinks]);
  const completedPaymentLinks = useMemo(() => paymentLinks.filter(link => link.status === 'completed').length, [paymentLinks]);
  const totalOnlineReceived = useMemo(
    () => paymentTransactions
      .filter(transaction => transaction.status === 'succeeded')
      .reduce((acc, transaction) => acc + transaction.amount, 0),
    [paymentTransactions]
  );

  const formatPaymentStatus = (status: PaymentTransactionRecord['status']) => {
    switch (status) {
      case 'succeeded':
        return { label: 'Pago', className: 'bg-green-100 text-green-800' };
      case 'processing':
        return { label: 'Processando', className: 'bg-blue-100 text-blue-800' };
      case 'failed':
        return { label: 'Falhou', className: 'bg-red-100 text-red-800' };
      case 'cancelled':
        return { label: 'Cancelado', className: 'bg-gray-200 text-gray-800' };
      default:
        return { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' };
    }
  };

  const receivableTransactions = useMemo(() => {
    if (!clientFinancialData) return [];
    return clientFinancialData.transactions.map(transaction => ({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      status: transaction.status,
      transaction_category: transaction.transaction_category,
      client_id: transaction.client_id ?? clientFinancialData.client_id,
    }));
  }, [clientFinancialData]);

  const pendingInstallments = useMemo(() => {
    if (!clientFinancialData) return [];
    return clientFinancialData.installments.map(installment => ({
      id: installment.id,
      installment_number: installment.installment_number,
      total_installments: installment.total_installments,
      amount: installment.amount,
      status: installment.status,
      due_date: installment.due_date,
      client_id: installment.client_id ?? clientFinancialData.client_id,
    }));
  }, [clientFinancialData]);

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

  type TransactionListItem =
    | { type: 'single'; transaction: ClientFinancialData['transactions'][0] }
    | {
        type: 'group';
        key: string;
        description: string;
        transactions: ClientFinancialData['transactions'];
        totalAmount: number;
        firstDate: string;
        lastDate: string;
        transaction_category: string;
        transaction_type: string;
        statusInfo: { label: string; color: string };
        pendingCount: number;
        paidCount: number;
        overdueCount: number;
      };

  const groupedTransactions = useMemo<TransactionListItem[]>(() => {
    if (!clientFinancialData) return [];

    // Função para normalizar descrição removendo sufixo de parcela
    const normalizeDescription = (desc: string) => {
      return desc.replace(/\s*-\s*Parcela\s+\d+\/\d+\s*$/i, '').trim();
    };

    const groups = new Map<string, ClientFinancialData['transactions']>();

    clientFinancialData.transactions.forEach(transaction => {
      if (transaction.recurrence_type === 'monthly') {
        const normalizedDesc = normalizeDescription(transaction.description);
        const key = `${normalizedDesc}|${transaction.created_at}`;
        const existing = groups.get(key) ?? [];
        existing.push(transaction);
        groups.set(key, existing);
      }
    });

    const items: TransactionListItem[] = [];
    const seenGroups = new Set<string>();

    clientFinancialData.transactions.forEach(transaction => {
      if (transaction.recurrence_type === 'monthly') {
        const normalizedDesc = normalizeDescription(transaction.description);
        const key = `${normalizedDesc}|${transaction.created_at}`;
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
          description: normalizedDesc,
          transactions: sortedItems,
          totalAmount,
          firstDate: sortedItems[0]?.transaction_date ?? transaction.transaction_date,
          lastDate: sortedItems[sortedItems.length - 1]?.transaction_date ?? transaction.transaction_date,
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
  }, [clientFinancialData]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando dados financeiros...</div>
      </div>
    );
  }

  if (!clientFinancialData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Cliente não encontrado</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/financeiro', { state: { activeTab: 'clients' } })}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Dados Financeiros</h1>
          <p className="text-muted-foreground">{clientFinancialData.client_name}</p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total a Receber</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(clientFinancialData.total_receivables)}
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
                <p className="text-sm text-muted-foreground">Já Recebido</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(clientFinancialData.paid_receivables)}
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
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(clientFinancialData.pending_receivables)}
                </p>
              </div>
              <Calendar className="size-8 text-yellow-600 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Atraso</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(clientFinancialData.overdue_receivables)}
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
              Gere novos links de pagamento e acompanhe a confirmação automática dos recebimentos.
            </p>
          </div>
          <PaymentLinkGenerator
            clientId={clientFinancialData.client_id}
            clientName={clientFinancialData.client_name}
            receivables={receivableTransactions}
            installments={pendingInstallments}
            onCreated={() => clientId && loadClientFinancialData(clientId)}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Links Ativos</p>
              <p className="text-2xl font-semibold">{activePaymentLinks}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Pagamentos Confirmados</p>
              <p className="text-2xl font-semibold text-green-600">{completedPaymentLinks}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase text-muted-foreground">Recebido Online</p>
              <p className="text-2xl font-semibold text-green-600">{formatCurrency(totalOnlineReceived)}</p>
            </div>
          </div>

          <PaymentLinksTable
            data={paymentLinks}
            onStatusUpdated={() => clientId && loadClientFinancialData(clientId)}
          />
        </CardContent>
      </Card>

      {paymentTransactions.length > 0 && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Histórico de Pagamentos Online</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentTransactions.map(transaction => {
                  const statusInfo = formatPaymentStatus(transaction.status);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>{format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="font-semibold text-green-600">{formatCurrency(transaction.amount)}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>{transaction.payment_method ?? '—'}</TableCell>
                      <TableCell>
                        {transaction.stripe_payment_id ? (
                          <span className="text-xs text-muted-foreground">{transaction.stripe_payment_id}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Área de Transações e Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Histórico Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transactions">
                Transações ({clientFinancialData.transactions.length})
              </TabsTrigger>
              <TabsTrigger value="installments">
                Parcelas ({clientFinancialData.installments.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="transactions" className="mt-6">
              {groupedTransactions.length > 0 ? (
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
                            </div>
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
                  <div className="font-medium mb-2">Nenhuma transação encontrada</div>
                  <div className="text-sm">Este cliente ainda não possui transações registradas</div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="installments" className="mt-6">
              {clientFinancialData.installments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientFinancialData.installments.map((installment) => (
                      <TableRow key={installment.id}>
                        <TableCell className="font-medium">
                          {installment.installment_number}/{installment.total_installments}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(installment.amount)}
                        </TableCell>
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
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <div className="font-medium mb-2">Nenhuma parcela encontrada</div>
                  <div className="text-sm">Este cliente não possui parcelas em aberto</div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}