// User Account Manager for Daily Shapes v4.0
// Integrates Supabase authentication with competition system

class UserAccountManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.competitions = [];
        this.initialized = false;
    }

    // Initialize the account manager
    async initialize() {
        if (this.initialized) return this.currentUser;

        try {
            // Get current user from already-initialized AuthService
            if (window.AuthService) {
                this.currentUser = window.AuthService.getCurrentUser();
            }

            // Load user profile if authenticated
            if (this.currentUser && !this.currentUser.isGuest) {
                await this.loadUserProfile();
                await this.loadUserCompetitions();
            }

            this.initialized = true;
            return this.currentUser;
        } catch (error) {
            console.error('Account manager initialization error:', error);
            return null;
        }
    }

    // ================================
    // USER PROFILE MANAGEMENT
    // ================================

    // Load complete user profile from database
    async loadUserProfile() {
        if (!this.currentUser || this.currentUser.isGuest) return null;

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode - return basic profile
            this.userProfile = {
                id: this.currentUser.id,
                username: this.currentUser.username || 'DemoUser',
                email: this.currentUser.email || 'demo@example.com',
                display_name: this.currentUser.username || 'Demo User',
                total_days_played: 0,
                current_streak: 0,
                best_streak: 0,
                competitions_created: 0,
                competitions_joined: 0,
                competitions_won: 0,
                perfect_cuts: 0,
                privacy_level: 'public',
                show_in_leaderboard: true,
                created_at: new Date().toISOString()
            };
            return this.userProfile;
        }

        try {
            const { data, error } = await SupabaseConfig.client
                .from('users')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                console.error('Error loading user profile:', error);
                return null;
            }

            // Ensure all required fields have default values
            // CRITICAL: Never allow undefined, null, or NaN - always default to 0
            const safeValue = (val) => {
                if (val === undefined || val === null || val === 'undefined' || isNaN(val) || val === '') return 0;
                const num = typeof val === 'number' ? val : parseFloat(val);
                return isNaN(num) ? 0 : num;
            };

            this.userProfile = {
                id: data.id,
                username: data.username || 'Unknown',
                email: data.email || '',
                display_name: data.display_name || data.username || 'Unknown',
                competitions_won: safeValue(data.competitions_won),
                competitions_created: safeValue(data.competitions_created),
                competitions_joined: safeValue(data.competitions_joined),
                perfect_cuts: safeValue(data.perfect_cuts),
                current_streak: safeValue(data.current_streak),
                best_streak: safeValue(data.best_streak),
                total_days_played: safeValue(data.total_days_played),
                total_score: safeValue(data.total_score),
                average_score: safeValue(data.average_score),
                privacy_level: data.privacy_level || 'public',
                show_in_leaderboard: data.show_in_leaderboard !== false,
                created_at: data.created_at || new Date().toISOString(),
                updated_at: data.updated_at || new Date().toISOString()
            };

            console.log('✅ User profile loaded with safe defaults:', {
                competitions_won: this.userProfile.competitions_won,
                current_streak: this.userProfile.current_streak,
                perfect_cuts: this.userProfile.perfect_cuts
            });
            return this.userProfile;
        } catch (error) {
            console.error('Error loading user profile:', error);
            return null;
        }
    }

    // Update user profile
    async updateUserProfile(updates) {
        if (!this.currentUser || this.currentUser.isGuest) {
            return { error: 'User not authenticated' };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode - update local profile
            if (this.userProfile) {
                Object.assign(this.userProfile, updates);
                return { success: true, data: this.userProfile };
            }
            return { error: 'Profile not loaded' };
        }

        try {
            const { data, error } = await SupabaseConfig.client
                .from('users')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating profile:', error);
                return { error: error.message };
            }

            this.userProfile = data;
            return { success: true, data: this.userProfile };
        } catch (error) {
            console.error('Error updating profile:', error);
            return { error: error.message };
        }
    }

    // Change username (with uniqueness check)
    async changeUsername(newUsername) {
        if (!newUsername || newUsername.length < 3) {
            return { error: 'Username must be at least 3 characters long' };
        }

        // Check username format
        if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
            return { error: 'Username can only contain letters, numbers, and underscores' };
        }

        // Check if username is available
        const uniqueCheck = await this.checkUsernameAvailability(newUsername);
        if (!uniqueCheck.available) {
            return { error: 'Username already taken' };
        }

        // Update username
        const updateResult = await this.updateUserProfile({ username: newUsername });
        if (updateResult.success) {
            // Update AuthService current user
            if (window.AuthService && window.AuthService.currentUser) {
                window.AuthService.currentUser.username = newUsername;
            }
            return { success: true, message: 'Username updated successfully' };
        }

        return updateResult;
    }

    // Check if username is available
    async checkUsernameAvailability(username) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode - always available
            return { available: true };
        }

        try {
            const { data, error } = await SupabaseConfig.client
                .from('users')
                .select('id')
                .eq('username', username)
                .neq('id', this.currentUser?.id || '')
                .limit(1);

            if (error) {
                console.error('Username check error:', error);
                return { available: true }; // Assume available on error
            }

            return { available: !data || data.length === 0 };
        } catch (error) {
            console.error('Username check error:', error);
            return { available: true };
        }
    }

    // ================================
    // COMPETITION MANAGEMENT
    // ================================

    // Load user's competitions
    async loadUserCompetitions() {
        if (!this.currentUser || this.currentUser.isGuest) return [];

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode
            this.competitions = [];
            return this.competitions;
        }

        try {
            // Get competitions user created
            const { data: createdCompetitions, error: createdError } = await SupabaseConfig.client
                .from('competitions')
                .select('*, competition_participants!inner(user_id)')
                .eq('creator_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            // Get competitions user joined
            const { data: joinedData, error: joinedError } = await SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    *,
                    competitions (*)
                `)
                .eq('user_id', this.currentUser.id);

            if (createdError || joinedError) {
                console.error('Error loading competitions:', createdError || joinedError);
                return [];
            }

            // Combine and deduplicate
            const allCompetitions = [
                ...(createdCompetitions || []),
                ...(joinedData?.map(p => ({ ...p.competitions, participation: p })) || [])
            ];

            // Remove duplicates by ID
            const uniqueCompetitions = allCompetitions.reduce((acc, comp) => {
                if (!acc.find(c => c.id === comp.id)) {
                    acc.push(comp);
                }
                return acc;
            }, []);

            this.competitions = uniqueCompetitions;
            return this.competitions;
        } catch (error) {
            console.error('Error loading competitions:', error);
            return [];
        }
    }

    // Create a new competition
    async createCompetition(competitionData) {
        if (!this.currentUser || this.currentUser.isGuest) {
            return { error: 'Must be signed in to create competitions' };
        }

        const {
            name,
            description,
            startDate,
            endDate,
            isPublic = true,
            maxParticipants = 100,
            scoringMethod = 'total_score',
            tags = []
        } = competitionData;

        // Validate required fields
        if (!name || !startDate || !endDate) {
            return { error: 'Name, start date, and end date are required' };
        }

        if (new Date(endDate) <= new Date(startDate)) {
            return { error: 'End date must be after start date' };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode - create mock competition
            const mockCompetition = {
                id: 'demo_comp_' + Date.now(),
                name,
                description,
                creator_id: this.currentUser.id,
                competition_type: 'custom',
                is_public: isPublic,
                start_date: startDate,
                end_date: endDate,
                max_participants: maxParticipants,
                scoring_method: scoringMethod,
                status: 'upcoming',
                tags,
                created_at: new Date().toISOString()
            };

            this.competitions.unshift(mockCompetition);
            return { success: true, data: mockCompetition };
        }

        try {
            const { data, error } = await SupabaseConfig.client
                .from('competitions')
                .insert({
                    name,
                    description,
                    creator_id: this.currentUser.id,
                    competition_type: 'custom',
                    is_public: isPublic,
                    start_date: startDate,
                    end_date: endDate,
                    max_participants: maxParticipants,
                    scoring_method: scoringMethod,
                    status: 'upcoming',
                    tags
                })
                .select()
                .single();

            if (error) {
                console.error('Competition creation error:', error);
                return { error: error.message };
            }

            // Update user profile
            await this.updateUserProfile({
                competitions_created: (this.userProfile?.competitions_created || 0) + 1
            });

            // Add to local competitions list
            this.competitions.unshift(data);

            return { success: true, data };
        } catch (error) {
            console.error('Competition creation error:', error);
            return { error: error.message };
        }
    }

    // Join a competition
    async joinCompetition(competitionId) {
        if (!this.currentUser || this.currentUser.isGuest) {
            return { error: 'Must be signed in to join competitions' };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode
            return { success: true, message: 'Joined competition (demo mode)' };
        }

        try {
            // Check if already joined
            const { data: existingParticipation } = await SupabaseConfig.client
                .from('competition_participants')
                .select('id')
                .eq('competition_id', competitionId)
                .eq('user_id', this.currentUser.id)
                .single();

            if (existingParticipation) {
                return { error: 'Already joined this competition' };
            }

            // Join the competition
            const { data, error } = await SupabaseConfig.client
                .from('competition_participants')
                .insert({
                    competition_id: competitionId,
                    user_id: this.currentUser.id,
                    status: 'active'
                })
                .select()
                .single();

            if (error) {
                console.error('Competition join error:', error);
                return { error: error.message };
            }

            // Update user profile
            await this.updateUserProfile({
                competitions_joined: (this.userProfile?.competitions_joined || 0) + 1
            });

            return { success: true, data, message: 'Successfully joined competition!' };
        } catch (error) {
            console.error('Competition join error:', error);
            return { error: error.message };
        }
    }

    // Leave a competition
    async leaveCompetition(competitionId) {
        if (!this.currentUser || this.currentUser.isGuest) {
            return { error: 'Must be signed in' };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode
            return { success: true, message: 'Left competition (demo mode)' };
        }

        try {
            const { error } = await SupabaseConfig.client
                .from('competition_participants')
                .update({ status: 'withdrawn' })
                .eq('competition_id', competitionId)
                .eq('user_id', this.currentUser.id);

            if (error) {
                console.error('Competition leave error:', error);
                return { error: error.message };
            }

            return { success: true, message: 'Successfully left competition' };
        } catch (error) {
            console.error('Competition leave error:', error);
            return { error: error.message };
        }
    }

    // Get public competitions to join
    async getPublicCompetitions(limit = 20, offset = 0) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Demo mode - return mock competitions
            return {
                data: [
                    {
                        id: 'demo_global_1',
                        name: 'Global Daily Challenge',
                        description: 'Compete with players worldwide in daily shape cutting challenges!',
                        is_global: true,
                        status: 'active',
                        start_date: '2024-01-01',
                        end_date: '2024-12-31',
                        max_participants: 10000,
                        current_participants: 1247
                    },
                    {
                        id: 'demo_weekly_1',
                        name: 'Weekly Masters Cup',
                        description: 'A week-long competition for precision cutting masters',
                        is_global: false,
                        status: 'upcoming',
                        start_date: '2024-01-22',
                        end_date: '2024-01-28',
                        max_participants: 500,
                        current_participants: 89
                    }
                ]
            };
        }

        try {
            const { data, error } = await SupabaseConfig.client
                .from('competitions')
                .select(`
                    *,
                    competition_participants (count)
                `)
                .eq('is_public', true)
                .in('status', ['upcoming', 'active'])
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                console.error('Error fetching public competitions:', error);
                return { error: error.message };
            }

            return { data: data || [] };
        } catch (error) {
            console.error('Error fetching public competitions:', error);
            return { error: error.message };
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================

    // Get current user info
    getCurrentUser() {
        return this.currentUser;
    }

    // Get user profile
    getUserProfile() {
        return this.userProfile;
    }

    // Get user competitions
    getUserCompetitions() {
        return this.competitions;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.currentUser && !this.currentUser.isGuest;
    }

    // Get user stats summary
    getUserStats() {
        if (!this.userProfile) return null;

        console.log('🎯 DEBUG: Raw user profile data:', this.userProfile);
        console.log('🎯 DEBUG: perfect_cuts field value:', this.userProfile.perfect_cuts);

        // Helper to ensure we never return undefined, null, NaN, or string "undefined"
        const safeNumber = (val) => {
            if (val === undefined || val === null || val === 'undefined' || isNaN(val)) return 0;
            return typeof val === 'number' ? val : parseInt(val) || 0;
        };

        return {
            totalDaysPlayed: safeNumber(this.userProfile.total_days_played),
            currentStreak: safeNumber(this.userProfile.current_streak),
            bestStreak: safeNumber(this.userProfile.best_streak),
            totalScore: safeNumber(this.userProfile.total_score),
            averageScore: safeNumber(this.userProfile.average_score),
            competitionsCreated: safeNumber(this.userProfile.competitions_created),
            competitionsJoined: safeNumber(this.userProfile.competitions_joined),
            competitionsWon: safeNumber(this.userProfile.competitions_won),
            perfectCuts: safeNumber(this.userProfile.perfect_cuts),
            globalRanking: this.userProfile.global_ranking || null
        };
    }

    // Refresh all user data
    async refresh() {
        if (this.currentUser && !this.currentUser.isGuest) {
            await this.loadUserProfile();
            await this.loadUserCompetitions();
        }
    }
}

// Create and export singleton instance
const userAccountManager = new UserAccountManager();

// Make globally available
if (typeof window !== 'undefined') {
    window.UserAccountManager = userAccountManager;
}

// Make userAccountManager available globally
window.userAccountManager = userAccountManager;