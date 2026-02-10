// Authentication Service for Daily Shapes v4.0
// Handles all authentication operations with Supabase backend

/**
 * SCORING CALCULATION METHOD
 * Daily score = average of ALL 6 attempts (all cuts)
 * NOT the average of best attempts per shape
 */

class AuthService {
    constructor() {
        this.currentUser = null;
        this.isGuest = true;
        this.guestData = this.loadGuestData();
        this.initialized = false;
    }
    
    // Initialize the authentication service
    async initialize() {
        // Prevent double initialization
        if (this.initializing) {
            console.log('🔄 AUTH SERVICE: Already initializing, waiting for completion...');
            return this.initializationPromise;
        }

        if (this.initialized) {
            console.log('✅ AUTH SERVICE: Already initialized, skipping...');
            return this.currentUser;
        }

        // Set flag and create promise to prevent race conditions
        this.initializing = true;
        this.initializationPromise = this._performInitialization();

        try {
            const result = await this.initializationPromise;
            return result;
        } finally {
            this.initializing = false;
            delete this.initializationPromise;
        }
    }

    async _performInitialization() {
        console.log('🔐 AUTH SERVICE: Starting initialization');
        console.log('   Supabase configured:', !!window.SupabaseConfig);
        console.log('   Supabase ready:', window.SupabaseConfig?.isReady());
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            console.warn('Running in demo mode - Supabase not configured');
            return this.initializeGuestMode();
        }
        
        // Wait for Supabase client to be fully initialized
        let supabaseReady = false;
        let waitAttempts = 0;
        const maxWaitAttempts = 10;
        
        while (!supabaseReady && waitAttempts < maxWaitAttempts) {
            waitAttempts++;
            if (window.SupabaseConfig.client && window.SupabaseConfig.client.auth) {
                console.log(`🔄 AUTH SERVICE: Supabase client ready on attempt ${waitAttempts}`);
                supabaseReady = true;
            } else {
                console.log(`🔄 AUTH SERVICE: Waiting for Supabase client (attempt ${waitAttempts}/${maxWaitAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        if (!supabaseReady) {
            console.error('AUTH SERVICE: Supabase client not ready after waiting');
            return this.initializeGuestMode();
        }
        
        try {
            // Use Supabase auth state listener to properly detect initial session
            console.log('🔄 AUTH SERVICE: Waiting for Supabase auth state initialization');
            
            const session = await new Promise((resolve) => {
                let resolved = false;
                let timeoutId;
                
                // Set up auth state change listener
                const { data: { subscription } } = SupabaseConfig.client.auth.onAuthStateChange((event, session) => {
                    console.log(`🔍 AUTH SERVICE: Auth event "${event}" with session:`, !!session);
                    
                    if (!resolved) {
                        if (event === 'INITIAL_SESSION') {
                            // INITIAL_SESSION can be false even if user is logged in
                            // Wait a bit to see if SIGNED_IN follows
                            if (session) {
                                // If we have a session immediately, use it
                                resolved = true;
                                clearTimeout(timeoutId);
                                subscription.unsubscribe();
                                resolve(session);
                            } else {
                                // If no session, wait a bit for SIGNED_IN event
                                console.log('🔄 AUTH SERVICE: INITIAL_SESSION had no session, waiting for SIGNED_IN...');
                            }
                        } else if (event === 'SIGNED_IN') {
                            // SIGNED_IN should have the actual session
                            resolved = true;
                            clearTimeout(timeoutId);
                            subscription.unsubscribe();
                            resolve(session);
                        }
                    }
                });
                
                // Fallback timeout in case no event fires
                timeoutId = setTimeout(() => {
                    if (!resolved) {
                        console.log('🔄 AUTH SERVICE: Timeout reached, falling back to direct session check');
                        resolved = true;
                        subscription.unsubscribe();
                        // Try one direct call as fallback
                        SupabaseConfig.client.auth.getSession().then(({ data: { session } }) => {
                            resolve(session);
                        }).catch(() => {
                            resolve(null);
                        });
                    }
                }, 3000); // 3 second timeout
            });
            
            console.log('🔐 AUTH SERVICE: Auth state result:', !!session, session ? `User: ${session.user.email}` : 'No session detected');
            
            if (session) {
                this.currentUser = session.user;
                this.isGuest = false;
                console.log('✅ User authenticated:', this.currentUser.id);
                await this.loadUserData();
            } else {
                console.log('❌ No session detected - initializing guest mode');
                this.initializeGuestMode();
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.initializeGuestMode();
        }
        
        console.log('🔐 AUTH SERVICE: Final state - isGuest:', this.isGuest, 'currentUser:', !!this.currentUser);
        this.initialized = true;
        
        // Trigger UI updates after initialization completes
        setTimeout(() => {
            if (typeof window !== 'undefined') {
                // Update button states
                if (window.updateButtonStates) {
                    console.log('🔄 Updating button states after AuthService initialization');
                    window.updateButtonStates();
                }
                
                // Trigger auth state changed event
                if (document && document.dispatchEvent) {
                    console.log('🔄 Triggering authStateChanged event');
                    document.dispatchEvent(new CustomEvent('authStateChanged'));
                }
                
                // Update menu state
                if (window.updateMenuState) {
                    window.updateMenuState();
                }
            }
        }, 100); // Small delay to ensure DOM is ready
        
        return this.currentUser;
    }
    
    // Initialize guest mode
    initializeGuestMode() {
        this.isGuest = true;
        this.currentUser = null;
        this.guestData = this.loadGuestData() || {
            id: 'guest_' + Date.now(),
            username: 'Guest',
            totalDaysPlayed: 0,
            currentStreak: 0,
            bestStreak: 0,
            scores: {}
        };
        this.saveGuestData();
        return null;
    }
    
    // ================================
    // USER MANAGEMENT
    // ================================

    // Generate a recovery code (format: XXXX-XXXX-XXXX)
    generateRecoveryCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, I, 1)
        let code = '';
        for (let i = 0; i < 12; i++) {
            if (i > 0 && i % 4 === 0) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code; // Returns format: XXXX-XXXX-XXXX
    }

    // Hash recovery code for storage (simple SHA-256)
    async hashRecoveryCode(code) {
        const encoder = new TextEncoder();
        const data = encoder.encode(code);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Create new user account
    async createUser(username, password) {
        // Generate internal email from username
        const email = `${username.toLowerCase()}@dailyshapes.local`;

        // Check username uniqueness
        const usernameCheck = await this.checkUniqueness('username', username);
        if (!usernameCheck.available) {
            return { error: 'Username already taken' };
        }
        
        // For demo mode without Supabase
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // Simulate account creation in demo mode
            this.currentUser = {
                id: 'demo_' + Date.now(),
                email: email,
                username: username,
                created_at: new Date().toISOString()
            };
            this.isGuest = false;
            
            // Save to localStorage for demo
            localStorage.setItem('ds_demo_user', JSON.stringify(this.currentUser));
            
            // Migrate guest data if exists
            if (this.guestData && this.guestData.scores) {
                await this.migrateGuestData();
            }
            
            return { data: this.currentUser };
        }
        
        try {
            // Create account with Supabase
            const { data, error } = await SupabaseConfig.client.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                        display_name: username
                    }
                }
            });

            if (error) {
                return { error: error.message };
            }

            // Check if user was created successfully
            if (data.user) {
                // Generate recovery code
                const recoveryCode = this.generateRecoveryCode();
                const hashedRecoveryCode = await this.hashRecoveryCode(recoveryCode);

                // Try to create user profile in database (non-blocking)
                try {
                    const { error: profileError } = await SupabaseConfig.client
                        .from('users')
                        .insert({
                            id: data.user.id,
                            email: email,
                            username: username,
                            email_verified: true, // Confirmed via email
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            competitions_won: 0,
                            recovery_code: hashedRecoveryCode
                        });

                    if (profileError) {
                        console.warn('Profile creation failed, but auth account created:', profileError);
                        // Continue anyway - auth account exists
                    }
                } catch (profileError) {
                    console.warn('Profile creation failed, but auth account created:', profileError);
                    // Continue anyway - auth account exists
                }

                this.currentUser = data.user;
                this.currentUser.recoveryCode = recoveryCode; // Store plaintext code temporarily for display
                this.isGuest = false;

                // Track account creation event
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'account_created', {
                        user_id: data.user.id,
                        username: username,
                        method: 'email',
                        event_category: 'user',
                        event_label: 'new_account'
                    });
                    console.log('📊 GA4: Tracked account_created event');
                }
            }

            // Migrate guest data if exists
            if (this.guestData && this.guestData.scores) {
                await this.migrateGuestData();
            }

            return {
                data: data.user,
                recoveryCode: this.currentUser.recoveryCode // Include recovery code in response
            };
        } catch (error) {
            console.error('Signup error:', error);
            return { error: error.message };
        }
    }
    
    // Authenticate user
    async loginUser(username, password) {
        // Generate internal email from username
        const email = `${username.toLowerCase()}@dailyshapes.local`;

        // For demo mode
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            const demoUser = JSON.parse(localStorage.getItem('ds_demo_user') || '{}');
            if (demoUser.username === username) {
                this.currentUser = demoUser;
                this.isGuest = false;
                return { data: demoUser };
            }
            return { error: 'Invalid credentials' };
        }

        try {
            // Verify username exists first
            const { data: userData, error: lookupError } = await SupabaseConfig.client
                .from('users')
                .select('username')
                .ilike('username', username)
                .single();

            if (lookupError || !userData) {
                return { error: 'No account found with this username. Please check your username or sign up for a new account.' };
            }
            
            // Sign in with Supabase
            const { data, error } = await SupabaseConfig.client.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                // Provide more user-friendly error messages
                if (error.message.includes('Invalid login credentials')) {
                    return { error: 'Invalid username or password. Please check your credentials and try again.' };
                } else if (error.message.includes('User not found')) {
                    return { error: 'No account found with this username. Please sign up first.' };
                }
                return { error: error.message };
            }
            
            this.currentUser = data.user;
            this.isGuest = false;

            // Fetch full user profile data including username
            const { data: profileData, error: profileError } = await SupabaseConfig.client
                .from('users')
                .select('*')
                .eq('email', data.user.email)
                .single();

            if (profileData) {
                // Merge profile data with auth user data
                this.currentUser = { ...data.user, ...profileData };
            }

            // Update last login
            await this.updateLastLogin();

            // Track account login event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'account_login', {
                    user_id: data.user.id,
                    username: profileData?.username || 'unknown',
                    method: 'email',
                    event_category: 'user',
                    event_label: 'returning_user'
                });
                console.log('📊 GA4: Tracked account_login event');
            }

            return { data: this.currentUser };
        } catch (error) {
            console.error('Login error:', error);
            return { error: error.message };
        }
    }
    
    // Logout user
    async logoutUser() {
        try {
            if (window.SupabaseConfig && window.SupabaseConfig.isReady()) {
                await SupabaseConfig.client.auth.signOut();
            }
            
            // Clear local storage
            localStorage.removeItem('ds_demo_user');
            CookieManager.delete('ds_auth_token');
            CookieManager.delete('ds_username');
            
            // Reset to guest mode
            this.initializeGuestMode();
            
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { error: error.message };
        }
    }
    
    // Update user stats
    async updateUserStats(dailyScore, streak) {
        if (this.isGuest) {
            // Update guest data
            this.guestData.totalDaysPlayed++;
            this.guestData.currentStreak = streak || 1;
            this.guestData.bestStreak = Math.max(this.guestData.bestStreak, this.guestData.currentStreak);
            this.saveGuestData();
            return { success: true };
        }
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { success: true }; // Demo mode
        }
        
        try {
            const { error } = await SupabaseConfig.client
                .from('users')
                .update({
                    total_days_played: this.currentUser.total_days_played + 1,
                    current_streak: streak,
                    best_streak: Math.max(this.currentUser.best_streak || 0, streak),
                    last_login: new Date().toISOString()
                })
                .eq('id', this.currentUser.id);
            
            if (error) {
                console.error('Stats update error:', error);
                return { error: error.message };
            }
            
            return { success: true };
        } catch (error) {
            console.error('Stats update error:', error);
            return { error: error.message };
        }
    }
    
    // Check username/email uniqueness
    async checkUniqueness(field, value) {
        // For demo mode
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            const demoUser = JSON.parse(localStorage.getItem('ds_demo_user') || '{}');
            let taken = false;

            if (field === 'email') {
                taken = demoUser.email === value;
            } else if (field === 'username') {
                // Case-insensitive username comparison
                taken = demoUser.username && demoUser.username.toLowerCase() === value.toLowerCase();
            }

            return { available: !taken };
        }
        
        try {
            let query = SupabaseConfig.client
                .from('users')
                .select('id');

            // For username, use case-insensitive comparison
            if (field === 'username') {
                query = query.ilike(field, value);
            } else {
                query = query.eq(field, value);
            }

            const { data, error } = await query.maybeSingle();
            
            if (error) {
                console.warn(`Uniqueness check error for ${field}, assuming available:`, error);
                return { available: true };
            }
            
            return { available: !data };
        } catch (error) {
            console.warn(`Uniqueness check error for ${field}, assuming available:`, error);
            return { available: true };
        }
    }
    
    // ================================
    // SCORE MANAGEMENT
    // ================================
    
    // Get existing daily score record
    async getExistingDailyScore(date) {
        if (this.isGuest) {
            return this.guestData.scores?.[date] || null;
        }
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return null; // Demo mode
        }
        
        try {
            const { data, error } = await SupabaseConfig.client
                .from('daily_scores')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .eq('date', date)
                .single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Error fetching existing score:', error);
                return null;
            }
            
            return data;
        } catch (error) {
            console.error('Error fetching existing score:', error);
            return null;
        }
    }

    // Save daily game results
    async saveDailyScore(date, shapeScores, mechanic) {
        console.log('🚀 SAVE DAILY SCORE - Starting process');
        console.log('   Input date:', date);
        console.log('   Input shapeScores:', JSON.stringify(shapeScores, null, 2));
        console.log('   Input mechanic:', mechanic);
        console.log('   Current user:', this.currentUser ? this.currentUser.id : 'No user');
        console.log('   Is guest:', this.isGuest);
        console.log('   Supabase ready:', window.SupabaseConfig?.isReady());
        
        // Calculate NEW ADDITIVE score: sum of smaller percentages + bonuses for perfect 50/50 cuts
        // This replaces the old "average out of 100" system
        let totalScore = 0;
        const allAttemptScores = [];

        for (let i = 1; i <= 3; i++) {
            const shapeKey = `shape${i}`;
            if (shapeScores[shapeKey]) {
                const attempt1 = shapeScores[shapeKey].attempt1;
                const attempt2 = shapeScores[shapeKey].attempt2;

                // Add both attempts to the total score
                if (attempt1 !== null) {
                    allAttemptScores.push(attempt1);
                    totalScore += attempt1;
                    // Add +50 bonus for perfect cuts
                    if (attempt1 === 50) {
                        totalScore += 50;
                    }
                }
                if (attempt2 !== null) {
                    allAttemptScores.push(attempt2);
                    totalScore += attempt2;
                    // Add +50 bonus for perfect cuts
                    if (attempt2 === 50) {
                        totalScore += 50;
                    }
                }
            }
        }

        // The new score is the additive total (not an average)
        const additiveScore = totalScore;

        console.log('🏆 NEW ADDITIVE SCORING (Sum of smaller percentages + bonuses):');
        console.log('   Individual cut scores:', allAttemptScores);
        console.log('   Perfect cuts (50s):', allAttemptScores.filter(s => s === 50).length);
        console.log('   Total additive score:', additiveScore);
        
        const scoreData = {
            date: date,
            shape1_attempt1: shapeScores.shape1?.attempt1 || null,
            shape1_attempt2: shapeScores.shape1?.attempt2 || null,
            shape2_attempt1: shapeScores.shape2?.attempt1 || null,
            shape2_attempt2: shapeScores.shape2?.attempt2 || null,
            shape3_attempt1: shapeScores.shape3?.attempt1 || null,
            shape3_attempt2: shapeScores.shape3?.attempt2 || null,
            mechanic_used: mechanic ? mechanic.substring(0, 20) : null  // Truncate to 20 chars for database field
            // NOTE: Removed daily_average field - will be calculated by database trigger
        };
        
        if (this.isGuest) {
            console.log('🏠 Saving to guest data (not Supabase)');
            // Save to guest data
            if (!this.guestData.scores) this.guestData.scores = {};
            this.guestData.scores[date] = scoreData;
            this.saveGuestData();
            return { success: true, additiveScore };
        }
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            console.log('🔄 Demo mode - Supabase not ready');
            return { success: true, additiveScore }; // Demo mode
        }
        
        try {
            scoreData.user_id = this.currentUser.id;
            scoreData.completed_at = new Date().toISOString();

            console.log('🔍 AUTH SERVICE DEBUG: Attempting to save score to daily_scores');
            console.log('   User ID:', this.currentUser.id);
            console.log('   Score data:', JSON.stringify(scoreData, null, 2));
            console.log('   NOTE: daily_average will be calculated by database trigger');

            // SAFEGUARD: Check if a score already exists for this date
            const { data: existingScore, error: checkError } = await SupabaseConfig.client
                .from('daily_scores')
                .select('id, date, completed_at')
                .eq('user_id', this.currentUser.id)
                .eq('date', date)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error('Error checking existing score:', checkError);
                return { error: checkError.message };
            }

            if (existingScore) {
                console.warn('⚠️ Score already exists for this date - REFUSING to overwrite');
                console.warn('   Existing score date:', existingScore.date);
                console.warn('   Existing score completed at:', existingScore.completed_at);
                return {
                    success: true,
                    additiveScore,
                    alreadyExists: true,
                    message: 'Score for this date already exists and will not be overwritten'
                };
            }

            // No existing score - safe to insert
            console.log('✅ No existing score found - proceeding with insert');
            const { data, error } = await SupabaseConfig.client
                .from('daily_scores')
                .insert(scoreData);

            if (error) {
                console.error('Score save error:', error);
                return { error: error.message };
            }

            console.log('✅ Score inserted successfully - updating streak and profile stats');

            // Update user streak (ONLY called for new scores, never for duplicates)
            await this.updateUserStreak(date);

            // Update user profile with new additive scoring (ONLY called for new scores)
            await this.updateUserProfileScores(additiveScore);

            // Track daily game completion event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'daily_game_completed', {
                    user_id: this.currentUser.id,
                    date: date,
                    additive_score: additiveScore,
                    mechanic: mechanic,
                    event_category: 'gameplay',
                    event_label: 'daily_completion'
                });
                console.log('📊 GA4: Tracked daily_game_completed event');
            }

            return { success: true, data, additiveScore };
        } catch (error) {
            console.error('Score save error:', error);
            return { error: error.message };
        }
    }
    
    // Get user's score history
    async getUserScores(dateRange) {
        if (this.isGuest) {
            return { data: this.guestData.scores || {} };
        }
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { data: {} }; // Demo mode
        }
        
        try {
            let query = SupabaseConfig.client
                .from('daily_scores')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('date', { ascending: false });
            
            if (dateRange) {
                if (dateRange.start) query = query.gte('date', dateRange.start);
                if (dateRange.end) query = query.lte('date', dateRange.end);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('Score fetch error:', error);
                return { error: error.message };
            }
            
            return { data };
        } catch (error) {
            console.error('Score fetch error:', error);
            return { error: error.message };
        }
    }
    
    // Update user profile scores using STANDARD scoring method
    async updateUserProfileScores(newDailyScore) {
        if (this.isGuest || !newDailyScore) {
            return { success: true };
        }
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { success: true }; // Demo mode
        }
        
        try {
            console.log('🔄 Recalculating user profile scores using STANDARD method...');

            // Get ALL daily scores for this user to recalculate from scratch
            const { data: allScores, error: fetchError } = await SupabaseConfig.client
                .from('daily_scores')
                .select('date, shape1_attempt1, shape1_attempt2, shape2_attempt1, shape2_attempt2, shape3_attempt1, shape3_attempt2')
                .eq('user_id', this.currentUser.id)
                .order('date', { ascending: false });

            if (fetchError) {
                console.error('Error fetching user daily scores:', fetchError);
                return { error: fetchError.message };
            }

            console.log(`📊 Found ${allScores.length} daily score records for recalculation`);

            // Group by date to ensure only ONE score per day is counted
            const scoresByDate = new Map();
            for (const scoreRecord of allScores) {
                if (!scoresByDate.has(scoreRecord.date)) {
                    scoresByDate.set(scoreRecord.date, scoreRecord);
                }
            }

            console.log(`📊 After deduplication: ${scoresByDate.size} unique days`);

            // Calculate average DAILY score (not average of individual cuts)
            const dailyScores = [];
            let totalDaysPlayed = 0;

            for (const scoreRecord of scoresByDate.values()) {
                totalDaysPlayed++;

                // Calculate total score for this day (all 6 cuts + bonuses)
                let dayTotal = 0;
                for (let i = 1; i <= 3; i++) {
                    const attempt1 = parseFloat(scoreRecord[`shape${i}_attempt1`]) || 0;
                    const attempt2 = parseFloat(scoreRecord[`shape${i}_attempt2`]) || 0;

                    dayTotal += attempt1;
                    dayTotal += attempt2;

                    // Add +50 bonus for perfect cuts
                    if (attempt1 === 50) dayTotal += 50;
                    if (attempt2 === 50) dayTotal += 50;
                }

                dailyScores.push(dayTotal);
            }

            console.log(`📈 Collected ${dailyScores.length} daily totals across ${totalDaysPlayed} days`);
            console.log(`📈 Daily scores:`, dailyScores);

            // Calculate average of daily totals
            const totalScore = dailyScores.reduce((sum, score) => sum + score, 0);
            const averageScore = dailyScores.length > 0 ? totalScore / dailyScores.length : 0;
            // Round to whole number - no decimals
            const averageScoreRounded = Math.round(averageScore);

            console.log(`📊 DAILY scoring summary:`);
            console.log(`   Total days: ${dailyScores.length}`);
            console.log(`   Total Score (all days): ${totalScore.toFixed(1)}`);
            console.log(`   Average Daily Score (raw): ${averageScore.toFixed(2)}`);
            console.log(`   Average Daily Score (rounded): ${averageScoreRounded}`);
            console.log(`   Days Played: ${totalDaysPlayed}`);

            // Update user profile with recalculated scores
            // Store average as integer (no decimal)
            const { error: updateError } = await SupabaseConfig.client
                .from('users')
                .update({
                    total_score: totalScore.toFixed(1),
                    average_score: averageScoreRounded,
                    total_days_played: totalDaysPlayed
                })
                .eq('id', this.currentUser.id);
            
            if (updateError) {
                console.error('Error updating user profile scores:', updateError);
                return { error: updateError.message };
            }

            console.log(`✅ User profile updated with STANDARD scoring: Avg ${averageScoreRounded}, Total ${totalScore.toFixed(1)}`);
            return { success: true, totalScore, averageScore: averageScoreRounded, totalDaysPlayed };
        } catch (error) {
            console.error('User profile score update error:', error);
            return { error: error.message };
        }
    }
    
    // Track perfect 50/50 cuts in daily mode only
    async trackPerfectCut() {
        if (this.isGuest || !this.currentUser) {
            console.log('🎯 Perfect cut detected but user is guest - not tracking');
            return { success: false };
        }

        // Only track perfect cuts in daily mode, not practice mode
        if (window.isPracticeMode || window.isPractiseMode) {
            console.log('🎯 Perfect cut detected in practice mode - not tracking');
            return { success: false };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            console.log('🎯 Perfect cut detected but database not ready - not tracking');
            return { success: false }; // Demo mode
        }
        
        try {
            console.log('🎯 Tracking perfect cut for user:', this.currentUser.id);
            
            // Increment perfect_cuts count in user profile
            const { error } = await SupabaseConfig.client
                .from('users')
                .update({
                    perfect_cuts: (this.currentUser.perfect_cuts || 0) + 1
                })
                .eq('id', this.currentUser.id);
            
            if (error) {
                console.error('❌ Error tracking perfect cut:', error);
                return { error: error.message };
            }
            
            // Update local user data
            this.currentUser.perfect_cuts = (this.currentUser.perfect_cuts || 0) + 1;

            // Refresh user profile in UserAccountManager to update display
            if (window.UserAccountManager) {
                await window.UserAccountManager.loadUserProfile();
                console.log('🔄 User profile refreshed after perfect cut');
            }

            console.log('✅ Perfect cut tracked successfully! Total:', this.currentUser.perfect_cuts);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error tracking perfect cut:', error);
            return { error: error.message };
        }
    }
    
    // Update global competition scores
    async updateGlobalCompetition(dailyScore) {
        if (this.isGuest) {
            return { success: true }; // Guests don't participate in global competitions
        }
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { success: true }; // Demo mode
        }
        
        try {
            // Find active global competition
            const { data: competition } = await SupabaseConfig.client
                .from('competitions')
                .select('id')
                .eq('is_global', true)
                .eq('is_active', true)
                .gte('end_date', new Date().toISOString().split('T')[0])
                .lte('start_date', new Date().toISOString().split('T')[0])
                .single();
            
            if (!competition) {
                return { success: true }; // No active global competition
            }
            
            // Update participant score
            const { error } = await SupabaseConfig.client
                .from('competition_participants')
                .upsert({
                    competition_id: competition.id,
                    user_id: this.currentUser.id,
                    total_score: dailyScore,
                    days_played: 1
                }, {
                    onConflict: 'competition_id,user_id'
                });
            
            if (error) {
                console.error('Competition update error:', error);
                return { error: error.message };
            }
            
            return { success: true };
        } catch (error) {
            console.error('Competition update error:', error);
            return { error: error.message };
        }
    }
    
    // ================================
    // GUEST MODE & MIGRATION
    // ================================
    
    // Load guest data from localStorage
    loadGuestData() {
        try {
            const data = localStorage.getItem('ds_guest_data');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading guest data:', error);
            return null;
        }
    }
    
    // Save guest data to localStorage
    saveGuestData() {
        try {
            localStorage.setItem('ds_guest_data', JSON.stringify(this.guestData));
        } catch (error) {
            console.error('Error saving guest data:', error);
        }
    }
    
    // Migrate guest data to user account
    async migrateGuestData() {
        if (!this.guestData || !this.guestData.scores) {
            return { success: true };
        }
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            // For demo mode, just clear guest data
            localStorage.removeItem('ds_guest_data');
            return { success: true };
        }
        
        try {
            // Save guest migration record
            await SupabaseConfig.client
                .from('guest_migrations')
                .insert({
                    user_id: this.currentUser.id,
                    guest_data: this.guestData,
                    migration_status: 'pending'
                });
            
            // Migrate scores
            for (const [date, scoreData] of Object.entries(this.guestData.scores)) {
                scoreData.user_id = this.currentUser.id;
                await SupabaseConfig.client
                    .from('daily_scores')
                    .upsert(scoreData, {
                        onConflict: 'user_id,date'
                    });
            }
            
            // Update migration status
            await SupabaseConfig.client
                .from('guest_migrations')
                .update({ migration_status: 'completed' })
                .eq('user_id', this.currentUser.id);
            
            // Clear guest data
            localStorage.removeItem('ds_guest_data');
            this.guestData = null;
            
            return { success: true };
        } catch (error) {
            console.error('Guest data migration error:', error);
            return { error: error.message };
        }
    }
    
    // ================================
    // HELPER FUNCTIONS
    // ================================
    
    // Update last login timestamp
    async updateLastLogin() {
        if (!this.currentUser || this.isGuest) return;
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return; // Demo mode
        }
        
        try {
            await SupabaseConfig.client
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', this.currentUser.id);
        } catch (error) {
            console.error('Last login update error:', error);
        }
    }
    
    // Update user streak based on play date
    // NOTE: This should ONLY be called when the daily game is completed (all 6 cuts done)
    async updateUserStreak(playDate) {
        if (this.isGuest) {
            // Streak calculation for guests
            // Check if this is a consecutive day from last completion
            const today = new Date().toISOString().split('T')[0];
            const lastPlayDate = this.guestData.lastPlayDate || null;

            if (playDate === today) {
                if (lastPlayDate) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];

                    // Check if last play was yesterday (consecutive)
                    if (lastPlayDate === yesterdayStr) {
                        // Continue streak
                        this.guestData.currentStreak = (this.guestData.currentStreak || 0) + 1;
                    } else if (lastPlayDate === today) {
                        // Already played today, don't increment
                        // This shouldn't happen as saveDailyScore should only be called once per day
                    } else {
                        // Streak broken, reset to 1
                        this.guestData.currentStreak = 1;
                    }
                } else {
                    // First time playing
                    this.guestData.currentStreak = 1;
                }

                this.guestData.lastPlayDate = today;
                this.guestData.bestStreak = Math.max(
                    this.guestData.bestStreak || 0,
                    this.guestData.currentStreak
                );
                this.saveGuestData();
            }
            return;
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return; // Demo mode
        }

        try {
            // Call the database function to update streak
            // The database function should:
            // 1. Check if user completed yesterday (consecutive day)
            // 2. If yes, increment current_streak by 1
            // 3. If no, reset current_streak to 1
            // 4. Update best_streak if current_streak exceeds it
            const { data, error } = await SupabaseConfig.client.rpc('update_user_streak', {
                p_user_id: this.currentUser.id,
                p_date: playDate
            });

            if (error) {
                console.error('❌ Streak update RPC failed:', error);
                console.error('   Error message:', error.message);
                console.error('   Error details:', error.details);
            } else {
                console.log('✅ Streak updated successfully via RPC');
                console.log('   RPC returned data:', data);

                // Reload user profile to get updated streak values
                if (window.UserAccountManager) {
                    await window.UserAccountManager.loadUserProfile();
                    const profile = window.UserAccountManager.getUserProfile();
                    console.log('✅ User profile reloaded with updated streak');
                    console.log('   Profile current_streak:', profile?.current_streak);
                    console.log('   Profile best_streak:', profile?.best_streak);
                    console.log('   Profile total_days_played:', profile?.total_days_played);
                }
            }
        } catch (error) {
            console.error('❌ Streak update exception:', error);
        }
    }
    
    // Load user data from database
    async loadUserData() {
        if (!this.currentUser || this.isGuest) return;
        
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return; // Demo mode
        }
        
        try {
            const { data, error } = await SupabaseConfig.client
                .from('users')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();
            
            if (data) {
                // Ensure competitions_won is never undefined
                if (data.competitions_won === undefined || data.competitions_won === null) {
                    data.competitions_won = 0;
                }
                this.currentUser = { ...this.currentUser, ...data };
            }
        } catch (error) {
            console.error('User data load error:', error);
        }
    }
    
    // Get current user info
    getCurrentUser() {
        if (this.isGuest) {
            return {
                ...this.guestData,
                isGuest: true
            };
        }

        // Ensure competitions_won is always defined
        if (this.currentUser && (this.currentUser.competitions_won === undefined || this.currentUser.competitions_won === null)) {
            this.currentUser.competitions_won = 0;
        }

        return this.currentUser;
    }
    
    // Check if user is logged in
    isLoggedIn() {
        return !this.isGuest && this.currentUser !== null;
    }

    // Check if user's email is verified

    // ================================
    // PASSWORD RESET
    // ================================

    // Send password reset magic link (username-based, no email exposure)
    async sendPasswordResetLink(username) {
        if (!username || username.trim() === '') {
            return { error: 'Please enter your username' };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { error: 'Password reset is not available in demo mode' };
        }

        try {
            // Convert username to internal email
            const email = `${username.toLowerCase()}@dailyshapes.local`;

            // Verify username exists first
            const { data: userData, error: lookupError } = await SupabaseConfig.client
                .from('users')
                .select('username')
                .ilike('username', username)
                .single();

            if (lookupError || !userData) {
                return { error: 'No account found with this username. Please check your username or create a new account.' };
            }

            console.log('📧 Sending password reset link for username:', username);

            // Send magic link to the internal email
            const { error } = await SupabaseConfig.client.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) {
                console.error('Password reset error:', error);
                return { error: error.message };
            }

            console.log('✅ Password reset link sent successfully');
            return {
                success: true,
                message: 'Password reset instructions have been sent. Please check your email.'
            };
        } catch (error) {
            console.error('Password reset error:', error);
            return { error: error.message };
        }
    }

    // Update password (called after user clicks magic link)
    async updatePassword(newPassword) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { error: 'Password update is not available in demo mode' };
        }

        if (!newPassword || newPassword.length < 6) {
            return { error: 'Password must be at least 6 characters long' };
        }

        try {
            const { error } = await SupabaseConfig.client.auth.updateUser({
                password: newPassword
            });

            if (error) {
                console.error('Password update error:', error);
                return { error: error.message };
            }

            console.log('✅ Password updated successfully');
            return { success: true, message: 'Password updated successfully!' };
        } catch (error) {
            console.error('Password update error:', error);
            return { error: error.message };
        }
    }

    // ================================
    // ADMIN ONLY - Password Reset Helpers
    // ================================

    // Verify recovery code for password reset
    // Usage: await AuthService.verifyRecoveryCode('username', 'XXXX-XXXX-XXXX')
    async verifyRecoveryCode(username, recoveryCode) {
        console.log('🔧 ADMIN: Verifying recovery code for username:', username);

        if (!username || !recoveryCode) {
            return { error: 'Username and recovery code required' };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { error: 'Database not available' };
        }

        try {
            // Hash the provided recovery code
            const hashedCode = await this.hashRecoveryCode(recoveryCode);

            // Find user and verify recovery code
            const { data: userData, error: lookupError } = await SupabaseConfig.client
                .from('users')
                .select('id, username, email, recovery_code')
                .ilike('username', username)
                .single();

            if (lookupError || !userData) {
                console.error('User lookup error:', lookupError);
                return { error: 'No account found with username: ' + username, verified: false };
            }

            // Verify recovery code matches
            if (userData.recovery_code === hashedCode) {
                console.log(`✅ ADMIN: Recovery code verified for ${username}`);
                return {
                    verified: true,
                    username: userData.username,
                    userId: userData.id,
                    message: `Recovery code verified! You can now reset the password for ${username}.`
                };
            } else {
                console.log(`❌ ADMIN: Recovery code DOES NOT MATCH for ${username}`);
                return {
                    verified: false,
                    error: 'Recovery code does not match. Please check the code and try again.'
                };
            }
        } catch (error) {
            console.error('❌ Recovery code verification error:', error);
            return { error: error.message, verified: false };
        }
    }

    // Reset password with recovery code verification
    // Usage: await AuthService.adminResetPassword('username', 'newPassword123')
    //
    // This generates a temporary password that you can send to the user via email
    async adminResetPassword(username, newPassword) {
        console.log('🔧 ADMIN: Password reset requested for username:', username);

        if (!username || username.trim() === '') {
            return { error: 'Please provide a username' };
        }

        if (!newPassword || newPassword.length < 6) {
            return { error: 'Password must be at least 6 characters long' };
        }

        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return { error: 'Database not available' };
        }

        try {
            // Find user by username
            const { data: userData, error: lookupError } = await SupabaseConfig.client
                .from('users')
                .select('id, username, email')
                .ilike('username', username)
                .single();

            if (lookupError || !userData) {
                console.error('User lookup error:', lookupError);
                return { error: 'No account found with username: ' + username };
            }

            console.log(`🔧 ADMIN: Found user ${userData.username} (ID: ${userData.id}, Email: ${userData.email})`);

            // Try to update password using direct auth API
            // First, we need to sign in as the user to update their password
            // This approach logs in as the user temporarily
            const tempEmail = userData.email || `${username.toLowerCase()}@dailyshapes.local`;

            try {
                // Use updateUser to change password - this only works if you have admin access
                // Note: This will require service_role key in SupabaseConfig to work
                const { data, error } = await SupabaseConfig.client.auth.admin.updateUserById(
                    userData.id,
                    { password: newPassword }
                );

                if (error) {
                    console.error('❌ Admin password update failed:', error);
                    return { error: `Failed to update password: ${error.message}` };
                }

                console.log(`✅ ADMIN: Password updated successfully for ${username}`);
                return {
                    success: true,
                    username: username,
                    newPassword: newPassword,
                    message: `Password reset successful! Send this to the user:\n\nUsername: ${username}\nTemporary Password: ${newPassword}\n\nAsk them to log in and change it immediately.`
                };
            } catch (adminError) {
                console.error('❌ Admin API not available:', adminError);
                return {
                    error: 'Admin password reset requires service role key. You\'ll need to reset it via Supabase Dashboard:\n\n' +
                           '1. Go to Supabase Dashboard → Authentication → Users\n' +
                           '2. Find user: ' + username + '\n' +
                           '3. Click "..." → Reset Password\n' +
                           '4. Send the reset link to the user\'s contact email'
                };
            }
        } catch (error) {
            console.error('❌ Admin password reset error:', error);
            return { error: error.message };
        }
    }
}

// Create and export singleton instance
const authService = new AuthService();

if (typeof window !== 'undefined') {
    window.AuthService = authService;
}