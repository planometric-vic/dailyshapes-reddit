// Competition Invite System for Daily Shapes v4.0
// Handles invite links, joining competitions, and competition discovery

class CompetitionInviteSystem {
    constructor() {
        this.pendingInviteCode = null;
        this.isInitialized = false;
    }

    // Initialize invite system
    initialize() {
        console.log('🔗 Initializing Competition Invite System...');
        
        this.setupInviteHandling();
        this.checkForInviteInURL();
        this.isInitialized = true;
        
        console.log('✅ Competition Invite System initialized');
    }

    // Set up invite URL handling
    setupInviteHandling() {
        // Handle invite URLs like /join/abc123def456
        const currentPath = window.location.pathname;
        const joinMatch = currentPath.match(/\/join\/([a-zA-Z0-9]+)$/);
        
        if (joinMatch) {
            this.pendingInviteCode = joinMatch[1];
            console.log('🔗 Invite code detected in URL:', this.pendingInviteCode);
            
            // Clean URL without page reload
            window.history.replaceState({}, document.title, window.location.pathname.replace(/\/join\/[a-zA-Z0-9]+$/, ''));
        }

        // Also handle query parameters like ?invite=abc123def456
        const urlParams = new URLSearchParams(window.location.search);
        const inviteParam = urlParams.get('invite');
        
        if (inviteParam && !this.pendingInviteCode) {
            this.pendingInviteCode = inviteParam;
            console.log('🔗 Invite code detected in query:', this.pendingInviteCode);
            
            // Clean URL
            urlParams.delete('invite');
            const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, document.title, newUrl);
        }
    }

    // Check for invite in URL and process it
    async checkForInviteInURL() {
        if (!this.pendingInviteCode) return;
        
        // Wait for authentication to be ready
        let attempts = 0;
        while (attempts < 50) {
            if (window.AuthService && window.AuthService.isInitialized) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        // Process the invite
        await this.processInviteCode(this.pendingInviteCode);
        this.pendingInviteCode = null;
    }

    // Process invite code
    async processInviteCode(inviteCode) {
        try {
            const competition = await this.validateInviteCode(inviteCode);
            
            if (!competition) {
                this.showInviteError('Invalid or expired invitation link.');
                return;
            }

            if (!window.AuthService.isLoggedIn()) {
                this.showAuthRequiredForInvite(competition, inviteCode);
                return;
            }

            // Check if user is already in competition
            const isAlreadyMember = await this.checkUserMembership(competition.id);
            if (isAlreadyMember) {
                this.showAlreadyJoinedMessage(competition);
                return;
            }

            // Show join confirmation
            this.showJoinCompetitionModal(competition);

        } catch (error) {
            console.error('Error processing invite:', error);
            this.showInviteError('Failed to process invitation. Please try again.');
        }
    }

    // Validate invite code and get competition data
    async validateInviteCode(inviteCode) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return this.getDemoCompetitionForInvite(inviteCode);
        }

        const { data, error } = await supabaseClient
            .from('competitions')
            .select(`
                id, name, description, start_date, end_date, 
                creator_timezone, is_active, is_public,
                users!competitions_creator_id_fkey(username)
            `)
            .eq('invite_code', inviteCode)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return null;
        }

        return data;
    }

    // Get demo competition for invite testing
    getDemoCompetitionForInvite(inviteCode) {
        return {
            id: 'demo_invite',
            name: 'Demo Invite Competition',
            description: 'A demonstration competition accessed via invite link',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            creator_timezone: 'UTC',
            is_active: true,
            is_public: false,
            users: { username: 'DemoCreator' }
        };
    }

    // Check if user is already a member of the competition
    async checkUserMembership(competitionId) {
        const user = window.AuthService.getCurrentUser();
        if (!user || user.isGuest) return false;

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return false; // Demo mode - allow joining
        }

        const { data } = await supabaseClient
            .from('competition_participants')
            .select('id')
            .eq('competition_id', competitionId)
            .eq('user_id', user.id)
            .maybeSingle();

        return !!data;
    }

    // Show authentication required message for invite
    showAuthRequiredForInvite(competition, inviteCode) {
        const modal = document.createElement('div');
        modal.className = 'invite-auth-modal competition-modal';

        const isSmallScreen = window.innerWidth <= 430;
        const contentStyles = isSmallScreen ? 'style="max-height: 95vh !important; min-height: 500px !important; width: 92% !important; display: flex !important; flex-direction: column !important;"' : '';
        const bodyStyles = isSmallScreen ? 'style="overflow-y: visible !important; flex: 1 !important;"' : '';

        modal.setAttribute('style', isSmallScreen ? 'display: flex; align-items: flex-start !important; padding-top: 10px !important;' : 'display: flex;');

        modal.innerHTML = `
            <div class="competition-modal-content" ${contentStyles}>
                <div class="competition-modal-header">
                    <h2>Join Competition</h2>
                    <button class="competition-modal-close" onclick="this.closest('.invite-auth-modal').remove()">&times;</button>
                </div>
                <div class="competition-modal-body" ${bodyStyles}>
                    <div class="invite-competition-preview">
                        <h3>🏆 ${this.escapeHtml(competition.name.toUpperCase())}</h3>
                        ${competition.description ? `<p class="competition-desc">${this.escapeHtml(competition.description)}</p>` : ''}
                        <div class="competition-details">
                            <div class="detail-item">
                                <strong>Duration:</strong> 
                                ${window.formatDateForUser ? window.formatDateForUser(competition.start_date) : new Date(competition.start_date).toLocaleDateString()} - ${window.formatDateForUser ? window.formatDateForUser(competition.end_date) : new Date(competition.end_date).toLocaleDateString()}
                            </div>
                            <div class="detail-item">
                                <strong>Created by:</strong> ${competition.users?.username || 'Unknown'}
                            </div>
                        </div>
                    </div>
                    <div class="auth-required-message">
                        <p>You need to sign in to join this competition.</p>
                        <div class="invite-auth-actions">
                            <button class="auth-btn" onclick="window.CompetitionInviteSystem.signInForInvite('${inviteCode}')">
                                Sign In to Join
                            </button>
                            <button class="cancel-btn" onclick="this.closest('.invite-auth-modal').remove()">
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
    }

    // Handle sign in for invite
    signInForInvite(inviteCode) {
        // Store invite code for after authentication
        localStorage.setItem('pendingInviteCode', inviteCode);
        
        // Close invite modal
        const modal = document.querySelector('.invite-auth-modal');
        if (modal) {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
        
        // Open auth modal
        if (window.openAuthModal) {
            window.openAuthModal();
        } else if (document.getElementById('authButton')) {
            document.getElementById('authButton').click();
        }
    }

    // Show join competition modal
    showJoinCompetitionModal(competition) {
        const modal = document.createElement('div');
        modal.className = 'join-competition-modal competition-modal';

        // Apply inline styles for small screens directly
        const isSmallScreen = window.innerWidth <= 430;
        const modalStyles = isSmallScreen ? 'style="align-items: flex-start !important; padding-top: 10px !important;"' : '';
        const contentStyles = isSmallScreen ? 'style="max-height: 95vh !important; min-height: 500px !important; width: 92% !important; display: flex !important; flex-direction: column !important;"' : '';
        const bodyStyles = isSmallScreen ? 'style="overflow-y: visible !important; flex: 1 !important; -webkit-overflow-scrolling: touch !important;"' : '';

        modal.setAttribute('style', isSmallScreen ? 'display: flex; align-items: flex-start !important; padding-top: 10px !important;' : 'display: flex;');

        modal.innerHTML = `
            <div class="competition-modal-content" ${contentStyles}>
                <div class="competition-modal-header">
                    <h2>Join Competition</h2>
                    <button class="competition-modal-close" onclick="window.CompetitionInviteSystem.closeJoinModal()">&times;</button>
                </div>
                <div class="competition-modal-body" ${bodyStyles}>
                    <div class="join-competition-preview">
                        <h3>🏆 ${this.escapeHtml(competition.name.toUpperCase())}</h3>
                        ${competition.description ? `<p class="competition-desc">${this.escapeHtml(competition.description)}</p>` : ''}
                        
                        <div class="competition-details">
                            <div class="detail-item">
                                <strong>Duration:</strong> 
                                ${window.formatDateForUser ? window.formatDateForUser(competition.start_date) : new Date(competition.start_date).toLocaleDateString()} - ${window.formatDateForUser ? window.formatDateForUser(competition.end_date) : new Date(competition.end_date).toLocaleDateString()}
                            </div>
                            <div class="detail-item">
                                <strong>Created by:</strong> ${competition.users?.username || 'Unknown'}
                            </div>
                            <div class="detail-item">
                                <strong>Timezone:</strong> ${competition.creator_timezone}
                            </div>
                        </div>
                        
                        <div class="join-competition-info">
                            <div class="info-item">
                                <span class="info-icon">🎯</span>
                                <span>Play daily puzzles to earn points</span>
                            </div>
                            <div class="info-item">
                                <span class="info-icon">🏅</span>
                                <span>Compete for medals and daily awards</span>
                            </div>
                            <div class="info-item">
                                <span class="info-icon">📊</span>
                                <span>Track your progress on the leaderboard</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="join-actions">
                        <button class="cancel-btn" onclick="window.CompetitionInviteSystem.closeJoinModal()">
                            Not Now
                        </button>
                        <button class="join-btn" onclick="window.CompetitionInviteSystem.joinCompetition('${competition.id}')">
                            🎉 Join Competition
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.classList.add('modal-open');

        console.log(`📱 Join competition modal created: screen ${window.innerWidth}x${window.innerHeight}, isSmallScreen: ${isSmallScreen}`);

        if (isSmallScreen) {
            const content = modal.querySelector('.competition-modal-content');
            console.log(`📱 Modal content dimensions: ${content?.offsetWidth}x${content?.offsetHeight}`);
        }
    }

    // Join competition
    async joinCompetition(competitionId) {
        const joinBtn = document.querySelector('.join-btn');
        if (joinBtn) {
            joinBtn.disabled = true;
            joinBtn.textContent = 'Joining...';
        }

        try {
            const user = window.AuthService.getCurrentUser();
            if (!user || user.isGuest) {
                throw new Error('User not authenticated');
            }

            if (window.SupabaseConfig && window.SupabaseConfig.isReady()) {
                // Add user to competition
                const { error } = await supabaseClient
                    .from('competition_participants')
                    .insert({
                        competition_id: competitionId,
                        user_id: user.id,
                        total_score: 0,
                        days_played: 0
                    });

                if (error && error.code !== '23505') { // Ignore duplicate entry
                    throw error;
                }

                // RETROACTIVE SCORE BACKFILL
                // Check if user has already played today (or other days in competition range)
                // and add those scores to the competition
                console.log('🔄 Checking for existing scores to backfill...');

                try {
                    const { data: backfillResult, error: backfillError } = await supabaseClient
                        .rpc('backfill_competition_scores_on_join', {
                            p_competition_id: competitionId,
                            p_user_id: user.id
                        });

                    if (backfillError) {
                        console.error('⚠️ Error backfilling scores:', backfillError);
                        // Don't throw - joining succeeded, backfill is bonus
                    } else if (backfillResult && backfillResult.length > 0) {
                        const { dates_backfilled, total_score_added } = backfillResult[0];
                        if (dates_backfilled > 0) {
                            console.log(`✅ Retroactively added ${dates_backfilled} day(s) of scores (${total_score_added.toFixed(1)} points) to competition!`);
                        } else {
                            console.log('ℹ️ No existing scores to backfill');
                        }
                    }
                } catch (backfillError) {
                    console.error('⚠️ Backfill error (non-fatal):', backfillError);
                    // Continue - user successfully joined, backfill is a bonus feature
                }
            }

            this.closeJoinModal();
            this.showJoinSuccess(competitionId);

            // Track competition invitation accepted event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'competition_invitation_accepted', {
                    competition_id: competitionId,
                    user_id: user.id,
                    event_category: 'competition',
                    event_label: 'joined_via_invite'
                });
                console.log('📊 GA4: Tracked competition_invitation_accepted event');
            }

        } catch (error) {
            console.error('Error joining competition:', error);
            alert('Failed to join competition. Please try again.');

            if (joinBtn) {
                joinBtn.disabled = false;
                joinBtn.textContent = '🎉 Join Competition';
            }
        }
    }

    // Show join success message
    showJoinSuccess(competitionId) {
        const modal = document.createElement('div');
        modal.className = 'join-success-modal competition-modal';
        modal.innerHTML = `
            <div class="competition-modal-content">
                <div class="success-header">
                    <h3>🎉 Successfully Joined!</h3>
                </div>
                <div class="competition-modal-body">
                    <div class="success-message">
                        <p>You've successfully joined the competition!</p>
                        <div class="success-info">
                            <div class="info-item">
                                <span class="info-icon">🎯</span>
                                <span>Start playing daily puzzles to earn points</span>
                            </div>
                            <div class="info-item">
                                <span class="info-icon">📊</span>
                                <span>Check the leaderboard to see your progress</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="success-actions">
                        <button class="close-btn" onclick="window.CompetitionInviteSystem.closeJoinSuccessModal()">
                            Start Playing
                        </button>
                        <button class="view-leaderboard-btn" onclick="window.CompetitionInviteSystem.viewCompetitionFromSuccess('${competitionId}')">
                            View Leaderboard
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // CRITICAL FIX: Force modal to be MUCH TALLER on small phones
        if (window.innerWidth <= 430) {
            modal.style.setProperty('align-items', 'flex-start', 'important');
            modal.style.setProperty('padding-top', '10px', 'important');

            const content = modal.querySelector('.competition-modal-content');
            if (content) {
                content.style.setProperty('max-height', '95vh', 'important');
                content.style.setProperty('min-height', '500px', 'important');
                content.style.setProperty('width', '92%', 'important');
            }

            const body = modal.querySelector('.competition-modal-body');
            if (body) {
                body.style.setProperty('overflow-y', 'visible', 'important');
                body.style.setProperty('flex', '1', 'important');
            }
        }

        // Trigger celebration effect
        this.triggerCelebration();
    }

    // Show already joined message
    showAlreadyJoinedMessage(competition) {
        const modal = document.createElement('div');
        modal.className = 'already-joined-modal competition-modal';
        modal.innerHTML = `
            <div class="competition-modal-content">
                <div class="competition-modal-header">
                    <h2>Already Joined</h2>
                    <button class="competition-modal-close" onclick="this.closest('.already-joined-modal').remove(); document.body.classList.remove('modal-open')">&times;</button>
                </div>
                <div class="competition-modal-body">
                    <div class="already-joined-message">
                        <h3>🏆 ${this.escapeHtml(competition.name.toUpperCase())}</h3>
                        <p>You're already participating in this competition!</p>
                        
                        <div class="already-joined-actions">
                            <button class="close-btn" onclick="this.closest('.already-joined-modal').remove(); document.body.classList.remove('modal-open')">
                                Continue Playing
                            </button>
                            <button class="view-leaderboard-btn" onclick="window.CompetitionInviteSystem.viewCompetitionFromExisting('${competition.id}')">
                                View Leaderboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');

        // CRITICAL FIX: Force modal to be MUCH TALLER on small phones
        if (window.innerWidth <= 430) {
            modal.style.setProperty('align-items', 'flex-start', 'important');
            modal.style.setProperty('padding-top', '10px', 'important');

            const content = modal.querySelector('.competition-modal-content');
            if (content) {
                content.style.setProperty('max-height', '95vh', 'important');
                content.style.setProperty('min-height', '500px', 'important');
                content.style.setProperty('width', '92%', 'important');
            }

            const body = modal.querySelector('.competition-modal-body');
            if (body) {
                body.style.setProperty('overflow-y', 'visible', 'important');
                body.style.setProperty('flex', '1', 'important');
            }
        }
    }

    // Show invite error
    showInviteError(message) {
        const modal = document.createElement('div');
        modal.className = 'invite-error-modal competition-modal';
        modal.innerHTML = `
            <div class="competition-modal-content">
                <div class="competition-modal-header">
                    <h2>Invitation Error</h2>
                    <button class="competition-modal-close" onclick="this.closest('.invite-error-modal').remove(); document.body.classList.remove('modal-open')">&times;</button>
                </div>
                <div class="competition-modal-body">
                    <div class="error-message">
                        <div class="error-icon">⚠️</div>
                        <p>${message}</p>
                        <div class="error-suggestions">
                            <h4>What you can do:</h4>
                            <ul>
                                <li>Check that the link is complete and correct</li>
                                <li>Ask the creator to send a new invite link</li>
                                <li>Create your own competition to play with friends</li>
                            </ul>
                        </div>
                        <div class="error-actions">
                            <button class="close-btn" onclick="this.closest('.invite-error-modal').remove(); document.body.classList.remove('modal-open')">
                                Close
                            </button>
                            <button class="create-btn" onclick="window.CustomCompetitionManager.openCreateModal(); this.closest('.invite-error-modal').remove(); document.body.classList.remove('modal-open')">
                                Create Competition
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');

        // CRITICAL FIX: Force modal to be MUCH TALLER on small phones
        if (window.innerWidth <= 430) {
            modal.style.setProperty('align-items', 'flex-start', 'important');
            modal.style.setProperty('padding-top', '10px', 'important');

            const content = modal.querySelector('.competition-modal-content');
            if (content) {
                content.style.setProperty('max-height', '95vh', 'important');
                content.style.setProperty('min-height', '500px', 'important');
                content.style.setProperty('width', '92%', 'important');
            }

            const body = modal.querySelector('.competition-modal-body');
            if (body) {
                body.style.setProperty('overflow-y', 'visible', 'important');
                body.style.setProperty('flex', '1', 'important');
            }
        }
    }

    // Trigger celebration effect
    triggerCelebration() {
        // Create confetti effect
        const colors = ['#FFD700', '#4CAF50', '#6496ff', '#FF6B35'];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 8px;
                height: 8px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}vw;
                top: -10px;
                z-index: 10005;
                border-radius: 50%;
                animation: confettiFall ${2 + Math.random() * 3}s linear forwards;
                pointer-events: none;
            `;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, 5000);
        }
    }

    // Modal management functions
    closeJoinModal() {
        const modal = document.querySelector('.join-competition-modal');
        if (modal) {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
    }

    closeJoinSuccessModal() {
        const modal = document.querySelector('.join-success-modal');
        if (modal) {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
    }

    viewCompetitionFromSuccess(competitionId) {
        this.closeJoinSuccessModal();
        if (window.CustomLeaderboardUI) {
            window.CustomLeaderboardUI.open(competitionId);
        }
    }

    viewCompetitionFromExisting(competitionId) {
        const modal = document.querySelector('.already-joined-modal');
        if (modal) {
            modal.remove();
            document.body.classList.remove('modal-open');
        }
        
        if (window.CustomLeaderboardUI) {
            window.CustomLeaderboardUI.open(competitionId);
        }
    }

    // Handle authentication state changes to process pending invites
    onAuthStateChange(isLoggedIn) {
        if (isLoggedIn) {
            const pendingInvite = localStorage.getItem('pendingInviteCode');
            if (pendingInvite) {
                localStorage.removeItem('pendingInviteCode');
                setTimeout(() => {
                    this.processInviteCode(pendingInvite);
                }, 1000); // Give time for UI to settle
            }
        }
    }

    // Utility function to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Check if system is ready
    isReady() {
        return this.isInitialized;
    }
}

// Create singleton instance
const competitionInviteSystem = new CompetitionInviteSystem();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CompetitionInviteSystem = competitionInviteSystem;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => competitionInviteSystem.initialize());
    } else {
        competitionInviteSystem.initialize();
    }

    // Listen for auth state changes
    document.addEventListener('authStateChanged', (e) => {
        competitionInviteSystem.onAuthStateChange(e.detail?.isLoggedIn);
    });
}

// Add confetti animation CSS
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confettiFall {
        0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(confettiStyle);

// Global confetti animation function that can be called from anywhere
window.triggerConfettiAnimation = function() {
    const colors = ['#FFD700', '#4CAF50', '#6496ff', '#FF6B35'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 8px;
            height: 8px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}vw;
            top: -10px;
            z-index: 10005;
            border-radius: 50%;
            animation: confettiFall ${2 + Math.random() * 3}s linear forwards;
            pointer-events: none;
        `;

        document.body.appendChild(confetti);

        setTimeout(() => {
            if (confetti.parentNode) {
                confetti.parentNode.removeChild(confetti);
            }
        }, 5000);
    }
};