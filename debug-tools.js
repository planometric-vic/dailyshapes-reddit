// Debug Tools for Daily Shapes v4.0
// Simple debugging utilities without complex logging systems

window.DebugTools = {
    // Check localStorage state
    checkGameState: function() {
        const today = new Date().toISOString().split('T')[0];
        const stateKey = `dailyGameState_${today}`;
        const savedState = localStorage.getItem(stateKey);
        
        console.log('=== GAME STATE DEBUG ===');
        console.log('Date:', today);
        console.log('State Key:', stateKey);
        console.log('Has Saved State:', !!savedState);
        
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                console.log('Parsed State:', parsed);
                console.log('Game Started:', parsed.isGameStarted);
                console.log('Game Complete:', parsed.isGameComplete);
                console.log('Current Shape:', parsed.currentShape);
                console.log('Current Attempt:', parsed.currentAttempt);
                console.log('Cuts Count:', parsed.cuts ? parsed.cuts.length : 0);
            } catch (e) {
                console.error('Error parsing state:', e);
            }
        }
        
        return savedState;
    },
    
    // Clear all game states
    clearAllStates: function() {
        const keys = Object.keys(localStorage);
        let cleared = 0;
        
        keys.forEach(key => {
            if (key.startsWith('dailyGameState_')) {
                localStorage.removeItem(key);
                cleared++;
                console.log('Cleared:', key);
            }
        });
        
        console.log(`Cleared ${cleared} game state(s)`);
    },
    
    // Test refresh protection system
    testRefreshProtection: function() {
        console.log('=== REFRESH PROTECTION TEST ===');
        
        console.log('RefreshProtection exists:', !!window.RefreshProtection);
        
        if (window.RefreshProtection) {
            console.log('Current State:', window.RefreshProtection.getCurrentState());
            console.log('Is Game In Progress:', window.RefreshProtection.isGameInProgress());
            console.log('Is Game Completed:', window.RefreshProtection.isGameCompleted());
        }
        
        // Check global game variables
        console.log('Global Variables:');
        console.log('  currentShapeNumber:', window.currentShapeNumber);
        console.log('  currentAttemptNumber:', window.currentAttemptNumber);
        console.log('  gameState:', window.gameState);
        console.log('  currentGeoJSON exists:', !!window.currentGeoJSON);
    },
    
    // Simulate saving a cut
    simulateCut: function() {
        if (!window.RefreshProtection) {
            console.log('RefreshProtection not available');
            return;
        }
        
        // Initialize if needed
        if (!window.RefreshProtection.getCurrentState()) {
            window.RefreshProtection.initializeStateTracking();
            window.RefreshProtection.activateProtection('TestMechanic');
        }
        
        // Save a test cut
        const testCut = {
            start: { x: 100, y: 100 },
            end: { x: 200, y: 200 }
        };
        
        window.RefreshProtection.saveCutResult(1, 1, testCut, 45.5, 54.5, 91.0, 'Test cut!');
        console.log('Simulated cut saved');
        
        this.checkGameState();
    },
    
    // Force browser hard refresh
    hardRefresh: function() {
        console.log('Forcing hard refresh...');
        window.location.reload(true);
    },
    
    // Check if Play button is working
    checkPlayButton: function() {
        const playBtn = document.getElementById('playBtn');
        console.log('=== PLAY BUTTON DEBUG ===');
        console.log('Play button exists:', !!playBtn);
        
        if (playBtn) {
            console.log('Play button visible:', playBtn.style.display !== 'none');
            console.log('Play button disabled:', playBtn.disabled);
            console.log('Play button text:', playBtn.textContent);
            console.log('Click handler:', typeof window.handlePlayButtonClick);
        }
    },
    
    // Simple game state setup for testing
    setupTestGame: function() {
        console.log('Setting up test game...');
        
        // Set global variables
        window.currentShapeNumber = 1;
        window.currentAttemptNumber = 1;
        window.gameState = 'playing';
        
        // Initialize refresh protection
        if (window.RefreshProtection) {
            window.RefreshProtection.initializeStateTracking();
            window.RefreshProtection.activateProtection('DefaultWithUndoMechanic');
            console.log('Test game setup complete');
        } else {
            console.log('RefreshProtection not available');
        }
    },
    
    // Test refresh protection integration with flow enforcer
    testFlowRefreshProtection: function() {
        console.log('=== FLOW REFRESH PROTECTION TEST ===');
        
        console.log('SimpleRefresh exists:', !!window.SimpleRefresh);
        console.log('GameFlowEnforcer exists:', !!window.GameFlowEnforcer);
        
        if (window.SimpleRefresh && window.GameFlowEnforcer) {
            // Check current flow state
            console.log('Flow Active:', window.GameFlowEnforcer.isFlowActive());
            console.log('Current Flow Step:', window.GameFlowEnforcer.getCurrentFlowStep());
            
            // Check if refresh state is being saved
            window.SimpleRefresh.save();
            console.log('✅ Refresh state saved');
            
            // Check what's in localStorage
            const today = new Date().toISOString().split('T')[0];
            const saved = localStorage.getItem(`simple_${today}`);
            if (saved) {
                const state = JSON.parse(saved);
                console.log('Saved Flow State:', state.flowState);
                console.log('Current Shape/Attempt:', state.currentShape, state.currentAttempt);
            }
        }
    },
    
    // Simulate refresh at current position
    simulateRefresh: function() {
        console.log('=== SIMULATING REFRESH ===');
        
        // Save current state
        if (window.SimpleRefresh) {
            window.SimpleRefresh.save();
            console.log('✅ State saved before refresh simulation');
        }
        
        console.log('💡 Now manually refresh the page and see if it restores to exact position');
        console.log('💡 After refresh, run DebugTools.checkRefreshRestore() to verify');
    },
    
    // Check if refresh restoration worked
    checkRefreshRestore: function() {
        console.log('=== CHECKING REFRESH RESTORATION ===');
        
        const today = new Date().toISOString().split('T')[0];
        const saved = localStorage.getItem(`simple_${today}`);
        
        if (saved) {
            const state = JSON.parse(saved);
            console.log('Restored State:');
            console.log('  Shape:', state.currentShape);
            console.log('  Attempt:', state.currentAttempt);
            console.log('  Flow State:', state.flowState);
            
            console.log('Current Game State:');
            console.log('  currentShapeNumber:', window.currentShapeNumber);
            console.log('  currentAttemptNumber:', window.currentAttemptNumber);
            console.log('  Flow Step:', window.GameFlowEnforcer ? window.GameFlowEnforcer.getCurrentFlowStep() : 'N/A');
            
            // Check if they match
            const shapesMatch = state.currentShape === window.currentShapeNumber;
            const attemptsMatch = state.currentAttempt === window.currentAttemptNumber;
            
            console.log('Restoration Success:');
            console.log('  Shapes match:', shapesMatch);
            console.log('  Attempts match:', attemptsMatch);
            
            if (shapesMatch && attemptsMatch) {
                console.log('✅ REFRESH RESTORATION SUCCESSFUL');
            } else {
                console.log('❌ REFRESH RESTORATION FAILED');
            }
        } else {
            console.log('❌ No saved state found');
        }
    }
};

// Add keyboard shortcuts for debugging
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+G - Check game state
    if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        window.DebugTools.checkGameState();
    }
    
    // Ctrl+Shift+C - Clear all states
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (confirm('Clear all game states?')) {
            window.DebugTools.clearAllStates();
        }
    }
    
    // Ctrl+Shift+T - Test refresh protection
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        window.DebugTools.testRefreshProtection();
    }
    
    // Ctrl+Shift+S - Simulate cut
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        window.DebugTools.simulateCut();
    }
    
    // Ctrl+Shift+F - Test flow refresh protection
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        window.DebugTools.testFlowRefreshProtection();
    }
    
    // Ctrl+Shift+R - Simulate refresh (save state)
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        window.DebugTools.simulateRefresh();
    }
});

console.log('🛠️ Debug Tools loaded');
console.log('💡 Shortcuts: Ctrl+Shift+G (state), Ctrl+Shift+C (clear), Ctrl+Shift+T (test), Ctrl+Shift+S (simulate)');
console.log('💡 New: Ctrl+Shift+F (flow test), Ctrl+Shift+R (save for refresh)');