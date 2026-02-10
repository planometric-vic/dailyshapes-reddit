// Custom Competition Manager for Daily Shapes v4.0
// Handles private competition creation, management, and participation

class CustomCompetitionManager {
    constructor() {
        this.activeCompetitions = new Map();
        this.subscriptions = new Map();
        this.validationTimeout = null;
        this.isInitialized = false;
    }

    // Initialize custom competition system
    async initialize() {
        console.log('🏅 Initializing Custom Competition Manager...');
        
        try {
            this.createCompetitionInterfaces();
            this.setupEventListeners();
            await this.loadUserCompetitions();
            this.isInitialized = true;
            console.log('✅ Custom Competition Manager initialized');
        } catch (error) {
            console.error('❌ Error initializing custom competition manager:', error);
        }
    }

    // Create all competition-related UI interfaces
    createCompetitionInterfaces() {
        this.createCompetitionCreationModal();
        this.createCompetitionManagementInterface();
        this.createJoinCompetitionModal();
        this.enhanceCompetitionButton();
    }

    // Create competition creation modal
    createCompetitionCreationModal() {
        const modal = document.createElement('div');
        modal.id = 'createCompetitionModal';
        modal.className = 'competition-modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="competition-modal-content">
                <div class="competition-modal-header">
                    <h2>Create Private Competition</h2>
                    <button class="competition-modal-close" onclick="window.CustomCompetitionManager.closeCreateModal()">&times;</button>
                </div>
                <div class="competition-modal-body">
                    <form id="createCompetitionForm">
                        <div class="form-group">
                            <label for="compName">Competition Name</label>
                            <input type="text" id="compName" required maxlength="50" placeholder="Enter competition name">
                            <div class="validation-message" id="nameValidation"></div>
                            <div class="helper-text">3-50 characters, must be unique</div>
                        </div>
                        
                        <div class="form-group">
                            <label for="compDescription">Description (Optional)</label>
                            <textarea id="compDescription" maxlength="200" placeholder="Describe your competition..."></textarea>
                            <div class="helper-text">Maximum 200 characters</div>
                        </div>
                        
                        <div class="date-inputs-row">
                            <div class="form-group">
                                <label for="startDate">Start Date</label>
                                <input type="date" id="startDate" required>
                                <div class="helper-text">Competitions can start today or later</div>
                            </div>
                            
                            <div class="form-group">
                                <label for="endDate">End Date</label>
                                <input type="date" id="endDate" required>
                                <div class="helper-text">Maximum: 1 year from start</div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="isPublic" checked>
                                <span class="checkmark"></span>
                                Public Competition (anyone can find and join)
                            </label>
                            <div class="helper-text">Uncheck to make invite-only</div>
                        </div>
                        
                        <div class="competition-preview" id="competitionPreview" style="display: none;">
                            <h4>Competition Preview</h4>
                            <div class="preview-content">
                                <div class="preview-item">
                                    <strong>Duration:</strong> <span id="previewDuration">-</span> days
                                </div>
                                <div class="preview-item">
                                    <strong>Timezone:</strong> <span id="previewTimezone">-</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="cancel-btn" onclick="window.CustomCompetitionManager.closeCreateModal()">Cancel</button>
                            <button type="submit" class="create-btn" id="createCompBtn" disabled>Create Competition</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Create competition management interface
    createCompetitionManagementInterface() {
        const interfaceElement = document.createElement('div');
        interfaceElement.id = 'competitionManagementInterface';
        interfaceElement.className = 'competition-modal';
        interfaceElement.style.display = 'none';

        interfaceElement.innerHTML = `
            <div class="competition-modal-content competition-management-content">
                <div class="competition-modal-header">
                    <h2>My Competitions</h2>
                    <button class="competition-modal-close" onclick="window.CustomCompetitionManager.closeManagementInterface()">&times;</button>
                </div>
                <div class="competition-modal-body">
                    <div class="competition-tabs">
                        <button class="competition-tab active" data-tab="global" onclick="window.CustomCompetitionManager.switchTab('global')">
                            Global
                        </button>
                        <button class="competition-tab" data-tab="joined" onclick="window.CustomCompetitionManager.switchTab('joined')">
                            My Competitions <span id="joinedCount" class="tab-count">0</span>
                        </button>
                        <button class="competition-tab" data-tab="created" onclick="window.CustomCompetitionManager.switchTab('created')">
                            Created by Me <span id="createdCount" class="tab-count">0</span>
                        </button>
                    </div>
                    
                    <div class="tab-content">
                        <div id="globalTab" class="competition-tab-panel active">
                            <div class="global-competition-info">
                                <p>View the global monthly leaderboard where all players compete.</p>
                                <button class="view-global-btn" onclick="window.LeaderboardUI.open()">
                                    🏆 View Global Leaderboard
                                </button>
                            </div>
                        </div>
                        
                        <div id="joinedTab" class="competition-tab-panel">
                            <div class="competitions-list" id="joinedCompetitionsList">
                                <!-- Joined competitions will be populated here -->
                            </div>
                        </div>
                        
                        <div id="createdTab" class="competition-tab-panel">
                            <div class="competitions-list" id="createdCompetitionsList">
                                <!-- Created competitions will be populated here -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="management-actions">
                        <button class="create-competition-btn" onclick="window.CustomCompetitionManager.openCreateModal()">
                            + Create New Competition
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(interfaceElement);
    }

    // Create join competition modal
    createJoinCompetitionModal() {
        const modal = document.createElement('div');
        modal.id = 'joinCompetitionModal';
        modal.className = 'competition-modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="competition-modal-content">
                <div class="competition-modal-header">
                    <h2>Join Competition</h2>
                    <button class="competition-modal-close" onclick="window.CustomCompetitionManager.closeJoinModal()">&times;</button>
                </div>
                <div class="competition-modal-body">
                    <div class="join-competition-content" id="joinCompetitionContent">
                        <!-- Competition details will be populated here -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Enhance the existing competition button with dropdown
    enhanceCompetitionButton() {
        const compButton = document.getElementById('compButton');
        if (!compButton) return;

        // Create dropdown menu
        const dropdown = document.createElement('div');
        dropdown.id = 'compButtonDropdown';
        dropdown.className = 'comp-button-dropdown';
        dropdown.style.display = 'none';
        
        dropdown.innerHTML = `
            <div class="dropdown-item" onclick="window.LeaderboardUI.open()">
                🏆 Global Leaderboard
            </div>
            <div class="dropdown-item" onclick="window.CustomCompetitionManager.openManagementInterface()">
                🏅 My Competitions
            </div>
            <div class="dropdown-item" onclick="window.CustomCompetitionManager.openCreateModal()">
                ➕ Create Competition
            </div>
        `;

        // Insert dropdown in the button suite container
        const buttonSuite = document.querySelector('.button-suite');
        if (buttonSuite) {
            buttonSuite.appendChild(dropdown);
        } else {
            // Fallback to inserting after button
            compButton.parentNode.insertBefore(dropdown, compButton.nextSibling);
        }

        // Update button functionality
        const originalOnClick = compButton.onclick;
        compButton.onclick = function(e) {
            e.stopPropagation();
            window.CustomCompetitionManager.toggleCompetitionDropdown();
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#compButton') && !e.target.closest('#compButtonDropdown')) {
                dropdown.style.display = 'none';
            }
        });
    }

    // Toggle competition button dropdown
    toggleCompetitionDropdown() {
        const dropdown = document.getElementById('compButtonDropdown');
        if (!dropdown) return;
        
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }

    // Setup event listeners for competition forms
    setupEventListeners() {
        // Competition creation form submission
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'createCompetitionForm') {
                e.preventDefault();
                this.handleCreateCompetition();
            }
        });

        // Real-time name validation
        document.addEventListener('input', (e) => {
            if (e.target.id === 'compName') {
                this.validateCompetitionName(e.target.value);
            }
        });

        // Date validation
        document.addEventListener('change', (e) => {
            if (e.target.id === 'startDate' || e.target.id === 'endDate') {
                this.validateDates();
                this.updatePreview();
            }
        });

        // Real-time preview updates
        document.addEventListener('input', (e) => {
            if (['compName', 'compDescription', 'isPublic'].includes(e.target.id)) {
                this.updatePreview();
            }
        });
    }

    // Validate competition name uniqueness
    async validateCompetitionName(name) {
        clearTimeout(this.validationTimeout);
        const validationEl = document.getElementById('nameValidation');
        const createBtn = document.getElementById('createCompBtn');
        
        if (name.length < 3) {
            validationEl.textContent = 'Name must be at least 3 characters';
            validationEl.className = 'validation-message invalid';
            createBtn.disabled = true;
            return;
        }

        validationEl.textContent = 'Checking availability...';
        validationEl.className = 'validation-message checking';

        this.validationTimeout = setTimeout(async () => {
            try {
                const isUnique = await this.checkNameUniqueness(name);
                
                if (isUnique) {
                    validationEl.textContent = '✓ Name is available';
                    validationEl.className = 'validation-message valid';
                    this.validateForm();
                } else {
                    validationEl.textContent = 'Name already taken by an active competition';
                    validationEl.className = 'validation-message invalid';
                    createBtn.disabled = true;
                }
            } catch (error) {
                console.error('Error validating name:', error);
                validationEl.textContent = 'Unable to check name availability';
                validationEl.className = 'validation-message invalid';
                createBtn.disabled = true;
            }
        }, 500);
    }

    // Check name uniqueness against active competitions
    async checkNameUniqueness(name) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return true; // Allow in demo mode
        }

        const { data, error } = await supabaseClient
            .from('competitions')
            .select('id')
            .eq('name', name.trim())
            .eq('is_active', true)
            .eq('is_global', false);

        if (error) throw error;
        return data.length === 0;
    }

    // Validate date inputs
    validateDates() {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');

        // Get today's date in local timezone (not UTC)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        // Set minimum dates - allow competitions to start today
        startDate.min = today;
        
        if (startDate.value) {
            const start = new Date(startDate.value);
            const maxEnd = new Date(start);
            maxEnd.setFullYear(maxEnd.getFullYear() + 1);
            
            endDate.min = startDate.value;
            endDate.max = maxEnd.toISOString().split('T')[0];
        }

        this.validateForm();
    }

    // Validate entire form and enable/disable submit button
    validateForm() {
        const name = document.getElementById('compName').value.trim();
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const createBtn = document.getElementById('createCompBtn');
        const validationEl = document.getElementById('nameValidation');

        const isValid = name.length >= 3 &&
                       startDate &&
                       endDate &&
                       new Date(endDate) >= new Date(startDate) &&
                       validationEl.classList.contains('valid');
        
        createBtn.disabled = !isValid;
    }

    // Update competition preview
    updatePreview() {
        const preview = document.getElementById('competitionPreview');
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            document.getElementById('previewDuration').textContent = duration;
            document.getElementById('previewTimezone').textContent = timezone;

            // Update preview dates with proper formatting
            const previewDates = document.querySelector('.preview-dates');
            if (previewDates) {
                const formattedStart = window.formatDateForUser ? window.formatDateForUser(startDate) : start.toLocaleDateString();
                const formattedEnd = window.formatDateForUser ? window.formatDateForUser(endDate) : end.toLocaleDateString();
                previewDates.textContent = `${formattedStart} - ${formattedEnd}`;
            }
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    // Handle competition creation
    async handleCreateCompetition() {
        const createBtn = document.getElementById('createCompBtn');
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';

        try {
            const formData = {
                name: document.getElementById('compName').value.trim(),
                description: document.getElementById('compDescription').value.trim() || null,
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
                isPublic: document.getElementById('isPublic').checked
            };

            const competition = await this.createCompetition(formData);
            
            if (competition) {
                this.closeCreateModal();
                this.showCompetitionCreatedSuccess(competition);
                await this.loadUserCompetitions();
            }

        } catch (error) {
            console.error('Error creating competition:', error);
            if (window.CompetitionUI && window.CompetitionUI.showErrorPopup) {
                window.CompetitionUI.showErrorPopup('Failed to create competition. Please try again.');
            } else {
                console.error('Competition error: Failed to create competition. Please try again.');
            }
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = 'Create Competition';
        }
    }

    // Create competition in database
    async createCompetition(formData) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            if (window.CompetitionUI && window.CompetitionUI.showErrorPopup) {
                window.CompetitionUI.showErrorPopup('Database connection required to create competitions');
            } else {
                console.error('Competition error: Database connection required to create competitions');
            }
            return null;
        }

        const user = window.AuthService.getCurrentUser();
        if (!user || user.isGuest) {
            if (window.CompetitionUI && window.CompetitionUI.showErrorPopup) {
                window.CompetitionUI.showErrorPopup('Please sign in to create competitions');
            } else {
                console.error('Competition error: Please sign in to create competitions');
            }
            return null;
        }

        const inviteCode = this.generateInviteCode();
        const creatorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const competition = {
            name: formData.name,
            description: formData.description,
            creator_id: user.id,
            creator_timezone: creatorTimezone,
            start_date: formData.startDate,
            end_date: formData.endDate,
            is_global: false,
            is_public: formData.isPublic,
            is_active: true,
            invite_code: inviteCode,
            scoring_type: 'total',
            min_days_required: 1
        };

        const { data, error } = await supabaseClient
            .from('competitions')
            .insert(competition)
            .select()
            .single();

        if (error) throw error;

        // Auto-enroll creator
        await this.enrollUserInCompetition(data.id, user.id);

        // Track competition creation event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'competition_created', {
                competition_id: data.id,
                competition_name: data.name,
                is_public: data.is_public,
                duration_days: Math.ceil((new Date(data.end_date) - new Date(data.start_date)) / (1000 * 60 * 60 * 24)) + 1,
                event_category: 'competition',
                event_label: data.is_public ? 'public' : 'private'
            });
            console.log('📊 GA4: Tracked competition_created event');
        }

        return data;
    }

    // Generate unique invite code
    generateInviteCode() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    // Show competition creation success message
    showCompetitionCreatedSuccess(competition) {
        const inviteLink = `${window.location.origin}/join/${competition.invite_code}`;
        
        const modal = document.createElement('div');
        modal.className = 'competition-success-modal';
        modal.innerHTML = `
            <div class="success-modal-content">
                <div class="success-header">
                    <h3>Competition Created!</h3>
                </div>
                <div class="success-body">
                    <p><strong>${competition.name.toUpperCase()}</strong> has been created successfully.</p>
                    <div class="invite-link-section">
                        <label>Invite Link:</label>
                        <div class="invite-link-input">
                            <input type="text" value="${inviteLink}" readonly id="inviteLinkInput">
                            <button onclick="window.CustomCompetitionManager.copyInviteLink()" class="copy-btn">Copy</button>
                        </div>
                    </div>
                    <div class="success-actions">
                        <button onclick="window.CustomCompetitionManager.closeSuccessModal()" class="close-success-btn">Close</button>
                        <button onclick="window.CustomCompetitionManager.viewCompetition('${competition.id}')" class="view-comp-btn">View Competition</button>
                    </div>
                    <div class="input-help" style="font-size: 12px; margin-bottom: 20px; text-align: center; margin-top: 15px;">Only those with access to this link can see the leaderboard</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    // Copy invite link to clipboard
    async copyInviteLink() {
        const input = document.getElementById('inviteLinkInput');
        try {
            await navigator.clipboard.writeText(input.value);
            const copyBtn = event.target;
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);

            // Track competition link copy event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'competition_link_copied', {
                    event_category: 'competition',
                    event_label: 'invite_link_copied'
                });
                console.log('📊 GA4: Tracked competition_link_copied event');
            }
        } catch (error) {
            // Fallback for older browsers
            input.select();
            document.execCommand('copy');

            // Track competition link copy event (fallback method)
            if (typeof gtag !== 'undefined') {
                gtag('event', 'competition_link_copied', {
                    event_category: 'competition',
                    event_label: 'invite_link_copied_fallback'
                });
                console.log('📊 GA4: Tracked competition_link_copied event (fallback)');
            }
        }
    }

    // Close success modal
    closeSuccessModal() {
        const modal = document.querySelector('.competition-success-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Modal management functions
    openCreateModal() {
        const modal = document.getElementById('createCompetitionModal');
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        this.resetCreateForm();
        this.validateDates();
    }

    closeCreateModal() {
        const modal = document.getElementById('createCompetitionModal');
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    openManagementInterface() {
        const interfaceElement = document.getElementById('competitionManagementInterface');
        interfaceElement.style.display = 'flex';
        document.body.classList.add('modal-open');
        this.loadUserCompetitions();
    }

    closeManagementInterface() {
        const interfaceElement = document.getElementById('competitionManagementInterface');
        interfaceElement.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    // Reset create form
    resetCreateForm() {
        document.getElementById('createCompetitionForm').reset();
        document.getElementById('nameValidation').textContent = '';
        document.getElementById('nameValidation').className = 'validation-message';
        document.getElementById('createCompBtn').disabled = true;
        document.getElementById('competitionPreview').style.display = 'none';
    }

    // Switch between management tabs
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.competition-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab panels
        document.querySelectorAll('.competition-tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Load appropriate content
        if (tabName === 'joined' || tabName === 'created') {
            this.loadUserCompetitions();
        }
    }

    // Load user's competitions
    async loadUserCompetitions() {
        if (!window.AuthService.isLoggedIn()) return;
        
        try {
            const user = window.AuthService.getCurrentUser();
            
            // Load joined competitions
            const joinedComps = await this.getUserJoinedCompetitions(user.id);
            this.renderCompetitionsList(joinedComps, 'joinedCompetitionsList');
            document.getElementById('joinedCount').textContent = joinedComps.length;
            
            // Load created competitions
            const createdComps = await this.getUserCreatedCompetitions(user.id);
            this.renderCompetitionsList(createdComps, 'createdCompetitionsList', true);
            document.getElementById('createdCount').textContent = createdComps.length;
            
        } catch (error) {
            console.error('Error loading user competitions:', error);
        }
    }

    // Get competitions user has joined
    async getUserJoinedCompetitions(userId) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return [];
        }

        const { data, error } = await supabaseClient
            .from('competition_participants')
            .select(`
                competitions!inner(
                    id, name, description, start_date, end_date, 
                    is_active, creator_id, creator_timezone,
                    users!competitions_creator_id_fkey(username)
                )
            `)
            .eq('user_id', userId)
            .eq('competitions.is_global', false)
            .order('competitions.created_at', { ascending: false });

        if (error) throw error;
        return data.map(item => item.competitions);
    }

    // Get competitions user has created
    async getUserCreatedCompetitions(userId) {
        if (!window.SupabaseConfig || !window.SupabaseConfig.isReady()) {
            return [];
        }

        const { data, error } = await supabaseClient
            .from('competitions')
            .select('*')
            .eq('creator_id', userId)
            .eq('is_global', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Render competitions list
    renderCompetitionsList(competitions, containerId, isCreator = false) {
        const container = document.getElementById(containerId);
        
        if (competitions.length === 0) {
            container.innerHTML = `
                <div class="no-competitions">
                    <p>${isCreator ? "You haven't created any competitions yet." : "You haven't joined any competitions yet."}</p>
                    <button class="create-competition-btn" onclick="window.CustomCompetitionManager.openCreateModal()">
                        Create Your First Competition
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = competitions.map(comp => {
            const status = this.getCompetitionStatus(comp);
            const participantCount = this.activeCompetitions.get(comp.id)?.participantCount || 0;
            
            return `
                <div class="competition-card ${status.class}">
                    <div class="competition-card-header">
                        <h4>${this.escapeHtml(comp.name)}</h4>
                        <span class="competition-status">${status.text}</span>
                    </div>
                    <div class="competition-card-body">
                        ${comp.description ? `<p class="competition-description">${this.escapeHtml(comp.description)}</p>` : ''}
                        <div class="competition-meta">
                            <span class="competition-dates">
                                ${window.formatDateForUser ? window.formatDateForUser(comp.start_date) : new Date(comp.start_date).toLocaleDateString()} - ${window.formatDateForUser ? window.formatDateForUser(comp.end_date) : new Date(comp.end_date).toLocaleDateString()}
                            </span>
                            <span class="participant-count">${participantCount} players</span>
                        </div>
                        ${isCreator ? `
                            <div class="creator-info">
                                <span class="creator-timezone">Timezone: ${comp.creator_timezone}</span>
                            </div>
                        ` : `
                            <div class="creator-info">
                                Created by: ${comp.users?.username || 'Unknown'}
                            </div>
                        `}
                    </div>
                    <div class="competition-card-actions">
                        <button class="view-leaderboard-btn" onclick="window.CustomCompetitionManager.viewCompetitionLeaderboard('${comp.id}')">
                            View Leaderboard
                        </button>
                        ${isCreator ? `
                            <button class="manage-competition-btn" onclick="window.CustomCompetitionManager.manageCompetition('${comp.id}')">
                                Manage
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Get competition status
    getCompetitionStatus(competition) {
        const now = new Date();
        const startDate = new Date(competition.start_date);
        const endDate = new Date(competition.end_date);
        
        if (!competition.is_active) {
            return { text: 'Ended', class: 'ended' };
        }
        
        if (now < startDate) {
            return { text: 'Upcoming', class: 'upcoming' };
        }
        
        if (now > endDate) {
            return { text: 'Completed', class: 'completed' };
        }
        
        return { text: 'Active', class: 'active' };
    }

    // Enroll user in competition
    async enrollUserInCompetition(competitionId, userId) {
        const { error } = await supabaseClient
            .from('competition_participants')
            .insert({
                competition_id: competitionId,
                user_id: userId,
                total_score: 0,
                days_played: 0
            });

        if (error && error.code !== '23505') { // Ignore duplicate entry errors
            throw error;
        }
    }

    // Utility function to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // View competition leaderboard
    async viewCompetitionLeaderboard(competitionId) {
        if (window.CustomLeaderboardUI) {
            await window.CustomLeaderboardUI.open(competitionId);
        }
    }

    // View competition from success modal
    viewCompetition(competitionId) {
        this.closeSuccessModal();
        this.viewCompetitionLeaderboard(competitionId);
    }

    // Manage competition (creator functions)
    async manageCompetition(competitionId) {
        // For now, just open the leaderboard
        // This could be expanded with creator-specific management features
        await this.viewCompetitionLeaderboard(competitionId);
    }

    // Check if manager is ready
    isReady() {
        return this.isInitialized;
    }
}

// Create singleton instance
const customCompetitionManager = new CustomCompetitionManager();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CustomCompetitionManager = customCompetitionManager;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => customCompetitionManager.initialize());
    } else {
        customCompetitionManager.initialize();
    }
}