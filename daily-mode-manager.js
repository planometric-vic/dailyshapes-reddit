/**
 * Daily Mode Manager for Daily Shapes v4.0
 * Manages daily shape loading, midnight reset, and Sunday rotation
 */

class DailyModeManager {
    constructor() {
        this.storage = new ShapeStorage();
        this.shapes = [];
        this.currentShapeIndex = 0;
        this.currentDate = null;
        this.midnightTimer = null;
        this.isSundayRotation = false;
        this.isInitialized = false;
    }

    /**
     * Initialize Daily Mode
     */
    async initialize() {
        console.log('🎮 Initializing Daily Mode Manager...');

        try {
            // Get current Melbourne date
            this.currentDate = this.storage.getMelbourneDate();
            const dateStr = this.storage.formatDateToYYMMDD(this.currentDate);
            console.log(`📅 Daily Mode date: ${dateStr} (Melbourne time)`);

            // Check if it's Sunday
            this.isSundayRotation = this.storage.isSunday(this.currentDate);
            if (this.isSundayRotation) {
                console.log('🔄 Sunday detected - rotation mode enabled');
            }

            // Preload all 3 shapes for today
            const result = await this.storage.preloadDailyShapes(this.currentDate);

            if (result.errors.length > 0) {
                console.warn('⚠️ Some shapes failed to load:', result.errors);

                // Handle missing shapes gracefully
                result.shapes.forEach((shape, index) => {
                    if (!shape) {
                        console.error(`❌ Shape ${index + 1} is missing`);
                        // Could load a default shape here if needed
                    }
                });
            }

            this.shapes = result.shapes;
            console.log(`✅ Daily Mode initialized with ${this.shapes.filter(s => s).length}/3 shapes`);

            // Set up midnight reset
            this.setupMidnightReset();

            // Mark as initialized
            this.isInitialized = true;

            return {
                success: true,
                shapesLoaded: this.shapes.filter(s => s).length,
                date: dateStr,
                isSunday: this.isSundayRotation
            };

        } catch (error) {
            console.error('Failed to initialize Daily Mode:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Set up midnight reset timer
     */
    setupMidnightReset() {
        // Clear existing timer
        if (this.midnightTimer) {
            clearTimeout(this.midnightTimer);
        }

        // Calculate time until midnight Melbourne time
        const now = new Date();
        const melbourneNow = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Melbourne"}));

        const midnight = new Date(melbourneNow);
        midnight.setHours(24, 0, 0, 0);

        const msUntilMidnight = midnight - melbourneNow;

        console.log(`⏰ Midnight reset scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

        // Set timer for midnight
        this.midnightTimer = setTimeout(() => {
            console.log('🌙 Midnight reached - resetting Daily Mode');
            this.handleMidnightReset();
        }, msUntilMidnight);
    }

    /**
     * Handle midnight reset
     */
    async handleMidnightReset() {
        console.log('🔄 Processing midnight reset...');

        try {
            // Clear current shapes
            this.shapes = [];
            this.currentShapeIndex = 0;

            // Reinitialize with new date
            await this.initialize();

            // Notify UI of reset
            this.notifyReset();

            console.log('✅ Midnight reset complete');
        } catch (error) {
            console.error('Failed to reset at midnight:', error);
            // Retry in 1 minute
            setTimeout(() => this.handleMidnightReset(), 60000);
        }
    }

    /**
     * Get current shape
     */
    getCurrentShape() {
        if (!this.isInitialized || this.shapes.length === 0) {
            return null;
        }

        const shape = this.shapes[this.currentShapeIndex];

        // Apply rotation flag if Sunday
        if (shape && this.isSundayRotation) {
            shape.rotationEnabled = true;
        }

        return shape;
    }

    /**
     * Get shape by index (0-based)
     */
    getShape(index) {
        if (!this.isInitialized || index < 0 || index >= this.shapes.length) {
            return null;
        }

        const shape = this.shapes[index];

        // Apply rotation flag if Sunday
        if (shape && this.isSundayRotation) {
            shape.rotationEnabled = true;
        }

        return shape;
    }

    /**
     * Move to next shape
     */
    nextShape() {
        if (this.currentShapeIndex < this.shapes.length - 1) {
            this.currentShapeIndex++;
            console.log(`➡️ Advanced to shape ${this.currentShapeIndex + 1}`);
            return this.getCurrentShape();
        }
        return null;
    }

    /**
     * Check if all shapes are completed
     */
    isComplete() {
        return this.currentShapeIndex >= this.shapes.length - 1;
    }

    /**
     * Get progress info
     */
    getProgress() {
        return {
            current: this.currentShapeIndex + 1,
            total: this.shapes.length,
            percentage: Math.round(((this.currentShapeIndex + 1) / this.shapes.length) * 100),
            date: this.storage.formatDateToYYMMDD(this.currentDate),
            isSunday: this.isSundayRotation
        };
    }

    /**
     * Notify UI of reset (can be overridden)
     */
    notifyReset() {
        // Dispatch custom event
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('dailyModeReset', {
                detail: {
                    date: this.storage.formatDateToYYMMDD(this.currentDate),
                    isSunday: this.isSundayRotation
                }
            }));
        }

        // Reload page as fallback
        if (window.location && window.location.reload) {
            console.log('🔄 Reloading page for new day...');
            setTimeout(() => window.location.reload(), 1000);
        }
    }

    /**
     * Clean up (call when leaving daily mode)
     */
    cleanup() {
        if (this.midnightTimer) {
            clearTimeout(this.midnightTimer);
            this.midnightTimer = null;
        }
        this.isInitialized = false;
        console.log('🧹 Daily Mode Manager cleaned up');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.DailyModeManager = DailyModeManager;
}