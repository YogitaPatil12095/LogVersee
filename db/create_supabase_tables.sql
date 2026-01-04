-- SQL migration to create user-scoped tables for LogVerse
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)

-- Table: user_activities
create table if not exists public.user_activities (
  user_id text primary key,
  activities jsonb,
  updated_at timestamptz default now()
);

-- Table: user_grid_data
create table if not exists public.user_grid_data (
  user_id text primary key,
  grid_data jsonb,
  updated_at timestamptz default now()
);

-- Table: user_preferences
create table if not exists public.user_preferences (
  user_id text primary key,
  theme text,
  updated_at timestamptz default now()
);

-- Optional: grant anon role insert/select/upsert as needed (use with caution)
-- grant usage on schema public to anon;
-- grant select, insert, update on user_activities, user_grid_data, user_preferences to anon;

-- Notes:
-- 1) If Row Level Security (RLS) is enabled, create appropriate policies to allow
--    authenticated users to read/write only their own rows, e.g. using auth.uid() checks.
-- 2) After creating tables, the existing client-side upsert calls in `src/App.js`
--    will start persisting data server-side.
