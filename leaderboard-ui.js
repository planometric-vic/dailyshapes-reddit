// Leaderboard UI Component for Daily Shapes v4.0
// Handles global competition interface, real-time updates, and user interactions

class LeaderboardUI {
    constructor() {
        this.isVisible = false;
        this.currentPage = 1;
        this.pageSize = 100; // Show top 100 players
        this.leaderboardData = [];
        this.userRank = null;
        this.isLoading = false;
        this.refreshInterval = null;
        this.totalParticipants = 0;
    }

    // Initialize leaderboard UI
    initialize() {
        console.log('📊 Initializing Leaderboard UI...');
        this.createLeaderboardModal();
        this.setupEventListeners();
        console.log('✅ Leaderboard UI initialized');
    }

    // Create leaderboard modal HTML
    createLeaderboardModal() {
        const modal = document.createElement('div');
        modal.id = 'leaderboardModal';
        modal.className = 'leaderboard-modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="leaderboard-modal-content">
                <div class="leaderboard-header">
                    <h2 id="leaderboardTitle" style="${window.innerWidth >= 1200 ? 'font-size: 28px !important; line-height: 1.2 !important;' : 'font-size: 24px !important; line-height: 1.2 !important;'}">Global Leaderboard</h2>
                    <button class="leaderboard-close" onclick="window.LeaderboardUI.close()">&times;</button>
                </div>
                
                <div class="leaderboard-stats">
                    <div class="stats-left">
                        <span id="participantCount">Loading players...</span>
                        <span id="daysRemaining" class="days-remaining"></span>
                    </div>
                    <div class="stats-right">
                        <button id="findMeBtn" class="find-me-button" onclick="window.LeaderboardUI.findMe()" disabled>
                            <span class="find-me-text">Find Me</span>
                            <span class="find-me-rank" id="findMeRank"></span>
                        </button>
                    </div>
                </div>
                
                <div class="user-rank-display" id="userRankDisplay" style="display: none;">
                    <div class="user-rank-card">
                        <span class="user-rank-position">Your Rank: <strong id="userCurrentRank">#---</strong></span>
                        <span class="user-rank-score">Score: <strong id="userCurrentScore">--.-</strong></span>
                        <span class="user-rank-days">Days: <strong id="userCurrentDays">-</strong></span>
                    </div>
                </div>
                
                <div class="leaderboard-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div class="leaderboard-table" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                        <div class="leaderboard-row leaderboard-header-row" style="flex-shrink: 0;">
                            <span class="col-rank">Rank</span>
                            <span class="col-player">Player</span>
                            <span class="col-score">Score</span>
                            <span class="col-days">Days</span>
                            <span class="col-avg">Avg</span>
                        </div>
                        <div id="leaderboardBody" style="flex: 1; overflow-y: auto; overflow-x: hidden;">
                            <!-- Leaderboard rows will be inserted here -->
                        </div>
                    </div>
                    
                    <div class="leaderboard-loading" id="leaderboardLoading" style="display: none;">
                        <div class="loading-spinner"></div>
                        <span>Loading leaderboard...</span>
                    </div>
                    
                    <div class="leaderboard-error" id="leaderboardError" style="display: none;">
                        <span>Unable to load leaderboard. Please try again.</span>
                        <button onclick="window.LeaderboardUI.refresh()">Retry</button>
                    </div>
                </div>
                
                <div class="pagination-controls" id="paginationControls" style="display: none;">
                    <button id="prevPageBtn" onclick="window.LeaderboardUI.previousPage()" disabled>← Previous</button>
                    <span id="pageInfo">Page 1</span>
                    <button id="nextPageBtn" onclick="window.LeaderboardUI.nextPage()">Next →</button>
                </div>
                
                <div class="leaderboard-footer">
                    <div class="refresh-info">
                        <span id="lastUpdateTime">Updated: --:--</span>
                        <button class="refresh-button" onclick="window.LeaderboardUI.refresh()">🔄 Refresh</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Set up event listeners
    setupEventListeners() {
        // Close modal when clicking outside
        document.getElementById('leaderboardModal').addEventListener('click', (e) => {
            if (e.target.id === 'leaderboardModal') {
                this.close();
            }
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isVisible) {
                if (e.key === 'Escape') {
                    this.close();
                } else if (e.key === 'r' || e.key === 'R') {
                    this.refresh();
                } else if (e.key === 'f' || e.key === 'F') {
                    this.findMe();
                }
            }
        });
    }

    // Open leaderboard modal
    async open() {
        console.log('📊 Opening leaderboard...');

        this.isVisible = true;
        const modal = document.getElementById('leaderboardModal');
        modal.style.display = 'flex';

        // Set leaderboard title font size based on screen width
        setTimeout(() => {
            const leaderboardTitle = document.getElementById('leaderboardTitle');
            if (leaderboardTitle) {
                if (window.innerWidth >= 1200) {
                    leaderboardTitle.style.fontSize = '28px';
                    leaderboardTitle.style.lineHeight = '1.2';
                } else {
                    leaderboardTitle.style.fontSize = '24px';
                    leaderboardTitle.style.lineHeight = '1.2';
                }
            }
            const h2Elements = document.querySelectorAll('.leaderboard-header h2');
            h2Elements.forEach(h2 => {
                if (window.innerWidth >= 1200) {
                    h2.style.fontSize = '28px';
                    h2.style.lineHeight = '1.2';
                } else {
                    h2.style.fontSize = '24px';
                    h2.style.lineHeight = '1.2';
                }
            });
        }, 100);
        
        // Load initial data
        await this.loadInitialData();
        
        // Set up periodic refresh
        this.startPeriodicRefresh();
        
        // Add body class to prevent scrolling
        document.body.classList.add('modal-open');
    }

    // Close leaderboard modal
    close() {
        console.log('📊 Closing leaderboard...');
        
        this.isVisible = false;
        const modal = document.getElementById('leaderboardModal');
        modal.style.display = 'none';
        
        // Stop periodic refresh
        this.stopPeriodicRefresh();
        
        // Remove body class
        document.body.classList.remove('modal-open');
    }

    // Load initial data
    async loadInitialData() {
        await this.loadCompetitionInfo();
        await this.loadLeaderboard();
        await this.loadUserRank();
    }

    // Load competition information
    async loadCompetitionInfo() {
        try {
            const competition = window.GlobalCompetitionManager.getCurrentCompetition();
            if (competition) {
                const titleElement = document.getElementById('leaderboardTitle');
                titleElement.textContent = competition.name;
                // Set font size based on screen width
                if (window.innerWidth >= 1200) {
                    titleElement.style.fontSize = '28px';
                    titleElement.style.lineHeight = '1.2';
                } else {
                    titleElement.style.fontSize = '24px';
                    titleElement.style.lineHeight = '1.2';
                }
                
                // Load detailed competition statistics
                const stats = await window.GlobalCompetitionManager.getCompetitionStats();
                if (stats) {
                    document.getElementById('daysRemaining').textContent = 
                        stats.daysRemaining > 0 ? `${stats.daysRemaining} days remaining` : 'Competition ended';
                    
                    // Update player count with more detail
                    document.getElementById('participantCount').textContent =
                        `${stats.activeParticipants.toLocaleString()} active players (${stats.totalParticipants.toLocaleString()} total)`;
                        
                    // Store stats for potential use elsewhere
                    this.competitionStats = stats;
                }
            }
        } catch (error) {
            console.error('Error loading competition info:', error);
        }
    }

    // Load leaderboard data
    async loadLeaderboard(page = 1) {
        this.showLoading();
        
        try {
            const leaderboard = await window.GlobalCompetitionManager.getGlobalLeaderboard(this.pageSize, page);
            this.leaderboardData = leaderboard;
            this.currentPage = page;
            this.totalParticipants = window.GlobalCompetitionManager.getTotalParticipants();
            
            this.renderLeaderboard();
            this.updatePagination();
            this.updateParticipantCount();
            this.hideLoading();
            
            console.log(`📊 Loaded leaderboard page ${page}: ${leaderboard.length} players`);
            
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            this.showError();
        }
    }

    // Render leaderboard table
    renderLeaderboard() {
        const tbody = document.getElementById('leaderboardBody');
        if (!tbody || !this.leaderboardData) return;

        tbody.innerHTML = '';

        this.leaderboardData.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-row';
            
            // Highlight current user
            const currentUser = window.AuthService?.getCurrentUser();
            if (currentUser && !currentUser.isGuest && player.user_id === currentUser.id) {
                row.classList.add('current-user');
            }
            
            // Add medal class for top 3
            if (player.medal) {
                row.classList.add(`rank-${player.rank}`);
            }

            row.innerHTML = `
                <span class="col-rank">
                    ${player.medal} ${player.rank}
                </span>
                <span class="col-player">${this.escapeHtml(player.username)}</span>
                <span class="col-score">${player.total_score}</span>
                <span class="col-days">${player.days_played}</span>
                <span class="col-avg">${player.averageScore}</span>
            `;

            tbody.appendChild(row);
        });

        this.updateLastUpdateTime();
    }

    // Load user's current rank
    async loadUserRank() {
        try {
            const userRank = await window.GlobalCompetitionManager.findUserRank();
            this.userRank = userRank;
            
            if (userRank) {
                this.updateUserRankDisplay(userRank);
                this.updateFindMeButton(userRank);
            } else {
                this.hideFindMeButton();
            }
            
        } catch (error) {
            console.error('Error loading user rank:', error);
            this.hideFindMeButton();
        }
    }

    // Update user rank display
    updateUserRankDisplay(userRank) {
        const display = document.getElementById('userRankDisplay');

        // Only show user rank card if user is outside top 100
        if (userRank && window.AuthService?.isLoggedIn() && userRank.rank > 100) {
            document.getElementById('userCurrentRank').textContent = `#${userRank.rank}`;
            document.getElementById('userCurrentScore').textContent = userRank.score;
            document.getElementById('userCurrentDays').textContent = userRank.daysPlayed;
            display.style.display = 'block';
        } else {
            display.style.display = 'none';
        }
    }

    // Update Find Me button
    updateFindMeButton(userRank) {
        const button = document.getElementById('findMeBtn');
        const rankSpan = document.getElementById('findMeRank');
        
        if (userRank && window.AuthService?.isLoggedIn()) {
            button.disabled = false;
            rankSpan.textContent = `(#${userRank.rank})`;
            button.style.display = 'flex';
        } else {
            this.hideFindMeButton();
        }
    }

    // Hide Find Me button
    hideFindMeButton() {
        const button = document.getElementById('findMeBtn');
        button.style.display = 'none';
    }

    // Find Me functionality
    async findMe() {
        if (!this.userRank) {
            await this.loadUserRank();
        }

        if (!this.userRank) {
            alert('Unable to find your rank. Please make sure you have played at least one game.');
            return;
        }

        // Calculate which page the user is on
        const userPage = Math.ceil(this.userRank.rank / this.pageSize);
        
        if (userPage !== this.currentPage) {
            // Load the page with the user's rank
            await this.loadLeaderboard(userPage);
        }

        // Scroll to user's row
        setTimeout(() => {
            const currentUserRow = document.querySelector('.leaderboard-row.current-user');
            if (currentUserRow) {
                currentUserRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight briefly
                currentUserRow.classList.add('highlight');
                setTimeout(() => {
                    currentUserRow.classList.remove('highlight');
                }, 2000);
            }
        }, 500);
    }

    // Pagination functions
    async nextPage() {
        if (this.hasNextPage()) {
            await this.loadLeaderboard(this.currentPage + 1);
        }
    }

    async previousPage() {
        if (this.currentPage > 1) {
            await this.loadLeaderboard(this.currentPage - 1);
        }
    }

    // Check if there's a next page
    hasNextPage() {
        return this.leaderboardData.length === this.pageSize;
    }

    // Update pagination controls
    updatePagination() {
        const controls = document.getElementById('paginationControls');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const pageInfo = document.getElementById('pageInfo');

        // Show pagination if not on first page or has next page
        if (this.currentPage > 1 || this.hasNextPage()) {
            controls.style.display = 'flex';
            prevBtn.disabled = this.currentPage <= 1;
            nextBtn.disabled = !this.hasNextPage();
            pageInfo.textContent = `Page ${this.currentPage}`;
        } else {
            controls.style.display = 'none';
        }
    }

    // Update player count
    updateParticipantCount() {
        const countElement = document.getElementById('participantCount');
        if (this.totalParticipants > 0) {
            countElement.textContent = `${this.totalParticipants.toLocaleString()} players competing`;
        } else {
            countElement.textContent = 'Loading players...';
        }
    }

    // Show loading state
    showLoading() {
        this.isLoading = true;
        document.getElementById('leaderboardLoading').style.display = 'flex';
        document.getElementById('leaderboardError').style.display = 'none';
    }

    // Hide loading state
    hideLoading() {
        this.isLoading = false;
        document.getElementById('leaderboardLoading').style.display = 'none';
    }

    // Show error state
    showError() {
        this.isLoading = false;
        document.getElementById('leaderboardLoading').style.display = 'none';
        document.getElementById('leaderboardError').style.display = 'flex';
    }

    // Refresh leaderboard
    async refresh() {
        console.log('🔄 Refreshing leaderboard...');
        window.GlobalCompetitionManager.invalidateCache();
        await this.loadLeaderboard(this.currentPage);
        await this.loadUserRank();
    }

    // Refresh all data (for monthly resets)
    async refreshAll() {
        console.log('🔄 Refreshing all competition data...');
        window.GlobalCompetitionManager.invalidateCache();
        await this.loadInitialData();
    }

    // Update last update time
    updateLastUpdateTime() {
        const timeElement = document.getElementById('lastUpdateTime');
        const now = new Date();
        timeElement.textContent = `Updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }

    // Start periodic refresh (every 5 minutes)
    startPeriodicRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.isVisible && !this.isLoading) {
                this.refresh();
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    // Stop periodic refresh
    stopPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Handle real-time leaderboard updates
    refreshLeaderboard() {
        if (this.isVisible && !this.isLoading) {
            setTimeout(() => {
                this.refresh();
            }, 1000); // Small delay to batch updates
        }
    }

    // Utility function to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Check if leaderboard is currently visible
    get isLeaderboardVisible() {
        return this.isVisible;
    }
}

// Create singleton instance
const leaderboardUI = new LeaderboardUI();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.LeaderboardUI = leaderboardUI;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => leaderboardUI.initialize());
    } else {
        leaderboardUI.initialize();
    }
}