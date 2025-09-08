import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('=== Fix WhatsApp Schedule Function Called ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔧 Fixing WhatsApp cron job schedule...');

    // Remove the incorrect cron job
    try {
      await supabase.rpc('exec_sql', {
        sql: `SELECT cron.unschedule('daily-whatsapp-agenda-1212');`
      });
      console.log('✅ Removed incorrect cron job: daily-whatsapp-agenda-1212');
    } catch (error: any) {
      console.log('⚠️ Job might not exist or already removed:', error.message);
    }

    // Create the correct cron job
    const correctCronSQL = `
      SELECT cron.schedule(
        'daily-whatsapp-agenda-1210-correct',
        '10 12 * * *',
        $$
        SELECT
          net.http_post(
              url:='https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyMzUxOCwiZXhwIjoyMDcxODk5NTE4fQ.D1V8wiQgTKELahdl1Xm98i7r_LEPzAXofQR5JxMwOz0"}'::jsonb,
              body:='{"scheduled": true, "trigger": "cron", "fixed": true}'::jsonb
          ) as request_id;
        $$
      );
    `;

    const { error: cronError } = await supabase.rpc('exec_sql', { sql: correctCronSQL });
    
    if (cronError) {
      throw new Error(`Erro ao criar cron job correto: ${cronError.message}`);
    }

    console.log('✅ Created correct cron job: daily-whatsapp-agenda-1210-correct');

    // Verify the fix
    const verifySQL = `
      SELECT jobname, schedule, active 
      FROM cron.job 
      WHERE jobname IN ('daily-whatsapp-agenda-1212', 'daily-whatsapp-agenda-1210-correct')
      ORDER BY jobname;
    `;
    
    const verifyResult = await supabase.rpc('exec_sql', { sql: verifySQL });
    console.log('🔍 Verification result:', verifyResult);

    return new Response(JSON.stringify({
      ok: true,
      message: 'Cron job corrigido com sucesso! Agora executará às 12:10 corretamente.',
      fixApplied: true,
      newJobName: 'daily-whatsapp-agenda-1210-correct',
      schedule: '10 12 * * *',
      verification: verifyResult
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in fix-whatsapp-schedule function:', error);
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