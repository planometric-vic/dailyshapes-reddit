/**
 * Supabase Shim for Devvit
 * Provides the same global APIs that main.js and other game files expect
 * (SupabaseConfig, supabaseClient, AuthService, etc.) but routes everything
 * through the DevvitBridge to Redis.
 *
 * This file MUST be loaded BEFORE main.js and other game files.
 */

// ============================================================
// SupabaseConfig shim
// ============================================================

window.SupabaseConfig = {
    client: null,
    _ready: false,

    isReady() {
        return DevvitBridge.initialized;
    },

    async waitForReady() {
        return DevvitBridge.waitForInit();
    }
};

// Fake supabaseClient that doesn't crash when called
window.supabaseClient = {
    auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: () => Promise.resolve({ data: null, error: { message: 'Auth not available on Reddit' } }),
        signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Auth not available on Reddit' } }),
        signOut: () => Promise.resolve({ error: null }),
    },
    from: (table) => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }), limit: () => Promise.resolve({ data: [], error: null }), order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }), single: () => Promise.resolve({ data: null, error: null }), order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }), order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
        insert: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
    storage: {
        from: (bucket) => ({
            getPublicUrl: (path) => ({ data: { publicUrl: '' } }),
            download: (path) => Promise.resolve({ data: null, error: { message: 'Storage not available on Reddit' } }),
        })
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
};

window.SupabaseConfig.client = window.supabaseClient;

// ============================================================
// AuthService shim
// ============================================================

window.AuthService = {
    currentUser: null,
    _loggedIn: false,
    _username: 'anonymous',
    initialized: false,
    isGuest: true,

    async initialize() {
        // Will be populated when Devvit init data arrives
        this.initialized = true;
        return true;
    },

    // main.js calls isLoggedIn() as a function
    isLoggedIn() {
        return this._loggedIn;
    },

    getUser() {
        return this.currentUser;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    isAuthenticated() {
        return this._loggedIn;
    },

    // Submit scores via DevvitBridge to Reddit Redis
    async saveDailyScore(dateString, shapeScores, mechanicName) {
        if (!window.DevvitBridge || !window.DevvitBridge.initData) {
            console.warn('[Devvit Shim] Cannot submit score - bridge not ready');
            return { success: false };
        }
        const dayKey = window.DevvitBridge.initData.dayKey;
        let total = 0;
        for (let i = 1; i <= 3; i++) {
            const shape = shapeScores && shapeScores['shape' + i];
            if (shape) {
                total += (shape.attempt1 || 0) + (shape.attempt2 || 0);
            }
        }
        total = Math.round(total);
        console.log('[Devvit Shim] Submitting score:', { dayKey, total, shapeScores });
        try {
            await window.DevvitBridge.submitScore(dayKey, shapeScores, total);
            return { success: true };
        } catch (e) {
            console.error('[Devvit Shim] Score submission failed:', e);
            return { success: false };
        }
    },

    // Called by game to track events - no-op on Reddit
    trackPerfectCut() {},
    trackGameCompleted() {},
    trackEvent() {},

    // Populate from Devvit init data
    _setFromDevvit(initData) {
        this._username = initData.username || 'anonymous';
        this._loggedIn = true;
        this.initialized = true;
        this.isGuest = false;
        this.currentUser = {
            id: initData.username, // Reddit username as ID
            username: initData.username,
            email: null,
        };
    }
};

// ============================================================
// ShapeStorage shim - loads shapes from Devvit init data
// ============================================================

window.ShapeStorage = {
    _shapes: {}, // dayKey -> [shape0, shape1, shape2]

    setShapes(dayKey, shapes) {
        this._shapes[dayKey] = shapes;
    },

    async loadShape(filename) {
        // Shapes come from initData, not from file loading
        console.log('[ShapeStorage shim] loadShape called for:', filename);
        return null;
    },

    async preloadDailyShapes(date) {
        // Already loaded via initData
        return true;
    },

    getShapeForDay(dayKey, index) {
        const shapes = this._shapes[dayKey];
        if (shapes && shapes[index]) {
            return JSON.parse(shapes[index]);
        }
        return null;
    }
};

// ============================================================
// DailyModeManager shim
// ============================================================

window.DailyModeManager = class {
    constructor() {
        this.shapes = [];
        this.mechanic = 'DefaultWithUndoMechanic';
        this.dayKey = '';
        this.isReady = false;
    }

    async initialize() {
        const initData = await DevvitBridge.waitForInit();
        this.shapes = (initData.shapes || []).map(s => typeof s === 'string' ? JSON.parse(s) : s);
        this.mechanic = initData.mechanic;
        this.dayKey = initData.dayKey;
        this.isReady = true;
        return true;
    }

    getShape(index) {
        return this.shapes[index] || null;
    }
};

// ============================================================
// Globals that various game files check for
// ============================================================

// Fake GA4
window.gtag = function() {};

// Hunter.io email validation - not needed
window.HunterEmailValidator = {
    validate: () => Promise.resolve({ result: 'valid' })
};

// Social auth config - not needed
window.SocialAuthConfig = {
    google: { clientId: '' },
    facebook: { appId: '' },
    apple: { clientId: '' }
};

// ============================================================
// Hook into Devvit init to populate shims
// ============================================================

window.addEventListener('devvit-init', (event) => {
    const initData = event.detail;
    console.log('[Devvit Shim] Init data received:', initData.username, 'day:', initData.dayKey);

    // Populate auth
    window.AuthService._setFromDevvit(initData);

    // Store shapes
    if (initData.shapes && initData.shapes.length > 0) {
        window.ShapeStorage.setShapes(initData.dayKey, initData.shapes);
    }

    // Mark config as ready
    window.SupabaseConfig._ready = true;

    // Set global game mode flags
    window.isDemoMode = true; // Use demo mode flow (no Supabase dependency)
    window.isDailyMode = false;
    window.isPracticeMode = false;

    // Set day info
    window.devvitDayKey = initData.dayKey;
    window.devvitDayNumber = initData.dayNumber;
    window.devvitDayOfWeek = initData.dayOfWeek;
    window.devvitMechanic = initData.mechanic;
    window.devvitShapes = initData.shapes || [];
    window.devvitUsername = initData.username;
});

console.log('[Devvit Shim] Supabase/Auth/Shape shims loaded');
