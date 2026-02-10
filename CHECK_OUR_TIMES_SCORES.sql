-- Emergency diagnostic for "Our Times" competition
-- Competition ID: 6b68e958-f2ec-4bfd-842d-dd5169446fbe

-- ============================================================================
-- STEP 1: Get competition details
-- ============================================================================
SELECT
    'COMPETITION INFO' as section,
    name,
    start_date,
    end_date,
    is_active,
    created_at
FROM competitions
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- ============================================================================
-- STEP 2: Show EVERY daily score for EVERY user in this competition
-- ============================================================================
SELECT
    'ALL DAILY SCORES FOR COMPETITION PARTICIPANTS' as section,
    u.username,
    ds.user_id,
    ds.date,
    ds.completed_at,
    ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    ) as daily_average,
    CASE
        WHEN ds.completed_at IS NULL THEN '❌ Not completed'
        WHEN ds.date > CURRENT_DATE THEN '❌ Future date'
        ELSE '✅ Valid'
    END as status
FROM competition_participants cp
JOIN daily_scores ds ON cp.user_id = ds.user_id
JOIN users u ON u.id = cp.user_id
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND ds.date >= '2025-10-01'  -- Show last 2 weeks
ORDER BY u.username, ds.date DESC;

-- ============================================================================
-- STEP 3: Calculate what EVERY user's total SHOULD be
-- ============================================================================
WITH comp_info AS (
    SELECT start_date, end_date
    FROM competitions
    WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
),
calculated_totals AS (
    SELECT
        ds.user_id,
        COUNT(*) as days_with_scores,
        SUM(
            ROUND(
                (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                 COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                 COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                1
            )
        ) as calculated_total,
        MIN(ds.date) as first_date,
        MAX(ds.date) as last_date
    FROM daily_scores ds
    CROSS JOIN comp_info ci
    WHERE ds.date >= ci.start_date
      AND ds.date <= ci.end_date
      AND ds.date <= CURRENT_DATE
      AND ds.completed_at IS NOT NULL
      AND ds.user_id IN (
          SELECT user_id
          FROM competition_participants
          WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
      )
    GROUP BY ds.user_id
)
SELECT
    'CORRECT TOTALS VS CURRENT STORED' as section,
    u.username,
    ct.calculated_total as should_be,
    cp.total_score as currently_stored,
    (ct.calculated_total - COALESCE(cp.total_score, 0)) as difference,
    ct.days_with_scores as days_should_be,
    cp.days_played as days_currently_stored,
    ct.first_date,
    ct.last_date,
    CASE
        WHEN ABS(ct.calculated_total - COALESCE(cp.total_score, 0)) > 0.1 THEN '❌ MISMATCH'
        ELSE '✅ Correct'
    END as status
FROM calculated_totals ct
LEFT JOIN competition_participants cp
    ON cp.user_id = ct.user_id
    AND cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
LEFT JOIN users u ON u.id = ct.user_id
ORDER BY ct.calculated_total DESC;

-- ============================================================================
-- STEP 4: Focus on the two problem users
-- ============================================================================
SELECT
    'DETAILED BREAKDOWN - Problem Users' as section,
    u.username,
    ds.user_id,
    ds.date,
    ds.completed_at,
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
FROM daily_scores ds
JOIN users u ON u.id = ds.user_id
WHERE ds.user_id IN (
    '2ad9c311-deeb-4108-9c43-2be074fc6c2d'::uuid,
    '5801f70d-70fc-43df-b956-4bb154292289'::uuid
)
AND ds.date >= '2025-10-01'
ORDER BY ds.user_id, ds.date DESC;
