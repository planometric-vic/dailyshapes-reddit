-- ============================================================================
-- Add UNIQUE constraint to competition_daily_tracking
-- Prevents duplicate scores for the same user/competition/date
-- ============================================================================

-- Add unique constraint if it doesn't already exist
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'competition_daily_tracking_unique_user_comp_date'
    ) THEN
        -- Add the unique constraint
        ALTER TABLE competition_daily_tracking
        ADD CONSTRAINT competition_daily_tracking_unique_user_comp_date
        UNIQUE (competition_id, user_id, date);

        RAISE NOTICE 'Added unique constraint to competition_daily_tracking';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- Verify the constraint was added
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'competition_daily_tracking'::regclass
  AND conname = 'competition_daily_tracking_unique_user_comp_date';
