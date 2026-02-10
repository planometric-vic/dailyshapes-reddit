// Competition System for Daily Shapes v4.0
// CUSTOM COMPETITIONS ONLY - No Global Competition
// Handles user-generated competitions, invites, and leaderboards

class CompetitionManager {
    constructor() {
        this.currentCompetitions = new Map();
        this.userCompetitions = [];
        this.currentLeaderboard = null;
        this.isInitialized = false;
        
        // Bind methods
        this.createCompetition = this.createCompetition.bind(this);
        this.joinCompetition = this.joinCompetition.bind(this);
        this.submitScore = this.submitScore.bind(this);
    }
    
    /**
     * Initialize competition system
     */
    async initialize() {
        console.log('🏆 Initializing Custom Competition System...');
        
        try {
            this.isInitialized = true;
            
            // Only load user competitions if authenticated
            if (window.AuthService?.currentUser) {
                await this.loadUserCompetitions();
            } else {
                console.log('ℹ️ User not authenticated - competitions require login');
            }
            
            console.log('✅ Competition system initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize competitions:', error);
            return false;
        }
    }
    
    /**
     * Load user's competitions
     */
    async loadUserCompetitions() {
        try {
            if (!window.AuthService?.currentUser) {
                console.log('ℹ️ No user logged in');
                return;
            }
            
            const userId = window.AuthService.currentUser.id;
            
            // Get competitions user is participating in
            const { data, error } = await SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    competition_id,
                    joined_at,
                    total_score,
                    average_score,
                    days_played,
                    competitions (
                        id,
                        name,
                        description,
                        start_date,
                        end_date,
                        creator_id,
                        is_public,
                        invite_code,
                        is_active,
                        max_participants,
                        competition_participants (count)
                    )
                `)
                .eq('user_id', userId)
                .eq('competitions.is_active', true)
                .order('joined_at', { ascending: false });
            
            if (error) {
                console.error('❌ Failed to load user competitions:', error);
                return;
            }
            
            this.userCompetitions = data || [];
            console.log(`✅ Loaded ${this.userCompetitions.length} user competitions`);
            
        } catch (error) {
            console.error('❌ Failed to load user competitions:', error);
        }
    }
    
    /**
     * Create a new custom competition
     */
    async createCompetition(competitionData) {
        console.log('🎯 Creating new custom competition:', competitionData);
        
        if (!window.AuthService?.currentUser) {
            throw new Error('Must be logged in to create competitions');
        }
        
        const creatorId = window.AuthService.currentUser.id;
        
        try {
            // Generate a unique invite code
            const inviteCode = this.generateInviteCode();
            
            // Create competition
            const { data, error } = await SupabaseConfig.client
                .from('competitions')
                .insert([{
                    name: competitionData.name,
                    description: competitionData.description || '',
                    creator_id: creatorId,
                    start_date: competitionData.startDate,
                    end_date: competitionData.endDate,
                    competition_type: 'custom',
                    is_public: competitionData.isPublic !== false,
                    is_active: true,
                    invite_code: inviteCode,
                    max_participants: competitionData.maxParticipants || null,
                    scoring_type: competitionData.scoringType || 'cumulative',
                    min_days_required: competitionData.minDaysRequired || 1
                }])
                .select()
                .single();
            
            if (error) {
                console.error('❌ Failed to create competition:', error);
                throw error;
            }
            
            // Auto-join creator to competition
            await this.joinCompetition(data.id, creatorId);
            
            console.log('✅ Created competition:', data);
            return data;
            
        } catch (error) {
            console.error('❌ Failed to create competition:', error);
            throw error;
        }
    }
    
    /**
     * Join a competition
     */
    async joinCompetition(competitionId, userId = null) {
        const participantId = userId || window.AuthService?.currentUser?.id;
        
        if (!participantId) {
            throw new Error('Must be logged in to join competitions');
        }
        
        try {
            // Check if already joined
            const { data: existing } = await SupabaseConfig.client
                .from('competition_participants')
                .select('id')
                .eq('competition_id', competitionId)
                .eq('user_id', participantId)
                .maybeSingle();
            
            if (existing) {
                console.log('ℹ️ Already joined this competition');
                return { success: true, message: 'Already joined' };
            }
            
            // Join competition
            const { data, error } = await SupabaseConfig.client
                .from('competition_participants')
                .insert([{
                    competition_id: competitionId,
                    user_id: participantId,
                    total_score: 0,
                    days_played: 0
                }])
                .select()
                .single();
            
            if (error) {
                console.error('❌ Failed to join competition:', error);
                throw error;
            }
            
            console.log('✅ Joined competition:', competitionId);
            
            // Reload user competitions
            await this.loadUserCompetitions();
            
            return { success: true, data };
            
        } catch (error) {
            console.error('❌ Failed to join competition:', error);
            throw error;
        }
    }
    
    /**
     * Join competition by invite code
     */
    async joinByInviteCode(inviteCode) {
        console.log('🔑 Joining competition with invite code:', inviteCode);
        
        if (!window.AuthService?.currentUser) {
            throw new Error('Must be logged in to join competitions');
        }
        
        try {
            // Find competition by invite code
            const { data: competition, error } = await SupabaseConfig.client
                .from('competitions')
                .select('*')
                .eq('invite_code', inviteCode.toUpperCase())
                .eq('is_active', true)
                .single();
            
            if (error || !competition) {
                throw new Error('Invalid or expired invite code');
            }
            
            // Check if competition is full
            if (competition.max_participants) {
                const { count } = await SupabaseConfig.client
                    .from('competition_participants')
                    .select('id', { count: 'exact' })
                    .eq('competition_id', competition.id);
                
                if (count >= competition.max_participants) {
                    throw new Error('Competition is full');
                }
            }
            
            // Join the competition
            const result = await this.joinCompetition(competition.id);
            
            return { 
                success: true, 
                competition: competition,
                ...result
            };
            
        } catch (error) {
            console.error('❌ Failed to join by invite code:', error);
            throw error;
        }
    }
    
    /**
     * Submit score to competitions
     */
    async submitScore(dailyScore, date = null) {
        console.log('📊 Submitting score to competitions:', dailyScore);
        
        if (!window.AuthService?.currentUser) {
            console.log('ℹ️ No user logged in - skipping competition submission');
            return;
        }
        
        const userId = window.AuthService.currentUser.id;
        const scoreDate = date || new Date().toISOString().split('T')[0];
        
        try {
            // Get all active competitions user is in
            const activeCompetitions = this.userCompetitions.filter(comp => {
                const competition = comp.competitions;
                if (!competition || !competition.is_active) return false;

                const scoreDateTime = new Date(scoreDate);
                const startDate = new Date(competition.start_date);
                const endDateObj = new Date(competition.end_date);
                const endOfEndDate = new Date(endDateObj);
                endOfEndDate.setHours(23, 59, 59, 999); // End of the end date

                return scoreDateTime >= startDate && scoreDateTime <= endOfEndDate;
            });
            
            console.log(`📊 Submitting to ${activeCompetitions.length} active competitions`);
            
            // Submit to each competition
            for (const comp of activeCompetitions) {
                try {
                    await this.submitToCompetition(
                        comp.competition_id, 
                        userId, 
                        dailyScore, 
                        scoreDate
                    );
                } catch (error) {
                    console.error(`Failed to submit to competition ${comp.competition_id}:`, error);
                }
            }
            
            // Reload competitions to get updated scores
            await this.loadUserCompetitions();
            
        } catch (error) {
            console.error('❌ Failed to submit scores:', error);
        }
    }
    
    /**
     * Submit score to specific competition
     */
    async submitToCompetition(competitionId, userId, score, date) {
        try {
            // Update participant's score
            const { data: participant } = await SupabaseConfig.client
                .from('competition_participants')
                .select('total_score, days_played')
                .eq('competition_id', competitionId)
                .eq('user_id', userId)
                .maybeSingle();
            
            if (!participant) {
                console.warn('Not a participant in competition:', competitionId);
                return;
            }
            
            // Update cumulative score and days played
            const newTotalScore = (participant.total_score || 0) + score;
            const newDaysPlayed = (participant.days_played || 0) + 1;
            const newAverage = newTotalScore / newDaysPlayed;
            
            const { error } = await SupabaseConfig.client
                .from('competition_participants')
                .update({
                    total_score: newTotalScore,
                    days_played: newDaysPlayed,
                    average_score: newAverage,
                    last_score_date: date
                })
                .eq('competition_id', competitionId)
                .eq('user_id', userId);
            
            if (error) {
                console.error('Failed to update competition score:', error);
                throw error;
            }
            
            console.log(`✅ Score submitted to competition ${competitionId}`);
            
        } catch (error) {
            console.error('Failed to submit to competition:', error);
            throw error;
        }
    }
    
    /**
     * Get leaderboard for a competition
     */
    async getLeaderboard(competitionId, limit = 100) {
        try {
            const { data, error } = await SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    user_id,
                    total_score,
                    average_score,
                    days_played,
                    users (
                        id,
                        username,
                        display_name
                    )
                `)
                .eq('competition_id', competitionId)
                .order('total_score', { ascending: false })
                .limit(limit);
            
            if (error) {
                console.error('Failed to get leaderboard:', error);
                throw error;
            }
            
            return data;
            
        } catch (error) {
            console.error('Failed to get leaderboard:', error);
            throw error;
        }
    }
    
    /**
     * Get user's active competitions
     */
    getActiveCompetitions() {
        const now = new Date();

        return this.userCompetitions.filter(comp => {
            const competition = comp.competitions;
            if (!competition || !competition.is_active) return false;

            const endDateObj = new Date(competition.end_date);
            const endOfEndDate = new Date(endDateObj);
            endOfEndDate.setHours(23, 59, 59, 999); // End of the end date

            return now <= endOfEndDate; // Include competitions up to end of end date
        });
    }
    
    /**
     * Generate unique invite code
     */
    generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    /**
     * Leave a competition
     */
    async leaveCompetition(competitionId) {
        if (!window.AuthService?.currentUser) {
            throw new Error('Must be logged in');
        }
        
        try {
            const { error } = await SupabaseConfig.client
                .from('competition_participants')
                .delete()
                .eq('competition_id', competitionId)
                .eq('user_id', window.AuthService.currentUser.id);
            
            if (error) {
                console.error('Failed to leave competition:', error);
                throw error;
            }
            
            // Reload competitions
            await this.loadUserCompetitions();
            
            console.log('✅ Left competition:', competitionId);
            return { success: true };
            
        } catch (error) {
            console.error('Failed to leave competition:', error);
            throw error;
        }
    }
}

// Create singleton instance
const competitionManager = new CompetitionManager();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CompetitionManager = competitionManager;
}

console.log('✨ Custom Competition System loaded');