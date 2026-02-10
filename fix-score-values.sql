-- Fix the inflated score values
-- The scores should be ~80-90 for one day, not 400-500+

-- First, let's see what the actual daily scores should be
SELECT 
    '=== ACTUAL DAILY SCORES FROM RAW DATA ===' as section;

SELECT 
    u.username,
    ds.date,
    GREATEST(ds.shape1_attempt1, ds.shape1_attempt2) as shape1_best,
    GREATEST(ds.shape2_attempt1, ds.shape2_attempt2) as shape2_best,
    GREATEST(ds.shape3_attempt1, ds.shape3_attempt2) as shape3_best,
    ROUND((
        GREATEST(ds.shape1_attempt1, ds.shape1_attempt2) + 
        GREATEST(ds.shape2_attempt1, ds.shape2_attempt2) + 
        GREATEST(ds.shape3_attempt1, ds.shape3_attempt2)
    ) / 3.0, 1) as correct_daily_average
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE ds.date = '2025-08-30'
ORDER BY u.username;

-- Now fix the competition scores to use the correct calculation
BEGIN;

UPDATE competition_participants cp
SET 
    total_score = ROUND(subq.correct_score, 1),
    average_score = ROUND(subq.correct_score, 1),
    best_day_score = ROUND(subq.correct_score, 1)
FROM (
    SELECT 
        cp2.competition_id,
        cp2.user_id,
        (
            SELECT 
                (GREATEST(ds.shape1_attempt1, ds.shape1_attempt2) + 
                 GREATEST(ds.shape2_attempt1, ds.shape2_attempt2) + 
                 GREATEST(ds.shape3_attempt1, ds.shape3_attempt2)) / 3.0
            FROM daily_scores ds
            WHERE ds.user_id = cp2.user_id
                AND ds.date = '2025-08-30'
                AND cp2.competition_id = ANY(ds.competitions_participated)
            LIMIT 1
        ) as correct_score
    FROM competition_participants cp2
    WHERE cp2.days_played > 0
) subq
WHERE cp.competition_id = subq.competition_id 
    AND cp.user_id = subq.user_id
    AND subq.correct_score IS NOT NULL;

COMMIT;

-- Show the corrected results
SELECT 
    '=== FINAL CORRECTED SCORES ===' as section;

SELECT 
    u.username,
    cp.days_played as days,
    ROUND(cp.total_score, 1) as score,
    ROUND(cp.average_score, 1) as avg,
    c.name as competition
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
WHERE cp.days_played > 0
ORDER BY c.name, cp.total_score DESC;

-- Update rankings with correct scores
DO $$
DECLARE
    comp_record RECORD;
BEGIN
    FOR comp_record IN 
        SELECT DISTINCT competition_id 
        FROM competition_participants 
        WHERE days_played > 0
    LOOP
        PERFORM update_competition_rankings(comp_record.competition_id);
    END LOOP;
END $$;

-- Verify the fix worked
SELECT 
    '=== VERIFICATION ===' as section;

SELECT 
    'Expected scores should be around 80-90 for one day, not 400-500+' as note;

SELECT 
    u.username,
    COUNT(DISTINCT c.id) as num_competitions,
    ROUND(AVG(cp.total_score), 1) as avg_score_across_comps,
    CASE 
        WHEN AVG(cp.total_score) < 150 THEN '✅ FIXED'
        ELSE '❌ STILL BROKEN'
    END as status
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
WHERE cp.days_played > 0
GROUP BY u.username
ORDER BY u.username;