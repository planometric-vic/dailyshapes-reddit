-- FIXED Migration for Global Monthly Competitions
-- Run this in your Supabase SQL Editor

-- Step 1: Make creator_id nullable for system-created global competitions
ALTER TABLE competitions
ALTER COLUMN creator_id DROP NOT NULL;

-- Step 2: Create November 2025 Global Competition
INSERT INTO competitions (
    name,
    description,
    creator_id,
    start_date,
    end_date,
    is_global,
    is_public,
    is_active,
    scoring_type,
    min_days_required
) VALUES (
    'NOVEMBER GLOBAL',
    'Monthly global competition for all Daily Shapes players',
    NULL,
    '2025-11-01',
    '2025-11-30',
    true,
    true,
    true,
    'total',
    1
) ON CONFLICT DO NOTHING;

-- Step 3: Verify the competition was created
SELECT
    id,
    name,
    start_date,
    end_date,
    is_global,
    is_active,
    creator_id
FROM competitions
WHERE is_global = true
ORDER BY start_date DESC
LIMIT 5;
