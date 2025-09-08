-- Habilitar realtime na tabela client_contacts
ALTER TABLE client_contacts REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE client_contacts;