(function() {
    const canvas = document.getElementById('geoCanvas');
    const canvasSize = 380; // Internal resolution - do NOT change (pixel calculations depend on it)

    // Calculate display size based on layout mode:
    // Desktop (wide viewport): side-by-side layout, canvas can use full height
    // Mobile (narrow viewport): stacked layout, reserve space for UI below canvas
    var viewportWidth = window.innerWidth || 380;
    var viewportHeight = window.innerHeight || 512;
    var isSideBySide = viewportWidth >= 600;
    var displaySize;
    if (isSideBySide) {
        // Side-by-side: UI is beside the canvas, only reserve for instruction area above
        displaySize = Math.min(canvasSize, Math.max(260, viewportHeight - 30));
    } else {
        // Stacked: reserve ~180px for UI below canvas
        displaySize = Math.min(canvasSize, Math.max(260, viewportHeight - 180));
    }

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';

    console.log('[Devvit] Canvas initialized to ' + canvasSize + 'x' + canvasSize + ' (display: ' + displaySize + 'x' + displaySize + ', layout: ' + (isSideBySide ? 'side-by-side' : 'stacked') + ')');

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Force canvas container sizing
    const container = canvas.parentElement;
    if (container && container.classList.contains('canvas-container')) {
        const resizeContainer = () => {
            if (window.completionViewActive) return;
            var vw = window.innerWidth || 380;
            var vh = window.innerHeight || 512;
            var sbs = vw >= 600;
            var ds = sbs
                ? Math.min(canvasSize, Math.max(260, vh - 30))
                : Math.min(canvasSize, Math.max(260, vh - 180));
            container.classList.remove('canvas-container');
            container.classList.add('canvas-container-fixed');
            var marginStyle = sbs
                ? 'margin-left: 0 !important; margin-right: 0 !important;'
                : 'margin-left: auto !important; margin-right: auto !important;';
            container.style.cssText =
                'position: relative;' +
                'width: ' + ds + 'px !important;' +
                'height: ' + ds + 'px !important;' +
                'min-width: ' + ds + 'px !important;' +
                'max-width: ' + ds + 'px !important;' +
                'display: flex;' +
                'justify-content: center;' +
                'align-items: center;' +
                marginStyle +
                'overflow: visible !important;';
            canvas.style.width = ds + 'px';
            canvas.style.height = ds + 'px';
        };
        resizeContainer();
        window.addEventListener('resize', resizeContainer);
    }

    // Loading animation
    var loadingAnimationActive = true;
    var loadingAnimationFrame = null;
    var rotationAngle = 0;
    var scalePhase = 0;
    var loadingStartTime = Date.now();
    var fadeOutOpacity = 1;
    var isFadingOut = false;

    var loadingMessages = [
        "Give us this day our Daily Shapes!",
        "Things are taking Shape!",
        "Shape up or ship out!",
        "What do we want? SHAPES!",
        "Let there be Shapes!"
    ];
    var loadingMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

    var shapes = ['hexagon', 'circle', 'square', 'triangle'];
    var shapeToRender = shapes[Math.floor(Math.random() * shapes.length)];

    function drawShape(ctx, shape, size) {
        ctx.beginPath();
        switch(shape) {
            case 'square':
                var half = size / 2;
                ctx.moveTo(-half, -half);
                ctx.lineTo(half, -half);
                ctx.lineTo(half, half);
                ctx.lineTo(-half, half);
                ctx.closePath();
                break;
            case 'triangle':
                var height = size * Math.sqrt(3);
                var sideLength = size * 2;
                ctx.moveTo(0, -height * 0.5);
                ctx.lineTo(sideLength * 0.5, height * 0.5);
                ctx.lineTo(-sideLength * 0.5, height * 0.5);
                ctx.closePath();
                break;
            case 'circle':
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                break;
            case 'hexagon':
                var angleStep = (Math.PI * 2) / 6;
                for (var i = 0; i <= 6; i++) {
                    var angle = i * angleStep - Math.PI / 2;
                    var x = size * Math.cos(angle);
                    var y = size * Math.sin(angle);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                break;
        }
        ctx.stroke();
    }

    function animateLoading() {
        if (!loadingAnimationActive && !isFadingOut) return;

        var logicalSize = 380;
        ctx.clearRect(0, 0, logicalSize, logicalSize);

        var centerX = logicalSize / 2;
        var centerY = logicalSize / 2 - 20;
        var scale = 0.8 + Math.sin(scalePhase) * 0.2;
        var baseSize = logicalSize * 0.08;
        var size = baseSize * scale;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle);
        ctx.globalAlpha = fadeOutOpacity;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'miter';

        drawShape(ctx, shapeToRender, size);

        ctx.restore();

        rotationAngle += 0.03;
        scalePhase += 0.05;

        if (isFadingOut) {
            fadeOutOpacity -= 0.04;
            var overlay = document.getElementById('loading-text-overlay');
            if (overlay) overlay.style.opacity = fadeOutOpacity;

            if (fadeOutOpacity <= 0) {
                loadingAnimationActive = false;
                isFadingOut = false;
                if (overlay) overlay.remove();
                ctx.clearRect(0, 0, logicalSize, logicalSize);

                var welcomeOverlay = document.getElementById('welcomeOverlay');
                var isWelcomeVisible = welcomeOverlay && welcomeOverlay.style.visibility === 'visible';
                var hasActiveGame = window.isRestoringGameState ||
                    (window.gameState && window.gameState !== 'initial') ||
                    (window.currentShapeNumber && window.currentShapeNumber > 0);

                if (!isWelcomeVisible && !hasActiveGame) {
                    canvas.style.display = 'none';
                } else if (hasActiveGame) {
                    canvas.style.display = 'block';
                }

                if (window._loadingAnimationCallback) {
                    var callback = window._loadingAnimationCallback;
                    window._loadingAnimationCallback = null;
                    callback();
                }
                return;
            }
        }
        loadingAnimationFrame = requestAnimationFrame(animateLoading);
    }

    // Create loading text overlay
    var loadingTextOverlay = document.createElement('div');
    loadingTextOverlay.id = 'loading-text-overlay';
    loadingTextOverlay.style.cssText =
        'position: absolute !important;' +
        'top: 50% !important;' +
        'left: 50% !important;' +
        'transform: translate(-50%, -50%) !important;' +
        'margin-top: 50px !important;' +
        'font-family: Georgia, "Times New Roman", Times, serif !important;' +
        'font-size: 20px !important;' +
        'color: #000 !important;' +
        'text-align: center !important;' +
        'pointer-events: none !important;' +
        'z-index: 100 !important;' +
        'opacity: 1 !important;' +
        'white-space: nowrap !important;' +
        'max-width: 90% !important;' +
        'overflow: hidden !important;' +
        'text-overflow: ellipsis !important;' +
        'line-height: 1.3 !important;' +
        'font-style: italic !important;' +
        'font-weight: normal !important;';
    loadingTextOverlay.textContent = loadingMessage;

    var loadingContainer = canvas.parentElement;
    loadingContainer.style.position = 'relative';
    loadingContainer.appendChild(loadingTextOverlay);

    animateLoading();

    window.stopImmediateLoadingAnimation = function(callback) {
        var elapsed = Date.now() - loadingStartTime;
        var minTime = 2000;

        if (callback && !window._loadingAnimationCallback) {
            window._loadingAnimationCallback = callback;
        }

        if (elapsed < minTime) {
            setTimeout(function() {
                loadingAnimationActive = false;
                isFadingOut = true;
            }, minTime - elapsed);
        } else {
            loadingAnimationActive = false;
            isFadingOut = true;
        }
    };
})();
