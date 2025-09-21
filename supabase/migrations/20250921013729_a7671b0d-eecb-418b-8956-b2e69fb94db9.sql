-- Add active field to profiles table for user deactivation
ALTER TABLE public.profiles 
ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

-- Add payment_date to client_financials for cash flow
ALTER TABLE public.client_financials 
ADD COLUMN payment_date DATE;

-- Create financial_categories table for expense categorization
CREATE TABLE public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.financial_categories(id),
  category_type TEXT NOT NULL CHECK (category_type IN ('previsao_custo', 'variavel', 'fixo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS on financial_categories
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for financial_categories
CREATE POLICY "Only admins can manage financial categories"
ON public.financial_categories
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.financial_categories(id),
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  recurrence_type TEXT CHECK (recurrence_type IN ('none', 'monthly', 'yearly')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for expenses
CREATE POLICY "Only admins can manage expenses"
ON public.expenses
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Add message attachments table for chat file uploads
CREATE TABLE public.message_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on message_attachments
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for message_attachments
CREATE POLICY "Users can manage their own attachments"
ON public.message_attachments
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', false);

-- Create storage policies for chat files
CREATE POLICY "Users can upload chat files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own chat files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Update profiles table policies to include active field check
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view active profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND active = true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_financial_categories_updated_at
BEFORE UPDATE ON public.financial_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();