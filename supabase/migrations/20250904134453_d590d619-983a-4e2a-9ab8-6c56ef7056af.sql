-- Sincronizar emails de todos os usuários entre auth.users e profiles
UPDATE auth.users 
SET email = profiles.email
FROM profiles 
WHERE auth.users.id = profiles.user_id 
AND auth.users.email != profiles.email;