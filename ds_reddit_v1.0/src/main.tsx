import { Devvit, useState } from '@devvit/public-api';

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
  shapes: string[];       // GeoJSON strings for today's 3 shapes
  mechanic: string;       // Mechanic name for today
  existingProgress: string | null;
  existingScore: number | null;
  leaderboard: LeaderboardEntry[];
  weeklyLeaderboard: LeaderboardEntry[];
  weekKey: string;
  userWeeklyScore: number;
  userWeeklyRank: number;
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

// ============================================================
// REDIS KEY HELPERS
// ============================================================

const redisKeys = {
  shape: (dayKey: string, index: number) => `shapes:${dayKey}:${index}`,
  userScore: (dayKey: string, username: string) => `scores:${dayKey}:${username}`,
  leaderboard: (dayKey: string) => `leaderboard:${dayKey}`,
  weeklyLeaderboard: (weekKey: string) => `weekly:${weekKey}`,
  progress: (dayKey: string, username: string) => `progress:${dayKey}:${username}`,
  userStats: (username: string) => `stats:${username}`,
};

// ============================================================
// MENU ACTIONS & FORMS
// ============================================================

/** Admin action to create today's daily puzzle post */
Devvit.addMenuItem({
  label: 'Create Daily Shapes Puzzle',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const dayKey = getTodayKey();
    const dayNum = getDayNumber();
    const dow = getDayOfWeek();
    const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultWithUndoMechanic';

    const subreddit = await context.reddit.getCurrentSubreddit();
    const post = await context.reddit.submitPost({
      title: `Daily Shapes #${dayNum} - ${mechanic.replace('Mechanic', '')}`,
      subredditName: subreddit.name,
      preview: (
        <vstack alignment="center middle" padding="large" backgroundColor="#1a1a2e">
          <text size="xxlarge" weight="bold" color="white">Daily Shapes #{dayNum}</text>
          <spacer size="medium" />
          <text size="large" color="#e0e0e0">Loading puzzle...</text>
        </vstack>
      ),
    });

    context.ui.showToast({ text: `Daily Shapes #${dayNum} created!` });
    context.ui.navigateTo(post);
  },
});

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
    description: 'Paste the JSON payload from prepare-upload.cjs. Format: { "YYMMDD": [geojson0, geojson1, geojson2], ... }',
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
      // Support both array format [obj0, obj1, obj2] and object format {"0": ..., "1": ..., "2": ...}
      const shapeArray = Array.isArray(dayShapes)
        ? dayShapes
        : [dayShapes['0'] ?? dayShapes[0], dayShapes['1'] ?? dayShapes[1], dayShapes['2'] ?? dayShapes[2]];

      for (let i = 0; i < shapeArray.length; i++) {
        if (i > 2) break;
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

    for (let i = 0; i < 3; i++) {
      const data = await context.redis.get(redisKeys.shape(dayKey, i));
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const featureCount = parsed.features?.length ?? 0;
          results.push(`Shape ${i + 1}: ${featureCount} feature(s), ${data.length} bytes`);
        } catch {
          results.push(`Shape ${i + 1}: stored (${data.length} bytes, parse error)`);
        }
      } else {
        results.push(`Shape ${i + 1}: MISSING`);
      }
    }

    context.ui.showToast({
      text: `Day ${dayKey}: ${results.join(' | ')}`,
    });
  },
});

// ============================================================
// SCHEDULED JOBS
// ============================================================

Devvit.addSchedulerJob({
  name: 'create-daily-post',
  onRun: async (_event, context) => {
    const dayKey = getTodayKey();
    const dayNum = getDayNumber();
    const dow = getDayOfWeek();
    const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultWithUndoMechanic';

    const shape0 = await context.redis.get(redisKeys.shape(dayKey, 0));
    if (!shape0) {
      console.log(`No shapes uploaded for ${dayKey}, skipping daily post`);
      return;
    }

    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.reddit.submitPost({
      title: `Daily Shapes #${dayNum} - ${mechanic.replace('Mechanic', '')}`,
      subredditName: subreddit.name,
      preview: (
        <vstack alignment="center middle" padding="large" backgroundColor="#1a1a2e">
          <text size="xxlarge" weight="bold" color="white">Daily Shapes #{dayNum}</text>
          <spacer size="medium" />
          <text size="large" color="#e0e0e0">Loading puzzle...</text>
        </vstack>
      ),
    });

    console.log(`Daily Shapes #${dayNum} post created for ${dayKey}`);
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
    const [launched, setLaunched] = useState(false);

    const onMessage = async (msg: any) => {
      const username = (await context.reddit.getCurrentUser())?.username ?? 'anonymous';

      switch (msg.type) {
        case 'INIT_REQUEST': {
          const dayKey = getTodayKey();
          const dayNum = getDayNumber();
          const dow = getDayOfWeek();
          const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultWithUndoMechanic';

          const shapes: string[] = [];
          for (let i = 0; i < 3; i++) {
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

          const rawLeaderboard = await context.redis.zRange(
            redisKeys.leaderboard(dayKey), 0, 9, { reverse: true, by: 'rank' }
          );
          const leaderboard: LeaderboardEntry[] = rawLeaderboard.map((entry, idx) => ({
            username: entry.member,
            score: entry.score,
            rank: idx + 1,
          }));

          // Weekly leaderboard (Mon-Sun)
          const weekKey = getWeekKey();
          const rawWeekly = await context.redis.zRange(
            redisKeys.weeklyLeaderboard(weekKey), 0, 19, { reverse: true, by: 'rank' }
          );
          const weeklyLeaderboard: LeaderboardEntry[] = rawWeekly.map((entry, idx) => ({
            username: entry.member,
            score: entry.score,
            rank: idx + 1,
          }));
          const userWeeklyScore = await context.redis.zScore(
            redisKeys.weeklyLeaderboard(weekKey), username
          ) ?? 0;
          const userWeeklyRank = await context.redis.zRank(
            redisKeys.weeklyLeaderboard(weekKey), username
          );

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
              leaderboard,
              weeklyLeaderboard,
              weekKey,
              userWeeklyScore,
              userWeeklyRank: userWeeklyRank !== undefined ? userWeeklyRank + 1 : -1,
              postTitle: `Daily Shapes #${dayNum}`,
            } as InitData,
          } as any);
          break;
        }

        case 'SUBMIT_SCORE': {
          const { dayKey, scores, total } = msg.data;

          // Store daily score
          await context.redis.set(redisKeys.userScore(dayKey, username), String(total));
          await context.redis.zAdd(redisKeys.leaderboard(dayKey), { member: username, score: total });

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

          // Update user stats
          const statsKey = redisKeys.userStats(username);
          await context.redis.hIncrBy(statsKey, 'totalGames', 1);
          await context.redis.hIncrBy(statsKey, 'totalScore', total);

          // Get updated weekly leaderboard to send back
          const rawWeekly = await context.redis.zRange(
            redisKeys.weeklyLeaderboard(weekKey), 0, 19, { reverse: true, by: 'rank' }
          );
          const weeklyLeaderboard: LeaderboardEntry[] = rawWeekly.map((entry, idx) => ({
            username: entry.member,
            score: entry.score,
            rank: idx + 1,
          }));
          const userWeeklyRank = await context.redis.zRank(
            redisKeys.weeklyLeaderboard(weekKey), username
          );

          context.ui.webView.postMessage('game-webview', {
            type: 'SCORE_SAVED',
            data: {
              weeklyLeaderboard,
              userWeeklyScore: newWeeklyTotal,
              userWeeklyRank: userWeeklyRank !== undefined ? userWeeklyRank + 1 : -1,
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
          const rawWeekly = await context.redis.zRange(
            redisKeys.weeklyLeaderboard(weekKey), 0, 19, { reverse: true, by: 'rank' }
          );
          const weeklyLb: LeaderboardEntry[] = rawWeekly.map((entry, idx) => ({
            username: entry.member,
            score: entry.score,
            rank: idx + 1,
          }));
          const userWScore = await context.redis.zScore(
            redisKeys.weeklyLeaderboard(weekKey), username
          ) ?? 0;
          const userWRank = await context.redis.zRank(
            redisKeys.weeklyLeaderboard(weekKey), username
          );

          context.ui.webView.postMessage('game-webview', {
            type: 'WEEKLY_LEADERBOARD_RESPONSE',
            data: {
              weeklyLeaderboard: weeklyLb,
              userWeeklyScore: userWScore,
              userWeeklyRank: userWRank !== undefined ? userWRank + 1 : -1,
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

    if (!launched) {
      return (
        <vstack
          alignment="center middle"
          height="100%"
          backgroundColor="#1a1a2e"
          gap="large"
          padding="large"
        >
          <vstack alignment="center middle" gap="small">
            <text size="xxlarge" weight="bold" color="white">
              DAILY SHAPES
            </text>
            <text size="medium" color="#b0b0b0">
              Cut shapes into perfect halves
            </text>
          </vstack>

          <vstack alignment="center middle" gap="small">
            <text size="small" color="#808080">
              3 shapes. 2 attempts each. How close to 50/50 can you cut?
            </text>
          </vstack>

          <button
            appearance="primary"
            size="large"
            onPress={() => setLaunched(true)}
          >
            PLAY
          </button>
        </vstack>
      );
    }

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
