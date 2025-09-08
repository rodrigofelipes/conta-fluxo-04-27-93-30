import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const startTime = new Date().toISOString();
  const brazilTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  console.log('=== Daily WhatsApp Agenda Function Called ===');
  console.log('🕐 UTC Execution time:', startTime);
  console.log('🇧🇷 Brazil time:', brazilTime);
  console.log('🌍 Request method:', req.method);
  console.log('📍 User-Agent:', req.headers.get('user-agent') || 'unknown');
  
  // Log request body for debugging
  let requestBody = null;
  try {
    if (req.method === 'POST') {
      requestBody = await req.json();
      console.log('📨 Request body:', JSON.stringify(requestBody, null, 2));
    }
  } catch (e) {
    console.log('📨 No JSON body or invalid JSON');
  }
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get today's date in Brazil timezone
    const brazilTime = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const today = brazilTime.split(',')[0]; // YYYY-MM-DD format
    console.log('🇧🇷 Brazil time:', brazilTime);
    console.log('📅 Checking agenda for date:', today);
    
    // Multiple sends allowed: skip daily lock check
    console.log('🔄 Multiple sends allowed for today, proceeding...');
    
    // Find Débora's profile (need both user_id and profile id)
    const { data: deboraProfil, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, name')
      .eq('name', 'Débora')
      .eq('role', 'admin')
      .single();
    
    if (profileError || !deboraProfil) {
      console.log('Débora profile not found:', profileError);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Perfil da Débora não encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Found Débora profile:', deboraProfil);
    
    // Get Débora's agenda for today - only appointments she created or is a collaborator in
    const { data: agenda, error: agendaError } = await supabase
      .from('agenda')
      .select('*')
      .eq('data', today)
      .or(`created_by.eq.${deboraProfil.user_id},collaborators_ids.cs.{${deboraProfil.id}}`)
      .order('horario', { ascending: true });
    
    if (agendaError) {
      console.error('Error fetching agenda:', agendaError);
      throw agendaError;
    }
    
    console.log(`Found ${agenda?.length || 0} appointments for today`);
    
    if (!agenda || agenda.length === 0) {
      console.log('No appointments found for today');
      
      // Log execution without creating lock (multiple sends allowed)
      console.log('📝 No appointments found, but not creating lock (multiple sends allowed)');
      
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'Nenhum compromisso encontrado para hoje' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Format the message
    let message = `🗓️ *Agenda do dia ${new Date().toLocaleDateString('pt-BR')}*\n\n`;
    
    agenda.forEach((appointment, index) => {
      const time = appointment.horario.substring(0, 5); // HH:MM format
      const endTime = appointment.horario_fim ? ` - ${appointment.horario_fim.substring(0, 5)}` : '';
      
      message += `⏰ *${time}${endTime}*\n`;
      message += `📋 ${appointment.titulo}\n`;
      message += `👤 Cliente: ${appointment.cliente}\n`;
      message += `📍 Tipo: ${appointment.tipo}\n`;
      
      if (appointment.local) {
        message += `🏢 Local: ${appointment.local}\n`;
      }
      
      if (appointment.descricao) {
        message += `📝 ${appointment.descricao}\n`;
      }
      
      if (index < agenda.length - 1) {
        message += '\n';
      }
    });
    
    message += '\n✨ Tenha um ótimo dia!';
    
    console.log('Formatted message:', message);
    
    // Log the attempt in the database
    const { data: logEntry, error: logError } = await supabase
      .from('daily_whatsapp_log')
      .insert({
        user_name: 'Débora',
        appointments_count: agenda.length,
        message_content: message,
        whatsapp_status: 'sending'
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Error logging attempt:', logError);
    }
    
    // Get Débora's phone from environment or use default test number
    const DEBORA_PHONE = Deno.env.get('DEBORA_WHATSAPP_NUMBER') || '5511999999999';
    
    console.log('Enviando agenda para WhatsApp:', DEBORA_PHONE);
    
    if (DEBORA_PHONE === '5511999999999') {
      console.warn('⚠️  ATENÇÃO: Usando número de teste! Configure DEBORA_WHATSAPP_NUMBER no Supabase');
    }
    
    const { data: whatsappResponse, error: whatsappError } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        to: DEBORA_PHONE,
        message: message
      }
    });
    
    if (whatsappError) {
      console.error('WhatsApp send error:', whatsappError);
      
      // Update log entry with error
      if (logEntry) {
        await supabase
          .from('daily_whatsapp_log')
          .update({
            whatsapp_status: 'failed',
            error_details: whatsappError
          })
          .eq('id', logEntry.id);
      }
      
      throw whatsappError;
    }
    
    console.log('WhatsApp message sent successfully:', whatsappResponse);
    
    // Update log entry with success
    if (logEntry) {
      await supabase
        .from('daily_whatsapp_log')
        .update({
          whatsapp_status: 'sent'
        })
        .eq('id', logEntry.id);
    }
    
    // Log successful execution without creating lock (multiple sends allowed)
    console.log('✅ Agenda sent successfully, multiple sends allowed for today');
    
    return new Response(JSON.stringify({
      ok: true,
      message: 'Agenda enviada com sucesso via WhatsApp',
      appointmentsCount: agenda.length,
      whatsappResponse
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error in daily-whatsapp-agenda function:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});