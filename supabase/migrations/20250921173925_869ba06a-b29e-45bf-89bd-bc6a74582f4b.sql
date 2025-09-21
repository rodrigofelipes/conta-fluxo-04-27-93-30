-- Clear all WhatsApp chat message history while keeping clients intact

-- Delete all WhatsApp contacts/messages from client_contacts
DELETE FROM client_contacts WHERE contact_type = 'whatsapp';

-- Delete all message attachments 
DELETE FROM message_attachments;

-- Clear any remaining messages in the messages table
DELETE FROM messages;