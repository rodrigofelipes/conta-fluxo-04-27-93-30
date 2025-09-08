-- Create system_settings table for administrative configurations
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin-only access
CREATE POLICY "Only admins can view system settings"
ON public.system_settings
FOR SELECT
USING (is_admin());

CREATE POLICY "Only admins can insert system settings"
ON public.system_settings
FOR INSERT
WITH CHECK (is_admin() AND auth.uid() = created_by);

CREATE POLICY "Only admins can update system settings"
ON public.system_settings
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin() AND auth.uid() = updated_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default WhatsApp agenda schedule setting
INSERT INTO public.system_settings (setting_key, setting_value, description, created_by)
VALUES (
  'whatsapp_agenda_schedule',
  '0 8 * * *',
  'Horário para envio automático da agenda diária via WhatsApp (formato cron)',
  (SELECT user_id FROM profiles WHERE role = 'admin' AND name = 'Débora' LIMIT 1)
);

-- Create settings change log table for auditing
CREATE TABLE public.system_settings_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT
);

-- Enable RLS on log table
ALTER TABLE public.system_settings_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view logs
CREATE POLICY "Only admins can view settings logs"
ON public.system_settings_log
FOR SELECT
USING (is_admin());