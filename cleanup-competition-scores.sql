-- ============================================================================
-- CLEANUP SCRIPT: Fix Duplicate Scores in Competitions
-- For competitions: 60c2e42d-6d1a-445e-bd34-b3c460c175ab
--                   e5039157-0386-4ec5-af58-9ff8fc2f3b61
-- ============================================================================

-- STEP 1: Show current state BEFORE cleanup
SELECT
    'BEFORE CLEANUP' as status,
    cp.competition_id,
    c.name as competition_name,
    cp.user_id,
    u.username,
    cp.total_score,
    cp.days_played,
    cp.average_score
FROM competition_participants cp
JOIN competitions c ON c.id = cp.competition_id
JOIN users u ON u.id = cp.user_id
WHERE cp.competition_id IN (
    '60c2e42d-6d1a-445e-bd34-b3c460c175ab',
    'e5039157-0386-4ec5-af58-9ff8fc2f3b61'
)
ORDER BY c.name, cp.total_score DESC;


-- STEP 2: Rebuild competition_daily_tracking from daily_scores
-- This will be the single source of truth
DO $$
DECLARE
    v_comp_id UUID;
    v_comp_start DATE;
    v_comp_end DATE;
    v_user_id UUID;
    v_date DATE;
    v_daily_score NUMERIC;
    v_count INTEGER := 0;
BEGIN
    -- For each competition that needs fixing
    FOR v_comp_id, v_comp_start, v_comp_end IN
        SELECT id, start_date, end_date
        FROM competitions
        WHERE id IN (
            '60c2e42d-6d1a-445e-bd34-b3c460c175ab',
            'e5039157-0386-4ec5-af58-9ff8fc2f3b61'
        )
    LOOP
        RAISE NOTICE 'Cleaning competition: %', v_comp_id;

        -- Clear existing daily tracking for this competition
        DELETE FROM competition_daily_tracking
        WHERE competition_id = v_comp_id;

        RAISE NOTICE 'Cleared existing daily tracking';

        -- Get all participants in this competition
        FOR v_user_id IN
            SELECT DISTINCT user_id
            FROM competition_participants
            WHERE competition_id = v_comp_id
        LOOP
            -- For each participant, find their daily scores within competition dates
            FOR v_date, v_daily_score IN
                SELECT
                    ds.date,
                    -- Calculate daily average: average of ALL 6 attempts
                    ROUND(
                        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                        1
                    )::NUMERIC(4,1) as daily_score
                FROM daily_scores ds
                WHERE ds.user_id = v_user_id
                  AND ds.date >= v_comp_start
                  AND ds.date <= v_comp_end
                  AND ds.completed_at IS NOT NULL
                  -- Only include days where at least one attempt has a score
                  AND (ds.shape1_attempt1 IS NOT NULL OR ds.shape1_attempt2 IS NOT NULL OR
                       ds.shape2_attempt1 IS NOT NULL OR ds.shape2_attempt2 IS NOT NULL OR
                       ds.shape3_attempt1 IS NOT NULL OR ds.shape3_attempt2 IS NOT NULL)
                ORDER BY ds.date ASC
            LOOP
                -- Insert into daily tracking (one record per date)
                INSERT INTO competition_daily_tracking (
                    competition_id,
                    user_id,
                    date,
                    daily_score,
                    created_at
                ) VALUES (
                    v_comp_id,
                    v_user_id,
                    v_date,
                    v_daily_score,
                    NOW()
                )
                ON CONFLICT (competition_id, user_id, date) DO NOTHING;

                v_count := v_count + 1;
            END LOOP;
        END LOOP;

        RAISE NOTICE 'Rebuilt % daily score records', v_count;
        v_count := 0;
    END LOOP;
END $$;


-- STEP 3: Recalculate all participant totals from daily_tracking
UPDATE competition_participants cp
SET
    total_score = daily_totals.total,
    days_played = daily_totals.days,
    average_score = ROUND(daily_totals.total / NULLIF(daily_totals.days, 0), 1),
    last_score_update = NOW()
FROM (
    SELECT
        competition_id,
        user_id,
        COALESCE(SUM(daily_score), 0) as total,
        COUNT(*) as days
    FROM competition_daily_tracking
    WHERE competition_id IN (
        '60c2e42d-6d1a-445e-bd34-b3c460c175ab',
        'e5039157-0386-4ec5-af58-9ff8fc2f3b61'
    )
    GROUP BY competition_id, user_id
) daily_totals
WHERE cp.competition_id = daily_totals.competition_id
  AND cp.user_id = daily_totals.user_id;


-- STEP 4: Show AFTER cleanup state
SELECT
    'AFTER CLEANUP' as status,
    cp.competition_id,
    c.name as competition_name,
    cp.user_id,
    u.username,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    (SELECT COUNT(*) FROM competition_daily_tracking cdt
     WHERE cdt.competition_id = cp.competition_id
     AND cdt.user_id = cp.user_id) as daily_records_count
FROM competition_participants cp
JOIN competitions c ON c.id = cp.competition_id
JOIN users u ON u.id = cp.user_id
WHERE cp.competition_id IN (
    '60c2e42d-6d1a-445e-bd34-b3c460c175ab',
    'e5039157-0386-4ec5-af58-9ff8fc2f3b61'
)
ORDER BY c.name, cp.total_score DESC;


-- STEP 5: Show detailed daily scores for verification
SELECT
    'DAILY BREAKDOWN' as status,
    c.name as competition_name,
    u.username,
    cdt.date,
    cdt.daily_score
FROM competition_daily_tracking cdt
JOIN competitions c ON c.id = cdt.competition_id
JOIN users u ON u.id = cdt.user_id
WHERE cdt.competition_id IN (
    '60c2e42d-6d1a-445e-bd34-b3c460c175ab',
    'e5039157-0386-4ec5-af58-9ff8fc2f3b61'
)
ORDER BY c.name, u.username, cdt.date;
