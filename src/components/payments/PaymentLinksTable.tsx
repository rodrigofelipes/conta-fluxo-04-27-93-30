import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, RefreshCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentLinkRow {
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

interface PaymentLinksTableProps {
  data: PaymentLinkRow[];
  onStatusUpdated?: () => void;
  limit?: number;
}

const statusConfig: Record<PaymentLinkRow['status'], { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-blue-100 text-blue-800' },
  expired: { label: 'Expirado', className: 'bg-gray-200 text-gray-800' },
  completed: { label: 'Pago', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

export function PaymentLinksTable({ data, onStatusUpdated, limit }: PaymentLinksTableProps) {
  const rows = useMemo(() => (limit ? data.slice(0, limit) : data), [data, limit]);

  const copyLink = async (token: string) => {
    const publicUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${publicUrl}/pay/${token}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
    toast({ title: 'Link copiado', description: 'O link foi copiado para a área de transferência.' });
  };

  const refreshStatus = async (token: string) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('verify-payment-status', {
        body: { token },
      });
      if (error) throw error;
      if (result?.link) {
        toast({ title: 'Status atualizado', description: `Novo status: ${result.link.status}` });
      }
      onStatusUpdated?.();
    } catch (err: any) {
      console.error('Erro ao atualizar status do pagamento', err);
      toast({
        title: 'Não foi possível atualizar',
        description: err?.message ?? 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum link de pagamento encontrado.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden md:table-cell">Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Expira em</TableHead>
            <TableHead className="hidden lg:table-cell">Último acesso</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(link => {
            const status = statusConfig[link.status];
            const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(link.amount ?? 0);
            const expiresAt = format(new Date(link.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
            const accessedAt = link.accessed_at ? format(new Date(link.accessed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—';

            return (
              <TableRow key={link.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{link.description}</span>
                    <span className="text-xs text-muted-foreground">Criado em {format(new Date(link.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{formattedAmount}</TableCell>
                <TableCell>
                  <Badge className={status.className}>{status.label}</Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{expiresAt}</TableCell>
                <TableCell className="hidden lg:table-cell">{link.paid_at ? format(new Date(link.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : accessedAt}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => copyLink(link.link_token)} title="Copiar link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refreshStatus(link.link_token)}
                      title="Atualizar status"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </Button>
                    {link.checkout_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(link.checkout_url ?? '#', '_blank', 'noopener')}
                        title="Abrir checkout"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
