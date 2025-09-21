-- Ensure clients.created_by is automatically set to current user's profile id
-- 1) Create or replace trigger function
CREATE OR REPLACE FUNCTION public.set_client_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  -- If profile not found, attempt to create a minimal one
  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (user_id, name, email, role)
    VALUES (auth.uid(), coalesce((auth.jwt() ->> 'email'), 'Usuário'), coalesce((auth.jwt() ->> 'email'), ''), 'user')
    RETURNING id INTO v_profile_id;
  END IF;

  NEW.created_by := v_profile_id; -- always enforce correct linkage
  RETURN NEW;
END;
$$;

-- 2) Drop existing trigger if any and create a new BEFORE INSERT trigger
DROP TRIGGER IF EXISTS trg_set_client_created_by ON public.clients;
CREATE TRIGGER trg_set_client_created_by
BEFORE INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.set_client_created_by();

-- 3) Simplify RLS policies to avoid false negatives while keeping auth required
DROP POLICY IF EXISTS "Users can insert clients with proper created_by" ON public.clients;
DROP POLICY IF EXISTS "Users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients" ON public.clients;

CREATE POLICY "Authenticated can insert clients"
ON public.clients
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view clients"
ON public.clients
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update clients"
ON public.clients
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
