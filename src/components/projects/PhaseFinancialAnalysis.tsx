import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Calculator,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useIntelligentPhases } from '@/hooks/useIntelligentPhases';

interface PhaseFinancialData {
  id: string;
  phase_name: string;
  allocated_hours: number;
  executed_hours: number;
  value_percentage: number;
  assigned_profile?: { name: string } | null;
  loss?: {
    excess_hours: number;
    hourly_value: number;
    total_loss: number;
    loss_percentage: number;
  };
  savings?: {
    saved_hours: number;
    hourly_value: number;
    total_savings: number;
    savings_percentage: number;
  };
}

interface PhaseFinancialAnalysisProps {
  projectId: string;
  contractedValue: number;
  contractedHours: number;
}

export function PhaseFinancialAnalysis({ 
  projectId, 
  contractedValue, 
  contractedHours 
}: PhaseFinancialAnalysisProps) {
  const { phases, loading, calculatePhaseLoss } = useIntelligentPhases(projectId);
  const [financialData, setFinancialData] = useState<PhaseFinancialData[]>([]);
  const [calculating, setCalculating] = useState(false);

  // Calcular valor por hora baseado no contrato
  const hourlyRate = contractedValue > 0 && contractedHours > 0 
    ? contractedValue / contractedHours 
    : 150; // Valor padrão de R$ 150/hora

  const calculatePhaseFinancials = async () => {
    if (phases.length === 0) return;
    
    setCalculating(true);
    const results: PhaseFinancialData[] = [];

    for (const phase of phases) {
      // Usar o valor por hora baseado no contrato, não no valor da fase
      const phaseHourlyRate = hourlyRate;
      
      let phaseData: PhaseFinancialData = {
        id: phase.id,
        phase_name: phase.phase_name,
        allocated_hours: phase.allocated_hours,
        executed_hours: phase.executed_hours,
        value_percentage: phase.value_percentage,
        assigned_profile: (phase as any).assigned_profile
      };

      if (phase.executed_hours > phase.allocated_hours) {
        // Fase com prejuízo (sempre mostrar se excedeu as horas)
        const lossData = await calculatePhaseLoss(phase.id);
        if (lossData) {
          phaseData.loss = lossData;
        } else {
          // Cálculo manual se a RPC não estiver disponível
          const excessHours = phase.executed_hours - phase.allocated_hours;
          phaseData.loss = {
            excess_hours: excessHours,
            hourly_value: phaseHourlyRate,
            total_loss: excessHours * phaseHourlyRate,
            loss_percentage: (excessHours / phase.allocated_hours) * 100
          };
        }
      } else if (phase.executed_hours < phase.allocated_hours && phase.status === 'completed') {
        // Fase com economia (só mostrar se a fase foi concluída)
        const savedHours = phase.allocated_hours - phase.executed_hours;
        phaseData.savings = {
          saved_hours: savedHours,
          hourly_value: phaseHourlyRate,
          total_savings: savedHours * phaseHourlyRate,
          savings_percentage: (savedHours / phase.allocated_hours) * 100
        };
      }

      results.push(phaseData);
    }

    setFinancialData(results);
    setCalculating(false);
  };

  useEffect(() => {
    calculatePhaseFinancials();
  }, [phases, contractedValue, contractedHours]);

  const totalLoss = financialData.reduce((sum, phase) => 
    sum + (phase.loss?.total_loss || 0), 0
  );

  const totalSavings = financialData.reduce((sum, phase) => 
    sum + (phase.savings?.total_savings || 0), 0
  );

  const netFinancialImpact = totalSavings - totalLoss;

  if (loading || calculating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Análise Financeira das Fases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Análise Financeira das Fases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Nenhuma fase configurada para análise financeira.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Análise Financeira das Fases
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={calculatePhaseFinancials}
            disabled={calculating}
          >
            Recalcular
          </Button>
        </div>
        
        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">Prejuízos</span>
            </div>
            <div className="text-lg font-bold text-red-700">
              R$ {totalLoss.toFixed(2)}
            </div>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Economias</span>
            </div>
            <div className="text-lg font-bold text-green-700">
              R$ {totalSavings.toFixed(2)}
            </div>
          </div>

          <div className={`p-3 border rounded-md ${
            netFinancialImpact >= 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`flex items-center gap-2 ${
              netFinancialImpact >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Impacto Líquido</span>
            </div>
            <div className={`text-lg font-bold ${
              netFinancialImpact >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {netFinancialImpact >= 0 ? '+' : ''}R$ {netFinancialImpact.toFixed(2)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {financialData.map((phase) => (
          <div key={phase.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">{phase.phase_name}</h4>
                {phase.assigned_profile && (
                  <p className="text-sm text-muted-foreground">
                    Responsável: {phase.assigned_profile.name}
                  </p>
                )}
              </div>
              
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {phase.executed_hours}h / {phase.allocated_hours}h
                </p>
                <p className="text-xs text-muted-foreground">
                  {phase.value_percentage}% do contrato
                </p>
              </div>
            </div>

            {/* Status da fase */}
            <div className="flex items-center gap-2">
              {phase.loss ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Prejuízo
                </Badge>
              ) : phase.savings ? (
                <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Economia (Concluída)
                </Badge>
              ) : phase.executed_hours === phase.allocated_hours && (phase as any).status === 'completed' ? (
                <Badge variant="secondary">
                  Executada no Prazo
                </Badge>
              ) : (
                <Badge variant="outline">
                  {(phase as any).status === 'completed' ? 'Concluída' : 
                   (phase as any).status === 'in_progress' ? 'Em Andamento' : 
                   (phase as any).status === 'pending' ? 'Pendente' : 'Cancelada'}
                </Badge>
              )}
            </div>

            {/* Detalhes financeiros */}
            {phase.loss && (
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                <div className="flex items-center gap-2 text-red-600 font-medium">
                  <TrendingDown className="h-4 w-4" />
                  Análise de Prejuízo
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Horas excedentes:</span>
                    <div className="font-medium">{phase.loss.excess_hours.toFixed(1)}h</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor/hora fase:</span>
                    <div className="font-medium">R$ {phase.loss.hourly_value.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prejuízo total:</span>
                    <div className="font-medium text-red-600">R$ {phase.loss.total_loss.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">% de excesso:</span>
                    <div className="font-medium text-red-600">{phase.loss.loss_percentage.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )}

            {phase.savings && (
              <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Análise de Economia
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Horas poupadas:</span>
                    <div className="font-medium">{phase.savings.saved_hours.toFixed(1)}h</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor/hora fase:</span>
                    <div className="font-medium">R$ {phase.savings.hourly_value.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Economia total:</span>
                    <div className="font-medium text-green-600">R$ {phase.savings.total_savings.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">% economizado:</span>
                    <div className="font-medium text-green-600">{phase.savings.savings_percentage.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-xs text-green-700 bg-green-100 p-2 rounded">
                  💡 Estas horas podem ser utilizadas em outras fases ou projetos
                </div>
              </div>
            )}

            {!phase.loss && !phase.savings && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="flex items-center gap-2 text-blue-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {phase.executed_hours === phase.allocated_hours && (phase as any).status === 'completed'
                      ? 'Fase executada exatamente no prazo previsto'
                      : (phase as any).status === 'completed'
                      ? 'Fase concluída'
                      : (phase as any).status === 'in_progress'
                      ? 'Fase em andamento - aguardando conclusão para análise final'
                      : 'Fase ainda não iniciada'
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Resumo e recomendações */}
        {netFinancialImpact !== 0 && (
          <div className={`p-4 rounded-lg border ${
            netFinancialImpact >= 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <h4 className={`font-medium mb-2 ${
              netFinancialImpact >= 0 ? 'text-green-800' : 'text-red-800'
            }`}>
              Resumo Financeiro do Projeto
            </h4>
            <p className={`text-sm ${
              netFinancialImpact >= 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {netFinancialImpact >= 0 
                ? `O projeto está gerando uma economia líquida de R$ ${netFinancialImpact.toFixed(2)}. As horas economizadas podem ser realocadas para outras atividades.`
                : `O projeto está com prejuízo líquido de R$ ${Math.abs(netFinancialImpact).toFixed(2)}. Considere revisar o planejamento das fases restantes para minimizar custos adicionais.`
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}