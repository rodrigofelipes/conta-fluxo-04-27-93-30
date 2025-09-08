-- Criar bucket para documentos dos clientes
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false);

-- Criar políticas para o bucket de documentos
CREATE POLICY "Authenticated users can view client documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload client documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'client-documents' AND auth.uid() IS NOT NULL);

-- Criar tabela para histórico de contatos
CREATE TABLE public.client_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  contact_type TEXT NOT NULL, -- 'call', 'email', 'meeting', 'whatsapp', 'other'
  subject TEXT NOT NULL,
  description TEXT,
  contact_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS para client_contacts
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- Criar políticas para client_contacts
CREATE POLICY "Authenticated users can view client contacts" 
ON public.client_contacts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert client contacts" 
ON public.client_contacts 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client contacts" 
ON public.client_contacts 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Criar tabela para documentos dos clientes
CREATE TABLE public.client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'contract', 'pix_receipt', 'invoice', 'other'
  file_path TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS para client_documents
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- Criar políticas para client_documents
CREATE POLICY "Authenticated users can view client documents" 
ON public.client_documents 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert client documents" 
ON public.client_documents 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client documents" 
ON public.client_documents 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Criar tabela para financeiro dos clientes
CREATE TABLE public.client_financials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  transaction_type TEXT NOT NULL, -- 'income', 'expense', 'payment_received', 'payment_sent'
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  reference_document TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS para client_financials
ALTER TABLE public.client_financials ENABLE ROW LEVEL SECURITY;

-- Criar políticas para client_financials
CREATE POLICY "Authenticated users can view client financials" 
ON public.client_financials 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert client financials" 
ON public.client_financials 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client financials" 
ON public.client_financials 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_documents_updated_at
BEFORE UPDATE ON public.client_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_financials_updated_at
BEFORE UPDATE ON public.client_financials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();