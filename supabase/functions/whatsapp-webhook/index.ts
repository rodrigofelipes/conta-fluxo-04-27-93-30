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
const PHONE_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

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

// Cache de admin para evitar busca repetida
let cachedAdmin: { id: string; username: string; fullName: string; cacheTime: number } | null = null;
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function findAvailableAdmin() {
  console.log('🔍 Procurando admin disponível...');

  // Usar cache se disponível e não expirado
  if (cachedAdmin && (Date.now() - cachedAdmin.cacheTime) < ADMIN_CACHE_TTL) {
    console.log(`✅ Admin do cache: ${cachedAdmin.username}`);
    return cachedAdmin;
  }

  // Buscar admin usando a tabela profiles
  const { data: adminData, error } = await supabase
    .from('profiles')
    .select('user_id, name, email')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ Erro ao buscar admin:', error);
    return null;
  }

  if (!adminData) {
    console.log('❌ Nenhum admin encontrado');
    return null;
  }

  const admin = {
    id: adminData.user_id,
    username: adminData.name || adminData.email,
    fullName: adminData.name || adminData.email,
    cacheTime: Date.now()
  };

  // Atualizar cache
  cachedAdmin = admin;

  console.log(`✅ Admin encontrado: ${admin.username}`);
  return admin;
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
              const cliente = await findClientByPhone(senderPhone);
              
              // Buscar admin disponível
              const admin = await findAvailableAdmin();
              if (!admin) {
                console.log('❌ Nenhum admin disponível');
                continue;
              }
              
              if (cliente) {
                // Cliente encontrado - salvar mensagem
                console.log(`📱 Salvando mensagem do cliente ${cliente.name}`);
                await saveWhatsAppMessage(
                  cliente.id,
                  messageText,
                  false, // não é mensagem enviada, é recebida
                  admin.id
                );
              } else {
                // Cliente não encontrado - criar novo cliente
                console.log(`❓ Contato desconhecido: ${senderPhone} - criando novo cliente`);
                
                const newClient = await createUnknownClient(senderPhone, messageText);
                if (newClient) {
                  // Salvar mensagem do novo cliente
                  await saveWhatsAppMessage(
                    newClient.id,
                    messageText,
                    false,
                    admin.id
                  );
                } else {
                  console.error('❌ Não foi possível criar cliente para o número:', senderPhone);
                }
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