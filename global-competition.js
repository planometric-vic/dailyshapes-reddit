// Global Monthly Competition System for Daily Shapes v4.0
// Handles global leaderboards, real-time updates, and monthly competitions

class GlobalCompetitionManager {
    constructor() {
        this.currentCompetition = null;
        this.leaderboardCache = null;
        this.cacheTimestamp = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.realtimeSubscription = null;
        this.userRank = null;
        this.totalParticipants = 0;
        this.isInitialized = false;
    }

    // Initialize the competition system
    async initialize() {
        console.log('🏆 Initializing Global Competition Manager...');
        
        try {
            // Get or create current month's competition
            await this.ensureCurrentMonthCompetition();
            
            // Auto-enroll user if authenticated
            if (window.AuthService && window.AuthService.isLoggedIn()) {
                await this.autoEnrollUser();
            }
            
            // Set up real-time subscriptions
            this.setupRealtimeUpdates();
            
            // Set up monthly reset detection
            this.setupMonthlyResetDetection();
            
            this.isInitialized = true;
            console.log('✅ Global Competition Manager initialized');
            
        } catch (error) {
            console.error('❌ Error initializing competition system:', error);
            // Continue in demo mode
            this.initializeDemoMode();
        }
    }

    // Initialize demo mode for offline/error scenarios
    initializeDemoMode() {
        console.log('🎮 Running competition system in demo mode');
        this.currentCompetition = {
            id: 'demo',
            name: `${this.getCurrentMonthName().toUpperCase()} GLOBAL`,
            is_global: true,
            start_date: this.getMonthStart(),
            end_date: this.getMonthEnd()
        };
        this.isInitialized = true;
    }

    // Ensure current month's global competition exists (based on user's local timezone)
    async ensureCurrentMonthCompetition() {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            throw new Error('Supabase not available');
        }

        // Get current date in user's LOCAL timezone
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        console.log(`🌍 Checking for global competition in user's timezone: ${year}-${month.toString().padStart(2, '0')}`);

        // Check if competition exists for current month
        const { data: existingComp, error: fetchError } = await supabaseClient
            .from('competitions')
            .select('*')
            .eq('is_global', true)
            .eq('start_date', this.getMonthStart())
            .maybeSingle();

        if (existingComp) {
            this.currentCompetition = existingComp;
            console.log('📅 Using existing global competition:', existingComp.name);

            // Deactivate old competitions
            await this.deactivateOldCompetitions(year, month);
            return;
        }

        console.log('🆕 No competition found for current month, creating new one...');

        // Create new monthly competition (this is the first user in their timezone to enter the new month)
        await this.createMonthlyGlobalCompetition(year, month);

        // Deactivate previous month's competition
        await this.deactivateOldCompetitions(year, month);
    }

    // Create global competition for the month
    async createMonthlyGlobalCompetition(year, month) {
        console.log(`🏆 Creating global competition for ${month}/${year}`);

        const competition = {
            name: `${this.getMonthName(month).toUpperCase()} GLOBAL`,
            description: 'Monthly global competition for all Daily Shapes players',
            creator_id: null, // System-created (NULL allowed after migration)
            competition_type: 'global',
            start_date: `${year}-${month.toString().padStart(2, '0')}-01`,
            end_date: this.getLastDayOfMonth(year, month),
            is_global: true,
            is_public: true,
            is_active: true,
            status: 'active', // Set to active immediately
            scoring_method: 'total_score',
            allow_late_entries: true, // Users can join mid-month
            require_consecutive_days: false,
            minimum_days_to_qualify: 1
        };

        const { data: newComp, error } = await supabaseClient
            .from('competitions')
            .insert(competition)
            .select()
            .single();

        if (error) {
            console.error('Error creating global competition:', error);
            throw error;
        }

        this.currentCompetition = newComp;
        console.log('✅ Global competition created:', newComp.name);

        // Auto-enroll all existing users
        await this.enrollAllExistingUsers();
    }

    // Deactivate old global competitions from previous months
    async deactivateOldCompetitions(currentYear, currentMonth) {
        try {
            const currentMonthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;

            console.log(`🗄️ Deactivating global competitions before ${currentMonthStart}`);

            const { error } = await supabaseClient
                .from('competitions')
                .update({
                    is_active: false,
                    status: 'completed'
                })
                .eq('is_global', true)
                .eq('is_active', true)
                .lt('end_date', currentMonthStart);

            if (error) {
                console.error('❌ Error deactivating old competitions:', error);
            } else {
                console.log('✅ Old global competitions deactivated');
            }
        } catch (error) {
            console.error('❌ Error in deactivateOldCompetitions:', error);
        }
    }

    // Auto-enroll all existing users in new competition
    async enrollAllExistingUsers() {
        if (!this.currentCompetition) return;

        try {
            // Get all users who don't have an entry for this competition
            const { data: users, error: usersError } = await supabaseClient
                .from('users')
                .select('id')
                .not('is_guest', 'eq', true);

            if (usersError) throw usersError;

            // Batch enroll users
            const enrollments = users.map(user => ({
                competition_id: this.currentCompetition.id,
                user_id: user.id,
                total_score: 0,
                days_played: 0
            }));

            if (enrollments.length > 0) {
                const { error: enrollError } = await supabaseClient
                    .from('competition_participants')
                    .upsert(enrollments, { onConflict: 'competition_id,user_id' });

                if (enrollError) throw enrollError;
                
                console.log(`📝 Auto-enrolled ${enrollments.length} users in global competition`);
            }

        } catch (error) {
            console.error('Error enrolling existing users:', error);
        }
    }

    // Auto-enroll current user
    async autoEnrollUser() {
        if (!this.currentCompetition || !window.AuthService.isLoggedIn()) {
            return;
        }

        const user = window.AuthService.getCurrentUser();
        if (!user || user.isGuest) return;

        try {
            // Check if already enrolled
            const { data: existing } = await supabaseClient
                .from('competition_participants')
                .select('id')
                .eq('competition_id', this.currentCompetition.id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (existing) {
                console.log('👤 User already enrolled in global competition');
                return;
            }

            // Enroll user
            const { error } = await supabaseClient
                .from('competition_participants')
                .insert({
                    competition_id: this.currentCompetition.id,
                    user_id: user.id,
                    total_score: 0,
                    days_played: 0
                });

            if (error) throw error;

            console.log('🎉 User auto-enrolled in global competition');

        } catch (error) {
            console.error('Error auto-enrolling user:', error);
        }
    }

    // Get global leaderboard with medal system
    async getGlobalLeaderboard(limit = 100, page = 1) {
        // Check cache first
        if (this.isLeaderboardCacheValid()) {
            return this.leaderboardCache;
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return this.getDemoLeaderboard(limit);
        }

        try {
            const offset = (page - 1) * limit;

            // Get leaderboard data
            const { data: leaderboard, error } = await supabaseClient
                .from('competition_participants')
                .select(`
                    user_id,
                    total_score,
                    days_played,
                    users!inner(username)
                `)
                .eq('competition_id', this.currentCompetition?.id)
                .order('total_score', { ascending: false })
                .order('days_played', { ascending: false }) // Tiebreaker
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Get total participant count
            const { count: totalCount } = await supabaseClient
                .from('competition_participants')
                .select('user_id', { count: 'exact' })
                .eq('competition_id', this.currentCompetition?.id)
                .gt('total_score', 0);

            this.totalParticipants = totalCount || 0;

            // Add medals and rankings
            const leaderboardWithMedals = leaderboard.map((participant, index) => {
                const globalRank = offset + index + 1;
                return {
                    ...participant,
                    medal: globalRank === 1 ? '🥇' : globalRank === 2 ? '🥈' : globalRank === 3 ? '🥉' : '',
                    rank: globalRank,
                    username: participant.users.username,
                    averageScore: participant.days_played > 0 ? 
                        (participant.total_score / participant.days_played).toFixed(1) : '0.0'
                };
            });

            // Cache the result
            this.leaderboardCache = leaderboardWithMedals;
            this.cacheTimestamp = Date.now();

            console.log(`📊 Loaded leaderboard: ${leaderboardWithMedals.length} players`);
            return leaderboardWithMedals;

        } catch (error) {
            console.error('Error loading leaderboard:', error);
            return this.getDemoLeaderboard(limit);
        }
    }

    // Get demo leaderboard for offline mode
    getDemoLeaderboard(limit = 100) {
        const demoPlayers = [];
        for (let i = 0; i < Math.min(limit, 50); i++) {
            const score = 400 - (i * 8) + Math.random() * 10;
            const days = Math.floor(Math.random() * 20) + 1;
            demoPlayers.push({
                user_id: `demo_${i}`,
                username: `Player${i + 1}`,
                total_score: score.toFixed(1),
                days_played: days,
                averageScore: (score / days).toFixed(1),
                medal: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '',
                rank: i + 1
            });
        }
        this.totalParticipants = 1234; // Demo count
        return demoPlayers;
    }

    // Check if leaderboard cache is still valid
    isLeaderboardCacheValid() {
        return this.leaderboardCache && 
               this.cacheTimestamp && 
               (Date.now() - this.cacheTimestamp) < this.cacheTimeout;
    }

    // Find user's position in global leaderboard
    async findUserRank() {
        if (!window.AuthService.isLoggedIn()) {
            return null;
        }

        const user = window.AuthService.getCurrentUser();
        if (!user || user.isGuest) return null;

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { rank: 247, totalParticipants: 1234, score: 89.3, daysPlayed: 8 }; // Demo
        }

        try {
            // Get user's current score and stats
            const { data: userStats } = await supabaseClient
                .from('competition_participants')
                .select('total_score, days_played')
                .eq('competition_id', this.currentCompetition?.id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!userStats) {
                return null; // User not enrolled
            }

            // Count users with higher scores
            const { count: betterPlayers } = await supabaseClient
                .from('competition_participants')
                .select('user_id', { count: 'exact' })
                .eq('competition_id', this.currentCompetition?.id)
                .gt('total_score', userStats.total_score);

            const userRank = (betterPlayers || 0) + 1;

            this.userRank = {
                rank: userRank,
                totalParticipants: this.totalParticipants,
                score: userStats.total_score,
                daysPlayed: userStats.days_played,
                averageScore: userStats.days_played > 0 ? 
                    (userStats.total_score / userStats.days_played).toFixed(1) : '0.0'
            };

            return this.userRank;

        } catch (error) {
            console.error('Error finding user rank:', error);
            return null;
        }
    }

    // Submit daily score to global competition
    async submitDailyScore(dailyScore) {
        if (!window.AuthService.isLoggedIn() || !this.currentCompetition) {
            return;
        }

        const user = window.AuthService.getCurrentUser();
        if (!user || user.isGuest) return;

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            console.log('📊 Demo mode: Would submit score', dailyScore);
            return;
        }

        try {
            console.log(`🏆 Submitting daily score: ${dailyScore} to global competition`);

            // Auto-enroll user if not already enrolled (for players who join mid-month)
            await this.autoEnrollUser();

            // Update participant score with SQL increment
            const { error } = await supabaseClient.rpc('update_competition_score', {
                p_competition_id: this.currentCompetition.id,
                p_user_id: user.id,
                p_daily_score: dailyScore
            });

            if (error) throw error;

            // Invalidate cache to force refresh
            this.invalidateCache();

            console.log('✅ Daily score submitted to global competition');

        } catch (error) {
            console.error('❌ Error submitting daily score:', error);
            // Don't throw - daily game should continue working
        }
    }

    // Set up real-time subscriptions for leaderboard updates
    setupRealtimeUpdates() {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady() || !this.currentCompetition) {
            return;
        }

        try {
            this.realtimeSubscription = supabaseClient
                .channel('global-competition')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'competition_participants',
                        filter: `competition_id=eq.${this.currentCompetition.id}`
                    },
                    (payload) => {
                        console.log('📡 Real-time leaderboard update received');
                        this.handleRealtimeUpdate(payload);
                    }
                )
                .subscribe();

            console.log('📡 Real-time subscriptions enabled');

        } catch (error) {
            console.error('Error setting up real-time updates:', error);
        }
    }

    // Handle real-time updates
    handleRealtimeUpdate(payload) {
        // Invalidate cache to force refresh on next request
        this.invalidateCache();
        
        // Notify UI if leaderboard is currently visible
        if (window.leaderboardUI && window.leaderboardUI.isVisible) {
            setTimeout(() => {
                window.leaderboardUI.refreshLeaderboard();
            }, 1000); // Small delay to batch updates
        }
    }

    // Invalidate leaderboard cache
    invalidateCache() {
        this.leaderboardCache = null;
        this.cacheTimestamp = null;
    }

    // Set up monthly reset detection
    setupMonthlyResetDetection() {
        // Check for month change every hour
        setInterval(() => {
            this.checkForMonthChange();
        }, 60 * 60 * 1000); // 1 hour

        // Also check on page focus
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.checkForMonthChange(), 1000);
            }
        });
    }

    // Check if month has changed and handle reset
    async checkForMonthChange() {
        if (!this.currentCompetition) return;

        const now = new Date();
        const currentMonthStart = this.getMonthStart();
        
        // Check if current competition is for current month
        if (this.currentCompetition.start_date !== currentMonthStart) {
            console.log('📅 Month change detected, resetting global competition');
            await this.handleMonthlyReset();
        }
    }

    // Handle monthly reset
    async handleMonthlyReset() {
        try {
            // Archive current competition
            if (this.currentCompetition && this.currentCompetition.id !== 'demo') {
                await supabaseClient
                    .from('competitions')
                    .update({ is_active: false })
                    .eq('id', this.currentCompetition.id);
            }

            // Create new month's competition
            const now = new Date();
            await this.createMonthlyGlobalCompetition(now.getFullYear(), now.getMonth() + 1);

            // Clear cache
            this.invalidateCache();
            
            // Refresh UI if visible
            if (window.leaderboardUI && window.leaderboardUI.isVisible) {
                window.leaderboardUI.refreshAll();
            }

            console.log('🔄 Monthly reset completed');

        } catch (error) {
            console.error('Error handling monthly reset:', error);
        }
    }

    // Utility functions
    getCurrentMonthName() {
        return this.getMonthName(new Date().getMonth() + 1);
    }

    getMonthName(month) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[month - 1];
    }

    getMonthStart() {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
    }

    getMonthEnd() {
        const now = new Date();
        return this.getLastDayOfMonth(now.getFullYear(), now.getMonth() + 1);
    }

    getLastDayOfMonth(year, month) {
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    }

    // Get current competition info
    getCurrentCompetition() {
        return this.currentCompetition;
    }

    // Get total participants count
    getTotalParticipants() {
        return this.totalParticipants;
    }

    // Get comprehensive competition statistics
    async getCompetitionStats() {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady() || !this.currentCompetition) {
            return this.getDemoCompetitionStats();
        }

        try {
            const { data: stats, error } = await supabaseClient
                .rpc('get_competition_stats', {
                    p_competition_id: this.currentCompetition.id
                });

            if (error) throw error;

            if (stats && stats.length > 0) {
                const result = stats[0];
                return {
                    totalParticipants: result.total_participants || 0,
                    activeParticipants: result.active_participants || 0,
                    totalGamesPlayed: result.total_games_played || 0,
                    averageScore: result.average_score || 0,
                    highestScore: result.highest_score || 0,
                    daysRemaining: result.days_remaining || 0
                };
            }

            return this.getDemoCompetitionStats();

        } catch (error) {
            console.error('Error loading competition stats:', error);
            return this.getDemoCompetitionStats();
        }
    }

    // Get demo competition statistics
    getDemoCompetitionStats() {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysRemaining = Math.max(0, Math.ceil((endOfMonth - now) / (24 * 60 * 60 * 1000)));

        return {
            totalParticipants: 1234,
            activeParticipants: 987,
            totalGamesPlayed: 12456,
            averageScore: 78.5,
            highestScore: 495.2,
            daysRemaining: daysRemaining
        };
    }

    // Check if competition system is ready
    isReady() {
        return this.isInitialized;
    }

    // Cleanup subscriptions
    destroy() {
        if (this.realtimeSubscription) {
            this.realtimeSubscription.unsubscribe();
        }
    }
}

// Create singleton instance
const globalCompetitionManager = new GlobalCompetitionManager();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.GlobalCompetitionManager = globalCompetitionManager;
}