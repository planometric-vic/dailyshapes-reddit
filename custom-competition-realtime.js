// Real-time Updates for Custom Competitions
// Manages subscriptions and live updates for multiple custom competitions

class CustomCompetitionRealtime {
    constructor() {
        this.subscriptions = new Map();
        this.activeCompetitions = new Set();
        this.updateTimers = new Map();
        this.batchUpdateDelay = 2000; // 2 seconds
        this.maxSubscriptions = 10; // Limit concurrent subscriptions
        this.isInitialized = false;
    }

    // Initialize real-time system
    initialize() {
        console.log('📡 Initializing Custom Competition Real-time System...');
        
        this.setupGlobalListeners();
        this.isInitialized = true;
        
        console.log('✅ Custom Competition Real-time System initialized');
    }

    // Set up global event listeners
    setupGlobalListeners() {
        // Listen for authentication changes
        document.addEventListener('authStateChanged', (e) => {
            if (e.detail?.isLoggedIn) {
                this.onUserLogin();
            } else {
                this.onUserLogout();
            }
        });

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle visibility changes to optimize subscriptions
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseSubscriptions();
            } else {
                this.resumeSubscriptions();
            }
        });
    }

    // Handle user login - load their competitions
    async onUserLogin() {
        if (!window.AuthService.isLoggedIn()) return;
        
        try {
            await this.loadUserCompetitionsForSubscription();
        } catch (error) {
            console.error('Error loading user competitions for real-time:', error);
        }
    }

    // Handle user logout - cleanup subscriptions
    onUserLogout() {
        this.cleanup();
        this.activeCompetitions.clear();
    }

    // Load user's competitions and subscribe to updates
    async loadUserCompetitionsForSubscription() {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return;
        }

        const user = window.AuthService.getCurrentUser();
        if (!user || user.isGuest) return;

        try {
            // Get competitions user has joined (limit to avoid too many subscriptions)
            const { data: joinedComps } = await supabaseClient
                .from('competition_participants')
                .select('competition_id')
                .eq('user_id', user.id)
                .limit(this.maxSubscriptions);

            if (joinedComps) {
                joinedComps.forEach(comp => {
                    this.activeCompetitions.add(comp.competition_id);
                    this.subscribeToCompetition(comp.competition_id);
                });
            }

        } catch (error) {
            console.error('Error loading user competitions:', error);
        }
    }

    // Subscribe to a specific competition's updates
    subscribeToCompetition(competitionId) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return;
        }

        // Don't create duplicate subscriptions
        if (this.subscriptions.has(competitionId)) {
            return;
        }

        try {
            const subscription = supabaseClient
                .channel(`custom-competition-${competitionId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'competition_participants',
                        filter: `competition_id=eq.${competitionId}`
                    },
                    (payload) => {
                        this.handleCompetitionUpdate(competitionId, payload);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'daily_scores',
                        filter: `user_id=in.(${this.getUsersInCompetition(competitionId)})`
                    },
                    (payload) => {
                        this.handleDailyScoreUpdate(competitionId, payload);
                    }
                )
                .subscribe();

            this.subscriptions.set(competitionId, subscription);
            console.log(`📡 Subscribed to competition updates: ${competitionId}`);

        } catch (error) {
            console.error('Error subscribing to competition:', competitionId, error);
        }
    }

    // Unsubscribe from a specific competition
    unsubscribeFromCompetition(competitionId) {
        const subscription = this.subscriptions.get(competitionId);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(competitionId);
            console.log(`📡 Unsubscribed from competition: ${competitionId}`);
        }

        // Clear any pending update timers
        const timer = this.updateTimers.get(competitionId);
        if (timer) {
            clearTimeout(timer);
            this.updateTimers.delete(competitionId);
        }
    }

    // Handle competition participant updates
    handleCompetitionUpdate(competitionId, payload) {
        console.log(`📡 Competition update received for ${competitionId}:`, payload.eventType);
        
        // Batch updates to avoid too many refreshes
        this.scheduleUpdate(competitionId, 'leaderboard');
    }

    // Handle daily score updates that might affect competitions
    handleDailyScoreUpdate(competitionId, payload) {
        console.log(`📡 Daily score update for competition ${competitionId}:`, payload.eventType);
        
        // These updates can affect daily awards
        this.scheduleUpdate(competitionId, 'awards');
    }

    // Schedule batched updates to avoid excessive refreshes
    scheduleUpdate(competitionId, updateType) {
        const timerKey = `${competitionId}_${updateType}`;
        
        // Clear existing timer
        const existingTimer = this.updateTimers.get(timerKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Schedule new update
        const timer = setTimeout(() => {
            this.executeUpdate(competitionId, updateType);
            this.updateTimers.delete(timerKey);
        }, this.batchUpdateDelay);

        this.updateTimers.set(timerKey, timer);
    }

    // Execute the actual update
    executeUpdate(competitionId, updateType) {
        // Update custom leaderboard if visible
        if (window.CustomLeaderboardUI && 
            window.CustomLeaderboardUI.currentCompetitionId === competitionId && 
            window.CustomLeaderboardUI.isVisible) {
            
            if (updateType === 'leaderboard') {
                window.CustomLeaderboardUI.refresh();
            } else if (updateType === 'awards') {
                // Refresh daily awards specifically
                window.CustomLeaderboardUI.refreshDailyAwards();
            }
        }

        // Update competition management interface if visible
        if (window.CustomCompetitionManager && 
            document.getElementById('competitionManagementInterface')?.style.display !== 'none') {
            window.CustomCompetitionManager.loadUserCompetitions();
        }

        // Trigger custom event for other components
        document.dispatchEvent(new CustomEvent('customCompetitionUpdate', {
            detail: { competitionId, updateType }
        }));
    }

    // Get list of user IDs in a competition (for daily score filtering)
    getUsersInCompetition(competitionId) {
        // This would ideally be cached, but for simplicity, we'll use a placeholder
        // In a real implementation, you'd cache the participant list
        return 'select'; // Supabase will handle the filtering
    }

    // Subscribe to a competition when leaderboard is opened
    onLeaderboardOpen(competitionId) {
        if (!this.activeCompetitions.has(competitionId)) {
            this.activeCompetitions.add(competitionId);
            this.subscribeToCompetition(competitionId);
        }
    }

    // Unsubscribe from a competition when no longer needed
    onLeaderboardClose(competitionId) {
        // Keep subscription if user is still a member
        // This could be optimized to check actual usage
    }

    // Pause subscriptions when page is hidden
    pauseSubscriptions() {
        console.log('📡 Pausing competition subscriptions...');
        
        // Don't actually unsubscribe, just stop processing updates aggressively
        this.updateTimers.forEach((timer, key) => {
            clearTimeout(timer);
        });
        this.updateTimers.clear();
    }

    // Resume subscriptions when page is visible
    resumeSubscriptions() {
        console.log('📡 Resuming competition subscriptions...');
        
        // Force refresh of any visible leaderboards
        if (window.CustomLeaderboardUI && window.CustomLeaderboardUI.isVisible) {
            window.CustomLeaderboardUI.refresh();
        }
    }

    // Add a competition to active subscriptions
    addCompetition(competitionId) {
        if (!this.activeCompetitions.has(competitionId)) {
            this.activeCompetitions.add(competitionId);
            this.subscribeToCompetition(competitionId);
        }
    }

    // Remove a competition from active subscriptions
    removeCompetition(competitionId) {
        this.activeCompetitions.delete(competitionId);
        this.unsubscribeFromCompetition(competitionId);
    }

    // Get subscription status
    getSubscriptionStatus() {
        return {
            totalSubscriptions: this.subscriptions.size,
            activeCompetitions: Array.from(this.activeCompetitions),
            maxSubscriptions: this.maxSubscriptions,
            pendingUpdates: this.updateTimers.size
        };
    }

    // Force refresh all active competitions
    forceRefreshAll() {
        this.activeCompetitions.forEach(competitionId => {
            this.executeUpdate(competitionId, 'leaderboard');
        });
    }

    // Cleanup all subscriptions
    cleanup() {
        console.log('📡 Cleaning up competition subscriptions...');
        
        // Unsubscribe from all competitions
        this.subscriptions.forEach((subscription, competitionId) => {
            subscription.unsubscribe();
        });
        this.subscriptions.clear();

        // Clear all timers
        this.updateTimers.forEach((timer) => {
            clearTimeout(timer);
        });
        this.updateTimers.clear();
    }

    // Health check for subscriptions
    healthCheck() {
        const status = this.getSubscriptionStatus();
        
        console.log('📡 Competition Real-time Health Check:', {
            subscriptions: status.totalSubscriptions,
            competitions: status.activeCompetitions.length,
            pendingUpdates: status.pendingUpdates
        });

        // Reconnect if no subscriptions but should have some
        if (status.totalSubscriptions === 0 && 
            window.AuthService.isLoggedIn() && 
            status.activeCompetitions.length > 0) {
            
            console.log('📡 Reconnecting competition subscriptions...');
            this.loadUserCompetitionsForSubscription();
        }

        return status;
    }

    // Check if system is ready
    isReady() {
        return this.isInitialized;
    }
}

// Create singleton instance
const customCompetitionRealtime = new CustomCompetitionRealtime();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CustomCompetitionRealtime = customCompetitionRealtime;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => customCompetitionRealtime.initialize());
    } else {
        customCompetitionRealtime.initialize();
    }

    // Run health checks periodically
    setInterval(() => {
        if (customCompetitionRealtime.isReady()) {
            customCompetitionRealtime.healthCheck();
        }
    }, 5 * 60 * 1000); // Every 5 minutes
}