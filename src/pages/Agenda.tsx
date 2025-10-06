import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Gift,
  NotebookPen
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  startOfWeek,
  endOfWeek,
  addDays, // 👈 ADICIONADO
} from "date-fns";
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

const parseDateStringSafely = (value?: string | null) => {
  if (!value) return null;
  return new Date(`${value}T12:00:00`);
};

const formatDisplayDate = (value?: string | null) => {
  const parsed = parseDateStringSafely(value);
  if (!parsed) return "";
  return format(parsed, "dd/MM/yyyy", { locale: ptBR });
};

const formatDisplayDateRange = (start?: string | null, end?: string | null) => {
  const startDate = parseDateStringSafely(start);
  const endDate = parseDateStringSafely(end || start);

  if (!startDate || !endDate) return "";

  const sameDay = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");
  if (sameDay) {
    return format(startDate, "dd/MM/yyyy", { locale: ptBR });
  }

  return `${format(startDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;
};

// Helper para determinar quem deve aparecer baseado na hierarquia
const getAttendeesDisplay = (collaboratorsIds: string[], profiles: { id: string; name: string }[]): string => {
  if (!collaboratorsIds || collaboratorsIds.length === 0) return 'Colaborador';
  
  const profilesMap = new Map(profiles.map(p => [p.id, p.name]));
  const attendeeNames = collaboratorsIds.map(id => profilesMap.get(id)).filter(Boolean) as string[];
  
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

const INTERNAL_MEETING_PLACEHOLDER = "Reunião Interna";

const sanitizeOptionalString = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const agendaFormSchema = z
  .object({
    titulo: z.string().min(2, "Título deve ter pelo menos 2 caracteres"),
    descricao: z.string().optional(),
    cliente: z.string().optional(),
    tipo: z.enum(["reuniao_cliente", "visita_obra", "apresentacao", "aprovacao", "medicao"], {
      required_error: "Selecione um tipo de reunião"
    }),
    data: z.string().min(1, "Selecione uma data"),
    data_fim: z.string().min(1, "Selecione a data de término"),
    horario: z.string().min(1, "Selecione um horário"),
    horario_fim: z.string().optional(),
    local: z.string().optional(),
    agenda_type: z.enum(["pessoal", "compartilhada"], {
      required_error: "Selecione o setor da agenda"
    }),
    collaborators_ids: z.array(z.string()).default([]),
    isInternalMeeting: z.boolean().default(false),
    external_location: z.boolean().default(false),
    distance_km: z.number().optional(),
    travel_cost: z.number().optional()
  })
  .superRefine((data, ctx) => {
    if (!data.isInternalMeeting && (!data.cliente || data.cliente.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cliente"],
        message: "Selecione um cliente"
      });
    }

    if (data.data && data.data_fim && data.data_fim < data.data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data_fim"],
        message: "Data de término não pode ser anterior à data de início"
      });
    }
  });

interface AgendaItem {
  id: string;
  titulo: string;
  descricao?: string;
  cliente: string;
  tipo: "reuniao_cliente" | "visita_obra" | "apresentacao" | "aprovacao" | "medicao";
  data: string;
  data_fim?: string | null;
  horario: string;
  horario_fim?: string | null;
  local?: string;
  created_at: string;
  created_by: string;
  agenda_type: "pessoal" | "compartilhada";
  visibility: "private" | "team" | "public";
  collaborators_ids: string[];
  creator_name?: string;
  attendees_display?: string;
  external_location?: boolean;
  distance_km?: number;
  travel_cost?: number;
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

type MinutesGroup = {
  type: AgendaItem["tipo"];
  locations: {
    location: string;
    items: AgendaItem[];
  }[];
};

const tiposReuniao = [
  {
    value: "reuniao_cliente",
    label: "Reunião com Cliente",
    color: "bg-blue-500",
    gradient: "linear-gradient(135deg, #1e40af 0%, #3b82f6 30%, #60a5fa  70%, #93c5fd 100%)"
  },
  {
    value: "visita_obra",
    label: "Visita à Obra",
    color: "bg-green-500",
    gradient: "linear-gradient(135deg, #166534 0%, #16a34a 30%, #22c55e 70%, #4ade80 100%)"
  },
  {
    value: "apresentacao",
    label: "Apresentação de Projeto",
    color: "bg-purple-500",
    gradient: "linear-gradient(135deg, #6b21a8 0%, #8b5cf6 30%, #a78bfa 70%, #c4b5fd 100%)"
  },
  {
    value: "aprovacao",
    label: "Aprovação/Assinatura",
    color: "bg-yellow-500",
    gradient: "linear-gradient(135deg, #ca8a04 0%, #eab308 30%, #fbbf24 70%, #fde047 100%)"
  },
  {
    value: "medicao",
    label: "Medição/Vistoria",
    color: "bg-orange-500",
    gradient: "linear-gradient(135deg, #c2410c 0%, #ea580c 30%, #f97316 70%, #fb923c 100%)"
  }
];

const locaisReuniao = [
  { value: "Sala de reunião", label: "Sala de reunião" },
  { value: "Sala 5º andar", label: "Sala 5º andar" },
  { value: "Sala Olevate", label: "Sala Olevate" },
  { value: "Sala Débora", label: "Sala Débora" }
];

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
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AgendaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
    name: string;
    isMasterAdmin: boolean;
  } | null>(null);
  const [sectorFilter, setSectorFilter] = useState<'todos' | 'pessoal' | 'compartilhada'>('todos');
  const [activeTab, setActiveTab] = useState<'agenda' | 'atas'>('agenda');
  const [minutesTypeFilter, setMinutesTypeFilter] = useState<'all' | AgendaItem['tipo']>('all');
  const [minutesLocationFilter, setMinutesLocationFilter] = useState<'all' | string>('all');
  const [isMinutesDialogOpen, setIsMinutesDialogOpen] = useState(false);
  const [selectedMinutesMeetingId, setSelectedMinutesMeetingId] = useState("");
  const [selectedMinutesMeeting, setSelectedMinutesMeeting] = useState<AgendaItem | null>(null);
  const [minutesText, setMinutesText] = useState("");
  const [isSavingMinutes, setIsSavingMinutes] = useState(false);





  // Hook para acessar as cores da paleta selecionada
  const { selectedGradient, gradientOptions } = useGradientDatabase();

  const defaultFormValues: z.infer<typeof agendaFormSchema> = {
    titulo: "",
    descricao: "",
    cliente: "",
    tipo: "reuniao_cliente",
    data: "",
    data_fim: "",
    horario: "",
    horario_fim: "",
    local: "",
    agenda_type: "compartilhada",
    collaborators_ids: [],
    isInternalMeeting: false,
    external_location: false,
    distance_km: 0,
    travel_cost: 0
  };

  const form = useForm<z.infer<typeof agendaFormSchema>>({
    resolver: zodResolver(agendaFormSchema),
    defaultValues: defaultFormValues
  });

  const resetFormToDefault = () => {
    form.reset(defaultFormValues);
    setEditingItem(null);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetFormToDefault();
  };

  const isInternalMeeting = form.watch("isInternalMeeting");
  const isExternalLocation = form.watch("external_location");
  const startDateValue = form.watch("data");
  const endDateValue = form.watch("data_fim");
  const distanceKm = form.watch("distance_km");

  useEffect(() => {
    if (isInternalMeeting) {
      form.setValue("cliente", "");
      form.clearErrors("cliente");
    }
  }, [isInternalMeeting, form]);

  useEffect(() => {
    if (!startDateValue) {
      return;
    }

    if (!endDateValue || endDateValue < startDateValue) {
      form.setValue("data_fim", startDateValue, { shouldValidate: true });
    }
  }, [startDateValue, endDateValue, form]);

  // Calcular automaticamente o custo de deslocamento: R$ 5,00 por km
  useEffect(() => {
    if (isExternalLocation && distanceKm !== undefined) {
      const calculatedCost = distanceKm * 5;
      form.setValue("travel_cost", calculatedCost);
    }
  }, [distanceKm, isExternalLocation, form]);

  const loadData = async () => {
    try {
      // Buscar usuário atual
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, role, name')
          .eq('user_id', userData.user.id)
          .single();

        if (profileData) {
          const isMasterAdmin =
            profileData.role === 'admin' &&
            (profileData.name === 'Débora' || profileData.name === 'Olevate');

          setCurrentUser({
            id: profileData.id,
            role: profileData.role,
            name: profileData.name,
            isMasterAdmin
          });
        }
      }

      // Buscar agendamentos
      const { data: agendaData, error: agendaError } = await supabase
        .from('agenda')
        .select('*')
        .order('data', { ascending: true })
        .order('horario', { ascending: true });

      if (agendaError) throw agendaError;

      // Buscar clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (clientesError) throw clientesError;

      // Buscar colaboradores
      const { data: colaboradoresData, error: colaboradoresError } = await supabase
        .from('profiles')
        .select('id, user_id, name, email')
        .order('name');
      if (colaboradoresError) throw colaboradoresError;

      // Buscar feriados
      const { data: holidaysData, error: holidaysError } = await supabase
        .from('holidays')
        .select('*')
        .order('date');
      if (holidaysError) throw holidaysError;

      // Mapear dados incluindo nome do criador e attendees
      const profilesMap = new Map(colaboradoresData?.map(p => [p.user_id, p.name]) || []);
      const mappedAgenda =
        (agendaData?.map(item => ({
          ...item,
          data_fim: item.data_fim || item.data, // Usar data como data_fim se não existir
          cliente: item.cliente?.trim().length ? item.cliente : INTERNAL_MEETING_PLACEHOLDER,
          creator_name: profilesMap.get(item.created_by) || 'Usuário desconhecido',
          attendees_display: getAttendeesDisplay(item.collaborators_ids || [], colaboradoresData || [])
        })) as AgendaItem[]) || [];

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
      const { data: user } = await supabase.auth.getUser();
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
      const localEndDate = new Date(values.data_fim + 'T12:00:00');
      const formattedEndDate = localEndDate.toISOString().split('T')[0];

      const basePayload = {
        titulo: values.titulo.trim(),
        descricao: sanitizeOptionalString(values.descricao),
        cliente: values.isInternalMeeting ? INTERNAL_MEETING_PLACEHOLDER : values.cliente?.trim() || "",
        tipo: values.tipo,
        data: formattedDate,
        data_fim: formattedEndDate,
        horario: values.horario,
        horario_fim: sanitizeOptionalString(values.horario_fim),
        local: sanitizeOptionalString(values.local),
        agenda_type: values.agenda_type,
        collaborators_ids: values.collaborators_ids,
        external_location: values.external_location || false,
        distance_km: values.external_location ? (values.distance_km || 0) : 0,
        travel_cost: values.external_location ? (values.travel_cost || 0) : 0
      };

      if (editingItem) {
        const { data, error } = await supabase
          .from('agenda')
          .update(basePayload)
          .eq('id', editingItem.id)
          .select()
          .single();

        if (error) throw error;

        const attendeesDisplay = getAttendeesDisplay(
          values.collaborators_ids || [],
          colaboradores.map(colaborador => ({ id: colaborador.id, name: colaborador.name }))
        );

        const creatorName =
          colaboradores.find(colaborador => colaborador.user_id === (data as AgendaItem).created_by)?.name ||
          editingItem.creator_name ||
          currentUser?.name ||
          'Usuário desconhecido';

        const updatedAgendaItem: AgendaItem = {
          ...(data as AgendaItem),
          data_fim: (data as AgendaItem).data_fim || formattedEndDate,
          cliente: values.isInternalMeeting ? INTERNAL_MEETING_PLACEHOLDER : values.cliente?.trim() || "",
          attendees_display: attendeesDisplay,
          creator_name: creatorName
        };

        setAgenda(prev => prev.map(item => (item.id === editingItem.id ? updatedAgendaItem : item)));
        setSelectedItem(prev => (prev && prev.id === editingItem.id ? updatedAgendaItem : prev));

        toast({
          title: "Sucesso!",
          description: "Agendamento atualizado com sucesso."
        });
      } else {
        const { data, error } = await supabase
          .from('agenda')
          .insert({
            ...basePayload,
            created_by: user.user.id
          })
          .select()
          .single();

        if (error) throw error;

        // Mantém a lista em memória atualizada
        const attendeesDisplay = getAttendeesDisplay(
          values.collaborators_ids || [],
          colaboradores.map(colaborador => ({ id: colaborador.id, name: colaborador.name }))
        );
        const newAgendaItem: AgendaItem = {
          ...(data as AgendaItem),
          data_fim: (data as AgendaItem).data_fim || formattedEndDate,
          cliente: values.isInternalMeeting ? INTERNAL_MEETING_PLACEHOLDER : values.cliente?.trim() || "",
          attendees_display: attendeesDisplay,
          creator_name: currentUser?.name || 'Você'
        };

        setAgenda(prev => [
          ...prev,
          newAgendaItem
        ]);

        toast({
          title: "Sucesso!",
          description: "Agendamento criado com sucesso."
        });
      }

      closeDialog();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast({
        title: "Erro",
        description: editingItem ? "Erro ao atualizar agendamento." : "Erro ao criar agendamento.",
        variant: "destructive"
      });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetFormToDefault();
    }
  };

  const handleEditClick = (item: AgendaItem) => {
    const isInternal = !item.cliente || item.cliente === INTERNAL_MEETING_PLACEHOLDER;

    form.reset({
      titulo: item.titulo,
      descricao: item.descricao || "",
      cliente: isInternal ? "" : item.cliente,
      tipo: item.tipo,
      data: item.data,
      data_fim: item.data_fim || item.data,
      horario: item.horario?.substring(0, 5) || "",
      horario_fim: item.horario_fim ? item.horario_fim.substring(0, 5) : "",
      local: item.local || "",
      agenda_type: item.agenda_type,
      collaborators_ids: item.collaborators_ids || [],
      isInternalMeeting: isInternal,
      external_location: item.external_location || false,
      distance_km: item.distance_km || 0,
      travel_cost: item.travel_cost || 0
    });

    setEditingItem(item);
    setIsDetailDialogOpen(false);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (item: AgendaItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !isDeleting) {
      setItemToDelete(null);
    }
    setIsDeleteDialogOpen(open);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);

      const { error } = await supabase
        .from('agenda')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      setAgenda(prev => prev.filter(agendaItem => agendaItem.id !== itemToDelete.id));
      if (selectedItem?.id === itemToDelete.id) {
        setSelectedItem(null);
        setIsDetailDialogOpen(false);
      }

      toast({
        title: "Sucesso!",
        description: "Agendamento excluído com sucesso."
      });

      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir agendamento.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMinutesDialogOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedMinutesMeetingId("");
      setSelectedMinutesMeeting(null);
      setMinutesText("");
    }

    setIsMinutesDialogOpen(open);

  };

  const handleSelectMinutesMeeting = (meetingId: string) => {
    const meeting = sortedAgendaForMinutes.find(item => item.id === meetingId) || null;
    setSelectedMinutesMeetingId(meetingId);
    setSelectedMinutesMeeting(meeting);
    setMinutesText(meeting?.descricao || "");
  };

  const handleSaveMinutes = async () => {
    if (!selectedMinutesMeeting) {
      toast({
        title: "Selecione a reunião",
        description: "Escolha uma reunião para registrar a ata.",
        variant: "destructive"
      });
      return;
    }

    const trimmedMinutes = minutesText.trim();
    if (trimmedMinutes.length === 0) {
      toast({
        title: "Ata obrigatória",
        description: "Escreva os principais pontos antes de salvar.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSavingMinutes(true);

      const { error } = await supabase
        .from('agenda')
        .update({ descricao: trimmedMinutes })
        .eq('id', selectedMinutesMeeting.id);

      if (error) throw error;

      setAgenda(prev =>
        prev.map(item =>
          item.id === selectedMinutesMeeting.id
            ? { ...item, descricao: trimmedMinutes }
            : item
        )
      );

      setSelectedMinutesMeeting(current =>
        current ? { ...current, descricao: trimmedMinutes } : current
      );

      toast({
        title: "Ata registrada",
        description: "As informações foram salvas com sucesso."
      });

      handleMinutesDialogOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar ata:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a ata. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSavingMinutes(false);
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
  const getLocationDisplay = (location?: string | null) => {
    if (!location) return "Local não informado";
    const trimmed = location.trim();
    return trimmed.length > 0 ? trimmed : "Local não informado";
  };

  const filteredAgendaBySector = useMemo(() => {
    return agenda.filter(item => {
      if (sectorFilter === 'todos') return true;
      return item.agenda_type === sectorFilter;
    });
  }, [agenda, sectorFilter]);

  const availableMinutesTypes = useMemo(() => {
    const unique = new Set<AgendaItem['tipo']>();
    filteredAgendaBySector.forEach(item => unique.add(item.tipo));
    return Array.from(unique);
  }, [filteredAgendaBySector]);

  const sortedMinutesTypes = useMemo(() => {
    return [...availableMinutesTypes].sort((a, b) => getTipoLabel(a).localeCompare(getTipoLabel(b), 'pt-BR'));
  }, [availableMinutesTypes]);

  const availableMinutesLocations = useMemo(() => {
    const unique = new Set<string>();
    filteredAgendaBySector.forEach(item => unique.add(getLocationDisplay(item.local)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [filteredAgendaBySector]);





  useEffect(() => {
    if (minutesTypeFilter !== 'all' && !availableMinutesTypes.includes(minutesTypeFilter)) {
      setMinutesTypeFilter('all');
    }
  }, [availableMinutesTypes, minutesTypeFilter]);

  useEffect(() => {
    if (minutesLocationFilter !== 'all' && !availableMinutesLocations.includes(minutesLocationFilter)) {
      setMinutesLocationFilter('all');
    }
  }, [availableMinutesLocations, minutesLocationFilter]);

  const filteredAgendaForMinutes = useMemo(() => {
    return filteredAgendaBySector
      .filter(item => minutesTypeFilter === 'all' || item.tipo === minutesTypeFilter)
      .filter(item => minutesLocationFilter === 'all' || getLocationDisplay(item.local) === minutesLocationFilter);
  }, [filteredAgendaBySector, minutesTypeFilter, minutesLocationFilter]);

  const sortedAgendaForMinutes = useMemo(() => {
    return [...filteredAgendaForMinutes].sort((a, b) => {
      const dateComparison = a.data.localeCompare(b.data);
      if (dateComparison !== 0) return dateComparison;

      if (a.horario && b.horario) {
        const timeComparison = a.horario.localeCompare(b.horario);
        if (timeComparison !== 0) return timeComparison;
      } else if (a.horario) {
        return -1;
      } else if (b.horario) {
        return 1;
      }

      return a.titulo.localeCompare(b.titulo, 'pt-BR');
    });
  }, [filteredAgendaForMinutes]);

  const minutesGroups = useMemo<MinutesGroup[]>(() => {
    const filtered = filteredAgendaForMinutes;

    const typeMap = new Map<AgendaItem['tipo'], Map<string, AgendaItem[]>>();

    filtered.forEach(item => {
      const locationKey = getLocationDisplay(item.local);
      if (!typeMap.has(item.tipo)) {
        typeMap.set(item.tipo, new Map());
      }
      const locationMap = typeMap.get(item.tipo)!;
      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, []);
      }
      locationMap.get(locationKey)!.push(item);
    });

    const result: MinutesGroup[] = Array.from(typeMap.entries()).map(([type, locationMap]) => ({
      type,
      locations: Array.from(locationMap.entries())
        .map(([location, items]) => ({
          location,
          items: [...items].sort((a, b) => {
            const dateComparison = a.data.localeCompare(b.data);
            if (dateComparison !== 0) return dateComparison;
            if (a.horario && b.horario) {
              return a.horario.localeCompare(b.horario);
            }
            return 0;
          })
        }))
        .sort((a, b) => a.location.localeCompare(b.location, 'pt-BR'))
    }));

    return result.sort((a, b) => getTipoLabel(a.type).localeCompare(getTipoLabel(b.type), 'pt-BR'));
  }, [filteredAgendaForMinutes]);

  const minutesSummary = useMemo(() => {
    const filtered = filteredAgendaForMinutes;

    const uniqueTypes = new Set(filtered.map(item => item.tipo));
    const uniqueLocations = new Set(filtered.map(item => getLocationDisplay(item.local)));

    return {
      total: filtered.length,
      types: uniqueTypes.size,
      locations: uniqueLocations.size
    };
  }, [filteredAgendaForMinutes]);

  useEffect(() => {
    if (
      selectedMinutesMeetingId &&
      !sortedAgendaForMinutes.some(item => item.id === selectedMinutesMeetingId)
    ) {
      setSelectedMinutesMeetingId("");
      setSelectedMinutesMeeting(null);
    }
  }, [selectedMinutesMeetingId, sortedAgendaForMinutes]);

  useEffect(() => {
    if (!selectedMinutesMeetingId) {
      return;
    }

    const updatedMeeting = sortedAgendaForMinutes.find(
      item => item.id === selectedMinutesMeetingId
    );

    if (updatedMeeting) {
      setSelectedMinutesMeeting(updatedMeeting);
    }
  }, [selectedMinutesMeetingId, sortedAgendaForMinutes]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Segunda-feira
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getItemsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return agenda.filter(item => {
      const start = item.data;
      const end = item.data_fim || item.data;
      if (dayStr < start || dayStr > end) return false;
      if (sectorFilter === 'todos') return true;
      return item.agenda_type === sectorFilter;
    });
  };

  const getHolidaysForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return holidays.filter(holiday => holiday.date === dayStr);
  };

  const handleItemClick = (item: AgendaItem) => {
    setSelectedItem({
      ...item,
      data_fim: item.data_fim || item.data
    });
    setIsDetailDialogOpen(true);
  };

  // =========================
  // PRÓXIMOS AGENDAMENTOS (HOJE E AMANHÃ) 👇
  // =========================
  const todayStr = formatDateToLocalString(new Date());
  const tomorrowStr = formatDateToLocalString(addDays(new Date(), 1));

  const upcomingAgenda = agenda
    .filter((item) => {
      // Filtro por setor (se necessário)
      if (sectorFilter !== 'todos' && item.agenda_type !== sectorFilter) return false;
      const start = item.data;
      const end = item.data_fim || item.data;
      const includesToday = start <= todayStr && end >= todayStr;
      const includesTomorrow = start <= tomorrowStr && end >= tomorrowStr;
      return includesToday || includesTomorrow;
    })
    // Ordena por data e horário (strings no formato YYYY-MM-DD e HH:mm ordenam corretamente)
    .sort((a, b) => {
      const byDate = a.data.localeCompare(b.data);
      if (byDate !== 0) return byDate;
      return a.horario.localeCompare(b.horario);
    });
  // =========================

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Agenda" subtitle="Carregando..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader title="Agenda" subtitle="Organização de reuniões, visitas e apresentações" />
      
      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as 'agenda' | 'atas')}
        className="space-y-4 md:space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="agenda" className="w-full">
            Agenda
          </TabsTrigger>
          <TabsTrigger value="atas" className="w-full">
            Atas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-4 md:space-y-6">
          <div className="space-y-3 md:space-y-4">
        {/* Primeira linha - Navegação do Calendário e Botão Novo Agendamento */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="flex-1 sm:flex-initial h-11"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="ml-1 sm:ml-2">Anterior</span>
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-initial h-11 justify-center min-w-[140px]">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  <span className="capitalize">
                    {format(currentMonth, "MMM yyyy", { locale: ptBR })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={currentMonth}
                  onSelect={(date) => {
                    if (date) {
                      const adjustedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
                      setCurrentMonth(adjustedDate);
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="flex-1 sm:flex-initial h-11"
            >
              <span className="mr-1 sm:mr-2">Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="btn-hero w-full sm:w-auto h-11"
                onClick={resetFormToDefault}
              >
                <Plus className="w-4 h-4 mr-2" />
                <span>Novo Agendamento</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="titulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Reunião inicial projeto casa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isInternalMeeting"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Reunião interna</FormLabel>
                          <FormDescription>
                            Ative para reuniões sem cliente associado.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cliente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isInternalMeeting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  isInternalMeeting ? "Reunião interna (sem cliente)" : "Selecione um cliente"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientes.map(cliente => (
                              <SelectItem key={cliente.id} value={cliente.name}>
                                {cliente.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isInternalMeeting ? (
                          <FormDescription>
                            O agendamento será registrado como "{INTERNAL_MEETING_PLACEHOLDER}".
                          </FormDescription>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Reunião</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposReuniao.map(tipo => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded ${tipo.color}`}></div>
                                  {tipo.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="local"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o local" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {locaisReuniao.map(local => (
                              <SelectItem key={local.value} value={local.value}>
                                {local.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="external_location"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Local Externo</FormLabel>
                          <FormDescription>
                            Ative se a reunião será em local externo ao escritório
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {isExternalLocation && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="distance_km"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Distância (km)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="0.0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="travel_cost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custo de Deslocamento (R$)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                {...field}
                                disabled
                                className="bg-muted"
                              />
                            </FormControl>
                            <FormDescription>
                              Calculado automaticamente: R$ 5,00 por km
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="agenda_type"
                    render={({ field }) => (
                      <FormItem>
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
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collaborators_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colaboradores Envolvidos</FormLabel>
                        <div className="space-y-2">
                          {colaboradores.map(colaborador => (
                            <div key={colaborador.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`collaborator-${colaborador.id}`}
                                checked={field.value.includes(colaborador.id)}
                                onChange={e => {
                                  const updatedValue = e.target.checked
                                    ? [...field.value, colaborador.id]
                                    : field.value.filter(id => id !== colaborador.id);
                                  field.onChange(updatedValue);
                                }}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor={`collaborator-${colaborador.id}`} className="text-sm font-medium">
                                {colaborador.name}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Início</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    (() => {
                                      const parsed = parseDateStringSafely(field.value);
                                      return parsed ? format(parsed, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>;
                                    })()
                                  ) : (
                                    <span>Selecione uma data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={parseDateStringSafely(field.value) || undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const formattedDate = formatDateToLocalString(date);
                                    field.onChange(formattedDate);
                                  }
                                }}
                                disabled={(date) => date < new Date("1900-01-01")}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_fim"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Término</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    (() => {
                                      const parsed = parseDateStringSafely(field.value);
                                      return parsed ? format(parsed, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>;
                                    })()
                                  ) : (
                                    <span>Selecione uma data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={parseDateStringSafely(field.value) || undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const formattedDate = formatDateToLocalString(date);
                                    field.onChange(formattedDate);
                                  }
                                }}
                                disabled={(date) => {
                                  const minDate = new Date("1900-01-01");
                                  if (date < minDate) return true;
                                  if (startDateValue) {
                                    const start = parseDateStringSafely(startDateValue);
                                    if (start) {
                                      const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                                      const normalizedCurrent = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                      return normalizedCurrent < normalizedStart;
                                    }
                                  }
                                  return false;
                                }}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="horario"
                      render={({ field }) => (
                        <FormItem>
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
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="horario_fim"
                      render={({ field }) => (
                        <FormItem>
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
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Detalhes adicionais sobre a reunião..." className="min-h-[80px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={closeDialog} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 btn-hero-static">
                      {editingItem ? "Salvar alterações" : "Agendar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Segunda linha - Filtros e Botões de Feriados */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
          {/* Filtro de Setor */}
          <div className="flex-1 sm:flex-initial">
            <Select value={sectorFilter} onValueChange={(value: 'todos' | 'pessoal' | 'compartilhada') => setSectorFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px] h-11">
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
          <div className="flex-1 sm:flex-initial">
            <Button variant="outline" size="sm" onClick={() => setIsHolidayDialogOpen(true)} className="w-full sm:w-auto h-11">
              <Gift className="w-4 h-4 mr-2" />
              <span>Novo Feriado</span>
            </Button>
          </div>
          
          {/* Status do usuário atual */}
          {currentUser && (
            <div className="text-xs lg:text-sm text-muted-foreground hidden xl:block flex-shrink-0 ml-auto">
              {currentUser.name}
            </div>
          )}
        </div>
      </div>

      {/* Calendário mensal */}
      <div className="overflow-x-auto -mx-3 md:mx-0">
        <div className="grid grid-cols-7 gap-0.5 md:gap-1 bg-card rounded-lg border p-2 md:p-4 min-w-[280px]">
          {/* Cabeçalho dos dias da semana */}
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
            <div key={day} className="text-center text-[10px] md:text-sm font-medium p-1 md:p-2 text-muted-foreground min-w-[38px] md:min-w-[120px]">
              {day}
            </div>
          ))}
          
          {/* Dias do mês */}
          {calendarDays.map(day => {
            const dayItems = getItemsForDay(day);
            const dayHolidays = getHolidaysForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hasHoliday = dayHolidays.length > 0;

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] md:min-h-[120px] min-w-[38px] md:min-w-[120px] p-1 md:p-2 border rounded-sm md:rounded-md ${isToday ? 'bg-primary/20 border-primary' : hasHoliday ? 'bg-brand/10 border-brand/30' : 'bg-primary/10 border-primary/30'} ${!isCurrentMonth ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-1 md:mb-2">
                  <div className={`text-[10px] md:text-sm font-medium ${isToday ? 'text-primary' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  {hasHoliday && <Gift className="h-2 md:h-3 w-2 md:w-3" style={{ color: `hsl(var(--brand))` }} />}
                </div>
                 
                {/* Feriados */}
                {dayHolidays.map(holiday => (
                  <div
                    key={holiday.id}
                    className="text-[9px] md:text-xs rounded p-0.5 md:p-1 mb-0.5 md:mb-1 border hidden md:block"
                    style={{
                      backgroundColor: `hsl(var(--brand) / 0.1)`,
                      borderColor: `hsl(var(--brand) / 0.3)`,
                      color: `hsl(var(--brand))`
                    }}
                  >
                    <div className="font-medium truncate" title={holiday.name}>
                      {holiday.name}
                    </div>
                  </div>
                ))}
                
                <div className="space-y-0.5 md:space-y-1">
                  {dayItems.slice(0, 2).map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="text-[8px] md:text-xs rounded border cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                    >
                      <div className={`p-0.5 md:p-2 rounded-t ${getTipoColor(item.tipo)} text-white overflow-hidden`}>
                        <div className="flex items-center gap-0.5 md:gap-1 mb-0 md:mb-1">
                          <span className="block truncate font-medium text-white flex-1 leading-tight" title={item.titulo}>
                            {item.titulo}
                          </span>
                          {item.agenda_type === 'compartilhada' && item.attendees_display && (
                            <span className="text-[8px] md:text-xs text-white/80 flex-shrink-0 hidden md:inline">
                              {item.attendees_display}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-0.5 md:p-1 bg-background text-muted-foreground flex items-center gap-0.5 md:gap-1 rounded-b">
                        <Clock className="w-2 md:w-3 h-2 md:h-3 flex-shrink-0 hidden md:block" />
                        <span className="truncate leading-tight">
                          {item.horario.substring(0, 5)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {dayItems.length > 2 && (
                    <div className="text-[8px] md:text-xs text-muted-foreground text-center p-0.5">
                      +{dayItems.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de detalhes do compromisso */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent
          className="max-w-lg p-[4px] rounded-lg overflow-hidden border-0"
          style={{ background: selectedItem ? getTipoGradient(selectedItem.tipo) : undefined }}
        >
          {selectedItem && (
            <div className="bg-background rounded-lg overflow-hidden">
              {/* Header com gradiente na cor do tipo */}
              <div className="relative p-8 rounded-t-lg overflow-hidden">
                <div className="absolute inset-0" style={{ background: getTipoGradient(selectedItem.tipo) }} />
                <div className="absolute inset-0 bg-black/10" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 z-20 h-10 w-10 p-0 text-white hover:bg-white/20 hover:text-white rounded-full transition-all duration-200 hover:scale-110"
                  onClick={() => setIsDetailDialogOpen(false)}
                >
                  <X className="h-6 w-6" />
                </Button>
                <div className="relative z-10 text-center space-y-4">
                  <div className="text-2xl font-semibold text-white">Detalhes do Agendamento</div>
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
                          {currentUser?.isMasterAdmin && (
                            <Badge variant="secondary" className="ml-2 text-xs bg-brand/10 text-brand border-brand/20">
                              {selectedItem.creator_name === 'Débora' || selectedItem.creator_name === 'Olevate' ? 'Master' : 'User'}
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Informações principais em cards */}
                <div className="grid gap-3 md:gap-4">
                  {/* Cliente */}
                  <Card className="p-3 md:p-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary/20"></div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground">Cliente</p>
                        <p className="font-semibold text-sm md:text-base text-foreground truncate">{selectedItem.cliente}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Data e Horário */}
                  <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
                    <Card className="p-3 md:p-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm text-muted-foreground">Início</p>
                          <p className="font-semibold text-sm md:text-base text-foreground truncate">
                            {formatDisplayDate(selectedItem.data)}
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-3 md:p-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm text-muted-foreground">Término</p>
                          <p className="font-semibold text-sm md:text-base text-foreground truncate">
                            {formatDisplayDate(selectedItem.data_fim || selectedItem.data)}
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-3 md:p-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs md:text-sm text-muted-foreground">Horário</p>
                          <p className="font-semibold text-sm md:text-base text-foreground truncate">
                            {selectedItem.horario.substring(0, 5)}
                            {selectedItem.horario_fim && ` - ${selectedItem.horario_fim.substring(0, 5)}`}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Local */}
                  {selectedItem.local && (
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Local</p>
                          <p className="font-semibold text-foreground">{selectedItem.local}</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Observações */}
                  {selectedItem.descricao && (
                    <Card className="p-4">
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
                    </Card>
                  )}
                </div>

                {/* Ações */}
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-3 md:pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 md:h-11 text-base md:text-sm"
                    onClick={() => selectedItem && handleEditClick(selectedItem)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 md:h-11 text-base md:text-sm text-destructive hover:text-destructive"
                    onClick={() => selectedItem && handleDeleteClick(selectedItem)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja excluir este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!isDeleting) {
                  handleConfirmDelete();
                }
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Dialog open={isMinutesDialogOpen} onOpenChange={handleMinutesDialogOpenChange}>

        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar ata de reunião</DialogTitle>
            <DialogDescription>
              Selecione um compromisso existente para preencher automaticamente os dados e registrar a ata.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="minutes-meeting-select">
                Reunião
              </label>
              <Select
                value={selectedMinutesMeetingId}
                onValueChange={handleSelectMinutesMeeting}
              >
                <SelectTrigger id="minutes-meeting-select" className="h-11 w-full">
                  <SelectValue placeholder="Selecione a reunião" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {sortedAgendaForMinutes.map(meeting => (
                    <SelectItem key={meeting.id} value={meeting.id}>
                      {`${formatDisplayDateRange(meeting.data, meeting.data_fim)} • ${meeting.titulo}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Os detalhes da reunião são preenchidos automaticamente após a seleção.
              </p>
            </div>

            {selectedMinutesMeeting && (
              <div className="space-y-4 rounded-lg border border-muted-foreground/20 bg-muted/10 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Título
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedMinutesMeeting.titulo}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Tipo e setor
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {getTipoLabel(selectedMinutesMeeting.tipo)}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          selectedMinutesMeeting.agenda_type === 'pessoal'
                            ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30'
                            : 'bg-green-500/10 text-green-700 border-green-500/30'
                        }`}
                      >
                        {selectedMinutesMeeting.agenda_type === 'pessoal' ? 'Pessoal' : 'Compartilhado'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Data e horário
                    </p>
                    <p className="text-sm text-foreground">
                      {formatDisplayDateRange(selectedMinutesMeeting.data, selectedMinutesMeeting.data_fim)}
                      {selectedMinutesMeeting.horario && (
                        <>
                          {' '}• {selectedMinutesMeeting.horario.substring(0, 5)}
                          {selectedMinutesMeeting.horario_fim && ` - ${selectedMinutesMeeting.horario_fim.substring(0, 5)}`}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Local
                    </p>
                    <p className="text-sm text-foreground">
                      {getLocationDisplay(selectedMinutesMeeting.local)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Cliente ou responsável
                    </p>
                    <p className="text-sm text-foreground">
                      {selectedMinutesMeeting.cliente || INTERNAL_MEETING_PLACEHOLDER}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Participantes
                    </p>
                    <p className="text-sm text-foreground">
                      {selectedMinutesMeeting.attendees_display || 'Equipe'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="minutes-description">
                Conteúdo da ata
              </label>
              <Textarea
                id="minutes-description"
                placeholder="Descreva os principais pontos discutidos, decisões e próximos passos."
                rows={8}
                value={minutesText}
                onChange={event => setMinutesText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Utilize este campo para registrar o resumo da reunião, responsáveis e prazos definidos.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => handleMinutesDialogOpenChange(false)}
                disabled={isSavingMinutes}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveMinutes}
                disabled={
                  isSavingMinutes || !selectedMinutesMeeting || minutesText.trim().length === 0
                }
              >
                {isSavingMinutes ? 'Salvando...' : 'Salvar ata'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de próximos agendamentos (AGORA APENAS HOJE E AMANHÃ) */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Próximos Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingAgenda.slice(0, 5).map(item => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-4 border rounded-xl hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200 hover:border-primary/30 cursor-pointer"
                onClick={() => handleItemClick(item)}
              >
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
                      <Badge
                        variant="secondary"
                        className={`text-xs ${item.agenda_type === 'pessoal' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20'}`}
                      >
                        {item.agenda_type === 'pessoal' ? 'Pessoal' : 'Compartilhado'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{item.cliente}</span> • {formatDisplayDateRange(item.data, item.data_fim)}
                      {item.horario && (
                        <>
                          {" "}às {item.horario.substring(0, 5)}
                          {item.horario_fim && ` - ${item.horario_fim.substring(0, 5)}`}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Participantes: {item.attendees_display}
                      {currentUser?.isMasterAdmin && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-brand/10 text-brand border-brand/20">
                          {item.creator_name === 'Débora' || item.creator_name === 'Olevate' ? 'Master' : 'User'}
                        </Badge>
                      )}
                    </div>
                    {item.local && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                        <MapPin className="w-3 h-3" />
                        {item.local}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="secondary" className={`${getTipoColor(item.tipo)} text-white border-transparent font-medium`}>
                    {getTipoLabel(item.tipo)}
                  </Badge>
                </div>
              </div>
            ))}

            {upcomingAgenda.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <div className="font-medium mb-2">Nenhum agendamento para hoje e amanhã</div>
                <div className="text-sm">Clique em "Novo Agendamento" para começar</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
          <HolidayDialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen} onHolidayCreated={loadData} />
          <HolidaySyncDialog
            open={isHolidaySyncDialogOpen}
            onOpenChange={setIsHolidaySyncDialogOpen}
            onHolidaysSynced={loadData}
          />
        </TabsContent>

        <TabsContent value="atas" className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid flex-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              <Select
                value={sectorFilter}
                onValueChange={(value: 'todos' | 'pessoal' | 'compartilhada') => setSectorFilter(value)}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Filtrar por setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  <SelectItem value="pessoal">Setor pessoal</SelectItem>
                  <SelectItem value="compartilhada">Setor compartilhado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={minutesTypeFilter}
                onValueChange={value => setMinutesTypeFilter(value as 'all' | AgendaItem['tipo'])}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Tipo de reunião" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {sortedMinutesTypes.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {getTipoLabel(tipo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={minutesLocationFilter}
                onValueChange={value => setMinutesLocationFilter(value)}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Local" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os locais</SelectItem>
                  {availableMinutesLocations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="btn-hero h-11 w-full lg:w-auto"
              onClick={() => handleMinutesDialogOpenChange(true)}
            >
              <NotebookPen className="mr-2 h-4 w-4" />
              Registrar ata
            </Button>
          </div>

          <Card className="border-muted-foreground/10 bg-card/50">
            <CardContent className="grid gap-4 py-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Atas cadastradas</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{minutesSummary.total}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipos de reunião</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{minutesSummary.types}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Locais registrados</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{minutesSummary.locations}</p>
              </div>
            </CardContent>
          </Card>

          {minutesGroups.length === 0 ? (
            <Card className="border-dashed border-muted-foreground/40 bg-card/40">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <NotebookPen className="h-10 w-10 text-muted-foreground/60" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma ata encontrada</p>
                  <p className="text-xs text-muted-foreground/80">
                    Cadastre agendamentos ou ajuste os filtros para visualizar as atas.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {minutesGroups.map(group => {
                const totalGroupMinutes = group.locations.reduce(
                  (total, location) => total + location.items.length,
                  0
                );

                return (
                  <div key={group.type} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm"
                          style={{ background: getTipoGradient(group.type) }}
                        >
                          <NotebookPen className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{getTipoLabel(group.type)}</h3>
                          <p className="text-sm text-muted-foreground">
                            {totalGroupMinutes} {totalGroupMinutes === 1 ? 'ata registrada' : 'atas registradas'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {totalGroupMinutes} {totalGroupMinutes === 1 ? 'registro' : 'registros'}
                      </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {group.locations.map(locationGroup => (
                        <Card
                          key={`${group.type}-${locationGroup.location}`}
                          className="border-muted-foreground/20 bg-card/80 shadow-sm transition-colors hover:border-primary/30"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="rounded-md bg-primary/10 p-2 text-primary">
                                  <MapPin className="h-4 w-4" />
                                </div>
                                <div>
                                  <CardTitle className="text-base font-semibold text-foreground">
                                    {locationGroup.location}
                                  </CardTitle>
                                  <p className="text-xs text-muted-foreground">
                                    {locationGroup.items.length}{' '}
                                    {locationGroup.items.length === 1 ? 'reunião registrada' : 'reuniões registradas'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {locationGroup.items.map(item => (
                              <div
                                key={item.id}
                                className="space-y-3 rounded-lg border border-muted-foreground/10 bg-background/60 p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-foreground">
                                    {formatDisplayDateRange(item.data, item.data_fim)}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Badge
                                      variant="secondary"
                                      className={`text-xs ${
                                        item.agenda_type === 'pessoal'
                                          ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30'
                                          : 'bg-green-500/10 text-green-700 border-green-500/30'
                                      }`}
                                    >
                                      {item.agenda_type === 'pessoal' ? 'Pessoal' : 'Compartilhada'}
                                    </Badge>
                                    <span>
                                      {item.horario.substring(0, 5)}
                                      {item.horario_fim && ` - ${item.horario_fim.substring(0, 5)}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>{item.cliente || INTERNAL_MEETING_PLACEHOLDER}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <span>Participantes: {item.attendees_display || 'Equipe'}</span>
                                  </div>
                                </div>

                                {item.descricao ? (
                                  <div className="rounded-md border border-muted-foreground/10 bg-card/70 p-3 text-sm leading-relaxed text-foreground">
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                      Resumo da ata
                                    </div>
                                    <p>{item.descricao}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs italic text-muted-foreground/80">
                                    Nenhuma observação registrada para esta reunião.
                                  </p>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
