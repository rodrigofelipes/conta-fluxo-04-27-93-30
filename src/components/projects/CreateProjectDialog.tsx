import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";

const createProjectSchema = z.object({
  client_id: z.string().min(1, "Cliente é obrigatório"),
  title: z.string().min(1, "Título é obrigatório"),
  endereco_obra: z.string().min(1, "Endereço da obra é obrigatório"),
  briefing: z.string().optional(),
  discriminacao: z.string().min(1, "Discriminação é obrigatória"),
  horas_contratadas: z.number().min(1, "Horas contratadas devem ser maior que 0"),
  valor_projeto: z.number().min(1, "Valor do projeto deve ser maior que 0"),
  status: z.enum(["em_andamento", "em_obra"]),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
}

interface Client {
  id: string;
  name: string;
  email?: string;
}

export function CreateProjectDialog({ 
  open, 
  onOpenChange,
  onProjectCreated 
}: CreateProjectDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { clients, loading: clientsLoading } = useClients();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      client_id: "",
      status: "em_andamento",
      horas_contratadas: 0,
      valor_projeto: 0,
    },
  });

  const onSubmit = async (data: CreateProjectFormData) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('projects')
        .insert({
          client_id: data.client_id,
          title: data.title,
          address: data.endereco_obra,
          briefing_document: data.briefing,
          description: data.discriminacao,
          contracted_hours: data.horas_contratadas,
          contracted_value: data.valor_projeto,
          status: data.status,
          executed_hours: 0,
          meetings_count: 0,
          visits_count: 0,
        });

      if (error) throw error;
      
      toast({
        title: "Sucesso!",
        description: "Projeto criado com sucesso!"
      });
      reset();
      onOpenChange(false);
      onProjectCreated?.();
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar projeto. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset({
      client_id: "",
      status: "em_andamento",
      horas_contratadas: 0,
      valor_projeto: 0,
      title: "",
      endereco_obra: "",
      briefing: "",
      discriminacao: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para criar um novo projeto
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Cliente *</Label>
              <Select
                value={watch("client_id")}
                onValueChange={(value) => setValue("client_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {clientsLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Carregando clientes...
                    </div>
                  ) : clients.length > 0 ? (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col">
                          <span>{client.name}</span>
                          {client.email && (
                            <span className="text-xs text-muted-foreground">{client.email}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      Nenhum cliente encontrado
                    </div>
                  )}
                </SelectContent>
              </Select>
              {errors.client_id && (
                <p className="text-sm text-red-600">{errors.client_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status do Projeto *</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="em_obra">Em Obra</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título do Projeto *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Nome/título do projeto"
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco_obra">Endereço *</Label>
            <Input
              id="endereco_obra"
              {...register("endereco_obra")}
              placeholder="Rua, número, bairro, cidade"
            />
            {errors.endereco_obra && (
              <p className="text-sm text-red-600">{errors.endereco_obra.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="briefing">Documentos</Label>
            <Input
              id="briefing"
              {...register("briefing")}
              placeholder="Resumo do projeto (ex: Casa de campo com 3 quartos)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discriminacao">Descrição</Label>
            <Textarea
              id="discriminacao"
              {...register("discriminacao")}
              placeholder="Descrição detalhada do projeto, conceito, área, características..."
              rows={4}
            />
            {errors.discriminacao && (
              <p className="text-sm text-red-600">{errors.discriminacao.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="horas_contratadas">Horas Contratadas *</Label>
              <Input
                id="horas_contratadas"
                type="number"
                min="1"
                {...register("horas_contratadas", { valueAsNumber: true })}
                placeholder="Ex: 120"
              />
              {errors.horas_contratadas && (
                <p className="text-sm text-red-600">{errors.horas_contratadas.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_projeto">Valor do Projeto (R$) *</Label>
              <Input
                id="valor_projeto"
                type="number"
                min="1"
                step="0.01"
                {...register("valor_projeto", { valueAsNumber: true })}
                placeholder="Ex: 15000.00"
              />
              {errors.valor_projeto && (
                <p className="text-sm text-red-600">{errors.valor_projeto.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="btn-hero"
              disabled={isLoading}
            >
              {isLoading ? "Criando..." : "Criar Projeto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}