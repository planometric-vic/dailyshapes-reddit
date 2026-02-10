-- Manual Backfill for User: 2ad9c311-deeb-4108-9c43-2be074fc6c2d
--
-- INSTRUCTIONS:
-- 1. First run diagnose-user-2ad9c311.sql to understand the situation
-- 2. Get the competition_id from Step 6 of the diagnostic
-- 3. Replace COMPETITION_ID_HERE below with the actual competition ID
-- 4. Run this script to manually trigger the backfill
--
-- This is SAFE to run multiple times - the function prevents double-counting

-- ==================================================
-- MANUAL BACKFILL EXECUTION
-- ==================================================

-- First, let's see what we're about to backfill
SELECT
    '=== Preview: Scores that will be backfilled ===' as section;

SELECT
    ds.date,
    ds.completed_at,
    ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1) as daily_score
FROM daily_scores ds
WHERE ds.user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND ds.date >= (SELECT start_date FROM competitions WHERE id = 'COMPETITION_ID_HERE'::uuid)
  AND ds.date <= (SELECT end_date FROM competitions WHERE id = 'COMPETITION_ID_HERE'::uuid)
  AND ds.completed_at IS NOT NULL  -- Required by backfill function
  AND NOT EXISTS (
      SELECT 1 FROM competition_daily_tracking cdt
      WHERE cdt.competition_id = 'COMPETITION_ID_HERE'::uuid
        AND cdt.user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
        AND cdt.date = ds.date
  )
ORDER BY ds.date ASC;

-- Now run the actual backfill
SELECT
    '=== Running Backfill Function ===' as section;

SELECT
    dates_backfilled,
    total_score_added,
    CASE
        WHEN dates_backfilled > 0
        THEN '✅ Successfully backfilled ' || dates_backfilled || ' day(s) with ' || total_score_added || ' points!'
        ELSE '⚠️ No scores found to backfill. Check if scores exist in daily_scores table with completed_at set.'
    END as result_message
FROM backfill_competition_scores_on_join(
    'COMPETITION_ID_HERE'::uuid,  -- 👈 REPLACE THIS with actual competition ID
    '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
);

-- Verify the backfill worked
SELECT
    '=== Verification: Check Updated Competition Participant ===' as section;

SELECT
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    cp.last_score_update
FROM competition_participants cp
WHERE cp.competition_id = 'COMPETITION_ID_HERE'::uuid  -- 👈 REPLACE THIS
  AND cp.user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid;

-- Show the tracking entries that were created
SELECT
    '=== Verification: Check Daily Tracking Entries ===' as section;

SELECT
    date,
    daily_score,
    created_at
FROM competition_daily_tracking
WHERE competition_id = 'COMPETITION_ID_HERE'::uuid  -- 👈 REPLACE THIS
  AND user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
ORDER BY date DESC;
