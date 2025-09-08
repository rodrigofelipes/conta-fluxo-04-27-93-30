import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_API_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

Deno.serve(async (req) => {
  console.log('=== WhatsApp Send Function Called ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.log('Invalid method:', req.method);
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  // Log environment variables (without exposing sensitive data)
  console.log('Environment check:');
  console.log('ACCESS_TOKEN exists:', !!ACCESS_TOKEN);
  console.log('PHONE_NUMBER_ID exists:', !!PHONE_NUMBER_ID);
  console.log('PHONE_NUMBER_ID value:', PHONE_NUMBER_ID ? `***${PHONE_NUMBER_ID.slice(-4)}` : 'undefined');

  // Check if required environment variables are set
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.error('Missing WhatsApp credentials');
    console.error('ACCESS_TOKEN:', !!ACCESS_TOKEN);
    console.error('PHONE_NUMBER_ID:', !!PHONE_NUMBER_ID);
    return new Response(JSON.stringify({ 
      ok: false,
      error: "Configuração do WhatsApp incompleta. Verifique as variáveis de ambiente.",
      details: {
        hasAccessToken: !!ACCESS_TOKEN,
        hasPhoneNumberId: !!PHONE_NUMBER_ID,
        phoneId: PHONE_NUMBER_ID ? `***${PHONE_NUMBER_ID.slice(-4)}` : 'undefined'
      }
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body: any;
  try {
    const rawBody = await req.text();
    console.log('Raw request body:', rawBody);
    body = JSON.parse(rawBody);
    console.log('Parsed body:', body);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: "JSON inválido" 
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { to, message } = body;
  console.log('Extracted fields:', { to, message });
  
  if (!to || !message) {
    console.error('Missing required fields:', { to: !!to, message: !!message });
    return new Response(JSON.stringify({ 
      ok: false,
      error: "Campos 'to' e 'message' são obrigatórios" 
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Normalize phone number to E.164 (digits only, with country code)
  const cleanedTo = String(to).replace(/\D/g, '');
  let finalTo = cleanedTo;
  // If Brazilian number without country code, prefix 55
  if (cleanedTo.length === 11 && !cleanedTo.startsWith('55')) {
    finalTo = `55${cleanedTo}`;
  }
  console.log('Normalized phone:', finalTo);

  if (finalTo.length < 12 || finalTo.length > 15) {
    console.error('Invalid phone length after normalization:', finalTo.length);
    return new Response(JSON.stringify({
      ok: false,
      error: "Número de telefone inválido. Use o formato com DDI (ex: 5599999999999)",
      details: { provided: to, normalized: finalTo }
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`Enviando mensagem WhatsApp para: ${finalTo}`);
    console.log(`Mensagem: ${message}`);
    console.log(`Phone Number ID: ${PHONE_NUMBER_ID}`);
    
    const whatsappPayload = {
      messaging_product: "whatsapp",
      to: finalTo,
      type: "text",
      text: { body: message },
    };
    console.log('WhatsApp API payload:', JSON.stringify(whatsappPayload, null, 2));
    
    const waResp = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(whatsappPayload),
    });

    console.log('WhatsApp API response status:', waResp.status);
    console.log('WhatsApp API response headers:', Object.fromEntries(waResp.headers.entries()));
    
    const data = await waResp.json();
    console.log('WhatsApp API response data:', JSON.stringify(data, null, 2));
    
    if (!waResp.ok) {
      console.error('WhatsApp API error - Status:', waResp.status);
      console.error('WhatsApp API error - Data:', data);
      const err = (data && (data.error || data)) || {};
      let userMessage = 'Falha ao enviar mensagem via WhatsApp.';
      if (err.code === 190 || err.type === 'OAuthException') {
        userMessage = 'Token do WhatsApp inválido/expirado ou app deletado. Gere um novo token e atualize os segredos (WHATSAPP_API_TOKEN / WHATSAPP_ACCESS_TOKEN).';
      } else if (waResp.status === 400 && (err.message?.includes('Unsupported post request') || err.error_subcode === 131000)) {
        userMessage = 'Número inválido. Envie com DDI (ex: 5599999999999).';
      }
      return new Response(JSON.stringify({ 
        ok: false, 
        error: err,
        message: userMessage,
        status: waResp.status
      }), { 
        status: waResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('WhatsApp message sent successfully:', data);
    
    // Log additional details for debugging
    if (data.contacts && data.contacts.length > 0) {
      console.log('Message delivered to WhatsApp ID:', data.contacts[0].wa_id);
    }
    if (data.messages && data.messages.length > 0) {
      console.log('WhatsApp message ID:', data.messages[0].id);
    }
    return new Response(JSON.stringify({ 
      ok: true, 
      data 
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Critical error in WhatsApp function:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message,
      errorType: error.name,
      stack: error.stack
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});