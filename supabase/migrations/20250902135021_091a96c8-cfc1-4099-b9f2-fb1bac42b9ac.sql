-- First, add the new columns without constraints
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS collaborators_ids uuid[] DEFAULT '{}';
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS agenda_type text DEFAULT 'compartilhada';
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'team';

-- Add columns to client_financials first without constraints
ALTER TABLE public.client_financials ADD COLUMN IF NOT EXISTS transaction_category text DEFAULT 'other';
ALTER TABLE public.client_financials ADD COLUMN IF NOT EXISTS recurrence_type text;
ALTER TABLE public.client_financials ADD COLUMN IF NOT EXISTS recurrence_end_date date;
ALTER TABLE public.client_financials ADD COLUMN IF NOT EXISTS parent_transaction_id uuid;
ALTER TABLE public.client_financials ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.client_financials ADD COLUMN IF NOT EXISTS bank_account_id uuid;

-- Update existing NULL values to match our constraint
UPDATE public.client_financials 
SET transaction_category = 'other' 
WHERE transaction_category IS NULL;

-- Now add the constraints
ALTER TABLE public.agenda ADD CONSTRAINT agenda_type_check CHECK (agenda_type IN ('pessoal', 'compartilhada'));
ALTER TABLE public.agenda ADD CONSTRAINT visibility_check CHECK (visibility IN ('private', 'team', 'public'));
ALTER TABLE public.client_financials ADD CONSTRAINT transaction_category_check CHECK (transaction_category IN ('receivable', 'payable', 'project', 'fixed_expense', 'variable_expense', 'other'));
ALTER TABLE public.client_financials ADD CONSTRAINT recurrence_type_check CHECK (recurrence_type IN ('none', 'monthly', 'quarterly', 'yearly'));

-- Create payment installments table
CREATE TABLE IF NOT EXISTS public.payment_installments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  financial_transaction_id uuid,
  installment_number integer NOT NULL,
  total_installments integer NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_date date,
  payment_method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS for payment_installments
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

-- Create policies for payment_installments
CREATE POLICY "Authenticated users can view payment installments" 
ON public.payment_installments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert payment installments" 
ON public.payment_installments 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update payment installments" 
ON public.payment_installments 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create bank accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit', 'investment')),
  balance numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS for bank_accounts
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for bank_accounts
CREATE POLICY "Authenticated users can view bank accounts" 
ON public.bank_accounts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert bank accounts" 
ON public.bank_accounts 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update bank accounts" 
ON public.bank_accounts 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create triggers for updated_at
CREATE TRIGGER update_payment_installments_updated_at
BEFORE UPDATE ON public.payment_installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();