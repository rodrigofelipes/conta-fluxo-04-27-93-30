import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EditPhaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: {
    id: string;
    phase_name: string;
    description?: string;
    allocated_hours: number;
    status: string;
    assigned_to?: string;
    priority?: string;
    due_date?: string;
  };
  onPhaseUpdated?: () => void;
}

type PhaseStatus = "pending" | "in_progress" | "completed" | "cancelled";
type Priority = "baixa" | "media" | "alta" | "urgente";

interface PhaseFormData {
  phase_name: string;
  description: string;
  allocated_hours: number;
  status: PhaseStatus;
  assigned_to: string | null;
  priority: Priority;
  due_date: Date | null;
}

const NO_COLLABORATOR_VALUE = "no-collaborator";

export function EditPhaseDialog({
  open,
  onOpenChange,
  phase,
  onPhaseUpdated
}: EditPhaseDialogProps) {
  const [saving, setSaving] = useState(false);
  const [collaborators, setCollaborators] = useState<{id: string, name: string}[]>([]);
  const [formData, setFormData] = useState<PhaseFormData>({
    phase_name: "",
    description: "",
    allocated_hours: 0,
    status: "pending",
    assigned_to: null,
    priority: "media",
    due_date: null
  });

  useEffect(() => {
    if (open && phase) {
      setFormData({
        phase_name: phase.phase_name || "",
        description: phase.description || "",
        allocated_hours: phase.allocated_hours || 0,
        status: (phase.status as PhaseStatus) || "pending",
        assigned_to: phase.assigned_to || null,
        priority: (phase.priority as Priority) || "media",
        due_date: phase.due_date ? parseISO(phase.due_date) : null
      });
      loadCollaborators();
    }
  }, [open, phase]);

  const loadCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'user')
        .order('name');
      
      if (error) throw error;
      setCollaborators(data || []);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phase_name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da fase é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('project_phases')
        .update({
          phase_name: formData.phase_name.trim(),
          description: formData.description.trim() || null,
          allocated_hours: formData.allocated_hours,
          status: formData.status,
          assigned_to: formData.assigned_to || null,
          priority: formData.priority,
          due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null
        })
        .eq('id', phase.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fase atualizada com sucesso!"
      });

      onOpenChange(false);
      onPhaseUpdated?.();

    } catch (error) {
      console.error('Erro ao atualizar fase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a fase",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Etapa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phase_name">Nome da Etapa *</Label>
            <Input
              id="phase_name"
              value={formData.phase_name}
              onChange={(e) => setFormData(prev => ({ ...prev, phase_name: e.target.value }))}
              placeholder="Ex: Análise e Planejamento"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva os objetivos e entregáveis desta fase..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as typeof formData.status }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allocated_hours">Horas Estimadas</Label>
            <Input
              id="allocated_hours"
              type="number"
              min="0"
              step="0.5"
              value={formData.allocated_hours}
              onChange={(e) => setFormData(prev => ({ ...prev, allocated_hours: parseFloat(e.target.value) || 0 }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_to">Colaborador Responsável</Label>
            <Select
              value={formData.assigned_to ?? NO_COLLABORATOR_VALUE}
              onValueChange={(value) =>
                setFormData(prev => ({
                  ...prev,
                  assigned_to: value === NO_COLLABORATOR_VALUE ? null : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COLLABORATOR_VALUE}>Nenhum</SelectItem>
                {collaborators.map((collaborator) => (
                  <SelectItem key={collaborator.id} value={collaborator.id}>
                    {collaborator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as typeof formData.priority }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Data de Entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.due_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date || undefined}
                  onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date || null }))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
