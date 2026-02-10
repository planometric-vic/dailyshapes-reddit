
// Clear shape cache and force reload of today's shapes
if (window.dailyModeManager && window.dailyModeManager.storage) {
    console.log('🧹 Clearing shape cache...');
    window.dailyModeManager.storage.clearCache();
    
    // Force reload of today's shapes
    console.log('🔄 Reloading today\'s shapes...');
    window.dailyModeManager.storage.preloadDailyShapes(window.dailyModeManager.currentDate)
        .then(result => {
            console.log('✅ Fresh shapes reloaded:', result);
            if (window.DailyGameCore) {
                console.log('🎮 Consider reloading the page to use the fresh shapes');
            }
        })
        .catch(error => {
            console.error('❌ Error reloading shapes:', error);
        });
} else {
    console.log('⚠️ Shape storage not available yet - wait for page to fully load');
}

