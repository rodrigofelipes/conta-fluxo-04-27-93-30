-- Remove messages table and related functionality
DROP TABLE IF EXISTS public.messages CASCADE;

-- Remove the mark_messages_as_viewed function
DROP FUNCTION IF EXISTS public.mark_messages_as_viewed(uuid, uuid);