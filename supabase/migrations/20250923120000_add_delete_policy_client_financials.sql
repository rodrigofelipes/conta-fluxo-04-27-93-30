-- Allow authenticated users to delete client financial records
CREATE POLICY "Authenticated users can delete client financials" ON public.client_financials
FOR DELETE USING (
  auth.uid() IS NOT NULL
);
