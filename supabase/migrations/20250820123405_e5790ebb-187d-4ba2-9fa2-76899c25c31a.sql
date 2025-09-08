-- Create storage bucket for task files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-files', 'task-files', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'image/jpeg', 'image/png', 'text/plain']);

-- Create storage policies for task files
CREATE POLICY "Users can view task files from their sector"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-files' AND
  (is_user_master_admin(auth.uid()) OR 
   user_has_setor_access(auth.uid(), (storage.foldername(name))[1]::setor))
);

CREATE POLICY "Admins can upload task files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-files' AND
  is_admin()
);

CREATE POLICY "Admins can update task files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'task-files' AND
  is_admin()
);

CREATE POLICY "Admins can delete task files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-files' AND
  is_admin()
);

-- Create documents table to track document uploads with user sectors
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  size bigint NOT NULL,
  category text NOT NULL,
  ref text,
  status text NOT NULL DEFAULT 'PENDENTE',
  urgent boolean DEFAULT false,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploader_setor setor NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies for documents table
CREATE POLICY "Users can view documents from their sector"
ON public.documents FOR SELECT
USING (
  is_user_master_admin(auth.uid()) OR 
  user_has_setor_access(auth.uid(), uploader_setor)
);

CREATE POLICY "Admins can insert documents"
ON public.documents FOR INSERT
WITH CHECK (
  is_admin() AND auth.uid() = uploaded_by
);

CREATE POLICY "Admins can update documents from their sector"
ON public.documents FOR UPDATE
USING (
  is_user_master_admin(auth.uid()) OR 
  user_has_setor_access(auth.uid(), uploader_setor)
);

CREATE POLICY "Admins can delete documents from their sector"
ON public.documents FOR DELETE
USING (
  is_user_master_admin(auth.uid()) OR 
  user_has_setor_access(auth.uid(), uploader_setor)
);

-- Create trigger for updating updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create tasks table
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('BAIXA', 'MEDIA', 'ALTA')),
  status text NOT NULL CHECK (status IN ('TODO', 'DOING', 'DONE')) DEFAULT 'TODO',
  client_id uuid NOT NULL,
  file_path text,
  viewed_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for tasks table
CREATE POLICY "Admins can view all tasks"
ON public.tasks FOR SELECT
USING (is_admin());

CREATE POLICY "Users can view tasks assigned to their clients"
ON public.tasks FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert tasks"
ON public.tasks FOR INSERT
WITH CHECK (is_admin() AND auth.uid() = created_by);

CREATE POLICY "Admins can update tasks"
ON public.tasks FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete tasks"
ON public.tasks FOR DELETE
USING (is_admin());

-- Create trigger for updating updated_at on tasks
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();