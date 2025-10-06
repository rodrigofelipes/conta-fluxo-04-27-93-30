-- Permite que usuários autenticados excluam documentos de clientes
CREATE POLICY "Authenticated users can delete client documents"
ON public.client_documents
FOR DELETE
USING (auth.uid() IS NOT NULL);
