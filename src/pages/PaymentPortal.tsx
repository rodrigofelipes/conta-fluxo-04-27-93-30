import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentPortalLink {
  id: string;
  client_id: string;
  description: string;
  amount: number;
  status: 'active' | 'expired' | 'completed' | 'cancelled';
  expires_at: string;
  accessed_at: string | null;
  paid_at: string | null;
  checkout_url: string | null;
  link_token: string;
}

export default function PaymentPortal() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<PaymentPortalLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const statusMeta = useMemo(() => {
    switch (link?.status) {
      case 'completed':
        return { label: 'Pago', icon: CheckCircle2, className: 'bg-green-100 text-green-800' };
      case 'expired':
        return { label: 'Expirado', icon: AlertCircle, className: 'bg-gray-200 text-gray-700' };
      case 'cancelled':
        return { label: 'Cancelado', icon: AlertCircle, className: 'bg-red-100 text-red-800' };
      default:
        return { label: 'Aguardando pagamento', icon: Clock, className: 'bg-blue-100 text-blue-800' };
    }
  }, [link?.status]);

  const fetchLinkStatus = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke('verify-payment-status', {
        body: { token, includeStripe: true },
      });
      if (error) throw error;
      if (!data?.link) {
        setError('Link de pagamento não encontrado ou expirado.');
        setLink(null);
        return;
      }
      setLink(data.link as PaymentPortalLink);
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      console.error('Erro ao carregar link de pagamento', err);
      setError(err?.message ?? 'Não foi possível carregar as informações do pagamento.');
      setLink(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLinkStatus();
  }, [fetchLinkStatus]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'success') {
      toast({
        title: 'Pagamento recebido!',
        description: 'Obrigado. Estamos confirmando os detalhes do pagamento.',
      });
    }
    if (statusParam === 'cancelled') {
      toast({
        title: 'Pagamento cancelado',
        description: 'Você pode tentar novamente clicando no botão abaixo.',
        variant: 'destructive',
      });
    }
  }, [searchParams]);

  const handleCheckout = () => {
    if (!link?.checkout_url) {
      toast({
        title: 'Checkout indisponível',
        description: 'Não foi possível encontrar a URL de pagamento. Solicite um novo link ao escritório.',
        variant: 'destructive',
      });
      return;
    }
    window.location.href = link.checkout_url;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="min-h-screen bg-muted/40 py-16 px-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <Badge className="mx-auto w-fit" variant="secondary">
              Fluxo Financeiro Integrado
            </Badge>
            <CardTitle className="text-2xl font-semibold">
              {link?.status === 'completed' ? 'Pagamento confirmado' : 'Resumo do pagamento'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading && (
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Verificando informações do pagamento...
              </div>
            )}

            {!loading && error && (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível acessar o link</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!loading && link && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                  <p className="text-xl font-semibold text-foreground">
                    {formatCurrency(link.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Válido até {format(new Date(link.expires_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {link.paid_at && (
                    <p className="text-xs text-green-700">
                      Pagamento confirmado em {format(new Date(link.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                  <p>Este link é seguro e processado pela Stripe. O escritório será notificado automaticamente quando o pagamento for concluído.</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {lastUpdated && `Última verificação: ${format(new Date(lastUpdated), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={fetchLinkStatus} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar status'
                )}
              </Button>
              {link?.status === 'active' && (
                <Button onClick={handleCheckout} className="btn-hero-static">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Pagar agora
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
