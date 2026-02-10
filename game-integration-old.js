// Game Integration for Daily Shapes v4.0
// Connects the daily game core with existing mechanics

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎮 Starting Daily Shapes v4.0...');
    
    // ALWAYS use demo mode - disable daily game core completely
    console.log('📋 Demo mode active - daily game core disabled');
    
    // Set demo mode preference
    localStorage.setItem('dailyShapes_demoMode', 'true');
    
    // ABSOLUTELY PREVENT daily game core from running
    if (window.DailyGameCore) {
        console.log('🚫 BLOCKING: Daily game core disabled');
        window.DailyGameCore.disabled = true;
        // Override ALL methods to prevent it from running
        window.DailyGameCore.initialize = function() {
            console.log('🚫 Daily game core initialization blocked');
            return Promise.resolve();
        };
        window.DailyGameCore.handleMidnightReset = function() {
            console.log('🚫 Midnight reset blocked in demo mode');
            return;
        };
        window.DailyGameCore.getGameProgress = function() {
            return { currentShape: 1, currentAttempt: 1, isCompleted: false };
        };
        window.DailyGameCore.getShapeData = function() {
            return null;
        };
        window.DailyGameCore.updateGameState = function() {
            return;
        };
        window.DailyGameCore.getNextAction = function() {
            return { type: 'none' };
        };
    }
    
    // Exit - let demo game system handle everything
    return;
    
    try {
        // Initialize daily game core
        await window.DailyGameCore.initialize();
        
        // Update UI with current mechanic
        updateMechanicDisplay();
        
        // Override existing game functions to use daily system
        integrateWithExistingGame();
        
        // Load first shape
        loadCurrentShape();
        
        console.log('✅ Daily Shapes v4.0 initialized successfully');
        
        // Ensure mechanic display is updated
        updateMechanicDisplay();
        
    } catch (error) {
        console.error('❌ Error initializing Daily Shapes:', error);
        // Fall back to existing demo functionality
        console.log('🔄 Falling back to demo mode');
        
        // Even in fallback, try to set a reasonable display
        const mechanicNameElement = document.getElementById('mechanicName');
        if (mechanicNameElement) {
            mechanicNameElement.textContent = 'Create triangular cuts by placing 3 points';
        }
    }
});

// Update the mechanic display in the UI
function updateMechanicDisplay() {
    const mechanicName = window.DailyGameCore?.currentMechanic;
    const mechanicNameElement = document.getElementById('mechanicName');
    
    console.log('🔧 updateMechanicDisplay called:', { mechanicName, hasElement: !!mechanicNameElement });
    
    if (mechanicNameElement) {
        if (mechanicName) {
            // Convert mechanic name to readable format
            const readableName = convertMechanicName(mechanicName);
            mechanicNameElement.textContent = readableName;
            console.log('✅ Mechanic name updated:', readableName);
        } else {
            // Fallback for Friday (today is day 5 = Friday = ThreePointTriangle)
            mechanicNameElement.textContent = 'Create triangular cuts by placing 3 points';
            console.log('⚠️ Using fallback mechanic name for Friday');
        }
    }
}

// Convert internal mechanic names to user-friendly challenge names
function convertMechanicName(mechanicName) {
    const nameMap = {
        'DefaultWithUndo': 'Straight Line Cutter',
        'HorizontalOnly': 'Locked Horizontal Cutter',
        'CircleCut': 'Circular Cutter',
        'DiagonalAscending': 'Locked Diagonal Cutter',
        'ThreePointTriangle': 'Triangular Cutter',
        'RotatingSquare': 'Rotatable Square Cutter',
        'RotatingShapeVector': 'Straight Line Cutter (Rotating Shape)',
        // Also handle the full mechanic names that might come from the system
        'ThreePointTriangleMechanic': 'Triangular Cutter',
        'DefaultWithUndoMechanic': 'Straight Line Cutter',
        'HorizontalOnlyMechanic': 'Locked Horizontal Cutter',
        'CircleCutMechanic': 'Circular Cutter',
        'DiagonalAscendingMechanic': 'Locked Diagonal Cutter',
        'RotatingSquareMechanic': 'Rotatable Square Cutter',
        'RotatingShapeVectorMechanic': 'Straight Line Cutter (Rotating Shape)'
    };
    
    return nameMap[mechanicName] || mechanicName;
}

// Load the current shape based on game state
function loadCurrentShape() {
    const progress = window.DailyGameCore.getGameProgress();
    const shapeNumber = progress.currentShape;
    
    console.log(`📐 Loading shape ${shapeNumber} for ${progress.currentMechanic}`);
    
    // Get shape data from daily game core
    const shapeData = window.DailyGameCore.getShapeData(shapeNumber);
    
    if (shapeData) {
        // Use existing shape loading logic
        if (window.loadGeoJSONShape) {
            window.loadGeoJSONShape(shapeData);
        }
        
        // Update current shape index for existing game logic
        if (typeof window.currentShapeIndex !== 'undefined') {
            window.currentShapeIndex = shapeNumber;
        }
        
        console.log(`✅ Shape ${shapeNumber} loaded`);
    } else {
        console.error(`❌ Failed to load shape ${shapeNumber}`);
    }
}

// Integrate with existing game mechanics
function integrateWithExistingGame() {
    // Override the existing cut completion handler
    if (typeof window.handleCutCompletion === 'function') {
        window.originalHandleCutCompletion = window.handleCutCompletion;
    }
    
    // New cut completion handler that uses daily game system
    window.handleCutCompletion = function(leftPercentage, rightPercentage) {
        console.log(`✂️ Cut completed: ${leftPercentage.toFixed(1)}% / ${rightPercentage.toFixed(1)}%`);
        
        // Process with scoring system
        const cutResult = window.ScoringSystem.processCutResult(leftPercentage, rightPercentage);
        
        // Get current game state
        const progress = window.DailyGameCore.getGameProgress();
        
        // Update game state with result
        window.DailyGameCore.updateGameState(
            progress.currentShape,
            progress.currentAttempt,
            {
                score: cutResult.score,
                leftPercentage: cutResult.leftPercentage,
                rightPercentage: cutResult.rightPercentage,
                isPerfect: cutResult.isPerfect,
                commentary: cutResult.commentary
            }
        );
        
        // Call original handler for UI updates
        if (window.originalHandleCutCompletion) {
            window.originalHandleCutCompletion(leftPercentage, rightPercentage);
        }
        
        // Handle next action
        setTimeout(() => {
            handleNextAction();
        }, 2000);
    };
    
    // Override shape switching logic
    if (typeof window.switchToShape === 'function') {
        window.originalSwitchToShape = window.switchToShape;
    }
    
    window.switchToShape = function(shapeNumber) {
        console.log(`🔄 Switching to shape ${shapeNumber}`);
        
        // Load shape from daily game core
        const shapeData = window.DailyGameCore.getShapeData(shapeNumber);
        
        if (shapeData && window.loadGeoJSONShape) {
            window.loadGeoJSONShape(shapeData);
            
            // Update game state
            if (typeof window.currentShapeIndex !== 'undefined') {
                window.currentShapeIndex = shapeNumber;
            }
        }
        
        // Update UI
        updateMechanicDisplay();
    };
    
    // Override demo day selector (remove functionality)
    const daySelect = document.getElementById('daySelect');
    if (daySelect) {
        daySelect.style.display = 'none';
    }
}

// Handle what happens after each cut
function handleNextAction() {
    const nextAction = window.DailyGameCore.getNextAction();
    
    console.log('🎯 Next action:', nextAction);
    
    switch (nextAction.type) {
        case 'cut':
            // Load the appropriate shape
            if (nextAction.shape !== window.currentShapeIndex) {
                window.switchToShape(nextAction.shape);
            }
            break;
            
        case 'completed':
            // Game completed
            handleGameCompletion();
            break;
    }
}

// Handle game completion
function handleGameCompletion() {
    console.log('🎉 Daily game completed!');
    
    // Get final score summary
    const progress = window.DailyGameCore.getGameProgress();
    const scoreSummary = window.ScoringSystem.getScoreSummary(progress);
    
    console.log('📊 Final scores:', scoreSummary);
    
    // Show completion message
    setTimeout(() => {
        showCompletionCelebration(scoreSummary);
    }, 1000);
}

// Show game completion celebration
function showCompletionCelebration(scoreSummary) {
    // Create completion overlay
    const completionOverlay = document.createElement('div');
    completionOverlay.className = 'completion-overlay';
    completionOverlay.innerHTML = `
        <div class="completion-content">
            <h2>🎉 Daily Challenge Complete!</h2>
            <div class="final-score">
                <span class="score-label">Daily Score:</span>
                <span class="score-value ${getScoreClass(scoreSummary.dailyAverage)}">${scoreSummary.dailyAverage}</span>
            </div>
            ${scoreSummary.perfectCuts > 0 ? `<div class="perfect-cuts">✨ ${scoreSummary.perfectCuts} Perfect Cut${scoreSummary.perfectCuts > 1 ? 's' : ''}!</div>` : ''}
            <div class="completion-message">Come back tomorrow for a new challenge!</div>
            <button onclick="closeCompletionOverlay()" class="close-completion">Continue</button>
        </div>
    `;
    
    completionOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    document.body.appendChild(completionOverlay);
    window.currentCompletionOverlay = completionOverlay;
}

// Get CSS class for score display
function getScoreClass(score) {
    if (score >= 98) return 'score-perfect';
    if (score >= 85) return 'score-excellent';
    if (score >= 70) return 'score-good';
    if (score >= 50) return 'score-fair';
    return 'score-poor';
}

// Close completion overlay
window.closeCompletionOverlay = function() {
    if (window.currentCompletionOverlay) {
        window.currentCompletionOverlay.remove();
        window.currentCompletionOverlay = null;
    }
};

// Handle page refresh/reload - restore game state
window.addEventListener('beforeunload', function() {
    // Game state is automatically saved by DailyGameCore
    console.log('💾 Saving game state before page unload');
});

// Handle visibility change (tab switching, etc.) - DISABLED IN DEMO MODE
// Commenting out to prevent daily-game-core from interfering
/*
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Page became visible again - check if it's a new day
        const currentDate = new Date().toLocaleDateString('en-CA');
        const gameDate = window.DailyGameCore.currentDate;
        
        if (currentDate !== gameDate) {
            console.log('📅 New day detected, triggering reset');
            window.DailyGameCore.handleMidnightReset();
        }
    }
});
*/

// Export functions for global access
window.loadCurrentShape = loadCurrentShape;
window.updateMechanicDisplay = updateMechanicDisplay;
window.handleNextAction = handleNextAction;

// Override stats window to show daily game stats
window.originalShowStatsWindow = window.showStatsWindow;
window.showStatsWindow = function() {
    const progress = window.DailyGameCore.getGameProgress();
    const scoreSummary = window.ScoringSystem.getScoreSummary(progress);
    
    console.log('📊 Showing daily stats:', scoreSummary);
    
    // Use original stats window but with updated data
    if (window.originalShowStatsWindow) {
        window.originalShowStatsWindow();
    }
    
    // Update stats content with daily data
    updateStatsContent(scoreSummary);
};

// Update stats content with daily game data
function updateStatsContent(scoreSummary) {
    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;
    
    const progress = window.DailyGameCore.getGameProgress();
    
    statsContent.innerHTML = `
        <div class="daily-stats">
            <h3>Today's Progress</h3>
            <p><strong>Challenge:</strong> ${convertMechanicName(progress.currentMechanic)}</p>
            <p><strong>Date:</strong> ${progress.currentDate}</p>
            ${progress.isCompleted ? `
                <p><strong>Daily Score:</strong> <span class="${getScoreClass(scoreSummary.dailyAverage)}">${scoreSummary.dailyAverage}</span></p>
                ${scoreSummary.perfectCuts > 0 ? `<p><strong>Perfect Cuts:</strong> ${scoreSummary.perfectCuts}</p>` : ''}
            ` : `
                <p><strong>Progress:</strong> Shape ${progress.currentShape}, Attempt ${progress.currentAttempt}</p>
            `}
            
            <h4>Shape Scores</h4>
            ${Object.keys(scoreSummary.shapes).map(shapeKey => {
                const shapeNum = shapeKey.replace('shape', '');
                const shape = scoreSummary.shapes[shapeKey];
                return `
                    <div class="shape-score">
                        <strong>Shape ${shapeNum}:</strong>
                        ${shape.attempt1 !== undefined ? ` ${shape.attempt1}` : ' --'}
                        ${shape.attempt2 !== undefined ? `, ${shape.attempt2}` : ', --'}
                        ${shape.average > 0 ? ` (Avg: ${shape.average})` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}