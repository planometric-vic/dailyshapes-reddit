-- Diagnostic Queries for Player b306be71-3ca5-464d-a76e-943dd326a569
-- Competition ID: 6b68e958-f2ec-4bfd-842d-dd5169446fbe

-- ==================================================
-- STEP 1: Check competition details
-- ==================================================
SELECT
    '=== STEP 1: Competition Details ===' as step,
    id,
    name,
    start_date,
    end_date,
    is_active,
    CURRENT_DATE as today
FROM competitions
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- ==================================================
-- STEP 2: Check if player is in competition_participants
-- ==================================================
SELECT
    '=== STEP 2: Competition Participant Record ===' as step,
    cp.joined_at,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    cp.last_score_update
FROM competition_participants cp
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND cp.user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid;

-- ==================================================
-- STEP 3: Check all daily_scores for this player (last 30 days)
-- ==================================================
SELECT
    '=== STEP 3: Player Daily Scores (Last 30 Days) ===' as step,
    date,
    completed_at,
    shape1_attempt1,
    shape1_attempt2,
    shape2_attempt1,
    shape2_attempt2,
    shape3_attempt1,
    shape3_attempt2,
    -- Calculate daily score as per backfill function
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1) as calculated_daily_score,
    CASE
        WHEN shape1_attempt1 IS NOT NULL OR shape1_attempt2 IS NOT NULL OR
             shape2_attempt1 IS NOT NULL OR shape2_attempt2 IS NOT NULL OR
             shape3_attempt1 IS NOT NULL OR shape3_attempt2 IS NOT NULL
        THEN 'YES'
        ELSE 'NO'
    END as has_scores
FROM daily_scores
WHERE user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- ==================================================
-- STEP 4: Check competition_daily_tracking (what's already been counted)
-- ==================================================
SELECT
    '=== STEP 4: Already Tracked Scores ===' as step,
    date,
    daily_score,
    created_at
FROM competition_daily_tracking
WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
ORDER BY date DESC;

-- ==================================================
-- STEP 5: Simulate what backfill function SHOULD find
-- ==================================================
SELECT
    '=== STEP 5: What Should Be Backfilled ===' as step,
    ds.date,
    ds.completed_at,
    ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1) as daily_score,
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM competition_daily_tracking cdt
            WHERE cdt.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
              AND cdt.user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
              AND cdt.date = ds.date
        ) THEN 'NOT YET TRACKED'
        ELSE 'ALREADY TRACKED'
    END as tracking_status
FROM daily_scores ds
CROSS JOIN (
    SELECT start_date, end_date
    FROM competitions
    WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
) c
WHERE ds.user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
  AND ds.date >= c.start_date
  AND ds.date <= c.end_date
  AND ds.date <= CURRENT_DATE
  AND ds.completed_at IS NOT NULL
  AND (ds.shape1_attempt1 IS NOT NULL OR ds.shape1_attempt2 IS NOT NULL OR
       ds.shape2_attempt1 IS NOT NULL OR ds.shape2_attempt2 IS NOT NULL OR
       ds.shape3_attempt1 IS NOT NULL OR ds.shape3_attempt2 IS NOT NULL)
ORDER BY ds.date DESC;

-- ==================================================
-- STEP 6: Check if backfill function exists
-- ==================================================
SELECT
    '=== STEP 6: Check Function Exists ===' as step,
    proname as function_name,
    prosrc as function_body_preview
FROM pg_proc
WHERE proname = 'backfill_competition_scores_on_join';

-- ==================================================
-- STEP 7: Try running the backfill function
-- ==================================================
SELECT
    '=== STEP 7: Manual Backfill Execution ===' as step,
    dates_backfilled,
    total_score_added
FROM backfill_competition_scores_on_join(
    '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid,
    'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
);
