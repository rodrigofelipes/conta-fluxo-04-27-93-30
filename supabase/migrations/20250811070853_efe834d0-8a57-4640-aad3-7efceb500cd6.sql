-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Create messages table (secure, RLS-enabled)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null,
  to_user_id uuid not null,
  message text not null,
  created_at timestamptz not null default now(),
  from_user_name text,
  to_user_name text
);

-- Enable Row Level Security
alter table public.messages enable row level security;

-- Policies (no IF NOT EXISTS)
create policy "Users can view their conversation messages"
  on public.messages
  for select
  to authenticated
  using (
    auth.uid() = from_user_id or auth.uid() = to_user_id
  );

create policy "Users can insert messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = from_user_id
  );

create policy "Users can update their own messages"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = from_user_id);

create policy "Users can delete their own messages"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = from_user_id);

-- For better realtime payloads on updates/deletes (optional but safe)
alter table public.messages replica identity full;

-- Helpful indexes for querying conversations
create index if not exists idx_messages_participants_created_at
  on public.messages (from_user_id, to_user_id, created_at desc);
create index if not exists idx_messages_reverse_participants_created_at
  on public.messages (to_user_id, from_user_id, created_at desc);
