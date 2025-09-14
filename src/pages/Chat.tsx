import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Phone, Search, Send, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { useCustomNotifications } from "@/hooks/useCustomNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";

interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  avatar?: string;
  isOnline?: boolean;
}

type MsgStatus = "sent" | "delivered" | "read";

interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  isOutgoing: boolean;
  status: MsgStatus;
}

type SectorKey = "coordenador" | "supervisor" | "admin" | "colaborador" | "triagem";

type RoutingState = {
  isAssigned: boolean;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedSector?: SectorKey;
  lastAssignedAt?: string;
  lastClosedAt?: string;
  lastMenuSentAt?: string;
};

const SECTOR_BY_OPTION: Record<string, SectorKey> = {
  "1": "coordenador",
  "2": "supervisor",
  "3": "admin",
  "4": "colaborador",
  "0": "triagem", // opção "Não sei" -> cai para 'admin' (via pickUserBySector)
};

const AUTO_MENU_TEXT =
  "Olá! 👋\nPor gentileza, informe o número do setor para o qual você deseja atendimento:\n\n" +
  "1 - Coordenador\n" +
  "2 - Supervisor\n" +
  "3 - Admin\n" +
  "4 - Colaborador\n" +
  "0 - Não sei o departamento (encaminharemos para Admin)";

export default function Chat() {
  const { user } = useAuth();
  const { showNotification } = useCustomNotifications();

  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [routingState, setRoutingState] = useState<RoutingState | null>(null);

  // Perfil/logado
  const [myRole, setMyRole] = useState<string>("");
  const [mySector, setMySector] = useState<string>("");
  const [myName, setMyName] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // -------- Helpers --------
  const isPrivileged = useMemo(() => {
    const r = (myRole || "").toLowerCase();
    return r === "admin" || r === "supervisor";
  }, [myRole]);

  const canReply = useMemo(() => {
    if (!routingState?.isAssigned) return false;
    if (routingState.assignedUserId === user?.id) return true;
    return isPrivileged;
  }, [routingState?.isAssigned, routingState?.assignedUserId, user?.id, isPrivileged]);

  const canCloseChat = useMemo(() => {
    if (!routingState) return isPrivileged; // se não sabemos, deixa só privilegiado
    if (!routingState.isAssigned) return isPrivileged; // somente admin/supervisor encerra sem dono
    return routingState.assignedUserId === user?.id || isPrivileged;
  }, [routingState, user?.id, isPrivileged]);

  const notifyNewMessage = (message: string, contactName: string) => {
    showNotification(`📱 Nova mensagem de ${contactName}`, message);
    try {
      const audio = new Audio("/sounds/gentle-bell.mp3");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
    setUnreadMessagesCount((prev) => prev + 1);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const sendWhatsApp = async (to: string, message: string) => {
    const result = await supabase.functions.invoke("whatsapp-send", {
      body: { to, message },
    });
    if (result.error || !result.data?.ok) {
      const msg =
        (result.error && (result.error as any).message) ||
        result.data?.error?.message ||
        "Erro ao enviar mensagem via WhatsApp";
      throw new Error(msg);
    }
  };

  const getClientById = async (clientId: string) => {
    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, phone")
      .eq("id", clientId)
      .single();
    if (error || !client) throw error || new Error("Cliente não encontrado");
    return client as { id: string; name: string; phone: string };
  };

  // Perfil do usuário logado (para checar permissões e mostrar nome)
  const loadMyProfile = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, name, email, sector, role")
      .eq("id", user.id)
      .limit(1)
      .single();
    if (!error && data) {
      setMyRole((data as any).role || "");
      setMySector((data as any).sector || "");
      setMyName((data as any).full_name || (data as any).name || (data as any).email || "");
    }
  };

  // Tenta buscar usuários por setor em 'profiles' e depois 'users'
  const findUsersBySector = async (sector: SectorKey) => {
    // Mapeia sinônimos para bater com valores variados no banco (maiúsculas/minúsculas, PT/EN)
    const synonyms: Record<SectorKey, string[]> = {
      coordenador: ["coordenador", "coordinator"],
      supervisor: ["supervisor", "supervisão", "supervisor(a)"],
      admin: ["admin", "administrator", "administrador", "administração"],
      colaborador: ["colaborador", "colaborador(a)", "staff", "employee"],
      triagem: ["admin"], // triagem cai em admin no pickUserBySector
    };

    const variants = synonyms[sector] || [sector];
    const orExpr = variants
      .map((v) => [`sector.ilike.*${v}*`, `role.ilike.*${v}*`])
      .flat()
      .join(",");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, name, email, sector, role")
      .or(orExpr)
      .limit(50);

    if (!error && data && data.length > 0) {
      return data.map((u: any) => ({
        id: u.id,
        name: u.full_name || u.name || u.email || "Usuário",
        sector: (u.sector || u.role || "").toLowerCase(),
      })) as Array<{ id: string; name: string; sector: string }>;
    }

    return [] as Array<{ id: string; name: string; sector: string }>;
  };

  // Escolhe o atendente (random simples). Para "triagem", cai para "admin".
  const pickUserBySector = async (sector: SectorKey) => {
    const effectiveSector: SectorKey = sector === "triagem" ? "admin" : sector;
    const users = await findUsersBySector(effectiveSector);
    if (!users.length) return null;
    const idx = Math.floor(Math.random() * users.length);
    return users[idx];
  };

  // Lê eventos ROUTING:* e devolve o estado de roteamento
  const readRoutingState = async (clientId: string): Promise<RoutingState> => {
    const { data, error } = await supabase
      .from("client_contacts")
      .select("id, subject, description, contact_date")
      .eq("client_id", clientId)
      .order("contact_date", { ascending: false })
      .limit(100);
    if (error) throw error;

    let state: RoutingState = { isAssigned: false };

    if (data && data.length) {
      const lastMenu = data.find((c: any) => (c.subject || "").startsWith("ROUTING:MENU_SENT"));
      if (lastMenu) state.lastMenuSentAt = lastMenu.contact_date;

      const lastAssigned = data.find((c: any) => (c.subject || "").startsWith("ROUTING:ASSIGNED"));
      const lastClosed = data.find((c: any) => (c.subject || "").startsWith("ROUTING:CLOSED"));

      if (lastAssigned) {
        state.lastAssignedAt = lastAssigned.contact_date;
        const parts = (lastAssigned.subject || "").split(":"); // ROUTING:ASSIGNED:<setor>:<userId>
        state.assignedSector = (parts[2] as SectorKey) || undefined;
        state.assignedUserId = parts[3] || undefined;
        if (lastAssigned.description) {
          const m = lastAssigned.description.match(/para\s+(.+?)\s*\(ID:/i);
          if (m) state.assignedUserName = m[1];
        }
      }
      if (lastClosed) state.lastClosedAt = lastClosed.contact_date;

      state.isAssigned =
        !!state.lastAssignedAt && (!state.lastClosedAt || new Date(state.lastAssignedAt) > new Date(state.lastClosedAt));
    }

    return state;
  };

  // Envia o menu automático (anti-spam 10min)
  const ensureMenuSent = async (clientId: string, phone: string) => {
    const routing = await readRoutingState(clientId);
    if (routing.isAssigned) return;

    const sentRecently =
      routing.lastMenuSentAt && Date.now() - new Date(routing.lastMenuSentAt).getTime() < 10 * 60 * 1000;

    if (!sentRecently) {
      await sendWhatsApp(phone, AUTO_MENU_TEXT);
      await supabase.from("client_contacts").insert({
        client_id: clientId,
        contact_type: "whatsapp",
        subject: "ROUTING:MENU_SENT",
        description: AUTO_MENU_TEXT,
        contact_date: new Date().toISOString(),
        created_by: user?.id ?? null,
      });
    }
  };

  // Trata a escolha "0-4" e atribui a um atendente do setor
  const handleRoutingSelection = async (clientId: string, selectionText: string) => {
    const choice = (selectionText || "").trim();
    if (!/^[0-4]$/.test(choice)) return false;

    const sector = SECTOR_BY_OPTION[choice];
    const client = await getClientById(clientId);
    const assignee = await pickUserBySector(sector);

    let finalAssignee = assignee || (await pickUserBySector("admin")) || (await pickUserBySector("supervisor")) || null;
    if (!finalAssignee) {
      const wantSelf =
        (sector === "admin" && ((myRole || "").toLowerCase() === "admin" || (mySector || "").toLowerCase() === "admin")) ||
        (sector === "supervisor" && ((myRole || "").toLowerCase() === "supervisor" || (mySector || "").toLowerCase() === "supervisor"));
      if (wantSelf && user?.id) {
        finalAssignee = { id: user.id, name: myName || "Você", sector: (mySector || myRole || sector).toLowerCase() } as any;
      }
    }

    const assignedUserId = finalAssignee?.id || "sem-user";
    const assignedUserName = finalAssignee?.name || "Equipe";

    await supabase.from("client_contacts").insert({
      client_id: clientId,
      contact_type: "whatsapp",
      subject: `ROUTING:ASSIGNED:${sector}:${assignedUserId}`,
      description: `Cliente direcionado para ${assignedUserName} (ID: ${assignedUserId}) no setor ${sector}.`,
      contact_date: new Date().toISOString(),
      created_by: user?.id ?? null,
    });

    const setorLabel =
      sector === "coordenador"
        ? "Coordenador"
        : sector === "supervisor"
        ? "Supervisor"
        : sector === "admin"
        ? "Admin"
        : sector === "colaborador"
        ? "Colaborador"
        : "Atendimento";

    await sendWhatsApp(
      client.phone,
      `Perfeito! ✅ Você selecionou ${setorLabel}.
Um atendente irá responder em instantes.`
    );

    // Cria uma mensagem visível para o atendente após o ASSIGNED
    await supabase.from("client_contacts").insert({
      client_id: clientId,
      contact_type: "whatsapp",
      subject: "Mensagem recebida via WhatsApp",
      description: `Novo atendimento iniciado — setor ${setorLabel}.`,
      contact_date: new Date().toISOString(),
      created_by: assignedUserId,
    });

    return true;
  };

  // Encerrar chat: volta à triagem para o próximo contato
  const closeChatForClient = async (clientId: string) => {
    await supabase.from("client_contacts").insert({
      client_id: clientId,
      contact_type: "whatsapp",
      subject: "ROUTING:CLOSED",
      description:
        "Chat encerrado pelo operador. Na próxima mensagem do cliente, o menu automático de setores será reenviado.",
      contact_date: new Date().toISOString(),
      created_by: user?.id ?? null,
    });
    toast({
      title: "Chat encerrado",
      description: "O próximo contato do cliente receberá o menu automático novamente.",
    });
    if (selectedContact?.id === clientId) {
      const state = await readRoutingState(clientId);
      setRoutingState(state);
      await loadMessages(clientId, state);
    }
  };

  // -------- Carregar Contatos --------
  const loadWhatsAppContacts = async () => {
    setLoading(true);
    try {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("id, name, phone, email, created_at")
        .not("phone", "is", null)
        .neq("phone", "")
        .order("name");
      if (error) throw error;
      if (!clients || clients.length === 0) {
        setContacts([]);
        return;
      }

      const contactsPromises = clients.map(async (client: any) => {
        const [lastContactResult, unreadCountResult, routing] = await Promise.all([
          supabase
            .from("client_contacts")
            .select("*")
            .eq("client_id", client.id)
            .eq("contact_type", "whatsapp")
            .order("contact_date", { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from("client_contacts")
            .select("id")
            .eq("client_id", client.id)
            .eq("contact_type", "whatsapp")
            .neq("created_by", user?.id),
          readRoutingState(client.id),
        ]);

        const lastContact = lastContactResult.data;
        const unreadMessages = unreadCountResult.data || [];

        const readMessagesKey = `read_messages_${client.id}`;
        const readMessages = JSON.parse(localStorage.getItem(readMessagesKey) || "[]");
        const unreadCount = unreadMessages.filter((msg: any) => !readMessages.includes(msg.id)).length;

        const notMyAssignment =
          routing.isAssigned && routing.assignedUserId !== user?.id && !isPrivileged;

        const lastMessage = routing.isAssigned
          ? notMyAssignment
            ? `🔒 Atribuído a ${routing.assignedUserName || "outro atendente"}`
            : lastContact?.description || lastContact?.subject || "Nenhuma conversa ainda"
          : "🟡 Em triagem — aguardando seleção do setor";

        return {
          id: client.id,
          name: client.name,
          phone: client.phone,
          lastMessage,
          lastMessageTime: lastContact?.contact_date || client.created_at,
          unreadCount,
          avatar: "",
          isOnline: Math.random() > 0.5, // simulado
        } as WhatsAppContact;
      });

      const contactsWithLastMessage = await Promise.all(contactsPromises);
      setContacts(contactsWithLastMessage);
    } catch (error) {
      console.error("Erro ao carregar contatos WhatsApp:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // -------- Carregar Mensagens (respeitando triagem e propriedade) --------
  const loadMessages = async (contactId: string, state?: RoutingState) => {
    try {
      const routing = state || (await readRoutingState(contactId));
      setRoutingState(routing);

      const { data: contactHistory, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", contactId)
        .eq("contact_type", "whatsapp")
        .order("contact_date", { ascending: true });

      if (error) throw error;

      // Se não estiver atribuído, escondemos o histórico (UI mostra aviso de triagem)
      let showFromIndex = 0;
      if (!routing.isAssigned) {
        showFromIndex = contactHistory?.length || 0; // ocultar tudo
      } else {
        // Exibir a partir do último ASSIGNED (para ficar claro o contexto)
        let assignPos = -1;
        for (let i = (contactHistory?.length || 0) - 1; i >= 0; i--) {
          const subj = (contactHistory![i].subject || "") as string;
          if (subj.startsWith("ROUTING:ASSIGNED")) {
            assignPos = i;
            break;
          }
        }
        showFromIndex = assignPos >= 0 ? assignPos + 1 : 0;
      }

      const visible = (contactHistory || [])
        .slice(showFromIndex)
        .filter((c: any) => !(c.subject || "").startsWith("ROUTING:"))
        .map((contact: any) => {
          const subjectLower = (contact.subject || "").toLowerCase();
          const isIncomingBySubject = subjectLower.includes("recebida");
          const isOutgoingBySubject = subjectLower.includes("enviada");
          const isOutgoing = isOutgoingBySubject || (!isIncomingBySubject && contact.created_by === user?.id);
          return {
            id: contact.id,
            content: contact.description || contact.subject,
            timestamp: contact.contact_date,
            isOutgoing,
            status: "read" as MsgStatus,
          } as ChatMessage;
        });

      setMessages(visible);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  };

  // -------- Efeitos --------
  useEffect(() => {
    loadMyProfile();
  }, [user?.id]);

  useEffect(() => {
    loadWhatsAppContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime: novas mensagens WhatsApp
  useEffect(() => {
    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_contacts", filter: "contact_type=eq.whatsapp" },
        async (payload: any) => {
          try {
            const subjectRaw = (payload.new.subject || "") as string;
            const isIncomingMessage = payload.new.created_by !== user?.id;
            const clientId = payload.new.client_id as string;

            // Se for ASSIGNMENT, notifica imediatamente o atendente dono
            if (subjectRaw.startsWith("ROUTING:ASSIGNED:")) {
              try {
                const parts = subjectRaw.split(":");
                const assignedUserId = parts[3];
                // Atualiza lista e estado
                loadWhatsAppContacts();
                if (assignedUserId === user?.id || isPrivileged) {
                  const { data: cli } = await supabase
                    .from("clients")
                    .select("name")
                    .eq("id", clientId)
                    .single();
                  if (cli) {
                    notifyNewMessage("Novo atendimento encaminhado para você.", cli.name);
                  }
                }
                if (selectedContact?.id === clientId) {
                  const st = await readRoutingState(clientId);
                  setRoutingState(st);
                  await loadMessages(clientId, st);
                }
              } catch (e) {
                console.error("Erro ao processar ROUTING:ASSIGNED:", e);
              }
              return;
            }

            // Atualiza a lista de contatos
            loadWhatsAppContacts();

            if (isIncomingMessage) {
              // Verifica estado de roteamento
              const state = await readRoutingState(clientId);
              const client = await getClientById(clientId);
              const text = (payload.new.description || payload.new.subject || "").trim();

              if (!state.isAssigned) {
                // Se cliente enviou "0-4", tenta atribuir
                if (/^[0-4]$/.test(text)) {
                  const ok = await handleRoutingSelection(clientId, text);
                  if (ok && selectedContact && selectedContact.id === clientId) {
                    const st = await readRoutingState(clientId);
                    setRoutingState(st);
                    await loadMessages(clientId, st);
                  }
                } else {
                  // Ainda não escolheu: envia/garante o menu
                  await ensureMenuSent(clientId, client.phone);
                }
                // Enquanto em triagem, não notifica a equipe fora da conversa ativa
                return;
              }

              // Já atribuído — somente notifica quem é o dono (ou quem é admin/supervisor)
              const mineOrPrivileged = state.assignedUserId === user?.id || isPrivileged;
              const isCurrent = selectedContact && clientId === selectedContact.id;

              if (!mineOrPrivileged) {
                // Não é meu chat: não notifica
                if (isCurrent) {
                  // Mas se por algum motivo eu estiver vendo, apenas recarrega para refletir bloqueio
                  await loadMessages(clientId, state);
                }
                return;
              }

              // Dono/privilegiado
              if (!isCurrent) {
                const { data: cli } = await supabase
                  .from("clients")
                  .select("name")
                  .eq("id", clientId)
                  .single();
                if (cli) {
                  notifyNewMessage(text || "Mensagem recebida", cli.name);
                }
              } else {
                await loadMessages(clientId, state);
                setUnreadMessagesCount((prev) => Math.max(0, prev - 1));
              }
            } else {
              // Mensagem enviada por mim
              if (selectedContact && payload.new.client_id === selectedContact.id) {
                await loadMessages(selectedContact.id);
              }
            }
          } catch (err) {
            console.error("Erro no listener realtime:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContact, user?.id, isPrivileged]);

  // -------- Ações UI --------
  const handleContactSelect = async (contact: WhatsAppContact) => {
    setSelectedContact(contact);

    // Marca mensagens como lidas (somente para o badge da lista)
    const readMessagesKey = `read_messages_${contact.id}`;
    const { data: unreadMessages } = await supabase
      .from("client_contacts")
      .select("id")
      .eq("client_id", contact.id)
      .eq("contact_type", "whatsapp")
      .neq("created_by", user?.id);

    if (unreadMessages) {
      const messageIds = unreadMessages.map((msg: any) => msg.id);
      const existingReadMessages = JSON.parse(localStorage.getItem(readMessagesKey) || "[]");
      const allReadMessages = [...new Set([...existingReadMessages, ...messageIds])];
      localStorage.setItem(readMessagesKey, JSON.stringify(allReadMessages));
      loadWhatsAppContacts();
    }

    const st = await readRoutingState(contact.id);
    setRoutingState(st);
    await loadMessages(contact.id, st);

    // Se estiver em triagem, garante menu enviado
    if (!st.isAssigned) {
      await ensureMenuSent(contact.id, contact.phone);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !user) return;

    // Bloqueia envio se ainda estiver em triagem ou se não for meu chat
    if (!canReply) {
      toast({
        title: routingState?.isAssigned ? "Este chat não está atribuído a você" : "Aguardando seleção do setor",
        description: routingState?.isAssigned
          ? "Apenas o atendente responsável (ou Admin/Supervisor) pode responder."
          : "O cliente ainda não escolheu o setor. Assim que ele responder ao menu automático, você poderá enviar mensagens.",
        variant: "destructive",
      });
      return;
    }

    // Envia localmente para resposta instantânea
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      content: newMessage,
      timestamp: new Date().toISOString(),
      isOutgoing: true,
      status: "sent",
    };
    setMessages((prev) => [...prev, newMsg]);
    const messageToSend = newMessage;
    setNewMessage("");

    try {
      const [sendResult] = await Promise.all([
        supabase.functions.invoke("whatsapp-send", {
          body: { to: selectedContact.phone, message: messageToSend },
        }),
        supabase.from("client_contacts").insert({
          client_id: selectedContact.id,
          contact_type: "whatsapp",
          subject: "Mensagem enviada via WhatsApp",
          description: messageToSend,
          contact_date: new Date().toISOString(),
          created_by: user.id,
        }),
      ]);

      if (sendResult.error) throw new Error(`Erro na chamada da função: ${(sendResult.error as any).message}`);
      if (!sendResult.data?.ok)
        throw new Error(sendResult.data?.error?.message || "Erro ao enviar mensagem via WhatsApp");
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    }
  };

  const filteredContacts = contacts.filter(
    (contact) => contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || contact.phone.includes(searchTerm)
  );

  // -------- Render --------
  return (
    <div className="space-y-6">
      <PageHeader title="Chat" subtitle="Conversas e comunicação com clientes via WhatsApp" />

      <div className="h-[calc(100vh-180px)] flex gap-6">
        {/* Lista de Contatos */}
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                WhatsApp
                {unreadMessagesCount > 0 && (
                  <Badge className="ml-2" variant="destructive">
                    {unreadMessagesCount}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <NotificationCenter />
                <Badge variant="secondary">{contacts.length}</Badge>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Carregando contatos...</div>
              ) : filteredContacts.length > 0 ? (
                <div className="space-y-1">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedContact?.id === contact.id ? "bg-primary/10 border-r-2 border-primary" : ""
                      }`}
                      onClick={() => handleContactSelect(contact)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {contact.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {contact.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                        {contact.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs font-medium border-2 border-background">
                            {contact.unreadCount}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">{contact.name}</h4>
                          {contact.lastMessageTime && (
                            <span className="text-xs text-muted-foreground">{formatTime(contact.lastMessageTime)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.lastMessage || "Nenhuma mensagem"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  {searchTerm ? "Nenhum contato encontrado" : "Nenhum contato WhatsApp ainda"}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Chat */}
        <Card className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              {/* Header do Chat */}
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedContact.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{selectedContact.name}</h3>
                      {!routingState?.isAssigned ? (
                        <Badge variant="secondary">Em triagem</Badge>
                      ) : canReply ? (
                        <Badge variant="default">
                          Ativo {routingState.assignedUserName ? `• ${routingState.assignedUserName}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          Atribuído a {routingState?.assignedUserName || "outro atendente"}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {selectedContact.phone}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeChatForClient(selectedContact.id)}
                      title="Encerrar chat"
                      disabled={!canCloseChat}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Encerrar chat
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Mensagens */}
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  {!routingState?.isAssigned && (
                    <div className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      <div className="font-medium mb-1">Em triagem</div>
                      O cliente ainda não escolheu o setor. O menu automático foi enviado e,
                      assim que ele responder com <strong>0, 1, 2, 3 ou 4</strong>, o chat será liberado aqui.
                    </div>
                  )}

                  {routingState?.isAssigned && !canReply && (
                    <div className="mb-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      <div className="font-medium mb-1">Chat atribuído a {routingState?.assignedUserName || "outro atendente"}</div>
                      Apenas o atendente responsável pode responder. Caso necessário, clique em <em>Encerrar chat</em>
                      para voltar a triagem e reenviar o menu automático ao cliente.
                    </div>
                  )}

                  <div className="space-y-4 pb-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex mb-4 ${message.isOutgoing ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl p-3 ${
                            message.isOutgoing
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          <div className={`flex items-center gap-1 mt-2 ${message.isOutgoing ? "justify-end" : "justify-start"}`}>
                            <span
                              className={`text-xs ${
                                message.isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              {formatTime(message.timestamp)}
                            </span>
                            {message.isOutgoing && <div className="text-xs text-primary-foreground/70">✓✓</div>}
                          </div>
                        </div>
                      </div>
                    ))}

                    {messages.length === 0 && routingState?.isAssigned && (
                      <div className="flex items-center justify-center h-full min-h-[200px]">
                        <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Input de Mensagem */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder={!routingState?.isAssigned
                      ? "Aguardando o cliente escolher o setor…"
                      : canReply
                      ? "Digite sua mensagem..."
                      : "Este chat está atribuído a outro atendente"}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                    disabled={!canReply}
                  />
                  <Button onClick={handleSendMessage} size="sm" disabled={!canReply}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Selecione um contato</h3>
                <p className="text-muted-foreground">Escolha um contato para iniciar a conversa</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
