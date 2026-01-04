-- Run this in Supabase SQL Editor to grant privileges and enable RLS with safe policies
-- Adjust if your tables use uuid for user_id (cast accordingly)

-- Grant schema usage (optional but safe)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant basic table privileges to the authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_grid_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;

-- If you also want the anon role to perform reads (not generally recommended), uncomment:
-- GRANT SELECT ON public.user_activities TO anon;
-- GRANT SELECT ON public.user_grid_data TO anon;
-- GRANT SELECT ON public.user_preferences TO anon;

-- Enable Row Level Security for each table
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_grid_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies that allow authenticated users to manage only their own rows.
-- These policies assume `user_id` is stored as text. If your `user_id` column is uuid, change `auth.uid()::text` to `auth.uid()::uuid` or cast the column.

CREATE POLICY "Authenticated users can SELECT their own activities"
  ON public.user_activities
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can INSERT/UPDATE their own activities"
  ON public.user_activities
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can SELECT their own grid data"
  ON public.user_grid_data
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can INSERT/UPDATE their own grid data"
  ON public.user_grid_data
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can SELECT their own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Authenticated users can INSERT/UPDATE their own preferences"
  ON public.user_preferences
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Notes:
-- 1) Run this in the Supabase SQL editor as a project admin (SQL -> New Query).
-- 2) If your `user_id` column is uuid, replace `auth.uid()::text = user_id` with `auth.uid()::uuid = user_id`.
-- 3) After running, try an authenticated request from your app and inspect the response.
-- 4) If you still see 42501 (insufficient_privilege), ensure you ran the GRANT statements above and that your JWT corresponds to an authenticated user (not service role).
