import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Phone, Search, Send } from "lucide-react";
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        const [lastContactResult, unreadCountResult] = await Promise.all([
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
        ]);

        const lastContact = lastContactResult.data;
        const unreadMessages = unreadCountResult.data || [];

        const readMessagesKey = `read_messages_${client.id}`;
        const readMessages = JSON.parse(localStorage.getItem(readMessagesKey) || "[]");
        const unreadCount = unreadMessages.filter((msg: any) => !readMessages.includes(msg.id)).length;

        const lastMessage = lastContact?.description || lastContact?.subject || "Nenhuma conversa ainda";

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

  // -------- Carregar Mensagens --------
  const loadMessages = async (contactId: string) => {
    try {
      const { data: contactHistory, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", contactId)
        .eq("contact_type", "whatsapp")
        .order("contact_date", { ascending: true });

      if (error) throw error;

      if (!contactHistory || contactHistory.length === 0) {
        setMessages([]);
        return;
      }

      const chatMessages: ChatMessage[] = contactHistory
        .filter((contact: any) => !contact.subject?.startsWith("ROUTING:"))
        .map((contact: any) => ({
          id: contact.id,
          content: contact.description || contact.subject || "Mensagem sem conteúdo",
          timestamp: contact.contact_date,
          isOutgoing: contact.created_by === user?.id,
          status: "delivered" as MsgStatus,
        }));

      setMessages(chatMessages);

      // Marcar como lidas
      const readMessagesKey = `read_messages_${contactId}`;
      const messageIds = chatMessages.map(msg => msg.id);
      localStorage.setItem(readMessagesKey, JSON.stringify(messageIds));
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive",
      });
    }
  };

  // -------- Enviar Mensagem --------
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;

    try {
      await sendWhatsApp(selectedContact.phone, newMessage);

      await supabase.from("client_contacts").insert({
        client_id: selectedContact.id,
        contact_type: "whatsapp",
        subject: "Mensagem enviada via WhatsApp",
        description: newMessage,
        contact_date: new Date().toISOString(),
        created_by: user?.id,
      });

      const newMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        content: newMessage,
        timestamp: new Date().toISOString(),
        isOutgoing: true,
        status: "sent",
      };

      setMessages((prev) => [...prev, newMsg]);
      setNewMessage("");

      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada via WhatsApp.",
      });

      await loadWhatsAppContacts();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  // Scroll automático para última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Carregar contatos inicialmente
  useEffect(() => {
    loadWhatsAppContacts();
  }, [user?.id]);

  // Polling para novas mensagens
  useEffect(() => {
    const interval = setInterval(() => {
      loadWhatsAppContacts();
      if (selectedContact) {
        loadMessages(selectedContact.id);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedContact]);

  const handleContactSelect = async (contact: WhatsAppContact) => {
    setSelectedContact(contact);
    await loadMessages(contact.id);
    setUnreadMessagesCount(0);
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Business" />
      
      <NotificationCenter />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Lista de Contatos */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversas
              {unreadMessagesCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {unreadMessagesCount}
                </Badge>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-320px)]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando contatos...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum contato encontrado
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedContact?.id === contact.id ? "bg-muted" : ""
                    }`}
                    onClick={() => handleContactSelect(contact)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.avatar} />
                        <AvatarFallback>
                          {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">{contact.name}</h4>
                          <div className="flex items-center gap-1">
                            {contact.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {contact.unreadCount}
                              </Badge>
                            )}
                            {contact.isOnline && (
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {contact.lastMessage}
                        </p>
                        {contact.lastMessageTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(contact.lastMessageTime)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Chat */}
        <Card className="col-span-2">
          {selectedContact ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedContact.avatar} />
                      <AvatarFallback>
                        {selectedContact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{selectedContact.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {selectedContact.phone}
                        {selectedContact.isOnline && (
                          <>
                            <span className="mx-1">•</span>
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span>Online</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex flex-col h-[calc(100vh-360px)]">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isOutgoing ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-3 py-2 ${
                            message.isOutgoing
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {formatTime(message.timestamp)}
                            {message.isOutgoing && (
                              <span className="ml-1">
                                {message.status === "sent" && "✓"}
                                {message.status === "delivered" && "✓✓"}
                                {message.status === "read" && "✓✓"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={sendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
                <p>Escolha um contato à esquerda para iniciar a conversa</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}