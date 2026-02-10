# Competition Score Bug Fix

## Problem Summary

Competition scores were being added incorrectly, with scores being duplicated or retroactively added wrong. This was happening for both new scores (when someone plays after joining) and backfilled scores (when someone joins and past scores are added).

## Root Cause

The `update_competition_score` RPC function in your Supabase database **had no duplicate detection**. Every time it was called, it:

1. **Always added** the score to the participant's total
2. **Always incremented** days_played by 1
3. Never checked if a score for that date already existed

### Why This Caused Issues:

**Scenario A - Multiple Attempts Per Day:**
- Player makes Try 1 → Score submitted → Added to total
- Player makes Try 2 → Score submitted → Added to total AGAIN
- Result: Same day counted twice (or more)

**Scenario B - Backfill + New Play:**
- Player joins competition → Backfill adds past scores
- Player plays today → New score submitted
- If backfill already added today's score → Double counted

**Scenario C - Page Refresh/Reload:**
- Score submission retries or fires multiple times
- Each submission adds to total again

## The Fix

### 1. Fixed RPC Function (SQL)

**File:** `fix-competition-score-rpc.sql`

The new `update_competition_score` function:
- ✅ Checks `competition_daily_tracking` table for existing score on that date
- ✅ If exists: **UPDATE** the score (don't add duplicate)
- ✅ If new: **INSERT** new daily record
- ✅ Recalculates totals from ALL daily records (single source of truth)
- ✅ Updates participant's total_score and days_played based on actual daily records

**To Apply:**
```sql
-- Run this in Supabase SQL Editor
-- Copy entire contents of fix-competition-score-rpc.sql
```

### 2. Added Date Parameter (JavaScript)

**File:** `competitions.js:728`

Updated the RPC call to pass the date:
```javascript
.rpc('update_competition_score', {
    p_competition_id: competition.id,
    p_user_id: userId,
    p_daily_score: parseFloat(averageScore.toFixed(1)),
    p_date: date  // NEW: Pass the date to prevent duplicates
});
```

### 3. Unique Constraint (SQL)

**File:** `add-unique-constraint.sql`

Adds database-level protection:
```sql
ALTER TABLE competition_daily_tracking
ADD CONSTRAINT competition_daily_tracking_unique_user_comp_date
UNIQUE (competition_id, user_id, date);
```

This prevents duplicate records at the database level.

## Cleanup Steps for Affected Competitions

**Affected Competition IDs:**
- `60c2e42d-6d1a-445e-bd34-b3c460c175ab`
- `e5039157-0386-4ec5-af58-9ff8fc2f3b61`

**File:** `cleanup-competition-scores.sql`

This script will:
1. Show current state (BEFORE cleanup)
2. Clear existing `competition_daily_tracking` for these competitions
3. Rebuild daily tracking from `daily_scores` table (one record per date)
4. Recalculate all participant totals from the clean daily records
5. Show final state (AFTER cleanup)
6. Show detailed daily breakdown for verification

**To Run:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy entire contents of `cleanup-competition-scores.sql`
3. Run the script
4. Review the BEFORE/AFTER output to verify correctness

## Installation Order

Run these in Supabase SQL Editor in this order:

```bash
1. add-unique-constraint.sql        # Add database protection
2. fix-competition-score-rpc.sql    # Fix the RPC function
3. cleanup-competition-scores.sql   # Clean up affected competitions
```

## What Changed

### Before (Broken):
```sql
-- Old RPC - always adds score
ON CONFLICT (competition_id, user_id)
DO UPDATE SET
    total_score = competition_participants.total_score + EXCLUDED.total_score,  -- ❌ ALWAYS ADDS
    days_played = competition_participants.days_played + 1                      -- ❌ ALWAYS INCREMENTS
```

### After (Fixed):
```sql
-- New RPC - checks for duplicates first
SELECT daily_score INTO v_existing_score
FROM competition_daily_tracking
WHERE competition_id = p_competition_id
  AND user_id = p_user_id
  AND date = p_date;

IF v_existing_score IS NOT NULL THEN
    -- Update existing (don't duplicate)
    UPDATE competition_daily_tracking SET daily_score = p_daily_score ...
ELSE
    -- Insert new
    INSERT INTO competition_daily_tracking ...
END IF;

-- Recalculate totals from ALL daily records
SELECT SUM(daily_score), COUNT(*) FROM competition_daily_tracking ...
```

## Why The Backfill Function Was OK

The `backfill_competition_scores_on_join` function actually had proper duplicate detection:

```sql
-- It checks for existing records
AND NOT EXISTS (
    SELECT 1 FROM competition_daily_tracking cdt
    WHERE cdt.competition_id = p_competition_id
      AND cdt.user_id = p_user_id
      AND cdt.date = ds.date
)
```

So backfill was fine - the issue was with regular score submissions.

## Testing

After applying fixes:

1. **Test duplicate submission:**
   - Play a game
   - Check competition score
   - Play again (2nd try same day)
   - Verify score was updated, not duplicated

2. **Test backfill:**
   - Create new competition with past dates
   - Join the competition
   - Verify past scores backfilled correctly
   - Play today
   - Verify today's score not duplicated

3. **Check leaderboard:**
   - Refresh leaderboard multiple times
   - Verify scores don't change/duplicate

## Summary

- ✅ Fixed RPC function to prevent duplicate submissions
- ✅ Added date parameter to RPC calls
- ✅ Added unique constraint for database-level protection
- ✅ Created cleanup script for affected competitions
- ✅ JavaScript code updated to pass date parameter

All future score submissions will now properly track daily scores and prevent duplicates.
