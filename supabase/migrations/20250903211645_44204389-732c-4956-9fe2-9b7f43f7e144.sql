-- Simple idempotent WhatsApp schedule manager
create or replace function public.manage_whatsapp_schedule(
  new_schedule text,
  user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  old_value text;
  job_name text;
  minute_part text;
  hour_part text;
  result jsonb;
begin
  -- Validate cron format
  if new_schedule !~ '^\d{1,2}\s\d{1,2}\s\*\s\*\s\*$' then
    raise exception 'Invalid cron format. Expected: "min hour * * *"';
  end if;

  -- Get current value
  select setting_value into old_value
  from system_settings
  where setting_key = 'whatsapp_agenda_schedule';

  -- Extract hour and minute for job name
  minute_part := split_part(new_schedule, ' ', 1);
  hour_part := split_part(new_schedule, ' ', 2);
  job_name := 'daily-whatsapp-agenda-' || hour_part || minute_part;

  -- Update or insert setting
  insert into system_settings (setting_key, setting_value, created_by, updated_by)
  values ('whatsapp_agenda_schedule', new_schedule, user_id, user_id)
  on conflict (setting_key) do update set
    setting_value = excluded.setting_value,
    updated_by = excluded.updated_by,
    updated_at = now();

  -- Log the change
  insert into system_settings_log (
    setting_key, old_value, new_value, changed_by, description
  ) values (
    'whatsapp_agenda_schedule',
    coalesce(old_value, 'none'),
    new_schedule,
    user_id,
    'Horário alterado via interface (job: ' || job_name || ')'
  );

  return jsonb_build_object(
    'success', true,
    'job_name', job_name,
    'schedule', new_schedule,
    'old_value', old_value
  );
end;
$$;

-- Grant execute to authenticated users (will be called by edge function with service role)
grant execute on function public.manage_whatsapp_schedule(text, uuid) to authenticated;