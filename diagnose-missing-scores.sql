-- Diagnose Missing Scores for Competition 6b68e958-f2ec-4bfd-842d-dd5169446fbe
-- Check what daily scores exist vs what's recorded in competition

-- User 1: 2ad9c311-deeb-4108-9c43-2be074fc6c2d
-- User 2: 5801f70d-70fc-43df-b956-4bb154292289

-- ============================================================================
-- Check competition details
-- ============================================================================
SELECT
    '=== COMPETITION DETAILS ===' as info,
    id,
    name,
    start_date,
    end_date,
    is_active,
    CURRENT_DATE as today
FROM competitions
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- ============================================================================
-- Check current competition_participants records
-- ============================================================================
SELECT
    '=== CURRENT COMPETITION RECORDS ===' as info,
    u.username,
    cp.user_id,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    cp.last_score_update
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND cp.user_id IN (
    '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid,
    '5801f70d-70fc-43df-b956-4bb154292289'::uuid
  );

-- ============================================================================
-- Check ALL daily scores for these users
-- ============================================================================
SELECT
    '=== ALL DAILY SCORES (User 2ad9c311) ===' as info,
    date,
    completed_at,
    shape1_attempt1,
    shape1_attempt2,
    shape2_attempt1,
    shape2_attempt2,
    shape3_attempt1,
    shape3_attempt2,
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_average
FROM daily_scores
WHERE user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND date >= '2025-10-01'  -- Last 2 weeks
ORDER BY date DESC;

SELECT
    '=== ALL DAILY SCORES (User 5801f70d) ===' as info,
    date,
    completed_at,
    shape1_attempt1,
    shape1_attempt2,
    shape2_attempt1,
    shape2_attempt2,
    shape3_attempt1,
    shape3_attempt2,
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_average
FROM daily_scores
WHERE user_id = '5801f70d-70fc-43df-b956-4bb154292289'::uuid
  AND date >= '2025-10-01'  -- Last 2 weeks
ORDER BY date DESC;

-- ============================================================================
-- Calculate what the scores SHOULD be based on competition dates
-- ============================================================================
WITH comp_dates AS (
    SELECT start_date, end_date
    FROM competitions
    WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
)
SELECT
    '=== WHAT SCORES SHOULD BE (User 2ad9c311) ===' as info,
    ds.date,
    ds.completed_at,
    ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_score,
    CASE
        WHEN ds.date >= (SELECT start_date FROM comp_dates)
         AND ds.date <= (SELECT end_date FROM comp_dates)
         AND ds.date <= CURRENT_DATE
         AND ds.completed_at IS NOT NULL
        THEN '✅ SHOULD COUNT'
        ELSE '❌ EXCLUDED'
    END as should_count,
    CASE
        WHEN ds.date < (SELECT start_date FROM comp_dates) THEN 'Before competition start'
        WHEN ds.date > (SELECT end_date FROM comp_dates) THEN 'After competition end'
        WHEN ds.date > CURRENT_DATE THEN 'Future date'
        WHEN ds.completed_at IS NULL THEN 'Not completed'
        ELSE 'Valid'
    END as reason
FROM daily_scores ds
WHERE ds.user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND ds.date >= '2025-10-01'
ORDER BY ds.date DESC;

WITH comp_dates AS (
    SELECT start_date, end_date
    FROM competitions
    WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
)
SELECT
    '=== WHAT SCORES SHOULD BE (User 5801f70d) ===' as info,
    ds.date,
    ds.completed_at,
    ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_score,
    CASE
        WHEN ds.date >= (SELECT start_date FROM comp_dates)
         AND ds.date <= (SELECT end_date FROM comp_dates)
         AND ds.date <= CURRENT_DATE
         AND ds.completed_at IS NOT NULL
        THEN '✅ SHOULD COUNT'
        ELSE '❌ EXCLUDED'
    END as should_count,
    CASE
        WHEN ds.date < (SELECT start_date FROM comp_dates) THEN 'Before competition start'
        WHEN ds.date > (SELECT end_date FROM comp_dates) THEN 'After competition end'
        WHEN ds.date > CURRENT_DATE THEN 'Future date'
        WHEN ds.completed_at IS NULL THEN 'Not completed'
        ELSE 'Valid'
    END as reason
FROM daily_scores ds
WHERE ds.user_id = '5801f70d-70fc-43df-b956-4bb154292289'::uuid
  AND ds.date >= '2025-10-01'
ORDER BY ds.date DESC;

-- ============================================================================
-- Calculate correct totals
-- ============================================================================
WITH comp_dates AS (
    SELECT start_date, end_date
    FROM competitions
    WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
)
SELECT
    '=== CALCULATED CORRECT TOTALS ===' as info,
    u.username,
    ds.user_id,
    COUNT(*) as days_that_should_count,
    SUM(
        ROUND(
            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
            1
        )
    ) as correct_total,
    cp.total_score as current_stored_total,
    cp.days_played as current_stored_days
FROM daily_scores ds
CROSS JOIN comp_dates cd
LEFT JOIN competition_participants cp
    ON cp.user_id = ds.user_id
    AND cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
LEFT JOIN users u ON u.id = ds.user_id
WHERE ds.user_id IN (
    '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid,
    '5801f70d-70fc-43df-b956-4bb154292289'::uuid
)
AND ds.date >= cd.start_date
AND ds.date <= cd.end_date
AND ds.date <= CURRENT_DATE
AND ds.completed_at IS NOT NULL
GROUP BY u.username, ds.user_id, cp.total_score, cp.days_played;

-- ============================================================================
-- Check competition_daily_tracking table
-- ============================================================================
SELECT
    '=== TRACKING TABLE (what was counted) ===' as info,
    user_id,
    date,
    daily_score,
    created_at
FROM competition_daily_tracking
WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND user_id IN (
    '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid,
    '5801f70d-70fc-43df-b956-4bb154292289'::uuid
  )
ORDER BY user_id, date DESC;
