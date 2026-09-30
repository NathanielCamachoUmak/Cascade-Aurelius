-- =============================================================================
-- Cascade-Aurelius: Add High Scores, Class Certifications & Progression Columns
-- Run this script in your Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Add dedicated JSONB columns to `public.profiles` (idempotent via IF NOT EXISTS)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS high_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_tutorials jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS progression_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill existing data from `settings_and_hotkeys` (if any was already stored there)
UPDATE public.profiles
SET
  high_scores = COALESCE(
    NULLIF(high_scores, '{}'::jsonb),
    COALESCE(settings_and_hotkeys->'highScores', '{}'::jsonb)
  ),
  completed_tutorials = COALESCE(
    NULLIF(completed_tutorials, '{}'::jsonb),
    COALESCE(settings_and_hotkeys->'completedTutorials', '{}'::jsonb)
  ),
  progression_data = COALESCE(
    NULLIF(progression_data, '{}'::jsonb),
    COALESCE(settings_and_hotkeys->'progressionData', '{}'::jsonb)
  );

-- 3. Ensure Row-Level Security (RLS) allows authenticated users to read & update their own profile row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
