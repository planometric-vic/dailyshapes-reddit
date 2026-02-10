# Google Analytics 4 Event Tracking Documentation
## Daily Shapes v4.1

**Last Updated:** 2025-10-13

## Overview

This document details all Google Analytics 4 (GA4) custom event tracking implemented in Daily Shapes. The tracking is designed to capture user engagement, competition participation, account management, and retention metrics without impacting game functionality.

## GA4 Setup

- **Measurement ID:** `G-MPQ1YV02EM`
- **Location:** `/index.html` lines 62-69
- **Implementation:** Standard GA4 gtag.js

---

## Tracked Events Summary

| Event Name | Category | Purpose | Location |
|------------|----------|---------|----------|
| `competition_created` | competition | Track when users create new competitions | custom-competition-manager.js:496 |
| `competition_link_copied` | competition | Track when invite links are copied | custom-competition-manager.js:567 |
| `competition_invitation_accepted` | competition | Track when users join via invite | competition-invite-system.js:365 |
| `account_created` | user | Track new account registrations | auth-service.js:268 |
| `account_login` | user | Track user logins (returning players) | auth-service.js:355 |
| `daily_game_started` | gameplay | Track when daily game begins (Play button) | main.js:2585 |
| `daily_game_completed` | gameplay | Track when all 6 cuts are completed | auth-service.js:632 |
| `practice_mode_started` | gameplay | Track practice mode usage | practice-mode.js:1269 |

---

## Detailed Event Specifications

### 1. Competition Created
**Event Name:** `competition_created`

**Triggered When:** User successfully creates a new competition

**Location:** `custom-competition-manager.js` line 496

**Parameters:**
```javascript
{
    competition_id: string,        // UUID of created competition
    competition_name: string,      // Name of competition
    is_public: boolean,            // Public vs private competition
    duration_days: number,         // Competition length in days
    event_category: 'competition',
    event_label: 'public' | 'private'
}
```

**Example:**
```javascript
gtag('event', 'competition_created', {
    competition_id: '6b68e958-f2ec-4bfd-842d-dd5169446fbe',
    competition_name: 'Weekly Challenge',
    is_public: true,
    duration_days: 7,
    event_category: 'competition',
    event_label: 'public'
});
```

---

### 2. Competition Link Copied
**Event Name:** `competition_link_copied`

**Triggered When:** User copies competition invite link to clipboard

**Location:** `custom-competition-manager.js` line 567 (modern method), line 581 (fallback method)

**Parameters:**
```javascript
{
    event_category: 'competition',
    event_label: 'invite_link_copied' | 'invite_link_copied_fallback'
}
```

**Notes:**
- Tracks both modern clipboard API and fallback `document.execCommand('copy')`
- Different labels distinguish between methods

---

### 3. Competition Invitation Accepted
**Event Name:** `competition_invitation_accepted`

**Triggered When:** User successfully joins a competition via invite link

**Location:** `competition-invite-system.js` line 365

**Parameters:**
```javascript
{
    competition_id: string,        // UUID of joined competition
    user_id: string,               // User's UUID
    event_category: 'competition',
    event_label: 'joined_via_invite'
}
```

**Example:**
```javascript
gtag('event', 'competition_invitation_accepted', {
    competition_id: '6b68e958-f2ec-4bfd-842d-dd5169446fbe',
    user_id: '2ad9c311-deeb-4108-9c43-2be074fc6c2d',
    event_category: 'competition',
    event_label: 'joined_via_invite'
});
```

---

### 4. Account Created
**Event Name:** `account_created`

**Triggered When:** User successfully completes account registration

**Location:** `auth-service.js` line 268

**Parameters:**
```javascript
{
    user_id: string,               // New user's UUID
    username: string,              // Chosen username
    method: 'email',               // Authentication method
    event_category: 'user',
    event_label: 'new_account'
}
```

**Example:**
```javascript
gtag('event', 'account_created', {
    user_id: '2ad9c311-deeb-4108-9c43-2be074fc6c2d',
    username: 'player123',
    method: 'email',
    event_category: 'user',
    event_label: 'new_account'
});
```

---

### 5. Account Login
**Event Name:** `account_login`

**Triggered When:** Existing user successfully logs in

**Location:** `auth-service.js` line 355

**Parameters:**
```javascript
{
    user_id: string,               // User's UUID
    username: string,              // Username
    method: 'email',               // Authentication method
    event_category: 'user',
    event_label: 'returning_user'
}
```

**Example:**
```javascript
gtag('event', 'account_login', {
    user_id: '2ad9c311-deeb-4108-9c43-2be074fc6c2d',
    username: 'player123',
    method: 'email',
    event_category: 'user',
    event_label: 'returning_user'
});
```

**Retention Analysis:**
Track returning players by analyzing:
- Day-over-day return rate (logins within 24 hours of previous session)
- 7-day retention (logins within 7 days of account creation)
- 30-day retention (logins within 30 days of account creation)

---

### 6. Daily Game Started
**Event Name:** `daily_game_started`

**Triggered When:** User clicks Play button to start daily challenge

**Location:** `main.js` line 2585

**Parameters:**
```javascript
{
    user_id: string,               // User UUID or 'guest'
    date: string,                  // YYYY-MM-DD format
    is_guest: boolean,             // Whether user is playing as guest
    event_category: 'gameplay',
    event_label: 'daily_session_started'
}
```

**Example:**
```javascript
gtag('event', 'daily_game_started', {
    user_id: '2ad9c311-deeb-4108-9c43-2be074fc6c2d',
    date: '2025-10-13',
    is_guest: false,
    event_category: 'gameplay',
    event_label: 'daily_session_started'
});
```

---

### 7. Daily Game Completed
**Event Name:** `daily_game_completed`

**Triggered When:** User completes all 6 cuts (3 shapes × 2 attempts) and score is saved

**Location:** `auth-service.js` line 632

**Parameters:**
```javascript
{
    user_id: string,               // User's UUID
    date: string,                  // YYYY-MM-DD format
    average_score: string,         // Average score (e.g., "85.3")
    mechanic: string,              // Day's mechanic name
    event_category: 'gameplay',
    event_label: 'daily_completion'
}
```

**Example:**
```javascript
gtag('event', 'daily_game_completed', {
    user_id: '2ad9c311-deeb-4108-9c43-2be074fc6c2d',
    date: '2025-10-13',
    average_score: '91.9',
    mechanic: 'DefaultWithUndoMechanic',
    event_category: 'gameplay',
    event_label: 'daily_completion'
});
```

**Note:** Only fires once per user per day to prevent duplicate tracking

---

### 8. Practice Mode Started
**Event Name:** `practice_mode_started`

**Triggered When:** User enters practice/archive mode

**Location:** `practice-mode.js` line 1269

**Parameters:**
```javascript
{
    event_category: 'gameplay',
    event_label: 'practice_session_started'
}
```

**Example:**
```javascript
gtag('event', 'practice_mode_started', {
    event_category: 'gameplay',
    event_label: 'practice_session_started'
});
```

---

## Safety Guarantees

### Non-Blocking Implementation
All tracking calls are wrapped in safety checks:

```javascript
if (typeof gtag !== 'undefined') {
    gtag('event', 'event_name', { ... });
    console.log('📊 GA4: Tracked event_name event');
}
```

### Fail-Safe Behavior
- If GA4 fails to load → tracking calls fail silently
- If network issues occur → no impact on gameplay
- If tracking errors → game continues normally
- All calls are asynchronous and non-blocking

### No Modification to Game Logic
- Tracking code added **after** successful operations
- No impact on function return values
- No changes to game state or user experience
- Zero dependencies on tracking success

---

## GA4 Dashboard Setup

### Recommended Custom Reports

#### 1. Competition Funnel
Track competition engagement flow:
1. `competition_created` → Competition creation rate
2. `competition_link_copied` → Share rate
3. `competition_invitation_accepted` → Conversion rate

#### 2. User Acquisition & Retention
Track new vs returning players:
1. `account_created` → New signups
2. `account_login` → Returning players
3. Calculate retention: Logins / Signups over time periods

#### 3. Daily Engagement
Track daily gameplay metrics:
1. `daily_game_started` → Daily active users
2. `daily_game_completed` → Completion rate
3. Compare guest vs authenticated users

#### 4. Practice Mode Usage
Track practice engagement:
1. `practice_mode_started` → Practice session starts
2. Compare daily vs practice engagement

---

## Viewing Events in GA4

### Real-Time Events
1. Navigate to **Reports** → **Realtime**
2. View events as they fire in real-time

### Event Analysis
1. Navigate to **Reports** → **Engagement** → **Events**
2. Filter by custom event names
3. View event counts and parameters

### Custom Exploration
1. Navigate to **Explore**
2. Create custom reports with event parameters
3. Build funnels and cohort analyses

---

## Testing Event Tracking

### Console Logging
All events log to console when fired:
```
📊 GA4: Tracked competition_created event
```

### GA4 DebugView
Enable debug mode:
```javascript
gtag('config', 'G-MPQ1YV02EM', { debug_mode: true });
```

Then view events in **Admin** → **DebugView**

### Browser Extension
Use **Google Analytics Debugger** Chrome extension to see events in browser console

---

## Future Enhancements

### Potential Additional Events
1. `perfect_cut_achieved` - Track 50/50 perfect cuts
2. `streak_milestone` - Track 3, 7, 14, 30 day streaks
3. `share_results` - Track social sharing
4. `mechanic_experienced` - Track which day's mechanic was played
5. `competition_leaderboard_viewed` - Track competition engagement

### Enhanced Parameters
1. Add session duration to `daily_game_completed`
2. Add attempt count to `daily_game_completed`
3. Add shape difficulty to practice mode events

---

## Privacy & GDPR Compliance

### Data Collection
- User IDs are hashed UUIDs (not personally identifiable)
- No collection of IP addresses (GA4 default)
- No collection of email addresses in events
- Username is only tracked for account events

### User Consent
Consider implementing cookie consent banner for EU users if required by your data policy.

---

## Troubleshooting

### Events Not Appearing in GA4

**Check 1: GA4 Loaded**
```javascript
// In browser console
typeof gtag
// Should return: "function"
```

**Check 2: Measurement ID Correct**
Verify `G-MPQ1YV02EM` in `index.html` line 68

**Check 3: Event Syntax**
Look for console logs: `📊 GA4: Tracked [event_name] event`

**Check 4: 24-48 Hour Delay**
GA4 events may take up to 48 hours to appear in standard reports (use Realtime for immediate verification)

---

## Support & Updates

For questions or issues with event tracking:
1. Check console for `📊 GA4:` log messages
2. Verify events in GA4 Realtime view
3. Review this documentation for correct implementation

**Last Modified:** October 13, 2025
**Version:** 1.0
**Implementation:** Daily Shapes v4.1
