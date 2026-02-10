// Comprehensive Refresh Protection System for Daily Shapes v4.0
// Handles all game state persistence and restoration

class RefreshProtectionSystem {
    constructor() {
        this.isInitialized = false;
        this.isRestoringState = false;
        this.currentGameState = null;
        this.saveDebouncer = null;
        
        // Bind methods
        this.initializeStateTracking = this.initializeStateTracking.bind(this);
        this.saveGameState = this.saveGameState.bind(this);
        this.restoreGameState = this.restoreGameState.bind(this);
        this.checkForExistingState = this.checkForExistingState.bind(this);
    }
    
    // Initialize the system
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🛡️ Initializing Refresh Protection System');
        
        // Set up browser navigation protection
        this.setupNavigationProtection();
        
        // Check for existing state
        const hasExistingState = await this.checkForExistingState();
        
        if (!hasExistingState) {
            this.initializeStateTracking();
        }
        
        // Set up daily cleanup
        this.setupDailyCleanup();
        
        this.isInitialized = true;
        console.log('✅ Refresh Protection System ready');
        
        return hasExistingState;
    }
    
    // Initialize state tracking for new game
    initializeStateTracking() {
        const currentDate = this.getCurrentLocalDate();
        
        this.currentGameState = {
            // Game identification
            date: currentDate,
            isGameStarted: false,
            mechanic: null,
            mechanicName: null,
            
            // Current position
            currentShape: 1,
            currentAttempt: 1,
            isGameComplete: false,
            
            // All cuts made
            cuts: [],
            
            // Visual state data
            currentShapeGeoJSON: null,
            lastRenderedCut: null,
            lastShapeColors: null,
            
            // UI state
            lastButtonShown: null,
            lastPercentageDisplay: null,
            progressCircleState: [false, false, false], // shape completion status
            
            // Completion data
            finalStats: null,
            
            // Timestamps
            gameStartedAt: null,
            lastSaveAt: null,
            completedAt: null
        };
        
        console.log('🆕 New game state initialized');
    }
    
    // Activate protection when "Play" button is pressed
    activateProtection(mechanicName, mechanicObject) {
        if (!this.currentGameState) {
            this.initializeStateTracking();
        }
        
        this.currentGameState.isGameStarted = true;
        this.currentGameState.mechanicName = mechanicName;
        this.currentGameState.mechanic = mechanicObject?.name || mechanicName;
        this.currentGameState.gameStartedAt = Date.now();
        
        // Save immediately
        this.saveGameState();
        
        console.log('🎮 Refresh protection activated for daily game mode');
    }
    
    // Save comprehensive game state
    saveGameState() {
        if (!this.currentGameState || this.isRestoringState) {
            return;
        }
        
        // Debounce saves to prevent excessive localStorage writes
        clearTimeout(this.saveDebouncer);
        this.saveDebouncer = setTimeout(() => {
            this._performSave();
        }, 100);
    }
    
    _performSave() {
        try {
            const currentDate = this.getCurrentLocalDate();
            const stateKey = `dailyGameState_${currentDate}`;
            
            // Update current state with global variables
            this.updateStateFromGlobals();
            
            // Update timestamp
            this.currentGameState.lastSaveAt = Date.now();
            
            // Save to localStorage
            localStorage.setItem(stateKey, JSON.stringify(this.currentGameState));
            
            console.log('💾 Game state saved', { 
                shape: this.currentGameState.currentShape,
                attempt: this.currentGameState.currentAttempt,
                cuts: this.currentGameState.cuts.length
            });
            
        } catch (error) {
            console.error('❌ Failed to save game state', error);
        }
    }
    
    // Update state from global game variables
    updateStateFromGlobals() {
        if (typeof window.currentShapeNumber !== 'undefined') {
            this.currentGameState.currentShape = window.currentShapeNumber;
        }
        if (typeof window.currentAttemptNumber !== 'undefined') {
            this.currentGameState.currentAttempt = window.currentAttemptNumber;
        }
        if (typeof window.currentGeoJSON !== 'undefined' && window.currentGeoJSON) {
            this.currentGameState.currentShapeGeoJSON = window.currentGeoJSON;
        }
        if (typeof window.gameState !== 'undefined') {
            this.currentGameState.gamePhase = window.gameState;
        }
    }
    
    // Save cut result
    saveCutResult(shapeIndex, attemptNumber, cutVector, leftPercentage, rightPercentage, score, commentary) {
        if (!this.currentGameState || this.isRestoringState) return;
        
        const cutData = {
            shapeIndex: shapeIndex,
            attemptNumber: attemptNumber,
            cutVector: cutVector,
            leftPercentage: leftPercentage,
            rightPercentage: rightPercentage,
            score: score,
            commentary: commentary,
            timestamp: Date.now()
        };
        
        // Add to cuts array
        this.currentGameState.cuts.push(cutData);
        
        // Save visual state
        this.saveVisualState(cutVector, leftPercentage, rightPercentage);
        
        // Update progress circles
        this.updateProgressState(shapeIndex, attemptNumber);
        
        // Save immediately for cut results
        this._performSave();
        
        console.log('✅ Cut result saved', { 
            shape: shapeIndex, 
            attempt: attemptNumber, 
            score: score 
        });
    }
    
    // Save visual state for restoration
    saveVisualState(cutVector, leftPercentage, rightPercentage) {
        if (!this.currentGameState) return;
        
        try {
            // Save cut vector
            if (cutVector) {
                this.currentGameState.lastRenderedCut = cutVector;
            }
            
            // Save percentage display
            if (leftPercentage !== undefined && rightPercentage !== undefined) {
                this.currentGameState.lastPercentageDisplay = {
                    left: leftPercentage,
                    right: rightPercentage
                };
            }
            
            // Capture canvas state
            if (window.canvas) {
                this.currentGameState.lastShapeColors = window.canvas.toDataURL();
            }
            
        } catch (error) {
            console.warn('⚠️ Could not save visual state', error);
        }
    }
    
    // Update progress circles state
    updateProgressState(shapeIndex, attemptNumber) {
        // Mark shape as having at least one attempt
        if (shapeIndex >= 1 && shapeIndex <= 3) {
            this.currentGameState.progressCircleState[shapeIndex - 1] = true;
        }
    }
    
    // Save game completion
    saveGameCompletion(finalStats) {
        if (!this.currentGameState) return;
        
        this.currentGameState.isGameComplete = true;
        this.currentGameState.finalStats = finalStats;
        this.currentGameState.completedAt = Date.now();
        
        this._performSave();
        
        console.log('🏁 Game completion saved');
    }
    
    // Check for existing saved state
    async checkForExistingState() {
        const today = this.getCurrentLocalDate();
        const stateKey = `dailyGameState_${today}`;
        
        try {
            const savedState = localStorage.getItem(stateKey);
            
            if (!savedState) {
                console.log('🆕 No saved state found - new game');
                return false;
            }
            
            const state = JSON.parse(savedState);
            
            // Validate state
            if (!state.date || state.date !== today) {
                console.log('🗑️ Clearing old state for new day');
                localStorage.removeItem(stateKey);
                return false;
            }
            
            if (!state.isGameStarted) {
                console.log('⚠️ State found but game not started');
                return false;
            }
            
            // Restore state
            if (state.isGameComplete) {
                console.log('🏁 Restoring completed game state');
                await this.restoreCompletedGame(state);
            } else {
                console.log('▶️ Restoring in-progress game state');
                await this.restoreInProgressGame(state);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error checking for existing state', error);
            return false;
        }
    }
    
    // Restore in-progress game
    async restoreInProgressGame(savedState) {
        console.log('🔄 Restoring in-progress game...');
        this.isRestoringState = true;
        
        try {
            // Set current state
            this.currentGameState = savedState;
            
            // Hide initial UI (Play button, welcome text)
            this.hideInitialGameUI();
            
            // Update global variables
            window.currentShapeNumber = savedState.currentShape || 1;
            window.currentAttemptNumber = savedState.currentAttempt || 1;
            window.gameState = 'playing';
            
            // Load correct mechanic
            if (savedState.mechanicName && window[savedState.mechanicName]) {
                window.currentMechanic = window[savedState.mechanicName];
                console.log(`🔧 Restored mechanic: ${savedState.mechanicName}`);
            }
            
            // Load and render current shape
            await this.loadAndRenderShape(savedState);
            
            // Restore all previous cuts visually
            await this.restoreVisualCuts(savedState.cuts);
            
            // Show current shape with most recent cut
            if (savedState.lastRenderedCut) {
                this.renderLastCut(savedState);
            }
            
            // Restore UI state
            this.restoreUIState(savedState);
            
            // Position user at correct game stage
            this.setCurrentGamePosition(savedState.currentShape, savedState.currentAttempt);
            
            console.log('✅ Game state restored successfully');
            
        } catch (error) {
            console.error('❌ Failed to restore in-progress game', error);
            // Fallback to new game
            this.initializeStateTracking();
        } finally {
            this.isRestoringState = false;
        }
    }
    
    // Restore completed game
    async restoreCompletedGame(savedState) {
        console.log('🏁 Restoring completed game state');
        this.isRestoringState = true;
        
        try {
            this.currentGameState = savedState;
            
            // Hide all cutting UI
            this.hideGameplayUI();
            
            // Show completion state
            this.showCompletedGameState(savedState);
            
        } catch (error) {
            console.error('❌ Failed to restore completed game', error);
        } finally {
            this.isRestoringState = false;
        }
    }
    
    // Hide initial game UI
    hideInitialGameUI() {
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.style.display = 'none';
        }
        
        // Hide welcome text or instructions
        const welcomeText = document.querySelector('.welcome-text');
        if (welcomeText) {
            welcomeText.style.display = 'none';
        }
    }
    
    // Hide all gameplay UI
    hideGameplayUI() {
        // Hide canvas and game controls
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            canvas.style.pointerEvents = 'none';
        }
        
        // Hide action buttons
        const actionButtons = document.querySelectorAll('.action-button');
        actionButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    // Load and render shape for restoration
    async loadAndRenderShape(savedState) {
        try {
            if (savedState.currentShapeGeoJSON) {
                window.currentGeoJSON = savedState.currentShapeGeoJSON;
                
                // Render the shape
                if (window.renderGeoJSON) {
                    await window.renderGeoJSON(savedState.currentShapeGeoJSON);
                }
            } else {
                // Load shape from file system
                const shapeNumber = savedState.currentShape || 1;
                if (window.loadShapeForDay) {
                    await window.loadShapeForDay(shapeNumber);
                }
            }
        } catch (error) {
            console.error('❌ Failed to load shape for restoration', error);
        }
    }
    
    // Restore visual cuts
    async restoreVisualCuts(cuts) {
        if (!cuts || cuts.length === 0) return;
        
        try {
            // Re-render each cut without animation
            for (const cut of cuts) {
                if (cut.cutVector && window.renderCutLine) {
                    window.renderCutLine(cut.cutVector, false); // No animation
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not restore visual cuts', error);
        }
    }
    
    // Render the last cut with colors
    renderLastCut(savedState) {
        try {
            // Skip rendering if we just canceled a line drawing to prevent visual corruption
            if (window.canceledLineDrawing) {
                console.log('🚫 Skipping renderLastCut due to recent cancel - preventing visual corruption');
                return;
            }
            
            if (savedState.lastShapeColors && window.canvas && window.ctx) {
                const img = new Image();
                img.onload = () => {
                    window.ctx.drawImage(img, 0, 0);
                };
                img.src = savedState.lastShapeColors;
            }
            
            // Show percentage display
            if (savedState.lastPercentageDisplay) {
                this.showPercentageDisplay(
                    savedState.lastPercentageDisplay.left,
                    savedState.lastPercentageDisplay.right
                );
            }
        } catch (error) {
            console.warn('⚠️ Could not render last cut', error);
        }
    }
    
    // Restore UI state
    restoreUIState(savedState) {
        try {
            // Restore progress circles
            if (savedState.progressCircleState) {
                this.updateProgressCircles(savedState.progressCircleState);
            }
            
            // Show appropriate button
            if (savedState.lastButtonShown) {
                this.showButton(savedState.lastButtonShown);
            }
            
        } catch (error) {
            console.warn('⚠️ Could not restore UI state', error);
        }
    }
    
    // Set current game position
    setCurrentGamePosition(shapeNumber, attemptNumber) {
        // Enable interaction based on current position
        window.isInteractionEnabled = true;
        
        // Update display elements
        this.updateGameDisplay(shapeNumber, attemptNumber);
    }
    
    // Show completed game state
    showCompletedGameState(savedState) {
        try {
            // Clear canvas
            if (window.ctx && window.canvas) {
                window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
            }
            
            // Show completion message
            this.showCompletionScreen(savedState);
            
        } catch (error) {
            console.error('❌ Failed to show completed game state', error);
        }
    }
    
    // Show completion screen with countdown and buttons
    showCompletionScreen(savedState) {
        // This would integrate with existing completion UI
        // Show countdown timer until next daily reset
        // Show "View Today's Stats" button
        // Show "Comp" button if user is authenticated
        
        console.log('🎉 Showing completion screen');
    }
    
    // Update progress circles display
    updateProgressCircles(progressState) {
        progressState.forEach((completed, index) => {
            const circle = document.querySelector(`.progress-circle-${index + 1}`);
            if (circle) {
                circle.classList.toggle('completed', completed);
            }
        });
    }
    
    // Show percentage display
    showPercentageDisplay(leftPct, rightPct) {
        const leftDisplay = document.getElementById('leftPercentage');
        const rightDisplay = document.getElementById('rightPercentage');
        
        if (leftDisplay) {
            leftDisplay.textContent = `${leftPct.toFixed(1)}%`;
        }
        if (rightDisplay) {
            rightDisplay.textContent = `${rightPct.toFixed(1)}%`;
        }
    }
    
    // Show appropriate button
    showButton(buttonType) {
        // Hide all buttons first
        const buttons = document.querySelectorAll('.action-button');
        buttons.forEach(btn => btn.style.display = 'none');
        
        // Show specific button
        const targetButton = document.getElementById(buttonType);
        if (targetButton) {
            targetButton.style.display = 'block';
        }
    }
    
    // Update game display
    updateGameDisplay(shapeNumber, attemptNumber) {
        // Update shape indicator
        const shapeIndicator = document.getElementById('currentShape');
        if (shapeIndicator) {
            shapeIndicator.textContent = shapeNumber;
        }
        
        // Update attempt indicator  
        const attemptIndicator = document.getElementById('currentAttempt');
        if (attemptIndicator) {
            attemptIndicator.textContent = attemptNumber;
        }
    }
    
    // Browser navigation protection
    setupNavigationProtection() {
        // Handle page refresh and navigation
        window.addEventListener('beforeunload', (event) => {
            if (this.currentGameState && this.currentGameState.isGameStarted && !this.currentGameState.isGameComplete) {
                // Save state before leaving
                this._performSave();
            }
        });
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (this.currentGameState && this.currentGameState.isGameStarted) {
                // Prevent navigation that could reset progress
                event.preventDefault();
                console.log('🛡️ Navigation blocked to preserve game state');
            }
        });
    }
    
    // Daily cleanup of old states
    setupDailyCleanup() {
        const cleanup = () => {
            try {
                const currentDate = this.getCurrentLocalDate();
                const keys = Object.keys(localStorage);
                
                keys.forEach(key => {
                    if (key.startsWith('dailyGameState_') && !key.includes(currentDate)) {
                        localStorage.removeItem(key);
                        console.log('🗑️ Removed old game state', { key });
                    }
                });
                
            } catch (error) {
                console.warn('⚠️ Failed to cleanup old states', error);
            }
        };
        
        // Run cleanup now
        cleanup();
        
        // Schedule daily cleanup at midnight
        const msUntilMidnight = this.getMillisecondsUntilMidnight();
        setTimeout(() => {
            cleanup();
            setInterval(cleanup, 24 * 60 * 60 * 1000); // Daily
        }, msUntilMidnight);
    }
    
    // Utility methods
    getCurrentLocalDate() {
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    
    getMillisecondsUntilMidnight() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return midnight - now;
    }
    
    // Guest user handling
    getGuestId() {
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
            guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('guestId', guestId);
        }
        return guestId;
    }
    
    // Public methods for external use
    isGameInProgress() {
        return this.currentGameState && 
               this.currentGameState.isGameStarted && 
               !this.currentGameState.isGameComplete;
    }
    
    isGameCompleted() {
        return this.currentGameState && this.currentGameState.isGameComplete;
    }
    
    getCurrentState() {
        return this.currentGameState;
    }
    
    // Reset for new day
    resetForNewDay() {
        const currentDate = this.getCurrentLocalDate();
        const stateKey = `dailyGameState_${currentDate}`;
        localStorage.removeItem(stateKey);
        
        this.currentGameState = null;
        this.isRestoringState = false;
        
        console.log('🌅 Reset for new day');
    }
}

// Create global instance
window.RefreshProtection = new RefreshProtectionSystem();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.RefreshProtection.initialize();
    });
} else {
    window.RefreshProtection.initialize();
}

console.log('🛡️ Refresh Protection System loaded');