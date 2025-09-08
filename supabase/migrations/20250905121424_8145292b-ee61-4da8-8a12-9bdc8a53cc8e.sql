-- Update all auth.users metadata with correct username from profiles
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{username}',
  to_jsonb(p.name)
)
FROM profiles p 
WHERE auth.users.id = p.user_id
AND (raw_user_meta_data->>'username' != p.name OR raw_user_meta_data->>'username' IS NULL);