# Global Monthly Competitions - Setup Guide

## Overview

The global monthly competition system automatically creates a new competition on the **1st day of each month at 00:00 in each user's LOCAL timezone**. This ensures users around the world all start their monthly competition at midnight in their own timezone.

## How It Works

### Client-Side Creation (Timezone-Aware)
- When ANY user loads the game on the 1st of a new month (in their timezone), the system checks if that month's competition exists
- If it doesn't exist, **that user's client creates it** for everyone globally
- This means the competition gets created as soon as the FIRST user anywhere in the world enters the new month
- All subsequent users will find the competition already exists

### Auto-Enrollment
- Users are automatically enrolled when they **play their first daily game** of the month
- You can join mid-month (e.g., November 15th) and still participate
- Your cumulative score for all games played that month counts toward the leaderboard

### Month Transitions
- On the 1st of each month, old competitions are automatically marked as `is_active: false`
- They move to the "Past Competitions" section
- The new month's competition becomes active

## Required Database Migration

**YOU MUST RUN THIS FIRST** before the system will work:

```sql
-- Run this in your Supabase SQL Editor

-- Make creator_id nullable for system-created competitions
ALTER TABLE competitions
ALTER COLUMN creator_id DROP NOT NULL;

-- Make creator_timezone nullable
ALTER TABLE competitions
ALTER COLUMN creator_timezone DROP NOT NULL;
```

## Creating the Current Month's Competition

Since you're setting this up mid-month (November 2025), you need to manually create the November competition:

```sql
-- Create NOVEMBER GLOBAL competition
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
```

## Verifying It Works

After running the migration and creating November's competition:

1. **Check the database:**
   ```sql
   SELECT id, name, start_date, end_date, is_global, is_active
   FROM competitions
   WHERE is_global = true
   ORDER BY start_date DESC;
   ```

2. **Test in the app:**
   - Log in as "bonko"
   - Play a daily game
   - You should be auto-enrolled in "NOVEMBER GLOBAL"
   - Check your competitions list - it should appear there

3. **Check the console:**
   - Open browser DevTools (F12)
   - Look for messages like:
     - `🌍 Checking for global competition in user's timezone: 2025-11`
     - `📅 Using existing global competition: NOVEMBER GLOBAL`
     - `🏆 Submitting daily score: XX.X to global competition`

## Future Months

### Automatic Creation (December onwards)

Starting December 1st at 00:00 (in any timezone):
- The first user to load the game will trigger creation of "DECEMBER GLOBAL"
- All users will be auto-enrolled when they play
- November's competition will be deactivated and moved to past competitions

### Manual Creation (Optional)

If you want to pre-create future months, use this template:

```sql
INSERT INTO competitions (
    name, description, creator_id, creator_timezone,
    start_date, end_date, is_global, is_public, is_active,
    scoring_type, min_days_required
) VALUES (
    'DECEMBER GLOBAL',  -- Change month name
    'Monthly global competition for all Daily Shapes players',
    NULL, 'UTC',
    '2025-12-01',       -- Change start date
    '2025-12-31',       -- Change end date
    true, true, true, 'total', 1
);
```

## Leaderboard Display

- Shows **top 100 players** by cumulative score
- If you're outside top 100, your rank shows in a separate card above the leaderboard
- Updates in real-time as scores are submitted

## Technical Details

### Files Modified
1. **global-competition.js**
   - `ensureCurrentMonthCompetition()` - Checks user's local timezone
   - `createMonthlyGlobalCompetition()` - Creates competition if needed
   - `deactivateOldCompetitions()` - Deactivates past months
   - `autoEnrollUser()` - Enrolls user when they play

2. **competitions.js**
   - Fixed schema mismatches (removed `status` field references)
   - Updated queries to use `is_active` instead

3. **main.js**
   - Removed filters that were hiding global competitions
   - Now shows global comps in both active and past lists

4. **leaderboard-ui.js**
   - Changed page size from 50 to 100
   - Shows user rank card only if outside top 100

### Database Schema Changes
- `competitions.creator_id`: Changed from `NOT NULL` to `NULLABLE`
- `competitions.creator_timezone`: Changed from `NOT NULL` to `NULLABLE`

## Troubleshooting

### Competition not appearing?
1. Check if migration was run: `\d competitions` should show `creator_id` as nullable
2. Check if competition exists: Run the SELECT query above
3. Check browser console for errors
4. Verify you're logged in (not guest mode)

### Not auto-enrolled?
1. Make sure you've played a daily game (not just visited the page)
2. Check `competition_participants` table:
   ```sql
   SELECT * FROM competition_participants
   WHERE user_id = 'YOUR_USER_ID'
   AND competition_id IN (SELECT id FROM competitions WHERE is_global = true);
   ```

### Old competitions not deactivating?
- Deactivation happens when the new competition is created
- If you manually created both months, deactivate the old one:
  ```sql
  UPDATE competitions
  SET is_active = false
  WHERE is_global = true
  AND end_date < CURRENT_DATE;
  ```

## Summary

✅ **Run the migration** to allow NULL creator_id
✅ **Create November competition** manually (one-time)
✅ **Test** by playing a game and checking competitions list
✅ **Future months** will auto-create at midnight local time
✅ **Users auto-enroll** when they play their first game of the month
