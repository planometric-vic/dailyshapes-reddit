/**
 * DevvitBridge - Communication layer between WebView game and Devvit backend.
 * Uses postMessage to send/receive data from the Devvit worker (Redis, Reddit API).
 */

const DevvitBridge = {
    /** Pending callbacks keyed by message type */
    _callbacks: {},

    /** Whether init data has been received */
    initialized: false,

    /** Cached init data from Devvit */
    initData: null,

    /** Initialize the bridge and request init data from Devvit */
    init() {
        // Listen for messages from Devvit
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg || !msg.type) return;

            // Special handling for Devvit system messages
            if (msg.type === 'devvit-message' && msg.data?.message) {
                this._handleMessage(msg.data.message);
                return;
            }

            this._handleMessage(msg);
        });

        // Request initialization data
        this.postMessage({ type: 'INIT_REQUEST' });
    },

    /** Handle incoming message from Devvit backend */
    _handleMessage(msg) {
        console.log('[DevvitBridge] Received:', msg.type);

        switch (msg.type) {
            case 'INIT_RESPONSE':
                this.initData = msg.data;
                this.initialized = true;
                if (this._callbacks['INIT_RESPONSE']) {
                    this._callbacks['INIT_RESPONSE'](msg.data);
                    delete this._callbacks['INIT_RESPONSE'];
                }
                // Fire custom event for the game to pick up
                window.dispatchEvent(new CustomEvent('devvit-init', { detail: msg.data }));
                break;

            case 'SCORE_SAVED':
                if (this._callbacks['SCORE_SAVED']) {
                    this._callbacks['SCORE_SAVED'](msg.data);
                    delete this._callbacks['SCORE_SAVED'];
                }
                window.dispatchEvent(new CustomEvent('devvit-score-saved', { detail: msg.data }));
                break;

            case 'LEADERBOARD_RESPONSE':
                if (this._callbacks['LEADERBOARD_RESPONSE']) {
                    this._callbacks['LEADERBOARD_RESPONSE'](msg.data);
                    delete this._callbacks['LEADERBOARD_RESPONSE'];
                }
                window.dispatchEvent(new CustomEvent('devvit-leaderboard', { detail: msg.data }));
                break;

            case 'PRACTICE_SHAPE_RESPONSE':
                if (this._callbacks['PRACTICE_SHAPE_RESPONSE']) {
                    this._callbacks['PRACTICE_SHAPE_RESPONSE'](msg.data);
                    delete this._callbacks['PRACTICE_SHAPE_RESPONSE'];
                }
                break;

            case 'PROGRESS_RESPONSE':
                if (this._callbacks['PROGRESS_RESPONSE']) {
                    this._callbacks['PROGRESS_RESPONSE'](msg.data);
                    delete this._callbacks['PROGRESS_RESPONSE'];
                }
                break;

            default:
                console.log('[DevvitBridge] Unknown message type:', msg.type);
        }
    },

    /** Send a message to the Devvit backend */
    postMessage(msg) {
        window.parent.postMessage(msg, '*');
    },

    /** Wait for init data (returns a promise) */
    waitForInit() {
        if (this.initialized && this.initData) {
            return Promise.resolve(this.initData);
        }
        return new Promise((resolve) => {
            this._callbacks['INIT_RESPONSE'] = resolve;
        });
    },

    /** Submit a completed daily score */
    submitScore(dayKey, scores, total) {
        return new Promise((resolve) => {
            this._callbacks['SCORE_SAVED'] = resolve;
            this.postMessage({
                type: 'SUBMIT_SCORE',
                data: { dayKey, scores, total }
            });
        });
    },

    /** Get the leaderboard for a day */
    getLeaderboard(dayKey) {
        return new Promise((resolve) => {
            this._callbacks['LEADERBOARD_RESPONSE'] = resolve;
            this.postMessage({
                type: 'GET_LEADERBOARD',
                data: { dayKey }
            });
        });
    },

    /** Save in-progress game state */
    saveProgress(dayKey, progress) {
        this.postMessage({
            type: 'SAVE_PROGRESS',
            data: { dayKey, progress: JSON.stringify(progress) }
        });
    },

    /** Get saved progress */
    getProgress(dayKey) {
        return new Promise((resolve) => {
            this._callbacks['PROGRESS_RESPONSE'] = resolve;
            this.postMessage({
                type: 'GET_PROGRESS',
                data: { dayKey }
            });
        });
    },

    /** Request a practice shape */
    getPracticeShape(dayKey, shapeIndex) {
        return new Promise((resolve) => {
            this._callbacks['PRACTICE_SHAPE_RESPONSE'] = resolve;
            this.postMessage({
                type: 'GET_PRACTICE_SHAPE',
                data: { dayKey, shapeIndex }
            });
        });
    }
};

window.DevvitBridge = DevvitBridge;
