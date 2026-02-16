/**
 * Devvit Game Initializer
 * Hooks into the original game's initialization flow to load shapes from
 * Devvit init data instead of Supabase.
 *
 * This file MUST be loaded AFTER main.js and all mechanics.
 * It overrides the Supabase-dependent initialization with Devvit-compatible logic.
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

        // Set day of week (1-7, where 7=Sunday, matching original main.js)
        const dow = initData.dayOfWeek; // 0=Sun, 6=Sat
        window.currentDay = dow === 0 ? 7 : dow; // Convert to 1-7

        // Determine mechanic
        const mechanicName = initData.mechanic || dayMechanics[dow] || 'DefaultWithUndoMechanic';
        console.log('[Devvit Init] Mechanic:', mechanicName, 'Day:', window.currentDay);

        // Parse shapes from init data
        const shapes = (initData.shapes || []).map(s => {
            try {
                return typeof s === 'string' ? JSON.parse(s) : s;
            } catch (e) {
                console.error('[Devvit Init] Failed to parse shape:', e);
                return null;
            }
        }).filter(Boolean);

        if (shapes.length === 0) {
            console.error('[Devvit Init] No shapes received! Check that shapes are loaded into Redis.');
            showNoShapesMessage();
            return;
        }

        console.log('[Devvit Init] Loaded', shapes.length, 'shapes');

        // Store shapes for the demo flow to access
        window.devvitParsedShapes = shapes;

        // Override the demo shape loader to return our Devvit shapes
        window.loadDemoShape = function(dayNumber, shapeNumber) {
            console.log('[Devvit Init] loadDemoShape called for day', dayNumber, 'shape', shapeNumber);
            const shapeIndex = shapeNumber - 1; // Convert 1-based to 0-based
            const geojson = shapes[shapeIndex];

            if (!geojson) {
                console.error('[Devvit Init] Shape not found:', shapeIndex);
                return Promise.reject('Shape not found');
            }

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
        const container = document.getElementById('game-container') || document.body;
        const msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;font-family:Arial,sans-serif;padding:20px;';
        msg.innerHTML = `
            <h2 style="margin-bottom:10px;">No shapes loaded</h2>
            <p style="color:#666;">Today's shapes haven't been uploaded to Redis yet.<br>
            A moderator needs to upload shapes for today.</p>
        `;
        container.appendChild(msg);
    }

    // Initialize the bridge
    DevvitBridge.init();

})();
