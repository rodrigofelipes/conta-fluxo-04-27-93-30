-- Corrigir políticas RLS para permitir que admins vejam seus próprios setores
DROP POLICY IF EXISTS "Master admins can view all admin setores" ON admin_setores;

-- Política para permitir que admins vejam seus próprios setores OU master admins vejam todos
CREATE POLICY "Admins can view their own setores or master admins can view all" 
ON public.admin_setores 
FOR SELECT 
USING (
  is_user_master_admin(auth.uid()) OR 
  auth.uid() = user_id
);

-- Política para permitir que admins vejam seus próprios setores (compatibilidade)
CREATE POLICY "Users can view their own admin setores" 
ON public.admin_setores 
FOR SELECT 
USING (auth.uid() = user_id);