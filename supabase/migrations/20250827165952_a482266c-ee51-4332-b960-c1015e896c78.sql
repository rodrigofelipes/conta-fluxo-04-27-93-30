-- Drop the current foreign key constraint and recreate it correctly
ALTER TABLE tasks_new DROP CONSTRAINT tasks_new_client_id_fkey;

-- Add the correct foreign key constraint to point to clientes table
ALTER TABLE tasks_new ADD CONSTRAINT tasks_new_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE CASCADE;