import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Edit, Trash2, ChevronLeft, ChevronRight, X, Gift, Download } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HolidayDialog } from "@/components/agenda/HolidayDialog";
import { HolidaySyncDialog } from "@/components/agenda/HolidaySyncDialog";
import { supabase } from "@/integrations/supabase/client";
import { useGradientDatabase } from "@/hooks/useGradientDatabase";

// Função para formatar data evitando problemas de timezone
const formatDateToLocalString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper para determinar quem deve aparecer baseado na hierarquia
const getAttendeesDisplay = (collaboratorsIds: string[], profiles: { id: string; name: string }[]): string => {
  if (!collaboratorsIds || collaboratorsIds.length === 0) return 'Colaborador';
  
  const profilesMap = new Map(profiles.map(p => [p.id, p.name]));
  const attendeeNames = collaboratorsIds.map(id => profilesMap.get(id)).filter(Boolean);
  
  // Prioridade 1: Débora e/ou Olevate
  const priority1 = attendeeNames.filter(name => name === 'Débora' || name === 'Olevate');
  if (priority1.length > 0) {
    return priority1.join(' e ');
  }
  
  // Prioridade 2: Mara e/ou Thuany
  const priority2 = attendeeNames.filter(name => name === 'Mara' || name === 'Thuany');
  if (priority2.length > 0) {
    return priority2.join(' e ');
  }
  
  // Fallback: "Colaborador"
  return 'Colaborador';
};
const agendaFormSchema = z.object({
  titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
  descricao: z.string().optional(),
  cliente: z.string().min(1, "Selecione um cliente"),
  tipo: z.enum(["reuniao_cliente", "visita_obra", "apresentacao", "aprovacao", "medicao"], {
    required_error: "Selecione um tipo de reunião"
  }),
  data: z.string().min(1, "Selecione uma data"),
  horario: z.string().min(1, "Selecione um horário"),
  horario_fim: z.string().optional(),
  local: z.string().optional(),
  agenda_type: z.enum(["pessoal", "compartilhada"], {
    required_error: "Selecione o setor da agenda"
  }),
  collaborators_ids: z.array(z.string()).default([])
});
interface AgendaItem {
  id: string;
  titulo: string;
  descricao?: string;
  cliente: string;
  tipo: "reuniao_cliente" | "visita_obra" | "apresentacao" | "aprovacao" | "medicao";
  data: string;
  horario: string;
  horario_fim?: string;
  local?: string;
  created_at: string;
  created_by: string;
  agenda_type: "pessoal" | "compartilhada";
  visibility: "private" | "team" | "public";
  collaborators_ids: string[];
  creator_name?: string;
  attendees_display?: string;
}
interface Holiday {
  id: string;
  name: string;
  date: string;
  is_national: boolean;
  description?: string;
}
interface Cliente {
  id: string;
  name: string;
}
interface Colaborador {
  id: string;
  user_id: string;
  name: string;
  email: string;
}
const tiposReuniao = [{
  value: "reuniao_cliente",
  label: "Reunião com Cliente",
  color: "bg-blue-500",
  gradient: "linear-gradient(135deg, #1e40af 0%, #3b82f6 30%, #60a5fa  70%, #93c5fd 100%)"
}, {
  value: "visita_obra",
  label: "Visita à Obra",
  color: "bg-green-500",
  gradient: "linear-gradient(135deg, #166534 0%, #16a34a 30%, #22c55e 70%, #4ade80 100%)"
}, {
  value: "apresentacao",
  label: "Apresentação de Projeto",
  color: "bg-purple-500",
  gradient: "linear-gradient(135deg, #6b21a8 0%, #8b5cf6 30%, #a78bfa 70%, #c4b5fd 100%)"
}, {
  value: "aprovacao",
  label: "Aprovação/Assinatura",
  color: "bg-yellow-500",
  gradient: "linear-gradient(135deg, #ca8a04 0%, #eab308 30%, #fbbf24 70%, #fde047 100%)"
}, {
  value: "medicao",
  label: "Medição/Vistoria",
  color: "bg-orange-500",
  gradient: "linear-gradient(135deg, #c2410c 0%, #ea580c 30%, #f97316 70%, #fb923c 100%)"
}];
export default function Agenda() {
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);
  const [isHolidaySyncDialogOpen, setIsHolidaySyncDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
    name: string;
    isMasterAdmin: boolean;
  } | null>(null);
  const [sectorFilter, setSectorFilter] = useState<'todos' | 'pessoal' | 'compartilhada'>('todos');

  // Hook para acessar as cores da paleta selecionada
  const {
    selectedGradient,
    gradientOptions
  } = useGradientDatabase();
  const form = useForm<z.infer<typeof agendaFormSchema>>({
    resolver: zodResolver(agendaFormSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      cliente: "",
      tipo: "reuniao_cliente",
      data: "",
      horario: "",
      horario_fim: "",
      local: "",
      agenda_type: "compartilhada",
      collaborators_ids: []
    }
  });
  const loadData = async () => {
    try {
      console.log('Carregando dados da agenda...');

      // Buscar usuário atual
      const {
        data: userData
      } = await supabase.auth.getUser();
      if (userData.user) {
        const {
          data: profileData
        } = await supabase.from('profiles').select('id, role, name').eq('user_id', userData.user.id).single();
        if (profileData) {
          const isMasterAdmin = profileData.role === 'admin' && (profileData.name === 'Débora' || profileData.name === 'Olevate');
          setCurrentUser({
            id: profileData.id,
            role: profileData.role,
            name: profileData.name,
            isMasterAdmin
          });
        }
      }
      console.log('Fazendo query simples para agenda...');
      // Buscar agendamentos - query simples sem joins
      const {
        data: agendaData,
        error: agendaError
      } = await supabase.from('agenda').select('*').order('data', {
        ascending: true
      }).order('horario', {
        ascending: true
      });
      console.log('Resultado da query agenda:', {
        agendaData,
        agendaError
      });
      if (agendaError) {
        console.error('Erro ao buscar agenda:', agendaError);
        throw agendaError;
      }

      // Buscar clientes
      const {
        data: clientesData,
        error: clientesError
      } = await supabase.from('clients').select('id, name').order('name');
      if (clientesError) {
        console.error('Erro ao buscar clientes:', clientesError);
        throw clientesError;
      }

      // Buscar colaboradores para mapear nomes dos criadores
      const {
        data: colaboradoresData,
        error: colaboradoresError
      } = await supabase.from('profiles').select('id, user_id, name, email').order('name');
      if (colaboradoresError) {
        console.error('Erro ao buscar colaboradores:', colaboradoresError);
        throw colaboradoresError;
      }

      // Buscar feriados
      const {
        data: holidaysData,
        error: holidaysError
      } = await supabase.from('holidays').select('*').order('date');
      if (holidaysError) {
        console.error('Erro ao buscar feriados:', holidaysError);
        throw holidaysError;
      }

      // Mapear dados incluindo nome do criador e attendees
      console.log('Mapeando nomes dos criadores...');
      const profilesMap = new Map(colaboradoresData?.map(p => [p.user_id, p.name]) || []);
      const profilesById = new Map(colaboradoresData?.map(p => [p.id, p.name]) || []);
      const mappedAgenda = agendaData?.map(item => ({
        ...item,
        creator_name: profilesMap.get(item.created_by) || 'Usuário desconhecido',
        attendees_display: getAttendeesDisplay(item.collaborators_ids || [], colaboradoresData || [])
      })) as AgendaItem[] || [];
      console.log('Dados carregados com sucesso:', {
        agenda: mappedAgenda.length,
        clientes: clientesData?.length,
        colaboradores: colaboradoresData?.length,
        feriados: holidaysData?.length
      });
      setAgenda(mappedAgenda);
      setClientes(clientesData || []);
      setColaboradores(colaboradoresData || []);
      setHolidays(holidaysData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da agenda.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, []);
  const onSubmit = async (values: z.infer<typeof agendaFormSchema>) => {
    try {
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user.user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado.",
          variant: "destructive"
        });
        return;
      }

      // Converter a data para o formato correto evitando problemas de timezone
      const localDate = new Date(values.data + 'T12:00:00');
      const formattedDate = localDate.toISOString().split('T')[0];
      const {
        data,
        error
      } = await supabase.from('agenda').insert({
        titulo: values.titulo,
        descricao: values.descricao,
        cliente: values.cliente,
        tipo: values.tipo,
        data: formattedDate,
        horario: values.horario,
        horario_fim: values.horario_fim,
        local: values.local,
        agenda_type: values.agenda_type,
        collaborators_ids: values.collaborators_ids,
        created_by: user.user.id
      }).select().single();
      if (error) throw error;
      setAgenda(prev => [...prev, data as AgendaItem]);
      toast({
        title: "Sucesso!",
        description: "Agendamento criado com sucesso."
      });
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar agendamento.",
        variant: "destructive"
      });
    }
  };
  const getTipoColor = (tipo: string) => {
    return tiposReuniao.find(t => t.value === tipo)?.color || "bg-gray-500";
  };
  const getTipoLabel = (tipo: string) => {
    return tiposReuniao.find(t => t.value === tipo)?.label || tipo;
  };
  const getTipoGradient = (tipo: string) => {
    return tiposReuniao.find(t => t.value === tipo)?.gradient || "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)";
  };
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, {
    weekStartsOn: 1
  }); // Segunda-feira
  const calendarEnd = endOfWeek(monthEnd, {
    weekStartsOn: 1
  });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });
  const getItemsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return agenda.filter(item => {
      if (item.data !== dayStr) return false;
      if (sectorFilter === 'todos') return true;
      return item.agenda_type === sectorFilter;
    });
  };
  const getHolidaysForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return holidays.filter(holiday => holiday.date === dayStr);
  };
  const handleItemClick = (item: AgendaItem) => {
    setSelectedItem(item);
    setIsDetailDialogOpen(true);
  };
  if (loading) {
    return <div className="space-y-6">
        <PageHeader title="Agenda" subtitle="Carregando..." />
      </div>;
  }
  return <div className="space-y-6">
      <PageHeader title="Agenda" subtitle="Organização de reuniões, visitas e apresentações" />
      
      <div className="space-y-4">
        {/* Primeira linha - Navegação do Calendário e Botão Novo Agendamento */}
        <div className="flex items-center justify-between gap-1.5 lg:gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="flex-shrink-0 min-w-[40px]">
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Mês Anterior</span>
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-shrink-0 min-w-[120px] lg:min-w-[140px] justify-center">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">
                    {format(currentMonth, "MMMM yyyy", {
                    locale: ptBR
                  })}
                  </span>
                  <span className="sm:hidden">
                    {format(currentMonth, "MM/yy", {
                    locale: ptBR
                  })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar mode="single" selected={currentMonth} onSelect={date => date && setCurrentMonth(date)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="flex-shrink-0 min-w-[40px]">
              <span className="hidden sm:inline mr-2">Próximo Mês</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="btn-hero flex-shrink-0 min-w-[40px]">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Novo Agendamento</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="titulo" render={({
                  field
                }) => <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Reunião inicial projeto casa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />

                  <FormField control={form.control} name="cliente" render={({
                  field
                }) => <FormItem>
                      <FormLabel>Cliente</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientes.map(cliente => <SelectItem key={cliente.id} value={cliente.name}>
                              {cliente.name}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>} />

                  <FormField control={form.control} name="tipo" render={({
                  field
                }) => <FormItem>
                      <FormLabel>Tipo de Reunião</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tiposReuniao.map(tipo => <SelectItem key={tipo.value} value={tipo.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded ${tipo.color}`}></div>
                                {tipo.label}
                              </div>
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>} />

                  <FormField control={form.control} name="agenda_type" render={({
                  field
                }) => <FormItem>
                      <FormLabel>Setor da Agenda</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o setor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pessoal">Setor Pessoal</SelectItem>
                          <SelectItem value="compartilhada">Setor Compartilhado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>} />

                  <FormField control={form.control} name="collaborators_ids" render={({
                  field
                }) => <FormItem>
                      <FormLabel>Colaboradores Envolvidos</FormLabel>
                      <div className="space-y-2">
                        {colaboradores.map(colaborador => <div key={colaborador.id} className="flex items-center space-x-2">
                            <input type="checkbox" id={`collaborator-${colaborador.id}`} checked={field.value.includes(colaborador.id)} onChange={e => {
                        const updatedValue = e.target.checked ? [...field.value, colaborador.id] : field.value.filter(id => id !== colaborador.id);
                        field.onChange(updatedValue);
                      }} className="rounded border-gray-300" />
                            <label htmlFor={`collaborator-${colaborador.id}`} className="text-sm font-medium">
                              {colaborador.name}
                            </label>
                          </div>)}
                      </div>
                      <FormMessage />
                    </FormItem>} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="data" render={({
                    field
                  }) => <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input type="date" placeholder="dd/mm/aaaa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="horario" render={({
                     field
                   }) => <FormItem>
                         <FormLabel>Horário de Início</FormLabel>
                         <FormControl>
                           <div className="relative">
                             <input 
                               type="time" 
                               step="300"
                               list="time-options"
                               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                               {...field}
                             />
                             <datalist id="time-options">
                               {Array.from({ length: 288 }, (_, i) => {
                                 const minutes = i * 5;
                                 const hours = Math.floor(minutes / 60);
                                 const mins = minutes % 60;
                                 const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                                 return <option key={time} value={time} />;
                               })}
                             </datalist>
                           </div>
                         </FormControl>
                         <FormMessage />
                       </FormItem>} />

                     <FormField control={form.control} name="horario_fim" render={({
                     field
                   }) => <FormItem>
                         <FormLabel>Horário de Término (Opcional)</FormLabel>
                         <FormControl>
                           <div className="relative">
                             <input 
                               type="time" 
                               step="300"
                               list="time-options-end"
                               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                               {...field}
                             />
                             <datalist id="time-options-end">
                               {Array.from({ length: 288 }, (_, i) => {
                                 const minutes = i * 5;
                                 const hours = Math.floor(minutes / 60);
                                 const mins = minutes % 60;
                                 const time = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                                 return <option key={time} value={time} />;
                               })}
                             </datalist>
                           </div>
                         </FormControl>
                         <FormMessage />
                       </FormItem>} />
                  </div>

                  <FormField control={form.control} name="local" render={({
                  field
                }) => <FormItem>
                      <FormLabel>Local</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Escritório, Rua das Flores 123..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />

                  <FormField control={form.control} name="descricao" render={({
                  field
                }) => <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Detalhes adicionais sobre a reunião..." className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>} />

                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 btn-hero-static">
                      Agendar
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Segunda linha - Filtros e Botões de Feriados */}
        <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
          {/* Filtro de Setor */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Select value={sectorFilter} onValueChange={(value: 'todos' | 'pessoal' | 'compartilhada') => setSectorFilter(value)}>
              <SelectTrigger className="w-[140px] sm:w-[160px] lg:w-[180px] flex-shrink-0">
                <SelectValue placeholder="Filtrar por setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-muted"></div>
                    Todos os Setores
                  </div>
                </SelectItem>
                <SelectItem value="pessoal">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-yellow-500"></div>
                    Setor Pessoal
                  </div>
                </SelectItem>
                <SelectItem value="compartilhada">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    Setor Compartilhado
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões de Feriados */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            
            
            <Button variant="outline" size="sm" onClick={() => setIsHolidayDialogOpen(true)} className="flex-shrink-0 min-w-[40px]">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Novo Feriado</span>
            </Button>
          </div>
          
          {/* Status do usuário atual */}
          {currentUser && <div className="text-xs lg:text-sm text-muted-foreground hidden xl:block flex-shrink-0 ml-auto">
              {currentUser.name}
            </div>}
        </div>
      </div>

      {/* Calendário mensal */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 bg-card rounded-lg border p-4 min-w-fit">
          {/* Cabeçalho dos dias da semana */}
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <div key={day} className="text-center text-sm font-medium p-2 text-muted-foreground min-w-[120px]">
              {day}
            </div>)}
          
          {/* Dias do mês */}
          {calendarDays.map(day => {
          const dayItems = getItemsForDay(day);
          const dayHolidays = getHolidaysForDay(day);
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const hasHoliday = dayHolidays.length > 0;
          return <div key={day.toISOString()} className={`min-h-[120px] min-w-[120px] p-2 border rounded-md ${isToday ? 'bg-primary/20 border-primary' : hasHoliday ? 'bg-brand/10 border-brand/30' : 'bg-primary/10 border-primary/30'} ${!isCurrentMonth ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-sm font-medium ${isToday ? 'text-primary' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  {hasHoliday && <Gift className="h-3 w-3" style={{
                color: `hsl(var(--brand))`
              }} />}
                </div>
                 
                {/* Feriados */}
                {dayHolidays.map(holiday => <div key={holiday.id} className="text-xs rounded p-1 mb-1 border" style={{
              backgroundColor: `hsl(var(--brand) / 0.1)`,
              borderColor: `hsl(var(--brand) / 0.3)`,
              color: `hsl(var(--brand))`
            }}>
                    <div className="font-medium truncate" title={holiday.name}>
                      {holiday.name}
                    </div>
                  </div>)}
                
                <div className="space-y-1">
                  {dayItems.map(item => <div key={item.id} onClick={() => handleItemClick(item)} className="text-xs rounded border cursor-pointer hover:opacity-90 transition-opacity overflow-hidden">
                      <div className={`p-2 rounded-t ${getTipoColor(item.tipo)} text-white overflow-hidden`}>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="block truncate font-medium text-white flex-1" title={item.titulo}>
                            {item.titulo}
                          </span>
                          {item.agenda_type === 'compartilhada' && item.attendees_display && (
                            <span className="text-xs text-white/80 flex-shrink-0">
                              {item.attendees_display}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-1 bg-background text-muted-foreground flex items-center gap-1 rounded-b">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {item.horario.substring(0, 5)}
                          {item.horario_fim && ` - ${item.horario_fim.substring(0, 5)}`}
                        </span>
                      </div>
                    </div>)}
                </div>
              </div>;
        })}
        </div>
      </div>

      {/* Modal de detalhes do compromisso */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg p-[4px] rounded-lg overflow-hidden border-0" style={{
        background: selectedItem ? getTipoGradient(selectedItem.tipo) : undefined
      }}>
          {selectedItem && <div className="bg-background rounded-lg overflow-hidden">
              {/* Header com gradiente na cor do tipo */}
              <div className="relative p-8 rounded-t-lg overflow-hidden">
                {/* Fundo gradiente monocromático baseado no tipo */}
                <div className="absolute inset-0" style={{
              background: getTipoGradient(selectedItem.tipo)
            }} />
                
                {/* Overlay sutil para melhor legibilidade */}
                <div className="absolute inset-0 bg-black/10" />
                
                {/* Botão de fechar */}
                <Button variant="ghost" size="sm" className="absolute top-4 right-4 z-20 h-10 w-10 p-0 text-white hover:bg-white/20 hover:text-white rounded-full transition-all duration-200 hover:scale-110" onClick={() => setIsDetailDialogOpen(false)}>
                  <X className="h-6 w-6" />
                </Button>
                
                {/* Conteúdo do header */}
                <div className="relative z-10 text-center space-y-4">
                  <div className="text-2xl font-semibold text-white">
                    Detalhes do Agendamento
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-3xl font-bold text-white leading-tight">
                      {selectedItem.titulo}
                    </h3>
                    <div className="flex justify-center">
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                        {getTipoLabel(selectedItem.tipo)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className={`w-5 h-5 rounded-full ${selectedItem.agenda_type === 'pessoal' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Setor</p>
                        <p className="font-semibold text-foreground">
                          {selectedItem.agenda_type === 'pessoal' ? 'Pessoal' : 'Compartilhado'}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Criado por</p>
                        <p className="font-semibold text-foreground">
                          {selectedItem.creator_name}
                          {currentUser?.isMasterAdmin && <Badge variant="secondary" className="ml-2 text-xs bg-brand/10 text-brand border-brand/20">
                              {selectedItem.creator_name === 'Débora' || selectedItem.creator_name === 'Olevate' ? 'Master' : 'User'}
                            </Badge>}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Informações principais em cards */}
                <div className="grid gap-4">
                  {/* Cliente */}
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-primary/20"></div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cliente</p>
                        <p className="font-semibold text-foreground">{selectedItem.cliente}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Data e Horário */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <CalendarIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Data</p>
                          <p className="font-semibold text-foreground">
                            {format(new Date(selectedItem.data), "dd/MM/yyyy", {
                          locale: ptBR
                        })}
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Horário</p>
                          <p className="font-semibold text-foreground">
                            {selectedItem.horario.substring(0, 5)}
                            {selectedItem.horario_fim && ` - ${selectedItem.horario_fim.substring(0, 5)}`}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Local */}
                  {selectedItem.local && <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Local</p>
                          <p className="font-semibold text-foreground">{selectedItem.local}</p>
                        </div>
                      </div>
                    </Card>}

                  {/* Observações */}
                  {selectedItem.descricao && <Card className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <div className="w-5 h-5 rounded bg-primary/20"></div>
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">Observações</p>
                        </div>
                        <p className="text-foreground leading-relaxed pl-13">
                          {selectedItem.descricao}
                        </p>
                      </div>
                    </Card>}
                </div>

                {/* Ações */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" className="flex-1 h-11">
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button variant="outline" className="flex-1 h-11 text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>}
        </DialogContent>
      </Dialog>

      {/* Lista de próximos agendamentos */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Próximos Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agenda.filter(item => {
            if (sectorFilter === 'todos') return true;
            return item.agenda_type === sectorFilter;
          }).slice(0, 5).map(item => <div key={item.id} className="group flex items-center justify-between p-4 border rounded-xl hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200 hover:border-primary/30 cursor-pointer" onClick={() => handleItemClick(item)}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                      <div className={`w-6 h-6 rounded-full ${getTipoColor(item.tipo)}`}></div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-background rounded-full border-2 border-background flex items-center justify-center">
                      <CalendarIcon className="w-2 h-2 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.titulo}
                      </div>
                      <Badge variant="secondary" className={`text-xs ${item.agenda_type === 'pessoal' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20'}`}>
                        {item.agenda_type === 'pessoal' ? 'Pessoal' : 'Compartilhado'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{item.cliente}</span> • {format(new Date(item.data), "dd/MM/yyyy")} às {item.horario.substring(0, 5)}
                      {item.horario_fim && ` - ${item.horario_fim.substring(0, 5)}`}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Participantes: {item.attendees_display}
                      {currentUser?.isMasterAdmin && <Badge variant="secondary" className="ml-2 text-xs bg-brand/10 text-brand border-brand/20">
                          {item.creator_name === 'Débora' || item.creator_name === 'Olevate' ? 'Master' : 'User'}
                        </Badge>}
                    </div>
                    {item.local && <div className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                        <MapPin className="w-3 h-3" />
                        {item.local}
                      </div>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="secondary" className={`${getTipoColor(item.tipo)} text-white border-transparent font-medium`}>
                    {getTipoLabel(item.tipo)}
                  </Badge>
                </div>
              </div>)}
            
            {agenda.length === 0 && <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div className="font-medium mb-2">Nenhum agendamento encontrado</div>
                <div className="text-sm">Clique em "Novo Agendamento" para começar</div>
              </div>}
          </div>
        </CardContent>
      </Card>
      
      <HolidayDialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen} onHolidayCreated={loadData} />
      
      <HolidaySyncDialog open={isHolidaySyncDialogOpen} onOpenChange={setIsHolidaySyncDialogOpen} onHolidaysSynced={loadData} />
    </div>;
}