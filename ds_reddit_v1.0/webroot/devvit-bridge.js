/**
 * Devvit Communication Bridge
 * Handles postMessage communication between the WebView and the Devvit backend.
 * The game code calls this via the shims (SupabaseConfig, AuthService, etc.)
 */

const DevvitBridge = {
    _callbacks: {},
    _callbackId: 0,
    initialized: false,
    initData: null,

    init() {
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg || !msg.type) return;

            // Devvit wraps messages in { type: 'devvit-message', data: { message: {...} } }
            if (msg.type === 'devvit-message' && msg.data?.message) {
                this._handleMessage(msg.data.message);
                return;
            }
            this._handleMessage(msg);
        });

        // Request init data from Devvit backend
        this.postMessage({ type: 'INIT_REQUEST' });
    },

    _handleMessage(msg) {
        console.log('[DevvitBridge] Received:', msg.type);

        switch (msg.type) {
            case 'INIT_RESPONSE':
                this.initData = msg.data;
                this.initialized = true;
                window.dispatchEvent(new CustomEvent('devvit-init', { detail: msg.data }));
                break;

            case 'SCORE_SAVED':
                window.dispatchEvent(new CustomEvent('devvit-score-saved', { detail: msg.data }));
                break;

            case 'LEADERBOARD_RESPONSE':
                window.dispatchEvent(new CustomEvent('devvit-leaderboard', { detail: msg.data }));
                break;

            case 'PROGRESS_RESPONSE':
                window.dispatchEvent(new CustomEvent('devvit-progress', { detail: msg.data }));
                break;

            case 'SHAPES_RESPONSE':
                window.dispatchEvent(new CustomEvent('devvit-shapes', { detail: msg.data }));
                break;
        }

        // Resolve any pending callbacks
        if (this._callbacks[msg.type]) {
            const cbs = this._callbacks[msg.type];
            this._callbacks[msg.type] = [];
            cbs.forEach(cb => cb(msg.data));
        }
    },

    postMessage(msg) {
        window.parent.postMessage(msg, '*');
    },

    /** Returns a promise that resolves when the specified message type is received */
    waitFor(messageType) {
        return new Promise((resolve) => {
            if (!this._callbacks[messageType]) this._callbacks[messageType] = [];
            this._callbacks[messageType].push(resolve);
        });
    },

    /** Wait for init data */
    waitForInit() {
        if (this.initialized && this.initData) return Promise.resolve(this.initData);
        return new Promise((resolve) => {
            window.addEventListener('devvit-init', (e) => resolve(e.detail), { once: true });
        });
    },

    submitScore(dayKey, scores, total) {
        this.postMessage({ type: 'SUBMIT_SCORE', data: { dayKey, scores, total } });
        return this.waitFor('SCORE_SAVED');
    },

    getLeaderboard(dayKey) {
        this.postMessage({ type: 'GET_LEADERBOARD', data: { dayKey } });
        return this.waitFor('LEADERBOARD_RESPONSE');
    },

    saveProgress(dayKey, progress) {
        this.postMessage({ type: 'SAVE_PROGRESS', data: { dayKey, progress: JSON.stringify(progress) } });
    },

    getProgress(dayKey) {
        this.postMessage({ type: 'GET_PROGRESS', data: { dayKey } });
        return this.waitFor('PROGRESS_RESPONSE');
    }
};

window.DevvitBridge = DevvitBridge;
