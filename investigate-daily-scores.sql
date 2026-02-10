-- Investigate what's actually in the daily_scores table

-- 1. Check raw data for the test date
SELECT 
    '=== RAW DAILY SCORES DATA ===' as section;

SELECT 
    u.username,
    ds.date,
    ds.shape1_attempt1 as s1a1,
    ds.shape1_attempt2 as s1a2,
    ds.shape2_attempt1 as s2a1,
    ds.shape2_attempt2 as s2a2,
    ds.shape3_attempt1 as s3a1,
    ds.shape3_attempt2 as s3a2
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE ds.date >= '2025-08-29' AND ds.date <= '2025-08-31'
ORDER BY u.username, ds.date;

-- 2. Check if there's ANY data for 2025-08-30
SELECT 
    '=== COUNT OF RECORDS PER DATE ===' as section;

SELECT 
    date,
    COUNT(*) as num_records,
    array_agg(DISTINCT u.username) as users_who_played
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE ds.date >= '2025-08-25' AND ds.date <= '2025-09-05'
GROUP BY date
ORDER BY date;

-- 3. Check all daily_scores for these users
SELECT 
    '=== ALL SCORES FOR COMPETITION USERS ===' as section;

SELECT 
    u.username,
    ds.date,
    ROUND((
        GREATEST(ds.shape1_attempt1, COALESCE(ds.shape1_attempt2, 0)) + 
        GREATEST(ds.shape2_attempt1, COALESCE(ds.shape2_attempt2, 0)) + 
        GREATEST(ds.shape3_attempt1, COALESCE(ds.shape3_attempt2, 0))
    ) / 3.0, 1) as calculated_average,
    array_length(ds.competitions_participated, 1) as num_competitions
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
ORDER BY u.username, ds.date DESC
LIMIT 20;

-- 4. Look at the competition_participants table directly
SELECT 
    '=== COMPETITION PARTICIPANTS RAW DATA ===' as section;

SELECT 
    u.username,
    c.name as competition,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.best_day_score,
    c.start_date,
    c.end_date
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
ORDER BY u.username, c.name;

-- 5. See what dates have been played for these competitions
SELECT 
    '=== DATES WITH SCORES IN COMPETITION RANGE ===' as section;

SELECT DISTINCT
    u.username,
    c.name as competition,
    ds.date,
    c.start_date,
    c.end_date,
    CASE 
        WHEN ds.date >= c.start_date AND ds.date <= c.end_date THEN 'IN RANGE'
        ELSE 'OUT OF RANGE'
    END as date_status
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
LEFT JOIN daily_scores ds ON ds.user_id = cp.user_id
    AND c.id = ANY(ds.competitions_participated)
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
    AND ds.date IS NOT NULL
ORDER BY u.username, c.name, ds.date;