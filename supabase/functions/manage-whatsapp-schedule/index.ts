import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('=== Manage WhatsApp Schedule Function Called ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { newSchedule } = await req.json();
    console.log('New schedule requested:', newSchedule);

    // Validate cron format (should be like "0 8 * * *")
    const cronRegex = /^\d{1,2}\s\d{1,2}\s\*\s\*\s\*$/;
    if (!cronRegex.test(newSchedule)) {
      throw new Error('Formato de horário inválido. Use formato cron: "minuto hora * * *"');
    }

    // Get current user to verify admin permissions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização necessário');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Permissão negada: apenas administradores podem alterar configurações');
    }

    // Update both system setting and cron job
    console.log('Updating system setting and cron job for WhatsApp schedule...');

    // Get current setting to log the change
    const { data: currentSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'whatsapp_agenda_schedule')
      .single();

    // First, remove ALL existing WhatsApp cron jobs
    console.log('Removing ALL existing WhatsApp cron jobs...');
    
    // Remove all existing jobs matching our pattern to avoid duplicates
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          DO $$
          DECLARE
            job_name text;
          BEGIN
            FOR job_name IN 
              SELECT jobname FROM cron.job WHERE jobname LIKE 'daily-whatsapp-agenda%'
            LOOP
              PERFORM cron.unschedule(job_name);
              RAISE NOTICE 'Removed cron job: %', job_name;
            END LOOP;
          END;
          $$;
        `
      });
      console.log('✅ Removed all existing daily-whatsapp-agenda* cron jobs');
    } catch (error: any) {
      console.warn('⚠️ Failed to remove existing cron jobs (might be none):', error.message);
    }

    // Create new cron job with updated schedule using direct HTTP call
    const [minute, hour] = newSchedule.split(' ');
    const cronJobName = `daily-whatsapp-agenda-${hour}${minute}`;
    
    console.log(`Creating new cron job: ${cronJobName} with schedule: ${newSchedule}`);

    const createCronJobSQL = `
      SELECT cron.schedule(
        '${cronJobName}',
        '${newSchedule}',
        $$
        SELECT
          net.http_post(
              url:='https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyMzUxOCwiZXhwIjoyMDcxODk5NTE4fQ.D1V8wiQgTKELahdl1Xm98i7r_LEPzAXofQR5JxMwOz0"}'::jsonb,
              body:='{"scheduled": true, "trigger": "cron"}'::jsonb
          ) as request_id;
        $$
      );
    `;

    const { error: cronError } = await supabase.rpc('exec_sql', { sql: createCronJobSQL });
    
    if (cronError) {
      console.error('Error creating cron job:', cronError);
      throw new Error(`Erro ao criar agendamento automático: ${cronError.message}`);
    }

    console.log('Cron job created successfully');

    // IMMEDIATELY create a one-time job for today if the time hasn't passed yet (Brazil timezone)
    const brazilTime = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const brazilNow = new Date(brazilTime);
    const today = brazilTime.split(',')[0]; // YYYY-MM-DD format
    
    // Create target time correctly in Brazil timezone
    const [hourStr, minuteStr] = [hour.padStart(2, '0'), minute.padStart(2, '0')];
    const targetTimeStr = `${today} ${hourStr}:${minuteStr}:00`;
    
    // Create target date in Brazil timezone by using the same locale conversion
    const targetTimeInBrazil = new Date(`${today}T${hourStr}:${minuteStr}:00-03:00`); // Brazil is UTC-3
    const brazilNowTime = new Date().toLocaleString('en-CA', { 
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const [currentDate, currentTime] = brazilNowTime.split(', ');
    const currentBrazilDate = new Date(`${currentDate}T${currentTime}:00-03:00`);
    
    console.log(`Current Brazil time: ${brazilNowTime}`);
    console.log(`Target time today (Brazil): ${targetTimeStr}`);
    console.log(`Current Brazil Date object: ${currentBrazilDate.toISOString()}`);
    console.log(`Target Brazil Date object: ${targetTimeInBrazil.toISOString()}`);
    
    if (targetTimeInBrazil > currentBrazilDate) {
      console.log('⏰ Creating immediate one-time job for today (Brazil timezone)');
      const immediateCronSchedule = `${minute} ${hour} ${currentBrazilDate.getDate()} ${currentBrazilDate.getMonth() + 1} *`;
      const immediateJobName = `daily-whatsapp-immediate-${Date.now()}`;
      
      const immediateJobSQL = `
        SELECT cron.schedule(
          '${immediateJobName}',
          '${immediateCronSchedule}',
          $$
          SELECT
            net.http_post(
                url:='https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
                headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZHl4eHRoYXF6Y2hqcGhhcndoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMyMzUxOCwiZXhwIjoyMDcxODk5NTE4fQ.D1V8wiQgTKELahdl1Xm98i7r_LEPzAXofQR5JxMwOz0"}'::jsonb,
                body:='{"scheduled": true, "trigger": "immediate", "immediate": true}'::jsonb
            ) as request_id;
          $$
        );
      `;
      
      try {
        await supabase.rpc('exec_sql', { sql: immediateJobSQL });
        console.log(`✅ Created immediate job: ${immediateJobName} for ${immediateCronSchedule}`);
      } catch (error: any) {
        console.warn('⚠️ Failed to create immediate job:', error.message);
      }
    } else {
      console.log('⏰ Target time has already passed today, will execute tomorrow');
    }

    // Update the system setting
    const { error: updateError } = await supabase
      .from('system_settings')
      .update({
        setting_value: newSchedule,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'whatsapp_agenda_schedule');

    if (updateError) {
      console.error('Error updating system setting:', updateError);
      throw new Error(`Erro ao salvar configuração: ${updateError.message}`);
    }

    // Log the change
    const { error: logError } = await supabase
      .from('system_settings_log')
      .insert({
        setting_key: 'whatsapp_agenda_schedule',
        old_value: currentSetting?.setting_value || 'none',
        new_value: newSchedule,
        changed_by: user.id,
        description: `Horário da agenda WhatsApp alterado via interface administrativa (cron job: ${cronJobName})`
      });

    if (logError) {
      console.warn('Warning: Could not log setting change:', logError);
    }

    console.log('WhatsApp schedule updated successfully');

    // Verify the cron job was created
    const verifyJobs = await supabase.rpc('exec_sql', { 
      sql: `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'daily-whatsapp-agenda%' ORDER BY jobname;` 
    }) as any;
    
    console.log('Active cron jobs:', verifyJobs);

    const wasImmediateJobCreated = targetTimeInBrazil > currentBrazilDate;
    
    return new Response(JSON.stringify({
      ok: true,
      message: wasImmediateJobCreated 
        ? `Horário alterado para ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}. Envio será feito hoje no novo horário!`
        : `Horário alterado para ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}. Envio será feito amanhã no novo horário.`,
      newSchedule,
      immediateJobCreated: wasImmediateJobCreated,
      activeJobs: verifyJobs
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in manage-whatsapp-schedule function:', error);
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