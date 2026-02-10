/**
 * Test Script for Scoring Consistency 
 * Verifies that all parts of the app use the same "Average of Best Attempts" scoring method
 */

// Test the standard scoring function
function testStandardScoring() {
    console.log('🧪 Testing Standard Scoring Function...');
    
    // Test data: 3 shapes with 2 attempts each
    const testCases = [
        {
            name: "Perfect scores",
            shape1: [100, 95],
            shape2: [100, 90],
            shape3: [100, 85],
            expected: 100 // (100 + 100 + 100) / 3
        },
        {
            name: "Mixed scores",
            shape1: [80, 90],  // best: 90
            shape2: [70, 85],  // best: 85
            shape3: [60, 95],  // best: 95
            expected: 90 // (90 + 85 + 95) / 3
        },
        {
            name: "Single attempt per shape",
            shape1: [75],
            shape2: [80],
            shape3: [85],
            expected: 80 // (75 + 80 + 85) / 3
        }
    ];
    
    testCases.forEach(testCase => {
        const bestScores = window.extractBestAttempts(
            testCase.shape1,
            testCase.shape2, 
            testCase.shape3
        );
        const result = window.calculateStandardDailyScore(bestScores);
        const rounded = Math.round(result * 10) / 10;
        
        const passed = Math.abs(rounded - testCase.expected) < 0.1;
        console.log(
            `${passed ? '✅' : '❌'} ${testCase.name}: ` +
            `Expected ${testCase.expected}, Got ${rounded}`
        );
        
        if (!passed) {
            console.error('   Best scores:', bestScores);
        }
    });
}

// Test that display elements use consistent scoring
function testDisplayConsistency() {
    console.log('🧪 Testing Display Consistency...');
    
    // Check if standard functions are available globally
    const functionsAvailable = 
        typeof window.calculateStandardDailyScore === 'function' &&
        typeof window.extractBestAttempts === 'function';
    
    console.log(
        `${functionsAvailable ? '✅' : '❌'} Standard scoring functions available globally`
    );
    
    // Test with sample data to ensure functions work
    if (functionsAvailable) {
        const sampleBest = [85.5, 90.2, 87.8];
        const result = window.calculateStandardDailyScore(sampleBest);
        const expected = (85.5 + 90.2 + 87.8) / 3;
        
        const consistent = Math.abs(result - expected) < 0.01;
        console.log(
            `${consistent ? '✅' : '❌'} Standard calculation works correctly: ${result.toFixed(1)}`
        );
    }
}

// Check database consistency (requires inspection of stored values)
function checkDatabaseConsistency() {
    console.log('🧪 Database Consistency Check...');
    console.log('   Please run the fix-scoring-consistency.sql script in Supabase');
    console.log('   Then verify that:');
    console.log('   - daily_scores.accuracy_score matches daily_scores.daily_average'); 
    console.log('   - users.average_score matches expected value from daily scores');
    console.log('   - Competition leaderboards show same scores as user profiles');
}

// Run all tests
function runAllTests() {
    console.log('🚀 Running Scoring Consistency Tests...\n');
    
    testStandardScoring();
    console.log('');
    testDisplayConsistency();
    console.log('');
    checkDatabaseConsistency();
    
    console.log('\n✅ All tests completed. Check output above for any failures.');
}

// Auto-run tests when script loads
if (typeof window !== 'undefined') {
    // Run tests when page is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAllTests);
    } else {
        setTimeout(runAllTests, 1000); // Wait for other scripts to load
    }
}

// Export for manual testing
window.testScoringConsistency = {
    runAllTests,
    testStandardScoring,
    testDisplayConsistency,
    checkDatabaseConsistency
};