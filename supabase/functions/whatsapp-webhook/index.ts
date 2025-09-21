import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || 'TokenVerifyConcep2020';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Cache de telefones para evitar busca repetida
const phoneCache = new Map<string, { client: any; cacheTime: number } | null>();
const userRoleCache = new Map<string, { user: any; cacheTime: number } | null>();
const conversationCache = new Map<string, { conversation: any; cacheTime: number } | null>();
const PHONE_CACHE_TTL = 10 * 60 * 1000; // 10 minutos
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function findClientByPhone(phone: string) {
  console.log(`🔍 Procurando cliente com telefone: ${phone}`);
  
  // Remove caracteres especiais e espaços do telefone
  const cleanPhone = phone.replace(/\D/g, '');
  console.log(`📞 Telefone limpo: ${cleanPhone}`);
  
  // Verificar cache primeiro
  const cacheKey = cleanPhone;
  const cached = phoneCache.get(cacheKey);
  if (cached && (Date.now() - cached.cacheTime) < PHONE_CACHE_TTL) {
    if (cached.client) {
      console.log(`✅ Cliente do cache: ${cached.client.name}`);
      return cached.client;
    } else {
      console.log('❌ Telefone não encontrado (cache)');
      return null;
    }
  }
  
  // Buscar cliente pelo telefone
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone, email')
    .eq('phone', phone)
    .maybeSingle();
    
  if (error) {
    console.log(`❌ Erro na busca: ${error.message}`);
    phoneCache.set(cacheKey, { client: null, cacheTime: Date.now() });
    return null;
  }
  
  // Atualizar cache
  phoneCache.set(cacheKey, { client: data, cacheTime: Date.now() });
  
  if (!data) {
    console.log(`❌ Nenhum cliente encontrado para telefone: ${phone}`);
    return null;
  }
  
  console.log(`✅ Cliente encontrado: ${data.name} (Tel: ${data.phone})`);
  return data;
}

// Função para encontrar usuário por nome específico
async function findUserByName(name: string): Promise<any> {
  console.log(`🔍 Procurando usuário: ${name}`);
  
  const cacheKey = `name_${name}`;
  const cached = userRoleCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.cacheTime) < USER_CACHE_TTL) {
    if (cached.user) {
      console.log(`✅ Usuário ${name} do cache: ${cached.user.name}`);
      return cached.user;
    }
  }

  const { data: userData, error } = await supabase
    .from('profiles')
    .select('id, user_id, name, email, role')
    .eq('name', name)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`❌ Erro ao buscar usuário ${name}:`, error);
    userRoleCache.set(cacheKey, { user: null, cacheTime: Date.now() });
    return null;
  }

  if (!userData) {
    console.log(`❌ Usuário ${name} não encontrado`);
    userRoleCache.set(cacheKey, { user: null, cacheTime: Date.now() });
    return null;
  }

  const user = {
    id: userData.id,
    user_id: userData.user_id,
    name: userData.name,
    email: userData.email,
    role: userData.role
  };

  userRoleCache.set(cacheKey, { user, cacheTime: Date.now() });
  console.log(`✅ Usuário ${name} encontrado (${user.role})`);
  return user;
}

// Função para encontrar usuário por role (fallback)
async function findUserByRole(role: string): Promise<any> {
  console.log(`🔍 Procurando usuário com role: ${role}`);
  
  const cacheKey = `role_${role}`;
  const cached = userRoleCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.cacheTime) < USER_CACHE_TTL) {
    if (cached.user) {
      console.log(`✅ Usuário ${role} do cache: ${cached.user.name}`);
      return cached.user;
    }
  }

  const { data: userData, error } = await supabase
    .from('profiles')
    .select('id, user_id, name, email, role')
    .eq('role', role)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`❌ Erro ao buscar usuário ${role}:`, error);
    userRoleCache.set(cacheKey, { user: null, cacheTime: Date.now() });
    return null;
  }

  if (!userData) {
    console.log(`❌ Nenhum usuário ${role} encontrado`);
    userRoleCache.set(cacheKey, { user: null, cacheTime: Date.now() });
    return null;
  }

  const user = {
    id: userData.id,
    user_id: userData.user_id,
    name: userData.name,
    email: userData.email,
    role: userData.role
  };

  userRoleCache.set(cacheKey, { user, cacheTime: Date.now() });
  console.log(`✅ Usuário ${role} encontrado: ${user.name}`);
  return user;
}

// Função para obter ou criar estado da conversa
async function getOrCreateConversation(phone: string, clientId?: string) {
  const cacheKey = `conv_${phone}`;
  const cached = conversationCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.cacheTime) < USER_CACHE_TTL) {
    return cached.conversation;
  }

  // Buscar conversa existente
  const { data: conversation, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('phone_number', phone)
    .maybeSingle();

  if (conversation) {
    conversationCache.set(cacheKey, { conversation, cacheTime: Date.now() });
    return conversation;
  }

  // Criar nova conversa se não existir
  const { data: newConversation, error: createError } = await supabase
    .from('whatsapp_conversations')
    .insert({
      phone_number: phone,
      client_id: clientId,
      state: 'awaiting_selection'
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Erro ao criar conversa:', createError);
    return null;
  }

  conversationCache.set(cacheKey, { conversation: newConversation, cacheTime: Date.now() });
  console.log(`✅ Nova conversa criada para: ${phone}`);
  return newConversation;
}

// Função para atualizar estado da conversa
async function updateConversationState(phone: string, updates: any) {
  const cacheKey = `conv_${phone}`;
  conversationCache.delete(cacheKey); // Limpar cache

  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('phone_number', phone)
    .select()
    .single();

  if (error) {
    console.error('❌ Erro ao atualizar conversa:', error);
    return null;
  }

  conversationCache.set(cacheKey, { conversation: data, cacheTime: Date.now() });
  console.log(`✅ Conversa atualizada: ${phone} -> ${updates.state || 'sem mudança de estado'}`);
  return data;
}

// Função para rotear usuário baseado na seleção
async function routeUserBySelection(selection: string): Promise<any> {
  console.log(`🎯 Roteando baseado na seleção: ${selection}`);
  
  switch (selection.trim()) {
    case '1': // Coordenador -> Leticia
      console.log('🎯 Procurando Leticia (coordenador)');
      return await findUserByName('Leticia');
    case '2': // Supervisor -> Thuany
      console.log('🎯 Procurando Thuany (supervisor)');
      return await findUserByName('Thuany');
    case '3': // Admin -> Mara
    case '0': // Não sei o departamento -> Mara
      console.log('🎯 Procurando Mara (admin)');
      return await findUserByName('Mara');
    case '4': // Colaborador -> Mara como fallback
      console.log('🎯 Procurando Mara (fallback colaborador)');
      return await findUserByName('Mara');
    default:
      console.log(`⚠️ Seleção inválida: ${selection}, usando Mara como fallback`);
      return await findUserByName('Mara');
  }
}

// Função para enviar mensagem de aguarde para o cliente
async function sendWelcomeMessage(phone: string) {
  const welcomeMessage = `Olá! 👋 Bem-vindo à Olevate! 

Obrigado pelo seu contato. Um de nossos atendentes irá falar com você em breve.

Aguarde um momento, por favor! 😊`;

  try {
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    console.log(`📱 Tentando enviar mensagem de boas-vindas usando Phone Number ID: ${phoneNumberId ? 'configurado' : 'NÃO CONFIGURADO'}`);
    
    if (!phoneNumberId) {
      console.error('❌ WHATSAPP_PHONE_NUMBER_ID não está configurado');
      return false;
    }
    
    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error('❌ WHATSAPP_ACCESS_TOKEN não está configurado');
      return false;
    }
    
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: {
          body: welcomeMessage
        }
      })
    });

    if (response.ok) {
      console.log(`✅ Mensagem de boas-vindas enviada para ${phone}`);
      return true;
    } else {
      const errorData = await response.json();
      console.error('❌ Erro ao enviar mensagem de boas-vindas:', errorData);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro na requisição da mensagem de boas-vindas:', error);
    return false;
  }
}

interface StoredAttachment {
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
}

async function saveWhatsAppMessage(
  clientId: string,
  messageText: string,
  isOutgoing: boolean,
  adminId?: string,
  attachments?: StoredAttachment[]
) {
  console.log(`💾 Salvando mensagem WhatsApp - Cliente: ${clientId}, Admin: ${adminId}, Outgoing: ${isOutgoing}`);

  // Find admin user for messages table
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('user_id', adminId)
    .single();

  const adminName = adminProfile?.name || 'Admin';

  // Save to messages table for chat interface
  const { data: messageRecord, error } = await supabase
    .from('messages')
    .insert({
      from_user_id: isOutgoing ? adminId : `whatsapp-${clientId}`,
      to_user_id: isOutgoing ? `whatsapp-${clientId}` : adminId,
      message: messageText,
      from_user_name: isOutgoing ? adminName : `Cliente WhatsApp`,
      to_user_name: isOutgoing ? `Cliente WhatsApp` : adminName,
      message_type: attachments && attachments.length > 0 ? 'attachment' : 'text'
    })
    .select()
    .single();

  if (error || !messageRecord) {
    console.error('❌ Erro ao salvar mensagem WhatsApp:', error);
    return null;
  }

  // Also save to client_contacts for record keeping
  await supabase
    .from('client_contacts')
    .insert({
      client_id: clientId,
      contact_type: 'whatsapp',
      subject: isOutgoing ? 'Mensagem enviada via WhatsApp' : 'Mensagem recebida via WhatsApp',
      description: messageText,
      contact_date: new Date().toISOString(),
      created_by: adminId || null
    });

  if (attachments && attachments.length > 0) {
    const attachmentsWithMessageId = attachments.map((attachment) => ({
      ...attachment,
      message_id: messageRecord.id,
    }));

    const { error: attachmentError } = await supabase
      .from('message_attachments')
      .insert(attachmentsWithMessageId);

    if (attachmentError) {
      console.error('❌ Erro ao salvar anexos da mensagem:', attachmentError);
    } else {
      console.log(`📎 ${attachments.length} anexo(s) vinculados à mensagem ${messageRecord.id}`);
    }
  }

  console.log('✅ Mensagem WhatsApp salva com sucesso');
  return messageRecord;
}

const getExtensionFromMime = (mimeType?: string) => {
  if (!mimeType) return undefined;
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic')) return 'heic';
  if (mimeType.includes('heif')) return 'heif';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('msword')) return 'doc';
  if (mimeType.includes('presentation')) return 'ppt';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'xls';
  if (mimeType.includes('plain')) return 'txt';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('audio/mpeg')) return 'mp3';
  if (mimeType.includes('audio/aac')) return 'aac';
  if (mimeType.includes('audio/ogg')) return 'ogg';
  if (mimeType.includes('audio/wav')) return 'wav';
  return undefined;
};

async function downloadAndStoreMedia(
  mediaId: string,
  uploadedBy: string,
  options: { mimeType?: string; fileName?: string }
): Promise<StoredAttachment | null> {
  try {
    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error('❌ WHATSAPP_ACCESS_TOKEN não configurado para baixar mídia');
      return null;
    }

    console.log(`⬇️ Baixando mídia ${mediaId}`);

    const metadataResponse = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    if (!metadataResponse.ok) {
      const errorData = await metadataResponse.text();
      console.error(`❌ Falha ao obter metadados da mídia ${mediaId}:`, errorData);
      return null;
    }

    const metadata = await metadataResponse.json();
    const downloadUrl = metadata.url;
    const mimeType = options.mimeType || metadata.mime_type || 'application/octet-stream';
    const fileSizeFromMeta = metadata.file_size as number | undefined;
    const metaFileName = metadata.file_name || metadata.filename;

    if (!downloadUrl) {
      console.error(`❌ URL de download não disponível para mídia ${mediaId}`);
      return null;
    }

    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    if (!mediaResponse.ok) {
      const errorData = await mediaResponse.text();
      console.error(`❌ Falha ao baixar a mídia ${mediaId}:`, errorData);
      return null;
    }

    const arrayBuffer = await mediaResponse.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    const fileSize = fileSizeFromMeta ?? fileBuffer.byteLength;
    const inferredExtension = getExtensionFromMime(mimeType);

    const baseName = options.fileName || metaFileName || `whatsapp-${mediaId}`;
    const hasExtension = baseName.includes('.');
    const finalFileName = hasExtension || !inferredExtension ? baseName : `${baseName}.${inferredExtension}`;

    const storageFileName = `${Date.now()}-${mediaId}-${finalFileName.replace(/\s+/g, '_')}`;
    const storagePath = `${uploadedBy}/${storageFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Erro ao salvar mídia no storage:', uploadError);
      return null;
    }

    return {
      file_name: finalFileName,
      file_path: storagePath,
      file_type: mimeType,
      file_size: fileSize,
      uploaded_by: uploadedBy,
    };
  } catch (error) {
    console.error(`❌ Erro inesperado ao processar mídia ${mediaId}:`, error);
    return null;
  }
}

async function createUnknownClient(phone: string, firstMessage: string) {
  console.log(`👤 Criando cliente para número desconhecido: ${phone}`);
  
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      name: `Cliente WhatsApp ${phone}`,
      phone: phone,
      email: `${phone.replace(/\D/g, '')}@whatsapp.temp`,
      classification: 'cliente',
      indication: 'WhatsApp'
    })
    .select('id, name, phone')
    .single();
    
  if (error) {
    console.error('❌ Erro ao criar cliente:', error);
    return null;
  }
  
  console.log(`✅ Cliente criado: ${newClient.name}`);
  return newClient;
}

serve(async (req) => {
  const url = new URL(req.url);

  console.log(`${req.method} ${url.pathname}${url.search}`);
  
  if (req.method === "GET" && url.pathname.endsWith("/whatsapp-webhook")) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    
    console.log("Verification attempt:", { mode, token, challenge, expectedToken: VERIFY_TOKEN });
    
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Verification successful");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    
    console.log("❌ Verification failed");
    return new Response("Verification failed", { status: 403 });
  }

  if (req.method === "POST" && url.pathname.endsWith("/whatsapp-webhook")) {
    try {
      const body = await req.json();
      console.log("📨 Webhook payload:", JSON.stringify(body, null, 2));
      
      // Processar mensagens do WhatsApp
      if (body.entry && body.entry[0]?.changes) {
        for (const change of body.entry[0].changes) {
          if (change.value?.messages) {
            for (const message of change.value.messages) {
              console.log(`📱 Nova mensagem WhatsApp: ${message.text?.body || 'Mídia'}`);
              
              const senderPhone = message.from;
              const messageType = message.type;
              let messageText = message.text?.body || 'Mensagem de mídia';
              const attachmentsToStore: StoredAttachment[] = [];

              // Buscar cliente pelo telefone
              let cliente = await findClientByPhone(senderPhone);
              
              // Se cliente não existir, criar um novo
              if (!cliente) {
                console.log(`❓ Contato desconhecido: ${senderPhone} - criando novo cliente`);
                cliente = await createUnknownClient(senderPhone, messageText);
                if (!cliente) {
                  console.error('❌ Não foi possível criar cliente para o número:', senderPhone);
                  continue;
                }
              }
              
              // Obter ou criar conversa
              const conversation = await getOrCreateConversation(senderPhone, cliente.id);
              if (!conversation) {
                console.error('❌ Não foi possível gerenciar conversa');
                continue;
              }

              // Sempre atribuir ao admin
              let assignedUser = await findUserByRole('admin');

              if (messageType === 'image') {
                messageText = message.image?.caption || 'Imagem recebida';
              } else if (messageType === 'video') {
                messageText = message.video?.caption || 'Vídeo recebido';
              } else if (messageType === 'audio') {
                messageText = 'Áudio recebido';
              } else if (messageType === 'document') {
                messageText = message.document?.caption || `Documento recebido${message.document?.filename ? `: ${message.document.filename}` : ''}`;
              } else if (messageType === 'sticker') {
                messageText = 'Figurinha recebida';
              }

              if (assignedUser && messageType && messageType !== 'text') {
                console.log(`📎 Mensagem contém mídia do tipo ${messageType}`);
                try {
                  if (messageType === 'image' && message.image?.id) {
                    const stored = await downloadAndStoreMedia(message.image.id, assignedUser.user_id, {
                      mimeType: message.image.mime_type,
                      fileName: message.image.filename,
                    });
                    if (stored) {
                      attachmentsToStore.push(stored);
                    }
                  } else if (messageType === 'video' && message.video?.id) {
                    const stored = await downloadAndStoreMedia(message.video.id, assignedUser.user_id, {
                      mimeType: message.video.mime_type,
                      fileName: message.video.filename,
                    });
                    if (stored) {
                      attachmentsToStore.push(stored);
                    }
                  } else if (messageType === 'audio' && message.audio?.id) {
                    const stored = await downloadAndStoreMedia(message.audio.id, assignedUser.user_id, {
                      mimeType: message.audio.mime_type,
                    });
                    if (stored) {
                      attachmentsToStore.push(stored);
                    }
                  } else if (messageType === 'document' && message.document?.id) {
                    const stored = await downloadAndStoreMedia(message.document.id, assignedUser.user_id, {
                      mimeType: message.document.mime_type,
                      fileName: message.document.filename,
                    });
                    if (stored) {
                      attachmentsToStore.push(stored);
                    }
                  } else if (messageType === 'sticker' && message.sticker?.id) {
                    const stored = await downloadAndStoreMedia(message.sticker.id, assignedUser.user_id, {
                      mimeType: message.sticker.mime_type,
                    });
                    if (stored) {
                      attachmentsToStore.push(stored);
                    }
                  }
                } catch (error) {
                  console.error('❌ Erro ao processar mídia recebida:', error);
                }
              }
              
              // Se é a primeira mensagem (awaiting_selection), enviar mensagem de boas-vindas
              if (conversation.state === 'awaiting_selection') {
                console.log('👋 Enviando mensagem de boas-vindas para cliente');
                const welcomeSent = await sendWelcomeMessage(senderPhone);
                
                if (welcomeSent) {
                  console.log('✅ Mensagem de boas-vindas enviada com sucesso');
                  
                  // Atualizar conversa para estado "contacted"
                  await updateConversationState(senderPhone, {
                    state: 'contacted',
                    assigned_to: assignedUser?.id
                  });
                } else {
                  console.error('❌ Falha ao enviar mensagem de boas-vindas');
                }
              }
              
              // Salvar mensagem
              if (assignedUser) {
                console.log(`📱 Salvando mensagem do cliente ${cliente.name} para ${assignedUser.name}`);
                await saveWhatsAppMessage(
                  cliente.id,
                  messageText,
                  false, // não é mensagem enviada, é recebida
                  assignedUser.user_id,
                  attachmentsToStore.length > 0 ? attachmentsToStore : undefined
                );
              } else {
                console.error('❌ Nenhum usuário disponível para receber a mensagem');
              }
              
              console.log('✅ Mensagem WhatsApp processada com sucesso');
            }
          }
        }
      }
      
      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      return new Response("ERROR", { status: 500 });
    }
  }

  return new Response("Not found", { status: 404 });
});