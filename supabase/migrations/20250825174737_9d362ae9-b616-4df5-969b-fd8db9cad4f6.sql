-- Add sector and responsible admin tracking to tasks table
ALTER TABLE public.tasks 
ADD COLUMN setor_responsavel setor,
ADD COLUMN admin_responsavel uuid;

-- Update existing tasks to have a default sector (you can change this later)
UPDATE public.tasks 
SET setor_responsavel = 'CONTABIL'::setor 
WHERE setor_responsavel IS NULL;