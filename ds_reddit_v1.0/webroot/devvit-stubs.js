// Competition system stubs - these functions are referenced by main.js and other files
// but the actual competition system files (competitions.js, global-competition.js, etc.)
// are not loaded in the Reddit port.
window.CustomCompetitionManager = window.CustomCompetitionManager || {
    initialize: function() {},
    isInitialized: function() { return false; },
    getActiveCompetitions: function() { return Promise.resolve([]); },
    submitScore: function() { return Promise.resolve(); },
};
window.CompetitionSystem = window.CompetitionSystem || {
    initialize: function() {},
    submitScore: function() {},
    getLeaderboard: function() { return Promise.resolve([]); },
};
window.GlobalCompetition = window.GlobalCompetition || {
    submit: function() {},
    getLeaderboard: function() { return Promise.resolve([]); },
};
window.CompetitionManager = window.CompetitionManager || {
    initialize: function() {},
    parseJoinLink: function() { return null; },
    joinCompetition: function() { return Promise.resolve({}); },
    autoJoinGlobalCompetition: function() { return Promise.resolve(); },
    getActiveCompetitions: function() { return Promise.resolve([]); },
};
// Auth functions that main.js may call
window.openAuthModal = window.openAuthModal || function() { console.log('[Devvit] Auth not needed on Reddit'); };
window.closeAuthModal = window.closeAuthModal || function() {};
window.handleSignup = window.handleSignup || function() {};
window.handleLogout = window.handleLogout || function() {};
window.showUserStats = window.showUserStats || function() {};
window.showChangePassword = window.showChangePassword || function() {};
window.closeUserStatsModal = window.closeUserStatsModal || function() {};
window.closeChangePasswordModal = window.closeChangePasswordModal || function() {};
window.closeForgotPasswordModal = window.closeForgotPasswordModal || function() {};
window.closeRecoveryCodeModal = window.closeRecoveryCodeModal || function() {};
window.closeSuccessModal = window.closeSuccessModal || function() {};
window.closeCompetitionPromptModal = window.closeCompetitionPromptModal || function() {};
window.openCreateCompetition = window.openCreateCompetition || function() {};
window.showActiveCompetitions = window.showActiveCompetitions || function() {};
window.showExpiredCompetitions = window.showExpiredCompetitions || function() {};
window.showCreateCompetition = window.showCreateCompetition || function() {};
window.showCompetitionMain = window.showCompetitionMain || function() {};
window.closeCompetitionModal = window.closeCompetitionModal || function() {};
window.closeJoinCompetitionModal = window.closeJoinCompetitionModal || function() {};
window.continueToOriginalDestination = window.continueToOriginalDestination || function() {};
window.closeStatsWindow = window.closeStatsWindow || function() {};
window.copyRecoveryCode = window.copyRecoveryCode || function() {};
// Supabase-dependent functions that should be no-ops
window.loadSupabaseShape = window.loadSupabaseShape || function() { return Promise.resolve(null); };
window.initializeSupabase = window.initializeSupabase || function() { return Promise.resolve(); };
window.checkSupabaseReady = window.checkSupabaseReady || function() { return true; };
// katex stub (loading animation references it)
window.katex = window.katex || { render: function() {} };

// Event listeners replacing inline onclick handlers (blocked by CSP)
var dateTitle = document.getElementById('dateTitle');
if (dateTitle) {
    dateTitle.addEventListener('click', function() {
        if (window.handleOption2Click) window.handleOption2Click();
    });
}
var statsCloseBtn = document.getElementById('statsCloseBtn');
if (statsCloseBtn) {
    statsCloseBtn.addEventListener('click', function() {
        if (window.closeStatsWindow) window.closeStatsWindow();
    });
}
var competitionCloseBtns = document.querySelectorAll('.competition-close-btn');
for (var i = 0; i < competitionCloseBtns.length; i++) {
    competitionCloseBtns[i].addEventListener('click', function() {
        if (window.closeCompetitionModal) window.closeCompetitionModal();
    });
}
