-- ============================================================
-- Lumina AI Media Platform — Supabase Setup
-- Run in Supabase SQL Editor
-- ============================================================

-- Admins table (if not using is_admin column on auth.users)
create table if not exists public.admins (
  user_id uuid references public.users(id) primary key,
  created_at timestamptz default now()
);

-- Make a user an admin (replace with real user ID after registration):
-- insert into admins (user_id) values ('YOUR-USER-UUID-HERE');

-- Optional: RLS policies (if you enable RLS)

-- Workers: service role only
alter table workers enable row level security;
create policy "service role only" on workers
  using (auth.role() = 'service_role');

-- Prompts: users can only see their own
alter table prompts enable row level security;
create policy "users can see own prompts" on prompts
  for select using (auth.uid() = user_id);
create policy "users can insert own prompts" on prompts
  for insert with check (auth.uid() = user_id);
create policy "service role full access prompts" on prompts
  using (auth.role() = 'service_role');

-- Users: service role and own record
alter table users enable row level security;
create policy "service role full access users" on users
  using (auth.role() = 'service_role');
create policy "users can read own record" on users
  for select using (auth.uid() = id);

-- Admins table
alter table admins enable row level security;
create policy "service role only admins" on admins
  using (auth.role() = 'service_role');

-- ============================================================
-- Storage bucket (media) — run in Supabase Dashboard > Storage
-- OR via this SQL:
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('media', 'media', true);
-- create policy "public read media" on storage.objects for select using (bucket_id = 'media');
-- create policy "service insert media" on storage.objects for insert with check (bucket_id = 'media' and auth.role() = 'service_role');
