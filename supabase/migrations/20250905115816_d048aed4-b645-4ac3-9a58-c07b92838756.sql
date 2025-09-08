-- Ensure profiles are created automatically for new users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Create/repair profiles for specific users 'teste' and 'teste1' if missing
WITH target_users AS (
  SELECT id as user_id,
         COALESCE(raw_user_meta_data->>'username', raw_user_meta_data->>'full_name', email) AS name,
         email
  FROM auth.users
  WHERE (raw_user_meta_data->>'username') IN ('teste','teste1')
)
INSERT INTO public.profiles (user_id, name, email, role)
SELECT tu.user_id, tu.name, tu.email, 'user'
FROM target_users tu
LEFT JOIN public.profiles p ON p.user_id = tu.user_id
WHERE p.user_id IS NULL;