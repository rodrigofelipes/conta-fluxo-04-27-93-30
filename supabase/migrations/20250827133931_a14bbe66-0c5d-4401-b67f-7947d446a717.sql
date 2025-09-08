-- ENUMs para tarefas
CREATE TYPE public.task_status AS ENUM ('aberta','em_andamento','concluida','arquivada');
CREATE TYPE public.task_priority AS ENUM ('baixa','media','alta','urgente');

-- Atualizar tabela profiles existente se necessário
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_e164 text,
ADD COLUMN IF NOT EXISTS company_name text;

-- Função para criar profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TAREFAS
CREATE TABLE IF NOT EXISTS public.tasks_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'aberta',
  priority public.task_priority NOT NULL DEFAULT 'media',
  due_date timestamp with time zone,
  client_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS tasks_new_client_id_idx ON public.tasks_new(client_id);
CREATE INDEX IF NOT EXISTS tasks_new_created_by_idx ON public.tasks_new(created_by);
CREATE INDEX IF NOT EXISTS tasks_new_status_idx ON public.tasks_new(status);
CREATE INDEX IF NOT EXISTS tasks_new_updated_at_idx ON public.tasks_new(updated_at DESC);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER trg_tasks_new_updated_at
  BEFORE UPDATE ON public.tasks_new
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- COMENTÁRIOS
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks_new(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS task_comments_created_at_idx ON public.task_comments(created_at DESC);

-- ARQUIVOS
CREATE TABLE IF NOT EXISTS public.task_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks_new(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  content_type text,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_files_task_idx ON public.task_files(task_id);

-- Habilitar RLS
ALTER TABLE public.tasks_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies para TASKS
CREATE POLICY "Admin can do everything with tasks"
ON public.tasks_new FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);

CREATE POLICY "Clients can view their own tasks"
ON public.tasks_new FOR SELECT
USING (client_id = auth.uid());

-- RLS Policies para COMMENTS
CREATE POLICY "Users can view comments on their tasks"
ON public.task_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks_new t
    WHERE t.id = task_comments.task_id
      AND (t.client_id = auth.uid() OR t.created_by = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.user_roles ur 
             WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
           ))
  )
);

CREATE POLICY "Users can create comments on their tasks"
ON public.task_comments FOR INSERT
WITH CHECK (
  author_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tasks_new t
    WHERE t.id = task_comments.task_id
      AND (t.client_id = auth.uid() OR t.created_by = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.user_roles ur 
             WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
           ))
  )
);

-- RLS Policies para FILES
CREATE POLICY "Users can view files on their tasks"
ON public.task_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks_new t
    WHERE t.id = task_files.task_id
      AND (t.client_id = auth.uid() OR t.created_by = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.user_roles ur 
             WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
           ))
  )
);

CREATE POLICY "Users can upload files to their tasks"
ON public.task_files FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tasks_new t
    WHERE t.id = task_files.task_id
      AND (t.client_id = auth.uid() OR t.created_by = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM public.user_roles ur 
             WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
           ))
  )
);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks_new;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_files;