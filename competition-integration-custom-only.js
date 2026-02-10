// Competition Integration for Daily Shapes v4.0
// CUSTOM COMPETITIONS ONLY VERSION - No Global Competition
// Handles integration between game core and custom competition systems

// Initialize competition systems when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🎯 Initializing Custom Competition Integration...');
    
    // Check if competition manager exists
    if (!window.CompetitionManager) {
        console.log('⚠️ Competition Manager not loaded');
        return;
    }
    
    try {
        // Initialize competition manager
        await window.CompetitionManager.initialize();
        
        // Competition functionality is now only available through completion popups
        }
        
        // Listen for authentication changes
        window.addEventListener('authStateChanged', handleAuthStateChange);
        
        // Listen for daily game completion
        window.addEventListener('dailyGameComplete', handleGameComplete);
        
        console.log('✅ Custom Competition Integration initialized');
        
    } catch (error) {
        console.error('❌ Error initializing competition integration:', error);
    }
});

// Open custom competitions interface
function openCustomCompetitionsModal() {
    console.log('🏆 Opening integrated competitions interface...');
    
    // Open integrated competition UI
    if (window.IntegratedCompetitionUI) {
        window.IntegratedCompetitionUI.show();
    } else {
        console.warn('Integrated Competition UI not loaded');
        showTemporaryMessage('Competitions feature is loading...');
    }
}

// Handle game completion - submit scores to active custom competitions
async function handleGameComplete(event) {
    console.log('🎮 Game complete - processing competition submissions...');
    
    // Check if user is logged in
    if (!window.AuthService || !window.AuthService.isLoggedIn()) {
        console.log('👤 User not logged in - skipping competition submission');
        return;
    }
    
    if (!window.CompetitionManager) {
        console.log('⚠️ Competition Manager not available');
        return;
    }
    
    const gameData = event.detail;
    if (!gameData || !gameData.dailyAverage) {
        console.error('Invalid game data for competition submission');
        return;
    }
    
    try {
        // Get user's active competitions
        const activeCompetitions = await window.CompetitionManager.getActiveCompetitions();
        
        if (activeCompetitions && activeCompetitions.length > 0) {
            console.log(`📊 Submitting score to ${activeCompetitions.length} competitions`);
            
            // Submit score to each active competition
            for (const competition of activeCompetitions) {
                try {
                    await window.CompetitionManager.submitToCompetition(
                        competition.id,
                        window.AuthService.currentUser.id,
                        gameData.dailyAverage,
                        gameData.date
                    );
                    console.log(`✅ Score submitted to: ${competition.name}`);
                } catch (error) {
                    console.error(`❌ Failed to submit to ${competition.name}:`, error);
                }
            }
            
            // Show success message
            showTemporaryMessage(`Score submitted to ${activeCompetitions.length} competition(s)!`);
            
            // Update competition button to show activity
            // Button removed - competition access through completion popups only
        } else {
            console.log('📊 No active competitions to submit to');
        }
        
    } catch (error) {
        console.error('❌ Error submitting to competitions:', error);
    }
}

// Handle authentication state changes
async function handleAuthStateChange(event) {
    const { isLoggedIn, user } = event.detail;
    
    if (isLoggedIn && user) {
        console.log('👤 User logged in - checking competitions...');
        
        // Refresh user's competitions
        if (window.CompetitionManager) {
            await window.CompetitionManager.loadUserCompetitions();
            
            // Update competition button
            const activeCompetitions = window.CompetitionManager.getActiveCompetitions();
            // Button removed - competition access through completion popups only
        }
    } else {
        console.log('👤 User logged out - clearing competition data');
        
        // Clear competition data
        if (window.CompetitionManager) {
            // Clear any cached data
            window.CompetitionManager.userCompetitions = [];
        }
        
        // Reset competition button
        // Button removed - competition access through completion popups only
    }
}

// Update competition button with active competition count
// Competition button removed - functionality now only in completion popups

// Show temporary message to user
function showTemporaryMessage(message, duration = 3000) {
    // Check if message container exists
    let messageContainer = document.getElementById('competitionMessage');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'competitionMessage';
        messageContainer.className = 'competition-message';
        document.body.appendChild(messageContainer);
    }
    
    messageContainer.textContent = message;
    messageContainer.classList.add('show');
    
    setTimeout(() => {
        messageContainer.classList.remove('show');
    }, duration);
}

// Check for active competitions on page load
window.addEventListener('load', async function() {
    // Wait a moment for everything to initialize
    setTimeout(async () => {
        if (window.AuthService && window.AuthService.isLoggedIn() && window.CompetitionManager) {
            try {
                await window.CompetitionManager.loadUserCompetitions();
                const activeCompetitions = window.CompetitionManager.getActiveCompetitions();
                // Button removed - competition access through completion popups only
                
                // Check if any competitions end today - TODO: implement in competition manager
                // const endingToday = await window.CompetitionManager.getCompetitionsEndingToday();
                // if (endingToday && endingToday.length > 0) {
                //     showTemporaryMessage(
                //         `${endingToday.length} competition(s) ending today!`,
                //         5000
                //     );
                // }
            } catch (error) {
                console.error('Error checking competitions on load:', error);
            }
        }
    }, 2000);
});

// Add styles for competition messages
const competitionStyles = `
    <style>
    .competition-message {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        z-index: 10000;
        pointer-events: none;
        font-weight: 500;
    }
    
    .competition-message.show {
        opacity: 1;
        transform: translateY(0);
    }
    </style>
`;

// Add styles to page
document.head.insertAdjacentHTML('beforeend', competitionStyles);

console.log('✨ Custom Competition Integration loaded successfully');