import { useCallback, useEffect, useMemo, useState, FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Send, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

interface ClientSummary {
  id: string;
  name: string;
  email?: string | null;
}

interface ClientFinancialRecord {
  id: string;
  description: string | null;
  amount: number | null;
  transaction_date: string | null;
  status: string | null;
  transaction_type: string | null;
}

type EmailSections = {
  includeSummary: boolean;
  includePending: boolean;
  includeRecent: boolean;
};

interface ClientFinancialEmailDialogProps {
  client: ClientSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientFinancialEmailDialog({
  client,
  open,
  onOpenChange,
}: ClientFinancialEmailDialogProps) {
  const [financials, setFinancials] = useState<ClientFinancialRecord[]>([]);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: "",
    cc: "",
    subject: "",
    message: "",
    includeSummary: true,
    includePending: true,
    includeRecent: true,
  });

  const formatMoney = useCallback((value: number | null | undefined) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  }, []);

  const formatDateToBR = useCallback((value?: string | null) => {
    if (!value) return "Sem data";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Sem data";
    return parsed.toLocaleDateString("pt-BR");
  }, []);

  const totalIncome = useMemo(
    () =>
      financials
        .filter((item) =>
          ["income", "payment_received"].includes(item.transaction_type || "")
        )
        .reduce((acc, item) => acc + (item.amount || 0), 0),
    [financials]
  );

  const totalExpenses = useMemo(
    () =>
      financials
        .filter((item) =>
          ["expense", "payment_sent"].includes(item.transaction_type || "")
        )
        .reduce((acc, item) => acc + (item.amount || 0), 0),
    [financials]
  );

  const netBalance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

  const pendingTransactions = useMemo(
    () =>
      financials.filter((item) =>
        ["pending", "overdue"].includes((item.status || "").toLowerCase())
      ),
    [financials]
  );

  const totalPendingAmount = useMemo(
    () => pendingTransactions.reduce((acc, item) => acc + (item.amount || 0), 0),
    [pendingTransactions]
  );

  const upcomingPendings = useMemo(() => {
    const withDate = pendingTransactions.filter((item) => item.transaction_date);
    const sorted = [...withDate].sort(
      (a, b) =>
        new Date(a.transaction_date || "").getTime() -
        new Date(b.transaction_date || "").getTime()
    );
    return sorted.slice(0, 3);
  }, [pendingTransactions]);

  const recentTransactions = useMemo(() => {
    const sorted = [...financials].sort(
      (a, b) =>
        new Date(b.transaction_date || "").getTime() -
        new Date(a.transaction_date || "").getTime()
    );
    return sorted.slice(0, 5);
  }, [financials]);

  const getStatusLabel = useCallback((status: string | null | undefined) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "completed" || normalized === "paid") return "Concluído";
    if (normalized === "pending") return "Pendente";
    if (normalized === "overdue") return "Em atraso";
    if (normalized === "cancelled") return "Cancelado";
    return status || "—";
  }, []);

  const composeEmailSummary = useCallback(
    (sections: EmailSections) => {
      const lines: string[] = [];
      const firstName = client?.name?.split(" ")[0] || client?.name || "cliente";

      lines.push(`Olá ${firstName},`);
      lines.push("");

      if (sections.includeSummary) {
        lines.push("Segue o resumo financeiro atualizado:");
        lines.push(`• Receitas registradas: ${formatMoney(totalIncome)}`);
        lines.push(`• Despesas registradas: ${formatMoney(totalExpenses)}`);
        lines.push(`• Saldo atual: ${formatMoney(netBalance)}`);
        lines.push("");
      }

      if (sections.includePending) {
        if (pendingTransactions.length > 0) {
          lines.push(
            `Pendências financeiras: ${formatMoney(totalPendingAmount)} em ${pendingTransactions.length} ${
              pendingTransactions.length === 1 ? "lançamento" : "lançamentos"
            }.`
          );

          const highlightPendings =
            upcomingPendings.length > 0
              ? upcomingPendings
              : pendingTransactions.slice(0, 3);

          highlightPendings.forEach((item) => {
            lines.push(
              `• ${item.description || "Lançamento"} - ${formatMoney(item.amount)} (${formatDateToBR(
                item.transaction_date
              )})`
            );
          });
        } else {
          lines.push("Não encontramos pendências financeiras no momento.");
        }
        lines.push("");
      }

      if (sections.includeRecent && recentTransactions.length > 0) {
        lines.push("Últimos lançamentos registrados:");
        recentTransactions.forEach((item) => {
          lines.push(
            `• ${formatDateToBR(item.transaction_date)} - ${item.description || "Lançamento"} (${formatMoney(
              item.amount
            )}) - ${getStatusLabel(item.status)}`
          );
        });
        lines.push("");
      }

      lines.push("Se precisar de qualquer ajuste ou esclarecimento, é só responder este email.");
      lines.push("");
      lines.push("Atenciosamente,");
      lines.push("Equipe Financeira");

      return lines.join("\n");
    },
    [
      client,
      formatDateToBR,
      formatMoney,
      getStatusLabel,
      netBalance,
      pendingTransactions,
      recentTransactions,
      totalExpenses,
      totalIncome,
      totalPendingAmount,
      upcomingPendings,
    ]
  );

  const emailSummaryPreview = useMemo(
    () =>
      composeEmailSummary({
        includeSummary: emailForm.includeSummary,
        includePending: emailForm.includePending,
        includeRecent: emailForm.includeRecent,
      }),
    [composeEmailSummary, emailForm.includePending, emailForm.includeRecent, emailForm.includeSummary]
  );

  useEffect(() => {
    if (!open || !client) return;

    setEmailForm((prev) => {
      const nextTo = prev.to || client.email || "";
      const nextSubject =
        prev.subject || (client ? `Resumo Financeiro - ${client.name}` : "Resumo Financeiro");
      const nextMessage =
        prev.message ||
        composeEmailSummary({
          includeSummary: prev.includeSummary,
          includePending: prev.includePending,
          includeRecent: prev.includeRecent,
        });

      if (prev.to === nextTo && prev.subject === nextSubject && prev.message === nextMessage) {
        return prev;
      }

      return {
        ...prev,
        to: nextTo,
        subject: nextSubject,
        message: nextMessage,
      };
    });
  }, [client, composeEmailSummary, open]);

  useEffect(() => {
    if (!open || !client?.id) return;

    const loadFinancials = async () => {
      try {
        setLoadingFinancials(true);
        const { data, error } = await supabase
          .from("client_financials")
          .select(
            "id, description, amount, transaction_date, status, transaction_type"
          )
          .eq("client_id", client.id)
          .order("transaction_date", { ascending: false });

        if (error) throw error;
        setFinancials(data || []);
      } catch (err) {
        console.error("Erro ao carregar dados financeiros do cliente:", err);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados financeiros do cliente.",
          variant: "destructive",
        });
      } finally {
        setLoadingFinancials(false);
      }
    };

    loadFinancials();
  }, [client?.id, open]);

  const handleToggleEmailSection = useCallback(
    (key: keyof EmailSections) => (checked: boolean) => {
      setEmailForm((prev) => {
        const updatedSections: EmailSections = {
          includeSummary: key === "includeSummary" ? checked : prev.includeSummary,
          includePending: key === "includePending" ? checked : prev.includePending,
          includeRecent: key === "includeRecent" ? checked : prev.includeRecent,
        };

        const next = {
          ...prev,
          ...updatedSections,
        } as typeof prev;

        if (!prev.message.trim()) {
          next.message = composeEmailSummary(updatedSections);
        }

        return next;
      });
    },
    [composeEmailSummary]
  );

  const handleUseSuggestedMessage = useCallback(() => {
    setEmailForm((prev) => ({
      ...prev,
      message: emailSummaryPreview,
    }));
  }, [emailSummaryPreview]);

  const handleSendEmail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!client) return;

      setIsSending(true);

      const highlightPendings =
        upcomingPendings.length > 0 ? upcomingPendings : pendingTransactions.slice(0, 3);

      const payload = {
        to: emailForm.to,
        cc: emailForm.cc,
        subject: emailForm.subject,
        message: emailForm.message,
        autoSummary: emailSummaryPreview,
        sections: {
          includeSummary: emailForm.includeSummary,
          includePending: emailForm.includePending,
          includeRecent: emailForm.includeRecent,
        },
        totals: {
          income: totalIncome,
          expenses: totalExpenses,
          balance: netBalance,
          pendingAmount: totalPendingAmount,
        },
        pending: highlightPendings.map((item) => ({
          id: item.id,
          description: item.description,
          amount: item.amount,
          transaction_date: item.transaction_date,
          status: item.status,
        })),
        recent: recentTransactions.map((item) => ({
          id: item.id,
          description: item.description,
          amount: item.amount,
          transaction_date: item.transaction_date,
          status: item.status,
        })),
      };

      console.log("[FinanceEmailPreview]", payload);

      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        toast({
          title: "Resumo preparado",
          description:
            "Os dados financeiros foram compilados. A integração com o serviço de email será conectada em breve.",
        });
        onOpenChange(false);
      } finally {
        setIsSending(false);
      }
    },
    [
      client,
      emailForm.cc,
      emailForm.includePending,
      emailForm.includeRecent,
      emailForm.includeSummary,
      emailForm.message,
      emailForm.subject,
      emailForm.to,
      emailSummaryPreview,
      netBalance,
      onOpenChange,
      pendingTransactions,
      recentTransactions,
      totalExpenses,
      totalIncome,
      totalPendingAmount,
      upcomingPendings,
    ]
  );

  const isFormValid = emailForm.to.trim().length > 0 && emailForm.subject.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar dados financeiros por email</DialogTitle>
        </DialogHeader>

        {!client ? (
          <div className="py-10 text-center text-muted-foreground">
            Selecione um cliente para enviar o resumo financeiro.
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSendEmail}>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Cliente selecionado</div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{client.name}</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  Receitas
                </div>
                <div className="text-2xl font-semibold">{formatMoney(totalIncome)}</div>
              </div>
              <div className="p-4 border rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <TrendingDown className="h-4 w-4" />
                  Despesas
                </div>
                <div className="text-2xl font-semibold">{formatMoney(totalExpenses)}</div>
              </div>
              <div className="p-4 border rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Badge variant={netBalance >= 0 ? "default" : "destructive"}>
                    Saldo Atual
                  </Badge>
                </div>
                <div className={`text-2xl font-semibold ${netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatMoney(netBalance)}
                </div>
              </div>
              <div className="p-4 border rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Pendências
                </div>
                <div className="text-2xl font-semibold">{formatMoney(totalPendingAmount)}</div>
                <div className="text-xs text-muted-foreground">
                  {pendingTransactions.length} {pendingTransactions.length === 1 ? "lançamento" : "lançamentos"} pendentes
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email-to">Destinatário</Label>
                <Input
                  id="email-to"
                  type="email"
                  value={emailForm.to}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, to: event.target.value }))}
                  placeholder="cliente@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-cc">Cópia (CC)</Label>
                <Input
                  id="email-cc"
                  value={emailForm.cc}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, cc: event.target.value }))}
                  placeholder="financeiro@empresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-subject">Assunto</Label>
              <Input
                id="email-subject"
                value={emailForm.subject}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Resumo Financeiro - Cliente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-message">Mensagem personalizada</Label>
              <Textarea
                id="email-message"
                value={emailForm.message}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Escreva uma mensagem para o cliente"
                rows={4}
              />
              <Button type="button" variant="link" className="px-0" onClick={handleUseSuggestedMessage}>
                Usar sugestão automática
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-medium">Seções do resumo</div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex items-start gap-3 rounded-lg border p-4">
                  <Switch
                    checked={emailForm.includeSummary}
                    onCheckedChange={handleToggleEmailSection("includeSummary")}
                  />
                  <div>
                    <div className="font-medium">Resumo geral</div>
                    <p className="text-sm text-muted-foreground">
                      Inclui totais de receitas, despesas e saldo.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border p-4">
                  <Switch
                    checked={emailForm.includePending}
                    onCheckedChange={handleToggleEmailSection("includePending")}
                  />
                  <div>
                    <div className="font-medium">Pendências</div>
                    <p className="text-sm text-muted-foreground">
                      Destaca valores e próximos vencimentos.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border p-4">
                  <Switch
                    checked={emailForm.includeRecent}
                    onCheckedChange={handleToggleEmailSection("includeRecent")}
                  />
                  <div>
                    <div className="font-medium">Últimos lançamentos</div>
                    <p className="text-sm text-muted-foreground">
                      Lista os lançamentos mais recentes do cliente.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Pré-visualização do resumo</div>
              <div className="rounded-lg border bg-muted/40 p-4">
                {loadingFinancials ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando lançamentos do cliente...
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">{emailSummaryPreview}</pre>
                )}
              </div>
            </div>

            {pendingTransactions.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium">Pendências em destaque</div>
                <div className="space-y-2">
                  {(upcomingPendings.length > 0 ? upcomingPendings : pendingTransactions.slice(0, 3)).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-medium">{item.description || "Lançamento"}</div>
                        <div className="text-xs text-muted-foreground">
                          Vencimento: {formatDateToBR(item.transaction_date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-amber-600">{formatMoney(item.amount)}</div>
                        <Badge variant="outline">{getStatusLabel(item.status)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
              <div>
                O envio será integrado a um serviço de email em breve. Esta ação apenas prepara o conteúdo.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!isFormValid || isSending || loadingFinancials}>
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparando
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Preparar envio
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
