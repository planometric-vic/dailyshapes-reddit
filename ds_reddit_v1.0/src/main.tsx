import { Devvit } from '@devvit/public-api';

// Enable Redis plugin
Devvit.configure({ redditAPI: true, redis: true });

// ============================================================
// TYPES
// ============================================================

interface InitData {
  username: string;
  dayKey: string;
  dayNumber: number;
  dayOfWeek: number;
  shapes: string[];       // GeoJSON strings for today's 10 shapes
  mechanic: string;       // Mechanic name for today
  existingProgress: string | null;
  existingScore: number | null;
  existingShapeScores: Record<string, any> | null;
  leaderboard: LeaderboardEntry[];
  weeklyLeaderboard: LeaderboardEntry[];
  weekKey: string;
  userWeeklyScore: number;
  userWeeklyRank: number;
  weeklyWins: LeaderboardEntry[];
  userWeeklyWins: number;
  userWeeklyWinsRank: number;
  perfectCuts: LeaderboardEntry[];
  userPerfectCuts: number;
  userPerfectCutsRank: number;
  postTitle: string;
}

interface LeaderboardEntry {
  username: string;
  score: number;
  rank: number;
}

// ============================================================
// MECHANIC SCHEDULE
// ============================================================

const MECHANIC_SCHEDULE: Record<number, string> = {
  0: 'RotatingShapeVectorMechanic', // Sunday
  1: 'DefaultWithUndoMechanic',     // Monday
  2: 'HorizontalOnlyMechanic',      // Tuesday
  3: 'CircleCutMechanic',           // Wednesday
  4: 'DiagonalAscendingMechanic',   // Thursday
  5: 'ThreePointTriangleMechanic',  // Friday
  6: 'RotatingSquareMechanic',      // Saturday
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/** Get today's date key in Melbourne timezone (YYMMDD format) */
function getTodayKey(): string {
  const now = new Date();
  const melb = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const yy = String(melb.getFullYear()).slice(2);
  const mm = String(melb.getMonth() + 1).padStart(2, '0');
  const dd = String(melb.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Get day number (days since epoch in Melbourne TZ) for display */
function getDayNumber(): number {
  const now = new Date();
  const melb = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const epoch = new Date(2025, 0, 1); // Jan 1, 2025
  return Math.floor((melb.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Get day of week (0=Sun, 6=Sat) in Melbourne TZ */
function getDayOfWeek(): number {
  const now = new Date();
  const melb = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  return melb.getDay();
}

/** Get the week key (YYMMDD of the Monday of the current week, UTC).
 *  Competitions run Mon-Sun. This key identifies the current week. */
function getWeekKey(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // Days since Monday
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - diff);
  const yy = String(monday.getUTCFullYear()).slice(-2);
  const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(monday.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Derive day-of-week from a YYMMDD key (0=Sun, 6=Sat) */
function getDayOfWeekForKey(dayKey: string): number {
  const yy = parseInt(dayKey.substring(0, 2), 10);
  const mm = parseInt(dayKey.substring(2, 4), 10);
  const dd = parseInt(dayKey.substring(4, 6), 10);
  return new Date(2000 + yy, mm - 1, dd).getDay();
}

/** Derive day number from a YYMMDD key */
function getDayNumberForKey(dayKey: string): number {
  const yy = parseInt(dayKey.substring(0, 2), 10);
  const mm = parseInt(dayKey.substring(2, 4), 10);
  const dd = parseInt(dayKey.substring(4, 6), 10);
  const date = new Date(2000 + yy, mm - 1, dd);
  const epoch = new Date(2025, 0, 1);
  return Math.floor((date.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Format a YYMMDD key as "Feb 17" */
function getFormattedDateForKey(dayKey: string): string {
  const mm = parseInt(dayKey.substring(2, 4), 10);
  const dd = parseInt(dayKey.substring(4, 6), 10);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[mm - 1]} ${dd}`;
}

/** Convert mechanic class name to user-friendly cutter name */
function getFriendlyMechanicName(mechanic: string): string {
  const nameMap: Record<string, string> = {
    'DefaultWithUndoMechanic': 'Straight Line Cutter',
    'HorizontalOnlyMechanic': 'Horizontal Cutter',
    'CircleCutMechanic': 'Circular Cutter',
    'DiagonalAscendingMechanic': 'Diagonal Cutter',
    'ThreePointTriangleMechanic': 'Triangular Cutter',
    'RotatingSquareMechanic': 'Square Cutter',
    'RotatingShapeVectorMechanic': 'Rotating Shape Cutter',
  };
  return nameMap[mechanic] || mechanic.replace('Mechanic', '');
}

/** Format today's date as "Feb 17" in Melbourne timezone */
function getFormattedDate(): string {
  const now = new Date();
  const melb = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[melb.getMonth()]} ${melb.getDate()}`;
}

// ============================================================
// REDIS KEY HELPERS
// ============================================================

const redisKeys = {
  shape: (dayKey: string, index: number) => `shapes:${dayKey}:${index}`,
  userScore: (dayKey: string, username: string) => `scores:${dayKey}:${username}`,
  leaderboard: (dayKey: string) => `leaderboard:${dayKey}`,
  weeklyLeaderboard: (weekKey: string) => `weekly:${weekKey}`,
  weeklyWinner: (weekKey: string) => `weekly_winner:${weekKey}`,
  weeklyWins: 'weekly_wins',       // sorted set: member=username, score=win_count
  perfectCuts: 'perfect_cuts',     // sorted set: member=username, score=cut_count
  userShapeScores: (dayKey: string, username: string) => `shapescores:${dayKey}:${username}`,
  progress: (dayKey: string, username: string) => `progress:${dayKey}:${username}`,
  userStats: (username: string) => `stats:${username}`,
  postDay: (postId: string) => `post_day:${postId}`,
};

/** Get the previous week's key (Monday before current Monday, UTC) */
function getPreviousWeekKey(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(thisMonday.getUTCDate() - diff);
  const prevMonday = new Date(thisMonday);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  const yy = String(prevMonday.getUTCFullYear()).slice(-2);
  const mm = String(prevMonday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(prevMonday.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Count perfect cuts from a shapeScores object (score === 50 = perfect).
 *  A perfect 50/50 cut returns score 50 (the smaller percentage).
 *  Supports both new format { shape1: 50, shape2: 45, ... } and
 *  legacy format { shape1: { attempt1: 50, attempt2: 45 }, ... }. */
function countPerfectCuts(scores: any): number {
  let count = 0;
  if (!scores) return 0;
  for (let i = 1; i <= 10; i++) {
    const shape = scores[`shape${i}`];
    if (shape == null) continue;
    if (typeof shape === 'number') {
      // New format: single score per shape
      if (shape >= 50) count++;
    } else {
      // Legacy format: { attempt1, attempt2 }
      if ((shape.attempt1 || 0) >= 50) count++;
      if ((shape.attempt2 || 0) >= 50) count++;
    }
  }
  return count;
}

/** Helper to fetch a leaderboard sorted set (top N, reverse order) with user stats */
async function fetchLeaderboard(
  redis: any, key: string, username: string, limit = 20
): Promise<{ entries: LeaderboardEntry[]; userScore: number; userRank: number }> {
  const raw = await redis.zRange(key, 0, limit - 1, { reverse: true, by: 'rank' });
  const entries: LeaderboardEntry[] = raw.map((entry: any, idx: number) => ({
    username: entry.member,
    score: entry.score,
    rank: idx + 1,
  }));
  const userScore = await redis.zScore(key, username) ?? 0;
  const userRankRaw = await redis.zRank(key, username);
  const userRank = userRankRaw !== undefined ? userRankRaw + 1 : -1;
  return { entries, userScore, userRank };
}

// ============================================================
// MENU ACTIONS & FORMS
// ============================================================

/**
 * Batch shape upload form.
 *
 * Accepts a JSON payload generated by tools/prepare-upload.js:
 * {
 *   "260216": { "0": "{...geojson...}", "1": "{...}", "2": "{...}" },
 *   "260217": { "0": "{...}", "1": "{...}", "2": "{...}" }
 * }
 */
const batchUploadForm = Devvit.createForm(
  () => ({
    title: 'Upload Shapes (Batch)',
    description: 'Paste the JSON payload from prepare-upload.cjs. Format: { "YYMMDD": [geojson0, ..., geojson9], ... }',
    fields: [
      { name: 'payload', label: 'Shape data (JSON)', type: 'paragraph' },
    ],
  }),
  async (event, context) => {
    const raw = event.values.payload?.trim();
    if (!raw) {
      context.ui.showToast({ text: 'No data provided.' });
      return;
    }

    let batch: Record<string, any>;
    try {
      batch = JSON.parse(raw);
    } catch (e) {
      context.ui.showToast({ text: `Invalid JSON: ${e}` });
      return;
    }

    let uploaded = 0;
    let errors = 0;
    const dayKeys = Object.keys(batch);

    for (const dayKey of dayKeys) {
      if (!dayKey.match(/^\d{6}$/)) {
        errors++;
        continue;
      }
      const dayShapes = batch[dayKey];
      // Support both array format [obj0, ..., obj9] and object format {"0": ..., ...}
      const shapeArray = Array.isArray(dayShapes)
        ? dayShapes
        : Array.from({ length: 10 }, (_, i) => dayShapes[String(i)] ?? dayShapes[i]);

      for (let i = 0; i < shapeArray.length; i++) {
        if (i > 9) break;
        const shape = shapeArray[i];
        if (!shape) continue;

        try {
          // shape may be an object (new format) or a string (old format)
          const obj = typeof shape === 'string' ? JSON.parse(shape) : shape;
          if (!obj.features && !obj.type) { errors++; continue; }
          // Store as JSON string in Redis
          const json = typeof shape === 'string' ? shape : JSON.stringify(shape);
          await context.redis.set(redisKeys.shape(dayKey, i), json);
          uploaded++;
        } catch {
          errors++;
        }
      }
    }

    context.ui.showToast({
      text: `Uploaded ${uploaded} shapes across ${dayKeys.length} days.${errors > 0 ? ` ${errors} errors.` : ''}`,
    });
  }
);

Devvit.addMenuItem({
  label: 'Upload Shapes (Daily Shapes)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    context.ui.showForm(batchUploadForm);
  },
});

/** Check what shapes are stored for today */
Devvit.addMenuItem({
  label: 'Check Today\'s Shapes (Daily Shapes)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const dayKey = getTodayKey();
    const results: string[] = [];

    for (let i = 0; i < 10; i++) {
      const data = await context.redis.get(redisKeys.shape(dayKey, i));
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const featureCount = parsed.features?.length ?? 0;
          results.push(`S${i + 1}: ${featureCount}f`);
        } catch {
          results.push(`S${i + 1}: err`);
        }
      } else {
        results.push(`S${i + 1}: -`);
      }
    }

    context.ui.showToast({
      text: `Day ${dayKey}: ${results.join(' | ')}`,
    });
  },
});

/** Mod tool: Reset a user's scores and remove them from leaderboards */
const resetUserForm = Devvit.createForm(
  () => ({
    title: 'Reset User Scores',
    description: 'Remove a user from all leaderboards and delete their scores. This cannot be undone.',
    fields: [
      { name: 'username', label: 'Reddit username (without u/)', type: 'string' },
      {
        name: 'scope',
        label: 'What to reset',
        type: 'select',
        options: [
          { label: 'Everything (all leaderboards + today\'s score)', value: 'all' },
          { label: 'Today\'s score only', value: 'today' },
          { label: 'Weekly leaderboard only', value: 'weekly' },
          { label: 'All-time stats only (wins + perfect cuts)', value: 'alltime' },
        ],
        defaultValue: ['all'],
      },
    ],
  }),
  async (event, context) => {
    const username = event.values.username?.trim();
    if (!username) {
      context.ui.showToast({ text: 'Please enter a username.' });
      return;
    }
    const scope = event.values.scope?.[0] || 'all';
    const dayKey = getTodayKey();
    const weekKey = getWeekKey();
    const actions: string[] = [];

    try {
      if (scope === 'all' || scope === 'today') {
        // Remove today's daily score
        await context.redis.del(redisKeys.userScore(dayKey, username));
        await context.redis.zRem(redisKeys.leaderboard(dayKey), [username]);
        // Remove progress
        await context.redis.del(redisKeys.progress(dayKey, username));
        actions.push('today\'s score');
      }

      if (scope === 'all' || scope === 'weekly') {
        // Remove from weekly leaderboard
        await context.redis.zRem(redisKeys.weeklyLeaderboard(weekKey), [username]);
        actions.push('weekly leaderboard');
      }

      if (scope === 'all' || scope === 'alltime') {
        // Remove from all-time sorted sets
        await context.redis.zRem(redisKeys.weeklyWins, [username]);
        await context.redis.zRem(redisKeys.perfectCuts, [username]);
        // Delete user stats hash
        await context.redis.del(redisKeys.userStats(username));
        actions.push('all-time stats');
      }

      context.ui.showToast({
        text: `Reset ${username}: ${actions.join(', ')}`,
      });
    } catch (e) {
      context.ui.showToast({ text: `Error resetting ${username}: ${e}` });
    }
  }
);

Devvit.addMenuItem({
  label: 'Reset User Scores (Daily Shapes)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    context.ui.showForm(resetUserForm);
  },
});

// ============================================================
// SCHEDULED JOBS
// ============================================================

Devvit.addSchedulerJob({
  name: 'create-daily-post',
  onRun: async (event, context) => {
    const subredditName = event.data?.subredditName as string | undefined;
    const dayKey = getTodayKey();
    const dow = getDayOfWeek();
    const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultWithUndoMechanic';

    // Duplicate prevention — skip if we already posted for this dayKey
    const postedKey = `posted:${dayKey}`;
    const alreadyPosted = await context.redis.get(postedKey);
    if (alreadyPosted) {
      console.log(`Already posted for ${dayKey}, skipping`);
      return;
    }

    // Require shapes in Redis before posting
    const shape0 = await context.redis.get(redisKeys.shape(dayKey, 0));
    if (!shape0) {
      console.log(`No shapes uploaded for ${dayKey}, skipping daily post`);
      return;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    const dateStr = getFormattedDate();
    const cutterName = getFriendlyMechanicName(mechanic);
    const post = await context.reddit.submitPost({
      title: `Daily Shapes - ${dateStr} - ${cutterName}`,
      subredditName: subredditName ?? subreddit.name,
      preview: (
        <vstack alignment="center middle" padding="large" backgroundColor="#ffffff">
          <text size="xlarge" weight="bold" color="#000000">Daily Shapes</text>
        </vstack>
      ),
    });

    // Store this post's dayKey so INIT_REQUEST serves the correct day's data
    if (post?.id) {
      await context.redis.set(redisKeys.postDay(post.id), dayKey);
    }

    // Mark this day as posted (expire after 48h to avoid unbounded growth)
    await context.redis.set(postedKey, '1');
    await context.redis.expire(postedKey, 172800);

    console.log(`Daily Shapes - ${dateStr} post created for ${dayKey}`);

    // On Monday, determine previous week's competition winner
    if (dow === 1) {
      const prevWeekKey = getPreviousWeekKey();
      const winnerKey = redisKeys.weeklyWinner(prevWeekKey);
      const existingWinner = await context.redis.get(winnerKey);
      if (!existingWinner) {
        const topScorers = await context.redis.zRange(
          redisKeys.weeklyLeaderboard(prevWeekKey), 0, 0, { reverse: true, by: 'rank' }
        );
        if (topScorers.length > 0) {
          const winner = topScorers[0].member;
          await context.redis.set(winnerKey, winner);
          const currentWins = await context.redis.zScore(redisKeys.weeklyWins, winner) ?? 0;
          await context.redis.zAdd(redisKeys.weeklyWins, {
            member: winner,
            score: currentWins + 1,
          });
          console.log(`Weekly winner for ${prevWeekKey}: ${winner} (now ${currentWins + 1} wins)`);
        }
      }
    }
  },
});

// ============================================================
// AUTOPOSTING — Schedule on install & upgrade
// ============================================================

/** Cancel all existing scheduled jobs then schedule the daily autopost at 11:00 AM UTC */
async function scheduleDailyAutopost(context: any) {
  // Cancel existing jobs to prevent duplicates
  const jobs = await context.scheduler.listJobs();
  for (const job of jobs) {
    await context.scheduler.cancelJob(job.id);
  }

  const subreddit = await context.reddit.getCurrentSubreddit();

  await context.scheduler.runJob({
    name: 'create-daily-post',
    cron: '0 9 * * *', // 9:00 AM UTC daily
    data: { subredditName: subreddit.name },
  });

  console.log(`Scheduled daily autopost for r/${subreddit.name} at 9:00 AM UTC`);
}

Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_, context) => {
    await scheduleDailyAutopost(context);
  },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  onEvent: async (_, context) => {
    await scheduleDailyAutopost(context);
  },
});

// Manual trigger for moderators — fires the job immediately
Devvit.addMenuItem({
  label: 'Post Daily Shapes Now',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.scheduler.runJob({
      name: 'create-daily-post',
      runAt: new Date(),
      data: { subredditName: subreddit.name },
    });
    context.ui.showToast({ text: 'Daily Shapes post triggered!' });
  },
});

// Clear the "already posted" flag so the job can re-post today
Devvit.addMenuItem({
  label: 'Clear Posted Flag (Daily Shapes)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const dayKey = getTodayKey();
    const postedKey = `posted:${dayKey}`;
    await context.redis.del(postedKey);
    context.ui.showToast({ text: `Cleared posted flag for ${dayKey}. You can now use "Post Daily Shapes Now".` });
  },
});

// ============================================================
// CUSTOM POST TYPE (game only - no admin mode)
// ============================================================

Devvit.addCustomPostType({
  name: 'Daily Shapes',
  description: 'A daily puzzle game - cut shapes into perfect halves!',
  height: 'tall',
  render: (context) => {
    const onMessage = async (msg: any) => {
      const username = (await context.reddit.getCurrentUser())?.username ?? 'anonymous';

      switch (msg.type) {
        case 'INIT_REQUEST': {
          // Use the post's original dayKey so old posts serve their own day's data
          let dayKey: string;
          const postId = context.postId;
          if (postId) {
            let storedDayKey = await context.redis.get(redisKeys.postDay(postId));
            if (!storedDayKey) {
              // Legacy post: derive dayKey from post creation date (Melbourne TZ)
              try {
                const post = await context.reddit.getPostById(postId);
                if (post?.createdAt) {
                  const created = new Date(post.createdAt);
                  const melb = new Date(created.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
                  const yy = String(melb.getFullYear()).slice(2);
                  const mm = String(melb.getMonth() + 1).padStart(2, '0');
                  const dd = String(melb.getDate()).padStart(2, '0');
                  storedDayKey = `${yy}${mm}${dd}`;
                  // Cache for future requests
                  await context.redis.set(redisKeys.postDay(postId), storedDayKey);
                }
              } catch (e) {
                console.log('Failed to derive dayKey from post creation date:', e);
              }
            }
            dayKey = storedDayKey || getTodayKey();
          } else {
            dayKey = getTodayKey();
          }
          const dayNum = getDayNumberForKey(dayKey);
          const dow = getDayOfWeekForKey(dayKey);
          const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultWithUndoMechanic';

          const shapes: string[] = [];
          for (let i = 0; i < 10; i++) {
            const shapeData = await context.redis.get(redisKeys.shape(dayKey, i));
            if (shapeData) shapes.push(shapeData);
          }

          const existingProgress = await context.redis.get(
            redisKeys.progress(dayKey, username)
          ) ?? null;

          const existingScoreStr = await context.redis.get(
            redisKeys.userScore(dayKey, username)
          );
          const existingScore = existingScoreStr ? parseInt(existingScoreStr, 10) : null;

          // Retrieve per-shape scores for radar graph on revisit
          const existingShapeScoresStr = existingScore != null
            ? await context.redis.get(redisKeys.userShapeScores(dayKey, username))
            : null;
          const existingShapeScores = existingShapeScoresStr
            ? JSON.parse(existingShapeScoresStr)
            : null;

          const rawLeaderboard = await context.redis.zRange(
            redisKeys.leaderboard(dayKey), 0, 9, { reverse: true, by: 'rank' }
          );
          const leaderboard: LeaderboardEntry[] = rawLeaderboard.map((entry, idx) => ({
            username: entry.member,
            score: entry.score,
            rank: idx + 1,
          }));

          // All leaderboards
          const weekKey = getWeekKey();
          const weekly = await fetchLeaderboard(context.redis, redisKeys.weeklyLeaderboard(weekKey), username);
          const wins = await fetchLeaderboard(context.redis, redisKeys.weeklyWins, username);
          const cuts = await fetchLeaderboard(context.redis, redisKeys.perfectCuts, username);

          context.ui.webView.postMessage('game-webview', {
            type: 'INIT_RESPONSE',
            data: {
              username,
              dayKey,
              dayNumber: dayNum,
              dayOfWeek: dow,
              shapes,
              mechanic,
              existingProgress,
              existingScore,
              existingShapeScores,
              leaderboard,
              weeklyLeaderboard: weekly.entries,
              weekKey,
              userWeeklyScore: weekly.userScore,
              userWeeklyRank: weekly.userRank,
              weeklyWins: wins.entries,
              userWeeklyWins: wins.userScore,
              userWeeklyWinsRank: wins.userRank,
              perfectCuts: cuts.entries,
              userPerfectCuts: cuts.userScore,
              userPerfectCutsRank: cuts.userRank,
              postTitle: `Daily Shapes - ${getFormattedDateForKey(dayKey)} - ${getFriendlyMechanicName(mechanic)}`,
            } as InitData,
          } as any);
          break;
        }

        case 'SUBMIT_SCORE': {
          const { scores, total } = msg.data;
          // Use post's dayKey instead of client-sent dayKey for score integrity
          const dayKey = context.postId
            ? (await context.redis.get(redisKeys.postDay(context.postId)) || msg.data.dayKey)
            : msg.data.dayKey;

          // Prevent duplicate daily scores — only the first submission counts
          const alreadyScored = await context.redis.get(redisKeys.userScore(dayKey, username));
          if (alreadyScored !== undefined && alreadyScored !== null) {
            console.log(`User ${username} already scored ${alreadyScored} for ${dayKey}, ignoring new score ${total}`);
            context.ui.webView.postMessage('game-webview', {
              type: 'ALREADY_SCORED',
              data: { existingScore: parseInt(alreadyScored, 10) },
            } as any);
            break;
          }

          // Store daily score
          await context.redis.set(redisKeys.userScore(dayKey, username), String(total));
          await context.redis.zAdd(redisKeys.leaderboard(dayKey), { member: username, score: total });

          // Store per-shape scores for radar graph on revisit
          if (scores) {
            await context.redis.set(
              redisKeys.userShapeScores(dayKey, username),
              JSON.stringify(scores)
            );
          }

          // Update weekly leaderboard (accumulate scores Mon-Sun)
          const weekKey = getWeekKey();
          const currentWeekly = await context.redis.zScore(
            redisKeys.weeklyLeaderboard(weekKey), username
          ) ?? 0;
          const newWeeklyTotal = currentWeekly + total;
          await context.redis.zAdd(redisKeys.weeklyLeaderboard(weekKey), {
            member: username,
            score: newWeeklyTotal,
          });

          // Track perfect cuts (all-time)
          const perfects = countPerfectCuts(scores);
          if (perfects > 0) {
            const currentPerfects = await context.redis.zScore(redisKeys.perfectCuts, username) ?? 0;
            await context.redis.zAdd(redisKeys.perfectCuts, {
              member: username,
              score: currentPerfects + perfects,
            });
          }

          // Update user stats
          const statsKey = redisKeys.userStats(username);
          await context.redis.hIncrBy(statsKey, 'totalGames', 1);
          await context.redis.hIncrBy(statsKey, 'totalScore', total);

          // Fetch all updated leaderboards to send back
          const weeklyLb = await fetchLeaderboard(context.redis, redisKeys.weeklyLeaderboard(weekKey), username);
          const winsLb = await fetchLeaderboard(context.redis, redisKeys.weeklyWins, username);
          const cutsLb = await fetchLeaderboard(context.redis, redisKeys.perfectCuts, username);

          context.ui.webView.postMessage('game-webview', {
            type: 'SCORE_SAVED',
            data: {
              weeklyLeaderboard: weeklyLb.entries,
              userWeeklyScore: weeklyLb.userScore,
              userWeeklyRank: weeklyLb.userRank,
              weeklyWins: winsLb.entries,
              userWeeklyWins: winsLb.userScore,
              userWeeklyWinsRank: winsLb.userRank,
              perfectCuts: cutsLb.entries,
              userPerfectCuts: cutsLb.userScore,
              userPerfectCutsRank: cutsLb.userRank,
            },
          } as any);
          break;
        }

        case 'GET_LEADERBOARD': {
          const { dayKey } = msg.data;
          const rawLeaderboard = await context.redis.zRange(
            redisKeys.leaderboard(dayKey), 0, 19, { reverse: true, by: 'rank' }
          );
          const leaderboard: LeaderboardEntry[] = rawLeaderboard.map((entry, idx) => ({
            username: entry.member,
            score: entry.score,
            rank: idx + 1,
          }));

          context.ui.webView.postMessage('game-webview', {
            type: 'LEADERBOARD_RESPONSE',
            data: leaderboard,
          } as any);
          break;
        }

        case 'GET_WEEKLY_LEADERBOARD': {
          const weekKey = getWeekKey();
          const wkly = await fetchLeaderboard(context.redis, redisKeys.weeklyLeaderboard(weekKey), username);
          const wns = await fetchLeaderboard(context.redis, redisKeys.weeklyWins, username);
          const cts = await fetchLeaderboard(context.redis, redisKeys.perfectCuts, username);

          context.ui.webView.postMessage('game-webview', {
            type: 'WEEKLY_LEADERBOARD_RESPONSE',
            data: {
              weeklyLeaderboard: wkly.entries,
              userWeeklyScore: wkly.userScore,
              userWeeklyRank: wkly.userRank,
              weeklyWins: wns.entries,
              userWeeklyWins: wns.userScore,
              userWeeklyWinsRank: wns.userRank,
              perfectCuts: cts.entries,
              userPerfectCuts: cts.userScore,
              userPerfectCutsRank: cts.userRank,
              weekKey,
            },
          } as any);
          break;
        }

        case 'SAVE_PROGRESS': {
          const { dayKey, progress } = msg.data;
          await context.redis.set(redisKeys.progress(dayKey, username), progress);
          await context.redis.expire(redisKeys.progress(dayKey, username), 172800);
          break;
        }

        case 'GET_PROGRESS': {
          const { dayKey } = msg.data;
          const progress = await context.redis.get(redisKeys.progress(dayKey, username));
          context.ui.webView.postMessage('game-webview', {
            type: 'PROGRESS_RESPONSE',
            data: { progress },
          } as any);
          break;
        }
      }
    };

    return (
      <vstack height="100%" width="100%">
        <webview
          id="game-webview"
          url="index.html"
          onMessage={onMessage}
          grow
        />
      </vstack>
    );
  },
});

export default Devvit;
