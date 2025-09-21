-- Fix RLS policies for clients table to ensure proper user authentication
-- The current policy requires auth.uid() IS NOT NULL but we need to ensure created_by is properly set

-- Drop existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;

-- Create new RLS policies for clients table with proper conditions
CREATE POLICY "Users can insert clients with proper created_by"
ON public.clients
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND id = created_by
  )
);

CREATE POLICY "Users can view all clients"
ON public.clients
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update clients"
ON public.clients
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    created_by IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND id = created_by
    )
  )
);