-- Check the actual scores in daily_scores for player b306be71-3ca5-464d-a76e-943dd326a569

SELECT
    date,
    shape1_attempt1,
    shape1_attempt2,
    shape2_attempt1,
    shape2_attempt2,
    shape3_attempt1,
    shape3_attempt2,
    daily_average,
    -- Calculate what it SHOULD be (additive with bonuses)
    COALESCE(shape1_attempt1, 0) + COALESCE(shape1_attempt2, 0) +
    COALESCE(shape2_attempt1, 0) + COALESCE(shape2_attempt2, 0) +
    COALESCE(shape3_attempt1, 0) + COALESCE(shape3_attempt2, 0) +
    -- Add +50 for each perfect cut
    CASE WHEN shape1_attempt1 = 50 THEN 50 ELSE 0 END +
    CASE WHEN shape1_attempt2 = 50 THEN 50 ELSE 0 END +
    CASE WHEN shape2_attempt1 = 50 THEN 50 ELSE 0 END +
    CASE WHEN shape2_attempt2 = 50 THEN 50 ELSE 0 END +
    CASE WHEN shape3_attempt1 = 50 THEN 50 ELSE 0 END +
    CASE WHEN shape3_attempt2 = 50 THEN 50 ELSE 0 END as correct_additive_score
FROM daily_scores
WHERE user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'
  AND date = '2025-11-17';
