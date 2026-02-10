-- MINIMAL Migration - Only uses guaranteed columns
-- Run this in your Supabase SQL Editor

-- Step 1: Make creator_id nullable
ALTER TABLE competitions
ALTER COLUMN creator_id DROP NOT NULL;

-- Step 2: Create November 2025 Global Competition (minimal fields only)
INSERT INTO competitions (
    name,
    description,
    creator_id,
    start_date,
    end_date,
    is_global,
    is_public,
    is_active
) VALUES (
    'NOVEMBER GLOBAL',
    'Monthly global competition for all Daily Shapes players',
    NULL,
    '2025-11-01',
    '2025-11-30',
    true,
    true,
    true
);

-- Step 3: Verify it was created
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
ORDER BY start_date DESC;
