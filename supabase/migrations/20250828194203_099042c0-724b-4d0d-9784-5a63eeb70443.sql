-- Create agenda table for meetings and appointments
CREATE TABLE public.agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('reuniao_cliente', 'visita_obra', 'apresentacao', 'aprovacao', 'medicao')),
  data DATE NOT NULL,
  horario TIME NOT NULL,
  local TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Authenticated users can view agenda" 
ON public.agenda 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create agenda items" 
ON public.agenda 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update agenda items" 
ON public.agenda 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete agenda items" 
ON public.agenda 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_agenda_updated_at
BEFORE UPDATE ON public.agenda
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();