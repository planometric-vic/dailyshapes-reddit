// Authentication and Header Management for Daily Shapes v4.0

// Cookie utility functions (kept for backward compatibility)
const CookieManager = {
    set: function(name, value, days = 30) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/";
    },
    
    get: function(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },
    
    delete: function(name) {
        document.cookie = name + "=; Max-Age=-99999999; path=/";
    }
};

// Enhanced Authentication Manager using AuthService
const AuthManager = {
    authService: null,
    
    async initialize() {
        // Wait for AuthService to be available (max 5 seconds)
        let attempts = 0;
        while (!window.AuthService && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.AuthService) {
            this.authService = window.AuthService;
            // Only initialize if not already initialized
            if (!this.authService.initialized) {
                await this.authService.initialize();
            }
        } else {
            console.warn('AuthService not available after waiting, using fallback mode');
        }
        updateHeaderUI();
    },
    
    isLoggedIn: function() {
        if (this.authService) {
            return this.authService.isLoggedIn();
        }
        // Fallback to cookie check
        return CookieManager.get('ds_auth_token') !== null;
    },
    
    getUsername: function() {
        if (this.authService) {
            const user = this.authService.getCurrentUser();
            if (user && !user.isGuest) {
                // Check various possible username fields
                return user.username || user.display_name || user.user_metadata?.username;
            }
        }
        // Fallback to cookie
        return CookieManager.get('ds_username') || null;
    },
    
    getEmail: function() {
        if (this.authService) {
            const user = this.authService.getCurrentUser();
            if (user && !user.isGuest) {
                return user.email;
            }
        }
        // Fallback to cookie
        return CookieManager.get('ds_email') || null;
    },
    
    getCurrentUser: function() {
        if (this.authService) {
            return this.authService.getCurrentUser();
        }
        return null;
    },
    
    async login(username, password) {
        if (!this.authService) {
            console.error('AuthService not available');
            return { error: 'Authentication service not available' };
        }

        try {
            showAuthLoading(true);
            const result = await this.authService.loginUser(username, password);
            
            if (result.error) {
                showAuthError(result.error);
                return result;
            }
            
            // Set authentication tokens and cookies
            if (result.data) {
                // Set userAuthToken for compatibility with navigation system
                localStorage.setItem('userAuthToken', 'authenticated');

                // Set backup cookies
                CookieManager.set('ds_auth_token', 'logged_in', 7);
                CookieManager.set('ds_username', result.data.username, 7);
            }
            
            updateHeaderUI();
            closeAuthModal();
            
            // Show welcome back confirmation modal
            setTimeout(() => {
                showWelcomeBackModal();
            }, 300);
            
            // Handle auth success for competition joins and other post-login actions
            setTimeout(() => {
                if (window.handleAuthSuccess && window.handleAuthSuccess()) {
                    // Auth success was handled by join competition flow
                } else if (window.CompetitionUI && window.CompetitionUI.handleAuthSuccess) {
                    window.CompetitionUI.handleAuthSuccess();
                }
            }, 1000); // Wait for auth state to fully update
            
            return result;
        } catch (error) {
            console.error('Login error:', error);
            showAuthError('Login failed. Please try again.');
            return { error: error.message };
        } finally {
            showAuthLoading(false);
        }
    },
    
    async logout() {
        if (this.authService) {
            await this.authService.logoutUser();
        }
        
        // Clear authentication tokens and cookies
        localStorage.removeItem('userAuthToken');
        CookieManager.delete('ds_auth_token');
        CookieManager.delete('ds_username');
        
        updateHeaderUI();
        closeAccountDropdown();
        showAuthSuccess('Logged out successfully');
    },
    
    async signup(username, password) {
        if (!this.authService) {
            console.error('AuthService not available');
            return { error: 'Authentication service not available' };
        }

        try {
            showAuthLoading(true);
            const result = await this.authService.createUser(username, password);

            if (result.error) {
                showAuthError(result.error);
                return result;
            }


            // Automatically log in the user after successful signup
            if (result.data) {
                // Try to sign in the user
                const loginResult = await this.authService.loginUser(username, password);

                if (loginResult.error) {
                    // Other login error
                    console.error('Auto-login failed:', loginResult.error);
                    showAuthError('Account created but login failed. Please try logging in manually.');
                    return loginResult;
                } else {
                    // Login successful

                    // Update AuthService state since login succeeded
                    if (this.authService && loginResult.data) {
                        this.authService.currentUser = loginResult.data.user || loginResult.data;
                        this.authService.isGuest = false;

                        // Also update AuthManager's reference to ensure consistency
                        if (AuthManager.authService) {
                            AuthManager.authService.currentUser = loginResult.data.user || loginResult.data;
                            AuthManager.authService.isGuest = false;
                        }

                    }

                    // Set authentication tokens and cookies after successful login
                    localStorage.setItem('userAuthToken', 'authenticated');

                    // Set backup cookies with user data
                    CookieManager.set('ds_auth_token', 'logged_in', 7);
                    CookieManager.set('ds_username', username, 7);

                    // Update UI immediately
                    updateHeaderUI();
                    closeAuthModal();

                    // Show recovery code modal if available
                    if (result.recoveryCode) {
                        console.log('🔑 Showing recovery code modal after signup');
                        setTimeout(() => {
                            showRecoveryCodeModal(result.recoveryCode);
                        }, 300);
                    } else {
                        // No recovery code (shouldn't happen for new signups, but handle gracefully)
                        // Check for pending competition join with our new handler
                        setTimeout(() => {
                            if (window.handleAuthSuccess && window.handleAuthSuccess()) {
                                // Auth success was handled by join competition flow
                            } else if (window.CompetitionUI && window.CompetitionUI.handleAuthSuccess) {
                                window.CompetitionUI.handleAuthSuccess();
                            }
                        }, 1000); // Wait for auth state to fully update

                        // Show success confirmation popup with short delay for smooth transition
                        setTimeout(() => {
                            showSuccessConfirmationModal();
                        }, 300); // Short delay for smooth transition
                    }
                }
                
            } else {
                showAuthError('Account creation failed. Please try again.');
            }
            
            return result;
        } catch (error) {
            console.error('Signup error:', error);
            showAuthError('Account creation failed. Please try again.');
            return { error: error.message };
        } finally {
            showAuthLoading(false);
        }
    }
};

// Update the dynamic date in the header - DISABLED for stability
function updateDateTitle() {
    // Update the date title with current local date
    const dateElement = document.getElementById('dateTitle');
    if (!dateElement) {
        console.log('⚠️ updateDateTitle: dateTitle element not found');
        return;
    }

    // Get current local date
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const day = now.getDate();

    // Update the header with current date
    dateElement.innerHTML = `<strong>Daily Shapes</strong> <span class="date-light">${month} ${day}</span>`;
    console.log(`🔄 updateDateTitle: Updated header to ${month} ${day}`);

    // Trigger font adjustment if available
    if (window.adjustHeaderFontSize && typeof window.adjustHeaderFontSize === 'function') {
        window.adjustHeaderFontSize();
    }
}

// Export function for use by other modules
window.updateDateTitle = updateDateTitle;

// Handle profile button click
function handleProfileButtonClick() {
    if (AuthManager.isLoggedIn()) {
        // Show logged-in user modal instead of dropdown
        showLoggedInUserModal();
    } else {
        // Set pending action so we show profile after auth
        localStorage.setItem('pendingUserAction', 'profile');
        openAuthModal();
    }
}

// Update header UI based on authentication state
function updateHeaderUI() {
    const profileButton = document.getElementById('profileButton');
    const profileButtonText = document.getElementById('profileButtonText');
    const compButton = document.getElementById('compButton');
    const archiveButton = document.getElementById('archiveButton');
    const accountDropdown = document.getElementById('accountDropdown');
    
    // Safety check - if required elements don't exist, skip UI update
    if (!profileButton) {
        return;
    }
    
    // Keep the profile button appearance consistent - always show the icon only
    // Remove the text span to keep circular button
    profileButtonText.style.display = 'none';
    
    if (AuthManager.isLoggedIn()) {
        // User is logged in - remove pulse but keep same appearance
        profileButton.classList.remove('logged-in'); // Don't add green styling
        profileButton.classList.remove('pulse');
        
        // Show navigation buttons
        if (compButton) compButton.classList.remove('hidden');
        if (archiveButton) archiveButton.classList.remove('hidden');
    } else {
        // User is not logged in - show pulse animation
        profileButton.classList.remove('logged-in');
        profileButton.classList.add('pulse');
        
        // Hide navigation buttons
        if (compButton) compButton.classList.add('hidden');
        if (archiveButton) archiveButton.classList.add('hidden');
        if (accountDropdown) accountDropdown.style.display = 'none';
    }
}

// Show logged-in user modal
function showLoggedInUserModal() {
    // Get fresh username each time modal is opened
    const username = AuthManager.getUsername();
    const user = AuthManager.getCurrentUser();

    // Debug logging
    console.log('🔍 Profile Modal Debug:', {
        username: username,
        user: user,
        authService: AuthManager.authService?.getCurrentUser()
    });

    const displayName = username || 'Account';
    
    // Create or get the logged-in user modal
    let modal = document.getElementById('loggedInUserModal');
    
    // If modal exists, reset its state first
    if (modal) {
        const confirmDiv = modal.querySelector('#logoutConfirmation');
        const buttons = modal.querySelectorAll('.user-menu-button');
        
        // Ensure we're showing the menu, not the confirmation
        if (confirmDiv) {
            confirmDiv.style.display = 'none';
        }
        buttons.forEach(btn => btn.style.display = 'flex');
    }
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'loggedInUserModal';
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-content">
                <div class="auth-modal-header">
                    <h2 id="loggedInUsername">${displayName}</h2>
                    <button class="auth-modal-close" onclick="closeLoggedInUserModal()">&times;</button>
                </div>
                <div class="auth-modal-body">
                    <div class="user-menu-options">
                        <button class="user-menu-button stats-button" onclick="showUserStats()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#10b981">
                                <path d="M16 6l2 2v12h-16v-12l2-2v-2c0-1.11.89-2 2-2h8c1.11 0 2 .89 2 2v2zm-8 0v-2h8v2h-8zm-5 4v10h14v-10h-14z"/>
                            </svg>
                            <span>View Stats</span>
                        </button>
                        <button class="user-menu-button password-button" onclick="showChangePassword()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6">
                                <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                            </svg>
                            <span>Change Password</span>
                        </button>
                        <button class="user-menu-button logout-button" onclick="showLogoutConfirmation()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444">
                                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                            </svg>
                            <span>Log Out</span>
                        </button>
                        <div id="logoutConfirmation" class="logout-confirmation" style="display: none;">
                            <p>Are you sure you want to log out?</p>
                            <div class="confirmation-buttons">
                                <button class="confirm-btn yes" onclick="confirmLogout()">Yes, Log Out</button>
                                <button class="confirm-btn no" onclick="cancelLogout()">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add CSS for the user menu buttons if not already present
        if (!document.getElementById('userMenuStyles')) {
            const style = document.createElement('style');
            style.id = 'userMenuStyles';
            style.textContent = `
                #loggedInUserModal .auth-modal-header h2 {
                    color: #333 !important;
                }
                
                .user-menu-options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 20px;
                }
                
                .user-menu-button {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: white;
                    border: 2px solid #000;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: left;
                    width: 100%;
                }
                
                .user-menu-button span {
                    color: #333;
                }
                
                .user-menu-button:hover {
                    background-color: #f8f9fa;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
                
                .user-menu-button.stats-button {
                    border-color: #10b981;
                }
                
                .user-menu-button.stats-button:hover {
                    background-color: #e8f5e8;
                }
                
                .user-menu-button.password-button {
                    border-color: #3b82f6;
                }
                
                .user-menu-button.password-button:hover {
                    background-color: #e8f0fe;
                }
                
                .user-menu-button.logout-button {
                    border-color: #ef4444;
                }
                
                .user-menu-button.logout-button span {
                    color: #ef4444;
                }
                
                .user-menu-button.logout-button:hover {
                    background-color: #fee2e2;
                }
                
                .user-menu-button svg {
                    flex-shrink: 0;
                }
                
                .logout-confirmation {
                    padding: 20px;
                    text-align: center;
                }
                
                .logout-confirmation p {
                    font-size: 16px;
                    color: #333;
                    margin-bottom: 20px;
                    font-weight: 600;
                }
                
                .confirmation-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                
                .confirm-btn {
                    padding: 10px 20px;
                    border: 2px solid #000;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .confirm-btn.yes {
                    background: #ef4444;
                    color: white;
                    border-color: #ef4444;
                }
                
                .confirm-btn.yes:hover {
                    background: #dc2626;
                    border-color: #dc2626;
                }
                
                .confirm-btn.no {
                    background: white;
                    color: #333;
                }
                
                .confirm-btn.no:hover {
                    background: #f8f9fa;
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        // Update username in case it changed
        const usernameElement = modal.querySelector('#loggedInUsername');
        if (usernameElement) {
            usernameElement.textContent = displayName;
        }
    }
    
    modal.style.display = 'flex';
}

// Close logged-in user modal
function closeLoggedInUserModal() {
    const modal = document.getElementById('loggedInUserModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Reset modal state when closing
        const confirmDiv = modal.querySelector('#logoutConfirmation');
        const buttons = modal.querySelectorAll('.user-menu-button');
        
        if (confirmDiv) {
            confirmDiv.style.display = 'none';
        }
        buttons.forEach(btn => btn.style.display = 'flex');
    }
}

// Toggle account dropdown
function toggleAccountDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'block';
        // Position dropdown below the button
        const button = document.getElementById('profileButton');
        const rect = button.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 5) + 'px';
        dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    }
}

// Close account dropdown
function closeAccountDropdown() {
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

// Open authentication modal
function openAuthModal(mode = 'signup', customMessage = null) {
    const modal = document.getElementById('authModal');
    if (modal) {
        // CRITICAL: Disable orientation checks while modal is open
        window.isModalOpenForOrientationCheck = true;
        console.log('🔓 Auth modal opened - orientation checks DISABLED');

        // Lock body position on small screens to prevent background shift when keyboard appears
        if (window.innerWidth <= 400 && window.innerHeight <= 700) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.setAttribute('data-scroll-lock', scrollY);
            console.log('🔒 Body locked at scroll position:', scrollY);
        }

        modal.style.display = 'flex';

        // Set custom message if provided
        const customMessageDiv = document.getElementById('authCustomMessage');
        if (customMessageDiv) {
            if (customMessage) {
                customMessageDiv.innerHTML = customMessage;
                customMessageDiv.style.display = 'block';
            } else {
                customMessageDiv.style.display = 'none';
            }
        }

        // Set auth mode (signup or login)
        switchAuthMode(mode);
        setTimeout(() => {
            const usernameField = document.getElementById('authUsername');
            if (usernameField) usernameField.focus();
        }, 100);
    }
}

// Close authentication modal
function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';

    // Unlock body position if it was locked
    const scrollY = document.body.getAttribute('data-scroll-lock');
    if (scrollY !== null) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.removeAttribute('data-scroll-lock');
        window.scrollTo(0, parseInt(scrollY));
        console.log('🔓 Body unlocked, restored scroll position:', scrollY);
    }

    // CRITICAL: Re-enable orientation checks when modal closes
    window.isModalOpenForOrientationCheck = false;
    console.log('🔒 Auth modal closed - orientation checks RE-ENABLED');

    // Hide custom message
    const customMessageDiv = document.getElementById('authCustomMessage');
    if (customMessageDiv) {
        customMessageDiv.style.display = 'none';
        customMessageDiv.innerHTML = '';
    }

    // Reset form
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
    const confirmPasswordInput = document.getElementById('authConfirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.value = '';
    }
}

// Switch between login and signup modes
function switchAuthMode(mode) {
    const title = document.getElementById('authModalTitle');
    const submitButton = document.getElementById('authSubmitButton');
    const switchText = document.getElementById('authSwitchText');
    const usernameGroup = document.getElementById('usernameGroup');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    if (mode === 'signup') {
        title.textContent = 'Sign Up';
        submitButton.textContent = 'Sign Up and Log In';
        submitButton.onclick = handleSignup;
        switchText.innerHTML = 'Already have an account? <a href="#" onclick="switchAuthMode(\'login\'); return false;">Log In</a>';
        usernameGroup.style.display = 'block';
        if (confirmPasswordGroup) {
            confirmPasswordGroup.style.display = 'block';
        }
        // Hide forgot password link in signup mode
        if (forgotPasswordLink) {
            forgotPasswordLink.style.display = 'none';
        }
    } else {
        title.textContent = 'Log In';
        submitButton.textContent = 'Log In';
        submitButton.onclick = handleLogin;
        switchText.innerHTML = 'Don\'t have an account? <a href="#" onclick="switchAuthMode(\'signup\'); return false;">Sign Up</a>';
        // Username is required for login now (no email), so keep it visible
        usernameGroup.style.display = 'block';
        if (confirmPasswordGroup) {
            confirmPasswordGroup.style.display = 'none';
        }
        // Show forgot password link in login mode
        if (forgotPasswordLink) {
            forgotPasswordLink.style.display = 'block';
        }
    }
}

// Handle login submission
async function handleLogin() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!username || !password) {
        showAuthError('Please fill in all fields');
        return;
    }

    const result = await AuthManager.login(username, password);
    // Error is already shown by AuthManager.login via showAuthError
    // No need to handle it here
}

// Handle signup submission
async function handleSignup() {
    console.log('🎯 handleSignup called!');
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const confirmPassword = document.getElementById('authConfirmPassword').value;
    console.log('📝 Form values:', {username, passwordLength: password.length});

    if (!username || !password || !confirmPassword) {
        showAuthError('Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        showAuthError('Passwords do not match');
        return;
    }

    // Basic validation
    if (username.length < 3) {
        showAuthError('Username must be at least 3 characters');
        return;
    }

    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }

    try {
        await AuthManager.signup(username, password);
    } catch (error) {
        console.error('Signup error:', error);
        showAuthError('Signup failed: ' + error.message);
    }
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        AuthManager.logout();
    }
}

// Show loading state
function showAuthLoading(isLoading) {
    const submitButton = document.getElementById('authSubmitButton');
    const socialButtons = document.querySelectorAll('.social-auth-button');
    
    if (submitButton) {
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading ? 'Please wait...' : 
            (submitButton.textContent.includes('Sign Up') ? 'Sign Up' : 'Log In');
    }
    
    socialButtons.forEach(btn => btn.disabled = isLoading);
}

// Show authentication error
function showAuthError(message) {
    console.log('🔴 Showing auth error:', message);
    const errorElement = document.getElementById('authError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.className = 'auth-feedback error';
        // Use setAttribute to set inline styles with !important
        errorElement.setAttribute('style', 
            'display: block !important;' +
            'color: #dc2626 !important;' +
            'background-color: #fee2e2 !important;' +
            'border: 1px solid #fca5a5 !important;' +
            'padding: 12px !important;' +
            'margin: 10px 0 !important;' +
            'border-radius: 6px !important;' +
            'font-size: 14px !important;' +
            'text-align: center !important;' +
            'font-weight: 500 !important;'
        );
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        console.error('Auth error element not found!');
        // Fallback to alert for now
        alert('Error: ' + message);
    }
}

// Show authentication success
function showAuthSuccess(message) {
    const successElement = document.getElementById('authSuccess');
    if (successElement) {
        successElement.textContent = message;
        successElement.className = 'auth-feedback success';
        // Use setAttribute to set inline styles with !important
        successElement.setAttribute('style', 
            'display: block !important;' +
            'color: #16a34a !important;' +
            'background-color: #dcfce7 !important;' +
            'border: 1px solid #86efac !important;' +
            'padding: 12px !important;' +
            'margin: 10px 0 !important;' +
            'border-radius: 6px !important;' +
            'font-size: 14px !important;' +
            'text-align: center !important;' +
            'font-weight: 500 !important;'
        );
        
        // Hide after 3 seconds
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    }
}

// Create feedback element if it doesn't exist
function createAuthFeedback(type) {
    const element = document.createElement('div');
    element.id = `auth${type.charAt(0).toUpperCase() + type.slice(1)}`;
    element.className = `auth-feedback ${type}`;
    element.style.display = 'none';
    
    const authForm = document.querySelector('.auth-form');
    if (authForm) {
        authForm.insertBefore(element, authForm.firstChild);
    }
    
    return element;
}

// Navigation functions for menu integration
function openCompetition() {
    if (window.handleCompetitionClick) {
        window.handleCompetitionClick();
    } else {
        alert('Competition feature coming soon!');
    }
}

function openPractice() {
    alert('Practice mode is not yet implemented.');
}

// Success Confirmation Modal Functions
function showSuccessConfirmationModal() {
    const modal = document.getElementById('successConfirmationModal');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important');

        // Force modal content to specific heights based on layout
        const modalContent = document.getElementById('successConfirmationContent');
        if (modalContent) {
            if (window.innerWidth >= 768) {
                // Desktop
                modalContent.style.setProperty('max-height', '185px', 'important');
                console.log('✅ Desktop: Forced modal height to 185px');
            } else if (window.innerWidth >= 357 && window.innerWidth <= 375 && window.innerHeight >= 560 && window.innerHeight <= 600) {
                // iPhone SE 2 and similar (375x560) - increase height to fit continue button
                modalContent.style.setProperty('max-height', '220px', 'important');
                console.log('✅ Mobile 375x560: Forced modal height to 220px');
            }
        }

        console.log('✅ Success confirmation modal shown');
    } else {
        console.error('❌ Success modal not found in DOM!');
    }
}

// Handle continue button in success modal - takes user to their original destination
function continueToOriginalDestination() {
    const pendingAction = localStorage.getItem('pendingUserAction');

    // Close the success modal first
    closeSuccessModal();

    // Take user to their original destination
    if (pendingAction === 'profile') {
        console.log('✅ Continuing to user profile after authentication');
        // Clear the pending action
        localStorage.removeItem('pendingUserAction');
        // Show user stats/profile modal
        if (window.showUserStats && typeof window.showUserStats === 'function') {
            window.showUserStats();
        } else if (window.showLoggedInUserModal && typeof window.showLoggedInUserModal === 'function') {
            window.showLoggedInUserModal();
        }
    } else if (pendingAction === 'practice') {
        console.log('✅ Continuing to practice mode after authentication');
        // Clear the pending action
        localStorage.removeItem('pendingUserAction');
        // Enter practice mode - use new practice-mode.js system
        if (window.PracticeMode && window.PracticeMode.open) {
            window.PracticeMode.open();
        } else if (window.enterSimplePracticeMode) {
            window.enterSimplePracticeMode();
        } else if (window.enterPracticeMode) {
            window.enterPracticeMode();
        }
    } else if (pendingAction === 'competitions') {
        console.log('✅ Continuing to competitions after authentication');
        // Clear the pending action
        localStorage.removeItem('pendingUserAction');
        // Show original competition modal (not the NEW system)
        if (window.openCompetitionModal) {
            console.log('🔍 Using original competition modal');
            window.openCompetitionModal();
        } else {
            // Fallback: try to open competition modal directly
            console.log('🔍 Direct fallback to competition modal');
            const competitionModal = document.getElementById('competitionModal');
            if (competitionModal) {
                competitionModal.style.display = 'flex';
                // Ensure it shows the main view (not my competitions)
                if (window.showCompetitionMain) {
                    window.showCompetitionMain();
                }
            }
        }
    } else {
        console.log('✅ No specific destination, starting daily mode');
        // Clear any pending action
        localStorage.removeItem('pendingUserAction');
        // Start daily game mode
        if (window.startDailyGame) {
            window.startDailyGame();
        } else if (window.handlePlayButtonClick) {
            window.handlePlayButtonClick();
        }
    }
}

// Make function globally available
window.continueToOriginalDestination = continueToOriginalDestination;

// Welcome Back Modal for existing users
function showWelcomeBackModal() {
    const modal = document.getElementById('successConfirmationModal');
    if (modal) {
        // Update modal content for returning users
        const header = modal.querySelector('.success-modal-header h2');
        const welcomeIcon = modal.querySelector('.welcome-icon');
        const welcomeTitle = modal.querySelector('.success-modal-body h3');
        const welcomeText = modal.querySelector('.success-modal-body p');

        if (header) header.textContent = 'Welcome back!';
        if (welcomeIcon) welcomeIcon.textContent = '';
        if (welcomeTitle) welcomeTitle.textContent = 'Great to see you again!';
        if (welcomeText) welcomeText.textContent = 'Ready to continue playing?';

        modal.style.display = 'flex';

        // Force modal content to 185px height for desktop
        const modalContent = document.getElementById('successConfirmationContent');
        if (modalContent && window.innerWidth >= 768) {
            modalContent.style.setProperty('max-height', '185px', 'important');
            console.log('✅ Desktop: Forced modal height to 185px');
        }
    } else {
        console.error('Success modal not found in DOM!');
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('successConfirmationModal');
    if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        console.log('✅ Success confirmation modal closed');
    }
}

// Success Modal Navigation Functions
function startDailyGame() {
    closeSuccessModal();
    // Go to daily game (already the default view)
    if (window.handleDailyClick) {
        window.handleDailyClick();
    }
}

function viewCompetitions() {
    closeSuccessModal();
    // Open the competition modal
    if (window.openCompetitionModal) {
        window.openCompetitionModal();
    } else if (window.handleCompetitionClick) {
        window.handleCompetitionClick();
    }
}

function seePractice() {
    closeSuccessModal();
    // Navigate to practice section
    if (window.handlePracticeClick) {
        window.handlePracticeClick();
    }
}

// Profile Menu Functions for Signed-in Users
function showUserProfileMenu() {
    // Create profile menu if it doesn't exist
    let profileMenu = document.getElementById('userProfileMenu');
    if (!profileMenu) {
        profileMenu = document.createElement('div');
        profileMenu.id = 'userProfileMenu';
        profileMenu.className = 'user-profile-menu';
        profileMenu.innerHTML = `
            <div class="profile-menu-item" onclick="handleCheckStats()">
                <span class="menu-icon">📊</span>
                <span class="menu-text">Check Stats</span>
            </div>
            <div class="profile-menu-item" onclick="showChangePasswordForm()">
                <span class="menu-icon">🔒</span>
                <span class="menu-text">Change Password</span>
            </div>
            <div class="profile-menu-divider"></div>
            <div class="profile-menu-item logout" onclick="handleLogOut()">
                <span class="menu-icon">🚪</span>
                <span class="menu-text">Log Out</span>
            </div>
        `;
        document.body.appendChild(profileMenu);
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (profileMenu && !profileMenu.contains(event.target) && 
                event.target.id !== 'animatedMenuButton' && 
                !event.target.closest('#animatedMenuButton')) {
                profileMenu.style.display = 'none';
            }
        });
    }
    
    // Position and show the menu
    const menuButton = document.getElementById('animatedMenuButton');
    if (menuButton && profileMenu) {
        const rect = menuButton.getBoundingClientRect();
        profileMenu.style.top = (rect.bottom + 5) + 'px';
        profileMenu.style.right = (window.innerWidth - rect.right) + 'px';
        profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
    }
}

function hideUserProfileMenu() {
    const profileMenu = document.getElementById('userProfileMenu');
    if (profileMenu) {
        profileMenu.style.display = 'none';
    }
}

// Profile Menu Action Functions
function checkUserStats() {
    hideUserProfileMenu();
    // Navigate to profile section to see stats
    if (window.handleProfileClick) {
        window.handleProfileClick();
    }
}

function showChangePasswordForm() {
    hideUserProfileMenu();

    // ABSOLUTE LOCK: Freeze everything on small screens
    if (window.innerWidth <= 400 && window.innerHeight <= 700) {
        const scrollY = window.scrollY;
        document.body.setAttribute('data-scroll-lock', scrollY);

        // Lock the viewport at current dimensions
        const currentHeight = window.innerHeight;
        document.body.setAttribute('data-viewport-height', currentHeight);

        // LOCK BODY IN PLACE
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.height = `${currentHeight + scrollY}px`;
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';

        // Prevent ALL scrolling and touch movement
        const preventMove = (e) => {
            // Allow touch only on modal elements
            if (e.target.closest('.auth-modal')) {
                return; // Let modal handle its own scrolling
            }
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        window.addEventListener('scroll', preventMove, { passive: false, capture: true });
        window.addEventListener('touchmove', preventMove, { passive: false, capture: true });
        window.addEventListener('wheel', preventMove, { passive: false, capture: true });

        document.body.setAttribute('data-prevent-handlers', 'true');

        // Force scroll position to stay at 0 constantly
        const lockScroll = setInterval(() => {
            if (window.scrollY !== 0 || window.scrollX !== 0) {
                window.scrollTo(0, 0);
                console.log('⚠️ Forced scroll back to 0');
            }
        }, 16);

        document.body.setAttribute('data-scroll-interval', lockScroll);

        console.log('🔒 ABSOLUTE LOCK: Body frozen at scroll:', scrollY);
    }

    // Create change password modal
    let passwordModal = document.getElementById('changePasswordModal');
    if (!passwordModal) {
        passwordModal = document.createElement('div');
        passwordModal.id = 'changePasswordModal';
        passwordModal.className = 'auth-modal';
        passwordModal.innerHTML = `
            <div class="auth-modal-content">
                <div class="auth-modal-header">
                    <h2>Change Password</h2>
                    <button class="auth-modal-close" onclick="closeChangePasswordModal()">&times;</button>
                </div>
                <div class="auth-modal-body">
                    <div class="auth-form">
                        <div class="form-group">
                            <label for="currentPassword">Current Password</label>
                            <input type="password" id="currentPassword" placeholder="Enter current password" required>
                        </div>
                        <div class="form-group">
                            <label for="newPassword">New Password</label>
                            <input type="password" id="newPassword" placeholder="Enter new password" required minlength="6">
                            <div class="input-help">Minimum 6 characters</div>
                        </div>
                        <div class="form-group">
                            <label for="confirmPassword">Confirm New Password</label>
                            <input type="password" id="confirmPassword" placeholder="Confirm password" required>
                        </div>
                        <button class="auth-submit-button" onclick="handlePasswordChange()">Update Password</button>
                        <div id="passwordChangeError" class="auth-feedback error" style="display: none;"></div>
                        <div id="passwordChangeSuccess" class="auth-feedback success" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(passwordModal);
    }

    // CRITICAL: Disable orientation checks while modal is open
    window.isModalOpenForOrientationCheck = true;

    passwordModal.style.display = 'flex';
}

function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        // Blur any active input to ensure keyboard closes
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
            console.log('🔓 Blurred active input field');
        }

        modal.style.display = 'none';

        // Unlock everything
        const scrollY = document.body.getAttribute('data-scroll-lock');

        // Clear the scroll enforcement interval
        const scrollInterval = document.body.getAttribute('data-scroll-interval');
        if (scrollInterval) {
            clearInterval(parseInt(scrollInterval));
            document.body.removeAttribute('data-scroll-interval');
        }

        // Remove event listeners
        if (document.body.getAttribute('data-prevent-handlers') === 'true') {
            const preventMove = (e) => {
                if (e.target.closest('.auth-modal')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                return false;
            };

            window.removeEventListener('scroll', preventMove, { capture: true });
            window.removeEventListener('touchmove', preventMove, { capture: true });
            window.removeEventListener('wheel', preventMove, { capture: true });

            document.body.removeAttribute('data-prevent-handlers');
        }

        // Unlock body styles
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';

        document.body.removeAttribute('data-viewport-height');

        if (scrollY !== null) {
            document.body.removeAttribute('data-scroll-lock');
            const targetScroll = parseInt(scrollY);

            // CRITICAL: On small screens, wait for keyboard to fully close before restoring scroll
            if (window.innerWidth <= 400 && window.innerHeight <= 700) {
                console.log('🔓 Small screen - restoring scroll to original position:', targetScroll);

                // Wait for keyboard to close, then restore scroll
                setTimeout(() => {
                    window.scrollTo(0, targetScroll);
                    console.log('🔓 Scroll restored:', targetScroll);
                }, 100);
            } else {
                // Immediate scroll restoration for non-small screens
                window.scrollTo(0, targetScroll);
                console.log('🔓 Body unlocked, restored scroll position:', scrollY);
            }
        } else {
            console.log('🔓 Body styles reset (no scroll position to restore)');
        }

        // CRITICAL: Re-enable orientation checks when modal closes
        window.isModalOpenForOrientationCheck = false;

        // Clear form
        const currentPwdField = document.getElementById('currentPassword');
        const newPwdField = document.getElementById('newPassword');
        const confirmPwdField = document.getElementById('confirmPassword');
        if (currentPwdField) currentPwdField.value = '';
        if (newPwdField) newPwdField.value = '';
        if (confirmPwdField) confirmPwdField.value = '';
        // Hide messages
        document.getElementById('passwordChangeError').style.display = 'none';
        document.getElementById('passwordChangeSuccess').style.display = 'none';
    }
}

async function handlePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    const errorElement = document.getElementById('passwordChangeError');
    const successElement = document.getElementById('passwordChangeSuccess');
    
    // Hide previous messages
    errorElement.style.display = 'none';
    successElement.style.display = 'none';
    
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
        errorElement.textContent = 'Please fill in all fields';
        errorElement.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorElement.textContent = 'New password must be at least 6 characters';
        errorElement.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorElement.textContent = 'New passwords do not match';
        errorElement.style.display = 'block';
        return;
    }
    
    try {
        // Update password using Supabase
        if (window.SupabaseConfig && window.SupabaseConfig.isReady()) {
            const { error } = await SupabaseConfig.client.auth.updateUser({
                password: newPassword
            });
            
            if (error) {
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
                return;
            }

            // CRITICAL: Blur inputs immediately to close keyboard BEFORE showing success message
            const currentPwdField = document.getElementById('currentPassword');
            const newPwdField = document.getElementById('newPassword');
            const confirmPwdField = document.getElementById('confirmPassword');
            if (currentPwdField) currentPwdField.blur();
            if (newPwdField) newPwdField.blur();
            if (confirmPwdField) confirmPwdField.blur();
            console.log('🔓 All password fields blurred - keyboard should close');

            successElement.textContent = 'Password updated successfully!';
            successElement.style.display = 'block';

            // Close modal after short delay (keyboard should already be closed by now)
            setTimeout(() => {
                closeChangePasswordModal();
            }, 2000);
        } else {
            errorElement.textContent = 'Password change not available in demo mode';
            errorElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Password change error:', error);
        errorElement.textContent = 'Failed to update password. Please try again.';
        errorElement.style.display = 'block';
    }
}

// Handle check stats action
function handleCheckStats() {
    // Close profile menu
    closeUserProfileMenu();
    
    // Open stats overlay
    if (typeof showStatsOverlay === 'function') {
        showStatsOverlay();
    } else if (typeof executeMenuAction === 'function') {
        // Navigate to stats section
        executeMenuAction('stats');
    } else {
        alert('Stats feature coming soon!');
    }
}

// Handle logout action (redirect to main handleLogout)
async function handleLogOut() {
    // Just call the main handleLogout function to use the integrated confirmation
    handleLogout();
}

// Handle social login
async function handleSocialLogin(provider) {
    try {
        showAuthLoading(true);
        const result = await SocialAuthConfig.handleSocialLogin(provider);
        
        if (result.error) {
            showAuthError(result.error);
            return;
        }
        
        updateHeaderUI();
        closeAuthModal();
        showAuthSuccess(`Welcome! Signed in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`);
        
        // Check for pending competition join with our new handler
        setTimeout(() => {
            if (window.handleAuthSuccess && window.handleAuthSuccess()) {
                // Auth success was handled by join competition flow
            } else if (window.CompetitionUI && window.CompetitionUI.handleAuthSuccess) {
                window.CompetitionUI.handleAuthSuccess();
            }
        }, 1000); // Wait for auth state to fully update
    } catch (error) {
        console.error('Social login error:', error);
        showAuthError(`${provider} login failed. Please try again.`);
    } finally {
        showAuthLoading(false);
    }
}

// ================================
// PROFILE MENU FUNCTIONS
// ================================

// Show user statistics modal
async function showUserStats() {
    const modal = document.getElementById('userStatsModal');
    const statsLoading = document.getElementById('statsLoading');
    const statsDisplay = document.getElementById('statsDisplay');
    const statsError = document.getElementById('statsError');

    if (!modal) return;

    // CRITICAL: Disable orientation checks while modal is open
    window.isModalOpenForOrientationCheck = true;

    // Close logged-in user modal
    closeLoggedInUserModal();

    // Close account dropdown
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    // Show modal and loading state
    modal.style.display = 'flex';
    statsLoading.style.display = 'block';
    statsDisplay.style.display = 'none';
    statsError.style.display = 'none';
    
    try {
        // Load user stats from UserAccountManager
        if (window.UserAccountManager) {
            // Force a fresh reload from database every time the modal opens
            console.log('🔄 Refreshing user profile from database...');
            await window.UserAccountManager.loadUserProfile();
            const stats = window.UserAccountManager.getUserStats();

            if (stats) {
                console.log('🎯 DEBUG: User stats loaded:', stats);
                console.log('🎯 DEBUG: competitionsWon raw value:', stats.competitionsWon, 'type:', typeof stats.competitionsWon);
                console.log('🎯 DEBUG: currentStreak raw value:', stats.currentStreak, 'type:', typeof stats.currentStreak);

                // Populate stats - ensure no undefined values ever display
                // Use strict checks to handle undefined, null, NaN, and string "undefined"
                const safeNumber = (val, fieldName) => {
                    console.log(`🔍 safeNumber called for ${fieldName}:`, val, 'type:', typeof val);
                    if (val === undefined || val === null || val === 'undefined' || String(val) === 'undefined' || isNaN(val)) {
                        console.log(`  → Returning 0 for ${fieldName}`);
                        return 0;
                    }
                    const result = typeof val === 'number' ? val : parseInt(val) || 0;
                    console.log(`  → Returning ${result} for ${fieldName}`);
                    return result;
                };

                // Set each stat with ultra-defensive checks
                const perfectCutsValue = safeNumber(stats.perfectCuts, 'perfectCuts');
                const currentStreakValue = safeNumber(stats.currentStreak, 'currentStreak');
                const bestStreakValue = safeNumber(stats.bestStreak, 'bestStreak');
                const averageScoreValue = safeNumber(stats.averageScore, 'averageScore');
                const totalScoreValue = safeNumber(stats.totalScore, 'totalScore');
                const competitionsWonValue = safeNumber(stats.competitionsWon, 'competitionsWon');

                // Verify values are never undefined before setting
                console.log('🎯 DEBUG: Final values before setting to DOM:', {
                    perfectCuts: perfectCutsValue,
                    currentStreak: currentStreakValue,
                    bestStreak: bestStreakValue,
                    averageScore: averageScoreValue,
                    totalScore: totalScoreValue,
                    competitionsWon: competitionsWonValue
                });

                document.getElementById('perfectCuts').textContent = perfectCutsValue;
                document.getElementById('currentStreak').textContent = currentStreakValue;
                document.getElementById('bestStreak').textContent = bestStreakValue;
                // Average score is now a whole number (no decimals)
                document.getElementById('averageScore').textContent = averageScoreValue + '%';
                document.getElementById('totalScore').textContent = totalScoreValue;
                document.getElementById('competitionsWon').textContent = competitionsWonValue;

                console.log('🎯 DEBUG: Actual DOM textContent after setting:');
                console.log('  - perfectCuts:', document.getElementById('perfectCuts').textContent);
                console.log('  - currentStreak:', document.getElementById('currentStreak').textContent);
                console.log('  - competitionsWon:', document.getElementById('competitionsWon').textContent);
                
                // Show stats display
                statsLoading.style.display = 'none';
                statsDisplay.style.display = 'block';
            } else {
                throw new Error('No stats available');
            }
        } else {
            throw new Error('UserAccountManager not available');
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
        
        // Show error state
        statsLoading.style.display = 'none';
        statsError.style.display = 'block';
    }
}

// Close user stats modal
function closeUserStatsModal() {
    const modal = document.getElementById('userStatsModal');
    if (modal) {
        modal.style.display = 'none';

        // CRITICAL: Re-enable orientation checks when modal closes
        window.isModalOpenForOrientationCheck = false;
    }
}

// Show change password modal
function showChangePassword() {
    const modal = document.getElementById('changePasswordModal');
    if (!modal) return;

    // ABSOLUTE LOCK: Freeze everything on small screens
    if (window.innerWidth <= 400 && window.innerHeight <= 700) {
        const scrollY = window.scrollY;
        document.body.setAttribute('data-scroll-lock', scrollY);

        // Lock the viewport at current dimensions
        const currentHeight = window.innerHeight;
        document.body.setAttribute('data-viewport-height', currentHeight);

        // LOCK BODY IN PLACE
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.height = `${currentHeight + scrollY}px`;
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';

        // Prevent ALL scrolling and touch movement
        const preventMove = (e) => {
            // Allow touch only on modal elements
            if (e.target.closest('.auth-modal')) {
                return; // Let modal handle its own scrolling
            }
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        window.addEventListener('scroll', preventMove, { passive: false, capture: true });
        window.addEventListener('touchmove', preventMove, { passive: false, capture: true });
        window.addEventListener('wheel', preventMove, { passive: false, capture: true });

        document.body.setAttribute('data-prevent-handlers', 'true');

        // Force scroll position to stay at 0 constantly
        const lockScroll = setInterval(() => {
            if (window.scrollY !== 0 || window.scrollX !== 0) {
                window.scrollTo(0, 0);
                console.log('⚠️ Forced scroll back to 0');
            }
        }, 16);

        document.body.setAttribute('data-scroll-interval', lockScroll);

        console.log('🔒 ABSOLUTE LOCK: Body frozen at scroll:', scrollY);
    }

    // CRITICAL: Disable orientation checks while modal is open
    window.isModalOpenForOrientationCheck = true;

    // Close logged-in user modal
    closeLoggedInUserModal();

    // Close account dropdown
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    // Reset form and show modal
    const form = document.getElementById('changePasswordForm');
    if (form) {
        form.reset();
    }

    // Hide any existing messages
    hideChangePasswordMessages();

    modal.style.display = 'flex';

    // NUCLEAR OPTION: Monitor and enforce frozen body position every frame
    if (window.innerWidth <= 400 && window.innerHeight <= 700) {
        const enforceBodyLock = setInterval(() => {
            // Force body back to exact position if iOS tries anything
            if (document.body.style.position === 'fixed') {
                document.body.style.top = '0px';
                document.body.style.left = '0px';
                document.body.style.right = '0px';
                document.body.style.bottom = '0px';

                // Also force window scroll to stay at 0
                if (window.scrollY !== 0 || window.scrollX !== 0) {
                    window.scrollTo(0, 0);
                    console.log('⚠️ Window scroll detected - forcing back to 0,0');
                }
            }
        }, 16); // Every frame (~60fps)

        modal.setAttribute('data-body-lock-interval', enforceBodyLock);
    }
}

// Close change password modal
function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        // Blur any active input to ensure keyboard closes
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
            console.log('🔓 Blurred active input field');
        }

        modal.style.display = 'none';

        // Unlock everything
        const scrollY = document.body.getAttribute('data-scroll-lock');

        // Clear the scroll enforcement interval
        const scrollInterval = document.body.getAttribute('data-scroll-interval');
        if (scrollInterval) {
            clearInterval(parseInt(scrollInterval));
            document.body.removeAttribute('data-scroll-interval');
        }

        // Remove event listeners
        if (document.body.getAttribute('data-prevent-handlers') === 'true') {
            const preventMove = (e) => {
                if (e.target.closest('.auth-modal')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                return false;
            };

            window.removeEventListener('scroll', preventMove, { capture: true });
            window.removeEventListener('touchmove', preventMove, { capture: true });
            window.removeEventListener('wheel', preventMove, { capture: true });

            document.body.removeAttribute('data-prevent-handlers');
        }

        // Unlock body styles
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';

        document.body.removeAttribute('data-viewport-height');

        if (scrollY !== null) {
            document.body.removeAttribute('data-scroll-lock');
            const targetScroll = parseInt(scrollY);

            // CRITICAL: On small screens, wait for keyboard to fully close before restoring scroll
            if (window.innerWidth <= 400 && window.innerHeight <= 700) {
                console.log('🔓 Small screen - restoring scroll to original position:', targetScroll);

                // Wait for keyboard to close, then restore scroll
                setTimeout(() => {
                    window.scrollTo(0, targetScroll);
                    console.log('🔓 Scroll restored:', targetScroll);
                }, 100);
            } else {
                // Immediate scroll restoration for non-small screens
                window.scrollTo(0, targetScroll);
                console.log('🔓 Body unlocked, restored scroll position:', scrollY);
            }
        } else {
            console.log('🔓 Body styles reset (no scroll position to restore)');
        }

        // CRITICAL: Re-enable orientation checks when modal closes
        window.isModalOpenForOrientationCheck = false;
    }
}

// Handle change password form submission
async function handleChangePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Hide previous messages
    hideChangePasswordMessages();
    
    // Validation
    if (newPassword !== confirmPassword) {
        showChangePasswordError('New passwords do not match');
        return;
    }
    
    if (newPassword.length < 6) {
        showChangePasswordError('Password must be at least 6 characters');
        return;
    }
    
    if (currentPassword === newPassword) {
        showChangePasswordError('New password must be different from current password');
        return;
    }
    
    // Show loading state
    const submitButton = document.getElementById('changePasswordSubmit');
    const buttonText = submitButton.querySelector('.button-text');
    const spinner = submitButton.querySelector('.loading-spinner');
    
    submitButton.disabled = true;
    buttonText.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        // Use Supabase to update password
        if (!window.SupabaseConfig || !window.SupabaseConfig.client) {
            throw new Error('Authentication service not available');
        }
        
        // Get username and generate internal email
        const username = AuthManager.getUsername();
        if (!username) {
            throw new Error('User not found');
        }
        const email = `${username.toLowerCase()}@dailyshapes.local`;

        // First verify current password by trying to sign in
        const { error: verifyError } = await SupabaseConfig.client.auth.signInWithPassword({
            email: email,
            password: currentPassword
        });

        if (verifyError) {
            throw new Error('Current password is incorrect');
        }
        
        // Update password
        const { error: updateError } = await SupabaseConfig.client.auth.updateUser({
            password: newPassword
        });
        
        if (updateError) {
            throw new Error(updateError.message);
        }

        // Success - CRITICAL: Blur inputs immediately to close keyboard BEFORE showing success message
        const currentPwdField = document.getElementById('currentPassword');
        const newPwdField = document.getElementById('newPassword');
        const confirmPwdField = document.getElementById('confirmPassword');
        if (currentPwdField) currentPwdField.blur();
        if (newPwdField) newPwdField.blur();
        if (confirmPwdField) confirmPwdField.blur();
        console.log('🔓 All password fields blurred - keyboard should close');

        showChangePasswordSuccess('Password updated successfully!');

        // Close modal after 2 seconds (keyboard should already be closed by now)
        setTimeout(() => {
            closeChangePasswordModal();
        }, 2000);
        
    } catch (error) {
        console.error('Password change error:', error);
        showChangePasswordError(error.message);
    } finally {
        // Reset loading state
        submitButton.disabled = false;
        buttonText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Helper functions for change password messages
function showChangePasswordError(message) {
    const errorDiv = document.getElementById('changePasswordError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function showChangePasswordSuccess(message) {
    const successDiv = document.getElementById('changePasswordSuccess');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
}

function hideChangePasswordMessages() {
    const errorDiv = document.getElementById('changePasswordError');
    const successDiv = document.getElementById('changePasswordSuccess');
    
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
    
    if (successDiv) {
        successDiv.style.display = 'none';
    }
}

// Show logout confirmation
function showLogoutConfirmation() {
    const modal = document.getElementById('loggedInUserModal');
    if (modal) {
        const menuOptions = modal.querySelector('.user-menu-options');
        const confirmDiv = modal.querySelector('#logoutConfirmation');
        
        // Hide menu buttons and show confirmation
        const buttons = modal.querySelectorAll('.user-menu-button');
        buttons.forEach(btn => btn.style.display = 'none');
        
        if (confirmDiv) {
            confirmDiv.style.display = 'block';
        }
    }
}

// Cancel logout
function cancelLogout() {
    const modal = document.getElementById('loggedInUserModal');
    if (modal) {
        const confirmDiv = modal.querySelector('#logoutConfirmation');
        const buttons = modal.querySelectorAll('.user-menu-button');
        
        // Show menu buttons and hide confirmation
        buttons.forEach(btn => btn.style.display = 'flex');
        
        if (confirmDiv) {
            confirmDiv.style.display = 'none';
        }
    }
}

// Confirm logout
function confirmLogout() {
    // Close logged-in user modal
    closeLoggedInUserModal();
    
    // Close account dropdown
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    AuthManager.logout();
}

// Enhanced logout with confirmation (for backward compatibility)
function handleLogout() {
    showLogoutConfirmation();
}

// ================================
// FORGOT PASSWORD FUNCTIONS
// ================================

// Show forgot password form
function showForgotPasswordForm() {
    closeAuthModal();

    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        // CRITICAL: Disable orientation checks while modal is open
        window.isModalOpenForOrientationCheck = true;

        modal.style.display = 'flex';
    }
}

// Close forgot password modal
function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'none';

        // CRITICAL: Re-enable orientation checks when modal closes
        window.isModalOpenForOrientationCheck = false;
    }
}

// Make functions globally available
window.showForgotPasswordForm = showForgotPasswordForm;
window.closeForgotPasswordModal = closeForgotPasswordModal;

// ================================
// RECOVERY CODE MODAL FUNCTIONS
// ================================

// Show recovery code modal after signup
function showRecoveryCodeModal(recoveryCode) {
    const modal = document.getElementById('recoveryCodeModal');
    const codeDisplay = document.getElementById('recoveryCodeDisplay');

    if (modal && codeDisplay) {
        // Display the recovery code
        codeDisplay.textContent = recoveryCode;

        // CRITICAL: Disable orientation checks while modal is open
        window.isModalOpenForOrientationCheck = true;

        modal.style.display = 'flex';
        console.log('🔑 Recovery code modal shown');
    }
}

// Close recovery code modal
function closeRecoveryCodeModal() {
    const modal = document.getElementById('recoveryCodeModal');
    if (modal) {
        modal.style.display = 'none';

        // CRITICAL: Re-enable orientation checks when modal closes
        window.isModalOpenForOrientationCheck = false;

        console.log('🔑 Recovery code modal closed');

        // Check for pending actions and show appropriate modal
        setTimeout(() => {
            if (window.handleAuthSuccess && window.handleAuthSuccess()) {
                // Auth success was handled by join competition flow
            } else if (window.CompetitionUI && window.CompetitionUI.handleAuthSuccess) {
                window.CompetitionUI.handleAuthSuccess();
            } else {
                // Show success confirmation modal
                showSuccessConfirmationModal();
            }
        }, 300);
    }
}

// Copy recovery code to clipboard
async function copyRecoveryCode() {
    const codeDisplay = document.getElementById('recoveryCodeDisplay');
    const copyBtn = document.getElementById('copyRecoveryCodeBtn');

    if (codeDisplay) {
        const code = codeDisplay.textContent;

        try {
            await navigator.clipboard.writeText(code);

            // Show feedback
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            copyBtn.style.backgroundColor = '#10b981';

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '';
            }, 2000);

            console.log('📋 Recovery code copied to clipboard');
        } catch (error) {
            console.error('Failed to copy recovery code:', error);
            alert('Failed to copy. Please write down your recovery code manually.');
        }
    }
}

// Make functions globally available
window.showRecoveryCodeModal = showRecoveryCodeModal;
window.closeRecoveryCodeModal = closeRecoveryCodeModal;
window.copyRecoveryCode = copyRecoveryCode;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Add critical styles for auth feedback to ensure visibility
    const criticalStyles = document.createElement('style');
    criticalStyles.id = 'authFeedbackCriticalStyles';
    criticalStyles.textContent = `
        #authError, #authSuccess {
            color: #333 !important;
            opacity: 1 !important;
        }
        #authError {
            color: #dc2626 !important;
        }
        #authSuccess {
            color: #16a34a !important;
        }
    `;
    document.head.appendChild(criticalStyles);
    
    updateDateTitle();
    
    // Export authentication functions globally
    window.openAuthModal = openAuthModal;
    window.switchAuthMode = switchAuthMode;
    window.closeAuthModal = closeAuthModal;
    window.handleSignup = handleSignup;
    window.handleLogin = handleLogin;
    window.showUserStats = showUserStats;
    window.closeUserStatsModal = closeUserStatsModal;
    window.showLoggedInUserModal = showLoggedInUserModal;
    window.closeLoggedInUserModal = closeLoggedInUserModal;
    window.handleProfileButtonClick = handleProfileButtonClick;
    window.toggleAccountDropdown = toggleAccountDropdown;
    window.closeAccountDropdown = closeAccountDropdown;
    window.showChangePassword = showChangePassword;
    window.closeChangePasswordModal = closeChangePasswordModal;
    window.handleChangePassword = handleChangePassword;
    
    // Initialize authentication
    try {
        await AuthManager.initialize();
    } catch (error) {
        console.error('Auth initialization error:', error);
    }
    
    
    // Update date at midnight
    setInterval(updateDateTitle, 60000); // Check every minute
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('accountDropdown');
        const authButton = document.getElementById('authButton');
        if (dropdown && !dropdown.contains(event.target) && event.target !== authButton) {
            closeAccountDropdown();
        }
    });
    
    // Close modal when clicking outside
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                // Don't close if there's an error showing - user should dismiss it first
                const errorElement = document.getElementById('authError');
                if (errorElement && errorElement.style.display === 'block') {
                    console.log('⚠️ Modal close prevented - error is showing');
                    return;
                }
                closeAuthModal();
            }
        });
    }

    // Dynamic title font sizing to prevent collision with menu button
    window.adjustTitleFontSize = function adjustTitleFontSize() {
        const dateTitle = document.getElementById('dateTitle');
        const mainHeader = document.querySelector('.main-header');
        const menuButton = document.getElementById('animatedMenuButton');
        const canvas = document.getElementById('geoCanvas');

        if (!dateTitle || !mainHeader || !menuButton) return;

        // Calculate canvas left edge position for alignment
        if (canvas) {
            const canvasRect = canvas.getBoundingClientRect();
            const headerRect = mainHeader.getBoundingClientRect();
            const canvasLeftOffset = canvasRect.left - headerRect.left;

            // Set left padding to align title with canvas left edge
            if (canvasLeftOffset > 0) {
                // Store original padding values first
                if (!mainHeader.dataset.originalPadding) {
                    const computedStyle = window.getComputedStyle(mainHeader);
                    mainHeader.dataset.originalPaddingLeft = computedStyle.paddingLeft;
                    mainHeader.dataset.originalPaddingRight = computedStyle.paddingRight;
                }

                // Apply canvas-aligned padding
                mainHeader.style.paddingLeft = canvasLeftOffset + 'px';

                // Preserve some right padding for the menu button
                const rightPadding = Math.max(16, canvasLeftOffset);
                mainHeader.style.paddingRight = rightPadding + 'px';
            }
        }

        // Get available space for font sizing
        const headerWidth = mainHeader.offsetWidth;
        const menuButtonWidth = menuButton.offsetWidth;

        // Calculate actual padding being used
        const computedStyle = window.getComputedStyle(mainHeader);
        const leftPadding = parseInt(computedStyle.paddingLeft) || 0;
        const rightPadding = parseInt(computedStyle.paddingRight) || 0;

        const availableWidth = headerWidth - menuButtonWidth - leftPadding - rightPadding - 10; // Small buffer

        // Start with larger font sizes and adjust down if necessary
        let fontSize = window.innerWidth <= 320 ? 16 :
                      window.innerWidth <= 480 ? 18 :
                      window.innerWidth <= 767 ? 20 : 22;

        dateTitle.style.fontSize = fontSize + 'px';

        // Check if text fits and reduce font size if necessary
        let iterations = 0;
        while (dateTitle.scrollWidth > availableWidth && fontSize > 10 && iterations < 20) {
            fontSize -= 0.5;
            dateTitle.style.fontSize = fontSize + 'px';
            iterations++;
        }

        // Ensure minimum readable size
        if (fontSize < 10) {
            dateTitle.style.fontSize = '10px';
        }
    }

    // Call on window resize and orientation change
    window.addEventListener('resize', window.adjustTitleFontSize);
    window.addEventListener('orientationchange', () => {
        setTimeout(window.adjustTitleFontSize, 100);
    });

    // Initial call after DOM is ready with more delay for canvas positioning
    setTimeout(window.adjustTitleFontSize, 500);

    // Also call when canvas is loaded/resized
    const observer = new MutationObserver(() => {
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            setTimeout(window.adjustTitleFontSize, 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
    });
});


