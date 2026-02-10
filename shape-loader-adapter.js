/**
 * Shape Loader Adapter
 * Bridges the new Supabase storage system with existing game code
 */

(function() {
    'use strict';

    // Store references to original functions
    const originalFunctions = {};

    /**
     * Initialize the adapter
     */
    function initializeAdapter() {
        console.log('🔌 Initializing Shape Loader Adapter...');

        // Wait for both game systems to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupAdapter);
        } else {
            setTimeout(setupAdapter, 100);
        }
    }

    /**
     * Setup the adapter overrides
     */
    async function setupAdapter() {
        // Store original functions if they exist
        if (window.loadSimplePracticeShape) {
            originalFunctions.loadSimplePracticeShape = window.loadSimplePracticeShape;
        }
        if (window.loadPracticeShape) {
            originalFunctions.loadPracticeShape = window.loadPracticeShape;
        }

        // Override practice shape loading functions
        window.loadSimplePracticeShape = async function(shapePath) {
            console.log('🔄 Adapter: Intercepting loadSimplePracticeShape:', shapePath);
            return loadShapeFromSupabase(shapePath, 'practice');
        };

        window.loadPracticeShape = async function(shapePath) {
            console.log('🔄 Adapter: Intercepting loadPracticeShape:', shapePath);
            return loadShapeFromSupabase(shapePath, 'practice');
        };

        // Override the daily shape loading if needed
        if (window.supabaseClient && window.supabaseClient.loadShape) {
            const originalLoadShape = window.supabaseClient.loadShape;
            window.supabaseClient.loadShape = async function(date, shapeIndex) {
                console.log('🔄 Adapter: Intercepting daily loadShape:', date, shapeIndex);
                return loadDailyShapeFromSupabase(date, shapeIndex);
            };
        }

        console.log('✅ Shape Loader Adapter ready');
    }

    /**
     * Convert legacy path to new format
     */
    function convertPathToNewFormat(shapePath) {
        // Handle various input formats
        // Example: "Shape2_20250731.json" -> "250731-02"
        // Example: "240731-02.geojson" -> "240731-02"

        if (!shapePath) return null;

        // Remove directory prefix if present
        shapePath = shapePath.replace(/^.*\//, '');

        // Check if already in new format (YYMMDD-NN)
        const newFormatMatch = shapePath.match(/^(\d{6})-(\d{2})/);
        if (newFormatMatch) {
            return {
                date: newFormatMatch[1],
                shapeNum: parseInt(newFormatMatch[2])
            };
        }

        // Convert from old format (Shape[N]_YYYYMMDD)
        const oldFormatMatch = shapePath.match(/Shape(\d+)_(\d{4})(\d{2})(\d{2})/);
        if (oldFormatMatch) {
            const shapeNum = parseInt(oldFormatMatch[1]);
            const year = oldFormatMatch[2].slice(-2); // Last 2 digits
            const month = oldFormatMatch[3];
            const day = oldFormatMatch[4];
            return {
                date: `${year}${month}${day}`,
                shapeNum: shapeNum
            };
        }

        console.warn('Unable to parse shape path:', shapePath);
        return null;
    }

    /**
     * Load shape from Supabase storage
     */
    async function loadShapeFromSupabase(shapePath, mode = 'practice') {
        try {
            // Convert path to new format
            const shapeInfo = convertPathToNewFormat(shapePath);
            if (!shapeInfo) {
                throw new Error(`Invalid shape path: ${shapePath}`);
            }

            // Get or create storage instance
            if (!window.shapeStorage) {
                if (window.ShapeStorage) {
                    window.shapeStorage = new ShapeStorage();
                } else {
                    throw new Error('ShapeStorage module not loaded');
                }
            }

            // Construct the filename
            const filename = `${shapeInfo.date}-${String(shapeInfo.shapeNum).padStart(2, '0')}.geojson`;
            console.log(`📥 Loading shape from Supabase: ${filename}`);

            // Load the shape
            const geoJSON = await window.shapeStorage.loadShape(filename);

            // For practice mode, remove rotation reference
            if (mode === 'practice' && geoJSON && geoJSON.properties && geoJSON.properties.rotationRef) {
                delete geoJSON.properties.rotationRef;
            }

            // Update global references that the game uses
            if (window.currentGeoJSON !== undefined) {
                window.currentGeoJSON = geoJSON;
            }

            // Parse and render the shape using existing game logic
            if (window.parseGeometry && window.renderShapesOnCanvas) {
                const parseResult = window.parseGeometry(geoJSON);
                window.renderShapesOnCanvas(parseResult.shapes, parseResult.bounds);

                // Store parsed shapes if practice mode uses them
                if (window.practiceMode && mode === 'practice') {
                    window.practiceMode.practiceParsedShapes = parseResult.shapes;
                }
            }

            console.log('✅ Shape loaded and rendered');
            return geoJSON;

        } catch (error) {
            console.error('Failed to load shape from Supabase:', error);

            // Try fallback to local file if available
            if (originalFunctions.loadSimplePracticeShape && mode === 'practice') {
                console.log('⚠️ Falling back to local shape loading');
                return originalFunctions.loadSimplePracticeShape(shapePath);
            }

            throw error;
        }
    }

    /**
     * Load daily shape from Supabase
     */
    async function loadDailyShapeFromSupabase(date, shapeIndex) {
        try {
            // Ensure we have the daily mode manager
            if (!window.dailyModeManager) {
                if (window.DailyModeManager) {
                    window.dailyModeManager = new DailyModeManager();
                    await window.dailyModeManager.initialize();
                }
            }

            // Get the shape from daily mode manager
            if (window.dailyModeManager) {
                const shape = window.dailyModeManager.getShape(shapeIndex - 1); // Convert to 0-based index

                if (shape) {
                    // Update global references
                    if (window.currentGeoJSON !== undefined) {
                        window.currentGeoJSON = shape;
                    }

                    return shape;
                }
            }

            // Fallback to direct loading
            if (!window.shapeStorage) {
                window.shapeStorage = new ShapeStorage();
            }

            // Parse the date to get Melbourne date
            const melbourneDate = new Date(date + 'T00:00:00');
            const dateStr = window.shapeStorage.formatDateToYYMMDD(melbourneDate);
            const filename = `${dateStr}-${String(shapeIndex).padStart(2, '0')}.geojson`;

            return await window.shapeStorage.loadShape(filename);

        } catch (error) {
            console.error('Failed to load daily shape:', error);
            throw error;
        }
    }

    /**
     * Map practice shape list to new format
     */
    function updatePracticeShapeList() {
        // If there's a global practice shapes list, update it
        if (window.practiceShapes && Array.isArray(window.practiceShapes)) {
            console.log('📝 Updating practice shape list...');

            // Generate shape list for last 30 days
            if (window.ShapeStorage) {
                const storage = new ShapeStorage();
                const dates = storage.getAvailablePracticeDates(30);

                // Create flat list of all shapes
                const newShapeList = [];
                dates.forEach(dateInfo => {
                    for (let i = 1; i <= 3; i++) {
                        newShapeList.push(`${dateInfo.dateStr}-${String(i).padStart(2, '0')}.geojson`);
                    }
                });

                // Update the global list
                window.practiceShapes = newShapeList;
                console.log(`✅ Updated practice shapes list with ${newShapeList.length} shapes`);
            }
        }
    }

    /**
     * Public API for testing
     */
    window.ShapeLoaderAdapter = {
        convertPath: convertPathToNewFormat,
        loadShape: loadShapeFromSupabase,
        updateShapeList: updatePracticeShapeList,
        isReady: () => !!window.shapeStorage
    };

    // Initialize the adapter
    initializeAdapter();

    // Listen for game ready event
    window.addEventListener('dailyShapesReady', () => {
        console.log('🎮 Game ready - updating shape lists');
        updatePracticeShapeList();
    });

})();