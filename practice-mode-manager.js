/**
 * Practice Mode Manager for Daily Shapes v4.0
 * Handles on-demand loading, navigation, and Sunday shape handling
 */

class PracticeModeManager {
    constructor() {
        this.storage = new ShapeStorage();
        this.currentShape = null;
        this.currentShapeMetadata = null;
        this.isInitialized = false;
        this.currentShapeIndex = 0;

        // Generate dynamic practice shape list based on user's current local time
        this.knownShapes = this.generatePracticeShapesList();
    }

    /**
     * Generate practice shapes list based on current local date
     * Returns exactly 3 days: day before yesterday and 2 days prior
     */
    generatePracticeShapesList() {
        const today = new Date();
        const practiceShapes = [];

        // Generate 3 days of practice shapes starting from day before yesterday
        for (let daysBack = 2; daysBack <= 4; daysBack++) {
            const practiceDate = new Date(today);
            practiceDate.setDate(today.getDate() - daysBack);

            const dateStr = this.formatDateToYYMMDD(practiceDate);

            // Add all 3 shapes for this date
            practiceShapes.push(
                `${dateStr}-01`,
                `${dateStr}-02`,
                `${dateStr}-03`
            );
        }

        console.log(`📅 Generated practice shapes for current date ${this.formatDateToYYMMDD(today)}:`, practiceShapes);
        return practiceShapes;
    }

    /**
     * Format date to YYMMDD format
     */
    formatDateToYYMMDD(date) {
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Initialize Practice Mode
     */
    async initialize() {
        console.log('🎯 Initializing Simple Practice Mode Manager...');

        try {
            // Start with the first known shape (most recent -03)
            this.currentShapeIndex = 0;
            const success = await this.loadShapeByIndex(0);

            if (!success) {
                // Try a few more shapes before giving up
                for (let i = 1; i < Math.min(5, this.knownShapes.length); i++) {
                    const fallbackSuccess = await this.loadShapeByIndex(i);
                    if (fallbackSuccess) {
                        this.currentShapeIndex = i;
                        break;
                    }
                }
            }

            if (!this.currentShape) {
                throw new Error('No practice shapes available');
            }

            this.isInitialized = true;

            return {
                success: true,
                currentShape: this.currentShape
            };

        } catch (error) {
            console.error('Failed to initialize Practice Mode:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Load shape by index from known shapes list
     */
    async loadShapeByIndex(index) {
        if (index < 0 || index >= this.knownShapes.length) {
            console.error(`Invalid shape index: ${index}`);
            return false;
        }

        const shapeName = this.knownShapes[index];
        const dateStr = shapeName.substring(0, 6);
        const shapeNumber = parseInt(shapeName.substring(7, 9));

        console.log(`📥 Attempting to load practice shape: ${shapeName}`);

        try {
            // Parse date from shape name
            const year = parseInt('20' + dateStr.substring(0, 2));
            const month = parseInt(dateStr.substring(2, 4)) - 1; // Month is 0-indexed
            const day = parseInt(dateStr.substring(4, 6));
            const shapeDate = new Date(year, month, day);

            // Load the shape
            const shape = await this.storage.loadPracticeShape(shapeDate, shapeNumber);

            if (shape) {
                // Set current shape and metadata
                this.currentShape = shape;
                this.currentShapeMetadata = {
                    name: shapeName,
                    date: shapeDate,
                    dateStr: dateStr,
                    shapeNumber: shapeNumber,
                    isSunday: this.storage.isSunday(shapeDate)
                };

                // Add UI metadata
                this.currentShape.metadata = {
                    date: dateStr,
                    shapeNumber: shapeNumber,
                    isSunday: this.currentShapeMetadata.isSunday,
                    rotationDisabled: true // Always disabled in practice
                };

                console.log(`✅ Loaded practice shape: ${shapeName}`);
                return true;
            }

        } catch (error) {
            console.log(`❌ Failed to load shape: ${shapeName}`, error.message);
            return false;
        }

        return false;
    }


    /**
     * Navigate to previous shape (older) - circular carousel
     */
    async previousShape() {
        console.log('🔄 Loading previous (older) shape...');

        // Try next available older shape first
        for (let i = this.currentShapeIndex + 1; i < this.knownShapes.length; i++) {
            const success = await this.loadShapeByIndex(i);
            if (success) {
                this.currentShapeIndex = i;
                console.log(`✅ Loaded previous shape: ${this.knownShapes[i]}`);
                return this.currentShape;
            }
        }

        // Circular navigation: wrap around to beginning
        console.log('🔄 Reached end, wrapping around to beginning...');
        for (let i = 0; i <= this.currentShapeIndex; i++) {
            const success = await this.loadShapeByIndex(i);
            if (success) {
                this.currentShapeIndex = i;
                console.log(`✅ Loaded previous shape (wrapped): ${this.knownShapes[i]}`);
                return this.currentShape;
            }
        }

        console.log('❌ No shapes available');
        return null;
    }

    /**
     * Navigate to next shape (newer) - circular carousel
     */
    async nextShape() {
        console.log('🔄 Loading next (newer) shape...');

        // Try next available newer shape first
        for (let i = this.currentShapeIndex - 1; i >= 0; i--) {
            const success = await this.loadShapeByIndex(i);
            if (success) {
                this.currentShapeIndex = i;
                console.log(`✅ Loaded next shape: ${this.knownShapes[i]}`);
                return this.currentShape;
            }
        }

        // Circular navigation: wrap around to end
        console.log('🔄 Reached beginning, wrapping around to end...');
        for (let i = this.knownShapes.length - 1; i >= this.currentShapeIndex; i--) {
            const success = await this.loadShapeByIndex(i);
            if (success) {
                this.currentShapeIndex = i;
                console.log(`✅ Loaded next shape (wrapped): ${this.knownShapes[i]}`);
                return this.currentShape;
            }
        }

        console.log('❌ No shapes available');
        return null;
    }

    /**
     * Jump to specific date and shape (on-demand loading)
     */
    async jumpToShape(dateStr, shapeNumber) {
        console.log(`🔄 Loading specific shape on-demand: ${dateStr}-${String(shapeNumber).padStart(2, '0')}`);

        try {
            // Parse the date string back to a date object
            const year = parseInt('20' + dateStr.substring(0, 2));
            const month = parseInt(dateStr.substring(2, 4)) - 1; // Month is 0-indexed
            const day = parseInt(dateStr.substring(4, 6));
            const targetDate = new Date(year, month, day);

            const shape = await this.storage.loadPracticeShape(targetDate, shapeNumber);

            if (shape) {
                const metadata = {
                    name: `${dateStr}-${String(shapeNumber).padStart(2, '0')}`,
                    date: targetDate,
                    dateStr: dateStr,
                    shapeNumber: shapeNumber,
                    isSunday: this.storage.isSunday(targetDate)
                };

                this.currentShape = shape;
                this.currentShapeMetadata = metadata;

                // Add metadata for UI
                this.currentShape.metadata = {
                    date: metadata.dateStr,
                    shapeNumber: metadata.shapeNumber,
                    isSunday: metadata.isSunday,
                    rotationDisabled: true // Always disabled in practice
                };

                console.log(`✅ Loaded specific shape: ${metadata.name}`);
                return this.currentShape;
            } else {
                console.error(`Shape not available: ${dateStr}-${String(shapeNumber).padStart(2, '0')}`);
                return null;
            }
        } catch (error) {
            console.error(`Failed to load specific shape: ${dateStr}-${String(shapeNumber).padStart(2, '0')}`, error);
            return null;
        }
    }

    /**
     * Navigate to random shape
     */
    async randomShape() {
        console.log('🔄 Loading random shape...');

        // Pick a random shape from our known list, excluding current
        const availableIndices = [];
        for (let i = 0; i < this.knownShapes.length; i++) {
            if (i !== this.currentShapeIndex) {
                availableIndices.push(i);
            }
        }

        if (availableIndices.length === 0) {
            console.log('📌 No other shapes available for random selection');
            return null;
        }

        // Try random shapes until we find one that loads
        const shuffledIndices = [...availableIndices].sort(() => Math.random() - 0.5);

        for (const randomIndex of shuffledIndices) {
            const success = await this.loadShapeByIndex(randomIndex);
            if (success) {
                this.currentShapeIndex = randomIndex;
                console.log(`✅ Loaded random shape: ${this.knownShapes[randomIndex]}`);
                return this.currentShape;
            }
        }

        console.log('📌 No random shapes could be loaded');
        return null;
    }

    /**
     * Get navigation info
     */
    getNavigationInfo() {
        if (!this.isInitialized || !this.currentShapeMetadata) {
            return null;
        }

        return {
            currentDate: this.currentShapeMetadata.dateStr,
            currentShape: this.currentShapeMetadata.shapeNumber,
            currentShapeName: this.currentShapeMetadata.name,
            totalShapes: this.knownShapes.length,
            totalDates: 'mixed', // Multiple dates available
            hasPrevious: this.currentShapeIndex < this.knownShapes.length - 1,
            hasNext: this.currentShapeIndex > 0,
            shapeIndex: this.currentShapeIndex,
            isSunday: this.currentShapeMetadata.isSunday
        };
    }

    /**
     * Get list of available dates for UI
     */
    getAvailableDatesList() {
        if (!this.currentShapeMetadata) {
            return [];
        }

        // Return current shape info for UI
        return [{
            date: this.currentShapeMetadata.dateStr,
            isSunday: this.currentShapeMetadata.isSunday,
            isTwoDaysAgo: this.currentShapeIndex === 0, // First shape is most recent
            shapes: [{
                number: this.currentShapeMetadata.shapeNumber,
                id: this.currentShapeMetadata.name,
                available: true
            }]
        }];
    }

    /**
     * Get list of all available shapes
     */
    getAvailableShapesList() {
        if (!this.currentShapeMetadata) {
            return [];
        }

        // Return current shape info for compatibility
        return [{
            name: this.currentShapeMetadata.name,
            date: this.currentShapeMetadata.date,
            dateStr: this.currentShapeMetadata.dateStr,
            shapeNumber: this.currentShapeMetadata.shapeNumber,
            isSunday: this.currentShapeMetadata.isSunday,
            index: this.currentShapeIndex,
            isCurrent: true
        }];
    }

    /**
     * Get current shape
     */
    getCurrentShape() {
        return this.currentShape;
    }

    /**
     * Clean up
     */
    cleanup() {
        this.currentShape = null;
        this.isInitialized = false;
        console.log('🧹 Practice Mode Manager cleaned up');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PracticeModeManager = PracticeModeManager;
}