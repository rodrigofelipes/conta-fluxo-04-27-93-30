-- Fix the foreign key constraint for time_entries
-- The current constraint references profiles.id but should reference profiles.user_id
-- since we're using auth.uid() which corresponds to profiles.user_id

-- First, drop the existing foreign key constraint
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE time_entries 
ADD CONSTRAINT time_entries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;