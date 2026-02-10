-- Debug queries to check why backfill didn't work

-- 1. Check if the tracking table has any entries (did function run at all?)
SELECT COUNT(*) as tracking_entries FROM competition_daily_tracking;

-- 2. First, check what columns daily_scores actually has
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'daily_scores'
ORDER BY ordinal_position;

-- 2b. Check if the user has daily_scores for today (we'll adjust this based on columns found)
-- SELECT * FROM daily_scores WHERE date = CURRENT_DATE;

-- 3. Check competition_participants columns (verify schema)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'competition_participants'
ORDER BY ordinal_position;

-- 4. Check if daily_scores table exists and has correct columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'daily_scores'
ORDER BY ordinal_position;

-- 5. Test the function manually (replace with actual IDs)
-- SELECT * FROM backfill_competition_scores_on_join(
--     'COMPETITION_ID_HERE'::uuid,
--     'USER_ID_HERE'::uuid
-- );
