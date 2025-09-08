-- Promote specific user to admin by UID
INSERT INTO public.user_roles (user_id, role)
VALUES ('63a67533-819d-4b9a-854d-a13b2ed15210', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove any existing user role to avoid conflicts
DELETE FROM public.user_roles 
WHERE user_id = '63a67533-819d-4b9a-854d-a13b2ed15210' AND role = 'user';