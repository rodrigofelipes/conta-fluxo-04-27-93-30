-- Adicionar política RLS para DELETE na tabela client_financials
CREATE POLICY "Authenticated users can delete client financials"
ON client_financials
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);