-- Create table to store messages from the internal general chat
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  user_name text
);

alter table public.group_messages enable row level security;

create policy if not exists "Authenticated users can read group messages"
  on public.group_messages
  for select
  to authenticated
  using (true);

create policy if not exists "Authenticated users can post group messages"
  on public.group_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists idx_group_messages_created_at
  on public.group_messages (created_at desc);

alter table public.group_messages replica identity full;

-- Ensure the table is part of realtime publications if available
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  END IF;
END $$;
