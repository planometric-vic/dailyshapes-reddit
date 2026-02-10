-- Run each query ONE AT A TIME and share the results

-- ============================================
-- QUERY 1: Competition Details
-- ============================================
SELECT
    id,
    name,
    start_date,
    end_date,
    is_active,
    CURRENT_DATE as today
FROM competitions
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- ============================================
-- QUERY 2: Player in Competition?
-- ============================================
SELECT
    user_id,
    competition_id,
    joined_at,
    total_score,
    days_played,
    average_score
FROM competition_participants
WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid;

-- ============================================
-- QUERY 3: Player's Daily Scores (Recent)
-- ============================================
SELECT
    user_id,
    date,
    completed_at,
    shape1_attempt1,
    shape2_attempt1,
    shape3_attempt1
FROM daily_scores
WHERE user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- ============================================
-- QUERY 4: Already Tracked?
-- ============================================
SELECT
    date,
    daily_score,
    created_at
FROM competition_daily_tracking
WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid;

-- ============================================
-- QUERY 5: Check table structure
-- ============================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_scores'
  AND column_name LIKE '%attempt%' OR column_name = 'completed_at'
ORDER BY ordinal_position;
