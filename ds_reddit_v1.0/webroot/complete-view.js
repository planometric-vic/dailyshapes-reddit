// Completion View Renderer for Daily Shapes v4.0
// Renders end-of-day summary inside the canvas

const completeView = (() => {
    let stopCountdown = null;
    let bound = false;
    let isActive = false;

    // Radar graph constants (shared by animateRadarGraph and renderCompletionOverlay)
    const NUM_SPOKES = 10;
    const SPOKE_ANGLE = (Math.PI * 2) / NUM_SPOKES;
    const RADAR_COLOR = '#00798C';

    // Get current date for tracking animation per day
    function getCurrentDate() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // Check if animation has been shown today
    function hasShownAnimationToday() {
        const today = getCurrentDate();
        const lastAnimationDate = localStorage.getItem('dailyShapes_lastAnimationDate');
        return lastAnimationDate === today;
    }

    // Mark animation as shown for today
    function markAnimationShown() {
        const today = getCurrentDate();
        localStorage.setItem('dailyShapes_lastAnimationDate', today);
    }

    // Check if competition prompt has been shown today
    function hasShownCompetitionPromptToday() {
        const today = getCurrentDate();
        const lastPromptDate = localStorage.getItem('dailyShapes_lastCompetitionPromptDate');
        return lastPromptDate === today;
    }

    // Mark competition prompt as shown for today
    function markCompetitionPromptShown() {
        const today = getCurrentDate();
        localStorage.setItem('dailyShapes_lastCompetitionPromptDate', today);
    }

    function show(model) {
        if (isActive) {
            // Already showing, just update the model
            updateDisplay(model);
            return;
        }

        isActive = true;

        // Set flag to prevent other scripts from resizing container
        window.completionViewActive = true;

        // Clear any lingering fireworks/confetti to prevent lag
        clearConfetti();

        // Prevent page scrolling in completion state
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        console.log('🔒 Disabled page scrolling for completion state');

        // Clear split displays immediately if reloading, or with delay if first time
        const isReload = hasShownAnimationToday();
        const clearDelay = isReload ? 0 : 2000;

        if (isReload) {
            console.log('🧹 IMMEDIATE: Clearing split displays (reload detected)');
        } else {
            console.log('🧹 DELAYED: Will clear split displays after 2 seconds (first animation)');
        }

        setTimeout(() => {
            const splitDisplays = document.querySelectorAll('.split-display, .split-display-large, .attempt-result');
            const fixedPercentageArea = document.getElementById('fixedPercentageArea');

            splitDisplays.forEach(element => {
                element.style.setProperty('display', 'none', 'important');
                element.style.setProperty('opacity', '0', 'important');
                element.style.setProperty('visibility', 'hidden', 'important');
            });

            if (fixedPercentageArea) {
                fixedPercentageArea.style.setProperty('display', 'none', 'important');
                fixedPercentageArea.style.setProperty('opacity', '0', 'important');
                fixedPercentageArea.style.setProperty('visibility', 'hidden', 'important');
                fixedPercentageArea.innerHTML = '';
            }

            console.log('🧹 Split displays cleared');
        }, clearDelay);

        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            console.error('❌ Game canvas not found for completion view');
            return;
        }

        // Ensure canvas and container are visible
        const canvasContainer = canvas.parentElement;
        if (canvasContainer) {
            canvasContainer.style.display = 'flex';
            canvasContainer.style.visibility = 'visible';
        }
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';

        const ctx = canvas.getContext('2d');

        // Disable canvas interaction
        canvas.style.pointerEvents = 'none';

        // Clear any previous instruction text immediately
        clearInstructionText();

        // Show countdown above canvas
        const countdownElement = showCountdownAboveCanvas();

        // Check if animation has already been shown today
        if (hasShownAnimationToday()) {
            // Already shown today - render immediately without animation
            console.log('🎬 Skipping animation - already shown today');
            renderCompletionOverlay(ctx, model);

            // Show actions and modal immediately
            createPostCanvasActions();

            // On reload, show leaderboard immediately (no animation to wait for)
            console.log('🔄 Reload detected - showing leaderboard immediately');
            if (window.WeeklyLeaderboard) {
                window.WeeklyLeaderboard.show();
            }

        } else {
            // First time today - show animated sequence
            console.log('🎬 Playing completion animation for the first time today');
            markAnimationShown();

            startAnimatedSequence(ctx, model, () => {
                // Buttons are now created during animation when tomorrow text appears
                console.log('🎬 Animation sequence complete');
            });
        }

        // Start live countdown
        stopCountdown?.();
        stopCountdown = startDailyCountdown({
            onTick: (timeString) => {
                // Update countdown above canvas
                if (countdownElement) {
                    countdownElement.textContent = `New shapes in ${timeString}`;
                }
                // Canvas doesn't need to be re-rendered for countdown updates
            },
            onZero: () => {
                // Soft refresh to new day
                console.log('🌅 New day starting - refreshing game state');
                location.hash = '#/home';
                location.reload();
            }
        });

        // CRITICAL: Only clear split displays if all shapes for the day are actually completed
        // Don't hide displays if user is still actively playing
        setTimeout(() => {
            // Check if all shapes are truly completed for the current day
            const isFullyCompleted = (window.RefreshProtection && window.RefreshProtection.isGameCompleted()) ||
                                    (window.dailyGameState && (window.dailyGameState.dayComplete || window.dailyGameState.isGameComplete));

            if (isFullyCompleted) {
                const splitDisplays = document.querySelectorAll('.split-display, .split-display-large, .attempt-result');
                const fixedPercentageArea = document.getElementById('fixedPercentageArea');

                splitDisplays.forEach(element => {
                    element.style.display = 'none';
                    element.style.opacity = '0';
                });

                // Also clear the fixed percentage area to ensure split displays don't persist there
                if (fixedPercentageArea) {
                    fixedPercentageArea.style.display = 'none';
                    fixedPercentageArea.style.opacity = '0';
                    fixedPercentageArea.innerHTML = ''; // Clear any content
                    console.log('🧹 Fixed percentage area cleared');
                }

                console.log('🧹 Final cleanup: All split displays cleared - day is completed');
            } else {
                console.log('🎮 Keeping split displays visible - game still in progress');
            }
        }, 100); // Short delay to ensure buttons are rendered first

        console.log('✅ Completion view shown');
    }

    function hide() {
        if (!isActive) return;

        isActive = false;
        stopCountdown?.();
        stopCountdown = null;

        // Clear flag
        window.completionViewActive = false;

        // Restore page scrolling
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        console.log('🔓 Restored page scrolling');

        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            // Clear canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Clear instruction text and restore instruction area visibility
        const instructionText = document.getElementById('instructionText');
        const instructionArea = document.getElementById('instructionArea');
        if (instructionText && instructionArea) {
            instructionText.textContent = '';
            instructionText.style.fontWeight = 'normal';
            instructionArea.style.visibility = 'visible'; // Restore instruction area visibility
            instructionArea.innerHTML = '<div id="instructionText" class="instruction-text"></div>';
        }
        
        // Restore split display and progress tracker visibility
        restoreGameElements();
        
        const container = document.getElementById('post-canvas-actions');
        if (container) {
            container.remove();
        }
        
        console.log('✅ Completion view hidden');
    }

    function updateDisplay(model) {
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            renderCompletionOverlay(ctx, model);
        }
    }

    function startAnimatedSequence(ctx, model, onComplete) {
        console.log('🎬 Starting animated completion sequence');

        // Step 1: Keep shaded shape visible for 1 second (it's already there from the final cut)
        setTimeout(() => {
            // Step 2: Fade out the shape, cut shading, and split display
            fadeOutFinalCut(ctx, () => {
                // Step 3: After fade out complete, start radar graph animation
                setTimeout(() => {
                    animateRadarGraph(ctx, model, onComplete);
                }, 100);
            });
        }, 1000);
    }

    function fadeOutFinalCut(ctx, callback) {
        console.log('🌫️ Fading out final cut');
        const canvas = ctx.canvas;
        const fadeSteps = 20;
        const fadeDuration = 500; // 500ms fade
        const stepDuration = fadeDuration / fadeSteps;
        let currentStep = 0;

        // Fade out split displays
        const splitDisplays = document.querySelectorAll('.split-display, .split-display-large, .attempt-result');
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');

        const fadeInterval = setInterval(() => {
            currentStep++;
            const opacity = 1 - (currentStep / fadeSteps);

            // Fade split displays
            splitDisplays.forEach(element => {
                element.style.opacity = opacity;
            });
            if (fixedPercentageArea) {
                fixedPercentageArea.style.opacity = opacity;
            }

            // Fade canvas content by drawing white overlay
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);

            ctx.globalAlpha = currentStep / fadeSteps;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;

            if (currentStep >= fadeSteps) {
                clearInterval(fadeInterval);

                // Hide split displays completely
                splitDisplays.forEach(element => {
                    element.style.display = 'none';
                });
                if (fixedPercentageArea) {
                    fixedPercentageArea.style.display = 'none';
                }

                // Clear canvas and draw grid only
                drawGridOnly(ctx);
                callback();
            }
        }, stepDuration);
    }

    function drawGridOnly(ctx) {
        const canvas = ctx.canvas;
        const rect = canvas.getBoundingClientRect();
        const cssWidth = rect.width;
        const cssHeight = rect.height;
        const dpr = window.devicePixelRatio || 1;

        // Check if canvas needs to be resized for proper DPR handling
        const expectedWidth = cssWidth * dpr;
        const expectedHeight = cssHeight * dpr;

        if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
            // Reset canvas size to match CSS dimensions with DPR scaling
            canvas.width = expectedWidth;
            canvas.height = expectedHeight;
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            ctx.scale(dpr, dpr);
        }

        // Clear and reset context using CSS dimensions (context is scaled)
        ctx.clearRect(0, 0, cssWidth, cssHeight);

        // Fill white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        // Draw black outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, cssWidth, cssHeight);

        // Draw grid lines
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 0.5;

        const gridSize = 14;
        const cellSize = cssWidth / gridSize;

        // Vertical lines
        for (let i = 0; i <= gridSize; i++) {
            const x = i * cellSize;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, cssHeight);
            ctx.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            const y = i * cellSize;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(cssWidth, y);
            ctx.stroke();
        }
    }

    // Confetti particle system - DOM-based fireworks for full-screen effect
    // Shared between animated and static views
    let confettiElements = [];
    let confettiTimeouts = []; // Track all timeouts for proper cleanup

    // Clear all confetti immediately (for cleanup)
    function clearConfetti() {
        // Cancel all pending timeouts
        confettiTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        confettiTimeouts = [];

        // Remove all confetti elements from DOM
        confettiElements.forEach(el => {
            if (el && el.parentNode) {
                el.remove();
            }
        });
        confettiElements = [];
    }

    function createConfetti(x, y, color, singleBurst = false) {
            // Clear any existing confetti first to prevent accumulation
            clearConfetti();

            // FIREWORK-STYLE CONFETTI for perfect cuts - explosive bursts across screen!
            const confettiColors = [
                color,
                '#FFD700', // Gold
                '#FFA500', // Orange
                '#FF6B35', // Red-orange
                '#FFFFFF', // White sparkles
                '#FF1493', // Deep pink
                '#00CED1'  // Turquoise
            ];

            // Create 4-5 firework bursts for visual impact
            // OR single burst at specified location for completion view
            const burstCount = singleBurst ? 1 : (4 + Math.floor(Math.random() * 2));

            for (let b = 0; b < burstCount; b++) {
                // Use provided coordinates for single burst, random for multiple bursts
                const burstX = singleBurst ? x : (Math.random() * window.innerWidth);
                const burstY = singleBurst ? y : (100 + Math.random() * (window.innerHeight * 0.4));

                // Each burst has 18-24 particles - good balance of impact and performance
                const particlesPerBurst = 18 + Math.floor(Math.random() * 6);

                // Stagger burst timing - MORE FREQUENT!
                const burstDelay = b * 120; // 120ms between bursts (was 200ms)

                const burstTimeoutId = setTimeout(() => {
                    for (let i = 0; i < particlesPerBurst; i++) {
                        const particleColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
                        const size = 4 + Math.random() * 5; // 4-9px (reduced for performance)

                        // Varied shapes
                        const shapeType = Math.random();
                        let shape = 'square';
                        if (shapeType < 0.33) shape = 'circle';
                        else if (shapeType < 0.66) shape = 'rect';

                        // Create DOM element at burst center
                        const confetti = document.createElement('div');
                        confetti.style.position = 'fixed';
                        confetti.style.left = burstX + 'px';
                        confetti.style.top = burstY + 'px';
                        confetti.style.width = size + 'px';
                        confetti.style.height = (shape === 'rect' ? size * 0.6 : size) + 'px';
                        confetti.style.backgroundColor = particleColor;
                        confetti.style.borderRadius = (shape === 'circle' ? '50%' : '0');
                        confetti.style.pointerEvents = 'none';
                        confetti.style.zIndex = '999999';
                        confetti.style.opacity = '1';

                        document.body.appendChild(confetti);
                        confettiElements.push(confetti);

                        // Explosive outward motion in all directions
                        const angle = (Math.PI * 2 * i) / particlesPerBurst + (Math.random() - 0.5) * 0.3;
                        const speed = 150 + Math.random() * 200; // 150-350px distance
                        const deltaX = Math.cos(angle) * speed;
                        const deltaY = Math.sin(angle) * speed;

                        // Rotation
                        const rotations = 2 + Math.random() * 3;

                        // Duration - quick burst (reduced for performance)
                        const duration = 0.6 + Math.random() * 0.3; // 0.6-0.9s (faster cleanup)
                        const fadeStartRatio = 0.5; // Start fading halfway through movement
                        const fadeDuration = duration * fadeStartRatio; // Fade takes half the duration

                        // Both transform and opacity animate together
                        confetti.style.transition = `transform ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${fadeDuration}s ease-out ${duration * fadeStartRatio}s`;

                        // Trigger explosion animation - particles fade while moving!
                        // Use translate3d for GPU acceleration
                        requestAnimationFrame(() => {
                            confetti.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotations * 360}deg) scale(0.3)`;
                            confetti.style.opacity = '0';
                        });

                        // Schedule removal
                        const removeTimeoutId = setTimeout(() => {
                            if (confetti.parentNode) {
                                confetti.remove();
                            }
                            const index = confettiElements.indexOf(confetti);
                            if (index > -1) {
                                confettiElements.splice(index, 1);
                            }
                        }, (duration + 0.15) * 1000);
                        confettiTimeouts.push(removeTimeoutId);
                    }
                }, burstDelay);
                confettiTimeouts.push(burstTimeoutId);
            }
        }

    function updateAndDrawConfetti(ctx) {
        // No-op for DOM-based confetti (animation handled by CSS)
    }

    // Helper functions - defined once, not in animation loop
    function getTomorrowsMechanic() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayOfWeek = tomorrow.getDay();
        const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek;
        const mechanicMap = {
            1: 'DefaultWithUndoMechanic',
            2: 'HorizontalOnlyMechanic',
            3: 'CircleCutMechanic',
            4: 'DiagonalAscendingMechanic',
            5: 'ThreePointTriangleMechanic',
            6: 'RotatingSquareMechanic',
            7: 'RotatingShapeVectorMechanic'
        };
        return mechanicMap[dayNum];
    }

    function getFriendlyMechanicName(mechanicName) {
        const nameMap = {
            'DefaultWithUndoMechanic': 'Straight Line Cutter',
            'HorizontalOnlyMechanic': 'Horizontal Cutter',
            'DiagonalAscendingMechanic': 'Diagonal Cutter',
            'CircleCutMechanic': 'Circular Cutter',
            'ThreePointTriangleMechanic': 'Triangular Cutter',
            'RotatingSquareMechanic': 'Square Cutter',
            'RotatingShapeVectorMechanic': 'Straight Line Cutter (Rotating Shape)'
        };
        return nameMap[mechanicName] || mechanicName;
    }

    function animateRadarGraph(ctx, model, onComplete) {
        console.log('📊 Animating radar graph');

        const canvas = ctx.canvas;

        // Draw grid immediately - this also sets up canvas with proper DPR scaling
        drawGridOnly(ctx);

        const rect = canvas.getBoundingClientRect();
        const cssWidth = rect.width;
        const cssHeight = rect.height;

        const gridSize = 14;
        const cellSize = cssWidth / gridSize;
        const hexagonHeight = cellSize * 4 * 2;
        const hexRadius = hexagonHeight / 2;
        const centerX = cssWidth / 2;
        const centerY = cssHeight / 2;

        // Extract scores from model
        const scores = [];
        const attemptPercentages = [];
        if (model.shapes && model.shapes.length > 0) {
            model.shapes.forEach(shape => {
                if (shape.attempts && shape.attempts.length > 0) {
                    shape.attempts.forEach(attempt => {
                        const leftPct = attempt.leftPct || attempt.leftPercentage || attempt.leftPercent || 0;
                        const rightPct = attempt.rightPct || attempt.rightPercentage || attempt.rightPercent || 0;
                        const smallerPct = Math.min(leftPct, rightPct);
                        scores.push(Math.round(smallerPct));
                        attemptPercentages.push({ left: leftPct, right: rightPct });
                    });
                }
            });
        }
        while (scores.length < NUM_SPOKES) {
            scores.push(0);
            attemptPercentages.push({ left: 0, right: 0 });
        }

        console.log('📊 Radar graph scores:', scores);

        const baseFontSize = Math.max(cssWidth * 0.045, 14);
        const titleSize = Math.round(baseFontSize * 1.2);
        const padding = Math.max(cssWidth * 0.05, 15);

        // Animation sequence
        let phase = 0;
        let hexagonOpacity = 0;
        let scoreAnimations = scores.map((score, index) => {
            // Check if BOTH percentages rounded to 50 for true perfect cut
            // This prevents 49/51 from being treated as perfect
            const percentages = attemptPercentages[index];
            const leftRounded = Math.round(percentages.left);
            const rightRounded = Math.round(percentages.right);
            const isPerfect = leftRounded === 50 && rightRounded === 50;

            return {
                triangleVisible: false,
                trianglePopScale: 0,
                scoreVisible: false,
                scorePopScale: 0,
                hasBonus: isPerfect, // 50-point bonus only for true perfect cuts (both sides = 50)
                bonusVisible: false,
                bonusPopScale: 0
            };
        });
        let totalScore = 0;
        let displayedScore = 0;
        let animationComplete = false;
        let isTabulatingScore = false; // Prevent multiple tabulation intervals
        let tomorrowTextOpacity = 0; // Start invisible
        let buttonsCreated = false; // Track if buttons have been created

        const animate = () => {
            drawGridOnly(ctx);

            // Phase 1: Fade in hexagon and vertices with "Today's Score: 0"
            if (phase === 0) {
                hexagonOpacity = Math.min(1, hexagonOpacity + 0.05);

                ctx.globalAlpha = hexagonOpacity;

                // Draw "My Score: 0"
                ctx.fillStyle = '#333';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = `bold ${Math.round(baseFontSize * 1.1)}px Arial, sans-serif`;
                ctx.fillText(`My Score: 0`, padding * 1.0, padding * 1.3);

                // Draw "Tomorrow's cutting tool will be..." at the bottom
                // (functions defined outside animation loop for performance)

                const tomorrowMechanic = getTomorrowsMechanic();
                const tomorrowTool = getFriendlyMechanicName(tomorrowMechanic);
                const textOffset = cellSize * 0.8;
                const vertex3Y = centerY + hexRadius + textOffset;
                const tomorrowTextY = vertex3Y + cellSize * 1.2;

                // Draw tomorrow's text with fade
                if (tomorrowTextOpacity > 0) {
                    ctx.save();
                    ctx.globalAlpha = tomorrowTextOpacity;
                    ctx.fillStyle = '#6496FF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.font = `bold ${Math.round(baseFontSize * 1.1 * 0.75)}px Arial, sans-serif`;
                    ctx.fillText(`Tomorrow: ${tomorrowTool}`, centerX, tomorrowTextY);
                    ctx.restore();
                }

                // Draw hexagon
                drawHexagon(ctx, centerX, centerY, hexRadius);

                // Draw dashed vertices
                drawDashedVertices(ctx, centerX, centerY, hexRadius);

                // Draw confetti
                updateAndDrawConfetti(ctx);

                ctx.globalAlpha = 1;

                if (hexagonOpacity >= 1) {
                    phase = 1;
                    setTimeout(() => requestAnimationFrame(animate), 300);
                    return;
                }

                requestAnimationFrame(animate);
                return;
            }

            // Phase 1: Pop triangles one by one clockwise from 90° (index 0)
            if (phase === 1) {
                // Find the current triangle to animate (first one where score isn't visible yet)
                let currentTriangleIndex = -1;
                for (let i = 0; i < NUM_SPOKES; i++) {
                    if (!scoreAnimations[i].scoreVisible) {
                        currentTriangleIndex = i;
                        break;
                    }
                }

                // If we have a triangle to show and not currently tabulating
                if (currentTriangleIndex !== -1 && !isTabulatingScore) {
                    // Make triangle visible if not already
                    if (!scoreAnimations[currentTriangleIndex].triangleVisible) {
                        scoreAnimations[currentTriangleIndex].triangleVisible = true;
                        console.log(`Triangle ${currentTriangleIndex} now visible`);
                    }

                    // Animate the triangle fade-in
                    if (scoreAnimations[currentTriangleIndex].trianglePopScale < 1) {
                        scoreAnimations[currentTriangleIndex].trianglePopScale = Math.min(1, scoreAnimations[currentTriangleIndex].trianglePopScale + 0.15);
                    }

                    // When triangle fade finishes, show score and start tabulating
                    if (scoreAnimations[currentTriangleIndex].trianglePopScale >= 1 && !scoreAnimations[currentTriangleIndex].scoreVisible) {
                        scoreAnimations[currentTriangleIndex].scoreVisible = true;

                        // If this score has a bonus, make bonus visible and trigger confetti
                        if (scoreAnimations[currentTriangleIndex].hasBonus) {
                            scoreAnimations[currentTriangleIndex].bonusVisible = true;

                            // Trigger confetti at bonus location
                            const angle = SPOKE_ANGLE * currentTriangleIndex - (Math.PI / 2);
                            const textDistance = hexRadius + cellSize * 0.8;
                            const baseX = centerX + textDistance * Math.cos(angle);
                            const baseY = centerY + textDistance * Math.sin(angle);
                            const isRightSide = currentTriangleIndex < NUM_SPOKES / 2;
                            const bonusX = baseX + (isRightSide ? cellSize * 1.2 : -cellSize * 1.2);

                            // Convert canvas coordinates to screen coordinates
                            const canvas = ctx.canvas;
                            const rect = canvas.getBoundingClientRect();
                            const screenX = rect.left + bonusX;
                            const screenY = rect.top + baseY;

                            createConfetti(screenX, screenY, '#FFD700', true); // Single burst at +50 location

                            console.log(`Bonus ${currentTriangleIndex} visible with confetti`);
                        }

                        // Add base score + bonus (if applicable) to total
                        const scoreToAdd = scores[currentTriangleIndex] + (scoreAnimations[currentTriangleIndex].hasBonus ? 50 : 0);
                        totalScore += scoreToAdd;
                        isTabulatingScore = true;

                        console.log(`Triangle ${currentTriangleIndex} complete, score: ${scores[currentTriangleIndex]}, bonus: ${scoreAnimations[currentTriangleIndex].hasBonus ? 50 : 0}, new total: ${totalScore}`);

                        // Start tabulating this score (base + bonus together)
                        const targetScore = totalScore;
                        const scoreStep = scoreToAdd / 10;
                        const tabulateInterval = setInterval(() => {
                            displayedScore = Math.min(targetScore, displayedScore + scoreStep);

                            // POP animation for the score label AND bonus (if applicable)
                            if (scoreAnimations[currentTriangleIndex].scorePopScale < 1) {
                                scoreAnimations[currentTriangleIndex].scorePopScale = Math.min(1, scoreAnimations[currentTriangleIndex].scorePopScale + 0.2);
                            }
                            if (scoreAnimations[currentTriangleIndex].hasBonus && scoreAnimations[currentTriangleIndex].bonusPopScale < 1) {
                                scoreAnimations[currentTriangleIndex].bonusPopScale = Math.min(1, scoreAnimations[currentTriangleIndex].bonusPopScale + 0.2);
                            }

                            // Trigger a redraw
                            requestAnimationFrame(animate);

                            if (displayedScore >= targetScore) {
                                clearInterval(tabulateInterval);
                                scoreAnimations[currentTriangleIndex].scorePopScale = 1;
                                if (scoreAnimations[currentTriangleIndex].hasBonus) {
                                    scoreAnimations[currentTriangleIndex].bonusPopScale = 1;
                                }
                                displayedScore = targetScore;
                                isTabulatingScore = false;
                                console.log(`Score ${currentTriangleIndex} tabulation complete, moving to next`);
                                // Delay before next triangle starts (shorter for 10 spokes)
                                setTimeout(() => requestAnimationFrame(animate), 300);
                            }
                        }, 50); // Reduced from 25ms to 50ms for better performance (20fps instead of 40fps)
                    }
                }

                // Only draw if something is animating
                // Clear canvas and redraw grid
                drawGridOnly(ctx);

                // Draw everything in Phase 1
                drawTriangles(ctx, centerX, centerY, hexRadius, scores, scoreAnimations);
                drawHexagon(ctx, centerX, centerY, hexRadius);
                drawDashedVertices(ctx, centerX, centerY, hexRadius);
                drawScoreLabels(ctx, centerX, centerY, hexRadius, scores, scoreAnimations, cellSize, baseFontSize);
                drawBonusLabels(ctx, centerX, centerY, hexRadius, scoreAnimations, cellSize, baseFontSize);

                ctx.fillStyle = '#333';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.font = `bold ${Math.round(baseFontSize * 1.1)}px Arial, sans-serif`;
                ctx.fillText(`My Score: ${Math.round(displayedScore)}`, padding * 1.0, padding * 1.3);

                // Draw "Tomorrow's cutting tool will be..." at the bottom
                // (functions defined outside animation loop for performance)

                const tomorrowMechanic = getTomorrowsMechanic();
                const tomorrowTool = getFriendlyMechanicName(tomorrowMechanic);
                const textOffset = cellSize * 0.8;
                const vertex3Y = centerY + hexRadius + textOffset;
                const tomorrowTextY = vertex3Y + cellSize * 1.2;

                // Draw tomorrow's text with fade
                if (tomorrowTextOpacity > 0) {
                    ctx.save();
                    ctx.globalAlpha = tomorrowTextOpacity;
                    ctx.fillStyle = '#6496FF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.font = `bold ${Math.round(baseFontSize * 1.1 * 0.75)}px Arial, sans-serif`;
                    ctx.fillText(`Tomorrow: ${tomorrowTool}`, centerX, tomorrowTextY);
                    ctx.restore();
                }

                // Check if all triangles are complete
                if (currentTriangleIndex === -1) {
                    console.log('✅ All triangles complete, final score:', totalScore);
                    console.log('✅ displayedScore:', displayedScore);
                    console.log('✅ confettiElements.length:', confettiElements.length);
                    console.log('✅ tomorrowTextOpacity:', tomorrowTextOpacity);
                    console.log('✅ animationComplete:', animationComplete);

                    // Create buttons when tomorrow text starts appearing (same time as text)
                    if (!buttonsCreated && tomorrowTextOpacity === 0) {
                        buttonsCreated = true;
                        createPostCanvasActions();
                        console.log('🔘 Buttons created alongside tomorrow text');
                    }

                    // Fade in tomorrow's text
                    if (tomorrowTextOpacity < 1) {
                        tomorrowTextOpacity = Math.min(1, tomorrowTextOpacity + 0.02);
                    }

                    // Keep animating until text is fully faded in (confetti handled by CSS)
                    if (tomorrowTextOpacity < 1) {
                        requestAnimationFrame(animate);
                        return;
                    }

                    // Animation complete (including confetti and text fade)
                    if (!animationComplete) {
                        animationComplete = true;
                        console.log('🎬 Animation complete! Setting timeout for popup...');

                        // Call onComplete callback if it exists
                        if (onComplete) {
                            onComplete();
                        }

                        // Show competition prompt popup after animation completes (only once per day)
                        setTimeout(() => {
                            console.log('⏰ Animation complete, checking if competition prompt should be shown...');

                            if (!hasShownCompetitionPromptToday()) {
                                if (window.showCompetitionPromptModal) {
                                    console.log('📢 Calling showCompetitionPromptModal() - first time today');
                                    window.showCompetitionPromptModal();
                                    markCompetitionPromptShown();
                                } else {
                                    console.error('❌ showCompetitionPromptModal not found on window');
                                }
                            } else {
                                console.log('✅ Competition prompt already shown today - skipping');
                            }
                        }, 2000); // 2 second delay after animation completes
                    }
                    return;
                }

                // Only continue animation if needed (during tabulation or pop animations)
                if (isTabulatingScore || scoreAnimations.some(sa => sa.trianglePopScale < 1 || sa.scorePopScale < 1 || (sa.hasBonus && sa.bonusPopScale < 1))) {
                    requestAnimationFrame(animate);
                }
                return;
            }

        };

        requestAnimationFrame(animate);
    }

    function drawHexagon(ctx, centerX, centerY, hexRadius) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const x = centerX + hexRadius * Math.cos(angle);
            const y = centerY + hexRadius * Math.sin(angle);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();
        ctx.stroke();
    }

    function drawDashedVertices(ctx, centerX, centerY, hexRadius) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.75;
        ctx.setLineDash([5, 5]);

        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const x = centerX + hexRadius * Math.cos(angle);
            const y = centerY + hexRadius * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    function drawTriangles(ctx, centerX, centerY, hexRadius, scores, scoreAnimations) {
        const scorePoints = [];
        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const score = scores[i];
            const normalizedScore = score === 50 ? 100 : (score / 50) * 100;
            const distance = (normalizedScore / 100) * hexRadius;
            const x = centerX + distance * Math.cos(angle);
            const y = centerY + distance * Math.sin(angle);
            scorePoints.push({ x, y });
        }

        for (let i = 0; i < NUM_SPOKES; i++) {
            if (!scoreAnimations[i].triangleVisible) continue;

            const currentPoint = scorePoints[i];
            const nextPoint = scorePoints[(i + 1) % NUM_SPOKES];

            const popScale = scoreAnimations[i].trianglePopScale || 0;

            ctx.save();
            ctx.globalAlpha = popScale;
            ctx.fillStyle = RADAR_COLOR;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(currentPoint.x, currentPoint.y);
            ctx.lineTo(nextPoint.x, nextPoint.y);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    function drawScoreLabels(ctx, centerX, centerY, hexRadius, scores, scoreAnimations, cellSize, baseFontSize) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textOffset = cellSize * 0.8;

        for (let i = 0; i < NUM_SPOKES; i++) {
            if (!scoreAnimations[i].scoreVisible) continue;

            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const score = scores[i];
            const popScale = scoreAnimations[i].scorePopScale || 0;

            const easeScale = popScale < 0.3
                ? popScale * 5
                : popScale < 0.7
                ? 1.5 - (popScale - 0.3) * 1.25
                : 1.0;

            ctx.fillStyle = RADAR_COLOR;

            const textDistance = hexRadius + textOffset;
            const x = centerX + textDistance * Math.cos(angle);
            const y = centerY + textDistance * Math.sin(angle);

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(easeScale, easeScale);

            ctx.font = `bold ${Math.round(baseFontSize * 0.85)}px Arial, sans-serif`;
            ctx.fillText(Math.round(score), 0, 0);

            ctx.restore();
        }
    }

    function drawBonusLabels(ctx, centerX, centerY, hexRadius, scoreAnimations, cellSize, baseFontSize) {
        ctx.textBaseline = 'middle';

        const textOffset = cellSize * 0.8;
        const bonusOffset = cellSize * 1.2;

        for (let i = 0; i < NUM_SPOKES; i++) {
            if (!scoreAnimations[i].bonusVisible) continue;

            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const bonusPopScale = scoreAnimations[i].bonusPopScale || 0;

            const easeScale = bonusPopScale < 0.25
                ? bonusPopScale * 6.4
                : bonusPopScale < 0.65
                ? 1.6 - (bonusPopScale - 0.25) * 1.5
                : 1.0;

            ctx.fillStyle = '#000000';

            const textDistance = hexRadius + textOffset;
            const baseX = centerX + textDistance * Math.cos(angle);
            const baseY = centerY + textDistance * Math.sin(angle);

            // Position bonus to right for first half of spokes, left for second half
            const isRightSide = i < NUM_SPOKES / 2;
            const bonusX = baseX + (isRightSide ? bonusOffset : -bonusOffset);

            ctx.save();
            ctx.translate(bonusX, baseY);
            ctx.scale(easeScale, easeScale);

            ctx.font = `bold ${Math.round(baseFontSize * 1.0)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('+50', 0, 0);

            ctx.restore();
        }
    }

    function renderCompletionOverlay(ctx, model) {
        const canvas = ctx.canvas;

        // Get device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;

        // Get CSS dimensions
        const rect = canvas.getBoundingClientRect();
        const cssWidth = rect.width;
        const cssHeight = rect.height;

        // Scale canvas for high DPI displays
        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;

        // Scale context to match
        ctx.scale(dpr, dpr);

        console.log(`📐 Canvas scaled for crisp text: CSS ${cssWidth}x${cssHeight}, actual ${canvas.width}x${canvas.height}, DPR ${dpr}`);

        // Draw the grid background manually with correct dimensions
        // Fill canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        // Draw black outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, cssWidth, cssHeight);

        // Draw grid lines (matching the pattern from drawGrid())
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 0.5;

        // Draw 14x14 grid with larger cells
        const gridSize = 14;
        const cellSize = cssWidth / gridSize;

        // Vertical lines
        for (let i = 0; i <= gridSize; i++) {
            const x = i * cellSize;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, cssHeight);
            ctx.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            const y = i * cellSize;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(cssWidth, y);
            ctx.stroke();
        }

        console.log('✅ Grid drawn in completion view with dimensions:', cssWidth, 'x', cssHeight);

        // Dynamic text sizing based on canvas width
        const baseFontSize = Math.max(cssWidth * 0.045, 14); // ~4.5% of canvas width, min 14px
        const titleSize = Math.round(baseFontSize * 1.2);

        // Dynamic padding and spacing based on canvas size
        const padding = Math.max(cssWidth * 0.05, 15);

        // Calculate total score with bonuses (need to do this early for title)
        let totalScoreForTitle = 0;
        const scoresForTitle = [];
        if (model.shapes && model.shapes.length > 0) {
            model.shapes.forEach(shape => {
                if (shape.attempts && shape.attempts.length > 0) {
                    shape.attempts.forEach(attempt => {
                        const leftPct = attempt.leftPct || attempt.leftPercentage || attempt.leftPercent || 0;
                        const rightPct = attempt.rightPct || attempt.rightPercentage || attempt.rightPercent || 0;
                        const smallerPct = Math.min(leftPct, rightPct);
                        const displayScore = Math.round(smallerPct);
                        scoresForTitle.push(displayScore);
                        totalScoreForTitle += displayScore;
                        if (displayScore === 50) {
                            totalScoreForTitle += 50; // Add bonus
                        }
                    });
                }
            });
        }

        // Draw score title with crisp text rendering
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        let y = padding * 1.3; // Add extra space above first line

        // Title - show total score including bonuses
        ctx.font = `bold ${Math.round(baseFontSize * 1.1)}px Arial, sans-serif`;
        ctx.fillText(`My Score: ${totalScoreForTitle}`, padding * 1.0, y);

        // Draw hexagon in center of canvas
        // Calculate hexagon size: 4 cells high, then double it (8 cells high total)
        const hexagonHeight = cellSize * 4 * 2; // 2x larger
        // For a regular hexagon with flat top/bottom and vertex pointing up,
        // the radius from center to vertex is height / 2
        const hexRadius = hexagonHeight / 2;

        const centerX = cssWidth / 2;
        const centerY = cssHeight / 2;

        // Draw radar graph with attempt scores
        const scores = [];
        if (model.shapes && model.shapes.length > 0) {
            model.shapes.forEach(shape => {
                if (shape.attempts && shape.attempts.length > 0) {
                    shape.attempts.forEach(attempt => {
                        const leftPct = attempt.leftPct || attempt.leftPercentage || attempt.leftPercent || 0;
                        const rightPct = attempt.rightPct || attempt.rightPercentage || attempt.rightPercent || 0;
                        const smallerPct = Math.min(leftPct, rightPct);
                        scores.push(Math.round(smallerPct));
                    });
                }
            });
        }
        while (scores.length < NUM_SPOKES) scores.push(0);

        console.log('📊 Radar graph scores (static render):', scores);

        // Calculate score positions along each spoke
        const scorePoints = [];
        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const score = scores[i];
            const normalizedScore = score === 50 ? 100 : (score / 50) * 100;
            const distance = (normalizedScore / 100) * hexRadius;
            scorePoints.push({
                x: centerX + distance * Math.cos(angle),
                y: centerY + distance * Math.sin(angle)
            });
        }

        // Draw filled triangles (center → score → next score)
        for (let i = 0; i < NUM_SPOKES; i++) {
            const cur = scorePoints[i];
            const next = scorePoints[(i + 1) % NUM_SPOKES];
            ctx.fillStyle = RADAR_COLOR;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(cur.x, cur.y);
            ctx.lineTo(next.x, next.y);
            ctx.closePath();
            ctx.fill();
        }

        // Draw decagon outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const x = centerX + hexRadius * Math.cos(angle);
            const y = centerY + hexRadius * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw dashed spokes
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.75;
        ctx.setLineDash([5, 5]);
        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const x = centerX + hexRadius * Math.cos(angle);
            const y = centerY + hexRadius * Math.sin(angle);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Draw score labels at spoke tips
        const textOffset = cellSize * 0.8;
        const bonusOffset = cellSize * 1.2;
        ctx.font = `bold ${Math.round(baseFontSize * 0.85)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let totalScore = 0;
        for (let i = 0; i < NUM_SPOKES; i++) {
            totalScore += scores[i];
            if (scores[i] === 50) totalScore += 50;
        }

        for (let i = 0; i < NUM_SPOKES; i++) {
            const angle = SPOKE_ANGLE * i - (Math.PI / 2);
            const score = scores[i];
            ctx.fillStyle = RADAR_COLOR;

            const textDist = hexRadius + textOffset;
            const x = centerX + textDist * Math.cos(angle);
            const y = centerY + textDist * Math.sin(angle);
            ctx.fillText(Math.round(score).toString(), x, y);

            if (score === 50) {
                const isRightSide = i < NUM_SPOKES / 2;
                const bonusX = x + (isRightSide ? bonusOffset : -bonusOffset);
                ctx.fillStyle = '#000000';
                ctx.font = `bold ${Math.round(baseFontSize)}px Arial, sans-serif`;
                ctx.fillText('+50', bonusX, y);
                ctx.font = `bold ${Math.round(baseFontSize * 0.85)}px Arial, sans-serif`;
            }
        }

        // Tomorrow's tool text
        const tomorrowMechanic = getTomorrowsMechanic();
        const tomorrowTool = getFriendlyMechanicName(tomorrowMechanic);
        const bottomVertexY = centerY + hexRadius + textOffset;
        const tomorrowTextY = bottomVertexY + cellSize * 1.2;

        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#6496FF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `bold ${Math.round(baseFontSize * 1.1 * 0.75)}px Arial, sans-serif`;
        ctx.fillText(`Tomorrow: ${tomorrowTool}`, centerX, tomorrowTextY);
        ctx.restore();

        console.log('✅ Completion canvas rendered: 10-spoke radar with scores');
    }

    function createPostCanvasActions() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;

        // Remove existing container if it exists
        const existing = document.getElementById('post-canvas-actions');
        if (existing) existing.remove();

        // Create new container with text buttons
        const container = document.createElement('div');
        container.id = 'post-canvas-actions';
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.5s ease';
        container.innerHTML = `
            <div class="action-buttons">
                <button id="btn-competitions" class="action-button-text" style="padding: 6px 12px; font-size: 12px; background-color: #C0D6DF; color: black; border: 2px solid #000; border-radius: 16px; cursor: pointer; margin: 0 5px; width: 159px; height: 48px; min-width: 159px; min-height: 48px; max-width: 159px; max-height: 48px; box-shadow: 2px 2px 0px #000;">Competitions</button>
                <button id="btn-share" class="action-button-text" style="padding: 6px 12px; font-size: 12px; background-color: #C4F7A1; color: black; border: 2px solid #000; border-radius: 16px; cursor: pointer; margin: 0 5px; width: 159px; height: 48px; min-width: 159px; min-height: 48px; max-width: 159px; max-height: 48px; white-space: nowrap; box-shadow: 2px 2px 0px #000;">Share Score</button>
            </div>
        `;

        // Insert after canvas container
        const canvasContainer = canvas.parentElement;
        canvasContainer.parentElement.insertBefore(container, canvasContainer.nextSibling);

        // Animate in after a short delay
        setTimeout(() => {
            container.style.opacity = '1';
        }, 100);

        // Bind click handlers (only once)
        if (!bound) {
            document.addEventListener('click', handleActionClick);
            bound = true;
        }
    }

    function showSimpleNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            color: black;
            padding: 16px 24px;
            border: 2px solid black;
            border-radius: 8px;
            font-size: 14px;
            text-align: center;
            z-index: 100000;
            max-width: 80%;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Fade in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
        });

        // Auto-close after 2 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }

    async function captureCanvasImage() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            console.error('❌ Canvas not found for sharing');
            return null;
        }

        try {
            // Convert canvas to blob
            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, 'image/png');
            });

            return blob;
        } catch (error) {
            console.error('❌ Failed to capture canvas image:', error);
            return null;
        }
    }

    function detectSafariOrIOS() {
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
        return isIOS || isSafari;
    }

    async function copyCanvasToClipboard() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            alert('Failed to capture image. Please try again.');
            return;
        }

        try {
            // For Safari/iOS, use Web Share API or download as fallback
            if (detectSafariOrIOS()) {
                console.log('🍎 Safari/iOS detected, using Web Share API');

                const blob = await captureCanvasImage();
                if (!blob) {
                    alert('Failed to capture image. Please try again.');
                    return;
                }

                // Try Web Share API first (works great on iOS)
                if (navigator.share) {
                    const file = new File([blob], 'daily-shapes-result.png', { type: 'image/png' });

                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Daily Shapes Result',
                            text: 'Check out my Daily Shapes result!'
                        });
                        console.log('✅ Shared via Web Share API');
                        return;
                    } catch (shareError) {
                        if (shareError.name === 'AbortError') {
                            console.log('ℹ️ Share cancelled by user');
                            return;
                        }
                        console.warn('⚠️ Web Share failed, trying download fallback:', shareError);
                    }
                }

                // Fallback: Download the image
                console.log('💾 Using download fallback for Safari/iOS');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'daily-shapes-result.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showSimpleNotification('Image downloaded to your device');
                console.log('✅ Image downloaded successfully');
                return;
            }

            // For other browsers, use Clipboard API
            const blob = await captureCanvasImage();
            if (!blob) {
                alert('Failed to capture image. Please try again.');
                return;
            }

            if (navigator.clipboard && navigator.clipboard.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]);

                console.log('✅ Canvas image copied to clipboard');
                showSimpleNotification('Your results have been copied to your clipboard');
            } else {
                console.warn('⚠️ Clipboard API not supported');
                showSimpleNotification('Clipboard not supported. Try using a desktop browser.');
            }
        } catch (error) {
            console.error('❌ Failed to copy to clipboard:', error);
            showSimpleNotification('Failed to copy. Your browser may not support this feature.');
        }
    }

    function handleActionClick(e) {
        if (!isActive) return;

        // Handle clicks on button or child SVG elements
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'btn-competitions') {
            // Check authentication using multiple methods for reliability
            const isSignedIn = window.AuthService?.currentUser && !window.AuthService.isGuest;

            if (isSignedIn) {
                // Open the new competition modal
                if (window.openCompetitionModal) {
                    console.log('🏆 Opening competition modal from completion screen');
                    window.openCompetitionModal();
                } else if (window.openCompetitionsPopup) {
                    console.log('🏆 Opening competitions popup from completion screen');
                    window.openCompetitionsPopup();
                } else {
                    console.warn('Competition modal not available');
                }
            } else {
                // Show compact auth popup (same as menu options)
                if (window.showAuthenticationPopup) {
                    // Set pending action for after authentication  
                    localStorage.setItem('pendingUserAction', 'competitions');
                    window.showAuthenticationPopup();
                } else if (window.openAuthModal) {
                    window.openAuthModal('signup', "To play in or create a competition with mates, you'll need a free account");
                }
            }
        }

        if (target.id === 'btn-share') {
            console.log('📤 Share button clicked');
            copyCanvasToClipboard();
        }
    }

    function fadeOutSplitDisplay() {
        // Fade out all split display elements
        const splitDisplays = document.querySelectorAll('.split-display, .split-display-large, .attempt-result');
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');

        splitDisplays.forEach(element => {
            element.style.transition = 'opacity 0.8s ease';
            element.style.opacity = '0';
            setTimeout(() => {
                element.style.display = 'none';
            }, 800);
        });

        if (fixedPercentageArea) {
            fixedPercentageArea.style.transition = 'opacity 0.8s ease';
            fixedPercentageArea.style.opacity = '0';
            setTimeout(() => {
                fixedPercentageArea.style.visibility = 'hidden';
            }, 800);
        }
        
        console.log('🔢 Split display elements faded out');
    }
    
    function fadeOutProgressTracker() {
        // Fade out progress circles
        const progressCircles = document.getElementById('progressCircles');
        if (progressCircles) {
            console.log('🔵 Starting progress tracker fade out');
            progressCircles.style.transition = 'opacity 0.8s ease';
            progressCircles.style.opacity = '0';
            setTimeout(() => {
                progressCircles.style.display = 'none';
                console.log('🔵 Progress tracker fade completed');
            }, 800);
        } else {
            console.log('⚠️ Progress circles element not found');
        }
        
        console.log('🔵 Progress tracker fade out initiated');
    }
    
    function showCountdownAboveCanvas() {
        // Find a suitable location above the canvas
        const canvasContainer = document.querySelector('.canvas-container');
        const instructionArea = document.getElementById('instructionArea');
        
        if (instructionArea) {
            // Use the instruction area space for the countdown
            const countdownElement = document.createElement('div');
            countdownElement.id = 'completion-countdown';
            countdownElement.style.cssText = `
                text-align: center;
                font-weight: bold;
                font-size: 16px;
                color: #333;
                padding: 8px 0;
                visibility: visible;
            `;
            countdownElement.textContent = 'New shapes in --:--:--';
            
            // Replace instruction text with countdown
            instructionArea.style.visibility = 'visible';
            instructionArea.innerHTML = '';
            instructionArea.appendChild(countdownElement);
            
            console.log('⏰ Countdown displayed above canvas');
            return countdownElement;
        }
        
        return null;
    }
    
    function clearInstructionText() {
        const instructionText = document.getElementById('instructionText');
        if (instructionText) {
            instructionText.textContent = '';
            instructionText.style.fontWeight = 'normal';
        }
        console.log('📝 Previous instruction text cleared');
    }
    
    function restoreGameElements() {
        // When game is complete, split displays should remain hidden
        // Split displays should only show immediately after a cut, not in completion state
        console.log('🔄 Restoring game elements - skipping split displays (game complete)');

        // IMPORTANT: Do NOT restore split display elements when game is complete
        // Split displays should only be visible immediately after cuts, until completion loads

        // Only restore progress tracker if needed
        const progressCircles = document.getElementById('progressCircles');
        if (progressCircles) {
            progressCircles.style.transition = '';
            progressCircles.style.opacity = '';
            progressCircles.style.display = '';
        }

        console.log('🔄 Game elements restored (split displays kept hidden)');
    }

    return {
        show,
        hide,
        updateDisplay,
        isActive: () => isActive,
        createConfetti, // Export for use during gameplay
        clearConfetti // Export for cleanup
    };
})();

// Export to window
window.completeView = completeView;