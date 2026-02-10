-- Migration to support auto-generated global monthly competitions
-- Run this in your Supabase SQL Editor
--
-- IMPORTANT: This enables client-side creation of global competitions
-- based on each user's LOCAL timezone. When the first user in any timezone
-- enters a new month (at 00:00 local time), the competition for that month
-- will be created automatically.

-- Step 1: Make creator_id nullable for system-created global competitions
ALTER TABLE competitions
ALTER COLUMN creator_id DROP NOT NULL;

-- Step 2: Make creator_timezone nullable (not needed for global competitions)
ALTER TABLE competitions
ALTER COLUMN creator_timezone DROP NOT NULL;

-- Step 3: Create November 2025 Global Competition
-- (Change the year/month as needed)
INSERT INTO competitions (
    name,
    description,
    creator_id,
    creator_timezone,
    start_date,
    end_date,
    is_global,
    is_public,
    invite_code,
    is_active,
    scoring_type,
    min_days_required
) VALUES (
    'NOVEMBER GLOBAL',
    'Monthly global competition for all Daily Shapes players',
    NULL,
    'UTC',
    '2025-11-01',
    '2025-11-30',
    true,
    true,
    NULL,
    true,
    'total',
    1
) ON CONFLICT DO NOTHING;

-- Step 4: Verify the competition was created
SELECT
    id,
    name,
    start_date,
    end_date,
    is_global,
    is_active
FROM competitions
WHERE is_global = true
ORDER BY start_date DESC
LIMIT 5;

-- Step 5: Create a function to auto-create monthly global competitions
-- This will run automatically on the 1st of each month
CREATE OR REPLACE FUNCTION create_monthly_global_competition()
RETURNS void AS $$
DECLARE
    current_month_name TEXT;
    competition_name TEXT;
    start_of_month DATE;
    end_of_month DATE;
    existing_comp UUID;
BEGIN
    -- Get current month info
    start_of_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    end_of_month := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Get month name
    current_month_name := UPPER(TO_CHAR(CURRENT_DATE, 'Month'));
    current_month_name := TRIM(current_month_name);
    competition_name := current_month_name || ' GLOBAL';

    -- Check if competition already exists for this month
    SELECT id INTO existing_comp
    FROM competitions
    WHERE is_global = true
      AND start_date = start_of_month
    LIMIT 1;

    -- Only create if doesn't exist
    IF existing_comp IS NULL THEN
        INSERT INTO competitions (
            name,
            description,
            creator_id,
            creator_timezone,
            start_date,
            end_date,
            is_global,
            is_public,
            is_active,
            scoring_type,
            min_days_required
        ) VALUES (
            competition_name,
            'Monthly global competition for all Daily Shapes players',
            NULL,
            'UTC',
            start_of_month,
            end_of_month,
            true,
            true,
            true,
            'total',
            1
        );

        RAISE NOTICE 'Created global competition: %', competition_name;
    ELSE
        RAISE NOTICE 'Global competition already exists for this month: %', competition_name;
    END IF;

    -- Deactivate old global competitions
    UPDATE competitions
    SET is_active = false
    WHERE is_global = true
      AND end_date < start_of_month
      AND is_active = true;

    RAISE NOTICE 'Deactivated old global competitions';
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create the competition for the current month
SELECT create_monthly_global_competition();

-- Step 7: Set up a scheduled job (optional - requires pg_cron extension)
-- Uncomment the following if you have pg_cron enabled:
-- SELECT cron.schedule(
--     'create-monthly-competition',
--     '0 0 1 * *',  -- Run at midnight on the 1st of every month
--     $$SELECT create_monthly_global_competition()$$
-- );
