import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  Square, 
  Timer,
  History,
  Plus,
  Clock,
  AlertTriangle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/state/auth";
import { supabase } from "@/integrations/supabase/client";

interface ProjectTimerProps {
  projectId: string;
  onHoursUpdate: () => void;
}

export function ProjectTimer({ projectId, onHoursUpdate }: ProjectTimerProps) {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    checkActiveTimer();
  }, [projectId, user]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startTime]);

  const checkActiveTimer = async () => {
    if (!user || !projectId) return;

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .is('end_time', null)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const activeEntry = data[0];
        const start = new Date(activeEntry.start_time);
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
        
        setStartTime(start);
        setElapsedTime(elapsed);
        setIsRunning(true);
      } else {
        setIsRunning(false);
        setElapsedTime(0);
        setStartTime(null);
      }
    } catch (error) {
      console.error('Erro ao verificar timer ativo:', error);
    }
  };

  const startTimer = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const { error } = await supabase
        .from('time_entries')
        .insert({
          project_id: projectId,
          user_id: user.id,
          start_time: now.toISOString()
        });

      if (error) throw error;

      setStartTime(now);
      setElapsedTime(0);
      setIsRunning(true);
      
      toast({
        title: "Timer iniciado",
        description: "Cronômetro de horas começou a contar."
      });
    } catch (error) {
      console.error('Erro ao iniciar timer:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o timer.",
        variant: "destructive"
      });
    }
  };

  const stopTimer = async () => {
    if (!user || !startTime) return;

    try {
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      const durationMinutes = Math.floor(durationSeconds / 60);

      const { error } = await supabase
        .from('time_entries')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .is('end_time', null);

      if (error) throw error;

      setIsRunning(false);
      const hours = (durationMinutes / 60).toFixed(2);
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      setElapsedTime(0);
      setStartTime(null);
      onHoursUpdate();

      toast({
        title: "Timer parado",
        description: `Sessão de ${hours}h (${minutes}m ${seconds}s) registrada.`
      });
    } catch (error) {
      console.error('Erro ao parar timer:', error);
      toast({
        title: "Erro",
        description: "Não foi possível parar o timer.",
        variant: "destructive"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Timer principal */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-full">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Controle de Horas</p>
                {isRunning ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Em andamento
                    </Badge>
                    <span className="font-mono text-lg font-bold text-primary">
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Cronômetro parado</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isRunning ? (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={stopTimer}
                  className="gap-2"
                >
                  <Square className="h-4 w-4" />
                  Parar
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  onClick={startTimer}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-4 w-4" />
                  Iniciar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}