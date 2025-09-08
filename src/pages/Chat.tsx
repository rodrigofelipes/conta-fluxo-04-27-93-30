import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MessageSquare, Phone, Clock, User, Send, Plus } from "lucide-react";
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
interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
  isOutgoing: boolean;
  status: 'sent' | 'delivered' | 'read';
}
export default function Chat() {
  const {
    user
  } = useAuth();
  const {
    showNotification
  } = useCustomNotifications();
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Função específica para notificações de chat
  const notifyNewMessage = (message: string, contactName: string) => {
    showNotification(`📱 Nova mensagem de ${contactName}`, message);

    // Som de notificação
    try {
      const audio = new Audio('/sounds/gentle-bell.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignorar erro se não conseguir tocar
      });
    } catch (error) {
      // Ignorar erro de áudio
    }

    // Incrementar contador de mensagens não lidas
    setUnreadMessagesCount(prev => prev + 1);
  };
  useEffect(() => {
    loadWhatsAppContacts();
  }, []);

  // Auto-scroll para baixo quando mensagens mudarem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages]);

  // Realtime subscription para novas mensagens
  useEffect(() => {
    const channel = supabase.channel('chat-messages').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'client_contacts',
      filter: 'contact_type=eq.whatsapp'
    }, payload => {
      console.log('Nova mensagem recebida:', payload);

      // Verificar se é uma mensagem recebida (não enviada pelo usuário atual)
      const isIncomingMessage = payload.new.created_by !== user?.id;
      if (isIncomingMessage) {
        // Só mostrar notificação se não estiver na conversa do cliente atual
        const isCurrentConversation = selectedContact && payload.new.client_id === selectedContact.id;
        if (!isCurrentConversation) {
          // Buscar dados do cliente para a notificação
          supabase.from('clients').select('name').eq('id', payload.new.client_id).single().then(({
            data: client
          }) => {
            if (client) {
              notifyNewMessage(payload.new.description || payload.new.subject || 'Mensagem recebida', client.name);
            }
          });
        }
      }

      // Atualizar a lista de contatos
      loadWhatsAppContacts();

      // Se a mensagem é para o contato selecionado, atualizar as mensagens
      if (selectedContact && payload.new.client_id === selectedContact.id) {
        loadMessages(selectedContact.id);
        // Marcar mensagens como lidas se o chat estiver aberto
        if (isIncomingMessage) {
          setUnreadMessagesCount(prev => Math.max(0, prev - 1));
        }
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContact, user?.id]);
  const loadWhatsAppContacts = async () => {
    setLoading(true);
    try {
      // Buscar apenas clientes que tenham número de telefone cadastrado
      const {
        data: clients,
        error
      } = await supabase.from('clients').select('id, name, phone, email, created_at').not('phone', 'is', null).neq('phone', '').order('name');
      if (error) throw error;
      if (!clients || clients.length === 0) {
        setContacts([]);
        return;
      }

      // Para cada cliente, buscar a última conversa WhatsApp e calcular mensagens não lidas
      const contactsPromises = clients.map(async client => {
        const [lastContactResult, unreadCountResult] = await Promise.all([supabase.from('client_contacts').select('*').eq('client_id', client.id).eq('contact_type', 'whatsapp').order('contact_date', {
          ascending: false
        }).limit(1).single(), supabase.from('client_contacts').select('id').eq('client_id', client.id).eq('contact_type', 'whatsapp').neq('created_by', user?.id)]);
        const lastContact = lastContactResult.data;
        const unreadMessages = unreadCountResult.data || [];

        // Recuperar mensagens lidas do localStorage
        const readMessagesKey = `read_messages_${client.id}`;
        const readMessages = JSON.parse(localStorage.getItem(readMessagesKey) || '[]');
        const unreadCount = unreadMessages.filter(msg => !readMessages.includes(msg.id)).length;
        return {
          id: client.id,
          name: client.name,
          phone: client.phone,
          lastMessage: lastContact?.description || lastContact?.subject || 'Nenhuma conversa ainda',
          lastMessageTime: lastContact?.contact_date || client.created_at,
          unreadCount,
          avatar: '',
          isOnline: Math.random() > 0.5 // Simulado
        };
      });
      const contactsWithLastMessage = await Promise.all(contactsPromises);
      setContacts(contactsWithLastMessage);
    } catch (error) {
      console.error('Erro ao carregar contatos WhatsApp:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos do WhatsApp.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const loadMessages = async (contactId: string) => {
    try {
      // Buscar todas as conversas com este cliente
      const {
        data: contactHistory,
        error
      } = await supabase.from('client_contacts').select('*').eq('client_id', contactId).eq('contact_type', 'whatsapp').order('contact_date', {
        ascending: true
      });
      if (error) throw error;
      const chatMessages: ChatMessage[] = contactHistory?.map((contact: any) => {
        const subjectLower = (contact.subject || '').toLowerCase();
        const isIncomingBySubject = subjectLower.includes('recebida');
        const isOutgoingBySubject = subjectLower.includes('enviada');
        const isOutgoing = isOutgoingBySubject || !isIncomingBySubject && contact.created_by === user?.id;
        return {
          id: contact.id,
          content: contact.description || contact.subject,
          timestamp: contact.contact_date,
          isOutgoing,
          status: 'read' as const
        };
      }) || [];
      setMessages(chatMessages);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };
  const handleContactSelect = (contact: WhatsAppContact) => {
    setSelectedContact(contact);
    loadMessages(contact.id);

    // Marcar todas as mensagens deste cliente como lidas
    if (contact.unreadCount > 0) {
      const readMessagesKey = `read_messages_${contact.id}`;
      supabase.from('client_contacts').select('id').eq('client_id', contact.id).eq('contact_type', 'whatsapp').neq('created_by', user?.id).then(({
        data: unreadMessages
      }) => {
        if (unreadMessages) {
          const messageIds = unreadMessages.map(msg => msg.id);
          const existingReadMessages = JSON.parse(localStorage.getItem(readMessagesKey) || '[]');
          const allReadMessages = [...new Set([...existingReadMessages, ...messageIds])];
          localStorage.setItem(readMessagesKey, JSON.stringify(allReadMessages));

          // Atualizar a lista de contatos para refletir que não há mais mensagens não lidas
          loadWhatsAppContacts();
        }
      });
    }
  };
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !user) return;

    // Adicionar mensagem localmente primeiro para resposta instantânea
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      content: newMessage,
      timestamp: new Date().toISOString(),
      isOutgoing: true,
      status: 'sent'
    };
    setMessages(prev => [...prev, newMsg]);
    const messageToSend = newMessage;
    setNewMessage("");
    try {
      // Enviar mensagem via API do WhatsApp em paralelo
      const [sendResult] = await Promise.all([supabase.functions.invoke('whatsapp-send', {
        body: {
          to: selectedContact.phone,
          message: messageToSend
        }
      }),
      // Salvar no banco em paralelo
      supabase.from('client_contacts').insert({
        client_id: selectedContact.id,
        contact_type: 'whatsapp',
        subject: 'Mensagem enviada via WhatsApp',
        description: messageToSend,
        contact_date: new Date().toISOString(),
        created_by: user.id
      })]);
      if (sendResult.error) {
        console.error('Erro na invocação da função:', sendResult.error);
        throw new Error(`Erro na chamada da função: ${sendResult.error.message}`);
      }
      if (!sendResult.data?.ok) {
        console.error('Função retornou erro:', sendResult.data);
        throw new Error(sendResult.data?.error?.message || 'Erro ao enviar mensagem via WhatsApp');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível enviar a mensagem.",
        variant: "destructive"
      });
    }
  };
  const filteredContacts = contacts.filter(contact => contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || contact.phone.includes(searchTerm));
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };
  return <div className="space-y-6">
      <PageHeader title="Chat" subtitle="Conversas e comunicação com clientes via WhatsApp" />
      
      <div className="h-[calc(100vh-180px)] flex gap-6">
      {/* Lista de Contatos */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              WhatsApp
              {unreadMessagesCount > 0}
            </CardTitle>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <Badge variant="secondary">{contacts.length}</Badge>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar contatos..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            {loading ? <div className="p-4 text-center text-muted-foreground">
                Carregando contatos...
              </div> : filteredContacts.length > 0 ? <div className="space-y-1">
                {filteredContacts.map(contact => <div key={contact.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selectedContact?.id === contact.id ? 'bg-primary/10 border-r-2 border-primary' : ''}`} onClick={() => handleContactSelect(contact)}>
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={contact.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {contact.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {contact.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />}
                      {/* Bolinha de notificação */}
                      {contact.unreadCount > 0 && <div className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs font-medium border-2 border-background">
                          {contact.unreadCount}
                        </div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium truncate">{contact.name}</h4>
                        {contact.lastMessageTime && <span className="text-xs text-muted-foreground">
                            {formatTime(contact.lastMessageTime)}
                          </span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {contact.lastMessage || 'Nenhuma mensagem'}
                        </p>
                      </div>
                    </div>
                  </div>)}
              </div> : <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato WhatsApp ainda'}
              </div>}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de Chat */}
      <Card className="flex-1 flex flex-col">
        {selectedContact ? <>
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
                  <h3 className="font-semibold">{selectedContact.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {selectedContact.phone}
                    {selectedContact.isOnline && <Badge variant="secondary" className="text-xs">Online</Badge>}
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Mensagens */}
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4 pb-4">
                  {messages.map(message => <div key={message.id} className={`flex mb-4 ${message.isOutgoing ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-3 ${message.isOutgoing ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'}`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <div className={`flex items-center gap-1 mt-2 ${message.isOutgoing ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-xs ${message.isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatTime(message.timestamp)}
                          </span>
                          {message.isOutgoing && <div className="text-xs text-primary-foreground/70">
                              ✓✓
                            </div>}
                        </div>
                      </div>
                    </div>)}
                  {messages.length === 0 && <div className="flex items-center justify-center h-full min-h-[200px]">
                      <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                    </div>}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>

            {/* Input de Mensagem */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input placeholder="Digite sua mensagem..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} className="flex-1" />
                <Button onClick={handleSendMessage} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </> : <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Selecione um contato</h3>
              <p className="text-muted-foreground">
                Escolha um contato para iniciar a conversa
              </p>
            </div>
          </div>}
      </Card>
      </div>
    </div>;
}