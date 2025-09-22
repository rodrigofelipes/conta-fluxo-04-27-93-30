import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreatePhaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onPhaseCreated?: () => void;
}

export function CreatePhaseDialog({ 
  open, 
  onOpenChange, 
  projectId,
  onPhaseCreated 
}: CreatePhaseDialogProps) {
  const [saving, setSaving] = useState(false);
  const [collaborators, setCollaborators] = useState<{id: string, name: string}[]>([]);
  const [formData, setFormData] = useState({
    phase_name: "",
    description: "",
    allocated_hours: 0,
    status: "pending" as 'pending' | 'in_progress' | 'completed' | 'cancelled',
    assigned_to: ""
  });

  useEffect(() => {
    if (open) {
      loadCollaborators();
    }
  }, [open]);

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

  const resetForm = () => {
    setFormData({
      phase_name: "",
      description: "",
      allocated_hours: 0,
      status: "pending",
      assigned_to: ""
    });
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

      // Obter o próximo order_index
      const { data: existingPhases } = await supabase
        .from('project_phases')
        .select('order_index')
        .eq('project_id', projectId)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrderIndex = existingPhases && existingPhases.length > 0 
        ? existingPhases[0].order_index + 1 
        : 1;

      const { error } = await supabase
        .from('project_phases')
        .insert({
          project_id: projectId,
          phase_name: formData.phase_name.trim(),
          description: formData.description.trim() || null,
          allocated_hours: formData.allocated_hours,
          status: formData.status,
          order_index: nextOrderIndex,
          executed_hours: 0,
          assigned_to: formData.assigned_to || null
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fase criada com sucesso!"
      });

      resetForm();
      onOpenChange(false);
      onPhaseCreated?.();

    } catch (error) {
      console.error('Erro ao criar fase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a fase",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Etapa do Projeto</DialogTitle>
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
            <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {collaborators.map((collaborator) => (
                  <SelectItem key={collaborator.id} value={collaborator.id}>
                    {collaborator.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {saving ? "Criando..." : "Criar Etapa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}