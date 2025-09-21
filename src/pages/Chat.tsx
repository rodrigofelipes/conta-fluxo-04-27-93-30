import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Phone, Search, Send, Download, Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { useCustomNotifications } from "@/hooks/useCustomNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { FileUpload, UploadedFileInfo } from "@/components/chat/FileUpload";
import { MediaMessage } from "@/components/chat/MediaMessage";

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
  attachments?: ChatAttachment[];
}

interface ChatAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  storagePath?: string;
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
  const [pendingAttachments, setPendingAttachments] = useState<UploadedFileInfo[]>([]);
  const [isSending, setIsSending] = useState(false);

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

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    const units = ["Bytes", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return `${size.toFixed(size > 100 ? 0 : 1)} ${units[i]}`;
  };

  const getSignedUrlForPath = async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("chat-files")
        .createSignedUrl(storagePath, 86400);

      if (error || !data?.signedUrl) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new Error(
          "Não foi possível gerar um link temporário para o arquivo. Verifique suas permissões e tente novamente."
        );
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Erro inesperado ao gerar URL assinada:", error);
      throw new Error(
        "Não foi possível gerar um link temporário para o arquivo anexado. Atualize a página e tente novamente."
      );
    }
  };

  const isValidHttpUrl = (value?: string | null) =>
    typeof value === "string" && /^https?:\/\//i.test(value);

  const extractEdgeFunctionError = (edgeError: unknown): string | null => {
    const pickMessage = (payload: unknown): string | null => {
      if (!payload) return null;

      if (typeof payload === "string") {
        try {
          const parsed = JSON.parse(payload);
          return pickMessage(parsed);
        } catch (error) {
          return payload;
        }
      }

      if (typeof payload === "object") {
        const objectPayload = payload as Record<string, unknown>;

        const directMessage = objectPayload.message;
        if (typeof directMessage === "string" && directMessage.trim()) {
          return directMessage;
        }

        const directError = objectPayload.error;
        if (typeof directError === "string" && directError.trim()) {
          return directError;
        }

        if (
          typeof directError === "object" &&
          directError !== null &&
          typeof (directError as { message?: unknown }).message === "string"
        ) {
          const nestedMessage = (directError as { message?: string }).message;
          if (nestedMessage?.trim()) {
            return nestedMessage;
          }
        }

        const bodyMessage = pickMessage(objectPayload.body);
        if (bodyMessage) return bodyMessage;

        const responseMessage = pickMessage(objectPayload.response);
        if (responseMessage) return responseMessage;

        const dataMessage = pickMessage(objectPayload.data);
        if (dataMessage) return dataMessage;
      }

      return null;
    };

    if (!edgeError) return null;

    if (edgeError instanceof Error) {
      return (
        pickMessage((edgeError as Error & { context?: unknown }).context) ||
        (edgeError.message?.trim() ? edgeError.message : null)
      );
    }

    if (typeof edgeError === "string") {
      return edgeError.trim() ? edgeError : null;
    }

    if (typeof edgeError === "object") {
      const objectError = edgeError as Record<string, unknown>;
      const contextMessage = pickMessage(objectError.context);
      if (contextMessage) return contextMessage;

      const message = objectError.message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }

    return null;
  };

  interface SendWhatsAppPayload {
    to: string;
    message?: string;
    mediaUrl?: string;
    mediaType?: string;
    fileName?: string;
    caption?: string;
  }

  const sendWhatsApp = async ({ to, message, mediaUrl, mediaType, fileName, caption }: SendWhatsAppPayload) => {
    const result = await supabase.functions.invoke("whatsapp-send", {
      body: { to, message, mediaUrl, mediaType, fileName, caption },
    });
    if (result.error || !result.data?.ok) {
      const edgeMessage = extractEdgeFunctionError(result.error);
      const responseMessage =
        (typeof result.data?.message === "string" && result.data.message.trim()) ||
        (typeof result.data?.error === "string" && result.data.error.trim()) ||
        (typeof result.data?.error?.message === "string" && result.data.error.message.trim()) ||
        null;

      const message = edgeMessage || responseMessage || "Erro ao enviar mensagem via WhatsApp.";
      throw new Error(message);
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

      let chatMessages: ChatMessage[] = contactHistory
        .filter((contact: any) => !contact.subject?.startsWith("ROUTING:"))
        .map((contact: any) => ({
          id: contact.id,
          content: contact.description || contact.subject || "Mensagem sem conteúdo",
          timestamp: contact.contact_date,
          isOutgoing: contact.created_by === user?.id,
          status: "delivered" as MsgStatus,
        }));

      const messageIds = chatMessages.map(msg => msg.id);

      if (messageIds.length > 0) {
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('message_attachments')
          .select('*')
          .in('message_id', messageIds);

        if (attachmentError) {
          console.error('Erro ao carregar anexos:', attachmentError);
        } else if (attachmentData && attachmentData.length > 0) {
          const storagePaths = attachmentData
            .filter((attachment) => attachment.file_path && !attachment.file_path.startsWith('http'))
            .map((attachment) => attachment.file_path);

          const uniquePaths = Array.from(new Set(storagePaths));
          const signedUrlMap = new Map<string, string>();

          if (uniquePaths.length > 0) {
            try {
              const { data: signedUrls, error: signedError } = await supabase.storage
                .from('chat-files')
                .createSignedUrls(uniquePaths, 86400);
              if (signedError) {
                console.error('Erro ao gerar URLs assinadas:', signedError);
              } else if (signedUrls) {
                signedUrls.forEach((item) => {
                  if (item.signedUrl) {
                    signedUrlMap.set(item.path, item.signedUrl);
                  }
                });
              }
            } catch (error) {
              console.error('Erro inesperado ao gerar URLs assinadas:', error);
            }
          }

          const attachmentsByMessage: Record<string, ChatAttachment[]> = {};

          attachmentData.forEach((attachment) => {
            const url = attachment.file_path.startsWith('http')
              ? attachment.file_path
              : signedUrlMap.get(attachment.file_path) || attachment.file_path;

            const chatAttachment: ChatAttachment = {
              id: attachment.id,
              fileName: attachment.file_name,
              fileType: attachment.file_type,
              fileSize: attachment.file_size,
              url,
              storagePath: attachment.file_path,
            };

            if (!attachmentsByMessage[attachment.message_id]) {
              attachmentsByMessage[attachment.message_id] = [];
            }

            attachmentsByMessage[attachment.message_id].push(chatAttachment);
          });

          chatMessages = chatMessages.map((message) => ({
            ...message,
            attachments: attachmentsByMessage[message.id] || [],
          }));
        }
      }

      setMessages(chatMessages);

      // Marcar como lidas
      const readMessagesKey = `read_messages_${contactId}`;
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
  const removePendingAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((file) => file.id !== attachmentId));
  };

  const sendMessage = async () => {
    if (!selectedContact) return;

    const contactId = selectedContact.id;
    const contactPhone = selectedContact.phone;

    const hasText = newMessage.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;

    if (!hasText && !hasAttachments) return;
    if (isSending) return;

    setIsSending(true);

    try {
      if (hasAttachments) {
        for (let index = 0; index < pendingAttachments.length; index++) {
          const attachment = pendingAttachments[index];
          const caption = index === 0 && hasText ? newMessage.trim() : undefined;

          const existingUrl = attachment.downloadUrl;
          const signedUrl = isValidHttpUrl(existingUrl)
            ? existingUrl
            : await getSignedUrlForPath(attachment.storagePath);

          if (!isValidHttpUrl(signedUrl)) {
            throw new Error(
              "Não foi possível gerar um link válido para o arquivo anexado. Verifique suas permissões e tente novamente."
            );
          }

          await sendWhatsApp({
            to: contactPhone,
            mediaUrl: signedUrl,
            mediaType: attachment.fileType,
            fileName: attachment.fileName,
            caption,
          });

          const description = caption || `Arquivo enviado: ${attachment.fileName}`;

          const { data: savedMessage, error: saveError } = await supabase
            .from('client_contacts')
            .insert({
              client_id: contactId,
              contact_type: 'whatsapp',
              subject: 'Mensagem enviada via WhatsApp',
              description,
              contact_date: new Date().toISOString(),
              created_by: user?.id,
            })
            .select()
            .single();

          if (saveError || !savedMessage) {
            throw saveError || new Error('Erro ao salvar mensagem.');
          }

          if (!user?.id) {
            throw new Error('Usuário não autenticado para salvar anexos.');
          }

          const { data: attachmentInsert, error: attachmentError } = await supabase
            .from('message_attachments')
            .insert({
              message_id: savedMessage.id,
              file_name: attachment.fileName,
              file_path: attachment.storagePath,
              file_type: attachment.fileType,
              file_size: attachment.fileSize,
              uploaded_by: user.id,
            })
            .select()
            .single();

          if (attachmentError) {
            throw attachmentError;
          }

          const chatAttachment: ChatAttachment = {
            id: attachmentInsert?.id || `${savedMessage.id}-attachment`,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            url: signedUrl,
            storagePath: attachment.storagePath,
          };

          const newChatMessage: ChatMessage = {
            id: savedMessage.id,
            content: description,
            timestamp: savedMessage.contact_date,
            isOutgoing: true,
            status: 'sent',
            attachments: [chatAttachment],
          };

          setMessages((prev) => [...prev, newChatMessage]);
        }
      } else if (hasText) {
        await sendWhatsApp({ to: contactPhone, message: newMessage.trim() });

        const { data: savedMessage, error: saveError } = await supabase
          .from('client_contacts')
          .insert({
            client_id: contactId,
            contact_type: 'whatsapp',
            subject: 'Mensagem enviada via WhatsApp',
            description: newMessage.trim(),
            contact_date: new Date().toISOString(),
            created_by: user?.id,
          })
          .select()
          .single();

        if (saveError || !savedMessage) {
          throw saveError || new Error('Erro ao salvar mensagem.');
        }

        const newChatMessage: ChatMessage = {
          id: savedMessage.id,
          content: newMessage.trim(),
          timestamp: savedMessage.contact_date,
          isOutgoing: true,
          status: 'sent',
        };

        setMessages((prev) => [...prev, newChatMessage]);
      }

      setNewMessage("");
      setPendingAttachments([]);

      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada via WhatsApp.',
      });

      await loadWhatsAppContacts();
      await loadMessages(contactId);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro ao enviar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
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
    setPendingAttachments([]);
    setNewMessage("");
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

      <div className="flex gap-4 h-[calc(100vh-200px)] overflow-hidden">
        {/* Lista de Contatos */}
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <NotificationCenter />
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
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
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
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={contact.avatar} />
                        <AvatarFallback>
                          {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">{contact.name}</h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
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
                          <span className="truncate">{contact.phone}</span>
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
        <Card className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              {/* Header do Chat */}
              <CardHeader className="pb-3 border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedContact.avatar} />
                    <AvatarFallback>
                      {selectedContact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{selectedContact.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{selectedContact.phone}</span>
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
              </CardHeader>
              
              {/* Área de Mensagens */}
              <div className="flex-1 flex flex-col overflow-hidden">
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
                          <div className="space-y-2">
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="space-y-2">
                                {message.attachments.map((attachment) => {
                                  const key = `${message.id}-${attachment.id}`;
                                  if (attachment.fileType.startsWith('image/')) {
                                    return (
                                      <a
                                        key={key}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block overflow-hidden rounded-md border border-border"
                                      >
                                        <img
                                          src={attachment.url}
                                          alt={attachment.fileName}
                                          className="max-h-60 w-full object-cover"
                                        />
                                      </a>
                                    );
                                  }

                                  if (attachment.fileType.startsWith('video/')) {
                                    return (
                                      <div
                                        key={key}
                                        className="rounded-md border border-border bg-background/80 p-2 text-foreground"
                                      >
                                        <p className="mb-1 text-sm font-medium break-words">
                                          {attachment.fileName}
                                        </p>
                                        <video
                                          controls
                                          className="max-h-60 w-full rounded-md"
                                          src={attachment.url}
                                        >
                                          Seu navegador não suporta o elemento de vídeo.
                                        </video>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {formatFileSize(attachment.fileSize)}
                                        </p>
                                      </div>
                                    );
                                  }

                                  if (attachment.fileType.startsWith('audio/')) {
                                    return (
                                      <div
                                        key={key}
                                        className="rounded-md border border-border bg-background/80 p-2 text-foreground"
                                      >
                                        <p className="mb-1 text-sm font-medium break-words">
                                          {attachment.fileName}
                                        </p>
                                        <audio controls className="w-full">
                                          <source src={attachment.url} type={attachment.fileType} />
                                          Seu navegador não suporta o elemento de áudio.
                                        </audio>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {formatFileSize(attachment.fileSize)}
                                        </p>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={key}
                                      className="rounded-md border border-border bg-background/80 p-3 text-foreground"
                                    >
                                      <p className="text-sm font-medium break-words">{attachment.fileName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {attachment.fileType} • {formatFileSize(attachment.fileSize)}
                                      </p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <Button variant="secondary" size="sm" asChild>
                                          <a
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <Eye className="mr-1 h-4 w-4" /> Visualizar
                                          </a>
                                        </Button>
                                        <Button variant="outline" size="sm" asChild>
                                          <a
                                            href={attachment.url}
                                            download={attachment.fileName}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <Download className="mr-1 h-4 w-4" /> Baixar
                                          </a>
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {message.content && (
                              <p className="text-sm break-words">{message.content}</p>
                            )}
                          </div>

                          <p className="mt-2 text-xs opacity-70">
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

                {/* Input de Mensagem */}
                <div className="p-4 border-t bg-background flex-shrink-0 space-y-3">
                  <FileUpload
                    onFileUploaded={(file) => {
                      setPendingAttachments((prev) => [...prev, file]);
                      toast({
                        title: 'Arquivo anexado',
                        description: `${file.fileName} está pronto para envio.`,
                      });
                    }}
                    disabled={!selectedContact || isSending}
                  />

                  {pendingAttachments.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-dashed border-muted bg-muted/40 p-3">
                      <p className="text-sm font-medium">Arquivos prontos para envio</p>
                      <div className="space-y-2">
                        {pendingAttachments.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-3 rounded-md bg-background p-2 shadow-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {file.fileType} • {formatFileSize(file.fileSize)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePendingAttachment(file.id)}
                              className="h-8 w-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      disabled={!selectedContact || isSending}
                    />
                    <Button
                      onClick={sendMessage}
                      size="icon"
                      disabled={(!newMessage.trim() && pendingAttachments.length === 0) || isSending}
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