-- ─── ENBD DSPM Issue Tracker — Supabase Setup ───────────────────────────────
-- Run this once in your Supabase project → SQL Editor

-- 1. Key-value store table (mirrors window.storage / localStorage API)
create table if not exists kv_store (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz default now()
);

-- 2. Row Level Security (required for anon access)
alter table kv_store enable row level security;

-- 3. Allow any authenticated or anon user to read (shared portal, no login)
create policy "Public read"
  on kv_store for select
  using (true);

-- 4. Allow any anon user to insert / update / delete
--    The anon key in the client bundle gates access — keep the URL internal
create policy "Public write"
  on kv_store for all
  using (true)
  with check (true);

-- 5. Optional: index for faster key lookups (already primary key, but explicit)
-- create index if not exists kv_store_key_idx on kv_store (key);

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- After running, confirm with:
-- select * from kv_store;   -- should return empty table
