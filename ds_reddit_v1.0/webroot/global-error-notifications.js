/**
 * Simple Global Error Popup - Direct approach
 */

window.showGlobalErrorPopup = function(message) {
    // NOTE: Removed automatic competition modal closing to prevent interference
    // const competitionModals = document.querySelectorAll('.competition-container, .competition-modal, [class*="competition"]');
    // competitionModals.forEach(modal => {
    //     if (modal.style) {
    //         modal.style.display = 'none';
    //     }
    // });
    
    // Create popup and insert at the very top of the HTML document
    const popup = document.createElement('div');
    popup.id = 'global-error-popup-final';
    popup.style.cssText = `
        position: fixed !important;
        top: 0px !important;
        left: 0px !important;
        right: 0px !important;
        bottom: 0px !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0,0,0,0.8) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: system-ui !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        box-sizing: border-box !important;
    `;
    
    popup.innerHTML = `
        <div style="background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); max-width: 400px; min-width: 300px;">
            <div style="background: #dc3545; color: white; padding: 8px 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; font-weight: 600;">
                <span>Error</span>
                <button onclick="this.closest('#global-error-popup-final').remove()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 4px;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='none'">&times;</button>
            </div>
            <div style="padding: 24px; display: flex; gap: 16px; align-items: flex-start;">
                <div style="font-size: 28px;">⚠️</div>
                <div style="color: #333; font-size: 15px; line-height: 1.5;">${message}</div>
            </div>
            <div style="padding: 0 24px 24px; text-align: right;">
                <button onclick="this.closest('#global-error-popup-final').remove()" style="background: #dc3545; color: white; border: none; border-radius: 6px; padding: 12px 24px; cursor: pointer; font-weight: 600;" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">OK</button>
            </div>
        </div>
    `;
    
    // Remove any existing
    const existing = document.getElementById('global-error-popup-final');
    if (existing) existing.remove();
    
    // Try inserting into HTML element first, then body as fallback
    try {
        document.documentElement.appendChild(popup);
        console.log('Popup added to HTML root');
        console.log('Popup element:', popup);
        console.log('Popup computed style:', window.getComputedStyle(popup));
        
        // Force visibility
        setTimeout(() => {
            console.log('Forcing popup visibility');
            popup.style.display = 'flex';
            popup.style.visibility = 'visible';
            popup.style.opacity = '1';
            popup.style.zIndex = '2147483647';
        }, 100);
        
    } catch(e) {
        try {
            document.body.appendChild(popup);
            console.log('Popup added to body');
        } catch(e2) {
            // Final fallback - native alert
            alert('Error: ' + message);
        }
    }
};

window.testErrorPopup = function() {
    window.showGlobalErrorPopup('Test error message');
};

console.log('Simple error popup system loaded');