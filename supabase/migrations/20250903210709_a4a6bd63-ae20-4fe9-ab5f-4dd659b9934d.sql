-- Secure idempotent scheduler for WhatsApp agenda
-- Creates a single cron job and removes duplicates, updates settings and logs
-- Uses SECURITY DEFINER to bypass RLS safely

create or replace function public.manage_whatsapp_agenda_schedule(
  new_schedule text,
  changed_by uuid,
  anon_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  job_rec record;
  old_value text;
  jobname text;
  minute_part text;
  hour_part text;
begin
  -- Basic validation: expect "m h * * *"
  if new_schedule !~ '^\d{1,2}\s\d{1,2}\s\*\s\*\s\*$' then
    raise exception 'Invalid cron format. Expected: "min hour * * *" (e.g., "0 8 * * *")';
  end if;

  -- Capture current value for logging
  select setting_value into old_value
  from public.system_settings
  where setting_key = 'whatsapp_agenda_schedule'
  limit 1;

  -- Unschedule all existing WhatsApp agenda jobs to avoid duplicates
  for job_rec in (
    select jobname from cron.job where jobname like 'daily-whatsapp-agenda%'
  ) loop
    perform cron.unschedule(job_rec.jobname);
  end loop;

  -- Build deterministic job name based on hour+minute
  minute_part := trim(split_part(new_schedule, ' ', 1));
  hour_part   := trim(split_part(new_schedule, ' ', 2));
  jobname := 'daily-whatsapp-agenda-' || hour_part || minute_part;

  -- Create the single new cron job
  perform cron.schedule(
    jobname,
    new_schedule,
    $$
    select net.http_post(
      url := 'https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/daily-whatsapp-agenda',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select anon_key from (values('placeholder')) v(anon_key))
      ),
      body := jsonb_build_object('scheduled', true)
    );
    $$
  );

  -- Update existing setting or insert if missing
  update public.system_settings
    set setting_value = new_schedule,
        updated_by    = changed_by,
        updated_at    = now()
  where setting_key = 'whatsapp_agenda_schedule';

  if not found then
    insert into public.system_settings (setting_key, setting_value, created_by, updated_by)
    values ('whatsapp_agenda_schedule', new_schedule, changed_by, changed_by);
  end if;

  -- Log the change
  insert into public.system_settings_log (setting_key, old_value, new_value, changed_by, description)
  values (
    'whatsapp_agenda_schedule',
    old_value,
    new_schedule,
    changed_by,
    'Horário da agenda WhatsApp alterado via função gerenciadora (cron job: ' || jobname || ')'
  );

  return jsonb_build_object(
    'ok', true,
    'jobname', jobname,
    'schedule', new_schedule
  );
end;
$$;

-- Ensure only privileged roles can execute directly (edge function will call with service role)
revoke all on function public.manage_whatsapp_agenda_schedule(text, uuid, text) from public;
