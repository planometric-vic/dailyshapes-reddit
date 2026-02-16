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

    // Wait for Devvit init data, then bootstrap the game
    window.addEventListener('devvit-init', async (event) => {
        const initData = event.detail;
        console.log('[Devvit Init] Bootstrapping game with:', {
            username: initData.username,
            dayKey: initData.dayKey,
            dayNumber: initData.dayNumber,
            dayOfWeek: initData.dayOfWeek,
            mechanic: initData.mechanic,
            shapeCount: initData.shapes?.length || 0
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

        // Prevent main.js DOMContentLoaded from running a second initializeDemoGame
        // (main.js checks this flag and skips demo init if Supabase is "active")
        window._devvitInitRunning = true;

        // Set day of week (1-7, where 7=Sunday, matching original main.js)
        const dow = initData.dayOfWeek; // 0=Sun, 6=Sat
        window.currentDay = dow === 0 ? 7 : dow; // Convert to 1-7

        // Determine mechanic
        const mechanicName = initData.mechanic || dayMechanics[dow] || 'DefaultWithUndoMechanic';
        console.log('[Devvit Init] Mechanic:', mechanicName, 'Day:', window.currentDay);

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

        // Stop the loading animation before starting the game
        if (typeof window.stopImmediateLoadingAnimation === 'function') {
            console.log('[Devvit Init] Stopping loading animation...');
            window.stopImmediateLoadingAnimation(function() {
                console.log('[Devvit Init] Loading animation finished');
            });
        }

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
    });

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
