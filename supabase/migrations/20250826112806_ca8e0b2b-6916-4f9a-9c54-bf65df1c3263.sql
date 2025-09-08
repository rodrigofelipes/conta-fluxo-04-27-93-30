-- Drop existing policies that might be causing the enum validation issue
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;

-- Create new simple policies for task-files bucket
CREATE POLICY "Enable read access for authenticated users on task-files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'task-files');

CREATE POLICY "Enable insert access for authenticated users on task-files" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'task-files');

CREATE POLICY "Enable update access for authenticated users on task-files" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'task-files');

CREATE POLICY "Enable delete access for authenticated users on task-files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'task-files');