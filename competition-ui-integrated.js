/**
 * Daily Shapes v4.0 - Integrated Competition UI
 * Uses the main canvas area as an expandable competition interface
 */

class IntegratedCompetitionUI {
    constructor() {
        this.isExpanded = false;
        this.currentView = 'main'; // 'main', 'myCompetitions', 'createCompetition'
        this.originalCanvasStyle = null;
        this.competitionContent = null;
        this.transitionDuration = 500; // ms
    }

    /**
     * Initialize the integrated competition UI
     */
    initialize() {
        console.log('🎨 Initializing Integrated Competition UI...');
        this.createStyles();
        this.setupEventListeners();
        console.log('✅ Integrated Competition UI initialized');
    }

    /**
     * Create neobrutalist styles for competition interface
     */
    createStyles() {
        const styles = `
            /* Competition Canvas Overlay */
            .competition-canvas-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                /* Styling will be copied from actual canvas before showing */
                display: none;
                z-index: 100;
                overflow: hidden;
                transition: height 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            }

            .competition-canvas-overlay.expanded {
                /* Keep exact same position and width as original canvas */
                position: absolute;
                top: 0; /* Top stays exactly where original canvas top is */
                left: 0; /* Left stays exactly where original canvas left is */
                width: 100%; /* Same width as original canvas */
                height: calc(100vh - var(--canvas-top-offset, 120px)); /* Extend height downward */
                /* Copy exact styling from original canvas */
                background: #f0f0f0;
                border: 4px solid #000000;
                box-shadow: 4px 4px 0px #000000;
                border-radius: 0;
                overflow-y: visible;
                z-index: 100;
            }

            /* Main Competition Buttons (shown in collapsed state) */
            .competition-main-buttons {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                display: flex;
                flex-direction: column;
                gap: 20px;
                z-index: 101;
            }

            .competition-btn {
                background: #ffffff;
                border: 4px solid #000000;
                box-shadow: 4px 4px 0px #000000;
                padding: 20px 40px;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 250px;
                text-align: center;
                position: relative;
            }

            .competition-btn:hover {
                transform: translate(-2px, -2px);
                box-shadow: 6px 6px 0px #000000;
            }

            .competition-btn:active {
                transform: translate(2px, 2px);
                box-shadow: 2px 2px 0px #000000;
            }

            .competition-btn.primary {
                background: #4ECDC4;
            }

            .competition-btn.secondary {
                background: #E0E0E0;
                color: #333;
            }

            /* Competition Content Area */
            .competition-content {
                padding: 30px;
                height: 100%;
                overflow-y: visible;
                display: none;
            }

            .competition-content.active {
                display: block;
            }

            /* Back Button */
            .competition-back-btn {
                background: #ffffff;
                border: 3px solid #000000;
                box-shadow: 3px 3px 0px #000000;
                padding: 10px 20px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                margin-bottom: 20px;
                transition: all 0.2s ease;
            }

            .competition-back-btn:hover {
                transform: translate(-1px, -1px);
                box-shadow: 4px 4px 0px #000000;
            }

            /* Competition List */
            .competition-list {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .competition-card {
                background: #ffffff;
                border: 3px solid #000000;
                box-shadow: 3px 3px 0px #000000;
                padding: 20px;
                transition: all 0.2s ease;
                cursor: pointer;
            }

            .competition-card:hover {
                transform: translate(-2px, -2px);
                box-shadow: 5px 5px 0px #000000;
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
                background: #4ECDC4;
                border: 2px solid #000000;
                padding: 5px 10px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }

            .competition-status.ended {
                background: #FF6B6B;
            }

            .competition-description {
                font-size: 14px;
                margin-bottom: 15px;
                line-height: 1.4;
                color: #333;
            }

            .competition-meta {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-weight: bold;
                color: #666;
            }

            /* Empty State */
            .competition-empty-state {
                text-align: center;
                padding: 60px 20px;
            }

            .empty-state-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }

            .empty-state-title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 15px;
            }

            .empty-state-text {
                font-size: 16px;
                line-height: 1.5;
                color: #666;
                margin-bottom: 30px;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
            }

            .empty-state-btn {
                background: #4ECDC4;
                border: 4px solid #000000;
                box-shadow: 4px 4px 0px #000000;
                padding: 15px 30px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .empty-state-btn:hover {
                transform: translate(-2px, -2px);
                box-shadow: 6px 6px 0px #000000;
            }

            /* Invitations */
            .invitation-section {
                margin-bottom: 30px;
            }

            .invitation-card {
                background: #FFE66D;
                border: 3px solid #000000;
                box-shadow: 3px 3px 0px #000000;
                padding: 20px;
                margin-bottom: 15px;
                border-left: 8px solid #FF6B6B;
            }

            .invitation-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }

            .invitation-title {
                font-size: 16px;
                font-weight: bold;
            }

            .invitation-actions {
                display: flex;
                gap: 10px;
                margin-top: 15px;
            }

            .accept-btn, .decline-btn {
                padding: 10px 20px;
                border: 2px solid #000000;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .accept-btn {
                background: #4ECDC4;
                box-shadow: 2px 2px 0px #000000;
            }

            .accept-btn:hover {
                transform: translate(-1px, -1px);
                box-shadow: 3px 3px 0px #000000;
            }

            .decline-btn {
                background: #ffffff;
                box-shadow: 2px 2px 0px #000000;
            }

            .decline-btn:hover {
                transform: translate(-1px, -1px);
                box-shadow: 3px 3px 0px #000000;
            }

            /* Loading State */
            .competition-loading {
                text-align: center;
                padding: 40px;
            }

            .loading-text {
                font-size: 18px;
                font-weight: bold;
                margin-top: 20px;
            }

            .loading-dots {
                display: inline-block;
                position: relative;
                width: 80px;
                height: 80px;
                margin: 0 auto;
            }

            .loading-dots div {
                position: absolute;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #000000;
                animation: loading-bounce 1.2s infinite ease-in-out both;
            }

            .loading-dots div:nth-child(1) { top: 8px; left: 8px; animation-delay: -0.36s; }
            .loading-dots div:nth-child(2) { top: 8px; left: 32px; animation-delay: -0.24s; }
            .loading-dots div:nth-child(3) { top: 8px; left: 56px; animation-delay: -0.12s; }
            .loading-dots div:nth-child(4) { top: 32px; left: 8px; animation-delay: 0s; }

            @keyframes loading-bounce {
                0%, 80%, 100% {
                    transform: scale(0);
                }
                40% {
                    transform: scale(1);
                }
            }

            /* Create Competition Form */
            .create-competition-form {
                max-width: 500px;
                margin: 0 auto;
            }

            .form-group {
                margin-bottom: 20px;
            }

            .form-label {
                display: block;
                font-weight: bold;
                margin-bottom: 8px;
                font-size: 16px;
            }

            .form-input, .form-textarea {
                width: 100%;
                padding: 12px;
                border: 3px solid #000000;
                box-shadow: 2px 2px 0px #000000;
                font-size: 14px;
                background: #ffffff;
                box-sizing: border-box;
            }

            .form-input:focus, .form-textarea:focus {
                outline: none;
                box-shadow: 3px 3px 0px #000000;
                transform: translate(-1px, -1px);
            }

            .form-textarea {
                height: 80px;
                resize: vertical;
            }

            .form-submit {
                background: #4ECDC4;
                border: 4px solid #000000;
                box-shadow: 4px 4px 0px #000000;
                padding: 15px 30px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                width: 100%;
                transition: all 0.2s ease;
            }

            .form-submit:hover {
                transform: translate(-2px, -2px);
                box-shadow: 6px 6px 0px #000000;
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .competition-canvas-overlay.expanded {
                    width: 95vw;
                    top: 100px;
                    height: calc(100vh - 120px);
                }

                .competition-btn {
                    min-width: 200px;
                    padding: 15px 30px;
                    font-size: 16px;
                }

                .competition-content {
                    padding: 20px;
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
            if (e.key === 'Escape' && this.isExpanded) {
                this.collapse();
            }
        });
    }

    /**
     * Show the competition interface
     */
    async show() {
        console.log('🏆 Opening integrated competition interface...');

        // Check if user is logged in
        if (!window.AuthService || !window.AuthService.isLoggedIn()) {
            this.showAuthPrompt();
            return;
        }

        // Get the main canvas
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            console.error('❌ Canvas not found');
            return;
        }

        // Create or get the competition overlay
        let overlay = document.getElementById('competition-canvas-overlay');
        if (!overlay) {
            overlay = this.createOverlay();
            canvas.parentNode.appendChild(overlay);
        }

        // Store original canvas style
        this.storeOriginalCanvasStyle(canvas);

        // Copy exact canvas styling to overlay before showing
        this.copyCanvasStyleToOverlay(canvas, overlay);
        
        // Show overlay in collapsed state first
        overlay.style.display = 'block';
        
        // Add main buttons
        this.showMainButtons();

        // Deactivate the canvas
        this.deactivateCanvas(canvas);
    }

    /**
     * Create the competition overlay
     */
    createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'competition-canvas-overlay';
        overlay.className = 'competition-canvas-overlay';
        
        overlay.innerHTML = `
            <div class="competition-main-buttons" id="competition-main-buttons">
                <button class="competition-btn primary" onclick="window.IntegratedCompetitionUI.showMyCompetitions()">
                    🏆 My Competitions
                </button>
                <button class="competition-btn secondary" onclick="window.IntegratedCompetitionUI.showCreateCompetition()">
                    ➕ Create Competition
                </button>
                <div style="margin: 15px 20px 0 20px; padding: 15px; background: white; border: 2px solid #000; border-radius: 8px; text-align: left; font-size: 12px; line-height: 1.5; color: #000; box-shadow: 2px 2px 0px #000;">
                    <strong style="color: #000; display: block; margin-bottom: 8px;">How it works:</strong>
                    <ul style="margin: 0; padding-left: 18px; color: #333;">
                        <li style="margin-bottom: 4px;">Create a competition & share the link to invite friends</li>
                        <li style="margin-bottom: 4px;">Your daily score counts for all active competitions</li>
                        <li>Track rankings on the leaderboard</li>
                    </ul>
                </div>
                <button class="competition-btn" onclick="window.IntegratedCompetitionUI.close()" style="background: #FF6B6B; margin-top: 10px; font-size: 14px;">
                    ✕ Close
                </button>
            </div>
            <div class="competition-content" id="competition-content">
                <!-- Dynamic content will be loaded here -->
            </div>
        `;

        return overlay;
    }

    /**
     * Store original canvas styling
     */
    storeOriginalCanvasStyle(canvas) {
        const canvasContainer = canvas.parentNode;
        this.originalCanvasStyle = {
            canvas: {
                width: canvas.style.width || getComputedStyle(canvas).width,
                height: canvas.style.height || getComputedStyle(canvas).height,
                boxShadow: canvas.style.boxShadow || getComputedStyle(canvas).boxShadow
            },
            container: {
                width: canvasContainer.style.width || getComputedStyle(canvasContainer).width,
                height: canvasContainer.style.height || getComputedStyle(canvasContainer).height,
                position: canvasContainer.style.position || getComputedStyle(canvasContainer).position
            }
        };
    }

    /**
     * Copy exact canvas styling to overlay
     */
    copyCanvasStyleToOverlay(canvas, overlay) {
        if (!canvas || !overlay) return;
        
        const canvasStyle = getComputedStyle(canvas);
        
        // Copy all visual properties from canvas
        overlay.style.width = canvasStyle.width;
        overlay.style.height = canvasStyle.height;
        overlay.style.border = canvasStyle.border;
        overlay.style.borderRadius = canvasStyle.borderRadius;
        overlay.style.boxShadow = canvasStyle.boxShadow;
        overlay.style.background = canvasStyle.backgroundColor;
        overlay.style.borderColor = canvasStyle.borderColor;
        overlay.style.borderStyle = canvasStyle.borderStyle;
        overlay.style.borderWidth = canvasStyle.borderWidth;
        
        // Ensure overlay is positioned exactly over canvas
        overlay.style.position = 'absolute';
        overlay.style.top = '0px';
        overlay.style.left = '0px';
        
        console.log('🎨 Copied canvas style to overlay:', {
            width: canvasStyle.width,
            height: canvasStyle.height,
            border: canvasStyle.border,
            boxShadow: canvasStyle.boxShadow
        });
    }

    /**
     * Show main buttons in collapsed state
     */
    showMainButtons() {
        const mainButtons = document.getElementById('competition-main-buttons');
        const content = document.getElementById('competition-content');
        
        if (mainButtons) mainButtons.style.display = 'flex';
        if (content) content.style.display = 'none';
    }

    /**
     * Expand the canvas to full competition view
     */
    expandCanvas() {
        return new Promise((resolve) => {
            const overlay = document.getElementById('competition-canvas-overlay');
            const canvas = document.getElementById('geoCanvas');
            
            if (!overlay || !canvas) {
                resolve();
                return;
            }

            // Hide main buttons
            const mainButtons = document.getElementById('competition-main-buttons');
            if (mainButtons) {
                mainButtons.style.display = 'none';
            }

            // Calculate expansion height based on viewport
            const canvasRect = canvas.getBoundingClientRect();
            const canvasTop = canvasRect.top;
            document.documentElement.style.setProperty('--canvas-top-offset', canvasTop + 'px');
            
            // Add expanded class for smooth transition - this will change height only
            setTimeout(() => {
                overlay.classList.add('expanded');
                
                // Show content after animation
                setTimeout(() => {
                    const content = document.getElementById('competition-content');
                    if (content) {
                        content.style.display = 'block';
                    }
                    this.isExpanded = true;
                    resolve();
                }, this.transitionDuration);
            }, 50); // Small delay to ensure styles are applied
        });
    }

    /**
     * Collapse back to main buttons
     */
    collapse() {
        return new Promise((resolve) => {
            const overlay = document.getElementById('competition-canvas-overlay');
            
            if (!overlay) {
                resolve();
                return;
            }

            // Hide content
            const content = document.getElementById('competition-content');
            if (content) {
                content.style.display = 'none';
            }

            // Remove expanded class
            overlay.classList.remove('expanded');
            
            // Show main buttons after animation
            setTimeout(() => {
                this.showMainButtons();
                this.isExpanded = false;
                this.currentView = 'main';
                resolve();
            }, this.transitionDuration);
        });
    }

    /**
     * Close and restore original canvas
     */
    close() {
        const overlay = document.getElementById('competition-canvas-overlay');
        const canvas = document.getElementById('geoCanvas');
        
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('expanded');
        }

        // Restore original canvas style
        this.restoreCanvasStyle(canvas);
        
        // Reactivate canvas
        this.reactivateCanvas(canvas);

        this.isExpanded = false;
        this.currentView = 'main';
    }

    /**
     * Deactivate the main canvas
     */
    deactivateCanvas(canvas) {
        if (canvas) {
            canvas.style.pointerEvents = 'none';
            canvas.style.filter = 'brightness(0.7)';
        }
    }

    /**
     * Reactivate the main canvas
     */
    reactivateCanvas(canvas) {
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            canvas.style.filter = 'none';
        }
    }

    /**
     * Restore original canvas styling
     */
    restoreCanvasStyle(canvas) {
        if (!canvas || !this.originalCanvasStyle) return;
        
        const canvasContainer = canvas.parentNode;
        
        // Restore canvas styles
        Object.assign(canvas.style, this.originalCanvasStyle.canvas);
        
        // Restore container styles
        Object.assign(canvasContainer.style, this.originalCanvasStyle.container);
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
     * Show My Competitions view
     */
    async showMyCompetitions() {
        await this.expandCanvas();
        
        const content = document.getElementById('competition-content');
        this.currentView = 'myCompetitions';

        // Show loading
        content.innerHTML = `
            <div class="competition-loading">
                <div class="loading-dots">
                    <div></div><div></div><div></div><div></div>
                </div>
                <div class="loading-text">Loading your competitions...</div>
            </div>
        `;

        try {
            // Initialize competition manager if needed
            if (!window.CompetitionManager.isInitialized) {
                await window.CompetitionManager.initialize();
            }
            
            // Load user competitions
            await window.CompetitionManager.loadUserCompetitions();
            const userCompetitions = window.CompetitionManager.getActiveCompetitions() || [];
            const invitations = await this.getUserInvitations();

            let html = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                    <button class="competition-back-btn" onclick="window.IntegratedCompetitionUI.collapse()">
                        ← Back
                    </button>
                    <button class="competition-back-btn" onclick="window.IntegratedCompetitionUI.close()" style="background: #FF6B6B;">
                        ✕ Close
                    </button>
                </div>
            `;

            // Show invitations first
            if (invitations && invitations.length > 0) {
                html += `<div class="invitation-section">`;
                invitations.forEach(invitation => {
                    html += `
                        <div class="invitation-card">
                            <div class="invitation-header">
                                <span>📨</span>
                                <span class="invitation-title">Competition Invitation</span>
                            </div>
                            <div class="competition-name">${invitation.name}</div>
                            <div class="competition-description">${invitation.description || 'Join this competition!'}</div>
                            <div class="invitation-actions">
                                <button class="accept-btn" onclick="window.IntegratedCompetitionUI.acceptInvitation('${invitation.invite_code}')">
                                    Accept
                                </button>
                                <button class="decline-btn" onclick="window.IntegratedCompetitionUI.declineInvitation('${invitation.id}')">
                                    Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            // Show competitions or empty state
            if (userCompetitions.length === 0) {
                html += `
                    <div class="competition-empty-state">
                        <div class="empty-state-icon">🏁</div>
                        <div class="empty-state-title">No Active Competitions</div>
                        <div class="empty-state-text">
                            You're not currently participating in any competitions. 
                            Create one and invite your friends!
                        </div>
                        <button class="empty-state-btn" onclick="window.IntegratedCompetitionUI.showCreateCompetition()">
                            Create Your First Competition
                        </button>
                    </div>
                `;
            } else {
                html += '<div class="competition-list">';
                
                userCompetitions.forEach(comp => {
                    const competition = comp.competitions;
                    if (!competition) return;
                    
                    const isActive = new Date() <= new Date(competition.end_date);
                    const statusText = isActive ? 'Active' : 'Ended';
                    const statusClass = isActive ? '' : 'ended';
                    
                    html += `
                        <div class="competition-card">
                            <div class="competition-card-header">
                                <h3 class="competition-name">${competition.name.toUpperCase()}</h3>
                                <span class="competition-status ${statusClass}">${statusText}</span>
                            </div>
                            <div class="competition-description">${competition.description || 'No description provided'}</div>
                            <div class="competition-meta">
                                <span>Your Score: ${(comp.total_score || 0).toFixed(1)}</span>
                                <span>Days Played: ${comp.days_played || 0}</span>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
            }

            content.innerHTML = html;

        } catch (error) {
            console.error('Error loading competitions:', error);
            content.innerHTML = `
                <button class="competition-back-btn" onclick="window.IntegratedCompetitionUI.collapse()">
                    ← Back
                </button>
                <div class="competition-empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Error Loading</div>
                    <div class="empty-state-text">Unable to load your competitions. Please try again.</div>
                    <button class="empty-state-btn" onclick="window.IntegratedCompetitionUI.showMyCompetitions()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show Create Competition view
     */
    async showCreateCompetition() {
        await this.expandCanvas();
        
        const content = document.getElementById('competition-content');
        this.currentView = 'createCompetition';

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                <button class="competition-back-btn" onclick="window.IntegratedCompetitionUI.collapse()">
                    ← Back
                </button>
                <button class="competition-back-btn" onclick="window.IntegratedCompetitionUI.close()" style="background: #FF6B6B;">
                    ✕ Close
                </button>
            </div>
            
            <div class="create-competition-form">
                <div class="competition-empty-state">
                    <div class="empty-state-icon">🚧</div>
                    <div class="empty-state-title">Coming Soon!</div>
                    <div class="empty-state-text">
                        The competition builder is being developed. 
                        For now, you can join competitions using invite codes.
                    </div>
                    
                    <div class="form-group" style="margin-top: 30px;">
                        <label class="form-label">Join with Invite Code:</label>
                        <input type="text" class="form-input" id="invite-code-input" placeholder="Enter 6-character code" maxlength="6" style="text-transform: uppercase;">
                    </div>
                    
                    <button class="form-submit" onclick="window.IntegratedCompetitionUI.joinByCode()">
                        Join Competition
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Join competition by invite code
     */
    async joinByCode() {
        const input = document.getElementById('invite-code-input');
        const code = input?.value?.trim().toUpperCase();
        
        if (!code || code.length !== 6) {
            this.showErrorPopup('Please enter a valid 6-character invite code');
            return;
        }

        try {
            const result = await window.CompetitionManager.joinByInviteCode(code);
            if (result.success) {
                // Show success message (could also be converted to a success popup later)
                alert(`Successfully joined: ${result.competition.name}!`);
                await this.showMyCompetitions();
            }
        } catch (error) {
            console.error('Error joining competition:', error);
            this.showErrorPopup('Failed to join competition: ' + error.message);
        }
    }

    /**
     * Get user invitations (placeholder)
     */
    async getUserInvitations() {
        // TODO: Implement invitation fetching
        return [];
    }

    /**
     * Accept invitation
     */
    async acceptInvitation(inviteCode) {
        try {
            const result = await window.CompetitionManager.joinByInviteCode(inviteCode);
            if (result.success) {
                await this.showMyCompetitions();
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
        // TODO: Implement invitation declining
        await this.showMyCompetitions();
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
const integratedCompetitionUI = new IntegratedCompetitionUI();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.IntegratedCompetitionUI = integratedCompetitionUI;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        integratedCompetitionUI.initialize();
    });
} else {
    integratedCompetitionUI.initialize();
}

console.log('✨ Integrated Competition UI loaded successfully');