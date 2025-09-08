-- Enable realtime for messages table
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Add messages table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;