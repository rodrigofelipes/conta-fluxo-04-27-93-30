import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Plus, 
  CheckCircle, 
  AlertCircle,
  Building,
  FileText,
  Users,
  X
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TimelineEvent {
  id: string;
  type: "task" | "meeting" | "milestone" | "note";
  title: string;
  description?: string;
  date: string;
  status: "completed" | "in_progress" | "pending";
  duration?: number; // em minutos
}

interface ProjectTimelineProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectTimeline({ projectId, projectTitle, open, onOpenChange }: ProjectTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState<{
    type: "task" | "meeting" | "milestone" | "note";
    title: string;
    description: string;
    date: string;
    duration: string;
  }>({
    type: "task",
    title: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    duration: ""
  });

  // Mock data para demonstração
  useEffect(() => {
    if (open) {
      setEvents([
        {
          id: "1",
          type: "milestone",
          title: "Projeto iniciado",
          description: "Início oficial do projeto arquitetônico",
          date: "2024-01-15",
          status: "completed"
        },
        {
          id: "2",
          type: "meeting",
          title: "Reunião inicial com cliente",
          description: "Discussão dos requisitos e expectativas do projeto",
          date: "2024-01-18",
          status: "completed",
          duration: 120
        },
        {
          id: "3",
          type: "task",
          title: "Levantamento topográfico",
          description: "Medições e análise do terreno",
          date: "2024-01-25",
          status: "completed",
          duration: 480
        },
        {
          id: "4",
          type: "task",
          title: "Desenvolvimento do projeto básico",
          description: "Criação dos desenhos preliminares",
          date: "2024-02-01",
          status: "in_progress",
          duration: 360
        },
        {
          id: "5",
          type: "meeting",
          title: "Apresentação do projeto básico",
          description: "Revisão e aprovação do projeto preliminar",
          date: "2024-02-15",
          status: "pending",
          duration: 90
        }
      ]);
    }
  }, [open]);

  const getEventIcon = (type: string, status: string) => {
    if (status === "completed") {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    switch (type) {
      case "task":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "meeting":
        return <Users className="h-4 w-4 text-purple-600" />;
      case "milestone":
        return <Building className="h-4 w-4 text-orange-600" />;
      case "note":
        return <FileText className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: { label: "Concluído", variant: "default" as const, class: "bg-green-100 text-green-800 border-green-200" },
      in_progress: { label: "Em Andamento", variant: "secondary" as const, class: "bg-blue-100 text-blue-800 border-blue-200" },
      pending: { label: "Pendente", variant: "outline" as const, class: "bg-yellow-100 text-yellow-800 border-yellow-200" }
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    return (
      <Badge variant={config.variant} className={config.class}>
        {config.label}
      </Badge>
    );
  };

  const handleAddEvent = () => {
    if (!newEvent.title) {
      toast({
        title: "Erro",
        description: "Título do evento é obrigatório",
        variant: "destructive"
      });
      return;
    }

    const event: TimelineEvent = {
      id: Date.now().toString(),
      type: newEvent.type,
      title: newEvent.title,
      description: newEvent.description,
      date: newEvent.date,
      status: "pending",
      duration: newEvent.duration ? parseInt(newEvent.duration) : undefined
    };

    setEvents(prev => [...prev, event].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    setNewEvent({
      type: "task",
      title: "",
      description: "",
      date: new Date().toISOString().split('T')[0],
      duration: ""
    });
    setShowAddEvent(false);
    
    toast({
      title: "Sucesso",
      description: "Evento adicionado à timeline"
    });
  };

  const completedEvents = events.filter(e => e.status === "completed").length;
  const totalEvents = events.length;
  const progress = totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">{projectTitle}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Timeline do Projeto</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Progress Overview */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Progresso Geral</span>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {completedEvents} de {totalEvents} eventos
                </span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">
                {progress.toFixed(0)}% do projeto concluído
              </p>
            </CardContent>
          </Card>

          {/* Timeline */}
          <ScrollArea className="flex-1 h-[400px]">
            <div className="space-y-4 pr-4">
              {/* Add Event Button */}
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Linha do Tempo</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowAddEvent(!showAddEvent)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Evento
                </Button>
              </div>

              {/* Add Event Form */}
              {showAddEvent && (
                <Card className="border-dashed border-2 border-primary/30">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Título *</Label>
                        <Input 
                          value={newEvent.title}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Ex: Reunião com cliente"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={newEvent.type}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value as "task" | "meeting" | "milestone" | "note" }))}
                        >
                          <option value="task">Tarefa</option>
                          <option value="meeting">Reunião</option>
                          <option value="milestone">Marco</option>
                          <option value="note">Anotação</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Data</Label>
                        <Input 
                          type="date"
                          value={newEvent.date}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duração (minutos)</Label>
                        <Input 
                          type="number"
                          value={newEvent.duration}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, duration: e.target.value }))}
                          placeholder="Ex: 120"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Descrição</Label>
                        <Textarea 
                          value={newEvent.description}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Detalhes do evento..."
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button onClick={handleAddEvent} size="sm">
                        Adicionar
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddEvent(false)} size="sm">
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline Events */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>
                
                <div className="space-y-6">
                  {events.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full border-4 border-background ${
                        event.status === 'completed' 
                          ? 'bg-green-100 dark:bg-green-900/40' 
                          : event.status === 'in_progress' 
                          ? 'bg-blue-100 dark:bg-blue-900/40' 
                          : 'bg-yellow-100 dark:bg-yellow-900/40'
                      } flex items-center justify-center z-10`}>
                        {getEventIcon(event.type, event.status)}
                      </div>

                      {/* Event card */}
                      <Card className="flex-1 border-2 border-border/50 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold">{event.title}</h4>
                                {getStatusBadge(event.status)}
                              </div>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mb-3">
                                  {event.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(event.date).toLocaleDateString('pt-BR')}
                                </div>
                                {event.duration && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {event.duration}min
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>

              {events.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum evento na timeline ainda.</p>
                  <p className="text-sm">Adicione o primeiro evento para começar o acompanhamento.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}