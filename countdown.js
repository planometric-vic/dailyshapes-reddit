// Countdown Timer for Daily Shapes v4.0
// Handles countdown to next local midnight

function startDailyCountdown({ onTick, onZero }) {
    const target = nextLocalMidnightMillis();
    
    function tick() {
        const remaining = Math.max(0, target - Date.now());
        const hours = String(Math.floor(remaining / 3600000)).padStart(2, '0');
        const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
        const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
        
        const timeString = `${hours}:${minutes}:${seconds}`;
        onTick(timeString, remaining);
        
        if (remaining <= 0) {
            clearInterval(intervalId);
            onZero?.();
        }
    }
    
    // Start immediately
    tick();
    const intervalId = setInterval(tick, 1000);
    
    // Return cleanup function
    return () => clearInterval(intervalId);
}

function nextLocalMidnightMillis() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
}

// Export for use
window.startDailyCountdown = startDailyCountdown;