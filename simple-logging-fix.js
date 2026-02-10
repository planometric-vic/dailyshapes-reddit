// Simple Logging Fix - Prevents console flooding without recursion issues
// This is a minimal, safe approach to control console output

(function() {
    'use strict';
    
    // Simple throttling mechanism
    let logCount = 0;
    let lastResetTime = Date.now();
    const MAX_LOGS_PER_SECOND = 15;
    const RESET_INTERVAL = 1000; // 1 second
    
    // Store original console methods
    const originalConsole = {
        log: console.log.bind(console),
        warn: console.warn.bind(console), 
        error: console.error.bind(console)
    };
    
    function shouldThrottle() {
        const now = Date.now();
        
        // Reset counter every second
        if (now - lastResetTime > RESET_INTERVAL) {
            logCount = 0;
            lastResetTime = now;
        }
        
        logCount++;
        
        // Throttle if exceeding limit
        return logCount > MAX_LOGS_PER_SECOND;
    }
    
    function isDebugMode() {
        const params = new URLSearchParams(window.location.search);
        return params.has('debug') || 
               params.has('verbose') || 
               window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1';
    }
    
    const debugMode = isDebugMode();
    
    // Simple console.log replacement
    console.log = function(...args) {
        // Always allow critical system messages
        const firstArg = args[0];
        if (typeof firstArg === 'string') {
            // Allow error and warning messages through
            if (firstArg.includes('❌') || firstArg.includes('⚠️') || firstArg.includes('🔥')) {
                originalConsole.log.apply(console, args);
                return;
            }
            
            // Allow success messages in debug mode
            if (debugMode && (firstArg.includes('✅') || firstArg.includes('🎮') || firstArg.includes('🎯'))) {
                originalConsole.log.apply(console, args);
                return;
            }
        }
        
        // Throttle everything else
        if (!shouldThrottle()) {
            // Only show in debug mode or for important messages
            if (debugMode) {
                originalConsole.log.apply(console, args);
            }
        } else if (logCount % 20 === 0) {
            // Show every 20th message when throttling
            originalConsole.log('[THROTTLED - showing 1 of 20]', ...args);
        }
    };
    
    // Keep warnings and errors as-is
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Provide method to restore original console
    window.restoreOriginalConsole = function() {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        originalConsole.log('🔧 Original console methods restored');
    };
    
    // Provide statistics
    window.getLogStats = function() {
        return {
            totalInterceptedLogs: logCount,
            maxLogsPerSecond: MAX_LOGS_PER_SECOND,
            debugMode: debugMode,
            isThrottling: logCount > MAX_LOGS_PER_SECOND
        };
    };
    
    // Export logs function
    window.exportLogs = function() {
        const timestamp = new Date().toISOString();
        const logContent = `=== Daily Shapes v4.0 Debug Info ===
Generated: ${timestamp}
URL: ${window.location.href}
Debug Mode: ${debugMode}
Log Statistics: ${JSON.stringify(window.getLogStats(), null, 2)}

To enable full logging, add ?debug=true to the URL
To restore original console: restoreOriginalConsole()
`;
        
        // Try to copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(logContent).then(() => {
                originalConsole.log('✅ Debug info copied to clipboard');
            }).catch(() => {
                downloadLogFile(logContent);
            });
        } else {
            downloadLogFile(logContent);
        }
    };
    
    function downloadLogFile(content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily-shapes-debug-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        originalConsole.log('📥 Debug info downloaded as file');
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+Shift+L to export logs
        if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            e.preventDefault();
            window.exportLogs();
        }
        
        // Ctrl+Shift+R to restore console
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            window.restoreOriginalConsole();
        }
    });
    
    originalConsole.log('🔧 Simple logging fix applied');
    if (debugMode) {
        originalConsole.log('🐛 Debug mode active - full logging enabled');
    } else {
        originalConsole.log('📝 Production mode - logging throttled (add ?debug=true for full logs)');
    }
    originalConsole.log('💡 Shortcuts: Ctrl+Shift+L (export), Ctrl+Shift+R (restore console)');
    
})();