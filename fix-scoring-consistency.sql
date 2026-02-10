-- Fix Scoring Consistency Across Daily Shapes Application
-- This script standardizes all scoring to use "Average of Best Attempts" method

-- 1. DROP the existing trigger that uses inconsistent scoring
DROP TRIGGER IF EXISTS calculate_averages_trigger ON daily_scores;

-- 2. Create a NEW trigger function that uses STANDARD scoring (best attempts only)
CREATE OR REPLACE FUNCTION calculate_standard_score_averages()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate BEST attempt per shape (not average of both attempts)
    NEW.shape1_average := GREATEST(COALESCE(NEW.shape1_attempt1, 0), COALESCE(NEW.shape1_attempt2, 0));
    NEW.shape2_average := GREATEST(COALESCE(NEW.shape2_attempt1, 0), COALESCE(NEW.shape2_attempt2, 0));  
    NEW.shape3_average := GREATEST(COALESCE(NEW.shape3_attempt1, 0), COALESCE(NEW.shape3_attempt2, 0));
    
    -- Calculate daily average using BEST attempts only (STANDARD method)
    NEW.daily_average := ROUND((COALESCE(NEW.shape1_average, 0) + COALESCE(NEW.shape2_average, 0) + 
                         COALESCE(NEW.shape3_average, 0)) / 
                         NULLIF(CASE WHEN NEW.shape1_average > 0 THEN 1 ELSE 0 END + 
                                CASE WHEN NEW.shape2_average > 0 THEN 1 ELSE 0 END + 
                                CASE WHEN NEW.shape3_average > 0 THEN 1 ELSE 0 END, 0), 1);
    
    -- Ensure accuracy_score matches daily_average for consistency
    NEW.accuracy_score := NEW.daily_average;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the new STANDARD trigger
CREATE TRIGGER calculate_standard_averages_trigger
    BEFORE INSERT OR UPDATE ON daily_scores
    FOR EACH ROW
    EXECUTE FUNCTION calculate_standard_score_averages();

-- 4. Update existing records to use consistent scoring
-- WARNING: This will recalculate all historical scores using the STANDARD method
UPDATE daily_scores 
SET 
    shape1_average = GREATEST(COALESCE(shape1_attempt1, 0), COALESCE(shape1_attempt2, 0)),
    shape2_average = GREATEST(COALESCE(shape2_attempt1, 0), COALESCE(shape2_attempt2, 0)),
    shape3_average = GREATEST(COALESCE(shape3_attempt1, 0), COALESCE(shape3_attempt2, 0));

-- Recalculate daily averages using STANDARD method
UPDATE daily_scores 
SET 
    daily_average = ROUND((COALESCE(shape1_average, 0) + COALESCE(shape2_average, 0) + COALESCE(shape3_average, 0)) / 
                    NULLIF(CASE WHEN shape1_average > 0 THEN 1 ELSE 0 END + 
                           CASE WHEN shape2_average > 0 THEN 1 ELSE 0 END + 
                           CASE WHEN shape3_average > 0 THEN 1 ELSE 0 END, 0), 1),
    accuracy_score = ROUND((COALESCE(shape1_average, 0) + COALESCE(shape2_average, 0) + COALESCE(shape3_average, 0)) / 
                     NULLIF(CASE WHEN shape1_average > 0 THEN 1 ELSE 0 END + 
                            CASE WHEN shape2_average > 0 THEN 1 ELSE 0 END + 
                            CASE WHEN shape3_average > 0 THEN 1 ELSE 0 END, 0), 1);

-- 5. Recalculate user profile scores using STANDARD method
-- This will make user profile scores match competition scores
UPDATE users 
SET 
    total_score = (
        SELECT COALESCE(SUM(daily_average), 0)
        FROM daily_scores 
        WHERE daily_scores.user_id = users.id
    ),
    average_score = (
        SELECT COALESCE(AVG(daily_average), 0)
        FROM daily_scores 
        WHERE daily_scores.user_id = users.id
    )
WHERE id IN (SELECT DISTINCT user_id FROM daily_scores);

-- 6. Show the results
SELECT 
    'SCORING CONSISTENCY FIX COMPLETED' as status,
    COUNT(*) as updated_daily_scores
FROM daily_scores;

SELECT 
    'USER PROFILES UPDATED' as status,
    COUNT(*) as updated_users  
FROM users 
WHERE total_score > 0;

-- Verification query - check that scores are now consistent
SELECT 
    u.username,
    u.average_score as user_profile_avg,
    ds.accuracy_score as competition_score,
    ds.daily_average as daily_score,
    CASE 
        WHEN u.average_score = ds.accuracy_score AND ds.accuracy_score = ds.daily_average 
        THEN '✅ CONSISTENT' 
        ELSE '❌ INCONSISTENT' 
    END as consistency_check
FROM users u
JOIN daily_scores ds ON u.id = ds.user_id
WHERE ds.date = (SELECT MAX(date) FROM daily_scores WHERE user_id = u.id)
LIMIT 10;