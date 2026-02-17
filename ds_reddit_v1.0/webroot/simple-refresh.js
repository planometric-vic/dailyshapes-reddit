// Simple Refresh Protection System for Daily Shapes Demo
// Saves and restores game state through page refreshes

(function() {
    'use strict';
    
    // Check for reset flag in URL
    if (window.location.hash === '#reset' || window.location.search.includes('reset')) {
        localStorage.clear();
        console.log('🔄 All game state cleared due to reset flag');
        window.location.hash = '';
        window.location.search = '';
    }
    
    // Clear any bad state from previous sessions
    // CRITICAL: Use local time to match daily-game-core.js date format
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format in local time
    const savedState = localStorage.getItem(`simple_refresh_${today}`);
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            // Only clear if it's truly corrupted or incomplete
            // DON'T clear if game is started but no cuts made yet (user may have just pressed Play)
            // DON'T clear if game is complete (we want to preserve completion state)
            const isCompleted = state.dayComplete || state.isGameComplete || state.gameState === 'finished' || state.gameState === 'locked';
            const hasValidState = state.isGameStarted && (state.currentShape || state.gameState);

            if (!hasValidState && !isCompleted) {
                // Only clear truly invalid states (not started, no shape, no game state)
                localStorage.removeItem(`simple_refresh_${today}`);
                localStorage.removeItem('dailyGameState_demo');
                console.log('🗑️ Cleared invalid state from previous session');
            }
        } catch (e) {
            // Bad state, clear it
            localStorage.removeItem(`simple_refresh_${today}`);
            localStorage.removeItem('dailyGameState_demo');
        }
    }
    
    // Simple refresh system
    window.SimpleRefresh = {
        save: function() {
            // CRITICAL: Don't save state during practice mode
            if (window.isPracticeMode) {
                console.log('🚫 SimpleRefresh: Skipping save during practice mode');
                return;
            }

            // CRITICAL: Use local time to match daily-game-core.js date format
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format in local time

            // Capture comprehensive game state
            const state = {
                date: today,
                // CRITICAL: Only mark as started if Play button was actually pressed
                // Check if dailyGameState exists and has isGameStarted flag
                isGameStarted: (window.dailyGameState && window.dailyGameState.isGameStarted) ||
                               (window.playButtonClicked === true) ||
                               (window.totalCutsMade > 0),
                currentShape: window.currentShapeNumber || 1,
                currentAttempt: window.currentAttemptNumber || 1,
                gameState: window.gameState,
                currentDay: window.currentDay,
                
                // Save current GeoJSON shape data
                currentGeoJSON: window.currentGeoJSON,
                
                // Save visual state - canvas as image
                canvasData: null,
                
                // Save cut history if available
                cuts: window.dailyGameState ? window.dailyGameState.cuts : [],
                currentAttempts: window.currentAttempts || [],
                
                // Save game progress
                attemptCount: window.attemptCount || 0,
                totalCutsMade: window.totalCutsMade || 0,
                cutsMadeThisShape: window.cutsMadeThisShape || 0,
                
                // Save completion state - check multiple sources
                dayComplete: (window.dailyGameState && window.dailyGameState.dayComplete) || 
                            window.gameState === 'finished' || window.gameState === 'locked',
                isGameComplete: (window.dailyGameState && window.dailyGameState.isGameComplete) || 
                               window.gameState === 'finished' || window.gameState === 'locked',
                completedAt: window.dailyGameState ? window.dailyGameState.completedAt : null,
                finalStats: window.dailyGameState ? window.dailyGameState.finalStats : null,
                
                // Save parsed shapes
                parsedShapes: window.parsedShapes || null,
                
                // Save mechanic info
                mechanicName: window.currentMechanic ? window.currentMechanic.name : null,

                // Save rotating shape mechanic state if active
                rotationState: null,

                timestamp: Date.now()
            };

            // Capture rotating shape mechanic state if active
            if (window.currentMechanic && window.currentMechanic.name === "Rotating Shape Vector Cut") {
                state.rotationState = {
                    isRotating: window.currentMechanic.isRotating,
                    rotationAngle: window.currentMechanic.rotationAngle,
                    rotationCenter: window.currentMechanic.rotationCenter,
                    originalShapes: window.currentMechanic.originalShapes ?
                        JSON.parse(JSON.stringify(window.currentMechanic.originalShapes)) : null,
                    rotationSpeed: window.currentMechanic.rotationSpeed
                };
                console.log('💾 Saved rotation state:', state.rotationState);
            }

            // Capture canvas state if available
            if (window.canvas) {
                try {
                    // Skip capturing canvas if we just canceled a line drawing to prevent corruption
                    if (window.canceledLineDrawing) {
                        console.log('🚫 Skipping canvas capture due to recent cancel - preventing corrupted state save');
                        state.canvasData = null;
                    } else if (window.skipCanvasCaptureAfterShapeTransition) {
                        // CRITICAL: Skip canvas capture immediately after shape transitions to prevent shading persistence
                        console.log('🚫 SimpleRefresh: Skipping canvas capture after shape transition - preventing shaded state persistence');
                        state.canvasData = null;
                    } else if (window.gameState === 'results' || window.gameState === 'finished' || window.gameState === 'locked') {
                        // Skip canvas during end-game screens
                        console.log('🚫 SimpleRefresh: Skipping canvas capture during end-game phase');
                        state.canvasData = null;
                    } else {
                        // CRITICAL: Capture canvas in ALL other states, including 'awaiting_choice'
                        // This preserves cut shading after page refresh
                        state.canvasData = window.canvas.toDataURL();
                        console.log('✅ SimpleRefresh: Canvas captured with current state (gameState: ' + window.gameState + ')');
                    }
                } catch (e) {
                    // Canvas might be tainted, skip
                    state.canvasData = null;
                }
            }

            try {
                localStorage.setItem(`simple_refresh_${today}`, JSON.stringify(state));
                console.log('💾 Refresh state saved');
                console.log('📊 Saved currentAttempts:', state.currentAttempts ? state.currentAttempts.length : 0, 'attempts');
                if (window.debugCurrentAttempts) {
                    window.debugCurrentAttempts('simple-refresh-save', 'SAVING state');
                }
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    console.warn('⚠️ localStorage quota exceeded, retrying without canvas data...');
                    // Retry without canvas data to ensure critical game state is saved
                    state.canvasData = null;
                    try {
                        localStorage.setItem(`simple_refresh_${today}`, JSON.stringify(state));
                        console.log('✅ Refresh state saved without canvas (quota limit reached)');
                        console.log('📊 Saved currentAttempts:', state.currentAttempts ? state.currentAttempts.length : 0, 'attempts');
                        if (window.debugCurrentAttempts) {
                            window.debugCurrentAttempts('simple-refresh-save', 'SAVING state (no canvas)');
                        }
                    } catch (retryError) {
                        console.error('❌ Failed to save game state even without canvas:', retryError);
                    }
                } else {
                    console.error('❌ Failed to save refresh state:', e);
                }
            }

            // Also persist to Redis via DevvitBridge (survives webview reloads)
            if (window.DevvitBridge && window.DevvitBridge.initData) {
                try {
                    // Save a compact version without canvas data (Redis-friendly)
                    var redisState = Object.assign({}, state);
                    delete redisState.canvasData;     // Too large for Redis
                    delete redisState.parsedShapes;   // Shapes come from server anyway
                    delete redisState.currentGeoJSON; // Redundant with shapes
                    window.DevvitBridge.saveProgress(
                        window.DevvitBridge.initData.dayKey,
                        redisState
                    );
                    console.log('☁️ Progress saved to Redis via DevvitBridge');
                } catch (redisErr) {
                    console.warn('⚠️ Failed to save progress to Redis:', redisErr);
                }
            }
        },
        
        restore: function() {
            // CRITICAL: Use local time to match daily-game-core.js date format
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format in local time
            const saved = localStorage.getItem(`simple_refresh_${today}`);

            if (saved) {
                try {
                    const state = JSON.parse(saved);

                    // DEBUG: Check what was actually saved
                    console.log('🔍 SimpleRefresh DEBUG - Saved state contains:', {
                        attempts: state.currentAttempts ? state.currentAttempts.length : 'null',
                        attemptsData: state.currentAttempts ? state.currentAttempts.map((a, i) => `[${i}] ${a.leftPercentage?.toFixed(1)}/${a.rightPercentage?.toFixed(1)}`) : 'none'
                    });

                    // Set restoration flag to prevent initial shape rendering
                    window.isRestoringGameState = true;
                    console.log('🔄 Set isRestoringGameState flag to prevent shape rendering during restoration');

                    // Restore global variables
                    window.currentShapeNumber = state.currentShape;
                    window.currentAttemptNumber = state.currentAttempt;
                    window.gameState = state.dayComplete ? 'finished' : 'playing';
                    window.currentDay = state.currentDay || 1;
                    window.currentGeoJSON = state.currentGeoJSON;
                    window.attemptCount = state.attemptCount || 0;
                    window.currentAttempts = state.currentAttempts || [];
                    window.totalCutsMade = state.totalCutsMade || 0;
                    window.cutsMadeThisShape = state.cutsMadeThisShape || 0;
                    window.parsedShapes = state.parsedShapes || null;

                    // CRITICAL: Sync local variables too (required by main.js)
                    if (typeof currentAttempts !== 'undefined') {
                        window.currentAttempts = state.currentAttempts || [];
                        console.log('📊 SimpleRefresh: Restored currentAttempts:', window.currentAttempts.length, 'attempts');
                        if (window.debugCurrentAttempts) {
                            window.debugCurrentAttempts('simple-refresh-restore', 'RESTORED from localStorage');
                        }
                    }
                    if (window.totalCutsMade !== undefined) {
                        window.totalCutsMade = state.totalCutsMade || 0;
                    }
                    if (window.cutsMadeThisShape !== undefined) {
                        window.cutsMadeThisShape = state.cutsMadeThisShape || 0;
                    }
                    
                    // Enable interaction only if not complete
                    window.isInteractionEnabled = !state.dayComplete;
                    
                    // Initialize dailyGameState if it doesn't exist
                    if (!window.dailyGameState) {
                        window.dailyGameState = {
                            isGameStarted: true,
                            currentShape: state.currentShape,
                            currentAttempt: state.currentAttempt,
                            cuts: []
                        };
                    }
                    
                    // Restore cut history and completion state to dailyGameState
                    if (state.cuts) {
                        window.dailyGameState.cuts = state.cuts;
                    }
                    window.dailyGameState.dayComplete = state.dayComplete || false;
                    window.dailyGameState.isGameComplete = state.isGameComplete || false;
                    window.dailyGameState.completedAt = state.completedAt || null;
                    window.dailyGameState.finalStats = state.finalStats || null;

                    // Restore rotating shape mechanic state if available
                    // DON'T start rotation yet - wait for canvas restoration
                    if (state.rotationState && window.currentMechanic &&
                        window.currentMechanic.name === "Rotating Shape Vector Cut") {
                        console.log('🔄 Storing rotation state for later restoration:', state.rotationState);

                        // Store rotation state but DON'T start rotation yet
                        // Canvas restoration will handle starting rotation
                        window.currentMechanic.rotationAngle = state.rotationState.rotationAngle || 0;
                        window.currentMechanic.rotationCenter = state.rotationState.rotationCenter;
                        window.currentMechanic.originalShapes = state.rotationState.originalShapes;

                        console.log('✅ Rotation state stored, waiting for canvas restoration to restart');
                    }

                    // CRITICAL: Store canvas data for later restoration after shapes/mechanic load
                    // Don't restore immediately as shapes haven't loaded yet
                    window.pendingCanvasRestoration = state.canvasData;
                    console.log('💾 Stored canvas data for delayed restoration after shapes load');

                    // CRITICAL: Actually restore the canvas after a delay (for rotating mechanic)
                    if (state.canvasData && state.mechanicName === "Rotating Shape Vector Cut") {
                        console.log('🔄 Sunday rotating mechanic detected - will restore canvas after shapes load');
                        setTimeout(() => {
                            if (window.pendingCanvasRestoration && window.canvas && window.ctx) {
                                const img = new Image();
                                img.onload = () => {
                                    window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
                                    window.ctx.drawImage(img, 0, 0);
                                    console.log('✅ Canvas restored for rotating mechanic');
                                    window.pendingCanvasRestoration = null;

                                    // Now restart rotation if it was running
                                    if (state.rotationState && state.rotationState.isRotating && window.currentMechanic) {
                                        setTimeout(() => {
                                            if (window.currentMechanic.startRotation) {
                                                window.currentMechanic.startRotation();
                                                console.log('🔄 Rotation restarted after canvas restoration');
                                            }
                                        }, 100);
                                    }
                                };
                                img.onerror = () => {
                                    console.error('❌ Failed to restore canvas image');
                                    window.pendingCanvasRestoration = null;
                                };
                                img.src = window.pendingCanvasRestoration;
                            }
                        }, 500); // Wait for shapes and mechanic to load
                    }

                    // Restore instructions based on game state
                    setTimeout(() => {
                        this.restoreInstructions(state);
                    }, 100);

                    // CRITICAL: Clear restoration flag after all restoration completes
                    // Extended to 500ms for rotating mechanic to fully initialize
                    setTimeout(() => {
                        window.isRestoringGameState = false;
                        console.log('✅ Cleared isRestoringGameState flag - new shapes can now initialize rotation');
                    }, 500); // Increased from 200ms to 500ms for rotating mechanic

                    console.log('✅ Refresh state restored:', {
                        shape: state.currentShape,
                        attempt: state.currentAttempt,
                        cuts: state.totalCutsMade,
                        complete: state.dayComplete,
                        rotationRestored: !!state.rotationState,
                        canvasRestored: !!state.canvasData
                    });

                    return state;
                } catch (e) {
                    console.error('Failed to restore state:', e);
                    this.clear();
                    return false;
                }
            }
            return false;
        },
        
        restoreInstructions: function(state) {
            console.log('📝 SimpleRefresh: Restoring instructions for restored game state');

            // Skip if in practice mode or if day is complete
            if (window.isPracticeMode) {
                console.log('📝 In practice mode, skipping instruction restoration');
                return;
            }

            if (state.dayComplete || state.isGameComplete) {
                console.log('📝 Day is complete, skipping instruction restoration');
                return;
            }

            try {
                // Get current mechanic name
                const mechanicName = window.getCurrentMechanicName ? window.getCurrentMechanicName() : null;
                if (!mechanicName) {
                    console.log('⚠️ No mechanic name available for instruction restoration');
                    return;
                }

                // Determine appropriate instruction based on game state
                if (state.gameState === 'cutting' || state.gameState === 'playing') {
                    // Show initial cutting instruction
                    const initialInstruction = window.getInitialInstruction ? window.getInitialInstruction(mechanicName) : null;
                    if (initialInstruction && window.updateInstructionText) {
                        window.updateInstructionText(initialInstruction);
                        console.log('📝 SimpleRefresh: Restored initial instruction:', initialInstruction);
                    }
                } else if (state.gameState === 'awaiting_choice' || state.gameState === 'results') {
                    // Try to restore commentary from cuts data
                    if (state.cuts && state.cuts.length > 0) {
                        const lastCut = state.cuts[state.cuts.length - 1];
                        if (lastCut && lastCut.leftPercentage !== undefined && lastCut.rightPercentage !== undefined) {
                            const score = 100 - Math.abs(lastCut.leftPercentage - lastCut.rightPercentage);
                            const commentary = window.getPlayfulCommentary ? window.getPlayfulCommentary(score) : 'Cut completed!';
                            if (window.updateInstructionText) {
                                window.updateInstructionText(commentary, true); // true for bold
                                console.log('📝 SimpleRefresh: Restored commentary:', commentary);
                            }
                        }
                    }
                } else {
                    // Default to initial instruction
                    const initialInstruction = window.getInitialInstruction ? window.getInitialInstruction(mechanicName) : null;
                    if (initialInstruction && window.updateInstructionText) {
                        window.updateInstructionText(initialInstruction);
                        console.log('📝 SimpleRefresh: Restored default initial instruction:', initialInstruction);
                    }
                }

            } catch (error) {
                console.error('❌ SimpleRefresh: Error restoring instructions:', error);
            }
        },

        clear: function() {
            // CRITICAL: Use local time to match daily-game-core.js date format
            const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format in local time
            localStorage.removeItem(`simple_refresh_${today}`);
        }
    };
    
    // Create SimpleGameRefresh alias for compatibility
    window.SimpleGameRefresh = window.SimpleRefresh;
    
    // Add global clear function for emergency use
    window.clearGameState = function() {
        localStorage.clear();
        console.log('🗑️ All game state cleared');
        console.log('🔄 Please refresh the page to start fresh');
    };
    
    // Add reset function that clears and reloads
    window.resetGame = function() {
        localStorage.clear();
        window.location.hash = '#fresh';
        window.location.reload();
    };
    
    console.log('💾 Simple Refresh Protection loaded');
    console.log('💡 Use clearGameState() or resetGame() if stuck');
    
})();