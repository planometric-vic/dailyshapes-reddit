// Daily Game Core System for Daily Shapes v4.0
// Handles automatic daily mechanics, state persistence, and scoring

class DailyGameCore {
    constructor() {
        this.currentDate = null;
        this.currentMechanic = null;
        this.userTimezone = null;
        this.midnightTimer = null;
        this.gameState = {
            currentShape: 1,
            currentAttempt: 1,  // Always 1 (single attempt per shape)
            shapeResults: {},
            hasStartedToday: false,
            completedShapes: [],
            isCompleted: false
        };
        this.shapes = {};
        // Initialize shape slots dynamically (10 per day)
        for (let i = 1; i <= 10; i++) this.shapes[`shape${i}`] = null;
    }
    
    // Initialize the daily game system
    async initialize() {
        // SAFETY CHECK: Don't initialize if demo mode is active
        if (this.disabled) {
            console.log('🚫 Daily Game Core initialization BLOCKED - demo mode active');
            return;
        }
        
        console.log('🎮 Initializing Daily Game Core...');
        
        // Set up timezone and date
        this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.currentDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format

        console.log(`📅 Current date: ${this.currentDate}`);
        console.log(`🌍 User timezone: ${this.userTimezone}`);
        
        // Try to restore saved state first
        await this.restoreGameState();
        
        // Load today's shapes and mechanic
        await this.loadTodaysContent();
        
        // Set up midnight reset timer
        this.setupMidnightReset();
        
        // Set up orientation blocking
        this.setupOrientationBlocking();
        
        console.log('✅ Daily Game Core initialized');
        return this.gameState;
    }
    
    // Determine which mechanic to use based on day of week
    getMechanicForDay(date) {
        const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        const mechanicMap = {
            1: 'DefaultWithUndoMechanic',      // Monday
            2: 'HorizontalOnlyMechanic',       // Tuesday
            3: 'DiagonalAscendingMechanic',    // Wednesday
            4: 'CircleCutMechanic',            // Thursday
            5: 'ThreePointTriangleMechanic',  // Friday
            6: 'RotatingSquareMechanic',      // Saturday
            0: 'RotatingShapeVectorMechanic'  // Sunday
        };
        
        return mechanicMap[dayOfWeek];
    }
    
    // Load today's content (mechanic and shapes)
    async loadTodaysContent() {
        try {
            // Determine today's mechanic
            const mechanicName = this.getMechanicForDay(this.currentDate);
            this.currentMechanic = mechanicName;
            
            console.log(`🎯 Today's mechanic: ${mechanicName}`);
            
            // Load today's shapes
            await this.loadTodaysShapes();
            
            // Initialize the game engine with today's mechanic
            if (window.initializeGameEngine) {
                window.initializeGameEngine(mechanicName);
            }
            
        } catch (error) {
            console.error('Error loading today\'s content:', error);
            // Fallback to demo shapes if needed
            await this.loadFallbackShapes();
        }
    }
    
    // Load shapes for today's date
    async loadTodaysShapes() {
        try {
            // Try to load from Supabase via DailyModeManager
            if (window.DailyModeManager && !this.disabled && !window.isDemoMode) {
                console.log('🔗 Loading shapes via DailyModeManager...');

                // Initialize daily mode manager if not already done
                if (!window.dailyModeManager) {
                    window.dailyModeManager = new window.DailyModeManager();
                    await window.dailyModeManager.initialize();
                }

                // Load shapes from daily mode manager
                if (window.dailyModeManager.shapes && window.dailyModeManager.shapes.length >= 1) {
                    const managerShapes = window.dailyModeManager.shapes;
                    const validShapes = managerShapes.filter(s => s !== null && s !== undefined);

                    if (validShapes.length >= 1) {
                        for (let i = 0; i < 10; i++) {
                            this.shapes[`shape${i + 1}`] = managerShapes[i] || validShapes[0];
                        }
                        console.log(`✅ Shapes loaded from Supabase via DailyModeManager (${validShapes.length}/10 valid)`);
                    } else {
                        throw new Error(`DailyModeManager has insufficient valid shapes (${validShapes.length}/10)`);
                    }
                } else {
                    throw new Error('DailyModeManager shapes not available');
                }
            } else {
                // Fall back to local demo shapes
                console.log('⚠️ DailyModeManager not available, using demo shapes');
                await this.loadDemoShapes();
            }

            console.log('🎨 Today\'s shapes loaded successfully');

        } catch (error) {
            console.log('📁 Loading fallback shapes due to error:', error.message);
            await this.loadDemoShapes();
        }
    }
    
    // Legacy method - now handled by DailyModeManager
    async loadShapesFromSupabase(datePrefix) {
        console.log('⚠️ loadShapesFromSupabase is deprecated, use DailyModeManager instead');
        throw new Error('Use DailyModeManager for Supabase shape loading');
    }
    
    // Load demo shapes from local files
    async loadDemoShapes() {
        console.log('📁 Loading demo shapes from local files');
        
        // Use day of week to determine which demo shapes to use
        const dayOfWeek = new Date(this.currentDate).getDay();
        const demoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Sunday=7, Monday=1, etc.
        
        // Demo shapes: load up to 10 (reuse day shapes cyclically if fewer are available)
        const shapePaths = [];
        for (let i = 0; i < 10; i++) {
            const fileIndex = (i % 3) + 1; // Cycle through shape1-3 demo files
            shapePaths.push(`v4-tests/day${demoDay}/shape${fileIndex}.geojson`);
        }

        for (let i = 0; i < 10; i++) {
            const shapeKey = `shape${i + 1}`;
            try {
                const response = await fetch(shapePaths[i]);
                if (response.ok) {
                    this.shapes[shapeKey] = await response.json();
                } else {
                    throw new Error(`Shape ${i + 1} not found`);
                }
            } catch (error) {
                console.warn(`Error loading ${shapeKey}:`, error);
                // Continue trying other shapes
            }
        }
    }
    
    // Load basic fallback shapes
    async loadFallbackShapes() {
        console.log('🔄 Loading fallback shapes');
        
        // Use shape1.geojson as fallback for all shapes
        try {
            const response = await fetch('geojson library/shape1.geojson');
            if (response.ok) {
                const fallbackShape = await response.json();
                for (let i = 1; i <= 10; i++) this.shapes[`shape${i}`] = fallbackShape;
            }
        } catch (error) {
            console.error('Failed to load fallback shapes:', error);
        }
    }
    
    // Get shape data for a specific shape number
    getShapeData(shapeNumber) {
        const shapeKey = `shape${shapeNumber}`;
        return this.shapes[shapeKey];
    }
    
    // Save game state to localStorage
    saveGameState() {
        const stateToSave = {
            ...this.gameState,
            date: this.currentDate,
            mechanic: this.currentMechanic,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('dailyGameState', JSON.stringify(stateToSave));
            console.log('💾 Game state saved');
        } catch (error) {
            console.error('Error saving game state:', error);
        }
    }
    
    // Restore game state from server (if logged in) or localStorage (fallback)
    async restoreGameState() {
        // If user is logged in, get state from server first
        if (window.AuthService && !window.AuthService.isGuest && window.SupabaseConfig?.isReady()) {
            console.log('🔐 User logged in, checking server for daily progress...');

            // ALWAYS clear old localStorage for logged-in users to prevent stale state
            try {
                const savedState = localStorage.getItem('dailyGameState');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    if (state.date !== this.currentDate) {
                        localStorage.removeItem('dailyGameState');
                        console.log('🗑️ Cleared old localStorage state for new day');
                    }
                }
            } catch (error) {
                console.error('Error checking localStorage date:', error);
            }

            const serverState = await this.loadDailyProgressFromServer();
            if (serverState) {
                console.log('✅ Restored game state from server');
                return true;
            }
        }

        // Fallback to localStorage (for guests or if server fails)
        try {
            const savedState = localStorage.getItem('dailyGameState');
            if (!savedState) {
                console.log('📝 No saved game state found');
                return false;
            }

            const state = JSON.parse(savedState);

            // Check if saved state is for today
            if (state.date !== this.currentDate) {
                console.log('🗑️ Clearing old game state for new day');
                this.clearGameState();
                return false;
            }
            
            // Restore the state
            this.gameState = {
                currentShape: state.currentShape || 1,
                currentAttempt: state.currentAttempt || 1,
                shapeResults: state.shapeResults || {},
                hasStartedToday: state.hasStartedToday || false,
                completedShapes: state.completedShapes || [],
                isCompleted: state.isCompleted || false
            };
            
            console.log('🔄 Game state restored:', this.gameState);
            return true;
        } catch (error) {
            console.error('Error restoring game state:', error);
            return false;
        }
    }
    
    // Clear game state
    clearGameState() {
        this.gameState = {
            currentShape: 1,
            currentAttempt: 1,
            shapeResults: {},
            hasStartedToday: false,
            completedShapes: [],
            isCompleted: false
        };
        
        try {
            localStorage.removeItem('dailyGameState');
            console.log('🧹 Game state cleared');
        } catch (error) {
            console.error('Error clearing game state:', error);
        }
    }
    
    // Update game state after a cut (1 attempt per shape)
    updateGameState(shapeNumber, attemptNumber, result) {
        const shapeKey = `shape${shapeNumber}`;

        if (!this.gameState.shapeResults[shapeKey]) {
            this.gameState.shapeResults[shapeKey] = {};
        }

        this.gameState.shapeResults[shapeKey][`attempt${attemptNumber}`] = result;
        this.gameState.hasStartedToday = true;

        // Shape is completed after 1 attempt
        if (!this.gameState.completedShapes.includes(shapeNumber)) {
            this.gameState.completedShapes.push(shapeNumber);
        }

        // Check if all 10 shapes are completed
        if (this.gameState.completedShapes.length === 10) {
            this.gameState.isCompleted = true;
        }

        // Move to next shape
        if (shapeNumber < 10) {
            this.gameState.currentShape = shapeNumber + 1;
            this.gameState.currentAttempt = 1;
        }

        this.saveGameState();

        // Save to database if user is authenticated
        if (window.AuthService && window.AuthService.isLoggedIn()) {
            this.saveToDatabaseDebounced();
        }
    }
    
    // Debounced database save to avoid too frequent calls
    saveToDatabaseDebounced() {
        clearTimeout(this.dbSaveTimer);
        this.dbSaveTimer = setTimeout(async () => {
            await this.saveDailyProgressToServer();
        }, 1000);
    }

    // Load daily progress from server
    async loadDailyProgressFromServer() {
        if (!window.SupabaseConfig?.isReady() || !window.AuthService?.currentUser?.id) {
            return null;
        }

        try {
            const { data, error } = await window.SupabaseConfig.client
                .from('user_daily_progress')
                .select('*')
                .eq('user_id', window.AuthService.currentUser.id)
                .eq('date', this.currentDate)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = not found
                console.error('Error loading daily progress:', error);
                return null;
            }

            if (data) {
                // Restore game state from server data
                this.gameState = {
                    currentShape: data.completed ? 11 : (data.attempts?.length || 0) + 1,
                    currentAttempt: 1,  // Always 1 (single attempt per shape)
                    shapeResults: data.scores ? this.convertScoresToShapeResults(data.scores) : {},
                    hasStartedToday: data.attempts?.length > 0,
                    completedShapes: data.scores ? Object.keys(this.convertScoresToShapeResults(data.scores)) : [],
                    isCompleted: data.completed
                };

                console.log('📊 Loaded daily progress from server:', data);
                return true;
            }

            return null;
        } catch (error) {
            console.error('Error loading daily progress:', error);
            return null;
        }
    }

    // Save daily progress to server
    async saveDailyProgressToServer() {
        if (!window.SupabaseConfig?.isReady() || !window.AuthService?.currentUser?.id) {
            console.log('⚠️ Cannot save to server - not authenticated');
            return;
        }

        try {
            // First, check if there's already a completed record for today
            const { data: existingData, error: checkError } = await window.SupabaseConfig.client
                .from('user_daily_progress')
                .select('completed, total_score')
                .eq('user_id', window.AuthService.currentUser.id)
                .eq('date', this.currentDate)
                .single();

            // If there's already a completed game, don't overwrite it
            if (existingData && existingData.completed) {
                console.log('🚫 Game already completed on server - not overwriting existing score:', existingData.total_score);
                console.log('⚠️ This prevents score manipulation by replaying after clearing cache');
                return;
            }

            const attempts = this.getAllAttempts();
            const scores = this.getAllScores();
            const totalScore = scores.reduce((sum, score) => sum + (score || 0), 0);

            const progressData = {
                user_id: window.AuthService.currentUser.id,
                date: this.currentDate,
                completed: this.gameState.isCompleted,
                scores: scores.length > 0 ? scores : null,
                attempts: attempts.length > 0 ? attempts : null,
                total_score: totalScore,
                updated_at: new Date().toISOString()
            };

            // Use upsert to handle both insert and update
            // This will only happen if there's no completed record yet
            const { data, error } = await window.SupabaseConfig.client
                .from('user_daily_progress')
                .upsert(progressData, {
                    onConflict: 'user_id,date',
                    ignoreDuplicates: false
                })
                .select();

            if (error) {
                console.error('Error saving daily progress:', error);
                return;
            }

            console.log('💾 Daily progress saved to server:', data);

            // Also save to localStorage as backup
            this.saveGameState();

        } catch (error) {
            console.error('Error saving daily progress:', error);
        }
    }

    // Helper function to convert scores array to shapeResults format
    convertScoresToShapeResults(scores) {
        const results = {};
        scores.forEach((score, index) => {
            if (score !== null) {
                results[`shape${index + 1}`] = score;
            }
        });
        return results;
    }

    // Helper function to get all attempts in chronological order
    getAllAttempts() {
        const attempts = [];
        for (let shape = 1; shape <= 10; shape++) {
            const shapeAttempts = this.getShapeAttempts(shape);
            shapeAttempts.forEach(attempt => {
                attempts.push({
                    ...attempt,
                    shape: shape,
                    timestamp: attempt.timestamp || Date.now()
                });
            });
        }
        return attempts.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Helper function to get all final scores
    getAllScores() {
        const scores = [];
        for (let shape = 1; shape <= 10; shape++) {
            scores.push(this.gameState.shapeResults[`shape${shape}`] || null);
        }
        return scores;
    }

    // Refresh game state after account login/logout
    async refreshForNewUser() {
        console.log('🔄 Refreshing game state for new user...');

        // Clear local game state
        this.gameState = {
            currentShape: 1,
            currentAttempt: 1,
            shapeResults: {},
            hasStartedToday: false,
            completedShapes: [],
            isCompleted: false
        };

        // Load fresh state from server (if logged in)
        await this.restoreGameState();

        // Update UI to reflect new state
        if (window.updateGameUI) {
            window.updateGameUI();
        }

        console.log('✅ Game state refreshed for new user');
    }

    // Save current progress to database
    async saveToDatabase() {
        if (!window.AuthService || !window.AuthService.isLoggedIn()) {
            return;
        }
        
        try {
            // Only save if game is completed
            if (!this.gameState.isCompleted) {
                return;
            }
            
            const shapeScores = {};
            
            // Convert game state to database format
            for (let i = 1; i <= 10; i++) {
                const shapeKey = `shape${i}`;
                const results = this.gameState.shapeResults[shapeKey];
                if (results) {
                    // Single attempt per shape
                    shapeScores[shapeKey] = results.attempt1?.score || 0;
                }
            }
            
            await window.AuthService.saveDailyScore(
                this.currentDate,
                shapeScores,
                this.currentMechanic
            );
            
            console.log('💾 Progress saved to database');
        } catch (error) {
            console.error('Error saving to database:', error);
        }
    }
    
    // Setup midnight reset timer
    setupMidnightReset() {
        const timeUntilMidnight = this.getTimeUntilMidnight();
        
        console.log(`⏰ Setting midnight reset timer: ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`);
        
        this.midnightTimer = setTimeout(() => {
            this.handleMidnightReset();
        }, timeUntilMidnight);
    }
    
    // Calculate time until next midnight in user's timezone
    getTimeUntilMidnight() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow - now;
    }
    
    // Handle midnight reset
    async handleMidnightReset() {
        console.log('🌙 Midnight reset triggered');
        
        // Clear current game state
        this.clearGameState();
        
        // Update to new date
        this.currentDate = new Date().toLocaleDateString('en-CA');
        
        // Update date title in header
        if (window.updateDateTitle) {
            window.updateDateTitle();
        }
        
        // Load new day's content
        await this.loadTodaysContent();
        
        // Reset game UI
        if (window.resetGameForNewDay) {
            window.resetGameForNewDay();
        }
        
        // Set up next midnight timer
        this.setupMidnightReset();
        
        console.log('🎉 New day initialized!');
    }
    
    // Setup orientation blocking for mobile devices
    setupOrientationBlocking() {
        // CRITICAL: Initialize modal flag to prevent undefined checks
        if (typeof window.isModalOpenForOrientationCheck === 'undefined') {
            window.isModalOpenForOrientationCheck = false;
        }

        // Create orientation message overlay
        if (!document.getElementById('orientationMessage')) {
            const orientationOverlay = document.createElement('div');
            orientationOverlay.id = 'orientationMessage';
            orientationOverlay.className = 'orientation-message';
            orientationOverlay.innerHTML = `
                <div class="orientation-content">
                    <div class="rotate-icon">📱</div>
                    <h2>Please rotate your device</h2>
                    <p>Daily Shapes works best in portrait mode</p>
                </div>
            `;
            orientationOverlay.style.display = 'none';
            document.body.appendChild(orientationOverlay);
        }

        // Track initial viewport height to detect keyboard
        this.initialViewportHeight = window.innerHeight;
        this.orientationCheckDebounce = null;

        // Set up orientation checking
        this.checkOrientation();

        // Debounced resize handler
        window.addEventListener('resize', () => {
            clearTimeout(this.orientationCheckDebounce);
            this.orientationCheckDebounce = setTimeout(() => {
                this.checkOrientation();
            }, 200);
        });

        window.addEventListener('orientationchange', () => {
            // Reset baseline height on actual orientation change
            setTimeout(() => {
                this.initialViewportHeight = window.innerHeight;
                this.checkOrientation();
            }, 500);
        });
    }
    
    // Check and enforce portrait orientation on mobile
    checkOrientation() {
        console.log(`🔍 checkOrientation() called - modalFlag: ${window.isModalOpenForOrientationCheck}`);

        const orientationMessage = document.getElementById('orientationMessage');
        const gameContainer = document.querySelector('.app-container');

        // CRITICAL: Skip ALL checks if any modal is open (prevents keyboard issues)
        if (window.isModalOpenForOrientationCheck === true) {
            console.log('🚫 Orientation check skipped - modal is open');
            return;
        }

        // Check if an input/textarea has focus (keyboard is likely open)
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable ||
            activeElement.type === 'text' ||
            activeElement.type === 'password' ||
            activeElement.type === 'email'
        )) {
            console.log('⌨️ Orientation check skipped - input field has focus');
            return;
        }

        // Detect keyboard appearance - if viewport shrank significantly, keyboard is likely open
        const currentHeight = window.innerHeight;
        const heightDifference = this.initialViewportHeight - currentHeight;
        const likelyKeyboardOpen = heightDifference > 100; // More sensitive threshold

        // Debug logging
        if (heightDifference > 50) {
            console.log(`📐 Height change detected: ${heightDifference}px (keyboard: ${likelyKeyboardOpen})`);
        }

        // Skip check if keyboard is likely open
        if (likelyKeyboardOpen) {
            console.log('⌨️ Orientation check skipped - keyboard likely open');
            return;
        }

        // Helper function to check if element is truly visible
        const isElementVisible = (element) => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   element.offsetParent !== null;
        };

        // Check if any auth/modal is open (these have forms that trigger keyboard)
        const authModal = document.getElementById('authModal');
        const changePasswordModal = document.getElementById('changePasswordModal');
        const userStatsModal = document.getElementById('userStatsModal');

        const isAnyModalOpen = isElementVisible(authModal) ||
                               isElementVisible(changePasswordModal) ||
                               isElementVisible(userStatsModal);

        // Skip orientation check if any modal is open
        if (isAnyModalOpen) {
            console.log('🚫 Orientation check skipped - modal is visible');
            return;
        }

        // Use screen.orientation API when available for more reliable detection
        let isLandscape;
        if (screen.orientation && screen.orientation.type) {
            isLandscape = screen.orientation.type.includes('landscape');
        } else {
            // Fallback to screen dimensions (not window) to avoid keyboard-induced changes
            const useScreenDimensions = window.screen && window.screen.width && window.screen.height;
            if (useScreenDimensions) {
                isLandscape = window.screen.width > window.screen.height;
            } else {
                // Last resort: use window dimensions with strict threshold
                isLandscape = window.innerWidth > window.innerHeight && window.innerWidth > 768;
            }
        }

        const isSmallHeight = window.innerHeight < 500;
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isLandscape && isSmallHeight && isMobile) {
            orientationMessage.style.display = 'flex';
            gameContainer.style.display = 'none';
            // COMPLETELY BLOCK interaction
            document.body.style.overflow = 'hidden';
        } else {
            orientationMessage.style.display = 'none';
            gameContainer.style.display = 'flex';
            document.body.style.overflow = '';
        }
    }
    
    // Get current game progress
    getGameProgress() {
        return {
            ...this.gameState,
            currentDate: this.currentDate,
            currentMechanic: this.currentMechanic,
            userTimezone: this.userTimezone
        };
    }
    
    // Check if player can make a cut (for UI state management)
    canMakeCut(shapeNumber, attemptNumber) {
        return this.gameState.currentShape === shapeNumber && 
               this.gameState.currentAttempt === attemptNumber;
    }
    
    // Get next action for UI
    getNextAction() {
        if (this.gameState.isCompleted) {
            return { type: 'completed', message: 'All shapes completed!' };
        }
        
        const currentShape = this.gameState.currentShape;
        const currentAttempt = this.gameState.currentAttempt;
        
        return {
            type: 'cut',
            shape: currentShape,
            attempt: currentAttempt,
            message: `Shape ${currentShape}, Attempt ${currentAttempt}`
        };
    }
    
    // Cleanup timers
    destroy() {
        if (this.midnightTimer) {
            clearTimeout(this.midnightTimer);
        }
        if (this.dbSaveTimer) {
            clearTimeout(this.dbSaveTimer);
        }
    }
}

// Create singleton instance
const dailyGameCore = new DailyGameCore();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.DailyGameCore = dailyGameCore;

    // Global refresh function for external use
    window.refreshDailyGameForNewUser = async function() {
        if (window.DailyGameCore && window.DailyGameCore.refreshForNewUser) {
            await window.DailyGameCore.refreshForNewUser();
        }
    };
}

// Helper function to initialize game engine with specific mechanic
window.initializeGameEngine = function(mechanicName) {
    console.log(`🔧 Initializing game engine with ${mechanicName}`);
    
    // Set the current mechanic based on mechanic name
    if (window[mechanicName]) {
        window.currentMechanic = window[mechanicName];
        console.log(`✅ ${mechanicName} mechanic activated`);
    } else {
        console.warn(`❌ Mechanic ${mechanicName} not found, using default`);
        window.currentMechanic = window.DefaultWithUndoMechanic;
    }
};

// Helper function to reset game for new day
window.resetGameForNewDay = function() {
    console.log('🔄 Resetting game for new day');
    
    // Reset game variables (preserve existing logic)
    if (window.resetGameState) {
        window.resetGameState();
    }
    
    // Clear canvas
    if (window.ctx) {
        window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
    }
    
    // Reset UI elements
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
    
    // Load first shape
    if (window.loadShapeForDay) {
        window.loadShapeForDay(1);
    }
};