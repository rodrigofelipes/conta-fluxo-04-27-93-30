-- Update auth.users metadata to match profiles table data
UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
  'username', p.name,
  'full_name', p.name,
  'email', p.email,
  'email_verified', true,
  'phone_verified', false,
  'telefone', COALESCE(au.raw_user_meta_data->>'telefone', '31997810730'),
  'sub', au.id
),
email = p.email
FROM profiles p 
WHERE auth.users.id = p.user_id
AND auth.users.email != p.email;