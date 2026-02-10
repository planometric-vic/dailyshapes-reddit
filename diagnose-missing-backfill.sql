-- Diagnostic Queries to Find Why Backfill Didn't Work
-- Replace 'USER_ID_HERE' with the actual user ID
-- Replace 'COMPETITION_ID_HERE' with the actual competition ID

-- ==================================================
-- STEP 1: Check if user has a daily_scores record for today
-- ==================================================
SELECT
    'Step 1: Check daily_scores table' as step,
    date,
    completed_at,
    shape1_attempt1,
    shape1_attempt2,
    shape2_attempt1,
    shape2_attempt2,
    shape3_attempt1,
    shape3_attempt2,
    -- Calculate what the backfill function would calculate
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1) as calculated_daily_score
FROM daily_scores
WHERE user_id = 'USER_ID_HERE'::uuid
  AND date = CURRENT_DATE
ORDER BY created_at DESC;

-- ==================================================
-- STEP 2: Check if backfill function exists
-- ==================================================
SELECT
    'Step 2: Check if backfill function exists' as step,
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'backfill_competition_scores_on_join';

-- ==================================================
-- STEP 3: Check competition details
-- ==================================================
SELECT
    'Step 3: Check competition details' as step,
    id,
    name,
    start_date,
    end_date,
    is_active
FROM competitions
WHERE id = 'COMPETITION_ID_HERE'::uuid;

-- ==================================================
-- STEP 4: Check if user is in competition_participants
-- ==================================================
SELECT
    'Step 4: Check competition_participants' as step,
    cp.joined_at,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date
FROM competition_participants cp
WHERE cp.competition_id = 'COMPETITION_ID_HERE'::uuid
  AND cp.user_id = 'USER_ID_HERE'::uuid;

-- ==================================================
-- STEP 5: Check if score was already tracked (prevents double-counting)
-- ==================================================
SELECT
    'Step 5: Check competition_daily_tracking' as step,
    date,
    daily_score,
    created_at
FROM competition_daily_tracking
WHERE competition_id = 'COMPETITION_ID_HERE'::uuid
  AND user_id = 'USER_ID_HERE'::uuid
ORDER BY date DESC;

-- ==================================================
-- STEP 6: Test backfill function manually
-- ==================================================
-- Run this to manually trigger the backfill
-- This will show what the function would return
SELECT
    'Step 6: Manual backfill test' as step,
    *
FROM backfill_competition_scores_on_join(
    'COMPETITION_ID_HERE'::uuid,
    'USER_ID_HERE'::uuid
);

-- ==================================================
-- STEP 7: Check user_daily_progress table (alternative storage)
-- ==================================================
SELECT
    'Step 7: Check user_daily_progress table' as step,
    date,
    completed,
    total_score,
    scores,
    attempts,
    updated_at
FROM user_daily_progress
WHERE user_id = 'USER_ID_HERE'::uuid
  AND date = CURRENT_DATE;

-- ==================================================
-- STEP 8: Check all daily_scores for this user (last 7 days)
-- ==================================================
SELECT
    'Step 8: Recent daily_scores for user' as step,
    date,
    completed_at,
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1) as daily_score
FROM daily_scores
WHERE user_id = 'USER_ID_HERE'::uuid
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
