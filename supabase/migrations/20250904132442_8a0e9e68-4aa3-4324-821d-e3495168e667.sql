-- Adicionar campo contracted_value na tabela projects
ALTER TABLE public.projects 
ADD COLUMN contracted_value numeric DEFAULT 0 NOT NULL;

-- Adicionar campo allocated_hours na tabela project_phases
ALTER TABLE public.project_phases 
ADD COLUMN allocated_hours numeric DEFAULT 0 NOT NULL;

-- Comentário explicativo dos campos
COMMENT ON COLUMN public.projects.contracted_value IS 'Valor total contratado do projeto em reais';
COMMENT ON COLUMN public.project_phases.allocated_hours IS 'Quantidade de horas alocadas para esta fase do projeto';