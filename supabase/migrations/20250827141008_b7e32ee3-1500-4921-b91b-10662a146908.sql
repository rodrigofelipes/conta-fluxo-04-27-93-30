-- Allow unauthenticated users to query username and email for login purposes
CREATE POLICY "Allow username lookup for authentication" 
ON public.profiles 
FOR SELECT 
USING (true);