# Fix User b306be71 Score Issue

## Problem Summary

User `b306be71-3ca5-464d-a76e-943dd326a569` in competition `6b68e958-f2ec-4bfd-842d-dd5169446fbe` has a `total_score` of **97.0**, which appears to be only a single day's score instead of the cumulative total of all days played.

## Root Cause

There are **two different versions** of the `submit_to_custom_competition` database function:

### Version 1: custom-competition-functions.sql (CORRECT)
```sql
ON CONFLICT (competition_id, user_id)
DO UPDATE SET
    total_score = competition_participants.total_score + p_daily_score,  -- ✅ ADDS
```

### Version 2: supabase-migration-fix-score-accumulation.sql (FIXED)
```sql
UPDATE competition_participants
SET
    total_score = COALESCE(total_score, 0) + p_daily_score,  -- ✅ ADDS (after our fix)
    days_played = COALESCE(days_played, 0) + 1,
```

### Possible Old Buggy Version (NOT FIXED)
If there was an older version in Supabase before our fixes:
```sql
UPDATE competition_participants
SET
    total_score = p_daily_score,  -- ❌ REPLACES instead of ADDS!
    days_completed = days_completed + 1,  -- ❌ Wrong column name
```

This would:
1. **REPLACE** the total_score with the new score (not add to it)
2. Fail with "column days_completed does not exist" error
3. Cause scores to only reflect the most recent day

## Diagnosis Steps

1. Open: `http://192.168.0.161:5500/investigate-user-scores.html`
2. This will automatically analyze user b306be71's scores
3. Check the output for:
   - **Total in database** vs **Calculated total from daily scores**
   - **Days played (stored)** vs **Days with scores**
   - **MISMATCH DETECTED** warning

## Expected Findings

If the bug occurred, you'll see:
- **Stored total**: 97.0
- **Calculated total**: [Sum of all daily scores - likely much higher]
- **Diagnosis**: "Only last day's score was recorded!"

## Fix Steps

### Step 1: Apply the Correct SQL Migration

**You must run BOTH SQL migrations in Supabase:**

#### A. First, apply the corrected function:
1. Go to Supabase Dashboard → SQL Editor
2. Copy `/sandbox/Daily_Shapes_v4.1/supabase-migration-fix-score-accumulation.sql`
3. Paste and run in SQL Editor
4. Verify: "Success. No rows returned"

#### B. Second, verify the INSERT ... ON CONFLICT version:
1. Go to Supabase Dashboard → SQL Editor
2. Copy `/sandbox/Daily_Shapes_v4.1/custom-competition-functions.sql`
3. Find the `submit_to_custom_competition` function (lines 89-122)
4. Paste and run ONLY that function
5. Verify: "Success. No rows returned"

**IMPORTANT**: The two files define the same function slightly differently. The `custom-competition-functions.sql` version uses `INSERT ... ON CONFLICT` which is more atomic and safer. I recommend using that version.

### Step 2: Recalculate User b306be71's Score

Once the function is fixed, we need to recalculate this user's actual total score from their daily scores.

**Option A: Manual Recalculation (Immediate Fix)**

Run this SQL in Supabase SQL Editor:

```sql
-- Recalculate total score for user b306be71 from all daily scores
WITH daily_totals AS (
    SELECT
        ds.user_id,
        SUM(
            ROUND(
                (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                 COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                 COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                1
            )
        ) as correct_total,
        COUNT(*) as correct_days_played
    FROM daily_scores ds
    JOIN competitions c ON c.id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
    WHERE ds.user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
      AND ds.date >= c.start_date
      AND ds.date <= c.end_date
      AND ds.completed_at IS NOT NULL
    GROUP BY ds.user_id
)
UPDATE competition_participants cp
SET
    total_score = dt.correct_total,
    days_played = dt.correct_days_played,
    average_score = ROUND(dt.correct_total / dt.correct_days_played, 1),
    last_score_update = NOW()
FROM daily_totals dt
WHERE cp.user_id = dt.user_id
  AND cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- Verify the fix
SELECT
    user_id,
    total_score,
    days_played,
    average_score,
    last_played_date,
    last_score_update
FROM competition_participants
WHERE user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
  AND competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;
```

**Option B: Use Backfill Function (If Available)**

If the `backfill_competition_scores_on_join` function exists:

```sql
-- First, clear the competition_daily_tracking entries for this user
DELETE FROM competition_daily_tracking
WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid;

-- Reset their competition participant record
UPDATE competition_participants
SET
    total_score = 0,
    days_played = 0,
    average_score = 0,
    last_played_date = NULL
WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND user_id = 'b306be71-3ca5-464d-a76e-943dd326a569'::uuid;

-- Run the backfill function
SELECT
    dates_backfilled,
    total_score_added
FROM backfill_competition_scores_on_join(
    '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid,
    'b306be71-3ca5-464d-a76e-943dd326a569'::uuid
);
```

### Step 3: Check for Other Affected Users

This bug might have affected **all users** in the competition, not just b306be71.

Run this diagnostic SQL to find all affected users:

```sql
-- Find users whose stored total doesn't match calculated total
WITH calculated_totals AS (
    SELECT
        ds.user_id,
        SUM(
            ROUND(
                (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                 COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                 COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                1
            )
        ) as calculated_total,
        COUNT(*) as calculated_days
    FROM daily_scores ds
    JOIN competitions c ON c.id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
    WHERE ds.date >= c.start_date
      AND ds.date <= c.end_date
      AND ds.completed_at IS NOT NULL
    GROUP BY ds.user_id
)
SELECT
    u.username,
    cp.user_id,
    cp.total_score as stored_total,
    ct.calculated_total,
    (ct.calculated_total - cp.total_score) as difference,
    cp.days_played as stored_days,
    ct.calculated_days,
    CASE
        WHEN ABS(ct.calculated_total - cp.total_score) < 0.1 THEN '✅ CORRECT'
        WHEN ABS(ct.calculated_total - cp.total_score) > 0.1 THEN '❌ MISMATCH'
    END as status
FROM competition_participants cp
JOIN calculated_totals ct ON cp.user_id = ct.user_id
JOIN users u ON cp.user_id = u.id
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
ORDER BY difference DESC;
```

### Step 4: Verify Fix

After recalculating scores:

1. Refresh the leaderboard in the app
2. Open: `http://192.168.0.161:5500/investigate-user-scores.html`
3. Change USER_ID to `'b306be71-3ca5-464d-a76e-943dd326a569'`
4. Verify: "✅ Scores match! Total is correct."

## Prevention

To prevent this in the future:

1. **Use the INSERT ... ON CONFLICT version** from `custom-competition-functions.sql` (more atomic)
2. **Add unit tests** for score accumulation
3. **Monitor competition_daily_tracking** table to ensure no duplicate submissions
4. **Add logging** to track score changes

## Files to Check

- `/sandbox/Daily_Shapes_v4.1/custom-competition-functions.sql` (lines 89-122)
- `/sandbox/Daily_Shapes_v4.1/supabase-migration-fix-score-accumulation.sql`
- `/sandbox/Daily_Shapes_v4.1/backfill-competition-scores-on-join.sql`

## Summary

1. ✅ Identified the bug: Score REPLACEMENT instead of ADDITION
2. ✅ Fixed the function in code files
3. ⚠️ **YOU MUST**: Apply SQL migration to Supabase
4. ⚠️ **YOU MUST**: Recalculate affected users' scores
5. ⚠️ **YOU MUST**: Check if other users are affected

---

**Status**: Ready to apply fix
**Priority**: HIGH - Affects competition integrity
**Est. Time**: 5-10 minutes to fix
