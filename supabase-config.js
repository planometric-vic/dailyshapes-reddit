// Supabase Configuration for Daily Shapes v4.0
// This file initializes the Supabase client and provides configuration

// Supabase configuration - Production ready
const SUPABASE_URL = 'https://zxrfhumifazjxgikltkz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cmZodW1pZmF6anhnaWtsdGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MjMyMTAsImV4cCI6MjA2ODQ5OTIxMH0.GJGVi_So1OAklXM6oantOGd3ok1OVhgURmc7KhEwcwQ';

// Initialize Supabase client
let supabaseClient = null;

// Check if Supabase library is loaded and credentials are provided
if (typeof window !== 'undefined' && window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storage: window.localStorage
        }
    });
    console.log('✅ Supabase client initialized');

    // Make client globally accessible
    window.supabaseClient = supabaseClient;
} else {
    console.log('ℹ️ Supabase disabled - running in local mode');
}

// Export configuration
const SupabaseConfig = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    client: supabaseClient,
    
    // Check if Supabase is ready
    isReady: function() {
        return supabaseClient !== null;
    },
    
    // Initialize Supabase (call this when the page loads)
    initialize: async function() {
        if (!supabaseClient) {
            console.log('ℹ️ Supabase not configured - running in local mode');
            return false;
        }
        
        try {
            // Check if we have an existing session
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error) {
                console.error('Error getting session:', error);
                return false;
            }
            
            if (session) {
                console.log('Existing session found for user:', session.user.email);
                return session;
            }
            
            return null;
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            return false;
        }
    },
    
    // Check if client is ready
    isReady: function() {
        return supabaseClient !== null;
    }
};

// Hunter.io Email Validation Configuration
const HunterConfig = {
    apiKey: '60d11d9e66725ebecdf9446824a1f0b32e297871', // Hunter.io API key

    // Free plan limits (100 verifications/month)
    monthlyLimit: 100,
    usageKey: 'hunter_usage_' + new Date().getFullYear() + '_' + (new Date().getMonth() + 1),

    // Get current month's usage
    getCurrentUsage: function() {
        return parseInt(localStorage.getItem(this.usageKey) || '0');
    },

    // Increment usage counter
    incrementUsage: function() {
        const current = this.getCurrentUsage();
        localStorage.setItem(this.usageKey, (current + 1).toString());
        return current + 1;
    },

    // Check if we can make Hunter.io API call
    canMakeAPICall: function() {
        return this.getCurrentUsage() < this.monthlyLimit && this.apiKey !== 'your-hunter-api-key-here';
    },

    // Validate email using Hunter.io
    validateEmail: async function(email) {
        // Basic email format validation first
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                valid: false,
                reason: 'Invalid email format',
                source: 'client'
            };
        }

        const domain = email.split('@')[1].toLowerCase();

        // Trusted domains (skip API for these)
        const trustedDomains = [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
            'aol.com', 'live.com', 'msn.com', 'ymail.com', 'protonmail.com'
        ];

        if (trustedDomains.includes(domain)) {
            return {
                valid: true,
                deliverable: true,
                reason: 'Email appears valid',
                source: 'client'
            };
        }

        // Use Hunter.io API for other domains if within limits
        if (this.canMakeAPICall()) {
            try {
                return await this.callHunterAPI(email);
            } catch (error) {
                console.warn('Hunter.io API error, falling back to basic validation:', error);
                return {
                    valid: true,
                    deliverable: null,
                    reason: 'Email format appears valid (verification unavailable)',
                    source: 'client'
                };
            }
        } else {
            // Fallback to basic validation when API limit reached
            return {
                valid: true,
                deliverable: null,
                reason: 'Email format appears valid (Hunter.io limit reached)',
                source: 'client'
            };
        }
    },

    // Call Hunter.io API
    callHunterAPI: async function(email) {
        const response = await fetch(
            `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${this.apiKey}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Hunter.io API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Increment usage counter
        this.incrementUsage();

        if (data.data) {
            const result = data.data;

            return {
                valid: result.result === 'deliverable' || result.result === 'risky',
                deliverable: result.result === 'deliverable',
                reason: this.getReasonFromHunterResult(result),
                hunterResult: result.result,
                score: result.score,
                source: 'hunter',
                usage: this.getCurrentUsage()
            };
        } else {
            throw new Error('Invalid Hunter.io response');
        }
    },

    // Convert Hunter.io result to user-friendly message
    getReasonFromHunterResult: function(result) {
        switch (result.result) {
            case 'deliverable':
                return 'Email verified and deliverable';
            case 'undeliverable':
                return 'Email address does not exist';
            case 'risky':
                return 'Email may not be deliverable (risky)';
            case 'unknown':
                return 'Unable to verify email deliverability';
            default:
                return 'Email verification completed';
        }
    }
};

// Social Login Configuration
const SocialAuthConfig = {
    providers: {
        google: {
            enabled: true,
            clientId: 'your-google-client-id.apps.googleusercontent.com',
            scope: 'email profile'
        },
        facebook: {
            enabled: true,
            appId: 'your-facebook-app-id',
            version: 'v12.0',
            scope: 'email,public_profile'
        },
        apple: {
            enabled: true,
            clientId: 'your-apple-client-id',
            scope: 'email name'
        }
    },
    
    // Handle social login
    handleSocialLogin: async function(provider) {
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            return { error: 'Authentication service not available' };
        }
        
        try {
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: window.location.origin,
                    scopes: this.providers[provider]?.scope
                }
            });
            
            if (error) {
                console.error(`${provider} login error:`, error);
                return { error: error.message };
            }
            
            return { data };
        } catch (error) {
            console.error(`${provider} login error:`, error);
            return { error: error.message };
        }
    }
};

// Export all configurations
if (typeof window !== 'undefined') {
    window.SupabaseConfig = SupabaseConfig;
    window.HunterConfig = HunterConfig;
    window.SocialAuthConfig = SocialAuthConfig;
}