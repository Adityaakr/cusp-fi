-- CUSP Waitlist — Supabase schema
-- Run this in the Supabase SQL Editor to set up the waitlist table and count function.

-- 1. Create the waitlist table
create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  role text,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.waitlist enable row level security;

-- 3. Allow anonymous users to INSERT (register)
create policy "Allow anonymous insert"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- 4. Deny direct SELECT on waitlist (emails are private)
-- No select policy = no one can read rows. We expose only the count via RPC.

-- 5. Create function to get waitlist count (callable by anon, returns count only)
create or replace function public.get_waitlist_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint from waitlist;
$$;

-- 6. Grant execute to anon so the frontend can call it
grant execute on function public.get_waitlist_count() to anon;
grant execute on function public.get_waitlist_count() to authenticated;

-- 7. Optional: Index for faster count (Postgres counts are typically fast without)
-- create index if not exists waitlist_created_at_idx on waitlist(created_at);
