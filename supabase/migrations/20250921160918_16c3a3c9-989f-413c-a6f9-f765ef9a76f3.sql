-- Delete all message attachments first (due to foreign key relationships)
DELETE FROM message_attachments;

-- Delete all messages
DELETE FROM messages;