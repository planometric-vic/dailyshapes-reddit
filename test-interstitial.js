// Test Interstitial Ad Function
// Add this to console to test interstitial ad appearance

window.testInterstitialAd = function(duration = 5000) {
    console.log('🎯 Testing interstitial ad for', duration + 'ms');

    // Create interstitial overlay
    const adOverlay = document.createElement('div');
    adOverlay.id = 'testInterstitialAd';
    adOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        font-family: Arial, sans-serif;
        animation: fadeIn 0.5s ease-in;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        .fade-out {
            animation: fadeOut 0.5s ease-out forwards;
        }
    `;
    document.head.appendChild(style);

    // Create ad content
    adOverlay.innerHTML = `
        <div style="text-align: center; max-width: 400px; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🎮</div>
            <h2 style="margin: 0 0 10px 0; font-size: 24px;">Test Mobile Game</h2>
            <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">
                Experience the ultimate puzzle adventure! Download now and get 100 free coins!
            </p>
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <div style="font-size: 14px; opacity: 0.8;">★★★★★ 4.8/5 Stars</div>
                <div style="font-size: 12px; opacity: 0.6;">Over 1M downloads</div>
            </div>
            <button id="testAdInstall" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 18px;
                border-radius: 25px;
                cursor: pointer;
                margin-bottom: 15px;
                box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                transition: all 0.3s ease;
            ">INSTALL FREE</button>
            <div style="font-size: 12px; opacity: 0.6;">
                Ad will close in <span id="adTimer">${Math.ceil(duration/1000)}</span> seconds
            </div>
            <div id="adCloseBtn" style="
                position: absolute;
                top: 20px;
                right: 20px;
                width: 30px;
                height: 30px;
                background: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: none;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 18px;
                font-weight: bold;
            ">×</div>
        </div>
    `;

    // Add to page
    document.body.appendChild(adOverlay);

    // Timer countdown
    const timerElement = adOverlay.querySelector('#adTimer');
    const closeBtn = adOverlay.querySelector('#adCloseBtn');
    let timeLeft = Math.ceil(duration/1000);

    const countdown = setInterval(() => {
        timeLeft--;
        if (timerElement) {
            timerElement.textContent = timeLeft;
        }

        // Show close button after 3 seconds
        if (timeLeft <= Math.ceil(duration/1000) - 3 && closeBtn) {
            closeBtn.style.display = 'flex';
        }

        if (timeLeft <= 0) {
            clearInterval(countdown);
            closeAd();
        }
    }, 1000);

    // Close ad function
    function closeAd() {
        console.log('🎯 Interstitial ad closed');
        adOverlay.classList.add('fade-out');
        setTimeout(() => {
            if (adOverlay.parentNode) {
                adOverlay.parentNode.removeChild(adOverlay);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 500);
        clearInterval(countdown);
    }

    // Add click handlers
    adOverlay.querySelector('#testAdInstall').addEventListener('click', () => {
        console.log('🎯 Test ad: Install button clicked');
        alert('Test Ad: Install button clicked!');
    });

    closeBtn.addEventListener('click', closeAd);

    return {
        close: closeAd,
        element: adOverlay
    };
};

console.log('🎯 Interstitial ad test function loaded!');
console.log('📋 Usage: testInterstitialAd(5000) // Shows ad for 5 seconds');
console.log('📋 Usage: testInterstitialAd() // Shows ad for default 5 seconds');