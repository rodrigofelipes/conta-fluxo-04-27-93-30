import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('=== WhatsApp Debug & Fix Function ===');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Starting WhatsApp system diagnosis...');
    
    // 1. Check current cron jobs
    console.log('📋 Checking cron jobs...');
    const cronJobs = await supabase.rpc('exec_sql', { 
      sql: `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%whatsapp%' OR jobname LIKE '%agenda%';` 
    }) as any;
    
    console.log('Current cron jobs:', cronJobs);

    // 2. Remove ALL WhatsApp cron jobs
    console.log('🧹 Cleaning ALL WhatsApp cron jobs...');
    const removeJobs = [
      'daily-whatsapp-agenda-1738',
      'daily-debora-whatsapp-agenda', 
      'daily-whatsapp-agenda-test',
      'daily-whatsapp-agenda',
      'daily-whatsapp-agenda-1755',
      'daily-whatsapp-agenda-1758',
      'daily-whatsapp-agenda-1700',
      'daily-whatsapp-agenda-1800',
      'daily-whatsapp-agenda-1900',
      'daily-whatsapp-agenda-2000',
      'daily-whatsapp-agenda-db-90',
      'daily-whatsapp-agenda-db-857',
      'daily-whatsapp-agenda-db-849'
    ];

    for (const job of removeJobs) {
      try {
        await supabase.rpc('exec_sql', { sql: `SELECT cron.unschedule('${job}');` });
        console.log(`✅ Removed: ${job}`);
      } catch (error: any) {
        console.log(`⚠️ Job ${job} not found (ok)`);
      }
    }

    // 3. Get current schedule setting
    const { data: schedule } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'whatsapp_agenda_schedule')
      .single();

    const currentSchedule = schedule?.setting_value || '0 9 * * *';
    console.log('📅 Current schedule:', currentSchedule);

    // 4. Create single new cron job with CORRECT URL
    const [minute, hour] = currentSchedule.split(' ');
    const jobName = `daily-whatsapp-agenda-${hour}${minute}`;
    
    console.log(`🔧 Creating new cron job: ${jobName}`);
    
    const createCronSQL = `
      SELECT cron.schedule(
        '${jobName}',
        '${currentSchedule}',
        $$
        SELECT
          net.http_post(
              url:='https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${supabaseKey}"}'::jsonb,
              body:='{"scheduled": true}'::jsonb
          ) as request_id;
        $$
      );
    `;

    await supabase.rpc('exec_sql', { sql: createCronSQL });
    console.log('✅ New cron job created successfully');

    // 5. Test the daily function manually
    console.log('🧪 Testing daily WhatsApp function...');
    
    const testResponse = await supabase.functions.invoke('daily-whatsapp-agenda', {
      body: { scheduled: true, debug: true }
    });

    console.log('Test result:', testResponse);

    // 6. Check final cron job status
    const finalJobs = await supabase.rpc('exec_sql', { 
      sql: `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%whatsapp%';` 
    }) as any;

    console.log('Final cron jobs:', finalJobs);

    return new Response(JSON.stringify({
      ok: true,
      message: 'WhatsApp debug and fix completed',
      results: {
        scheduleFound: currentSchedule,
        newJobName: jobName,
        testResponse: testResponse,
        finalJobs: finalJobs
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Debug function error:', error);
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