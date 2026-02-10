/**
 * Daily Shapes v4.0 Competition Management System
 * Handles global competitions, user-generated competitions, leaderboards, and competition builder
 */

class CompetitionManager {
    constructor() {
        this.currentCompetitions = new Map();
        this.globalCompetition = null;
        this.userCompetitions = [];
        this.currentLeaderboard = null;
        this.competitionCache = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize competition system
     */
    async initialize() {
        if (this.isInitialized) {
            return; // Prevent multiple initializations
        }
        
        console.log('🏆 Initializing Competition System...');
        try {
            this.isInitialized = true;

            // Ensure global competition exists and is current
            await this.ensureGlobalCompetitionExists();
            await this.loadGlobalCompetition();

            // Load user competitions
            if (window.AuthService?.currentUser) {
                await this.loadUserCompetitions();
                await this.autoJoinGlobalCompetition(window.AuthService.currentUser.id);
            } else {
                console.log('ℹ️ User not authenticated - loading guest mode');
            }

            // Set up monthly check for global competition reset
            this.setupMonthlyCheck();
            
            console.log('✅ Competition system initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize competition system:', error);
            this.isInitialized = false; // Allow retry on error
            // Don't throw error - allow system to continue working
        }
    }

    /**
     * Set up periodic check for monthly global competition reset
     */
    setupMonthlyCheck() {
        // Check every hour if we've entered a new month
        this.monthlyCheckInterval = setInterval(async () => {
            try {
                const currentDate = new Date();
                const currentMonth = currentDate.getMonth();
                const currentYear = currentDate.getFullYear();
                
                // Get the last known month/year from localStorage
                const lastCheckKey = 'ds_last_global_comp_check';
                const lastCheck = localStorage.getItem(lastCheckKey);
                const lastCheckData = lastCheck ? JSON.parse(lastCheck) : null;
                
                // If month has changed, ensure global competition is current
                if (!lastCheckData || 
                    lastCheckData.month !== currentMonth || 
                    lastCheckData.year !== currentYear) {
                    
                    console.log(`🗓️ New month detected: ${currentMonth + 1}/${currentYear}`);
                    console.log(`🏆 Checking for global competition reset...`);
                    
                    // Update global competition for new month
                    await this.ensureGlobalCompetitionExists();
                    
                    // Auto-join current user if authenticated
                    if (window.AuthService?.currentUser) {
                        await this.autoJoinGlobalCompetition(window.AuthService.currentUser.id);
                    }
                    
                    // Store the current month/year
                    localStorage.setItem(lastCheckKey, JSON.stringify({
                        month: currentMonth,
                        year: currentYear,
                        timestamp: Date.now()
                    }));
                    
                    console.log(`✅ Global competition updated for new month`);
                }
            } catch (error) {
                console.error('❌ Error in monthly competition check:', error);
            }
        }, 60 * 60 * 1000); // Check every hour
        
        // Also perform initial check on startup
        setTimeout(async () => {
            try {
                const currentDate = new Date();
                const currentMonth = currentDate.getMonth();
                const currentYear = currentDate.getFullYear();
                
                const lastCheckKey = 'ds_last_global_comp_check';
                const lastCheck = localStorage.getItem(lastCheckKey);
                const lastCheckData = lastCheck ? JSON.parse(lastCheck) : null;
                
                if (!lastCheckData || 
                    lastCheckData.month !== currentMonth || 
                    lastCheckData.year !== currentYear) {
                    
                    console.log(`🗓️ Initial monthly check: ${currentMonth + 1}/${currentYear}`);
                    localStorage.setItem(lastCheckKey, JSON.stringify({
                        month: currentMonth,
                        year: currentYear,
                        timestamp: Date.now()
                    }));
                }
            } catch (error) {
                console.error('❌ Error in initial monthly check:', error);
            }
        }, 5000);
    }

    /**
     * Ensure global monthly competition exists for current month
     */
    async ensureGlobalCompetitionExists() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const competitionName = `${monthNames[currentMonth].toUpperCase()} GLOBAL 🌍`;
        
        // First, check if we need to deactivate old global competitions from previous months
        await this.deactivateOldGlobalCompetitions(currentMonth, currentYear);
        
        // Check if global competition already exists for this month
        const { data: existingCompetition, error } = await SupabaseConfig.client
            .from('competitions')
            .select('*')
            .eq('competition_type', 'global')
            .eq('is_global', true)
            .eq('name', competitionName)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error checking for existing global competition:', error);
            return;
        }
        
        if (!existingCompetition) {
            // Create new global competition for current month
            const startDate = new Date(currentYear, currentMonth, 1);
            const endDate = new Date(currentYear, currentMonth + 1, 0);
            
            const newCompetition = {
                name: competitionName,
                description: `Official Daily Shapes global competition for ${monthNames[currentMonth]} ${currentYear}. Compete with players worldwide! Scores reset monthly.`,
                competition_type: 'global',
                is_global: true,
                is_public: true,
                is_active: true,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                min_participants: 1,
                scoring_method: 'average_score',
                allow_late_entries: true,
                require_consecutive_days: false,
                minimum_days_to_qualify: 1
            };
            
            const { data: createdCompetition, error: createError } = await SupabaseConfig.client
                .from('competitions')
                .insert([newCompetition])
                .select()
                .single();
            
            if (createError) {
                console.error('❌ Failed to create global competition:', createError);
                return;
            }
            
            this.globalCompetition = createdCompetition;
            console.log(`✅ Created NEW global competition for ${monthNames[currentMonth]}: ${competitionName}`);
            console.log(`🔄 All players start fresh with 0 scores for the new month!`);
        } else {
            this.globalCompetition = existingCompetition;
            console.log(`✅ Found existing global competition: ${competitionName}`);
        }

        // Fetch participant count for global competition
        await this.fetchParticipantCounts();
    }

    /**
     * Deactivate old global competitions from previous months
     */
    async deactivateOldGlobalCompetitions(currentMonth, currentYear) {
        try {
            // Calculate the start of current month
            const currentMonthStart = new Date(currentYear, currentMonth, 1);
            const currentMonthStartString = currentMonthStart.toISOString().split('T')[0];
            
            // Deactivate all global competitions that don't cover the current month
            const { error } = await SupabaseConfig.client
                .from('competitions')
                .update({
                    is_active: false
                })
                .eq('competition_type', 'global')
                .eq('is_global', true)
                .eq('is_active', true)
                .lt('end_date', currentMonthStartString);
            
            if (error) {
                console.error('❌ Error deactivating old global competitions:', error);
            } else {
                console.log(`✅ Deactivated old global competitions before ${currentMonthStartString}`);
            }
        } catch (error) {
            console.error('❌ Error in deactivateOldGlobalCompetitions:', error);
        }
    }

    /**
     * Auto-join user to global competition if authenticated
     */
    async autoJoinGlobalCompetition(userId) {
        if (!this.globalCompetition || !userId) {
            console.log('ℹ️ No global competition available or user not authenticated');
            return;
        }

        try {
            // Check if user is already a participant
            const { data: existingParticipation, error: checkError } = await SupabaseConfig.client
                .from('competition_participants')
                .select('id')
                .eq('competition_id', this.globalCompetition.id)
                .eq('user_id', userId)
                .eq('status', 'active')
                .single();

            if (existingParticipation) {
                console.log('✅ User already joined global competition');
                return;
            }

            // Auto-join user to global competition
            const { error: joinError } = await SupabaseConfig.client
                .from('competition_participants')
                .insert({
                    competition_id: this.globalCompetition.id,
                    user_id: userId,
                    total_score: 0,
                    days_played: 0
                });

            if (joinError) {
                console.error('❌ Error auto-joining global competition:', joinError);
                return;
            }

            console.log('✅ User auto-joined global competition');

            // Refresh participant counts
            await this.fetchParticipantCounts();

        } catch (error) {
            console.error('❌ Error in autoJoinGlobalCompetition:', error);
        }
    }

    /**
     * Load global competition data
     */
    async loadGlobalCompetition() {
        try {
            const { data, error } = await SupabaseConfig.client
                .from('competitions')
                .select('*')
                .eq('is_global', true)
                .eq('status', 'active')
                .single();

            if (error) {
                if (error.code !== 'PGRST116') { // Not found error is expected if no global comp exists
                    console.error('❌ Error loading global competition:', error);
                }
                this.globalCompetition = null;
                return;
            }

            this.globalCompetition = data;
            console.log('✅ Global competition loaded:', data.name);

            // Fetch participant count for global competition
            await this.fetchParticipantCounts();

        } catch (error) {
            console.error('❌ Error loading global competition:', error);
            this.globalCompetition = null;
        }
    }

    /**
     * Load user's participated competitions
     */
    async loadUserCompetitions(userId = null) {
        if (!userId && window.AuthService?.currentUser) {
            userId = window.AuthService.currentUser.id;
        }

        if (!userId) return;

        const { data, error } = await SupabaseConfig.client
            .from('competition_participants')
            .select(`
                id,
                total_score,
                average_score,
                days_played,
                rank,
                competitions!inner(
                    id,
                    name,
                    description,
                    start_date,
                    end_date,
                    is_active,
                    is_global,
                    max_participants,
                    status,
                    competition_type
                )
            `)
            .eq('user_id', userId)
            .eq('competitions.is_active', true)
            .in('competitions.status', ['active', 'upcoming']);

        if (error) {
            console.error('❌ Error loading user competitions:', error);
            return;
        }

        this.userCompetitions = data || [];

        // Fetch participant counts for each competition
        await this.fetchParticipantCounts();
    }

    /**
     * Fetch participant counts for all competitions efficiently
     */
    async fetchParticipantCounts() {
        try {
            // Get participant counts for ALL competitions in a single query
            const { data, error } = await SupabaseConfig.client
                .from('competition_participants')
                .select('competition_id');

            if (error) {
                console.error('❌ Error fetching participant counts:', error);
                return {};
            }

            // Count participants per competition
            const participantCounts = {};
            if (data) {
                data.forEach(participant => {
                    participantCounts[participant.competition_id] =
                        (participantCounts[participant.competition_id] || 0) + 1;
                });
            }

            // Store counts on competition objects
            if (this.globalCompetition) {
                this.globalCompetition.participant_count = participantCounts[this.globalCompetition.id] || 0;
            }

            if (this.userCompetitions) {
                this.userCompetitions.forEach(participation => {
                    if (participation.competitions) {
                        participation.competitions.participant_count =
                            participantCounts[participation.competitions.id] || 0;
                    }
                });
            }

            console.log('✅ Participant counts fetched:', participantCounts);
            return participantCounts;

        } catch (error) {
            console.error('❌ Error in fetchParticipantCounts:', error);
            return {};
        }
    }

    /**
     * Create new user competition
     */
    async createCompetition(competitionData, creatorId) {
        try {
            console.log('🏗️ Creating competition for user:', creatorId);
            console.log('📋 Competition data received:', competitionData);
            
            // Verify user is authenticated
            if (!creatorId) {
                throw new Error('Creator ID is required - user must be authenticated');
            }
            
            const competition = {
                name: competitionData.name,
                description: competitionData.description || '',
                creator_id: creatorId,
                competition_type: 'custom',
                is_global: false,
                is_public: competitionData.isPublic !== false,
                is_active: true,
                start_date: competitionData.startDate,
                end_date: competitionData.endDate,
                min_participants: competitionData.minParticipants || 2,
                scoring_method: competitionData.scoringMethod || 'average_score',
                allow_late_entries: competitionData.allowLateEntries !== false,
                require_consecutive_days: competitionData.requireConsecutiveDays === true,
                minimum_days_to_qualify: competitionData.minimumDays || 1
            };
            
            console.log('📝 Creating competition with data:', competition);
            
            const { data, error } = await SupabaseConfig.client
                .from('competitions')
                .insert([competition])
                .select()
                .single();
            
            if (error) {
                console.error('❌ Failed to create competition:', error);
                console.error('❌ Competition data that failed:', competition);
                console.error('❌ Error details:', JSON.stringify(error, null, 2));
                throw error;
            }
            
            if (!data) {
                console.error('❌ No data returned from competition creation');
                throw new Error('Competition creation returned no data');
            }
            
            console.log('✅ Competition created successfully:', data);
            
            // Auto-join creator to their competition
            await this.joinCompetition(data.id, creatorId, true);
            
            console.log('✅ Competition created successfully:', data.name);
            return data;
            
        } catch (error) {
            console.error('❌ Error creating competition:', error);
            throw error;
        }
    }

    /**
     * Ensure user exists in users table
     */
    async ensureUserExists(userId) {
        try {
            // Check if user exists in users table
            const { data: existingUser, error: checkError } = await SupabaseConfig.client
                .from('users')
                .select('id')
                .eq('id', userId)
                .single();
            
            if (!existingUser) {
                // User doesn't exist, get their data from auth and create user record
                const { data: authUser, error: authError } = await SupabaseConfig.client.auth.getUser();
                
                if (authError || !authUser?.user) {
                    console.error('❌ Could not get auth user:', authError);
                    return false;
                }
                
                const userData = {
                    id: authUser.user.id,
                    display_name: authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'Player',
                    email: authUser.user.email,
                    created_at: new Date().toISOString()
                };
                
                // Use upsert to handle potential race conditions
                const { error: upsertError } = await SupabaseConfig.client
                    .from('users')
                    .upsert([userData], { 
                        onConflict: 'id',
                        ignoreDuplicates: false 
                    });
                    
                if (upsertError) {
                    console.error('❌ Failed to create/update user record:', upsertError);
                    return false;
                }
                
                console.log('✅ Created user record for:', userData.display_name);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error ensuring user exists:', error);
            return false;
        }
    }

    /**
     * Join a competition
     */
    async joinCompetition(competitionId, userId, isAutoJoin = false) {
        try {
            // Ensure user exists in users table first
            const userExists = await this.ensureUserExists(userId);
            if (!userExists) {
                throw new Error('Failed to create or verify user record');
            }
            // Check if competition exists and is joinable
            const { data: competition, error: compError } = await SupabaseConfig.client
                .from('competitions')
                .select('*')
                .eq('id', competitionId)
                .single();
            
            if (compError || !competition) {
                throw new Error('Competition not found');
            }
            
            // Check if competition is still accepting participants
            const currentDate = new Date().toISOString().split('T')[0];
            if (competition.status === 'completed' || competition.status === 'cancelled') {
                throw new Error('Competition is no longer active');
            }
            
            if (!competition.allow_late_entries && currentDate > competition.start_date) {
                throw new Error('Competition has already started and does not allow late entries');
            }
            
            // Check if user is already participating
            const { data: existingParticipation } = await SupabaseConfig.client
                .from('competition_participants')
                .select('id')
                .eq('competition_id', competitionId)
                .eq('user_id', userId)
                .maybeSingle();
            
            if (existingParticipation) {
                console.log('ℹ️ User already participating in competition');
                return { 
                    success: true, 
                    data: existingParticipation,
                    competition: competition,
                    message: 'Already participating'
                };
            }
            
            // Add user to competition
            const participation = {
                competition_id: competitionId,
                user_id: userId,
                total_score: 0,
                days_played: 0
            };
            
            const { data, error } = await SupabaseConfig.client
                .from('competition_participants')
                .upsert([participation], { onConflict: 'competition_id,user_id' })
                .select()
                .single();
            
            if (error) {
                console.error('❌ Failed to join competition:', error);
                throw error;
            }
            
            if (!isAutoJoin) {
                console.log('✅ Successfully joined competition:', competition.name);
            } else {
                console.log('✅ Auto-joined competition:', competition.name);
            }
            
            console.log('🎯 Participation record created:', {
                competitionId: competition.id,
                competitionName: competition.name,
                userId: userId,
                participationId: data.id
            });

            // RETROACTIVE SCORE BACKFILL
            // Check if user has already played days within competition range
            // and add those scores to the competition
            console.log('🔄 Checking for existing scores to backfill...');

            try {
                const { data: backfillResult, error: backfillError } = await SupabaseConfig.client
                    .rpc('backfill_competition_scores_on_join', {
                        p_competition_id: competitionId,
                        p_user_id: userId
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

            return {
                success: true,
                data: data,
                competition: competition
            };
            
        } catch (error) {
            console.error('❌ Error joining competition:', error);
            return {
                success: false,
                error: error.message || 'Unknown error'
            };
        }
    }

    /**
     * Update competition participant scores
     */
    async updateCompetitionScores(userId, date, averageScore) {
        console.log('🏆 COMPETITION MANAGER: updateCompetitionScores called');
        console.log('   User ID:', userId);
        console.log('   Date:', date);
        console.log('   Average score:', averageScore);
        
        if (!userId || !date || averageScore === null || averageScore === undefined) {
            console.log('❌ Invalid parameters - aborting competition update');
            return;
        }
        
        try {
            console.log('📊 Fetching user competitions for score update');
            // Get all active competitions user is participating in
            const { data: participations, error } = await SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    id,
                    competition_id,
                    total_score,
                    average_score,
                    days_played,
                    competitions!inner(
                        id,
                        start_date,
                        end_date,
                        is_active
                    )
                `)
                .eq('user_id', userId);
            
            if (error || !participations) {
                console.error('❌ Error fetching user competitions:', error);
                return;
            }
            
            console.log('🔍 Found', participations.length, 'active competitions for user');
            
            if (participations.length === 0) {
                console.log('ℹ️ User is not participating in any active competitions');
                return;
            }
            
            // Update scores for each active competition
            for (const participation of participations) {
                const competition = participation.competitions;
                
                // Ensure proper date comparison by converting to Date objects
                const checkDate = new Date(date + 'T00:00:00');
                const startDate = new Date(competition.start_date + 'T00:00:00');
                const endDate = new Date(competition.end_date + 'T23:59:59');
                const isInRange = checkDate >= startDate && checkDate <= endDate;
                
                console.log('🏆 Checking competition:', competition.id);
                console.log('   Date check:', date, 'in range:', isInRange);
                console.log('   Start date:', competition.start_date, 'End date:', competition.end_date);
                console.log('   Competition active:', competition.is_active);
                
                // Check if date falls within competition period and competition is active
                if (isInRange && competition.is_active) {
                    console.log('📊 Updating competition score:', {
                        competitionId: competition.id,
                        userId: userId,
                        dailyScore: averageScore,
                        date: date
                    });
                    
                    // Update participation record using database function
                    // This automatically handles score aggregation, ranking updates, etc.
                    console.log('📊 Calling update_competition_score RPC:', {
                        competition_id: competition.id,
                        user_id: userId,
                        daily_score: averageScore,
                        type: typeof averageScore
                    });

                    const { data: rpcData, error: updateError } = await SupabaseConfig.client
                        .rpc('update_competition_score', {
                            p_competition_id: competition.id,
                            p_user_id: userId,
                            p_daily_score: parseFloat(averageScore.toFixed(1)),
                            p_date: date  // Pass the date to prevent duplicate submissions
                        });

                    if (updateError) {
                        console.error('❌ Failed to update competition scores:', updateError);
                        console.error('   Error message:', updateError.message);
                        console.error('   Error code:', updateError.code);
                        console.error('   Error details:', updateError.details);
                        console.error('   Error hint:', updateError.hint);

                        // Fallback: try manual update if RPC fails
                        console.log('🔄 Attempting manual competition participant update...');

                        // First, get the current score to add to it (not replace it)
                        const { data: currentParticipant, error: fetchError } = await SupabaseConfig.client
                            .from('competition_participants')
                            .select('total_score, days_completed')
                            .eq('competition_id', competition.id)
                            .eq('user_id', userId)
                            .maybeSingle();

                        if (fetchError) {
                            console.error('❌ Failed to fetch current participant data:', fetchError);
                        }

                        // Calculate new cumulative totals (ADD, don't replace)
                        const currentScore = currentParticipant?.total_score || 0;
                        const currentDays = currentParticipant?.days_completed || 0;
                        const newTotalScore = currentScore + averageScore;
                        const newDaysCompleted = currentDays + 1;

                        console.log('📊 Fallback calculation:', {
                            currentScore,
                            currentDays,
                            newScore: averageScore,
                            newTotalScore,
                            newDaysCompleted
                        });

                        const { error: fallbackError } = await SupabaseConfig.client
                            .from('competition_participants')
                            .upsert({
                                competition_id: competition.id,
                                user_id: userId,
                                total_score: newTotalScore,  // Use accumulated total
                                days_completed: newDaysCompleted,  // Increment days
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'competition_id,user_id'
                            });

                        if (fallbackError) {
                            console.error('❌ Fallback update also failed:', fallbackError);
                        } else {
                            console.log('✅ Fallback: Competition participant record updated manually (score accumulated correctly)');
                        }
                    } else {
                        console.log('✅ Competition score updated successfully via RPC');
                        if (rpcData) {
                            console.log('   RPC response:', rpcData);
                        }
                    }
                } else {
                    console.log('⏭️ Skipping competition (out of range or inactive)');
                }
            }
            
        } catch (error) {
            console.error('❌ Error updating competition scores:', error);
        }
    }

    /**
     * Update competition rankings
     */
    async updateCompetitionRankings(competitionId) {
        try {
            // Get all participants sorted by score
            const { data: participants, error } = await SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    id,
                    user_id,
                    total_score,
                    average_score,
                    days_played,
                    current_position,
                    users!inner(username, display_name)
                `)
                .eq('competition_id', competitionId)
                .eq('status', 'active')
                .order('average_score', { ascending: false })
                .order('days_played', { ascending: false })
                .order('joined_at', { ascending: true });
            
            if (error) {
                console.error('❌ Error fetching participants for ranking:', error);
                return;
            }
            
            // Update positions
            const updates = participants.map((participant, index) => ({
                id: participant.id,
                current_position: index + 1,
                best_position: Math.min(participant.current_position || 999999, index + 1)
            }));
            
            for (const update of updates) {
                await SupabaseConfig.client
                    .from('competition_participants')
                    .update({
                        current_position: update.current_position,
                        best_position: update.best_position
                    })
                    .eq('id', update.id);
            }
            
            console.log(`✅ Updated rankings for competition ${competitionId}`);
            
        } catch (error) {
            console.error('❌ Error updating competition rankings:', error);
        }
    }

    /**
     * Get competition leaderboard
     */
    async getCompetitionLeaderboard(competitionId, limit = 50) {
        try {
            const { data, error } = await SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    id,
                    user_id,
                    total_score,
                    average_score,
                    days_played,
                    joined_at,
                    users(username, email)
                `)
                .eq('competition_id', competitionId)
                .order('total_score', { ascending: false })
                .order('days_played', { ascending: false })
                .order('average_score', { ascending: false })
                .limit(limit);
            
            if (error) {
                console.error('❌ Error fetching leaderboard:', error);
                return [];
            }
            
            // Sort by total score (highest first), then by days played, then by average score
            const sortedData = data.sort((a, b) => {
                if (b.total_score !== a.total_score) {
                    return (b.total_score || 0) - (a.total_score || 0);
                }
                if (b.days_played !== a.days_played) {
                    return (b.days_played || 0) - (a.days_played || 0);
                }
                return (b.average_score || 0) - (a.average_score || 0);
            });

            // Add ranking and format data
            return sortedData.map((participant, index) => {
                const rank = index + 1;
                return {
                    ...participant,
                    rank: rank,
                    award: this.getAwardEmoji(rank),
                    username: participant.users?.username || 'Anonymous',
                    displayName: participant.users?.username || 'Anonymous',
                    avatarUrl: null, // No avatar URL available
                    formattedScore: participant.total_score?.toFixed(1) || '0.0',
                    current_position: rank
                };
            });
            
        } catch (error) {
            console.error('❌ Error getting leaderboard:', error);
            return [];
        }
    }

    /**
     * Get award emoji for ranking
     */
    getAwardEmoji(position) {
        switch (position) {
            case 1: return '👑';
            case 2: return '💯';
            case 3: return '🥄';
            default: return '';
        }
    }

    /**
     * Get competition by ID
     */
    async getCompetition(competitionId) {
        if (this.competitionCache.has(competitionId)) {
            return this.competitionCache.get(competitionId);
        }
        
        try {
            const { data, error } = await SupabaseConfig.client
                .from('competitions')
                .select(`
                    *,
                    users!competitions_creator_id_fkey(username)
                `)
                .eq('id', competitionId)
                .single();

            if (error) {
                console.error('❌ Error fetching competition:', error);

                if (error.code === 'PGRST116') {
                    // No rows returned - competition doesn't exist
                    console.log('ℹ️ Competition not found:', competitionId);
                    return null;
                }

                // Other error
                throw error;
            }

            if (data) {
                // Flatten the username for easier access
                if (data.users && data.users.username) {
                    data.creator_username = data.users.username;
                }
                this.competitionCache.set(competitionId, data);
            }

            return data;
            
        } catch (error) {
            console.error('❌ Failed to get competition:', error);
            return null;
        }
    }

    /**
     * Generate join link for competition
     */
    generateJoinLink(competitionId) {
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?join=${competitionId}`;
    }

    /**
     * Parse join link from URL
     */
    parseJoinLink() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('join');
    }

    /**
     * Clear join link from URL
     */
    clearJoinLink() {
        const url = new URL(window.location);
        url.searchParams.delete('join');
        window.history.replaceState({}, '', url);
    }

    /**
     * Debug method to check user's current competitions
     */
    async debugUserCompetitions(userId) {
        try {
            const { data: participations, error } = await SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    id,
                    status,
                    total_score,
                    average_score,
                    days_played,
                    competitions!inner(
                        id,
                        name,
                        is_global,
                        start_date,
                        end_date,
                        is_active
                    )
                `)
                .eq('user_id', userId);
            
            if (error) {
                console.error('❌ Error fetching user participations:', error);
                return;
            }
            
            console.log('🔍 User participations debug:', participations);
            return participations;
        } catch (error) {
            console.error('❌ Error in debugUserCompetitions:', error);
        }
    }
}

// Initialize global competition manager
window.CompetitionManager = new CompetitionManager();