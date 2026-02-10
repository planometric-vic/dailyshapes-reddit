import { Devvit, useState } from '@devvit/public-api';

// Enable Redis plugin
Devvit.configure({ redditAPI: true, redis: true });

// ============================================================
// TYPES
// ============================================================

type WebViewMessage =
  | { type: 'INIT_REQUEST' }
  | { type: 'SUBMIT_SCORE'; data: { dayKey: string; scores: number[]; total: number } }
  | { type: 'GET_LEADERBOARD'; data: { dayKey: string } }
  | { type: 'GET_PRACTICE_SHAPE'; data: { dayKey: string; shapeIndex: number } }
  | { type: 'SAVE_PROGRESS'; data: { dayKey: string; progress: string } }
  | { type: 'GET_PROGRESS'; data: { dayKey: string } };

type DevvitMessage =
  | { type: 'INIT_RESPONSE'; data: InitData }
  | { type: 'SCORE_SAVED'; data: { rank: number; total: number } }
  | { type: 'LEADERBOARD_RESPONSE'; data: LeaderboardEntry[] }
  | { type: 'PRACTICE_SHAPE_RESPONSE'; data: { shapeData: string } }
  | { type: 'PROGRESS_RESPONSE'; data: { progress: string | null } };

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
  1: 'DefaultMechanic',             // Monday
  2: 'HorizontalOnlyMechanic',      // Tuesday
  3: 'DiagonalAscendingMechanic',   // Wednesday
  4: 'CircleCutMechanic',           // Thursday
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

// ============================================================
// REDIS KEY HELPERS
// ============================================================

const redisKeys = {
  /** Shape data: shapes:{dayKey}:{shapeIndex} -> GeoJSON string */
  shape: (dayKey: string, index: number) => `shapes:${dayKey}:${index}`,

  /** Daily score: scores:{dayKey}:{username} -> total score */
  userScore: (dayKey: string, username: string) => `scores:${dayKey}:${username}`,

  /** Daily leaderboard sorted set: leaderboard:{dayKey} -> {member: username, score: total} */
  leaderboard: (dayKey: string) => `leaderboard:${dayKey}`,

  /** User progress (in-progress game state): progress:{dayKey}:{username} -> JSON */
  progress: (dayKey: string, username: string) => `progress:${dayKey}:${username}`,

  /** Monthly competition sorted set: competition:{YYMM} -> {member: username, score: cumulative} */
  competition: (yearMonth: string) => `competition:${yearMonth}`,

  /** All-time stats: stats:{username} -> hash {totalGames, totalScore, streak, ...} */
  userStats: (username: string) => `stats:${username}`,
};

// ============================================================
// MENU ACTIONS
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
    const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultMechanic';

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

/** Admin action to upload shapes for a day */
Devvit.addMenuItem({
  label: 'Upload Shapes (Daily Shapes)',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    context.ui.showToast({
      text: 'Use the scheduled job or API to upload shapes. See README for instructions.',
    });
  },
});

// ============================================================
// SCHEDULED JOBS
// ============================================================

/** Daily puzzle post creation job */
Devvit.addSchedulerJob({
  name: 'create-daily-post',
  onRun: async (_event, context) => {
    const dayKey = getTodayKey();
    const dayNum = getDayNumber();
    const dow = getDayOfWeek();
    const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultMechanic';

    // Check if shapes exist for today
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
// CUSTOM POST TYPE
// ============================================================

Devvit.addCustomPostType({
  name: 'Daily Shapes',
  description: 'A daily puzzle game - cut shapes into perfect halves!',
  height: 'tall',
  render: (context) => {
    const [launched, setLaunched] = useState(false);

    const onMessage = async (msg: WebViewMessage) => {
      const username = (await context.reddit.getCurrentUser())?.username ?? 'anonymous';

      switch (msg.type) {
        case 'INIT_REQUEST': {
          const dayKey = getTodayKey();
          const dayNum = getDayNumber();
          const dow = getDayOfWeek();
          const mechanic = MECHANIC_SCHEDULE[dow] || 'DefaultMechanic';

          // Load today's shapes from Redis
          const shapes: string[] = [];
          for (let i = 0; i < 3; i++) {
            const shapeData = await context.redis.get(redisKeys.shape(dayKey, i));
            if (shapeData) shapes.push(shapeData);
          }

          // Load existing progress
          const existingProgress = await context.redis.get(
            redisKeys.progress(dayKey, username)
          );

          // Load existing score
          const existingScoreStr = await context.redis.get(
            redisKeys.userScore(dayKey, username)
          );
          const existingScore = existingScoreStr ? parseInt(existingScoreStr, 10) : null;

          // Load leaderboard (top 10)
          const rawLeaderboard = await context.redis.zRange(
            redisKeys.leaderboard(dayKey), 0, 9, { reverse: true, by: 'rank' }
          );
          const leaderboard: LeaderboardEntry[] = rawLeaderboard.map((entry, idx) => ({
            username: entry.member,
            score: entry.score,
            rank: idx + 1,
          }));

          const initData: InitData = {
            username,
            dayKey,
            dayNumber: dayNum,
            dayOfWeek: dow,
            shapes,
            mechanic,
            existingProgress,
            existingScore,
            leaderboard,
            postTitle: `Daily Shapes #${dayNum}`,
          };

          context.ui.webView.postMessage('game-webview', {
            type: 'INIT_RESPONSE',
            data: initData,
          } as DevvitMessage);
          break;
        }

        case 'SUBMIT_SCORE': {
          const { dayKey, scores, total } = msg.data;

          // Save individual score
          await context.redis.set(
            redisKeys.userScore(dayKey, username),
            String(total)
          );

          // Add to daily leaderboard
          await context.redis.zAdd(redisKeys.leaderboard(dayKey), {
            member: username,
            score: total,
          });

          // Add to monthly competition
          const yearMonth = dayKey.substring(0, 4); // YYMM
          const currentMonthly = await context.redis.zScore(
            redisKeys.competition(yearMonth),
            username
          );
          await context.redis.zAdd(redisKeys.competition(yearMonth), {
            member: username,
            score: (currentMonthly ?? 0) + total,
          });

          // Update user stats
          const statsKey = redisKeys.userStats(username);
          await context.redis.hIncrBy(statsKey, 'totalGames', 1);
          await context.redis.hIncrBy(statsKey, 'totalScore', total);

          // Get rank
          const rank = await context.redis.zRank(
            redisKeys.leaderboard(dayKey),
            username
          );

          const leaderboardSize = await context.redis.zCard(
            redisKeys.leaderboard(dayKey)
          );

          context.ui.webView.postMessage('game-webview', {
            type: 'SCORE_SAVED',
            data: { rank: rank !== undefined ? rank + 1 : -1, total: leaderboardSize },
          } as DevvitMessage);
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
          } as DevvitMessage);
          break;
        }

        case 'SAVE_PROGRESS': {
          const { dayKey, progress } = msg.data;
          await context.redis.set(
            redisKeys.progress(dayKey, username),
            progress
          );
          // Expire after 48 hours
          await context.redis.expire(
            redisKeys.progress(dayKey, username),
            172800
          );
          break;
        }

        case 'GET_PROGRESS': {
          const { dayKey } = msg.data;
          const progress = await context.redis.get(
            redisKeys.progress(dayKey, username)
          );
          context.ui.webView.postMessage('game-webview', {
            type: 'PROGRESS_RESPONSE',
            data: { progress },
          } as DevvitMessage);
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
          onMessage={onMessage as (msg: any) => void | Promise<void>}
          grow
        />
      </vstack>
    );
  },
});

export default Devvit;
