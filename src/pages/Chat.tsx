import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MessageSquare, Phone, Search, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { useCustomNotifications } from "@/hooks/useCustomNotifications";
import { NotificationCenter } from "@/components/NotificationCenter";
import { FileUpload, UploadedFileInfo } from "@/components/chat/FileUpload";
import { MediaMessage } from "@/components/chat/MediaMessage";
import type { Database } from "@/integrations/supabase/types";

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

interface ClearConversationResponse {
  success: boolean;
  error?: string;
  failedStorage?: { path: string; error: string }[];
}

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientContactRow = Database["public"]["Tables"]["client_contacts"]["Row"];
type MessageAttachmentRow = Database["public"]["Tables"]["message_attachments"]["Row"];

const SUPABASE_MEDIA_PROXY_URL =
  "https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/media-proxy";

const buildMediaProxyUrl = (path: string, bucket = "chat-files") =>
  `${SUPABASE_MEDIA_PROXY_URL}?path=${encodeURIComponent(path)}&bucket=${encodeURIComponent(bucket)}`;

const isIncomingSubject = (subject?: string | null) =>
  typeof subject === "string" && subject.toLowerCase().includes("recebida");

const isOutgoingSubject = (subject?: string | null) =>
  typeof subject === "string" && subject.toLowerCase().includes("enviada");

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
  const [isClearingConversation, setIsClearingConversation] = useState(false);

  // Verificar sessão ao entrar no chat
  useEffect(() => {
    const verifySessionOnMount = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Erro ao verificar sessão no Chat:', error);
        }
        if (!session) {
          console.warn('Sem sessão ativa ao entrar no Chat');
        } else {
          console.log('Sessão válida no Chat');
        }
      } catch (error) {
        console.error('Erro inesperado ao verificar sessão no Chat:', error);
      }
    };

    verifySessionOnMount();
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contactsRef = useRef<WhatsAppContact[]>([]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  const notifyNewMessage = useCallback(
    (message: string, contactName: string) => {
      showNotification(`📱 Nova mensagem de ${contactName}`, message);
      try {
        const audio = new Audio("/sounds/gentle-bell.mp3");
        audio.volume = 0.3;
        audio.play().catch(() => {
          /* ignore autoplay restrictions */
        });
      } catch (error) {
        console.error("Erro ao tocar som de notificação:", error);
      }
      setUnreadMessagesCount((prev) => prev + 1);
    },
    [showNotification],
  );

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

  const getSignedUrlForPath = useCallback(async (storagePath: string) => {
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
  }, []);

  const isValidHttpUrl = useCallback(
    (value?: string | null) => typeof value === "string" && /^https?:\/\//i.test(value),
    [],
  );

  const mapAttachmentRowToChatAttachment = useCallback(
    (attachment: MessageAttachmentRow): ChatAttachment => {
      const storagePath = attachment.file_path;
      const isExternal = isValidHttpUrl(storagePath);
      return {
        id: attachment.id,
        fileName: attachment.file_name,
        fileType: attachment.file_type,
        fileSize: attachment.file_size,
        url: isExternal ? storagePath : buildMediaProxyUrl(storagePath),
        storagePath: isExternal ? undefined : storagePath,
      };
    },
    [isValidHttpUrl],
  );

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
  const loadWhatsAppContacts = useCallback(async (options: { silent?: boolean } = {}) => {
    const { silent } = options;

    if (!silent) {
      setLoading(true);
    }
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
        setUnreadMessagesCount(0);
        return;
      }

      let totalUnread = 0;

      const contactsWithLastMessage = await Promise.all(
        clients.map(async (client: Pick<ClientRow, "id" | "name" | "phone" | "created_at">) => {
          const [lastContactResult, unreadCountResult] = await Promise.all([
            supabase
              .from("client_contacts")
              .select("*")
              .eq("client_id", client.id)
              .eq("contact_type", "whatsapp")
              .not("subject", "ilike", "ROUTING:%")
              .order("contact_date", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("client_contacts")
              .select("id")
              .eq("client_id", client.id)
              .eq("contact_type", "whatsapp")
              .eq("subject", "Mensagem recebida via WhatsApp"),
          ]);

          const lastContact = (lastContactResult.data as ClientContactRow | null) ?? null;
          const unreadCandidates = (unreadCountResult.data as { id: string }[] | null) ?? [];

          const readMessagesKey = `read_messages_${client.id}`;
          const readMessages = new Set<string>(
            JSON.parse(localStorage.getItem(readMessagesKey) || "[]"),
          );

          const unreadMessages = unreadCandidates.filter((msg) => !readMessages.has(msg.id));
          const unreadCount = unreadMessages.length;
          totalUnread += unreadCount;

          const lastMessage =
            lastContact?.description || lastContact?.subject || "Nenhuma conversa ainda";

          return {
            id: client.id,
            name: client.name,
            phone: client.phone ?? "",
            lastMessage,
            lastMessageTime: lastContact?.contact_date || client.created_at,
            unreadCount,
            avatar: "",
            isOnline: Math.random() > 0.5,
          } as WhatsAppContact;
        }),
      );

      setContacts(contactsWithLastMessage);
      setUnreadMessagesCount(totalUnread);
    } catch (error) {
      console.error("Erro ao carregar contatos WhatsApp:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos do WhatsApp.",
        variant: "destructive",
      });
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [toast]);

  // -------- Carregar Mensagens --------
  const loadMessages = useCallback(
    async (contactId: string) => {
      try {
        const { data: contactHistory, error } = await supabase
          .from("client_contacts")
          .select("*")
          .eq("client_id", contactId)
          .eq("contact_type", "whatsapp")
          .not("subject", "ilike", "ROUTING:%")
          .order("contact_date", { ascending: true });

        if (error) throw error;

        if (!contactHistory || contactHistory.length === 0) {
          setMessages([]);
          const readMessagesKey = `read_messages_${contactId}`;
          localStorage.setItem(readMessagesKey, JSON.stringify([]));
          return;
        }

        const contactRows = contactHistory as ClientContactRow[];

        const chatMessages: ChatMessage[] = contactRows.map((contact) => {
          const outgoing = isOutgoingSubject(contact.subject);
          return {
            id: contact.id,
            content: contact.description || contact.subject || "Mensagem sem conteúdo",
            timestamp: contact.contact_date,
            isOutgoing: outgoing,
            status: outgoing ? ("sent" as MsgStatus) : ("delivered" as MsgStatus),
          };
        });

        const messageIds = chatMessages.map((msg) => msg.id);

        if (messageIds.length > 0) {
          const { data: attachmentData, error: attachmentError } = await supabase
            .from("message_attachments")
            .select("*")
            .in("message_id", messageIds);

          if (attachmentError) {
            console.error("Erro ao carregar anexos:", attachmentError);
          } else if (attachmentData && attachmentData.length > 0) {
            const attachmentsByMessage: Record<string, ChatAttachment[]> = {};

            (attachmentData as MessageAttachmentRow[]).forEach((attachment) => {
              const chatAttachment = mapAttachmentRowToChatAttachment(attachment);
              if (!attachmentsByMessage[attachment.message_id]) {
                attachmentsByMessage[attachment.message_id] = [];
              }
              attachmentsByMessage[attachment.message_id].push(chatAttachment);
            });

            chatMessages.forEach((message, index) => {
              const attachments = attachmentsByMessage[message.id];
              if (attachments && attachments.length > 0) {
                chatMessages[index] = {
                  ...message,
                  attachments,
                };
              }
            });
          }
        }

        setMessages(chatMessages);

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
    },
    [mapAttachmentRowToChatAttachment, toast],
  );

  const handleClearConversation = useCallback(async () => {
    if (!selectedContact) return;

    setIsClearingConversation(true);

    try {
      const contactId = selectedContact.id;

      const { data, error } = await supabase.functions.invoke(
        "whatsapp-clear-history",
        {
          body: {
            clientId: contactId,
          },
        },
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        const failedStorageMessage = Array.isArray(data?.failedStorage) && data.failedStorage.length > 0
          ? "Não foi possível remover alguns arquivos do armazenamento."
          : null;

        throw new Error(
          typeof data?.error === "string" && data.error.trim()
            ? data.error
            : failedStorageMessage || "Falha ao apagar o histórico deste contato.",
        );
      }

      setMessages([]);
      const readMessagesKey = `read_messages_${selectedContact.id}`;
      localStorage.removeItem(readMessagesKey);

      toast({
        title: "Conversas apagadas",
        description: `O histórico com ${selectedContact.name} foi removido.`,
      });

      await loadWhatsAppContacts({ silent: false });
    } catch (error) {
      console.error("Erro ao apagar conversas:", error);
      toast({
        title: "Erro ao apagar conversas",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível remover o histórico deste contato.",
        variant: "destructive",
      });
    } finally {
      setIsClearingConversation(false);
    }
  }, [selectedContact, toast, loadWhatsAppContacts]);

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
            url: attachment.storagePath ? buildMediaProxyUrl(attachment.storagePath) : signedUrl,
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

      await loadWhatsAppContacts({ silent: true });
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

  useEffect(() => {
    const activeContactId = selectedContact?.id;

    const channel = supabase
      .channel("whatsapp-chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_contacts",
          filter: "contact_type=eq.whatsapp",
        },
        async (payload) => {
          const newContact = payload.new as ClientContactRow | undefined;
          if (!newContact) return;
          if (newContact.subject?.startsWith("ROUTING:")) return;

          try {
            const contactId = newContact.client_id;
            const outgoing = isOutgoingSubject(newContact.subject);

            const isCurrentUserMessage = newContact.created_by === user?.id;

            if (activeContactId && contactId === activeContactId) {
              let attachments: ChatAttachment[] | undefined;

              try {
                const { data: attachmentRows } = await supabase
                  .from("message_attachments")
                  .select("*")
                  .eq("message_id", newContact.id);

                if (attachmentRows && attachmentRows.length > 0) {
                  attachments = (attachmentRows as MessageAttachmentRow[]).map(
                    mapAttachmentRowToChatAttachment,
                  );
                }
              } catch (attachmentError) {
                console.error("Erro ao carregar anexos em tempo real:", attachmentError);
              }

              setMessages((prev) => {
                const existingIndex = prev.findIndex((msg) => msg.id === newContact.id);
                if (existingIndex >= 0) {
                  if (!attachments || attachments.length === 0) {
                    return prev;
                  }

                  const existingAttachments = prev[existingIndex].attachments ?? [];
                  const existingAttachmentIds = new Set(existingAttachments.map((att) => att.id));
                  const mergedAttachments = [
                    ...existingAttachments,
                    ...attachments.filter((att) => !existingAttachmentIds.has(att.id)),
                  ];

                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...prev[existingIndex],
                    attachments: mergedAttachments,
                  };
                  return updated;
                }

                const newMessage: ChatMessage = {
                  id: newContact.id,
                  content:
                    newContact.description ||
                    newContact.subject ||
                    "Mensagem sem conteúdo",
                  timestamp: newContact.contact_date,
                  isOutgoing: outgoing,
                  status: outgoing ? "sent" : "delivered",
                  ...(attachments && attachments.length > 0 ? { attachments } : {}),
                };

                return [...prev, newMessage];
              });

              if (!outgoing) {
                const readMessagesKey = `read_messages_${contactId}`;
                const stored = new Set<string>(
                  JSON.parse(localStorage.getItem(readMessagesKey) || "[]"),
                );
                stored.add(newContact.id);
                localStorage.setItem(readMessagesKey, JSON.stringify(Array.from(stored)));
              }

              await loadWhatsAppContacts({ silent: true });
              return;
            }

            if (!outgoing) {
              const contactsSnapshot = contactsRef.current;
              const contactName =
                contactsSnapshot.find((contact) => contact.id === contactId)?.name ||
                "Cliente WhatsApp";

              notifyNewMessage(
                newContact.description ||
                  newContact.subject ||
                  "Nova mensagem recebida via WhatsApp",
                contactName,
              );
            } else if (isCurrentUserMessage) {
              return;
            }

            await loadWhatsAppContacts({ silent: true });
          } catch (error) {
            console.error("Erro ao processar atualização em tempo real do chat:", error);
          }
        },
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    selectedContact?.id,
    user?.id,
    loadWhatsAppContacts,
    mapAttachmentRowToChatAttachment,
    notifyNewMessage,
  ]);

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-chat-attachments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_attachments" },
        (payload) => {
          const attachment = payload.new as MessageAttachmentRow | undefined;
          if (!attachment) return;

          setMessages((prev) => {
            const index = prev.findIndex((message) => message.id === attachment.message_id);
            if (index === -1) return prev;

            const mappedAttachment = mapAttachmentRowToChatAttachment(attachment);
            const existingAttachments = prev[index].attachments ?? [];
            if (existingAttachments.some((att) => att.id === mappedAttachment.id)) {
              return prev;
            }

            const updated = [...prev];
            updated[index] = {
              ...prev[index],
              attachments: [...existingAttachments, mappedAttachment],
            };
            return updated;
          });
        },
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mapAttachmentRowToChatAttachment]);

  // Scroll automático para última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Carregar contatos inicialmente
  useEffect(() => {
    const clearChatHistoryEntries = () => {
      try {
        const keysToRemove: string[] = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key?.startsWith("read_messages_")) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (error) {
        console.error("Erro ao limpar histórico do chat:", error);
      }
    };

    clearChatHistoryEntries();
    loadWhatsAppContacts();
  }, [loadWhatsAppContacts, user?.id]);

  const handleContactSelect = async (contact: WhatsAppContact) => {
    setSelectedContact(contact);
    setPendingAttachments([]);
    setNewMessage("");
    await loadMessages(contact.id);
    await loadWhatsAppContacts({ silent: true });
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Business" />

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-0">
        {/* Lista de Contatos */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          <Card className="h-full flex flex-col">
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
            <CardContent className="p-0 flex-1 min-h-0">
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
                          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground mt-1 min-w-0">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="break-all min-w-0">{contact.phone}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-normal break-words line-clamp-3">
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
        </div>

        {/* Área de Chat */}
        <div className="flex-1 min-w-0">
          <Card className="h-full flex flex-col">
            {selectedContact ? (
              <>
              {/* Header do Chat */}
              <CardHeader className="pb-3 border-b flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedContact.avatar} />
                      <AvatarFallback>
                        {selectedContact.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold leading-tight break-words">
                        {selectedContact.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          <span className="break-all">{selectedContact.phone}</span>
                        </div>
                        {selectedContact.isOnline && (
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span>Online</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        disabled={isClearingConversation}
                        aria-label="Apagar conversas"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Apagar histórico de mensagens</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa ação removerá todas as mensagens trocadas com {selectedContact.name}.
                          O contato permanecerá disponível na lista para futuras conversas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearConversation}
                          disabled={isClearingConversation}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Apagar conversas
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              
              {/* Área de Mensagens */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ScrollArea className="h-full px-3 py-4">
                    <div className="space-y-4 w-full pr-6 sm:pr-8 lg:pr-10">
                      {messages.map((message) => (
                         <div
                           key={message.id}
                           className={`flex w-full chat-message-container ${message.isOutgoing ? "justify-end pr-1" : "justify-start"}`}
                         >
                           <div
                             className={`chat-message-bubble flex max-w-[75%] min-w-0 w-auto flex-col gap-2 rounded-2xl px-3 py-2 shadow-sm ${
                               message.isOutgoing
                                 ? "bg-primary text-primary-foreground"
                                 : "bg-muted"
                             } sm:max-w-[65%] lg:max-w-[50%]`}
                           >
                            <div className="space-y-2">
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="space-y-2">
                                  {message.attachments.map((attachment) => (
                                    <MediaMessage
                                      key={`${message.id}-${attachment.id}`}
                                      attachment={{
                                        id: attachment.id,
                                        fileName: attachment.fileName,
                                        fileType: attachment.fileType,
                                        fileSize: attachment.fileSize,
                                        downloadUrl: attachment.url,
                                        storagePath: attachment.storagePath
                                      }}
                                    />
                                  ))}
                                </div>
                              )}

                               {message.content && (
                                 <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-visible word-wrap">
                                   {message.content}
                                 </p>
                               )}
                            </div>

                            <div
                              className={`flex flex-wrap items-center gap-1 text-xs opacity-70 ${
                                message.isOutgoing ? "justify-end" : "justify-start"
                              }`}
                            >
                              <span>{formatTime(message.timestamp)}</span>
                              {message.isOutgoing && (
                                <span className="ml-1 flex items-center gap-0.5">
                                  {message.status === "sent" && "✓"}
                                  {message.status === "delivered" && "✓✓"}
                                  {message.status === "read" && "✓✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

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
    </div>
  );
}