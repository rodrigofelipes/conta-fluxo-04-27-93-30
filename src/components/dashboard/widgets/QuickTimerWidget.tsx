import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Timer, Play, Square, Clock } from "lucide-react";
import { useAuth } from "@/state/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Project {
  id: string;
  title: string;
}

interface QuickTimerWidgetProps {
  projects: Project[];
  onHoursUpdate?: () => void;
}

export function QuickTimerWidget({ projects, onHoursUpdate }: QuickTimerWidgetProps) {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [currentProjectTitle, setCurrentProjectTitle] = useState<string>("");

  useEffect(() => {
    checkActiveTimer();
  }, [user]);

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
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*, projects!inner(title)')
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
        setSelectedProject(activeEntry.project_id);
        setCurrentProjectTitle((activeEntry.projects as any)?.title || 'Projeto');
      } else {
        setIsRunning(false);
        setElapsedTime(0);
        setStartTime(null);
        setCurrentProjectTitle("");
      }
    } catch (error) {
      console.error('Erro ao verificar timer ativo:', error);
    }
  };

  const startTimer = async () => {
    if (!user || !selectedProject) return;

    try {
      const now = new Date();
      const { error } = await supabase
        .from('time_entries')
        .insert({
          project_id: selectedProject,
          user_id: user.id,
          start_time: now.toISOString()
        });

      if (error) throw error;

      const projectTitle = projects.find(p => p.id === selectedProject)?.title || 'Projeto';
      
      setStartTime(now);
      setElapsedTime(0);
      setIsRunning(true);
      setCurrentProjectTitle(projectTitle);
      
      toast({
        title: "Timer iniciado",
        description: `Cronômetro para "${projectTitle}" iniciado.`
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
        .eq('user_id', user.id)
        .is('end_time', null);

      if (error) throw error;

      setIsRunning(false);
      const hours = (durationMinutes / 60).toFixed(2);
      setElapsedTime(0);
      setStartTime(null);
      setCurrentProjectTitle("");
      onHoursUpdate?.();

      toast({
        title: "Timer parado",
        description: `Sessão de ${hours}h registrada.`
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
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="size-5" />
          Timer Rápido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isRunning && (
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isRunning && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Trabalhando em:</p>
            <p className="font-medium mb-4">{currentProjectTitle}</p>
            <div className="font-mono text-2xl font-bold text-primary mb-4">
              {formatTime(elapsedTime)}
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Em andamento
            </Badge>
          </div>
        )}

        <div className="flex justify-center">
          {isRunning ? (
            <Button 
              onClick={stopTimer}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <Square className="size-4" />
              Parar Timer
            </Button>
          ) : (
            <Button 
              onClick={startTimer}
              disabled={!selectedProject}
              size="lg"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Play className="size-4" />
              Iniciar Timer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}