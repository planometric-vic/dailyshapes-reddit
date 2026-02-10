-- ============================================================================
-- DIAGNOSTIC: Check why today's score isn't adding to competition totals
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Check your daily scores table (replace with your user_id)
SELECT
    'DAILY SCORES' as section,
    date,
    daily_average as score,
    completed_at
FROM daily_scores
WHERE user_id = 'YOUR_USER_ID_HERE'  -- REPLACE THIS
  AND date >= '2025-11-17'
ORDER BY date DESC;

-- Step 2: Check competition daily tracking (replace with your user_id)
SELECT
    'COMPETITION DAILY TRACKING' as section,
    cdt.competition_id,
    c.name as competition_name,
    cdt.date,
    cdt.daily_score,
    cdt.created_at
FROM competition_daily_tracking cdt
JOIN competitions c ON c.id = cdt.competition_id
WHERE cdt.user_id = 'YOUR_USER_ID_HERE'  -- REPLACE THIS
  AND cdt.date >= '2025-11-17'
ORDER BY cdt.date DESC, c.name;

-- Step 3: Check competition participants totals (replace with your user_id)
SELECT
    'COMPETITION TOTALS' as section,
    c.name as competition_name,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    cp.last_score_update
FROM competition_participants cp
JOIN competitions c ON c.id = cp.competition_id
WHERE cp.user_id = 'YOUR_USER_ID_HERE'  -- REPLACE THIS
ORDER BY c.name;

-- Step 4: Calculate what the totals SHOULD be (replace with your user_id)
SELECT
    'EXPECTED TOTALS' as section,
    cdt.competition_id,
    c.name as competition_name,
    SUM(cdt.daily_score) as expected_total_score,
    COUNT(*) as expected_days_played,
    cp.total_score as actual_total_score,
    cp.days_played as actual_days_played,
    SUM(cdt.daily_score) - cp.total_score as score_difference
FROM competition_daily_tracking cdt
JOIN competitions c ON c.id = cdt.competition_id
JOIN competition_participants cp ON cp.competition_id = cdt.competition_id AND cp.user_id = cdt.user_id
WHERE cdt.user_id = 'YOUR_USER_ID_HERE'  -- REPLACE THIS
GROUP BY cdt.competition_id, c.name, cp.total_score, cp.days_played
ORDER BY c.name;
