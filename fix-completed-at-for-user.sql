-- Fix completed_at for User: 2ad9c311-deeb-4108-9c43-2be074fc6c2d
-- This fixes the backfill issue if completed_at is NULL

-- ==================================================
-- STEP 1: Check the actual schema of daily_scores table
-- ==================================================
SELECT
    '=== Daily Scores Table Schema ===' as section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_scores'
ORDER BY ordinal_position;

-- ==================================================
-- STEP 2: Check current state of user's scores
-- ==================================================
SELECT
    '=== User Scores - Current State ===' as section;

SELECT
    date,
    completed_at,
    shape1_attempt1,
    shape1_attempt2,
    shape2_attempt1,
    shape2_attempt2,
    shape3_attempt1,
    shape3_attempt2,
    CASE
        WHEN completed_at IS NULL THEN '❌ NULL - Needs fixing'
        ELSE '✅ Set'
    END as completed_at_status,
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1) as daily_score
FROM daily_scores
WHERE user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- ==================================================
-- STEP 3: Fix completed_at for today's score
-- ==================================================
-- Set completed_at to NOW() for any scores that are missing it

SELECT
    '=== Fixing completed_at ===' as section;

UPDATE daily_scores
SET completed_at = NOW()
WHERE user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND date = CURRENT_DATE
  AND completed_at IS NULL
  -- Only update if the game is actually complete (all 6 attempts have scores)
  AND shape1_attempt1 IS NOT NULL
  AND shape1_attempt2 IS NOT NULL
  AND shape2_attempt1 IS NOT NULL
  AND shape2_attempt2 IS NOT NULL
  AND shape3_attempt1 IS NOT NULL
  AND shape3_attempt2 IS NOT NULL
RETURNING
    date,
    completed_at,
    'Completed_at has been set!' as status;

-- ==================================================
-- STEP 4: Verify the fix
-- ==================================================
SELECT
    '=== Verification - Check completed_at is now set ===' as section;

SELECT
    date,
    completed_at,
    CASE
        WHEN completed_at IS NOT NULL THEN '✅ Fixed! Ready for backfill'
        ELSE '❌ Still NULL - may need manual investigation'
    END as status
FROM daily_scores
WHERE user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND date = CURRENT_DATE;

-- ==================================================
-- NEXT STEPS:
-- ==================================================
-- After running this:
-- 1. If completed_at is now set, run manual-backfill-user-2ad9c311.sql
-- 2. If completed_at is still NULL, check if all 6 attempts have scores
--    (the UPDATE only runs if all 6 attempts are present)
