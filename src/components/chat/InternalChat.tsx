import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MessageSquare, Search, Send, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { useInternalChatContacts, InternalContact, GENERAL_CHAT_ID } from "@/hooks/useInternalChatContacts";
import { getRoleLabel } from "@/lib/roleUtils";

interface InternalMessage {
  id: string;
  content: string;
  timestamp: string;
  isOutgoing: boolean;
  from_user_name: string;
  to_user_name: string;
}

export function InternalChat() {
  const { user } = useAuth();
  const { contacts, loading, refetch } = useInternalChatContacts();
  const [selectedContact, setSelectedContact] = useState<InternalContact | null>(null);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mobileContactsOpen, setMobileContactsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const loadMessages = useCallback(async (contact: InternalContact) => {

    if (!user) return;


    try {
      if (contact.isGroup) {
        const { data, error } = await supabase
          .from('group_messages')

          .select('*')

          .order('created_at', { ascending: true });

        if (error) throw error;

        const groupMessages: InternalMessage[] = (data || []).map((msg) => ({
          id: msg.id,
          content: msg.message,
          timestamp: msg.created_at,

          isOutgoing: msg.user_id === user.id,
          from_user_name: msg.user_name,

          to_user_name: "Chat Geral",
        }));

        setMessages(groupMessages);
        return;
      }


      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${contact.id}),and(from_user_id.eq.${contact.id},to_user_id.eq.${user.id})`)

        .order('created_at', { ascending: true });

      if (error) throw error;

      const internalMessages: InternalMessage[] = (data || []).map((msg) => ({
        id: msg.id,
        content: msg.message,
        timestamp: msg.created_at,
        isOutgoing: msg.from_user_id === currentUserId,
        from_user_name: msg.from_user_name,
        to_user_name: msg.to_user_name,
      }));

      setMessages(internalMessages);

      // Marcar mensagens como lidas
      if (data && data.length > 0) {
        const unreadIds = data
          .filter(msg => msg.to_user_id === user.id && !msg.viewed_at)
          .map(msg => msg.id);

        if (unreadIds.length > 0) {
          await supabase
            .from('messages')
            .update({ viewed_at: new Date().toISOString() })
            .in('id', unreadIds);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mensagens.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !user || isSending) return;

    setIsSending(true);
    try {
      if (selectedContact.isGroup) {
        const { error } = await supabase
          .from('group_messages')
          .insert({
            user_id: user.id,
            message: newMessage,
            user_name: user.name,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('messages')
          .insert({
            from_user_id: user.id,
            to_user_id: selectedContact.id,
            message: newMessage,
            from_user_name: user.name,
            to_user_name: selectedContact.name,
            message_type: 'text',
          });

        if (error) throw error;
      }

      setNewMessage("");
      await loadMessages(selectedContact);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleContactSelect = useCallback(async (contact: InternalContact) => {
    setSelectedContact(contact);
    setNewMessage("");
    setMobileContactsOpen(false);


    await loadMessages(contact);
  }, [loadMessages]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;

    const privateChannel = supabase
      .channel('internal-chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new;

          // Se a mensagem é para este usuário ou deste usuário
          if (newMsg.to_user_id === user.id || newMsg.from_user_id === user.id) {
            // Atualizar lista de contatos
            await refetch({ silent: true });

            // Se a conversa está aberta, adicionar mensagem
            if (selectedContact &&
                !selectedContact.isGroup &&
                (newMsg.from_user_id === selectedContact.id || newMsg.to_user_id === selectedContact.id)) {
              await loadMessages(selectedContact);
            }
          }
        }
      )
      .subscribe();

    const groupChannel = supabase
      .channel('internal-group-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        async () => {
          await refetch({ silent: true });

          if (selectedContact?.isGroup) {
            await loadMessages(selectedContact);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(privateChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [user, selectedContact, loadMessages, refetch]);

  useEffect(() => {
    if (!selectedContact && contacts.length > 0) {
      const generalContact = contacts.find((contact) => contact.id === GENERAL_CHAT_ID);
      if (generalContact) {
        handleContactSelect(generalContact);
      }
    }
  }, [contacts, selectedContact, handleContactSelect]);

  // Auto scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnread = contacts.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-0">
      {/* Lista de Contatos - Desktop */}
      <div className="hidden md:block w-80 flex-shrink-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chat Interno
              {totalUnread > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {totalUnread}
                </Badge>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando usuários...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum usuário encontrado
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
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback>
                          {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                          <h4 className="font-medium leading-tight break-words flex-1 min-w-0">
                            {contact.name}
                          </h4>
                          <div className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
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
                          <p className="text-xs text-muted-foreground">
                            {contact.isGroup ? 'Canal geral' : getRoleLabel(contact.role as any)}
                          </p>
                        {contact.lastMessage && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-normal break-words line-clamp-2">
                            {contact.lastMessage}
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
      </div>

      {/* Área de Chat */}
      <Card className="flex-1 flex flex-col min-w-0 h-full">
        {selectedContact ? (
          <>
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* Botão mobile para voltar/abrir contatos */}
                <Sheet open={mobileContactsOpen} onOpenChange={setMobileContactsOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[320px] p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Chat Interno
                        {totalUnread > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {totalUnread}
                          </Badge>
                        )}
                      </SheetTitle>
                      <div className="relative mt-3">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar usuários..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-140px)]">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedContact?.id === contact.id ? "bg-muted" : ""
                          }`}
                          onClick={() => handleContactSelect(contact)}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarFallback>
                                {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{contact.name}</h4>
                                {contact.unreadCount > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {contact.unreadCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {contact.isGroup ? 'Canal geral' : getRoleLabel(contact.role as any)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </SheetContent>
                </Sheet>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback>
                      {selectedContact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold leading-tight break-words">
                      {selectedContact.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedContact.isGroup ? 'Canal geral' : getRoleLabel(selectedContact.role as any)}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Área de Mensagens */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full px-3 py-4">
                  <div className="space-y-4 w-full pr-6">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex w-full ${message.isOutgoing ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex max-w-[75%] flex-col gap-2 rounded-2xl px-3 py-2 shadow-sm ${
                            message.isOutgoing
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {selectedContact.isGroup && (
                            <span className={`text-xs font-semibold ${
                              message.isOutgoing
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground"
                            }`}
                            >
                              {message.isOutgoing ? 'Você' : message.from_user_name || 'Participante'}
                            </span>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                          <div className={`flex items-center text-xs opacity-70 ${
                            message.isOutgoing ? "justify-end" : "justify-start"
                          }`}>
                            <span>{formatTime(message.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Input de Mensagem */}
              <div className="p-4 border-t bg-background flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1"
                    disabled={isSending}
                  />
                  <Button
                    onClick={sendMessage}
                    size="icon"
                    disabled={!newMessage.trim() || isSending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Selecione um usuário</h3>
              <p className="hidden md:block">Escolha um usuário à esquerda para iniciar a conversa</p>

              {/* Botão mobile para abrir contatos */}
              <div className="md:hidden mt-6">
                <Sheet open={mobileContactsOpen} onOpenChange={setMobileContactsOpen}>
                  <SheetTrigger asChild>
                    <Button size="lg" className="w-full max-w-xs">
                      <MessageSquare className="mr-2 h-5 w-5" />
                      Ver Usuários
                      {totalUnread > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {totalUnread}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[320px] p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Chat Interno
                        {totalUnread > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {totalUnread}
                          </Badge>
                        )}
                      </SheetTitle>
                      <div className="relative mt-3">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar usuários..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-140px)]">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleContactSelect(contact)}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{contact.name}</h4>
                                {contact.unreadCount > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {contact.unreadCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {contact.isGroup ? 'Canal geral' : getRoleLabel(contact.role as any)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
