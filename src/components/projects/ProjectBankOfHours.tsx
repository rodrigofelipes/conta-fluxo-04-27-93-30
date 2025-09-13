import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  User,
  AlertTriangle,
  CheckCircle2,
  Calculator
} from 'lucide-react';
import { useIntelligentPhases } from '@/hooks/useIntelligentPhases';
import { PhaseFinancialAnalysis } from './PhaseFinancialAnalysis';

interface ProjectBankOfHoursProps {
  projectId: string;
  contractedValue: number;
  contractedHours: number;
}

interface CollaboratorHours {
  id: string;
  name: string;
  totalHours: number;
  phases: {
    phase_name: string;
    allocated_hours: number;
    executed_hours: number;
    status: string;
  }[];
}

export function ProjectBankOfHours({ 
  projectId, 
  contractedValue, 
  contractedHours 
}: ProjectBankOfHoursProps) {
  const { phases, loading } = useIntelligentPhases(projectId);
  const [collaborators, setCollaborators] = useState<CollaboratorHours[]>([]);

  // Processar dados dos colaboradores
  useEffect(() => {
    if (phases.length === 0) return;

    const collabMap = new Map<string, CollaboratorHours>();

    phases.forEach(phase => {
      const assignedProfile = (phase as any).assigned_profile;
      if (assignedProfile) {
        const collabId = assignedProfile.id;
        const collabName = assignedProfile.name;

        if (!collabMap.has(collabId)) {
          collabMap.set(collabId, {
            id: collabId,
            name: collabName,
            totalHours: 0,
            phases: []
          });
        }

        const collab = collabMap.get(collabId)!;
        collab.totalHours += phase.executed_hours;
        collab.phases.push({
          phase_name: phase.phase_name,
          allocated_hours: phase.allocated_hours,
          executed_hours: phase.executed_hours,
          status: phase.status
        });
      }
    });

    setCollaborators(Array.from(collabMap.values()));
  }, [phases]);

  const hourlyRate = contractedValue > 0 && contractedHours > 0 
    ? contractedValue / contractedHours 
    : 150;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Análise Financeira Completa */}
      <PhaseFinancialAnalysis 
        projectId={projectId}
        contractedValue={contractedValue}
        contractedHours={contractedHours}
      />

      {/* Banco de Horas por Colaborador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Banco de Horas por Colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {collaborators.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum colaborador atribuído às fases do projeto.
            </p>
          ) : (
            <div className="grid gap-6">
              {collaborators.map((collaborator) => (
                <div key={collaborator.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{collaborator.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Total trabalhado: {collaborator.totalHours.toFixed(1)}h
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        R$ {(collaborator.totalHours * hourlyRate).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valor total gerado
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">Fases Atribuídas:</h4>
                    <div className="grid gap-3">
                      {collaborator.phases.map((phase, index) => {
                        const isOverAllocated = phase.executed_hours > phase.allocated_hours;
                        const isUnderAllocated = phase.executed_hours < phase.allocated_hours && phase.status === 'completed';
                        const difference = phase.executed_hours - phase.allocated_hours;
                        
                        return (
                          <div key={index} className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{phase.phase_name}</span>
                              <div className="flex items-center gap-2">
                                {isOverAllocated && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    +{difference.toFixed(1)}h
                                  </Badge>
                                )}
                                {isUnderAllocated && (
                                  <Badge variant="default" className="text-xs bg-green-600">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    -{Math.abs(difference).toFixed(1)}h
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {phase.status === 'completed' ? 'Concluída' : 
                                   phase.status === 'in_progress' ? 'Em Andamento' : 
                                   phase.status === 'pending' ? 'Pendente' : 'Cancelada'}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Alocado:</span>
                                <div className="font-medium">{phase.allocated_hours}h</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Executado:</span>
                                <div className="font-medium">{phase.executed_hours.toFixed(1)}h</div>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Valor:</span>
                                <div className="font-medium">R$ {(phase.executed_hours * hourlyRate).toFixed(2)}</div>
                              </div>
                            </div>

                            {isOverAllocated && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                <div className="flex items-center gap-1 text-red-600">
                                  <TrendingDown className="h-3 w-3" />
                                  <span className="font-medium">Prejuízo: R$ {(Math.abs(difference) * hourlyRate).toFixed(2)}</span>
                                </div>
                              </div>
                            )}

                            {isUnderAllocated && (
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                                <div className="flex items-center gap-1 text-green-600">
                                  <TrendingUp className="h-3 w-3" />
                                  <span className="font-medium">Economia: R$ {(Math.abs(difference) * hourlyRate).toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Geral do Banco de Horas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumo do Banco de Horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Total Contratado</span>
              </div>
              <div className="text-xl font-bold text-blue-700">
                {contractedHours}h
              </div>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-md">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Total Executado</span>
              </div>
              <div className="text-xl font-bold text-purple-700">
                {phases.reduce((sum, phase) => sum + phase.executed_hours, 0).toFixed(1)}h
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Valor/Hora</span>
              </div>
              <div className="text-xl font-bold text-green-700">
                R$ {hourlyRate.toFixed(2)}
              </div>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-md">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">Colaboradores</span>
              </div>
              <div className="text-xl font-bold text-orange-700">
                {collaborators.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}