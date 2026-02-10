-- Check who played today but their scores are missing from competition_daily_tracking

-- Users who played today (have daily_scores for 2025-11-18)
SELECT
    'USERS WHO PLAYED TODAY' as section,
    ds.user_id,
    up.username,
    ds.date,
    ds.daily_average as score
FROM daily_scores ds
LEFT JOIN user_profiles up ON up.id = ds.user_id
WHERE ds.date = '2025-11-18'
ORDER BY ds.user_id;

-- Competition participants who played today BUT score is missing from competition_daily_tracking
SELECT
    'MISSING SCORES IN COMPETITIONS' as section,
    cp.competition_id,
    c.name as competition_name,
    ds.user_id,
    up.username,
    ds.date,
    ds.daily_average as their_score_today,
    cp.total_score as current_competition_total
FROM competition_participants cp
JOIN competitions c ON c.id = cp.competition_id
JOIN daily_scores ds ON ds.user_id = cp.user_id
LEFT JOIN user_profiles up ON up.id = ds.user_id
LEFT JOIN competition_daily_tracking cdt ON
    cdt.competition_id = cp.competition_id
    AND cdt.user_id = ds.user_id
    AND cdt.date = ds.date
WHERE ds.date = '2025-11-18'
  AND c.is_active = true
  AND ds.date >= c.start_date
  AND ds.date <= c.end_date
  AND cdt.id IS NULL  -- Score is MISSING from competition_daily_tracking
ORDER BY c.name, up.username;

-- Summary count
SELECT
    'SUMMARY' as section,
    COUNT(DISTINCT ds.user_id) as users_who_played_today,
    COUNT(*) as missing_competition_scores
FROM competition_participants cp
JOIN competitions c ON c.id = cp.competition_id
JOIN daily_scores ds ON ds.user_id = cp.user_id
LEFT JOIN competition_daily_tracking cdt ON
    cdt.competition_id = cp.competition_id
    AND cdt.user_id = ds.user_id
    AND cdt.date = ds.date
WHERE ds.date = '2025-11-18'
  AND c.is_active = true
  AND ds.date >= c.start_date
  AND ds.date <= c.end_date
  AND cdt.id IS NULL;
