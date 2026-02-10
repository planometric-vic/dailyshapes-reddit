#!/usr/bin/env node

/**
 * Command-line stress testing for Daily Shapes
 * Usage: node run-stress-test.js [options]
 */

const DailyShapesStressTester = require('./stress-test.js');

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        database: 25,
        auth: 10,
        competition: 20,
        realtime: 15,
        all: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--database':
            case '-d':
                options.database = parseInt(args[++i]) || 25;
                break;
            case '--auth':
            case '-a':
                options.auth = parseInt(args[++i]) || 10;
                break;
            case '--competition':
            case '-c':
                options.competition = parseInt(args[++i]) || 20;
                break;
            case '--realtime':
            case '-r':
                options.realtime = parseInt(args[++i]) || 15;
                break;
            case '--all':
                options.all = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
        }
    }

    return options;
}

// Show help
function showHelp() {
    console.log(`
Daily Shapes Stress Testing CLI

Usage: node run-stress-test.js [options]

Options:
    --database, -d <num>     Number of concurrent database users (default: 25)
    --auth, -a <num>         Number of concurrent auth users (default: 10)
    --competition, -c <num>  Number of competition participants (default: 20)
    --realtime, -r <num>     Number of real-time connections (default: 15)
    --all                    Run all tests
    --help, -h               Show this help

Examples:
    node run-stress-test.js --all
    node run-stress-test.js --database 50 --auth 20
    node run-stress-test.js --competition 100
    `);
}

// Main execution
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    console.log('🚀 Daily Shapes Command-Line Stress Tester');
    console.log('==========================================\n');

    const tester = new DailyShapesStressTester();

    try {
        if (options.all) {
            // Run comprehensive test suite
            console.log('Running comprehensive stress test suite...\n');
            await tester.runAllTests();
        } else {
            // Run individual tests based on options
            await tester.initializeClient();

            if (options.database > 0) {
                console.log(`\n🔍 Running database test with ${options.database} users...`);
                await tester.testDatabasePerformance(options.database);
            }

            if (options.auth > 0) {
                console.log(`\n🔐 Running authentication test with ${options.auth} users...`);
                await tester.testAuthenticationLoad(options.auth);
            }

            if (options.competition > 0) {
                console.log(`\n🏆 Running competition test with ${options.competition} participants...`);
                await tester.testCompetitionScalability(options.competition);
            }

            if (options.realtime > 0) {
                console.log(`\n⚡ Running real-time test with ${options.realtime} connections...`);
                await tester.testRealTimePerformance(options.realtime);
            }

            // Always run memory test
            console.log('\n🧠 Running memory usage test...');
            await tester.testMemoryUsage();

            // Generate report
            console.log('\n📊 Generating test report...');
            tester.generateReport();
        }

        console.log('\n✅ Stress testing completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Stress testing failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection:', reason);
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, parseArgs, showHelp };