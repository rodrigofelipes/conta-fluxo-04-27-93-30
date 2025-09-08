import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, UserCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Phase {
  id: string;
  phase_name: string;
  allocated_hours: number;
  executed_hours: number;
  status: string;
  assigned_to: string;
  supervised_by: string;
}

interface PhaseAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  phase: Phase | null;
  onAssignmentUpdate: () => void;
}

export function PhaseAssignmentDialog({
  isOpen,
  onClose,
  phase,
  onAssignmentUpdate
}: PhaseAssignmentDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [supervisors, setSupervisors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (phase) {
      setSelectedAssignee(phase.assigned_to || "");
      setSelectedSupervisor(phase.supervised_by || "");
    }
  }, [phase]);

  const loadProfiles = async () => {
    try {
      setLoading(true);

      // Buscar todos os perfis
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .order('name');

      if (profilesError) throw profilesError;

      // Separar usuários comuns de supervisores
      const users = (allProfiles || []).filter(p => p.role === 'user');
      const supervisorUsers = (allProfiles || []).filter(p => p.role === 'supervisor');

      setProfiles(users);
      setSupervisors(supervisorUsers);
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!phase || !selectedAssignee) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione um responsável pela etapa.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('project_phases')
        .update({
          assigned_to: selectedAssignee,
          supervised_by: selectedSupervisor === 'none' ? null : selectedSupervisor || null,
          status: selectedAssignee ? 'in_progress' : phase.status
        })
        .eq('id', phase.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Atribuições da etapa atualizadas com sucesso."
      });

      onAssignmentUpdate();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar atribuições:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as atribuições.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!phase) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Atribuir Responsáveis
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {phase.phase_name}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Phase Info */}
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Horas Alocadas:
              </span>
              <Badge variant="outline">{phase.allocated_hours}h</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Horas Executadas:</span>
              <Badge variant={phase.executed_hours > phase.allocated_hours ? "destructive" : "secondary"}>
                {phase.executed_hours.toFixed(1)}h
              </Badge>
            </div>
          </div>

          {/* Assignee Selection */}
          <div className="space-y-3">
            <Label htmlFor="assignee">Responsável pela Execução *</Label>
            {loading ? (
              <div className="animate-pulse h-10 bg-muted rounded"></div>
            ) : (
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                       <div className="flex items-center gap-2">
                         <Avatar className="h-6 w-6">
                           <AvatarFallback className="text-xs">
                             {getInitials(profile.name)}
                           </AvatarFallback>
                         </Avatar>
                         <p className="font-medium">{profile.name}</p>
                       </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Supervisor Selection */}
          <div className="space-y-3">
            <Label htmlFor="supervisor">Supervisor (Opcional)</Label>
            {loading ? (
              <div className="animate-pulse h-10 bg-muted rounded"></div>
            ) : (
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum supervisor</SelectItem>
                  {supervisors.map((profile) => (
                     <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(profile.name)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-medium">{profile.name}</p>
                        </div>
                     </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSave} 
              disabled={saving || !selectedAssignee}
              className="flex-1"
            >
              {saving ? "Salvando..." : "Salvar Atribuições"}
            </Button>
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}