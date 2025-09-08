-- Add estimated_hours column to client_budgets table
ALTER TABLE public.client_budgets 
ADD COLUMN estimated_hours numeric DEFAULT 0;