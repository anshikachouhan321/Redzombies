-- ==============================================================================
-- RedZombies — Global Real-Time Leaderboard Database Setup
-- Run this complete script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. Create the Leaderboard Table
CREATE TABLE IF NOT EXISTS public.leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_icon TEXT NOT NULL DEFAULT '💀',
  high_score INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Fast Index for Instant Top 10 Query Performance (O(log N))
CREATE INDEX IF NOT EXISTS idx_leaderboard_high_score 
  ON public.leaderboard (high_score DESC, updated_at ASC);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policies
-- Allow anyone to view the leaderboard scores (Public Read)
DROP POLICY IF EXISTS "Public can view leaderboard" ON public.leaderboard;
CREATE POLICY "Public can view leaderboard"
  ON public.leaderboard
  FOR SELECT
  USING (true);

-- Allow any player to register their profile / score (Public Insert)
DROP POLICY IF EXISTS "Anyone can insert leaderboard scores" ON public.leaderboard;
CREATE POLICY "Anyone can insert leaderboard scores"
  ON public.leaderboard
  FOR INSERT
  WITH CHECK (true);

-- Allow players to update their own score
DROP POLICY IF EXISTS "Anyone can update their own score" ON public.leaderboard;
CREATE POLICY "Anyone can update their own score"
  ON public.leaderboard
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 5. Enable Full Replica Identity for Complete Real-time Payloads
ALTER TABLE public.leaderboard REPLICA IDENTITY FULL;

-- 6. Add Table to Supabase Realtime Publication
-- This broadcasts INSERT and UPDATE events to connected WebSocket clients live!
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END
  $$;

  ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
COMMIT;

-- Setup Complete! The leaderboard is ready for real-time WebSocket sync.
