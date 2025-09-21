-- Create messages table for the chat system
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  from_user_name TEXT NOT NULL DEFAULT '',
  to_user_name TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for messages
CREATE POLICY "Authenticated users can view messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create index for better performance
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_from_user ON public.messages(from_user_id);
CREATE INDEX idx_messages_to_user ON public.messages(to_user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();