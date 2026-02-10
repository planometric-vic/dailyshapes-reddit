-- Detailed diagnostic for Our Times competition
-- Show EXACTLY what's happening

-- ============================================================================
-- 1. Show competition details
-- ============================================================================
SELECT
    '=== COMPETITION INFO ===' as section,
    id,
    name,
    start_date,
    end_date,
    is_active,
    created_at
FROM competitions
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- ============================================================================
-- 2. Show CURRENT stored scores in competition_participants
-- ============================================================================
SELECT
    '=== CURRENT STORED SCORES ===' as section,
    u.username,
    cp.user_id,
    cp.total_score as stored_total,
    cp.days_played as stored_days,
    cp.last_played_date,
    cp.last_score_update
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
ORDER BY cp.total_score DESC;

-- ============================================================================
-- 3. Show EVERY daily score for EVERY participant (with date filtering)
-- ============================================================================
SELECT
    '=== ALL DAILY SCORES (with filters applied) ===' as section,
    u.username,
    ds.user_id,
    ds.date,
    ds.completed_at,
    ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_score,
    CASE WHEN ds.date >= '2025-10-12' THEN '✅' ELSE '❌ Before start' END as after_start,
    CASE WHEN ds.date <= '2025-10-19' THEN '✅' ELSE '❌ After end' END as before_end,
    CASE WHEN ds.date <= CURRENT_DATE THEN '✅' ELSE '❌ Future' END as not_future,
    CASE WHEN ds.completed_at IS NOT NULL THEN '✅' ELSE '❌ Not completed' END as is_completed,
    CASE
        WHEN ds.date >= '2025-10-12'
         AND ds.date <= '2025-10-19'
         AND ds.date <= CURRENT_DATE
         AND ds.completed_at IS NOT NULL
        THEN '✅ SHOULD COUNT'
        ELSE '❌ EXCLUDED'
    END as final_status
FROM competition_participants cp
JOIN daily_scores ds ON cp.user_id = ds.user_id
JOIN users u ON u.id = cp.user_id
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND ds.date >= '2025-10-01'  -- Show all recent scores
ORDER BY u.username, ds.date DESC;

-- ============================================================================
-- 4. Calculate what SHOULD be counted
-- ============================================================================
SELECT
    '=== CALCULATED CORRECT TOTALS ===' as section,
    u.username,
    COUNT(*) as days_should_count,
    SUM(
        ROUND(
            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
            1
        )
    ) as total_should_be,
    string_agg(
        ds.date::text || '=' ||
        ROUND(
            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
            1
        )::text,
        ' + '
        ORDER BY ds.date
    ) as breakdown,
    cp.total_score as currently_stored,
    cp.days_played as currently_days
FROM competition_participants cp
JOIN daily_scores ds ON cp.user_id = ds.user_id
JOIN users u ON u.id = cp.user_id
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND ds.date >= '2025-10-12'
  AND ds.date <= '2025-10-19'
  AND ds.date <= CURRENT_DATE
  AND ds.completed_at IS NOT NULL
GROUP BY u.username, cp.total_score, cp.days_played
ORDER BY total_should_be DESC;

-- ============================================================================
-- 5. Show Mike and bennky specifically
-- ============================================================================
SELECT
    '=== MIKE DETAILED ===' as section,
    ds.date,
    ds.completed_at,
    shape1_attempt1, shape1_attempt2,
    shape2_attempt1, shape2_attempt2,
    shape3_attempt1, shape3_attempt2,
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_avg
FROM daily_scores ds
WHERE ds.user_id = '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid
  AND ds.date >= '2025-10-11'
ORDER BY ds.date DESC;

SELECT
    '=== BENNKY DETAILED ===' as section,
    ds.date,
    ds.completed_at,
    shape1_attempt1, shape1_attempt2,
    shape2_attempt1, shape2_attempt2,
    shape3_attempt1, shape3_attempt2,
    ROUND(
        (COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
         COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
         COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_avg
FROM daily_scores ds
WHERE ds.user_id = '5801f70d-70fc-43df-b956-4bb154292289'::uuid
  AND ds.date >= '2025-10-11'
ORDER BY ds.date DESC;

-- ============================================================================
-- 6. What does CURRENT_DATE resolve to?
-- ============================================================================
SELECT
    '=== SERVER DATE CHECK ===' as section,
    CURRENT_DATE as current_date,
    NOW() as now_timestamp,
    CURRENT_TIMESTAMP as current_timestamp;
