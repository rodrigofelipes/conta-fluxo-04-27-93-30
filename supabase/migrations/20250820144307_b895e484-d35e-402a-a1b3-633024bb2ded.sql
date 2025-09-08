-- Add viewed_at field to messages table for read receipts
ALTER TABLE public.messages 
ADD COLUMN viewed_at timestamp with time zone;

-- Create index for better performance on viewed_at queries
CREATE INDEX idx_messages_viewed_at ON public.messages(viewed_at);

-- Create function to mark messages as viewed
CREATE OR REPLACE FUNCTION public.mark_messages_as_viewed(
  viewer_id uuid,
  sender_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages 
  SET viewed_at = now()
  WHERE to_user_id = viewer_id 
    AND from_user_id = sender_id 
    AND viewed_at IS NULL;
END;
$$;