#!/usr/bin/env node

/**
 * Daily Shapes v4.0 - Week-long Gameplay Simulation Script
 * 
 * This script simulates a full week of gameplay with realistic player data
 * to test daily averages, leaderboards, and scoring systems.
 * 
 * SAFETY FEATURES:
 * - All test data is prefixed with 'SIM_PLAYER_' for easy identification
 * - Includes cleanup function to remove all test data
 * - Non-destructive - only creates new records
 * - Detailed logging for monitoring progress
 */

const { createClient } = require('@supabase/supabase-js');

// ================================
// CONFIGURATION
// ================================
const SUPABASE_URL = 'https://zxrfhumifazjxgikltkz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cmZodW1pZmF6anhnaWtsdGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MjMyMTAsImV4cCI6MjA2ODQ5OTIxMH0.GJGVi_So1OAklXM6oantOGd3ok1OVhgURmc7KhEwcwQ';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test session identifier for cleanup
const TEST_SESSION_ID = `TEST_SIM_${Date.now()}`;

// Simulation configuration
const SIMULATION_CONFIG = {
    startDate: '2025-08-20',  // 7 days ago
    endDate: '2025-08-26',     // Yesterday
    testSessionId: TEST_SESSION_ID,
    playerIdPrefix: 'SIM_PLAYER_',
    
    // Player distribution per day
    playersPerDay: {
        Monday: { min: 100, max: 150 },
        Tuesday: { min: 120, max: 160 },
        Wednesday: { min: 130, max: 170 },
        Thursday: { min: 125, max: 165 },
        Friday: { min: 140, max: 180 },
        Saturday: { min: 90, max: 130 },   // Lower weekend traffic
        Sunday: { min: 80, max: 120 }      // Lower weekend traffic
    },
    
    // Skill distribution
    skillDistribution: {
        expert: 0.15,      // 15% very accurate (90-100 score range)
        intermediate: 0.60, // 60% decent (70-90 score range)
        beginner: 0.25     // 25% learning (40-75 score range)
    },
    
    // Attempt patterns
    attemptPatterns: {
        expert: { min: 1, max: 2 },        // Experts often need fewer attempts
        intermediate: { min: 2, max: 3 },   // Most use 2-3 attempts
        beginner: { min: 2, max: 3 }        // Beginners typically use all attempts
    }
};

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Get day of week from date string
 */
function getDayOfWeek(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

/**
 * Generate random number between min and max
 */
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random float between min and max with precision
 */
function randomFloatBetween(min, max, precision = 1) {
    const value = Math.random() * (max - min) + min;
    return parseFloat(value.toFixed(precision));
}

/**
 * Generate normal distribution value using Box-Muller transform
 */
function normalDistribution(mean, stdDev) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + stdDev * normal;
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Calculate score from percentage split (matching game logic)
 */
function calculateScore(leftPercentage) {
    const deviation = Math.abs(50 - leftPercentage);
    const score = Math.max(0, 100 - (deviation * 2));
    return parseFloat(score.toFixed(1));
}

/**
 * Generate realistic cut vector coordinates
 */
function generateCutVector(targetAccuracy) {
    // Canvas is typically 380x380
    const canvasSize = 380;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    
    // Generate angle based on accuracy (more accurate = closer to optimal angles)
    const optimalAngles = [0, 45, 90, 135]; // Common cutting angles
    const baseAngle = optimalAngles[Math.floor(Math.random() * optimalAngles.length)];
    
    // Add noise based on accuracy (lower accuracy = more noise)
    const angleNoise = (100 - targetAccuracy) * 0.5;
    const angle = (baseAngle + randomFloatBetween(-angleNoise, angleNoise)) * Math.PI / 180;
    
    // Generate cut line that crosses the shape
    const lineLength = canvasSize * 1.5;
    const startX = centerX - Math.cos(angle) * lineLength / 2;
    const startY = centerY - Math.sin(angle) * lineLength / 2;
    const endX = centerX + Math.cos(angle) * lineLength / 2;
    const endY = centerY + Math.sin(angle) * lineLength / 2;
    
    return {
        start: { 
            x: clamp(Math.round(startX), 0, canvasSize), 
            y: clamp(Math.round(startY), 0, canvasSize) 
        },
        end: { 
            x: clamp(Math.round(endX), 0, canvasSize), 
            y: clamp(Math.round(endY), 0, canvasSize) 
        }
    };
}

/**
 * Assign skill level to a player based on distribution
 */
function assignSkillLevel() {
    const rand = Math.random();
    if (rand < SIMULATION_CONFIG.skillDistribution.expert) {
        return 'expert';
    } else if (rand < SIMULATION_CONFIG.skillDistribution.expert + SIMULATION_CONFIG.skillDistribution.intermediate) {
        return 'intermediate';
    } else {
        return 'beginner';
    }
}

/**
 * Generate player attempts based on skill level
 */
function generatePlayerAttempts(skillLevel) {
    const attemptConfig = SIMULATION_CONFIG.attemptPatterns[skillLevel];
    const numAttempts = randomBetween(attemptConfig.min, attemptConfig.max);
    const attempts = [];
    
    // Score distributions by skill level
    const scoreDistributions = {
        expert: { mean: 95, stdDev: 3 },
        intermediate: { mean: 82, stdDev: 8 },
        beginner: { mean: 65, stdDev: 15 }
    };
    
    const dist = scoreDistributions[skillLevel];
    
    for (let i = 0; i < numAttempts; i++) {
        // Generate target score using normal distribution
        let targetScore = normalDistribution(dist.mean, dist.stdDev);
        targetScore = clamp(targetScore, 0, 100);
        
        // Calculate percentage split from target score
        // Score = 100 - |50 - leftPct| * 2
        // So: |50 - leftPct| = (100 - score) / 2
        const deviation = (100 - targetScore) / 2;
        
        // Randomly choose which side gets the deviation
        const leftPercentage = Math.random() > 0.5 
            ? parseFloat((50 + deviation).toFixed(1))
            : parseFloat((50 - deviation).toFixed(1));
        
        const rightPercentage = parseFloat((100 - leftPercentage).toFixed(1));
        
        // Generate realistic cut vector
        const cutVector = generateCutVector(targetScore);
        
        attempts.push({
            leftPercentage,
            rightPercentage,
            score: calculateScore(leftPercentage),
            cutVector
        });
        
        // Improve slightly with each attempt (learning effect)
        if (i < numAttempts - 1) {
            dist.mean += randomFloatBetween(0, 2);
            dist.stdDev = Math.max(1, dist.stdDev - 0.5);
        }
    }
    
    return attempts;
}

/**
 * Find best attempt from array
 */
function findBestAttempt(attempts) {
    return attempts.reduce((best, current) => 
        current.score > best.score ? current : best
    );
}

/**
 * Generate realistic player count for a given day
 */
function generatePlayerCount(dayOfWeek) {
    const config = SIMULATION_CONFIG.playersPerDay[dayOfWeek];
    return randomBetween(config.min, config.max);
}

// ================================
// DATABASE FUNCTIONS
// ================================

/**
 * Insert cut attempt into v3_0_cuts table
 */
async function insertCutAttempt(attemptNumber, leftPercentage, rightPercentage, vectorStart, vectorEnd, date, playerId) {
    try {
        const { data, error } = await supabase
            .from('v3_0_cuts')
            .insert([{
                utc_date: date,
                session_id: playerId,  // Using player ID as session ID for test data
                attempt_number: attemptNumber,
                side_a_percentage: leftPercentage,
                side_b_percentage: rightPercentage,
                vector_start: vectorStart,
                vector_end: vectorEnd
            }]);
        
        if (error) {
            console.error(`❌ Error inserting cut attempt: ${error.message}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Exception inserting cut attempt: ${error.message}`);
        return false;
    }
}

/**
 * Submit final attempt to daily_scores table
 */
async function submitAttemptV3(date, leftPercentage, rightPercentage, attemptCount, playerId) {
    try {
        const { data, error } = await supabase
            .from('daily_scores')
            .insert([{
                utc_date: date,
                left_percentage: leftPercentage,
                right_percentage: rightPercentage,
                attempt_count: attemptCount,
                session_id: playerId
            }]);
        
        if (error) {
            // Table might be named differently or have different columns
            // Log but continue
            console.warn(`⚠️  Could not insert into daily_scores: ${error.message}`);
        }
        
        return true;
    } catch (error) {
        console.warn(`⚠️  Exception submitting to daily_scores: ${error.message}`);
        return true; // Continue anyway
    }
}

/**
 * Get today's average from database
 */
async function getTodaysAverage(date) {
    try {
        const { data, error } = await supabase
            .from('v3_0_cuts')
            .select('side_a_percentage, side_b_percentage')
            .eq('utc_date', date);
        
        if (error) {
            console.error(`❌ Error fetching average: ${error.message}`);
            return null;
        }
        
        if (!data || data.length === 0) {
            return null;
        }
        
        const avgLeft = data.reduce((sum, row) => sum + row.side_a_percentage, 0) / data.length;
        const avgRight = data.reduce((sum, row) => sum + row.side_b_percentage, 0) / data.length;
        
        return {
            leftPercentage: parseFloat(avgLeft.toFixed(1)),
            rightPercentage: parseFloat(avgRight.toFixed(1)),
            playerCount: data.length
        };
    } catch (error) {
        console.error(`❌ Exception fetching average: ${error.message}`);
        return null;
    }
}

/**
 * Get leaderboard for a specific date
 */
async function getLeaderboard(date) {
    try {
        // Get best attempts per session for the date
        const { data, error } = await supabase
            .from('v3_0_cuts')
            .select('session_id, side_a_percentage, side_b_percentage')
            .eq('utc_date', date);
        
        if (error) {
            console.error(`❌ Error fetching leaderboard: ${error.message}`);
            return [];
        }
        
        // Group by session and find best attempt
        const sessionBests = {};
        data.forEach(row => {
            const score = calculateScore(row.side_a_percentage);
            if (!sessionBests[row.session_id] || score > sessionBests[row.session_id].score) {
                sessionBests[row.session_id] = {
                    playerId: row.session_id,
                    score: score,
                    leftPercentage: row.side_a_percentage,
                    rightPercentage: row.side_b_percentage
                };
            }
        });
        
        // Convert to array and sort by score
        const leaderboard = Object.values(sessionBests)
            .sort((a, b) => b.score - a.score)
            .slice(0, 100); // Top 100
        
        return leaderboard;
    } catch (error) {
        console.error(`❌ Exception fetching leaderboard: ${error.message}`);
        return [];
    }
}

// ================================
// SIMULATION FUNCTIONS
// ================================

/**
 * Simulate a single day of gameplay
 */
async function simulateDay(date, dayIndex) {
    const dayOfWeek = getDayOfWeek(date);
    const playerCount = generatePlayerCount(dayOfWeek);
    
    console.log(`\n📅 Simulating ${date} (${dayOfWeek})`);
    console.log(`   👥 Generating ${playerCount} players...`);
    
    let successCount = 0;
    let failCount = 0;
    const skillCounts = { expert: 0, intermediate: 0, beginner: 0 };
    
    for (let p = 0; p < playerCount; p++) {
        const playerId = `${SIMULATION_CONFIG.playerIdPrefix}${TEST_SESSION_ID}_D${dayIndex}_P${p}`;
        const skillLevel = assignSkillLevel();
        skillCounts[skillLevel]++;
        
        // Generate attempts for this player
        const attempts = generatePlayerAttempts(skillLevel);
        
        // Insert each attempt into database
        let allAttemptsSuccessful = true;
        for (let a = 0; a < attempts.length; a++) {
            const attempt = attempts[a];
            const success = await insertCutAttempt(
                a + 1,  // Attempt number (1-indexed)
                attempt.leftPercentage,
                attempt.rightPercentage,
                attempt.cutVector.start,
                attempt.cutVector.end,
                date,
                playerId
            );
            
            if (!success) {
                allAttemptsSuccessful = false;
            }
        }
        
        // Submit final/best attempt
        const bestAttempt = findBestAttempt(attempts);
        await submitAttemptV3(
            date,
            bestAttempt.leftPercentage,
            bestAttempt.rightPercentage,
            attempts.length,
            playerId
        );
        
        if (allAttemptsSuccessful) {
            successCount++;
        } else {
            failCount++;
        }
        
        // Progress indicator every 25 players
        if ((p + 1) % 25 === 0) {
            process.stdout.write(`   ✅ Processed ${p + 1}/${playerCount} players\r`);
        }
    }
    
    console.log(`   ✅ Completed: ${successCount} successful, ${failCount} failed`);
    console.log(`   📊 Skill distribution: Expert: ${skillCounts.expert}, Intermediate: ${skillCounts.intermediate}, Beginner: ${skillCounts.beginner}`);
    
    return { playerCount, successCount, failCount, skillCounts };
}

/**
 * Run the full week simulation
 */
async function runSimulation() {
    console.log('🎮 DAILY SHAPES v4.0 - WEEK SIMULATION');
    console.log('=' .repeat(50));
    console.log(`📍 Test Session ID: ${TEST_SESSION_ID}`);
    console.log(`📅 Date Range: ${SIMULATION_CONFIG.startDate} to ${SIMULATION_CONFIG.endDate}`);
    console.log('=' .repeat(50));
    
    const startDate = new Date(SIMULATION_CONFIG.startDate);
    const endDate = new Date(SIMULATION_CONFIG.endDate);
    const results = [];
    
    // Simulate each day
    let currentDate = new Date(startDate);
    let dayIndex = 0;
    
    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        const dayResult = await simulateDay(dateString, dayIndex);
        results.push({ date: dateString, ...dayResult });
        
        currentDate.setDate(currentDate.getDate() + 1);
        dayIndex++;
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 SIMULATION COMPLETE - SUMMARY');
    console.log('=' .repeat(50));
    
    const totalPlayers = results.reduce((sum, day) => sum + day.playerCount, 0);
    const totalSuccess = results.reduce((sum, day) => sum + day.successCount, 0);
    
    console.log(`Total Players Generated: ${totalPlayers}`);
    console.log(`Successful Submissions: ${totalSuccess}`);
    console.log(`Success Rate: ${((totalSuccess / totalPlayers) * 100).toFixed(1)}%`);
    
    return results;
}

/**
 * Validate simulation data
 */
async function validateSimulation() {
    console.log('\n' + '=' .repeat(50));
    console.log('🔍 VALIDATING SIMULATION DATA');
    console.log('=' .repeat(50));
    
    const startDate = new Date(SIMULATION_CONFIG.startDate);
    const endDate = new Date(SIMULATION_CONFIG.endDate);
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        
        // Get daily average
        const average = await getTodaysAverage(dateString);
        
        // Get leaderboard
        const leaderboard = await getLeaderboard(dateString);
        
        console.log(`\n📅 ${dateString}:`);
        if (average) {
            console.log(`   📊 Daily Average: ${average.leftPercentage}% / ${average.rightPercentage}%`);
            console.log(`   👥 Total Players: ${average.playerCount}`);
        } else {
            console.log(`   ⚠️  No average data found`);
        }
        
        if (leaderboard.length > 0) {
            console.log(`   🏆 Top 3 Scores:`);
            leaderboard.slice(0, 3).forEach((entry, index) => {
                console.log(`      ${index + 1}. Score: ${entry.score.toFixed(1)} (${entry.leftPercentage}% / ${entry.rightPercentage}%)`);
            });
        } else {
            console.log(`   ⚠️  No leaderboard data found`);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

/**
 * Clean up all test data
 */
async function cleanupSimulation() {
    console.log('\n' + '=' .repeat(50));
    console.log('🧹 CLEANING UP SIMULATION DATA');
    console.log('=' .repeat(50));
    
    console.log(`Removing all records with prefix: ${SIMULATION_CONFIG.playerIdPrefix}`);
    console.log(`Test session pattern: ${TEST_SESSION_ID}`);
    
    try {
        // Delete from v3_0_cuts table
        const { data: cutData, error: cutError } = await supabase
            .from('v3_0_cuts')
            .delete()
            .like('session_id', `${SIMULATION_CONFIG.playerIdPrefix}%`);
        
        if (cutError) {
            console.error(`❌ Error cleaning v3_0_cuts: ${cutError.message}`);
        } else {
            console.log(`✅ Cleaned v3_0_cuts table`);
        }
        
        // Try to delete from daily_scores if it exists
        const { data: scoreData, error: scoreError } = await supabase
            .from('daily_scores')
            .delete()
            .like('session_id', `${SIMULATION_CONFIG.playerIdPrefix}%`);
        
        if (scoreError) {
            console.warn(`⚠️  Could not clean daily_scores: ${scoreError.message}`);
        } else {
            console.log(`✅ Cleaned daily_scores table`);
        }
        
        console.log('\n✨ Cleanup complete! All simulation data has been removed.');
        
    } catch (error) {
        console.error(`❌ Cleanup failed: ${error.message}`);
    }
}

// ================================
// MAIN EXECUTION
// ================================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'cleanup') {
        // Just run cleanup
        await cleanupSimulation();
    } else if (command === 'validate') {
        // Just run validation
        await validateSimulation();
    } else {
        // Run full simulation
        console.log('🚀 Starting week-long gameplay simulation...\n');
        
        // Run simulation
        await runSimulation();
        
        // Validate results
        await validateSimulation();
        
        // Prompt for cleanup
        console.log('\n' + '=' .repeat(50));
        console.log('💡 CLEANUP OPTIONS');
        console.log('=' .repeat(50));
        console.log('To remove all test data, run:');
        console.log('  node simulate-week-gameplay.js cleanup');
        console.log('\nTo validate data again, run:');
        console.log('  node simulate-week-gameplay.js validate');
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run main function
main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});