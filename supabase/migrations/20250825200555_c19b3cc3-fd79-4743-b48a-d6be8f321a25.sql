-- Add message_type column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'internal' CHECK (message_type IN ('internal', 'whatsapp'));

-- Update existing messages that start with [WhatsApp]
UPDATE public.messages 
SET message_type = 'whatsapp' 
WHERE message LIKE '[WhatsApp]%';

-- Set internal type for existing messages
UPDATE public.messages 
SET message_type = 'internal' 
WHERE message_type IS NULL AND message NOT LIKE '[WhatsApp]%';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(message_type);