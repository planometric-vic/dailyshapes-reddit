/**
 * Manual Bucket Test - Run this in browser console to diagnose bucket access
 */

async function manualBucketTest() {
    console.log('🔍 Manual Bucket Test Starting...');

    // Check if Supabase client exists
    if (!window.supabaseClient) {
        console.error('❌ No supabaseClient found');
        return;
    }

    console.log('✅ Supabase client found');

    // Test 1: Check authentication state
    console.log('\n1️⃣ Testing authentication state...');
    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        console.log('Session:', session ? '✅ Active' : '❌ None');
        if (sessionError) console.log('Session Error:', sessionError);

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        console.log('User:', user ? '✅ ' + (user.email || user.id) : '❌ None');
        if (userError) console.log('User Error:', userError);

    } catch (e) {
        console.error('Auth check failed:', e);
    }

    // Test 2: List buckets
    console.log('\n2️⃣ Testing bucket listing...');
    try {
        const { data: buckets, error } = await supabaseClient.storage.listBuckets();

        if (error) {
            console.error('❌ Bucket listing error:', error);
        } else {
            console.log('✅ Buckets found:', buckets.length);
            buckets.forEach((bucket, i) => {
                console.log(`  ${i+1}. "${bucket.name}" (Public: ${bucket.public})`);
            });
        }
    } catch (e) {
        console.error('❌ Bucket listing exception:', e);
    }

    // Test 3: Multiple list attempts on Daily Shapes bucket
    console.log('\n3️⃣ Testing "Daily Shapes" bucket access...');

    const listTests = [
        { name: 'Basic list', params: {} },
        { name: 'With limit 1', params: { limit: 1 } },
        { name: 'With limit 10', params: { limit: 10 } },
        { name: 'With limit 100', params: { limit: 100 } },
        { name: 'No limit', params: undefined },
        { name: 'With sortBy name asc', params: { sortBy: { column: 'name', order: 'asc' } } },
        { name: 'With sortBy created_at desc', params: { sortBy: { column: 'created_at', order: 'desc' } } }
    ];

    for (const test of listTests) {
        try {
            console.log(`\n  Testing: ${test.name}`);
            const { data: files, error } = await supabaseClient.storage
                .from('Daily Shapes')
                .list('', test.params);

            if (error) {
                console.log(`    ❌ Error: ${error.message}`);
                console.log(`    ❌ Code: ${error.statusCode || 'N/A'}`);
                console.log(`    ❌ Details:`, error);
            } else {
                console.log(`    ✅ Success: ${files.length} files`);
                if (files.length > 0) {
                    console.log(`    📁 First few files:`, files.slice(0, 3).map(f => f.name));
                }
            }
        } catch (e) {
            console.log(`    ❌ Exception: ${e.message}`);
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test 4: Try direct file download attempts
    console.log('\n4️⃣ Testing direct file downloads...');

    const today = new Date();
    const testFilenames = [];

    // Generate some probable filenames
    for (let i = 0; i < 3; i++) {
        const testDate = new Date(today);
        testDate.setDate(testDate.getDate() - i);

        const year = testDate.getFullYear().toString().slice(-2);
        const month = String(testDate.getMonth() + 1).padStart(2, '0');
        const day = String(testDate.getDate()).padStart(2, '0');
        const yymmdd = `${year}${month}${day}`;

        testFilenames.push(`${yymmdd}-01.geojson`);
        testFilenames.push(`${yymmdd}-02.geojson`);
        testFilenames.push(`${yymmdd}-03.geojson`);
    }

    console.log('Testing these filenames:', testFilenames.slice(0, 3), '...');

    for (const filename of testFilenames.slice(0, 6)) { // Test first 6
        try {
            console.log(`\n  Trying: ${filename}`);
            const { data, error } = await supabaseClient.storage
                .from('Daily Shapes')
                .download(filename);

            if (error) {
                console.log(`    ❌ Error: ${error.message}`);
            } else {
                console.log(`    ✅ Found! Size: ${data.size} bytes`);

                // Try to parse first few characters
                try {
                    const text = await data.text();
                    console.log(`    📄 Content preview: ${text.substring(0, 50)}...`);

                    if (text.startsWith('{')) {
                        const json = JSON.parse(text);
                        console.log(`    📊 Features: ${json.features?.length || 'N/A'}`);
                    }
                } catch (parseError) {
                    console.log(`    ⚠️ Parse error: ${parseError.message}`);
                }

                break; // Stop after first success
            }
        } catch (e) {
            console.log(`    ❌ Exception: ${e.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test 5: Check bucket URL generation
    console.log('\n5️⃣ Testing bucket URL generation...');
    try {
        const { data: urlData } = supabaseClient.storage
            .from('Daily Shapes')
            .getPublicUrl('test-file.txt');

        console.log('Public URL pattern:', urlData.publicUrl);

        // Try to access the URL to see what happens
        const response = await fetch(urlData.publicUrl);
        console.log('URL fetch status:', response.status, response.statusText);

    } catch (e) {
        console.log('URL test failed:', e.message);
    }

    console.log('\n🔍 Manual Bucket Test Complete');
    console.log('📊 Summary: Check all results above for patterns');
}

// Auto-export to window if in browser
if (typeof window !== 'undefined') {
    window.manualBucketTest = manualBucketTest;
    console.log('✅ manualBucketTest() function available. Run it in console.');
}