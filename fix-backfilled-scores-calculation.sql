-- Fix Backfilled Competition Scores - Correct Calculation
-- This script recalculates all backfilled scores using the correct formula:
-- Average of ALL 6 attempts (not average of best attempts per shape)

-- Step 1: Show current incorrect scores
SELECT
    '=== CURRENT BACKFILLED SCORES (INCORRECT) ===' as section;

SELECT
    u.username,
    c.name as competition_name,
    cdt.date,
    cdt.daily_score as incorrect_score,
    -- Calculate what it SHOULD be
    ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1) as correct_score,
    -- Show the difference
    ROUND(
        cdt.daily_score - (
            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0
        ),
        1
    ) as difference
FROM competition_daily_tracking cdt
JOIN users u ON cdt.user_id = u.id
JOIN competitions c ON cdt.competition_id = c.id
JOIN daily_scores ds ON ds.user_id = cdt.user_id AND ds.date = cdt.date
ORDER BY u.username, cdt.date;

-- Step 2: Update competition_daily_tracking with correct scores
BEGIN;

UPDATE competition_daily_tracking cdt
SET daily_score = (
    SELECT ROUND(
        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
        1
    )::NUMERIC(4,1)
    FROM daily_scores ds
    WHERE ds.user_id = cdt.user_id
      AND ds.date = cdt.date
)
WHERE EXISTS (
    SELECT 1 FROM daily_scores ds
    WHERE ds.user_id = cdt.user_id
      AND ds.date = cdt.date
);

-- Step 3: Recalculate competition_participants totals from corrected daily scores
UPDATE competition_participants cp
SET
    total_score = (
        SELECT COALESCE(SUM(daily_score), 0)
        FROM competition_daily_tracking cdt
        WHERE cdt.competition_id = cp.competition_id
          AND cdt.user_id = cp.user_id
    ),
    days_played = (
        SELECT COUNT(DISTINCT date)
        FROM competition_daily_tracking cdt
        WHERE cdt.competition_id = cp.competition_id
          AND cdt.user_id = cp.user_id
    ),
    best_day_score = (
        SELECT MAX(daily_score)
        FROM competition_daily_tracking cdt
        WHERE cdt.competition_id = cp.competition_id
          AND cdt.user_id = cp.user_id
    ),
    average_score = (
        SELECT ROUND(AVG(daily_score), 1)
        FROM competition_daily_tracking cdt
        WHERE cdt.competition_id = cp.competition_id
          AND cdt.user_id = cp.user_id
    ),
    last_score_update = NOW()
WHERE EXISTS (
    SELECT 1 FROM competition_daily_tracking cdt
    WHERE cdt.competition_id = cp.competition_id
      AND cdt.user_id = cp.user_id
);

COMMIT;

-- Step 4: Show corrected scores
SELECT
    '=== CORRECTED BACKFILLED SCORES ===' as section;

SELECT
    u.username,
    c.name as competition_name,
    cdt.date,
    cdt.daily_score as corrected_score
FROM competition_daily_tracking cdt
JOIN users u ON cdt.user_id = u.id
JOIN competitions c ON cdt.competition_id = c.id
ORDER BY u.username, cdt.date;

-- Step 5: Show updated competition participant totals
SELECT
    '=== UPDATED COMPETITION TOTALS ===' as section;

SELECT
    u.username,
    c.name as competition_name,
    cp.days_played,
    ROUND(cp.total_score, 1) as total_score,
    ROUND(cp.average_score, 1) as average_score,
    ROUND(cp.best_day_score, 1) as best_day_score
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
WHERE cp.days_played > 0
ORDER BY c.competition_name, cp.total_score DESC;

-- Step 6: Update competition rankings
DO $$
DECLARE
    comp_record RECORD;
BEGIN
    FOR comp_record IN
        SELECT DISTINCT competition_id
        FROM competition_participants
        WHERE days_played > 0
    LOOP
        RAISE NOTICE 'Updating rankings for competition: %', comp_record.competition_id;
        PERFORM update_competition_rankings(comp_record.competition_id);
    END LOOP;
END $$;

SELECT '=== FIX COMPLETE ===' as section;
