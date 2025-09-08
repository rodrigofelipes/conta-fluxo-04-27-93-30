-- Inserir roles para usuários existentes que não têm roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'user'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = p.user_id
);

-- Promover o primeiro usuário (teste2@gmail.com) para admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('7ffc0c34-f73a-4947-a6e1-031c2bc17524', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Tornar o primeiro usuário master admin
INSERT INTO public.master_admins (user_id)
VALUES ('7ffc0c34-f73a-4947-a6e1-031c2bc17524')
ON CONFLICT (user_id) DO NOTHING;

-- Adicionar o admin ao setor CONTABIL
INSERT INTO public.admin_setores (user_id, setor)
VALUES ('7ffc0c34-f73a-4947-a6e1-031c2bc17524', 'CONTABIL'::public.setor)
ON CONFLICT (user_id, setor) DO NOTHING;