// Competition Integration for Daily Shapes v4.0
// Connects global competition system with daily game core

// Initialize competition system when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🏆 Initializing competition integration...');
    
    try {
        // Wait for authentication to be ready
        let authReady = false;
        let attempts = 0;
        while (!authReady && attempts < 50) {
            if (window.AuthService || (window.AuthManager && window.AuthManager.authService)) {
                authReady = true;
            } else {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
        }
        
        // Initialize global competition manager
        await window.GlobalCompetitionManager.initialize();
        
        // Connect competition button to leaderboard
        setupCompetitionButton();
        
        // Integrate with daily game score submission
        integrateWithDailyGame();
        
        console.log('✅ Competition integration initialized');
        
    } catch (error) {
        console.error('❌ Error initializing competition integration:', error);
    }
});

// Set up competition button functionality
function setupCompetitionButton() {
    const compButton = document.getElementById('compButton');
    if (compButton) {
        compButton.onclick = function() {
            if (window.AuthService && window.AuthService.isLoggedIn()) {
                window.LeaderboardUI.open();
            } else {
                alert('Please sign in to view the global leaderboard!');
            }
        };
        
        console.log('🔗 Competition button connected to leaderboard');
    }
}

// Integrate with daily game score submission
function integrateWithDailyGame() {
    // Hook into the daily game core's score submission
    if (window.DailyGameCore) {
        // Override the original saveToDatabase method
        const originalSaveToDatabase = window.DailyGameCore.saveToDatabase;
        
        window.DailyGameCore.saveToDatabase = async function() {
            // Call original method first
            if (originalSaveToDatabase) {
                await originalSaveToDatabase.call(this);
            }
            
            // Submit to global competition if game is completed
            if (this.gameState.isCompleted) {
                await submitToGlobalCompetition();
            }
        };
        
        console.log('🔗 Daily game integrated with competition system');
    }
    
    // Also hook into the scoring system
    if (window.ScoringSystem) {
        // Override the processCutResult to track completion
        const originalProcessCutResult = window.ScoringSystem.processCutResult;
        
        window.ScoringSystem.processCutResult = function(leftPercentage, rightPercentage) {
            const result = originalProcessCutResult.call(this, leftPercentage, rightPercentage);
            
            // Check if this completed the daily game
            setTimeout(() => {
                checkAndSubmitCompletedGame();
            }, 100);
            
            return result;
        };
    }
}

// Submit completed daily game to global competition and custom competitions
async function submitToGlobalCompetition() {
    if (!window.AuthService || !window.AuthService.isLoggedIn()) {
        console.log('🏆 User not logged in, skipping competition submission');
        return;
    }
    
    if (!window.DailyGameCore || !window.GlobalCompetitionManager.isReady()) {
        console.log('🏆 Competition system not ready');
        return;
    }
    
    try {
        const progress = window.DailyGameCore.getGameProgress();
        const scoreSummary = window.ScoringSystem.getScoreSummary(progress);
        
        if (scoreSummary.isComplete && scoreSummary.dailyAverage > 0) {
            console.log(`🏆 Submitting daily score: ${scoreSummary.dailyAverage}`);
            
            // Submit to global competition
            await window.GlobalCompetitionManager.submitDailyScore(scoreSummary.dailyAverage);
            
            // Submit to all custom competitions user is part of
            await submitToCustomCompetitions(scoreSummary.dailyAverage);
            
            // Show submission confirmation
            showCompetitionSubmissionFeedback(scoreSummary.dailyAverage);
        }
        
    } catch (error) {
        console.error('❌ Error submitting to competitions:', error);
        // Don't throw - daily game should continue working
    }
}

// Submit to custom competitions
async function submitToCustomCompetitions(dailyScore) {
    if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
        console.log('🏅 Database not available for custom competitions');
        return;
    }
    
    const user = window.AuthService.getCurrentUser();
    if (!user || user.isGuest) return;
    
    try {
        // Get user's active custom competitions
        const { data: userCompetitions, error } = await supabaseClient
            .from('competition_participants')
            .select(`
                competition_id,
                competitions!inner(id, is_active, end_date)
            `)
            .eq('user_id', user.id)
            .eq('competitions.is_global', false)
            .eq('competitions.is_active', true)
            .gte('competitions.end_date', new Date().toISOString().split('T')[0]);

        if (error) throw error;

        // Submit score to each active custom competition
        const today = new Date().toISOString().split('T')[0];
        for (const comp of userCompetitions || []) {
            await supabaseClient.rpc('submit_to_custom_competition', {
                p_competition_id: comp.competition_id,
                p_user_id: user.id,
                p_daily_score: dailyScore,
                p_date: today
            });
        }

        console.log(`🏅 Submitted to ${userCompetitions?.length || 0} custom competitions`);

    } catch (error) {
        console.error('❌ Error submitting to custom competitions:', error);
        // Don't throw - continue with other submissions
    }
}

// Check and submit if daily game was just completed
async function checkAndSubmitCompletedGame() {
    if (!window.DailyGameCore) return;

    const progress = window.DailyGameCore.getGameProgress();
    const scoreSummary = window.ScoringSystem.getScoreSummary(progress);

    // Check if game was just completed (all 6 cuts done)
    if (scoreSummary.isComplete && scoreSummary.totalScores.length === 6) {
        // Check localStorage first (fast check)
        const hasSubmittedToday = localStorage.getItem(`competition_submitted_${progress.currentDate}`);

        if (!hasSubmittedToday && window.AuthService.isLoggedIn()) {
            // Double-check server to prevent submission after cache clear
            const alreadySubmittedToServer = await hasAlreadySubmittedToServer(progress.currentDate);

            if (!alreadySubmittedToServer) {
                await submitToGlobalCompetition();
                localStorage.setItem(`competition_submitted_${progress.currentDate}`, 'true');
            } else {
                console.log('🚫 Competition score already submitted to server - preventing duplicate submission');
            }
        }
    }
}

// Check if user has already submitted their score to the server for today
async function hasAlreadySubmittedToServer(date) {
    if (!window.SupabaseConfig?.isReady() || !window.AuthService?.currentUser?.id) {
        return false;
    }

    try {
        const { data, error } = await window.SupabaseConfig.client
            .from('user_daily_progress')
            .select('completed')
            .eq('user_id', window.AuthService.currentUser.id)
            .eq('date', date)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error checking server submission status:', error);
            return false;
        }

        // Return true if already completed on server
        return data?.completed === true;
    } catch (error) {
        console.error('Error checking server submission:', error);
        return false;
    }
}

// Show competition submission feedback
function showCompetitionSubmissionFeedback(score) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.className = 'competition-notification';
    notification.innerHTML = `
        <div class="competition-notification-content">
            🏆 Score submitted to Global Leaderboard!
            <div class="submitted-score">Daily Score: ${score}</div>
            <div class="competition-link">
                <a href="#" onclick="window.LeaderboardUI.open(); return false;">View Leaderboard</a>
            </div>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: #000;
        padding: 15px 20px;
        border-radius: 8px;
        border: 2px solid #000;
        box-shadow: 4px 4px 0px #000;
        z-index: 9999;
        font-weight: 600;
        text-align: center;
        max-width: 300px;
        animation: slideIn 0.5s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.5s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, 5000);
}

// Handle authentication state changes
window.addEventListener('authStateChanged', function(event) {
    const isLoggedIn = event.detail?.isLoggedIn;
    
    if (isLoggedIn) {
        // User just logged in - auto-enroll in global competition
        setTimeout(async () => {
            if (window.GlobalCompetitionManager.isReady()) {
                await window.GlobalCompetitionManager.autoEnrollUser();
            }
        }, 1000);
    }
});

// Enhanced competition button functionality with user status
function updateCompetitionButton() {
    const compButton = document.getElementById('compButton');
    if (!compButton) return;
    
    if (window.AuthService && window.AuthService.isLoggedIn()) {
        compButton.title = 'View Global Leaderboard';
        compButton.style.opacity = '1';
        
        // Try to get user's rank for button tooltip
        if (window.GlobalCompetitionManager.isReady()) {
            window.GlobalCompetitionManager.findUserRank().then(rank => {
                if (rank) {
                    compButton.title = `Global Leaderboard (Your Rank: #${rank.rank})`;
                }
            }).catch(() => {
                // Ignore errors
            });
        }
    } else {
        compButton.title = 'Sign in to view Global Leaderboard';
        compButton.style.opacity = '0.7';
    }
}

// Update competition button when auth state changes
document.addEventListener('DOMContentLoaded', function() {
    // Initial update
    setTimeout(updateCompetitionButton, 1000);
    
    // Update when auth state changes
    const originalUpdateHeaderUI = window.updateHeaderUI;
    if (originalUpdateHeaderUI) {
        window.updateHeaderUI = function() {
            originalUpdateHeaderUI();
            updateCompetitionButton();
        };
    }
});

// Add monthly reset detection
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.GlobalCompetitionManager.isReady()) {
        // Check for month change when page becomes visible
        setTimeout(() => {
            window.GlobalCompetitionManager.checkForMonthChange();
        }, 1000);
    }
});

// Add CSS animations for competition notifications
const competitionStyles = document.createElement('style');
competitionStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .competition-notification-content {
        font-size: 0.875rem;
        line-height: 1.4;
    }
    
    .submitted-score {
        font-size: 1rem;
        font-weight: 700;
        margin: 5px 0;
    }
    
    .competition-link {
        margin-top: 8px;
    }
    
    .competition-link a {
        color: #000;
        text-decoration: underline;
        font-weight: 600;
    }
    
    .competition-link a:hover {
        text-decoration: none;
    }
    
    /* Modal open state */
    body.modal-open {
        overflow: hidden;
    }
`;

document.head.appendChild(competitionStyles);

// Export functions for use by other modules
window.CompetitionIntegration = {
    submitToGlobalCompetition,
    updateCompetitionButton,
    showCompetitionSubmissionFeedback
};