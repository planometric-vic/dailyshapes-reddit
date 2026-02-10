#!/usr/bin/env node

/**
 * Competition Simulation - Daily Shapes v4.0
 * 
 * Tests cumulative daily average scoring for competitions
 * - 5 players competing from Aug 27 - Sep 5, 2025 (10 days)
 * - Each player plays daily with varying performance
 * - Leaderboard ranked by TOTAL of daily averages (cumulative score)
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://zxrfhumifazjxgikltkz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cmZodW1pZmF6anhnaWtsdGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MjMyMTAsImV4cCI6MjA2ODQ5OTIxMH0.GJGVi_So1OAklXM6oantOGd3ok1OVhgURmc7KhEwcwQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Competition configuration
const COMPETITION_CONFIG = {
    competitionId: `COMP_TEST_${Date.now()}`,
    startDate: '2025-08-27',
    endDate: '2025-09-05',
    
    // 5 test players with different skill profiles
    players: [
        {
            id: 'COMP_PLAYER_ALICE',
            name: 'Alice',
            skill: 'expert',        // Consistently high scores (85-95)
            consistency: 0.9,       // Very consistent
            improvement: 0.01       // Slight improvement over time
        },
        {
            id: 'COMP_PLAYER_BOB',
            name: 'Bob',
            skill: 'expert',        // Also expert but less consistent
            consistency: 0.7,       // More variation
            improvement: 0.02       // Improves more over time
        },
        {
            id: 'COMP_PLAYER_CHARLIE',
            name: 'Charlie',
            skill: 'intermediate',  // Medium scores (75-85)
            consistency: 0.8,       // Fairly consistent
            improvement: 0.03       // Good improvement
        },
        {
            id: 'COMP_PLAYER_DIANA',
            name: 'Diana',
            skill: 'intermediate',  // Medium scores
            consistency: 0.6,       // Less consistent
            improvement: 0.04       // Strong improvement
        },
        {
            id: 'COMP_PLAYER_EVAN',
            name: 'Evan',
            skill: 'beginner',      // Lower scores (65-75)
            consistency: 0.5,       // Inconsistent
            improvement: 0.05       // Most improvement
        }
    ]
};

// Player cumulative scores tracker
const playerCumulativeScores = {};

// Initialize cumulative scores
COMPETITION_CONFIG.players.forEach(player => {
    playerCumulativeScores[player.id] = {
        name: player.name,
        dailyScores: [],
        cumulativeTotal: 0,
        daysPlayed: 0
    };
});

// ================================
// HELPER FUNCTIONS
// ================================

function calculateScore(leftPercentage) {
    const deviation = Math.abs(50 - leftPercentage);
    const score = Math.max(0, 100 - (deviation * 2));
    return parseFloat(score.toFixed(1));
}

function generatePlayerDailyScore(player, dayIndex) {
    // Base score ranges by skill level
    const baseScores = {
        expert: { min: 85, max: 95 },
        intermediate: { min: 75, max: 85 },
        beginner: { min: 65, max: 75 }
    };
    
    const base = baseScores[player.skill];
    
    // Add improvement over time
    const improvementBonus = player.improvement * dayIndex * 10;
    
    // Add consistency factor (higher consistency = less variation)
    const variationRange = (base.max - base.min) * (1 - player.consistency);
    
    // Calculate score for the day
    const minScore = Math.min(base.min + improvementBonus, 95);
    const maxScore = Math.min(base.max + improvementBonus, 100);
    
    const score = minScore + Math.random() * (maxScore - minScore);
    
    // Add occasional bad days (realistic variation)
    const hasBadDay = Math.random() > 0.9; // 10% chance of bad day
    if (hasBadDay && player.skill !== 'expert') {
        return Math.max(50, score - 15);
    }
    
    return Math.min(100, score);
}

function generateShapeAttempts(targetDailyAverage) {
    // Generate 3 shapes with 2 attempts each
    // Shape scores should average to the target daily average
    const shapes = [];
    
    for (let shapeNum = 1; shapeNum <= 3; shapeNum++) {
        // Add variation between shapes
        const shapeVariation = (Math.random() - 0.5) * 10;
        const shapeTarget = targetDailyAverage + shapeVariation;
        
        // Generate 2 attempts per shape
        const attempts = [];
        for (let attemptNum = 1; attemptNum <= 2; attemptNum++) {
            // Second attempt usually better
            const attemptScore = attemptNum === 1 
                ? Math.max(0, shapeTarget - Math.random() * 5)
                : Math.min(100, shapeTarget + Math.random() * 3);
            
            // Calculate percentages from score
            const deviation = (100 - attemptScore) / 2;
            const leftPct = Math.random() > 0.5 
                ? 50 + deviation 
                : 50 - deviation;
            
            attempts.push({
                attemptNumber: attemptNum,
                leftPercentage: parseFloat(Math.max(0, Math.min(100, leftPct)).toFixed(1)),
                rightPercentage: parseFloat(Math.max(0, Math.min(100, 100 - leftPct)).toFixed(1)),
                score: calculateScore(leftPct),
                vector: {
                    start: { x: Math.floor(Math.random() * 380), y: 0 },
                    end: { x: Math.floor(Math.random() * 380), y: 380 }
                }
            });
        }
        
        shapes.push({
            shapeNumber: shapeNum,
            attempts: attempts,
            bestScore: Math.max(...attempts.map(a => a.score))
        });
    }
    
    return shapes;
}

// ================================
// DATABASE FUNCTIONS
// ================================

async function insertPlayerDay(player, date, dayIndex) {
    const targetDailyAverage = generatePlayerDailyScore(player, dayIndex);
    const shapes = generateShapeAttempts(targetDailyAverage);
    
    let successCount = 0;
    let attemptCount = 0;
    
    // Insert all attempts for this player's day
    for (const shape of shapes) {
        for (const attempt of shape.attempts) {
            attemptCount++;
            
            // Create unique session ID for this day
            const sessionId = `${player.id}_${date}_S${shape.shapeNumber}_A${attempt.attemptNumber}`;
            
            try {
                const { error } = await supabase
                    .from('v3_0_cuts')
                    .insert([{
                        utc_date: date,
                        session_id: sessionId,
                        attempt_number: attempt.attemptNumber,
                        side_a_percentage: attempt.leftPercentage,
                        side_b_percentage: attempt.rightPercentage,
                        vector_start: attempt.vector.start,
                        vector_end: attempt.vector.end
                    }]);
                
                if (!error) {
                    successCount++;
                }
            } catch (err) {
                console.error(`Error inserting: ${err.message}`);
            }
        }
    }
    
    // Calculate actual daily average (best of each shape)
    const dailyAverage = shapes.reduce((sum, shape) => sum + shape.bestScore, 0) / 3;
    
    // Update cumulative tracking
    playerCumulativeScores[player.id].dailyScores.push({
        date: date,
        score: parseFloat(dailyAverage.toFixed(1)),
        shapes: shapes.length
    });
    playerCumulativeScores[player.id].cumulativeTotal += dailyAverage;
    playerCumulativeScores[player.id].daysPlayed++;
    
    return {
        success: successCount === attemptCount,
        dailyAverage: parseFloat(dailyAverage.toFixed(1)),
        attemptsInserted: successCount
    };
}

// ================================
// SIMULATION FUNCTIONS
// ================================

async function simulateCompetitionDay(date, dayIndex) {
    console.log(`\n📅 Day ${dayIndex + 1}: ${date}`);
    console.log('─'.repeat(50));
    
    const dayResults = [];
    
    // Each player plays this day
    for (const player of COMPETITION_CONFIG.players) {
        const result = await insertPlayerDay(player, date, dayIndex);
        dayResults.push({
            player: player.name,
            dailyScore: result.dailyAverage,
            cumulative: parseFloat(playerCumulativeScores[player.id].cumulativeTotal.toFixed(1))
        });
        
        const dailyScore = result.dailyAverage || 0;
        console.log(`   ${player.name.padEnd(10)} Daily: ${dailyScore.toFixed(1).padStart(5)} | Cumulative: ${playerCumulativeScores[player.id].cumulativeTotal.toFixed(1).padStart(6)}`);
    }
    
    // Show daily leaderboard
    console.log('\n   📊 Leaderboard after Day ' + (dayIndex + 1) + ':');
    const sorted = Object.entries(playerCumulativeScores)
        .sort((a, b) => b[1].cumulativeTotal - a[1].cumulativeTotal)
        .slice(0, 5);
    
    sorted.forEach((entry, index) => {
        const [id, data] = entry;
        console.log(`      ${index + 1}. ${data.name.padEnd(10)} Total: ${data.cumulativeTotal.toFixed(1).padStart(6)} (${data.daysPlayed} days)`);
    });
    
    return dayResults;
}

async function runCompetitionSimulation() {
    console.log('🏆 COMPETITION SIMULATION - DAILY SHAPES v4.0');
    console.log('='.repeat(50));
    console.log(`📍 Competition ID: ${COMPETITION_CONFIG.competitionId}`);
    console.log(`📅 Duration: ${COMPETITION_CONFIG.startDate} to ${COMPETITION_CONFIG.endDate}`);
    console.log(`👥 Players: ${COMPETITION_CONFIG.players.map(p => p.name).join(', ')}`);
    console.log('='.repeat(50));
    console.log('\nScoring: CUMULATIVE TOTAL of daily averages');
    console.log('Each day: Players complete 3 shapes, 2 attempts each');
    console.log('Daily score = Average of best attempt per shape');
    console.log('Competition score = SUM of all daily scores');
    console.log('='.repeat(50));
    
    const startDate = new Date(COMPETITION_CONFIG.startDate);
    const endDate = new Date(COMPETITION_CONFIG.endDate);
    
    let currentDate = new Date(startDate);
    let dayIndex = 0;
    
    // Simulate each day of the competition
    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        await simulateCompetitionDay(dateString, dayIndex);
        
        currentDate.setDate(currentDate.getDate() + 1);
        dayIndex++;
    }
    
    // Final results
    console.log('\n' + '='.repeat(50));
    console.log('🏁 FINAL COMPETITION RESULTS');
    console.log('='.repeat(50));
    
    const finalStandings = Object.entries(playerCumulativeScores)
        .sort((a, b) => b[1].cumulativeTotal - a[1].cumulativeTotal);
    
    console.log('\n🏆 Final Standings (Total Cumulative Score):');
    console.log('─'.repeat(50));
    
    finalStandings.forEach((entry, index) => {
        const [id, data] = entry;
        const avgPerDay = data.cumulativeTotal / data.daysPlayed;
        
        console.log(`\n${index + 1}. ${data.name}`);
        console.log(`   Total Score: ${data.cumulativeTotal.toFixed(1)}`);
        console.log(`   Days Played: ${data.daysPlayed}`);
        console.log(`   Average/Day: ${avgPerDay.toFixed(1)}`);
        console.log(`   Daily Scores: ${data.dailyScores.map(d => d.score.toFixed(1)).join(', ')}`);
    });
    
    // Show progression chart
    console.log('\n📈 Score Progression:');
    console.log('─'.repeat(50));
    console.log('Day  ' + finalStandings.map(([id, data]) => data.name.substring(0, 5).padEnd(7)).join(''));
    
    for (let day = 0; day < dayIndex; day++) {
        const dayNum = (day + 1).toString().padStart(2);
        const scores = finalStandings.map(([id, data]) => {
            const cumulative = data.dailyScores.slice(0, day + 1)
                .reduce((sum, d) => sum + d.score, 0);
            return cumulative.toFixed(0).padStart(7);
        }).join('');
        console.log(`${dayNum}   ${scores}`);
    }
}

async function validateCompetitionData() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 VALIDATING COMPETITION DATA IN DATABASE');
    console.log('='.repeat(50));
    
    const startDate = new Date(COMPETITION_CONFIG.startDate);
    const endDate = new Date(COMPETITION_CONFIG.endDate);
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        
        console.log(`\n📅 ${dateString}:`);
        
        // Check each player's data for this day
        for (const player of COMPETITION_CONFIG.players) {
            const { data, error } = await supabase
                .from('v3_0_cuts')
                .select('side_a_percentage, side_b_percentage')
                .eq('utc_date', dateString)
                .like('session_id', `${player.id}%`);
            
            if (data && data.length > 0) {
                // Calculate daily average from actual database data
                const scores = data.map(row => calculateScore(row.side_a_percentage));
                const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
                
                console.log(`   ${player.name.padEnd(10)} Attempts: ${data.length}, Avg: ${avgScore.toFixed(1)}`);
            }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

async function cleanupCompetition() {
    console.log('\n' + '='.repeat(50));
    console.log('🧹 CLEANING UP COMPETITION TEST DATA');
    console.log('='.repeat(50));
    
    let totalDeleted = 0;
    
    for (const player of COMPETITION_CONFIG.players) {
        const { data, error } = await supabase
            .from('v3_0_cuts')
            .delete()
            .like('session_id', `${player.id}%`)
            .select();
        
        if (!error && data) {
            totalDeleted += data.length;
            console.log(`✅ Removed ${data.length} records for ${player.name}`);
        }
    }
    
    console.log(`\n✨ Total records removed: ${totalDeleted}`);
}

// ================================
// MAIN EXECUTION
// ================================

async function main() {
    const command = process.argv[2];
    
    if (command === 'cleanup') {
        await cleanupCompetition();
    } else if (command === 'validate') {
        await validateCompetitionData();
    } else {
        // Run full competition simulation
        await runCompetitionSimulation();
        
        // Validate
        await validateCompetitionData();
        
        console.log('\n' + '='.repeat(50));
        console.log('💡 NEXT STEPS');
        console.log('='.repeat(50));
        console.log('To validate data again:');
        console.log('  node simulate-competition.js validate');
        console.log('\nTo clean up test data:');
        console.log('  node simulate-competition.js cleanup');
    }
}

// Run
main().catch(console.error);