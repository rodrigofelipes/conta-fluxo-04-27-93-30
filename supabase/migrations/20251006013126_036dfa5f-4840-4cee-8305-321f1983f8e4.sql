-- Fix delete reappearing issue: add missing DELETE RLS policy on client_documents
-- Rationale: current RLS has SELECT/INSERT/UPDATE but no DELETE, so PostgREST returns 204 but zero rows are affected; frontend re-fetch brings item back.

-- Ensure table exists and RLS stays enabled (already enabled per inspection)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_documents' AND policyname = 'Users can delete their own client documents'
  ) THEN
    CREATE POLICY "Users can delete their own client documents"
    ON public.client_documents
    FOR DELETE
    USING (auth.uid() = uploaded_by OR public.is_admin());
  END IF;
END $$;