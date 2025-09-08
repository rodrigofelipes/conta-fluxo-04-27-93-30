-- Fix missing foreign key relationship between project_phases and projects
ALTER TABLE project_phases 
ADD CONSTRAINT fk_project_phases_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Create profiles for users that don't have them yet
INSERT INTO profiles (user_id, name, email, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'username', au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1)),
  au.email,
  'user'
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;