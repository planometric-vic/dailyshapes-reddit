-- Diagnostic Queries for User: 2ad9c311-deeb-4108-9c43-2be074fc6c2d
-- Run each section in your Supabase SQL Editor to investigate the backfill issue

-- ==================================================
-- STEP 1: Check if user has a daily_scores record for today
-- ==================================================
SELECT
    '=== STEP 1: User Daily Scores ===' as section;

SELECT
    date,
    completed_at,
    created_at,
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
    )::NUMERIC(4,1) as calculated_daily_score,
    -- Check if completed_at is set (required by backfill function!)
    CASE WHEN completed_at IS NULL THEN '❌ MISSING - BACKFILL WILL SKIP' ELSE '✅ Present' END as completed_at_status
FROM daily_scores
WHERE user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- ==================================================
-- STEP 2: Check user_daily_progress (alternative storage)
-- ==================================================
SELECT
    '=== STEP 2: User Daily Progress ===' as section;

SELECT
    date,
    completed,
    total_score,
    scores,
    attempts,
    created_at,
    updated_at
FROM user_daily_progress
WHERE user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- ==================================================
-- STEP 3: Find which competitions this user joined
-- ==================================================
SELECT
    '=== STEP 3: User Competition Participations ===' as section;

SELECT
    c.id as competition_id,
    c.name as competition_name,
    c.start_date,
    c.end_date,
    c.is_active,
    c.is_global,
    cp.joined_at,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    -- Check if today is in competition range
    CASE
        WHEN CURRENT_DATE >= c.start_date AND CURRENT_DATE <= c.end_date
        THEN '✅ Today is in range'
        ELSE '❌ Today is outside range'
    END as date_range_check
FROM competition_participants cp
JOIN competitions c ON c.id = cp.competition_id
WHERE cp.user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
ORDER BY cp.joined_at DESC;

-- ==================================================
-- STEP 4: Check if scores were already tracked in competitions
-- ==================================================
SELECT
    '=== STEP 4: Competition Daily Tracking (Already Added) ===' as section;

SELECT
    c.name as competition_name,
    cdt.date,
    cdt.daily_score,
    cdt.created_at
FROM competition_daily_tracking cdt
JOIN competitions c ON c.id = cdt.competition_id
WHERE cdt.user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
ORDER BY cdt.date DESC, cdt.created_at DESC
LIMIT 20;

-- ==================================================
-- STEP 5: Check if backfill function exists
-- ==================================================
SELECT
    '=== STEP 5: Backfill Function Check ===' as section;

SELECT
    proname as function_name,
    CASE WHEN proname IS NOT NULL THEN '✅ Function exists' ELSE '❌ Function missing' END as status
FROM pg_proc
WHERE proname = 'backfill_competition_scores_on_join';

-- ==================================================
-- STEP 6: Get current active global competition
-- ==================================================
SELECT
    '=== STEP 6: Current Global Competition ===' as section;

SELECT
    id as competition_id,
    name,
    start_date,
    end_date,
    is_active,
    created_at,
    -- This is what we'll use for the backfill
    CASE
        WHEN is_active = true AND CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date
        THEN '✅ Active and in date range'
        ELSE '⚠️ Inactive or outside date range'
    END as status
FROM competitions
WHERE is_global = true
ORDER BY created_at DESC
LIMIT 5;

-- ==================================================
-- STEP 7: Manual Backfill Test (Safe - just shows what would happen)
-- ==================================================
-- This will show what the backfill function WOULD do without actually doing it
-- Replace COMPETITION_ID_HERE with the actual competition ID from Step 6

/*
SELECT
    '=== STEP 7: Manual Backfill Test ===' as section;

SELECT
    dates_backfilled,
    total_score_added,
    CASE
        WHEN dates_backfilled > 0 THEN '✅ Backfill found scores to add!'
        ELSE '❌ No scores found to backfill'
    END as result
FROM backfill_competition_scores_on_join(
    'COMPETITION_ID_HERE'::uuid,  -- Replace with actual competition ID
    '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
);
*/

-- ==================================================
-- INSTRUCTIONS:
-- ==================================================
-- 1. Run sections 1-6 first to understand the situation
-- 2. Look at the results:
--    - Step 1: Does the user have a daily_scores record for today? Is completed_at set?
--    - Step 2: Is the score in user_daily_progress instead?
--    - Step 3: Which competitions did the user join? When?
--    - Step 4: Were scores already added to competitions?
--    - Step 5: Does the backfill function exist?
--    - Step 6: What's the current global competition ID?
-- 3. Uncomment Step 7, replace COMPETITION_ID_HERE with the ID from Step 6
-- 4. Run Step 7 to test the backfill (this is safe, it will run the function)
