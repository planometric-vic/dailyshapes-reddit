// Collapsible Menu System for Daily Shapes v4.0
// Manages expandable menu button functionality

class CollapsibleMenu {
    constructor() {
        this.isExpanded = false;
        this.selectedOption = null;
        this.menuButton = null;
        this.menuOverlay = null;
        this.isInitialized = false;
    }

    // Initialize the collapsible menu system
    initialize() {
        console.log('🔘 Initializing Collapsible Menu...');
        
        this.menuButton = document.getElementById('menuButton');
        this.menuOverlay = document.getElementById('menuOverlay');
        
        if (!this.menuButton || !this.menuOverlay) {
            // Collapsible menu elements not found - likely using animated menu instead
            return;
        }

        this.setupEventListeners();
        this.updateMenuState();
        this.isInitialized = true;
        
        console.log('✅ Collapsible Menu initialized');
    }

    // Setup event listeners
    setupEventListeners() {
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.button-suite') && this.isExpanded) {
                this.retractMenu();
            }
        });

        // Prevent menu from closing when clicking inside
        this.menuOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isExpanded) {
                this.retractMenu();
            }
        });
    }

    // Toggle menu expansion
    toggleMenu() {
        if (this.isExpanded) {
            this.retractMenu();
        } else {
            this.expandMenu();
        }
    }

    // Expand the menu to show all options
    expandMenu() {
        if (this.isExpanded) return;
        
        this.isExpanded = true;
        this.menuButton.classList.add('expanded');
        this.menuOverlay.classList.add('expanded');
        
        // Update button states based on auth status
        this.updateButtonStates();
    }

    // Retract the menu
    retractMenu() {
        if (!this.isExpanded) return;
        
        this.isExpanded = false;
        this.menuButton.classList.remove('expanded');
        this.menuOverlay.classList.remove('expanded');
    }

    // Handle menu option selection
    selectMenuOption(option) {
        console.log(`Selected menu option: ${option}`);
        
        // Store the selected option
        this.selectedOption = option;
        
        // Update menu button to show selected option
        this.updateMenuButtonAppearance(option);
        
        // Handle the actual functionality
        this.handleOptionAction(option);
        
        // Retract the menu
        this.retractMenu();
    }

    // Update menu button to show selected option
    updateMenuButtonAppearance(option) {
        // Remove all selection classes
        this.menuButton.classList.remove('auth-selected', 'stats-selected', 'archive-selected', 'comp-selected');
        
        // Add appropriate class and update icon
        switch (option) {
            case 'auth':
                this.menuButton.classList.add('auth-selected');
                this.updateMenuButtonIcon('auth');
                break;
            case 'stats':
                this.menuButton.classList.add('stats-selected');
                this.updateMenuButtonIcon('stats');
                break;
            case 'archive':
                this.menuButton.classList.add('archive-selected');
                this.updateMenuButtonIcon('archive');
                break;
            case 'comp':
                this.menuButton.classList.add('comp-selected');
                this.updateMenuButtonIcon('comp');
                break;
        }
    }

    // Update menu button icon
    updateMenuButtonIcon(option) {
        const svg = this.menuButton.querySelector('svg');
        if (!svg) return;

        const icons = {
            auth: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z',
            stats: 'M3 13h2v8H3zm4-8h2v16H7zm4-2h2v18h-2zm4 4h2v14h-2zm4-2h2v16h-2z',
            archive: 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z',
            comp: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z'
        };

        const path = svg.querySelector('path');
        if (path && icons[option]) {
            path.setAttribute('d', icons[option]);
        }
    }

    // Handle the actual functionality for each option
    handleOptionAction(option) {
        switch (option) {
            case 'auth':
                this.handleAuthAction();
                break;
            case 'stats':
                if (window.showStatsWindow) {
                    window.showStatsWindow();
                }
                break;
            case 'archive':
                if (this.isPracticeEnabled()) {
                    alert('Practice mode is not yet implemented.');
                }
                break;
            case 'comp':
                if (this.isCompEnabled()) {
                    this.handleCompAction();
                }
                break;
        }
    }

    // Handle auth button action
    handleAuthAction() {
        if (window.AuthManager && window.AuthManager.isLoggedIn()) {
            // User is logged in, show user profile/stats modal
            if (window.showUserStats && typeof window.showUserStats === 'function') {
                window.showUserStats();
            } else if (window.showLoggedInUserModal && typeof window.showLoggedInUserModal === 'function') {
                window.showLoggedInUserModal();
            }
        } else {
            // User is not logged in, set pending action and open auth modal
            localStorage.setItem('pendingUserAction', 'profile');
            if (window.openAuthModal) {
                window.openAuthModal();
            }
        }
    }

    // Handle competition button action
    handleCompAction() {
        if (window.CustomCompetitionManager && window.CustomCompetitionManager.toggleCompetitionDropdown) {
            window.CustomCompetitionManager.toggleCompetitionDropdown();
        } else if (window.openCompetition) {
            window.openCompetition();
        } else {
            alert('Competition feature coming soon!');
        }
    }

    // Check if practice is enabled (user must be logged in)
    isPracticeEnabled() {
        return window.AuthManager && window.AuthManager.isLoggedIn();
    }

    // Check if competition is enabled (user must be logged in)
    isCompEnabled() {
        return window.AuthManager && window.AuthManager.isLoggedIn();
    }

    // Update button states based on authentication
    updateButtonStates() {
        const authOption = document.getElementById('authOption');
        const archiveOption = document.getElementById('archiveOption');
        const compOption = document.getElementById('compOption');

        if (!authOption || !archiveOption || !compOption) return;

        const isLoggedIn = window.AuthManager && window.AuthManager.isLoggedIn();

        // Update practice button
        if (isLoggedIn) {
            archiveOption.classList.remove('disabled');
            archiveOption.setAttribute('data-tooltip', 'Practice');
        } else {
            archiveOption.classList.add('disabled');
            archiveOption.setAttribute('data-tooltip', 'Practice (Login Required)');
        }

        // Update competition button
        if (isLoggedIn) {
            compOption.classList.remove('disabled');
            compOption.setAttribute('data-tooltip', 'Compete');
        } else {
            compOption.classList.add('disabled');
            compOption.setAttribute('data-tooltip', 'Compete (Login Required)');
        }

        // Update auth button tooltip
        if (isLoggedIn) {
            const username = window.AuthManager.getUsername();
            authOption.setAttribute('data-tooltip', username || 'Account');
        } else {
            authOption.setAttribute('data-tooltip', 'Sign In');
        }
    }

    // Update menu state (called from external auth changes)
    updateMenuState() {
        this.updateButtonStates();
        
        // If no option is selected yet, default to auth
        if (!this.selectedOption) {
            this.selectedOption = 'auth';
            this.updateMenuButtonAppearance('auth');
        }
    }

    // Reset to default state
    resetToDefault() {
        this.selectedOption = null;
        this.menuButton.classList.remove('auth-selected', 'stats-selected', 'archive-selected', 'comp-selected');
        
        // Reset to person icon
        const svg = this.menuButton.querySelector('svg');
        const path = svg?.querySelector('path');
        if (path) {
            path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z');
        }
        
        this.retractMenu();
    }

    // Check if menu is ready
    isReady() {
        return this.isInitialized;
    }
}

// Create singleton instance
const collapsibleMenu = new CollapsibleMenu();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CollapsibleMenu = collapsibleMenu;
    
    // Global functions for HTML onclick handlers
    window.toggleMenu = function() {
        collapsibleMenu.toggleMenu();
    };
    
    window.selectMenuOption = function(option) {
        collapsibleMenu.selectMenuOption(option);
    };
    
    // MOVED TO MAIN INITIALIZATION: Prevent duplicate DOMContentLoaded listeners
    // Initialize when DOM is ready
    // if (document.readyState === 'loading') {
    //     document.addEventListener('DOMContentLoaded', () => collapsibleMenu.initialize());
    // } else {
    //     collapsibleMenu.initialize();
    // }
}

// Listen for auth state changes
document.addEventListener('authStateChanged', () => {
    if (collapsibleMenu.isReady()) {
        collapsibleMenu.updateMenuState();
    }
});

// Override the original updateHeaderUI function
if (typeof window !== 'undefined') {
    const originalUpdateHeaderUI = window.updateHeaderUI;
    window.updateHeaderUI = function() {
        // Call original function for compatibility
        if (originalUpdateHeaderUI) {
            originalUpdateHeaderUI();
        }
        
        // Update collapsible menu
        if (collapsibleMenu.isReady()) {
            collapsibleMenu.updateMenuState();
        }
    };
}