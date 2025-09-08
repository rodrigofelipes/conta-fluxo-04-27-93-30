import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  CheckCircle, 
  Timer, 
  AlertTriangle, 
  TrendingDown,
  DollarSign,
  Pause
} from 'lucide-react';
import { useIntelligentPhases } from '@/hooks/useIntelligentPhases';

interface IntelligentProjectSummaryProps {
  projectId: string;
  projectTitle: string;
  contractedValue: number;
}

export function IntelligentProjectSummary({ 
  projectId, 
  projectTitle, 
  contractedValue 
}: IntelligentProjectSummaryProps) {
  const {
    phases,
    loading,
    pendingPhases,
    inProgressPhases,
    completedPhases,
    phasesWithLoss,
    projectProgress,
    getTotalProjectLoss
  } = useIntelligentPhases(projectId);

  const [totalLoss, setTotalLoss] = useState<number>(0);

  useEffect(() => {
    const calculateLoss = async () => {
      const loss = await getTotalProjectLoss();
      setTotalLoss(loss);
    };
    
    if (phasesWithLoss.length > 0) {
      calculateLoss();
    }
  }, [phasesWithLoss, getTotalProjectLoss]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (phasesWithLoss.length > 0) return 'text-red-600';
    if (inProgressPhases.length > 0) return 'text-blue-600';
    if (completedPhases.length === phases.length && phases.length > 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getStatusMessage = () => {
    if (phasesWithLoss.length > 0) return `${phasesWithLoss.length} fase(s) com prejuízo`;
    if (inProgressPhases.length > 0) return `${inProgressPhases.length} fase(s) em andamento`;
    if (completedPhases.length === phases.length && phases.length > 0) return 'Projeto concluído';
    return `${pendingPhases.length} fase(s) pendente(s)`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{projectTitle}</CardTitle>
          <Badge 
            variant="outline" 
            className={`${getStatusColor()} border-current`}
          >
            {getStatusMessage()}
          </Badge>
        </div>
        
        {/* Project Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span>Progresso do Projeto</span>
            <span className="font-medium">{projectProgress}%</span>
          </div>
          <Progress 
            value={projectProgress} 
            className={`h-2 ${phasesWithLoss.length > 0 ? 'bg-red-50' : ''}`}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Phase Status Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
            <Pause className="h-4 w-4 text-gray-600" />
            <div>
              <div className="text-lg font-semibold">{pendingPhases.length}</div>
              <div className="text-xs text-muted-foreground">Pendentes</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md">
            <Timer className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-lg font-semibold">{inProgressPhases.length}</div>
              <div className="text-xs text-muted-foreground">Em Andamento</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-md">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-lg font-semibold">{completedPhases.length}</div>
              <div className="text-xs text-muted-foreground">Concluídas</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div>
              <div className="text-lg font-semibold">{phasesWithLoss.length}</div>
              <div className="text-xs text-muted-foreground">Com Prejuízo</div>
            </div>
          </div>
        </div>

        {/* Financial Impact */}
        {totalLoss > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-800">Impacto Financeiro</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Prejuízo Total:</div>
                <div className="font-semibold text-red-600 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {totalLoss.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">% do Contrato:</div>
                <div className="font-semibold text-red-600">
                  {contractedValue > 0 ? ((totalLoss / contractedValue) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {phases.length > 0 && completedPhases.length === phases.length && phasesWithLoss.length === 0 && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">
                Projeto concluído com sucesso sem prejuízos!
              </span>
            </div>
          </div>
        )}

        {/* No phases message */}
        {phases.length === 0 && (
          <div className="text-center p-4 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma fase configurada para este projeto.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}