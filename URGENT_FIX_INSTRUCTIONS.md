# 🚨 URGENT: Fix Competition Scores NOW

## What's Wrong

User b306be71 (and possibly others) have **incorrect scores**:
- **Stored**: 97.0 points, 1 day played
- **Should be**: 283.90 points, 3 days played
- **Missing**: 186.90 points!

This means the leaderboard rankings are **completely wrong**.

---

## The 2-Minute Fix

### Step 1: Open Supabase
1. Go to https://supabase.com
2. Log in to your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Run the Fix Script
1. Copy the entire contents of: `/sandbox/Daily_Shapes_v4.1/fix-competition-scores-complete.sql`
2. Paste into Supabase SQL Editor
3. Click **RUN** (the big button at bottom right)

### Step 3: Watch the Output
You'll see messages like:
```
✅ Function submit_to_custom_competition has been fixed
📊 CHECKING ALL USERS FOR SCORE MISMATCHES...
❌ MISMATCH #1: [username]
   Stored Total: 97 | Correct Total: 283.9
🔧 FIXING ALL AFFECTED USERS...
✅ Fixed [username]: 97 → 283.9 (3 days)
✅✅✅ SUCCESS! All scores are now correct!
```

### Step 4: Verify in the App
1. Open the game on your phone
2. Go to the competition leaderboard
3. Refresh the page
4. Verify user b306be71 now shows **283.9** points

---

## What This Script Does

1. **Fixes the database function** so future scores accumulate correctly
2. **Scans all users** in the competition for score mismatches
3. **Recalculates correct totals** from all daily scores
4. **Updates all affected users** automatically
5. **Verifies** everything is fixed

---

## Why This Happened

The database function `submit_to_custom_competition` was **REPLACING** scores instead of **ADDING** them.

**Before (BUGGY)**:
```sql
total_score = p_daily_score  -- Replaces old score!
```

**After (FIXED)**:
```sql
total_score = competition_participants.total_score + p_daily_score  -- Adds to existing!
```

Every time a user played a new day, their previous total was wiped out and replaced with just that day's score.

---

## Expected Results

After running this script:

| User | Before | After | Status |
|------|--------|-------|--------|
| b306be71 | 97 (1 day) | 283.9 (3 days) | ✅ Fixed |
| Others | TBD | TBD | ✅ Checked & Fixed |

The script will show you exactly which users were affected and what their corrected scores are.

---

## If Something Goes Wrong

If you see errors:
1. Copy the entire error message
2. Check if any users have `NULL` values in `shape1_attempt1` through `shape3_attempt2`
3. The script handles NULLs with `COALESCE`, so it should work

If scores still don't match after running:
1. Run the script again (it's safe to run multiple times)
2. Check the output for remaining mismatches
3. Manually verify one user's daily scores in the database

---

## Future Prevention

After this fix:
- ✅ New scores will **ADD** correctly (function is fixed)
- ✅ The `competition_daily_tracking` table prevents double-counting
- ✅ All future daily games will work correctly

---

## Time Required

- **Script runtime**: ~5-10 seconds
- **Total time**: 2 minutes including copy/paste

---

## DO THIS NOW!

Your competition leaderboard is showing wrong results. Run this fix before anyone else plays today!

**File to run**: `/sandbox/Daily_Shapes_v4.1/fix-competition-scores-complete.sql`

Copy → Paste → Run → Done! 🎉
