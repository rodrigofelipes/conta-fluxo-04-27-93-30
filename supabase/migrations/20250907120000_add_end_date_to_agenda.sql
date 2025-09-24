-- Add end date support for agenda events
ALTER TABLE public.agenda
  ADD COLUMN IF NOT EXISTS data_fim DATE;

-- Ensure existing records have an end date to avoid null handling on the frontend
UPDATE public.agenda
SET data_fim = data
WHERE data_fim IS NULL;
