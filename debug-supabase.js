/**
 * Debug Script for Supabase Connection Issues
 * Helps diagnose why the "Daily Shapes" bucket isn't being found
 */

console.log('🔍 Loading Supabase Debug Script...');

const SupabaseDebug = {

    // Test basic Supabase connection
    testConnection: async function() {
        console.log('🔍 Testing Supabase connection...');

        if (!window.SupabaseConfig) {
            console.error('❌ SupabaseConfig not found');
            return false;
        }

        if (!window.SupabaseConfig.isReady()) {
            console.error('❌ SupabaseConfig not ready');
            return false;
        }

        if (!window.supabaseClient) {
            console.error('❌ supabaseClient not found');
            return false;
        }

        console.log('✅ Supabase client exists');
        return true;
    },

    // List all available buckets with detailed info
    listAllBuckets: async function() {
        console.log('🗂️ Listing all Supabase buckets...');

        try {
            const { data: buckets, error } = await supabaseClient.storage.listBuckets();

            if (error) {
                console.error('❌ Error listing buckets:', error);
                return { success: false, error };
            }

            console.log('📂 Available buckets:', buckets.length);
            buckets.forEach((bucket, index) => {
                console.log(`  ${index + 1}. "${bucket.name}" (ID: ${bucket.id})`);
                console.log(`     Public: ${bucket.public}, Created: ${bucket.created_at}`);
            });

            return { success: true, buckets };

        } catch (error) {
            console.error('❌ Exception listing buckets:', error);
            return { success: false, error };
        }
    },

    // Test different authentication approaches
    testAuthMethods: async function() {
        console.log('🔐 Testing different authentication methods...');

        // Test 1: Current session
        try {
            const { data: session, error: sessionError } = await supabaseClient.auth.getSession();
            console.log('📋 Current session:', session ? 'Active' : 'None', sessionError ? sessionError.message : '');
        } catch (e) {
            console.error('❌ Session check failed:', e.message);
        }

        // Test 2: Anonymous access attempt
        try {
            console.log('🔓 Testing anonymous access to bucket...');
            const { data: anonFiles, error: anonError } = await supabaseClient.storage
                .from('Daily Shapes')
                .list('', { limit: 5 });

            if (anonError) {
                console.log('❌ Anonymous access failed:', anonError.message);
            } else {
                console.log('✅ Anonymous access works:', anonFiles.length, 'files');
            }
        } catch (e) {
            console.log('❌ Anonymous access exception:', e.message);
        }

        // Test 3: Try with different list options
        try {
            console.log('🔍 Testing with different list options...');

            // Test with no limit
            const { data: allFiles, error: allError } = await supabaseClient.storage
                .from('Daily Shapes')
                .list('');

            if (allError) {
                console.log('❌ List all failed:', allError.message);
            } else {
                console.log('📁 List all result:', allFiles.length, 'files');
            }

            // Test with higher limit
            const { data: moreFiles, error: moreError } = await supabaseClient.storage
                .from('Daily Shapes')
                .list('', { limit: 100 });

            if (moreError) {
                console.log('❌ List 100 failed:', moreError.message);
            } else {
                console.log('📁 List 100 result:', moreFiles.length, 'files');
            }

            // Test with sortBy
            const { data: sortedFiles, error: sortError } = await supabaseClient.storage
                .from('Daily Shapes')
                .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });

            if (sortError) {
                console.log('❌ List sorted failed:', sortError.message);
            } else {
                console.log('📁 List sorted result:', sortedFiles.length, 'files');
            }

        } catch (e) {
            console.log('❌ List options test exception:', e.message);
        }
    },

    // Test direct file access with expected YYMMDD naming
    testDirectFileAccess: async function() {
        console.log('📁 Testing direct file access with YYMMDD naming...');

        // Generate expected filenames for recent dates
        const today = new Date();
        const testFiles = [];

        // Generate test filenames for last 7 days
        for (let i = 0; i < 7; i++) {
            const testDate = new Date(today);
            testDate.setDate(testDate.getDate() - i);

            const year = testDate.getFullYear().toString().slice(-2);
            const month = String(testDate.getMonth() + 1).padStart(2, '0');
            const day = String(testDate.getDate()).padStart(2, '0');
            const yymmdd = `${year}${month}${day}`;

            testFiles.push(`${yymmdd}-01.geojson`);
            testFiles.push(`${yymmdd}-02.geojson`);
            testFiles.push(`${yymmdd}-03.geojson`);
        }

        console.log('🔍 Testing these expected filenames:', testFiles.slice(0, 5), '...');

        for (const filename of testFiles.slice(0, 10)) { // Test first 10 only
            try {
                const { data, error } = await supabaseClient.storage
                    .from('Daily Shapes')
                    .download(filename);

                if (error) {
                    console.log(`❌ ${filename}: ${error.message}`);
                } else {
                    console.log(`✅ ${filename}: Found! (${data.size} bytes)`);
                    return { found: true, filename, size: data.size };
                }
            } catch (e) {
                console.log(`❌ ${filename}: Exception - ${e.message}`);
            }
        }

        console.log('🔍 No expected files found with direct access');
        return { found: false };
    },

    // Test RLS policies by checking error messages
    testRLSPolicies: async function() {
        console.log('🛡️ Testing for RLS (Row Level Security) policies...');

        try {
            // Try to access the bucket with verbose error reporting
            const { data: files, error } = await supabaseClient.storage
                .from('Daily Shapes')
                .list('', { limit: 1 });

            if (error) {
                console.log('🛡️ RLS/Policy error details:', error);

                // Check for common RLS error patterns
                if (error.message.includes('policy')) {
                    console.log('⚠️ RLS policy may be blocking access');
                }
                if (error.message.includes('insufficient privileges')) {
                    console.log('⚠️ Insufficient privileges - need authentication');
                }
                if (error.message.includes('not allowed')) {
                    console.log('⚠️ Access not allowed - check bucket permissions');
                }
            } else {
                console.log('✅ No RLS policy issues detected');
                return files;
            }
        } catch (e) {
            console.log('🛡️ RLS test exception:', e.message);
        }
    },

    // Try different variations of bucket names
    testBucketNames: async function() {
        console.log('🔍 Testing different bucket name variations...');

        const variations = [
            'Daily Shapes',
            'daily-shapes',
            'daily_shapes',
            'DailyShapes',
            'DAILY_SHAPES',
            'dailyshapes'
        ];

        for (const bucketName of variations) {
            try {
                const { data: files, error } = await supabaseClient.storage
                    .from(bucketName)
                    .list('', { limit: 1 });

                if (!error) {
                    console.log(`✅ Found bucket: "${bucketName}" with ${files.length} files`);
                } else {
                    console.log(`❌ Bucket "${bucketName}": ${error.message}`);
                }
            } catch (e) {
                console.log(`❌ Bucket "${bucketName}": ${e.message}`);
            }
        }
    },

    // Test specific file access
    testFileAccess: async function(bucketName = 'Daily Shapes') {
        console.log(`📁 Testing file access in "${bucketName}" bucket...`);

        try {
            // List files in bucket
            const { data: files, error: listError } = await supabaseClient.storage
                .from(bucketName)
                .list('', { limit: 10 });

            if (listError) {
                console.error(`❌ Error listing files in "${bucketName}":`, listError);
                return { success: false, error: listError };
            }

            console.log(`📂 Found ${files.length} files in "${bucketName}"`);
            files.forEach((file, index) => {
                console.log(`  ${index + 1}. ${file.name} (${(file.metadata?.size / 1024).toFixed(2)}KB)`);
            });

            // Try to download a file if any exist
            if (files.length > 0) {
                const firstFile = files[0];
                console.log(`📥 Testing download of: ${firstFile.name}`);

                const { data, error: downloadError } = await supabaseClient.storage
                    .from(bucketName)
                    .download(firstFile.name);

                if (downloadError) {
                    console.error(`❌ Error downloading ${firstFile.name}:`, downloadError);
                } else {
                    console.log(`✅ Successfully downloaded ${firstFile.name} (${data.size} bytes)`);

                    // Try to read the content
                    try {
                        const text = await data.text();
                        const json = JSON.parse(text);
                        console.log(`✅ File is valid JSON with ${json.features?.length || 0} features`);
                    } catch (parseError) {
                        console.warn(`⚠️ Could not parse JSON:`, parseError.message);
                    }
                }
            }

            return { success: true, files };

        } catch (error) {
            console.error(`❌ Exception testing file access:`, error);
            return { success: false, error };
        }
    },

    // Check authentication status
    checkAuth: async function() {
        console.log('🔐 Checking Supabase authentication...');

        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();

            if (error) {
                console.log('⚠️ Auth error:', error.message);
            }

            if (user) {
                console.log('✅ User authenticated:', user.email || user.id);
            } else {
                console.log('ℹ️ No user authenticated (anonymous access)');
            }

            // Check session
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

            if (sessionError) {
                console.log('⚠️ Session error:', sessionError.message);
            }

            if (session) {
                console.log('✅ Active session found');
            } else {
                console.log('ℹ️ No active session');
            }

        } catch (error) {
            console.error('❌ Exception checking auth:', error);
        }
    },

    // Run comprehensive diagnosis
    runDiagnosis: async function() {
        console.log('🩺 Running comprehensive Supabase diagnosis...');

        const results = {
            connection: await this.testConnection(),
            buckets: await this.listAllBuckets(),
            auth: await this.checkAuth()
        };

        // NEW: Test different authentication methods
        await this.testAuthMethods();

        // NEW: Test RLS policies
        await this.testRLSPolicies();

        // NEW: Test direct file access
        await this.testDirectFileAccess();

        if (results.connection && results.buckets.success) {
            await this.testBucketNames();

            // If we found buckets, test the first one
            if (results.buckets.buckets.length > 0) {
                const firstBucket = results.buckets.buckets[0];
                console.log(`🧪 Testing first available bucket: "${firstBucket.name}"`);
                await this.testFileAccess(firstBucket.name);
            }

            // Also try the expected bucket name
            console.log('🧪 Testing expected "Daily Shapes" bucket...');
            await this.testFileAccess('Daily Shapes');
        }

        console.log('🩺 Diagnosis complete. Check logs above for details.');
        return results;
    }
};

// Export to window
window.SupabaseDebug = SupabaseDebug;

// Auto-run diagnosis after a delay
setTimeout(async () => {
    await SupabaseDebug.runDiagnosis();
}, 2000);

console.log('🔍 Supabase Debug Script loaded. Use window.SupabaseDebug.runDiagnosis() to run manual diagnosis.');