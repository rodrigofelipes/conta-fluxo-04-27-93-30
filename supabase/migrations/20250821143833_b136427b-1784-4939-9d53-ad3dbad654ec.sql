-- Promote the recently logged-in user to admin and master admin
SELECT public.promote_user_to_master_admin('teste2@gmail.com');

-- Ensure this admin appears in admin_setores for routing (uses default setor CONTABIL)
INSERT INTO public.admin_setores (user_id, setor, username)
SELECT p.user_id, 'CONTABIL'::public.setor, p.username
FROM public.profiles p
WHERE p.email = 'teste2@gmail.com'
ON CONFLICT (user_id, setor) DO NOTHING;