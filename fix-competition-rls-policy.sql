-- ============================================================================
-- FIX: Row-Level Security (RLS) Policy for competition_daily_tracking
--
-- ERROR: "new row violates row-level security policy for table competition_daily_tracking"
--
-- The update_competition_score RPC function needs permission to INSERT/UPDATE
-- rows in competition_daily_tracking on behalf of users.
-- ============================================================================

-- Step 1: Check current RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'competition_daily_tracking';

-- Step 2: Enable RLS on the table (if not already enabled)
ALTER TABLE competition_daily_tracking ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Users can view their own competition daily tracking" ON competition_daily_tracking;
DROP POLICY IF EXISTS "Users can insert their own competition daily tracking" ON competition_daily_tracking;
DROP POLICY IF EXISTS "Users can update their own competition daily tracking" ON competition_daily_tracking;

-- Step 4: Create proper RLS policies

-- Allow users to view their own competition daily tracking records
CREATE POLICY "Users can view their own competition daily tracking"
ON competition_daily_tracking
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to view competition daily tracking for competitions they're in
CREATE POLICY "Users can view competition daily tracking for their competitions"
ON competition_daily_tracking
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM competition_participants cp
        WHERE cp.competition_id = competition_daily_tracking.competition_id
        AND cp.user_id = auth.uid()
    )
);

-- Allow the RPC function to insert competition daily tracking records
-- This policy allows inserts when the user_id matches the authenticated user
CREATE POLICY "Users can insert their own competition daily tracking"
ON competition_daily_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow the RPC function to update competition daily tracking records
-- This policy allows updates when the user_id matches the authenticated user
CREATE POLICY "Users can update their own competition daily tracking"
ON competition_daily_tracking
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 5: Verify the policies were created
SELECT
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'competition_daily_tracking'
ORDER BY cmd, policyname;
