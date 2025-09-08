-- Create messages table for chat functionality
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  from_user_name text NOT NULL,
  to_user_name text NOT NULL,
  viewed_at timestamp with time zone DEFAULT NULL,
  message_type text DEFAULT 'internal'
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for messages
CREATE POLICY "Users can view messages they sent or received"
ON public.messages
FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can insert their own messages"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update message status"
ON public.messages
FOR UPDATE
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Create function to mark messages as viewed
CREATE OR REPLACE FUNCTION mark_messages_as_viewed(viewer_id uuid, sender_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE messages
  SET viewed_at = now()
  WHERE to_user_id = viewer_id 
    AND from_user_id = sender_id 
    AND viewed_at IS NULL;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(from_user_id, to_user_id, created_at DESC);