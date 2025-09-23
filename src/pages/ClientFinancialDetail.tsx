import { useState, useEffect } from "react";
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
  ArrowLeft
} from "lucide-react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
  }>;
  installments: Array<{
    id: string;
    installment_number: number;
    total_installments: number;
    amount: number;
    due_date: string;
    status: string;
    payment_date?: string;
  }>;
}

export default function ClientFinancialDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const { clients } = useClients();
  const navigate = useNavigate();
  const [clientFinancialData, setClientFinancialData] = useState<ClientFinancialData | null>(null);
  const [loading, setLoading] = useState(true);

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
          onClick={() => navigate('/financeiro', { state: { activeTab: 'clientes' } })}
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
              {clientFinancialData.transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientFinancialData.transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {transaction.description}
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(transaction.transaction_category)}>
                            {getCategoryLabel(transaction.transaction_category)}
                          </Badge>
                        </TableCell>
                        <TableCell className={`font-semibold ${
                          transaction.transaction_type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(transaction.status)}>
                            {getStatusLabel(transaction.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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