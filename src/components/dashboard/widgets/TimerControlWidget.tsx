import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timer, Users, Clock, Activity } from "lucide-react";
import { useTeamTimers } from "@/hooks/useTeamTimers";

export function TimerControlWidget() {
  const { activeTimers, teamActivity, loading } = useTeamTimers();

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="size-5" />
            Controle de Timers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Timers Ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="size-5" />
            Timers Ativos ({activeTimers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTimers.length > 0 ? (
            <div className="space-y-3">
              {activeTimers.map((timer) => (
                <div key={timer.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {timer.user_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {timer.project_title}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 font-mono">
                      {formatTime(timer.elapsed_seconds)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum timer ativo
            </p>
          )}
        </CardContent>
      </Card>

      {/* Atividade da Equipe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Atividade da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamActivity.length > 0 ? (
            <div className="space-y-3">
              {teamActivity.slice(0, 5).map((activity) => (
                <div key={activity.user_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.user_name}
                    </p>
                    {activity.active_project && (
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.active_project}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="size-3" />
                      <span>Hoje: {activity.total_hours_today.toFixed(1)}h</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Semana: {activity.total_hours_week.toFixed(1)}h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atividade registrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}