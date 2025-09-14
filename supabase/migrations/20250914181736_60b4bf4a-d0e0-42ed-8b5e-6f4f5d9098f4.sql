-- Criar tabela para controlar estado das conversas WhatsApp
CREATE TABLE public.whatsapp_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id),
  phone_number text NOT NULL,
  state text NOT NULL DEFAULT 'awaiting_selection',
  selected_option text,
  assigned_to uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(phone_number)
);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view WhatsApp conversations" 
ON public.whatsapp_conversations 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage WhatsApp conversations" 
ON public.whatsapp_conversations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();