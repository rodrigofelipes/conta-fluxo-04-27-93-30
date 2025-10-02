-- Adicionar campos de local externo na tabela agenda
ALTER TABLE public.agenda 
ADD COLUMN IF NOT EXISTS external_location boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS distance_km numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS travel_cost numeric DEFAULT 0;