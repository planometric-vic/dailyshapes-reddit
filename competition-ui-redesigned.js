/**
 * Daily Shapes v4.0 - Redesigned Competition UI
 * Contained modal with improved UX flow
 */

class CompetitionUI {
    constructor() {
        this.currentView = 'main'; // 'main', 'create', 'myCompetitions'
        this.selectedCompetition = null;
        this.isVisible = false;
    }

    /**
     * Initialize competition UI
     */
    initialize() {
        console.log('🎨 Initializing Redesigned Competition UI...');
        this.createStyles();
        this.setupEventListeners();
        console.log('✅ Competition UI initialized');
    }

    /**
     * Create contained modal styles
     */
    createStyles() {
        const styles = `
            /* Modal Overlay */
            .competition-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
                z-index: 10000;
                display: none;
                justify-content: center;
                align-items: center;
                padding: 20px;
                box-sizing: border-box;
            }

            /* Modal Container */
            .competition-modal {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 600px;
                width: 100%;
                max-height: 80vh;
                overflow-y: visible;
                position: relative;
                animation: modalSlideIn 0.3s ease-out;
            }

            @keyframes modalSlideIn {
                from {
                    transform: translateY(-50px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            /* Modal Header */
            .competition-modal-header {
                padding: 25px 30px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .competition-modal-title {
                color: white;
                font-size: 24px;
                font-weight: bold;
                margin: 0;
            }

            .competition-close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 28px;
                cursor: pointer;
                padding: 5px;
                border-radius: 50%;
                transition: background-color 0.2s;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .competition-close-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            /* Modal Content */
            .competition-modal-content {
                padding: 30px;
                color: white;
            }

            /* Main View Buttons */
            .competition-main-buttons {
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-bottom: 30px;
            }

            .competition-primary-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 18px 25px;
                border-radius: 15px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                min-height: 60px;
            }

            .competition-primary-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            }

            .competition-primary-btn .btn-icon {
                font-size: 24px;
            }

            .competition-primary-btn .btn-text {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            }

            .btn-subtitle {
                font-size: 14px;
                opacity: 0.8;
                font-weight: normal;
            }

            /* Empty State */
            .competition-empty-state {
                text-align: center;
                padding: 40px 20px;
            }

            .empty-state-icon {
                font-size: 64px;
                margin-bottom: 20px;
                opacity: 0.7;
            }

            .empty-state-title {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 15px;
            }

            .empty-state-text {
                font-size: 16px;
                line-height: 1.5;
                opacity: 0.9;
                margin-bottom: 25px;
            }

            /* Competition List */
            .competition-list {
                display: flex;
                flex-direction: column;
                gap: 15px;
                margin-bottom: 20px;
            }

            .competition-card {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 15px;
                padding: 20px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: all 0.3s ease;
            }

            .competition-card:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
            }

            .competition-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .competition-name {
                font-size: 18px;
                font-weight: bold;
                margin: 0;
            }

            .competition-status {
                background: rgba(255, 255, 255, 0.2);
                padding: 5px 12px;
                border-radius: 15px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }

            .competition-description {
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 15px;
                line-height: 1.4;
            }

            .competition-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                opacity: 0.8;
            }

            /* Invitations */
            .invitation-card {
                background: rgba(255, 215, 0, 0.2);
                border: 2px solid rgba(255, 215, 0, 0.4);
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 15px;
            }

            .invitation-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }

            .invitation-icon {
                font-size: 20px;
            }

            .invitation-title {
                font-size: 16px;
                font-weight: bold;
                color: #FFD700;
            }

            .invitation-actions {
                display: flex;
                gap: 10px;
                margin-top: 15px;
            }

            .accept-btn, .decline-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 10px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .accept-btn {
                background: #4CAF50;
                color: white;
            }

            .accept-btn:hover {
                background: #45a049;
            }

            .decline-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }

            .decline-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            /* Back Button */
            .back-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 14px;
                margin-bottom: 20px;
                transition: all 0.2s ease;
            }

            .back-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            /* Loading State */
            .competition-loading {
                text-align: center;
                padding: 40px;
            }

            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top: 3px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* Responsive Design */
            @media (max-width: 640px) {
                .competition-modal {
                    max-width: 95%;
                    margin: 10px;
                    max-height: 90vh;
                }
                
                .competition-modal-content {
                    padding: 20px;
                }
                
                .competition-primary-btn {
                    padding: 15px 20px;
                    font-size: 15px;
                }
            }
        `;

        // Add styles to head
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.close();
            }
        });

        // Close on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('competition-modal-overlay')) {
                this.close();
            }
        });
    }

    /**
     * Show the main competition modal
     */
    async show() {
        console.log('🏆 Opening competition modal...');
        
        // Check if user is logged in
        if (!window.AuthService || !window.AuthService.isLoggedIn()) {
            this.showAuthPrompt();
            return;
        }

        // Create modal if it doesn't exist
        let overlay = document.getElementById('competition-modal-overlay');
        if (!overlay) {
            overlay = this.createModal();
        }

        // Show modal
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this.isVisible = true;

        // Load initial content
        await this.showMainView();
    }

    /**
     * Close the modal
     */
    close() {
        const overlay = document.getElementById('competition-modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        document.body.style.overflow = 'auto';
        this.isVisible = false;
        this.currentView = 'main';
    }

    /**
     * Create the modal structure
     */
    createModal() {
        const overlay = document.createElement('div');
        overlay.id = 'competition-modal-overlay';
        overlay.className = 'competition-modal-overlay';

        overlay.innerHTML = `
            <div class="competition-modal">
                <div class="competition-modal-header">
                    <h2 class="competition-modal-title" id="competition-modal-title">Competitions</h2>
                    <button class="competition-close-btn" onclick="window.CompetitionUI.close()">×</button>
                </div>
                <div class="competition-modal-content" id="competition-modal-content" style="max-height: 450px !important;">
                    <!-- Content will be dynamically loaded -->
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // FORCE max-height for small screens
        const modalContent = overlay.querySelector('.competition-modal-content');
        if (modalContent && window.innerHeight <= 580) {
            modalContent.style.maxHeight = '450px';
            modalContent.style.setProperty('max-height', '450px', 'important');
        }

        return overlay;
    }

    /**
     * Show authentication prompt
     */
    showAuthPrompt() {
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'block';
            const authMessage = authModal.querySelector('.auth-message');
            if (authMessage) {
                authMessage.textContent = 'Sign in to create and join competitions with friends!';
            }
        }
    }

    /**
     * Show main view with two primary buttons
     */
    async showMainView() {
        const title = document.getElementById('competition-modal-title');
        const content = document.getElementById('competition-modal-content');
        
        if (title) title.textContent = 'Competitions';
        
        // Show loading while fetching data
        content.innerHTML = `
            <div class="competition-loading">
                <div class="loading-spinner"></div>
                <div>Loading your competitions...</div>
            </div>
        `;

        try {
            // Load user's competition data
            await window.CompetitionManager.loadUserCompetitions();
            
            const userCompetitions = window.CompetitionManager.getActiveCompetitions() || [];
            const invitations = await this.getUserInvitations();
            
            let html = '';

            // Show invitations if any
            if (invitations && invitations.length > 0) {
                html += `<div class="invitation-section">`;
                invitations.forEach(invitation => {
                    html += `
                        <div class="invitation-card">
                            <div class="invitation-header">
                                <span class="invitation-icon">📨</span>
                                <span class="invitation-title">Competition Invitation</span>
                            </div>
                            <div class="competition-name">${invitation.name}</div>
                            <div class="competition-description">${invitation.description || 'Join this competition!'}</div>
                            <div class="invitation-actions">
                                <button class="accept-btn" onclick="window.CompetitionUI.acceptInvitation('${invitation.invite_code}')">
                                    Accept
                                </button>
                                <button class="decline-btn" onclick="window.CompetitionUI.declineInvitation('${invitation.id}')">
                                    Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            // Main action buttons
            html += `
                <div class="competition-main-buttons">
                    <button class="competition-primary-btn" onclick="window.CompetitionUI.showMyCompetitions()">
                        <div class="btn-icon">🏆</div>
                        <div class="btn-text">
                            <div>My Competitions</div>
                            <div class="btn-subtitle">${userCompetitions.length} active</div>
                        </div>
                    </button>
                    
                    <button class="competition-primary-btn" onclick="window.CompetitionUI.showCreateCompetition()">
                        <div class="btn-icon">➕</div>
                        <div class="btn-text">
                            <div>Create Competition</div>
                            <div class="btn-subtitle">Start a new competition</div>
                        </div>
                    </button>
                </div>
            `;

            // Show empty state message if no competitions and no invitations
            if (userCompetitions.length === 0 && (!invitations || invitations.length === 0)) {
                html += `
                    <div class="competition-empty-state">
                        <div class="empty-state-icon">🎮</div>
                        <div class="empty-state-title">No Competitions Yet</div>
                        <div class="empty-state-text">
                            Looks like you're not currently part of any competitions. 
                            Try setting one up and inviting your mates!
                        </div>
                        <button class="competition-primary-btn" onclick="window.CompetitionUI.showCreateCompetition()">
                            <div class="btn-icon">🚀</div>
                            <div class="btn-text">
                                <div>Set Up Your First Competition</div>
                            </div>
                        </button>
                    </div>
                `;
            }

            content.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading competitions:', error);
            content.innerHTML = `
                <div class="competition-empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Error Loading Competitions</div>
                    <div class="empty-state-text">
                        Unable to load your competitions. Please try again.
                    </div>
                    <button class="competition-primary-btn" onclick="window.CompetitionUI.show()">
                        <div class="btn-text">Retry</div>
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show My Competitions view
     */
    async showMyCompetitions() {
        const title = document.getElementById('competition-modal-title');
        const content = document.getElementById('competition-modal-content');
        
        if (title) title.textContent = 'My Competitions';
        this.currentView = 'myCompetitions';

        content.innerHTML = `
            <button class="back-btn" onclick="window.CompetitionUI.showMainView()">← Back</button>
            <div class="competition-loading">
                <div class="loading-spinner"></div>
                <div>Loading your competitions...</div>
            </div>
        `;

        try {
            const userCompetitions = window.CompetitionManager.getActiveCompetitions() || [];
            
            let html = `<button class="back-btn" onclick="window.CompetitionUI.showMainView()">← Back</button>`;
            
            if (userCompetitions.length === 0) {
                html += `
                    <div class="competition-empty-state">
                        <div class="empty-state-icon">🏁</div>
                        <div class="empty-state-title">No Active Competitions</div>
                        <div class="empty-state-text">
                            You're not currently participating in any competitions.
                        </div>
                    </div>
                `;
            } else {
                html += '<div class="competition-list">';
                
                for (const comp of userCompetitions) {
                    const competition = comp.competitions;
                    if (!competition) continue;
                    
                    const isActive = new Date() <= new Date(competition.end_date);
                    const statusText = isActive ? 'Active' : 'Ended';
                    const statusClass = isActive ? 'active' : 'ended';
                    
                    html += `
                        <div class="competition-card" onclick="window.CompetitionUI.viewCompetition('${competition.id}')">
                            <div class="competition-card-header">
                                <h3 class="competition-name">${competition.name.toUpperCase()}</h3>
                                <span class="competition-status ${statusClass}">${statusText}</span>
                            </div>
                            <div class="competition-description">${competition.description || 'No description'}</div>
                            <div class="competition-meta">
                                <span>Your Score: ${(comp.total_score || 0).toFixed(1)}</span>
                                <span>Days Played: ${comp.days_played || 0}</span>
                            </div>
                        </div>
                    `;
                }
                
                html += '</div>';
            }

            content.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading user competitions:', error);
            content.innerHTML = `
                <button class="back-btn" onclick="window.CompetitionUI.showMainView()">← Back</button>
                <div class="competition-empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Error Loading</div>
                    <div class="empty-state-text">Unable to load your competitions.</div>
                </div>
            `;
        }
    }

    /**
     * Show Create Competition view
     */
    showCreateCompetition() {
        const title = document.getElementById('competition-modal-title');
        const content = document.getElementById('competition-modal-content');
        
        if (title) title.textContent = 'Create Competition';
        this.currentView = 'create';

        content.innerHTML = `
            <button class="back-btn" onclick="window.CompetitionUI.showMainView()">← Back</button>
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🚧</div>
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 15px;">Coming Soon!</div>
                <div style="opacity: 0.9; line-height: 1.5;">
                    The competition builder is being developed. 
                    <br>For now, competitions can be created through the admin panel.
                </div>
            </div>
        `;
    }

    /**
     * Get user invitations (placeholder for now)
     */
    async getUserInvitations() {
        try {
            // TODO: Implement actual invitation fetching from database
            // For now, return empty array
            return [];
        } catch (error) {
            console.error('Error fetching invitations:', error);
            return [];
        }
    }

    /**
     * Accept invitation
     */
    async acceptInvitation(inviteCode) {
        try {
            console.log('Accepting invitation:', inviteCode);
            const result = await window.CompetitionManager.joinByInviteCode(inviteCode);
            
            if (result.success) {
                // Refresh the main view
                await this.showMainView();
            }
        } catch (error) {
            console.error('Error accepting invitation:', error);
            this.showErrorPopup('Failed to join competition: ' + error.message);
        }
    }

    /**
     * Decline invitation
     */
    async declineInvitation(invitationId) {
        try {
            console.log('Declining invitation:', invitationId);
            // TODO: Implement invitation declining
            await this.showMainView();
        } catch (error) {
            console.error('Error declining invitation:', error);
        }
    }

    /**
     * View competition details
     */
    viewCompetition(competitionId) {
        console.log('Viewing competition:', competitionId);
        // TODO: Implement competition detail view
    }

    /**
     * Show error message as small inline text without layout shifts
     */
    showErrorPopup(message) {
        // Use the main competition UI's inline error system
        if (window.CompetitionUI && window.CompetitionUI.showErrorPopup) {
            window.CompetitionUI.showErrorPopup(message);
        } else {
            // Fallback - just log to console
            console.error('Competition error:', message);
        }
    }
}

// Create singleton instance
const competitionUI = new CompetitionUI();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CompetitionUI = competitionUI;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        competitionUI.initialize();
    });
} else {
    competitionUI.initialize();
}

console.log('✨ Redesigned Competition UI loaded successfully');