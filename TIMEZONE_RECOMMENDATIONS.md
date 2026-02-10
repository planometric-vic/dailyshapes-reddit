# Timezone Handling Recommendations

## Current Issue

Your app and Supabase server are in different timezones:
- **App**: Australia (UTC+11)
- **Supabase**: UTC (UTC+0)

This causes:
1. When Australians play on Oct 14, Supabase thinks it's Oct 13
2. Scores get filtered out by `CURRENT_DATE` checks
3. Competition scores appear incomplete

## Current Fix Applied

The `FIX_TIMEZONE_ISSUE.sql` removes `CURRENT_DATE` filtering and relies only on competition start/end dates.

**Pros:**
- ✅ Works for all timezones
- ✅ Simple and reliable
- ✅ No more missing scores

**Cons:**
- ⚠️ Allows pre-playing (users can play tomorrow's game today if it's available)
- ⚠️ Competition end dates must be set correctly

## Recommended Long-Term Solution

### Option 1: Store Timezone with Competitions (Best)

Add a timezone field to competitions:

```sql
ALTER TABLE competitions
ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- For Australian competitions
UPDATE competitions
SET timezone = 'Australia/Sydney'
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe';
```

Then in your app:
```javascript
// Get competition timezone
const competition = await getCompetition(competitionId);
const compTz = competition.timezone; // 'Australia/Sydney'

// Check if today's game is within competition dates
const todayInCompTz = new Date().toLocaleString('en-US', {
    timeZone: compTz
}).split(',')[0];

// Only allow submission if date is within competition range
if (gameDate >= competition.start_date && gameDate <= competition.end_date) {
    await submitScore(competitionId, userId, score, gameDate);
}
```

### Option 2: Normalize All Dates to UTC in App (Simplest)

In your JavaScript, always convert dates to UTC before saving:

```javascript
// Current (problematic)
const today = new Date().toISOString().split('T')[0]; // '2025-10-14' in AEDT
await saveDailyScore(userId, today, score);

// Better (normalized)
const todayUTC = new Date().toUTCString().split(' ').slice(1,4).join(' ');
const todayUTCDate = new Date(todayUTC).toISOString().split('T')[0]; // Always UTC
await saveDailyScore(userId, todayUTCDate, score);
```

### Option 3: Remove Date Filtering Entirely (Current Approach)

Just rely on competition start/end dates and accept that:
- Users in different timezones can play "tomorrow's" game a few hours early
- This is actually fine for most casual competitions
- Daily Shapes is about playing daily, not precise timing

**This is what the current fix does.**

## What Your Current Code Does

Based on the `completed_at` timestamps I saw:

```javascript
// Mike's Oct 14 score
date: "2025-10-14"
completed_at: "2025-10-13 20:38:08" (UTC)
```

This shows your app is:
1. Setting `date` to the game date (Oct 14)
2. Setting `completed_at` to when they actually played (Oct 13 8:38 PM UTC)

This is actually GOOD - you're correctly tracking the game date vs completion timestamp.

## My Recommendation

**Keep the current fix** (`FIX_TIMEZONE_ISSUE.sql`) because:

1. ✅ **Simple** - no timezone conversion needed
2. ✅ **Works globally** - anyone can play from any timezone
3. ✅ **Competition dates control everything** - set end_date correctly and you're protected
4. ✅ **Pre-playing is minor** - if someone plays Oct 15's game a few hours early on Oct 14, who cares?

The only requirement: **Set competition end_dates correctly** to prevent scoring after competition ends.

## Future Enhancement (Optional)

If you want stricter date validation later:

```sql
-- Add a function to validate score submission
CREATE OR REPLACE FUNCTION is_valid_score_date(
    p_game_date DATE,
    p_competition_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    comp_start DATE;
    comp_end DATE;
BEGIN
    SELECT start_date, end_date
    INTO comp_start, comp_end
    FROM competitions
    WHERE id = p_competition_id;

    -- Allow scores within competition range
    RETURN p_game_date >= comp_start
       AND p_game_date <= comp_end;
END;
$$ LANGUAGE plpgsql;

-- Use in submit function
CREATE OR REPLACE FUNCTION submit_to_custom_competition(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
    -- Validate date is within competition
    IF NOT is_valid_score_date(p_date, p_competition_id) THEN
        RAISE EXCEPTION 'Score date % is outside competition dates', p_date;
    END IF;

    -- Rest of function...
END;
$$ LANGUAGE plpgsql;
```

## Summary

**Current fix is good enough.** The timezone issue is solved by removing `CURRENT_DATE` filtering and relying on competition date boundaries instead.

No changes needed to your app code - it's already handling dates correctly.
