/**
 * Local Competition Demo System
 * Provides mock competition data with realistic participant counts for local development
 */

// Mock competition data with realistic participant counts
const mockCompetitionData = {
    globalCompetition: {
        id: 'global-demo-comp',
        name: 'DS Global Comp September 2025',
        description: 'Monthly global competition for all Daily Shapes players',
        start_date: '2025-09-01T00:00:00Z',
        end_date: '2025-09-30T23:59:59Z',
        competition_type: 'global',
        is_global: true,
        status: 'active',
        participant_count: 1247,
        created_at: '2025-09-01T00:00:00Z'
    },
    userCompetitions: [
        {
            id: 'custom-comp-1',
            name: "Ben's Test Comp",
            description: 'A test competition for friends',
            start_date: '2025-09-20T00:00:00Z',
            end_date: '2025-09-25T23:59:59Z',
            competition_type: 'custom',
            is_global: false,
            status: 'active',
            participant_count: 8,
            created_at: '2025-09-20T00:00:00Z'
        },
        {
            id: 'custom-comp-2',
            name: 'Weekend Warriors',
            description: 'Quick weekend challenge',
            start_date: '2025-09-21T00:00:00Z',
            end_date: '2025-09-23T23:59:59Z',
            competition_type: 'custom',
            is_global: false,
            status: 'active',
            participant_count: 23,
            created_at: '2025-09-21T00:00:00Z'
        }
    ]
};

// Mock CompetitionManager for local development
class LocalCompetitionManager {
    constructor() {
        this.globalCompetition = null;
        this.userCompetitions = [];
        this.isInitialized = false;
        console.log('🏠 Local Competition Manager initialized');
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log('🏠 Loading local competition demo data...');

        // Simulate async loading
        await new Promise(resolve => setTimeout(resolve, 100));

        this.globalCompetition = mockCompetitionData.globalCompetition;
        this.userCompetitions = mockCompetitionData.userCompetitions.map(comp => ({
            competitions: comp,
            status: 'active',
            joined_at: comp.created_at
        }));

        this.isInitialized = true;
        console.log('✅ Local competition data loaded');
        console.log(`🏆 Global competition: ${this.globalCompetition.name} (${this.globalCompetition.participant_count} players)`);
        console.log(`👥 User competitions: ${this.userCompetitions.length} competitions`);
    }

    async fetchParticipantCounts() {
        // Mock participant count fetching
        console.log('🔍 Fetching participant counts (local demo)...');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));

        // Participant counts are already set in the mock data
        if (this.globalCompetition) {
            console.log(`✅ Global competition participant count: ${this.globalCompetition.participant_count}`);
        }

        this.userCompetitions.forEach(participation => {
            if (participation.competitions) {
                console.log(`✅ ${participation.competitions.name}: ${participation.competitions.participant_count} participants`);
            }
        });

        return true;
    }

    async ensureGlobalCompetitionExists() {
        // In demo mode, global competition always exists
        console.log('🏠 Global competition exists (demo mode)');
        return this.globalCompetition;
    }

    async loadGlobalCompetition() {
        // Already loaded in initialize
        console.log('✅ Global competition loaded (demo)');
    }

    async loadUserCompetitions() {
        // Already loaded in initialize
        console.log('✅ User competitions loaded (demo)');
    }

    async autoJoinGlobalCompetition(userId) {
        console.log('✅ Auto-joined global competition (demo mode)');
    }

    getTotalParticipants() {
        return this.globalCompetition ? this.globalCompetition.participant_count : 0;
    }

    getCurrentCompetition() {
        return this.globalCompetition;
    }

    setupMonthlyCheck() {
        // No-op in demo mode
        console.log('🏠 Monthly check disabled in demo mode');
    }

    invalidateCache() {
        console.log('🔄 Cache invalidated (demo mode)');
    }
}

// Initialize local competition system if Supabase is not available
if (typeof window !== 'undefined') {
    // Wait for DOM and check if Supabase failed to load
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!window.supabase || !window.SupabaseConfig?.client) {
                console.log('🏠 Supabase not available - initializing local competition demo');

                // Create mock SupabaseConfig
                window.SupabaseConfig = {
                    client: null,
                    isConfigured: false
                };

                // Replace CompetitionManager with local version
                window.CompetitionManager = new LocalCompetitionManager();

                // Initialize the local system
                window.CompetitionManager.initialize().then(() => {
                    console.log('🏠 Local competition system ready');

                    // Trigger any waiting competition UI
                    if (window.CompetitionUI && window.CompetitionUI.loadCompetitionsView) {
                        setTimeout(() => {
                            console.log('🏠 Refreshing competition UI with local data');
                            // If competition interface is currently visible, refresh it
                            const competitionContainer = document.getElementById('competition-container');
                            if (competitionContainer && competitionContainer.style.display !== 'none') {
                                window.CompetitionUI.loadCompetitionsView();
                            }
                        }, 500);
                    }
                });
            }
        }, 1000);
    });
}