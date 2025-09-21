-- Allow authenticated users to delete client contacts
CREATE POLICY "Authenticated users can delete client contacts" ON public.client_contacts
FOR DELETE USING (
  auth.uid() IS NOT NULL
);
