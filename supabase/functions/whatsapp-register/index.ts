import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  // Check if required environment variables are set
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.error('Missing WhatsApp credentials');
    return new Response(JSON.stringify({ 
      ok: false,
      error: "Configuração do WhatsApp incompleta. Verifique as variáveis de ambiente." 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ 
      ok: false,
      error: "JSON inválido" 
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { pin } = body;
  if (!pin || pin.length !== 6) {
    return new Response(JSON.stringify({ 
      ok: false,
      error: "PIN de 6 dígitos é obrigatório" 
    }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`Registrando número WhatsApp com PIN: ${pin}`);
    
    // WhatsApp Business API call to verify/register the phone number
    const waResp = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: pin,
      }),
    });

    const data = await waResp.json();
    
    if (!waResp.ok) {
      console.error('WhatsApp registration error:', data);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: data 
      }), { 
        status: waResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('WhatsApp number registered successfully:', data);
    return new Response(JSON.stringify({ 
      ok: true, 
      data 
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error registering WhatsApp number:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});