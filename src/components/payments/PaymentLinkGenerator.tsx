import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentLinkSource =
  | { type: "transaction"; id: string; description: string; amount: number; clientId?: string | null }
  | { type: "installment"; id: string; description: string; amount: number; clientId?: string | null };

interface PaymentLinkGeneratorProps {
  clientId?: string;
  clientName?: string;
  receivables: Array<{
    id: string;
    description: string;
    amount: number;
    status: string;
    transaction_category: string;
    client_id?: string;
  }>;
  installments: Array<{
    id: string;
    installment_number: number;
    total_installments: number;
    amount: number;
    status: string;
    due_date: string;
    client_id: string;
  }>;
  onCreated?: (payload: { paymentLinkUrl: string; linkToken: string }) => void;
  triggerClassName?: string;
  triggerLabel?: string;
  defaultSource?: PaymentLinkSource | null;
}

const paymentLinkSchema = z.object({
  sourceType: z.enum(["transaction", "installment", "custom"]),
  sourceId: z.string().optional(),
  amount: z
    .string()
    .min(1, "Informe o valor")
    .refine(value => !Number.isNaN(Number(value.replace(/\./g, "").replace(",", "."))), {
      message: "Valor inválido",
    }),
  description: z.string().min(3, "Informe uma descrição"),
  expiresInHours: z
    .string()
    .min(1, "Informe a validade")
    .refine(value => Number(value) > 0 && Number(value) <= 720, {
      message: "Use um período entre 1 e 720 horas",
    }),
});

export function PaymentLinkGenerator({
  clientId,
  clientName,
  receivables,
  installments,
  onCreated,
  triggerClassName,
  triggerLabel = "Gerar link de pagamento",
  defaultSource = null,
}: PaymentLinkGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof paymentLinkSchema>>({
    resolver: zodResolver(paymentLinkSchema),
    defaultValues: {
      sourceType: defaultSource?.type ?? (receivables.length > 0 ? "transaction" : "custom"),
      sourceId: defaultSource?.id,
      amount: defaultSource ? defaultSource.amount.toFixed(2) : "",
      description: defaultSource?.description ?? "",
      expiresInHours: "168", // 7 days
    },
  });

  const sourceType = form.watch("sourceType");
  const sourceId = form.watch("sourceId");

  const availableTransactions = useMemo(() =>
    receivables
      .filter(item => item.status === "pending" && item.transaction_category === "receivable")
      .map(item => ({
        value: item.id,
        label: `${item.description} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}`,
        amount: item.amount,
        clientId: item.client_id ?? clientId ?? null,
      })),
  [receivables, clientId]);

  const availableInstallments = useMemo(() =>
    installments
      .filter(item => item.status === "pending")
      .map(item => ({
        value: item.id,
        label: `Parcela ${item.installment_number}/${item.total_installments} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}`,
        amount: item.amount,
        clientId: item.client_id,
      })),
  [installments]);

  useEffect(() => {
    if (sourceType === "transaction" && sourceId) {
      const found = availableTransactions.find(item => item.value === sourceId);
      if (found) {
        form.setValue("amount", found.amount.toFixed(2));
        form.setValue("description", `Pagamento de ${found.label.split("•")[0].trim()}`);
      }
    }

    if (sourceType === "installment" && sourceId) {
      const found = availableInstallments.find(item => item.value === sourceId);
      if (found) {
        form.setValue("amount", found.amount.toFixed(2));
        form.setValue("description", `Parcela ${found.label.split("•")[0].replace('Parcela ', '')}`);
      }
    }
    if (sourceType === "custom") {
      form.setValue("sourceId", undefined);
    }
  }, [sourceType, sourceId, form, availableTransactions, availableInstallments]);

  const handleSubmit = async (values: z.infer<typeof paymentLinkSchema>) => {
    try {
      if (!clientId && !defaultSource?.clientId) {
        toast({
          title: "Selecione um cliente",
          description: "É necessário informar o cliente para gerar o link de pagamento.",
          variant: "destructive",
        });
        return;
      }

      const parsedAmount = Number(values.amount.replace(/\./g, "").replace(",", "."));
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({
          title: "Valor inválido",
          description: "Informe um valor maior que zero.",
          variant: "destructive",
        });
        return;
      }

      const hours = Number(values.expiresInHours);
      const expiresInMinutes = hours * 60;

      const payload = {
        clientId: clientId ?? defaultSource?.clientId ?? availableTransactions.find(item => item.value === values.sourceId)?.clientId ?? availableInstallments.find(item => item.value === values.sourceId)?.clientId,
        financialTransactionId: values.sourceType === "transaction" ? values.sourceId ?? null : null,
        installmentId: values.sourceType === "installment" ? values.sourceId ?? null : null,
        amount: parsedAmount,
        description: values.description,
        expiresInMinutes,
      };

      if (!payload.clientId) {
        toast({
          title: "Seleção incompleta",
          description: "Escolha um cliente ou uma transação vinculada antes de gerar o link.",
          variant: "destructive",
        });
        return;
      }

      setIsSubmitting(true);
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: payload,
      });

      if (error) {
        throw error;
      }

      const linkToken = data?.linkToken ?? data?.link_token;
      const paymentLinkUrl = data?.paymentLinkUrl ?? data?.payment_link_url;

      if (linkToken && paymentLinkUrl) {
        toast({
          title: "Link gerado",
          description: "Copie e envie para o cliente finalizar o pagamento.",
        });
        onCreated?.({ paymentLinkUrl, linkToken });
        setOpen(false);
        form.reset({
          sourceType: values.sourceType,
          sourceId: undefined,
          amount: "",
          description: "",
          expiresInHours: values.expiresInHours,
        });
      } else {
        throw new Error("Não foi possível gerar o link de pagamento.");
      }
    } catch (err: any) {
      console.error("Erro ao gerar link de pagamento:", err);
      toast({
        title: "Erro ao gerar link",
        description: err?.message ?? "Não foi possível gerar o link. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn("gap-2", triggerClassName)}>
          <LinkIcon className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar link de pagamento {clientName ? `para ${clientName}` : ""}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sourceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem do pagamento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a origem" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="transaction">Transação a receber</SelectItem>
                      <SelectItem value="installment">Parcela pendente</SelectItem>
                      <SelectItem value="custom">Valor personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(form.watch("sourceType") === "transaction" || form.watch("sourceType") === "installment") && (
              <FormField
                control={form.control}
                name="sourceId"
                render={({ field }) => {
                  const options = form.watch("sourceType") === "transaction" ? availableTransactions : availableInstallments;
                  return (
                    <FormItem>
                      <FormLabel>{form.watch("sourceType") === "transaction" ? "Transação" : "Parcela"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={options.length ? "Selecione" : "Nenhum item disponível"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {options.length === 0 ? (
                            <SelectItem value="__empty" disabled>
                              Nenhum item pendente encontrado
                            </SelectItem>
                          ) : (
                            options.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input placeholder="0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiresInHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade (horas)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={720} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição para o cliente</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Ex: Pagamento do projeto executivo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Badge variant="secondary">Dica</Badge>
                O link será enviado via Stripe Checkout com confirmação automática quando o pagamento for concluído.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-hero-static" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  "Gerar link"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
