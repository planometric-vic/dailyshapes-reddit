/**
 * Verification Script for Daily Shapes v4.0 Supabase Integration
 * Run this in browser console to verify all systems are configured correctly
 */

async function verifySupabaseIntegration() {
    console.log('🔍 Verifying Daily Shapes v4.0 Supabase Integration...\n');

    const results = {
        supabase: false,
        dailyGameCore: false,
        practiceV4: false,
        dailyMode: false,
        demoMode: false,
        shapesAvailable: false,
        todaysShapes: [],
        practiceShapes: []
    };

    // 1. Check Supabase Connection
    console.log('1️⃣ Checking Supabase Connection...');
    if (window.supabaseClient) {
        console.log('✅ Supabase client exists');

        try {
            // Test direct file access for today
            const today = new Date();
            const year = today.getFullYear().toString().slice(-2);
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const testFile = `${year}${month}${day}-01.geojson`;

            const { data, error } = await supabaseClient.storage
                .from('Daily Shapes')
                .download(testFile);

            if (!error && data) {
                console.log(`✅ Can access today's shape: ${testFile} (${data.size} bytes)`);
                results.supabase = true;
                results.todaysShapes.push(testFile);
            } else {
                console.log(`❌ Cannot access today's shape: ${error?.message || 'Unknown error'}`);
            }
        } catch (e) {
            console.log('❌ Supabase test failed:', e.message);
        }
    } else {
        console.log('❌ Supabase client not found');
    }

    // 2. Check Daily Game Core
    console.log('\n2️⃣ Checking Daily Game Core...');
    if (window.DailyGameCore) {
        console.log('✅ Daily Game Core exists');
        console.log(`   Disabled: ${window.DailyGameCore.disabled === true}`);
        console.log(`   Initialized: ${window.DailyGameCore.initialized === true}`);

        if (!window.DailyGameCore.disabled) {
            results.dailyGameCore = true;

            // Check if it can load shapes
            try {
                if (!window.DailyGameCore.initialized) {
                    console.log('   Initializing Daily Game Core...');
                    await window.DailyGameCore.initialize();
                }

                const shapeData = window.DailyGameCore.getShapeData(1);
                if (shapeData) {
                    console.log('✅ Daily Game Core can load shapes');
                    results.shapesAvailable = true;
                } else {
                    console.log('⚠️ Daily Game Core has no shape data');
                }
            } catch (e) {
                console.log('❌ Daily Game Core error:', e.message);
            }
        } else {
            console.log('❌ Daily Game Core is disabled');
        }
    } else {
        console.log('❌ Daily Game Core not found');
    }

    // 3. Check Practice Mode v4
    console.log('\n3️⃣ Checking Practice Mode v4...');
    if (window.PracticeModeV4) {
        console.log('✅ Practice Mode v4 exists');
        results.practiceV4 = true;

        // Check if it can access yesterday's shapes
        if (window.DateUtils) {
            const yesterday = window.DateUtils.getYesterdayYYMMDD();
            console.log(`   Yesterday's date: ${yesterday}`);

            try {
                const testFile = `${yesterday}-03.geojson`;
                const { data, error } = await supabaseClient.storage
                    .from('Daily Shapes')
                    .download(testFile);

                if (!error && data) {
                    console.log(`✅ Can access yesterday's shape: ${testFile}`);
                    results.practiceShapes.push(testFile);
                } else {
                    console.log(`⚠️ Cannot access yesterday's shape: ${error?.message || 'Unknown'}`);
                }
            } catch (e) {
                console.log('⚠️ Practice shape test failed:', e.message);
            }
        }
    } else {
        console.log('❌ Practice Mode v4 not found');
    }

    // 4. Check Game Modes
    console.log('\n4️⃣ Checking Game Mode Configuration...');
    console.log(`   isDailyMode: ${window.isDailyMode}`);
    console.log(`   isDemoMode: ${window.isDemoMode}`);
    console.log(`   isPracticeMode: ${window.isPracticeMode}`);

    results.dailyMode = window.isDailyMode === true;
    results.demoMode = window.isDemoMode;

    if (!results.demoMode && results.dailyMode) {
        console.log('✅ Configured for Daily Mode (Supabase shapes)');
    } else if (results.demoMode) {
        console.log('⚠️ Still in Demo Mode (local shapes)');
    }

    // 5. Check Migration Integration
    console.log('\n5️⃣ Checking Migration Integration...');
    if (window.MigrationIntegration) {
        const status = window.MigrationIntegration.getStatus();
        console.log('✅ Migration Integration active:', status);
    } else {
        console.log('❌ Migration Integration not found');
    }

    // Summary
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log('========================');

    const checks = [
        { name: 'Supabase Connection', status: results.supabase },
        { name: 'Daily Game Core', status: results.dailyGameCore },
        { name: 'Practice Mode v4', status: results.practiceV4 },
        { name: 'Daily Mode Active', status: results.dailyMode && !results.demoMode },
        { name: 'Shapes Available', status: results.shapesAvailable }
    ];

    checks.forEach(check => {
        console.log(`${check.status ? '✅' : '❌'} ${check.name}`);
    });

    const passedChecks = checks.filter(c => c.status).length;
    const totalChecks = checks.length;

    console.log(`\nResult: ${passedChecks}/${totalChecks} checks passed`);

    if (passedChecks === totalChecks) {
        console.log('🎉 All systems operational! Daily Shapes v4.0 is ready.');
    } else if (passedChecks >= 3) {
        console.log('⚠️ Partial integration - some features may not work correctly.');
    } else {
        console.log('❌ Integration incomplete - please check configuration.');
    }

    // Action items
    if (!results.dailyMode || results.demoMode) {
        console.log('\n⚠️ ACTION REQUIRED:');
        console.log('   - Set isDemoMode = false in main.js');
        console.log('   - Set isDailyMode = true in main.js');
        console.log('   - Ensure Daily Game Core is not disabled');
    }

    return results;
}

// Auto-export
if (typeof window !== 'undefined') {
    window.verifySupabaseIntegration = verifySupabaseIntegration;
    console.log('✅ Verification script loaded. Run: verifySupabaseIntegration()');
}