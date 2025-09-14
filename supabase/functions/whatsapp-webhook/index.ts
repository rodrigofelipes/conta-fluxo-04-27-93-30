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

// Função para verificar se mensagem é seleção do menu
function isMenuSelection(message: string): boolean {
  const trimmed = message.trim();
  return ['0', '1', '2', '3', '4'].includes(trimmed);
}

async function saveWhatsAppMessage(clientId: string, messageText: string, isOutgoing: boolean, adminId?: string) {
  console.log(`💾 Salvando mensagem WhatsApp - Cliente: ${clientId}, Admin: ${adminId}, Outgoing: ${isOutgoing}`);
  
  const { error } = await supabase
    .from('client_contacts')
    .insert({
      client_id: clientId,
      contact_type: 'whatsapp',
      subject: isOutgoing ? 'Mensagem enviada via WhatsApp' : 'Mensagem recebida via WhatsApp',
      description: messageText,
      contact_date: new Date().toISOString(),
      created_by: adminId || null
    });
    
  if (error) {
    console.error('❌ Erro ao salvar mensagem WhatsApp:', error);
    return false;
  }
  
  console.log('✅ Mensagem WhatsApp salva com sucesso');
  return true;
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
              const messageText = message.text?.body || 'Mensagem de mídia';
              
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
              
              let assignedUser = null;
              
              // Verificar se é uma seleção do menu
              if (conversation.state === 'awaiting_selection' && isMenuSelection(messageText)) {
                console.log(`🎯 Cliente selecionou opção: ${messageText}`);
                
                // Rotear para usuário baseado na seleção
                assignedUser = await routeUserBySelection(messageText);
                
                if (assignedUser) {
                  // Atualizar conversa com usuário atribuído
                  await updateConversationState(senderPhone, {
                    state: 'routed',
                    selected_option: messageText,
                    assigned_to: assignedUser.id
                  });
                  
                  console.log(`✅ Conversa roteada para: ${assignedUser.name} (${assignedUser.role})`);
                } else {
                  // Fallback para admin se não encontrar usuário específico
                  assignedUser = await findUserByRole('admin');
                  if (assignedUser) {
                    await updateConversationState(senderPhone, {
                      state: 'routed',
                      selected_option: messageText,
                      assigned_to: assignedUser.id
                    });
                    console.log(`⚠️ Roteamento fallback para admin: ${assignedUser.name}`);
                  }
                }
              } else if (conversation.state === 'routed' && conversation.assigned_to) {
                // Conversa já roteada - usar usuário atribuído
                const { data: userData } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', conversation.assigned_to)
                  .single();
                
                if (userData) {
                  assignedUser = userData;
                  console.log(`📨 Mensagem para usuário atribuído: ${assignedUser.name}`);
                } else {
                  // Fallback se usuário atribuído não for encontrado
                  assignedUser = await findUserByRole('admin');
                  console.log(`⚠️ Usuário atribuído não encontrado, usando admin fallback`);
                }
              } else {
                // Estado inicial ou não definido - usar admin
                assignedUser = await findUserByRole('admin');
                console.log(`📨 Usando admin padrão para mensagem`);
              }
              
              // Salvar mensagem
              if (assignedUser) {
                console.log(`📱 Salvando mensagem do cliente ${cliente.name} para ${assignedUser.name}`);
                await saveWhatsAppMessage(
                  cliente.id,
                  messageText,
                  false, // não é mensagem enviada, é recebida
                  assignedUser.user_id
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