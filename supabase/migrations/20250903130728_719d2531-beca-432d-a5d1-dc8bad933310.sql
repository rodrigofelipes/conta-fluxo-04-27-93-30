-- Add "coordenador" to user_role enum
ALTER TYPE user_role ADD VALUE 'coordenador';

-- Add end time column to agenda table
ALTER TABLE public.agenda ADD COLUMN horario_fim TIME;

-- Create holidays table for managing national and custom holidays
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  is_national BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Create policies for holidays
CREATE POLICY "Authenticated users can view holidays"
ON public.holidays
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create holidays"
ON public.holidays
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update holidays"
ON public.holidays
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete holidays"
ON public.holidays
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create user_alerts table for hour tracking alerts
CREATE TABLE public.user_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('daily_hours', 'weekly_hours', 'monthly_hours', 'project_hours')),
  threshold_value NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for user_alerts
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for user_alerts
CREATE POLICY "Users can view their own alerts"
ON public.user_alerts
FOR SELECT
USING (auth.uid() IN (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own alerts"
ON public.user_alerts
FOR INSERT
WITH CHECK (auth.uid() IN (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own alerts"
ON public.user_alerts
FOR UPDATE
USING (auth.uid() IN (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own alerts"
ON public.user_alerts
FOR DELETE
USING (auth.uid() IN (SELECT user_id FROM profiles WHERE user_id = auth.uid()));

-- Create client_budgets table for client budget management
CREATE TABLE public.client_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  project_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
  version INTEGER NOT NULL DEFAULT 1,
  valid_until DATE,
  items JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for client_budgets
ALTER TABLE public.client_budgets ENABLE ROW LEVEL SECURITY;

-- Create policies for client_budgets
CREATE POLICY "Authenticated users can view client budgets"
ON public.client_budgets
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create client budgets"
ON public.client_budgets
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update client budgets"
ON public.client_budgets
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client budgets"
ON public.client_budgets
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_alerts_updated_at
BEFORE UPDATE ON public.user_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_budgets_updated_at
BEFORE UPDATE ON public.client_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some common Brazilian holidays
INSERT INTO public.holidays (name, date, is_national, description, created_by) VALUES
('Confraternização Universal', '2024-01-01', true, 'Ano Novo', (SELECT id FROM profiles LIMIT 1)),
('Tiradentes', '2024-04-21', true, 'Feriado Nacional', (SELECT id FROM profiles LIMIT 1)),
('Dia do Trabalhador', '2024-05-01', true, 'Dia do Trabalho', (SELECT id FROM profiles LIMIT 1)),
('Independência do Brasil', '2024-09-07', true, 'Feriado Nacional', (SELECT id FROM profiles LIMIT 1)),
('Nossa Senhora Aparecida', '2024-10-12', true, 'Padroeira do Brasil', (SELECT id FROM profiles LIMIT 1)),
('Finados', '2024-11-02', true, 'Feriado Nacional', (SELECT id FROM profiles LIMIT 1)),
('Proclamação da República', '2024-11-15', true, 'Feriado Nacional', (SELECT id FROM profiles LIMIT 1)),
('Natal', '2024-12-25', true, 'Natal', (SELECT id FROM profiles LIMIT 1));