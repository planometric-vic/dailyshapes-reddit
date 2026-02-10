/**
 * Migration Integration Script for Daily Shapes v4.0
 * Integrates the new Supabase bucket migration features with existing system
 */

console.log('🔄 Loading Daily Shapes v4.0 Migration Integration...');

// Integration object to manage migration features
const MigrationIntegration = {

    // Override practice button handlers to use new Practice Mode v4.0
    initializePracticeMode: function() {
        // Replace old practice mode with new v4.0
        window.openPractice = function() {
            if (window.PracticeModeV4) {
                console.log('🎯 Opening Practice Mode v4.0 with Supabase integration');
                window.PracticeModeV4.open();
            } else {
                console.error('❌ Practice Mode v4.0 not available, falling back to original');
                if (window.PracticeMode) {
                    window.PracticeMode.open();
                } else {
                    alert('Practice mode is not available');
                }
            }
        };

        window.openPracticeMode = function() {
            window.openPractice();
        };

        // Also override the direct PracticeMode.open if it exists
        if (window.PracticeMode && window.PracticeMode.open) {
            window.PracticeMode.originalOpen = window.PracticeMode.open;
            window.PracticeMode.open = function() {
                console.log('🎯 Redirecting PracticeMode.open to v4.0');
                if (window.PracticeModeV4) {
                    window.PracticeModeV4.open();
                } else {
                    window.PracticeMode.originalOpen();
                }
            };
        }

        console.log('✅ Practice Mode integration configured for v4.0');
    },

    // Initialize Daily Game Core for new bucket structure
    initializeDailyGameCore: function() {
        // Ensure daily game core is using new naming convention
        if (window.DailyGameCore && !window.DailyGameCore.disabled) {
            console.log('🎮 Daily Game Core migration features enabled');

            // Log current configuration
            const progress = window.DailyGameCore.getGameProgress();
            console.log('📊 Daily Game Status:', {
                currentDate: progress.currentDate,
                currentMechanic: progress.currentMechanic,
                shapesLoaded: Object.keys(window.DailyGameCore.shapes).filter(key => window.DailyGameCore.shapes[key] !== null).length
            });
        } else {
            console.log('ℹ️ Daily Game Core disabled or not available');
        }
    },

    // Test connection to Supabase bucket with new naming convention
    testSupabaseConnection: async function() {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            console.log('ℹ️ Supabase not configured - migration will use local fallbacks');
            return false;
        }

        try {
            // Test accessing the 'Daily Shapes' bucket
            const { data: buckets, error: bucketsError } = await supabaseClient.storage.listBuckets();

            if (bucketsError) {
                console.error('❌ Error accessing Supabase buckets:', bucketsError);
                return false;
            }

            const dailyShapesBucket = buckets.find(bucket => bucket.name === 'Daily Shapes');
            if (!dailyShapesBucket) {
                console.warn('⚠️ "Daily Shapes" bucket not found. Available buckets:', buckets.map(b => b.name));
                return false;
            }

            console.log('✅ Supabase "Daily Shapes" bucket accessible');

            // Test listing files in bucket
            const { data: files, error: filesError } = await supabaseClient.storage
                .from('Daily Shapes')
                .list('', { limit: 5 });

            if (filesError) {
                console.error('❌ Error listing files in Daily Shapes bucket:', filesError);
                return false;
            }

            console.log(`📁 Daily Shapes bucket contains ${files.length} files (showing first 5)`);
            files.forEach(file => {
                console.log(`  - ${file.name} (${(file.metadata?.size / 1024).toFixed(2)}KB)`);
            });

            return true;
        } catch (error) {
            console.error('❌ Supabase connection test failed:', error);
            return false;
        }
    },

    // Validate date utilities are working correctly
    testDateUtilities: function() {
        if (!window.DateUtils) {
            console.error('❌ DateUtils not available');
            return false;
        }

        const today = new Date();
        const todayYYMMDD = window.DateUtils.getTodayYYMMDD();
        const yesterdayYYMMDD = window.DateUtils.getYesterdayYYMMDD();

        console.log('📅 Date Utilities Test:', {
            today: today.toISOString().split('T')[0],
            todayYYMMDD: todayYYMMDD,
            yesterdayYYMMDD: yesterdayYYMMDD,
            shapeFilename: window.DateUtils.getShapeFilename(today, 1)
        });

        // Test parsing back
        const parsedToday = window.DateUtils.parseFromYYMMDD(todayYYMMDD);
        const isDateValid = parsedToday.toDateString() === today.toDateString();

        console.log(isDateValid ? '✅ Date utilities working correctly' : '❌ Date parsing failed');
        return isDateValid;
    },

    // Initialize all migration features
    initialize: async function() {
        console.log('🚀 Initializing Daily Shapes v4.0 Migration...');

        // 1. Test date utilities
        this.testDateUtilities();

        // 2. Test Supabase connection
        const supabaseReady = await this.testSupabaseConnection();

        // 3. Initialize practice mode
        this.initializePracticeMode();

        // 4. Initialize daily game core
        this.initializeDailyGameCore();

        // 5. Log migration status
        console.log('📊 Migration Status Summary:', {
            dateUtils: !!window.DateUtils,
            supabaseReady: supabaseReady,
            practiceV4: !!window.PracticeModeV4,
            dailyGameCore: !!window.DailyGameCore && !window.DailyGameCore.disabled,
            originalPracticeMode: !!window.PracticeMode
        });

        console.log('✅ Daily Shapes v4.0 Migration Integration Complete');

        return {
            success: true,
            features: {
                supabaseBuckets: supabaseReady,
                practiceV4: !!window.PracticeModeV4,
                dateUtils: !!window.DateUtils,
                dailyGameCore: !!window.DailyGameCore
            }
        };
    },

    // Get migration status for debugging
    getStatus: function() {
        return {
            timestamp: new Date().toISOString(),
            components: {
                dateUtils: {
                    available: !!window.DateUtils,
                    todayYYMMDD: window.DateUtils?.getTodayYYMMDD(),
                    yesterdayYYMMDD: window.DateUtils?.getYesterdayYYMMDD()
                },
                supabase: {
                    configured: !!window.SupabaseConfig,
                    ready: window.SupabaseConfig?.isReady()
                },
                practiceMode: {
                    v4Available: !!window.PracticeModeV4,
                    v4Active: window.PracticeModeV4?.isActive,
                    originalAvailable: !!window.PracticeMode,
                    isPracticeMode: window.isPracticeMode
                },
                dailyGameCore: {
                    available: !!window.DailyGameCore,
                    disabled: window.DailyGameCore?.disabled,
                    currentDate: window.DailyGameCore?.currentDate,
                    currentMechanic: window.DailyGameCore?.currentMechanic
                }
            }
        };
    }
};

// Export to window for global access
window.MigrationIntegration = MigrationIntegration;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        // Wait a bit for other scripts to load
        setTimeout(async () => {
            await MigrationIntegration.initialize();
        }, 1000);
    });
} else {
    // DOM already loaded, initialize after a short delay
    setTimeout(async () => {
        await MigrationIntegration.initialize();
    }, 1000);
}

console.log('📦 Daily Shapes v4.0 Migration Integration script loaded');