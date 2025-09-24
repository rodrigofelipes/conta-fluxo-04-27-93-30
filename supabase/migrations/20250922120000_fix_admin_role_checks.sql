-- Ensure admin role helper functions work without user_roles table
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  has_explicit_role boolean := false;
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    INTO has_explicit_role;

    IF has_explicit_role THEN
      RETURN true;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND role = _role::text
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  has_role_in_table boolean := false;
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    INTO has_role_in_table;

    IF has_role_in_table THEN
      RETURN true;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin', 'supervisor', 'coordenador')
  );
END;
$$;
