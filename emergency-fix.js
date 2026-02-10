// Emergency Fix - Nuclear approach to stop console flooding
// This will completely silence all console output except critical errors

(function() {
    'use strict';
    
    // Store original console methods
    const original = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };
    
    // Counter for emergency messages
    let emergencyCount = 0;
    const MAX_EMERGENCY = 5;
    
    // Emergency console that shows only first few critical messages
    function emergencyLog(level, ...args) {
        if (emergencyCount < MAX_EMERGENCY) {
            emergencyCount++;
            original[level].apply(console, args);
            if (emergencyCount === MAX_EMERGENCY) {
                original.warn('📵 Console logging disabled to prevent flooding');
            }
        }
    }
    
    // Replace ALL console methods with silent versions
    console.log = function() {};
    console.info = function() {};
    console.debug = function() {};
    console.warn = function(...args) {
        emergencyLog('warn', ...args);
    };
    console.error = function(...args) {
        emergencyLog('error', ...args);
    };
    
    // Provide way to restore console for debugging
    window.enableConsole = function() {
        console.log = original.log;
        console.warn = original.warn;
        console.error = original.error;
        console.info = original.info;
        console.debug = original.debug;
        original.log('✅ Console restored');
    };
    
    // Provide silent way to check state
    window.checkState = function() {
        const today = new Date().toISOString().split('T')[0];
        const state = localStorage.getItem(`dailyGameState_${today}`);
        return state ? JSON.parse(state) : null;
    };
    
    // Enhanced refresh protection - saves complete game state
    window.SimpleRefresh = {
        save: function() {
            const today = new Date().toISOString().split('T')[0];
            
            // Capture comprehensive game state
            const state = {
                date: today,
                isGameStarted: true,
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
                
                // Save completion state
                dayComplete: window.dailyGameState ? window.dailyGameState.dayComplete : false,
                isGameComplete: window.dailyGameState ? window.dailyGameState.isGameComplete : false,
                completedAt: window.dailyGameState ? window.dailyGameState.completedAt : null,
                finalStats: window.dailyGameState ? window.dailyGameState.finalStats : null,
                
                // Save Flow Enforcer state for exact position restoration
                flowState: null,
                
                timestamp: Date.now()
            };
            
            // Capture Flow Enforcer state
            if (window.GameFlowEnforcer && window.GameFlowEnforcer.isFlowActive()) {
                state.flowState = {
                    currentFlowStep: window.GameFlowEnforcer.getCurrentFlowStep(),
                    flowProgress: window.GameFlowEnforcer.gameFlowState.flowProgress,
                    completedSteps: window.GameFlowEnforcer.gameFlowState.completedSteps,
                    currentStep: window.GameFlowEnforcer.gameFlowState.currentStep
                };
            }
            
            // Capture canvas state if available
            if (window.canvas) {
                try {
                    state.canvasData = window.canvas.toDataURL();
                } catch (e) {
                    // Canvas might be tainted, skip
                }
            }
            
            localStorage.setItem(`simple_${today}`, JSON.stringify(state));
        },
        
        restore: function() {
            const today = new Date().toISOString().split('T')[0];
            const saved = localStorage.getItem(`simple_${today}`);
            if (saved) {
                try {
                    const state = JSON.parse(saved);
                    
                    // Restore global variables
                    window.currentShapeNumber = state.currentShape;
                    window.currentAttemptNumber = state.currentAttempt;
                    window.gameState = state.dayComplete ? 'finished' : 'playing';
                    window.currentDay = state.currentDay || 1;
                    window.currentGeoJSON = state.currentGeoJSON;
                    window.attemptCount = state.attemptCount || 0;
                    window.currentAttempts = state.currentAttempts || [];
                    
                    // Enable interaction only if not complete
                    window.isInteractionEnabled = !state.dayComplete;
                    
                    // Restore cut history and completion state to dailyGameState if it exists
                    if (window.dailyGameState) {
                        if (state.cuts) {
                            window.dailyGameState.cuts = state.cuts;
                        }
                        window.dailyGameState.dayComplete = state.dayComplete || false;
                        window.dailyGameState.isGameComplete = state.isGameComplete || false;
                        window.dailyGameState.completedAt = state.completedAt || null;
                        window.dailyGameState.finalStats = state.finalStats || null;
                    }
                    
                    // Restore Flow Enforcer state to exact position
                    if (state.flowState && window.GameFlowEnforcer) {
                        // Wait for flow enforcer to be fully initialized
                        setTimeout(() => {
                            if (window.GameFlowEnforcer.restoreFlowState) {
                                window.GameFlowEnforcer.restoreFlowState(state.flowState);
                            } else {
                                // Manual restoration if method not available
                                window.GameFlowEnforcer.gameFlowState.currentFlowStep = state.flowState.currentFlowStep;
                                window.GameFlowEnforcer.gameFlowState.flowProgress = state.flowState.flowProgress;
                                window.GameFlowEnforcer.gameFlowState.completedSteps = state.flowState.completedSteps;
                                window.GameFlowEnforcer.gameFlowState.currentStep = state.flowState.currentStep;
                                
                                // Execute the restored step
                                window.GameFlowEnforcer.executeFlowStep(state.flowState.currentFlowStep);
                            }
                        }, 100);
                    }
                    
                    return state;
                } catch (e) {
                    // Corrupted state, clear it
                    this.clear();
                    return false;
                }
            }
            return false;
        },
        
        clear: function() {
            const today = new Date().toISOString().split('T')[0];
            localStorage.removeItem(`simple_${today}`);
        }
    };
    
    original.log('🚨 Emergency fix applied - console silenced');
    original.log('💡 Use enableConsole() to restore, checkState() to inspect, SimpleRefresh.save/restore/clear');
    
    // Create SimpleGameRefresh alias for compatibility with main.js
    window.SimpleGameRefresh = window.SimpleRefresh;
    
})();