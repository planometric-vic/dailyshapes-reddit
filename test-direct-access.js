/**
 * Test Direct File Access - Verify the RLS workaround works
 */

async function testDirectFileAccess() {
    console.log('🧪 Testing Direct File Access Workaround...');

    if (!window.supabaseClient) {
        console.error('❌ supabaseClient not found');
        return;
    }

    if (!window.DateUtils) {
        console.error('❌ DateUtils not found');
        return;
    }

    // Generate test filenames for recent dates
    const testResults = {
        success: [],
        failed: [],
        dates: []
    };

    console.log('📅 Generating test filenames for recent dates...');

    const today = new Date();
    for (let i = 0; i < 7; i++) { // Test last 7 days
        const testDate = new Date(today);
        testDate.setDate(testDate.getDate() - i);

        const year = testDate.getFullYear().toString().slice(-2);
        const month = String(testDate.getMonth() + 1).padStart(2, '0');
        const day = String(testDate.getDate()).padStart(2, '0');
        const yymmdd = `${year}${month}${day}`;

        testResults.dates.push({
            date: testDate.toLocaleDateString(),
            yymmdd: yymmdd,
            files: [`${yymmdd}-01.geojson`, `${yymmdd}-02.geojson`, `${yymmdd}-03.geojson`]
        });
    }

    console.log('🔍 Testing direct file downloads...');

    // Test direct access for each potential file
    for (const dateInfo of testResults.dates) {
        console.log(`\n📅 Testing ${dateInfo.date} (${dateInfo.yymmdd}):`);

        for (const filename of dateInfo.files) {
            try {
                const { data, error } = await supabaseClient.storage
                    .from('Daily Shapes')
                    .download(filename);

                if (error) {
                    console.log(`  ❌ ${filename}: ${error.message}`);
                    testResults.failed.push({ filename, error: error.message });
                } else {
                    console.log(`  ✅ ${filename}: ${data.size} bytes`);

                    // Verify it's valid geojson
                    try {
                        const text = await data.text();
                        const geojson = JSON.parse(text);

                        if (geojson.type === 'FeatureCollection' && geojson.features) {
                            console.log(`    📊 Valid GeoJSON with ${geojson.features.length} features`);

                            // Check for Sunday rotation mechanics
                            const rotationFeature = geojson.features.find(
                                f => f.properties && f.properties.type === 'reference' &&
                                f.properties.corner === 'rotation-center'
                            );

                            if (rotationFeature) {
                                console.log(`    🔄 Sunday rotation center found: ${rotationFeature.geometry.coordinates}`);
                            }

                            testResults.success.push({
                                filename,
                                size: data.size,
                                features: geojson.features.length,
                                hasRotation: !!rotationFeature
                            });
                        } else {
                            console.log(`    ⚠️ Invalid GeoJSON structure`);
                            testResults.failed.push({ filename, error: 'Invalid GeoJSON structure' });
                        }
                    } catch (parseError) {
                        console.log(`    ❌ Parse error: ${parseError.message}`);
                        testResults.failed.push({ filename, error: `Parse error: ${parseError.message}` });
                    }
                }
            } catch (exception) {
                console.log(`  ❌ ${filename}: Exception - ${exception.message}`);
                testResults.failed.push({ filename, error: `Exception: ${exception.message}` });
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Test summary
    console.log('\n📊 Direct Access Test Results:');
    console.log(`✅ Successful downloads: ${testResults.success.length}`);
    console.log(`❌ Failed downloads: ${testResults.failed.length}`);

    if (testResults.success.length > 0) {
        console.log('\n🎯 SUCCESS: Direct file access works! RLS workaround confirmed.');
        console.log('📋 Working files:');
        testResults.success.forEach(file => {
            console.log(`  - ${file.filename} (${file.features} features${file.hasRotation ? ', with rotation' : ''})`);
        });
    } else {
        console.log('\n⚠️ No files found via direct access.');
        console.log('This could mean:');
        console.log('1. Files don\'t exist for recent dates');
        console.log('2. Different naming convention used');
        console.log('3. Additional authentication required');
    }

    if (testResults.failed.length > 0) {
        console.log('\n❌ Failed downloads (expected for non-existent dates):');
        testResults.failed.slice(0, 5).forEach(file => {
            console.log(`  - ${file.filename}: ${file.error}`);
        });
        if (testResults.failed.length > 5) {
            console.log(`  ... and ${testResults.failed.length - 5} more`);
        }
    }

    return testResults;
}

// Test the Daily Game Core direct access
async function testDailyGameCoreAccess() {
    console.log('\n🎮 Testing Daily Game Core Access Pattern...');

    if (!window.DailyGameCore) {
        console.log('❌ DailyGameCore not found');
        return;
    }

    // Try to trigger today's shape preloading
    try {
        console.log('🔄 Testing formatDateToYYMMDD...');
        const todayStr = window.DailyGameCore.formatDateToYYMMDD(new Date());
        console.log(`📅 Today's YYMMDD format: ${todayStr}`);

        const expectedFiles = [
            `${todayStr}-01.geojson`,
            `${todayStr}-02.geojson`,
            `${todayStr}-03.geojson`
        ];

        console.log('🔍 Expected today\'s files:', expectedFiles);

        // Test direct access to today's expected files
        for (const filename of expectedFiles) {
            try {
                const { data, error } = await supabaseClient.storage
                    .from('Daily Shapes')
                    .download(filename);

                if (error) {
                    console.log(`❌ ${filename}: ${error.message}`);
                } else {
                    console.log(`✅ ${filename}: Available! (${data.size} bytes)`);
                }
            } catch (e) {
                console.log(`❌ ${filename}: Exception - ${e.message}`);
            }
        }

    } catch (error) {
        console.log('❌ Daily Game Core test failed:', error.message);
    }
}

// Export for manual running
if (typeof window !== 'undefined') {
    window.testDirectFileAccess = testDirectFileAccess;
    window.testDailyGameCoreAccess = testDailyGameCoreAccess;
    console.log('✅ Direct access test functions loaded:');
    console.log('  - testDirectFileAccess()');
    console.log('  - testDailyGameCoreAccess()');
}