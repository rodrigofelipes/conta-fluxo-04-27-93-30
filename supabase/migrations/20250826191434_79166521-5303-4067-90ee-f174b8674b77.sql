-- Verificar e corrigir implementação do setor "TODOS"

-- 1. O setor TODOS deve representar acesso a TODOS os setores, não um setor específico
-- Atualizar função user_has_setor_access para tratar TODOS corretamente
CREATE OR REPLACE FUNCTION public.user_has_setor_access(user_id_param uuid, setor_param setor)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  -- Se o setor solicitado é TODOS, só master admin ou admin com setor TODOS pode acessar
  CASE WHEN setor_param = 'TODOS'::public.setor THEN
    public.is_user_master_admin(user_id_param) OR 
    EXISTS (
      SELECT 1 FROM public.admin_setores 
      WHERE user_id = user_id_param AND setor = 'TODOS'::public.setor
    )
  ELSE
    -- Para setores específicos, permitir se tem acesso ao setor específico OU setor TODOS
    EXISTS (
      SELECT 1 FROM public.admin_setores 
      WHERE user_id = user_id_param 
        AND (setor = setor_param OR setor = 'TODOS'::public.setor)
    ) OR public.is_user_master_admin(user_id_param)
  END;
$$;

-- 2. Verificar registros com setor TODOS na tabela admin_setores
SELECT 
  p.username, 
  p.email, 
  asec.setor, 
  ur.role
FROM admin_setores asec 
JOIN profiles p ON asec.user_id = p.user_id
JOIN user_roles ur ON asec.user_id = ur.user_id
WHERE asec.setor = 'TODOS'::setor
ORDER BY p.username;