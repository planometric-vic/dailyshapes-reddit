// Enhanced Leaderboard UI for Custom Competitions
// Extends the existing leaderboard with custom competition support and enhanced medal system

class CustomLeaderboardUI {
    constructor() {
        this.currentCompetitionId = null;
        this.competitionData = null;
        this.leaderboardCache = new Map();
        this.cacheTimeout = 3 * 60 * 1000; // 3 minutes
        this.dailyAwardsCache = new Map();
        this.isVisible = false;
    }

    // Initialize custom leaderboard UI
    initialize() {
        console.log('🏅 Initializing Custom Leaderboard UI...');
        this.createCustomLeaderboardModal();
        this.setupEventListeners();

        // Test the responsive styling system
        setTimeout(() => {
            console.log('🧪 Testing responsive styling system...');
            this.applyDynamicLeaderboardStyles();
        }, 2000);

        // Set up global observer for any leaderboard creation
        this.setupLeaderboardObserver();

        console.log('✅ Custom Leaderboard UI initialized');

        // Create global mobile adjustment function for testing
        this.createGlobalMobileFunction();
    }

    // Create a global function for mobile adjustments that's always available
    createGlobalMobileFunction() {
        window.fixPlayerColumn = (silent = false) => {
            if (!silent) console.log('🔧 Simple player column fix for 320px screens');

            if (window.innerWidth > 320) {
                if (!silent) console.log(`⚠️ Current screen width is ${window.innerWidth}px - only applies to 320px screens`);
                return;
            }

            // Find elements with grid-template-columns that include minmax(120px, 3fr)
            const allElements = document.querySelectorAll('*');
            let fixedCount = 0;

            allElements.forEach(element => {
                const style = element.getAttribute('style') || '';

                if (style.includes('minmax(120px, 3fr)')) {
                    if (!silent) console.log('📱 Found grid with 120px player column, reducing to 100px');

                    const newStyle = style.replace('minmax(120px, 3fr)', 'minmax(100px, 3fr)');
                    element.setAttribute('style', newStyle);
                    fixedCount++;

                    if (!silent) console.log('✅ Fixed grid template:', element);
                }
            });

            if (!silent || fixedCount > 0) {
                console.log(`📱 Fixed ${fixedCount} grid templates`);
            }
            return fixedCount;
        };

        window.testMobileAdjustments = () => {
            console.log('🔧 Manual mobile adjustment test triggered');

            if (window.innerWidth > 320) {
                console.log(`⚠️ Current screen width is ${window.innerWidth}px - mobile adjustments only work on 320px or smaller`);
                return;
            }

            console.log('📱 Starting FULL DOCUMENT SCAN for mobile adjustments...');

            // Get ALL elements in the document
            const allElements = document.querySelectorAll('*');
            console.log(`📱 Scanning ${allElements.length} total elements in document`);

            let modifiedCount = 0;
            let found120Elements = [];
            let foundFlexElements = [];

            // Scan every single element
            allElements.forEach(element => {
                const computedStyle = window.getComputedStyle(element);
                const inlineStyle = element.getAttribute('style') || '';

                // Check for 120px width in ANY form
                if (inlineStyle.includes('120px') ||
                    element.style.width === '120px' ||
                    computedStyle.width === '120px') {

                    found120Elements.push({
                        element,
                        inlineStyle,
                        computedWidth: computedStyle.width,
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id
                    });
                }

                // Check for flex elements
                if (inlineStyle.includes('flex: 1') || inlineStyle.includes('flex:1')) {
                    foundFlexElements.push({
                        element,
                        inlineStyle,
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id
                    });
                }
            });

            console.log(`📱 Found ${found120Elements.length} elements with 120px:`, found120Elements);
            console.log(`📱 Found ${foundFlexElements.length} flex elements:`, foundFlexElements);

            // Modify all 120px elements found
            found120Elements.forEach(item => {
                const element = item.element;

                // Skip game buttons - we only want leaderboard elements
                if (element.id === 'playBtn' || element.id === 'practiceBtn') {
                    console.log(`📱 SKIPPING game button: ${element.id}`);
                    return;
                }

                console.log('📱 MODIFYING 120px element:', {
                    tag: item.tagName,
                    class: item.className,
                    id: item.id,
                    before: item.computedWidth
                });

                // Check what's preventing the width change
                const beforeStyle = element.getAttribute('style') || '';
                console.log(`📱 Before modification - inline style: "${beforeStyle}"`);

                // Force the width change with maximum priority
                element.style.setProperty('width', '90px', 'important');
                element.style.setProperty('max-width', '90px', 'important');
                element.style.setProperty('min-width', '90px', 'important');

                const afterStyle = element.getAttribute('style') || '';
                const newWidth = window.getComputedStyle(element).width;

                console.log(`📱 After modification - inline style: "${afterStyle}"`);
                console.log(`📱 MODIFIED: ${item.computedWidth} → ${newWidth}`, element);

                if (newWidth === item.computedWidth) {
                    console.warn(`⚠️ Width change failed! Still ${newWidth} - CSS might be overriding our changes`);

                    // Try even more aggressive approach
                    element.setAttribute('style', `${afterStyle} width: 90px !important; max-width: 90px !important; min-width: 90px !important;`);
                    const finalWidth = window.getComputedStyle(element).width;
                    console.log(`📱 After setAttribute: ${finalWidth}`);
                }

                modifiedCount++;
            });

            // Modify flex elements for score column positioning
            foundFlexElements.forEach(item => {
                const element = item.element;
                if (element.closest('#competitionLeaderboardContainer') ||
                    element.closest('#customLeaderboardModal') ||
                    element.closest('.competition-modal') ||
                    element.closest('.leaderboard')) {

                    element.style.paddingLeft = '5px';
                    console.log('📱 Adjusted flex element padding:', {
                        tag: item.tagName,
                        class: item.className,
                        id: item.id
                    });
                }
            });

            console.log(`📱 TOTAL MODIFIED: ${modifiedCount} elements from 120px to 90px`);
            return { found120Elements, foundFlexElements, modifiedCount };
        };

        console.log('🔧 Global mobile test function created: window.testMobileAdjustments()');


        // No continuous monitoring - we'll apply fixes at the right moments instead
    }

    // Create custom competition leaderboard modal
    createCustomLeaderboardModal() {
        const modal = document.createElement('div');
        modal.id = 'customLeaderboardModal';
        modal.className = 'leaderboard-modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="leaderboard-modal-content">
                <div class="leaderboard-header">
                    <h2 id="customLeaderboardTitle">Leaderboard</h2>
                    <button class="leaderboard-close" onclick="window.CustomLeaderboardUI.close()">&times;</button>
                </div>
                
                <div class="custom-competition-info" id="customCompetitionInfo">
                    <!-- Competition details will be populated here -->
                </div>
                
                <div class="leaderboard-stats">
                    <div class="stats-left">
                        <span id="customParticipantCount">Loading...</span>
                        <span id="customDaysRemaining" class="days-remaining"></span>
                    </div>
                </div>
                
                <div class="medal-legend" id="medalLegend">
                    <div class="legend-item">
                        <span class="legend-symbol">🥇🥈🥉</span>
                        <span class="legend-text">Overall Top 3</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-symbol">👑</span>
                        <span class="legend-text">Best Daily Score Today</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-symbol">💯</span>
                        <span class="legend-text">Perfect Cut Today (50.0%/50.0%)</span>
                    </div>
                </div>
                
                <div class="user-rank-display" id="customUserRankDisplay" style="display: none;">
                    <div class="user-rank-card">
                        <span class="user-rank-position">Your Rank: <strong id="customUserCurrentRank">#---</strong></span>
                        <span class="user-rank-score">Score: <strong id="customUserCurrentScore">--.-</strong></span>
                        <span class="user-rank-days">Days: <strong id="customUserCurrentDays">-</strong></span>
                    </div>
                </div>
                
                <div class="leaderboard-container">
                    <div class="leaderboard-table">
                        <div class="leaderboard-row leaderboard-header-row">
                            <span class="col-rank">Rank</span>
                            <span class="col-player">Player</span>
                            <span class="col-awards">Awards</span>
                            <span class="col-score">Score</span>
                            <span class="col-days">Days</span>
                            <span class="col-avg">Avg</span>
                        </div>
                        <div id="customLeaderboardBody">
                            <!-- Custom leaderboard rows will be inserted here -->
                        </div>
                    </div>
                    
                    <div class="leaderboard-loading" id="customLeaderboardLoading" style="display: none;">
                        <div class="loading-spinner"></div>
                        <span>Loading leaderboard...</span>
                    </div>
                    
                    <div class="leaderboard-error" id="customLeaderboardError" style="display: none;">
                        <span>Unable to load leaderboard. Please try again.</span>
                        <button onclick="window.CustomLeaderboardUI.refresh()">Retry</button>
                    </div>
                </div>
                
                <div class="pagination-controls" id="customPaginationControls" style="display: none;">
                    <button id="customPrevPageBtn" onclick="window.CustomLeaderboardUI.previousPage()" disabled>← Previous</button>
                    <span id="customPageInfo">Page 1</span>
                    <button id="customNextPageBtn" onclick="window.CustomLeaderboardUI.nextPage()">Next →</button>
                </div>
                
                <div class="leaderboard-footer">
                    <div class="refresh-info">
                        <span id="customLastUpdateTime">Updated: --:--</span>
                        <button class="refresh-button" onclick="window.CustomLeaderboardUI.refresh()">🔄 Refresh</button>
                    </div>
                    <div class="competition-actions" id="competitionActions">
                        <!-- Competition-specific actions will be added here -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Set up event listeners
    setupEventListeners() {
        // Close modal when clicking outside
        document.getElementById('customLeaderboardModal').addEventListener('click', (e) => {
            if (e.target.id === 'customLeaderboardModal') {
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
                } else if (e.key === 'm' || e.key === 'M') {
                    // Manual mobile adjustment trigger
                    console.log('🔧 Manual mobile adjustment triggered by keyboard');
                    if (window.innerWidth <= 320) {
                        this.applyMobileAdjustments();
                    }
                }
            }

            // Global keyboard shortcut for mobile testing (works anywhere)
            if ((e.key === 'M' && e.ctrlKey) || (e.key === 'm' && e.ctrlKey)) {
                console.log('🔧 Global mobile adjustment triggered (Ctrl+M)');
                if (window.innerWidth <= 320 && window.mobileModifyElements) {
                    window.mobileModifyElements();
                }
            }
        });
    }

    // Open custom competition leaderboard
    async open(competitionId) {
        console.log('🏅 Opening custom competition leaderboard:', competitionId);
        
        this.currentCompetitionId = competitionId;
        this.isVisible = true;
        
        const modal = document.getElementById('customLeaderboardModal');
        modal.style.display = 'flex';
        
        // Load competition data
        await this.loadCompetitionData();
        
        // Load leaderboard
        await this.loadCustomLeaderboard();

        // Load user rank
        await this.loadCustomUserRank();

        // Apply mobile-specific adjustments for 320px screens (with delay to ensure DOM is ready)
        setTimeout(() => {
            this.applyMobileAdjustments();
        }, 100);

        // Also apply again after a longer delay to catch any async content
        setTimeout(() => {
            this.applyMobileAdjustments();
        }, 500);

        // Apply the simple grid fix for 320px screens
        if (window.innerWidth <= 320) {
            setTimeout(() => {
                if (window.fixPlayerColumn) {
                    window.fixPlayerColumn();
                }
            }, 200);
        }

        // Add body class to prevent scrolling
        document.body.classList.add('modal-open');
    }

    // Close custom leaderboard modal
    close() {
        console.log('🏅 Closing custom competition leaderboard...');
        
        this.isVisible = false;
        this.currentCompetitionId = null;
        this.competitionData = null;
        
        const modal = document.getElementById('customLeaderboardModal');
        modal.style.display = 'none';
        
        // Remove body class
        document.body.classList.remove('modal-open');

        // Disconnect mobile observer if it exists
        if (this.mobileObserver) {
            this.mobileObserver.disconnect();
            this.mobileObserver = null;
        }
    }

    // Load competition data
    async loadCompetitionData() {
        if (!this.currentCompetitionId) return;
        
        try {
            if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
                this.competitionData = this.getDemoCompetitionData();
                this.renderCompetitionInfo();
                return;
            }

            const { data, error } = await supabaseClient
                .from('competitions')
                .select(`
                    id, name, description, start_date, end_date, 
                    creator_timezone, is_active,
                    users!competitions_creator_id_fkey(username)
                `)
                .eq('id', this.currentCompetitionId)
                .single();

            if (error) throw error;

            this.competitionData = data;
            this.renderCompetitionInfo();

        } catch (error) {
            console.error('Error loading competition data:', error);
            this.competitionData = this.getDemoCompetitionData();
            this.renderCompetitionInfo();
        }
    }

    // Get demo competition data
    getDemoCompetitionData() {
        return {
            id: 'demo',
            name: 'Demo Custom Competition',
            description: 'A sample custom competition for demonstration',
            start_date: '2024-01-01',
            end_date: '2024-01-31',
            creator_timezone: 'UTC',
            is_active: true,
            users: { username: 'DemoCreator' }
        };
    }

    // Render competition information
    renderCompetitionInfo() {
        if (!this.competitionData) return;

        document.getElementById('customLeaderboardTitle').textContent = 'Leaderboard';
        
        const infoContainer = document.getElementById('customCompetitionInfo');
        const startDate = window.formatDateForUser ? window.formatDateForUser(this.competitionData.start_date) : new Date(this.competitionData.start_date).toLocaleDateString();
        const endDate = window.formatDateForUser ? window.formatDateForUser(this.competitionData.end_date) : new Date(this.competitionData.end_date).toLocaleDateString();
        
        infoContainer.innerHTML = `
            <div class="competition-info-card">
                <div class="competition-meta-row">
                    <span class="competition-dates">📅 ${startDate} - ${endDate}</span>
                    <span class="competition-creator">👤 Created by ${this.competitionData.users?.username || 'Unknown'}</span>
                </div>
                ${this.competitionData.description ? `
                    <div class="competition-description">
                        ${this.escapeHtml(this.competitionData.description)}
                    </div>
                ` : ''}
                <div class="competition-timezone">
                    🌍 Competition timezone: ${this.competitionData.creator_timezone}
                </div>
                <div class="competition-actions" style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                    <button id="customRefreshBtn" class="refresh-button" onclick="window.CustomLeaderboardUI.refreshLeaderboard()"
                          style="width: 40px; height: 40px; background: #4CAF50; color: white; border: 1px solid #000; border-radius: 50%; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: inline-flex; align-items: center; justify-content: center; padding: 0;"
                          onmouseover="this.style.background='#45a049'"
                          onmouseout="this.style.background='#4CAF50'"
                          title="Refresh leaderboard">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                    </button>
                    <span id="customLinkBtn" class="link-button" onclick="window.CustomLeaderboardUI.copyCompetitionLink()"
                          style="padding: 6px 18px; background: #6496FF; color: white; border: 1px solid #000; border-radius: 20px; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"
                          onmouseover="this.style.background='#5485E8'"
                          onmouseout="this.style.background='#6496FF'"
                          title="Copy competition invite link">
                        Invite
                    </span>
                </div>
            </div>
        `;

        console.log('🔄 Competition info rendered with refresh button and invite button');

        // Calculate days remaining
        const endDateObj = new Date(this.competitionData.end_date);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((endDateObj - now) / (24 * 60 * 60 * 1000)));
        
        document.getElementById('customDaysRemaining').textContent = 
            daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Competition ended';
    }

    // Load custom competition leaderboard
    async loadCustomLeaderboard() {
        this.showLoading();
        
        try {
            // Check cache first
            const cacheKey = `${this.currentCompetitionId}_leaderboard`;
            const cached = this.leaderboardCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                this.renderCustomLeaderboard(cached.data);
                this.hideLoading();
                return;
            }

            if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
                const demoData = this.getDemoLeaderboardData();
                this.renderCustomLeaderboard(demoData);
                this.hideLoading();
                return;
            }

            // Get leaderboard data
            const { data: leaderboard, error } = await supabaseClient
                .from('competition_participants')
                .select(`
                    user_id,
                    total_score,
                    days_played,
                    joined_at,
                    users!inner(username)
                `)
                .eq('competition_id', this.currentCompetitionId)
                .order('total_score', { ascending: false })
                .order('days_played', { ascending: false })
                .limit(100);

            if (error) throw error;

            // Get player count
            const { count: participantCount } = await supabaseClient
                .from('competition_participants')
                .select('user_id', { count: 'exact' })
                .eq('competition_id', this.currentCompetitionId)
                .gt('total_score', 0);

            document.getElementById('customParticipantCount').textContent =
                `${participantCount || 0} players`;

            // Get daily awards
            const dailyAwards = await this.loadDailyAwards();
            console.log('🏆 Daily awards loaded for leaderboard:', dailyAwards);

            // Add medals, rankings, and daily awards
            const enhancedLeaderboard = leaderboard.map((participant, index) => {
                const rank = index + 1;
                console.log(`🔍 Processing participant ${index + 1}:`, participant.user_id, participant.users.username);
                console.log(`🔢 BEFORE conversion - total_score:`, participant.total_score, typeof participant.total_score);
                const convertedScore = Math.floor(Number(participant.total_score));
                console.log(`🔢 AFTER conversion - total_score:`, convertedScore, typeof convertedScore);
                const awards = this.getDailyAwardsForUser(participant.user_id, dailyAwards);

                return {
                    ...participant,
                    medal: rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '',
                    rank: rank,
                    username: participant.users.username,
                    total_score: convertedScore,
                    averageScore: participant.days_played > 0 ?
                        Math.round(participant.total_score / participant.days_played) : '0',
                    dailyAwards: awards
                };
            });

            // Cache the result
            this.leaderboardCache.set(cacheKey, {
                data: enhancedLeaderboard,
                timestamp: Date.now()
            });

            this.renderCustomLeaderboard(enhancedLeaderboard);
            this.hideLoading();

        } catch (error) {
            console.error('Error loading custom leaderboard:', error);
            this.showError();
        }
    }

    // Load daily awards data
    async loadDailyAwards() {
        if (!this.currentCompetitionId) {
            console.warn('⚠️ No competition ID - cannot load awards');
            return {};
        }

        const cacheKey = `${this.currentCompetitionId}_daily_awards`;
        const cached = this.dailyAwardsCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < 60 * 1000) { // 1 minute cache
            console.log('📦 Using cached daily awards:', cached.data);
            return cached.data;
        }

        try {
            const today = new Date().toISOString().split('T')[0];
            console.log('🏆 Loading daily awards for date:', today);

            // Get today's scores for this competition
            const { data: todaysScores, error } = await supabaseClient
                .from('daily_scores')
                .select('user_id, daily_average, perfect_cuts')
                .eq('date', today)
                .gte('daily_average', 0)
                .order('daily_average', { ascending: false });

            if (error) {
                console.error('❌ Error fetching daily scores:', error);
                throw error;
            }

            console.log(`📊 Found ${todaysScores?.length || 0} daily scores for today:`, todaysScores);

            // Find best daily scores (can be multiple if tied)
            const bestScore = todaysScores.length > 0 ? todaysScores[0].daily_average : 0;
            const bestScoreUsers = todaysScores
                .filter(score => score.daily_average === bestScore)
                .map(score => score.user_id);

            // Find perfect cuts (exactly 50.0/50.0)
            const perfectCutUsers = todaysScores
                .filter(score => score.perfect_cuts > 0)
                .map(score => score.user_id);

            console.log('🏆 Awards calculated:', {
                bestScore,
                bestScoreUsers,
                perfectCutUsers
            });

            const awards = {
                bestScoreUsers,
                perfectCutUsers
            };

            this.dailyAwardsCache.set(cacheKey, {
                data: awards,
                timestamp: Date.now()
            });

            return awards;

        } catch (error) {
            console.error('❌ Error loading daily awards:', error);
            return { bestScoreUsers: [], perfectCutUsers: [] };
        }
    }

    // Get daily awards for a specific user
    getDailyAwardsForUser(userId, dailyAwards) {
        if (!dailyAwards) {
            console.log(`⚠️ No dailyAwards data for user ${userId}`);
            return '';
        }

        let awards = '';

        // Crown emoji for best daily score
        if (dailyAwards.bestScoreUsers && dailyAwards.bestScoreUsers.includes(userId)) {
            awards += '👑';
            console.log(`👑 Crown awarded to user ${userId}`);
        }

        // 100 emoji for perfect cuts
        if (dailyAwards.perfectCutUsers && dailyAwards.perfectCutUsers.includes(userId)) {
            awards += '💯';
            console.log(`💯 Perfect cut awarded to user ${userId}`);
        }

        if (awards) {
            console.log(`🏆 User ${userId} received awards: ${awards}`);
        }

        return awards;
    }

    // Get demo leaderboard data
    getDemoLeaderboardData() {
        const demoPlayers = [];
        for (let i = 0; i < 20; i++) {
            const score = 300 - (i * 12) + Math.random() * 15;
            const days = Math.floor(Math.random() * 10) + 1;
            const hasCrown = i < 3 && Math.random() > 0.5;
            const hasPerfect = i < 8 && Math.random() > 0.7;
            
            demoPlayers.push({
                user_id: `demo_${i}`,
                username: `Player${i + 1}`,
                total_score: Math.round(score),
                days_played: days,
                averageScore: Math.round(score / days),
                medal: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '',
                rank: i + 1,
                dailyAwards: (hasCrown ? '👑' : '') + (hasPerfect ? '💯' : '')
            });
        }
        return demoPlayers;
    }

    // Render custom leaderboard table
    renderCustomLeaderboard(leaderboardData) {
        const tbody = document.getElementById('customLeaderboardBody');
        if (!tbody || !leaderboardData) return;

        tbody.innerHTML = '';

        leaderboardData.forEach((player, index) => {
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
                <span class="col-awards">${player.dailyAwards || ''}</span>
                <span class="col-score">${Math.floor(Number(player.total_score))}</span>
                <span class="col-days">${player.days_played}</span>
                <span class="col-avg">${Math.floor(Number(player.averageScore))}</span>
            `;

            tbody.appendChild(row);
        });

        this.updateLastUpdateTime();

        // Apply dynamic responsive styles to the newly created leaderboard
        this.applyDynamicLeaderboardStyles();
    }

    // Apply dynamic responsive styles to newly created leaderboard rows
    applyDynamicLeaderboardStyles() {
        console.log('🚨 ULTRA AGGRESSIVE STYLING - MUST BE VISIBLE! 🚨');
        console.log('🎨 Screen dimensions:', window.innerWidth, 'x', window.innerHeight);

        // Apply mobile responsive styles for leaderboard tables
        const leaderboardStyleId = 'MOBILE_LEADERBOARD_STYLES';
        let existingStyle = document.getElementById(leaderboardStyleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        const mobileStyle = document.createElement('style');
        mobileStyle.id = leaderboardStyleId;
        mobileStyle.innerHTML = `
            /* CRITICAL: Prevent modal content itself from scrolling - APPLIES TO ALL SCREEN SIZES */
            #customLeaderboardModal,
            .leaderboard-modal {
                overflow: hidden !important;
            }

            /* Modal content must be flex column with controlled overflow and FIXED height */
            #customLeaderboardModal .leaderboard-modal-content {
                display: flex !important;
                flex-direction: column !important;
                height: 95vh !important; /* FIXED height prevents modal from growing */
                max-height: 95vh !important;
                overflow: hidden !important;
            }

            /* Fixed sections at top - no scrolling */
            #customLeaderboardModal .leaderboard-header,
            #customLeaderboardModal .custom-competition-info,
            #customLeaderboardModal .leaderboard-stats,
            #customLeaderboardModal .medal-legend,
            #customLeaderboardModal .user-rank-display {
                flex: 0 0 auto !important;
                overflow: visible !important;
            }

            /* Leaderboard container takes remaining space */
            #customLeaderboardModal .leaderboard-container {
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                border: 1px solid #dee2e6 !important;
                border-radius: 8px !important;
            }

            /* Table wrapper must not scroll */
            #customLeaderboardModal .leaderboard-table {
                display: flex !important;
                flex-direction: column !important;
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow: hidden !important;
            }

            /* Fixed header row - never scrolls */
            #customLeaderboardModal .leaderboard-header-row {
                flex: 0 0 auto !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 15 !important;
                background: #f8f9fa !important;
                border-bottom: 2px solid #dee2e6 !important;
                font-weight: bold !important;
            }

            /* ONLY the body scrolls - player rows */
            #customLeaderboardModal #customLeaderboardBody {
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow-x: hidden !important;
                overflow-y: auto !important;
                -webkit-overflow-scrolling: touch !important;
            }

            /* Fixed footer sections - no scrolling */
            #customLeaderboardModal .pagination-controls,
            #customLeaderboardModal .leaderboard-footer {
                flex: 0 0 auto !important;
                overflow: visible !important;
            }

            /* Ensure all leaderboard rows fit within container width */
            #customLeaderboardModal .leaderboard-row,
            #customLeaderboardModal div[style*="grid-template-columns"] {
                max-width: 100% !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
            }

            /* ONLY target 320px screens - adjust Player column and text sizes */
            @media screen and (max-width: 320px) {
                /* Target grid containers directly with important override */
                [style*="minmax(120px, 3fr)"] {
                    grid-template-columns: minmax(50px, 1fr) minmax(20px, 20px) minmax(100px, 3fr) minmax(80px, 1.5fr) !important;
                }

                /* Target any element with inline style containing width: 120px */
                [style*="width: 120px"],
                [style*="width:120px"],
                div[style*="width: 120px"],
                div[style*="width:120px"],
                span[style*="width: 120px"],
                span[style*="width:120px"] {
                    width: 85px !important;
                    max-width: 85px !important;
                    font-size: 0.75rem !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                }

                /* Target all elements inside the leaderboard container */
                #competitionLeaderboardContainer * {
                    font-size: 0.75rem !important;
                }

                /* Score column (usually last child or has flex: 1) */
                #competitionLeaderboardContainer [style*="flex: 1"],
                #competitionLeaderboardContainer [style*="flex:1"],
                #competitionLeaderboardContainer div[style*="display: flex"] > *:last-child {
                    font-size: 0.8rem !important;
                }
            }
        `;
        document.head.appendChild(mobileStyle);
        console.log('📱 Applied mobile leaderboard responsive styles');

        // Also directly modify the elements with JavaScript for 320px screens
        if (window.innerWidth <= 320) {
            console.log('📱 Triggering comprehensive mobile adjustment system');

            // Use the comprehensive mobile adjustment system if available
            if (window.mobileModifyElements) {
                window.mobileModifyElements();
            } else {
                // Fallback to simple approach
                console.log('📱 Using fallback mobile adjustments');
                const elements120px = document.querySelectorAll('[style*="width: 120px"], [style*="width:120px"]');
                elements120px.forEach(element => {
                    element.style.setProperty('width', '90px', 'important');
                    element.style.setProperty('maxWidth', '90px', 'important');
                    console.log('📱 Modified 120px element to 90px:', element);
                });

                const scoreElements = document.querySelectorAll('#competitionLeaderboardContainer [style*="flex: 1"], #competitionLeaderboardContainer [style*="flex:1"]');
                scoreElements.forEach(element => {
                    element.style.paddingLeft = '5px';
                    console.log('📱 Adjusted score column padding:', element);
                });
            }

            // Apply the simple grid fix that actually works
            if (window.fixPlayerColumn) {
                console.log('📱 Applying grid template fix');
                window.fixPlayerColumn();
            }
        }

        console.log('📱 Mobile leaderboard styles applied successfully');
    }

    // Load user's current rank in competition
    async loadCustomUserRank() {
        if (!window.AuthService.isLoggedIn() || !this.currentCompetitionId) {
            return;
        }

        const user = window.AuthService.getCurrentUser();
        if (!user || user.isGuest) return;

        try {
            if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
                this.updateCustomUserRankDisplay({ rank: 12, score: 85.3, daysPlayed: 4 });
                this.updateCustomFindMeButton({ rank: 12 });
                return;
            }

            // Get user's stats
            const { data: userStats } = await supabaseClient
                .from('competition_participants')
                .select('total_score, days_played')
                .eq('competition_id', this.currentCompetitionId)
                .eq('user_id', user.id)
                .single();

            if (!userStats) return;

            // Count users with better scores
            const { count: betterPlayers } = await supabaseClient
                .from('competition_participants')
                .select('user_id', { count: 'exact' })
                .eq('competition_id', this.currentCompetitionId)
                .gt('total_score', userStats.total_score);

            const userRank = {
                rank: (betterPlayers || 0) + 1,
                score: Math.floor(Number(userStats.total_score)),
                daysPlayed: userStats.days_played,
                averageScore: userStats.days_played > 0 ?
                    Math.round(userStats.total_score / userStats.days_played) : '0'
            };

            this.updateCustomUserRankDisplay(userRank);
            this.updateCustomFindMeButton(userRank);

        } catch (error) {
            console.error('Error loading custom user rank:', error);
        }
    }

    // Update user rank display
    updateCustomUserRankDisplay(userRank) {
        const display = document.getElementById('customUserRankDisplay');
        
        if (userRank && window.AuthService?.isLoggedIn()) {
            document.getElementById('customUserCurrentRank').textContent = `#${userRank.rank}`;
            document.getElementById('customUserCurrentScore').textContent = userRank.score;
            document.getElementById('customUserCurrentDays').textContent = userRank.daysPlayed;
            display.style.display = 'block';
        } else {
            display.style.display = 'none';
        }
    }

    // Update Find Me button
    updateCustomFindMeButton(userRank) {
        const button = document.getElementById('customFindMeBtn');
        const rankSpan = document.getElementById('customFindMeRank');
        
        if (userRank && window.AuthService?.isLoggedIn()) {
            button.disabled = false;
            rankSpan.textContent = `(#${userRank.rank})`;
            button.style.display = 'flex';
        } else {
            button.style.display = 'none';
        }
    }

    // Find Me functionality
    async findMe() {
        const currentUserRow = document.querySelector('#customLeaderboardBody .leaderboard-row.current-user');
        if (currentUserRow) {
            currentUserRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            currentUserRow.classList.add('highlight');
            setTimeout(() => {
                currentUserRow.classList.remove('highlight');
            }, 2000);
        } else {
            alert('You are not currently on this leaderboard page. Make sure you have played at least one game in this competition.');
        }
    }

    // Refresh leaderboard
    async refresh() {
        console.log('🔄 Refreshing custom leaderboard...');
        this.leaderboardCache.clear();
        this.dailyAwardsCache.clear();
        await this.loadCustomLeaderboard();
        await this.loadCustomUserRank();
    }

    // Show loading state
    showLoading() {
        document.getElementById('customLeaderboardLoading').style.display = 'flex';
        document.getElementById('customLeaderboardError').style.display = 'none';
    }

    // Hide loading state
    hideLoading() {
        document.getElementById('customLeaderboardLoading').style.display = 'none';
    }

    // Show error state
    showError() {
        document.getElementById('customLeaderboardLoading').style.display = 'none';
        document.getElementById('customLeaderboardError').style.display = 'flex';
    }

    // Update last update time
    updateLastUpdateTime() {
        const timeElement = document.getElementById('customLastUpdateTime');
        const now = new Date();
        timeElement.textContent = `Updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }

    // Refresh daily awards specifically
    async refreshDailyAwards() {
        // Clear daily awards cache and reload
        this.dailyAwardsCache.clear();
        await this.loadCustomLeaderboard();
    }

    // Utility function to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Copy competition link to clipboard
    copyCompetitionLink() {
        if (!this.currentCompetitionId) {
            console.error('No competition ID available');
            return;
        }

        try {
            // Generate the invite/join link
            const joinLink = `${window.location.origin}${window.location.pathname}?join=${this.currentCompetitionId}`;

            // Get competition details from localStorage
            const compDetailsString = localStorage.getItem(`compDetails_${this.currentCompetitionId}`);
            let plainTextMessage = joinLink; // Default to just the link
            let htmlMessage = `<a href="${joinLink}">${joinLink}</a>`;

            if (compDetailsString) {
                const compDetails = JSON.parse(compDetailsString);

                // Format dates with "Today" replacement (use window function if available)
                const formatDate = window.formatCompetitionDate || ((date) => date);
                const startDate = formatDate(compDetails.startDate);
                const endDate = formatDate(compDetails.endDate);

                // Create formatted invite text matching copyJoinLink()
                plainTextMessage = `Join my Daily Shapes competition!
Runs from ${startDate} to ${endDate}
Don't be a square - join the fun!

${joinLink}`;

                htmlMessage = `Join my Daily Shapes competition!<br>
Runs from ${startDate} to ${endDate}<br>
Don't be a square - join the fun!<br><br>
<a href="${joinLink}">${joinLink}</a>`;
            }

            // Try to use modern Clipboard API with both plain text and HTML
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    const clipboardItem = new ClipboardItem({
                        'text/plain': new Blob([plainTextMessage], { type: 'text/plain' }),
                        'text/html': new Blob([htmlMessage], { type: 'text/html' })
                    });

                    navigator.clipboard.write([clipboardItem]).then(() => {
                        this.showLinkCopyFeedback();
                    }).catch(() => {
                        // Fallback to plain text if rich content fails
                        navigator.clipboard.writeText(plainTextMessage).then(() => {
                            this.showLinkCopyFeedback();
                        }).catch(() => {
                            this.fallbackCopyTextToClipboard(plainTextMessage);
                        });
                    });
                } catch (err) {
                    // Fallback to plain text for older browsers
                    navigator.clipboard.writeText(plainTextMessage).then(() => {
                        this.showLinkCopyFeedback();
                    }).catch(() => {
                        this.fallbackCopyTextToClipboard(plainTextMessage);
                    });
                }
            } else {
                // Fallback for older browsers
                this.fallbackCopyTextToClipboard(plainTextMessage);
            }
        } catch (error) {
            console.error('Error copying competition link:', error);
        }
    }

    // Show feedback when link is copied
    showLinkCopyFeedback() {
        // Use the global notification function if available
        if (window.showCopyNotification) {
            window.showCopyNotification();
        } else {
            // Fallback to button feedback
            const button = document.getElementById('customLinkBtn');
            if (button) {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.background = '#28a745';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '#6496FF';
                }, 2000);
            }
        }
    }

    // Refresh leaderboard data without affecting game state
    async refreshLeaderboard() {
        if (!this.currentCompetitionId) {
            console.error('No competition ID available to refresh');
            return;
        }

        console.log('🔄 Refreshing leaderboard for competition:', this.currentCompetitionId);

        // Show visual feedback - make button spin
        const refreshBtn = document.getElementById('customRefreshBtn');
        if (refreshBtn) {
            refreshBtn.style.animation = 'spin 1s linear';
            refreshBtn.style.pointerEvents = 'none'; // Disable during refresh
        }

        try {
            // Clear cache and reload leaderboard data
            const cacheKey = `${this.currentCompetitionId}_leaderboard`;
            this.leaderboardCache.delete(cacheKey);
            await this.loadCustomLeaderboard();
            console.log('✅ Leaderboard refreshed successfully');

            // Show success feedback
            if (refreshBtn) {
                refreshBtn.style.background = '#45a049';
                setTimeout(() => {
                    refreshBtn.style.background = '#4CAF50';
                }, 500);
            }
        } catch (error) {
            console.error('❌ Error refreshing leaderboard:', error);

            // Show error feedback
            if (refreshBtn) {
                refreshBtn.style.background = '#f44336';
                setTimeout(() => {
                    refreshBtn.style.background = '#4CAF50';
                }, 2000);
            }
        } finally {
            // Re-enable button and stop animation
            if (refreshBtn) {
                refreshBtn.style.animation = '';
                refreshBtn.style.pointerEvents = 'auto';
            }
        }
    }

    // Fallback copy method for older browsers
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showLinkCopyFeedback();
            }
        } catch (err) {
            console.error('Fallback: Could not copy text: ', err);
        }

        document.body.removeChild(textArea);
    }

    // Apply mobile-specific adjustments for 320px screens
    applyMobileAdjustments() {
        // Only apply on screens 320px or smaller
        if (window.innerWidth > 320) {
            return;
        }

        console.log('📱 Applying mobile adjustments for 320px screen');

        // Function to modify elements
        const modifyElements = () => {
            console.log('📱 Starting FULL DOCUMENT SCAN for mobile adjustments...');

            // Get ALL elements in the document
            const allElements = document.querySelectorAll('*');
            console.log(`📱 Scanning ${allElements.length} total elements in document`);

            let modifiedCount = 0;
            let found120Elements = [];
            let foundFlexElements = [];

            // Scan every single element
            allElements.forEach(element => {
                const computedStyle = window.getComputedStyle(element);
                const inlineStyle = element.getAttribute('style') || '';

                // Check for 120px width in ANY form
                if (inlineStyle.includes('120px') ||
                    element.style.width === '120px' ||
                    computedStyle.width === '120px') {

                    found120Elements.push({
                        element,
                        inlineStyle,
                        computedWidth: computedStyle.width,
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id
                    });
                }

                // Check for flex elements
                if (inlineStyle.includes('flex: 1') || inlineStyle.includes('flex:1')) {
                    foundFlexElements.push({
                        element,
                        inlineStyle,
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id
                    });
                }
            });

            console.log(`📱 Found ${found120Elements.length} elements with 120px:`, found120Elements);
            console.log(`📱 Found ${foundFlexElements.length} flex elements:`, foundFlexElements);

            // Modify all 120px elements found
            found120Elements.forEach(item => {
                const element = item.element;
                console.log('📱 MODIFYING 120px element:', {
                    tag: item.tagName,
                    class: item.className,
                    id: item.id,
                    before: item.computedWidth
                });

                // Force the width change with maximum priority
                element.style.setProperty('width', '90px', 'important');
                element.style.setProperty('max-width', '90px', 'important');
                element.style.setProperty('min-width', '90px', 'important');

                modifiedCount++;

                const newWidth = window.getComputedStyle(element).width;
                console.log(`📱 MODIFIED: ${item.computedWidth} → ${newWidth}`, element);
            });

            // Modify flex elements for score column positioning
            foundFlexElements.forEach(item => {
                const element = item.element;
                if (element.closest('#competitionLeaderboardContainer') ||
                    element.closest('#customLeaderboardModal') ||
                    element.closest('.competition-modal') ||
                    element.closest('.leaderboard')) {

                    element.style.paddingLeft = '5px';
                    console.log('📱 Adjusted flex element padding:', {
                        tag: item.tagName,
                        class: item.className,
                        id: item.id
                    });
                }
            });

            console.log(`📱 TOTAL MODIFIED: ${modifiedCount} elements from 120px to 90px`);

            // Also add a global reference for manual testing
            window.mobileModifyElements = modifyElements;
        };

        // Apply modifications immediately
        modifyElements();

        // Set up continuous checking for a few seconds to catch any delayed elements
        const checkInterval = setInterval(() => {
            modifyElements();
        }, 200);

        // Stop continuous checking after 5 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            console.log('📱 Stopped continuous mobile adjustment checking');
        }, 5000);

        // Set up a MutationObserver specifically for mobile adjustments
        if (this.mobileObserver) {
            this.mobileObserver.disconnect();
        }

        this.mobileObserver = new MutationObserver((mutations) => {
            let shouldModify = false;

            mutations.forEach((mutation) => {
                // Check for added nodes that might contain our target elements
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const has120pxWidth = node.querySelector && (
                                node.querySelector('[style*="width: 120px"]') ||
                                node.querySelector('[style*="width:120px"]')
                            );

                            const isFlexElement = node.style && (
                                node.style.flex === '1' ||
                                node.getAttribute('style')?.includes('flex: 1') ||
                                node.getAttribute('style')?.includes('flex:1')
                            );

                            if (has120pxWidth || isFlexElement) {
                                shouldModify = true;
                            }
                        }
                    });
                }

                // Check for style attribute changes
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.getAttribute('style')?.includes('width: 120px') ||
                        target.getAttribute('style')?.includes('width:120px') ||
                        target.getAttribute('style')?.includes('flex: 1') ||
                        target.getAttribute('style')?.includes('flex:1')) {
                        shouldModify = true;
                    }
                }
            });

            if (shouldModify) {
                console.log('📱 MutationObserver detected changes requiring mobile adjustments');
                setTimeout(modifyElements, 50); // Small delay to ensure DOM is ready
            }
        });

        // Start observing
        this.mobileObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style']
        });

        console.log('📱 Mobile adjustments applied and observer started');
    }

    // Set up global observer to detect any leaderboard table creation
    setupLeaderboardObserver() {
        console.log('🔍 Setting up leaderboard observer...');

        // Observer for DOM changes
        const observer = new MutationObserver((mutations) => {
            let leaderboardFound = false;
            let triggerReason = '';

            mutations.forEach((mutation) => {
                // Check added nodes
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is a leaderboard table or contains one
                        const isLeaderboardTable = node.classList && (
                            node.classList.contains('leaderboard-table') ||
                            node.classList.contains('leaderboard') ||
                            node.tagName === 'TABLE'
                        );

                        const hasLeaderboardTable = node.querySelector && (
                            node.querySelector('.leaderboard-table') ||
                            node.querySelector('.leaderboard') ||
                            node.querySelector('table')
                        );

                        if (isLeaderboardTable || hasLeaderboardTable) {
                            console.log('🎯 Leaderboard detected by observer (added node)!', node);
                            leaderboardFound = true;
                            triggerReason = 'added node';
                        }

                        // Also check for any elements that might contain participant data
                        if (node.innerHTML && (
                            node.innerHTML.includes('participant') ||
                            node.innerHTML.includes('rank') ||
                            node.innerHTML.includes('score') ||
                            node.innerHTML.includes('leaderboard')
                        )) {
                            console.log('🎯 Potential leaderboard content detected!', node);
                            leaderboardFound = true;
                            triggerReason = 'content match';
                        }
                    }
                });

                // Check attribute changes (like style display changes)
                if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
                    const target = mutation.target;
                    if (target.classList && (
                        target.classList.contains('leaderboard-table') ||
                        target.classList.contains('leaderboard') ||
                        target.tagName === 'TABLE'
                    )) {
                        console.log('🎯 Leaderboard attribute changed!', target);
                        leaderboardFound = true;
                        triggerReason = 'attribute change';
                    }
                }
            });

            if (leaderboardFound) {
                console.log(`🎨 Triggering responsive styles from observer (${triggerReason})`);
                // Small delay to ensure DOM is fully rendered
                setTimeout(() => {
                    this.applyDynamicLeaderboardStyles();

                    // Apply grid fix immediately for 320px screens
                    if (window.innerWidth <= 320 && window.fixPlayerColumn) {
                        console.log('📱 Applying grid fix immediately after leaderboard detection');
                        window.fixPlayerColumn();
                    }
                }, 100);
            }
        });

        // Start observing with more comprehensive options
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        // Also set up a click listener to trigger on any button clicks
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target.tagName === 'BUTTON' || target.classList.contains('btn')) {
                console.log('🔍 Button clicked, checking for leaderboards in 500ms...', target);
                setTimeout(() => {
                    this.applyDynamicLeaderboardStyles();
                }, 500);
            }
        });

        console.log('✅ Leaderboard observer active');
    }
}

// Create singleton instance
const customLeaderboardUI = new CustomLeaderboardUI();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CustomLeaderboardUI = customLeaderboardUI;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => customLeaderboardUI.initialize());
    } else {
        customLeaderboardUI.initialize();
    }
}