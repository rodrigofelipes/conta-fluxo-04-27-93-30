import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClientData } from "@/hooks/useClientData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { LogOut, User, DollarSign, FileText, CreditCard, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PaymentLinkRow } from "@/components/payments/PaymentLinksTable";

interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  status: string;
  transaction_date: string;
  payment_date: string | null;
  transaction_type: string;
}

interface PaymentInstallment {
  id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  installment_number: number;
  total_installments: number;
}

export default function ClientPortal() {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkRow[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clientData, loading: loadingClient } = useClientData(user?.id);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/portal-cliente/login");
        return;
      }

      setUser(user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/portal-cliente/login");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!clientData?.id) return;

      try {
        // Buscar transações financeiras
        const { data: transData, error: transError } = await supabase
          .from('client_financials')
          .select('*')
          .eq('client_id', clientData.id)
          .order('transaction_date', { ascending: false });

        if (transError) throw transError;
        setTransactions(transData || []);

        // Buscar parcelas
        const { data: instData, error: instError } = await supabase
          .from('payment_installments')
          .select('*')
          .eq('client_id', clientData.id)
          .order('due_date', { ascending: true });

        if (instError) throw instError;
        setInstallments(instData || []);

        // Buscar links de pagamento
        const { data: linksData, error: linksError } = await supabase
          .from('payment_links')
          .select('*')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false });

        if (linksError) throw linksError;
        setPaymentLinks((linksData || []) as PaymentLinkRow[]);
      } catch (error) {
        console.error('Erro ao carregar dados financeiros:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar seus dados financeiros.",
        });
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchFinancialData();
  }, [clientData, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/portal-cliente/login");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const totalPendente = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalPago = transactions
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const parcelasPendentes = installments.filter(i => i.status === 'pending').length;

  if (loadingClient) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Acesso negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar o portal do cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLogout}>Fazer logout</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Portal do Cliente</h1>
            <p className="text-sm text-muted-foreground">Bem-vindo, {clientData.name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalPendente)}</div>
              <p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPago)}</div>
              <p className="text-xs text-muted-foreground mt-1">Pagamentos realizados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Parcelas Pendentes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{parcelasPendentes}</div>
              <p className="text-xs text-muted-foreground mt-1">Parcelas a vencer</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="financeiro" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="financeiro">
              <FileText className="h-4 w-4 mr-2" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="parcelas">
              <Calendar className="h-4 w-4 mr-2" />
              Parcelas
            </TabsTrigger>
            <TabsTrigger value="pagamentos">
              <CreditCard className="h-4 w-4 mr-2" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="dados">
              <User className="h-4 w-4 mr-2" />
              Meus Dados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financeiro" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transações Financeiras</CardTitle>
                <CardDescription>Histórico completo de suas transações</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransactions ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma transação encontrada
                  </p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(transaction.transaction_date)}
                            {transaction.payment_date && ` • Pago em ${formatDate(transaction.payment_date)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(Number(transaction.amount))}</p>
                          <p className={`text-sm ${
                            transaction.status === 'paid' 
                              ? 'text-green-600' 
                              : transaction.status === 'pending'
                              ? 'text-orange-600'
                              : 'text-red-600'
                          }`}>
                            {transaction.status === 'paid' ? 'Pago' : 
                             transaction.status === 'pending' ? 'Pendente' : 'Vencido'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parcelas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Parcelas</CardTitle>
                <CardDescription>Suas parcelas e vencimentos</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransactions ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : installments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma parcela encontrada
                  </p>
                ) : (
                  <div className="space-y-3">
                    {installments.map((installment) => (
                      <div
                        key={installment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            Parcela {installment.installment_number}/{installment.total_installments}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Vencimento: {formatDate(installment.due_date)}
                            {installment.payment_date && ` • Pago em ${formatDate(installment.payment_date)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(Number(installment.amount))}</p>
                          <p className={`text-sm ${
                            installment.status === 'paid' 
                              ? 'text-green-600' 
                              : 'text-orange-600'
                          }`}>
                            {installment.status === 'paid' ? 'Pago' : 'Pendente'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Links de Pagamento</CardTitle>
                <CardDescription>Links de pagamento online disponíveis</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTransactions ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : paymentLinks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum link de pagamento encontrado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {paymentLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{link.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Expira em: {formatDate(link.expires_at)}
                            {link.paid_at && ` • Pago em ${formatDate(link.paid_at)}`}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            <p className="font-bold">{formatCurrency(Number(link.amount))}</p>
                            <p className={`text-sm ${
                              link.status === 'completed' 
                                ? 'text-green-600' 
                                : link.status === 'expired'
                                ? 'text-gray-600'
                                : 'text-blue-600'
                            }`}>
                              {link.status === 'completed' ? 'Pago' : 
                               link.status === 'expired' ? 'Expirado' : 
                               link.status === 'pending' ? 'Aguardando' : 'Ativo'}
                            </p>
                          </div>
                          {link.checkout_url && link.status !== 'completed' && link.status !== 'expired' && (
                            <Button
                              size="sm"
                              onClick={() => window.open(link.checkout_url!, '_blank')}
                            >
                              Pagar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dados" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dados Cadastrais</CardTitle>
                <CardDescription>Suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Nome</Label>
                    <p className="font-medium">{clientData.name}</p>
                  </div>
                  {clientData.email && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Email</Label>
                      <p className="font-medium">{clientData.email}</p>
                    </div>
                  )}
                  {clientData.phone && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Telefone</Label>
                      <p className="font-medium">{clientData.phone}</p>
                    </div>
                  )}
                  {clientData.cpf && (
                    <div>
                      <Label className="text-sm text-muted-foreground">CPF</Label>
                      <p className="font-medium">{clientData.cpf}</p>
                    </div>
                  )}
                  {clientData.birth_date && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Data de Nascimento</Label>
                      <p className="font-medium">{formatDate(clientData.birth_date)}</p>
                    </div>
                  )}
                  {clientData.residential_address && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Endereço Residencial</Label>
                      <p className="font-medium">{clientData.residential_address}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
