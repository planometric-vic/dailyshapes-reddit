# Score Submission Bug Fix

## Problem Identified

The database function `submit_to_custom_competition` had a **column name mismatch** that prevented scores from being submitted to competitions.

### Issues Found:
1. ❌ Function tried to update `days_completed` column (doesn't exist)
2. ❌ Actual table has `days_played` column
3. ❌ Function didn't update `last_played_date` field
4. ❌ Function didn't update `last_score_update` field

## Files Updated

### 1. `/supabase-migration-fix-score-accumulation.sql`
Updated both database functions to:
- ✅ Change `days_completed` → `days_played`
- ✅ Add `last_played_date` parameter and update
- ✅ Add `last_score_update = NOW()` to track submission time
- ✅ Add optional `p_date` parameter (defaults to CURRENT_DATE)

### 2. `/competition-integration.js`
Updated the JavaScript call to include the date parameter:
```javascript
await supabaseClient.rpc('submit_to_custom_competition', {
    p_competition_id: comp.competition_id,
    p_user_id: user.id,
    p_daily_score: dailyScore,
    p_date: today  // NEW: Pass today's date
});
```

### 3. `/test-score-submission.html`
Updated diagnostic tool to:
- ✅ Pass date parameter to RPC call
- ✅ Remove manual workaround (function now handles all updates)
- ✅ Verify final state after submission

## CRITICAL: You Must Apply the SQL Migration

**The database functions need to be updated in Supabase!**

### Steps to Apply Fix:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Copy and Paste the SQL Migration**
   - Open: `/sandbox/Daily_Shapes_v4.1/supabase-migration-fix-score-accumulation.sql`
   - Copy the ENTIRE file contents
   - Paste into Supabase SQL Editor

4. **Execute the Migration**
   - Click "Run" button
   - Wait for confirmation: "Success. No rows returned"

5. **Verify the Fix**
   - Open: `http://192.168.0.161:5500/test-score-submission.html` on your phone
   - Click "Manually Submit Score" button
   - Should see: ✅ Score submitted successfully!
   - Should see: ✅ Final participant record with updated `last_played_date`

## Expected Results After Fix

Once the SQL migration is applied:

### Competition Participant Record Will Show:
```json
{
  "competition_id": "6b68e958-f2ec-4bfd-842d-dd5169446fbe",
  "user_id": "4649ca91-87e2-4691-be9d-cced89140181",
  "total_score": <accumulated score>,
  "days_played": 2,
  "last_played_date": "2025-10-13",  // ✅ Updated to today!
  "last_score_update": "2025-10-13T...",  // ✅ Timestamp of submission
  "updated_at": "2025-10-13T..."
}
```

### Automatic Score Submission Will Work:
- When you complete the daily game, your score will automatically submit to:
  - ✅ Global competition
  - ✅ All custom competitions you're in
- The `last_played_date` will automatically update
- The `days_played` counter will increment correctly

## Testing Checklist

After applying the SQL migration:

- [ ] Run SQL migration in Supabase
- [ ] Verify no errors in SQL execution
- [ ] Open diagnostic tool: `http://192.168.0.161:5500/test-score-submission.html`
- [ ] Click "Manually Submit Score"
- [ ] Verify success message appears
- [ ] Check `last_played_date` is updated to "2025-10-13"
- [ ] Check `days_played` incremented to 2
- [ ] Check `total_score` increased by today's average
- [ ] Play tomorrow's daily game and verify automatic submission works

## Why This Happened

The original SQL migration was created with incorrect column names that didn't match the actual database schema. The table was likely modified after the migration was written, but the migration file wasn't updated to reflect the schema changes.

This is a common issue when:
1. Database schema evolves over time
2. Migration files aren't kept in sync
3. Column names are changed without updating all references

## Prevention

To prevent this in the future:
1. Always verify column names match the actual table schema
2. Test migrations in a staging environment first
3. Use database introspection tools to confirm schema
4. Keep migration files in version control and update them when schema changes

---

**Status:** Ready to apply SQL migration
**Priority:** HIGH - Blocking competition score submissions
**Estimated Time:** 2 minutes to apply fix
