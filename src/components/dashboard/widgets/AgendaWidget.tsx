import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";

interface AgendaItem {
  id: string;
  titulo: string;
  descricao?: string;
  data: string;
  horario: string;
  horario_fim?: string;
  tipo: string;
  cliente: string;
  created_by_name?: string;
  attendees_display?: string;
}

interface AgendaWidgetProps {
  meetings: AgendaItem[];
  loading?: boolean;
}

export function AgendaWidget({ meetings, loading }: AgendaWidgetProps) {
  const formatDate = (dateStr: string) => {
    // Parse seguro para evitar offset UTC -> local
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr) - 1; // Date usa 0-11
    const day = Number(dayStr);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case 'reunião': return 'bg-blue-100 text-blue-800';
      case 'visita': return 'bg-green-100 text-green-800';
      case 'ligação': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Agenda
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center responsive-gap-sm">
          <Calendar className="size-4 sm:size-5 flex-shrink-0" />
          <span className="responsive-text-lg">Próximos Compromissos</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="responsive-padding-sm">
        {meetings.length > 0 ? (
          <div className="space-y-4">
            {(() => {
              const today = new Date();
              const todayStr = today.toISOString().split('T')[0];
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().split('T')[0];

              const todayMeetings = meetings.filter(m => m.data === todayStr);
              const tomorrowMeetings = meetings.filter(m => m.data === tomorrowStr);

              return (
                <>
                  {todayMeetings.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
                      {todayMeetings.map((meeting) => (
                        <div key={meeting.id} className="flex items-start responsive-gap-sm p-2 sm:p-3 rounded-lg hover:bg-accent/50 transition-colors border border-border/40">
                          <div className="flex-shrink-0 text-center min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-primary">
                              {formatDate(meeting.data)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs sm:text-sm font-medium truncate">
                                {meeting.titulo}
                              </p>
                              {meeting.attendees_display && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  "{meeting.attendees_display}"
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mb-2">
                              <Clock className="size-3 flex-shrink-0 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {meeting.horario}
                                {meeting.horario_fim && ` - ${meeting.horario_fim}`}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {meeting.cliente}
                            </p>
                            {meeting.descricao && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {meeting.descricao}
                              </p>
                            )}
                            <Badge 
                              variant="outline" 
                              className={`mt-2 text-xs ${getTipoColor(meeting.tipo)}`}
                            >
                              {meeting.tipo}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {todayMeetings.length > 0 && tomorrowMeetings.length > 0 && (
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/30"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-background px-3 text-xs text-muted-foreground">Amanhã</span>
                      </div>
                    </div>
                  )}

                  {tomorrowMeetings.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
                      {tomorrowMeetings.map((meeting) => (
                        <div key={meeting.id} className="flex items-start responsive-gap-sm p-2 sm:p-3 rounded-lg hover:bg-accent/50 transition-colors border border-border/40">
                          <div className="flex-shrink-0 text-center min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-primary">
                              {formatDate(meeting.data)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs sm:text-sm font-medium truncate">
                                {meeting.titulo}
                              </p>
                              {meeting.attendees_display && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  "{meeting.attendees_display}"
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mb-2">
                              <Clock className="size-3 flex-shrink-0 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {meeting.horario}
                                {meeting.horario_fim && ` - ${meeting.horario_fim}`}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {meeting.cliente}
                            </p>
                            {meeting.descricao && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {meeting.descricao}
                              </p>
                            )}
                            <Badge 
                              variant="outline" 
                              className={`mt-2 text-xs ${getTipoColor(meeting.tipo)}`}
                            >
                              {meeting.tipo}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
            Nenhum compromisso agendado
          </p>
        )}
      </CardContent>
    </Card>
  );
}