-- Add gradient column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN gradient text DEFAULT 'Dourado Atual';