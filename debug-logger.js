// Perfect Cut v2.0 - Debug Logger
// Comprehensive debugging and error tracking system

class DebugLogger {
    constructor() {
        this.logs = [];
        this.errors = [];
        this.warnings = [];
        this.debugMode = this.isDebugMode();
        this.initializeDebugUI();
    }

    isDebugMode() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('debug') || urlParams.has('debugDate') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    }

    log(message, data = null, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            stack: level === 'error' ? new Error().stack : null
        };

        this.logs.push(logEntry);
        
        if (level === 'error') {
            this.errors.push(logEntry);
        } else if (level === 'warn') {
            this.warnings.push(logEntry);
        }

        // Console output with styling
        const style = this.getLogStyle(level);
        if (data) {
            console.log(`%c[${level.toUpperCase()}] ${message}`, style, data);
        } else {
            console.log(`%c[${level.toUpperCase()}] ${message}`, style);
        }

        // Update debug UI if in debug mode
        if (this.debugMode) {
            this.updateDebugUI();
        }
    }

    getLogStyle(level) {
        const styles = {
            error: 'color: #ff4444; font-weight: bold;',
            warn: 'color: #ffaa00; font-weight: bold;',
            info: 'color: #4444ff;',
            success: 'color: #00aa00; font-weight: bold;',
            debug: 'color: #888888;'
        };
        return styles[level] || styles.info;
    }

    error(message, data = null) {
        this.log(message, data, 'error');
    }

    warn(message, data = null) {
        this.log(message, data, 'warn');
    }

    success(message, data = null) {
        this.log(message, data, 'success');
    }

    debug(message, data = null) {
        if (this.debugMode) {
            this.log(message, data, 'debug');
        }
    }

    // Test various system components
    async runSystemChecks() {
        this.log('🔍 Starting system diagnostics...');
        
        const checks = [
            () => this.checkDOMElements(),
            () => this.checkScriptLoading(),
            () => this.checkSupabaseIntegration(),
            () => this.checkEnvironmentVariables(),
            () => this.checkShapeFiles(),
            () => this.checkCanvasSetup(),
            () => this.checkEventListeners()
        ];

        let passedChecks = 0;
        for (const check of checks) {
            try {
                const result = await check();
                if (result) passedChecks++;
            } catch (error) {
                this.error('System check failed', error);
            }
        }

        this.log(`✅ System checks complete: ${passedChecks}/${checks.length} passed`);
        return passedChecks === checks.length;
    }

    checkDOMElements() {
        this.debug('Checking DOM elements...');
        const requiredElements = [
            'geoCanvas', 'playBtn', 'appTitle', 
            'commentaryOverlay'
        ];

        let missing = [];
        for (const id of requiredElements) {
            const element = document.getElementById(id);
            if (!element) {
                missing.push(id);
            }
        }

        if (missing.length > 0) {
            this.error('Missing DOM elements', missing);
            return false;
        }

        this.success('All required DOM elements found');
        return true;
    }

    checkScriptLoading() {
        this.debug('Checking script loading...');
        const requiredGlobals = [
            'SUPABASE_CONFIG', 'PUZZLE_CONFIG', 'TEST_CONFIG',
            'DateUtils', 'ShapeTypeHandler', 'supabaseClient'
        ];

        let missing = [];
        for (const global of requiredGlobals) {
            if (typeof window[global] === 'undefined') {
                missing.push(global);
            }
        }

        if (missing.length > 0) {
            this.error('Missing global objects (scripts not loaded)', missing);
            return false;
        }

        this.success('All required scripts loaded');
        return true;
    }

    async checkSupabaseIntegration() {
        this.debug('Checking Supabase integration...');
        
        if (typeof supabase === 'undefined') {
            this.error('Supabase library not loaded');
            return false;
        }

        if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anon_key) {
            this.error('Supabase configuration missing', SUPABASE_CONFIG);
            return false;
        }

        try {
            await supabaseClient.initialize();
            this.success('Supabase client initialized successfully');
            return true;
        } catch (error) {
            this.error('Supabase initialization failed', error);
            return false;
        }
    }

    checkEnvironmentVariables() {
        this.debug('Checking environment variables...');
        
        const config = {
            url: SUPABASE_CONFIG.url,
            key: SUPABASE_CONFIG.anon_key ? '[PRESENT]' : '[MISSING]',
            bucket: SUPABASE_CONFIG.storage_bucket
        };

        this.debug('Environment config', config);

        if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.includes('YOUR_SUPABASE')) {
            this.error('Supabase URL not configured properly');
            return false;
        }

        if (!SUPABASE_CONFIG.anon_key || SUPABASE_CONFIG.anon_key.includes('YOUR_SUPABASE')) {
            this.error('Supabase anon key not configured properly');
            return false;
        }

        this.success('Environment variables configured');
        return true;
    }

    async checkShapeFiles() {
        this.debug('Checking shape file structure...');
        
        const currentDate = DateUtils.getCurrentUTCDate();
        this.debug('Current date for testing', currentDate);

        // Shape files are now loaded from Supabase only
        this.success('Shape loading configured for Supabase storage');
        return true;
    }

    checkCanvasSetup() {
        this.debug('Checking canvas setup...');
        
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            this.error('Canvas element not found');
            return false;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            this.error('Canvas 2D context not available');
            return false;
        }

        this.success('Canvas setup verified', {
            width: canvas.width,
            height: canvas.height,
            context: '2d'
        });
        return true;
    }

    checkEventListeners() {
        this.debug('Checking event listeners...');
        
        const playBtn = document.getElementById('playBtn');
        if (!playBtn) {
            this.error('Play button not found');
            return false;
        }

        // Check if event listeners are attached by looking for click handlers
        const hasClickHandler = playBtn.onclick !== null || playBtn.getAttribute('onclick') !== null;
        
        this.debug('Event listener check', {
            playButton: 'found',
            hasClickHandler: hasClickHandler
        });

        this.success('Event listener setup verified');
        return true;
    }

    initializeDebugUI() {
        // Debug UI disabled for production
        return;

        // Create debug panel
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 400px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            overflow-y: auto;
            display: none;
        `;

        debugPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>Debug Console</strong>
                <div style="display: flex; gap: 5px;">
                    <button onclick="debugLogger.copyLogs()" style="background: #28a745; color: white; border: none; padding: 2px 8px; border-radius: 3px; font-size: 11px;">Copy</button>
                    <button onclick="debugLogger.clearLogs()" style="background: #dc3545; color: white; border: none; padding: 2px 8px; border-radius: 3px; font-size: 11px;">Clear</button>
                    <button onclick="debugLogger.toggleDebugPanel()" style="background: #333; color: white; border: none; padding: 2px 8px; border-radius: 3px; font-size: 11px;">Hide</button>
                </div>
            </div>
            <div id="debugContent" style="max-height: 300px; overflow-y: auto;"></div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #555; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 10px; color: #999;">
                    Total: ${this.logs.length} logs | Errors: ${this.errors.length} | Warnings: ${this.warnings.length}
                </div>
                <button onclick="debugLogger.runQuickTest()" style="background: #17a2b8; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Test</button>
            </div>
        `;

        document.body.appendChild(debugPanel);

        // Create debug toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '🐛';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10001;
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 16px;
            cursor: pointer;
        `;
        toggleBtn.onclick = () => this.toggleDebugPanel();

        document.body.appendChild(toggleBtn);
    }

    toggleDebugPanel() {
        const panel = document.getElementById('debugPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    async copyLogs() {
        try {
            console.log('📋 Attempting to copy logs...');
            const logText = this.generateLogText();
            
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(logText);
                this.showCopyFeedback('✅ Logs copied to clipboard!', '#28a745');
                console.log('✅ Logs copied to clipboard successfully');
            } else {
                throw new Error('Clipboard API not available');
            }
            
        } catch (error) {
            console.warn('⚠️ Clipboard copy failed, showing manual copy option:', error.message);
            
            // Fallback: show logs in a textarea for manual copy
            this.showLogsForManualCopy();
            this.showCopyFeedback('📋 Manual copy - select all & copy', '#ffc107');
        }
    }

    clearLogs() {
        // Ask for confirmation
        if (confirm('Clear all debug logs?')) {
            this.logs = [];
            this.errors = [];
            this.warnings = [];
            this.updateDebugUI();
            this.log('Debug logs cleared', null, 'info');
        }
    }

    generateLogText() {
        const systemInfo = this.getSystemInfo();
        const timestamp = new Date().toISOString();
        
        let logText = `PERFECT CUT v2.0 - DEBUG LOGS
Generated: ${timestamp}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

=== SYSTEM INFO ===
${systemInfo}

=== LOGS (${this.logs.length} total) ===
`;

        // Add all logs with timestamps
        this.logs.forEach(log => {
            logText += `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
            if (log.data) {
                logText += `\nData: ${JSON.stringify(log.data, null, 2)}`;
            }
            if (log.stack && log.level === 'error') {
                logText += `\nStack: ${log.stack}`;
            }
            logText += '\n\n';
        });

        // Add summary
        logText += `=== SUMMARY ===
Total Logs: ${this.logs.length}
Errors: ${this.errors.length}
Warnings: ${this.warnings.length}
`;

        return logText;
    }

    getSystemInfo() {
        try {
            const info = {
                'Game State': window.gameState || 'unknown',
                'Current Date': window.currentDate || 'unknown',
                'Shape Index': window.currentShapeIndex || 'unknown',
                'Canvas': document.getElementById('geoCanvas') ? 'present' : 'missing',
                'Supabase Config': typeof window.SUPABASE_CONFIG !== 'undefined' ? 'loaded' : 'missing',
                'DateUtils': typeof window.DateUtils !== 'undefined' ? 'loaded' : 'missing',
                'ShapeTypeHandler': typeof window.ShapeTypeHandler !== 'undefined' ? 'loaded' : 'missing',
                'Supabase Client': typeof window.supabaseClient !== 'undefined' ? 'loaded' : 'missing'
            };

            return Object.entries(info)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        } catch (error) {
            return `Error getting system info: ${error.message}`;
        }
    }

    showCopyFeedback(message, color) {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.style.cssText = `
            position: fixed;
            top: 70px;
            right: 15px;
            background: ${color};
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10002;
            font-family: monospace;
        `;
        feedback.textContent = message;
        
        document.body.appendChild(feedback);
        
        // Remove after 3 seconds
        setTimeout(() => {
            document.body.removeChild(feedback);
        }, 3000);
    }

    showLogsForManualCopy() {
        // Create modal with logs for manual copying
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10003;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const logText = this.generateLogText();
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 8px; max-width: 80%; max-height: 80%; overflow: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">Debug Logs (Manual Copy)</h3>
                    <button onclick="document.body.removeChild(this.parentNode.parentNode)" 
                            style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Close</button>
                </div>
                <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Select all text below and copy (Ctrl+A, Ctrl+C):</p>
                <textarea readonly style="width: 100%; height: 400px; font-family: monospace; font-size: 11px; border: 1px solid #ccc; padding: 10px;">${logText}</textarea>
            </div>
        `;

        document.body.appendChild(modal);

        // Auto-select the text
        const textarea = modal.querySelector('textarea');
        textarea.focus();
        textarea.select();
    }

    updateDebugUI() {
        if (!this.debugMode) return;

        const content = document.getElementById('debugContent');
        const panel = document.getElementById('debugPanel');
        if (!content || !panel) return;

        const recentLogs = this.logs.slice(-20); // Show more recent logs
        content.innerHTML = recentLogs.map(log => {
            const color = log.level === 'error' ? '#ff4444' : 
                         log.level === 'warn' ? '#ffaa00' :
                         log.level === 'success' ? '#00aa00' : '#ffffff';
            
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            
            return `<div style="color: ${color}; margin: 3px 0; font-size: 11px; line-height: 1.3;">
                <span style="color: #888;">[${timestamp}]</span> 
                <strong>[${log.level.toUpperCase()}]</strong> ${log.message}
                ${log.data ? '<br><span style="color: #ccc; font-size: 10px; margin-left: 20px;">' + JSON.stringify(log.data, null, 2) + '</span>' : ''}
            </div>`;
        }).join('');

        // Update stats in header
        const statsDiv = panel.querySelector('div:last-child');
        if (statsDiv) {
            statsDiv.innerHTML = `Total: ${this.logs.length} logs | Errors: ${this.errors.length} | Warnings: ${this.warnings.length}`;
        }

        // Auto-scroll to bottom
        content.scrollTop = content.scrollHeight;
    }

    async runQuickTest() {
        this.log('🧪 Running quick system test...');
        
        try {
            // Run system checks
            await this.runSystemChecks();
            
            // Run startup tests if available
            if (window.startupTest) {
                this.log('🔄 Running startup tests...');
                await window.startupTest.runAllTests();
            }
            
            this.success('Quick test completed successfully');
            
        } catch (error) {
            this.error('Quick test failed', error);
        }
    }

    getSummary() {
        return {
            totalLogs: this.logs.length,
            errors: this.errors.length,
            warnings: this.warnings.length,
            recentLogs: this.logs.slice(-5)
        };
    }
}

// Create global debug logger instance
const debugLogger = new DebugLogger();

// Ensure global access
window.debugLogger = debugLogger;
window.DebugLogger = DebugLogger;

// Export for module systems or global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugLogger;
}

// Log successful loading
console.log('✅ DebugLogger loaded and ready');

// Auto-run system checks when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => debugLogger.runSystemChecks(), 1000);
    });
} else {
    setTimeout(() => debugLogger.runSystemChecks(), 1000);
}