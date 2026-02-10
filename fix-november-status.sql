-- Fix the November competition status to 'active'
UPDATE competitions
SET status = 'active'
WHERE id = '7f0dc3a1-670b-4f94-8ab1-16818026ee4c';

-- Verify
SELECT id, name, status, is_active, start_date, end_date
FROM competitions
WHERE is_global = true;
