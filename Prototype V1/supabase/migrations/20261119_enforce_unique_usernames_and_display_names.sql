-- =============================================================================
-- Cascade-Aurelius: Enforce Unique Usernames & Display Names in Supabase
-- Run this script in your Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Ensure `username` column exists on `public.profiles`
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS username text;

-- 2. Backfill existing `auth.users` into `public.profiles` if missing
INSERT INTO public.profiles (id, username, high_scores, completed_tutorials, progression_data, settings_and_hotkeys)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  '{}'::jsonb,
  '{}'::jsonb,
  '{"level": 1, "xp": 0, "points": 0}'::jsonb,
  '{}'::jsonb
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET username = COALESCE(public.profiles.username, EXCLUDED.username);

-- 3. Create a Case-Insensitive UNIQUE Index on `public.profiles(username)`
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx 
  ON public.profiles (LOWER(username));

-- 4. Backfill `auth.users.raw_user_meta_data` so the Supabase Auth -> Users
--    dashboard displays usernames under the "Display name" column for existing users!
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'display_name', COALESCE(raw_user_meta_data->>'username', raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  'full_name',    COALESCE(raw_user_meta_data->>'username', raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  'name',         COALESCE(raw_user_meta_data->>'username', raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  'username',     COALESCE(raw_user_meta_data->>'username', raw_user_meta_data->>'display_name', split_part(email, '@', 1))
)
WHERE raw_user_meta_data->>'display_name' IS NULL 
   OR raw_user_meta_data->>'username' IS NULL;

-- 5. RPC function to check if a username is available (case-insensitive)
CREATE OR REPLACE FUNCTION public.is_username_available(check_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF check_username IS NULL OR length(trim(check_username)) < 3 THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(trim(check_username))
  );
END;
$$;

-- Grant execution to public / anon / authenticated users
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated, service_role;

-- 6. Trigger Function to automatically synchronize new users to `profiles`
--    and ensure unique usernames at the database level
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  desired_username text;
BEGIN
  -- Determine username from metadata or fallback to email prefix
  desired_username := trim(COALESCE(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'display_name',
    split_part(new.email, '@', 1)
  ));

  -- Validate minimum length
  IF length(desired_username) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters long.';
  END IF;

  -- Enforce uniqueness across profiles (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(desired_username) AND id <> new.id
  ) THEN
    RAISE EXCEPTION 'Username "%" is already taken. Please choose another username.', desired_username;
  END IF;

  -- Insert profile row (FK check passes because user exists in auth.users)
  INSERT INTO public.profiles (
    id,
    username,
    high_scores,
    completed_tutorials,
    progression_data,
    settings_and_hotkeys
  )
  VALUES (
    new.id,
    desired_username,
    '{}'::jsonb,
    '{}'::jsonb,
    '{"level": 1, "xp": 0, "points": 0}'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username;

  -- Ensure auth.users has display_name and full_name populated in metadata
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'display_name', desired_username,
    'full_name', desired_username,
    'name', desired_username,
    'username', desired_username
  )
  WHERE id = new.id
    AND (raw_user_meta_data->>'display_name' IS NULL OR raw_user_meta_data->>'username' IS NULL);

  RETURN new;
END;
$$;

-- Attach trigger to auth.users AFTER INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Ensure RLS allows reading profiles for username verification & leaderboards
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Public profiles are viewable by everyone"
      ON public.profiles
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
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
