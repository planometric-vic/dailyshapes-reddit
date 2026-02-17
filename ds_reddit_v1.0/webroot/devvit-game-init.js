/**
 * Devvit Game Initializer
 * Hooks into the original game's initialization flow to load shapes from
 * Devvit init data instead of Supabase.
 *
 * This file MUST be loaded AFTER main.js and all mechanics.
 * It overrides the Supabase-dependent initialization with Devvit-compatible logic.
 *
 * Shape loading priority:
 *   1. Redis shapes (sent in INIT_RESPONSE from backend)
 *   2. Bundled shapes in webroot/assets/shapes/YYMMDD-01.geojson etc.
 */

(function() {
    'use strict';

    console.log('[Devvit Init] Game initializer loaded, waiting for Devvit data...');

    // Map day-of-week to mechanic class name (matching original main.js)
    const dayMechanics = {
        0: 'RotatingShapeVectorMechanic', // Sunday
        1: 'DefaultWithUndoMechanic',     // Monday
        2: 'HorizontalOnlyMechanic',      // Tuesday
        3: 'CircleCutMechanic',           // Wednesday
        4: 'DiagonalAscendingMechanic',   // Thursday
        5: 'ThreePointTriangleMechanic',  // Friday
        6: 'RotatingSquareMechanic',      // Saturday
    };

    /**
     * Try loading bundled shapes from webroot/assets/shapes/
     * Uses your naming format: YYMMDD-01.geojson, YYMMDD-02.geojson, YYMMDD-03.geojson
     */
    async function loadBundledShapes(dayKey) {
        const shapes = [];
        for (let i = 1; i <= 3; i++) {
            const filename = `${dayKey}-0${i}.geojson`;
            const url = `assets/shapes/${filename}`;
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const geojson = await response.json();
                    shapes.push(geojson);
                    console.log(`[Devvit Init] Loaded bundled shape: ${filename}`);
                } else {
                    console.log(`[Devvit Init] Bundled shape not found: ${filename} (${response.status})`);
                }
            } catch (e) {
                console.log(`[Devvit Init] Could not load bundled shape: ${filename}`, e);
            }
        }
        return shapes;
    }

    /**
     * Restore mid-game progress from Redis-backed state.
     * Called when existingProgress is found in INIT_RESPONSE (user refreshed mid-game).
     * Sets all global variables so the game resumes at the exact point.
     */
    function restoreFromRedisProgress(progress, shapes, mechanicName) {
        console.log('[Devvit Init] Restoring game from Redis progress:', {
            shape: progress.currentShape,
            attempt: progress.currentAttempt,
            totalCuts: progress.totalCutsMade,
            gameState: progress.gameState,
            cutsCount: progress.cuts ? progress.cuts.length : 0
        });

        window.isRestoringGameState = true;

        // Restore core game variables
        window.currentShapeNumber = progress.currentShape || 1;
        window.currentAttemptNumber = progress.currentAttempt || 1;
        window.currentDay = progress.currentDay || 1;
        window.totalCutsMade = progress.totalCutsMade || 0;
        window.cutsMadeThisShape = progress.cutsMadeThisShape || 0;
        window.attemptCount = progress.attemptCount || 0;
        window.currentAttempts = progress.currentAttempts || [];
        window.playButtonClicked = true;

        // Restore dailyGameState
        if (!window.dailyGameState) {
            window.dailyGameState = {};
        }
        window.dailyGameState.isGameStarted = true;
        window.dailyGameState.cuts = progress.cuts || [];
        window.dailyGameState.dayComplete = progress.dayComplete || false;
        window.dailyGameState.isGameComplete = progress.isGameComplete || false;
        window.dailyGameState.completedAt = progress.completedAt || null;
        window.dailyGameState.finalStats = progress.finalStats || null;

        // Also write to localStorage so SimpleRefresh works for subsequent refreshes
        // (localStorage is fresh on each Devvit webview load)
        if (window.SimpleRefresh) {
            try {
                const today = new Date().toLocaleDateString('en-CA');
                const localState = Object.assign({}, progress, {
                    date: today,
                    isGameStarted: true,
                    timestamp: Date.now()
                });
                localStorage.setItem('simple_refresh_' + today, JSON.stringify(localState));
                console.log('[Devvit Init] Wrote Redis progress to localStorage for SimpleRefresh');
            } catch (e) {
                console.warn('[Devvit Init] Could not write to localStorage:', e);
            }
        }

        // Set game state — if the game was in the middle of awaiting_choice,
        // we restore to that state so the "Next Shape" button appears
        if (progress.dayComplete || progress.isGameComplete) {
            window.gameState = 'finished';
        } else {
            window.gameState = progress.gameState || 'playing';
        }

        window.isInteractionEnabled = !(progress.dayComplete || progress.isGameComplete);

        // Clear restoration flag after a delay
        setTimeout(function() {
            window.isRestoringGameState = false;
            console.log('[Devvit Init] Cleared isRestoringGameState flag');
        }, 500);
    }

    /**
     * Show "already played" locked screen when existingScore is found.
     * Renders the radar graph (if shape scores available) and shows the leaderboard.
     */
    function showAlreadyPlayedScreen(score, shapeScores, existingProgress) {
        console.log('[Devvit Init] User already played today, score:', score, 'shapeScores:', shapeScores);

        // Stop loading animation
        if (typeof window.stopImmediateLoadingAnimation === 'function') {
            window.stopImmediateLoadingAnimation(function() {
                drawLockedScreen(score, shapeScores, existingProgress);
            });
        } else {
            drawLockedScreen(score, shapeScores, existingProgress);
        }

        function drawLockedScreen(score, shapeScores, existingProgress) {
            // Hide welcome/play UI
            var welcomeOverlay = document.getElementById('welcomeOverlay');
            if (welcomeOverlay) welcomeOverlay.style.display = 'none';
            var playBtn = document.getElementById('initialPlayButton');
            if (playBtn) playBtn.style.display = 'none';
            var progressDisplay = document.getElementById('demoProgressDisplay');
            if (progressDisplay) progressDisplay.style.display = 'none';

            // Set game state to locked
            window.gameState = 'locked';
            window.isInteractionEnabled = false;
            if (window.dailyGameState) {
                window.dailyGameState.dayComplete = true;
                window.dailyGameState.isGameComplete = true;
            }

            // Mark animation as already shown so completeView renders static radar
            var today = new Date();
            var dateStr = today.getFullYear() + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getDate()).padStart(2, '0');
            localStorage.setItem('dailyShapes_lastAnimationDate', dateStr);

            // Try to build a model from available sources
            var model = null;
            if (shapeScores) {
                model = buildModelFromShapeScores(shapeScores);
                console.log('[Devvit Init] Built model from Redis shapeScores');
            }
            if (!model && existingProgress) {
                model = buildModelFromProgress(existingProgress);
                console.log('[Devvit Init] Built model from existingProgress');
            }
            if (!model) {
                model = buildModelFromLocalStorage();
                console.log('[Devvit Init] Built model from localStorage');
            }

            if (model && model.shapes.length > 0 && window.completeView) {
                console.log('[Devvit Init] Rendering radar graph, shapes:', model.shapes.length);
                window.completeView.show(model);
            } else {
                // Fallback: draw simple text if no shape data from any source
                var canvasEl = document.getElementById('geoCanvas');
                if (canvasEl) {
                    canvasEl.style.display = 'block';
                    var ctx = canvasEl.getContext('2d');
                    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

                    ctx.fillStyle = '#333';
                    ctx.font = 'bold 22px Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText("Today's game complete!", canvasEl.width / 2, canvasEl.height / 2 - 30);

                    ctx.fillStyle = '#666';
                    ctx.font = '16px Arial, sans-serif';
                    ctx.fillText('Your score: ' + score, canvasEl.width / 2, canvasEl.height / 2 + 10);

                    ctx.font = '13px Arial, sans-serif';
                    ctx.fillText('Come back tomorrow for a new game', canvasEl.width / 2, canvasEl.height / 2 + 45);
                }

                // Show weekly leaderboard
                setTimeout(function() {
                    if (window.WeeklyLeaderboard) {
                        window.WeeklyLeaderboard.show();
                    }
                }, 300);
            }
        }
    }

    /**
     * Build a completeView model from per-shape scores stored in Redis.
     * Shape scores format: { shape1: { attempt1: 50 }, shape2: { attempt1: 37 }, ... }
     */
    function buildModelFromShapeScores(shapeScores) {
        var shapes = [];
        for (var i = 1; i <= 10; i++) {
            var key = 'shape' + i;
            var shape = shapeScores[key];
            if (shape) {
                var scoreVal = typeof shape === 'number' ? shape : (shape.attempt1 || 0);
                shapes.push({
                    name: 'Shape ' + i,
                    shapeNumber: i,
                    attempts: [{
                        n: 1,
                        leftPct: scoreVal,
                        rightPct: 100 - scoreVal,
                        scorePct: scoreVal
                    }]
                });
            }
        }
        if (shapes.length === 0) return null;
        return { dayNumber: window.currentDay || 1, avgScorePct: 0, shapes: shapes, bestCut: null, avgScore: 0, shapeSplits: shapes };
    }

    /**
     * Build model from existingProgress (Redis saved SimpleRefresh state).
     * Progress format: JSON string with finalStats or shape data from dailyGameState.
     */
    function buildModelFromProgress(progress) {
        try {
            var state = typeof progress === 'string' ? JSON.parse(progress) : progress;
            if (!state) return null;
            // Try to build from the cuts array in progress
            // Each cut has leftPercentage, rightPercentage
            if (state.cuts && state.cuts.length > 0) {
                return buildModelFromCuts(state.cuts);
            }
        } catch (e) {
            console.warn('[Devvit Init] Failed to parse existingProgress:', e);
        }
        return null;
    }

    /**
     * Build model from cuts array (from progress state).
     */
    function buildModelFromCuts(cuts) {
        var shapes = [];
        for (var i = 0; i < cuts.length && i < 10; i++) {
            var cut = cuts[i];
            if (cut && cut.leftPercentage !== undefined) {
                var leftPct = cut.leftPercentage;
                var rightPct = cut.rightPercentage || (100 - leftPct);
                shapes.push({
                    name: 'Shape ' + (i + 1),
                    shapeNumber: i + 1,
                    attempts: [{
                        n: 1,
                        leftPct: leftPct,
                        rightPct: rightPct,
                        scorePct: Math.min(leftPct, rightPct)
                    }]
                });
            }
        }
        if (shapes.length === 0) return null;
        return { dayNumber: window.currentDay || 1, avgScorePct: 0, shapes: shapes, bestCut: null, avgScore: 0, shapeSplits: shapes };
    }

    /**
     * Build model from localStorage dailyStats (demoGameDailyStats).
     */
    function buildModelFromLocalStorage() {
        try {
            var savedStats = localStorage.getItem('demoGameDailyStats');
            if (!savedStats) return null;
            var dailyStats = JSON.parse(savedStats);
            var dayKey = 'day' + (window.currentDay || 1);
            var dayData = dailyStats[dayKey];
            if (!dayData) return null;

            var shapes = [];
            for (var i = 1; i <= 10; i++) {
                var shapeKey = 'shape' + i;
                var shapeAttempts = dayData[shapeKey];
                if (shapeAttempts && shapeAttempts.length > 0) {
                    var attempt = shapeAttempts[0];
                    if (attempt && attempt.leftPercentage !== undefined) {
                        shapes.push({
                            name: 'Shape ' + i,
                            shapeNumber: i,
                            attempts: [{
                                n: 1,
                                leftPct: attempt.leftPercentage,
                                rightPct: attempt.rightPercentage || (100 - attempt.leftPercentage),
                                scorePct: Math.min(attempt.leftPercentage, attempt.rightPercentage || (100 - attempt.leftPercentage))
                            }]
                        });
                    }
                }
            }
            if (shapes.length === 0) return null;
            return { dayNumber: window.currentDay || 1, avgScorePct: 0, shapes: shapes, bestCut: null, avgScore: 0, shapeSplits: shapes };
        } catch (e) {
            console.warn('[Devvit Init] Failed to read localStorage stats:', e);
            return null;
        }
    }

    // Wait for Devvit init data, then bootstrap the game
    window.addEventListener('devvit-init', async (event) => {
        const initData = event.detail;
        console.log('[Devvit Init] Bootstrapping game with:', {
            username: initData.username,
            dayKey: initData.dayKey,
            dayNumber: initData.dayNumber,
            dayOfWeek: initData.dayOfWeek,
            mechanic: initData.mechanic,
            shapeCount: initData.shapes?.length || 0,
            hasExistingScore: initData.existingScore !== null && initData.existingScore !== undefined,
            hasExistingProgress: !!initData.existingProgress
        });

        // Wait for DOM ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        // Set up canvas if not already done
        const canvasEl = document.getElementById('geoCanvas');
        if (canvasEl && !window.canvas) {
            window.canvas = canvasEl;
            if (typeof setupCanvasForCrispRendering === 'function') {
                window.ctx = setupCanvasForCrispRendering(canvasEl);
            } else {
                canvasEl.width = 380;
                canvasEl.height = 380;
                window.ctx = canvasEl.getContext('2d');
                window.ctx.imageSmoothingEnabled = false;
            }
        }

        // Set game mode flags
        window.isDemoMode = true;
        window.isDailyMode = false;
        window.isPracticeMode = false;
        window.isSupabaseMode = false;

        // Set day of week (1-7, where 7=Sunday, matching original main.js)
        const dow = initData.dayOfWeek; // 0=Sun, 6=Sat
        window.currentDay = dow === 0 ? 7 : dow; // Convert to 1-7

        // Determine mechanic
        const mechanicName = initData.mechanic || dayMechanics[dow] || 'DefaultWithUndoMechanic';
        console.log('[Devvit Init] Mechanic:', mechanicName, 'Day:', window.currentDay);

        // ============================================================
        // GATE 1: If user already submitted a score today, lock the game
        // ============================================================
        if (initData.existingScore !== null && initData.existingScore !== undefined) {
            console.log('[Devvit Init] GATE 1: User already scored today:', initData.existingScore);
            applyOverrides();
            showAlreadyPlayedScreen(initData.existingScore, initData.existingShapeScores, initData.existingProgress);
            return;
        }

        // Parse shapes from init data (Redis)
        let shapes = (initData.shapes || []).map(s => {
            try {
                return typeof s === 'string' ? JSON.parse(s) : s;
            } catch (e) {
                console.error('[Devvit Init] Failed to parse shape:', e);
                return null;
            }
        }).filter(Boolean);

        // Fallback: try loading bundled shapes from webroot
        if (shapes.length === 0) {
            console.log('[Devvit Init] No Redis shapes, trying bundled shapes...');
            shapes = await loadBundledShapes(initData.dayKey);
        }

        if (shapes.length === 0) {
            console.error('[Devvit Init] No shapes found in Redis or bundled files!');
            showNoShapesMessage();
            return;
        }

        console.log('[Devvit Init] Loaded', shapes.length, 'shapes');

        // Store shapes for the demo flow to access
        window.devvitParsedShapes = shapes;
        // Also store total shape count for the game flow
        window.devvitTotalShapes = shapes.length;

        // Ensure currentShapeNumber is set (1-based, needed for getDailyCutShadingColor)
        if (!window.currentShapeNumber) {
            window.currentShapeNumber = 1;
        }

        // Override the demo shape loader to return our Devvit shapes
        window.loadDemoShape = function(dayNumber, shapeNumber) {
            console.log('[Devvit Init] loadDemoShape called for day', dayNumber, 'shape', shapeNumber);
            const shapeIndex = shapeNumber - 1; // Convert 1-based to 0-based
            const geojson = shapes[shapeIndex];

            if (!geojson) {
                console.error('[Devvit Init] Shape not found:', shapeIndex);
                return Promise.reject('Shape not found');
            }

            // Update currentShapeNumber so getDailyCutShadingColor() returns correct color
            window.currentShapeNumber = shapeNumber;

            // Parse and set the shape
            if (typeof parseGeometry === 'function') {
                const result = parseGeometry(geojson);
                window.parsedShapes = result.shapes;
                parsedShapes = result.shapes;

                // Render the shape
                if (typeof redrawCanvas === 'function') {
                    redrawCanvas();
                }
            }

            return Promise.resolve(geojson);
        };

        // Override loadSupabaseShape to also use Devvit shapes
        window.loadSupabaseShape = window.loadDemoShape;

        // ============================================================
        // GATE 2: If user has mid-game progress, restore it
        // ============================================================
        let hasRedisProgress = false;
        if (initData.existingProgress) {
            try {
                const progress = typeof initData.existingProgress === 'string'
                    ? JSON.parse(initData.existingProgress)
                    : initData.existingProgress;

                if (progress && progress.isGameStarted && progress.totalCutsMade > 0) {
                    console.log('[Devvit Init] GATE 2: Restoring mid-game progress from Redis');
                    restoreFromRedisProgress(progress, shapes, mechanicName);
                    hasRedisProgress = true;
                }
            } catch (e) {
                console.error('[Devvit Init] Failed to parse existingProgress:', e);
            }
        }

        // NOTE: Do NOT call stopImmediateLoadingAnimation() here!
        // initializeDemoGame() calls it internally with showWelcomeScreen as the
        // callback. If we call it first, the callback slot gets taken and
        // showWelcomeScreen never runs.

        // Try to use the existing demo game initialization
        if (typeof initializeDemoGame === 'function') {
            console.log('[Devvit Init] Using initializeDemoGame()');
            try {
                await initializeDemoGame();
            } catch (e) {
                console.error('[Devvit Init] initializeDemoGame failed:', e);
                // Fall back to manual init
                manualInit(mechanicName, shapes[0]);
            }
        } else {
            console.log('[Devvit Init] initializeDemoGame not found, using manual init');
            manualInit(mechanicName, shapes[0]);
        }

        // If we restored from Redis, the SimpleRefresh.restore() call inside
        // initializeDemoGame will pick up the localStorage state we wrote
        // in restoreFromRedisProgress(), so the game state gets fully restored
        // through the existing restoration pipeline.
        if (hasRedisProgress) {
            console.log('[Devvit Init] Redis progress was injected into localStorage — SimpleRefresh will handle visual restoration');

            // Safety net: after initializeDemoGame finishes, ensure the canvas
            // is interactive if the game state says we should be cutting.
            // main.js sets isShapeAnimationComplete=true during restore, but
            // interaction may still fail if mechanic listeners weren't re-bound.
            setTimeout(function() {
                var gs = window.gameState;
                var shouldActivate = (gs === 'cutting' || gs === 'playing');
                console.log('[Devvit Init] Post-restore activation check:', {
                    gameState: gs, shouldActivate: shouldActivate,
                    isInteractionEnabled: window.isInteractionEnabled
                });

                if (shouldActivate && !window.isInteractionEnabled) {
                    // Force-enable interaction bypassing the animation gate
                    window.isInteractionEnabled = true;

                    var canvasEl = document.getElementById('geoCanvas');
                    if (canvasEl) {
                        canvasEl.style.pointerEvents = 'auto';
                        canvasEl.style.cursor = 'crosshair';
                    }

                    if (typeof setupMechanicsEventListeners === 'function') {
                        setupMechanicsEventListeners();
                    }

                    console.log('[Devvit Init] Canvas force-activated for restored game');
                }
            }, 600);
        }

        applyOverrides();
    });

    /** Apply all post-init overrides (no-ops, stubs, etc.) */
    function applyOverrides() {
        // Prevent main.js DOMContentLoaded from running a second initialization.
        // main.js waits up to 5s for supabaseIntegrationActive, then calls either
        // initializeSupabaseGameMode() or initializeDemoGame(). Replace both with
        // no-ops since we already initialized above.
        console.log('[Devvit Init] Replacing init functions with no-ops to prevent double init');
        window.initializeDemoGame = function() {
            console.log('[Devvit] initializeDemoGame already ran - skipping');
            return Promise.resolve();
        };
        window.initializeSupabaseGameMode = function() {
            console.log('[Devvit] initializeSupabaseGameMode blocked - using Devvit init');
            return Promise.resolve();
        };

        // Override Supabase-dependent functions that crash on Reddit.
        // checkIfUserHasPlayedToday calls SupabaseConfig.isReady() which gets
        // destroyed when local-competition-demo.js overwrites SupabaseConfig.
        window.checkIfUserHasPlayedToday = async function() { return false; };
        window.syncServerCompletionState = async function() {};

        // Stub countdown functions - no daily countdown in Reddit (new post each day).
        // CSS hides the UI, but the JS intervals still fire. Replace with no-ops.
        window.startDailyCountdown = function() { return function() {}; };
        window.startNextGameCountdown = function() {};

        // Override competition prompt to show weekly leaderboard instead.
        // complete-view.js calls showCompetitionPromptModal() ~2s after
        // the radar animation finishes and the score is totalled.
        // It's gated by hasShownCompetitionPromptToday() which checks localStorage,
        // so clear the flag so our override always fires.
        localStorage.removeItem('dailyShapes_lastCompetitionPromptDate');
        window.showCompetitionPromptModal = function() {
            console.log('[Devvit] Showing weekly leaderboard (post-game)');
            if (window.WeeklyLeaderboard) {
                window.WeeklyLeaderboard.show();
            }
        };

        // Remove Share Score / Competitions buttons from completion view.
        // complete-view.js creates #post-canvas-actions after animation.
        // CSS hides it, but also override the creator function as no-op.
        window.createPostCanvasActions = function() {
            console.log('[Devvit] createPostCanvasActions suppressed');
        };

        // local-competition-demo.js overwrites CompetitionManager on DOMContentLoaded,
        // removing parseJoinLink/clearJoinLink. Patch it back after a delay.
        setTimeout(function() {
            if (window.CompetitionManager) {
                if (typeof window.CompetitionManager.parseJoinLink !== 'function') {
                    window.CompetitionManager.parseJoinLink = function() { return null; };
                }
                if (typeof window.CompetitionManager.clearJoinLink !== 'function') {
                    window.CompetitionManager.clearJoinLink = function() {};
                }
            }
        }, 100);
    }

    function manualInit(mechanicName, firstShape) {
        console.log('[Devvit Init] Manual initialization with', mechanicName);

        // Ensure shape number is set for correct coloring
        window.currentShapeNumber = 1;

        // Parse the first shape
        if (typeof parseGeometry === 'function' && firstShape) {
            const result = parseGeometry(firstShape);
            window.parsedShapes = result.shapes;
            if (typeof window.parsedShapes !== 'undefined') {
                parsedShapes = result.shapes;
            }
        }

        // Load the mechanic
        if (typeof loadDemoMechanic === 'function') {
            loadDemoMechanic(mechanicName);
        } else {
            // Manual mechanic loading
            const MechanicClass = window[mechanicName];
            if (MechanicClass) {
                window.currentMechanic = MechanicClass;
                currentMechanic = MechanicClass;
                if (MechanicClass.init) MechanicClass.init();
            }
        }

        // Set game state
        if (typeof setGameState === 'function') {
            setGameState('cutting');
        } else {
            window.gameState = 'cutting';
            gameState = 'cutting';
        }

        window.isInteractionEnabled = true;
        isInteractionEnabled = true;

        // Set up event listeners
        if (typeof setupMechanicsEventListeners === 'function') {
            setupMechanicsEventListeners();
        }

        // Draw
        if (typeof redrawCanvas === 'function') {
            redrawCanvas();
        }
    }

    function showNoShapesMessage() {
        // Stop loading animation if running
        if (typeof window.stopImmediateLoadingAnimation === 'function') {
            window.stopImmediateLoadingAnimation(function() {
                displayMessage();
            });
        } else {
            displayMessage();
        }

        function displayMessage() {
            const canvas = document.getElementById('geoCanvas');
            if (canvas) {
                canvas.style.display = 'block';
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, 380, 380);

                // Draw a friendly "no shapes" message on the canvas
                ctx.fillStyle = '#333';
                ctx.font = 'bold 20px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('No shapes loaded yet', 190, 170);

                ctx.fillStyle = '#666';
                ctx.font = '14px Arial, sans-serif';
                ctx.fillText('A moderator needs to upload', 190, 200);
                ctx.fillText("today's shapes to start the game.", 190, 220);
            }
        }
    }

    // Initialize the bridge
    DevvitBridge.init();

})();
