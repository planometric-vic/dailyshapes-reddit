/**
 * Temporary override to force using a known date that has shapes in Supabase
 * This helps test if the integration works when shapes are available
 */

(function() {
    'use strict';

    console.log('🔧 OVERRIDE: Forcing date to 250923 for testing...');

    // Wait for ShapeStorage to be available
    function waitForShapeStorage() {
        if (window.ShapeStorage) {
            applyOverride();
        } else {
            setTimeout(waitForShapeStorage, 100);
        }
    }

    function applyOverride() {
        // Store original method
        const originalGetMelbourneDate = window.ShapeStorage.prototype.getMelbourneDate;

        // Override to return September 23, 2025 (known to have shapes)
        window.ShapeStorage.prototype.getMelbourneDate = function() {
            console.log('🔧 OVERRIDE: Using test date September 23, 2025');
            return new Date(2025, 8, 23); // Month is 0-based
        };

        console.log('✅ OVERRIDE: Date override applied - all shape loading will use 250923');

        // Restore function to allow manual reset
        window.restoreDateFunction = function() {
            window.ShapeStorage.prototype.getMelbourneDate = originalGetMelbourneDate;
            console.log('✅ Date function restored to normal');
        };
    }

    // Start the override process
    waitForShapeStorage();

})();