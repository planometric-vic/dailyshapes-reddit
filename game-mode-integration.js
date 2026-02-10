/**
 * Game Mode Integration Module for Daily Shapes v4.0
 * Integrates new Supabase storage with existing game mechanics
 */

class GameModeIntegration {
    constructor() {
        this.dailyMode = null;
        this.practiceMode = null;
        this.currentMode = null;
        this.isInitialized = false;
        this.errorHandler = new ErrorHandler();
    }

    /**
     * Initialize the game mode system
     */
    async initialize() {
        console.log('🎮 Initializing Game Mode Integration...');

        try {
            // Get Supabase client from various possible sources
            const client = this.getSupabaseClient();

            if (!client) {
                console.warn('⚠️ Supabase client not available. Running in offline mode.');
                this.errorHandler.activateDemoMode();
                return false;
            }

            // Test bucket access by trying to load a test file
            console.log('🔍 Testing Supabase bucket access...');
            try {
                const { data: testUrlData } = client.storage
                    .from('shapes')
                    .getPublicUrl('test-connection.json');

                if (!testUrlData?.publicUrl) {
                    throw new Error('Cannot generate public URLs');
                }

                console.log('✅ Bucket URL generation works');
            } catch (bucketError) {
                console.error('❌ Bucket access failed:', bucketError);
                this.errorHandler.activateDemoMode();
                return false;
            }

            console.log('✅ Supabase bucket accessible - overriding demo mode');

            // Override demo mode flags since we have bucket access
            window.isDemoMode = false;
            if (window.DailyGameCore) {
                window.DailyGameCore.disabled = false;
            }

            // Initialize storage module
            if (!window.ShapeStorage) {
                console.error('ShapeStorage module not loaded');
                return false;
            }

            // Determine which mode to start
            const mode = this.determineGameMode();

            if (mode === 'daily') {
                await this.initializeDailyMode();
            } else if (mode === 'practice') {
                await this.initializePracticeMode();
            }

            this.isInitialized = true;
            console.log('✅ Game Mode Integration initialized');

            return true;

        } catch (error) {
            console.error('Failed to initialize game modes:', error);
            this.errorHandler.handleInitError(error);
            return false;
        }
    }

    /**
     * Get Supabase client from various sources
     */
    getSupabaseClient() {
        // Check for v4.0 SupabaseConfig client
        if (window.SupabaseConfig && window.SupabaseConfig.client) {
            return window.SupabaseConfig.client;
        }

        // Check for existing supabaseClient global
        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        // Try to create client if Supabase library is available
        if (window.supabase && window.SupabaseConfig) {
            const { createClient } = window.supabase;
            const client = createClient(
                window.SupabaseConfig.url,
                window.SupabaseConfig.anonKey
            );
            window.SupabaseConfig.client = client;
            window.supabaseClient = client; // Set global reference
            return client;
        }

        return null;
    }

    /**
     * Determine which game mode to use
     */
    determineGameMode() {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');

        if (mode === 'practice') {
            return 'practice';
        }

        // Check if user is authenticated for practice mode
        const isAuthenticated = this.checkAuthentication();
        if (!isAuthenticated && mode === 'practice') {
            console.log('⚠️ Practice mode requires authentication');
            return 'daily';
        }

        // Default to daily mode
        return mode || 'daily';
    }

    /**
     * Check user authentication
     */
    checkAuthentication() {
        // Check Supabase session
        const token = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
        if (token) {
            try {
                const data = JSON.parse(token);
                return !!(data && data.access_token);
            } catch {
                return false;
            }
        }
        return false;
    }

    /**
     * Initialize Daily Mode
     */
    async initializeDailyMode() {
        console.log('🌅 Starting Daily Mode...');

        this.dailyMode = new DailyModeManager();
        const result = await this.dailyMode.initialize();

        if (result.success) {
            this.currentMode = 'daily';

            // Expose dailyModeManager globally for shape access
            window.dailyModeManager = this.dailyMode;
            console.log('🔗 DailyModeManager exposed globally as window.dailyModeManager');

            await this.loadDailyShape(0);
        }

        return result;
    }

    /**
     * Initialize Practice Mode
     */
    async initializePracticeMode() {
        console.log('🎯 Starting Practice Mode...');

        this.practiceMode = new PracticeModeManager();
        const result = await this.practiceMode.initialize();

        if (result.success) {
            this.currentMode = 'practice';
            await this.loadPracticeShape();
        }

        return result;
    }

    /**
     * Load shape for Daily Mode
     */
    async loadDailyShape(index) {
        if (!this.dailyMode) return null;

        const shape = this.dailyMode.getShape(index);

        if (shape) {
            // Integrate with existing game engine
            this.integrateShapeWithEngine(shape, 'daily');

            // Handle Sunday rotation
            if (shape.rotationEnabled) {
                this.enableRotationMechanic(shape);
            }
        }

        return shape;
    }

    /**
     * Load shape for Practice Mode
     */
    async loadPracticeShape() {
        if (!this.practiceMode) return null;

        const shape = this.practiceMode.getCurrentShape();

        if (shape && !shape.error) {
            // Integrate with existing game engine
            this.integrateShapeWithEngine(shape, 'practice');
        }

        return shape;
    }

    /**
     * Integrate shape with existing game engine
     */
    integrateShapeWithEngine(shape, mode) {
        if (!shape) return;

        try {
            // Update existing shape loader
            if (window.loadedGeoJSON) {
                window.loadedGeoJSON = shape;
            }

            // Update shape references
            if (window.currentShapeData) {
                window.currentShapeData = shape;
            }

            // Trigger shape loaded event
            this.triggerShapeLoadedEvent(shape, mode);

            console.log(`✅ Shape integrated with game engine (${mode} mode)`);

        } catch (error) {
            console.error('Failed to integrate shape:', error);
            this.errorHandler.handleShapeError(error);
        }
    }

    /**
     * Enable rotation mechanic for Sunday shapes
     */
    enableRotationMechanic(shape) {
        if (!shape.properties || !shape.properties.rotationRef) {
            console.warn('Rotation reference missing for Sunday shape');
            return;
        }

        // Set rotation flag for game engine
        if (window.gameEngine) {
            window.gameEngine.enableRotation = true;
            window.gameEngine.rotationRef = shape.properties.rotationRef;
        }

        // Update mechanic name
        if (window.currentMechanic) {
            window.currentMechanic = 'RotatingShapeVectorMechanic';
        }

        console.log('🔄 Rotation mechanic enabled for Sunday');
    }

    /**
     * Handle shape navigation (Practice Mode)
     */
    async navigatePractice(direction) {
        if (!this.practiceMode || this.currentMode !== 'practice') {
            return null;
        }

        let shape;
        if (direction === 'next') {
            shape = await this.practiceMode.nextShape();
        } else if (direction === 'previous') {
            shape = await this.practiceMode.previousShape();
        }

        if (shape && !shape.error) {
            this.integrateShapeWithEngine(shape, 'practice');
        }

        return shape;
    }

    /**
     * Handle shape progression (Daily Mode)
     */
    async progressDaily() {
        if (!this.dailyMode || this.currentMode !== 'daily') {
            return null;
        }

        const shape = this.dailyMode.nextShape();

        if (shape) {
            this.integrateShapeWithEngine(shape, 'daily');
        }

        return shape;
    }

    /**
     * Trigger shape loaded event
     */
    triggerShapeLoadedEvent(shape, mode) {
        const event = new CustomEvent('shapeLoaded', {
            detail: {
                shape: shape,
                mode: mode,
                metadata: shape.metadata || {}
            }
        });

        window.dispatchEvent(event);
    }

    /**
     * Get current mode info
     */
    getModeInfo() {
        if (this.currentMode === 'daily' && this.dailyMode) {
            return {
                mode: 'daily',
                progress: this.dailyMode.getProgress()
            };
        } else if (this.currentMode === 'practice' && this.practiceMode) {
            return {
                mode: 'practice',
                navigation: this.practiceMode.getNavigationInfo()
            };
        }

        return null;
    }

    /**
     * Switch game mode
     */
    async switchMode(newMode) {
        // Clean up current mode
        if (this.currentMode === 'daily' && this.dailyMode) {
            this.dailyMode.cleanup();
        } else if (this.currentMode === 'practice' && this.practiceMode) {
            this.practiceMode.cleanup();
        }

        // Initialize new mode
        if (newMode === 'daily') {
            await this.initializeDailyMode();
        } else if (newMode === 'practice') {
            await this.initializePracticeMode();
        }

        return this.currentMode;
    }

    /**
     * Clean up
     */
    cleanup() {
        if (this.dailyMode) {
            this.dailyMode.cleanup();
        }
        if (this.practiceMode) {
            this.practiceMode.cleanup();
        }
        this.isInitialized = false;
        console.log('🧹 Game Mode Integration cleaned up');
    }
}

/**
 * Error Handler for graceful error management
 */
class ErrorHandler {
    constructor() {
        this.errorCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Handle initialization errors
     */
    handleInitError(error) {
        console.error('Initialization error:', error);

        // Show user-friendly message
        this.showErrorMessage(
            'Unable to connect to shape server',
            'The game will continue with demo shapes.',
            'warning'
        );

        // Fall back to demo mode
        this.activateDemoMode();
    }

    /**
     * Handle shape loading errors
     */
    handleShapeError(error) {
        console.error('Shape loading error:', error);

        this.errorCount++;

        if (this.errorCount < this.maxRetries) {
            // Retry loading
            this.showErrorMessage(
                'Shape loading failed',
                `Retrying... (${this.errorCount}/${this.maxRetries})`,
                'info'
            );
        } else {
            // Give up and show error
            this.showErrorMessage(
                'Unable to load shape',
                'Please check your connection and try again.',
                'error'
            );
        }
    }

    /**
     * Show error message to user
     */
    showErrorMessage(title, message, type = 'error') {
        // Check if there's an existing error display element
        let errorDisplay = document.getElementById('error-display');

        if (!errorDisplay) {
            // Create error display if it doesn't exist
            errorDisplay = document.createElement('div');
            errorDisplay.id = 'error-display';
            errorDisplay.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#ff4444' : type === 'warning' ? '#ff9900' : '#4444ff'};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                max-width: 300px;
                font-family: Arial, sans-serif;
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(errorDisplay);
        }

        errorDisplay.innerHTML = `
            <strong style="display: block; margin-bottom: 5px;">${title}</strong>
            <span style="font-size: 14px;">${message}</span>
        `;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorDisplay) {
                errorDisplay.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => errorDisplay.remove(), 300);
            }
        }, 5000);
    }

    /**
     * Activate demo mode as fallback
     */
    activateDemoMode() {
        console.log('🎮 Activating demo mode with local shapes...');

        // Set demo flag
        if (window.DailyGameCore) {
            window.DailyGameCore.disabled = true;
        }

        // Load demo shapes
        if (window.loadDemoShapes) {
            window.loadDemoShapes();
        }
    }

    /**
     * Reset error count
     */
    reset() {
        this.errorCount = 0;
    }
}

// Add CSS animations
if (typeof document !== 'undefined' && !document.getElementById('error-animations')) {
    const style = document.createElement('style');
    style.id = 'error-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Export for use
if (typeof window !== 'undefined') {
    window.GameModeIntegration = GameModeIntegration;
}