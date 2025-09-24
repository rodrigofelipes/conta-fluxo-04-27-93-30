-- Allow admins to toggle user active status safely
-- 1) Create a restrictive trigger so regular admins can only change "active" for other users
CREATE OR REPLACE FUNCTION public.restrict_profile_updates_for_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the updater is an admin but not a master admin
  IF public.is_admin() AND NOT public.is_master_admin() THEN
    -- And only when updating someone else's profile
    IF auth.uid() <> OLD.user_id THEN
      -- Block changes to any field other than "active" (and automatic updated_at)
      IF (NEW.user_id IS DISTINCT FROM OLD.user_id)
         OR (NEW.name IS DISTINCT FROM OLD.name)
         OR (NEW.email IS DISTINCT FROM OLD.email)
         OR (NEW.role IS DISTINCT FROM OLD.role)
         OR (NEW.theme IS DISTINCT FROM OLD.theme)
         OR (NEW.gradient IS DISTINCT FROM OLD.gradient)
         OR (NEW.telefone IS DISTINCT FROM OLD.telefone)
      THEN
        RAISE EXCEPTION 'Admins can only toggle the "active" field for other users';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_profile_updates_for_admins ON public.profiles;
CREATE TRIGGER trg_restrict_profile_updates_for_admins
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.restrict_profile_updates_for_admins();

-- 2) Add a permissive policy that explicitly allows admins to perform updates (the trigger above guards fields)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Admins can update any profile (active toggle)') THEN
    CREATE POLICY "Admins can update any profile (active toggle)"
    ON public.profiles
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;