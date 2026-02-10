#!/usr/bin/env node

/**
 * Small Test Simulation - Daily Shapes v4.0
 * Creates a minimal test dataset (10 players, single day) for demonstration
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://zxrfhumifazjxgikltkz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cmZodW1pZmF6anhnaWtsdGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MjMyMTAsImV4cCI6MjA2ODQ5OTIxMH0.GJGVi_So1OAklXM6oantOGd3ok1OVhgURmc7KhEwcwQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test configuration - SMALL SCALE
const TEST_CONFIG = {
    date: '2025-08-27',  // Today - a new date not in existing data
    playerCount: 10,     // Just 10 test players
    testId: `DEMO_${Date.now()}`
};

// Helper functions
function calculateScore(leftPct) {
    const deviation = Math.abs(50 - leftPct);
    return Math.max(0, 100 - (deviation * 2));
}

function generateAttempt(targetScore) {
    const deviation = (100 - targetScore) / 2;
    const leftPct = Math.random() > 0.5 
        ? 50 + deviation 
        : 50 - deviation;
    
    return {
        leftPercentage: parseFloat(leftPct.toFixed(1)),
        rightPercentage: parseFloat((100 - leftPct).toFixed(1)),
        score: calculateScore(leftPct),
        vector: {
            start: { x: Math.floor(Math.random() * 380), y: 0 },
            end: { x: Math.floor(Math.random() * 380), y: 380 }
        }
    };
}

async function runSmallTest() {
    console.log('🧪 SMALL SCALE TEST SIMULATION');
    console.log('=' .repeat(40));
    console.log(`📅 Date: ${TEST_CONFIG.date}`);
    console.log(`👥 Players: ${TEST_CONFIG.playerCount}`);
    console.log(`🔖 Test ID: ${TEST_CONFIG.testId}`);
    console.log('=' .repeat(40));
    
    let successCount = 0;
    
    for (let i = 0; i < TEST_CONFIG.playerCount; i++) {
        const playerId = `SIM_DEMO_${TEST_CONFIG.testId}_P${i}`;
        
        // Generate 2 attempts per player
        const targetScores = [
            75 + Math.random() * 25,  // Score between 75-100
            80 + Math.random() * 20   // Slightly better second attempt
        ];
        
        for (let attemptNum = 0; attemptNum < 2; attemptNum++) {
            const attempt = generateAttempt(targetScores[attemptNum]);
            
            try {
                const { error } = await supabase
                    .from('v3_0_cuts')
                    .insert([{
                        utc_date: TEST_CONFIG.date,
                        session_id: playerId,
                        attempt_number: attemptNum + 1,
                        side_a_percentage: attempt.leftPercentage,
                        side_b_percentage: attempt.rightPercentage,
                        vector_start: attempt.vector.start,
                        vector_end: attempt.vector.end
                    }]);
                
                if (!error) {
                    successCount++;
                    console.log(`✅ Player ${i + 1}: Attempt ${attemptNum + 1} - Score: ${attempt.score.toFixed(1)}`);
                } else {
                    console.error(`❌ Failed: ${error.message}`);
                }
            } catch (err) {
                console.error(`❌ Error: ${err.message}`);
            }
        }
    }
    
    console.log('\n' + '=' .repeat(40));
    console.log(`✅ Inserted ${successCount} attempts successfully`);
    
    // Validate
    console.log('\n🔍 Validating test data...');
    const { data, error } = await supabase
        .from('v3_0_cuts')
        .select('side_a_percentage, side_b_percentage')
        .eq('utc_date', TEST_CONFIG.date)
        .like('session_id', 'SIM_DEMO_%');
    
    if (data && data.length > 0) {
        const avgLeft = data.reduce((sum, r) => sum + r.side_a_percentage, 0) / data.length;
        const avgRight = data.reduce((sum, r) => sum + r.side_b_percentage, 0) / data.length;
        
        console.log(`📊 Test Data Average: ${avgLeft.toFixed(1)}% / ${avgRight.toFixed(1)}%`);
        console.log(`📈 Total test records: ${data.length}`);
    }
    
    // Cleanup instructions
    console.log('\n' + '=' .repeat(40));
    console.log('🧹 To clean up this test data, run:');
    console.log('   node test-simulation-small.js cleanup');
}

async function cleanupTest() {
    console.log('🧹 Cleaning up test data...');
    
    const { data, error } = await supabase
        .from('v3_0_cuts')
        .delete()
        .like('session_id', 'SIM_DEMO_%')
        .select();
    
    if (error) {
        console.error(`❌ Cleanup error: ${error.message}`);
    } else {
        console.log(`✅ Removed ${data ? data.length : 0} test records`);
    }
}

// Main
async function main() {
    const command = process.argv[2];
    
    if (command === 'cleanup') {
        await cleanupTest();
    } else {
        await runSmallTest();
    }
}

main().catch(console.error);