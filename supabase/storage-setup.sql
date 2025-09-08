-- Create storage bucket for task files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('task-files', 'task-files', true, 52428800, ARRAY['application/pdf', 'image/*', 'text/*', 'application/vnd.openxmlformats-officedocument.*', 'application/msword', 'application/vnd.ms-excel']);

-- Set up RLS policies for the bucket
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files');

CREATE POLICY "Allow authenticated users to view files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-files');

CREATE POLICY "Allow authenticated users to update files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-files');

CREATE POLICY "Allow authenticated users to delete files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-files');