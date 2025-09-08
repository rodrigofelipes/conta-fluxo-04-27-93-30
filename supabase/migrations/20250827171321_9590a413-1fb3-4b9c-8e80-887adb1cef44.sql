-- Add foreign key constraints to tasks_new table to link with profiles
ALTER TABLE tasks_new 
ADD CONSTRAINT tasks_new_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE tasks_new 
ADD CONSTRAINT tasks_new_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE CASCADE;