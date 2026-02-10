/**
 * Daily Shapes Stress Testing Suite
 * Tests database performance, authentication, and competition systems under load
 */

class DailyShapesStressTester {
    constructor() {
        this.supabaseUrl = 'https://zxrfhumifazjxgikltkz.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cmZodW1pZmF6anhnaWtsdGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MjMyMTAsImV4cCI6MjA2ODQ5OTIxMH0.GJGVi_So1OAklXM6oantOGd3ok1OVhgURmc7KhEwcwQ';
        this.testResults = {
            database: [],
            auth: [],
            competitions: [],
            gameState: [],
            overall: {}
        };
        this.testUsers = [];
        this.activeConnections = 0;
        this.maxConcurrentUsers = 50;
    }

    // Initialize Supabase client
    async initializeClient() {
        if (typeof window === 'undefined') {
            // Node.js environment - use fetch polyfill
            global.fetch = require('node-fetch');
            const { createClient } = require('@supabase/supabase-js');
            this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        } else {
            // Browser environment
            const { createClient } = window.supabase;
            this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        }
        console.log('✅ Supabase client initialized for stress testing');
    }

    // Generate test user data
    generateTestUser(index) {
        return {
            email: `stresstest${index}@dailyshapes.test`,
            username: `stressuser${index}`,
            password: 'StressTest123!'
        };
    }

    // Create test score data
    generateTestScore() {
        return {
            date: new Date().toISOString().split('T')[0],
            attempts: [
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 100)
            ],
            scores: [
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 100)
            ],
            completed: true
        };
    }

    // Test 1: Database Performance Under Load
    async testDatabasePerformance(concurrentUsers = 25) {
        console.log(`🔍 Testing database performance with ${concurrentUsers} concurrent users...`);
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < concurrentUsers; i++) {
            promises.push(this.simulateDatabaseOperations(i));
        }

        try {
            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            const testResult = {
                test: 'Database Performance',
                concurrentUsers,
                duration,
                successful,
                failed,
                successRate: (successful / concurrentUsers) * 100,
                averageResponseTime: duration / concurrentUsers,
                throughput: concurrentUsers / (duration / 1000),
                timestamp: new Date().toISOString()
            };

            this.testResults.database.push(testResult);
            console.log(`📊 Database Test Results:`, testResult);
            return testResult;

        } catch (error) {
            console.error('❌ Database test failed:', error);
            throw error;
        }
    }

    // Simulate database operations for one user
    async simulateDatabaseOperations(userIndex) {
        const testUser = this.generateTestUser(userIndex);
        const testScore = this.generateTestScore();

        try {
            // 1. Insert daily progress
            const { data: progressData, error: progressError } = await this.supabase
                .from('user_daily_progress')
                .upsert({
                    user_id: `stress-test-${userIndex}`,
                    date: testScore.date,
                    attempts: testScore.attempts,
                    scores: testScore.scores,
                    completed: testScore.completed
                });

            if (progressError) throw progressError;

            // 2. Query user progress
            const { data: queryData, error: queryError } = await this.supabase
                .from('user_daily_progress')
                .select('*')
                .eq('user_id', `stress-test-${userIndex}`)
                .limit(10);

            if (queryError) throw queryError;

            // 3. Update competition scores (if competitions table exists)
            try {
                const { data: compData, error: compError } = await this.supabase
                    .from('competition_participants')
                    .upsert({
                        competition_id: 'stress-test-comp',
                        user_id: `stress-test-${userIndex}`,
                        daily_scores: JSON.stringify([testScore]),
                        total_score: testScore.scores.reduce((sum, score) => sum + score, 0) / 3
                    });
            } catch (compError) {
                // Competition table might not exist, continue test
            }

            return { success: true, userIndex };

        } catch (error) {
            console.error(`Database operation failed for user ${userIndex}:`, error);
            throw error;
        }
    }

    // Test 2: Authentication Performance
    async testAuthenticationLoad(concurrentSignups = 10) {
        console.log(`🔐 Testing authentication with ${concurrentSignups} concurrent signups...`);
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < concurrentSignups; i++) {
            promises.push(this.simulateUserSignup(i));
        }

        try {
            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            const testResult = {
                test: 'Authentication Load',
                concurrentSignups,
                duration,
                successful,
                failed,
                successRate: (successful / concurrentSignups) * 100,
                averageResponseTime: duration / concurrentSignups,
                timestamp: new Date().toISOString()
            };

            this.testResults.auth.push(testResult);
            console.log(`🔐 Auth Test Results:`, testResult);
            return testResult;

        } catch (error) {
            console.error('❌ Authentication test failed:', error);
            throw error;
        }
    }

    // Simulate user signup
    async simulateUserSignup(userIndex) {
        const testUser = this.generateTestUser(Date.now() + userIndex); // Unique users

        try {
            const { data, error } = await this.supabase.auth.signUp({
                email: testUser.email,
                password: testUser.password,
                options: {
                    data: {
                        username: testUser.username
                    }
                }
            });

            if (error) throw error;

            // Store for cleanup
            this.testUsers.push({ ...testUser, id: data.user?.id });

            return { success: true, userIndex, userId: data.user?.id };

        } catch (error) {
            console.error(`Signup failed for user ${userIndex}:`, error);
            throw error;
        }
    }

    // Test 3: Competition System Scalability
    async testCompetitionScalability(participants = 20) {
        console.log(`🏆 Testing competition system with ${participants} participants...`);
        const startTime = Date.now();
        const competitionId = `stress-test-comp-${Date.now()}`;

        try {
            // Create competition
            const { data: compData, error: compError } = await this.supabase
                .from('competitions')
                .insert({
                    id: competitionId,
                    name: 'Stress Test Competition',
                    creator_id: 'stress-test-creator',
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    settings: JSON.stringify({ maxParticipants: participants })
                });

            // Simulate participants joining and submitting scores
            const promises = [];
            for (let i = 0; i < participants; i++) {
                promises.push(this.simulateCompetitionParticipation(competitionId, i));
            }

            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            const testResult = {
                test: 'Competition Scalability',
                participants,
                duration,
                successful,
                failed,
                successRate: (successful / participants) * 100,
                competitionId,
                timestamp: new Date().toISOString()
            };

            this.testResults.competitions.push(testResult);
            console.log(`🏆 Competition Test Results:`, testResult);
            return testResult;

        } catch (error) {
            console.error('❌ Competition test failed:', error);
            throw error;
        }
    }

    // Simulate competition participation
    async simulateCompetitionParticipation(competitionId, userIndex) {
        const userId = `stress-participant-${userIndex}`;
        const testScore = this.generateTestScore();

        try {
            // Join competition
            const { data: joinData, error: joinError } = await this.supabase
                .from('competition_participants')
                .upsert({
                    competition_id: competitionId,
                    user_id: userId,
                    username: `StressUser${userIndex}`,
                    daily_scores: JSON.stringify([testScore]),
                    total_score: testScore.scores.reduce((sum, score) => sum + score, 0) / 3,
                    last_updated: new Date().toISOString()
                });

            if (joinError) throw joinError;

            // Query leaderboard
            const { data: leaderboard, error: leaderError } = await this.supabase
                .from('competition_participants')
                .select('*')
                .eq('competition_id', competitionId)
                .order('total_score', { ascending: false })
                .limit(10);

            if (leaderError) throw leaderError;

            return { success: true, userIndex, leaderboardSize: leaderboard?.length };

        } catch (error) {
            console.error(`Competition participation failed for user ${userIndex}:`, error);
            throw error;
        }
    }

    // Test 4: Real-time Performance
    async testRealTimePerformance(connections = 15) {
        console.log(`⚡ Testing real-time performance with ${connections} connections...`);
        const startTime = Date.now();
        const channels = [];

        try {
            // Create multiple real-time subscriptions
            for (let i = 0; i < connections; i++) {
                const channel = this.supabase
                    .channel(`stress-test-${i}`)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'competition_participants'
                    }, (payload) => {
                        console.log(`📡 Real-time update received on channel ${i}:`, payload);
                    })
                    .subscribe();

                channels.push(channel);
                this.activeConnections++;
            }

            // Wait for connections to establish
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate some changes to trigger real-time updates
            const updatePromises = [];
            for (let i = 0; i < Math.min(connections, 5); i++) {
                updatePromises.push(this.triggerRealTimeUpdate(i));
            }

            await Promise.allSettled(updatePromises);

            // Test duration
            await new Promise(resolve => setTimeout(resolve, 3000));

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Cleanup channels
            for (const channel of channels) {
                await this.supabase.removeChannel(channel);
                this.activeConnections--;
            }

            const testResult = {
                test: 'Real-time Performance',
                connections,
                duration,
                activeConnections: this.activeConnections,
                timestamp: new Date().toISOString()
            };

            this.testResults.competitions.push(testResult);
            console.log(`⚡ Real-time Test Results:`, testResult);
            return testResult;

        } catch (error) {
            console.error('❌ Real-time test failed:', error);
            throw error;
        }
    }

    // Trigger real-time update
    async triggerRealTimeUpdate(index) {
        try {
            const { data, error } = await this.supabase
                .from('competition_participants')
                .upsert({
                    competition_id: 'stress-test-realtime',
                    user_id: `realtime-user-${index}`,
                    username: `RealtimeUser${index}`,
                    total_score: Math.floor(Math.random() * 100),
                    last_updated: new Date().toISOString()
                });

            if (error) throw error;
            return { success: true, index };

        } catch (error) {
            console.error(`Real-time update failed for ${index}:`, error);
            throw error;
        }
    }

    // Test 5: Memory and Performance Monitoring
    async testMemoryUsage() {
        console.log('🧠 Testing memory usage...');

        const memoryBefore = this.getMemoryUsage();

        // Simulate heavy operations
        const largeDataSet = [];
        for (let i = 0; i < 10000; i++) {
            largeDataSet.push(this.generateTestScore());
        }

        // Process data
        const processedData = largeDataSet.map(score => ({
            ...score,
            average: score.scores.reduce((sum, s) => sum + s, 0) / 3
        }));

        const memoryAfter = this.getMemoryUsage();

        const testResult = {
            test: 'Memory Usage',
            memoryBefore,
            memoryAfter,
            memoryIncrease: memoryAfter.used - memoryBefore.used,
            dataSetSize: largeDataSet.length,
            timestamp: new Date().toISOString()
        };

        this.testResults.overall.memory = testResult;
        console.log('🧠 Memory Test Results:', testResult);

        // Cleanup
        largeDataSet.length = 0;
        processedData.length = 0;

        return testResult;
    }

    // Get memory usage (browser or Node.js)
    getMemoryUsage() {
        if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
            // Browser environment
            return {
                used: window.performance.memory.usedJSHeapSize,
                total: window.performance.memory.totalJSHeapSize,
                limit: window.performance.memory.jsHeapSizeLimit
            };
        } else if (typeof process !== 'undefined' && process.memoryUsage) {
            // Node.js environment
            const mem = process.memoryUsage();
            return {
                used: mem.heapUsed,
                total: mem.heapTotal,
                limit: mem.heapTotal,
                rss: mem.rss
            };
        } else {
            return { used: 0, total: 0, limit: 0 };
        }
    }

    // Run all stress tests
    async runAllTests() {
        console.log('🚀 Starting Daily Shapes stress testing suite...');
        const overallStart = Date.now();

        try {
            await this.initializeClient();

            // Run tests in sequence to avoid overwhelming the system
            console.log('\n1️⃣ Testing database performance...');
            await this.testDatabasePerformance(25);

            console.log('\n2️⃣ Testing authentication load...');
            await this.testAuthenticationLoad(10);

            console.log('\n3️⃣ Testing competition scalability...');
            await this.testCompetitionScalability(20);

            console.log('\n4️⃣ Testing real-time performance...');
            await this.testRealTimePerformance(15);

            console.log('\n5️⃣ Testing memory usage...');
            await this.testMemoryUsage();

            const overallEnd = Date.now();
            const totalDuration = overallEnd - overallStart;

            this.testResults.overall.duration = totalDuration;
            this.testResults.overall.timestamp = new Date().toISOString();

            console.log('\n🎉 All stress tests completed!');
            this.generateReport();

            return this.testResults;

        } catch (error) {
            console.error('❌ Stress testing failed:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    // Generate comprehensive test report
    generateReport() {
        console.log('\n📊 DAILY SHAPES STRESS TEST REPORT');
        console.log('=====================================');

        const report = {
            summary: {
                totalDuration: this.testResults.overall.duration,
                timestamp: this.testResults.overall.timestamp,
                testsRun: Object.keys(this.testResults).length - 1
            },
            recommendations: [],
            criticalIssues: []
        };

        // Database Performance Analysis
        if (this.testResults.database.length > 0) {
            const dbTest = this.testResults.database[0];
            console.log('\n📈 Database Performance:');
            console.log(`   Success Rate: ${dbTest.successRate.toFixed(1)}%`);
            console.log(`   Average Response Time: ${dbTest.averageResponseTime.toFixed(0)}ms`);
            console.log(`   Throughput: ${dbTest.throughput.toFixed(1)} operations/second`);

            if (dbTest.successRate < 95) {
                report.criticalIssues.push('Database success rate below 95%');
            }
            if (dbTest.averageResponseTime > 2000) {
                report.criticalIssues.push('Database response time too slow (>2s)');
            }
        }

        // Authentication Analysis
        if (this.testResults.auth.length > 0) {
            const authTest = this.testResults.auth[0];
            console.log('\n🔐 Authentication Performance:');
            console.log(`   Success Rate: ${authTest.successRate.toFixed(1)}%`);
            console.log(`   Average Response Time: ${authTest.averageResponseTime.toFixed(0)}ms`);

            if (authTest.successRate < 90) {
                report.criticalIssues.push('Authentication success rate below 90%');
            }
        }

        // Competition System Analysis
        if (this.testResults.competitions.length > 0) {
            const compTest = this.testResults.competitions.find(t => t.test === 'Competition Scalability');
            if (compTest) {
                console.log('\n🏆 Competition System:');
                console.log(`   Success Rate: ${compTest.successRate.toFixed(1)}%`);
                console.log(`   Participants Handled: ${compTest.participants}`);

                if (compTest.successRate < 95) {
                    report.criticalIssues.push('Competition system success rate below 95%');
                }
            }
        }

        // Memory Usage Analysis
        if (this.testResults.overall.memory) {
            const memTest = this.testResults.overall.memory;
            console.log('\n🧠 Memory Usage:');
            console.log(`   Memory Increase: ${(memTest.memoryIncrease / 1024 / 1024).toFixed(1)}MB`);

            if (memTest.memoryIncrease > 50 * 1024 * 1024) { // 50MB
                report.recommendations.push('Consider memory optimization for large datasets');
            }
        }

        // Recommendations
        console.log('\n💡 Recommendations:');

        report.recommendations.push('Implement connection pooling for database operations');
        report.recommendations.push('Add caching layer for frequently accessed data');
        report.recommendations.push('Monitor real-time connection limits');
        report.recommendations.push('Implement rate limiting for API endpoints');
        report.recommendations.push('Set up database indexing for user_daily_progress table');

        report.recommendations.forEach(rec => console.log(`   • ${rec}`));

        if (report.criticalIssues.length > 0) {
            console.log('\n⚠️  Critical Issues:');
            report.criticalIssues.forEach(issue => console.log(`   • ${issue}`));
        }

        console.log('\n✅ Report generation complete');

        return report;
    }

    // Cleanup test data
    async cleanup() {
        console.log('🧹 Cleaning up test data...');

        try {
            // Delete test user progress
            await this.supabase
                .from('user_daily_progress')
                .delete()
                .like('user_id', 'stress-test-%');

            // Delete test competition participants
            await this.supabase
                .from('competition_participants')
                .delete()
                .like('user_id', 'stress-%');

            // Delete test competitions
            await this.supabase
                .from('competitions')
                .delete()
                .like('id', 'stress-test-comp-%');

            console.log('✅ Cleanup completed');

        } catch (error) {
            console.error('⚠️  Cleanup failed (this is normal if tables don\'t exist):', error.message);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DailyShapesStressTester;
} else if (typeof window !== 'undefined') {
    window.DailyShapesStressTester = DailyShapesStressTester;
}