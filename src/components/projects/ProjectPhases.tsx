import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Edit, Trash2, DollarSign, CheckCircle, Clock, AlertCircle, UserPlus, User, FileText, TrendingUp, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PhaseAssignmentDialog } from "./PhaseAssignmentDialog";
import { ProjectBankOfHours } from "./ProjectBankOfHours";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ProjectPhase {
  id: string;
  project_id: string;
  phase_name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  order_index: number;
  value_percentage: number;
  value_amount: number;
  allocated_hours: number;
  executed_hours: number;
  assigned_to?: string;
  supervised_by?: string;
  start_date?: string;
  due_date?: string;
  assigned_profile?: {
    name: string;
  };
  supervisor_profile?: {
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface ProjectPhasesProps {
  projectId: string;
  contractedValue: number;
  contractedHours: number;
  onPhasesChange?: () => void;
}

const statusLabels = {
  pending: "Pendente",
  in_progress: "Em Andamento", 
  completed: "Concluída",
  cancelled: "Cancelada"
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200"
};

const statusIcons = {
  pending: Clock,
  in_progress: AlertCircle,
  completed: CheckCircle,
  cancelled: Trash2
};

export function ProjectPhases({ projectId, contractedValue, contractedHours, onPhasesChange }: ProjectPhasesProps) {
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPhaseForAssignment, setSelectedPhaseForAssignment] = useState<ProjectPhase | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [phaseToDelete, setPhaseToDelete] = useState<ProjectPhase | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingPhase, setDeletingPhase] = useState(false);

  const [formData, setFormData] = useState({
    phase_name: "",
    description: "",
    status: "pending" as ProjectPhase['status'],
    allocated_hours: 0,
    start_date: null as Date | null,
    due_date: null as Date | null
  });

  // Calcular valor por hora
  const valuePerHour = contractedHours > 0 ? contractedValue / contractedHours : 0;

  const loadPhases = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_phases')
        .select(`
          *,
          assigned_profile:profiles!assigned_to(name),
          supervisor_profile:profiles!supervised_by(name)
        `)
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      // Para cada fase, verificar se tem time_entries para determinar status correto
      const phasesWithValues = await Promise.all((data || []).map(async (phase) => {
        const { data: hasTimeEntries } = await supabase
          .rpc('phase_has_time_entries', { phase_id_param: phase.id });
        
        // Determinar status correto baseado em time_entries
        let actualStatus = phase.status;
        if (phase.status === 'in_progress' && !hasTimeEntries) {
          actualStatus = 'pending';
        }

        return {
          ...phase,
          status: actualStatus as ProjectPhase['status'],
          value_amount: phase.allocated_hours * valuePerHour,
          value_percentage: contractedHours > 0 ? (phase.allocated_hours / contractedHours) * 100 : 0,
          assigned_profile: Array.isArray(phase.assigned_profile) ? phase.assigned_profile[0] : phase.assigned_profile,
          supervisor_profile: Array.isArray(phase.supervisor_profile) ? phase.supervisor_profile[0] : phase.supervisor_profile
        };
      }));

      setPhases(phasesWithValues);
    } catch (error) {
      console.error('Erro ao carregar fases:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as fases do projeto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhases();
  }, [projectId, contractedValue, contractedHours]);

  const resetForm = () => {
    setFormData({
      phase_name: "",
      description: "",
      status: "pending",
      allocated_hours: 0,
      start_date: null,
      due_date: null
    });
    setEditingPhase(null);
  };

  const handleOpenDialog = (phase?: ProjectPhase) => {
    if (phase) {
      setEditingPhase(phase);
      setFormData({
        phase_name: phase.phase_name,
        description: phase.description || "",
        status: phase.status,
        allocated_hours: phase.allocated_hours,
        start_date: phase.start_date ? parseISO(phase.start_date) : null,
        due_date: phase.due_date ? parseISO(phase.due_date) : null
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSavePhase = async () => {
    if (!formData.phase_name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Nome da fase é obrigatório",
        variant: "destructive"
      });
      return;
    }

    // Verificar se a soma das horas não excede as horas contratuais
    const totalAllocatedHours = phases
      .filter(p => p.id !== editingPhase?.id)
      .reduce((sum, p) => sum + p.allocated_hours, 0) + formData.allocated_hours;

    if (totalAllocatedHours > contractedHours) {
      toast({
        title: "Horas inválidas",
        description: `A soma das horas não pode exceder ${contractedHours}h. Atual: ${totalAllocatedHours}h`,
        variant: "destructive"
      });
      return;
    }

    if (formData.allocated_hours <= 0) {
      toast({
        title: "Campo obrigatório",
        description: "Horas alocadas deve ser maior que zero",
        variant: "destructive"
      });
      return;
    }

    // Validar datas
    if (formData.start_date && formData.due_date && formData.start_date > formData.due_date) {
      toast({
        title: "Datas inválidas",
        description: "A data de início não pode ser posterior à data de entrega",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const calculatedPercentage = contractedHours > 0 ? (formData.allocated_hours / contractedHours) * 100 : 0;

      if (editingPhase) {
        // Atualizar fase existente
        const { error } = await supabase
          .from('project_phases')
          .update({
            phase_name: formData.phase_name,
            description: formData.description,
            status: formData.status,
            allocated_hours: formData.allocated_hours,
            value_percentage: calculatedPercentage,
            start_date: formData.start_date ? format(formData.start_date, 'yyyy-MM-dd') : null,
            due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null
          })
          .eq('id', editingPhase.id);

        if (error) throw error;
      } else {
        // Criar nova fase
        const nextOrderIndex = Math.max(...phases.map(p => p.order_index), 0) + 1;
        
        const { error } = await supabase
          .from('project_phases')
          .insert({
            project_id: projectId,
            phase_name: formData.phase_name,
            description: formData.description,
            status: formData.status,
            allocated_hours: formData.allocated_hours,
            value_percentage: calculatedPercentage,
            order_index: nextOrderIndex,
            created_by: userData.user.id,
            start_date: formData.start_date ? format(formData.start_date, 'yyyy-MM-dd') : null,
            due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: editingPhase ? "Fase atualizada com sucesso" : "Fase criada com sucesso"
      });

      setIsDialogOpen(false);
      resetForm();
      loadPhases();
      onPhasesChange?.();
    } catch (error) {
      console.error('Erro ao salvar fase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a fase",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhase = async () => {
    if (!phaseToDelete) return;

    setDeletingPhase(true);
    try {
      const { error } = await supabase
        .from('project_phases')
        .delete()
        .eq('id', phaseToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Fase excluída com sucesso"
      });

      loadPhases();
      onPhasesChange?.();
    } catch (error) {
      console.error('Erro ao excluir fase:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a fase",
        variant: "destructive"
      });
    } finally {
      setDeletingPhase(false);
      setIsDeleteDialogOpen(false);
      setPhaseToDelete(null);
    }
  };

  const openDeleteDialog = (phase: ProjectPhase) => {
    setPhaseToDelete(phase);
    setIsDeleteDialogOpen(true);
  };

  const openAssignmentDialog = (phase: ProjectPhase) => {
    setSelectedPhaseForAssignment(phase);
    setIsAssignmentDialogOpen(true);
  };

  const handleAssignmentUpdate = () => {
    loadPhases();
    setSelectedPhaseForAssignment(null);
  };

  const totalAllocatedHours = phases.reduce((sum, phase) => sum + phase.allocated_hours, 0);
  const remainingHours = contractedHours - totalAllocatedHours;
  const totalAllocatedPercentage = contractedHours > 0 ? (totalAllocatedHours / contractedHours) * 100 : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fases do Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="phases" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="phases" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Fases do Projeto
          </TabsTrigger>
          <TabsTrigger value="bank-hours" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Banco de Horas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phases">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Fases do Projeto
                </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova Fase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPhase ? 'Editar Fase' : 'Nova Fase'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="phase_name">Nome da Fase *</Label>
                  <Input
                    id="phase_name"
                    value={formData.phase_name}
                    onChange={(e) => setFormData({...formData, phase_name: e.target.value})}
                    placeholder="Ex: Projeto Executivo"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descrição detalhada da fase"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({...formData, status: value as ProjectPhase['status']})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="allocated_hours">Horas Alocadas *</Label>
                  <Input
                    id="allocated_hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.allocated_hours}
                    onChange={(e) => setFormData({...formData, allocated_hours: Number(e.target.value)})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor: R$ {(formData.allocated_hours * valuePerHour).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Restante disponível: {remainingHours.toFixed(1)}h de {contractedHours}h
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Valor por hora: R$ {valuePerHour.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div>
                  <Label htmlFor="start_date">Data de Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.start_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_date ? format(formData.start_date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.start_date || undefined}
                        onSelect={(date) => setFormData({...formData, start_date: date || null})}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {formData.start_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ⚠️ A fase mudará automaticamente para "Em Andamento" nesta data
                    </p>
                  )}
                </div>

                <div>
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
                        onSelect={(date) => setFormData({...formData, due_date: date || null})}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleSavePhase} 
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo de Distribuição */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Distribuição por Horas</span>
            <span className="text-sm text-muted-foreground">
              {totalAllocatedHours.toFixed(1)}h de {contractedHours}h
            </span>
          </div>
          <Progress value={totalAllocatedPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>R$ {(totalAllocatedHours * valuePerHour).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span>R$ {contractedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Valor por hora: R$ {valuePerHour.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Lista de Fases */}
        {phases.length > 0 ? (
          <div className="space-y-3">
            {phases.map((phase, index) => {
              const StatusIcon = statusIcons[phase.status];
              return (
                <div 
                  key={phase.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{index + 1}. {phase.phase_name}</span>
                        <Badge variant="outline" className={statusColors[phase.status]}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusLabels[phase.status]}
                        </Badge>
                      </div>
                      
                      {phase.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {phase.description}
                        </p>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {phase.allocated_hours}h ({phase.value_percentage.toFixed(1)}%)
                          </span>
                          <span className="font-medium text-primary">
                            R$ {phase.value_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {phase.executed_hours > phase.allocated_hours && (
                            <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">
                              Prejuízo: R$ {((phase.executed_hours - phase.allocated_hours) * valuePerHour).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                        
                        {/* Assignment info */}
                        <div className="flex items-center gap-4 text-xs">
                          {phase.assigned_profile ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <User className="h-3 w-3" />
                              <span>Responsável: {phase.assigned_profile.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <UserPlus className="h-3 w-3" />
                              <span>Não atribuída</span>
                            </div>
                          )}
                          {phase.supervisor_profile && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <span>Supervisor: {phase.supervisor_profile.name}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Progress bar if executed_hours exists */}
                        {phase.executed_hours !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progresso</span>
                              <span>{phase.executed_hours.toFixed(1)}h / {phase.allocated_hours}h</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  phase.executed_hours > phase.allocated_hours 
                                    ? 'bg-red-500' 
                                    : 'bg-primary'
                                }`}
                                style={{ 
                                  width: `${Math.min((phase.executed_hours / phase.allocated_hours) * 100, 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openAssignmentDialog(phase)}
                        title="Atribuir responsável"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenDialog(phase)}
                        title="Editar fase"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(phase)}
                        className="text-destructive hover:text-destructive"
                        title="Excluir fase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">Nenhuma fase criada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Divida seu projeto em fases para melhor controle financeiro
            </p>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Fase
            </Button>
          </div>
        )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank-hours">
          <ProjectBankOfHours 
            projectId={projectId}
            contractedValue={contractedValue}
            contractedHours={contractedHours}
          />
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <PhaseAssignmentDialog
        isOpen={isAssignmentDialogOpen}
        onClose={() => {
          setIsAssignmentDialogOpen(false);
          setSelectedPhaseForAssignment(null);
        }}
        phase={selectedPhaseForAssignment ? {
          id: selectedPhaseForAssignment.id,
          phase_name: selectedPhaseForAssignment.phase_name,
          allocated_hours: selectedPhaseForAssignment.allocated_hours,
          executed_hours: selectedPhaseForAssignment.executed_hours || 0,
          status: selectedPhaseForAssignment.status,
          assigned_to: selectedPhaseForAssignment.assigned_to || '',
          supervised_by: selectedPhaseForAssignment.supervised_by || ''
        } : null}
        onAssignmentUpdate={handleAssignmentUpdate}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setPhaseToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fase</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a fase "{phaseToDelete?.phase_name ?? 'selecionada'}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPhase}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePhase}
              disabled={deletingPhase}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPhase ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}