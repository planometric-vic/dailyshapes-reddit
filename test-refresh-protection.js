// Test Script for Refresh Protection System
// This script provides testing utilities to verify the refresh protection works correctly

class RefreshProtectionTester {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }
    
    // Add a test
    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }
    
    // Run all tests
    async runAllTests() {
        logger.info('🧪 Starting Refresh Protection Tests');
        this.passed = 0;
        this.failed = 0;
        
        for (const test of this.tests) {
            try {
                logger.debug(`🧪 Running: ${test.name}`);
                await test.testFn();
                this.passed++;
                logger.info(`✅ PASSED: ${test.name}`);
            } catch (error) {
                this.failed++;
                logger.error(`❌ FAILED: ${test.name}`, error.message);
            }
        }
        
        const total = this.passed + this.failed;
        logger.info(`🧪 Tests completed: ${this.passed}/${total} passed`);
        
        return {
            total,
            passed: this.passed,
            failed: this.failed,
            success: this.failed === 0
        };
    }
    
    // Assert helper
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    // Setup test data
    setupTestData() {
        // Mock game state data
        return {
            date: new Date().toISOString().split('T')[0],
            isGameStarted: true,
            mechanic: 'DefaultWithUndoMechanic',
            currentShape: 2,
            currentAttempt: 1,
            cuts: [
                {
                    shapeIndex: 1,
                    attemptNumber: 1,
                    score: 85.5,
                    leftPercentage: 42.5,
                    rightPercentage: 57.5,
                    timestamp: Date.now() - 10000
                }
            ]
        };
    }
}

// Create tester instance
const tester = new RefreshProtectionTester();

// Test 1: Enhanced Logger
tester.addTest('Enhanced Logger Initialization', async () => {
    tester.assert(typeof window.logger !== 'undefined', 'Logger should be available');
    tester.assert(typeof window.logger.info === 'function', 'Logger should have info method');
    tester.assert(typeof window.logger.debug === 'function', 'Logger should have debug method');
    tester.assert(typeof window.logger.error === 'function', 'Logger should have error method');
});

// Test 2: Refresh Protection System
tester.addTest('Refresh Protection System Initialization', async () => {
    tester.assert(typeof window.RefreshProtection !== 'undefined', 'RefreshProtection should be available');
    tester.assert(typeof window.RefreshProtection.initialize === 'function', 'Should have initialize method');
    tester.assert(typeof window.RefreshProtection.activateProtection === 'function', 'Should have activateProtection method');
    tester.assert(typeof window.RefreshProtection.saveCutResult === 'function', 'Should have saveCutResult method');
});

// Test 3: State Storage and Retrieval
tester.addTest('State Storage and Retrieval', async () => {
    const testData = tester.setupTestData();
    const currentDate = new Date().toISOString().split('T')[0];
    const stateKey = `dailyGameState_${currentDate}`;
    
    // Save test state
    localStorage.setItem(stateKey, JSON.stringify(testData));
    
    // Retrieve and verify
    const retrieved = localStorage.getItem(stateKey);
    tester.assert(retrieved !== null, 'State should be saved to localStorage');
    
    const parsedState = JSON.parse(retrieved);
    tester.assert(parsedState.isGameStarted === true, 'Game started flag should be preserved');
    tester.assert(parsedState.currentShape === 2, 'Current shape should be preserved');
    tester.assert(parsedState.cuts.length === 1, 'Cuts array should be preserved');
    
    // Cleanup
    localStorage.removeItem(stateKey);
});

// Test 4: Cut Result Saving
tester.addTest('Cut Result Saving', async () => {
    if (!window.RefreshProtection) {
        throw new Error('RefreshProtection not available');
    }
    
    // Initialize the system
    window.RefreshProtection.initializeStateTracking();
    window.RefreshProtection.activateProtection('TestMechanic', null);
    
    // Save a test cut result
    window.RefreshProtection.saveCutResult(1, 1, {start: {x: 10, y: 10}, end: {x: 90, y: 90}}, 45.0, 55.0, 90.0, 'Great cut!');
    
    const currentState = window.RefreshProtection.getCurrentState();
    tester.assert(currentState.cuts.length === 1, 'Cut should be saved to state');
    tester.assert(currentState.cuts[0].score === 90.0, 'Score should be preserved');
    tester.assert(currentState.cuts[0].commentary === 'Great cut!', 'Commentary should be preserved');
});

// Test 5: Game Completion Handling
tester.addTest('Game Completion Handling', async () => {
    if (!window.RefreshProtection) {
        throw new Error('RefreshProtection not available');
    }
    
    const testStats = {
        allScores: [85.5, 92.3, 88.7],
        dailyAverage: 88.8,
        completedAt: Date.now()
    };
    
    window.RefreshProtection.saveGameCompletion(testStats);
    
    const currentState = window.RefreshProtection.getCurrentState();
    tester.assert(currentState.isGameComplete === true, 'Game should be marked as complete');
    tester.assert(currentState.finalStats !== null, 'Final stats should be saved');
    tester.assert(currentState.finalStats.dailyAverage === 88.8, 'Daily average should be preserved');
});

// Test 6: Log Export Functionality
tester.addTest('Log Export Functionality', async () => {
    tester.assert(typeof window.exportLogs === 'function', 'exportLogs function should be available');
    tester.assert(typeof window.logger.exportLogs === 'function', 'Logger should have exportLogs method');
    
    // Test log generation
    const logs = window.logger.exportLogs();
    tester.assert(typeof logs === 'string', 'Exported logs should be a string');
    tester.assert(logs.includes('Daily Shapes v4.0'), 'Logs should include header');
});

// Test 7: Console Log Throttling
tester.addTest('Console Log Throttling', async () => {
    const originalLogCount = window.getLogStats ? window.getLogStats().totalInterceptedLogs : 0;
    
    // Generate many rapid logs
    for (let i = 0; i < 20; i++) {
        console.log(`Test log message ${i}`);
    }
    
    if (window.getLogStats) {
        const stats = window.getLogStats();
        tester.assert(stats.totalInterceptedLogs > originalLogCount, 'Logs should be intercepted');
    }
});

// Test 8: Guest User ID Generation
tester.addTest('Guest User ID Generation', async () => {
    // Clear any existing guest ID
    localStorage.removeItem('guestId');
    
    if (window.RefreshProtection && window.RefreshProtection.getGuestId) {
        const guestId1 = window.RefreshProtection.getGuestId();
        const guestId2 = window.RefreshProtection.getGuestId();
        
        tester.assert(typeof guestId1 === 'string', 'Guest ID should be a string');
        tester.assert(guestId1.startsWith('guest_'), 'Guest ID should have correct prefix');
        tester.assert(guestId1 === guestId2, 'Guest ID should be consistent');
    }
});

// Test 9: Date Handling
tester.addTest('Date Handling', async () => {
    if (window.RefreshProtection) {
        const currentDate = window.RefreshProtection.getCurrentLocalDate();
        tester.assert(typeof currentDate === 'string', 'Date should be a string');
        tester.assert(/^\d{4}-\d{2}-\d{2}$/.test(currentDate), 'Date should be in YYYY-MM-DD format');
    }
});

// Test 10: Integration with Existing Systems
tester.addTest('Integration with Existing Systems', async () => {
    // Test that legacy functions still exist
    tester.assert(typeof window.saveCutResult === 'function', 'Legacy saveCutResult should still exist');
    tester.assert(typeof window.handlePlayButtonClick === 'function', 'handlePlayButtonClick should exist');
    
    // Test that global variables are accessible
    tester.assert(typeof window.gameState !== 'undefined', 'gameState should be accessible');
    tester.assert(typeof window.currentShapeNumber !== 'undefined', 'currentShapeNumber should be accessible');
});

// Export tester to global scope
window.RefreshProtectionTester = tester;

// Provide convenient test runners
window.testRefreshProtection = async function() {
    logger.info('🧪 Running comprehensive refresh protection tests...');
    const results = await tester.runAllTests();
    
    if (results.success) {
        logger.info('🎉 All tests passed! Refresh protection is working correctly.');
    } else {
        logger.warn(`⚠️ ${results.failed} test(s) failed. Check the logs above for details.`);
    }
    
    return results;
};

// Quick test runner for essential functions
window.testEssentials = async function() {
    logger.info('🧪 Running essential functionality tests...');
    
    const essentialTests = [
        'Enhanced Logger Initialization',
        'Refresh Protection System Initialization', 
        'State Storage and Retrieval',
        'Integration with Existing Systems'
    ];
    
    let passed = 0;
    let total = 0;
    
    for (const testName of essentialTests) {
        const test = tester.tests.find(t => t.name === testName);
        if (test) {
            total++;
            try {
                await test.testFn();
                passed++;
                logger.info(`✅ ${testName}`);
            } catch (error) {
                logger.error(`❌ ${testName}: ${error.message}`);
            }
        }
    }
    
    logger.info(`🧪 Essential tests: ${passed}/${total} passed`);
    return { passed, total, success: passed === total };
};

logger.info('🧪 Refresh Protection Test Suite loaded');
logger.info('💡 Run window.testRefreshProtection() to test all functionality');
logger.info('💡 Run window.testEssentials() to test core features only');