// Daily Shapes v2.0 - Main Game Logic
// Cloud-based daily puzzle game with multi-cut mechanics

// === DATE OVERRIDE REMOVED ===
// Using actual current date and time - no manual overrides
const nowDate = new Date();
const currentLocalDate = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
console.log('📅 Using real current date (local timezone):', currentLocalDate, '| UTC:', nowDate.toISOString().split('T')[0]);

// Global variables
let canvas, ctx;
let currentGeoJSON = null;
let parsedShapes = [];
// Removed currentShapeUseDirectCoordinates tracking

// TARGETED DEBUG: Track currentAttempts changes
window.debugCurrentAttempts = function(location, action) {
    const attempts = window.currentAttempts || [];
    const localAttempts = (typeof currentAttempts !== 'undefined') ? currentAttempts : [];
    console.log(`🎯 ATTEMPTS DEBUG [${location}] ${action}:`);
    console.log(`   Window attempts: ${attempts.length}`, attempts.map((a, i) => `[${i}] ${a.leftPercentage?.toFixed(1)}/${a.rightPercentage?.toFixed(1)}`));
    console.log(`   Local attempts: ${localAttempts.length}`, localAttempts.map((a, i) => `[${i}] ${a.leftPercentage?.toFixed(1)}/${a.rightPercentage?.toFixed(1)}`));
    console.log(`   Shape: ${window.currentShapeNumber || '?'}, Attempt: ${window.currentAttemptNumber || '?'}, Total cuts: ${window.totalCutsMade || 0}`);
};

// Helper function to get the left-side cut shading color based on current shape (daily mode only)
function getDailyCutShadingColor() {
    // Only applies to daily mode - practice mode always uses dark grey (#61605f = 97, 96, 95)
    if (window.isPracticeMode) {
        return { r: 97, g: 96, b: 95 }; // Dark grey for practice mode
    }

    // Daily mode: always use teal #00798C
    return { r: 0, g: 121, b: 140 };  // #00798C - Teal
}

// Make it globally available for mechanics files
window.getDailyCutShadingColor = getDailyCutShadingColor;

// Game state variables
let gameState = 'initial'; // 'initial', 'playing', 'cutting', 'results', 'locked', 'finished', 'practise'
window.gameState = gameState; // Ensure window sync
let currentDate = null;
let currentDayNumber = 1;
let isInteractionEnabled = false; // Tracks when canvas interaction is allowed
window.isInteractionEnabled = isInteractionEnabled; // Ensure window sync

// Helper functions to ensure window sync
function setGameState(newState) {
    gameState = newState;
    window.gameState = newState;
    console.log('🔄 Game state updated:', newState);
}

function setInteractionEnabled(enabled, fromProgressionButton = false) {
    // PRACTICE MODE: Skip animation check entirely
    if (window.isPracticeMode) {
        isInteractionEnabled = enabled;
        window.isInteractionEnabled = enabled;
        console.log('🔄 Practice mode: Interaction enabled (bypassing animation check)');

        // Set initial instruction for practice mode when enabling interaction
        if (enabled && (gameState === 'cutting' || gameState === 'playing')) {
            const mechanicName = getPracticeMechanicName();
            const initialInstruction = getInitialInstruction(mechanicName);
            if (window.updateInstructionText && initialInstruction) {
                window.updateInstructionText(initialInstruction);
                console.log('🎮 Practice mode: Set initial instruction:', initialInstruction);
            }
        }
        return;
    }

    // DAILY MODE: Block re-enabling if we're in awaiting_choice state (unless from progression button)
    if (isDailyMode && enabled && gameState === 'awaiting_choice' && !fromProgressionButton) {
        console.log('🚫 DAILY MODE: Cannot re-enable interaction while awaiting user choice - use progression buttons');
        return;
    }

    // DAILY GAME: Keep existing animation check (unchanged)
    if (enabled && !isShapeAnimationComplete && (gameState === 'cutting' || gameState === 'playing')) {
        console.log('🚫 Interaction enable blocked - waiting for shape animation to complete');
        return;
    }

    isInteractionEnabled = enabled;
    window.isInteractionEnabled = enabled;
    console.log('🔄 Interaction enabled updated:', enabled, fromProgressionButton ? '(from progression button)' : '');

    // Set initial instruction for daily mode when enabling interaction for cutting
    if (enabled && (gameState === 'cutting' || gameState === 'playing')) {
        const mechanicName = getCurrentMechanicName();
        const initialInstruction = getInitialInstruction(mechanicName);
        if (window.updateInstructionText && initialInstruction) {
            window.updateInstructionText(initialInstruction);
            console.log('🎯 Daily mode: Set initial instruction:', initialInstruction);
        }
    }
}

// Note: Stats will be loaded after dailyStats is declared
let isPractiseMode = false; // Legacy - keep for backward compatibility (deprecated - use isPracticeMode)
let isPracticeMode = false; // Simple flag to track practice mode
let isDailyMode = false; // Flag to track if we're in actual daily game mode (not demo/practice)
let practiceShapes = []; // Store practice shapes
let currentPracticeShapeIndex = 0;
let isFirstPracticeCut = true; // Tracks if this is the first practice cut
let hasShownFinalInstructions = false; // Tracks if final instructions have been shown

// Practice Mode State - Completely isolated from daily game
const practiceMode = {
    isActive: false,
    currentShapeIndex: 0,
    availableShapes: [],
    currentShapePath: null,
    practiceCanvas: null,
    practiceCtx: null,
    practiceParsedShapes: [],
    practiceCurrentVector: null,
    practiceIsDrawingVector: false,
    practiceVectorStart: null,
    practiceVectorEnd: null,
    savedDailyGameState: null, // Store daily game state when entering practice
    cachedCanvasRect: null // Cache canvas rect during drag to prevent layout thrashing
};

// v3.0 - Single shape with multiple attempts
let currentAttempts = [];  // Array of attempt objects: {score, leftPercentage, rightPercentage, cutVector, splitAreas}
let attemptCount = 0;
let maxAttempts = 1;  // 1 attempt per shape
let finalLockedScore = null;
let shapeScreenshot = null; // Single screenshot for pulsing animation

// Animation variables for pulsing effect
let pulseCount = 0;
let pulseInterval = null;
let canvasRestoreData = null;

// Animation completion flag to prevent early interaction
let isShapeAnimationComplete = false;

// Stats tracking system
let dailyStats = {
    // Structure: { day1: { shape1: [score], shape2: [score], ..., shape10: [score] }, day2: {...}, ... }
};

// Initialize stats for all days (10 shapes per day, 1 attempt each)
for (let day = 1; day <= 7; day++) {
    const dayObj = {};
    for (let s = 1; s <= 10; s++) dayObj[`shape${s}`] = [];
    dailyStats[`day${day}`] = dayObj;
}

// Load saved stats on initialization (after dailyStats is declared)
const savedDemoStats = localStorage.getItem('demoGameDailyStats');
if (savedDemoStats) {
    try {
        const parsedStats = JSON.parse(savedDemoStats);
        Object.assign(dailyStats, parsedStats);
        console.log('📊 Loaded saved demo stats from localStorage');
    } catch (e) {
        console.warn('⚠️ Could not load saved demo stats:', e);
    }
}

// ================================
// LOADING ANIMATION SYSTEM
// ================================

let loadingAnimationActive = false;
let loadingAnimationFrame = null;
let hexagonProgress = 0;
let loadingText = "";

// Loading messages array
const loadingMessages = [
    "Give us this day our Daily Shapes!",
    "Things are taking Shape!",
    "Shape up or ship out!",
    "What do we want? SHAPES!",
    "Shape that booty!",
    "Let there be Shapes!"
];

function showLoadingAnimation() {
    if (!canvas || !ctx) return;

    loadingAnimationActive = true;
    hexagonProgress = 0;

    // Select random loading message
    loadingText = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

    // Start animation loop
    animateLoading();
}

function hideLoadingAnimation() {
    // Stop immediate loading animation if it exists
    if (window.stopImmediateLoadingAnimation) {
        window.stopImmediateLoadingAnimation();
    }

    // Stop main loading animation
    loadingAnimationActive = false;
    if (loadingAnimationFrame) {
        cancelAnimationFrame(loadingAnimationFrame);
        loadingAnimationFrame = null;
    }

    // Clear canvas and draw initial grid
    if (canvas && ctx) {
        drawGrid();
    }
}

function animateLoading() {
    if (!loadingAnimationActive) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hexagon animation
    drawLoadingHexagon();

    // Draw loading text
    drawLoadingText();

    // Update progress (slow animation - 3 second cycle)
    hexagonProgress += 0.008; // ~3 seconds per cycle
    if (hexagonProgress > 1) {
        hexagonProgress = 0;
    }

    // Continue animation
    loadingAnimationFrame = requestAnimationFrame(animateLoading);
}

function drawLoadingHexagon() {
    const logicalSize = 380;
    const centerX = logicalSize / 2;
    const centerY = logicalSize / 2 - 50; // Offset up to leave space for text
    const radius = Math.min(logicalSize, logicalSize) * 0.1; // Responsive size

    // Calculate how much of the hexagon to draw
    const totalPoints = 6;
    const currentPoint = hexagonProgress * totalPoints * 2; // Draw and erase cycle

    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Translate to center, rotate, then draw
    ctx.translate(centerX, centerY);
    ctx.rotate(hexagonProgress * Math.PI * 2); // Rotate based on progress

    // Calculate hexagon points relative to origin (0, 0)
    const angleStep = (Math.PI * 2) / 6;
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = i * angleStep - Math.PI / 2; // Start from top
        points.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });
    }

    ctx.beginPath();

    if (currentPoint <= totalPoints) {
        // Drawing phase - clockwise
        const segments = currentPoint;

        // Draw complete segments
        for (let i = 0; i < Math.floor(segments) && i < 6; i++) {
            const startPoint = points[i];
            const endPoint = points[(i + 1) % 6];

            if (i === 0) {
                ctx.moveTo(startPoint.x, startPoint.y);
            }
            ctx.lineTo(endPoint.x, endPoint.y);
        }

        // Draw partial segment
        const partialSegment = segments % 1;
        if (partialSegment > 0 && Math.floor(segments) < 6) {
            const i = Math.floor(segments);
            const startPoint = points[i];
            const endPoint = points[(i + 1) % 6];

            const partialX = startPoint.x + (endPoint.x - startPoint.x) * partialSegment;
            const partialY = startPoint.y + (endPoint.y - startPoint.y) * partialSegment;

            if (Math.floor(segments) === 0) {
                ctx.moveTo(startPoint.x, startPoint.y);
            }
            ctx.lineTo(partialX, partialY);
        }
    } else {
        // Undrawing phase - clockwise undraw (segment 1 disappears first, then 2, then 3, etc.)
        const undrawProgress = currentPoint - totalPoints; // 0 to 6
        const segmentsToSkip = Math.floor(undrawProgress); // Complete segments to skip from beginning
        const partialUndraw = undrawProgress % 1; // Partial progress on current segment being removed

        // Calculate which segments to draw (skip removed ones from the beginning)
        const startSegment = segmentsToSkip; // Which segment index to start drawing from
        const visibleSegments = 6 - segmentsToSkip; // How many segments remain

        if (visibleSegments > 0) {
            let hasDrawnAny = false;

            // Draw remaining complete segments (starting from startSegment)
            for (let i = startSegment; i < 6; i++) {
                const startPoint = points[i];
                const endPoint = points[(i + 1) % 6];

                if (!hasDrawnAny) {
                    ctx.moveTo(startPoint.x, startPoint.y);
                    hasDrawnAny = true;
                }
                ctx.lineTo(endPoint.x, endPoint.y);
            }

            // Handle partial undraw of the current segment being removed
            if (partialUndraw > 0 && startSegment > 0) {
                // Draw the partial segment that's being undone (from start toward end)
                const i = startSegment - 1;
                const startPoint = points[i];
                const endPoint = points[(i + 1) % 6];

                // Calculate how much of this segment to show (shrinking from start to end)
                const visibleAmount = 1 - partialUndraw;

                if (visibleAmount > 0) {
                    // Draw from startPoint partway toward endPoint
                    const partialX = startPoint.x + (endPoint.x - startPoint.x) * visibleAmount;
                    const partialY = startPoint.y + (endPoint.y - startPoint.y) * visibleAmount;

                    if (!hasDrawnAny) {
                        ctx.moveTo(startPoint.x, startPoint.y);
                        hasDrawnAny = true;
                    } else {
                        // Connect from previous segments
                        ctx.moveTo(startPoint.x, startPoint.y);
                    }
                    ctx.lineTo(partialX, partialY);
                }
            }
        }
    }

    ctx.stroke();
    ctx.restore();
}


function drawLoadingText() {
    const logicalSize = 380;
    const centerX = logicalSize / 2;
    const centerY = logicalSize / 2 + 100; // Below hexagon

    ctx.save();

    // Match welcome content text styling (responsive font size)
    const baseFontSize = Math.min(logicalSize, logicalSize) * 0.04;
    const fontSize = Math.max(16, Math.min(32, baseFontSize));

    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word wrap for smaller screens
    const maxWidth = logicalSize * 0.8;
    wrapText(ctx, loadingText, centerX, centerY, maxWidth, fontSize * 1.2);

    ctx.restore();
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, currentY);
}

// Daily reset functionality
let lastResetDate = null;

function checkDailyReset() {
    const now = new Date();
    const today = now.toDateString(); // Gets date in format like "Wed Oct 25 2023"
    
    if (lastResetDate !== today) {
        console.log('🌅 New day detected - resetting daily stats');
        resetDailyStats();
        lastResetDate = today;
        
        // Save the reset date to localStorage
        localStorage.setItem('lastResetDate', today);
        
        // Clear old game states from previous days
        cleanupOldGameStates(today);
    }
}

// Simple game state for minimal compatibility
let dailyGameState = null;
let isRestoringState = false;

function initializeDailyGameState() {
    dailyGameState = {
        isGameStarted: false,
        currentShape: 1,
        currentAttempt: 1,
        cuts: []
    };
}

function saveVisualState(cutVector, leftPct, rightPct) {
    if (!dailyGameState || isRestoringState) return;
    
    try {
        // Save cut vector
        if (cutVector) {
            dailyGameState.lastRenderedCut = cutVector;
        }
        
        // Save percentage display
        if (leftPct !== undefined && rightPct !== undefined) {
            dailyGameState.lastPercentageDisplay = {
                left: leftPct,
                right: rightPct
            };
        }
        
        // CRITICAL: Skip canvas state capture to prevent visual persistence bugs
        // Canvas state capture was causing shaded cut results to persist across attempts
        if (canvas && (gameState === 'cutting' || gameState === 'playing')) {
            // Only capture unshaded canvas state, never colored results
            dailyGameState.lastShapeColors = canvas.toDataURL();
            console.log('📸 Visual state: Captured unshaded canvas state');
        } else {
            // Skip capture during result phases to prevent shading persistence
            dailyGameState.lastShapeColors = null;
            console.log('🚫 Visual state: Skipped canvas capture during results phase');
        }
        
        // Refresh protection disabled
    } catch (error) {
        console.error('❌ Failed to save visual state:', error);
    }
}

function saveCutResult(shapeIndex, attemptNum, cutVector, leftPct, rightPct, score, commentary) {
    if (!dailyGameState || isRestoringState) return;
    
    const cutData = {
        shapeIndex: shapeIndex,
        attemptNumber: attemptNum,
        cutVector: cutVector,
        leftPercentage: leftPct,
        rightPercentage: rightPct,
        score: score,
        commentary: commentary,
        timestamp: Date.now()
    };
    
    // Save additional data for rotating square mechanic
    if (window.currentSquareData) {
        cutData.squareData = {
            center: window.currentSquareData.center,
            size: window.currentSquareData.size,
            rotation: window.currentSquareData.rotation
        };
        console.log('💾 Saved rotating square data:', cutData.squareData);
    }
    
    // Notify game flow enforcer of cut completion
    if (window.GameFlowEnforcer && window.GameFlowEnforcer.isFlowActive()) {
        window.GameFlowEnforcer.onCutCompleted(cutData);
    }
    
    // Save to legacy system for compatibility
    dailyGameState.cuts.push(cutData);
    saveVisualState(cutVector, leftPct, rightPct);
    
    // Simple refresh system (if available)
    if (window.SimpleGameRefresh && window.SimpleGameRefresh.save) {
        window.SimpleGameRefresh.save();
    }
}

function getCurrentLocalDate() {
    // Use local date instead of UTC
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function checkForExistingGameState() {
    const today = getCurrentLocalDate();
    const stateKey = `dailyGameState_${today}`;
    console.log('🔍 Checking for saved state with key:', stateKey);
    
    const savedState = localStorage.getItem(stateKey);
    console.log('🔍 Found saved state:', !!savedState);
    
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            console.log('🔄 Parsed existing game state:', state);
            console.log('🔍 State details - isGameStarted:', state.isGameStarted, 'isGameComplete:', state.isGameComplete, 'dayComplete:', state.dayComplete);
            
            if (state.isGameStarted) {
                dailyGameState = state;

                if (state.isGameComplete || state.dayComplete) {
                    console.log('🏁 Game already completed today - showing completion view');

                    // Block any new gameplay
                    gameState = 'finished';
                    isInteractionEnabled = false;

                    // Hide Play button permanently for completed games
                    const playBtn = document.getElementById('playBtn');
                    if (playBtn) {
                        playBtn.style.display = 'none';
                        console.log('🚫 Play button hidden - game already completed');
                    }

                    // Show completion view using SAVED finalStats
                    setTimeout(() => {
                        if (window.completeView && state.finalStats) {
                            // Use saved finalStats to build completion model
                            const completionModel = buildCompletionModelFromFinalStats(state.finalStats);
                            window.completeView.show(completionModel);
                            console.log('✅ Completion view shown with saved finalStats');
                        } else {
                            // Fallback to live data if finalStats not available
                            const currentDayStats = getDayStats(currentDay);
                            const completionModel = buildCompletionModel(currentDayStats);
                            window.completeView.show(completionModel);
                            console.warn('⚠️ Using fallback live data - finalStats not available');
                        }

                        // completeView handles the score display
                    }, 500);

                    return 'completed';
                } else {
                    console.log('▶️ Game in progress - will restore');
                    return 'in_progress';
                }
            } else {
                console.log('⚠️ State found but game not started');
            }
        } catch (error) {
            console.error('❌ Failed to parse saved state:', error);
            localStorage.removeItem(stateKey);
        }
    } else {
        console.log('🆕 No saved state - new game');
    }
    
    return 'new';
}

function cleanupOldGameStates(currentDate) {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dailyGameState_') && !key.includes(currentDate)) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Removed old game state:', key);
    });
}

async function restoreInProgressGame(savedState) {
    console.log('🔄 Restoring in-progress game...');
    console.log('🔄 Saved state to restore:', savedState);
    isRestoringState = true;
    
    try {
        // Hide initial UI
        console.log('🔄 Step 1: Hiding initial UI...');
        hideInitialGameUI();
        
        // Set current variables
        console.log('🔄 Step 2: Setting variables...');
        currentShapeNumber = savedState.currentShape;
        currentAttemptNumber = savedState.currentAttempt;
        currentDay = savedState.mechanic;
        window.currentDay = currentDay;  // Update global for mechanics
        console.log('🔄 Variables set - Shape:', currentShapeNumber, 'Attempt:', currentAttemptNumber, 'Day:', currentDay);
        
        // Load the demo day and mechanic
        console.log('🔄 Step 3: Loading demo day...');
        await loadDemoDay(savedState.mechanic);
        console.log('🔄 Demo day loaded successfully');
        
        // Load current shape
        if (savedState.currentShapeGeoJSON) {
            currentGeoJSON = savedState.currentShapeGeoJSON;
            const parseResult = parseGeometry(currentGeoJSON);
            parsedShapes = parseResult.shapes;
        } else {
            await loadDemoShape(savedState.mechanic, savedState.currentShape);
        }
        
        // Restore visual state for the current position
        const currentShapeCuts = savedState.cuts.filter(cut => 
            cut.shapeIndex === savedState.currentShape
        );
        
        if (currentShapeCuts.length > 0) {
            // Restore the last cut for this shape
            const lastCut = currentShapeCuts[currentShapeCuts.length - 1];
            await restoreCutVisual(lastCut);
            
            // Update UI with percentages using fixed area
            showAttemptResult(lastCut.leftPercentage, lastCut.rightPercentage);
            
            // Show appropriate button using normal game flow (no restoration tricks)
            setTimeout(() => {
                if (currentShapeCuts.length >= 1) {
                    // Cut completed on this shape
                    if (savedState.currentShape < 10) {
                        createProgressionButton();
                    } else {
                        // Day complete
                        setTimeout(() => showDayStatsPopup(), 1000);
                    }
                }
            }, 150); // Brief delay for smooth restoration
        } else {
            // No cuts yet for this shape, ready for cutting
            gameState = 'cutting';
            isInteractionEnabled = true;
        }
        
        // Update progress UI
        updateProgressUI();
        
        // Update stats
        restoreStatsFromCuts(savedState.cuts);
        
    } catch (error) {
        console.error('❌ Failed to restore game state:', error);
        // Fall back to new game
        initializeDemoGame();
    } finally {
        isRestoringState = false;
    }
}

async function restoreCutVisual(cutData) {
    if (!cutData) return;
    
    try {
        // Handle rotating square mechanic restoration
        if (cutData.squareData && window.RotatingSquareMechanic) {
            console.log('🔄 Restoring rotating square cut:', cutData.squareData);
            
            // Restore the square state to the mechanic
            window.RotatingSquareMechanic.currentSquare = cutData.squareData;
            
            // Calculate areas using the restored square data
            const areaResults = window.RotatingSquareMechanic.calculateAreas();
            
            // Render the cut result
            window.RotatingSquareMechanic.renderCutResult(areaResults);
            
            console.log('✅ Rotating square cut restored successfully');
            
        } else if (cutData.cutVector) {
            // Handle vector-based mechanics restoration
            console.log('🔄 Restoring vector-based cut:', cutData.cutVector);
            
            // Render the cut with colors
            const { leftArea, rightArea } = await performCut(cutData.cutVector);
            
            // Skip animations - go straight to result
            renderColoredCutResult(leftArea, rightArea);
            
            console.log('✅ Vector-based cut restored successfully');
        } else {
            console.warn('⚠️ No valid cut data to restore:', cutData);
            return;
        }
        
        // Show commentary (works for both types)
        if (cutData.commentary) {
            showCommentary(cutData.commentary, false);
        }
        
    } catch (error) {
        console.error('❌ Failed to restore cut visual:', error);
    }
}

function restoreStatsFromCuts(cuts) {
    if (!cuts || cuts.length === 0) return;
    
    // Clear current stats
    for (let day = 1; day <= 7; day++) {
        dailyStats[`day${day}`] = {
            shape1: [],
            shape2: [],
            shape3: []
        };
    }
    
    // Rebuild stats from cuts
    cuts.forEach(cut => {
        const dayKey = `day${currentDay}`;
        const shapeKey = `shape${cut.shapeIndex}`;
        
        if (!dailyStats[dayKey][shapeKey]) {
            dailyStats[dayKey][shapeKey] = [];
        }
        
        dailyStats[dayKey][shapeKey].push({
            score: cut.score,
            leftPercentage: cut.leftPercentage,
            rightPercentage: cut.rightPercentage
        });
    });
    
    console.log('📊 Stats restored from cuts');
}

function showCompletedGameState(savedState) {
    console.log('🏁 Showing completed game state');
    
    // Hide initial UI
    hideInitialGameUI();
    
    // Show completion screen with countdown
    showCompletionScreen(savedState);
    
    // Show stats if requested
    if (savedState.finalStats) {
        dailyGameState.finalStats = savedState.finalStats;
    }
}

function showCompletionScreen(savedState) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    // Show countdown timer
    showCountdownToMidnight();
    
    // Create completion buttons
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `
            <div class="completion-buttons" style="text-align: center; margin-top: 20px;">
                <button onclick="viewTodayStats()" style="padding: 12px 24px; margin: 10px; background: #6496ff; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    View Today's Stats
                </button>
            </div>
        `;
    }
}

function hideInitialGameUI() {
    // Hide welcome overlay
    const welcomeOverlay = document.getElementById('welcomeOverlay');
    if (welcomeOverlay) {
        welcomeOverlay.style.visibility = 'hidden';
    }
    
    // Hide play button
    const initialPlayButton = document.getElementById('initialPlayButton');
    if (initialPlayButton) {
        initialPlayButton.style.visibility = 'hidden';
    }
}

function viewTodayStats() {
    if (dailyGameState && dailyGameState.finalStats) {
        showDayStatsContent(currentDay);
        document.getElementById('statsOverlay').style.display = 'block';
    }
}

// Make viewTodayStats global for button onclick
window.viewTodayStats = viewTodayStats;

// Guest user state management
function getOrCreateGuestId() {
    let guestId = localStorage.getItem('guestId');
    if (!guestId) {
        guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('guestId', guestId);
    }
    return guestId;
}

function saveGuestState(gameState) {
    const guestId = getOrCreateGuestId();
    const currentDate = getCurrentLocalDate();
    const guestKey = `dailyGameState_guest_${guestId}_${currentDate}`;
    localStorage.setItem(guestKey, JSON.stringify(gameState));
}

function restoreGuestState() {
    const guestId = getOrCreateGuestId();
    const currentDate = getCurrentLocalDate();
    const guestKey = `dailyGameState_guest_${guestId}_${currentDate}`;
    return localStorage.getItem(guestKey);
}

function checkPracticeAccess() {
    const supabaseToken = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
    if (!supabaseToken) {
        // Store user's original intent
        localStorage.setItem('pendingUserAction', 'practice');
        // Use consistent auth popup (same as account/competition)
        showAuthenticationPopup();
        return false;
    }
    return true;
}

function showCountdownToMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const updateCountdown = () => {
        const now = new Date();
        const diff = tomorrow - now;
        
        if (diff <= 0) {
            // Midnight reached - trigger reset
            checkDailyReset();
            location.reload();
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const countdownText = `Next puzzle in ${hours}h ${minutes}m ${seconds}s`;
        
        // Draw countdown on canvas
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText(countdownText, 190, 190); // Center of 380x380 logical canvas
        
        ctx.restore();
    };
    
    // Update every second
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function resetDailyStats() {
    // Clear all stats for all days
    for (let day = 1; day <= 7; day++) {
        dailyStats[`day${day}`] = {
            shape1: [],
            shape2: [],
            shape3: []
        };
    }
    // Save the reset stats to localStorage
    localStorage.setItem('demoGameDailyStats', JSON.stringify(dailyStats));
    console.log('📊 Daily stats reset complete');
}

function initializeDailyReset() {
    // Check for stored reset date
    const storedResetDate = localStorage.getItem('lastResetDate');
    const today = new Date().toDateString();
    
    if (storedResetDate !== today) {
        console.log('🌅 Initializing daily reset - new day detected');
        resetDailyStats();
        lastResetDate = today;
        localStorage.setItem('lastResetDate', today);
    } else {
        lastResetDate = storedResetDate;
        console.log('📊 Using existing daily stats (same day)');
    }
    
    // Set up interval to check for daily reset every minute
    setInterval(checkDailyReset, 60000); // Check every minute
}

// Legacy variables (kept for compatibility with old functions)
let gameResults = [];
let isReplayMode = false;
let replayShapeIndex = 1;
let currentShapeIndex = 1; // For legacy function compatibility
let cutsPerformed = 0;
let firstCutVector = null;
let pendingQuadrants = [];
let maxCutsForShape3 = 2;

// Vector cutting variables (preserve existing functionality)
let isDrawingVector = false;
let vectorStart = null;
let vectorEnd = null;
let currentVector = null;
let vectorCutActive = false;
let dragDistance = 0;

// Loading popup variables (compact version)
let loadingPopupElement = null;
let splashStartTime = null;

// First visit tracking

// Game State Persistence - localStorage keys for structured refresh recovery
const STORAGE_KEYS = {
    // Session validation
    lastPlayDate: 'dailyShapes_lastPlayDate',
    sessionTimestamp: 'dailyShapes_sessionTimestamp',
    
    // Game phase tracking
    gamePhase: 'dailyShapes_gamePhase',  // 'pre-play', 'during-play', 'post-play'
    playStarted: 'dailyShapes_playStarted',
    isFinished: 'dailyShapes_isFinished',
    
    // Try tracking
    currentTryNumber: 'dailyShapes_currentTryNumber',  // 1, 2, or 3
    hasTriedToday: 'dailyShapes_hasTriedToday',
    
    // Cut data for each attempt
    tryAttempts: 'dailyShapes_tryAttempts',  // Array of attempt data
    currentCutData: 'dailyShapes_currentCutData',  // Current uncommitted cut
    
    // UI state
    canvasState: 'dailyShapes_canvasState',
    displayedPercentages: 'dailyShapes_displayedPercentages',
    
    // Final state
    finalCommittedData: 'dailyShapes_finalCommittedData',
    
    // Legacy keys (for compatibility)
    gameState: 'dailyShapes_gameState',
    attemptCount: 'dailyShapes_attemptCount',
    currentAttempts: 'dailyShapes_currentAttempts',
    finalScoreData: 'dailyShapes_finalScoreData',
    currentCutState: 'dailyShapes_currentCutState'
};

// Testing and debug variables
let testingMode = false;

// Fallback embedded shape for testing when files can't be loaded
const fallbackShape = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [100, 100],
                [250, 100],
                [250, 200],
                [175, 250],
                [100, 200],
                [100, 100]
            ]]
        }
    }]
};


// Demo Game Mechanics System
let currentMechanic = null;
let currentDay = 1;  // Track selected day (1-7) - Will be set based on actual date
window.currentDay = currentDay;  // Make it globally accessible for mechanics

// Global helper function for practice mode to update the local currentMechanic variable
window.setCurrentMechanic = function(mechanic) {
    currentMechanic = mechanic;
    window.currentMechanic = mechanic;
    console.log(`🔧 GLOBAL: Updated both local and window.currentMechanic to:`, mechanic?.name);
};
let currentShapeNumber = 1;  // Track current shape (1-10)
let currentDemoAttempt = 0;  // Track attempt within shape (will be incremented after each cut)
let currentAttemptNumber = 1;  // Track current attempt number (always 1 in 10x1 mode)
let isDemoMode = true;  // True when in demo mode (not practice mode)
window.isDemoMode = isDemoMode;  // Make it globally accessible for mechanics

// BULLETPROOF REFRESH: Expose game state variables on window object
window.currentShapeNumber = currentShapeNumber;
window.currentAttemptNumber = currentAttemptNumber;

// BULLETPROOF REFRESH: Sync function to update local variables after reset
window.syncBulletproofVariables = function(shapeNumber, attemptNumber) {
    console.log('🔄 SYNC: Updating main.js local variables');
    console.log('   From:', { currentShapeNumber, currentAttemptNumber, totalCutsMade, cutsMadeThisShape });
    console.log('   To:', { shapeNumber, attemptNumber });
    
    currentShapeNumber = shapeNumber;
    currentAttemptNumber = attemptNumber;
    window.currentShapeNumber = currentShapeNumber;
    window.currentAttemptNumber = currentAttemptNumber;
    
    // CRITICAL: Also sync cut counters from window variables if they exist
    if (typeof window.totalCutsMade === 'number') {
        totalCutsMade = window.totalCutsMade;
        console.log('🔄 SYNC: Restored totalCutsMade to', totalCutsMade);
    }
    if (typeof window.cutsMadeThisShape === 'number') {
        cutsMadeThisShape = window.cutsMadeThisShape;
        console.log('🔄 SYNC: Restored cutsMadeThisShape to', cutsMadeThisShape);
    }
    
    console.log('✅ SYNC: All variables synchronized');
};

// Day to mechanic mapping
const dayMechanics = {
    1: 'DefaultWithUndoMechanic',      // Monday
    2: 'HorizontalOnlyMechanic',       // Tuesday
    3: 'CircleCutMechanic',            // Wednesday
    4: 'DiagonalAscendingMechanic',    // Thursday
    5: 'ThreePointTriangleMechanic',   // Friday
    6: 'RotatingSquareMechanic',       // Saturday
    7: 'RotatingShapeVectorMechanic'   // Sunday
};

// Demo Game State Management
// Button restoration functions removed - now using fixed areas for consistent positioning

// User-friendly mechanic names mapping
function getUserFriendlyMechanicName(mechanicName) {
    const friendlyNames = {
        'DefaultWithUndoMechanic': 'Straight Line Cutter',
        'HorizontalOnlyMechanic': 'Locked Horizontal Cutter',
        'DiagonalAscendingMechanic': 'Locked Diagonal Cutter',
        'CircleCutMechanic': 'Circular Cutter',
        'ThreePointTriangleMechanic': 'Triangular Cutter',
        'RotatingSquareMechanic': 'Square Cutter',
        'RotatingShapeVectorMechanic': 'Straight Line Cutter (Rotating Shape)'
    };
    
    return friendlyNames[mechanicName] || mechanicName;
}


// Hide today's challenge text
function hideTodaysChallenge() {
    const mechanicInfo = document.getElementById('mechanicInfo');
    if (mechanicInfo) {
        mechanicInfo.style.visibility = 'hidden';
    }
}

// Show instruction area with initial instruction
function showInstructionArea() {
    const instructionArea = document.getElementById('instructionArea');
    const instructionText = document.getElementById('instructionText');
    
    if (instructionArea && instructionText) {
        // Clear any existing text immediately
        instructionText.textContent = '';
        instructionText.style.fontWeight = '';
        instructionText.style.textAlign = '';
        
        // Show the instruction area
        instructionArea.style.display = 'flex';
        instructionArea.style.visibility = 'visible';
        console.log('📝 Instruction area display set to flex and visibility to visible');
        
        // Set initial instruction immediately instead of loading message
        const mechanicName = getCurrentMechanicName();
        const initialInstruction = getInitialInstruction(mechanicName);
        if (initialInstruction) {
            updateInstructionText(initialInstruction);
            console.log('✅ Instruction area shown with initial instruction:', initialInstruction);
        } else {
            console.log('⚠️ No initial instruction available for mechanic:', mechanicName);
        }
    }
}

// Detect if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Get device-specific cancellation instruction
function getCancellationInstruction() {
    return isMobileDevice() 
        ? 'tap with another finger to cancel'
        : 'right-click to cancel';
}

// Get device-specific initial action instruction
function getInitialActionInstruction() {
    return isMobileDevice() ? 'Tap and hold' : 'Click and hold';
}

// Get device-specific tap instruction (for triangle mechanic)
function getTapInstruction() {
    return isMobileDevice() ? 'Tap' : 'Click';
}

// Get initial instruction for each mechanic
function getInitialInstruction(mechanicName) {
    const isMobile = isMobileDevice();
    const clickTapAction = isMobile ? 'Tap and hold' : 'Click and hold';
    const tapAction = isMobile ? 'Tap' : 'Click';

    const instructions = {
        'DefaultWithUndoMechanic': `${clickTapAction} to start cutting`,           // Monday
        'HorizontalOnlyMechanic': `${clickTapAction} to start cutting`,           // Tuesday
        'CircleCutMechanic': `${clickTapAction} to start cutting`,                // Thursday
        'DiagonalAscendingMechanic': `${clickTapAction} to start cutting`,        // Wednesday
        'ThreePointTriangleMechanic': `${clickTapAction} to start cutting`,       // Friday
        'RotatingSquareMechanic': `${clickTapAction} to start cutting`,           // Saturday
        'RotatingShapeVectorMechanic': `${clickTapAction} to start cutting`       // Sunday
    };

    return instructions[mechanicName] || `${clickTapAction} to start cutting`;
}

// Get dynamic instruction based on interaction state
function getDynamicInstruction(mechanicName, state) {
    const isMobile = isMobileDevice();
    const clickTapAction = isMobile ? 'Tap and hold' : 'Click and hold';
    const tapAction = isMobile ? 'Tap' : 'Click';
    const cancelInstruction = isMobile ? 'Tap with another finger' : 'Right-click';
    const dragInstruction = `Drag & release to cut. ${cancelInstruction} to cancel.`;

    const dynamicInstructions = {
        'DefaultWithUndoMechanic': {
            'initial': `${clickTapAction} to start cutting`,
            'first_touch': dragInstruction,
            'completed': `${clickTapAction} to start cutting`
        },
        'HorizontalOnlyMechanic': {
            'initial': `${clickTapAction} to start cutting`,
            'first_touch': dragInstruction,
            'completed': `${clickTapAction} to start cutting`
        },
        'CircleCutMechanic': {
            'initial': `${clickTapAction} to start cutting`,
            'first_touch': dragInstruction,
            'completed': `${clickTapAction} to start cutting`
        },
        'DiagonalAscendingMechanic': {
            'initial': `${clickTapAction} to start cutting`,
            'first_touch': dragInstruction,
            'completed': `${clickTapAction} to start cutting`
        },
        'ThreePointTriangleMechanic': {
            'initial': `${clickTapAction} to start cutting`,
            'first_touch': dragInstruction,
            'completed': `${clickTapAction} to start cutting`
        },
        'RotatingSquareMechanic': {
            'initial': `${clickTapAction} to start cutting`,
            'first_touch': dragInstruction,
            'completed': `${clickTapAction} to start cutting`
        },
        'RotatingShapeVectorMechanic': {
            'initial': `${clickTapAction} to start cutting`,
            'first_touch': dragInstruction,
            'completed': `${clickTapAction} to start cutting`
        }
    };

    const mechanicInstructions = dynamicInstructions[mechanicName];
    if (mechanicInstructions && mechanicInstructions[state]) {
        return mechanicInstructions[state];
    }
    
    // Default fallback with device responsiveness
    // In practice mode, avoid "Complete your cut" - return to initial instruction instead
    if (state === 'initial') {
        return `${holdAction} to start cutting (${getCancellationInstruction()})`;
    } else if (window.isPracticeMode && state === 'completed') {
        return `${holdAction} to start cutting (${getCancellationInstruction()})`;
    } else {
        return state === 'completed' ? `${holdAction} to start cutting` : 'Complete your cut';
    }
}

// Update instruction text during gameplay
function updateInstructionText(newInstruction, isBold = false) {
    // SIMPLIFIED APPROACH: Only suppress instructions in very specific cases
    // This ensures instructions always work unless absolutely necessary to suppress them

    const instructionText = document.getElementById('instructionText');
    if (!instructionText) {
        console.warn('⚠️ Instruction text element not found');
        return;
    }

    // NEVER suppress instructions - removed all suppression logic to ensure instructions always appear

    // ALWAYS show the instruction
    instructionText.textContent = newInstruction;

    // Apply styling
    if (isBold) {
        instructionText.style.fontWeight = 'bold';
        instructionText.style.textAlign = 'center';
    } else {
        instructionText.style.fontWeight = 'normal';
        instructionText.style.textAlign = 'center';
    }

    // FORCE visibility - ensure instructions are never hidden
    instructionText.style.opacity = '1';
    instructionText.style.display = 'block';
    instructionText.style.visibility = 'visible';

    const mode = window.isPracticeMode ? 'Practice' : 'Daily';
    console.log(`📝 ${mode} mode instruction updated:`, newInstruction, 'isBold:', isBold);
}

// Export functions for mechanics and practice mode to use
window.updateInstructionText = updateInstructionText;
window.getInitialInstruction = getInitialInstruction;
window.showInstructionArea = showInstructionArea;

// Reset instructions to initial state for current mechanic
function resetInstructionsToInitial() {
    const mechanicName = isPracticeMode ? getPracticeMechanicName() : getCurrentMechanicName();
    const initialInstruction = getInitialInstruction(mechanicName);
    updateInstructionText(initialInstruction);
}

// Export reset function for mechanics to use
window.resetInstructionsToInitial = resetInstructionsToInitial;

// Get current mechanic name (shortened for database)
function getCurrentMechanicName() {
    const mechanicNames = {
        1: 'DefaultWithUndoMechanic',      // Monday
        2: 'HorizontalOnlyMechanic',       // Tuesday
        3: 'DiagonalAscendingMechanic',    // Wednesday
        4: 'CircleCutMechanic',            // Thursday
        5: 'ThreePointTriangleMechanic',   // Friday
        6: 'RotatingSquareMechanic',       // Saturday
        7: 'RotatingShapeVectorMechanic'   // Sunday
    };

    return mechanicNames[currentDay] || 'DefaultWithUndoMechanic';
}

// Get practice mode mechanic name (same as daily but Sunday uses Monday's mechanic)
function getPracticeMechanicName() {
    const mechanicNames = {
        1: 'DefaultWithUndoMechanic',      // Monday
        2: 'HorizontalOnlyMechanic',       // Tuesday
        3: 'CircleCutMechanic',            // Wednesday
        4: 'DiagonalAscendingMechanic',    // Thursday
        5: 'ThreePointTriangleMechanic',   // Friday
        6: 'RotatingSquareMechanic',       // Saturday
        7: 'DefaultWithUndoMechanic'       // Sunday uses Monday's mechanic (not rotating_vector)
    };
    
    return mechanicNames[currentDay] || 'DefaultWithUndoMechanic';
}

function saveDemoGameState() {
    try {
        const savedState = {
            currentDay: currentDay,
            currentShapeNumber: currentShapeNumber,
            currentAttemptNumber: currentAttemptNumber,
            
            // Game progress tracking
            gameStarted: gameState !== 'initial',
            gameStateValue: gameState,
            isInteractionEnabled: isInteractionEnabled,
            
            // Cut tracking
            totalCutsMade: window.totalCutsMade || 0,
            cutsMadeThisShape: window.cutsMadeThisShape || 0,
            currentAttempts: currentAttempts || [],
            
            // Current mechanic
            mechanicName: currentMechanic?.name || null,
            
            // Button state removed - using fixed areas instead
            
            // Canvas/visual state
            canvasDataURL: null, // Will be set below if canvas exists
            
            // Percentage display values (get from last attempt if available)
            leftPercentage: currentAttempts.length > 0 ? 
                currentAttempts[currentAttempts.length - 1].leftPercentage : 
                (document.getElementById('leftPercentage')?.textContent || null),
            rightPercentage: currentAttempts.length > 0 ? 
                currentAttempts[currentAttempts.length - 1].rightPercentage : 
                (document.getElementById('rightPercentage')?.textContent || null),
            
            // UI state
            hasProgressButton: !!document.getElementById('progressionButton'),
            welcomeScreenVisible: !!document.querySelector('.welcome-overlay:not(.hidden)'),
            
            // Completion tracking
            dayComplete: dailyGameState?.dayComplete || false,
            isGameComplete: dailyGameState?.isGameComplete || false,
            completedAt: dailyGameState?.completedAt || null,
            finalStats: dailyGameState?.finalStats || null,
            
            timestamp: Date.now()
        };
        
        // Capture canvas state if available
        const canvasElement = document.getElementById('geoCanvas');
        if (canvasElement && parsedShapes && parsedShapes.length > 0) {
            try {
                // Skip capturing canvas if we just canceled a line drawing to prevent corruption
                if (window.canceledLineDrawing) {
                    console.log('🚫 Skipping canvas capture due to recent cancel - preventing corrupted state save');
                    savedState.canvasDataURL = null;
                } else if (window.skipCanvasCaptureAfterShapeTransition) {
                    // CRITICAL: Skip canvas capture immediately after shape transitions to prevent shading persistence
                    console.log('🚫 Skipping canvas capture after shape transition - preventing shaded state persistence');
                    savedState.canvasDataURL = null;
                } else if (gameState === 'results' || gameState === 'finished' || gameState === 'locked') {
                    // Skip canvas during end-game completion screens only
                    console.log('🚫 Skipping canvas capture during end-game phase');
                    savedState.canvasDataURL = null;
                } else {
                    // CRITICAL: Capture canvas in ALL active game states, INCLUDING 'awaiting_choice'
                    // This preserves cut shading when user has made a cut and is viewing the split display
                    savedState.canvasDataURL = canvasElement.toDataURL();
                    console.log('📸 Canvas state captured for restoration (gameState: ' + gameState + ', length:', savedState.canvasDataURL.length, ')');
                }
            } catch (e) {
                console.warn('⚠️ Could not capture canvas state:', e);
                savedState.canvasDataURL = null;
            }
        } else {
            console.log('📸 No canvas state to capture - canvas:', !!canvasElement, 'shapes:', parsedShapes?.length || 0);
        }
        
        localStorage.setItem('dailyGameState_demo', JSON.stringify(savedState));

        // Also save to SimpleRefresh system for page reload compatibility
        if (window.SimpleRefresh && window.SimpleRefresh.save) {
            window.SimpleRefresh.save();
        }

        console.log('💾 Demo game state saved:', {
            day: savedState.currentDay,
            shape: savedState.currentShapeNumber,
            attempt: savedState.currentAttemptNumber,
            cuts: savedState.totalCutsMade,
            gameStarted: savedState.gameStarted
        });
        
        // Also save to SimpleGameRefresh for emergency restoration (if available)
        if (window.SimpleGameRefresh && window.SimpleGameRefresh.save) {
            window.SimpleGameRefresh.save();
        }
    } catch (error) {
        console.warn('⚠️ Could not save demo game state:', error);
    }
}

// Supabase Game Mode Functions
async function initializeSupabaseGameMode() {
    try {
        console.log('🔗 Starting Supabase Game Mode initialization...');

        // CRITICAL: Ensure we're in daily mode, not practice mode
        window.isPracticeMode = false;
        window.isDailyMode = true;
        console.log('🔄 Ensured daily mode flags are set for Supabase initialization');

        // Hide any existing commentary from previous session
        hideCommentary();

        // Initialize authentication service first
        if (window.AuthService && !window.AuthService.initialized) {
            console.log('🔐 Initializing AuthService...');
            await window.AuthService.initialize();
            console.log('✅ AuthService initialized, isLoggedIn:', window.AuthService.isLoggedIn());
        }

        // Initialize user account manager after auth
        if (window.UserAccountManager && !window.UserAccountManager.initialized) {
            console.log('👤 Initializing UserAccountManager...');
            await window.UserAccountManager.initialize();
            console.log('✅ UserAccountManager initialized');
        }

        // Sync server-side completion state with localStorage for logged-in users
        if (window.AuthService && window.AuthService.isLoggedIn()) {
            await syncServerCompletionState();
        }

        // Initialize daily game state if not exists
        if (!dailyGameState) {
            initializeDailyGameState();
        }

        // Initialize daily reset functionality
        initializeDailyReset();

        // Setup canvas
        canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        ctx = setupCanvasForCrispRendering(canvas);
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }

        // Canvas ready (loading animation handled by HTML inline script)
        console.log('✅ Canvas setup complete');

        // Setup event listeners
        setupDemoEventListeners();

        // Initialize game state
        gameState = 'initial';
        isInteractionEnabled = false;
        maxAttempts = 1;

        // Get current day for mechanic
        const today = new Date();
        const dayOfWeek = today.getDay();
        currentDay = dayOfWeek === 0 ? 7 : dayOfWeek;

        window.currentDay = currentDay;

        currentShapeNumber = 1;
        currentAttemptNumber = 1;
        window.currentShapeNumber = currentShapeNumber;
        window.currentAttemptNumber = currentAttemptNumber;

        console.log(`📅 Current day: ${currentDay} (${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentDay === 7 ? 0 : currentDay]})`);

        // Check if we have an active game to prevent showing welcome screen inappropriately
        let hasActiveGame = window.SimpleRefresh && window.SimpleRefresh.restore && window.SimpleRefresh.restore();

        // Validate that saved game is from today, not yesterday
        // CRITICAL: In demo mode, validate by DAY OF WEEK, not calendar date
        if (hasActiveGame) {
            // Check if saved game is from the same day of the week (demo mode uses day-of-week)
            const savedDay = hasActiveGame.currentDay || hasActiveGame.day;

            if (savedDay && savedDay !== currentDay) {
                console.log(`⚠️ Saved game is from day ${savedDay}, but current day is ${currentDay}. Clearing old state.`);

                // Clear old demo game state from different day of week
                const oldDayFlag = `demo_completed_day_${savedDay}`;
                localStorage.removeItem(oldDayFlag);
                console.log(`🗑️ Cleared old demo flag: ${oldDayFlag}`);

                window.SimpleRefresh.clear();
                hasActiveGame = null;
            } else {
                console.log(`✅ Saved game validated - same day of week (day ${currentDay})`);
            }
        }

        console.log('🔍 Supabase init: hasActiveGame result:', !!hasActiveGame);

        // Only show welcome screen if we're not restoring a saved game
        if (!hasActiveGame) {
            // Wait for loading animation to complete before showing welcome screen
            // Don't call hideLoadingAnimation() here as it would clear the callback
            if (window.stopImmediateLoadingAnimation) {
                window.stopImmediateLoadingAnimation(showWelcomeScreen);
            } else {
                hideLoadingAnimation();
                showWelcomeScreen();
            }
        } else {
            hideLoadingAnimation();
            console.log('🔄 Skipping welcome screen in Supabase init - will restore saved game state later');
            // Hide welcome overlay immediately to prevent flashing
            const welcomeOverlay = document.getElementById('welcomeOverlay');
            if (welcomeOverlay) {
                welcomeOverlay.style.visibility = 'hidden';
            }
        }

        // Create progress UI
        createProgressUI();

        // Set up event listeners
        setupEventListeners();

        console.log('🔗 Supabase Game Mode initialized - checking for shapes from integration');

        // Function to initialize DailyGameCore with Supabase shapes
        const initializeDailyGameCoreWithSupabase = async () => {
            console.log('🎯 Supabase shapes ready - initializing DailyGameCore');

            // Initialize DailyGameCore to pull shapes from DailyModeManager
            if (window.DailyGameCore) {
                try {
                    console.log('🔄 Initializing DailyGameCore to load Supabase shapes...');
                    await window.DailyGameCore.initialize();
                    console.log('✅ DailyGameCore initialized with Supabase shapes');

                    // Verify shapes are available
                    const shape1 = window.DailyGameCore.getShapeData(1);
                    if (shape1) {
                        console.log('✅ Shape 1 is now available from DailyGameCore');
                    } else {
                        console.error('❌ Shape 1 still not available after DailyGameCore initialization');
                    }
                } catch (error) {
                    console.error('❌ Failed to initialize DailyGameCore:', error);
                }
            }

            // Load the current mechanic for today
            const mechanicClassName = dayMechanics[currentDay];
            if (mechanicClassName) {
                loadDemoMechanic(mechanicClassName, false); // Don't initialize yet
                console.log(`🔧 Loaded mechanic: ${mechanicClassName}`);
            }

            console.log('✅ Supabase integration with game engine complete');

            // Now that shapes are loaded, initialize the menu button
            console.log('🔵 Shapes loaded - initializing animated menu...');
            initializeAnimatedMenu();

            // Restore canvas and UI state if we're restoring a saved game
            if (window.isRestoringGameState && window.pendingCanvasRestoration) {
                console.log('🔄 Triggering delayed canvas restoration after Supabase init');
                setTimeout(() => {
                    if (window.pendingCanvasRestoration && window.canvas && window.ctx) {
                        console.log('🎨 Restoring canvas state with cut shading (Supabase flow)');
                        const img = new Image();
                        img.onload = function() {
                            window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
                            window.ctx.drawImage(img, 0, 0);
                            console.log('✅ Canvas state with cut shading restored (Supabase flow)');

                            // Restore UI elements for the current state
                            if (window.currentAttempts && window.currentAttempts.length > 0) {
                                const lastAttempt = window.currentAttempts[window.currentAttempts.length - 1];
                                if (lastAttempt && lastAttempt.leftPercentage !== undefined) {
                                    console.log('🔄 Restoring percentage display:', lastAttempt.leftPercentage, '/', lastAttempt.rightPercentage);
                                    if (window.showAttemptResult) {
                                        window.showAttemptResult(lastAttempt.leftPercentage, lastAttempt.rightPercentage);
                                    }
                                }
                            }

                            // Clear the pending restoration and flag
                            window.pendingCanvasRestoration = null;
                            window.isRestoringGameState = false;
                            console.log('🔄 Cleared isRestoringGameState flag - restoration complete (Supabase flow)');

                            // CRITICAL: Start rotation AFTER canvas is restored (for rotating shape mechanic)
                            if (currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut" &&
                                typeof currentMechanic.startRotation === 'function' && !currentMechanic.isRotating) {
                                console.log('🔄 Starting rotation after canvas restoration (Supabase flow)');
                                currentMechanic.startRotation();
                            }
                        };
                        img.src = window.pendingCanvasRestoration;
                    }
                }, 300);
            }

            // Fallback: Try again after a short delay if initialization failed
            setTimeout(() => {
                if (!menuState.isInitialized) {
                    console.log('🔵 Menu not initialized yet, trying fallback initialization...');
                    initializeAnimatedMenu();
                }
            }, 1000);
        };

        // Wait for dailyModeManager to be ready with a polling approach
        console.log('⏳ Waiting for Supabase shapes to be loaded...');

        let attempts = 0;
        const maxPollingAttempts = 100; // 10 seconds max wait (100 * 100ms)

        const waitForSupabaseShapes = async () => {
            while (attempts < maxPollingAttempts) {
                if (window.dailyModeManager && window.dailyModeManager.shapes && window.dailyModeManager.shapes.length >= 3) {
                    console.log('✅ Supabase shapes are ready - initializing DailyGameCore');
                    await initializeDailyGameCoreWithSupabase();
                    return;
                }

                attempts++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log('⚠️ Timeout waiting for Supabase shapes - proceeding anyway');
        };

        // Also listen for the event as backup
        window.addEventListener('dailyShapesReady', initializeDailyGameCoreWithSupabase);

        // Start polling
        waitForSupabaseShapes();

        // CRITICAL: Ensure header title is properly formatted after Supabase initialization
        if (window.updateDateTitle && typeof window.updateDateTitle === 'function') {
            window.updateDateTitle();
            console.log('🔄 Supabase init: Header title formatted properly');
        } else {
            console.log('⚠️ Supabase init: updateDateTitle not available yet');
        }

        document.body.classList.add('ready');

    } catch (error) {
        console.error('❌ Supabase Game Mode initialization failed:', error);
        // Fall back to demo mode
        hideLoadingAnimation();
        console.log('🔄 Falling back to demo mode');
        await initializeDemoGame();
    }
}

// Demo Game Functions
async function initializeDemoGame() {
    try {
        console.log('🎮 Starting Demo Game initialization...');
        
        // Set demo mode preference to prevent daily-game-core from initializing
        localStorage.setItem('dailyShapes_demoMode', 'true');
        
        // Hide any existing commentary from previous session
        hideCommentary();
        
        // Initialize authentication service first
        if (window.AuthService && !window.AuthService.initialized) {
            console.log('🔐 Initializing AuthService...');
            await window.AuthService.initialize();
            console.log('✅ AuthService initialized, isLoggedIn:', window.AuthService.isLoggedIn());
        }
        
        // Initialize user account manager after auth
        if (window.UserAccountManager && !window.UserAccountManager.initialized) {
            console.log('👤 Initializing UserAccountManager...');
            await window.UserAccountManager.initialize();
            console.log('✅ UserAccountManager initialized');
        }
        
        // Initialize daily game state if not exists
        if (!dailyGameState) {
            initializeDailyGameState();
        }
        
        // Initialize daily reset functionality
        initializeDailyReset();
        
        // Refresh protection disabled - always start new game

        // Setup canvas
        canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        ctx = setupCanvasForCrispRendering(canvas);
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }

        // Draw initial grid
        drawGrid();
        console.log('✅ Canvas setup complete');
        
        // Setup demo event listeners
        setupDemoEventListeners();
        
        // Initialize in daily mode by default (not demo/practice mode)
        const isPracticeModeStored = localStorage.getItem('dailyShapes_practiceMode') === 'true';
        if (isPracticeModeStored) {
            // Initialize in practice mode
            isPracticeMode = true;
            window.isPracticeMode = true; // Set global for mechanics to access
            isPractiseMode = true;
            isDailyMode = false;
            console.log('🎮 Initializing in practice mode - unlimited cuts allowed');
        } else {
            // Initialize in daily mode by default (Play button starts daily game)
            isPracticeMode = false;
            window.isPracticeMode = false; // Set global for mechanics to access
            isPractiseMode = false;
            isDailyMode = false;  // Demo mode should not use daily mode logic
            console.log('🎯 Initializing in demo mode - 2-cut restriction enabled');
        }
        gameState = 'initial';
        isInteractionEnabled = false;
        maxAttempts = 1;  // 1 attempt per shape
        
        // Load Monday by default
        currentDay = 1;
        window.currentDay = currentDay;  // Update global for mechanics
        currentShapeNumber = 1;
        currentAttemptNumber = 1;
        window.currentShapeNumber = currentShapeNumber;  // BULLETPROOF REFRESH: Sync window property
        window.currentAttemptNumber = currentAttemptNumber;  // BULLETPROOF REFRESH: Sync window property
        
        // Clear any conflicting bulletproof refresh data
        const bulletproofKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('dailyGameState_2025-') || key.includes('bulletproof')
        );
        bulletproofKeys.forEach(key => {
            console.log('🧹 Clearing conflicting refresh data:', key);
            localStorage.removeItem(key);
        });
        
        // Get current day for demo mode
        // Use actual current date
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const currentDemoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Sunday=7, Monday=1, etc.

        // Update global currentDay with actual calculated day
        currentDay = currentDemoDay;
        window.currentDay = currentDay;
        
        // Keep saved state for proper restoration between modes
        // localStorage.removeItem('dailyGameState_demo'); // REMOVED - prevents proper state restoration
        console.log('🔄 Checking for saved game state to restore...');

        // Check for saved DEMO game state (not conflicting with bulletproof system)
        const savedGameState = localStorage.getItem('dailyGameState_demo');
        let parsed = null; // Declare in outer scope for later use

        console.log('🔍 DEBUG: savedGameState exists:', !!savedGameState);
        console.log('🔍 DEBUG: currentDemoDay:', currentDemoDay);

        if (savedGameState) {
            try {
                parsed = JSON.parse(savedGameState);
                console.log('🔍 DEBUG: parsed state:', {
                    currentDay: parsed.currentDay,
                    currentShapeNumber: parsed.currentShapeNumber,
                    gameStarted: parsed.gameStarted,
                    currentDemoDay: currentDemoDay
                });

                // Only restore if it's for the same day - otherwise start fresh for new day
                if (parsed.currentDay === currentDemoDay && parsed.currentShapeNumber) {
                    console.log('🔄 Restoring saved demo state - Day:', parsed.currentDay, 'Shape:', parsed.currentShapeNumber, 'Attempt:', parsed.currentAttemptNumber);
                    
                    // Restore basic state
                    currentDay = parsed.currentDay;
                    window.currentDay = currentDay;  // Update global for mechanics
                    currentShapeNumber = parsed.currentShapeNumber;
                    currentAttemptNumber = parsed.currentAttemptNumber || 1;
                    
                    // Restore game progress
                    if (parsed.gameStarted) {
                        setGameState(parsed.gameStateValue || 'playing');
                        setInteractionEnabled(parsed.isInteractionEnabled || false);
                        
                        // Restore cut counters
                        window.totalCutsMade = parsed.totalCutsMade || 0;
                        window.cutsMadeThisShape = parsed.cutsMadeThisShape || 0;
                        if (parsed.currentAttempts) {
                            currentAttempts = parsed.currentAttempts;
                        }
                        
                        console.log('📊 Restored game progress - cuts:', window.totalCutsMade, 'thisShape:', window.cutsMadeThisShape);
                        
                        // Mark that we need to restore to playing state after initialization
                        window.restoreGameState = true;
                        
                        // Add restoration class immediately to prevent UI flashing
                        document.body.classList.add('restoring');
                    }
                    
                    // Update window properties
                    window.currentShapeNumber = currentShapeNumber;
                    window.currentAttemptNumber = currentAttemptNumber;
                } else {
                    console.log('🆕 New day detected - starting fresh for day', currentDemoDay);
                    currentDay = currentDemoDay;
                    window.currentDay = currentDay;  // Update global for mechanics
                }
            } catch (error) {
                console.log('⚠️ Invalid saved state, using current day');
                currentDay = currentDemoDay;
                window.currentDay = currentDay;  // Update global for mechanics
            }
        } else {
            // No saved state - use current day
            currentDay = currentDemoDay;
            window.currentDay = currentDay;  // Update global for mechanics
        }
        
        console.log(`📅 Demo day: ${currentDemoDay} (${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentDemoDay === 7 ? 0 : currentDemoDay]})`);
        
        // Store the current day for later loading
        
        // Handle different game states
        // CRITICAL: Actually RESTORE the game state using SimpleRefresh
        let restoredState = null;
        if (window.SimpleRefresh && window.SimpleRefresh.restore) {
            restoredState = window.SimpleRefresh.restore();
            console.log('🔄 SimpleRefresh.restore() called, result:', !!restoredState);
        }

        // Check if we have an active game based on restored state
        let hasActiveGame = false;
        if (restoredState) {
            // Game is active if it was started, regardless of cut count
            hasActiveGame = restoredState.isGameStarted;
            console.log('🔍 DEBUG: hasActiveGame from restored state:', hasActiveGame, {
                isGameStarted: restoredState.isGameStarted,
                currentDay: restoredState.currentDay,
                currentShape: restoredState.currentShape,
                currentAttempt: restoredState.currentAttempt,
                dayComplete: restoredState.dayComplete
            });
        }
        console.log('🔍 DEBUG: hasActiveGame result:', hasActiveGame);
        
        // Only show welcome screen if we're not restoring a saved game
        if (!window.restoreGameState && !hasActiveGame) {
            // Wait for loading animation to complete before showing welcome screen
            // Don't call hideLoadingAnimation() here as it would clear the callback
            if (window.stopImmediateLoadingAnimation) {
                window.stopImmediateLoadingAnimation(showWelcomeScreen);
            } else {
                hideLoadingAnimation();
                showWelcomeScreen();
            }
        } else {
            hideLoadingAnimation();
            console.log('🔄 Skipping welcome screen - restoring saved game state (restoreGameState:', !!window.restoreGameState, 'hasActiveGame:', hasActiveGame, ')');
            // Hide welcome overlay and initial welcome buttons immediately
            const welcomeOverlay = document.getElementById('welcomeOverlay');
            if (welcomeOverlay) {
                welcomeOverlay.style.visibility = 'hidden';
            }
            hideInitialWelcomeButtons();
        }
        
        // Create initial UI (but stay in initial state)
        createProgressUI();
        
        // Set up event listeners for buttons including practice button
        console.log('🔧 Setting up event listeners...');
        setupEventListeners();
        
        console.log('🎮 Initial demo state: Shape', currentShapeNumber, ', Attempt', currentAttemptNumber);
        
        console.log('🎮 Demo Game initialized successfully');

        // Now that demo game is loaded, initialize the menu button
        console.log('🔵 Demo game loaded - initializing animated menu...');
        initializeAnimatedMenu();

        // Fallback: Try again after a short delay if initialization failed
        setTimeout(() => {
            if (!menuState.isInitialized) {
                console.log('🔵 Menu not initialized yet, trying demo fallback initialization...');
                initializeAnimatedMenu();
            }
        }, 1000);

        // CRITICAL: Ensure header title is properly formatted after demo initialization
        if (window.updateDateTitle && typeof window.updateDateTitle === 'function') {
            window.updateDateTitle();
            console.log('🔄 Demo init: Header title formatted properly');
        } else {
            console.log('⚠️ Demo init: updateDateTitle not available yet');
        }

        // Mark as ready to show results container for non-restoration loads
        if (!window.restoreGameState) {
            setTimeout(() => {
                document.body.classList.add('ready');
            }, 50); // Small delay to ensure CSS is loaded
        }
        
        // DO NOT save initial state here - it causes restore loops
        // Only save state after player actions
        // saveDemoGameState();
        
        // CRITICAL: Re-enable restoration - this is NOT legacy, it's essential!
        if (window.restoreGameState) {
            console.log('🔄 Completing game state restoration...');
            
            // Restoration class already added earlier when we detected saved state
            
            setTimeout(async () => {
                // Hide welcome screen and play button if game was already started
                const welcomeOverlay = document.querySelector('.welcome-overlay');
                if (welcomeOverlay) {
                    welcomeOverlay.style.visibility = 'hidden';
                }
                
                // Hide initial welcome buttons during restoration
                hideInitialWelcomeButtons();
                console.log('🔄 Welcome buttons hidden during state restoration');
                
                // Use the already parsed state (parsed variable contains all saved data)
                // If parsed is null, re-parse from localStorage as fallback
                const savedState = parsed || JSON.parse(localStorage.getItem('dailyGameState_demo') || '{}');
                
                // Load just the mechanic for the current day
                const mechanicClassName = dayMechanics[currentDay];
                loadDemoMechanic(mechanicClassName);
                
                // Store the cut counters before loading shape (which would reset them)
                const preservedTotalCuts = window.totalCutsMade;
                const preservedShapeCuts = window.cutsMadeThisShape;
                const preservedAttempts = savedState.currentAttempts || [];
                
                // Load the specific shape that was saved
                await loadDemoShape(currentDay, savedState.currentShapeNumber);
                
                // Restore the cut counters after shape loading
                window.totalCutsMade = preservedTotalCuts;
                window.cutsMadeThisShape = preservedShapeCuts;
                // CRITICAL: Also update the global variables that handleCutAttempt uses
                totalCutsMade = preservedTotalCuts;
                cutsMadeThisShape = preservedShapeCuts;
                currentAttempts = preservedAttempts;
                attemptCount = preservedAttempts.length;
                
                // Ensure attempt number is correctly restored
                currentAttemptNumber = savedState.currentAttemptNumber;
                window.currentAttemptNumber = currentAttemptNumber;
                
                // Set game state based on whether this shape's single cut has been made
                if (window.cutsMadeThisShape >= 1) {
                    // Cut completed on this shape - awaiting shape progression
                    setGameState('awaiting_choice');
                    setInteractionEnabled(false);
                    console.log('🔄 Cut done on this shape, awaiting shape progression');
                } else {
                    // No cuts made yet - ready for cutting
                    setGameState('cutting');
                    setInteractionEnabled(true);
                    console.log('🔄 Enabled canvas interaction for fresh shape (no cuts made)');
                }
                
                console.log('🔄 Restored game state:', gameState, 'interaction enabled:', isInteractionEnabled);
                
                console.log('🔄 Restored cut counters - total:', window.totalCutsMade, 'thisShape:', window.cutsMadeThisShape);
                
                // Restore canvas state if available (with longer delay to ensure it's not overwritten)
                const shouldRestoreCanvas = savedState && savedState.canvasDataURL;
                
                if (shouldRestoreCanvas) {
                    console.log('🔄 Preparing to restore canvas state...');
                    console.log('🔄 Canvas data URL length:', savedState.canvasDataURL.length);
                    
                    // Optimized restoration with polling for canvas readiness
                    const restoreCanvas = () => {
                        const canvasElement = document.getElementById('geoCanvas');
                        const context = canvasElement?.getContext('2d');
                        
                        if (canvasElement && context && parsedShapes && parsedShapes.length > 0) {
                            const img = new Image();
                            img.onload = function() {
                                // Skip rendering if we just canceled a line drawing to prevent visual corruption
                                if (window.canceledLineDrawing) {
                                    console.log('🚫 Skipping canvas restoration due to recent cancel - preventing visual corruption');
                                    return;
                                }
                                console.log('🎨 Restoring canvas: drawing saved cut state over current canvas...');
                                // Don't clear - just draw over the existing canvas to preserve the shape
                                context.drawImage(img, 0, 0);
                                console.log('✅ Canvas state restored successfully from saved data');
                                
                                // Also restore the percentage display if there was a cut
                                if (window.cutsMadeThisShape > 0 && savedState) {
                                    // Check if we're in completion state - if so, skip percentage restoration to avoid interference
                                    const isCompletionViewActive = window.completeView && typeof window.completeView.isActive === 'function' && window.completeView.isActive();
                                    const isGameCompleted = (window.RefreshProtection && window.RefreshProtection.isGameCompleted()) ||
                                                           (window.dailyGameState && (window.dailyGameState.dayComplete || window.dailyGameState.isGameComplete));

                                    if (isCompletionViewActive || isGameCompleted) {
                                        console.log('🎮 Completion state active during restoration - skipping percentage display restoration to prevent flash');
                                        return;
                                    }

                                    // Hide the table format percentage display
                                    const percentageDisplay = document.getElementById('percentageDisplay');
                                    if (percentageDisplay) {
                                        percentageDisplay.style.display = 'none';
                                    }

                                    // Use the proper createNewAttemptResult format instead
                                    if (savedState.leftPercentage && savedState.rightPercentage &&
                                        savedState.leftPercentage !== '-' && savedState.rightPercentage !== '-') {

                                        const resultsContainer = document.getElementById('resultsContainer');
                                        if (resultsContainer) {
                                            // Remove any existing attempt-result divs to avoid duplicates
                                            const existingResults = resultsContainer.querySelectorAll('.attempt-result');
                                            existingResults.forEach(result => result.remove());

                                            // Create the properly formatted percentage display
                                            const leftVal = typeof savedState.leftPercentage === 'number' ?
                                                savedState.leftPercentage : parseFloat(savedState.leftPercentage);
                                            const rightVal = typeof savedState.rightPercentage === 'number' ?
                                                savedState.rightPercentage : parseFloat(savedState.rightPercentage);

                                            createNewAttemptResult(leftVal, rightVal);
                                            console.log('📊 Restored percentages using proper format:', leftVal, rightVal);
                                        }
                                    }
                                }
                            };
                            img.onerror = function() {
                                console.error('❌ Failed to load saved canvas image');
                            };
                            img.src = savedState.canvasDataURL;
                        } else {
                            // Canvas not ready yet, try again in a short time
                            setTimeout(restoreCanvas, 50);
                        }
                    };
                    
                    // Start restoration with a small initial delay
                    setTimeout(restoreCanvas, 200);
                } else {
                    console.log('🔄 No canvas data to restore');

                    // For fresh shapes (like after Next Shape + refresh), ensure canvas is active
                    if (window.cutsMadeThisShape === 0 && gameState === 'cutting') {
                        setTimeout(() => {
                            const canvasElement = document.getElementById('geoCanvas');
                            if (canvasElement) {
                                canvasElement.style.pointerEvents = 'auto';
                                console.log('🔧 ACTIVATED: Canvas pointer-events set to auto for fresh shape after restoration');
                            }
                        }, 100);
                    }
                }
                
                // Setup event listeners for mechanics after restoration
                if (currentMechanic) {
                    console.log('🔄 Setting up mechanics event listeners after restoration');
                    setupMechanicsEventListeners();
                }
                
                // FINAL CHECK: Ensure canvas is active for cutting state (addressing Next Shape + refresh lockup)
                setTimeout(() => {
                    if (gameState === 'cutting' && isInteractionEnabled) {
                        const canvasElement = document.getElementById('geoCanvas');
                        if (canvasElement) {
                            canvasElement.style.pointerEvents = 'auto';
                            console.log('🔧 FINAL CHECK: Canvas activation confirmed for cutting state');
                        }
                    }
                }, 200);
                
                // Restore any progress buttons that should be visible
                // Button should be based on cuts made, not current attempt number
                if (window.cutsMadeThisShape > 0) {
                    // Set currentAttemptNumber to match cuts made (for button logic)
                    const actualAttemptCompleted = window.cutsMadeThisShape;
                    currentAttemptNumber = actualAttemptCompleted;
                    window.currentAttemptNumber = currentAttemptNumber;
                    console.log('🔄 Adjusted attempt number to match cuts made:', currentAttemptNumber);
                    createProgressionButton();
                }
                
                // Update progress UI to show correct state
                updateProgressUI();
                
                // Skip redrawCanvas if we have saved canvas state to restore
                // (redrawCanvas would overwrite the restored visual state)
                if (typeof redrawCanvas === 'function' && (!savedState || !savedState.canvasDataURL)) {
                    redrawCanvas();
                    console.log('🎨 Called redrawCanvas (no saved canvas state to restore)');
                } else if (savedState && savedState.canvasDataURL) {
                    console.log('🎨 Skipped redrawCanvas to preserve restored canvas state');
                }
                
                console.log('📊 Final restored state - Shape:', currentShapeNumber, 'Attempt:', currentAttemptNumber, 'Cuts:', window.cutsMadeThisShape);
                
                // Show welcome back popup after restoration is complete
                // Always show if there's any saved state (meaning the user has started the game)
                // BUT suppress if day is complete
                
                // Check multiple sources for completion state
                const isCompletedInSavedState = savedState && (savedState.dayComplete || savedState.isGameComplete);
                const isCompletedInDailyState = dailyGameState && (dailyGameState.dayComplete || dailyGameState.isGameComplete);
                
                // Also check localStorage directly for completion state
                const today = getCurrentLocalDate();
                const stateKey = `dailyGameState_${today}`;
                let isCompletedInLocalStorage = false;
                try {
                    const localStorageState = localStorage.getItem(stateKey);
                    if (localStorageState) {
                        const parsed = JSON.parse(localStorageState);
                        isCompletedInLocalStorage = parsed.dayComplete || parsed.isGameComplete;
                    }
                } catch (e) {
                    console.warn('Could not parse localStorage state for completion check');
                }
                
                const isDayComplete = isCompletedInSavedState || isCompletedInDailyState || isCompletedInLocalStorage;
                
                if (savedState && savedState.gameStarted && !isDayComplete) {
                    setTimeout(() => {
                        // HARD GATE: Never show welcome back popup
                        if (false) { /* never show welcome back */ }
                    }, 200); // Small delay to ensure UI is ready
                } else if (isDayComplete) {
                    console.log('✅ Day complete detected - suppressing welcome back popup');
                    console.log('✅ Sources - savedState:', isCompletedInSavedState, 'dailyState:', isCompletedInDailyState, 'localStorage:', isCompletedInLocalStorage);
                }
                
                console.log('✅ Game state restoration completed');
                
                // Remove restoration class to re-enable normal UI
                document.body.classList.remove('restoring');
                
                // Mark body as ready to show results container
                document.body.classList.add('ready');
                
                window.restoreGameState = false;
            }, 100);
        }
        
        // Expose functions to window for mechanics to use
        window.handleCutAttempt = handleCutAttempt;
        window.isDemoMode = isDemoMode;
        
        // Initialize competition system
        if (window.CompetitionManager && window.CompetitionUI) {
            setTimeout(async () => {
                try {
                    console.log('🏆 Initializing competition system...');
                    await window.CompetitionManager.initialize();
                    window.CompetitionUI.initialize();
                    
                    // Check for join link AFTER AuthService is fully initialized
                    const joinCompetitionId = window.CompetitionManager?.parseJoinLink();
                    if (joinCompetitionId) {
                        console.log('🔗 Join link detected on page load:', joinCompetitionId);
                        
                        // Wait for AuthService to be fully initialized before showing modal
                        const waitForAuth = () => {
                            return new Promise((resolve) => {
                                const checkAuth = () => {
                                    if (window.AuthService && window.AuthService.initialized) {
                                        console.log('✅ AuthService ready for competition join modal');
                                        resolve();
                                    } else {
                                        console.log('⏳ Waiting for AuthService to initialize...');
                                        setTimeout(checkAuth, 100);
                                    }
                                };
                                checkAuth();
                            });
                        };
                        
                        await waitForAuth();
                        
                        // Now check if user is already logged in
                        const isLoggedIn = window.AuthService.isLoggedIn();
                        console.log('🔍 Auth status for competition join:', {
                            isLoggedIn,
                            isGuest: window.AuthService.isGuest,
                            userId: window.AuthService.currentUser?.id
                        });
                        
                        if (isLoggedIn) {
                            // User is already logged in - try to join directly
                            console.log('🔄 User already logged in, attempting auto-join to competition');
                            try {
                                const result = await window.CompetitionManager.joinCompetition(joinCompetitionId, window.AuthService.currentUser.id);
                                if (result && result.success) {
                                    console.log('✅ Auto-joined competition successfully');
                                    // Show main competition modal (with how competitions work text)
                                    setTimeout(() => {
                                        openCompetitionModal();
                                    }, 500);
                                } else {
                                    console.log('⚠️ Auto-join failed, showing manual join modal');
                                    showJoinCompetitionModal(joinCompetitionId);
                                }
                            } catch (error) {
                                console.error('❌ Error auto-joining competition:', error);
                                showJoinCompetitionModal(joinCompetitionId);
                            }
                        } else {
                            // User not logged in - store competition ID and show join modal
                            console.log('🔑 User not logged in, storing competition ID and showing join modal');
                            sessionStorage.setItem('pendingJoinCompetitionId', joinCompetitionId);
                            showJoinCompetitionModal(joinCompetitionId);
                        }
                    } else {
                        // Auto-join user to global competition if authenticated (only if no join link)
                        if (window.AuthService?.currentUser) {
                            await window.CompetitionManager.autoJoinGlobalCompetition(window.AuthService.currentUser.id);
                        }
                    }
                    
                    console.log('✅ Competition system initialized successfully');
                } catch (error) {
                    console.warn('⚠️ Competition system initialization failed:', error);
                }
                
                // Final button state update after everything is loaded
                setTimeout(() => {
                    console.log('🔄 Final button state update check');
                    
                    // Direct localStorage check to debug the issue
                    const supabaseToken = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
                    const userAuthToken = localStorage.getItem('userAuthToken');
                    console.log('🔍 Direct localStorage check at final update:', {
                        supabaseToken: !!supabaseToken,
                        userAuthToken: !!userAuthToken
                    });
                    
                    // If we have tokens but buttons are still greyed out, force enable them
                    if (supabaseToken || userAuthToken) {
                        console.log('✅ Tokens found - forcing button enable');

                        // AuthService should already be initialized - just update UI state
                        if (typeof updateButtonStates === 'function') {
                            updateButtonStates();
                        }
                    } else {
                        // No tokens, normal update
                        if (typeof updateButtonStates === 'function') {
                            updateButtonStates();
                        }
                    }
                }, 3000); // Longer delay to ensure everything is loaded
            }, 2000); // Wait for auth and other systems to be ready
        }
        
    } catch (error) {
        console.error('💥 Error initializing Demo Game:', error);
    }
}

// Welcome Screen Functions
function showWelcomeScreen() {
    console.log('🎮 Showing welcome screen');
    
    // Show welcome overlay
    const welcomeOverlay = document.getElementById('welcomeOverlay');
    if (welcomeOverlay) {
        welcomeOverlay.style.visibility = 'visible';
    }
    
    // Update today's mechanic text
    const mechanicSpan = document.getElementById('todaysMechanic');
    const mechanicWelcomeText = document.getElementById('mechanicWelcomeText');
    
    if (mechanicSpan) {
        const mechanicNames = {
            1: 'Straight Line Cutter',
            2: 'Horizontal Line Cutter',
            3: 'Circle Cutter',
            4: 'Diagonal Line Cutter',
            5: 'Triangle Cutter',
            6: 'Rotating Square Cutter',
            7: 'Straight Line Cutter'
        };
        
        const mechanicName = mechanicNames[currentDay] || 'Loading...';
        mechanicSpan.textContent = mechanicName;
        
        // Apply blue color styling to the mechanic name
        mechanicSpan.style.color = '#6496FF';
        
        // Special case for Sunday (day 7) - show spinning shapes text with blue styling
        if (mechanicWelcomeText && currentDay === 7) {
            mechanicWelcomeText.innerHTML = 'Today you\'re using the <strong style="color: #6496FF;">Straight Line Cutter</strong> on <strong style="color: #6496FF;">spinning shapes</strong>. Follow tips above the grid.';
        }
    }
    
    // REMOVED DUPLICATE EVENT LISTENER - Play button handler is set up in setupEventListeners()
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.style.display = 'block';
        
        // Also show the container
        const initialPlayButton = document.getElementById('initialPlayButton');
        if (initialPlayButton) {
            initialPlayButton.style.visibility = 'visible';
        }
    }
    
    // Show canvas and draw grid
    if (canvas && ctx) {
        canvas.style.display = 'block';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
    }
}

// Show sign-in reminder modal for guests starting the game
function showSignInReminderModal() {
    const modal = document.createElement('div');
    modal.id = 'signInReminderModal';
    modal.className = 'auth-modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '10001';

    modal.innerHTML = `
        <div class="auth-modal-content" style="border-radius: 12px !important;">
            <div class="auth-modal-body">
                <p style="text-align: center; margin: 16px 0; line-height: 1.4; font-size: 14px;">
                    Don't forget to sign in to your account if you're currently playing in a competition
                </p>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
                    <button class="auth-submit-button" onclick="openSignInFromReminder()">
                        Sign In
                    </button>
                    <button class="cancel-btn" onclick="proceedWithoutSignIn()" style="background: #6c757d; border: 2px solid #6c757d;">
                        No Thanks
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
}

// Close sign-in reminder modal
function closeSignInReminderModal() {
    const modal = document.getElementById('signInReminderModal');
    if (modal) {
        modal.remove();
        document.body.classList.remove('modal-open');
    }
}

// Open sign-in modal from reminder
function openSignInFromReminder() {
    closeSignInReminderModal();

    // Set flag to indicate sign-in was triggered from play button
    sessionStorage.setItem('signInFromPlay', 'true');

    if (window.openAuthModal) {
        window.openAuthModal('login');
    }
}

// Proceed without signing in
function proceedWithoutSignIn() {
    closeSignInReminderModal();
    // Continue with the game start
    continuePlayButtonClick();
}

// Check if user has already played today's game
async function checkIfUserHasPlayedToday() {
    if (!window.SupabaseConfig?.isReady() || !window.AuthService?.currentUser?.id) {
        return false;
    }

    try {
        // Get today's date in YYYY-MM-DD format using LOCAL timezone
        const todayDate = new Date();
        const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

        const { data, error } = await window.SupabaseConfig.client
            .from('user_daily_progress')
            .select('completed')
            .eq('user_id', window.AuthService.currentUser.id)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error checking daily progress:', error);
            return false;
        }

        // Return true if the user has completed today's game
        return data?.completed === true;
    } catch (error) {
        console.error('Error checking if user has played today:', error);
        return false;
    }
}

// Sync server-side completion state with localStorage
async function syncServerCompletionState() {
    if (!window.SupabaseConfig?.isReady() || !window.AuthService?.currentUser?.id) {
        return;
    }

    try {
        // Use LOCAL timezone for date calculation
        const todayDate = new Date();
        const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
        const todayLocalDate = getCurrentLocalDate();

        console.log('🔄 Syncing server completion state for:', today);

        const { data, error } = await window.SupabaseConfig.client
            .from('user_daily_progress')
            .select('*')
            .eq('user_id', window.AuthService.currentUser.id)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching server completion state:', error);
            return;
        }

        // If user has completed the game on the server, sync to localStorage
        if (data && data.completed) {
            console.log('✅ Server shows game completed - syncing to localStorage');

            // Create a completed state in localStorage to prevent replay
            const stateKey = `dailyGameState_${todayLocalDate}`;
            const completedState = {
                isGameStarted: true,
                isGameComplete: true,
                dayComplete: true,
                currentShape: 11,
                currentAttempt: 1,
                cuts: [],
                mechanic: currentDay,
                date: todayLocalDate,
                timestamp: Date.now(),
                syncedFromServer: true,
                totalCutsMade: 10 // All 10 shapes with 1 cut each
            };

            localStorage.setItem(stateKey, JSON.stringify(completedState));
            console.log('💾 Saved completed state to localStorage from server');

            // Also save to SimpleRefresh if available
            if (window.SimpleRefresh && window.SimpleRefresh.saveState) {
                window.SimpleRefresh.saveState(completedState);
                console.log('💾 Saved completed state to SimpleRefresh from server');
            }

            // Also set the global state
            dailyGameState = completedState;
        } else {
            console.log('📝 No completed game found on server for today');
        }
    } catch (error) {
        console.error('Error syncing server completion state:', error);
    }
}

// Show modal informing user they've already played today
function showAlreadyPlayedModal() {
    const modal = document.createElement('div');
    modal.id = 'alreadyPlayedModal';
    modal.className = 'auth-modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '10001';

    modal.innerHTML = `
        <div class="auth-modal-content" style="border-radius: 12px !important;">
            <div class="auth-modal-header">
                <h2>Already Completed Today! 🎉</h2>
                <button class="auth-modal-close" onclick="closeAlreadyPlayedModal()">&times;</button>
            </div>
            <div class="auth-modal-body">
                <p style="text-align: center; margin: 16px 0; line-height: 1.4; font-size: 14px;">
                    You've already completed today's Daily Shapes challenge!
                </p>
                <p style="text-align: center; margin: 16px 0; line-height: 1.4; font-size: 14px;">
                    Come back tomorrow for a new puzzle, or try Practice Mode to keep playing.
                </p>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
                    <button class="auth-submit-button" onclick="openPracticeModeFromAlreadyPlayed()">
                        Try Practice Mode
                    </button>
                    <button class="cancel-btn" onclick="closeAlreadyPlayedModal()" style="background: #6c757d; border: 2px solid #6c757d;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
}

// Close already played modal
function closeAlreadyPlayedModal() {
    const modal = document.getElementById('alreadyPlayedModal');
    if (modal) {
        modal.remove();
        document.body.classList.remove('modal-open');
    }
}

// Open practice mode from already played modal
function openPracticeModeFromAlreadyPlayed() {
    closeAlreadyPlayedModal();
    // Navigate to practice mode
    if (window.PracticeMode && window.PracticeMode.start) {
        window.PracticeMode.start();
    }
}

// Continue the play button click logic after modal interaction
function continuePlayButtonClick() {
    // Close practice mode if it's active
    if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.close) {
        console.log('🔚 Closing practice mode before starting daily mode');
        window.PracticeMode.close();
    }

    // Set demo mode preference to prevent daily-game-core from taking over
    localStorage.setItem('dailyShapes_demoMode', 'true');

    // Clear any bad previous state
    window.SimpleRefresh && window.SimpleRefresh.clear && window.SimpleRefresh.clear();
    localStorage.removeItem('dailyGameState_demo');

    // Initialize state if not already done
    if (!dailyGameState) {
        initializeDailyGameState();
    }

    // Mark game as started
    dailyGameState.isGameStarted = true;

    // Track daily game start event
    if (typeof gtag !== 'undefined') {
        const user = window.AuthService && window.AuthService.getCurrentUser();
        gtag('event', 'daily_game_started', {
            user_id: user && !user.isGuest ? user.id : 'guest',
            date: new Date().toLocaleDateString('en-CA'),
            is_guest: !user || user.isGuest,
            event_category: 'gameplay',
            event_label: 'daily_session_started'
        });
        console.log('📊 GA4: Tracked daily_game_started event');
    }

    // Hide the today's challenge text when play is clicked
    hideTodaysChallenge();

    // Show instruction area with initial instruction
    showInstructionArea();

    // Show progress display immediately when play is clicked with !important
    const progressDisplay = document.getElementById('demoProgressDisplay');
    if (progressDisplay) {
        progressDisplay.style.setProperty('visibility', 'visible', 'important');
        progressDisplay.style.setProperty('display', 'block', 'important');
        progressDisplay.style.setProperty('opacity', '1', 'important');
        console.log('📊 Progress display forcibly shown in play button handler');
    }

    // Hide welcome overlay
    const welcomeOverlay = document.getElementById('welcomeOverlay');
    if (welcomeOverlay) {
        welcomeOverlay.style.visibility = 'hidden';
        console.log('✅ Welcome overlay hidden');
    } else {
        console.error('❌ Welcome overlay not found!');
    }

    // Hide play button
    hidePlayButton();

    // Start the actual game
    console.log('🎮 About to call startGame()...');
    startGame();
}

async function handlePlayButtonClick() {
    // CRITICAL: Block play if game is already completed today
    if (dailyGameState && (dailyGameState.isGameComplete || dailyGameState.dayComplete)) {
        console.log('🚫 Game already completed today - play button blocked');
        window.playButtonClicked = false;
        return;
    }

    // CRITICAL: Block play if game state is finished
    if (gameState === 'finished') {
        console.log('🚫 Game is finished - play button blocked');
        window.playButtonClicked = false;
        return;
    }

    // Prevent rapid double-clicks
    if (window.playButtonClicked) {
        console.log('⚠️ Play button already clicked - ignoring duplicate');
        return;
    }
    window.playButtonClicked = true;
    setTimeout(() => { window.playButtonClicked = false; }, 2000); // Clear after 2 seconds

    // Check if user is logged in, if not show sign-in reminder
    const isLoggedIn = window.AuthService && window.AuthService.isLoggedIn();
    console.log('🔐 Play button - checking auth status:', {
        AuthService: !!window.AuthService,
        isLoggedIn: isLoggedIn,
        gameState: gameState
    });

    if (!isLoggedIn && gameState === 'initial' && !isDemoMode) {
        console.log('👤 User not logged in - showing sign-in reminder modal');
        showSignInReminderModal();
        window.playButtonClicked = false; // Reset so play can be pressed again after modal
        return;
    }

    // If user is logged in, check if they've already completed today's game
    if (isLoggedIn && gameState === 'initial') {
        const hasPlayedToday = await checkIfUserHasPlayedToday();
        if (hasPlayedToday) {
            console.log('🚫 User has already completed today\'s game');
            showAlreadyPlayedModal();
            window.playButtonClicked = false;
            return;
        }
    }

    // Continue with normal play button flow
    continuePlayButtonClick();
}

// Make functions globally available
window.closeSignInReminderModal = closeSignInReminderModal;
window.openSignInFromReminder = openSignInFromReminder;
window.proceedWithoutSignIn = proceedWithoutSignIn;
window.closeAlreadyPlayedModal = closeAlreadyPlayedModal;
window.openPracticeModeFromAlreadyPlayed = openPracticeModeFromAlreadyPlayed;

// Stats System Functions
function calculateScore(leftPercentage, rightPercentage) {
    // NEW SCORING: Use the smaller percentage (0-50 range)
    // Bonus points for perfect 50/50 cuts are added separately by the database trigger
    const leftRounded = Math.round(leftPercentage);
    const rightRounded = Math.round(rightPercentage);

    // Check for TRUE perfect cut: both sides must round to exactly 50
    // This prevents 49/51 from being incorrectly treated as perfect
    if (leftRounded === 50 && rightRounded === 50) {
        return 50; // True perfect cut - eligible for bonus
    }

    // For non-perfect cuts, if one side rounds to 50 but the other doesn't,
    // return 49 to prevent false perfect cut detection
    // Example: 49.6/50.4 rounds to 50/50 (perfect), but 49.4/50.6 rounds to 49/51 (not perfect)
    // Example: 49.5/50.5 rounds to 50/51, so we return 49 (smaller raw percentage floored)
    if (leftRounded === 50 || rightRounded === 50) {
        // One side is 50, check if it's a true 50/50
        if (leftRounded !== rightRounded) {
            // Not both 50, so return the smaller raw percentage floored to prevent false 50
            return Math.floor(Math.min(leftPercentage, rightPercentage));
        }
    }

    // Normal case: return the smaller of the two rounded percentages
    const smallerPct = Math.min(leftRounded, rightRounded);

    return smallerPct;
}

function getCommentary(leftPercentage, rightPercentage) {
    // Round percentages first
    const leftRounded = Math.round(leftPercentage);
    const rightRounded = Math.round(rightPercentage);

    // Check for perfect 50/50 split FIRST
    if (leftRounded === 50 && rightRounded === 50) {
        return "PERFECT CUT!!! 💯";
    }

    // Calculate the smaller percentage (the accuracy metric)
    const smallerPct = Math.min(leftRounded, rightRounded);

    // Commentary based on percentage split ranges (smaller percentage determines accuracy)
    if (smallerPct === 49) {
        return "Amazing! 🌟";
    } else if (smallerPct >= 47 && smallerPct <= 48) {
        return "Excellent! 👏";
    } else if (smallerPct >= 45 && smallerPct <= 46) {
        return "Great job! 👍";
    } else if (smallerPct >= 42 && smallerPct <= 44) {
        return "Nice cut! ✨";
    } else if (smallerPct >= 38 && smallerPct <= 41) {
        return "Good effort! 💪";
    } else if (smallerPct >= 33 && smallerPct <= 37) {
        return "Not bad! 🎯";
    } else if (smallerPct >= 25 && smallerPct <= 32) {
        return "Keep trying! 💫";
    } else {
        // smallerPct 0-24 (including 0/100 invalid cuts)
        return "Shapes can be hard... 🤦";
    }
}

function recordAttemptScore(dayNumber, shapeNumber, leftPercentage, rightPercentage) {
    const score = calculateScore(leftPercentage, rightPercentage);
    const dayKey = `day${dayNumber}`;
    const shapeKey = `shape${shapeNumber}`;
    
    if (!dailyStats[dayKey]) {
        const obj = {};
        for (let s = 1; s <= 10; s++) obj[`shape${s}`] = [];
        dailyStats[dayKey] = obj;
    }

    if (!dailyStats[dayKey][shapeKey]) {
        dailyStats[dayKey][shapeKey] = [];
    }
    
    // Store both score and percentage splits
    const attemptData = {
        score: score,
        leftPercentage: Math.round(leftPercentage * 10) / 10,
        rightPercentage: Math.round(rightPercentage * 10) / 10
    };
    
    dailyStats[dayKey][shapeKey].push(attemptData);
    
    // Save stats to localStorage for persistence across refreshes
    localStorage.setItem('demoGameDailyStats', JSON.stringify(dailyStats));
    
    console.log(`📊 STATS: Recorded score ${score} (${attemptData.leftPercentage}%/${attemptData.rightPercentage}%) for Day ${dayNumber}, Shape ${shapeNumber}`);
    console.log(`📊 STATS: Current stats for ${dayKey}.${shapeKey}:`, dailyStats[dayKey][shapeKey]);
    
    return score;
}

function clearStatsForDay(dayNumber) {
    const dayKey = `day${dayNumber}`;
    if (dailyStats[dayKey]) {
        dailyStats[dayKey] = {
            shape1: [],
            shape2: [],
            shape3: []
        };
        console.log(`📊 STATS: Cleared all stats for Day ${dayNumber}`);
    }
}

function getDayStats(dayNumber) {
    const dayKey = `day${dayNumber}`;
    if (!dailyStats[dayKey]) {
        const obj = {};
        for (let s = 1; s <= 10; s++) obj[`shape${s}`] = [];
        return obj;
    }
    return dailyStats[dayKey];
}

function calculateDayAverage(dayNumber) {
    const dayData = getDayStats(dayNumber);
    const allCutScores = [];

    // STANDARD SCORING: Average of ALL cuts (up to 6 total: 2 per shape)
    Array.from({length: 10}, (_, i) => `shape${i + 1}`).forEach(shapeKey => {
        if (dayData[shapeKey] && dayData[shapeKey].length > 0) {
            // Add ALL attempt scores for this shape
            dayData[shapeKey].forEach(attemptData => {
                const score = typeof attemptData === 'number' ? attemptData : attemptData.score;
                allCutScores.push(score);
            });
        }
    });

    if (allCutScores.length === 0) return 0;

    // Calculate average of ALL cuts (STANDARD method)
    const standardAverage = allCutScores.reduce((sum, score) => sum + score, 0) / allCutScores.length;

    console.log(`📊 STANDARD scoring calculation for completion screen:`);
    console.log(`   All cut scores: [${allCutScores.join(', ')}]`);
    console.log(`   Standard average: ${standardAverage.toFixed(1)}`);

    return Math.round(standardAverage * 10) / 10; // Round to 1 decimal place
}

function getAllScoresForDay(dayNumber) {
    const dayStats = getDayStats(dayNumber);
    const allScores = [];
    
    Array.from({length: 10}, (_, i) => `shape${i + 1}`).forEach(shapeKey => {
        const scores = dayStats[shapeKey] || [];
        scores.forEach(attemptData => {
            const score = typeof attemptData === 'number' ? attemptData : attemptData.score;
            allScores.push(score);
        });
    });
    
    return allScores;
}

function getShapeAveragesForDay(dayNumber) {
    const dayStats = getDayStats(dayNumber);
    const shapeAverages = [];
    
    Array.from({length: 10}, (_, i) => `shape${i + 1}`).forEach(shapeKey => {
        const scores = dayStats[shapeKey] || [];
        if (scores.length > 0) {
            let total = 0;
            scores.forEach(attemptData => {
                const score = typeof attemptData === 'number' ? attemptData : attemptData.score;
                total += score;
            });
            shapeAverages.push(Math.round((total / scores.length) * 10) / 10);
        } else {
            shapeAverages.push(0);
        }
    });
    
    return shapeAverages;
}

async function showDayStatsPopup() {
    console.log('📊 Day completed - showing completion view...');
    
    // Set game state to finished and hide progress tracker
    gameState = 'finished';
    updateProgressUI();
    
    const currentDayStats = getDayStats(currentDay);
    let hasAnyStats = false;
    
    for (const shapeKey of Array.from({length: 10}, (_, i) => `shape${i + 1}`)) {
        if (currentDayStats[shapeKey] && currentDayStats[shapeKey].length > 0) {
            hasAnyStats = true;
            break;
        }
    }
    
    // Mark game as complete and save final stats
    if (dailyGameState) {
        dailyGameState.isGameComplete = true;
        dailyGameState.dayComplete = true;
        dailyGameState.completedAt = Date.now();
        dailyGameState.finalStats = {
            allScores: getAllScoresForDay(currentDay),
            shapeAverages: getShapeAveragesForDay(currentDay),
            dailyAverage: calculateDayAverage(currentDay),
            completedAt: Date.now()
        };
    }

    // Save completion to refresh protection system
    if (window.RefreshProtection) {
        const finalStats = {
            allScores: getAllScoresForDay(currentDay),
            shapeAverages: getShapeAveragesForDay(currentDay),
            dailyAverage: calculateDayAverage(currentDay),
            completedAt: Date.now()
        };
        window.RefreshProtection.saveGameCompletion(finalStats);
    }

    // Save state with completion flag - CRITICAL for refresh protection
    saveDemoGameState();

    // Also save to SimpleRefresh immediately
    if (window.SimpleRefresh) {
        window.SimpleRefresh.save();
        console.log('💾 Saved completion state to SimpleRefresh');
    }
    
    // Save final daily scores to Supabase (all 10 shapes at once)
    if (!isPracticeMode && window.AuthService && window.AuthService.isLoggedIn()) {
        try {
            // Build complete shape scores for all 10 shapes
            const dayStats = getDayStats(currentDay);
            const shapeScores = {};

            for (let i = 1; i <= 10; i++) {
                const shapeKey = `shape${i}`;
                const shapeAttempts = dayStats[shapeKey] || [];

                shapeScores[shapeKey] = {
                    attempt1: shapeAttempts[0] ? (typeof shapeAttempts[0] === 'number' ? shapeAttempts[0] : shapeAttempts[0].score) : null
                };
            }
            
            console.log('💾 Final completion - saving daily scores for all shapes:', JSON.stringify(shapeScores, null, 2));
            
            // Get current date in YYYY-MM-DD format using LOCAL timezone (not UTC)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;

            console.log('📅 Date calculation:', {
                localDate: dateString,
                utcDate: today.toISOString().split('T')[0],
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                timezoneOffset: today.getTimezoneOffset()
            });
            
            // Save final scores to daily_scores table
            const saveResult = await window.AuthService.saveDailyScore(
                dateString,
                shapeScores,
                getCurrentMechanicName()
            );
            
            if (saveResult.success) {
                // Check if score already existed (was not actually saved)
                if (saveResult.alreadyExists) {
                    console.log('⚠️ Score already exists for today - this is a page reload/refresh');
                    console.log('   Message:', saveResult.message);
                    console.log('   Attempting competition update anyway (in case it failed previously)');

                    // Still attempt to update competitions in case the previous attempt failed
                    // The RPC function has duplicate detection, so this is safe
                    if (window.AuthService?.currentUser && window.CompetitionManager && saveResult.additiveScore !== null) {
                        setTimeout(() => {
                            window.CompetitionManager.updateCompetitionScores(
                                window.AuthService.currentUser.id,
                                dateString,
                                saveResult.additiveScore
                            ).catch(error => {
                                console.error('❌ Failed to update competition scores on retry:', error);
                            });
                        }, 100);
                    }
                } else {
                    console.log('✅ Final daily scores saved successfully');

                    // Update competition scores ONLY if this was a new score
                    if (window.AuthService?.currentUser && window.CompetitionManager && saveResult.additiveScore !== null) {
                        setTimeout(() => {
                            window.CompetitionManager.updateCompetitionScores(
                                window.AuthService.currentUser.id,
                                dateString,
                                saveResult.additiveScore
                            ).catch(error => {
                                console.error('❌ Failed to update competition scores:', error);
                            });
                        }, 100);
                    }
                }
            } else if (saveResult.error) {
                console.error('❌ Final daily score save failed:', saveResult.error);
            }
        } catch (error) {
            console.error('❌ Failed to save final daily scores:', error);
        }
    }

    // Show completion view instead of popup (with error handling fallback)
    try {
        if (window.completeView && hasAnyStats) {
            const completionModel = buildCompletionModel(currentDayStats);
            window.completeView.show(completionModel);
        } else {
            // Fallback for no stats - still show basic completion
            const basicModel = {
                dayNumber: currentDay,
                avgScorePct: 0,
                shapes: [],
                bestCut: null,
                // Legacy properties for compatibility
                avgScore: 0,
                shapeSplits: []
            };
            if (window.completeView) {
                window.completeView.show(basicModel);
            }
        }
    } catch (error) {
        console.error('❌ Failed to show completion view:', error);
        // Force show completion view even if there's an error
        if (window.completeView) {
            const fallbackModel = {
                dayNumber: currentDay,
                avgScorePct: 0,
                shapes: [],
                bestCut: null,
                avgScore: 0,
                shapeSplits: []
            };
            try {
                window.completeView.show(fallbackModel);
            } catch (secondError) {
                console.error('❌ Fallback completion view also failed:', secondError);
            }
        }
    }

    // NOTE: Competition prompt modal is now shown after radar animation completes
    // (handled in complete-view.js with proper timing after animation finishes)

    // completeView handles the score display
}

// Draw final scores using crisp HTML text overlay
function drawFinalScoresOnCanvas(dayStats) {
    if (!canvas) return;

    // Remove any existing overlays
    const oldOverlay = document.getElementById('completion-html-overlay');
    if (oldOverlay) {
        oldOverlay.remove();
    }

    // Clear canvas and draw grid
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
    }

    // Create HTML overlay for crisp text - centered in canvas
    const overlay = document.createElement('div');
    overlay.id = 'completion-html-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 85%;
        max-width: 320px;
        pointer-events: none;
        font-family: Arial, sans-serif;
        color: #333;
        text-align: center;
        box-sizing: border-box;
    `;

    let totalScore = 0;
    let html = '<div style="font-size: 20px; font-weight: bold; margin-bottom: 16px; text-align: center;">Today\'s Score</div>';

    // Build score display
    for (let i = 1; i <= 3; i++) {
        const shapeKey = `shape${i}`;
        const shapeAttempts = dayStats[shapeKey] || [];

        html += `<div style="margin-bottom: 12px; text-align: center;">`;
        html += `<div style="font-size: 16px; font-weight: bold; margin-bottom: 6px;">Shape ${i}:</div>`;

        for (let j = 0; j < 2; j++) {
            const attempt = shapeAttempts[j];
            if (attempt) {
                const score = typeof attempt === 'number' ? attempt : attempt.score;
                const leftPct = attempt.leftPercentage || 0;
                const rightPct = attempt.rightPercentage || 0;

                html += `<div style="font-size: 14px; color: #555; margin-bottom: 4px;">`;
                html += `Attempt ${j + 1}: ${leftPct.toFixed(1)}% / ${rightPct.toFixed(1)}% - ${score.toFixed(1)}`;
                html += `</div>`;

                totalScore += score;
            }
        }

        html += `</div>`;
    }

    // Separator and total
    html += `<div style="border-top: 2px solid #ddd; margin: 16px auto; padding-top: 16px; font-size: 20px; font-weight: bold; text-align: center; max-width: 200px;">`;
    html += `Total: ${totalScore.toFixed(1)}`;
    html += `</div>`;

    overlay.innerHTML = html;

    // Insert overlay into canvas container
    const canvasContainer = canvas.parentElement;
    if (canvasContainer) {
        canvasContainer.style.position = 'relative';
        canvasContainer.appendChild(overlay);
        console.log('✅ Created crisp HTML text overlay for scores');
    }
}

// Build completion model from saved finalStats (prevents duplicates)
function buildCompletionModelFromFinalStats(finalStats) {
    console.log('📊 Building completion model from saved finalStats:', finalStats);

    // finalStats contains the data saved at completion time
    // This prevents duplicate attempts from appearing after refresh
    const dayStats = getDayStats(currentDay);

    // Use the buildCompletionModel but ensure we only use data from completion time
    // The finalStats object has allScores, shapeAverages, dailyAverage
    // We need to rebuild the shape-specific structure

    let allCutScores = []; // ALL cut scores (up to 6 total: 2 per shape)
    let shapes = [];
    let globalBestCut = null;
    let globalBestScore = 0;

    // Build from saved day stats - 1 attempt per shape
    for (let shapeIndex = 1; shapeIndex <= 10; shapeIndex++) {
        const shapeKey = `shape${shapeIndex}`;
        let shapeAttempts = [];
        let shapeBestScore = 0;

        if (dayStats[shapeKey] && dayStats[shapeKey].length > 0) {
            // Only take the single attempt per shape
            const validAttempts = dayStats[shapeKey].slice(0, 1);

            validAttempts.forEach((attempt, index) => {
                if (attempt.leftPercentage !== undefined && attempt.rightPercentage !== undefined) {
                    const score = calculateScore(attempt.leftPercentage, attempt.rightPercentage);

                    const attemptData = {
                        n: index + 1,
                        leftPct: attempt.leftPercentage,
                        rightPct: attempt.rightPercentage,
                        scorePct: score
                    };

                    shapeAttempts.push(attemptData);

                    // Add ALL cut scores to the daily average calculation
                    allCutScores.push(score);

                    if (score > shapeBestScore) {
                        shapeBestScore = score;
                    }

                    if (score > globalBestScore) {
                        globalBestScore = score;
                        globalBestCut = {
                            shapeName: `Shape ${shapeIndex}`,
                            leftPct: attempt.leftPercentage,
                            rightPct: attempt.rightPercentage,
                            scorePct: score
                        };
                    }
                }
            });
        }

        if (shapeAttempts.length > 0) {
            shapes.push({
                name: `Shape ${shapeIndex}`,
                shapeNumber: shapeIndex,
                attempts: shapeAttempts
            });
        }
    }

    // Calculate average from ALL cuts (not just best cuts) - override finalStats if needed
    const avgScorePct = allCutScores.length > 0 ?
        (allCutScores.reduce((sum, score) => sum + score, 0) / allCutScores.length) :
        (finalStats.dailyAverage || 0);

    console.log('✅ Completion model built with', shapes.length, 'shapes,', shapes.reduce((sum, s) => sum + s.attempts.length, 0), 'total attempts');

    return {
        dayNumber: currentDay,
        avgScorePct: avgScorePct,
        shapes: shapes,
        bestCut: globalBestCut,
        avgScore: avgScorePct,
        shapeSplits: shapes
    };
}

// Export to window for global access
window.buildCompletionModelFromFinalStats = buildCompletionModelFromFinalStats;

function buildCompletionModel(dayStats) {
    // Build shape-specific data and overall stats
    let allCutScores = []; // ALL cut scores (up to 6 total: 2 per shape)
    let shapes = [];
    let globalBestCut = null;
    let globalBestScore = 0;

    for (let shapeIndex = 1; shapeIndex <= 10; shapeIndex++) {
        const shapeKey = `shape${shapeIndex}`;
        let shapeAttempts = [];
        let shapeBestScore = 0;
        let shapeBestCut = null;

        if (dayStats[shapeKey] && dayStats[shapeKey].length > 0) {
            dayStats[shapeKey].forEach((attempt, index) => {
                if (attempt.leftPercentage !== undefined && attempt.rightPercentage !== undefined) {
                    const score = calculateScore(attempt.leftPercentage, attempt.rightPercentage);

                    const attemptData = {
                        n: index + 1,
                        leftPct: attempt.leftPercentage,
                        rightPct: attempt.rightPercentage,
                        scorePct: score
                    };

                    shapeAttempts.push(attemptData);

                    // Add ALL cut scores to the daily average calculation
                    allCutScores.push(score);

                    // Track best for this shape
                    if (score > shapeBestScore) {
                        shapeBestScore = score;
                        shapeBestCut = attemptData;
                    }

                    // Track global best
                    if (score > globalBestScore) {
                        globalBestScore = score;
                        globalBestCut = {
                            shapeName: `Shape ${shapeIndex}`,
                            leftPct: attempt.leftPercentage,
                            rightPct: attempt.rightPercentage,
                            scorePct: score
                        };
                    }
                }
            });
        }

        if (shapeAttempts.length > 0) {
            shapes.push({
                name: `Shape ${shapeIndex}`,
                shapeNumber: shapeIndex,
                attempts: shapeAttempts
            });
        }
    }

    // Calculate average score from ALL cuts (not just best cuts)
    const avgScorePct = allCutScores.length > 0 ?
        (allCutScores.reduce((sum, score) => sum + score, 0) / allCutScores.length) :
        0;

    return {
        dayNumber: currentDay,
        avgScorePct: avgScorePct,
        shapes: shapes,
        bestCut: globalBestCut,
        // Legacy properties for compatibility
        avgScore: avgScorePct,
        shapeSplits: shapes
    };
}

function showDayStatsContent(day) {
    const content = document.getElementById('statsContent');
    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayStats = getDayStats(day);
    const dayAverage = calculateDayAverage(day);
    
    let html = `
        <div class="day-summary">
            <h3>${dayNames[day]} Complete!</h3>
            <div class="total-score">Average Score: ${dayAverage.toFixed(1)}/100</div>
            <div class="shapes-summary">
    `;
    
    Array.from({length: 10}, (_, i) => `shape${i + 1}`).forEach((shapeKey, index) => {
        const shapeNumber = index + 1;
        const scores = dayStats[shapeKey] || [];
        
        // Skip shapes with no attempts
        if (scores.length === 0) return;
        
        html += `
            <div class="shape-result">
                <div class="shape-header">Shape ${shapeNumber}</div>
                <div class="attempts-list">
        `;
        
        scores.forEach((attemptData, attemptIndex) => {
            // Handle both old format (number) and new format (object)
            const score = typeof attemptData === 'number' ? attemptData : attemptData.score;
            const leftPct = typeof attemptData === 'object' ? attemptData.leftPercentage : null;
            const rightPct = typeof attemptData === 'object' ? attemptData.rightPercentage : null;
            
            html += `<div class="attempt-score${attemptIndex === scores.length - 1 ? ' best' : ''}">`;
            html += `Attempt ${attemptIndex + 1}: ${score}/100`;
            if (leftPct !== null && rightPct !== null) {
                html += `<span class="split-percentages">${leftPct.toFixed(1)}% / ${rightPct.toFixed(1)}%</span>`;
            }
            html += `</div>`;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        <div style="text-align: center; margin-top: 30px;">
            <button onclick="closeStatsWindow()" style="padding: 12px 24px; font-size: 16px; background: #6496ff; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Continue
            </button>
        </div>
    `;
    
    content.innerHTML = html;
}

function showStatsWindow() {
    const overlay = document.getElementById('statsOverlay');
    const content = document.getElementById('statsContent');
    
    // Check if there are any stats at all
    let hasAnyStats = false;
    for (let day = 1; day <= 7; day++) {
        const dayStats = getDayStats(day);
        Array.from({length: 10}, (_, i) => `shape${i + 1}`).forEach(shapeKey => {
            if (dayStats[shapeKey] && dayStats[shapeKey].length > 0) {
                hasAnyStats = true;
            }
        });
    }
    
    if (!hasAnyStats) {
        content.innerHTML = `
            <div class="no-attempts" style="text-align: center; padding: 40px; font-size: 16px;">
                <p style="margin-bottom: 20px;">📊 No attempts recorded yet!</p>
                <p style="color: #6c757d;">Start playing to see your scores and stats here.</p>
            </div>
        `;
        overlay.style.display = 'flex';
        return;
    }
    
    // Build stats content
    let html = '';
    
    for (let day = 1; day <= 7; day++) {
        const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayStats = getDayStats(day);
        const dayAverage = calculateDayAverage(day);
        
        // Skip days with no data
        const dayHasData = Array.from({length: 10}, (_, i) => `shape${i + 1}`).some(shapeKey => 
            dayStats[shapeKey] && dayStats[shapeKey].length > 0
        );
        
        if (!dayHasData) continue;
        
        html += `
            <div class="day-summary">
                <h3>${dayNames[day]} (Day ${day})</h3>
                <div class="total-score">Average Score: ${dayAverage.toFixed(1)}/100</div>
                <div class="shapes-summary">
        `;
        
        Array.from({length: 10}, (_, i) => `shape${i + 1}`).forEach((shapeKey, index) => {
            const shapeNumber = index + 1;
            const scores = dayStats[shapeKey] || [];
            
            // Skip shapes with no attempts
            if (scores.length === 0) return;
            
            html += `
                <div class="shape-result">
                    <div class="shape-header">Shape ${shapeNumber}</div>
                    <div class="attempts-list">
            `;
            
            scores.forEach((attemptData, attemptIndex) => {
                // Handle both old format (number) and new format (object)
                const score = typeof attemptData === 'number' ? attemptData : attemptData.score;
                const leftPct = typeof attemptData === 'object' ? attemptData.leftPercentage : null;
                const rightPct = typeof attemptData === 'object' ? attemptData.rightPercentage : null;
                
                const allScores = scores.map(s => typeof s === 'number' ? s : s.score);
                const bestScore = Math.max(...allScores);
                const isBest = score === bestScore && scores.length > 1;
                
                html += `
                    <div class="attempt-score ${isBest ? 'best' : ''}">
                        Attempt ${attemptIndex + 1}<br>
                        <strong>${score.toFixed(1)}/100</strong>
                        ${leftPct !== null && rightPct !== null ? 
                            `<br><small class="split-percentages">${leftPct}% | ${rightPct}%</small>` : ''
                        }
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    overlay.style.display = 'flex';
}

function closeStatsWindow() {
    const overlay = document.getElementById('statsOverlay');
    overlay.style.display = 'none';
}

// Close stats window when clicking outside of it
document.addEventListener('DOMContentLoaded', function() {
    const overlay = document.getElementById('statsOverlay');
    if (overlay) {
        overlay.addEventListener('click', function(event) {
            if (event.target === overlay) {
                closeStatsWindow();
            }
        });
    }
});

function setupDemoEventListeners() {
    console.log('🎧 Setting up Demo Game event listeners...');
    
    // Day selector dropdown (optional - for demo/test mode)
    const daySelect = document.getElementById('daySelect');
    
    if (daySelect) {
        console.log('✅ Found daySelect, adding event listener');
        daySelect.addEventListener('change', async function() {
            const selectedDay = parseInt(daySelect.value);
            console.log('📅 Day selected:', selectedDay);
            
            // Clear stats for the selected day when switching
            clearStatsForDay(selectedDay);
            
            currentDay = selectedDay;
            currentShapeNumber = 1;
            currentAttemptNumber = 1;
            
            // Save state after day selection
            saveDemoGameState();
            
            // Hide any existing button
            hideProgressionButton();
            
            await loadDemoDay(selectedDay);
            
            // Update UI for new day
            createProgressUI();
        });
    } else {
        console.log('📌 Day selector not present - using current day');
    }
    
    // Canvas event listeners will be setup during day loading, not here
    
    console.log('✅ Demo Game event listeners setup complete');
}

async function loadDemoDay(dayNumber) {
    try {
        console.log(`🔄 Loading demo day ${dayNumber}`);
        
        // Reset game state for new day
        resetDemoGame();
        
        // Set the current day
        currentDay = dayNumber;
        currentShapeNumber = 1;
        currentDemoAttempt = 0;
        
        // Load the mechanic for this day (but don't initialize yet)
        const mechanicClassName = dayMechanics[dayNumber];
        console.log(`🔧 Day ${dayNumber} selected - Loading mechanic: ${mechanicClassName}`);
        loadDemoMechanic(mechanicClassName, false); // false = don't initialize yet
        
        // Load the first shape for this day
        await loadDemoShape(dayNumber, 1);
        
        // Initialize the mechanic after shapes are loaded
        if (currentMechanic && currentMechanic.init) {
            console.log('🔧 Initializing mechanic after shapes loaded');
            currentMechanic.init();
            
            // Setup canvas event listeners after mechanic initialization
            console.log('🔧 Setting up canvas interaction after mechanic init');
            setupMechanicsEventListeners();
        }
        
        // Keep canvas inactive until animation completes
        setGameState('cutting');
        setInteractionEnabled(false);
        isShapeAnimationComplete = false; // Reset animation flag
        
        // Keep canvas pointer events disabled until ready
        const canvasElement = document.getElementById('geoCanvas');
        if (canvasElement) {
            canvasElement.style.pointerEvents = 'none';
            console.log('🔧 Canvas pointer-events set to none - waiting for animation');
        }
        
        console.log(`✅ Demo day ${dayNumber} loaded successfully - canvas inactive until animation completes`);
        
    } catch (error) {
        console.error(`💥 Error loading demo day ${dayNumber}:`, error);
    }
}

// Load shape from Supabase via DailyGameCore
async function loadSupabaseShape(dayNumber, shapeNumber) {
    console.log(`🔗 Loading Supabase shape: day${dayNumber}, shape${shapeNumber}`);

    try {
        let shapeData = null;

        // Debug DailyGameCore state
        console.log('🔍 DEBUG: DailyGameCore exists?', !!window.DailyGameCore);
        console.log('🔍 DEBUG: DailyGameCore.getShapeData exists?', !!(window.DailyGameCore && window.DailyGameCore.getShapeData));

        // Try to get shape from DailyGameCore first
        if (window.DailyGameCore && window.DailyGameCore.getShapeData) {
            shapeData = window.DailyGameCore.getShapeData(shapeNumber);
            console.log('🔍 DEBUG: DailyGameCore.getShapeData returned:', !!shapeData);
        }

        // If DailyGameCore doesn't have the shape, try dailyModeManager directly
        if (!shapeData) {
            console.log('🔍 DEBUG: Trying to get shape directly from dailyModeManager...');
            console.log('🔍 DEBUG: window.dailyModeManager exists?', !!window.dailyModeManager);
            console.log('🔍 DEBUG: window.dailyModeManager.shapes exists?', !!(window.dailyModeManager && window.dailyModeManager.shapes));

            if (window.dailyModeManager && window.dailyModeManager.shapes) {
                console.log('🔍 DEBUG: dailyModeManager.shapes.length:', window.dailyModeManager.shapes.length);
                console.log('🔍 DEBUG: dailyModeManager.shapes:', window.dailyModeManager.shapes);

                if (shapeNumber >= 1 && shapeNumber <= window.dailyModeManager.shapes.length) {
                    shapeData = window.dailyModeManager.shapes[shapeNumber - 1]; // Convert to 0-based index
                    console.log('🔍 DEBUG: Got shape directly from dailyModeManager:', !!shapeData);
                    console.log('🔍 DEBUG: Shape data type:', typeof shapeData);
                    if (shapeData) {
                        console.log('🔍 DEBUG: Shape data keys:', Object.keys(shapeData));
                    }
                } else {
                    console.log('🔍 DEBUG: Shape number out of range:', shapeNumber, 'available:', window.dailyModeManager.shapes.length);
                }
            } else {
                console.log('🔍 DEBUG: dailyModeManager or shapes not available');
            }
        }

        if (!shapeData) {
            throw new Error(`Shape ${shapeNumber} not available from either DailyGameCore or dailyModeManager`);
        }

        console.log('✅ Supabase shape retrieved successfully');

        // Set global references for game engine
        window.loadedGeoJSON = shapeData;
        window.currentGeoJSON = shapeData;
        loadedGeoJSON = shapeData;

        // Parse the geometry
        if (window.parseGeometry) {
            const parseResult = window.parseGeometry(shapeData);
            parsedShapes = parseResult.shapes;
            window.parsedShapes = parsedShapes;

            console.log(`🎨 Parsed ${parsedShapes.length} shapes from Supabase GeoJSON`);
        }

        // Load and initialize the appropriate mechanic for this day
        const mechanicClassName = dayMechanics[dayNumber];
        if (mechanicClassName && window.loadDemoMechanic) {
            console.log(`🔧 Loading mechanic: ${mechanicClassName}`);
            window.loadDemoMechanic(mechanicClassName, true); // true = initialize after loading
        }

        // Set up canvas interaction
        console.log('🔧 Setting up canvas interaction');
        window.setupMechanicsEventListeners && window.setupMechanicsEventListeners();

        // Update game state
        setGameState('cutting');
        setInteractionEnabled(false); // Will be enabled after animation

        console.log('✅ Supabase shape loaded and game ready');

    } catch (error) {
        console.error('❌ Failed to load Supabase shape:', error);
        // Fallback to demo shapes
        console.log('🔄 Falling back to demo shapes');
        await loadDemoDay(dayNumber);
    }
}

// Demo shape loading functionality removed - this game uses practice shapes only
async function loadDemoShape(dayNumber, shapeNumber) {
    console.log(`📁 Loading demo shape: day${dayNumber}, shape${shapeNumber}`);
    
    try {
        const shapePath = `v4-tests/day${dayNumber}/shape${shapeNumber}.geojson`;
        console.log(`🔍 Fetching shape from: ${shapePath}`);
        
        const response = await fetch(shapePath);
        if (!response.ok) {
            throw new Error(`Failed to load shape: ${response.status} ${response.statusText}`);
        }
        
        const geoJSON = await response.json();
        console.log(`✅ Demo shape loaded: ${shapePath}`);
        
        // Parse and set the shapes
        const parseResult = parseGeometry(geoJSON);
        parsedShapes = parseResult.shapes;
        window.parsedShapes = parsedShapes; // Make shapes globally available for cutting mechanics

        console.log(`📐 Parsed ${parsedShapes.length} shapes for day ${dayNumber}, shape ${shapeNumber}`);

        // CRITICAL: Initialize rotating mechanic with new shapes if it's active
        if (currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut" && typeof currentMechanic.initializeWithShapes === 'function') {
            console.log('🔄 SHAPES LOADED: Initializing rotating mechanic with new shapes');
            currentMechanic.initializeWithShapes();
        }

        // Render the shapes (unless doing fresh start with animation OR restoring state)
        if (parsedShapes.length > 0) {
            if (!window.freshGameStart && !window.isRestoringGameState) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawGrid(ctx);
                renderShapeForCutting(parsedShapes);
                console.log(`🎨 Demo shape rendered successfully`);
            } else if (window.isRestoringGameState) {
                console.log('🔄 Skipped initial rendering - restoring game state with saved canvas');
                // Restore the canvas after a short delay to ensure everything is ready
                setTimeout(() => {
                    if (window.pendingCanvasRestoration && window.canvas && window.ctx) {
                        console.log('🎨 Restoring canvas state with cut shading after shape load');
                        const img = new Image();
                        img.onload = function() {
                            window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
                            window.ctx.drawImage(img, 0, 0);
                            console.log('✅ Canvas state with cut shading restored');

                            // Clear the pending restoration and flag
                            window.pendingCanvasRestoration = null;
                            window.isRestoringGameState = false;
                            console.log('🔄 Cleared isRestoringGameState flag - restoration complete');

                            // CRITICAL: Start rotation AFTER canvas is restored (for rotating shape mechanic)
                            if (currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut" &&
                                typeof currentMechanic.startRotation === 'function' && !currentMechanic.isRotating) {
                                console.log('🔄 Starting rotation after canvas restoration');
                                currentMechanic.startRotation();
                            }
                        };
                        img.src = window.pendingCanvasRestoration;
                    } else {
                        // No canvas data to restore, just clear the flag
                        window.isRestoringGameState = false;
                        console.log('🔄 Cleared isRestoringGameState flag - no canvas to restore');

                        // Still start rotation if needed (no canvas to restore but mechanic needs rotation)
                        if (currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut" &&
                            typeof currentMechanic.startRotation === 'function' && !currentMechanic.isRotating) {
                            console.log('🔄 Starting rotation (no canvas to restore)');
                            currentMechanic.startRotation();
                        }
                    }
                }, 200);
            } else {
                console.log('🎬 Skipped immediate rendering in loadDemoShape - will use fade-in animation');
            }
        }
        
    } catch (error) {
        console.error(`❌ Failed to load demo shape: day${dayNumber}, shape${shapeNumber}`, error);
        throw error;
    }
}

// Orphaned code removed from old loadDemoShape function

function resetDemoGame() {
    console.log('🔄 Resetting Demo Game...');
    
    // Clean up current mechanic first (critical for Sunday's rotating mechanic)
    if (currentMechanic && currentMechanic.reset) {
        console.log('🧹 Cleaning up current mechanic before reset');
        currentMechanic.reset();
    }
    currentMechanic = null;
    
    // Reset all game state
    currentGeoJSON = null;
    parsedShapes = [];
    currentAttempts = [];
    
    console.log('✅ Demo Game reset complete');
}

/* ORPHANED CODE FROM DELETED FUNCTION - COMMENTED OUT TO FIX SYNTAX ERROR
        if (shapeNumber === 1) {
            currentAttemptNumber = 1;  // Reset to attempt 1 for new shape
        }
        
        // Reset instructions to initial state for new shape (unless game is complete)
        // Check if we're loading for a completed game
        const isLoadingForCompletedGame = (window.dailyGameState && (window.dailyGameState.dayComplete || window.dailyGameState.isGameComplete)) ||
                                          (window.restoredState && (window.restoredState.dayComplete || window.restoredState.isGameComplete));
        
        if (!isLoadingForCompletedGame) {
            resetInstructionsToInitial();
        } else {
            console.log('📝 Skipping instruction reset - game is complete');
        }
        
        gameState = 'cutting';
        isInteractionEnabled = true;
        
        // Hide percentage table when loading new shape
        const percentageDisplay = document.getElementById('percentageDisplay');
        if (percentageDisplay) {
            percentageDisplay.style.display = 'none';
        }
        
        // Hide attempt display when loading new shape
        const attemptDisplay = document.getElementById('attemptDisplay');
        if (attemptDisplay) {
            attemptDisplay.style.display = 'none';
        }
        
        // Reinitialize current mechanic for new shape (especially important for rotating mechanics)
        if (currentMechanic && currentMechanic.init) {
            console.log('🔄 Reinitializing mechanic for new shape:', currentMechanic.name);
            currentMechanic.init();
            
            // Canvas interaction is already setup during day loading, no need to repeat here
        }
        
        // Redraw canvas to ensure new shape is visible (unless restoring or doing fresh start with animation)
        if (!window.restoreGameState && !window.freshGameStart) {
            console.log('🎨 Redrawing canvas after shape load to make shape visible');
            redrawCanvas();
        } else if (window.restoreGameState) {
            console.log('🔄 Skipped redrawCanvas in loadDemoShape during restoration');
        } else if (window.freshGameStart) {
            console.log('🎬 Skipped redrawCanvas in loadDemoShape - will use fade-in animation');
        }
        
        // If this is day 7 (Sunday) with rotating mechanic, ensure rotation starts
        if (dayNumber === 7 && currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut") {
            console.log('🌀 IMMEDIATE: Day 7 shape loaded - forcing rotation setup');
            console.log('🌀 Current mechanic rotation state:', currentMechanic.isRotating);
            // Try immediately first
            if (currentMechanic.setupRotation) {
                currentMechanic.setupRotation();
            }
            // Also try with a delay as backup
            setTimeout(() => {
                console.log('🌀 DELAYED: Day 7 shape loaded - ensuring rotation is active');
                if (!currentMechanic.isRotating && currentMechanic.setupRotation) {
                    console.log('🌀 DELAYED: Starting rotation for day 7 shape');
                    currentMechanic.setupRotation();
                }
            }, 100);
            // And one more aggressive attempt
            setTimeout(() => {
                console.log('🌀 AGGRESSIVE: Final rotation attempt');
                if (!currentMechanic.isRotating && currentMechanic.setupRotation) {
                    currentMechanic.setupRotation();
                }
                // Force a redraw if rotation started
                if (currentMechanic.isRotating && currentMechanic.drawCurrentState) {
                    currentMechanic.drawCurrentState();
                }
            }, 500);
        }
    }
}

function resetDemoGame() {
    console.log('🔄 Resetting Demo Game...');
    
    // Clean up current mechanic first (critical for Sunday's rotating mechanic)
    if (currentMechanic && currentMechanic.reset) {
        console.log('🧹 Cleaning up current mechanic before reset');
        currentMechanic.reset();
    }
    currentMechanic = null;
    
    // Reset all game state
    currentGeoJSON = null;
    parsedShapes = [];
    currentAttempts = [];
    attemptCount = 0;
    currentDemoAttempt = 0;
    currentShapeNumber = 1;
    currentAttemptNumber = 1;
    window.currentShapeNumber = currentShapeNumber;  // BULLETPROOF REFRESH: Sync window property
    window.currentAttemptNumber = currentAttemptNumber;  // BULLETPROOF REFRESH: Sync window property
    gameState = 'initial';
    isInteractionEnabled = false;
    
    // Clear the canvas and redraw grid
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    // Clear any commentary
    hideCommentary();
    clearResultsTable();
    
    // Hide percentage table
    const percentageDisplay = document.getElementById('percentageDisplay');
    if (percentageDisplay) {
        percentageDisplay.style.display = 'none';
    }
    
    // Hide attempt display
    const attemptDisplay = document.getElementById('attemptDisplay');
    if (attemptDisplay) {
        attemptDisplay.style.display = 'none';
    }
    
    // Hide progression button
    hideProgressionButton();
    
    console.log('✅ Demo Game reset complete');
}
*/

function loadDemoMechanic(mechanicClassName, shouldInitialize = true) {
    try {
        console.log(`🔧 Loading demo mechanic: ${mechanicClassName}`);
        
        // Get the mechanic class from global scope
        const MechanicClass = window[mechanicClassName];
        console.log('🔧 Looking for mechanic class:', mechanicClassName, 'Found:', !!MechanicClass);
        if (!MechanicClass) {
            throw new Error(`Mechanic class ${mechanicClassName} not found`);
        }
        
        // Load the new mechanic
        currentMechanic = MechanicClass;
        window.currentMechanic = MechanicClass;
        
        console.log('🔧 Mechanic loaded:', currentMechanic.name);
        console.log('🔧 Mechanic has performVectorCut:', typeof currentMechanic.performVectorCut);
        
        // Ensure game state is correct for interaction if we have a shape loaded
        if (parsedShapes && parsedShapes.length > 0) {
            setGameState('cutting');
            setInteractionEnabled(true);
            console.log('🎮 Game state set to cutting with interaction enabled');
        }
        
        // Only initialize if requested (after shapes are loaded)
        if (shouldInitialize) {
            // Initialize the mechanic first
            currentMechanic.init();
            
            // Canvas interaction setup is handled in loadDemoDay(), not here to avoid conflicts
            
            // Special handling for RotatingShapeVectorMechanic
            if (mechanicClassName === 'RotatingShapeVectorMechanic') {
                console.log('🌀 Loading RotatingShapeVectorMechanic');
                console.log('🌀 Special init for RotatingShapeVectorMechanic - ensuring rotation starts');
                // Delay rotation setup to ensure shapes are fully loaded
                setTimeout(() => {
                    if (currentMechanic && currentMechanic.setupRotation && !currentMechanic.isRotating) {
                        console.log('🌀 Forcing rotation setup with delay...');
                        currentMechanic.setupRotation();
                    } else if (currentMechanic && currentMechanic.isRotating) {
                        console.log('🌀 Rotation already active');
                    } else {
                        console.warn('🌀 Cannot setup rotation - mechanic not available');
                    }
                }, 100);
            }
        }
        
        console.log(`✅ Mechanic ${mechanicClassName} loaded successfully`);
        
    } catch (error) {
        console.error(`💥 Error loading mechanic ${mechanicClassName}:`, error);
        currentMechanic = null;
    }
}

// Demo Game UI Functions
function createProgressUI() {
    // Use existing progress display element from HTML to prevent layout shifts
    const progressDisplay = document.getElementById('demoProgressDisplay');
    if (!progressDisplay) {
        console.error('❌ Progress display element not found in HTML');
        return;
    }
    
    // Keep progress display hidden during initialization - it will be shown in startGame()
    progressDisplay.style.visibility = 'hidden';
    
    // Element styling is handled by CSS - just update content without showing
    updateProgressUI();
}

function updateProgressUI() {
    const progressDisplay = document.getElementById('demoProgressDisplay');
    if (!progressDisplay) {
        console.error('❌ Progress display element not found!');
        return;
    }
    
    // Only show progress if game has actually started and is not complete
    // Also show progress when gameState is 'playing' (right after play button is pressed)
    const shouldShowProgress = (gameState !== 'initial' && 
                               gameState !== 'welcome' && 
                               gameState !== 'finished' && 
                               gameState !== 'locked' && 
                               gameState !== 'completed') || 
                               gameState === 'playing';
    
    // Log current state before changes
    console.log('📊 Progress display before changes:');
    console.log('   - inline style:', progressDisplay.style.cssText);
    console.log('   - computed display:', window.getComputedStyle(progressDisplay).display);
    console.log('   - computed opacity:', window.getComputedStyle(progressDisplay).opacity);
    console.log('   - should show:', shouldShowProgress, '(gameState:', gameState, ')');
    
    if (shouldShowProgress) {
        // Game has started, show progress display
        progressDisplay.style.setProperty('visibility', 'visible', 'important');
        progressDisplay.style.setProperty('display', 'block', 'important');
        progressDisplay.style.setProperty('opacity', '1', 'important');
    } else {
        // Game hasn't started, keep progress hidden
        // Don't use !important so CSS media queries can override this for desktop
        progressDisplay.style.setProperty('display', 'none');
        progressDisplay.style.setProperty('visibility', 'hidden');
    }
    
    // Show the current state - "Shape X of 10"
    const totalShapes = window.devvitTotalShapes || 10;
    if (!window.isPracticeMode && window.isDailyMode) {
        progressDisplay.innerHTML = `<span style="color: #00798C;">Shape ${currentShapeNumber}</span> of ${totalShapes}`;
    } else {
        progressDisplay.textContent = `Shape ${currentShapeNumber} of ${totalShapes}`;
    }

    console.log('📊 Progress UI updated: Shape', currentShapeNumber, 'of', totalShapes);
    console.log('🎮 Game state:', gameState, '| Interaction enabled:', isInteractionEnabled);
}

function createProgressionButton() {
    console.log('🎮 createProgressionButton called');
    console.log('🎮 Current state when creating button:', {
        currentAttemptNumber,
        currentShapeNumber,
        cutsMadeThisShape,
        totalCutsMade,
        isDemoMode,
        isDailyMode,
        gameState
    });

    // Remove any existing button to allow new button type
    const existingButton = document.querySelector('.progression-button');
    if (existingButton) {
        console.log('🔄 Removing existing button to create new one');
        existingButton.remove();
    }
    
    // Always use fixed button area - NO EXCEPTIONS
    const fixedButtonArea = document.getElementById('fixedButtonArea');
    if (!fixedButtonArea) {
        console.error('❌ Fixed button area not found');
        return;
    }
    
    // Ensure the fixed button area is ready and properly positioned
    fixedButtonArea.style.setProperty('display', 'flex', 'important');  // Match CSS: display: flex
    fixedButtonArea.style.setProperty('visibility', 'visible', 'important');
    // REMOVED: Let CSS handle positioning - no JavaScript positioning overrides
    fixedButtonArea.style.setProperty('pointer-events', 'auto', 'important');
    console.log('🔘 Fixed button area styles applied');
    
    // Always clear existing buttons to allow new button type
    // This ensures Next Attempt can be replaced with Next Shape
    fixedButtonArea.innerHTML = '';
    
    console.log('🔘 Fixed button area cleared for new button:', fixedButtonArea);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'demoProgressionButton';
    buttonContainer.className = 'demo-progression-button-container';

    // Detect small phone layout (iPhone SE 375x547)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const containerMargin = isSmallPhone ? '-26px 0' : '10px 0';
    const containerPadding = isSmallPhone ? '2px' : '10px';

    // Clean styling with forced visibility
    buttonContainer.style.cssText = `
        width: 100%;
        text-align: center;
        margin: ${containerMargin};
        padding: ${containerPadding};
        visibility: visible !important;
        display: block !important;
        opacity: 1 !important;
    `;
    
    const button = document.createElement('button');
    button.className = 'progression-button';
    button.style.cssText = `
        padding: 8px 16px;
        font-size: 16px;
        font-weight: bold;
        background-color: #FFC8E2;
        color: black;
        border: 2px solid #000;
        border-radius: 16px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        position: relative;
        z-index: 1000;
        pointer-events: auto;
        visibility: visible !important;
        display: inline-block !important;
        opacity: 1 !important;
        box-shadow: 2px 2px 0px #000;
    `;
    
    // Determine button text based on current state
    let buttonText = '';
    let clickHandler = null;
    
    console.log('🔘 Button decision - Attempt:', currentAttemptNumber, 'Shape:', currentShapeNumber);
    
    if (currentShapeNumber < 10) {
        // Just finished cut on shapes 1-9 - move to next shape
        buttonText = 'Next Shape';
        clickHandler = handleNextShape;
        console.log('🔘 Showing: Next Shape (load shape', currentShapeNumber + 1, ')');

    } else if (currentShapeNumber >= 10) {
        // Just finished cut on shape 10 - show day stats
        console.log('🔘 Day complete - showing stats popup');

        // CRITICAL: Save state BEFORE delay to prevent loss on refresh
        if (window.SimpleRefresh && window.SimpleRefresh.save) {
            window.SimpleRefresh.save();
            console.log('💾 State saved before completion delay');
        }

        // Reduced delay from 1500ms to 500ms to minimize race condition window
        setTimeout(() => {
            showDayStatsPopup();
        }, 500); // 0.5 second delay to let user see final results
        return; // Exit early, no button needed
    }

    console.log('🔘 Button text determined:', buttonText);
    console.log('🔘 Click handler determined:', clickHandler?.name || 'none');

    if (!buttonText) {
        console.error('❌ No button text determined! State:', {
            currentAttemptNumber,
            currentShapeNumber,
            cutsMadeThisShape
        });
        return; // Don't create empty button
    }

    button.textContent = buttonText;
    button.addEventListener('click', (event) => {
        console.log('🔘 Button clicked!', buttonText, 'Handler:', clickHandler?.name || 'unknown');
        console.log('🔘 Current game state:', gameState, 'Interaction enabled:', isInteractionEnabled);
        console.log('🔘 Current position - Shape:', currentShapeNumber, 'Attempt:', currentAttemptNumber, 'Cuts this shape:', cutsMadeThisShape);
        event.preventDefault();
        event.stopPropagation();
        if (clickHandler) {
            try {
                console.log('🔘 About to execute handler:', clickHandler.name);
                clickHandler();
                console.log('✅ Click handler executed successfully');
                console.log('🔘 After handler - Shape:', currentShapeNumber, 'Attempt:', currentAttemptNumber);
            } catch (error) {
                console.error('❌ Error executing click handler:', error);
                console.error('Stack:', error.stack);
            }
        } else {
            console.error('❌ No click handler defined for button:', buttonText);
        }
    });
    
    // Hover effect
    button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#FFB3D9';
    });
    button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#FFC8E2';
    });
    
    buttonContainer.appendChild(button);
    fixedButtonArea.appendChild(buttonContainer);
    
    console.log('🔘 Created progression button:', buttonText, '(just completed attempt', currentAttemptNumber, 'of shape', currentShapeNumber + ')');
    
    // Test if button is clickable
    setTimeout(() => {
        const testButton = document.querySelector('#demoProgressionButton button');
        if (testButton) {
            console.log('🔘 Button found in DOM:', testButton);
            console.log('🔘 Button clickable test:');
            console.log('   - offsetWidth:', testButton.offsetWidth);
            console.log('   - offsetHeight:', testButton.offsetHeight);
            console.log('   - visibility:', window.getComputedStyle(testButton).visibility);
            console.log('   - pointer-events:', window.getComputedStyle(testButton).pointerEvents);
            console.log('   - z-index:', window.getComputedStyle(testButton).zIndex);
            console.log('   - position:', testButton.getBoundingClientRect());
            
            // Add a direct click test listener
            testButton.onclick = function() {
                console.log('🔘 Direct onclick fired!');
            };
        } else {
            console.error('❌ Button not found in DOM after creation');
        }
    }, 500);
    
    // Save current state after button creation
    if (window.SimpleRefresh && window.SimpleRefresh.save) {
        window.SimpleRefresh.save();
        console.log('💾 State saved after button creation');
    }
    
    // Button created - step recorder will handle the click tracking
}

function hideProgressionButton() {
    const button = document.getElementById('demoProgressionButton');
    if (button) {
        button.style.display = 'none';
    }
}

function showProgressionButton() {
    const button = document.getElementById('demoProgressionButton');
    if (button) {
        button.style.display = 'block';
    }
}

// Button Click Handlers
function handleNextAttempt() {
    console.log('🔘 Next Attempt clicked - moving to attempt 2 of shape', currentShapeNumber);
    console.log('🔘 Current state before: Shape', currentShapeNumber, 'Attempt', currentAttemptNumber, 'Cuts', cutsMadeThisShape);
    
    hideProgressionButton();
    
    // Hide split-display elements
    const splitDisplays = document.querySelectorAll('.split-display-large');
    splitDisplays.forEach(display => {
        if (display.closest('.attempt-result')) {
            display.closest('.attempt-result').style.display = 'none';
        }
    });
    
    // Clear fixed percentage area to remove any split-display elements
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (fixedPercentageArea) {
        fixedPercentageArea.innerHTML = '';
    }
    
    // Move to attempt 2 of same shape
    currentAttemptNumber = 2;
    
    // CRITICAL: Increment totalCutsMade to mark button progression
    totalCutsMade++;
    console.log('🔘 Next Attempt: Incremented totalCutsMade to', totalCutsMade);
    
    // BULLETPROOF REFRESH: Sync window properties
    window.currentAttemptNumber = currentAttemptNumber;
    window.totalCutsMade = totalCutsMade;
    
    // Save state after moving to next attempt
    saveDemoGameState();
    
    updateProgressUI();
    
    // Reset canvas for next attempt on same shape
    console.log('🔘 About to call resetForNextAttempt');
    resetForNextAttempt();
    console.log('🔘 resetForNextAttempt completed');
    
    // Reset instructions to initial state for consistency
    resetInstructionsToInitial();
    
    console.log('🔘 AFTER handleNextAttempt - gameState:', gameState, 'isInteractionEnabled:', isInteractionEnabled);
}

function handleNextShape() {
    console.log('🔘 Next Shape clicked - current shape:', currentShapeNumber);
    
    hideProgressionButton();
    
    // Hide split-display elements
    const splitDisplays = document.querySelectorAll('.split-display-large');
    splitDisplays.forEach(display => {
        if (display.closest('.attempt-result')) {
            display.closest('.attempt-result').style.display = 'none';
        }
    });
    
    // Clear fixed percentage area to remove any split-display elements
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (fixedPercentageArea) {
        fixedPercentageArea.innerHTML = '';
    }
    
    // Move to next shape and reset attempt counter
    if (currentShapeNumber < 10) {
        currentShapeNumber++;
        currentAttemptNumber = 1; // Reset to attempt 1 for new shape
        cutsMadeThisShape = 0; // CRITICAL: Reset shape cut counter
        
        // CRITICAL: Increment totalCutsMade to mark button progression
        totalCutsMade++;
        console.log('🔘 Next Shape: Incremented totalCutsMade to', totalCutsMade);
        
        // BULLETPROOF REFRESH: Sync all counters
        window.cutsMadeThisShape = cutsMadeThisShape; 
        window.currentShapeNumber = currentShapeNumber;  
        window.currentAttemptNumber = currentAttemptNumber;
        window.totalCutsMade = totalCutsMade;
        
        // Save state after advancing to next shape
        saveDemoGameState();
        
        console.log('🔘 Moving to shape', currentShapeNumber, 'attempt', currentAttemptNumber);
        console.log('🔘 Reset cutsMadeThisShape to 0 for new shape');
    }
    
    updateProgressUI();
    
    
    // Load the next shape and activate canvas for cutting
    setTimeout(async () => {
        // Clear restore flag to ensure canvas gets redrawn
        window.restoreGameState = false;
        console.log('🔧 Cleared restoreGameState to force canvas redraw');

        // CRITICAL FIX: Clear currentVector from previous shape to prevent coordinate persistence
        currentVector = null;
        window.currentVector = null;
        globalThis.currentVector = null;
        console.log('🚫 Cleared currentVector to prevent coordinate persistence from previous shape');

        // CRITICAL FIX: Set flag to prevent canvas state capture during shape transition
        window.skipCanvasCaptureAfterShapeTransition = true;
        console.log('🚫 Set flag to skip canvas capture during shape transition');

        // CRITICAL FIX: Clear canvas before loading new shape to prevent shading persistence
        if (window.ctx && window.canvas) {
            window.ctx.clearRect(0, 0, canvas.width, canvas.height);
            console.log('🧹 Cleared canvas before loading new shape');
        }

        // Load next shape - use Supabase if available, otherwise demo
        if (window.supabaseIntegrationActive && window.DailyGameCore) {
            console.log('🔗 Loading next Supabase shape for daily game...');
            await loadSupabaseShape(currentDay, currentShapeNumber);
        } else {
            console.log('🎮 Loading next demo shape...');
            await loadDemoShape(currentDay, currentShapeNumber);
        }

        // CRITICAL FIX: Force canvas redraw after loading new shape
        if (parsedShapes && parsedShapes.length > 0) {
            console.log('🎨 Force redrawing canvas for new shape with', parsedShapes.length, 'shapes');
            redrawCanvas();
        }
        
        // Activate canvas for immediate cutting
        setGameState('cutting');
        
        // CRITICAL FIX: Enable shape animation complete flag for new shape
        isShapeAnimationComplete = true;
        console.log('✅ Shape animation marked as complete for new shape');
        
        setInteractionEnabled(true, true); // true = from progression button
        console.log('🔘 New shape - enabled canvas interaction for cutting');
        
        // Reset instructions to initial state for consistency
        resetInstructionsToInitial();
        
        // CRITICAL FIX: Ensure canvas can receive pointer events and is fully activated
        const canvasElement = document.getElementById('geoCanvas');
        if (canvasElement) {
            canvasElement.style.pointerEvents = 'auto';
            canvasElement.style.cursor = 'crosshair';
            
            // Ensure global canvas references are set
            if (!window.canvas) {
                window.canvas = canvasElement;
            }
            if (!window.ctx) {
                window.ctx = canvasElement.getContext('2d');
            }
            
            console.log('🔧 FIXED: Canvas fully activated for next shape');
            console.log('🔧 Canvas state:', {
                hasCanvas: !!window.canvas,
                hasCtx: !!window.ctx,
                pointerEvents: canvasElement.style.pointerEvents,
                cursor: canvasElement.style.cursor,
                isInteractionEnabled: isInteractionEnabled,
                gameState: gameState
            });
        }

        // CRITICAL FIX: Clear flag and save state after canvas is fully clean
        setTimeout(() => {
            // Clear the skip flag now that canvas is clean
            window.skipCanvasCaptureAfterShapeTransition = false;
            console.log('✅ Cleared skip canvas capture flag - canvas is now clean');

            // Save state after activating new shape for cutting
            saveDemoGameState();
            console.log('💾 State saved with clean canvas after shape transition delay');
        }, 200); // Delay to ensure canvas is fully redrawn and clean
        
        // Special handling for Sunday's rotating mechanic - restart rotation for new shape
        if (currentDay === 7 && currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut") {
            console.log('🔄 ROTATION: Sunday mechanic - restarting rotation for new shape');
            if (currentMechanic.restartRotationForNextAttempt) {
                currentMechanic.restartRotationForNextAttempt();
            }
        }
        
        console.log('🔘 New shape loaded - canvas active for cutting');
        
        // FINAL CHECK: Verify mechanic event listeners are working
        if (currentMechanic && currentMechanic.name) {
            console.log('🔧 FINAL CHECK: Current mechanic:', currentMechanic.name);
            console.log('🔧 FINAL CHECK: Mechanic has event listeners:', !!currentMechanic.setupEventListeners);
            
            // FORCE: Always re-setup mechanic event listeners after shape load
            setTimeout(() => {
                console.log('🔄 FORCE: Re-setting up mechanic event listeners for post-refresh next shape');
                setupMechanicsEventListeners();
                
                // Additional force: Call the mechanic's init if available
                if (currentMechanic.init) {
                    console.log('🔄 FORCE: Re-initializing mechanic');
                    currentMechanic.init();
                }
            }, 100);
        }
    }, 500);
}


function resetForNextAttempt() {
    console.log('🔄 BEFORE reset - gameState:', gameState, 'isInteractionEnabled:', isInteractionEnabled);
    
    // Don't reset instructions immediately - let commentary be visible first
    // resetInstructionsToInitial(); // Moved to when user starts next cut
    
    // Clear the colored cut result and reset canvas for next attempt
    setGameState('cutting');
    setInteractionEnabled(true, true); // true = from progression button
    
    console.log('🔄 AFTER reset - gameState:', gameState, 'isInteractionEnabled:', isInteractionEnabled);
    
    // Ensure parsedShapes is available - reload if needed
    if (!parsedShapes || parsedShapes.length === 0) {
        console.log('⚠️ parsedShapes missing after reset - reloading shape data');
        // Reload shape data synchronously if available
        if (window.currentGeoJSON) {
            console.log('🔄 Reloading shape from currentGeoJSON');
            const parseResult = parseGeometry(window.currentGeoJSON);
            parsedShapes = parseResult.shapes;
            console.log('✅ Reloaded', parsedShapes.length, 'shapes for redraw');
        }
    }
    
    // Clear restore flag to ensure canvas gets redrawn
    window.restoreGameState = false;
    console.log('🔧 Cleared restoreGameState in resetForNextAttempt to force canvas redraw');
    
    // CRITICAL: Clear all saved canvas states to prevent shading persistence
    if (window.dailyGameState) {
        window.dailyGameState.lastShapeColors = null;
        window.dailyGameState.shadedCanvasState = null;
        console.log('🔧 Cleared saved canvas states to prevent shading persistence');
    }
    
    // Clear demo game saved canvas state
    const savedDemoState = localStorage.getItem('dailyGameState_demo');
    if (savedDemoState) {
        const parsedState = JSON.parse(savedDemoState);
        if (parsedState.canvasDataURL) {
            parsedState.canvasDataURL = null;
            localStorage.setItem('dailyGameState_demo', JSON.stringify(parsedState));
            console.log('🔧 Cleared demo canvas state to prevent shading persistence');
        }
    }
    
    // Clear canvas and redraw clean shape
    redrawCanvas();
    
    // CRITICAL FIX: Force another redraw if shapes are available
    if (parsedShapes && parsedShapes.length > 0) {
        setTimeout(() => {
            console.log('🎨 Force redrawing canvas after reset with', parsedShapes.length, 'shapes');
            redrawCanvas();
        }, 50);
    }
    
    // Hide percentage display
    const percentageDisplay = document.getElementById('percentageDisplay');
    if (percentageDisplay) {
        percentageDisplay.style.display = 'none';
    }

    // Force the mechanic to recognize the new state AND re-initialize
    if (currentMechanic && currentMechanic.reset) {
        console.log('🔄 Resetting current mechanic state');
        currentMechanic.reset();

        // Re-initialize the mechanic to ensure event handlers are properly set
        if (currentMechanic.init) {
            console.log('🔄 Re-initializing current mechanic');
            currentMechanic.init();
        }
    }

    // Special handling for Sunday's rotating mechanic - restart rotation AFTER re-initialization
    if (currentDay === 7 && currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut") {
        console.log('🔄 ROTATION: Sunday mechanic - restarting rotation for next attempt');
        if (currentMechanic.restartRotationForNextAttempt) {
            currentMechanic.restartRotationForNextAttempt();
        }

        // CRITICAL: Ensure rotation is properly set up if returning from practice mode
        if (window.returnedFromPracticeMode) {
            console.log('🔄 ROTATION: Returned from practice mode - reinitializing mechanic');
            if (currentMechanic.init) {
                currentMechanic.init();
            }
            window.returnedFromPracticeMode = false; // Clear flag
        }
    }

    // CRITICAL: Setup mechanics event listeners after reset
    console.log('🔄 Setting up mechanics event listeners after reset');
    setupMechanicsEventListeners();
    
    // CRITICAL: Clear global vector variables to prevent persistence
    currentVector = null;
    window.currentVector = null;
    globalThis.currentVector = null;
    console.log('🔧 Cleared all global vector references in resetForNextAttempt');
    
    // Comprehensive canvas debugging and CRITICAL FIX
    console.log('🧪 TESTING: Adding comprehensive canvas debugging');
    const canvasElement = document.getElementById('geoCanvas');
    
    // CRITICAL FIX: Ensure canvas can receive pointer events and is fully activated
    if (canvasElement) {
        canvasElement.style.pointerEvents = 'auto';
        canvasElement.style.cursor = 'crosshair';
        
        // Ensure global canvas references are set
        if (!window.canvas) {
            window.canvas = canvasElement;
        }
        if (!window.ctx) {
            window.ctx = canvasElement.getContext('2d');
        }
        
        console.log('🔧 FIXED: Canvas fully activated for next attempt');
        console.log('🔧 Canvas state:', {
            hasCanvas: !!window.canvas,
            hasCtx: !!window.ctx,
            pointerEvents: canvasElement.style.pointerEvents,
            cursor: canvasElement.style.cursor,
            isInteractionEnabled: isInteractionEnabled,
            gameState: gameState
        });
    }
    console.log('🧪 TESTING: Canvas found =', !!canvasElement);
    
    if (canvasElement) {
        console.log('🧪 CANVAS DEBUG:', {
            id: canvasElement.id,
            display: window.getComputedStyle(canvasElement).display,
            visibility: window.getComputedStyle(canvasElement).visibility,
            pointerEvents: window.getComputedStyle(canvasElement).pointerEvents,
            position: window.getComputedStyle(canvasElement).position,
            zIndex: window.getComputedStyle(canvasElement).zIndex,
            opacity: window.getComputedStyle(canvasElement).opacity,
            width: canvasElement.offsetWidth,
            height: canvasElement.offsetHeight,
            clientRect: canvasElement.getBoundingClientRect()
        });
        
        // Check for overlaying elements
        const rect = canvasElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const elementAtCenter = document.elementFromPoint(centerX, centerY);
        
        console.log('🧪 ELEMENT AT CANVAS CENTER:', {
            element: elementAtCenter?.tagName,
            id: elementAtCenter?.id,
            className: elementAtCenter?.className,
            isCanvas: elementAtCenter === canvasElement
        });
    }
    
    // Remove any existing test listeners
    if (window.testCanvasClickHandler) {
        canvasElement?.removeEventListener('click', window.testCanvasClickHandler);
    }
    
    // Add a direct click test
    window.testCanvasClickHandler = (e) => {
        console.log('🧪 DIRECT CANVAS CLICK DETECTED!', {
            x: e.clientX,
            y: e.clientY,
            target: e.target?.id,
            gameState,
            isInteractionEnabled
        });

        // Close menu dropdown if it's open
        if (window.menuState && window.menuState.isExpanded) {
            console.log('🔵 Direct canvas handler - closing menu dropdown');
            window.collapseMenu();
        }
    };
    
    if (canvasElement) {
        canvasElement.addEventListener('click', window.testCanvasClickHandler);
        console.log('🧪 TESTING: Direct click listener added to canvas');
    }
    
    
    console.log('🔄 Ready for next attempt on same shape - interaction should be enabled');
    
    // CRITICAL FIX: Enable shape animation complete flag so interaction can be enabled
    isShapeAnimationComplete = true;
    console.log('✅ Shape animation marked as complete - interaction now allowed');
    
    // Try to enable interaction again now that animation is complete
    setInteractionEnabled(true);
    
    // FINAL CHECK: Verify mechanic event listeners are working for next attempt
    if (currentMechanic && currentMechanic.name) {
        console.log('🔧 FINAL CHECK (Next Attempt): Current mechanic:', currentMechanic.name);
        console.log('🔧 FINAL CHECK (Next Attempt): Mechanic has event listeners:', !!currentMechanic.setupEventListeners);
        
        // Ensure mechanics are properly listening for events
        setTimeout(() => {
            console.log('🔄 Ensuring mechanic event listeners are active for next attempt');
            setupMechanicsEventListeners();
        }, 50);
    }
}

// AUTHORITATIVE REFRESH LOGIC - Handles all 12 scenarios precisely
function restoreAuthoritativeGameState(restoredState) {
    console.log('📋 AUTHORITATIVE RESTORE - Shape:', restoredState.currentShape, 'Attempt:', restoredState.currentAttempt, 'Cuts:', restoredState.cutsMadeThisShape, 'State:', restoredState.gameState);
    
    // Restore basic attempts data - check multiple sources
    if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
        currentAttempts = restoredState.currentAttempts;
        console.log('✅ Restored currentAttempts from state:', currentAttempts.length, 'attempts');
        window.debugCurrentAttempts('restoration', 'RESTORED from saved state');
    } else if (window.currentAttempts && window.currentAttempts.length > 0) {
        currentAttempts = window.currentAttempts;
        console.log('✅ Restored currentAttempts from window:', currentAttempts.length, 'attempts');
        window.debugCurrentAttempts('restoration', 'RESTORED from window fallback');
    }

    // CRITICAL: Ensure window.currentAttempts is synced with local currentAttempts
    window.currentAttempts = currentAttempts;
    
    // Ensure global variables are synced
    currentShapeNumber = restoredState.currentShape;
    currentAttemptNumber = restoredState.currentAttempt;
    cutsMadeThisShape = restoredState.cutsMadeThisShape || 0;
    window.currentShapeNumber = currentShapeNumber;
    window.currentAttemptNumber = currentAttemptNumber;
    window.cutsMadeThisShape = cutsMadeThisShape;
    
    // AUTHORITATIVE 12-SCENARIO LOGIC
    if (restoredState.gameState === 'cutting') {
        // Scenarios 2, 4, 6, 8, 10 - Button clicked, ready for cut
        restoreCleanCanvasState(restoredState);
    } else if (restoredState.gameState === 'awaiting_choice') {
        // Scenarios 1, 3, 5, 7, 9 - Cut made, show button + visualization
        restoreCutCompleteState(restoredState);
    } else if (restoredState.currentShape >= 10 && restoredState.cutsMadeThisShape >= 1) {
        // Final cut on shape 10 made, show completion
        restoreCompletionState(restoredState);
    } else {
        // Default fallback
        console.log('⚠️ Unknown state, defaulting to cutting mode');
        restoreCleanCanvasState(restoredState);
    }
}

function restoreCleanCanvasState(restoredState) {
    console.log('🧹 Restoring clean canvas state');
    
    // Set game state for cutting
    setGameState('cutting');
    isShapeAnimationComplete = true;
    setInteractionEnabled(true);
    
    // Update progress UI
    updateProgressUI();
    
    // Ensure canvas is active and ready
    const canvasElement = document.getElementById('geoCanvas');
    if (canvasElement) {
        canvasElement.style.pointerEvents = 'auto';
        canvasElement.style.cursor = 'crosshair';
    }
    
    // Force redraw clean shape
    redrawCanvas();
    
    console.log('✅ Clean canvas ready - Shape', restoredState.currentShape, 'Cut', getCurrentCutNumber(restoredState));
}

function restoreCutCompleteState(restoredState) {
    console.log('🎨 Restoring cut complete state');
    
    // Set game state for awaiting choice
    setGameState('awaiting_choice');
    setInteractionEnabled(false);
    
    // Update progress UI
    updateProgressUI();
    
    // Disable canvas interaction
    const canvasElement = document.getElementById('geoCanvas');
    if (canvasElement) {
        canvasElement.style.pointerEvents = 'none';
    }
    
    // Restore visual state (canvas + percentages)
    restoreVisualState(restoredState);
    
    // Create appropriate button
    setTimeout(() => {
        createAppropriateButton(restoredState);
    }, 500);
    
    console.log('✅ Cut complete state restored - Shape', restoredState.currentShape, 'Attempt', restoredState.currentAttempt);
}

function restoreCompletionState(restoredState) {
    console.log('🏆 Restoring completion state');
    
    // Set completion state
    setGameState('finished');
    setInteractionEnabled(false);
    
    // Disable canvas interaction
    const canvasElement = document.getElementById('geoCanvas');
    if (canvasElement) {
        canvasElement.style.pointerEvents = 'none';
    }
    
    // Show completion screen without popup
    setTimeout(() => {
        showInCanvasCompletion();
    }, 500);
    
    console.log('✅ Completion state restored');
}

function getCurrentCutNumber(restoredState) {
    // Determine which cut number we're on based on attempt and cuts made
    if (restoredState.currentAttempt === 1) {
        return 1; // First cut of first attempt
    } else {
        return 2; // Second cut of second attempt  
    }
}

function createAppropriateButton(restoredState) {
    if (restoredState.cutsMadeThisShape >= 1) {
        // Cut completed on this shape - show Next Shape (unless final shape)
        if (restoredState.currentShape < 10) {
            console.log('🔘 Creating Next Shape button');
            createProgressionButton();
        }
    }
}

function restoreVisualState(restoredState) {
    // CRITICAL: Check both restoredState.canvasData AND window.pendingCanvasRestoration
    // SimpleRefresh stores canvas data in window.pendingCanvasRestoration
    const canvasDataSource = restoredState.canvasData || window.pendingCanvasRestoration;

    // Restore canvas image if available
    if (canvasDataSource && window.canvas && window.ctx) {
        console.log('🎨 restoreVisualState: Found canvas data to restore');
        setTimeout(() => {
            const img = new Image();
            img.onload = function() {
                // Skip rendering if we just canceled a line drawing to prevent visual corruption
                if (window.canceledLineDrawing) {
                    console.log('🚫 Skipping canvas visual state restoration due to recent cancel - preventing visual corruption');
                    return;
                }
                window.ctx.clearRect(0, 0, canvas.width, canvas.height);
                window.ctx.drawImage(img, 0, 0);
                console.log('✅ Canvas visual state restored from image data');

                // Clear pending restoration since we've used it
                if (window.pendingCanvasRestoration) {
                    window.pendingCanvasRestoration = null;
                    console.log('🔄 Cleared pendingCanvasRestoration after use');
                }
            };
            img.src = canvasDataSource;
        }, 100);
    } else {
        console.log('⚠️ No canvas data available, falling back to pixel-based restoration');
        // Fallback to pixel-based rendering if we have attempt data
        if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
            const lastAttempt = restoredState.currentAttempts[restoredState.currentAttempts.length - 1];
            if (lastAttempt.leftArea && lastAttempt.rightArea) {
                console.log('🎨 Using pixel-based restoration from attempt data');
                // Draw grid and shape first
                redrawCanvas();
                // Then apply pixel shading
                setTimeout(() => {
                    renderPixelBasedCutResult(lastAttempt);
                }, 50);
            } else {
                // No pixel data either, just redraw clean
                redrawCanvas();
            }
        } else {
            // No data at all, just redraw clean
            redrawCanvas();
        }
    }
    
    // Restore percentage display using correct attempt index
    if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
        setTimeout(() => {
            restoreCutResultDisplayWithIndex(restoredState);
        }, 200);
    }
}

function showInCanvasCompletion() {
    // Use existing completion logic but ensure no popup
    console.log('🎯 Showing in-canvas completion (no popup)');
    // This will be implemented to show stats in canvas area
    // For now, trigger existing completion but suppress popup
    if (typeof showCompletionView === 'function') {
        showCompletionView();
    }
}

// Function to restore cut result display with correct indexing
function restoreCutResultDisplayWithIndex(restoredState) {
    if (!restoredState.currentAttempts || restoredState.currentAttempts.length === 0) return;

    // CRITICAL: currentAttempts only stores attempts for the CURRENT SHAPE, not cumulative
    // So we just need currentAttempt - 1, NOT a cumulative index
    const currentShape = restoredState.currentShape || window.currentShapeNumber || 1;
    const currentAttempt = restoredState.currentAttempt || window.currentAttemptNumber || 1;
    const targetAttemptIndex = currentAttempt - 1;  // Simple: just the current attempt index (0-based)

    console.log(`🎨 Restoring cut result display for Shape ${currentShape}, Attempt ${currentAttempt} (index ${targetAttemptIndex})`);

    const attempts = restoredState.currentAttempts;
    if (targetAttemptIndex < 0 || targetAttemptIndex >= attempts.length) {
        console.log(`⚠️ Target attempt index ${targetAttemptIndex} out of bounds (attempts length: ${attempts.length})`);
        // Fallback: use last attempt in array
        if (attempts.length > 0) {
            console.log('📊 Falling back to last attempt in array');
            const lastAttempt = attempts[attempts.length - 1];
            if (lastAttempt && lastAttempt.leftPercentage !== undefined && lastAttempt.rightPercentage !== undefined) {
                displayCutResult(lastAttempt.leftPercentage, lastAttempt.rightPercentage);
                return;
            }
        }
        return;
    }

    const targetAttempt = attempts[targetAttemptIndex];
    if (!targetAttempt || targetAttempt.leftPercentage === undefined || targetAttempt.rightPercentage === undefined) {
        console.log('⚠️ Target attempt has no percentage data:', targetAttempt);
        return;
    }

    console.log('🎨 Using attempt data:', targetAttempt.leftPercentage, targetAttempt.rightPercentage);

    displayCutResult(targetAttempt.leftPercentage, targetAttempt.rightPercentage);
    console.log('✅ Cut result display restored with correct indexing');
}

// Helper function to display cut result (DRY - don't repeat yourself)
function displayCutResult(leftPercentage, rightPercentage) {
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (!fixedPercentageArea) return;

    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Create the result display
    const resultDiv = document.createElement('div');
    resultDiv.className = 'attempt-result';

    // Determine colors - always use teal for cut shading
    const leftColor = '#00798C';
    const rightColor = '#999999';  // Grey - matches separator color

    resultDiv.innerHTML = `
        <div class="attempt-info">
            <div class="split-display-large">
                <span style="color: ${leftColor}; font-weight: bold;">${Math.round(leftPercentage)}%</span>
                <span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span>
                <span style="color: ${rightColor}; font-weight: bold;">${Math.round(rightPercentage)}%</span>
            </div>
        </div>
    `;

    // Clear and add the result
    fixedPercentageArea.innerHTML = '';
    fixedPercentageArea.style.setProperty('visibility', 'visible', 'important');  // Force visible
    fixedPercentageArea.appendChild(resultDiv);

    console.log('✅ Cut result displayed:', leftPercentage.toFixed(1), '/', rightPercentage.toFixed(1));
}

// Legacy function - kept for backward compatibility
function restoreCutResultDisplay(attempts) {
    if (!attempts || attempts.length === 0) return;

    const lastAttempt = attempts[attempts.length - 1];
    if (!lastAttempt || !lastAttempt.leftPercentage || !lastAttempt.rightPercentage) return;

    console.log('🎨 [LEGACY] Restoring cut result display:', lastAttempt.leftPercentage, lastAttempt.rightPercentage);

    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (!fixedPercentageArea) return;

    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Create the result display
    const resultDiv = document.createElement('div');
    resultDiv.className = 'attempt-result';

    // Determine colors - always use teal for cut shading
    const leftColor = '#00798C';
    const rightColor = '#999999';  // Grey - matches separator color

    resultDiv.innerHTML = `
        <div class="attempt-info">
            <div class="split-display-large">
                <span style="color: ${leftColor}; font-weight: bold;">${Math.round(lastAttempt.leftPercentage)}%</span>
                <span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span>
                <span style="color: ${rightColor}; font-weight: bold;">${Math.round(lastAttempt.rightPercentage)}%</span>
            </div>
        </div>
    `;

    // Clear and add the result
    fixedPercentageArea.innerHTML = '';
    fixedPercentageArea.style.setProperty('visibility', 'visible', 'important');  // Force visible
    fixedPercentageArea.appendChild(resultDiv);

    console.log('✅ [LEGACY] Cut result display restored');
}

// Demo Game Progression Functions
// Legacy function - now handled by button system
async function handleDemoAttemptComplete() {
    console.log('⚠️ handleDemoAttemptComplete called - this should now be handled by button system');
    // This function is kept for compatibility but functionality moved to button handlers
}


function setupMechanicsEventListeners() {
    console.log('🎧 Setting up mechanics event listeners...');
    
    if (!canvas) {
        console.error('Canvas not available for mechanics event listeners');
        return;
    }
    
    // Remove existing event listeners
    // CRITICAL: Preserve canvas content during restoration to maintain cut shading
    let canvasImageData = null;
    if (window.restoreGameState && ctx) {
        try {
            canvasImageData = ctx.getImageData(0, 0, 380, 380);
            console.log('💾 Preserved canvas content during event listener setup');
        } catch (e) {
            console.log('⚠️ Could not preserve canvas content:', e);
        }
    }
    
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
    window.canvas = canvas; // Ensure global reference is updated
    ctx = canvas.getContext('2d');
    window.ctx = ctx; // Ensure global context is updated
    
    // CRITICAL: Restore preserved canvas content during restoration
    if (canvasImageData && window.restoreGameState && !window.canceledLineDrawing) {
        try {
            ctx.putImageData(canvasImageData, 0, 0);
            console.log('✅ Restored canvas content after event listener setup');
        } catch (e) {
            console.log('⚠️ Could not restore canvas content:', e);
        }
    } else if (window.canceledLineDrawing) {
        console.log('🚫 Skipping canvas restoration due to recent cancel - preventing visual corruption');
    }
    
    // Redraw if we have shapes (but avoid double-draw during restoration or fresh start)
    if (parsedShapes && parsedShapes.length > 0) {
        // Don't redraw if we just restored/loaded a shape (prevents flickering) or during fresh start (fade-in animation will handle it)
        if (!window.restoreGameState && !window.freshGameStart) {
            redrawCanvas();
        } else if (window.restoreGameState) {
            console.log('🔄 Skipped redrawCanvas in setupMechanicsEventListeners during restoration');
        } else if (window.freshGameStart) {
            console.log('🎬 Skipped redrawCanvas in setupMechanicsEventListeners - will use fade-in animation');
        }
    } else {
        drawGrid();
    }
    
    // Add new event listeners for mechanics
    canvas.addEventListener('mousedown', handleMechanicStart);
    canvas.addEventListener('mousemove', handleMechanicMove);
    canvas.addEventListener('mouseup', handleMechanicEnd);
    
    canvas.addEventListener('touchstart', handleMechanicStart);
    canvas.addEventListener('touchmove', handleMechanicMove);
    canvas.addEventListener('touchend', handleMechanicEnd);
    
    // Prevent default touch behavior
    canvas.addEventListener('touchstart', e => e.preventDefault());
    canvas.addEventListener('touchmove', e => e.preventDefault());
    canvas.addEventListener('touchend', e => e.preventDefault());
    
    // Handle right-click context menu on canvas - use capture phase to ensure we get it first
    canvas.addEventListener('contextmenu', e => {
        console.log('🌐 Global contextmenu handler triggered');
        e.preventDefault(); // Prevent the context menu first
        
        // Check if current mechanic is drawing (different mechanics use different property names)
        if (currentMechanic) {
            const isCurrentlyDrawing = currentMechanic.isDrawing || currentMechanic.isDrawingVector;
            console.log('🌐 Current mechanic:', currentMechanic.name, 'isDrawing:', currentMechanic.isDrawing, 'isDrawingVector:', currentMechanic.isDrawingVector);
            if (isCurrentlyDrawing) {
                console.log('🔄 Global: Right-click detected during drawing - canceling');
                // Different mechanics have different cancel methods
                if (currentMechanic.cancelDraw) {
                    currentMechanic.cancelDraw();
                } else if (currentMechanic.cancelLineDraw) {
                    currentMechanic.cancelLineDraw();
                }
                
                // CRITICAL: Clear corrupted visual states after canceling (same as mechanic-specific handler)
                if (window.dailyGameState) {
                    console.log('🔧 Global handler: Clearing corrupted visual states after cancel');
                    window.dailyGameState.lastShapeColors = null;
                    window.dailyGameState.lastRenderedCut = null;
                    window.dailyGameState.shadedCanvasState = null; // Clear shaded canvas state
                }
                if (window.RefreshProtection && window.RefreshProtection.currentGameState) {
                    window.RefreshProtection.currentGameState.lastShapeColors = null;
                    window.RefreshProtection.currentGameState.lastRenderedCut = null;
                    window.RefreshProtection.currentGameState.shadedCanvasState = null; // Clear shaded canvas state
                }
                
                // CRITICAL: Clear any global shaded canvas states that might persist
                if (window.shadedCanvasState) {
                    console.log('🔧 Global handler: Clearing global shadedCanvasState after cancel');
                    window.shadedCanvasState = null;
                }

                // CRITICAL: Clear window.currentVector to prevent previous cut rendering after cancel
                if (window.currentVector) {
                    console.log('🔧 Global handler: Clearing window.currentVector after cancel to prevent stale cut rendering');
                    window.currentVector = null;
                }

                // Set a flag to prevent visual state restoration until next valid cut
                window.canceledLineDrawing = true;
            }
        }
    }, false);
    
    console.log('✅ Mechanics event listeners setup complete');
}

function handleMechanicStart(event) {
    console.log('🔧🔧🔧 handleMechanicStart CALLED!!! 🔧🔧🔧', {
        hasCurrentMechanic: !!currentMechanic,
        mechanicName: currentMechanic?.name,
        isInteractionEnabled,
        gameState,
        parsedShapesLength: parsedShapes?.length,
        eventType: event.type,
        eventTarget: event.target?.tagName + '#' + event.target?.id
    });

    // Close menu dropdown if it's open when starting canvas interaction
    if (window.menuState && window.menuState.isExpanded) {
        console.log('🔵 Mechanic interaction started - closing menu dropdown');
        window.collapseMenu();
    }

    // Reset instructions when user starts a new cut (clear any commentary)
    resetInstructionsToInitial();

    // Clear the cancellation flag to allow new cuts to render properly
    window.canceledLineDrawing = false;
    
    // Only handle left-click (button 0) mouse down, ignore right-click (button 2)
    if (event.type === 'mousedown' && event.button !== 0) {
        console.log('🔧 Ignoring non-left-click mousedown, button:', event.button);
        return;
    }
    
    if (!currentMechanic || !isInteractionEnabled) {
        console.log('🚫 Mechanic start blocked:', {
            noMechanic: !currentMechanic,
            interactionDisabled: !isInteractionEnabled
        });
        return;
    }
    
    // DAILY MODE: Block mechanic start if cut limit reached (1 cut per shape)
    if (isDailyMode && window.cutsMadeThisShape >= 1) {
        console.log('🚫 MECHANIC START BLOCKED: Daily mode cut limit reached', {
            cutsMadeThisShape: window.cutsMadeThisShape,
            isDailyMode,
            maxCuts: 1
        });
        return;
    }
    
    const canvasRect = canvas.getBoundingClientRect();
    const handled = currentMechanic.handleStart(event, canvasRect);
    
    if (handled) {
        // Hide any "Try again" message from previous invalid cuts when starting a new valid cut
        hideTryAgainMessage();
        event.preventDefault();
    }
}

function handleMechanicMove(event) {
    console.log('🔍 DEBUG: handleMechanicMove called', {
        currentMechanic: currentMechanic ? currentMechanic.name : 'null',
        isInteractionEnabled,
        practiceMode: practiceMode.isActive,
        eventType: event.type
    });
    
    if (!currentMechanic || !isInteractionEnabled) return;
    
    // DAILY MODE: Block mechanic moves if cut limit reached (1 cut per shape)
    if (isDailyMode && window.cutsMadeThisShape >= 1) {
        console.log('🚫 MECHANIC MOVE BLOCKED: Daily mode cut limit reached');
        return;
    }
    
    const canvasRect = canvas.getBoundingClientRect();
    const handled = currentMechanic.handleMove(event, canvasRect);
    
    console.log('🔍 DEBUG: handleMechanicMove result:', handled);
    
    if (handled) {
        event.preventDefault();
    }
}

async function handleMechanicEnd(event) {
    if (!currentMechanic || !isInteractionEnabled) return;
    
    // Only handle left-click (button 0) mouse up, ignore right-click (button 2)
    if (event.type === 'mouseup' && event.button !== 0) {
        console.log('🔧 Ignoring non-left-click mouseup, button:', event.button);
        return;
    }
    
    // DAILY MODE: Block mechanic end if cut limit reached (1 cut per shape)
    if (isDailyMode && window.cutsMadeThisShape >= 1) {
        console.log('🚫 MECHANIC END BLOCKED: Daily mode cut limit reached');
        return;
    }
    
    const handled = await currentMechanic.handleEnd(event);
    
    if (handled) {
        event.preventDefault();
    }
}

function clearResultsTable() {
    const resultsTableBody = document.getElementById('resultsTableBody');
    if (resultsTableBody) {
        resultsTableBody.innerHTML = '';
    }
}


// Initialize the application with error handling
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Force leaderboard title font size on full screen
        if (window.innerWidth >= 1200) {
            const style = document.createElement('style');
            style.textContent = `
                .leaderboard-header h2,
                #leaderboardTitle,
                div.leaderboard-header h2,
                .leaderboard-modal-content .leaderboard-header h2 {
                    font-size: 23px !important;
                    line-height: 1.2 !important;
                }
            `;
            document.head.appendChild(style);
        }


        // CRITICAL: Ensure clean daily mode start - clear any lingering practice mode state
        window.isPracticeMode = false;
        window.isDailyMode = true;
        if (window.PracticeMode) {
            window.PracticeMode.isActive = false;
        }
        if (window.practiceMode) {
            window.practiceMode.isActive = false;
        }
        console.log('🧹 Cleared any lingering practice mode flags on page load');

        // CRITICAL FIX: Remove restoring class to ensure split display shows
        document.body.classList.remove('restoring');
        console.log('🔧 Removed restoring class from body to enable split display visibility');

        // Canvas setup for later use
        canvas = document.getElementById('geoCanvas');
        if (canvas) {
            ctx = setupCanvasForCrispRendering(canvas);
        }

        // Menu initialization moved to after shapes are loaded

        // Initialize collapsible menu
        if (window.collapsibleMenu && typeof window.collapsibleMenu.initialize === 'function') {
            window.collapsibleMenu.initialize();
        }

        // Listen for auth state changes to update menu visibility
        document.addEventListener('authStateChange', function(e) {
            const isLoggedIn = e.detail?.isLoggedIn || false;
            updateLoginStatus(isLoggedIn);
        });

        // Also check initial auth state if available
        setTimeout(() => {
            if (window.AuthService && typeof window.AuthService.isLoggedIn === 'function') {
                const isLoggedIn = window.AuthService.isLoggedIn();
                updateLoginStatus(isLoggedIn);
            }
        }, 1000); // Wait for auth service to initialize

        // Wait for Supabase integration to be ready (it loads after main.js)
        let supabaseCheckCount = 0;
        const maxSupabaseWait = 50; // 5 seconds max wait (50 * 100ms)

        while (!window.supabaseIntegrationActive && supabaseCheckCount < maxSupabaseWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
            supabaseCheckCount++;
        }

        // Check if Supabase integration is active before running demo game
        if (window.supabaseIntegrationActive) {
            console.log('🔗 Supabase integration is active - using Supabase initialization path');

            // Initialize essential game components without demo shapes
            await initializeSupabaseGameMode();
        } else {
            console.log('🎮 Supabase integration not detected - using demo initialization path');
            // Always run normal initialization first
            await initializeDemoGame();
        }
        
        // Then check for game flow state after initialization
        setTimeout(async function() {
            // Don't restore if we have a fresh start flag
            if (window.location.hash === '#fresh' || localStorage.getItem('freshStart') === 'true') {
                console.log('🆕 Fresh start requested - skipping restoration');
                localStorage.removeItem('freshStart');
                return;
            }
            
            // Check for SimpleRefresh saved state first
            const restoredState = window.SimpleRefresh && window.SimpleRefresh.restore && window.SimpleRefresh.restore();
            
            // Validate restored state is not corrupted
            if (restoredState) {
                // CRITICAL: Don't clear initial welcome state - it's valid!
                // Only clear if state is truly invalid (no shape/day data)
                // The welcome screen with Play button visible is a valid state to restore
                const hasValidData = restoredState.currentShape && restoredState.currentDay;

                if (!hasValidData) {
                    console.log('🆕 Invalid state (missing shape/day data), clearing');
                    window.SimpleRefresh.clear();
                    return;
                }

                console.log('✅ Valid state detected - will restore (gameStarted:', restoredState.isGameStarted, 'cuts:', restoredState.totalCutsMade || 0, ')');

                // Check if state is too old (more than 24 hours)
                const stateAge = Date.now() - (restoredState.timestamp || 0);
                if (stateAge > 24 * 60 * 60 * 1000) {
                    console.log('⚠️ Saved state too old, starting fresh');
                    window.SimpleRefresh.clear();
                    return;
                }

                // Check if state is valid
                if (!restoredState.currentShape || !restoredState.currentDay) {
                    console.log('⚠️ Invalid saved state, starting fresh');
                    window.SimpleRefresh.clear();
                    return;
                }

                // Validate that saved state is from the same day of week (demo mode uses day-of-week)
                // CRITICAL: Check day of week, not calendar date
                const savedDay = restoredState.currentDay;
                const today = new Date();
                const currentDayOfWeek = (today.getDay() === 0) ? 7 : today.getDay(); // Convert Sunday from 0 to 7

                if (savedDay && savedDay !== currentDayOfWeek) {
                    console.log(`⚠️ Saved state is from day ${savedDay}, but current day is ${currentDayOfWeek}. Starting fresh for new day.`);

                    // Clear old demo game state from different day of week
                    const oldDayFlag = `demo_completed_day_${savedDay}`;
                    localStorage.removeItem(oldDayFlag);
                    console.log(`🗑️ Cleared old demo flag: ${oldDayFlag}`);

                    window.SimpleRefresh.clear();
                    return;
                } else if (savedDay) {
                    console.log(`✅ Saved state validated - same day of week (day ${currentDayOfWeek})`);
                }

                console.log('🔄 Restoring game from saved state:', restoredState);

                // Hide any existing commentary - should not show on refresh
                hideCommentary();

                // Full restoration of saved game state
                const playBtn = document.getElementById('playBtn');
                const welcomeOverlay = document.getElementById('welcomeOverlay');

                // CRITICAL: Only hide Play button and welcome overlay if game actually started
                if (restoredState.isGameStarted) {
                    // Game was started - hide play button and welcome overlay
                    if (playBtn) playBtn.style.display = 'none';
                    if (welcomeOverlay) welcomeOverlay.style.visibility = 'hidden';
                    console.log('✅ Game started - hiding welcome elements');
                } else {
                    // Game NOT started - keep welcome overlay and Play button visible
                    if (playBtn) playBtn.style.display = 'block';
                    if (welcomeOverlay) welcomeOverlay.style.visibility = 'visible';
                    console.log('✅ Game not started - keeping welcome elements visible');
                }

                // Check if the game was completed
                if (restoredState.dayComplete || restoredState.isGameComplete) {
                    // Day is complete - show completion view
                    gameState = 'finished';
                    isInteractionEnabled = false;
                    
                    // Make restoredState globally accessible for other functions
                    window.restoredState = restoredState;
                    
                    // Hide progress tracker for completion state
                    updateProgressUI();
                    
                    // Clear instruction area immediately for completion state
                    const instructionText = document.getElementById('instructionText');
                    if (instructionText) {
                        instructionText.textContent = '';
                        console.log('🗑️ Cleared instruction text for completion state');
                    }
                    
                    // Show completion view after a brief delay
                    setTimeout(() => {
                        // Build completion model from current stats even if finalStats not saved
                        const currentDayStats = getDayStats(currentDay);

                        if (window.completeView) {
                            const completionModel = buildCompletionModel(currentDayStats);
                            window.completeView.show(completionModel);
                        } else {
                            console.log('⚠️ Complete view not available yet');
                        }

                        // completeView handles the score display
                    }, 500);

                    console.log('✅ Restored to completion state - showing completion view');
                    return; // Exit early, no need to restore playing state
                }

                // CRITICAL: If game hasn't started yet, just show welcome screen - don't load shapes
                if (!restoredState.isGameStarted) {
                    console.log('✅ Game not started yet - showing initial welcome screen');
                    gameState = 'initial';
                    isInteractionEnabled = false;
                    return; // Exit early, don't load any shapes
                }

                // Set game state variables for in-progress game
                gameState = 'playing';
                isInteractionEnabled = true;
                
                // AUTHORITATIVE REFRESH LOGIC - Calculate correct state FIRST
                const correctedState = calculateCorrectGameState(restoredState);
                console.log('📋 Using corrected state:', correctedState);
                
                // DAILY MODE: Load daily shapes via DailyGameCore instead of demo shapes
                if (window.DailyGameCore && window.DailyGameCore.getShapeData) {
                    console.log('🔄 DAILY MODE: Loading daily shape via DailyGameCore for restoration...');

                    // Use the daily mode mechanic (already loaded during initialization)
                    if (window.currentMechanic) {
                        console.log(`🔧 Using existing daily mechanic: ${window.currentMechanic.name}`);
                    } else {
                        // Fallback: load the correct daily mechanic
                        const mechanicClassName = dayMechanics[correctedState.currentDay || currentDay];
                        if (mechanicClassName) {
                            loadDemoMechanic(mechanicClassName);
                            console.log(`🔧 Loaded daily mechanic for restoration: ${mechanicClassName}`);
                        }
                    }

                    // Load daily shape from DailyGameCore
                    const dailyShapeData = window.DailyGameCore.getShapeData(correctedState.currentShape);
                    if (dailyShapeData) {
                        // Set the current shape data
                        window.currentGeoJSON = dailyShapeData;

                        // Parse the daily shape
                        const parseResult = window.parseGeometry(dailyShapeData);
                        console.log(`🔄 DAILY MODE: Parsed daily shape ${correctedState.currentShape} for restoration:`, parseResult);

                        // CRITICAL: Set parsedShapes globally for cutting mechanics
                        parsedShapes = parseResult.shapes;
                        window.parsedShapes = parsedShapes;
                        console.log(`🔄 DAILY MODE: Set parsedShapes array with ${parsedShapes.length} shapes`);

                        // CRITICAL: Always render the shape as a base layer
                        // Even if we have canvas data, we render the unshaded shape first as a fallback
                        // The canvas restoration will happen later and draw the shading on top
                        window.renderShapeForCutting(parsedShapes, false);
                        console.log(`✅ DAILY MODE: Daily shape ${correctedState.currentShape} loaded and rendered (base layer)`);

                        // Mark that we've rendered the base shape, so canvas can be restored on top
                        window.baseShapeRendered = true;
                    } else {
                        console.error(`❌ DAILY MODE: Failed to get daily shape ${correctedState.currentShape} from DailyGameCore`);
                    }
                } else {
                    console.log('🔄 DEMO MODE: Loading demo shape for restoration...');
                    // DEMO MODE: Load demo shapes as before
                    const mechanicClassName = dayMechanics[correctedState.currentDay || currentDay];
                    if (mechanicClassName) {
                        loadDemoMechanic(mechanicClassName);
                    }

                    // For clean canvas scenarios, clear restore flag so shape gets drawn
                    if (correctedState.scenarioNumber === 2 || correctedState.scenarioNumber === 4 || correctedState.scenarioNumber === 6 || correctedState.scenarioNumber === 8 || correctedState.scenarioNumber === 10) {
                        window.restoreGameState = false;
                        console.log('🎨 Cleared restoreGameState for clean canvas scenario', correctedState.scenarioNumber);
                    }

                    // Load the CORRECT demo shape based on authoritative logic
                    await loadDemoShape(correctedState.currentDay || currentDay, correctedState.currentShape);
                }
                
                // Ensure canvas and ctx are available before restoration
                if (!window.canvas) {
                    window.canvas = document.getElementById('geoCanvas');
                }
                if (!window.ctx && window.canvas) {
                    window.ctx = setupCanvasForCrispRendering(window.canvas);
                }
                
                // Apply the complete restoration with corrected state
                restoreAuthoritativeGameState(correctedState);
                
                // OLD LOGIC REMOVED - All restoration now handled by restoreAuthoritativeGameState()
            }
        }, 1500); // Wait 1.5 seconds for full initialization
        
        // Process any join links in the URL after initialization
        setTimeout(() => {
            processJoinLink();
        }, 1000); // Small delay to ensure everything is ready

    } catch (error) {
        // Silent error handling - just show error message
        console.error('❌ Error in game initialization:', error);
        showErrorMessage('Game failed to initialize. Please refresh the page.');
    }
});

// Refresh protection disabled

// Global error handler
window.addEventListener('error', function(event) {
    console.error('💥 Global error:', event.error);
    
    // Track error in analytics
    if (window.Analytics) {
        window.Analytics.trackError('global_error', event.message || event.error?.message || 'Unknown error');
    }
    
    if (window.debugLogger) {
        debugLogger.error('Global error', {
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error
        });
    }
});

// Show error message to user
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 10000;
        text-align: center;
        font-family: sans-serif;
    `;
    errorDiv.innerHTML = `
        <h3>⚠️ Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="background: white; color: #ff4444; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Reload Page</button>
    `;
    document.body.appendChild(errorDiv);
}

// ====================================================================
// GAME STATE PERSISTENCE FUNCTIONS
// ====================================================================

// ====================================================================
// STRUCTURED REFRESH RECOVERY SYSTEM
// ====================================================================

// Save comprehensive game state for structured refresh recovery
function saveStructuredGameState() {
    try {
        const currentDate = getCurrentLocalDate();
        const gameData = {
            date: currentDate,
            lastUpdated: Date.now(),
            
            // Current game position
            currentShape: currentShapeNumber || 1,
            currentAttempt: currentAttemptNumber || 1,
            currentDay: currentDay || 1,
            
            // Game state tracking
            gameState: gameState || 'playing',
            cutsMadeThisShape: cutsMadeThisShape || 0,
            totalCutsMade: totalCutsMade || 0,
            
            // Current attempts and scores
            currentAttempts: currentAttempts || [],
            attemptCount: attemptCount || 0,
            
            // Visual state
            currentGeoJSON: currentGeoJSON,
            mechanic: currentMechanic ? currentMechanic.name : null,
            
            // Completion state
            isGameComplete: gameState === 'finished' || gameState === 'locked',
            dayComplete: gameState === 'finished' || gameState === 'locked'
        };
        
        // Save comprehensive state to localStorage
        localStorage.setItem(STORAGE_KEYS.structuredState, JSON.stringify(gameData));
        
        // Save current cut state separately for quick access
        if (currentAttempts && currentAttempts.length > 0) {
            const latestAttempt = currentAttempts[currentAttempts.length - 1];
            const currentCutState = {
                leftPercentage: latestAttempt.leftPercentage,
                rightPercentage: latestAttempt.rightPercentage,
                splitAreas: latestAttempt.splitAreas,
                vector: latestAttempt.cutVector,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEYS.currentCutState, JSON.stringify(currentCutState));
        }
        
        // Save final locked score separately if game is complete
        if (gameState === 'finished' || gameState === 'locked') {
            const finalLockedScore = getFinalScore();
            if (finalLockedScore) {
                const finalData = {
                    leftPercentage: finalLockedScore.leftPercentage,
                    rightPercentage: finalLockedScore.rightPercentage,
                    attemptCount: attemptCount,
                    cutVector: currentVector,
                    splitAreas: currentAttempts[currentAttempts.length - 1]?.splitAreas,
                    timestamp: Date.now()
                };
                localStorage.setItem(STORAGE_KEYS.finalCommittedData, JSON.stringify(finalData));
            }
        }
        
        console.log('✅ Structured game state saved successfully');
        
    } catch (error) {
        console.error('❌ Failed to save structured game state:', error);
    }
}

// Helper functions for game state detection
function getGamePhase() {
    // CRITICAL: Always check game state first, not finalLockedScore
    let phase;
    if (gameState === 'awaiting_choice') {
        phase = 'during-play'; // User is still making a choice
    } else if (gameState === 'locked' || gameState === 'finished') {
        phase = 'post-play'; // Game is definitely finished
    } else if (gameState === 'playing' || gameState === 'cutting' || gameState === 'animating' || currentAttempts.length > 0) {
        phase = 'during-play';
    } else {
        phase = 'pre-play';
    }
    
    console.log('🔍 DEBUG - getGamePhase():', {
        gameState,
        currentAttemptsLength: currentAttempts.length,
        finalLockedScore: !!finalLockedScore,
        detectedPhase: phase
    });
    
    return phase;
}

function isPlayStarted() {
    return gameState !== 'initial' && gameState !== 'loading';
}

function isGameFinished() {
    // Game is only finished if game state indicates completion
    return gameState === 'locked' || gameState === 'finished';
}

function getCurrentTryNumber() {
    if (gameState === 'awaiting_choice' && currentAttempts.length > 0) {
        // User is in middle of current attempt
        return currentAttempts.length;
    } else {
        // User is about to start next attempt
        return currentAttempts.length + 1;
    }
}

// Legacy save function (for compatibility)
function saveGameState() {
    try {
        console.log('💾 saveGameState() called with:', {
            gameState,
            attemptCount,
            currentAttemptsLength: currentAttempts.length
        });
        const today = getCurrentDateString();
        localStorage.setItem(STORAGE_KEYS.lastPlayDate, today);
        localStorage.setItem(STORAGE_KEYS.gameState, gameState);
        localStorage.setItem(STORAGE_KEYS.attemptCount, attemptCount.toString());
        localStorage.setItem(STORAGE_KEYS.currentAttempts, JSON.stringify(currentAttempts));
        localStorage.setItem(STORAGE_KEYS.isFinished, (gameState === 'finished' || gameState === 'locked').toString());
        
        // Save current cut state if there's an uncommitted cut
        if (gameState === 'awaiting_choice' && currentVector && currentAttempts.length > 0) {
            const currentCutState = {
                cutVector: currentVector,
                lastAttemptResult: currentAttempts[currentAttempts.length - 1],
                isAwaitingChoice: true
            };
            localStorage.setItem(STORAGE_KEYS.currentCutState, JSON.stringify(currentCutState));
            console.log('💾 Saved current cut state for uncommitted cut');
        } else {
            // Clear cut state when not in awaiting choice mode
            localStorage.removeItem(STORAGE_KEYS.currentCutState);
        }
        
        console.log('💾 Game state saved:', {
            date: today,
            gameState,
            attemptCount,
            attempts: currentAttempts.length,
            isFinished: gameState === 'finished' || gameState === 'locked'
        });
        
        if (gameState === 'finished' || gameState === 'locked') {
            const finalAttempt = currentAttempts[currentAttempts.length - 1];
            if (finalAttempt) {
                const finalScoreData = {
                    leftPercentage: finalAttempt.leftPercentage,
                    rightPercentage: finalAttempt.rightPercentage,
                    cutVector: finalAttempt.cutVector,
                    attemptCount: attemptCount,
                    splitAreas: finalAttempt.splitAreas
                };
                localStorage.setItem(STORAGE_KEYS.finalScoreData, JSON.stringify(finalScoreData));
            }
        }
        
        console.log('💾 Game state saved:', { gameState, attemptCount, isFinished: gameState === 'finished' || gameState === 'locked' });
    } catch (error) {
        console.error('❌ Failed to save game state:', error);
    }
}

// Load and analyze structured game state for refresh recovery
function loadStructuredGameState() {
    try {
        const today = getCurrentDateString();
        const lastPlayDate = localStorage.getItem(STORAGE_KEYS.lastPlayDate);
        
        console.log('🔍 Loading structured game state:', {
            today,
            lastPlayDate,
            isNewDay: lastPlayDate !== today
        });
        
        // Check if it's a new day - if so, clear previous state
        if (lastPlayDate !== today) {
            console.log('📅 New day detected, clearing previous state');
            clearStructuredGameState();
            return null;
        }
        
        // Check if we were in practice mode - if so, just reset to fresh state
        const wasPracticeMode = localStorage.getItem('dailyShapes_practiceMode') === 'true';
        if (wasPracticeMode) {
            console.log('🎮 Was in practice mode - clearing all state for fresh start');
            
            // Clear practice mode localStorage
            localStorage.removeItem('dailyShapes_practiceMode');
            
            // Reset global practice mode variable
            isPracticeMode = false;
            window.isPracticeMode = false; // Reset global for mechanics to access
            isPractiseMode = false; // Legacy compatibility
            
            // Clear any practice-related DOM elements
            const practiceElements = [
                'phase1Instructions',
                'phase2Instructions', 
                'finalPracticeInstructions',
                'practicePercentageDisplay',
                'playBtnBelowCanvas',
                'practicePlayBtn',
                'medalStatsTable'
            ];
            
            practiceElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                }
            });
            
            // Clear all game state for fresh start
            clearStructuredGameState();
            return null; // This will cause normal initialization (fresh start)
        }

        // Load all structured data
        const gamePhase = localStorage.getItem(STORAGE_KEYS.gamePhase) || 'pre-play';
        const playStarted = localStorage.getItem(STORAGE_KEYS.playStarted) === 'true';
        const isFinished = localStorage.getItem(STORAGE_KEYS.isFinished) === 'true';
        const currentTryNumber = parseInt(localStorage.getItem(STORAGE_KEYS.currentTryNumber) || '1');
        const hasTriedToday = localStorage.getItem(STORAGE_KEYS.hasTriedToday) === 'true';
        
        console.log('🔍 DEBUG - Loading from localStorage:', {
            gamePhase,
            playStarted,
            isFinished,
            currentTryNumber,
            hasTriedToday
        });
        
        const tryAttemptsData = JSON.parse(localStorage.getItem(STORAGE_KEYS.tryAttempts) || '[]');
        const currentCutData = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentCutData) || 'null');
        const displayedPercentages = JSON.parse(localStorage.getItem(STORAGE_KEYS.displayedPercentages) || 'null');
        const finalCommittedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.finalCommittedData) || 'null');
        
        const structuredState = {
            // Session info
            lastPlayDate,
            sessionTimestamp: parseInt(localStorage.getItem(STORAGE_KEYS.sessionTimestamp) || '0'),
            
            // Game phase
            gamePhase,
            playStarted,
            isFinished,
            
            // Try tracking
            currentTryNumber,
            hasTriedToday,
            tryAttemptsData,
            
            // Current state
            currentCutData,
            displayedPercentages,
            finalCommittedData,
            
            // Analysis
            needsWelcomeBack: gamePhase !== 'pre-play',
            restoreType: determineRestoreType(gamePhase, currentCutData, isFinished)
        };
        
        console.log('📂 Loaded structured state:', structuredState);
        return structuredState;
        
    } catch (error) {
        console.error('❌ Failed to load structured game state:', error);
        return null;
    }
}

// Determine what type of restoration is needed
function determineRestoreType(gamePhase, currentCutData, isFinished) {
    console.log('🔍 DEBUG - determineRestoreType inputs:', {
        gamePhase,
        hasCurrentCutData: !!currentCutData,
        isAwaitingChoice: currentCutData?.isAwaitingChoice,
        isFinished
    });
    
    if (gamePhase === 'pre-play') {
        console.log('🔍 Restore type: none (pre-play)');
        return 'none';
    } else if (gamePhase === 'post-play' || isFinished) {
        console.log('🔍 Restore type: post-play');
        return 'post-play';
    } else if (currentCutData && currentCutData.isAwaitingChoice) {
        console.log('🔍 Restore type: awaiting-choice');
        return 'awaiting-choice';
    } else {
        console.log('🔍 Restore type: during-play');
        return 'during-play';
    }
}

// Clear structured game state
function clearStructuredGameState() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🗑️ Structured game state cleared for new day');
    } catch (error) {
        console.error('❌ Failed to clear structured game state:', error);
    }
}

// Legacy load function (for compatibility)
function loadGameState() {
    try {
        const today = getCurrentDateString();
        const lastPlayDate = localStorage.getItem(STORAGE_KEYS.lastPlayDate);
        
        console.log('🔍 Loading game state:', {
            today,
            lastPlayDate,
            gameStateInStorage: localStorage.getItem(STORAGE_KEYS.gameState),
            attemptCountInStorage: localStorage.getItem(STORAGE_KEYS.attemptCount)
        });
        
        // Check if it's a new day - if so, clear previous state
        if (lastPlayDate !== today) {
            console.log('📅 New day detected, clearing previous state');
            clearGameState();
            return null;
        }
        
        const savedGameState = localStorage.getItem(STORAGE_KEYS.gameState);
        const savedAttemptCount = parseInt(localStorage.getItem(STORAGE_KEYS.attemptCount) || '0');
        const savedCurrentAttempts = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentAttempts) || '[]');
        const savedIsFinished = localStorage.getItem(STORAGE_KEYS.isFinished) === 'true';
        const savedFinalScoreData = JSON.parse(localStorage.getItem(STORAGE_KEYS.finalScoreData) || 'null');
        const savedCurrentCutState = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentCutState) || 'null');
        
        console.log('📂 Loaded game state:', { 
            savedGameState, 
            savedAttemptCount, 
            savedIsFinished,
            attemptsLength: savedCurrentAttempts.length,
            hasCutState: !!savedCurrentCutState
        });
        
        return {
            gameState: savedGameState,
            attemptCount: savedAttemptCount,
            currentAttempts: savedCurrentAttempts,
            isFinished: savedIsFinished,
            finalScoreData: savedFinalScoreData,
            currentCutState: savedCurrentCutState
        };
    } catch (error) {
        console.error('❌ Failed to load game state:', error);
        return null;
    }
}

// Clear game state (called on new day)
function clearGameState() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🗑️ Game state cleared for new day');
    } catch (error) {
        console.error('❌ Failed to clear game state:', error);
    }
}

// Check if midnight reset is needed
function checkMidnightReset() {
    try {
        const today = getCurrentDateString();
        const lastResetDate = localStorage.getItem('lastMidnightReset');
        
        if (lastResetDate !== today) {
            console.log('📅 Midnight reset needed:', { lastResetDate, today });
            
            // Clear all game state
            clearStructuredGameState();
            
            // Set new reset date
            localStorage.setItem('lastMidnightReset', today);
            console.log('🔄 Midnight reset completed');
            return true;
        }
        
        console.log('✅ No midnight reset needed');
        return false; // No reset needed
        
    } catch (error) {
        console.error('❌ Failed to check midnight reset:', error);
        return false;
    }
}

// Show CUT popup and progress circles for specific try number
function showAttemptDisplayForTry(tryNumber) {
    console.log(`🔪 Showing CUT popup for try ${tryNumber}`);
    
    // Show CUT popup
    showCutPopup();
    
    // Show progress circles with fade-in animation for all tries
    const progressCircles = document.getElementById('progressCircles');
    if (progressCircles) {
        progressCircles.style.display = 'flex';
        progressCircles.style.opacity = '0';
        // Trigger fade-in after a brief delay
        setTimeout(() => {
            progressCircles.style.transition = 'opacity 0.5s ease';
            progressCircles.style.opacity = '1';
            
            // Update circle colors based on attempts already made
            updateProgressCircles(attemptCount);
        }, 50);
    }
}

// Update progress circles based on attempt number  
function updateProgressCircles(attemptNumber) {
    const circles = ['circle1', 'circle2', 'circle3'];
    const progressCircles = document.getElementById('progressCircles');
    
    console.log('🔵 updateProgressCircles called with attemptNumber:', attemptNumber);
    
    // Ensure progress circles are visible first
    if (progressCircles) {
        progressCircles.style.display = 'flex';
        progressCircles.style.opacity = '1';
    }
    
    // Reset all circles first
    circles.forEach(circleId => {
        const circle = document.getElementById(circleId);
        if (circle) {
            circle.classList.remove('filled');
        }
    });
    
    // Fill circles based on attempts made
    for (let i = 0; i < attemptNumber && i < circles.length; i++) {
        const circle = document.getElementById(circles[i]);
        if (circle) {
            circle.classList.add('filled');
            console.log('🔵 Filled circle:', circles[i]);
        }
    }
}

// ====================================================================
// AUTHORITATIVE REFRESH FUNCTIONS (Implementation)
// ====================================================================

// Calculate correct game state based on total cuts made - AUTHORITATIVE SOURCE
// 10 shapes × 1 cut each. totalCutsMade increments on each cut and each "Next Shape" click.
// Odd totalCuts = cut just made on current shape (awaiting button)
// Even totalCuts = "Next Shape" clicked, ready for next cut
function calculateCorrectGameState(restoredState) {
    const totalCuts = restoredState.totalCutsMade || 0;

    let correctShape, correctAttempt, correctCutsThisShape, scenarioNumber;

    if (totalCuts === 0) {
        // Fresh game - Shape 1, ready for cut
        correctShape = 1; correctAttempt = 1; correctCutsThisShape = 0; scenarioNumber = "Initial";
    } else if (totalCuts >= 19) {
        // Final cut on shape 10 - game complete
        correctShape = 10; correctAttempt = 1; correctCutsThisShape = 1; scenarioNumber = "Complete";
    } else if (totalCuts % 2 === 1) {
        // Odd: cut just made on shape, awaiting "Next Shape" button
        correctShape = Math.ceil(totalCuts / 2);
        correctAttempt = 1;
        correctCutsThisShape = 1;
        scenarioNumber = totalCuts;
    } else {
        // Even: "Next Shape" clicked, ready for cut on next shape
        correctShape = (totalCuts / 2) + 1;
        correctAttempt = 1;
        correctCutsThisShape = 0;
        scenarioNumber = totalCuts;
    }

    console.log('📋 CALCULATE SCENARIO', scenarioNumber + ':', 'Total cuts:', totalCuts, '→ Shape:', correctShape, 'Attempt:', correctAttempt, 'CutsThisShape:', correctCutsThisShape);

    return {
        ...restoredState,
        currentShape: correctShape,
        currentAttempt: correctAttempt,
        cutsMadeThisShape: correctCutsThisShape,
        totalCutsMade: totalCuts,
        scenarioNumber: scenarioNumber
    };
}

function restoreAuthoritativeGameState(correctedState) {
    console.log('📋 AUTHORITATIVE RESTORE - Using corrected state:', correctedState);
    
    // CRITICAL: Ensure all global variables are synchronized with corrected state
    window.currentShapeNumber = correctedState.currentShape;
    window.currentAttemptNumber = correctedState.currentAttempt;
    window.cutsMadeThisShape = correctedState.cutsMadeThisShape;
    window.totalCutsMade = correctedState.totalCutsMade;
    
    // Also sync the local variables used by the button logic
    if (typeof currentShapeNumber !== 'undefined') {
        currentShapeNumber = correctedState.currentShape;
    }
    if (typeof currentAttemptNumber !== 'undefined') {
        currentAttemptNumber = correctedState.currentAttempt;
    }
    if (typeof cutsMadeThisShape !== 'undefined') {
        cutsMadeThisShape = correctedState.cutsMadeThisShape;
    }
    if (typeof totalCutsMade !== 'undefined') {
        totalCutsMade = correctedState.totalCutsMade;
    }
    
    console.log('✅ All variables synchronized to corrected state:', {
        currentShapeNumber: window.currentShapeNumber,
        currentAttemptNumber: window.currentAttemptNumber,
        cutsMadeThisShape: window.cutsMadeThisShape,
        totalCutsMade: window.totalCutsMade
    });
    
    // Execute the restoration based on the scenario
    if (correctedState.scenarioNumber === 11) {
        // Scenario 11 - Final cut made, show completion
        restoreCompletionState(correctedState);
    } else if (correctedState.scenarioNumber === 1 || correctedState.scenarioNumber === 3 || correctedState.scenarioNumber === 5 || correctedState.scenarioNumber === 7 || correctedState.scenarioNumber === 9) {
        // Scenarios 1,3,5,7,9 - Cut made, show button + visualization
        restoreCutCompleteState(correctedState);
    } else if (correctedState.scenarioNumber === 2 || correctedState.scenarioNumber === 4 || correctedState.scenarioNumber === 6 || correctedState.scenarioNumber === 8 || correctedState.scenarioNumber === 10) {
        // Scenarios 2,4,6,8,10 - Button clicked, ready for cut (CLEAN CUTTING STATE)
        restoreCleanCanvasState(correctedState);
    } else {
        // Initial or fallback
        restoreCleanCanvasState(correctedState);
    }
}

function restoreCleanCanvasState(restoredState) {
    console.log('🎨 SCENARIO', restoredState.scenarioNumber, '- CLEAN CANVAS STATE (Button clicked, ready for cutting)');
    
    // EXACT IMPLEMENTATION OF SCENARIOS 2,4,6,8,10 PER USER REQUIREMENTS:
    // Reload State: shape X (active canvas), progress tracker (Shape X of 10),
    // relevant pre-cut instruction (not commentary), NO BUTTONS
    
    // 1. Set correct game state variables  
    window.currentShapeNumber = restoredState.currentShape;
    window.currentAttemptNumber = restoredState.currentAttempt;
    window.cutsMadeThisShape = restoredState.cutsMadeThisShape;
    window.totalCutsMade = restoredState.totalCutsMade;
    setGameState('cutting');
    setInteractionEnabled(true);
    
    // 2. Update progress tracker with correct values
    updateProgressUI();
    
    // 3. Clear any existing buttons - we're in clean cutting state
    const fixedButtonArea = document.getElementById('fixedButtonArea');
    if (fixedButtonArea) {
        fixedButtonArea.innerHTML = '';
        fixedButtonArea.style.visibility = 'hidden';
        console.log('🚫 Cleared buttons - clean cutting state');
    }
    
    // 4. Clear any percentage displays or commentary from previous cuts
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (fixedPercentageArea) {
        fixedPercentageArea.innerHTML = '';
    }
    const commentaryArea = document.getElementById('commentary');
    if (commentaryArea) {
        commentaryArea.remove(); // Remove completely instead of just hiding
        console.log('🗑️ Removed old commentary area');
    }
    
    // 4.5. CRITICAL: Completely remove layout-interfering elements from DOM during refresh
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        // REMOVE (not just hide) the results table that causes layout shift
        const resultsTable = resultsContainer.querySelector('.results-table');
        if (resultsTable) {
            resultsTable.remove();
            console.log('🗑️ Completely removed results table to eliminate layout interference');
        }
        
        // REMOVE any other interfering elements to ensure zero layout impact
        const attemptDisplay = resultsContainer.querySelector('#attemptDisplay');
        if (attemptDisplay) {
            attemptDisplay.remove();
        }
        
        // Store what we removed for potential restoration later
        resultsContainer.setAttribute('data-elements-removed', 'true');
        console.log('🗑️ Removed all interfering elements - container now contains only fixed areas');
    }
    
    // 5. Ensure canvas is active and ready for cutting
    setTimeout(() => {
        // CRITICAL: Redraw the shape so it's visible immediately
        // But avoid calling redrawCanvas if we already cleared restoreGameState (it was already called)
        if (typeof redrawCanvas === 'function' && !window.redrawAlreadyCalled) {
            console.log('🎨 Redrawing shape for immediate visibility');
            window.redrawAlreadyCalled = true;
            redrawCanvas();
            // Clear flag after a delay to allow future redraws
            setTimeout(() => {
                window.redrawAlreadyCalled = false;
            }, 1000);
        }
        
        // Enable canvas interaction
        const canvasElement = document.getElementById('geoCanvas');
        if (canvasElement) {
            canvasElement.style.pointerEvents = 'auto';
            canvasElement.style.cursor = 'crosshair';
            console.log('✅ Canvas activated for cutting');
        }
        
        // Mark shape animation as complete
        window.isShapeAnimationComplete = true;
        
        // Reinitialize mechanic event listeners
        if (typeof setupMechanicsEventListeners === 'function') {
            setupMechanicsEventListeners();
        }
        
        // Show pre-cut instruction
        showPreCutInstruction();
        
        console.log('✅ SCENARIO', restoredState.scenarioNumber, 'restoration complete - ready for cutting on Shape', restoredState.currentShape, 'Attempt', restoredState.currentAttempt);
        
        // Clear refresh flag after restoration is complete - elements were removed, not hidden
        setTimeout(() => {
            const resultsContainer = document.querySelector('.results-container');
            if (resultsContainer) {
                resultsContainer.removeAttribute('data-elements-removed');
                console.log('🔄 Refresh restoration complete - fixed elements now in proper position');
            }
        }, 500);
    }, 200);
}

function getScenarioNumberForButton(totalCuts) {
    // Even totalCuts = "Next Shape" clicked, canvas should be active for next shape
    if (totalCuts > 0 && totalCuts % 2 === 0) return totalCuts;
    return "Initial";
}

function showPreCutInstruction() {
    // Show pre-cut instruction instead of commentary
    const mechanicName = getCurrentMechanicName();
    const instruction = getInitialInstruction(mechanicName);
    updateInstructionText(instruction, false);
}

function restoreCutCompleteState(restoredState) {
    const totalCuts = restoredState.totalCutsMade || 0;
    console.log('🎯 SCENARIO', getScenarioNumber(totalCuts), '- CUT COMPLETE STATE');
    
    // EXACT IMPLEMENTATION OF SCENARIOS 1,3,5,7,9 PER USER REQUIREMENTS:
    // Reload State: attempt X shaded shape X, attempt X percentage score, Next [Attempt/Shape] button, 
    // progress tracker (Shape X of 10), attempt X commentary
    
    // 1. Set correct game state variables
    window.currentShapeNumber = restoredState.currentShape;
    window.currentAttemptNumber = restoredState.currentAttempt;
    window.cutsMadeThisShape = restoredState.cutsMadeThisShape;
    window.totalCutsMade = restoredState.totalCutsMade;
    setGameState('awaiting_choice');
    setInteractionEnabled(false);
    
    // 2. Update progress tracker with correct values
    updateProgressUI();
    
    // 2.5. CRITICAL: Completely remove layout-interfering elements from DOM during refresh
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        // REMOVE (not just hide) the results table that causes layout shift
        const resultsTable = resultsContainer.querySelector('.results-table');
        if (resultsTable) {
            resultsTable.remove();
            console.log('🗑️ Completely removed results table to eliminate layout interference');
        }
        
        // REMOVE any other interfering elements to ensure zero layout impact
        const attemptDisplay = resultsContainer.querySelector('#attemptDisplay');
        if (attemptDisplay) {
            attemptDisplay.remove();
        }
        
        // Store what we removed for potential restoration later
        resultsContainer.setAttribute('data-elements-removed', 'true');
        console.log('🗑️ Removed all interfering elements - container now contains only fixed areas');
    }
    
    // 3. Restore shaded shape with percentage score  
    setTimeout(() => {
        restoreCompleteVisualState(restoredState);
    }, 200);
    
    // 4. Commentary disabled after refresh
    // Commentary should only show after actual cuts, not on refresh
    // setTimeout(() => {
    //     restoreAttemptCommentary(restoredState);
    // }, 400);
    
    // 5. Determine and show correct button
    let buttonType;
    if (restoredState.cutsMadeThisShape >= 1 && restoredState.currentShape < 10) {
        buttonType = 'Next Shape';
    }
    
    console.log('🔘 Will show:', buttonType, 'button for Shape', restoredState.currentShape, 'Cut', restoredState.cutsMadeThisShape);
    
    // 6. Create and show the button
    setTimeout(() => {
        createProgressionButton();
        
        // Force button visibility as specified - preserve original positioning
        const buttonArea = document.getElementById('fixedButtonArea');
        if (buttonArea) {
            // Use individual style properties instead of cssText to preserve existing styles
            buttonArea.style.setProperty('display', 'flex', 'important');  // Match CSS: display: flex
            buttonArea.style.setProperty('visibility', 'visible', 'important');
            buttonArea.style.setProperty('opacity', '1', 'important');
            console.log('✅', buttonType, 'button forced visible with preserved positioning');
        }
    }, 300);
    
    console.log('✅ SCENARIO', getScenarioNumber(totalCuts), 'restoration complete');
    
    // Clear refresh flag after restoration is complete - elements were removed, not hidden
    setTimeout(() => {
        const resultsContainer = document.querySelector('.results-container');
        if (resultsContainer) {
            resultsContainer.removeAttribute('data-elements-removed');
            console.log('🔄 Refresh restoration complete - fixed elements now in proper position');
        }
    }, 500);
}

function getScenarioNumber(totalCuts) {
    // In 10×1 mode: odd totalCuts = cut just made, even = button clicked
    if (totalCuts > 0) return totalCuts;
    return "Unknown";
}

function restoreCompletionState(restoredState) {
    console.log('🎉 COMPLETION STATE - Game finished');
    setGameState('finished');

    // CRITICAL: Skip visual restoration and go straight to completion view
    // The completion view will render its own canvas content
    console.log('⏩ Skipping visual restoration - going straight to completion view');

    // Clear any pending canvas restoration to prevent flashing
    if (window.pendingCanvasRestoration) {
        window.pendingCanvasRestoration = null;
        console.log('🔄 Cleared pendingCanvasRestoration to prevent visual flash');
    }

    // Show completion view immediately without delay
    showDayStatsPopup();
}


// ====================================================================
// GAME STATE PERSISTENCE FUNCTIONS
// ====================================================================

// ====================================================================
// STRUCTURED REFRESH RECOVERY SYSTEM
// ====================================================================

// Save comprehensive game state for structured refresh recovery
function saveStructuredGameState() {
    try {
        const today = getCurrentDateString();
        const timestamp = Date.now();
        
        console.log('💾 Saving structured game state:', {
            gamePhase: getGamePhase(),
            currentTryNumber: getCurrentTryNumber(),
            playStarted: isPlayStarted(),
            isFinished: isGameFinished()
        });
        
        // Session validation
        localStorage.setItem(STORAGE_KEYS.lastPlayDate, today);
        localStorage.setItem(STORAGE_KEYS.sessionTimestamp, timestamp.toString());
        
        // Game phase tracking
        localStorage.setItem(STORAGE_KEYS.gamePhase, getGamePhase());
        localStorage.setItem(STORAGE_KEYS.playStarted, isPlayStarted().toString());
        localStorage.setItem(STORAGE_KEYS.isFinished, isGameFinished().toString());
        
        // Try tracking
        localStorage.setItem(STORAGE_KEYS.currentTryNumber, getCurrentTryNumber().toString());
        localStorage.setItem(STORAGE_KEYS.hasTriedToday, (currentAttempts.length > 0).toString());
        
        // Save try attempts data
        const tryAttemptsData = currentAttempts.map(attempt => ({
            tryNumber: attempt.tryNumber || currentAttempts.indexOf(attempt) + 1,
            leftPercentage: attempt.leftPercentage,
            rightPercentage: attempt.rightPercentage,
            cutVector: attempt.cutVector,
            splitAreas: attempt.splitAreas,
            timestamp: attempt.timestamp || Date.now()
        }));
        localStorage.setItem(STORAGE_KEYS.tryAttempts, JSON.stringify(tryAttemptsData));
        
        // Save current cut data if awaiting choice
        if (gameState === 'awaiting_choice' && currentVector) {
            const currentCutData = {
                cutVector: currentVector,
                lastAttemptResult: currentAttempts[currentAttempts.length - 1],
                isAwaitingChoice: true,
                tryNumber: getCurrentTryNumber()
            };
            localStorage.setItem(STORAGE_KEYS.currentCutData, JSON.stringify(currentCutData));
        } else {
            localStorage.removeItem(STORAGE_KEYS.currentCutData);
        }
        
        // Save UI state
        if (currentAttempts.length > 0) {
            const latestAttempt = currentAttempts[currentAttempts.length - 1];
            const displayData = {
                leftPercentage: latestAttempt.leftPercentage,
                rightPercentage: latestAttempt.rightPercentage,
                tryNumber: getCurrentTryNumber()
            };
            localStorage.setItem(STORAGE_KEYS.displayedPercentages, JSON.stringify(displayData));
        }
        
        // Save final committed data
        if (finalLockedScore) {
            const finalData = {
                leftPercentage: finalLockedScore.leftPercentage,
                rightPercentage: finalLockedScore.rightPercentage,
                attemptCount: attemptCount,
                cutVector: currentVector,
                splitAreas: currentAttempts[currentAttempts.length - 1]?.splitAreas,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEYS.finalCommittedData, JSON.stringify(finalData));
        }
        
        console.log('✅ Structured game state saved successfully');
        
    } catch (error) {
        console.error('❌ Failed to save structured game state:', error);
    }
}

// Helper functions for game state detection
function getGamePhase() {
    // CRITICAL: Always check game state first, not finalLockedScore
    let phase;
    if (gameState === 'awaiting_choice') {
        phase = 'during-play'; // User is still making a choice
    } else if (gameState === 'locked' || gameState === 'finished') {
        phase = 'post-play'; // Game is definitely finished
    } else if (gameState === 'playing' || gameState === 'cutting' || gameState === 'animating' || currentAttempts.length > 0) {
        phase = 'during-play';
    } else {
        phase = 'pre-play';
    }
    
    console.log('🔍 DEBUG - getGamePhase():', {
        gameState,
        currentAttemptsLength: currentAttempts.length,
        finalLockedScore: !!finalLockedScore,
        detectedPhase: phase
    });
    
    return phase;
}

function isPlayStarted() {
    return gameState !== 'initial' && gameState !== 'loading';
}

function isGameFinished() {
    // Game is only finished if game state indicates completion
    return gameState === 'locked' || gameState === 'finished';
}

function getCurrentTryNumber() {
    if (gameState === 'awaiting_choice' && currentAttempts.length > 0) {
        // User is in middle of current attempt
        return currentAttempts.length;
    } else {
        // User is about to start next attempt
        return currentAttempts.length + 1;
    }
}

// Legacy save function (for compatibility)
function saveGameState() {
    try {
        console.log('💾 saveGameState() called with:', {
            gameState,
            attemptCount,
            currentAttemptsLength: currentAttempts.length
        });
        const today = getCurrentDateString();
        localStorage.setItem(STORAGE_KEYS.lastPlayDate, today);
        localStorage.setItem(STORAGE_KEYS.gameState, gameState);
        localStorage.setItem(STORAGE_KEYS.attemptCount, attemptCount.toString());
        localStorage.setItem(STORAGE_KEYS.currentAttempts, JSON.stringify(currentAttempts));
        localStorage.setItem(STORAGE_KEYS.isFinished, (gameState === 'finished' || gameState === 'locked').toString());
        
        // Save current cut state if there's an uncommitted cut
        if (gameState === 'awaiting_choice' && currentVector && currentAttempts.length > 0) {
            const currentCutState = {
                cutVector: currentVector,
                lastAttemptResult: currentAttempts[currentAttempts.length - 1],
                isAwaitingChoice: true
            };
            localStorage.setItem(STORAGE_KEYS.currentCutState, JSON.stringify(currentCutState));
            console.log('💾 Saved current cut state for uncommitted cut');
        } else {
            // Clear cut state when not in awaiting choice mode
            localStorage.removeItem(STORAGE_KEYS.currentCutState);
        }
        
        console.log('💾 Game state saved:', {
            date: today,
            gameState,
            attemptCount,
            attempts: currentAttempts.length,
            isFinished: gameState === 'finished' || gameState === 'locked'
        });
        
        if (gameState === 'finished' || gameState === 'locked') {
            const finalAttempt = currentAttempts[currentAttempts.length - 1];
            if (finalAttempt) {
                const finalScoreData = {
                    leftPercentage: finalAttempt.leftPercentage,
                    rightPercentage: finalAttempt.rightPercentage,
                    cutVector: finalAttempt.cutVector,
                    attemptCount: attemptCount,
                    splitAreas: finalAttempt.splitAreas
                };
                localStorage.setItem(STORAGE_KEYS.finalScoreData, JSON.stringify(finalScoreData));
            }
        }
        
        console.log('💾 Game state saved:', { gameState, attemptCount, isFinished: gameState === 'finished' || gameState === 'locked' });
    } catch (error) {
        console.error('❌ Failed to save game state:', error);
    }
}

// Load and analyze structured game state for refresh recovery
function loadStructuredGameState() {
    try {
        const today = getCurrentDateString();
        const lastPlayDate = localStorage.getItem(STORAGE_KEYS.lastPlayDate);
        
        console.log('🔍 Loading structured game state:', {
            today,
            lastPlayDate,
            isNewDay: lastPlayDate !== today
        });
        
        // Check if it's a new day - if so, clear previous state
        if (lastPlayDate !== today) {
            console.log('📅 New day detected, clearing previous state');
            clearStructuredGameState();
            return null;
        }
        
        // Check if we were in practice mode - if so, just reset to fresh state
        const wasPracticeMode = localStorage.getItem('dailyShapes_practiceMode') === 'true';
        if (wasPracticeMode) {
            console.log('🎮 Was in practice mode - clearing all state for fresh start');
            
            // Clear practice mode localStorage
            localStorage.removeItem('dailyShapes_practiceMode');
            
            // Reset global practice mode variable
            isPracticeMode = false;
            window.isPracticeMode = false; // Reset global for mechanics to access
            isPractiseMode = false; // Legacy compatibility
            
            // Clear any practice-related DOM elements
            const practiceElements = [
                'phase1Instructions',
                'phase2Instructions', 
                'finalPracticeInstructions',
                'practicePercentageDisplay',
                'playBtnBelowCanvas',
                'practicePlayBtn',
                'medalStatsTable'
            ];
            
            practiceElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                }
            });
            
            // Clear all game state for fresh start
            clearStructuredGameState();
            return null; // This will cause normal initialization (fresh start)
        }

        // Load all structured data
        const gamePhase = localStorage.getItem(STORAGE_KEYS.gamePhase) || 'pre-play';
        const playStarted = localStorage.getItem(STORAGE_KEYS.playStarted) === 'true';
        const isFinished = localStorage.getItem(STORAGE_KEYS.isFinished) === 'true';
        const currentTryNumber = parseInt(localStorage.getItem(STORAGE_KEYS.currentTryNumber) || '1');
        const hasTriedToday = localStorage.getItem(STORAGE_KEYS.hasTriedToday) === 'true';
        
        console.log('🔍 DEBUG - Loading from localStorage:', {
            gamePhase,
            playStarted,
            isFinished,
            currentTryNumber,
            hasTriedToday
        });
        
        const tryAttemptsData = JSON.parse(localStorage.getItem(STORAGE_KEYS.tryAttempts) || '[]');
        const currentCutData = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentCutData) || 'null');
        const displayedPercentages = JSON.parse(localStorage.getItem(STORAGE_KEYS.displayedPercentages) || 'null');
        const finalCommittedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.finalCommittedData) || 'null');
        
        const structuredState = {
            // Session info
            lastPlayDate,
            sessionTimestamp: parseInt(localStorage.getItem(STORAGE_KEYS.sessionTimestamp) || '0'),
            
            // Game phase
            gamePhase,
            playStarted,
            isFinished,
            
            // Try tracking
            currentTryNumber,
            hasTriedToday,
            tryAttemptsData,
            
            // Current state
            currentCutData,
            displayedPercentages,
            finalCommittedData,
            
            // Analysis
            needsWelcomeBack: gamePhase !== 'pre-play',
            restoreType: determineRestoreType(gamePhase, currentCutData, isFinished)
        };
        
        console.log('📂 Loaded structured state:', structuredState);
        return structuredState;
        
    } catch (error) {
        console.error('❌ Failed to load structured game state:', error);
        return null;
    }
}

// Determine what type of restoration is needed
function determineRestoreType(gamePhase, currentCutData, isFinished) {
    console.log('🔍 DEBUG - determineRestoreType inputs:', {
        gamePhase,
        hasCurrentCutData: !!currentCutData,
        isAwaitingChoice: currentCutData?.isAwaitingChoice,
        isFinished
    });
    
    if (gamePhase === 'pre-play') {
        console.log('🔍 Restore type: none (pre-play)');
        return 'none';
    } else if (gamePhase === 'post-play' || isFinished) {
        console.log('🔍 Restore type: post-play');
        return 'post-play';
    } else if (currentCutData && currentCutData.isAwaitingChoice) {
        console.log('🔍 Restore type: awaiting-choice');
        return 'awaiting-choice';
    } else {
        console.log('🔍 Restore type: during-play');
        return 'during-play';
    }
}

// Clear structured game state
function clearStructuredGameState() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🗑️ Structured game state cleared for new day');
    } catch (error) {
        console.error('❌ Failed to clear structured game state:', error);
    }
}

// Legacy load function (for compatibility)
function loadGameState() {
    try {
        const today = getCurrentDateString();
        const lastPlayDate = localStorage.getItem(STORAGE_KEYS.lastPlayDate);
        
        console.log('🔍 Loading game state:', {
            today,
            lastPlayDate,
            gameStateInStorage: localStorage.getItem(STORAGE_KEYS.gameState),
            attemptCountInStorage: localStorage.getItem(STORAGE_KEYS.attemptCount)
        });
        
        // Check if it's a new day - if so, clear previous state
        if (lastPlayDate !== today) {
            console.log('📅 New day detected, clearing previous state');
            clearGameState();
            return null;
        }
        
        const savedGameState = localStorage.getItem(STORAGE_KEYS.gameState);
        const savedAttemptCount = parseInt(localStorage.getItem(STORAGE_KEYS.attemptCount) || '0');
        const savedCurrentAttempts = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentAttempts) || '[]');
        const savedIsFinished = localStorage.getItem(STORAGE_KEYS.isFinished) === 'true';
        const savedFinalScoreData = JSON.parse(localStorage.getItem(STORAGE_KEYS.finalScoreData) || 'null');
        const savedCurrentCutState = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentCutState) || 'null');
        
        console.log('📂 Loaded game state:', { 
            savedGameState, 
            savedAttemptCount, 
            savedIsFinished,
            attemptsLength: savedCurrentAttempts.length,
            hasCutState: !!savedCurrentCutState
        });
        
        return {
            gameState: savedGameState,
            attemptCount: savedAttemptCount,
            currentAttempts: savedCurrentAttempts,
            isFinished: savedIsFinished,
            finalScoreData: savedFinalScoreData,
            currentCutState: savedCurrentCutState
        };
    } catch (error) {
        console.error('❌ Failed to load game state:', error);
        return null;
    }
}

// Clear game state (called on new day)
function clearGameState() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🗑️ Game state cleared for new day');
    } catch (error) {
        console.error('❌ Failed to clear game state:', error);
    }
}

// Get current date string for consistency
function getCurrentDateString() {
    // PROMO VIDEO OVERRIDE - Return fixed date for shape loading
    // Format: YYYY-MM-DD (must match folder name in Supabase bucket)
    return '2025-11-11'; // Fixed date for promo video - Tuesday shapes

    // Simple date format without DateUtils dependency
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ====================================================================
// MIDNIGHT RESET FUNCTIONALITY
// ====================================================================

// Check if it's past midnight and clear state if needed
function checkMidnightReset() {
    try {
        const now = new Date();
        const today = getCurrentDateString();
        
        // Check if stored date is different from today
        const storedDate = localStorage.getItem(STORAGE_KEYS.lastPlayDate);
        
        if (storedDate && storedDate !== today) {
            console.log('🌙 Midnight reset detected:', {
                storedDate,
                today,
                timeDiff: now.toISOString()
            });
            
            // Clear all game state for new day
            clearStructuredGameState();
            
            // Reset global variables
            gameState = 'initial';
            currentAttempts = [];
            attemptCount = 0;
            finalLockedScore = null;
            currentVector = null;
            
            console.log('✅ Game state reset for new day');
            return true; // Reset occurred
        }
        
        return false; // No reset needed
        
    } catch (error) {
        console.error('❌ Failed to check midnight reset:', error);
        return false;
    }
}

// Set up periodic midnight check (runs every 5 minutes)
function setupMidnightCheck() {
    // Check immediately on startup
    checkMidnightReset();
    
    // Then check every 5 minutes
    setInterval(() => {
        if (checkMidnightReset()) {
            console.log('🔄 Midnight reset triggered - reloading page for fresh start');
            // Optionally reload the page for a completely fresh start
            // window.location.reload();
        }
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log('⏰ Midnight reset check scheduled every 5 minutes');
}

// ====================================================================
// DYNAMIC WELCOME BACK POPUP SYSTEM
// ====================================================================

// Show structured Welcome Back popup based on game state
function showStructuredWelcomeBackPopup(structuredState) {
    // Suppress welcome back popup if day is already complete
    if (dailyGameState && dailyGameState.dayComplete) {
        console.log('✅ Day complete - suppressing structured welcome back popup');
        return;
    }
    
    const popup = document.getElementById('welcomeBackPopup');
    const welcomeBackText = document.getElementById('welcomeBackText');
    const continueBtn = document.getElementById('continueBtn');
    
    if (!popup || !welcomeBackText || !continueBtn) {
        console.error('❌ Welcome Back popup elements not found');
        return;
    }
    
    // Generate dynamic message based on game state
    const message = generateWelcomeBackMessage(structuredState);
    welcomeBackText.innerHTML = message; // Use innerHTML to support HTML formatting
    
    // Hide play button during popup
    hidePlayButton();
    
    // Show popup
    popup.style.display = 'flex';
    
    // Handle continue button click with structured restoration
    continueBtn.onclick = () => {
        popup.style.display = 'none';
        console.log('🔄 Player continued from structured welcome back');
        
        // Perform the appropriate restoration based on state
        performStructuredRestoration(structuredState);
        
        // Save updated state
        saveStructuredGameState();
    };
    
    console.log('👋 Structured Welcome Back popup shown for:', structuredState.restoreType);
}

// Generate dynamic welcome back message
function generateWelcomeBackMessage(structuredState) {
    const { restoreType, currentTryNumber, hasTriedToday, tryAttemptsData, currentCutData } = structuredState;
    
    switch (restoreType) {
        case 'during-play':
            if (!hasTriedToday) {
                return "Welcome back.<br>You haven't had a try yet.";
            } else {
                const completedTries = tryAttemptsData.length;
                const tryText = completedTries === 1 ? 'try' : 'tries';
                return `Welcome back.<br>You've made ${completedTries} ${tryText}.`;
            }
            
        case 'awaiting-choice':
            const currentAttempt = currentTryNumber;
            const attemptSuffix = currentAttempt === 1 ? 'st' : currentAttempt === 2 ? 'nd' : 'rd';
            return `Welcome back.<br>You're in the middle of your ${currentAttempt}${attemptSuffix} try.`;
            
        case 'post-play':
            return "Welcome back.<br>You've completed today's puzzle.";
            
        default:
            return "Welcome back.";
    }
}

// Perform structured restoration based on state type
async function performStructuredRestoration(structuredState) {
    const { restoreType, tryAttemptsData, currentCutData, displayedPercentages, finalCommittedData } = structuredState;
    
    console.log('🔄 Performing structured restoration:', restoreType);
    console.log('🔄 DEBUG - Full structured state:', structuredState);
    
    try {
        switch (restoreType) {
            case 'during-play':
                await restoreDuringPlayState(structuredState);
                break;
                
            case 'awaiting-choice':
                await restoreAwaitingChoiceState(structuredState);
                break;
                
            case 'post-play':
                await restorePostPlayState(structuredState);
                break;
                
            default:
                console.log('ℹ️ No restoration needed for:', restoreType);
        }
    } catch (error) {
        console.error('❌ Failed to perform structured restoration:', error);
    }
}

// Restore during-play state (active field, ready for next cut)
async function restoreDuringPlayState(structuredState) {
    const { currentTryNumber, tryAttemptsData, displayedPercentages } = structuredState;
    
    console.log('🎮 Restoring during-play state for try:', currentTryNumber);
    console.log('🎮 DEBUG - Restoration data:', {
        currentTryNumber,
        tryAttemptsDataLength: tryAttemptsData?.length,
        hasDisplayedPercentages: !!displayedPercentages,
        displayedPercentages,
        tryAttemptsData
    });
    
    // Restore global game state
    attemptCount = tryAttemptsData.length;
    
    // Check if already at max attempts
    if (attemptCount >= maxAttempts) {
        console.log('⚠️ Already at max attempts - no more cuts allowed');
        // Should not happen in during-play state, but safeguard
    }
    
    currentAttempts = tryAttemptsData.map(data => ({
        leftPercentage: data.leftPercentage,
        rightPercentage: data.rightPercentage,
        cutVector: data.cutVector,
        splitAreas: data.splitAreas,
        tryNumber: data.tryNumber
    }));
    
    // Load shape data first before rendering (critical for grid display)
    console.log('🔄 Loading shape data for state restoration...');
    if (!parsedShapes || parsedShapes.length === 0) {
        try {
            await loadDailyShape();
            console.log('✅ Shape data loaded for state restoration');
        } catch (error) {
            console.error('❌ Failed to load shape data during restoration:', error);
        }
    }
    
    // Hide play button first
    hidePlayButton();
    
    // Render the shape on canvas (critical for interaction to work)
    renderCurrentShape();
    
    // Mobile-specific fix: Add delay for grid rendering on mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // On mobile, add a short delay to ensure canvas context is ready
        setTimeout(() => {
            console.log('📱 Mobile: Delayed grid rendering');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            if (parsedShapes && parsedShapes.length > 0) {
                renderShapeForCutting(parsedShapes);
            }
            console.log('✅ Mobile: Grid and shape rendered after delay');
        }, 100);
    } else {
        // Desktop: Immediate rendering
        console.log('🔄 Desktop: Ensuring grid and shape are visible after refresh');
        if (!parsedShapes || parsedShapes.length === 0) {
            console.warn('⚠️ No parsed shapes available for grid rendering');
        } else {
            // Force redraw grid and shape to ensure visibility
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            renderShapeForCutting(parsedShapes);
            console.log('✅ Desktop: Grid and shape force-rendered after refresh');
        }
    }

    // CRITICAL: Only enable interaction if game is not complete
    if (window.dailyGameState && (window.dailyGameState.dayComplete || window.dailyGameState.isGameComplete)) {
        gameState = 'finished';
        isInteractionEnabled = false;
        if (canvas) {
            canvas.style.pointerEvents = 'none';
        }
        console.log('🚫 Game is complete - keeping interaction disabled');
    } else {
        // Set game state to 'cutting' like in normal flow
        gameState = 'cutting';
        isInteractionEnabled = true;

        // Enable canvas interaction
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            console.log('✅ Canvas interaction enabled for restored playing state');
        }
    }
    
    // Ensure results container is visible
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        resultsContainer.style.display = 'block';
    }
    
    // For first attempt (no tries yet), show goal beneath canvas with proper setup
    if (tryAttemptsData.length === 0) {
        // Show goal beneath canvas like in normal game start
        const resultsContainer = document.querySelector('.results-container');
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
            
            // Hide the old table
            const table = resultsContainer.querySelector('.results-table');
            if (table) {
                table.style.display = 'none';
            }
            
            // Show goal display
            const goalDisplay = document.getElementById('goalDisplay');
            const goalTextEl = document.getElementById('goalText');
            
            // Hide any goal display - should not be visible during cutting state
            if (goalDisplay) {
                goalDisplay.style.display = 'none';
                goalDisplay.style.opacity = '0';
            }
            
            // Show CUT popup and progress circles for state restoration
            setTimeout(() => {
                showCutPopup();
                
                // Show progress circles with correct state
                const progressCircles = document.getElementById('progressCircles');
                if (progressCircles) {
                    progressCircles.style.display = 'flex';
                    progressCircles.style.opacity = '1';
                    
                    // Update circle states based on current attemptCount using same approach as normal gameplay
                    const circles = ['circle1', 'circle2', 'circle3'];
                    
                    // Reset all circles first
                    circles.forEach(circleId => {
                        const circle = document.getElementById(circleId);
                        if (circle) {
                            circle.classList.remove('filled');
                        }
                    });
                    
                    // Fill completed attempts using CSS class
                    for (let i = 0; i < attemptCount && i < circles.length; i++) {
                        const circle = document.getElementById(circles[i]);
                        if (circle) {
                            circle.classList.add('filled');
                        }
                    }
                }
            }, 300);
            
            // No attempt display needed - just progress circles
        }
    } else {
        // After first attempt: ALWAYS show previous percentages in large format, hide goal box
        console.log('🎮 DEBUG - About to show previous percentages:', {
            hasDisplayedPercentages: !!displayedPercentages,
            displayedPercentages,
            currentAttemptsLength: currentAttempts.length,
            currentAttempts
        });
        
        // Hide the goal display completely - we don't want the goal box visible
        const goalDisplay = document.getElementById('goalDisplay');
        if (goalDisplay) {
            goalDisplay.style.display = 'none';
        }
        
        if (displayedPercentages) {
            console.log('🎮 Using displayedPercentages for attempt result display');
            showAttemptResult(displayedPercentages.leftPercentage, displayedPercentages.rightPercentage);
        } else if (currentAttempts.length > 0) {
            // Fallback: use the last attempt if displayedPercentages wasn't saved properly
            console.log('🎮 Using fallback currentAttempts for attempt result display');
            const lastAttempt = currentAttempts[currentAttempts.length - 1];
            showAttemptResult(lastAttempt.leftPercentage, lastAttempt.rightPercentage);
        } else {
            // This should never happen after first attempt, but safety fallback
            console.warn('⚠️ No previous percentages to display after attempts made');
        }
        
        // Show attempt display for next try - ensure it's properly positioned after attempt result
        setTimeout(() => {
            console.log('🎮 About to call showAttemptDisplayForTry with:', currentTryNumber);
            
            // Make sure we have the results container
            const resultsContainer = document.querySelector('.results-container');
            const attemptResult = document.querySelector('.attempt-result');
            
            // Show CUT popup for current try
            showCutPopup();
            
            // Show progress circles for subsequent attempts too
            const progressCircles = document.getElementById('progressCircles');
            if (progressCircles) {
                progressCircles.style.display = 'flex';
                progressCircles.style.opacity = '1';
                
                // Update circle states based on current attemptCount
                const circles = ['circle1', 'circle2', 'circle3'];
                
                // Reset all circles first
                circles.forEach(circleId => {
                    const circle = document.getElementById(circleId);
                    if (circle) {
                        circle.classList.remove('filled');
                    }
                });
                
                // Fill completed attempts using CSS class
                for (let i = 0; i < attemptCount && i < circles.length; i++) {
                    const circle = document.getElementById(circles[i]);
                    if (circle) {
                        circle.classList.add('filled');
                    }
                }
                
                console.log('✅ Progress circles restored for subsequent attempts, filled:', attemptCount);
            }
            
            console.log('🎮 Showing CUT popup for try:', currentTryNumber);
        }, 50);
    }
    
    // Ensure interaction is truly enabled
    isInteractionEnabled = true;
    if (canvas) {
        canvas.style.pointerEvents = 'auto';
    }
    
    console.log('🎮 During-play state restored:', {
        canvasEnabled: canvas?.style.pointerEvents === 'auto',
        isInteractionEnabled: isInteractionEnabled,
        goalDisplayVisible: document.getElementById('goalDisplay')?.style.display === 'block',
        attemptNumber: currentTryNumber
    });
    
    // Final verification of goal display content
    const finalGoalDisplay = document.getElementById('goalDisplay');
    const finalGoalText = document.getElementById('goalText');
    console.log('🎮 FINAL STATE CHECK:', {
        goalDisplayExists: !!finalGoalDisplay,
        goalDisplayVisible: finalGoalDisplay?.style.display,
        goalDisplayOpacity: finalGoalDisplay?.style.opacity,
        goalTextExists: !!finalGoalText,
        goalTextContent: finalGoalText?.innerHTML,
        cutPopupExists: !!document.getElementById('cutPopup')
    });
}

// Restore awaiting-choice state (cut made, buttons needed)
async function restoreAwaitingChoiceState(structuredState) {
    const { currentCutData, currentTryNumber, tryAttemptsData } = structuredState;
    
    console.log('🔘 Restoring awaiting-choice state for try:', currentTryNumber);
    
    if (!currentCutData) {
        console.error('❌ No current cut data for awaiting-choice restoration');
        return;
    }
    
    // Restore global game state arrays
    attemptCount = tryAttemptsData.length;
    
    // CRITICAL: Check if player has already used all attempts
    if (attemptCount >= maxAttempts) {
        console.log('⚠️ Player has already used all attempts - forcing to post-play state');
        // Convert to post-play state with the last attempt as final
        structuredState.restoreType = 'post-play';
        structuredState.finalCommittedData = {
            leftPercentage: currentCutData.lastAttemptResult.leftPercentage,
            rightPercentage: currentCutData.lastAttemptResult.rightPercentage,
            attemptCount: attemptCount,
            cutVector: currentCutData.cutVector,
            splitAreas: currentCutData.lastAttemptResult.splitAreas
        };
        await restorePostPlayState(structuredState);
        return;
    }
    
    currentAttempts = tryAttemptsData.map(data => ({
        leftPercentage: data.leftPercentage,
        rightPercentage: data.rightPercentage,
        cutVector: data.cutVector,
        splitAreas: data.splitAreas,
        tryNumber: data.tryNumber
    }));
    
    // Hide play button first
    hidePlayButton();
    
    // First render the base shapes (uncut)
    renderCurrentShape();
    
    // Restore current cut vector
    currentVector = currentCutData.cutVector;
    const cutResult = currentCutData.lastAttemptResult;
    
    // Set game state to awaiting choice
    gameState = 'awaiting_choice';
    isInteractionEnabled = false;
    
    // Disable canvas interaction explicitly
    if (canvas) {
        canvas.style.pointerEvents = 'none';
        console.log('🚫 Canvas interaction disabled for awaiting-choice state');
    }
    
    // Show results container
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        resultsContainer.style.display = 'block';
    }
    
    // Render the cut with colors on top of base shapes
    renderVectorCutResult(cutResult);
    
    // Show the percentages (this creates the percentage display)
    showAttemptResult(cutResult.leftPercentage, cutResult.rightPercentage);
    
    // Hide goal display - we don't want empty goal box
    const goalDisplay = document.getElementById('goalDisplay');
    if (goalDisplay) {
        goalDisplay.style.display = 'none';
    }
    
    // Show attempt display for current try
    showAttemptDisplayForTry(currentTryNumber);
    
    // Show progress circles with correct state based on attemptCount
    const progressCircles = document.getElementById('progressCircles');
    if (progressCircles) {
        progressCircles.style.display = 'flex';
        progressCircles.style.opacity = '1';
        
        // Fill circles based on number of attempts made using the same approach as normal gameplay
        const circles = ['circle1', 'circle2', 'circle3'];
        
        // Reset all circles first
        circles.forEach(circleId => {
            const circle = document.getElementById(circleId);
            if (circle) {
                circle.classList.remove('filled');
            }
        });
        
        // Fill completed attempts using CSS class (same as updateProgressCircles function)
        for (let i = 0; i < attemptCount && i < circles.length; i++) {
            const circle = document.getElementById(circles[i]);
            if (circle) {
                circle.classList.add('filled');
            }
        }
    }
    
    // Automatically proceed to next attempt after a short delay
    setTimeout(() => {
        console.log('🔘 Automatically proceeding to next attempt after restoration');
        if (gameState === 'awaiting_choice' && attemptCount < maxAttempts) {
            handleTryAgain();
        } else {
            console.log('🔘 Not proceeding - gameState is:', gameState, 'attemptCount:', attemptCount);
        }
    }, 1500); // 1.5 second delay to let user see the restored state
    
    // Ensure progress circles are visible
    setTimeout(() => {
        ensureProgressCirclesVisible();
    }, 100);
    
    console.log('🔘 Awaiting-choice state restored:', {
        canvasDisabled: canvas?.style.pointerEvents === 'none',
        percentagesShown: true,
        currentTryNumber: currentTryNumber,
        gameState: gameState
    });
}

// Restore post-play state (final results, share button)
async function restorePostPlayState(structuredState) {
    const { finalCommittedData, tryAttemptsData } = structuredState;
    
    console.log('🏁 Restoring post-play state');
    
    if (!finalCommittedData) {
        console.error('❌ No final committed data for post-play restoration');
        return;
    }
    
    // Restore attempts data for medal table
    if (tryAttemptsData && tryAttemptsData.length > 0) {
        currentAttempts = tryAttemptsData;
        console.log('🏁 Restored attempts data:', currentAttempts.length, 'attempts');
    }
    
    // Restore global game state
    gameState = 'locked';
    attemptCount = finalCommittedData.attemptCount;
    finalLockedScore = {
        leftPercentage: finalCommittedData.leftPercentage,
        rightPercentage: finalCommittedData.rightPercentage
    };
    isInteractionEnabled = false;
    
    // Restore cut vector if available
    if (finalCommittedData.cutVector) {
        currentVector = finalCommittedData.cutVector;
        
        // Render the final cut with colors
        const finalResult = {
            leftPercentage: finalCommittedData.leftPercentage,
            rightPercentage: finalCommittedData.rightPercentage,
            splitAreas: finalCommittedData.splitAreas
        };
        renderVectorCutResult(finalResult);
    }
    
    // Hide play button
    hidePlayButton();
    
    // Create final attempt result for display
    const attemptResult = {
        leftPercentage: finalCommittedData.leftPercentage,
        rightPercentage: finalCommittedData.rightPercentage,
        attemptCount: finalCommittedData.attemptCount
    };
    
    // Fetch and show today's average
    let todaysAverage = null;
    try {
        todaysAverage = await supabaseClient.getTodaysAverage(currentDate);
    } catch (error) {
        console.error('Failed to get today\'s average for restored state:', error);
    }
    
    showCommittedResultInstant(attemptResult, todaysAverage);
    
    // Show post-lock-in elements (share button and countdown)
    showPostLockInElements();
    
    // Ensure progress circles are visible in post-play state
    setTimeout(() => {
        ensureProgressCirclesVisible();
    }, 100);
}

// Show CUT popup and progress circles for specific try number
function showAttemptDisplayForTry(tryNumber) {
    console.log(`🔪 Showing CUT popup for try ${tryNumber}`);
    
    // Show CUT popup
    showCutPopup();
    
    // Show progress circles with fade-in animation for all tries
    const progressCircles = document.getElementById('progressCircles');
    if (progressCircles) {
        progressCircles.style.display = 'flex';
        progressCircles.style.opacity = '0';
        // Trigger fade-in after a brief delay
        setTimeout(() => {
            progressCircles.style.transition = 'opacity 0.5s ease';
            progressCircles.style.opacity = '1';
            
            // Update circle colors based on attempts already made
            updateProgressCircles(attemptCount);
        }, 50);
    }
}

// Update progress circles based on attempt number
function updateProgressCircles(attemptNumber) {
    const circles = ['circle1', 'circle2', 'circle3'];
    const progressCircles = document.getElementById('progressCircles');
    
    console.log('🔵 updateProgressCircles called with attemptNumber:', attemptNumber);
    
    // Ensure progress circles are visible first
    if (progressCircles) {
        progressCircles.style.display = 'flex';
        progressCircles.style.opacity = '1';
    }
    
    // Reset all circles first
    circles.forEach(circleId => {
        const circle = document.getElementById(circleId);
        if (circle) {
            circle.classList.remove('filled');
        }
    });
    
    // Fill circles based on attempts made
    for (let i = 0; i < attemptNumber && i < circles.length; i++) {
        const circle = document.getElementById(circles[i]);
        if (circle) {
            circle.classList.add('filled');
            console.log('🔵 Filled circle:', circles[i]);
        }
    }
}

// Legacy function (for compatibility)
function showWelcomeBackPopup(savedState) {
    // HARD GATE: Never show welcome back popup - global rule A
    if (false) { /* never show welcome back popup */ return; }
    // Suppress welcome back popup if day is already complete
    if (dailyGameState && dailyGameState.dayComplete) {
        console.log('✅ Day complete - suppressing welcome back popup');
        return;
    }
    
    const popup = document.getElementById('welcomeBackPopup');
    const welcomeBackText = document.getElementById('welcomeBackText');
    const continueBtn = document.getElementById('continueBtn');
    
    if (!popup || !welcomeBackText || !continueBtn) {
        console.error('❌ Welcome Back popup elements not found');
        return;
    }
    
    // Update text based on current demo game state
    const currentAttempt = window.currentAttemptNumber || savedState.currentAttemptNumber || 1;
    const cutsMade = window.cutsMadeThisShape || 0;
    const currentShape = window.currentShapeNumber || savedState.currentShapeNumber || 1;
    
    let message;
    if (gameState === 'cutting' && currentAttempt === 2) {
        // User is ready for second attempt after clicking "Next Attempt"
        message = `Welcome back! You're ready for your 2nd try on shape ${currentShape}.`;
    } else if (gameState === 'awaiting_choice' && cutsMade > 0) {
        // User has made a cut and is waiting for next action
        const attemptSuffix = currentAttempt === 1 ? 'st' : currentAttempt === 2 ? 'nd' : 'rd';
        message = `Welcome back! You're in the middle of your ${currentAttempt}${attemptSuffix} try on shape ${currentShape}.`;
    } else if (cutsMade > 0) {
        // User has made cuts
        const tryText = cutsMade === 1 ? 'try' : 'tries';
        message = `Welcome back! You've made ${cutsMade} ${tryText} on shape ${currentShape}.`;
    } else {
        // Fallback
        message = `Welcome back! Continue your game on shape ${currentShape}.`;
    }
    
    welcomeBackText.textContent = message;
    
    // Show popup
    popup.style.display = 'flex';
    
    // Handle continue button click
    continueBtn.onclick = () => {
        popup.style.display = 'none';
        console.log('🔄 Player continued in-progress demo game');
        
        // Demo game doesn't need automatic progression - user can see their restored state
        // and interact with the buttons as needed
        
        // Save the current state again to ensure persistence
        saveDemoGameState();
    };
    
    console.log('👋 Welcome Back popup shown for shape', currentShape, 'attempt', currentAttempt);
}

// Restore finished game state
async function restoreFinishedGameState(savedState) {
    try {
        gameState = 'locked'; // Use 'locked' instead of 'finished' to match normal flow
        attemptCount = savedState.attemptCount;
        currentAttempts = savedState.currentAttempts;
        
        if (savedState.finalScoreData) {
            const data = savedState.finalScoreData;
            finalLockedScore = {
                leftPercentage: data.leftPercentage,
                rightPercentage: data.rightPercentage
            };
            
            // Restore the cut vector and render the colored cut on canvas
            if (data.cutVector && data.splitAreas) {
                currentVector = data.cutVector;
                const areaResults = {
                    leftPercentage: data.leftPercentage,
                    rightPercentage: data.rightPercentage,
                    splitAreas: data.splitAreas
                };
                
                // Render the cut with colors
                renderVectorCutResult(areaResults);
            } else {
                // Fallback: just draw the basic canvas
                redrawCanvas();
            }
            
            // Show the final results in the results table
            const attemptResult = {
                leftPercentage: data.leftPercentage,
                rightPercentage: data.rightPercentage,
                attemptCount: attemptCount
            };
            
            // Fetch today's average for display
            let todaysAverage = null;
            try {
                todaysAverage = await supabaseClient.getTodaysAverage(currentDate);
            } catch (error) {
                console.error('Failed to get today\'s average for restored state:', error);
            }
            
            showCommittedResultInstant(attemptResult, todaysAverage);
            
            // Show post-lock-in elements (share button and countdown)
            showPostLockInElements();
        }
        
        // Hide the play button and disable interaction
        hidePlayButton();
        isInteractionEnabled = false;
        
        console.log('🎯 Finished game state restored - game is locked');
    } catch (error) {
        console.error('❌ Failed to restore finished game state:', error);
    }
}

async function initializeGame() {
    try {
        console.log('🚀 initializeGame() - Starting...');
        
        // Check canvas setup
        canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }
        console.log('✅ Canvas element found');

        ctx = setupCanvasForCrispRendering(canvas);
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        console.log('✅ Canvas 2D context obtained');
        
        // Draw initial grid (loading animation handled by HTML)
        drawGrid();
        console.log('✅ Initial grid drawn');
        
        // Check dependencies (DateUtils not needed for demo mode)
        console.log('🔍 Demo mode - skipping DateUtils check');
        
        console.log('🔍 Checking supabaseClient...');
        if (typeof supabaseClient === 'undefined') {
            console.error('❌ supabaseClient not loaded');
            throw new Error('supabaseClient not loaded');
        }
        console.log('✅ supabaseClient available');
        
        // Get current date and update UI (using local time)
        currentDate = getCurrentDateString();
        currentDayNumber = 1; // Demo always uses day 1
        console.log(`📅 Current local date: ${currentDate}, Day #${currentDayNumber}`);
        console.log(`🔍 Will load shapes from Supabase folder: day_${currentDate}/`);
        
        // Update title immediately after getting day number - use proper date formatting
        if (window.updateDateTitle && typeof window.updateDateTitle === 'function') {
            window.updateDateTitle();
        } else {
            updateTitle(); // Fallback
        }
        
        // Set up midnight reset checking
        setupMidnightCheck();
        
        // Test localStorage functionality
        try {
            localStorage.setItem('test', 'value');
            const testValue = localStorage.getItem('test');
            localStorage.removeItem('test');
            console.log('🔍 localStorage test result:', testValue);
        } catch (e) {
            console.error('❌ localStorage not working:', e);
        }
        
        // ====================================================================
        // STRUCTURED REFRESH RECOVERY SYSTEM
        // ====================================================================
        
        console.log('🔍 Checking for structured game state...');
        const structuredState = loadStructuredGameState();
        console.log('🔍 loadStructuredGameState() returned:', structuredState);
        
        if (structuredState && structuredState.needsWelcomeBack) {
            console.log('📂 Found structured state requiring restoration:', structuredState.restoreType);
            
            // Check if day is complete - suppress welcome back if so
            if (structuredState.dayComplete || structuredState.isGameComplete) {
                console.log('✅ Day complete in structured state - suppressing welcome back popup');
                // Still load and show completion view if needed
                const geoJSON = await supabaseClient.loadShape(currentDate, 1);
                if (geoJSON) {
                    currentGeoJSON = geoJSON;
                    const parseResult = parseGeometry(geoJSON);
                    parsedShapes = parseResult.shapes;
                    setupEventListeners();
                    setupOrientationDetection();
                    redrawCanvas();
                    
                    // Show completion view instead of welcome back popup
                    if (window.completeView && structuredState.finalStats) {
                        const currentDayStats = getDayStats(currentDay);
                        const completionModel = buildCompletionModel(currentDayStats);
                        window.completeView.show(completionModel);
                    }
                }
                hideLoadingAnimation();
                return;
            }
            
            // Load the shape data first
            const geoJSON = await supabaseClient.loadShape(currentDate, 1);
            if (geoJSON) {
                currentGeoJSON = geoJSON;
                console.log('🔍 About to call parseGeometry...');
                const parseResult = parseGeometry(geoJSON);
                console.log('🔍 parseResult received:', parseResult);
                console.log('🔍 parseResult.shapes:', parseResult ? parseResult.shapes : 'null/undefined');
                parsedShapes = parseResult.shapes;
                console.log('🔍 parsedShapes after assignment:', parsedShapes ? parsedShapes.length : 'null/undefined');
                setupEventListeners();
                setupOrientationDetection();
                console.log('🔍 parsedShapes before redrawCanvas:', parsedShapes ? parsedShapes.length : 'null/undefined');
                redrawCanvas();
                
                // Show structured Welcome Back popup - DISABLED (outdated feature)
                hideLoadingAnimation();
                // showStructuredWelcomeBackPopup(structuredState);
                // return; // Stop here - restoration will happen when user clicks Continue

                // Directly perform restoration instead of showing popup
                performStructuredRestoration(structuredState);
                saveStructuredGameState();
            } else {
                console.error('❌ Failed to load shape data for structured restoration');
            }
        }
        
        // v3.0 - Check if today's puzzle is already completed in Supabase
        console.log('🔍 Checking for existing completion...');
        console.log('🔍 Current date:', currentDate);
        console.log('🔍 Supabase client initialized:', !!supabaseClient);
        
        let completionStatus = null;
        try {
            console.log('🔍 About to call checkTodaysCompletion...');
            completionStatus = await Promise.race([
                supabaseClient.checkTodaysCompletion(currentDate),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000))
            ]);
            console.log('🔍 Completion status result:', completionStatus);
        } catch (error) {
            console.warn('⚠️ Failed to check completion status:', error);
            console.log('🔄 Continuing with normal initialization...');
        }
        
        if (completionStatus && completionStatus.completed) {
            console.log(`✅ Found existing completion: ${completionStatus.leftPercentage.toFixed(1)}%/${completionStatus.rightPercentage.toFixed(1)}% in ${completionStatus.attemptCount} attempts`);
            await loadAndDisplayCompletedPuzzle(completionStatus);
            hideLoadingAnimation();
            return; // Skip normal initialization
        } else {
            console.log('ℹ️ No existing completion found, proceeding with normal initialization');
        }
        
        // v3.0 - No shape cache needed
        
        // Continue with normal initialization
        await normalInitialization();
        
    } catch (error) {
        console.error('💥 initializeGame() failed:', error);
        if (window.debugLogger) {
            debugLogger.error('Game initialization failed', error);
        }
        
        // Fallback initialization to at least show basic UI
        try {
            console.log('🔄 Attempting fallback initialization...');
            await fallbackInitialization();
        } catch (fallbackError) {
            console.error('💥 Fallback initialization also failed:', fallbackError);
            showErrorMessage('Game failed to initialize. Please refresh the page.');
        }
    }
}

// Fallback initialization when main initialization fails
async function fallbackInitialization() {
    console.log('🔄 Starting fallback initialization...');
    
    // Set up basic canvas if possible
    try {
        canvas = document.getElementById('geoCanvas');
        if (canvas) {
            ctx = setupCanvasForCrispRendering(canvas);
            // Canvas ready (loading animation handled by HTML)
            console.log('✅ Fallback canvas ready');
        }
    } catch (error) {
        console.warn('⚠️ Canvas setup failed in fallback:', error);
    }
    
    // Set up basic event listeners for buttons
    try {
        setupBasicEventListeners();
    } catch (error) {
        console.warn('⚠️ Event listeners setup failed in fallback:', error);
    }
    
    // Hide loading animation and show welcome message even if other systems failed
    try {
        hideLoadingAnimation();
        showBasicWelcomeMessage();
    } catch (error) {
        console.warn('⚠️ Welcome message failed in fallback:', error);
    }
    
    console.log('✅ Fallback initialization completed');
}

// Helper function to setup canvas (NO HiDPI - simple 380x380)
function setupCanvasForCrispRendering(canvasElement) {
    if (!canvasElement) return null;

    const context = canvasElement.getContext('2d');
    if (!context) return null;

    // Simple 380x380 canvas - no DPR scaling
    // Canvas is always 380x380 internally
    const canvasSize = 380;

    if (canvasElement.width === canvasSize && canvasElement.height === canvasSize) {
        console.log(`✨ Canvas already configured: ${canvasSize}x${canvasSize}`);
        context.imageSmoothingEnabled = false;
        return context;
    }

    // Canvas needs configuration
    canvasElement.width = canvasSize;
    canvasElement.height = canvasSize;
    canvasElement.style.width = `${canvasSize}px`;
    canvasElement.style.height = `${canvasSize}px`;

    // Disable image smoothing for crisp rendering
    context.imageSmoothingEnabled = false;

    console.log(`✨ Canvas configured: ${canvasSize}x${canvasSize}`);
    return context;
}

// Helper function to get canvas size
function getCanvasSize() {
    // Canvas is always 380x380 internally
    return 380;
}

function drawBasicGrid() {
    if (!ctx || !canvas) return;

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // Use logical coordinates (380x380) - context scaling handles DPR
    for (let x = 0; x <= 380; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 380);
        ctx.stroke();
    }

    for (let y = 0; y <= 380; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(380, y);
        ctx.stroke();
    }
}

function setupBasicEventListeners() {
    const playBtn = document.getElementById('playBtn');
    const practiseBtn = document.getElementById('practiseBtn');
    
    if (playBtn) {
        playBtn.addEventListener('click', function() {
            alert('Game initialization failed. Please refresh the page and check your internet connection.');
        });
    }
    
    if (practiseBtn) {
        practiseBtn.addEventListener('click', function() {
            alert('Game initialization failed. Please refresh the page and check your internet connection.');
        });
    }
}

function showBasicWelcomeMessage() {
    const goalDisplay = document.getElementById('goalDisplay');
    const goalTextEl = document.getElementById('goalText');
    
    if (goalDisplay && goalTextEl) {
        const errorMessage = `
            <strong>Connection Issue</strong><br><br>
            Unable to connect to the game server.<br><br>
            Please check your internet connection and refresh the page to try again.
        `;
        goalTextEl.innerHTML = errorMessage;
        goalDisplay.style.display = 'block';
        goalDisplay.style.opacity = '1';
        goalTextEl.style.opacity = '1';
    }
}

// v3.0 - Load and display a previously completed puzzle
async function loadAndDisplayCompletedPuzzle(completionStatus) {
    try {
        console.log('🎯 Loading and displaying completed puzzle...');
        
        // Set up the basic UI components first
        setupEventListeners();
        setupOrientationDetection();
        drawGrid();
        
        // Load the shape data
        console.log('📥 Loading shape data for completed puzzle...');
        const geoJSON = await supabaseClient.loadShape(currentDate, 1);
        if (!geoJSON) {
            throw new Error('Failed to load shape data for completed puzzle');
        }
        
        currentGeoJSON = geoJSON;
        const parseResult = parseGeometry(geoJSON);
        parsedShapes = parseResult.shapes;
        console.log('✅ Shape data loaded and parsed');
        
        // Set game state to finished
        gameState = 'finished';
        // CRITICAL: Don't clear currentAttempts during restoration - they contain the split percentages
        attemptCount = completionStatus.attemptCount;
        finalLockedScore = completionStatus.leftPercentage;
        
        // Create a mock cut vector that approximates the stored percentages
        const bounds = calculateBounds(parsedShapes);
        const mockCutVector = createMockCutVector(bounds, completionStatus.leftPercentage, completionStatus.rightPercentage);
        
        // Store the completion data
        const completionAttempt = {
            score: completionStatus.leftPercentage,
            leftPercentage: completionStatus.leftPercentage,
            rightPercentage: completionStatus.rightPercentage,
            cutVector: mockCutVector,
            splitAreas: null // We don't store split areas
        };
        currentAttempts.push(completionAttempt);
        // CRITICAL: Sync local array to window for SimpleRefresh to save
        window.currentAttempts = [...currentAttempts];
        window.debugCurrentAttempts('completion', 'PUSHED completion attempt');
        
        // Render the completed shape with colors
        console.log('🎨 Rendering completed puzzle with colors...');
        renderReplayBinaryColors(mockCutVector, 1, parsedShapes);
        
        // Show the final state UI
        console.log('📊 Setting up completed state UI...');
        showFinalState();
        
        // Display the locked-in percentage with box animation
        const goalDisplay = document.getElementById('goalDisplay');
        const goalText = document.getElementById('goalText');
        if (goalDisplay && goalText) {
            const leftPercent = Math.round(completionStatus.leftPercentage);
            const rightPercent = Math.round(completionStatus.rightPercentage);
            goalText.innerHTML = `<span class="percentage-text">${leftPercent}%</span> / <span class="percentage-text">${rightPercent}%</span>`;
            goalDisplay.style.display = 'block';
            
            // No lock-in box animation needed
        }
        
        // No attempt display to hide - using CUT popup instead
        
        console.log('✅ Completed puzzle displayed successfully');
        
    } catch (error) {
        console.error('💥 Failed to load completed puzzle:', error);
        // Fall back to normal initialization
        console.log('🔄 Falling back to normal initialization...');
        await normalInitialization();
    }
}

// Extracted normal initialization for fallback
async function normalInitialization() {
    // Initialize components
    console.log('🔧 Setting up event listeners...');
    setupEventListeners();
    
    console.log('📱 Setting up orientation detection...');
    setupOrientationDetection();
    
    console.log('🖼️ UI displays already updated...');
    
    console.log('📐 Drawing initial grid...');
    drawGrid();
    
    // Note: Practice mode refresh recovery is handled in loadStructuredGameState()
    // If refreshed while in practice mode, it will clear practice state and return to normal initialization
    
    console.log('✅ Daily Shapes v2.0 initialized successfully');
    console.log(`📊 Game state: ${gameState}, Date: ${currentDate}`);
    
    // Hide loading animation and show welcome content
    hideLoadingAnimation();

    // Show goal display at initial load
    showGoalDisplay();
    
    // Only show play button if we didn't restore a saved state
    // (saved state restoration happens earlier and returns early if found)
    showPlayButton();
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.disabled = false;
        playBtn.classList.remove('disabled');
    }
    
    if (window.debugLogger) {
        debugLogger.success('Game initialization complete', {
            date: currentDate,
            dayNumber: currentDayNumber,
            canvasSize: '380x380 (logical)'
        });
    }
}

function updateTitle() {
    const title = `Daily Shapes #${currentDayNumber}`;
    document.title = title;

    // ALWAYS ensure the visible header maintains proper date formatting
    // This prevents any timing issues from breaking the header display
    if (window.updateDateTitle && typeof window.updateDateTitle === 'function') {
        window.updateDateTitle();
        console.log('🔄 updateTitle: Used updateDateTitle() to maintain proper header formatting');
    } else {
        // Fallback to updating dateTitle directly with proper formatting
        const dateTitle = document.getElementById('dateTitle');
        if (dateTitle) {
            // Use actual current date for fallback
            const now = new Date();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[now.getMonth()];
            const day = now.getDate().toString().padStart(2, '0');
            dateTitle.innerHTML = `<strong>Daily Shapes</strong> ${month} ${day}`;
            console.log('🔄 updateTitle: Used fallback to set proper header formatting');
        }
    }
}

// Navigation and Authentication System
let currentSection = 'daily'; // Track current section: daily, practice, competition, profile

function isUserSignedIn() {
    // Simple check: if Supabase token exists, user is signed in
    const supabaseToken = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
    return !!supabaseToken;
}

// Export globally for use in other modules
window.isUserSignedIn = isUserSignedIn;
window.showUserProfileMenu = showUserProfileMenu;

// Manual auth refresh function for debugging
window.refreshAuthState = async function() {
    console.log('🔄 Manual auth refresh requested');
    if (window.AuthService) {
        await window.AuthService.initialize();
        console.log('✅ AuthService refreshed');
        updateButtonStates();
        document.dispatchEvent(new CustomEvent('authStateChanged'));
        console.log('✅ UI updated');
    }
};

// Competition Popup Functions
function openCompetitionModal() {
    const modal = document.getElementById('competitionModal');
    if (modal) {
        // Store current scroll position to fix Safari viewport shift bug
        window.safariScrollPosition = window.pageYOffset || document.documentElement.scrollTop;

        // Prevent body scroll during modal
        document.body.style.position = 'fixed';
        document.body.style.top = `-${window.safariScrollPosition}px`;
        document.body.style.width = '100%';

        modal.style.display = 'flex';

        // Force overflow visible on modal
        modal.style.setProperty('overflow-y', 'visible', 'important');

        showCompetitionMain(); // Start at main menu (this also sets modal height)
    }
}

function closeCompetitionModal() {
    const modal = document.getElementById('competitionModal');
    if (modal) {
        modal.style.display = 'none';

        // Restore body scroll and position to fix Safari viewport shift bug
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';

        // Restore scroll position
        if (typeof window.safariScrollPosition !== 'undefined') {
            window.scrollTo(0, window.safariScrollPosition);
        }
    }
}

function showCompetitionMain() {
    // Hide all views
    hideAllCompetitionViews();
    // Show main view
    document.getElementById('competitionMainView').style.display = 'block';

    // Force correct modal height (override any cached CSS)
    const modalContent = document.querySelector('#competitionModal .success-modal-content');
    const modalBody = document.querySelector('#competitionMainView .success-modal-body');

    if (modalContent) {
        // Check viewport size and set appropriate height
        if (window.innerWidth <= 400 && window.innerHeight <= 600) {
            // Small viewport (375x547)
            modalContent.style.setProperty('height', '480px', 'important');
            modalContent.style.setProperty('max-height', '480px', 'important');
        } else if (window.innerWidth >= 1200) {
            // Large desktop
            modalContent.style.setProperty('height', '700px', 'important');
            modalContent.style.setProperty('max-height', '700px', 'important');
        } else if (window.innerWidth >= 769) {
            // Medium desktop
            modalContent.style.setProperty('height', 'auto', 'important');
            modalContent.style.setProperty('max-height', '750px', 'important');
        } else {
            // Mobile
            modalContent.style.setProperty('height', 'auto', 'important');
            modalContent.style.setProperty('max-height', '490px', 'important');
        }
        modalContent.style.setProperty('overflow-y', 'visible', 'important');
        modalContent.style.setProperty('display', 'flex', 'important');
        modalContent.style.setProperty('flex-direction', 'column', 'important');
    }

    // Force modal body to fill available space
    if (modalBody) {
        modalBody.style.setProperty('flex', '1', 'important');
        modalBody.style.setProperty('height', 'auto', 'important');
        modalBody.style.setProperty('min-height', '0', 'important');
        modalBody.style.setProperty('overflow-y', 'visible', 'important');
        modalBody.style.setProperty('display', 'flex', 'important');
        modalBody.style.setProperty('flex-direction', 'column', 'important');
    }
}

function showActiveCompetitions() {
    console.log('✅ Loading active competitions in existing modal');

    // Hide all views and show active competitions view
    hideAllCompetitionViews();
    document.getElementById('competitionActiveView').style.display = 'block';

    // Load competitions with participant counts into the existing modal
    loadActiveCompetitionsInModal();
    return;

    // Fallback to old system
    console.log('⚠️ Fallback to old competition system');
    // Hide all views
    hideAllCompetitionViews();
    // Show active competitions view
    document.getElementById('competitionActiveView').style.display = 'block';

    // Load active competitions
    loadActiveCompetitions();
}

function showCreateCompetition() {
    // Hide all views
    hideAllCompetitionViews();
    // Show create competition view
    document.getElementById('competitionCreateView').style.display = 'block';
    
    // Load competition creation form
    loadCompetitionCreationForm();
}

function showExpiredCompetitions() {
    // Hide all views
    hideAllCompetitionViews();
    // Show expired competitions view
    document.getElementById('competitionExpiredView').style.display = 'block';
    
    // Load expired competitions
    loadExpiredCompetitions();
}

async function loadActiveCompetitions() {
    const listContainer = document.getElementById('activeCompetitionsList');
    
    // Check if user is logged in first
    const isLoggedIn = window.AuthService && !window.AuthService.isGuest;
    if (!isLoggedIn) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <p style="font-size: 16px; color: #666; margin-bottom: 20px;">Please sign in to view competitions</p>
                <button class="success-nav-btn primary" onclick="closeCompetitionModal(); showAuthenticationPopup();" style="margin: 0 auto;">
                    Sign In
                </button>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = '<p style="font-size: 24px;">Loading competitions...</p>';
    
    try {
        // Always use our custom implementation for consistent behavior
        if (window.CompetitionManager) {
            // Load competitions using CompetitionManager
            await window.CompetitionManager.loadUserCompetitions();
            const userComps = window.CompetitionManager.userCompetitions || [];
            
            let html = '';

            // Show all competitions (including global monthly competitions)

            // Show user competitions (only active ones)
            const activeComps = userComps.filter(participation => {
                const comp = participation.competitions;

                if (comp.end_date) {
                    const now = new Date();
                    const endDateObj = new Date(comp.end_date);
                    const endOfEndDate = new Date(endDateObj);
                    endOfEndDate.setHours(23, 59, 59, 999); // End of the end date

                    return now <= endOfEndDate; // Include competitions up to end of end date
                }
                return true; // Include competitions without end date
            });

            if (activeComps.length > 0) {
                // Sort competitions by days remaining (least days remaining at the top)
                activeComps.sort((a, b) => {
                    const compA = a.competitions;
                    const compB = b.competitions;

                    const now = new Date();

                    // Calculate days remaining for competition A
                    let daysA = Infinity; // Default to far future
                    if (compA.start_date && compA.end_date) {
                        const startDateA = new Date(compA.start_date);
                        const endDateA = new Date(compA.end_date);
                        const endOfEndDateA = new Date(endDateA);
                        endOfEndDateA.setHours(23, 59, 59, 999);

                        if (now < startDateA) {
                            // Not started yet - calculate days until start + large offset
                            const daysUntilStart = Math.floor((startDateA.getTime() - now.getTime()) / (1000 * 3600 * 24));
                            daysA = daysUntilStart + 10000; // Add large offset for not-started
                        } else {
                            // Started - calculate days until end of end date
                            daysA = Math.floor((endOfEndDateA.getTime() - now.getTime()) / (1000 * 3600 * 24));
                        }
                    }

                    // Calculate days remaining for competition B
                    let daysB = Infinity;
                    if (compB.start_date && compB.end_date) {
                        const startDateB = new Date(compB.start_date);
                        const endDateB = new Date(compB.end_date);
                        const endOfEndDateB = new Date(endDateB);
                        endOfEndDateB.setHours(23, 59, 59, 999);

                        if (now < startDateB) {
                            const daysUntilStart = Math.floor((startDateB.getTime() - now.getTime()) / (1000 * 3600 * 24));
                            daysB = daysUntilStart + 10000;
                        } else {
                            daysB = Math.floor((endOfEndDateB.getTime() - now.getTime()) / (1000 * 3600 * 24));
                        }
                    }

                    return daysA - daysB; // Ascending order (least days remaining first)
                });

                activeComps.forEach(participation => {
                    const comp = participation.competitions;
                    // Use participant_count from NEW system, fallback to old system
                    participation.participants_count = comp.participant_count || comp.competition_participants?.[0]?.count || 0;
                    // Calculate days remaining or starting date
                    let daysRemaining = 'Unknown';
                    let dateColor = '#6496FF'; // Default blue color

                    if (comp.start_date && comp.end_date) {
                        const startDate = new Date(comp.start_date);
                        const endDate = new Date(comp.end_date);
                        const today = new Date();

                        // Check if competition hasn't started yet
                        if (today < startDate) {
                            // Format start date based on locale
                            const isUS = isAmericanUser();
                            console.log('🌍 Locale Detection Debug:', {
                                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                                locale: navigator.language,
                                isUS: isUS
                            });
                            const month = String(startDate.getMonth() + 1).padStart(2, '0');
                            const day = String(startDate.getDate()).padStart(2, '0');
                            const year = String(startDate.getFullYear()).slice(-2);

                            if (isUS) {
                                daysRemaining = `Starting ${month}/${day}/${year}`;
                                console.log('📅 Using US format:', daysRemaining);
                            } else {
                                daysRemaining = `Starting ${day}/${month}/${year}`;
                                console.log('📅 Using International format:', daysRemaining);
                            }
                            dateColor = '#FAB06A'; // Orange color for competitions that haven't started
                        } else {
                            // Competition has started, show days remaining
                            const timeDiff = endDate.getTime() - today.getTime();
                            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                            if (daysDiff > 0) {
                                daysRemaining = `${daysDiff} day${daysDiff === 1 ? '' : 's'} left`;
                            } else if (daysDiff === 0) {
                                daysRemaining = 'Ends today';
                            }
                        }
                    }
                    
                    html += `
                            <div class="competition-card-compact" 
                                 style="padding: 12px; margin: 6px 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: #e8e8e8; position: relative; min-height: 80px; width: calc(100% - 20px); box-sizing: border-box;" 
                                 onclick="window.showCompetitionLeaderboard('${comp.id}', '${comp.name.replace(/'/g, "\\'")}')"
                                 onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.borderColor='#6496FF';"
                                 onmouseout="this.style.transform=''; this.style.boxShadow=''; this.style.borderColor='#ddd';">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 4px 0; color: #333; font-size: 14px; font-weight: 600; line-height: 1.3;">${comp.name.toUpperCase()}</h4>
                                        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
                                            <span style="font-size: 13px; color: ${dateColor}; font-weight: bold;">
                                                📅 ${daysRemaining}
                                            </span>
                                            <span style="font-size: 13px; color: #666; font-weight: bold;">
                                                👥 ${participation.participant_count || participation.participants_count || 0} players
                                            </span>
                                        </div>
                                    </div>
                                    <div style="text-align: right; margin-left: 8px;">
                                        <p style="font-size: 12px; color: #999; margin: 0; line-height: 1.2; font-weight: bold;">View →</p>
                                    </div>
                                </div>
                            </div>
                        `;
                });
            }
            
            if (html) {
                listContainer.innerHTML = '<div class="competitions-grid-compact" style="padding: 0;">' + html + '</div>';
            } else {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <p style="font-size: 16px; color: #666; margin-bottom: 20px;">Looks like you're not currently connected to any competitions</p>
                        <button class="success-nav-btn primary" onclick="showCreateCompetition()" style="margin: 0 auto;">
                            <span class="btn-icon">➕</span>
                            Create Competition
                        </button>
                    </div>
                `;
            }
        } else {
            // Competition system not loaded yet
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #666;">Competition system is loading...</p>
                    <p style="color: #999; font-size: 14px; margin-top: 10px;">Please try again in a moment.</p>
                    <button class="success-nav-btn secondary" onclick="showActiveCompetitions()" style="margin-top: 20px;">
                        Refresh
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading competitions:', error);
        
        // Check if it's a permissions error
        if (error.message && error.message.includes('row-level security')) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #666;">Session expired. Please sign in again.</p>
                    <button class="success-nav-btn primary" onclick="closeCompetitionModal(); showAuthenticationPopup();">
                        Sign In
                    </button>
                </div>
            `;
        } else {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #666;">Unable to load competitions at this time.</p>
                    <button class="success-nav-btn secondary" onclick="showActiveCompetitions()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}

async function loadActiveCompetitionsInModal() {
    console.log('✅ Loading active competitions with participant counts');

    // First fetch participant counts using the NEW system
    if (window.CompetitionManager && window.CompetitionManager.fetchParticipantCounts) {
        try {
            await window.CompetitionManager.fetchParticipantCounts();
            console.log('✅ Participant counts fetched successfully');
        } catch (error) {
            console.error('❌ Error fetching participant counts:', error);
        }
    }

    // Then load the competitions using the existing function
    await loadActiveCompetitions();
}

async function loadExpiredCompetitions() {
    const listContainer = document.getElementById('expiredCompetitionsList');
    
    // Check if user is logged in first
    const isLoggedIn = window.AuthService && !window.AuthService.isGuest;
    if (!isLoggedIn) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <p style="font-size: 16px; color: #666; margin-bottom: 20px;">Please sign in to view competitions</p>
                <button class="success-nav-btn primary" onclick="closeCompetitionModal(); showAuthenticationPopup();" style="margin: 0 auto;">
                    Sign In
                </button>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = '<p style="font-size: 24px;">Loading past competitions...</p>';
    
    try {
        if (window.CompetitionManager) {
            // Load competitions using CompetitionManager
            await window.CompetitionManager.loadUserCompetitions();
            const userComps = window.CompetitionManager.userCompetitions || [];
            
            let html = '';

            // Show all ended competitions (including past global monthly competitions)
            const endedComps = userComps.filter(participation => {
                const comp = participation.competitions;

                if (comp.end_date) {
                    const now = new Date();
                    const endDateObj = new Date(comp.end_date);
                    const endOfEndDate = new Date(endDateObj);
                    endOfEndDate.setHours(23, 59, 59, 999); // End of the end date

                    return now > endOfEndDate; // Only include competitions after end of end date
                }
                return false; // Don't include competitions without end date
            });

            if (endedComps.length > 0) {
                // Sort past competitions by most recently ended first
                endedComps.sort((a, b) => {
                    const compA = a.competitions;
                    const compB = b.competitions;

                    if (compA.end_date && compB.end_date) {
                        const endDateA = new Date(compA.end_date);
                        const endDateB = new Date(compB.end_date);
                        return endDateB.getTime() - endDateA.getTime(); // Descending order (most recent first)
                    }
                    return 0;
                });

                endedComps.forEach(participation => {
                    const comp = participation.competitions;
                    // Use participant_count from NEW system, fallback to old system
                    participation.participants_count = comp.participant_count || comp.competition_participants?.[0]?.count || 0;
                    
                    // Calculate how long ago it ended
                    let endedText = 'Ended';
                    if (comp.end_date) {
                        const endDate = new Date(comp.end_date);
                        const today = new Date();
                        const daysSinceEnd = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 3600 * 24));
                        
                        if (daysSinceEnd === 0) {
                            endedText = 'Ended today';
                        } else if (daysSinceEnd === 1) {
                            endedText = 'Ended yesterday';
                        } else if (daysSinceEnd < 7) {
                            endedText = `Ended ${daysSinceEnd} days ago`;
                        } else if (daysSinceEnd < 30) {
                            const weeks = Math.floor(daysSinceEnd / 7);
                            endedText = `Ended ${weeks} week${weeks === 1 ? '' : 's'} ago`;
                        } else {
                            const months = Math.floor(daysSinceEnd / 30);
                            endedText = `Ended ${months} month${months === 1 ? '' : 's'} ago`;
                        }
                    }
                    
                    html += `
                        <div class="competition-card-compact" 
                             style="padding: 12px; margin: 6px 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: #e8e8e8; position: relative; min-height: 80px; width: calc(100% - 20px); box-sizing: border-box; opacity: 0.8;" 
                             onclick="window.showCompetitionLeaderboard('${comp.id}', '${comp.name.replace(/'/g, "\\'")}')"
                             onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.borderColor='#999';"
                             onmouseout="this.style.transform=''; this.style.boxShadow=''; this.style.borderColor='#ddd';">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div style="flex: 1;">
                                    <h4 style="margin: 0 0 4px 0; color: #333; font-size: 14px; font-weight: 600; line-height: 1.3;">${comp.name.toUpperCase()}</h4>
                                    ${comp.description ? `<p style="color: #666; margin: 0; font-size: 12px; line-height: 1.2;">
                                        ${comp.description}
                                    </p>` : ''}
                                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
                                        <span style="font-size: 13px; color: #e74c3c; font-weight: bold;">
                                            📅 ${endedText}
                                        </span>
                                        <span style="font-size: 13px; color: #666; font-weight: bold;">
                                            👥 ${participation.participant_count || participation.participants_count || 0} player${(participation.participant_count || participation.participants_count) === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            
            if (html) {
                listContainer.innerHTML = '<div class="competitions-grid-compact" style="padding: 0;">' + html + '</div>';
            } else {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <p style="font-size: 16px; color: #666; margin-bottom: 20px;">No ended competitions to display</p>
                        <button class="success-nav-btn secondary" onclick="showActiveCompetitions()" style="margin: 0 auto;">
                            Back to Active Competitions
                        </button>
                    </div>
                `;
            }
        } else {
            // Competition system not loaded yet
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <p style="color: #666;">Competition system is loading...</p>
                    <button class="success-nav-btn secondary" onclick="showExpiredCompetitions()" style="margin: 20px auto 0 auto;">
                        Refresh
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading ended competitions:', error);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="color: #666;">Unable to load ended competitions.</p>
                <button class="success-nav-btn secondary" onclick="showExpiredCompetitions()">
                    Try Again
                </button>
            </div>
        `;
    }
}

function loadCompetitionCreationForm() {
    const formContainer = document.querySelector('.create-competition-form');
    
    // Check if user is logged in first
    const isLoggedIn = window.AuthService && !window.AuthService.isGuest;
    if (!isLoggedIn) {
        formContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="font-size: 16px; color: #666; margin-bottom: 20px;">Please sign in to create competitions</p>
                <button class="success-nav-btn primary" onclick="closeCompetitionModal(); showAuthenticationPopup();">
                    Sign In
                </button>
            </div>
        `;
        return;
    }
    
    // Calculate today's date for minimum date (allow same-day competitions)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const minDate = `${year}-${month}-${day}`;
    
    formContainer.innerHTML = `
        <style>
            /* Date input styling to match placeholder color */
            #compStartDate, #compEndDate {
                color: #6c757d !important;
                font-family: inherit;
            }

            #compStartDate:focus, #compEndDate:focus {
                color: #333 !important;
            }

            #compStartDate:valid, #compEndDate:valid {
                color: #333 !important;
            }

            /* Webkit specific date input styling */
            #compStartDate::-webkit-datetime-edit,
            #compEndDate::-webkit-datetime-edit {
                color: #6c757d !important;
            }

            #compStartDate:focus::-webkit-datetime-edit,
            #compEndDate:focus::-webkit-datetime-edit {
                color: #333 !important;
            }

            #compStartDate:valid::-webkit-datetime-edit,
            #compEndDate:valid::-webkit-datetime-edit {
                color: #333 !important;
            }

            /* Individual date field components */
            #compStartDate::-webkit-datetime-edit-text,
            #compStartDate::-webkit-datetime-edit-month-field,
            #compStartDate::-webkit-datetime-edit-day-field,
            #compStartDate::-webkit-datetime-edit-year-field,
            #compEndDate::-webkit-datetime-edit-text,
            #compEndDate::-webkit-datetime-edit-month-field,
            #compEndDate::-webkit-datetime-edit-day-field,
            #compEndDate::-webkit-datetime-edit-year-field {
                color: #6c757d !important;
            }

            #compStartDate:focus::-webkit-datetime-edit-text,
            #compStartDate:focus::-webkit-datetime-edit-month-field,
            #compStartDate:focus::-webkit-datetime-edit-day-field,
            #compStartDate:focus::-webkit-datetime-edit-year-field,
            #compEndDate:focus::-webkit-datetime-edit-text,
            #compEndDate:focus::-webkit-datetime-edit-month-field,
            #compEndDate:focus::-webkit-datetime-edit-day-field,
            #compEndDate:focus::-webkit-datetime-edit-year-field {
                color: #333 !important;
            }
        </style>
        <div class="competition-form">
            <div class="form-group" style="margin-bottom: 32px;">
                <label for="compName">Competition Name</label>
                <input type="text" id="compName" placeholder="eg. Rhombus Rumble" maxlength="50" style="margin-bottom: 16px;">
            </div>
            <div class="form-group">
                <label for="compStartDate">Start Date</label>
                <input type="date" id="compStartDate" min="${minDate}">
                <div class="input-help" style="font-size: 12px; margin-bottom: 20px;">Competition can start tomorrow or later</div>
            </div>
            <div class="form-group">
                <label for="compEndDate">End Date</label>
                <input type="date" id="compEndDate" min="${minDate}">
            </div>
            <button class="success-nav-btn primary" onclick="createNewCompetition()">
                Create Competition
            </button>
        </div>
    `;

    // Add event listeners to handle date field styling
    setTimeout(() => {
        const startDateInput = document.getElementById('compStartDate');
        const endDateInput = document.getElementById('compEndDate');

        // Function to handle date input styling
        function handleDateInputStyling(input) {
            if (!input) return;

            // Set initial grey color
            input.style.color = '#999';

            // Change color when user selects a date
            input.addEventListener('change', function() {
                if (this.value) {
                    this.style.color = '#333'; // Normal text color when date is selected
                } else {
                    this.style.color = '#999'; // Grey when empty
                }
            });

            // Handle focus events
            input.addEventListener('focus', function() {
                this.style.color = '#333';
            });

            input.addEventListener('blur', function() {
                if (!this.value) {
                    this.style.color = '#999';
                }
            });
        }

        handleDateInputStyling(startDateInput);
        handleDateInputStyling(endDateInput);
    }, 100);
}

async function showCompetitionLeaderboard(competitionId, competitionName) {
    console.log('📊 Showing leaderboard for competition:', competitionId, competitionName);
    
    // Check if user is logged in first
    const isLoggedIn = window.AuthService && !window.AuthService.isGuest;
    if (!isLoggedIn) {
        console.log('🔒 User not logged in - cannot view leaderboard');
        showAuthenticationPopup();
        return;
    }
    
    // Hide all views
    hideAllCompetitionViews();
    
    // Create or show leaderboard view
    let leaderboardView = document.getElementById('competitionLeaderboardView');
    if (!leaderboardView) {
        // Create the leaderboard view if it doesn't exist
        const modalContent = document.querySelector('.competition-modal-content');
        if (!modalContent) {
            console.error('Competition modal content not found');
            return;
        }
        leaderboardView = document.createElement('div');
        leaderboardView.id = 'competitionLeaderboardView';
        leaderboardView.className = 'competition-view';
        leaderboardView.style.display = 'none';
        modalContent.appendChild(leaderboardView);
    }
    
    // Show loading state
    leaderboardView.innerHTML = `
        <div class="competition-header">
            <button class="back-btn" onclick="showActiveCompetitions()" style="margin-bottom: 20px; padding: 8px 16px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
                ← Back to Competitions
            </button>
            <h3 style="margin: 0 0 20px 0;">Leaderboard</h3>
        </div>
        <div id="leaderboardContent" style="max-height: 400px; overflow-y: auto;">
            <p>Loading leaderboard...</p>
        </div>
    `;
    
    leaderboardView.style.display = 'block';
    
    try {
        // Load competition details and leaderboard
        let leaderboardData = [];
        let loadError = null;
        
        // Try multiple methods to get the leaderboard data
        if (window.CompetitionManager) {
            console.log('📊 Trying CompetitionManager.getCompetitionLeaderboard...');
            
            // First, ensure we have the latest competition data
            if (window.CompetitionManager.loadUserCompetitions) {
                await window.CompetitionManager.loadUserCompetitions();
            }
            
            // Try to get leaderboard
            if (window.CompetitionManager.getCompetitionLeaderboard) {
                try {
                    leaderboardData = await window.CompetitionManager.getCompetitionLeaderboard(competitionId);
                    console.log('📊 Got leaderboard data from CompetitionManager:', leaderboardData);
                } catch (err) {
                    console.log('⚠️ CompetitionManager.getCompetitionLeaderboard failed:', err);
                    loadError = err;
                }
            }
            
            // If that didn't work, try getting from userCompetitions
            if ((!leaderboardData || leaderboardData.length === 0) && window.CompetitionManager.userCompetitions) {
                const competition = window.CompetitionManager.userCompetitions.find(c => 
                    c.competitions && c.competitions.id === competitionId
                );
                if (competition && competition.participants) {
                    leaderboardData = competition.participants;
                    console.log('📊 Got participants from userCompetitions:', leaderboardData);
                }
            }
        }
        
        // Fallback to direct Supabase query
        if ((!leaderboardData || leaderboardData.length === 0) && window.SupabaseConfig && window.SupabaseConfig.client) {
            console.log('📊 Trying direct Supabase query...');
            const { data, error } = await window.SupabaseConfig.client
                .from('competition_participants')
                .select(`
                    *,
                    users!inner(
                        id,
                        username,
                        email
                    )
                `)
                .eq('competition_id', competitionId)
                .order('total_score', { ascending: false });
            
            if (error) {
                console.error('❌ Supabase query error:', error);
                loadError = error;
            } else if (data) {
                leaderboardData = data;
                console.log('📊 Got leaderboard data from Supabase:', leaderboardData);
            }
        }
        
        const leaderboardContent = document.getElementById('leaderboardContent');

        if (leaderboardData && leaderboardData.length > 0) {
            // Load daily awards for today (using LOCAL timezone)
            const todayDate = new Date();
            const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
            let dailyAwards = { bestScoreUsers: [], perfectCutUsers: [] };

            console.log('🏆 Loading daily awards for date:', today);

            try {
                if (window.SupabaseConfig && window.SupabaseConfig.client) {
                    const { data: todaysScores, error } = await window.SupabaseConfig.client
                        .from('daily_scores')
                        .select('user_id, daily_average, perfect_cuts')
                        .eq('date', today)
                        .gte('daily_average', 0)
                        .order('daily_average', { ascending: false });

                    console.log(`📊 Found ${todaysScores?.length || 0} daily scores for ${today}:`, todaysScores);

                    if (!error && todaysScores && todaysScores.length > 0) {
                        // Find best daily score(s)
                        const bestScore = todaysScores[0].daily_average;
                        dailyAwards.bestScoreUsers = todaysScores
                            .filter(score => score.daily_average === bestScore)
                            .map(score => score.user_id);

                        // Find perfect cuts
                        dailyAwards.perfectCutUsers = todaysScores
                            .filter(score => score.perfect_cuts > 0)
                            .map(score => score.user_id);

                        console.log('🏆 Daily awards calculated:', {
                            bestScore,
                            bestScoreUsers: dailyAwards.bestScoreUsers,
                            perfectCutUsers: dailyAwards.perfectCutUsers
                        });
                    }
                }
            } catch (error) {
                console.error('❌ Error loading daily awards:', error);
            }

            let html = `
                <div style="background: #f8f9fa; border-radius: 8px; padding: 15px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #dee2e6;">
                                <th style="text-align: left; padding: 10px; font-weight: 600;">Rank</th>
                                <th style="text-align: left; padding: 10px; font-weight: 600;">Player</th>
                                <th style="text-align: center; padding: 10px; font-weight: 600;">Awards</th>
                                <th style="text-align: right; padding: 10px; font-weight: 600;">Score</th>
                                <th style="text-align: right; padding: 10px; font-weight: 600;">Games</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            leaderboardData.forEach((participant, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                const username = participant.users?.username || participant.users?.email?.split('@')[0] || 'Player';
                const score = participant.total_score || 0;
                const games = participant.games_played || 0;

                // Calculate daily awards for this participant
                let awards = '';
                const hasCrown = dailyAwards.bestScoreUsers.includes(participant.user_id);
                const hasPerfect = dailyAwards.perfectCutUsers.includes(participant.user_id);

                if (hasCrown && hasPerfect) {
                    awards = '👑<br>💯';
                } else if (hasCrown) {
                    awards = '👑';
                } else if (hasPerfect) {
                    awards = '💯';
                }

                // Highlight current user's row
                const isCurrentUser = window.AuthService?.currentUser?.id === participant.user_id;
                const rowStyle = isCurrentUser ? 'background: #e3f2fd;' : index % 2 === 0 ? 'background: #fff;' : 'background: #f8f9fa;';

                html += `
                    <tr style="${rowStyle}">
                        <td style="padding: 12px 10px; border-bottom: 1px solid #dee2e6;">
                            <span style="font-weight: ${rank <= 3 ? 'bold' : 'normal'};">${medal} ${rank}</span>
                        </td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #dee2e6;">
                            ${username}
                            ${isCurrentUser ? '<span style="color: #1976d2; font-size: 12px;"> (You)</span>' : ''}
                        </td>
                        <td style="padding: 12px 10px; text-align: center; border-bottom: 1px solid #dee2e6; font-size: 20px; line-height: 1.2;">
                            ${awards}
                        </td>
                        <td style="padding: 12px 10px; text-align: right; border-bottom: 1px solid #dee2e6; font-weight: 600;">
                            ${score.toFixed(1)}%
                        </td>
                        <td style="padding: 12px 10px; text-align: right; border-bottom: 1px solid #dee2e6; color: #666;">
                            ${games}
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            // Add competition stats
            const avgScore = leaderboardData.reduce((sum, p) => sum + (p.total_score || 0), 0) / leaderboardData.length;
            html += `
                <div style="margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 16px;">Competition Stats</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <span style="color: #666; font-size: 14px;">Total Players:</span>
                            <strong style="display: block; font-size: 18px;">${leaderboardData.length}</strong>
                        </div>
                        <div>
                            <span style="color: #666; font-size: 14px;">Average Score:</span>
                            <strong style="display: block; font-size: 18px;">${avgScore.toFixed(1)}%</strong>
                        </div>
                    </div>
                </div>
            `;
            
            // Add share button
            html += `
                <div style="margin-top: 20px; text-align: center;">
                    <button class="success-nav-btn secondary" onclick="shareCompetition('${competitionId}')" style="width: 100%;">
                        📤 Share Competition Link
                    </button>
                </div>
            `;
            
            leaderboardContent.innerHTML = html;
        } else {
            leaderboardContent.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #666;">No players have joined this competition yet.</p>
                    <button class="success-nav-btn primary" onclick="shareCompetition('${competitionId}')">
                        Invite Players
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Error loading leaderboard:', error);
        const leaderboardContent = document.getElementById('leaderboardContent');
        if (leaderboardContent) {
            // Check if it's an authentication error
            if (error.message && (error.message.includes('row-level security') || error.message.includes('JWT'))) {
                leaderboardContent.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: #666;">Session expired. Please sign in again.</p>
                        <button class="success-nav-btn primary" onclick="closeCompetitionModal(); showAuthenticationPopup();">
                            Sign In
                        </button>
                    </div>
                `;
            } else {
                leaderboardContent.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: #d32f2f;">Error loading leaderboard</p>
                        <p style="color: #666; font-size: 14px; margin-top: 10px;">${error.message || 'Please try again later'}</p>
                        <button class="success-nav-btn secondary" onclick="showActiveCompetitions()" style="margin-top: 20px;">
                            Back to Competitions
                        </button>
                    </div>
                `;
            }
        }
    }
}

function shareCompetition(competitionId) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${competitionId}`;

    // Get competition details from localStorage
    const compDetailsString = localStorage.getItem(`compDetails_${competitionId}`);
    let shareText = 'Join my Daily Shapes competition!';

    if (compDetailsString) {
        const compDetails = JSON.parse(compDetailsString);

        // Format dates with "Today" replacement
        const startDate = formatCompetitionDate(compDetails.startDate);
        const endDate = formatCompetitionDate(compDetails.endDate);

        // Updated invite text
        shareText = `Join my Daily Shapes competition!
Runs from ${startDate} to ${endDate}
Don't be a square - join the fun!

${shareUrl}`;
    }

    if (navigator.share) {
        navigator.share({
            title: 'Join my Daily Shapes competition!',
            text: shareText,
            url: shareUrl
        }).catch(err => {
            // Fallback to copy with formatted message
            copyCompetitionToClipboard(shareText, shareUrl);
        });
    } else {
        copyCompetitionToClipboard(shareText, shareUrl);
    }
}

function copyCompetitionToClipboard(text, url) {
    // Try modern clipboard API with formatted text
    try {
        navigator.clipboard.writeText(text).then(() => {
            showCopyNotification();
        }).catch(() => {
            // Fallback to old method
            fallbackCopyText(text);
        });
    } catch (err) {
        // Fallback to old method
        fallbackCopyText(text);
    }

    function fallbackCopyText(text) {
        const tempInput = document.createElement('textarea');
        tempInput.value = text;
        tempInput.style.position = 'fixed';
        tempInput.style.top = '0';
        tempInput.style.left = '0';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showCopyNotification();
    }
}

function copyToClipboard(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);

    // Show success message
    const message = document.createElement('div');
    message.textContent = 'Competition link copied to clipboard!';
    message.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #4caf50; color: white; padding: 12px 24px; border-radius: 4px; z-index: 10000;';
    document.body.appendChild(message);
    setTimeout(() => message.remove(), 3000);
}

function showCompetitionError(message) {
    // Show error message in the competition form
    const formContainer = document.querySelector('.create-competition-form');
    if (!formContainer) return;
    
    // Remove any existing error
    const existingError = formContainer.querySelector('.competition-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Create absolutely positioned error element that doesn't affect layout
    const errorDiv = document.createElement('div');
    errorDiv.className = 'competition-error';
    errorDiv.style.cssText = `
        position: absolute !important;
        top: -12px !important;
        left: 8px !important;
        right: 8px !important;
        color: #dc3545 !important;
        font-size: 14px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-weight: normal !important;
        line-height: 1.3 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        background: none !important;
        text-align: left !important;
        display: block !important;
        width: auto !important;
        box-sizing: border-box !important;
        z-index: 1000 !important;
        pointer-events: none !important;
    `;
    errorDiv.textContent = message;
    
    // Make form container relatively positioned to contain the absolute error
    if (formContainer.style.position !== 'relative') {
        formContainer.style.position = 'relative';
    }
    
    // Append to form container (not insert before, to avoid layout impact)
    formContainer.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

async function createNewCompetition() {
    const name = document.getElementById('compName').value.trim();
    const startDate = document.getElementById('compStartDate').value;
    const endDate = document.getElementById('compEndDate').value;
    
    if (!name) {
        showCompetitionError('Please enter a competition name');
        return;
    }
    
    if (!startDate) {
        showCompetitionError('Please select a start date');
        return;
    }
    
    if (!endDate) {
        showCompetitionError('Please select an end date');
        return;
    }
    
    // Validate start date is at least today (allow same-day competitions)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const selectedStartDate = new Date(startDate + 'T00:00:00'); // Ensure local timezone
    const selectedEndDate = new Date(endDate + 'T00:00:00'); // Ensure local timezone

    if (selectedStartDate < today) {
        showCompetitionError('Start date cannot be in the past');
        return;
    }
    
    if (selectedEndDate <= selectedStartDate) {
        showCompetitionError('End date must be after start date');
        return;
    }
    
    try {
        if (window.CompetitionManager) {
            // Get the current user ID
            const userId = window.AuthService?.currentUser?.id || 
                          window.AuthManager?.getCurrentUser()?.id;
            
            if (!userId) {
                showCompetitionError('Please log in to create a competition');
                return;
            }
            
            // Calculate duration in days for backward compatibility
            const durationDays = Math.ceil((selectedEndDate - selectedStartDate) / (1000 * 60 * 60 * 24));
            
            const result = await window.CompetitionManager.createCompetition({
                name: name,
                duration_days: durationDays,
                isPublic: false, // All competitions are now private
                startDate: startDate, // Use selected start date
                endDate: endDate,
                minParticipants: 2,
                allowLateEntries: true,
                requireConsecutiveDays: false,
                scoringMethod: 'average_score'
            }, userId);
            
            if (result && result.id) {
                // Use the actual competition UUID for the link
                const joinLink = `${window.location.origin}${window.location.pathname}?join=${result.id}`;

                // Store competition details for copy functionality
                if (typeof(Storage) !== "undefined") {
                    localStorage.setItem(`compDetails_${result.id}`, JSON.stringify({
                        name: name,
                        startDate: startDate,
                        endDate: endDate,
                        link: joinLink
                    }));
                }
                
                // Show success with join link
                const formContainer = document.querySelector('.create-competition-form');
                formContainer.innerHTML = `
                    <div class="success-message">
                        <h3>Competition Created!</h3>
                        <p><strong>${name}</strong> has been created successfully.</p>
                        
                        <h4>Share this link to invite players:</h4>
                        <div class="join-link-container">
                            <input type="text" id="joinLinkInput" value="${joinLink}" readonly 
                                   style="width: 100%; padding: 8px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; margin: 8px 0;">
                            <button class="success-nav-btn secondary" onclick="copyJoinLink()" style="width: 100%; margin-top: 8px;">
                                Copy Join Link
                            </button>
                        </div>

                        <div class="input-help" style="font-size: 12px; margin-bottom: 20px; text-align: center; margin-top: 15px;">Only those with access to this link can see the leaderboard</div>
                    </div>
                `;
            } else {
                showCompetitionError('Failed to create competition: ' + (result?.error || 'Unknown error'));
            }
        } else {
            showCompetitionError('Competition system is not available');
        }
    } catch (error) {
        console.error('Error creating competition:', error);
        showCompetitionError('Failed to create competition');
    }
}

function viewCompetitionDetails(competitionId) {
    // Show the leaderboard view within the current popup
    showCompetitionLeaderboard(competitionId);
}

async function showCompetitionLeaderboard(competitionId) {
    try {
        // Hide all other views
        hideAllCompetitionViews();
        
        // Show the leaderboard view
        const leaderboardView = document.getElementById('competitionLeaderboardView');
        if (!leaderboardView) {
            console.error('Leaderboard view not found');
            return;
        }
        
        leaderboardView.style.display = 'block';
        
        // Get competition details
        let competitionData = null;

        if (window.CompetitionManager) {
            try {
                competitionData = await window.CompetitionManager.getCompetition(competitionId);
            } catch (error) {
                console.warn('Could not fetch competition details:', error);
            }
        }

        // Update the title to just "Leaderboard"
        const titleElement = document.getElementById('leaderboardCompetitionTitle');
        if (titleElement) {
            titleElement.textContent = 'Leaderboard';
        }
        
        // Get leaderboard container
        const container = document.getElementById('competitionLeaderboardContainer');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                <p>Loading leaderboard...</p>
            </div>
        `;
        
        // Get leaderboard data
        let leaderboardData = [];
        if (window.CompetitionManager) {
            try {
                leaderboardData = await window.CompetitionManager.getCompetitionLeaderboard(competitionId);
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: #666;">Unable to load leaderboard.</p>
                        <button onclick="showCompetitionLeaderboard('${competitionId}')" class="success-nav-btn secondary">
                            Try Again
                        </button>
                    </div>
                `;
                return;
            }
        }
        
        // Render leaderboard
        renderLeaderboardTable(container, leaderboardData, competitionData);
        
    } catch (error) {
        console.error('Error showing competition leaderboard:', error);
    }
}

function renderLeaderboardTable(container, leaderboardData, competitionData) {
    if (!leaderboardData || leaderboardData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="color: #666;">No participants yet.</p>
                <p style="font-size: 14px; color: #999;">Invite friends to join this competition!</p>
            </div>
        `;
        return;
    }
    
    // Competition info section
    let infoHtml = '';
    if (competitionData) {
        const startDate = formatDateForUser(competitionData.start_date);
        const endDate = formatDateForUser(competitionData.end_date);

        // Check if competition has truly ended (past midnight of end date)
        const now = new Date();
        const endDateObj = new Date(competitionData.end_date);
        const endOfEndDate = new Date(endDateObj);
        endOfEndDate.setHours(23, 59, 59, 999); // End of the end date

        const status = now < new Date(competitionData.start_date) ? 'Upcoming' :
                      now > endOfEndDate ? 'Ended' : 'Active';

        infoHtml = `
            <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <div style="margin-bottom: 12px;">
                    <h3 style="margin: 0; color: #333; ${window.innerWidth >= 1200 ? 'font-size: 28px !important;' : 'font-size: 24px !important;'}">${competitionData.name.toUpperCase()}</h3>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: #666;">
                    <span>📅 ${startDate} - ${endDate}</span>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>👥 ${leaderboardData.length} players</span>
                        ${status !== 'Ended' ? `
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button onclick="refreshCompetitionLeaderboard('${competitionData.id}')" class="leaderboard-refresh-btn" title="Refresh leaderboard">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                                </svg>
                            </button>
                            <span onclick="copyCompetitionLink('${competitionData.id}')"
                                  style="padding: 4px 12px; background: #6496FF; color: white; border: 1px solid #000; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer;"
                                  onmouseover="this.style.background='#5485E8'"
                                  onmouseout="this.style.background='#6496FF'"
                                  title="Copy competition invite link">
                                Invite
                            </span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Leaderboard with fixed header structure
    let tableHtml = `
        <div style="display: flex; flex-direction: column; height: 100%;">
            <!-- Fixed competition info -->
            ${infoHtml}

            <!-- Fixed table header -->
            <div style="background: white; border-radius: 8px 8px 0 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex-shrink: 0; overflow: hidden; width: 100%; max-width: 100%;">
                <div style="background: #f8f9fa; padding: 12px; border-bottom: 1px solid #dee2e6; font-weight: bold; display: grid !important; grid-template-columns: minmax(50px, 1fr) minmax(20px, 20px) minmax(120px, 3fr) minmax(80px, 1.5fr); gap: 8px; font-size: 14px; color: black; width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden;">
                    <span style="text-align: center; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Rank</span>
                    <span style="text-align: center; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    <span style="text-align: left; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Player</span>
                    <span style="text-align: left; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Score</span>
                </div>
            </div>

            <!-- Scrollable data rows -->
            <div style="background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; width: 100%; max-width: 100%;">
    `;
    
    // Get current user for highlighting
    const currentUserId = window.AuthService?.currentUser?.id || window.AuthManager?.getCurrentUser()?.id;
    
    leaderboardData.forEach((player, index) => {
        const rank = index + 1;
        const isCurrentUser = currentUserId && player.user_id === currentUserId;
        const averageScore = player.days_played > 0 ? Math.round(player.total_score / player.days_played) : 0;
        
        // Determine rank display (medal or number)
        let rankDisplay = rank.toString();
        if (rank === 1) {
            rankDisplay = '🥇';
        } else if (rank === 2) {
            rankDisplay = '🥈';
        } else if (rank === 3) {
            rankDisplay = '🥉';
        }
        
        // Calculate daily awards (use test data if available, otherwise placeholder)
        let dailyAwards = player.dailyAwards || '';
        // TODO: Replace with actual daily awards logic when not testing
        // if (player.has_daily_crown) dailyAwards += '👑';
        // if (player.has_perfect_cut) dailyAwards += '💯';

        tableHtml += `
            <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; display: grid !important; grid-template-columns: minmax(50px, 1fr) minmax(20px, 20px) minmax(120px, 3fr) minmax(80px, 1.5fr); gap: 8px; align-items: center; font-size: 14px; color: black; width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden; ${isCurrentUser ? 'background: #e7f3ff; font-weight: bold;' : ''}" ${isCurrentUser ? 'id="current-user-row"' : ''}>
                <span style="text-align: center; font-size: ${rankDisplay.includes('🥇') || rankDisplay.includes('🥈') || rankDisplay.includes('🥉') ? '18px' : '13px'}; color: black; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${rankDisplay}</span>
                <span style="text-align: center; font-size: 18px; color: black; font-weight: 300; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${dailyAwards}</span>
                <span style="text-align: left; color: ${isCurrentUser ? '#0066cc' : 'black'}; font-weight: 300; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${player.username || 'Player ' + (index + 1)}</span>
                <span style="text-align: left; color: black; font-weight: 300; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${Math.floor(player.total_score || 0)}</span>
            </div>
        `;
    });

    tableHtml += `
            </div>
        </div>
    </div>`;

    container.innerHTML = tableHtml;
    
    // Scroll to current user if they're in the list
    setTimeout(() => {
        const currentUserRow = document.getElementById('current-user-row');
        if (currentUserRow) {
            // Find the scrollable container
            const scrollableContainer = currentUserRow.closest('[style*="overflow-y: auto"]');
            if (scrollableContainer) {
                const containerRect = scrollableContainer.getBoundingClientRect();
                const rowRect = currentUserRow.getBoundingClientRect();
                const scrollTop = scrollableContainer.scrollTop + (rowRect.top - containerRect.top) - (containerRect.height / 2) + (rowRect.height / 2);
                scrollableContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
            } else {
                currentUserRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 100);
}

function hideAllCompetitionViews() {
    const views = [
        'competitionMainView',
        'competitionActiveView', 
        'competitionCreateView',
        'competitionLeaderboardView',
        'competitionExpiredView'
    ];
    
    views.forEach(viewId => {
        const view = document.getElementById(viewId);
        if (view) {
            view.style.display = 'none';
        }
    });
}

function openFullCompetitionInterface() {
    // Close the modal and open the full competition interface
    closeCompetitionModal();
    
    // Show the full competition interface
    if (window.CompetitionUI) {
        window.CompetitionUI.showCompetitionInterface();
    } else {
        console.warn('Competition UI not available');
    }
}

async function refreshCompetitionLeaderboard(competitionId) {
    console.log('🔄 Refreshing competition leaderboard:', competitionId);
    await showCompetitionLeaderboard(competitionId);
    console.log('✅ Leaderboard refreshed');
}

async function copyCompetitionLink(competitionId) {
    try {
        // Use the actual competition UUID for the link
        const joinLink = `${window.location.origin}${window.location.pathname}?join=${competitionId}`;

        // Get competition details from localStorage
        let compDetailsString = localStorage.getItem(`compDetails_${competitionId}`);

        // If not in localStorage, fetch from server
        if (!compDetailsString && window.CompetitionManager) {
            try {
                const competition = await window.CompetitionManager.getCompetition(competitionId);
                if (competition) {
                    // Save to localStorage for future use
                    localStorage.setItem(`compDetails_${competitionId}`, JSON.stringify({
                        name: competition.name,
                        startDate: competition.start_date,
                        endDate: competition.end_date,
                        link: joinLink
                    }));
                    compDetailsString = localStorage.getItem(`compDetails_${competitionId}`);
                }
            } catch (error) {
                console.warn('Could not fetch competition details:', error);
            }
        }

        let plainTextMessage = joinLink; // Default to just the link
        let htmlMessage = `<a href="${joinLink}">${joinLink}</a>`;

        if (compDetailsString) {
            const compDetails = JSON.parse(compDetailsString);

            // Format dates with "Today" replacement
            const startDate = formatCompetitionDate(compDetails.startDate);
            const endDate = formatCompetitionDate(compDetails.endDate);

            // Create formatted invite text matching copyJoinLink()
            plainTextMessage = `Join my Daily Shapes competition!
Runs from ${startDate} to ${endDate}
Don't be a square - join the fun!

${joinLink}`;

            htmlMessage = `Join my Daily Shapes competition!<br>
Runs from ${startDate} to ${endDate}<br>
Don't be a square - join the fun!<br><br>
<a href="${joinLink}">${joinLink}</a>`;
        } else {
            // Fallback if no details found - use generic message
            plainTextMessage = `Join my Daily Shapes competition!
Don't be a square - join the fun!

${joinLink}`;

            htmlMessage = `Join my Daily Shapes competition!<br>
Don't be a square - join the fun!<br><br>
<a href="${joinLink}">${joinLink}</a>`;
        }

        // Try to copy with both plain text and HTML formats
        try {
            const clipboardItem = new ClipboardItem({
                'text/plain': new Blob([plainTextMessage], { type: 'text/plain' }),
                'text/html': new Blob([htmlMessage], { type: 'text/html' })
            });

            navigator.clipboard.write([clipboardItem]).then(() => {
                showCopyNotification();
            }).catch(() => {
                // Fallback to plain text if rich content fails
                navigator.clipboard.writeText(plainTextMessage).then(() => {
                    showCopyNotification();
                }).catch(() => {
                    fallbackCopyTextToClipboard(plainTextMessage);
                });
            });
        } catch (err) {
            // Fallback to plain text for older browsers
            try {
                navigator.clipboard.writeText(plainTextMessage).then(() => {
                    showCopyNotification();
                }).catch(() => {
                    fallbackCopyTextToClipboard(plainTextMessage);
                });
            } catch (err2) {
                fallbackCopyTextToClipboard(plainTextMessage);
            }
        }
    } catch (error) {
        console.error('Error copying competition link:', error);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyNotification();
        }
    } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
    }

    document.body.removeChild(textArea);
}

function showCopyNotification() {
    // Create notification popup
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        color: black;
        border: 2px solid black;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        pointer-events: none;
        text-align: center;
    `;
    notification.textContent = 'Competition link copied';

    // Add to page
    document.body.appendChild(notification);

    // Remove after 1 second
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 1000);
}

// Test function to simulate a competition with 20 players
function testCompetitionLeaderboard() {
    // Generate 20 fake players with realistic scores
    const fakePlayerNames = [
        "AlexGamer", "BettyShapes", "CharlieAce", "DianaSniper", "EthanPro",
        "FionaSharp", "GeorgeKing", "HelenStar", "IvanMaster", "JuliaCut",
        "KevinBest", "LindaWiz", "MikeChamp", "NancySkill", "OscarTop",
        "PaulaShot", "QuinnEdge", "RachelFast", "SamShapes", "TinaExact"
    ];

    const leaderboardData = fakePlayerNames.map((name, index) => {
        // Generate realistic scores with some randomness
        const baseScore = Math.max(0, 95 - (index * 3) + Math.random() * 10 - 5);
        const daysPlayed = Math.floor(Math.random() * 7) + 1;
        const totalScore = Math.round(baseScore * daysPlayed * 10) / 10;

        // Add some daily awards for top players
        let dailyAwards = '';
        if (index === 0) dailyAwards = '👑💯'; // Top player gets both
        else if (index < 3) dailyAwards = '👑'; // Top 3 get crown
        else if (Math.random() < 0.3) dailyAwards = '💯'; // Random perfect cuts

        return {
            user_id: `test_user_${index + 1}`,
            username: name,
            total_score: totalScore,
            days_played: daysPlayed,
            participant_count: 20,
            dailyAwards: dailyAwards
        };
    });

    // Sort by total score descending
    leaderboardData.sort((a, b) => b.total_score - a.total_score);

    // Create fake competition data
    const competitionData = {
        id: 'test_competition_123',
        name: 'TESTO Competition - 20 Players',
        start_date: '2025-01-15',
        end_date: '2025-01-21',
        description: 'Test competition with 20 players to check leaderboard display'
    };

    // Simulate current user as 8th place player for testing blue highlight
    if (!window.AuthService) window.AuthService = {};
    if (!window.AuthService.currentUser) window.AuthService.currentUser = {};
    window.AuthService.currentUser.id = 'test_user_8';

    // Get the leaderboard container and render
    const container = document.getElementById('competitionLeaderboardContainer');
    if (container) {
        renderLeaderboardTable(container, leaderboardData, competitionData);

        // Show the leaderboard view
        hideAllCompetitionViews();
        document.getElementById('competitionLeaderboardView').style.display = 'block';

        console.log('🎮 Test competition leaderboard created with 20 players');
        console.log('📊 Current user (test_user_8) should be highlighted in blue');
        console.log('📊 Leaderboard data:', leaderboardData);
    } else {
        console.error('❌ Leaderboard container not found');
    }
}

// Utility functions for US date formatting
function isAmericanUser() {
    // Check timezone first - this is the most reliable indicator
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // If timezone is clearly non-US, return false regardless of locale
    if (timezone.startsWith('Australia/') || timezone.startsWith('Europe/') ||
        timezone.startsWith('Asia/') || timezone.startsWith('Africa/') ||
        timezone.startsWith('Antarctica/') || timezone === 'UTC') {
        return false;
    }

    // Only return true for actual US timezones
    const usTimezones = [
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Detroit',
        'America/Kentucky/Louisville', 'America/Indiana/Indianapolis', 'America/Boise',
        'America/North_Dakota/Center', 'America/Menominee', 'America/Metlakatla',
        'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific', 'US/Alaska', 'US/Hawaii'
    ];

    if (usTimezones.includes(timezone)) {
        return true;
    }

    // For any other timezone (Canada, Mexico, etc.), return false even if locale is en-US
    return false;
}

function formatDateForUser(dateString) {
    const date = new Date(dateString);
    if (isAmericanUser()) {
        // US format: MM/DD/YYYY
        return date.toLocaleDateString('en-US');
    } else {
        // International format: DD/MM/YYYY
        return date.toLocaleDateString('en-GB');
    }
}

// Export functions globally
window.openCompetitionModal = openCompetitionModal;
window.closeCompetitionModal = closeCompetitionModal;
window.showCompetitionMain = showCompetitionMain;
window.showActiveCompetitions = showActiveCompetitions;
window.showCreateCompetition = showCreateCompetition;
window.showExpiredCompetitions = showExpiredCompetitions;
window.createNewCompetition = createNewCompetition;
window.viewCompetitionDetails = viewCompetitionDetails;
window.showCompetitionLeaderboard = showCompetitionLeaderboard;
window.copyCompetitionLink = copyCompetitionLink;
window.showCopyNotification = showCopyNotification;
window.isAmericanUser = isAmericanUser;
window.formatDateForUser = formatDateForUser;
window.testCompetitionLeaderboard = testCompetitionLeaderboard;
window.openFullCompetitionInterface = openFullCompetitionInterface;

// Join Competition Popup Functions
async function showJoinCompetitionModal(competitionId) {
    console.log('🚨 showJoinCompetitionModal called with ID:', competitionId);
    console.trace('🚨 Call stack:');

    const modal = document.getElementById('joinCompetitionModal');
    const content = document.getElementById('joinCompetitionContent');

    if (!modal || !content) {
        console.error('Join competition modal elements not found');
        return;
    }

    // First check if user is already participating
    const isAlreadyParticipating = await checkUserParticipation(competitionId);
    if (isAlreadyParticipating) {
        console.log('🔗 User already participating, showing already playing modal instead');
        showAlreadyPlayingModal(competitionId);
        return;
    }

    console.log('🚨 About to show join competition modal');
    content.innerHTML = '<p>Loading competition details...</p>';
    modal.style.display = 'flex';

    try {
        // Get competition details
        const competition = await window.CompetitionManager.getCompetition(competitionId);

        if (competition) {
            const isLoggedIn = isUserSignedIn();

            if (isLoggedIn) {
                // Format the start date
                const startDate = new Date(competition.start_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const compStartDate = new Date(competition.start_date);
                compStartDate.setHours(0, 0, 0, 0);

                // Check if start date is today
                const isToday = compStartDate.getTime() === today.getTime();

                // Format date based on user's locale
                const formatDate = (date) => {
                    // Detect if user is in US (using timezone or navigator.language)
                    const isUS = Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('America') ||
                                 navigator.language?.startsWith('en-US');

                    if (isUS) {
                        // MM/DD/YY format for US
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const year = String(date.getFullYear()).slice(-2);
                        return `${month}/${day}/${year}`;
                    } else {
                        // DD/MM/YY format for rest of world
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = String(date.getFullYear()).slice(-2);
                        return `${day}/${month}/${year}`;
                    }
                };

                // Calculate duration in days
                const start = new Date(competition.start_date);
                const end = new Date(competition.end_date);
                const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

                // Format the start date text
                const startDateText = isToday ? 'Today' : formatDate(startDate);

                // Show join prompt for logged in users
                content.innerHTML = `
                    <div class="success-message" style="padding: 12px 0 8px 0 !important; margin-bottom: 0 !important;">
                        <p style="font-size: 14px; margin-bottom: 6px; color: #666;">Join Competition</p>
                        <h2 style="font-size: 24px; font-weight: bold; margin: 0 0 10px 0;">${competition.name.toUpperCase()}</h2>
                        <p style="margin: 0 0 5px 0; font-size: 15px;">${competition.description || ''}</p>
                        <p style="margin: 0 0 5px 0; font-size: 15px;">Duration: ${durationDays} days starting ${startDateText}</p>
                        <p style="margin: 0; font-size: 15px;">Created by: ${competition.creator_username || competition.creator_id || 'Daily Shapes'}</p>
                    </div>

                    <div class="success-navigation" style="padding-top: 8px !important; padding-bottom: 0px !important; margin-bottom: 0 !important;">
                        <div class="success-buttons" style="margin-bottom: 0 !important;">
                            <button class="success-nav-btn primary" onclick="joinCompetitionFromModal('${competitionId}')">
                                Accept
                            </button>
                            <button class="success-nav-btn tertiary" onclick="closeJoinCompetitionModal()">
                                <span class="btn-icon">✕</span>
                                Cancel
                            </button>
                        </div>
                    </div>
                `;

                // Adjust modal body and content padding to remove empty space
                const modalBody = modal.querySelector('.success-modal-body');
                if (modalBody) {
                    modalBody.style.paddingTop = '8px';
                    modalBody.style.paddingBottom = '0px';
                }

                const modalContent = modal.querySelector('.success-modal-content');
                if (modalContent) {
                    modalContent.style.paddingBottom = '12px';
                }
            } else {
                // Show login prompt for non-logged in users
                content.innerHTML = `
                    <div class="success-message">
                        <div class="welcome-icon">🏆</div>
                        <h3>Join Competition</h3>
                        <p><strong>${competition.name}</strong></p>
                        <p>You need to sign up or log in to join this competition.</p>
                    </div>
                    
                    <div class="success-navigation">
                        <div class="success-buttons">
                            <button class="success-nav-btn primary" onclick="signupToJoinCompetition('${competitionId}')">
                                <span class="btn-icon">👤</span>
                                Sign Up to Join
                            </button>
                            <button class="success-nav-btn secondary" onclick="loginToJoinCompetition('${competitionId}')">
                                <span class="btn-icon">🔑</span>
                                Log In to Join
                            </button>
                            <button class="success-nav-btn tertiary" onclick="closeJoinCompetitionModal()">
                                <span class="btn-icon">✕</span>
                                Cancel
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            content.innerHTML = `
                <div class="success-message">
                    <div class="welcome-icon">❌</div>
                    <h3>Competition Not Found</h3>
                    <p>The competition you're trying to join doesn't exist or has been removed.</p>
                </div>
                
                <div class="success-navigation">
                    <div class="success-buttons">
                        <button class="success-nav-btn tertiary" onclick="closeJoinCompetitionModal()">
                            <span class="btn-icon">✕</span>
                            Close
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading competition details:', error);
        content.innerHTML = `
            <div class="success-message">
                <div class="welcome-icon">❌</div>
                <h3>Error</h3>
                <p>Unable to load competition details. Please try again.</p>
            </div>
            
            <div class="success-navigation">
                <div class="success-buttons">
                    <button class="success-nav-btn tertiary" onclick="closeJoinCompetitionModal()">
                        <span class="btn-icon">✕</span>
                        Close
                    </button>
                </div>
            </div>
        `;
    }
}

function closeJoinCompetitionModal() {
    const modal = document.getElementById('joinCompetitionModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear join link from URL
        if (window.CompetitionManager) {
            window.CompetitionManager.clearJoinLink();
        }
        // Clear pending join from sessionStorage
        sessionStorage.removeItem('pendingJoinCompetitionId');
        console.log('🗑️ Cleared pending competition join');
    }
}

async function joinCompetitionFromModal(competitionId) {
    try {
        const userId = window.AuthService?.currentUser?.id || window.AuthManager?.getCurrentUser()?.id;
        if (!userId) {
            alert('Please log in to join the competition');
            return;
        }
        
        const result = await window.CompetitionManager.joinCompetition(competitionId, userId);
        
        if (result.success) {
            closeJoinCompetitionModal();
            
            // Show success message
            const modal = document.getElementById('joinCompetitionModal');
            const content = document.getElementById('joinCompetitionContent');
            if (modal && content) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                        <h3 style="margin-bottom: 10px;">Successfully joined!</h3>
                        <p style="color: #666; margin-bottom: 20px;">
                            ${result.message === 'Already participating' ? 
                                'You were already part of this competition' : 
                                'Welcome to the competition!'}
                        </p>
                        <button class="success-nav-btn primary" onclick="closeJoinCompetitionModal(); openCompetitionModal();">
                            Continue
                        </button>
                    </div>
                `;
                
                // Auto-close and open competitions quickly
                setTimeout(() => {
                    closeJoinCompetitionModal();
                    openCompetitionModal();
                }, 500); // Reduced from 3000ms to 500ms for quicker transition
            }
        } else {
            // Show error in the modal instead of browser alert
            const content = document.getElementById('joinCompetitionContent');
            if (content) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 30px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                        <h3 style="margin-bottom: 10px;">Unable to join</h3>
                        <p style="color: #666; margin-bottom: 20px;">${result.error || 'Unknown error'}</p>
                        <button class="success-nav-btn secondary" onclick="location.reload()">
                            Try Again
                        </button>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error joining competition:', error);
        // Show error in the modal instead of browser alert
        const content = document.getElementById('joinCompetitionContent');
        if (content) {
            content.innerHTML = `
                <div style="text-align: center; padding: 30px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                    <h3 style="margin-bottom: 10px;">Connection Error</h3>
                    <p style="color: #666; margin-bottom: 20px;">Unable to connect to the competition system</p>
                    <button class="success-nav-btn secondary" onclick="location.reload()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}

function signupToJoinCompetition(competitionId) {
    // Store the join info for after authentication
    sessionStorage.setItem('pendingJoinCompetitionId', competitionId);
    
    closeJoinCompetitionModal();
    
    // Open signup modal
    if (window.openAuthModal) {
        window.openAuthModal('signup', 'Create an account to join this competition');
    }
}

function loginToJoinCompetition(competitionId) {
    // Store the join info for after authentication
    sessionStorage.setItem('pendingJoinCompetitionId', competitionId);
    
    closeJoinCompetitionModal();
    
    // Open login modal
    if (window.openAuthModal) {
        window.openAuthModal('login', 'Log in to join this competition');
    }
}

// Process URL parameters for join links
async function processJoinLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');

    if (joinCode) {
        console.log('🔗 Processing join link with competition ID:', joinCode);

        // Use the join code directly as the competition ID (UUID)
        const competitionId = joinCode;

        // Check if user is logged in
        if (window.AuthService?.isLoggedIn()) {
            console.log('🔗 User is logged in, checking participation status');
            // Check if user is already participating in this competition
            const isAlreadyParticipating = await checkUserParticipation(competitionId);

            if (isAlreadyParticipating) {
                console.log('🔗 User already participating, showing already playing modal');
                showAlreadyPlayingModal(competitionId);
            } else {
                console.log('🔗 User not participating, showing join competition modal');
                showJoinCompetitionModal(competitionId);
            }
        } else {
            console.log('🔗 User not logged in, storing pending join and showing auth');
            // Store the competition ID for after authentication
            sessionStorage.setItem('pendingJoinCompetitionId', competitionId);

            // Show auth required popup with competition-specific message
            showCompetitionAuthPopup();
        }

        // Clean up URL to remove the join parameter
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
}

// Show auth required popup for competition invites
function showCompetitionAuthPopup() {
    // Create popup if it doesn't exist
    let popup = document.getElementById('competitionAuthPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'competitionAuthPopup';
        popup.className = 'auth-popup-overlay';
        popup.innerHTML = `
            <div class="auth-popup-content">
                <button class="auth-popup-close" id="compAuthClose" aria-label="Close">×</button>
                <h3>Join Competition</h3>
                <p>To join this Daily Shapes competition, you'll need a free account.</p>
                <div class="auth-popup-buttons">
                    <button id="compAuthCreateAccount" class="auth-popup-btn primary">Create Account</button>
                    <button id="compAuthSignIn" class="auth-popup-btn secondary">Sign In</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        // Add event listeners
        document.getElementById('compAuthCreateAccount').addEventListener('click', () => {
            closeCompetitionAuthPopup();
            if (window.openAuthModal) {
                window.openAuthModal('signup', 'Create an account to join this competition');
            }
        });

        document.getElementById('compAuthSignIn').addEventListener('click', () => {
            closeCompetitionAuthPopup();
            if (window.openAuthModal) {
                window.openAuthModal('login', 'Sign in to join this competition');
            }
        });

        document.getElementById('compAuthClose').addEventListener('click', () => {
            closeCompetitionAuthPopup();
            // Clear the pending competition ID if user closes without signing in
            sessionStorage.removeItem('pendingJoinCompetitionId');
        });

        // Close on overlay click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                closeCompetitionAuthPopup();
                sessionStorage.removeItem('pendingJoinCompetitionId');
            }
        });
    }

    popup.style.display = 'flex';
}

function closeCompetitionAuthPopup() {
    const popup = document.getElementById('competitionAuthPopup');
    if (popup) popup.style.display = 'none';
}

// Check if user is already participating in a competition
async function checkUserParticipation(competitionId) {
    try {
        console.log('🔗 Checking participation for competition:', competitionId);

        // Get current user ID
        const userId = window.AuthService?.currentUser?.id;
        if (!userId) {
            console.log('❌ No user ID available for participation check');
            return false;
        }

        console.log('🔗 Checking database directly for user:', userId);

        // Check database directly instead of relying on cached data
        if (window.SupabaseConfig?.client) {
            const { data: existingParticipation, error } = await window.SupabaseConfig.client
                .from('competition_participants')
                .select('id, competition_id, status')
                .eq('competition_id', competitionId)
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('❌ Database error checking participation:', error);
                // Fall back to cached check if database fails
                return await checkUserParticipationCached(competitionId);
            }

            const isParticipating = !!existingParticipation;
            console.log('🔗 Database participation check result:', isParticipating);
            if (existingParticipation) {
                console.log('🔗 Found participation record:', existingParticipation);
            }

            return isParticipating;
        } else {
            console.log('⚠️ Supabase not available, falling back to cached check');
            return await checkUserParticipationCached(competitionId);
        }
    } catch (error) {
        console.error('❌ Error checking user participation:', error);
        return false; // If error, assume not participating to show join modal
    }
}

// Fallback cached check
async function checkUserParticipationCached(competitionId) {
    try {
        console.log('🔗 Using cached participation check for:', competitionId);

        // Load user competitions with retry logic
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                if (window.CompetitionManager && window.CompetitionManager.loadUserCompetitions) {
                    console.log(`🔗 Loading user competitions (attempt ${attempts + 1}/${maxAttempts})`);
                    await window.CompetitionManager.loadUserCompetitions();
                }
                break;
            } catch (loadError) {
                attempts++;
                console.log(`⚠️ Failed to load user competitions (attempt ${attempts}):`, loadError);
                if (attempts >= maxAttempts) {
                    throw loadError;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Check if competition ID exists in user's competitions
        const userCompetitions = window.CompetitionManager?.userCompetitions || [];
        console.log('🔗 Cached user competitions:', userCompetitions.map(c => ({ id: c.id || c.competition_id, name: c.name })));

        const isParticipating = userCompetitions.some(participation => {
            const competitionIdMatch = participation.competition_id === competitionId;
            const idMatch = participation.id === competitionId;
            return competitionIdMatch || idMatch;
        });

        console.log('🔗 Cached participation check result:', isParticipating);
        return isParticipating;
    } catch (error) {
        console.error('❌ Error in cached participation check:', error);
        return false;
    }
}

// Show small popup notification when user is already participating in the competition
function showAlreadyPlayingModal(competitionId) {
    console.log('🎯 SHOWING ALREADY PLAYING MODAL for competition:', competitionId);
    showAlreadyPlayingNotification();
}

function showAlreadyPlayingNotification() {
    console.log('🎯 CREATING ALREADY PLAYING NOTIFICATION POPUP');
    // Create notification popup
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        color: black;
        border: 2px solid black;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        pointer-events: none;
        text-align: center;
    `;
    notification.textContent = "You're already playing in this competition";

    // Add to page
    document.body.appendChild(notification);

    // Remove after 1 second
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 1000);
}

// Navigate to competition leaderboard
function viewCompetitionLeaderboard(competitionId) {
    // Close the modal first
    closeJoinCompetitionModal();

    // Navigate to leaderboard view
    if (window.CustomCompetitionManager && window.CustomCompetitionManager.viewCompetitionLeaderboard) {
        console.log('📊 Opening leaderboard for competition:', competitionId);
        window.CustomCompetitionManager.viewCompetitionLeaderboard(competitionId);
    } else {
        console.log('📊 CustomCompetitionManager not available, triggering event');
        // Fallback: trigger a custom event
        const event = new CustomEvent('showCompetitionLeaderboard', {
            detail: { competitionId }
        });
        document.dispatchEvent(event);
    }
}

// Export functions globally
window.showJoinCompetitionModal = showJoinCompetitionModal;
window.closeJoinCompetitionModal = closeJoinCompetitionModal;
window.processJoinLink = processJoinLink;
window.joinCompetitionFromModal = joinCompetitionFromModal;
window.signupToJoinCompetition = signupToJoinCompetition;
window.loginToJoinCompetition = loginToJoinCompetition;

// Copy join link function
// Generate short alphanumeric code for competition links
function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Helper function to format competition dates with "Today" replacement
function formatCompetitionDate(dateStr) {
    // Use LOCAL timezone for today comparison
    const todayDate = new Date();
    const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    if (dateStr === today) {
        return 'Today';
    }
    return formatDateForUser(dateStr);
}

function copyJoinLink() {
    const input = document.getElementById('joinLinkInput');
    if (input) {
        const linkUrl = input.value;
        const competitionId = linkUrl.split('?join=')[1];

        // Get competition details from localStorage
        const compDetailsString = localStorage.getItem(`compDetails_${competitionId}`);
        if (compDetailsString) {
            const compDetails = JSON.parse(compDetailsString);

            // Format dates with "Today" replacement
            const startDate = formatCompetitionDate(compDetails.startDate);
            const endDate = formatCompetitionDate(compDetails.endDate);

            // Updated invite text
            const plainTextMessage = `Join my Daily Shapes competition!
Runs from ${startDate} to ${endDate}
Don't be a square - join the fun!

${linkUrl}`;

            const htmlMessage = `Join my Daily Shapes competition!<br>
Runs from ${startDate} to ${endDate}<br>
Don't be a square - join the fun!<br><br>
<a href="${linkUrl}">${linkUrl}</a>`;

            // Get button reference for success feedback
            const button = document.querySelector('.success-nav-btn.secondary');

            // Copy with both plain text and HTML formats
            try {
                const clipboardItem = new ClipboardItem({
                    'text/plain': new Blob([plainTextMessage], { type: 'text/plain' }),
                    'text/html': new Blob([htmlMessage], { type: 'text/html' })
                });

                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess(button);
                }).catch(() => {
                    // Fallback to plain text if rich content fails
                    navigator.clipboard.writeText(plainTextMessage).then(() => {
                        showCopySuccess(button);
                    }).catch(() => {
                        fallbackCopyTextToClipboard(plainTextMessage, button);
                    });
                });
            } catch (err) {
                // Fallback to plain text for older browsers
                try {
                    navigator.clipboard.writeText(plainTextMessage).then(() => {
                        showCopySuccess(button);
                    }).catch(() => {
                        fallbackCopyTextToClipboard(plainTextMessage, button);
                    });
                } catch (err2) {
                    fallbackCopyTextToClipboard(plainTextMessage, button);
                }
            }
        } else {
            // Fallback to copying just the link if details not found
            input.select();
            input.setSelectionRange(0, 99999);

            try {
                document.execCommand('copy');
                const button = document.querySelector('.success-nav-btn.secondary');
                showCopySuccess(button);
            } catch (err) {
                console.error('Failed to copy: ', err);
                alert('Failed to copy link. Please select and copy manually.');
            }
        }
    }

    function showCopySuccess(button) {
        if (button) {
            const originalText = button.innerHTML;
            button.innerHTML = '<span class="btn-icon">✅</span>Copied!';

            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }

        // Show the same notification popup as the Invite button
        showCopyNotification();
    }

    function fallbackCopyTextToClipboard(text, button) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showCopySuccess(button);
            } else {
                alert('Failed to copy. Please copy manually.');
            }
        } catch (err) {
            console.error('Fallback: Failed to copy: ', err);
            alert('Failed to copy. Please copy manually.');
        }

        document.body.removeChild(textArea);
    }
}

window.copyJoinLink = copyJoinLink;

// Override competition auth success handler to use our new modal
window.handleAuthSuccess = function() {
    console.log('🔐 handleAuthSuccess called - processing authentication success');
    
    const pendingJoinId = sessionStorage.getItem('pendingJoinCompetitionId');
    
    // ALWAYS refresh AuthService state after login - this is critical
    setTimeout(async () => {
        try {
            // CRITICAL: Re-initialize AuthService to pick up new session state
            console.log('🔐 Re-initializing AuthService to detect new session after login');
            if (window.AuthService) {
                await window.AuthService.initialize();
                console.log('✅ AuthService re-initialized, new state:', {
                    isGuest: window.AuthService.isGuest,
                    currentUser: !!window.AuthService.currentUser,
                    userId: window.AuthService.currentUser?.id
                });
            }
            
            // Update UI state to reflect login
            if (window.updateLoginStatus) {
                window.updateLoginStatus(true);
            }
            if (window.updateMenuState) {
                window.updateMenuState();
            }
            
            // Update menu visibility for logged-in state
            updateMenuVisibility();
            
            // Update button states to reflect new auth state
            updateButtonStates();
            
            // Trigger auth state changed event for all UI elements
            document.dispatchEvent(new CustomEvent('authStateChanged'));
            
            // Competition join is handled by processAuthStateChange via authStateChanged event
            console.log('✅ Login completed - competition handling delegated to authStateChanged event');
        } catch (error) {
            console.error('❌ Error in handleAuthSuccess:', error);
            if (pendingJoinId) {
                showJoinCompetitionModal(pendingJoinId);
            }
        }
    }, 300); // Reduced delay for faster modal appearance
    
    return true; // Always indicate we handled the auth success
};

// Track if we've already processed the initial join link
let hasProcessedInitialJoinLink = false;

// Additional auth state change listener for competition joins
document.addEventListener('authStateChanged', async () => {
    console.log('🔄 Auth state changed - checking for pending competition joins and refreshing daily game');

    // Refresh daily game state for new user
    if (window.DailyGameCore && window.DailyGameCore.refreshForNewUser) {
        await window.DailyGameCore.refreshForNewUser();
    }

    // Check if sign-in was triggered from play button
    const signInFromPlay = sessionStorage.getItem('signInFromPlay');
    if (signInFromPlay && window.AuthService?.isLoggedIn()) {
        console.log('✅ Sign-in from play button detected - continuing game start');
        sessionStorage.removeItem('signInFromPlay');

        // Continue with the play button flow
        setTimeout(() => {
            continuePlayButtonClick();
        }, 500);
        return; // Skip competition join logic
    }

    const pendingJoinId = sessionStorage.getItem('pendingJoinCompetitionId');
    if (pendingJoinId && window.AuthService?.isLoggedIn()) {
        console.log('🔗 Found pending competition join after auth state change:', pendingJoinId);

        // Remove from storage to prevent multiple attempts
        sessionStorage.removeItem('pendingJoinCompetitionId');

        try {
            // Add small delay to ensure CompetitionManager is fully initialized after login
            console.log('🔗 Waiting for CompetitionManager to fully initialize...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check if user is already participating before attempting to join
            const isAlreadyParticipating = await checkUserParticipation(pendingJoinId);

            if (isAlreadyParticipating) {
                console.log('🔗 User already participating after login');
                showAlreadyPlayingModal(pendingJoinId);
            } else {
                console.log('🔗 User not participating, showing join modal');
                showJoinCompetitionModal(pendingJoinId);
            }
        } catch (error) {
            console.error('❌ Error joining competition in auth state change:', error);
            showJoinCompetitionModal(pendingJoinId);
        }
    } else if (!hasProcessedInitialJoinLink) {
        // Only process URL join links once on initial page load, not on every auth state change
        hasProcessedInitialJoinLink = true;
        processJoinLink();
    }
});

function updateButtonStates() {
    // Set active state for current section
    updateActiveButtonState();
}

function updateActiveButtonState() {
    // For dropdown menu, we don't need to track active states of individual items
    // The menu button itself shows the expanded/collapsed state through CSS classes
    console.log('🔵 Active state updated for dropdown menu');
}

function showAuthenticationPopup() {
    // Create popup if it doesn't exist
    let popup = document.getElementById('authRequiredPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'authRequiredPopup';
        popup.className = 'auth-popup-overlay';
        popup.innerHTML = `
            <div class="auth-popup-content">
                <button class="auth-popup-close" id="authClose" aria-label="Close">×</button>
                <h3>Account Required</h3>
                <p>You need to sign in to access this feature.</p>
                <div class="auth-popup-buttons">
                    <button id="authCreateAccount" class="auth-popup-btn primary">Create Account</button>
                    <button id="authSignIn" class="auth-popup-btn secondary">Sign In</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        
        // Add event listeners
        document.getElementById('authCreateAccount').addEventListener('click', () => {
            closeAuthPopup();
            openAuthModal();
            switchAuthMode('signup');
        });
        
        document.getElementById('authSignIn').addEventListener('click', () => {
            closeAuthPopup();
            openAuthModal();
            switchAuthMode('login');
        });
        
        document.getElementById('authClose').addEventListener('click', closeAuthPopup);
        
        // Close on overlay click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) closeAuthPopup();
        });
    }
    
    popup.style.display = 'flex';
}

function closeAuthPopup() {
    const popup = document.getElementById('authRequiredPopup');
    if (popup) popup.style.display = 'none';
}

async function showUserProfileMenu() {
    try {
        console.log('📋 showUserProfileMenu called - entering function');
        
        // Create profile popup if it doesn't exist
        let popup = document.getElementById('userProfilePopup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'userProfilePopup';
            popup.className = 'profile-popup-overlay';
            document.body.appendChild(popup);
            console.log('📋 Profile popup created');
        } else {
            console.log('📋 Profile popup already exists');
        }
    
    // Get user data from Supabase session
    let userEmail = 'User';
    let userName = 'User';
    
    // Try Supabase first
    if (window.supabase && window.supabase.auth) {
        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (session && session.user) {
                userEmail = session.user.email || 'User';
                userName = userEmail.split('@')[0]; // Use email prefix as username
                console.log('📋 Got user from Supabase:', userEmail);
            }
        } catch (err) {
            console.log('⚠️ Could not get Supabase session in profile menu:', err);
        }
    }
    
    // Fallback to localStorage if Supabase is not available
    if (userEmail === 'User') {
        const userData = JSON.parse(localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token') || '{}');
        if (userData?.currentSession?.user) {
            userEmail = userData.currentSession.user.email || 'User';
            userName = userEmail.split('@')[0];
            console.log('📋 Got user from localStorage:', userEmail);
        }
    }
    
    // Final fallback to AuthService
    if (userEmail === 'User' && window.AuthService && window.AuthService.currentUser) {
        userEmail = window.AuthService.currentUser.email || 'User';
        userName = userEmail.split('@')[0];
        console.log('📋 Got user from AuthService:', userEmail);
    }
    
    console.log('📋 Final user data:', { userName, userEmail });
    
    // Get statistics from localStorage or UserAccountManager
    let stats = {
        gamesPlayed: parseInt(localStorage.getItem('totalGamesPlayed') || '0'),
        perfectCuts: parseInt(localStorage.getItem('totalPerfectCuts') || '0'),
        averageScore: Math.round(parseFloat(localStorage.getItem('averageScore') || '0')),
        currentStreak: parseInt(localStorage.getItem('currentStreak') || '0'),
        bestStreak: parseInt(localStorage.getItem('bestStreak') || '0'),
        competitionsWon: 0
    };

    // If we have UserAccountManager, get proper stats
    if (window.UserAccountManager && window.UserAccountManager.getUserStats) {
        const userStats = window.UserAccountManager.getUserStats();
        if (userStats) {
            stats = {
                gamesPlayed: stats.gamesPlayed, // Keep localStorage for this
                perfectCuts: userStats.perfectCuts || 0,
                averageScore: Math.round(userStats.averageScore || 0), // Whole number, no decimals
                currentStreak: userStats.currentStreak || 0,
                bestStreak: userStats.bestStreak || 0,
                competitionsWon: (userStats.competitionsWon !== undefined && userStats.competitionsWon !== null && userStats.competitionsWon !== 'undefined') ? userStats.competitionsWon : 0
            };
        }
    }

    // Ensure competitions won is never undefined
    if (stats.competitionsWon === undefined || stats.competitionsWon === null || stats.competitionsWon === 'undefined') {
        stats.competitionsWon = 0;
    }
    
    popup.innerHTML = `
        <div class="profile-popup-content">
            <button class="profile-popup-close" id="profileClose" aria-label="Close">×</button>
            <h3>${userName}</h3>

            <div class="profile-stats">
                <h4>Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Perfect Cuts</span>
                        <span class="stat-value">${stats.perfectCuts}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Average Score</span>
                        <span class="stat-value">${stats.averageScore || 0}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Daily Streak</span>
                        <span class="stat-value">${stats.currentStreak} 🔥</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Comps Won</span>
                        <span class="stat-value">${stats.competitionsWon || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="profile-buttons">
                <button id="changePasswordBtn" class="profile-popup-btn secondary">Change Password</button>
                <button id="logoutBtn" class="profile-popup-btn primary">Log Out</button>
            </div>
        </div>
    `;
    
    // Add event listeners
    document.getElementById('profileClose').addEventListener('click', closeProfilePopup);
    document.getElementById('changePasswordBtn').addEventListener('click', () => {
        closeProfilePopup();
        showChangePasswordModal();
    });
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        closeProfilePopup();
        await handleLogout();
    });
    
    // Close on overlay click
    popup.addEventListener('click', (e) => {
        if (e.target === popup) closeProfilePopup();
    });
    
    popup.style.display = 'flex';
    console.log('📋 Profile popup displayed with display:flex');
    } catch (error) {
        console.error('❌ Error in showUserProfileMenu:', error);
        console.error('Stack trace:', error.stack);
        alert('Error showing profile menu. Please try again.');
    }
}

function closeProfilePopup() {
    const popup = document.getElementById('userProfilePopup');
    if (popup) popup.style.display = 'none';
}

async function showChangePasswordModal() {
    console.log('🔐 Opening change password modal');

    // Remove any existing modal and unlock body if needed
    const existingModal = document.getElementById('changePasswordModal');
    if (existingModal) {
        closeMainPasswordModal();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'changePasswordModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 3000;';

    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; border: 2px solid black; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2); max-width: 400px; width: 90%; position: relative;">
            <button id="closePasswordModalBtn" class="auth-modal-close" style="position: absolute; top: 10px; right: 10px;">×</button>
            <h3 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 700; text-align: center;">Change Password</h3>
            <p style="color: #666; margin-bottom: 20px; text-align: center;">Enter your new password below</p>

            <div style="margin-bottom: 15px;">
                <input type="password" id="newPassword" placeholder="New Password"
                    style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
            </div>

            <div style="margin-bottom: 20px;">
                <input type="password" id="confirmPassword" placeholder="Confirm Password"
                    style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
            </div>

            <div id="passwordError" style="color: #ff4444; margin-bottom: 15px; display: none; text-align: center;"></div>
            <div id="passwordSuccess" style="color: #44aa44; margin-bottom: 15px; display: none; text-align: center;"></div>

            <button id="submitPasswordChange"
                style="width: 100%; padding: 12px 24px; border: 2px solid black; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; background: #6496FF; color: white;">
                Update Password
            </button>

            <button id="cancelPasswordChangeBtn"
                style="width: 100%; margin-top: 10px; padding: 12px 24px; border: 2px solid #666; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; background: white; color: #333;">
                Cancel
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Lock body position on small screens to prevent background shift when keyboard appears
    if (window.innerWidth <= 400 && window.innerHeight <= 700) {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.setAttribute('data-scroll-lock', scrollY);
        console.log('🔒 Body locked at scroll position for password modal:', scrollY);
    }

    // Add event listeners for close and cancel buttons
    const closeBtn = document.getElementById('closePasswordModalBtn');
    const cancelBtn = document.getElementById('cancelPasswordChangeBtn');

    console.log('🔍 Close button found:', !!closeBtn);
    console.log('🔍 Cancel button found:', !!cancelBtn);

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('🔘 Close button clicked');
            closeMainPasswordModal();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            console.log('🔘 Cancel button clicked');
            closeMainPasswordModal();
        });
    }

    // Add event listener for submit button
    document.getElementById('submitPasswordChange').addEventListener('click', async () => {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('passwordError');
        const successDiv = document.getElementById('passwordSuccess');
        const submitBtn = document.getElementById('submitPasswordChange');
        
        // Reset messages
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
        
        // Validation
        if (!newPassword || !confirmPassword) {
            errorDiv.textContent = 'Please enter and confirm your new password';
            errorDiv.style.display = 'block';
            return;
        }
        
        if (newPassword.length < 6) {
            errorDiv.textContent = 'Password must be at least 6 characters long';
            errorDiv.style.display = 'block';
            return;
        }
        
        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Show loading state
        submitBtn.textContent = 'Updating...';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        
        try {
            // Get the Supabase client from SupabaseConfig
            let supabaseClient = null;
            
            if (window.SupabaseConfig && window.SupabaseConfig.client) {
                supabaseClient = window.SupabaseConfig.client;
                console.log('🔐 Got Supabase client from SupabaseConfig');
            } else if (window.supabaseClient) {
                supabaseClient = window.supabaseClient;
                console.log('🔐 Got Supabase client from window');
            } else if (window.supabase) {
                supabaseClient = window.supabase;
                console.log('🔐 Got Supabase client from window.supabase');
            }
            
            // Debug what we have
            console.log('🔐 Supabase client check:', {
                hasClient: !!supabaseClient,
                hasAuth: !!(supabaseClient && supabaseClient.auth),
                hasUpdateUser: !!(supabaseClient && supabaseClient.auth && supabaseClient.auth.updateUser)
            });
            
            if (!supabaseClient || !supabaseClient.auth) {
                throw new Error('Authentication service not available. Please refresh the page and try again.');
            }
            
            console.log('🔐 Updating password via Supabase...');
            const { data, error } = await supabaseClient.auth.updateUser({ 
                password: newPassword 
            });
            
            if (error) {
                console.error('Password update error:', error);
                errorDiv.textContent = error.message || 'Failed to update password';
                errorDiv.style.display = 'block';
                submitBtn.textContent = 'Update Password';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            } else {
                console.log('✅ Password updated successfully');
                successDiv.textContent = 'Password updated successfully!';
                successDiv.style.display = 'block';
                submitBtn.textContent = 'Success!';
                submitBtn.style.background = '#44aa44';

                // Close modal after 2 seconds
                setTimeout(() => {
                    closeMainPasswordModal();
                    // Close the profile popup too
                    const profilePopup = document.getElementById('userProfilePopup');
                    if (profilePopup) {
                        profilePopup.remove();
                    }
                }, 2000);
            }
        } catch (err) {
            console.error('Password update error:', err);
            errorDiv.textContent = err.message || 'An error occurred while updating password';
            errorDiv.style.display = 'block';
            submitBtn.textContent = 'Update Password';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeMainPasswordModal();
        }
    });

    // Focus on first input
    setTimeout(() => {
        document.getElementById('newPassword').focus();
    }, 100);
}

// Helper function to close the change password modal and unlock body
function closeMainPasswordModal() {
    console.log('🔧 closeMainPasswordModal called');
    const modal = document.getElementById('changePasswordModal');
    console.log('🔍 Modal found:', !!modal);

    if (!modal) {
        console.log('❌ No modal found to close');
        return;
    }

    // Unlock body position if it was locked
    const scrollY = document.body.getAttribute('data-scroll-lock');
    if (scrollY !== null) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.removeAttribute('data-scroll-lock');
        window.scrollTo(0, parseInt(scrollY));
        console.log('🔓 Body unlocked for password modal, restored scroll position:', scrollY);
    }

    // Remove the modal
    modal.remove();
    console.log('✅ Modal removed successfully');
}

// Make functions globally available
window.showChangePasswordModal = showChangePasswordModal;
window.closeMainPasswordModal = closeMainPasswordModal;

async function handleLogout() {
    try {
        console.log('🔐 Logging out...');
        
        // Get the Supabase client from SupabaseConfig
        let supabaseClient = null;
        
        if (window.SupabaseConfig && window.SupabaseConfig.client) {
            supabaseClient = window.SupabaseConfig.client;
            console.log('🔐 Got Supabase client from SupabaseConfig for logout');
        } else if (window.supabaseClient) {
            supabaseClient = window.supabaseClient;
            console.log('🔐 Got Supabase client from window for logout');
        }
        
        // Sign out from Supabase if client is available
        if (supabaseClient && supabaseClient.auth) {
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                console.error('Supabase signOut error:', error);
            } else {
                console.log('✅ Successfully signed out from Supabase');
            }
        }
        
        // Clear local storage auth tokens regardless
        localStorage.removeItem('sb-zxrfhumifazjxgikltkz-auth-token');
        localStorage.removeItem('userAuthToken');
        console.log('✅ Cleared local storage tokens');
        
        // Refresh the page to reset the state
        window.location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

// Make the logout function globally available
window.handleLogoutClick = handleLogout;

// Make competition functions globally available
window.showCompetitionLeaderboard = showCompetitionLeaderboard;
window.shareCompetition = shareCompetition;

async function switchToSection(section) {
    const previousSection = currentSection;
    currentSection = section;
    
    // Save game state when leaving daily section (using same save as refresh)
    if (previousSection === 'daily' && section !== 'daily') {
        if (window.SimpleRefresh && window.SimpleRefresh.save) {
            window.SimpleRefresh.save();
            console.log('💾 Game state saved when navigating to', section);
        }
    }
    
    // Hide main game interface
    const gameElements = ['.canvas-container', '.goal-display', '.results-container', '.buttons-below-canvas'];
    gameElements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) element.style.display = 'none';
    });
    
    // Show section content
    await showSectionContent(section, previousSection);
    updateActiveButtonState();
    
    // Update title
    updateSectionTitle(section);
}

function updateSectionTitle(section) {
    const titleElement = document.getElementById('dateTitle');
    if (!titleElement) return;
    
    switch(section) {
        case 'archive':
            titleElement.innerHTML = '<strong>Practice</strong>';
            document.title = 'Practice - Daily Shapes';
            break;
        case 'competition':
            titleElement.innerHTML = '<strong>Competitions</strong>';
            document.title = 'Competitions - Daily Shapes';
            break;
        case 'profile':
            titleElement.innerHTML = '<strong>Profile</strong>';
            document.title = 'Profile - Daily Shapes';
            break;
        case 'daily':
        default:
            // Restore the proper formatted date title instead of using updateTitle()
            if (window.updateDateTitle && typeof window.updateDateTitle === 'function') {
                window.updateDateTitle();
                document.title = `Daily Shapes #${currentDayNumber || 1}`;
            } else {
                updateTitle(); // Fallback to existing function
            }
            break;
    }
}

async function showSectionContent(section, previousSection) {
    // Remove existing section content
    const existingContent = document.getElementById('sectionContent');
    if (existingContent) existingContent.remove();
    
    if (section === 'daily') {
        // Show main game interface
        const gameElements = ['.canvas-container', '.goal-display', '.results-container', '.buttons-below-canvas'];
        gameElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.style.display = '';
        });
        return;
    }
    
    // Create section content container
    const sectionContent = document.createElement('div');
    sectionContent.id = 'sectionContent';
    sectionContent.className = 'section-content';
    
    // Insert after canvas container
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
        canvasContainer.parentNode.insertBefore(sectionContent, canvasContainer.nextSibling);
    } else {
        document.querySelector('main').appendChild(sectionContent);
    }
    
    // Show loading state
    sectionContent.innerHTML = '<div class="loading-content">Loading...</div>';
    
    // Generate content based on section
    let content = '';
    switch(section) {
        case 'archive':
            content = createPracticeContent();
            break;
        case 'competition':
            content = createCompetitionContent();
            break;
        case 'profile':
            content = await createProfileContent();
            break;
    }
    
    sectionContent.innerHTML = content;
}

function createPracticeContent() {
    return `
        <div class="section-placeholder">
            <div class="section-header">
                <h2>Your Puzzle History</h2>
                <button class="back-to-daily-btn" onclick="handleBackToDaily()">← Back to Daily Shapes</button>
            </div>
            <div class="placeholder-content">
                <div class="placeholder-calendar">
                    <div class="calendar-grid">
                        ${generateCalendarPlaceholder()}
                    </div>
                </div>
                <div class="placeholder-stats">
                    <h3>Your Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number">--</div>
                            <div class="stat-label">Puzzles Solved</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">--</div>
                            <div class="stat-label">Current Streak</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">--</div>
                            <div class="stat-label">Best Time</div>
                        </div>
                    </div>
                </div>
                <div class="coming-soon">
                    <p>🚧 Coming Soon - View your puzzle history and statistics</p>
                </div>
            </div>
        </div>
    `;
}

function createCompetitionContent() {
    // Show the competition interface
    setTimeout(() => {
        if (window.CompetitionUI) {
            window.CompetitionUI.showCompetitionInterface();
        }
    }, 100);
    
    return `
        <div class="section-placeholder">
            <div class="section-header">
                <h2>Loading Competitions...</h2>
                <button class="back-to-daily-btn" onclick="handleBackToDaily()">← Back to Daily Shapes</button>
            </div>
            <div class="placeholder-content">
                <div style="text-align: center; padding: 40px;">
                    <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #2a5298; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p>Opening competition interface...</p>
                </div>
            </div>
        </div>`;
}

async function createProfileContent() {
    let username = 'Guest';
    let userProfile = null;
    let userStats = null;
    let competitions = [];
    
    // Get user data if authenticated
    if (isUserSignedIn() && window.UserAccountManager) {
        try {
            await window.UserAccountManager.initialize();
            const currentUser = window.UserAccountManager.getCurrentUser();
            userProfile = window.UserAccountManager.getUserProfile();
            userStats = window.UserAccountManager.getUserStats();
            competitions = window.UserAccountManager.getUserCompetitions();
            
            if (currentUser && !currentUser.isGuest) {
                username = userProfile?.username || currentUser.username || 'Player';
            }
        } catch (error) {
            console.error('Error loading user data for profile:', error);
        }
    }
    
    const isAuthenticated = isUserSignedIn();
    
    return `
        <div class="section-placeholder">
            <div class="section-header">
                <h2>Profile</h2>
                <button class="back-to-daily-btn" onclick="handleBackToDaily()">← Back to Daily Shapes</button>
            </div>
            <div class="placeholder-content">
                <div class="profile-info">
                    <div class="profile-avatar">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="#333">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                        </svg>
                    </div>
                    <h3>${username}</h3>
                    <p class="profile-status">${isAuthenticated ? 'Signed In' : 'Guest User'}</p>
                </div>
                
                ${isAuthenticated && userStats ? `
                    <div class="profile-stats">
                        <h4>Game Statistics</h4>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-number">${userStats.totalDaysPlayed}</div>
                                <div class="stat-label">Days Played</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${userStats.currentStreak}</div>
                                <div class="stat-label">Current Streak</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${userStats.bestStreak}</div>
                                <div class="stat-label">Best Streak</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${Math.round(userStats.averageScore || 0)}</div>
                                <div class="stat-label">Average Score</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${isAuthenticated && competitions.length > 0 ? `
                    <div class="profile-competitions">
                        <h4>My Competitions (${competitions.length})</h4>
                        <div class="competitions-list">
                            ${competitions.slice(0, 3).map(comp => `
                                <div class="competition-item">
                                    <div class="comp-name">${comp.name.toUpperCase()}</div>
                                    <div class="comp-status status-${comp.status}">${comp.status}</div>
                                </div>
                            `).join('')}
                            ${competitions.length > 3 ? `<div class="competition-item more">+${competitions.length - 3} more competitions</div>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <div class="profile-sections">
                    <div class="profile-section">
                        <h4>Account Settings</h4>
                        <div class="settings-list">
                            ${isAuthenticated ? `
                                <div class="setting-item" onclick="changeUsername()">Change Username</div>
                                <div class="setting-item" onclick="changePassword()">Change Password</div>
                                <div class="setting-item" onclick="togglePrivacy()">Privacy Settings</div>
                                <div class="setting-item" onclick="manageNotifications()">Notifications</div>
                            ` : `
                                <div class="setting-item disabled">Sign in to access settings</div>
                            `}
                        </div>
                    </div>
                    
                    <div class="profile-section">
                        <h4>Competition Stats</h4>
                        ${isAuthenticated && userStats ? `
                            <div class="competition-stats">
                                <p>Competitions Created: <strong>${userStats.competitionsCreated || 0}</strong></p>
                                <p>Competitions Joined: <strong>${userStats.competitionsJoined || 0}</strong></p>
                                <p>Competitions Won: <strong>${userStats.competitionsWon || 0}</strong></p>
                                ${userStats.globalRanking ? `<p>Global Ranking: <strong>#${userStats.globalRanking}</strong></p>` : ''}
                            </div>
                        ` : `
                            <p class="no-data">Sign in to view competition statistics</p>
                        `}
                    </div>
                </div>
                
                ${!isAuthenticated ? `
                    <div class="profile-actions">
                        <button onclick="openAuthModal(); switchAuthMode('signup')" class="primary-btn">Create Account</button>
                        <button onclick="openAuthModal(); switchAuthMode('login')" class="secondary-btn">Sign In</button>
                    </div>
                ` : `
                    <div class="profile-actions">
                        <button onclick="refreshProfile()" class="secondary-btn">Refresh Data</button>
                        <button onclick="handleLogout()" class="danger-btn">Sign Out</button>
                    </div>
                `}
                
                ${!isAuthenticated ? `
                    <div class="coming-soon">
                        <p>📊 Sign in to view your detailed statistics and manage competitions</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function generateCalendarPlaceholder() {
    const days = Array.from({length: 30}, (_, i) => i + 1);
    return days.map(day => `
        <div class="calendar-day ${Math.random() > 0.7 ? 'solved' : ''}">
            <span class="day-number">${day}</span>
            ${Math.random() > 0.7 ? '<span class="solved-indicator">✓</span>' : ''}
        </div>
    `).join('');
}

async function handleBackToDaily() {
    await switchToSection('daily');
    
    // Collapse menu if expanded
    const menuOptions = document.getElementById('menuOptions');
    if (menuOptions && menuOptions.classList.contains('expanded')) {
        collapseMenu();
    }
}

// Button click handlers
async function handleOption1Click() {
    console.log('Account selected');
    collapseMenu(); // Close dropdown after selection
    
    // Check if user is logged in using multiple methods
    let isLoggedIn = false;
    
    // Method 1: Check Supabase session directly
    if (window.supabase && window.supabase.auth) {
        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (session && session.user) {
                isLoggedIn = true;
                console.log('✅ User logged in (Supabase session):', session.user.email);
            }
        } catch (err) {
            console.log('⚠️ Could not check Supabase session:', err);
        }
    }
    
    // Method 2: Check localStorage as fallback
    if (!isLoggedIn) {
        const supabaseToken = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
        if (supabaseToken) {
            try {
                const tokenData = JSON.parse(supabaseToken);
                if (tokenData?.currentSession?.user) {
                    isLoggedIn = true;
                    console.log('✅ User logged in (localStorage):', tokenData.currentSession.user.email);
                }
            } catch (err) {
                console.log('⚠️ Could not parse localStorage token');
            }
        }
    }
    
    // Method 3: Check AuthService
    if (!isLoggedIn && window.AuthService && !window.AuthService.isGuest) {
        isLoggedIn = true;
        console.log('✅ User logged in (AuthService)');
    }
    
    console.log('🔍 Final login status:', isLoggedIn);
    
    if (isLoggedIn) {
        // User is logged in - refresh data before showing account popup
        console.log('🔄 Refreshing user stats before showing profile...');

        // Refresh user data to ensure stats are up to date
        if (window.UserAccountManager) {
            try {
                await window.UserAccountManager.refresh();
                console.log('✅ User stats refreshed successfully');
            } catch (error) {
                console.error('⚠️ Error refreshing user stats:', error);
                // Continue anyway to show the popup
            }
        }

        console.log('📋 Creating profile popup inline...');

        try {
            // Remove existing popup if any
            const existingPopup = document.getElementById('userProfilePopup');
            if (existingPopup) {
                existingPopup.remove();
            }
            
            // Create new popup
            const popup = document.createElement('div');
            popup.id = 'userProfilePopup';
            popup.className = 'profile-popup-overlay';
            popup.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); justify-content: center; align-items: center; z-index: 2000;';
            
            // Get user data
            let userEmail = 'User';
            let userName = 'User';
            
            // Try to get from AuthService first
            if (window.AuthService && window.AuthService.currentUser) {
                userEmail = window.AuthService.currentUser.email || 'User';
                userName = window.AuthService.currentUser.username || userEmail.split('@')[0];
                console.log('📋 Got user from AuthService:', userEmail, 'username:', userName);
            } else {
                // Fallback to localStorage
                const userData = JSON.parse(localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token') || '{}');
                if (userData?.currentSession?.user) {
                    userEmail = userData.currentSession.user.email || 'User';
                    userName = userData.currentSession.user.user_metadata?.username || userEmail.split('@')[0];
                }
            }
            
            // Get statistics from UserAccountManager
            let stats = {
                gamesPlayed: 0,
                perfectCuts: 0,
                averageScore: 0,
                currentStreak: 0
            };
            
            try {
                if (window.UserAccountManager) {
                    await window.UserAccountManager.initialize();
                    const userStats = window.UserAccountManager.getUserStats();
                    const userProfile = window.UserAccountManager.getUserProfile();
                    
                    // Get username from profile if available
                    if (userProfile && userProfile.username) {
                        userName = userProfile.username;
                        console.log('📋 Updated username from UserAccountManager profile:', userName);
                    }
                    
                    if (userStats) {
                        console.log('📊 User Profile Debug - Raw stats from UserAccountManager:', userStats);
                        // Try to get perfect cuts from AuthService if available
                        let perfectCuts = 0;
                        if (window.AuthService && typeof window.AuthService.getPerfectCutsCount === 'function') {
                            perfectCuts = await window.AuthService.getPerfectCutsCount();
                        } else {
                            // Fallback: Use a reasonable estimate or stored value
                            perfectCuts = userStats.competitionsWon || 0;
                        }
                        
                        stats = {
                            perfectCuts: (userStats.perfectCuts ?? 0),
                            competitionsWon: (userStats.competitionsWon !== undefined && userStats.competitionsWon !== null && userStats.competitionsWon !== 'undefined') ? userStats.competitionsWon : 0,
                            averageScore: Math.round(userStats.averageScore || 0), // Whole number, no decimals
                            currentStreak: (userStats.currentStreak ?? 0)
                        };
                    }
                }
            } catch (error) {
                console.error('Error loading user statistics:', error);
            }
            
            popup.innerHTML = `
                <div class="profile-popup-content" style="background: white; padding: 30px; border-radius: 12px; border: 2px solid black; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2); text-align: center; max-width: 450px; width: 90%; position: relative;">
                    <button onclick="document.getElementById('userProfilePopup').remove()" style="position: absolute !important; top: 10px !important; right: 10px !important; width: 28px !important; height: 28px !important; min-width: 28px !important; min-height: 28px !important; max-width: 28px !important; max-height: 28px !important; border-radius: 50% !important; background: white !important; border: 2px solid #000 !important; font-size: 14px !important; cursor: pointer !important; color: #333 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; margin: 0 !important; line-height: 1 !important; font-weight: bold !important; box-sizing: border-box !important;">×</button>
                    <h3 style="margin: 0 0 25px 0; font-size: 28px; font-weight: 700;">${userName}</h3>

                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 25px; border: 1px solid #e0e0e0;">
                        <h4 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Statistics</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">PERFECT CUTS</div>
                                <div style="font-size: 20px; font-weight: 700;">${stats.perfectCuts}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">COMPS WON</div>
                                <div style="font-size: 20px; font-weight: 700;">${stats.competitionsWon || 0}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">AVERAGE SCORE</div>
                                <div style="font-size: 20px; font-weight: 700;">${stats.averageScore || 0}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #666; margin-bottom: 5px;">DAILY STREAK</div>
                                <div style="font-size: 20px; font-weight: 700;">${stats.currentStreak} 🔥</div>
                                <div style="font-size: 10px; color: #888; margin-top: 2px;">consecutive days</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button onclick="window.showChangePasswordModal()" style="padding: 12px 24px; border: 2px solid #666; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; background: white; color: #333;">Change Password</button>
                        <button onclick="window.handleLogoutClick()" style="padding: 12px 24px; border: 2px solid black; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; background: #FF6B6B; color: white;">Log Out</button>
                    </div>
                </div>
            `;
            
            // Add to body
            document.body.appendChild(popup);
            
            // Close on overlay click
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    popup.remove();
                }
            });
            
            console.log('✅ Profile popup displayed successfully');
            
        } catch (error) {
            console.error('❌ Error creating profile popup:', error);
            alert('Error showing profile menu. Please try again.');
        }
    } else {
        // User is not logged in - show auth modal popup
        showAuthenticationPopup();
    }
}

async function handleOption2Click() {
    console.log('handleOption2Click triggered - Today\'s Shapes button pressed');
    collapseMenu();

    // CRITICAL: Complete state reset to ensure clean separation between modes
    if (window.isPracticeMode) {
        console.log('🔄 Exiting practice mode - performing complete state reset...');

        // Clear ALL practice mode flags and state
        window.isPracticeMode = false;
        window.isDailyMode = true;

        // Clear practice mode manager state if it exists
        if (window.PracticeMode) {
            window.PracticeMode.isActive = false;
            window.PracticeMode.practiceShapes = [];
        }

        // Clear the old practice mode state
        if (window.practiceMode) {
            window.practiceMode.isActive = false;
            window.practiceMode.availableShapes = [];
            window.practiceMode.currentShapePath = null;
        }

        // Clear any practice-related localStorage
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.includes('practice') || key.includes('Practice')) {
                    localStorage.removeItem(key);
                    console.log(`🗑️ Cleared practice storage: ${key}`);
                }
            });
        } catch (e) {
            console.log('⚠️ Could not clear practice storage:', e);
        }

        // After clearing practice mode, reload to restore daily mode state
        console.log('🔄 Reloading page to restore daily mode state after practice exit...');
        window.location.reload();
    } else {
        // Already in daily mode - just refresh the page to restore current state
        // This acts like pressing browser refresh button
        console.log('🔄 Refreshing page to restore current daily mode state...');
        window.location.reload();
    }
}

async function handleOption3Click() {
    console.log('Competitions selected');
    collapseMenu(); // Close dropdown after selection
    
    // Check if user is logged in using multiple methods
    let isLoggedIn = false;
    
    // Check AuthService first
    if (window.AuthService && !window.AuthService.isGuest) {
        isLoggedIn = true;
    } else {
        // Fallback to localStorage check
        const supabaseToken = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
        if (supabaseToken) {
            isLoggedIn = true;
        }
    }
    
    if (!isLoggedIn) {
        console.log('🔒 User not logged in - showing authentication popup');
        // Set pending action so we return to competitions after auth
        localStorage.setItem('pendingUserAction', 'competitions');
        showAuthenticationPopup();
        return;
    }
    
    // Open competitions modal
    openCompetitionModal();
}

async function handleOption4Click() {
    console.log('Practice selected');
    collapseMenu(); // Close dropdown after selection
    
    // Enter practice mode with proper state management
    await enterPracticeMode();
}

async function enterPracticeMode() {
    console.log('🎮 Entering practice mode...');
    
    // Check authentication
    const supabaseToken = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
    if (!supabaseToken) {
        // Store user's original intent
        localStorage.setItem('pendingUserAction', 'practice');
        // Use consistent auth popup (same as account/competition)
        showAuthenticationPopup();
        return;
    }
    
    // Use the existing PracticeMode instance
    if (!window.PracticeMode) {
        console.error('❌ PracticeMode instance not available');
        return;
    }

    // Open practice mode using the existing instance
    await window.PracticeMode.open();
    
    console.log('✅ Practice mode entered');
}

// Make function available globally for auth success flow
window.enterPracticeMode = enterPracticeMode;

function showSimplePracticeNavigation() {
    // Show practice mode indicator
    document.getElementById('practiceModeIndicator').style.display = 'block';

    // Show practice navigation
    document.getElementById('practiceNavigation').style.display = 'flex';

    // Desktop full-screen mode: Move practice elements down by 50px
    if (window.innerWidth >= 769) {
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        const buttonsContainer = document.getElementById('buttonsContainer');

        if (fixedPercentageArea) {
            fixedPercentageArea.style.setProperty('margin-top', '55px', 'important');
            fixedPercentageArea.style.setProperty('position', 'relative', 'important');
        }

        if (buttonsContainer) {
            buttonsContainer.style.setProperty('margin-top', '50px', 'important');
            buttonsContainer.style.setProperty('margin-bottom', '0', 'important');
            buttonsContainer.style.setProperty('position', 'relative', 'important');
        }

        console.log('✅ Desktop: Moved practice mode elements down by 50px');
    }
}

// OLD PRACTICE FUNCTION REMOVED - Now using practice-mode.js class system

function showPracticeResults(leftPercentage, rightPercentage) {
    // Use existing scoring system
    const score = window.ScoringSystem.calculateCutScore(leftPercentage);

    // Format score: show "100/100" for perfect scores, "XX.X/100" for others
    const formattedScore = score === 100 ? '100' : score.toFixed(1);

    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Adjust score margin based on device size
    const isSpecificMobile = (window.innerWidth === 430 && window.innerHeight === 805) ||
                             (window.innerWidth === 390 && window.innerHeight === 715) ||
                             (window.innerWidth === 412 && window.innerHeight === 785) ||
                             (window.innerWidth === 360 && window.innerHeight === 630);
    const scoreMarginTop = isSpecificMobile ? '3px' : '-17px';
    console.log('📊 showPracticeResults called - Device:', window.innerWidth, 'x', window.innerHeight, 'isSpecificMobile:', isSpecificMobile, 'scoreMarginTop:', scoreMarginTop);

    // Display results matching daily game style - single line, center aligned
    // Practice mode: dark grey color, NO SCORE display (only split display)
    const percentageArea = document.getElementById('fixedPercentageArea');
    percentageArea.innerHTML = `
        <div style="text-align: center; margin: 16px 0; line-height: 1.5;">
            <div class="split-display-large" style="display: inline-block; white-space: nowrap;">
                <span style="color: #666666; font-weight: bold; font-size: ${splitFontSize}px;">${leftPercentage.toFixed(1)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px;">${rightPercentage.toFixed(1)}%</span>
            </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="returnToDailyGame()" style="
                background: #f0f0f0;
                border: 1px solid #ccc;
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 10px;
                color: #666;
                cursor: pointer;
                transition: background 0.2s;
                display: inline-block;
            " onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f0f0f0'">
                Return to Game
            </button>
        </div>
    `;
    
    // Deactivate canvas until reset
    canvas.style.pointerEvents = 'none';
    
    console.log('✅ Practice cut completed - score:', score);
}

function handlePracticeCutComplete(areaResults, preservedVector = null) {

    // CRITICAL: Validate that the cut actually divided the shape (not 0/100 or 100/0)
    const leftRounded = Math.round(areaResults.leftPercentage);
    const rightRounded = Math.round(areaResults.rightPercentage);

    if ((leftRounded === 0 && rightRounded === 100) || (leftRounded === 100 && rightRounded === 0)) {
        console.log('🚫 INVALID PRACTICE CUT: Cut resulted in 0/100 split - treating as miss');

        // Re-enable canvas for next attempt
        if (window.practiceMode && typeof window.practiceMode.enableCanvasInteraction === 'function') {
            window.practiceMode.enableCanvasInteraction();
        }

        // Show "Try again" message
        handleMiss();
        return;
    }

    // Use the preserved vector if currentVector was cleared
    // CRITICAL: Ensure we have the extended vector for proper rendering
    const vectorForRendering = preservedVector || window.currentVector || currentVector;

    // Use practice mode's own rendering if available
    console.log('🔍 Practice mode check:', {
        PracticeMode: !!window.PracticeMode,
        PracticeModeDisplayResults: !!(window.PracticeMode && window.PracticeMode.displayResults),
        SimplePracticeMode: !!window.SimplePracticeMode,
        SimplePracticeModeActive: !!(window.SimplePracticeMode && window.SimplePracticeMode.isActive),
        practiceMode: !!window.practiceMode
    });
    
    if (window.PracticeMode && window.PracticeMode.displayResults) {
        console.log('📍 Taking PracticeMode.displayResults path');
        window.PracticeMode.displayResults(areaResults);
    } else {
        // Check if we have a shape-based mechanic that should handle its own rendering
        // BUT force vector-based rendering in practice mode to ensure shading works
        const isPracticeModeActive = (window.SimplePracticeMode && window.SimplePracticeMode.isActive) || 
                                   (window.practiceMode);
        
        if (currentMechanic && currentMechanic.renderCutResult && (window.currentCircle || window.currentCircleData) && !isPracticeModeActive) {
            console.log('🎨 Taking shape-based mechanic rendering path');
            const circleData = window.currentCircleData || window.currentCircle;
            currentMechanic.renderCutResult(areaResults, circleData);
        } else if (vectorForRendering) {
            console.log('📍 Taking vector-based rendering path');
            // Ensure vector is available for rendering
            currentVector = vectorForRendering;
            if (isPracticeModeActive) {
                console.log('🎯 Practice mode: Forcing vector-based rendering for shading support');
            }
            // CRITICAL: Clear canceled line drawing flag just before rendering to ensure visual shading works
            if (window.canceledLineDrawing) {
                console.log('🔧 Practice mode: Clearing canceledLineDrawing flag just before rendering to fix shading');
                window.canceledLineDrawing = false;
            }
            
            // Fallback to main game rendering
            renderVectorCutResult(areaResults);
        }
    }
    
    // Show practice results
    showPracticeResults(areaResults.leftPercentage, areaResults.rightPercentage);
}

function resetPracticeShape() {
    // Clear results display
    document.getElementById('fixedPercentageArea').innerHTML = '';
    
    // CRITICAL: Clear vectors and reset mechanic state
    currentVector = null;
    window.currentVector = null;
    globalThis.currentVector = null;
    
    // Reset mechanic if present
    if (currentMechanic && currentMechanic.reset) {
        currentMechanic.reset();
        console.log('🔧 Practice mode: Reset mechanic for new attempt');
    }
    
    // Re-enable interaction
    setInteractionEnabled(true);
    setGameState('cutting');
    canvas.style.pointerEvents = 'auto';
    
    // Reset cut counters for unlimited practice cutting
    if (window.isPracticeMode) {
        totalCutsMade = 0;
        cutsMadeThisShape = 0;
        attemptCount = 0;
        console.log('🔄 Practice mode: Reset cut counters for unlimited cutting');
    }
    
    // Reload current shape
    const currentShapePath = practiceShapes[currentPracticeShapeIndex];
    loadSimplePracticeShape(currentShapePath);
    
    // Force enable interaction for practice mode only
    if (window.isPracticeMode) {
        isShapeAnimationComplete = true; // Override animation flag for practice
        setInteractionEnabled(true);
        setGameState('cutting');
        canvas.style.pointerEvents = 'auto';
        console.log('✅ Practice mode: Canvas interaction re-enabled after reset');
    }
    
    console.log('✅ Practice shape reset');
}

// Comprehensive UI cleanup function to prevent conflicts between modes
function hideInitialWelcomeButtons() {
    const playBtn = document.getElementById('playBtn');
    const practiceBtn = document.getElementById('practiceBtn');
    const buttonsContainer = document.querySelector('.buttons-below-canvas');
    
    if (playBtn) {
        playBtn.style.display = 'none';
    }
    if (practiceBtn) {
        practiceBtn.style.display = 'none';
    }
    if (buttonsContainer) {
        buttonsContainer.style.display = 'none';
    }
    console.log('🧹 Initial welcome buttons hidden to prevent UI conflicts');
}

function returnToDailyGame() {
    console.log('🔄 Returning to daily game...');

    // Ensure initial buttons don't interfere with daily game
    hideInitialWelcomeButtons();

    // Reset practice mode flag and re-enable daily mode
    isPracticeMode = false;
    window.isPracticeMode = false; // Reset global for mechanics to access
    isDailyMode = true;

    // Hide practice UI elements
    const practiceNav = document.getElementById('practiceNavigation');
    const practiceIndicator = document.getElementById('practiceModeIndicator');
    if (practiceNav) practiceNav.style.display = 'none';
    if (practiceIndicator) practiceIndicator.style.display = 'none';

    // Clear practice results display
    const percentageArea = document.getElementById('fixedPercentageArea');
    if (percentageArea) percentageArea.innerHTML = '';

    // CRITICAL FIX: Clear the canvas before restoring to prevent shading persistence
    if (window.ctx && window.canvas) {
        window.ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('🧹 Cleared canvas before restoring daily game state');
    }

    // Restore daily game state using SimpleRefresh system
    if (window.SimpleRefresh && window.SimpleRefresh.restore) {
        console.log('💾 Restoring daily game state from saved data...');
        const restoredState = window.SimpleRefresh.restore();

        if (restoredState) {
            console.log('✅ Daily game state restored successfully');

            // CRITICAL: Restore the canvas visual state including cut shading
            if (restoredState.canvasData) {
                console.log('🎨 Restoring canvas with cut shading...');
                restoreVisualState(restoredState);
            }

            // Show instruction area since game is in progress
            if (restoredState.isGameStarted) {
                showInstructionArea();
                console.log('📝 Instruction area restored for active game');
            }

            // Restore percentage displays if they exist
            if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
                const lastAttempt = restoredState.currentAttempts[restoredState.currentAttempts.length - 1];
                if (lastAttempt.leftPercentage !== undefined && lastAttempt.rightPercentage !== undefined) {
                    updatePercentageDisplays(lastAttempt.leftPercentage, lastAttempt.rightPercentage);
                }
            }
        } else {
            console.log('ℹ️ No saved state found - returning to initial game state');
            // Reset to initial state if no saved state exists
            setGameState('initial');
            setInteractionEnabled(false);
        }
    } else {
        console.log('⚠️ SimpleRefresh not available - resetting to initial state');
        setGameState('initial');
        setInteractionEnabled(false);
    }

    // CRITICAL: Check if we should restore completion view after returning from practice mode
    // This ensures that if the user entered practice mode from the completion state,
    // the competitions/archives buttons are restored when they return
    setTimeout(() => {
        if (window.dailyGameState && (window.dailyGameState.dayComplete || window.dailyGameState.isGameComplete)) {
            console.log('🏆 Daily game was completed - restoring completion view after practice mode');
            if (window.completeView && window.showCompletionView) {
                window.showCompletionView();
            } else if (window.completeView) {
                // Build and show completion model
                const currentDayStats = getDayStats(currentDay);
                if (currentDayStats && window.buildCompletionModel) {
                    const completionModel = window.buildCompletionModel(currentDayStats);
                    window.completeView.show(completionModel);
                    console.log('✅ Completion view restored after practice mode exit');
                }
            }
        }
    }, 200); // Small delay to ensure daily mode is fully restored

    console.log('✅ Successfully returned to daily game');
}

async function handleDailyClick() {
    await switchToSection('daily');
}

async function handleProfileClick() {
    if (!isUserSignedIn()) {
        showAuthenticationPopup();
        return;
    }
    await switchToSection('profile');
}

// Profile management functions
async function refreshProfile() {
    if (window.UserAccountManager) {
        try {
            await window.UserAccountManager.refresh();
            // Refresh the profile section if currently viewing it
            if (currentSection === 'profile') {
                await switchToSection('profile');
            }
            showAuthSuccess('Profile data refreshed');
        } catch (error) {
            console.error('Profile refresh error:', error);
            showAuthError('Failed to refresh profile data');
        }
    }
}

async function changeUsername() {
    const newUsername = prompt('Enter new username (3-20 characters, letters, numbers, and underscores only):');
    if (!newUsername) return;
    
    if (window.UserAccountManager) {
        try {
            const result = await window.UserAccountManager.changeUsername(newUsername);
            if (result.success) {
                showAuthSuccess(result.message);
                await refreshProfile();
            } else {
                showAuthError(result.error);
            }
        } catch (error) {
            console.error('Username change error:', error);
            showAuthError('Failed to change username');
        }
    }
}

function changePassword() {
    showAuthError('Password changes must be done through the account settings. This feature will be available soon.');
}

function togglePrivacy() {
    showAuthError('Privacy settings will be available soon.');
}

function manageNotifications() {
    showAuthError('Notification settings will be available soon.');
}

function updateShapeProgress() {
    // Show play button on initial load
    if (gameState === 'initial') {
        showPlayButton();
        // Ensure the play button is enabled
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.disabled = false;
            playBtn.classList.remove('disabled');
        }
    }
}

function isLoading() {
    // Check if loading popup is currently visible
    const loadingPopup = document.getElementById('loadingPopup');
    return loadingPopup && loadingPopup.classList.contains('visible');
}

function setupOrientationDetection() {
    // CRITICAL: Initialize modal flag to prevent undefined checks
    if (typeof window.isModalOpenForOrientationCheck === 'undefined') {
        window.isModalOpenForOrientationCheck = false;
    }

    // Track initial viewport height to detect keyboard
    let initialViewportHeight = window.innerHeight;
    let orientationCheckDebounce = null;

    function checkOrientation() {
        console.log(`🔍 checkOrientation() called - modalFlag: ${window.isModalOpenForOrientationCheck}`);

        const orientationMessage = document.getElementById('orientationMessage');
        const gameContainer = document.querySelector('.app-container');

        // CRITICAL: Skip ALL checks if any modal is open (prevents keyboard issues)
        if (window.isModalOpenForOrientationCheck === true) {
            console.log('🚫 Orientation check skipped - modal is open');
            return;
        }

        // Check if an input/textarea has focus (keyboard is likely open)
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable ||
            activeElement.type === 'text' ||
            activeElement.type === 'password' ||
            activeElement.type === 'email'
        )) {
            console.log('⌨️ Orientation check skipped - input field has focus');
            return;
        }

        // Detect keyboard appearance - if viewport shrank significantly, keyboard is likely open
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        const likelyKeyboardOpen = heightDifference > 100; // More sensitive threshold

        // Debug logging
        if (heightDifference > 50) {
            console.log(`📐 Height change detected: ${heightDifference}px (keyboard: ${likelyKeyboardOpen})`);
        }

        // Skip check if keyboard is likely open
        if (likelyKeyboardOpen) {
            console.log('⌨️ Orientation check skipped - keyboard likely open');
            return;
        }

        // Helper function to check if element is truly visible
        const isElementVisible = (element) => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   element.offsetParent !== null;
        };

        // Check if any auth/modal is open (these have forms that trigger keyboard)
        const authModal = document.getElementById('authModal');
        const changePasswordModal = document.getElementById('changePasswordModal');
        const userStatsModal = document.getElementById('userStatsModal');

        const isAnyModalOpen = isElementVisible(authModal) ||
                               isElementVisible(changePasswordModal) ||
                               isElementVisible(userStatsModal);

        // Skip orientation check if any modal is open
        if (isAnyModalOpen) {
            console.log('🚫 Orientation check skipped - modal is visible');
            return;
        }

        // Use screen.orientation API when available for more reliable detection
        let isLandscape;
        if (screen.orientation && screen.orientation.type) {
            isLandscape = screen.orientation.type.includes('landscape');
        } else {
            // Fallback to screen dimensions (not window) to avoid keyboard-induced changes
            const useScreenDimensions = window.screen && window.screen.width && window.screen.height;
            if (useScreenDimensions) {
                isLandscape = window.screen.width > window.screen.height;
            } else {
                // Last resort: use window dimensions with strict threshold
                isLandscape = window.innerWidth > window.innerHeight && window.innerWidth > 768;
            }
        }

        const isSmallHeight = window.innerHeight < 500;
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Check if device is in landscape mode and height is small (mobile)
        if (isLandscape && isSmallHeight && isMobile) {
            orientationMessage.style.display = 'flex';
            gameContainer.style.display = 'none';
        } else {
            orientationMessage.style.display = 'none';
            gameContainer.style.display = 'flex';
        }
    }

    // Check on load and orientation change
    checkOrientation();

    // Debounced resize handler
    window.addEventListener('resize', () => {
        clearTimeout(orientationCheckDebounce);
        orientationCheckDebounce = setTimeout(() => {
            checkOrientation();
        }, 200);
    });

    window.addEventListener('orientationchange', () => {
        // Reset baseline height on actual orientation change
        setTimeout(() => {
            initialViewportHeight = window.innerHeight;
            checkOrientation();
        }, 100);
    });
}

function setupEventListeners() {
    try {
        console.log('🔧 Setting up event listeners...');
        
        // Game controls
        const playBtn = document.getElementById('playBtn');
        if (!playBtn) {
            throw new Error('Play button not found');
        }
        // Skip adding duplicate event listener if already added
        if (!playBtn.hasAttribute('data-listener-added')) {
            playBtn.addEventListener('click', function(e) {
                console.log('🔘 Play button clicked!', e);
                console.log('Button disabled?', playBtn.disabled);
                console.log('Button classes:', playBtn.className);
                // Call the demo version of handlePlayButtonClick
                handlePlayButtonClick(e);
            });

            // Add debugging to detect what's blocking button clicks
            playBtn.addEventListener('mousedown', function(e) {
                console.log('🟢 Play button MOUSEDOWN detected!', e);
            });

            // Add test for immediate area around button
            playBtn.addEventListener('touchstart', function(e) {
                console.log('🟢 Play button TOUCHSTART detected!', e);
            });
            playBtn.setAttribute('data-listener-added', 'true');
        }
        console.log('✅ Play button event listener attached');
        console.log('Play button element:', playBtn);
        console.log('Play button initial disabled state:', playBtn.disabled);
        
        // Practice button event listener
        const practiceBtn = document.getElementById('practiceBtn');
        if (practiceBtn) {
            practiceBtn.addEventListener('click', function(e) {
                // Use same logic as practice menu option
                enterPracticeMode();
            });
            console.log('✅ Practice button event listener attached');
            console.log('Practice button element:', practiceBtn);
        }
        
        // Setup replay navigation (will be activated later)
        setupReplayNavigation();
        
        

        // Demo canvas setup
        console.log('✅ Demo canvas initialized');
        
        // Header share button
        const headerShareBtn = document.getElementById('shareBtn');
        
        if (headerShareBtn) {
            headerShareBtn.addEventListener('click', handleShare);
        }
        
        // Trophy button
        const trophyBtn = document.getElementById('trophyBtn');
        const trophyPopup = document.getElementById('trophyPopup');
        const trophyPopupClose = document.getElementById('trophyPopupClose');
        
        if (trophyBtn && trophyPopup) {
            // Function to show popup
            function showTrophyPopup() {
                trophyPopup.classList.add('show');
            }
            
            // Function to hide popup
            function hideTrophyPopup() {
                trophyPopup.classList.remove('show');
            }
            
            // Make hideTrophyPopup globally accessible for button handlers
            window.hideTrophyPopup = hideTrophyPopup;
            
            // Trophy button click handler
            trophyBtn.addEventListener('click', function() {
                showTrophyPopup();
                
                // Auto-hide after 5 seconds
                setTimeout(() => {
                    hideTrophyPopup();
                }, 5000);
            });
            
            // Close button handler
            if (trophyPopupClose) {
                trophyPopupClose.addEventListener('click', function() {
                    hideTrophyPopup();
                });
            }
            
            // Click outside popup to close
            trophyPopup.addEventListener('click', function(e) {
                if (e.target === trophyPopup) {
                    hideTrophyPopup();
                }
            });
            
            // Check if we should auto-show the popup
            const hasSeenTrophyPopup = localStorage.getItem('hasSeenTrophyPopup');
            if (!hasSeenTrophyPopup) {
                // Auto-show popup after a short delay
                setTimeout(() => {
                    showTrophyPopup();
                    localStorage.setItem('hasSeenTrophyPopup', 'true');
                    
                    // Hide popup after 5 seconds
                    setTimeout(() => {
                        hideTrophyPopup();
                    }, 5000);
                }, 500);
            }
        }
        
        // Instructions popup already handled above with help button listeners
        
        // Navigation button event listeners
        console.log('🔧 Setting up navigation button listeners...');
        
        const option1Btn = document.getElementById('option1Btn');
        const option2Btn = document.getElementById('option2Btn');
        const option3Btn = document.getElementById('option3Btn');
        const animatedMenuButton = document.getElementById('animatedMenuButton');
        
        if (option1Btn) {
            option1Btn.addEventListener('click', handleOption1Click);
            console.log('✅ Account button listener attached');
        }
        
        // REMOVED: Today's Shapes button listener - handled by animated menu system to prevent double loading
        // if (option2Btn) {
        //     option2Btn.addEventListener('click', handleOption2Click);
        //     console.log('✅ Today\'s Shapes button listener attached');
        // }
        
        if (option3Btn) {
            option3Btn.addEventListener('click', handleOption3Click);
            console.log('✅ Competitions button listener attached');
        }
        
        const option4Btn = document.getElementById('option4Btn');
        if (option4Btn) {
            option4Btn.addEventListener('click', handleOption4Click);
            console.log('✅ Practice button listener attached');
        }
        
        // Menu toggle functionality handled by initializeAnimatedMenu() - removed duplicate handler
        
        // Initialize button states
        updateButtonStates();

        // Make navigation functions globally accessible
        window.handleOption1Click = handleOption1Click;
        window.handleOption2Click = handleOption2Click;
        window.handleOption3Click = handleOption3Click;
        window.handleOption4Click = handleOption4Click;
        window.handleDailyClick = handleDailyClick;
        window.handleProfileClick = handleProfileClick;
        
        // Alias functions for complete-view.js compatibility
        window.openCompetitionsPopup = openCompetitionModal;
        
        
        // Vector cutting event listeners (preserve existing functionality)
        console.log('🖱️ Setting up vector cutting event listeners...');
        setupVectorEventListeners();
        
        console.log('✅ All event listeners set up successfully');

        // Add global click debugging to see what's being clicked
        document.addEventListener('click', function(e) {
            console.log('🌍 GLOBAL CLICK detected on:', e.target.tagName, e.target.id, e.target.className);
            if (e.target.id === 'playBtn' || e.target.id === 'practiceBtn') {
                console.log('🎯 BUTTON CLICK detected:', e.target.id);
            }
        });

        document.addEventListener('touchstart', function(e) {
            console.log('🌍 GLOBAL TOUCHSTART detected on:', e.target.tagName, e.target.id, e.target.className);

            // Close menu dropdown if touching canvas
            if (e.target && e.target.id === 'geoCanvas' && window.menuState && window.menuState.isExpanded) {
                console.log('🔵 Global touchstart on canvas - closing menu dropdown');
                window.collapseMenu();
            }
        });
        
        // Add document click handler to close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            const menuDropdown = document.getElementById('menuDropdown');
            const animatedMenuButton = document.getElementById('animatedMenuButton');
            
            // Check if click is outside both the dropdown and menu button
            if (menuDropdown && animatedMenuButton && 
                !menuDropdown.contains(e.target) && 
                !animatedMenuButton.contains(e.target) &&
                menuState.isExpanded) {
                collapseMenu();
            }
        });
        
    } catch (error) {
        console.error('💥 Failed to setup event listeners:', error);
        if (window.debugLogger) {
            debugLogger.error('Event listener setup failed', error);
        }
        throw error;
    }
}

function setupVectorEventListeners() {
    try {
        if (!canvas) {
            throw new Error('Canvas not available for event listeners');
        }
        
        // Mouse events
        canvas.addEventListener('mousedown', handleVectorStart);
        canvas.addEventListener('mousemove', handleVectorDrag);
        canvas.addEventListener('mouseup', handleVectorEnd);
        
        // DEBUG: Add simple test event listener
        canvas.addEventListener('click', function(e) {
            console.log('🔍 DEBUG: Canvas clicked!', {
                x: e.clientX,
                y: e.clientY,
                target: e.target,
                canvasStyle: canvas.style.pointerEvents,
                practiceMode: practiceMode.isActive,
                isInteractionEnabled: isInteractionEnabled
            });

            // Close menu dropdown if it's open
            if (window.menuState && window.menuState.isExpanded) {
                console.log('🔵 Canvas clicked - closing menu dropdown');
                window.collapseMenu();
            }
        });
        
        // Additional debug for mousedown events
        canvas.addEventListener('mousedown', function(e) {
            console.log('🔍 DEBUG: Canvas mousedown detected before handleVectorStart!', {
                practiceMode: practiceMode.isActive,
                isInteractionEnabled: isInteractionEnabled,
                pointerEvents: canvas.style.pointerEvents
            });
        });
        
        console.log('✅ Mouse event listeners attached to canvas');
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', handleVectorStart);
        canvas.addEventListener('touchmove', handleVectorDrag);
        canvas.addEventListener('touchend', handleVectorEnd);
        console.log('✅ Touch event listeners attached to canvas');
        
        // Prevent default touch behavior
        canvas.addEventListener('touchstart', e => e.preventDefault());
        canvas.addEventListener('touchmove', e => e.preventDefault());
        canvas.addEventListener('touchend', e => e.preventDefault());
        console.log('✅ Touch event prevention set up');
        
    } catch (error) {
        console.error('💥 Failed to setup vector event listeners:', error);
        if (window.debugLogger) {
            debugLogger.error('Vector event listener setup failed', error);
        }
        throw error;
    }
}

// Grid rendering function
function redrawCanvas() {
    console.log('🔄 redrawCanvas() called, parsedShapes:', parsedShapes ? `array with ${parsedShapes.length} items` : 'null/undefined');
    console.log('🔧 Current mechanic:', currentMechanic ? currentMechanic.name : 'null');
    console.log('🔧 Current day:', currentDay);
    
    // Only skip redraw for rotating mechanic if we're actually on Sunday and rotation is active
    if (currentDay === 7 && currentMechanic && currentMechanic.name === "Rotating Shape Vector Cut" && currentMechanic.isRotating) {
        console.log('🌀 Sunday rotating mechanic active - skipping redraw, let rotation handle it');
        return;
    }
    
    // Check for practice mode shapes if parsedShapes is empty
    let shapesToRender = parsedShapes;
    if ((!parsedShapes || parsedShapes.length === 0) && window.isPracticeMode) {
        console.log('🎯 Practice mode: Using stored shapes for redraw');
        if (window.practiceMode && window.practiceMode.practiceParsedShapes) {
            shapesToRender = window.practiceMode.practiceParsedShapes;
            console.log('🔄 Found practice mode shapes:', shapesToRender.length);
        } else if (window.PracticeMode && window.PracticeMode.originalShapes) {
            shapesToRender = window.PracticeMode.originalShapes;
            console.log('🔄 Found practice mode shapes (fallback):', shapesToRender.length);
        }
    }

    if (!shapesToRender || shapesToRender.length === 0) {
        console.log('⚠️ No shapes to redraw, only drawing grid');
        drawGrid();
        return;
    }

    console.log('🔄 Redrawing canvas with current shapes');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    renderShapeForCutting(shapesToRender);
}

function drawGrid(context = ctx) {
    context.save();

    // Use logical size (380x380) - context scaling handles DPR
    const logicalSize = 380;

    // Fill canvas with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, logicalSize, logicalSize);

    // Draw black outline
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.strokeRect(0, 0, logicalSize, logicalSize);

    // Only draw grid lines if game has started (not initial state)
    if (gameState !== 'initial') {
        // Grid lines
        context.strokeStyle = '#d0d0d0';
        context.lineWidth = 0.5;

        // Draw 14x14 grid with larger cells
        const gridSize = 14;
        const cellSize = logicalSize / gridSize;

        // Vertical lines
        for (let i = 0; i <= gridSize; i++) {
            const x = i * cellSize;
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, logicalSize);
            context.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            const y = i * cellSize;
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(logicalSize, y);
            context.stroke();
        }
    }

    context.restore();
}

function drawGridLinesOnly(context = ctx) {
    context.save();

    // Use logical size (380x380) - context scaling handles DPR
    const logicalSize = 380;

    // Draw black outline only
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.strokeRect(0, 0, logicalSize, logicalSize);

    // Only draw grid lines if game has started (not initial state)
    if (gameState !== 'initial') {
        // Grid lines - match the exact same grid as drawGrid()
        context.strokeStyle = '#d0d0d0';
        context.lineWidth = 0.5;

        // Draw 14x14 grid with larger cells (same as drawGrid)
        const gridSize = 14;
        const cellSize = logicalSize / gridSize;

        // Vertical lines
        for (let i = 0; i <= gridSize; i++) {
            const x = i * cellSize;
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, logicalSize);
            context.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            const y = i * cellSize;
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(logicalSize, y);
            context.stroke();
        }
    }
    
    context.restore();
}

function drawReferencePoints() {
    // Draw reference points at canvas corners to verify coordinate system
    ctx.save();
    ctx.fillStyle = 'red';
    ctx.font = '12px Arial';
    
    // Top-left (0,0)
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillText('0,0', 12, 12);
    
    // Top-right (380, 0)
    ctx.fillRect(372, 0, 8, 8);
    ctx.fillText(`380,0`, 330, 12);

    // Bottom-left (0, 380)
    ctx.fillRect(0, 372, 8, 8);
    ctx.fillText(`0,380`, 12, 368);

    // Bottom-right (380, 380)
    ctx.fillRect(372, 372, 8, 8);
    ctx.fillText(`380,380`, 300, 368);

    // Center point (190, 190)
    ctx.fillRect(186, 186, 8, 8);
    ctx.fillText(`190,190`, 200, 180);
    
    ctx.restore();
}

// Game flow functions
function handlePlayButtonClickOld() {
    try {
        console.log('🎮 Play button clicked (old handler)');
        
        // Hide trophy popup if open
        if (window.hideTrophyPopup) {
            window.hideTrophyPopup();
        }
        
        // Track game start
        if (window.Analytics) {
            window.Analytics.trackGameStart();
        }
        
        // Capture button state BEFORE hiding it
        const playBtn = document.getElementById('playBtn');
        if (!playBtn) {
            throw new Error('Play button not found');
        }
        
        const buttonText = playBtn.textContent;
        const isDisabled = playBtn.disabled;
        
        console.log(`Button state: "${buttonText}", disabled: ${isDisabled}`);
        
        if (isDisabled) {
            console.log('Button click ignored - button is disabled');
            return;
        }
        
        if (window.debugLogger) {
            debugLogger.log('Play button clicked', { 
                buttonText, 
                gameState
            });
        }
        
        // Hide button immediately when tapped
        hidePlayButton();
        
        // Fade out welcome text
        fadeOutWelcomeText();
        
        // Small gap to let button disappear before any other action
        setTimeout(() => {
            // Handle different button states
            if (buttonText === 'Play') {
                console.log('🚀 Starting new game...');
                startGame();
            } else if (buttonText === 'Play Again') {
                console.log('🔄 Resetting game...');
                resetGame();
            } else if (buttonText === 'Reset') {
                console.log('🔄 Hard reset...');
                handleReset();
            } else {
                console.warn('⚠️ Unknown button state:', buttonText);
            }
            
            // Show CUT popup after play is clicked
            if (buttonText === 'Play') {
                setTimeout(() => {
                    showCutPopup();
                }, 500); // Show after startGame has begun and shape loads
            }
            
        }, 100); // 100ms gap between button disappearing and any other action
        
    } catch (error) {
        console.error('💥 Error in handlePlayButtonClick:', error);
        if (window.debugLogger) {
            debugLogger.error('Play button handler failed', error);
        }
    }
}

function handlePractiseButtonClick() {
    try {
        console.log('🎮 Practise button clicked');
        
        // Hide trophy popup if open
        if (window.hideTrophyPopup) {
            window.hideTrophyPopup();
        }
        
        // Track practice mode start
        if (window.Analytics) {
            window.Analytics.trackPracticeMode();
        }
        
        // Fade out welcome text
        fadeOutWelcomeText();
        
        // Immediately hide buttons and initialize practice mode
        const buttonsContainer = document.querySelector('.buttons-below-canvas');
        if (buttonsContainer) {
            buttonsContainer.style.transition = 'opacity 0.5s';
            buttonsContainer.style.opacity = '0';
            buttonsContainer.style.pointerEvents = 'none'; // Prevent any interaction during fade
            
            // After fade animation, initialize practice mode
            setTimeout(async () => {
                await initializePracticeMode();
            }, 500);
        } else {
            // If no buttons container, initialize immediately
            initializePracticeMode();
        }
        
        if (window.debugLogger) {
            debugLogger.log('Practise mode activated');
        }
        
    } catch (error) {
        console.error('💥 Error in handlePractiseButtonClick:', error);
        if (window.debugLogger) {
            debugLogger.error('Practise button handler failed', error);
        }
    }
}

async function startGame() {
    const playBtn = document.getElementById('playBtn');
    
    // CRITICAL: Hide initial welcome buttons to prevent UI conflicts
    hideInitialWelcomeButtons();
    
    // CRITICAL: Preserve demo/daily mode setting from initialization
    // Don't override isDailyMode here - it was set correctly during initialization
    isPracticeMode = false;
    window.isPracticeMode = false; // Reset global for mechanics to access
    isPractiseMode = false;
    // CRITICAL: Ensure demo mode and daily mode are mutually exclusive
    if (isDemoMode) {
        isDailyMode = false;
        console.log('🔧 DEMO MODE: Forcing isDailyMode = false to ensure demo logic is used');
    }
    console.log('🎯 GAME START: Mode preserved, isDailyMode =', isDailyMode, 'isDemoMode =', isDemoMode);
    
    // Reset interaction state
    isInteractionEnabled = false;
    console.log('🚀 Canvas interaction disabled at game start');
    
    // Reset game state for v3.0
    gameState = 'playing';
    currentAttempts = [];
    attemptCount = 0;
    finalLockedScore = null;
    shapeScreenshot = null;
    canvasRestoreData = null;
    
    // Mark game as started in state
    if (!dailyGameState) {
        initializeDailyGameState();
    }
    dailyGameState.isGameStarted = true;
    dailyGameState.gameStateValue = 'playing';

    // Save structured state now that play has started
    saveStructuredGameState();

    // Save demo game state immediately after pressing Play
    saveDemoGameState();

    // Save simple refresh state
    if (window.SimpleRefresh && window.SimpleRefresh.save) {
        window.SimpleRefresh.save();
    }
    
    // Clear pulse animation if any
    if (pulseInterval) {
        clearInterval(pulseInterval);
        pulseInterval = null;
    }
    
    // Hide results table and old UI elements
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
    
    // UX TIMING IMPLEMENTATION: 0.2s delay before loading shapes
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
        // Set flag to indicate we're starting fresh (not restoring)
        window.freshGameStart = true;
        
        // Load shapes - use Supabase if available, otherwise demo
        console.log('🔍 DEBUG: Checking Supabase integration status...');
        console.log('🔍 DEBUG: window.supabaseIntegrationActive =', window.supabaseIntegrationActive);
        console.log('🔍 DEBUG: window.DailyGameCore =', !!window.DailyGameCore);

        if (window.supabaseIntegrationActive && window.DailyGameCore) {
            console.log('🔗 Loading Supabase shapes for daily game...');
            console.log('🔍 DEBUG: About to call loadSupabaseShape with day:', currentDay, 'shape:', currentShapeNumber);
            await loadSupabaseShape(currentDay, currentShapeNumber);
        } else {
            console.log('🎮 Loading demo shapes (Supabase not available)...');
            console.log('🔍 DEBUG: About to call loadDemoDay with day:', currentDay);
            await loadDemoDay(currentDay);
        }

        // UX TIMING IMPLEMENTATION: 0.2s delay, then show goal and shape together
        await new Promise(resolve => setTimeout(async () => {
            // Show goal beneath canvas
            showGoalBeneathCanvas();
            
            // Clear canvas first for fade-in animation
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw grid first, then show the daily shape immediately (no fade-in)
            drawGrid();
            renderShapeForCutting(parsedShapes, false);
            isShapeAnimationComplete = true;
            setInteractionEnabled(true);
            console.log('✅ Shape animation marked as complete - interaction now allowed');
            
            // Clear fresh game start flag
            window.freshGameStart = false;
            
            // Ensure interaction is fully enabled after animations
            gameState = 'cutting';
            isShapeAnimationComplete = true; // Mark animation as complete for daily game
            isInteractionEnabled = true;
            if (canvas) {
                canvas.style.pointerEvents = 'auto';
            }
            console.log('✅ Daily shape is ready for cutting - game state:', gameState, 'interaction enabled:', isInteractionEnabled);

            // Save state now that shape is loaded and ready for cutting
            saveDemoGameState();
            if (window.SimpleRefresh && window.SimpleRefresh.save) {
                window.SimpleRefresh.save();
            }

            console.log('💾 State saved after shape load - currentDay:', currentDay, 'currentShapeNumber:', currentShapeNumber, 'gameState:', gameState);

            resolve();
        }, 200));
        
    } catch (error) {
        console.error('Error during game start:', error);
        
        // Hide popup and continue with fallback loading
        await hideLoadingPopup();
        
        if (window.debugLogger) {
            debugLogger.error('Game start failed', error);
        }
        
        // Show error message
        showCommentary('Failed to load shape. Please refresh the page.', false);
    }
}

// Removed nextShape function - not needed in v3.0

async function loadCurrentShape() {
    try {
        console.log(`🔄 Loading single shape for date ${currentDate}`);
        
        if (window.debugLogger) {
            debugLogger.log(`Loading single shape for ${currentDate}`);
        }
        
        let geoJSON = null;
        let source = 'unknown';
        
        // v3.0 - Load shape directly (no preloading cache)
        const loadingStrategies = [
            () => loadFromSupabase(),
            () => loadFallbackShape()
        ];
        
        for (const strategy of loadingStrategies) {
            try {
                const result = await strategy();
                if (result.success) {
                    geoJSON = result.geoJSON;
                    source = result.source;
                    break;
                }
            } catch (error) {
                console.warn(`Loading strategy failed:`, error);
            }
        }
        
        if (!geoJSON) {
            throw new Error('All shape loading strategies failed');
        }
        
        console.log(`✅ Daily shape ready from ${source}`);
        
        currentGeoJSON = geoJSON;
        const parseResult = parseGeometry(geoJSON);
        parsedShapes = parseResult.shapes;
        // Removed direct coordinates tracking
        
        if (window.debugLogger) {
            debugLogger.success(`Daily shape loaded from ${source}`, {
                date: currentDate,
                featuresCount: geoJSON.features?.length,
                parsedShapes: parsedShapes.length
            });
        }
        
        // Data loaded - rendering will happen separately
        gameState = 'cutting';
        
    } catch (error) {
        console.error('💥 Failed to load shape:', error);
        if (window.debugLogger) {
            debugLogger.error('Shape loading failed completely', error);
        }
        showCommentary('Failed to load shape. Please refresh the page.', false);
        throw error;
    }
}

// v3.0 - Preloading removed, single shape loads on demand

// v3.0 - Legacy function removed, using loadFromSupabase instead


// Split loading functions for precise timing control
async function loadCurrentShapeData() {
    // This is just a wrapper that calls the existing loadCurrentShape
    // but only loads data without rendering
    await loadCurrentShape();
}

function renderCurrentShape() {
    // Render the loaded shape data
    if (!parsedShapes || parsedShapes.length === 0) {
        console.error('No shape data to render');
        return;
    }
    
    // Clear canvas and redraw with grid and shape
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    renderShapeForCutting(parsedShapes);
    
    hidePlayButton();
}

async function loadFromSupabase() {
    console.log('🌐 Trying to load from Supabase...');
    try {
        // v3.0 - Always load shape 1 (single daily shape)
        const geoJSON = await supabaseClient.loadShape(currentDate, 1);
        return { success: true, geoJSON, source: 'Supabase' };
    } catch (error) {
        console.log('Supabase loading failed:', error.message);
        return { success: false, error };
    }
}

// v3.0 - Load single daily shape
async function loadDailyShape() {
    try {
        console.log(`🔄 Loading daily shape for date ${currentDate}`);
        
        if (window.debugLogger) {
            debugLogger.log(`Loading daily shape for ${currentDate}`);
        }
        
        let geoJSON = null;
        let source = 'unknown';
        
        // v3.0 - Load single shape from day_YYYY-MM-DD/shape.geojson
        const loadingStrategies = [
            () => loadFromSupabaseV3(),
            () => loadFallbackShape()
        ];
        
        for (const strategy of loadingStrategies) {
            try {
                const result = await strategy();
                if (result.success) {
                    geoJSON = result.geoJSON;
                    source = result.source;
                    break;
                }
            } catch (error) {
                console.warn(`Loading strategy failed:`, error);
            }
        }
        
        if (!geoJSON) {
            throw new Error('All shape loading strategies failed');
        }
        
        console.log(`✅ Daily shape ready from ${source}`);
        
        currentGeoJSON = geoJSON;
        const parseResult = parseGeometry(geoJSON);
        parsedShapes = parseResult.shapes;
        // Removed direct coordinates tracking
        
        console.log(`🔍 Daily shape parsing complete: ${parsedShapes.length} shapes`);
        
        if (window.debugLogger) {
            debugLogger.success(`Daily shape loaded from ${source}`, {
                date: currentDate,
                featuresCount: geoJSON.features?.length,
                parsedShapes: parsedShapes.length
            });
        }
        
    } catch (error) {
        console.error('💥 Failed to load daily shape:', error);
        if (window.debugLogger) {
            debugLogger.error('Daily shape loading failed completely', error);
        }
        throw error;
    }
}

async function loadFromSupabaseV3() {
    console.log('🌐 Loading v3.0 single daily shape from Supabase...');
    try {
        // Use the existing loadShape method but with shape index 1
        const geoJSON = await supabaseClient.loadShape(currentDate, 1);
        console.log('✅ Successfully loaded single daily shape via existing method');
        return { success: true, geoJSON, source: 'Supabase' };
    } catch (error) {
        console.log('Supabase v3.0 loading failed:', error.message);
        return { success: false, error };
    }
}


async function loadFallbackShape() {
    console.log('🔄 Using fallback shape...');
    showCommentary('Using test shape (network shapes unavailable)', true);
    return { success: true, geoJSON: fallbackShape, source: 'Fallback' };
}

function renderShapeForCutting(shapes, useDirectCoordinates = false, context = ctx) {
    // Only log during non-animation calls to reduce console spam
    if (!window.isAnimating) {
        console.log(`🎨 renderShapeForCutting called with ${shapes.length} shapes, useDirectCoordinates: ${useDirectCoordinates}`);
    }
    if (shapes.length === 0) {
        if (!window.isAnimating) {
            console.error('❌ No shapes to render!');
        }
        return;
    }
    
    // Calculate bounds for scaling and centering
    const bounds = calculateBounds(shapes);
    const scale = calculateScale(bounds, useDirectCoordinates);
    const offset = calculateOffset(bounds, scale, useDirectCoordinates);
    
    if (!window.isAnimating) {
        console.log(`🎨 Rendering with offset: (${offset.x.toFixed(1)}, ${offset.y.toFixed(1)}), scale: ${scale.toFixed(2)}`);
    }
    
    // Set drawing styles - lighter grey fill, black stroke
    context.save();
    context.fillStyle = '#dddddd';
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    
    // Draw each shape
    shapes.forEach((shape, index) => {
        drawPolygon(shape, scale, offset, context);
    });
    
    context.restore();
}

// Draw shape from GeoJSON data (for replay mode)
function drawShapeFromGeoJSON(geoJSON) {
    if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
        console.warn('Invalid GeoJSON provided to drawShapeFromGeoJSON');
        return;
    }
    
    // Parse the GeoJSON into shapes
    const parseResult = parseGeometry(geoJSON);
    const shapes = parseResult.shapes;
    
    // Render the shapes using the existing function
    renderShapeForCutting(shapes, parseResult.useDirectCoordinates);
}

// Draw shape outline only from GeoJSON data (for replay mode)
function drawShapeOutlineFromGeoJSON(geoJSON) {
    if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
        console.warn('Invalid GeoJSON provided to drawShapeOutlineFromGeoJSON');
        return;
    }
    
    // Parse the GeoJSON into shapes
    const parseResult = parseGeometry(geoJSON);
    const shapes = parseResult.shapes;
    
    // Calculate bounds for scaling and centering
    const bounds = calculateBounds(shapes);
    const scale = calculateScale(bounds, parseResult.useDirectCoordinates);
    const offset = calculateOffset(bounds, scale, parseResult.useDirectCoordinates);
    
    // Set drawing styles - outline only
    ctx.save();
    ctx.fillStyle = 'transparent';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    // Draw each shape outline
    shapes.forEach(shape => {
        drawPolygonOutline(shape, scale, offset);
    });
    
    ctx.restore();
}





// Stats popup functions
async function showStats() {
    console.log('showStats called - finalLockedScore:', finalLockedScore);
    
    // v3.0 - Use the final locked score for your average (single result)
    let yourSplit = 'No result';
    if (finalLockedScore) {
        yourSplit = `${finalLockedScore.leftPercentage.toFixed(1)}% / ${finalLockedScore.rightPercentage.toFixed(1)}%`;
    }
    
    // Get global average from Supabase
    let globalSplit = 'Loading...';
    try {
        const globalAvg = await supabaseClient.getTodaysAverage(currentDate);
        if (globalAvg) {
            globalSplit = `${globalAvg.leftPercentage.toFixed(1)}% / ${globalAvg.rightPercentage.toFixed(1)}%`;
        } else {
            globalSplit = yourSplit; // Fallback to your split if no global data
        }
    } catch (error) {
        console.error('Error fetching global average:', error);
        globalSplit = yourSplit; // Fallback
    }
    
    // Update the popup content with split format
    document.getElementById('yourAverage').textContent = yourSplit;
    document.getElementById('globalAverage').textContent = globalSplit;
    
    // Disable canvas interaction and swipe gestures while popup is visible
    canvas.style.pointerEvents = 'none';
    isReplayMode = false; // Ensure replay mode is disabled while stats are shown
    const swipeIndicators = document.getElementById('swipeIndicators');
    if (swipeIndicators) {
        swipeIndicators.style.display = 'none';
    }
    
    // Show the popup
    document.getElementById('statsPopup').style.display = 'flex';
}

function hideStats() {
    const statsPopup = document.getElementById('statsPopup');
    if (statsPopup) {
        statsPopup.style.display = 'none';
        // Move popup back to its original position in the DOM
        document.body.appendChild(statsPopup);
    }
    
    // Hide any remaining commentary when stats popup is closed
    hideCommentary();
    
    // Show the header share button now that game is completed and stats popup closed
    const headerShareBtn = document.getElementById('shareBtn');
    if (headerShareBtn) {
        headerShareBtn.style.visibility = 'visible';
        headerShareBtn.style.opacity = '1';
    }
    
    // NOW activate replay mode after stats popup is closed
    canvas.style.pointerEvents = 'auto';
    setupReplayNavigation();
    isReplayMode = true;
    
    // Track replay usage
    if (window.Analytics) {
        window.Analytics.trackReplayUsage();
    }
    // v3.0 - No swipe indicators needed for single shape per day
    
    // Ensure no vestige buttons are shown during replay
    hidePlayButton();
    
    // Show the last shape in replay mode
    showReplayShape(replayShapeIndex);
    
    console.log('🔄 Stats popup closed - replay mode activated');
}

function handleShare() {
    // v3.0 - Use locked score and attempt count
    if (!finalLockedScore) {
        console.error('No locked score available for sharing');
        return;
    }
    
    // Track share event
    if (window.Analytics) {
        window.Analytics.trackShare();
    }
    
    const dayNumber = currentDayNumber || 1;
    
    // Generate emoji pattern - always show 3 attempts
    let emojiPattern = ' ';
    
    // Get all attempts and rank them by accuracy
    if (currentAttempts && currentAttempts.length > 0) {
        // Rank attempts by how close they are to 50/50
        const rankedAttempts = [...currentAttempts].map((attempt, index) => ({
            ...attempt,
            originalIndex: index,
            accuracy: Math.abs(50 - attempt.leftPercentage)
        })).sort((a, b) => a.accuracy - b.accuracy);
        
        // Assign medals based on ranking (best to worst)
        const medals = ['🥇', '🥈', '🥉'];
        const attemptMedals = {};
        
        // Assign medals to attempts based on their ranking
        rankedAttempts.forEach((attempt, rankIndex) => {
            if (rankIndex < medals.length) {
                attemptMedals[attempt.originalIndex] = medals[rankIndex];
            } else {
                attemptMedals[attempt.originalIndex] = '🥉'; // Default to bronze for extra attempts
            }
        });
        
        // Build emoji pattern in chronological order (order of cuts made)
        for (let i = 0; i < 3; i++) {
            if (i < currentAttempts.length) {
                emojiPattern += attemptMedals[i]; // Use original index order
            } else {
                // Unused attempts - leave blank or use a placeholder
                emojiPattern += '⬜'; // Empty square for unused attempts
            }
        }
    } else {
        // Fallback if no attempts data
        emojiPattern = ' 🥇🥈🥉';
    }
    
    // Determine which try number achieved the best score
    let bestAttemptNumber = 1; // Default to 1st try
    
    if (currentAttempts && currentAttempts.length > 0) {
        console.log('🔍 Share Debug - Finding best attempt from:', currentAttempts.map((a, i) => ({
            attempt: i + 1,
            left: a.leftPercentage,
            right: a.rightPercentage,
            accuracy: Math.abs(50 - a.leftPercentage)
        })));
        
        // Find the attempt with the best accuracy (closest to 50/50)
        let bestAccuracy = Infinity;
        let bestIndex = 0;
        
        for (let i = 0; i < currentAttempts.length; i++) {
            const attempt = currentAttempts[i];
            const accuracy = Math.abs(50 - attempt.leftPercentage);
            console.log(`🔍 Attempt ${i + 1}: ${attempt.leftPercentage}% / ${attempt.rightPercentage}%, accuracy: ${accuracy}`);
            if (accuracy < bestAccuracy) {
                bestAccuracy = accuracy;
                bestIndex = i;
                console.log(`🏆 New best: Attempt ${i + 1} with accuracy ${accuracy}`);
            }
        }
        
        bestAttemptNumber = bestIndex + 1; // Convert to 1-indexed
        console.log(`🎯 Final best attempt number: ${bestAttemptNumber}`);
    } else {
        console.log('⚠️ No currentAttempts available for share message');
    }
    
    // Get percentages from the best attempt (not finalLockedScore)
    let leftPercent, rightPercent;
    if (currentAttempts && currentAttempts.length > 0 && bestAttemptNumber <= currentAttempts.length) {
        const bestAttempt = currentAttempts[bestAttemptNumber - 1]; // Convert back to 0-indexed
        leftPercent = bestAttempt.leftPercentage.toFixed(1);
        rightPercent = bestAttempt.rightPercentage.toFixed(1);
        console.log(`🔍 Using percentages from best attempt ${bestAttemptNumber}: ${leftPercent}% / ${rightPercent}%`);
    } else {
        // Fallback to finalLockedScore if no attempts available
        leftPercent = finalLockedScore.leftPercentage.toFixed(1);
        rightPercent = finalLockedScore.rightPercentage.toFixed(1);
        console.log(`🔍 Fallback: Using finalLockedScore percentages: ${leftPercent}% / ${rightPercent}%`);
    }
    
    const tryOrdinal = bestAttemptNumber === 1 ? '1st' : bestAttemptNumber === 2 ? '2nd' : '3rd';
    
    // Use parentheses - best compromise for working links across platforms
    const shareText = `Daily Shapes #${dayNumber}\n${emojiPattern}\n ${leftPercent}% / ${rightPercent}% (best split) on my ${tryOrdinal} cut\n (dailyshapes.com)`;
    
    console.log('🔍 Final share text:', shareText);
    
    // Copy to clipboard like Wordle
    copyToClipboardWithPopup(shareText);
}

function copyToClipboardWithPopup(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyConfirmationPopup();
        }).catch(error => {
            console.error('Clipboard write failed:', error);
            showCopyConfirmationPopup('Copy failed - try again');
        });
    } else {
        // Fallback for older browsers - try textarea method
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showCopyConfirmationPopup();
        } catch (error) {
            console.error('Fallback copy failed:', error);
            showCopyConfirmationPopup('Copy not supported');
        }
    }
}

function showCopyConfirmationPopup(message = 'Copied to clipboard') {
    // Create popup overlay
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    // Create popup content
    popup.innerHTML = `
        <div style="
            background-color: #ffffff;
            border: 3px solid #000000;
            border-radius: 12px;
            padding: 16px 24px;
            text-align: center;
            box-shadow: 6px 6px 0px #000000;
            margin: 20px;
        ">
            <div style="
                font-size: 18px;
                font-weight: 600;
                color: #000000;
                line-height: 1.4;
                margin: 0;
            ">${message}</div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Fade in
    setTimeout(() => {
        popup.style.opacity = '1';
    }, 10);
    
    // Auto-remove after 2 seconds
    setTimeout(() => {
        if (document.body.contains(popup)) {
            document.body.removeChild(popup);
        }
    }, 2000);
}


function endGame() {
    console.log('🎯 endGame() function called - all shapes completed');
    
    hidePlayButton();
    
    // Initialize replay mode immediately with shape 10
    const totalShapesForEnd = window.devvitTotalShapes || 10;
    console.log('🎯 Setting replayShapeIndex to', totalShapesForEnd, 'in endGame()');
    replayShapeIndex = totalShapesForEnd;
    console.log('🎯 replayShapeIndex is now:', replayShapeIndex);
    gameState = 'finished';
    console.log('🎯 gameState set to:', gameState);

    // Don't show swipe indicators until after stats popup is closed

    // Show stats immediately after endGame
    showStats();
    console.log('🔄 Replay mode fully activated - starting with shape', totalShapesForEnd);
}

function resetGame() {
    // Reset interaction state
    isInteractionEnabled = false;
    console.log('🔄 Canvas interaction disabled at game reset');
    
    // Reset all game state for v3.0
    currentAttempts = [];
    attemptCount = 0;
    finalLockedScore = null;
    shapeScreenshot = null;
    canvasRestoreData = null;
    
    // Clear pulse animation if any
    if (pulseInterval) {
        clearInterval(pulseInterval);
        pulseInterval = null;
    }
    
    // Clear countdown interval if any
    if (window.gameCountdownInterval) {
        clearInterval(window.gameCountdownInterval);
        window.gameCountdownInterval = null;
    }
    
    // Clear displays
    hideCommentary();
    
    // Clear attempt results and buttons
    const attemptResult = document.querySelector('.attempt-result');
    if (attemptResult) {
        attemptResult.remove();
    }
    
    // Clear post-lock-in elements
    const postLockInContainer = document.querySelector('.post-lockin-container');
    if (postLockInContainer) {
        postLockInContainer.remove();
    }
    
    // Hide countdown overlay
    const countdownOverlay = document.getElementById('countdownOverlay');
    if (countdownOverlay) {
        countdownOverlay.style.display = 'none';
    }
    
    const attemptButtons = document.querySelector('.attempt-buttons');
    if (attemptButtons) {
        attemptButtons.remove();
    }
    
    // Reset game state
    gameState = 'initial';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    // Show play button with "Play Again" text
    const playBtn = document.getElementById('playBtn');
    playBtn.textContent = 'Play Again';
    playBtn.disabled = false;
    playBtn.classList.remove('disabled');
    showPlayButton();
}

function handleReset() {
    location.reload();
}


// Compact loading popup functions
function showLoadingPopup() {
    if (!loadingPopupElement) {
        loadingPopupElement = document.getElementById('loadingPopup');
    }
    
    if (loadingPopupElement) {
        console.log('⏳ Showing compact loading popup...');
        splashStartTime = Date.now();
        
        // Show the popup immediately
        loadingPopupElement.style.display = 'block';
        
        // Trigger fade-in animation
        requestAnimationFrame(() => {
            loadingPopupElement.classList.add('visible');
        });
        
        if (window.debugLogger) {
            debugLogger.log('Loading popup displayed');
        }
    }
}

async function hideLoadingPopup() {
    if (!loadingPopupElement) {
        return;
    }
    
    // Ensure minimum display time of 300ms
    const minDisplayTime = 300;
    const elapsed = splashStartTime ? Date.now() - splashStartTime : minDisplayTime;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    
    if (remainingTime > 0) {
        console.log(`⏱️ Waiting ${remainingTime}ms more for minimum popup display time...`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
    
    console.log('⏳ Hiding loading popup...');
    
    // Start fade-out animation
    loadingPopupElement.classList.remove('visible');
    
    // Wait for fade-out transition to complete, then hide
    setTimeout(() => {
        if (loadingPopupElement) {
            loadingPopupElement.style.display = 'none';
        }
        
        // Hide the play button now that shape is loaded and ready for cutting
        hidePlayButton();
        
        if (window.debugLogger) {
            debugLogger.log('Loading popup hidden');
        }
    }, 300); // Match CSS transition duration
}

// Instant loading popup functions for precise UX timing
function showLoadingPopupInstant() {
    console.log('🔍 showLoadingPopupInstant called, window.startLoadingAnimation exists:', !!window.startLoadingAnimation);
    // Use new canvas loading animation instead of popup
    if (window.startLoadingAnimation) {
        console.log('⏳ Starting canvas loading animation...');
        window.startLoadingAnimation();
    } else {
        console.error('❌ window.startLoadingAnimation not found!');
    }
}

function hideLoadingPopupInstant() {
    // Stop canvas loading animation
    if (window.stopImmediateLoadingAnimation) {
        console.log('⏳ Stopping canvas loading animation...');
        window.stopImmediateLoadingAnimation();
    }
}

// Removed nextShapeWithTiming function - not needed in v3.0

// Vector cutting event handlers
function handleVectorStart(event) {
    try {
        console.log('🔍 DEBUG: handleVectorStart called', {
            isInteractionEnabled,
            gameState,
            attemptCount,
            isPracticeMode: window.isPracticeMode,
            practiceMode: practiceMode.isActive,
            canvasPointerEvents: canvas?.style.pointerEvents,
            eventType: event.type,
            eventTarget: event.target.tagName
        });

        // Close menu dropdown if it's open when starting canvas interaction
        if (window.menuState && window.menuState.isExpanded) {
            console.log('🔵 Active canvas interaction started - closing menu dropdown');
            window.collapseMenu();
        }

        // Reset instructions when user starts a new cut (clear any commentary)
        resetInstructionsToInitial();
        
        // Special handling for practice mode
        if (window.isPracticeMode) {
            console.log('🔪 Practice mode vector start detected');
            if (isReplayMode) {
                console.log('Vector start ignored - in replay mode');
                return;
            }
            // Skip other checks for practice mode, go directly to practice vector start
        } else {
            // Normal game mode checks
            if (!isInteractionEnabled) {
                console.log('Vector start ignored - interaction not enabled yet');
                return;
            }

            if (isReplayMode) {
                console.log('Vector start ignored - in replay mode');
                return;
            }

            if (gameState !== 'cutting') {
                console.log('Vector start ignored - not in cutting state:', gameState);
                return;
            }
        }

        // Hide goal commentary when user starts cutting
        hideGoalCommentary();

        if (window.isPracticeMode) {
            // Practice mode: use current mechanic's start handler for proper visual feedback
            console.log('🔪 Starting practice vector cut - using current mechanic');
            console.log('🔧 DEBUG: currentMechanic exists:', !!currentMechanic);
            console.log('🔧 DEBUG: window.currentMechanic exists:', !!window.currentMechanic);
            console.log('🔧 DEBUG: currentMechanic name:', currentMechanic ? currentMechanic.name : 'null');
            console.log('🔧 DEBUG: window.currentMechanic name:', window.currentMechanic ? window.currentMechanic.name : 'null');

            // Use window.currentMechanic for practice mode
            const practiceMechanic = window.currentMechanic || currentMechanic;
            console.log('🔧 DEBUG: Using mechanic:', practiceMechanic ? practiceMechanic.name : 'null');

            // PERFORMANCE FIX: Cache canvas rect once at start of drag to prevent layout thrashing
            // This prevents canvas and navigation elements from shifting during drag operations
            const canvasRect = canvas.getBoundingClientRect();
            practiceMode.cachedCanvasRect = canvasRect;
            console.log('📐 Cached canvas rect for drag operation:', canvasRect);

            // Try to use current mechanic's start handler
            if (practiceMechanic && typeof practiceMechanic.handleStart === 'function') {
                console.log('🔧 Practice mode: Using current mechanic start handler', {
                    mechanicName: practiceMechanic.name,
                    isInteractionEnabled: window.isInteractionEnabled
                });
                const handled = practiceMechanic.handleStart(event, canvasRect);
                console.log('🔧 Practice mode: Mechanic handleStart result:', handled, typeof handled);
                if (handled) {
                    console.log('🔧 Practice mode: Mechanic handled start - setting practice flags');
                    // Still set practice-specific flags for drag handler compatibility
                    practiceMode.practiceIsDrawingVector = true;
                    practiceMode.practiceVectorStart = getCanvasCoordinates(event);
                    practiceMode.practiceVectorEnd = null;
                    practiceMode.practiceCurrentVector = null;
                    console.log('🔧 Practice mode: Practice flags set, returning early');
                    return;
                } else {
                    console.log('🔧 Practice mode: Mechanic did not handle start, falling back');
                }
            } else {
                console.log('🔧 Practice mode: No mechanic handleStart available');
            }

            // Fallback to basic practice handling
            console.log('🔧 Practice mode: Using fallback start handling');
            practiceMode.practiceIsDrawingVector = true;
            practiceMode.practiceVectorStart = getCanvasCoordinates(event);
            practiceMode.practiceVectorEnd = null;
            practiceMode.practiceCurrentVector = null;
            console.log('🔧 Practice vector state:', {
                isDrawing: practiceMode.practiceIsDrawingVector,
                start: practiceMode.practiceVectorStart
            });
        } else {
            // Normal game mode
            console.log('🔪 Starting vector cut - attempt:', attemptCount + 1);
            
            // Hide any "Try again" message when starting a new cut
            hideTryAgainMessage();
            
            isDrawingVector = true;
            vectorStart = getCanvasCoordinates(event);
            vectorEnd = null;
            currentVector = null;
            vectorCutActive = false;
            dragDistance = 0;
        }
        
        if (window.debugLogger) {
            debugLogger.debug('Vector drawing started', { 
                x: practiceMode.isActive ? practiceMode.practiceVectorStart.x : vectorStart.x, 
                y: practiceMode.isActive ? practiceMode.practiceVectorStart.y : vectorStart.y,
                practiceMode: practiceMode.isActive
            });
        }
        
    } catch (error) {
        console.error('💥 Error in handleVectorStart:', error);
        if (window.debugLogger) {
            debugLogger.error('Vector start handler failed', error);
        }
    }
}

function handleVectorDrag(event) {
    console.log('🔍 DEBUG: handleVectorDrag called - event type:', event.type);
    console.log('🔍 DEBUG: Practice mode status:', {
        practiceMode_isActive: practiceMode.isActive,
        isPracticeMode: window.isPracticeMode,
        practiceMode_object: practiceMode
    });

    // Check practice mode conditions
    if (window.isPracticeMode) {
        console.log('🔍 DEBUG: handleVectorDrag called for practice mode', {
            isReplayMode,
            practiceIsDrawingVector: practiceMode.practiceIsDrawingVector,
            practiceVectorStart: practiceMode.practiceVectorStart,
            eventType: event.type
        });
        
        if (isReplayMode || !practiceMode.practiceIsDrawingVector || !practiceMode.practiceVectorStart) {
            console.log('🔍 Practice drag blocked:', {
                isReplayMode, 
                practiceIsDrawingVector: practiceMode.practiceIsDrawingVector, 
                practiceVectorStart: !!practiceMode.practiceVectorStart,
                condition1_isReplayMode: isReplayMode,
                condition2_notPracticeIsDrawingVector: !practiceMode.practiceIsDrawingVector,
                condition3_noPracticeVectorStart: !practiceMode.practiceVectorStart
            });
            return;
        }
        
        // Practice mode: Use current mechanic's visual feedback system instead of custom handling
        const practiceMechanic = window.currentMechanic || currentMechanic;
        if (practiceMechanic && typeof practiceMechanic.handleMove === 'function') {
            console.log('🔧 Practice mode: About to call mechanic.handleMove', {
                mechanicName: practiceMechanic.name,
                handleMoveType: typeof practiceMechanic.handleMove
            });
            // PERFORMANCE FIX: Use cached canvas rect from handleVectorStart to prevent layout thrashing
            const canvasRect = practiceMode.cachedCanvasRect || canvas.getBoundingClientRect();
            console.log('🔧 Canvas rect for mechanic (cached):', canvasRect);
            const handled = practiceMechanic.handleMove(event, canvasRect);
            console.log('🔧 Practice mode: Mechanic handleMove result:', handled, typeof handled);
            if (handled) {
                console.log('🔧 Practice mode: Mechanic handled visual feedback - preventing default and returning');
                event.preventDefault();
                return;
            } else {
                console.log('🔧 Practice mode: Mechanic did not handle - falling back to default');
            }
        } else {
            console.log('🔧 Practice mode: No currentMechanic.handleMove available:', {
                currentMechanic: !!currentMechanic,
                windowCurrentMechanic: !!window.currentMechanic,
                practiceMechanic: !!practiceMechanic,
                currentMechanicName: currentMechanic?.name,
                windowCurrentMechanicName: window.currentMechanic?.name,
                handleMove: typeof (practiceMechanic && practiceMechanic.handleMove)
            });
        }
        
        // Special check: Three Point Triangle mechanic should NEVER have fallback drag behavior
        if (practiceMechanic && practiceMechanic.name === 'Three Point Triangle Cut') {
            console.log('🚫 Three Point Triangle mechanic: No drag fallback permitted - returning early');
            return;
        }

        // Fallback to basic practice handling if mechanic doesn't handle it
        practiceMode.practiceVectorEnd = getCanvasCoordinates(event);

        // Calculate drag distance for practice mode
        const dx = practiceMode.practiceVectorEnd.x - practiceMode.practiceVectorStart.x;
        const dy = practiceMode.practiceVectorEnd.y - practiceMode.practiceVectorStart.y;
        const dragDistance = Math.sqrt(dx * dx + dy * dy);

        console.log('🔍 Practice drag distance:', dragDistance);

        // Only show preview if drag distance is significant
        if (dragDistance > 5) {
            console.log('🔍 Drawing practice vector preview - fallback mode');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid(ctx);
            renderPracticeShapeForCutting(practiceMode.practiceParsedShapes);
            drawPracticeCurrentVector();
        } else {
            console.log('🔍 Drag distance too small for preview:', dragDistance);
        }
        return;
    }
    
    // Normal game mode
    if (isReplayMode || !isDrawingVector || !vectorStart || gameState !== 'cutting') return;
    
    // CRITICAL FIX: Don't redraw if we're in practice mode and have a completed cut
    if (isPracticeMode && currentVector) {
        console.log('🚫 Skipping vector drag redraw - practice mode with completed cut');
        return;
    }
    
    vectorEnd = getCanvasCoordinates(event);
    
    // Calculate drag distance
    const dx = vectorEnd.x - vectorStart.x;
    const dy = vectorEnd.y - vectorStart.y;
    dragDistance = Math.sqrt(dx * dx + dy * dy);
    
    // Only show preview if drag distance is significant
    if (dragDistance > 5) {
        // Redraw canvas with current vector
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        renderShapeForCutting(parsedShapes);
        drawCurrentVector();
        
        // Draw first cut if this is the second cut for Shape 3
        if (currentShapeIndex === 3 && firstCutVector) {
            drawPreviousVector(firstCutVector);
        }
    }
}

async function handleVectorEnd(event) {
    // PRACTICE MODE: Use same cutting logic but different completion
    if (window.isPracticeMode) {
        console.log('🔧 Practice mode: handleVectorEnd called');
        console.log('🔧 Practice mode: currentMechanic:', currentMechanic ? currentMechanic.name : 'null');
        console.log('🔧 Practice mode: window.currentMechanic:', window.currentMechanic ? window.currentMechanic.name : 'null');

        // Use window.currentMechanic for practice mode
        const practiceMechanic = window.currentMechanic || currentMechanic;
        console.log('🔧 Practice mode: Using mechanic:', practiceMechanic ? practiceMechanic.name : 'null');

        // Use current mechanic's end handler if available
        if (practiceMechanic && typeof practiceMechanic.handleEnd === 'function') {
            console.log('🔧 Practice mode: Using current mechanic end handler');
            const result = await practiceMechanic.handleEnd(event);
            console.log('🔧 Practice mode: Mechanic handleEnd result:', result);

            // ALWAYS reset practice mode drawing state, regardless of result
            // This prevents ghost lines when user clicks without dragging
            console.log('🔧 Practice mode: Resetting drawing state (result:', result, ')');
            practiceMode.practiceIsDrawingVector = false;
            practiceMode.practiceVectorStart = null;
            practiceMode.practiceVectorEnd = null;
            practiceMode.practiceCurrentVector = null;
            // Clear cached canvas rect now that drag operation is complete
            practiceMode.cachedCanvasRect = null;
            console.log('📐 Cleared cached canvas rect');

            return result;
        }
        
        console.log('🔧 Practice mode: Using fallback daily game cutting mechanics');
        // Continue with existing daily game cut calculation below...
        // The practice mode interception will happen in handleCutAttempt()
    }
    
    // Normal game mode checks - allow practice mode to continue through
    if (isReplayMode || !isDrawingVector || !vectorStart || (gameState !== 'cutting' && !window.isPracticeMode)) return;
    
    isDrawingVector = false;
    vectorEnd = getCanvasCoordinates(event);
    
    // Check if this was a proper drag (not just a tap)
    if (dragDistance < 10) {
        // Single tap - show try again message in instruction location
        if (window.updateInstructionText) {
            window.updateInstructionText('Try again', true); // true for bold styling
        }
        
        // Reset and redraw original shape
        resetVectorState();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        renderShapeForCutting(parsedShapes);
        
        // Redraw first cut if applicable
        if (currentShapeIndex === 3 && firstCutVector) {
            drawPreviousVector(firstCutVector);
        }
        
        return;
    }
    
    if (vectorStart && vectorEnd) {
        // Normalize vector direction for consistent left/right calculation
        let normalizedStart = vectorStart;
        let normalizedEnd = vectorEnd;
        
        // Always ensure consistent direction: if start.x > end.x, swap them
        if (vectorStart.x > vectorEnd.x) {
            normalizedStart = vectorEnd;
            normalizedEnd = vectorStart;
        }
        
        // Perform the cut calculation
        // Check if current mechanic has its own performVectorCut method
        if (currentMechanic && typeof currentMechanic.performVectorCut === 'function') {
            console.log('🔧 Using mechanic-specific performVectorCut');
            // Let the mechanic handle setting currentVector to avoid overwriting
            currentMechanic.performVectorCut();
        } else {
            console.log('🔧 Using default performVectorCut - main game sets currentVector');
            // Calculate extended vector that spans the entire canvas
            currentVector = extendVectorToCanvasBounds(normalizedStart, normalizedEnd);
            vectorCutActive = true;
            performVectorCut();
        }
    }
}

function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (event.type.startsWith('touch')) {
        clientX = event.touches[0]?.clientX || event.changedTouches[0]?.clientX;
        clientY = event.touches[0]?.clientY || event.changedTouches[0]?.clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }
    
    // Get pointer position relative to canvas display area
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    // Scale from display size to logical canvas size (380x380)
    const logicalSize = 380;
    const scaleX = logicalSize / rect.width;
    const scaleY = logicalSize / rect.height;

    return {
        x: relativeX * scaleX,
        y: relativeY * scaleY
    };
}

function extendVectorToCanvasBounds(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Use logical canvas size (380x380) for bounds calculations
    const logicalSize = 380;

    // Handle vertical line
    if (Math.abs(dx) < 0.001) {
        return {
            start: { x: start.x, y: 0 },
            end: { x: start.x, y: logicalSize }
        };
    }

    // Handle horizontal line
    if (Math.abs(dy) < 0.001) {
        return {
            start: { x: 0, y: start.y },
            end: { x: logicalSize, y: start.y }
        };
    }

    // Calculate slope and intercept
    const slope = dy / dx;
    const intercept = start.y - slope * start.x;

    // Find intersections with canvas boundaries
    const intersections = [];

    // Left edge (x = 0)
    const leftY = intercept;
    if (leftY >= 0 && leftY <= logicalSize) {
        intersections.push({ x: 0, y: leftY });
    }

    // Right edge (x = logicalSize)
    const rightY = slope * logicalSize + intercept;
    if (rightY >= 0 && rightY <= logicalSize) {
        intersections.push({ x: logicalSize, y: rightY });
    }

    // Top edge (y = 0)
    const topX = (0 - intercept) / slope;
    if (topX >= 0 && topX <= logicalSize) {
        intersections.push({ x: topX, y: 0 });
    }

    // Bottom edge (y = logicalSize)
    const bottomX = (logicalSize - intercept) / slope;
    if (bottomX >= 0 && bottomX <= logicalSize) {
        intersections.push({ x: bottomX, y: logicalSize });
    }
    
    // Return the two intersection points
    if (intersections.length >= 2) {
        return {
            start: intersections[0],
            end: intersections[1]
        };
    }
    
    // Fallback to original points if no intersections found
    return { start, end };
}

function drawCurrentVector() {
    if (!vectorStart || !vectorEnd) return;
    
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(vectorStart.x, vectorStart.y);
    ctx.lineTo(vectorEnd.x, vectorEnd.y);
    ctx.stroke();
    
    ctx.restore();
}

function drawPreviousVector(vector) {
    if (!vector) return;
    
    ctx.save();
    ctx.strokeStyle = '#000000'; // Changed to solid black for committed cuts
    ctx.lineWidth = 2; // Match final cut width for consistency
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.moveTo(vector.start.x, vector.start.y);
    ctx.lineTo(vector.end.x, vector.end.y);
    ctx.stroke();
    
    ctx.restore();
}

// Generic vector drawing function for replay mode
function drawVector(start, end, style = 'cut') {
    if (!start || !end) return;
    
    ctx.save();
    
    if (style === 'cut') {
        // Main cut vector - bold black line
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
    } else if (style === 'previous') {
        // Previous cut vector - solid black line to match finalized cuts
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
    } else {
        // Default style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
    }
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    ctx.restore();
}

// Vector cutting and pixel-based area calculation - v3.0
async function performVectorCut() {
    // Get shapes with practice mode priority
    // CRITICAL: Practice mode must use practiceParsedShapes to avoid contamination
    const shapes = window.isPracticeMode ?
                  (window.practiceMode?.practiceParsedShapes || []) :
                  (parsedShapes || []);

    console.log('🚀 performVectorCut called with:', {
        hasCurrentVector: !!currentVector,
        currentVector: currentVector,
        shapesLength: shapes.length,
        gameState: gameState,
        isInteractionEnabled: isInteractionEnabled,
        isPracticeMode: window.isPracticeMode
    });

    if (!currentVector || !shapes.length) {
        console.error('❌ performVectorCut early exit - missing requirements:', {
            hasCurrentVector: !!currentVector,
            shapesLength: shapes.length,
            isPracticeMode: window.isPracticeMode
        });
        return;
    }
    
    updateStatus('Calculating cut areas...');
    
    // First validate the cut
    const isValidCut = validateCut();
    console.log('🔍 Cut validation result:', isValidCut);
    if (!isValidCut) {
        console.log('❌ Invalid cut detected - not counting attempt');
        // Invalid cut - allow recut without counting
        handleInvalidCut();
        return;
    }
    console.log('✅ Valid cut detected - proceeding with attempt');
    
    // Process the cut and calculate areas (don't increment attempt count yet)
    await handleCutAttempt();
}

// Validate if a cut actually divides the shape
function validateCut() {
    // Get shapes with practice mode priority
    // CRITICAL: Practice mode must use practiceParsedShapes to avoid contamination
    const shapes = window.isPracticeMode ?
                  (window.practiceMode?.practiceParsedShapes || []) :
                  (parsedShapes || []);

    console.log('🔍 validateCut called:', {
        hasCurrentVector: !!currentVector,
        shapesLength: shapes.length,
        isPracticeMode: window.isPracticeMode
    });

    if (!currentVector || !shapes.length) {
        console.warn('🔍 validateCut early return - missing currentVector or shapes');
        return false;
    }

    // Create temporary canvas for pixel analysis
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Render shapes on temporary canvas
    renderShapesForPixelAnalysis(tempCtx, shapes);
    
    // Get pixel data
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    
    // Calculate areas on each side of the vector
    // Use window.currentVector which is set by the mechanic
    const vectorForCalculation = window.currentVector || currentVector;
    if (!vectorForCalculation) {
        console.error('❌ No vector available for area calculation');
        return;
    }
    const areaResults = calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, vectorForCalculation);
    
    // Check for invalid cut (no actual division)
    // Use small tolerance for floating point comparison
    if (areaResults.leftPercentage < 0.1 || areaResults.rightPercentage < 0.1) {
        console.log('Invalid cut detected - no actual division:', areaResults.leftPercentage, areaResults.rightPercentage);
        return false;
    }
    
    return true;
}

// Handle invalid cuts - allow recut without counting
function handleInvalidCut() {
    console.log('🚫 Invalid cut - allowing recut without counting');
    
    // Reset vector state but keep game in cutting mode
    resetVectorState();
    
    // Show try again message in instruction location
    if (window.updateInstructionText) {
        window.updateInstructionText('Try again', true); // true for bold styling
    }
    
    // Redraw original shape with any previous cuts
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // Get shapes with practice mode priority
    // CRITICAL: Practice mode must use practiceParsedShapes, NOT window.parsedShapes
    const shapes = window.isPracticeMode ?
                  (window.practiceMode?.practiceParsedShapes || []) :
                  (parsedShapes || []);
    renderShapeForCutting(shapes);
    
    // For Shape 3, redraw first cut if it exists
    if (currentShapeIndex === 3 && firstCutVector) {
        drawPreviousVector(firstCutVector);
    }
    
    // Keep the game in cutting state for recut
    gameState = 'cutting';
}

// v3.0 - Handle cut attempt with pulsing animation
// Global cut tracking to prevent exploits
// Initialize from window if already set (for restoration), otherwise start at 0
let totalCutsMade = window.totalCutsMade || 0;
let cutsMadeThisShape = window.cutsMadeThisShape || 0;
window.totalCutsMade = totalCutsMade; // Expose for bulletproof system
window.cutsMadeThisShape = cutsMadeThisShape; // Expose for bulletproof system

async function handleCutAttempt() {
    console.log('🔥 MAIN: handleCutAttempt called!');
    console.log('🔥 MAIN: isDemoMode =', isDemoMode, 'isPracticeMode =', isPracticeMode, 'window.isPracticeMode =', window.isPracticeMode);
    console.log('🔥 MAIN: isDailyMode =', isDailyMode, '(CRITICAL FOR CUT BLOCKING)');
    console.log('🔥 MAIN: Current counters - totalCuts:', totalCutsMade, 'cutsThisShape:', cutsMadeThisShape);
    
    // Note: canceledLineDrawing flag is now cleared just before each renderVectorCutResult call
    // to ensure visual shading works properly after right-click cancellation
    
    // PRACTICE MODE: Use existing cutting logic but handle results differently
    if (window.isPracticeMode) {
        console.log('🔪 Practice mode cut attempt - using existing logic');
        // Continue with existing cut calculation below, but we'll handle the results differently
    }
    
    // CRITICAL FIX: Enforce 1-cut limit per shape in daily mode

    // SAFETY: If not in practice mode and not explicitly daily mode, assume daily mode
    if (!window.isPracticeMode && !isDailyMode) {
        console.log('🚨 SAFETY: Not in practice mode but isDailyMode=false, forcing daily mode');
        isDailyMode = true;
    }

    // DAILY MODE: Block if we've already made 1 cut on current shape
    if (isDailyMode && cutsMadeThisShape >= 1) {
        console.log('🚫 CUT BLOCKED: Daily mode - Shape cuts', cutsMadeThisShape, 'exceeds maximum of 1 per shape');
        // Re-enable canvas if we blocked due to cut limit (shouldn't happen but safety check)
        if (!window.isPracticeMode) {
            console.log('🔓 Re-enabling canvas after cut limit block (safety)');
            canvas.style.pointerEvents = 'none'; // Keep it disabled since at limit
            isInteractionEnabled = false;
            window.isInteractionEnabled = false;
        }
        return;
    }

    // DAILY MODE: Block if attempt number exceeds 1 (backup check)
    if (isDailyMode && currentAttemptNumber > 1) {
        console.log('🚫 CUT BLOCKED: Daily mode - Attempt number', currentAttemptNumber, 'exceeds maximum of 1 per shape');
        // Re-enable canvas if we blocked due to attempt limit (shouldn't happen but safety check)
        if (!window.isPracticeMode) {
            console.log('🔓 Re-enabling canvas after attempt limit block (safety)');
            canvas.style.pointerEvents = 'none'; // Keep it disabled since at limit
            isInteractionEnabled = false; 
            window.isInteractionEnabled = false;
        }
        return;
    }
    
    // Block if game state is not 'cutting' (check practice mode state for practice mode)
    const effectiveGameState = window.isPracticeMode ? window.gameState : gameState;
    if (effectiveGameState !== 'cutting') {
        console.log('🚫 CUT BLOCKED: Game state is', effectiveGameState, 'not "cutting"', window.isPracticeMode ? '(practice mode)' : '(daily mode)');
        return;
    }
    
    // Block if interaction is disabled (check practice mode state for practice mode)
    const effectiveInteractionEnabled = window.isPracticeMode ? window.isInteractionEnabled : isInteractionEnabled;
    if (!effectiveInteractionEnabled) {
        console.log('🚫 CUT BLOCKED: Interaction is disabled', window.isPracticeMode ? '(practice mode)' : '(daily mode)');
        return;
    }
    
    // Increment counters BEFORE proceeding (ONLY for daily/demo mode, NOT practice mode)
    if (!window.isPracticeMode) {
        totalCutsMade++;
        cutsMadeThisShape++;
        window.totalCutsMade = totalCutsMade; // Keep window variable in sync
        window.cutsMadeThisShape = cutsMadeThisShape; // Keep window variable in sync
    } else {
        console.log('🎯 Practice mode: NOT incrementing daily game counters');
    }
    
    console.log('✅ Cut allowed - Attempt:', currentAttemptNumber, 'Shape:', currentShapeNumber, 'State:', gameState);
    console.log('✅ Updated counters - totalCuts:', totalCutsMade, 'cutsThisShape:', cutsMadeThisShape);
    
    // DAILY MODE: IMMEDIATELY deactivate canvas to prevent rapid multiple cuts
    if (isDailyMode && !isPracticeMode) {
        console.log('🔒 IMMEDIATE: Deactivating canvas to prevent multiple rapid cuts');
        canvas.style.pointerEvents = 'none';
        isInteractionEnabled = false;
        window.isInteractionEnabled = false;
    }
    
    // Create a temporary canvas to render shapes for pixel analysis
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Render shapes on temporary canvas - use practice mode shapes if in practice mode
    // CRITICAL: Practice mode must use practiceParsedShapes, NOT window.parsedShapes (which contains daily shapes)
    const shapesToAnalyze = window.isPracticeMode ?
                           (window.practiceMode?.practiceParsedShapes || window.parsedShapes || []) :
                           (parsedShapes || []);

    console.log(`🔍 CRITICAL: renderShapesForPixelAnalysis using ${shapesToAnalyze.length} shapes (isPracticeMode: ${window.isPracticeMode})`);
    if (window.isPracticeMode) {
        console.log('🎮 PRACTICE: Using practice shapes for pixel analysis:', shapesToAnalyze[0]?.coordinates?.length || 'no shape', 'vertices');
    }
    renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
    
    // Get pixel data
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    
    // Check if shape-based mechanic already calculated area results
    let areaResults;
    if (window.currentAreaResults) {
        console.log('🔥 MAIN: Using pre-calculated area results from shape-based mechanic');
        areaResults = window.currentAreaResults;
        
        // Ensure currentVector is set from window.currentVector (from shape-based mechanic)
        if (window.currentVector && !currentVector) {
            currentVector = window.currentVector;
        }
    } else {
        // Calculate areas on each side of the vector (for line-based cuts)
        const vectorForCalculation = window.currentVector || currentVector;
        if (!vectorForCalculation) {
            console.error('❌ No vector available for area calculation');
            return;
        }
        areaResults = calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, vectorForCalculation);
        // Set global currentVector for compatibility
        currentVector = vectorForCalculation;
    }
    
    console.log('Valid cut - Area Results:', areaResults.leftPercentage, areaResults.rightPercentage);

    // CRITICAL: Validate that the cut actually divided the shape (not 0/100 or 100/0)
    const leftRounded = Math.round(areaResults.leftPercentage);
    const rightRounded = Math.round(areaResults.rightPercentage);

    if ((leftRounded === 0 && rightRounded === 100) || (leftRounded === 100 && rightRounded === 0)) {
        console.log('🚫 INVALID CUT: Cut resulted in 0/100 split - treating as miss');

        // Roll back counters that were incremented earlier (daily mode only)
        if (!window.isPracticeMode) {
            totalCutsMade--;
            cutsMadeThisShape--;
            window.totalCutsMade = totalCutsMade;
            window.cutsMadeThisShape = cutsMadeThisShape;
            console.log('🔄 Rolled back counters - totalCuts:', totalCutsMade, 'cutsThisShape:', cutsMadeThisShape);
        }

        // Re-enable canvas for next attempt (both daily and practice mode)
        if (window.isPracticeMode) {
            console.log('🔓 Practice mode: Re-enabling canvas after invalid cut');
            // Practice mode uses its own interaction state
            if (window.practiceMode && typeof window.practiceMode.enableCanvasInteraction === 'function') {
                window.practiceMode.enableCanvasInteraction();
            }
        } else if (isDailyMode) {
            console.log('🔓 Daily mode: Re-enabling canvas after invalid cut');
            canvas.style.pointerEvents = 'auto';
            isInteractionEnabled = true;
            window.isInteractionEnabled = true;
        }

        // Show "Try again" message (handleMiss works for both modes)
        handleMiss();
        return;
    }

    // Calculate score for both practice and daily modes (needed for confetti)
    const score = ShapeTypeHandler.calculateShape1Score(areaResults.leftPercentage, areaResults.rightPercentage);
    
    // For practice mode, show instructions instead of commentary
    if (window.isPracticeMode) {
        // In practice mode, show initial instruction instead of commentary
        const practiceMechanic = getPracticeMechanicName();
        const initialInstruction = getInitialInstruction(practiceMechanic);
        if (window.updateInstructionText && initialInstruction) {
            // Add a small delay to ensure the instruction appears after any visual updates
            setTimeout(() => {
                window.updateInstructionText(initialInstruction, false);

                // FORCE INSTRUCTION AREA VISIBILITY for practice mode
                const instructionArea = document.getElementById('instructionArea');
                if (instructionArea) {
                    instructionArea.style.display = 'flex';
                    instructionArea.style.visibility = 'visible';
                    instructionArea.style.opacity = '1';
                    console.log('🔧 FORCED instruction area visibility for practice mode');
                }

                console.log('🎮 Practice mode - restored initial instruction:', initialInstruction);
            }, 500);
        }
    } else {
        // Daily mode - show commentary as before
        console.log('🎯 Score calculation - Percentages:', areaResults.leftPercentage, '/', areaResults.rightPercentage, 'Score:', score);
        const commentary = getCommentary(areaResults.leftPercentage, areaResults.rightPercentage);
        console.log('🎯 Showing cut commentary:', commentary);
        if (window.updateInstructionText) {
            window.updateInstructionText(commentary, true); // true for bold styling
            console.log('🎯 Commentary sent to updateInstructionText');
        } else {
            console.error('🎯 updateInstructionText not available');
        }
    }
    
    // Perfect cut detection and fireworks are handled in showAttemptResult to avoid duplicate triggers
    
    // Clear shape-based area results after using them
    if (window.currentAreaResults) {
        window.currentAreaResults = null;
        console.log('🔥 MAIN: Cleared shape-based area results');
    }
    
    // Store attempt result for tracking (both demo and normal mode, but NOT practice mode)
    if (!window.isPracticeMode) {
        const attemptResult = {
            attemptNumber: attemptCount,
            leftPercentage: areaResults.leftPercentage,
            rightPercentage: areaResults.rightPercentage,
            cutVector: { ...currentVector },
            splitAreas: {
                left: areaResults.leftArea,
                right: areaResults.rightArea
            },
            timestamp: new Date().toISOString()
        };

        // CRITICAL: Save triangle points for Triangle mechanic restoration
        if (window.triangleCutResult && window.triangleCutResult.triangle) {
            attemptResult.trianglePoints = window.triangleCutResult.triangle.points;
            console.log('💾 Saved triangle points to attempt:', attemptResult.trianglePoints);
        }

        currentAttempts.push(attemptResult);
        // CRITICAL: Sync local array to window for SimpleRefresh to save
        window.currentAttempts = [...currentAttempts];
        window.debugCurrentAttempts('cut-processing', 'PUSHED new attempt result');

        // CRITICAL: Save to SimpleRefresh immediately after syncing attempt data
        if (window.SimpleRefresh && window.SimpleRefresh.save) {
            window.SimpleRefresh.save();
            console.log('💾 SimpleRefresh: Saved state immediately after cut processing');
        }
    }
    
    // Record score for stats tracking (in demo mode, but NEVER in practice mode)
    if (isDemoMode && !window.isPracticeMode && currentDay && currentShapeNumber) {
        recordAttemptScore(currentDay, currentShapeNumber, areaResults.leftPercentage, areaResults.rightPercentage);
        
        // Refresh protection disabled
    }
    
    // IMPORTANT: For v3.0, we need to track that an attempt has been used
    // even before the user chooses Retry/Commit (but NOT in practice mode)
    if (!window.isPracticeMode && currentAttempts.length > attemptCount) {
        attemptCount = currentAttempts.length;
        console.log('📊 Attempt count updated to match attempts made:', attemptCount);
        console.log('📊 maxAttempts:', maxAttempts, 'isPracticeMode:', isPracticeMode);
    }
    
    // Always save to database for local testing (but NOT in practice mode)
    // Track attempt made
    if (!window.isPracticeMode && window.Analytics) {
        window.Analytics.trackAttemptMade(attemptCount, areaResults.leftPercentage, areaResults.rightPercentage);
    }
    
    // Save score automatically for logged-in users (v4.0 competition-ready scoring)
    // SKIP ALL DATABASE OPERATIONS IN PRACTICE MODE
    if (window.isPracticeMode) {
        console.log('🎮 Practice mode - skipping database save and competition updates');
    } else if (window.AuthService && window.AuthService.isLoggedIn()) {
        try {
            // Get the current date in YYYY-MM-DD format
            const today = new Date();
            const dateString = today.toISOString().split('T')[0];
            
            console.log('🔍 DEBUG: Starting automatic score save for logged-in user');
            console.log('   Current shape number:', currentShapeNumber);
            console.log('   Current attempt:', attemptCount);
            console.log('   Current date:', dateString);
            console.log('   Current mechanic:', getCurrentMechanicName());
            
            // Build shape scores object - accumulate ALL shapes played so far
            const shapeScores = {};
            
            // First, get any existing scores from the database to preserve previous shapes
            console.log('🔍 DEBUG: Fetching existing scores from database for accumulation...');
            try {
                const existingScore = await window.AuthService.getExistingDailyScore(dateString);
                if (existingScore) {
                    console.log('🔍 DEBUG: Found existing score record:', existingScore);
                    // Add existing scores from database
                    for (let i = 1; i <= 3; i++) {
                        const shapeKey = `shape${i}`;
                        const attempt1Key = `${shapeKey}_attempt1`;
                        const attempt2Key = `${shapeKey}_attempt2`;
                        
                        if (existingScore[attempt1Key] !== null || existingScore[attempt2Key] !== null) {
                            shapeScores[shapeKey] = {
                                attempt1: existingScore[attempt1Key],
                                attempt2: existingScore[attempt2Key]
                            };
                        }
                    }
                } else {
                    console.log('🔍 DEBUG: No existing score record found - starting fresh');
                }
            } catch (error) {
                console.error('❌ ERROR: Failed to fetch existing scores:', error);
                // Continue without existing scores
            }
            
            // Now update the current shape's scores
            const shapeNum = currentShapeNumber;
            const shapeKey = `shape${shapeNum}`;
            
            // Update current shape's score (1 attempt per shape)
            if (!shapeScores[shapeKey]) {
                shapeScores[shapeKey] = {
                    attempt1: null
                };
            }

            // Add the current attempt (just made)
            const currentScore = calculateScore(areaResults.leftPercentage, areaResults.rightPercentage);
            shapeScores[shapeKey].attempt1 = currentScore;
            
            console.log('📊 DEBUG: Shape scores prepared for saving:', JSON.stringify(shapeScores, null, 2));
            console.log('ℹ️ Daily score will be saved during final completion, not after each attempt');
        } catch (error) {
            console.error('❌ Failed to prepare score data:', error);
            // Continue game regardless of score preparation failure
        }
    } else {
        console.log('ℹ️ DEBUG: Score preparation skipped - user not logged in');
    }
    
    // PRACTICE MODE: Intercept results before rendering
    if (window.isPracticeMode) {
        console.log('🔪 Practice mode cut detected - intercepting results');
        // Store the current vector before calling practice complete handler
        // CRITICAL: Use window.currentVector which has the extended coordinates
        const vectorForPracticeRendering = window.currentVector || currentVector;
        console.log('🔧 Practice mode vector for rendering:', {
            hasWindowVector: !!window.currentVector,
            hasCurrentVector: !!currentVector,
            vectorStart: vectorForPracticeRendering?.start,
            vectorEnd: vectorForPracticeRendering?.end
        });
        handlePracticeCutComplete(areaResults, vectorForPracticeRendering);
        return; // Don't continue with daily game logic
    }
    
    // CRITICAL: Clear canceled line drawing flag just before rendering to ensure visual shading works
    if (window.canceledLineDrawing) {
        console.log('🔧 Clearing canceledLineDrawing flag just before rendering to fix shading');
        window.canceledLineDrawing = false;
    }

    // CRITICAL: Skip rendering if Triangle mechanic has already rendered the result
    if (window.triangleCutActive && window.triangleCutResult) {
        console.log('✅ Triangle mechanic already rendered result - skipping main.js rendering to preserve grid and outline');
    } else {
        // Render the result with color coding BEFORE capturing
        renderVectorCutResult(areaResults);
        console.log('🎨 handleCutAttempt - rendered colored cut result, isPracticeMode:', isPracticeMode);
    }
    
    // Disable canvas interaction during animation
    canvas.style.pointerEvents = 'none';

    // PRACTICE MODE: Keep cutting state for unlimited cuts
    if (window.isPracticeMode) {
        // Don't change game state in practice mode - keep it as 'cutting'
        console.log('🎮 PRACTICE MODE: Keeping gameState as cutting for unlimited cuts');

        // Re-enable canvas interaction immediately for practice mode after a short delay
        setTimeout(() => {
            if (window.isPracticeMode) {
                canvas.style.pointerEvents = 'auto';
                window.gameState = 'cutting';
                window.isInteractionEnabled = true;
                console.log('🎮 PRACTICE MODE: Canvas re-enabled for next cut');
            }
        }, 2000); // 2 second delay to let user see the result
    } else {
        gameState = 'animating';
    }
    
    // DAILY MODE: Force disable interaction to prevent additional cuts
    if (isDailyMode) {
        isInteractionEnabled = false;
        window.isInteractionEnabled = false;
        console.log('🚫 DAILY MODE: Canvas interaction force disabled after cut');
    }
    
    // Show split percentages immediately as cut is made
    // In test lab mode, we want to see the results even though it's "practice mode"
    showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
    
    if (!window.isPracticeMode) {
        // Ensure progress circles are visible and update them
        const progressCircles = document.getElementById('progressCircles');
        if (progressCircles) {
            progressCircles.style.display = 'flex';
            progressCircles.style.opacity = '1';
        }
        updateProgressCircles(attemptCount);
    }
    
    // For attempts 1 and 2: Set awaiting_choice state immediately to handle refresh during animation
    // ONLY in daily mode - practice/demo modes should continue cutting
    if (isDailyMode && attemptCount < maxAttempts) {
        gameState = 'awaiting_choice';
        isInteractionEnabled = false;
        
        console.log('🎯 Daily mode: Canvas deactivated after cut - awaiting user decision');
        
        // CRITICAL: Create progression button for daily mode (like demo mode does)
        console.log('🔘 DAILY MODE: Creating progression button after cut');
        createProgressionButton();
        
        // Save game state and structured state immediately
        console.log('💾 Saving awaiting_choice state before animation:', {
            attemptCount,
            currentAttemptsLength: currentAttempts.length,
            gameState
        });
        saveGameState();
        saveStructuredGameState();
    }
    
    // Check if this is the max attempt (only in daily mode, not demo mode)
    if (isDailyMode && !isDemoMode && attemptCount >= maxAttempts) {
        // On 3rd attempt: first show the 3rd cut with fade animation, then show best result
        console.log('🎯 3rd attempt reached - showing cut fade, then finding best attempt');
        
        // Mark game as finished immediately to prevent refresh issues
        gameState = 'finished';
        
        // Find best attempt immediately to save final data
        const bestAttempt = currentAttempts.reduce((best, attempt) => {
            const currentDiff = Math.abs(50 - attempt.leftPercentage);
            const bestDiff = Math.abs(50 - best.leftPercentage);
            return currentDiff < bestDiff ? attempt : best;
        });
        
        // Set finalLockedScore immediately
        finalLockedScore = {
            leftPercentage: bestAttempt.leftPercentage,
            rightPercentage: bestAttempt.rightPercentage
        };
        
        // Save comprehensive state for refresh recovery
        const today = getCurrentDateString();
        localStorage.setItem(STORAGE_KEYS.lastPlayDate, today);
        localStorage.setItem(STORAGE_KEYS.gamePhase, 'post-play');
        localStorage.setItem(STORAGE_KEYS.isFinished, 'true');
        localStorage.setItem(STORAGE_KEYS.hasTriedToday, 'true');
        saveGameState();
        saveStructuredGameState();
        
        try {
            // First, perform the same fade animation as attempts 1 and 2
            console.log('🎮 Starting 3rd attempt fade animation...');
            
            // Add timeout to prevent hanging
            const fadeTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fade animation timeout')), 5000)
            );
            
            await Promise.race([performFadeAnimation(), fadeTimeout]);
            console.log('✅ 3rd attempt fade animation complete');
            
            // Now find the best attempt and show final results
        console.log('📊 All attempts for comparison:', currentAttempts.map(a => ({
            attempt: a.attemptNumber,
            leftPercent: a.leftPercentage.toFixed(1),
            rightPercent: a.rightPercentage.toFixed(1),
            deviation: (Math.abs(a.leftPercentage - 50) + Math.abs(a.rightPercentage - 50)).toFixed(1)
        })));
        const bestAttempt = findBestAttempt(currentAttempts);
        finalLockedScore = bestAttempt;
        
        // Save final score data immediately for refresh recovery
        localStorage.setItem(STORAGE_KEYS.finalScoreData, JSON.stringify({
            leftPercentage: bestAttempt.leftPercentage,
            rightPercentage: bestAttempt.rightPercentage,
            attemptCount: attemptCount,
            cutVector: bestAttempt.cutVector,
            splitAreas: bestAttempt.splitAreas
        }));
        
        // Update currentVector to be the best attempt's cut vector for final rendering
        currentVector = bestAttempt.cutVector;
        
        // Render the pre-cut grey shape first (no clearing, keep existing state)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        renderCurrentShape(); // Show the grey shape without any cuts
        
        // Prepare the best attempt's cut data for fade-in
        const bestAttemptAreaResults = {
            leftPercentage: bestAttempt.leftPercentage,
            rightPercentage: bestAttempt.rightPercentage,
            leftArea: bestAttempt.splitAreas.left,
            rightArea: bestAttempt.splitAreas.right
        };
        
        // Directly render the best cut result without animation
        console.log('🎮 Rendering best cut result...');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set currentVector for rendering
        currentVector = bestAttempt.cutVector;
        
        // CRITICAL: Clear canceled line drawing flag just before rendering to ensure visual shading works
        if (window.canceledLineDrawing) {
            console.log('🔧 Best attempt: Clearing canceledLineDrawing flag just before rendering to fix shading');
            window.canceledLineDrawing = false;
        }
        
        renderVectorCutResult(bestAttemptAreaResults);
        console.log('✅ Best cut rendered');
        
        // Animation removed - direct rendering for daily game mode
        console.log('✅ Direct rendering complete');
        
        // Remove attempt buttons (matching commit flow)
        const buttonsDiv = document.querySelector('.attempt-buttons');
        if (buttonsDiv) {
            buttonsDiv.remove();
        }
        
        // After committed result animation, show share button and countdown (no canvas fade needed)
        showPostLockInElements();
        
        // Submit to Supabase
        try {
            await supabaseClient.submitAttemptV3(
                currentDate,
                bestAttempt.leftPercentage,
                bestAttempt.rightPercentage,
                attemptCount
            );
            console.log('✅ Final score submitted successfully');
        } catch (error) {
            console.error('Failed to submit final score:', error);
        }
        
        // Show final state
        gameState = 'locked';
        
        // Track game completion
        if (window.Analytics && finalLockedScore) {
            window.Analytics.trackGameComplete(attemptCount, finalLockedScore);
        }
        
        saveGameState(); // Save final game state
        saveStructuredGameState(); // Save structured final state
        await showFinalState();
        
        // Game complete - no stats popup in v3.0
        } catch (error) {
            console.error('💥 Error in end-of-game sequence:', error);
            // Fallback: show final state anyway
            gameState = 'locked';
            saveGameState();
            saveStructuredGameState();
            await showFinalState();
        }
    } else if (isDemoMode) {
        // Demo mode: handle progression with attempt limits
        console.log('🎮 Demo mode cut completed');
        console.log('🎮 Current state - Attempt:', currentAttemptNumber, 'Shape:', currentShapeNumber);
        console.log('🎮 Cuts made this shape:', cutsMadeThisShape, 'Total cuts:', totalCutsMade);
        console.log('🎮 isDemoMode:', isDemoMode, 'isPracticeMode:', isPracticeMode);
        
        // Determine what happens next based on cuts made this shape
        if (cutsMadeThisShape >= 1) {
            // Cut completed on this shape - show Next Shape or completion
            console.log('✅ Cut completed on shape', currentShapeNumber);
            currentAttemptNumber = 1;
            window.currentAttemptNumber = currentAttemptNumber;

            // Update UI and show appropriate button (Next Shape or completion)
            updateProgressUI();
            createProgressionButton();

            // Disable further interaction until button is clicked
            gameState = 'awaiting_choice';
            isInteractionEnabled = false;
        } else {
            console.error('⚠️ Unexpected cuts made this shape:', cutsMadeThisShape);
            // Set safe defaults in error case
            gameState = 'awaiting_choice';
            isInteractionEnabled = false;
        }
    } else if (isPracticeMode) {
        // Practice mode: show staggered instructions with cut solidification
        console.log('🎮 Practice mode cut - showing staged instructions');
        await handlePracticeModeCut(areaResults);
    } else {
        // For attempts 1 and 2: fade animation then automatically prepare for next attempt
        await performFadeAnimation();
        // Automatically proceed to next attempt after a short delay
        setTimeout(() => {
            handleTryAgain();
        }, 1000); // 1 second delay to let user see the result
    }

    // Clear triangle protection flags now that rendering is complete
    if (window.triangleCutActive) {
        console.log('🧹 handleCutAttempt complete - clearing triangle protection flags');
        window.triangleCutActive = false;
        window.triangleCutResult = null;
    }

    // Save state after cut is completed
    saveDemoGameState();
}

// v3.0 - Score calculation removed - now just track percentages

// Find the best attempt (closest to 50%/50% split)
function findBestAttempt(attempts) {
    if (!attempts || attempts.length === 0) return null;
    
    let bestAttempt = attempts[0];
    let bestScore = Math.abs(bestAttempt.leftPercentage - 50) + Math.abs(bestAttempt.rightPercentage - 50);
    
    for (let i = 1; i < attempts.length; i++) {
        const attempt = attempts[i];
        const score = Math.abs(attempt.leftPercentage - 50) + Math.abs(attempt.rightPercentage - 50);
        
        // Lower score means closer to perfect 50/50 split
        if (score < bestScore) {
            bestScore = score;
            bestAttempt = attempt;
        }
    }
    
    console.log('🎯 Best attempt selected:', {
        attemptNumber: bestAttempt.attemptNumber,
        leftPercentage: bestAttempt.leftPercentage.toFixed(1),
        rightPercentage: bestAttempt.rightPercentage.toFixed(1),
        deviationFromPerfect: bestScore.toFixed(1),
        totalAttempts: attempts.length
    });
    
    return bestAttempt;
}

// v3.0 - Prepare canvas states for fade animation
async function prepareCanvasForFade() {
    try {
        // Save the base state (just grid and grey shape) for final state
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 380;
        tempCanvas.height = 380;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw just grid and grey shape
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        drawGrid(tempCtx);
        renderShapeForCutting(parsedShapes, false, tempCtx);
        
        canvasRestoreData = tempCanvas.toDataURL('image/png');
        
        console.log('📸 Prepared canvas states for fade animation');
    } catch (error) {
        console.error('Failed to prepare canvas:', error);
    }
}

// v3.0 - Perform fade animation - holds at full opacity for 1s, then fades over 3 seconds
async function performFadeAnimation() {
    return new Promise((resolve) => {
        const holdDuration = 1000; // Hold at full opacity for 1 second
        const fadeDuration = 3000; // Then fade over 3 seconds
        const totalDuration = holdDuration + fadeDuration;
        const fadeStartTime = Date.now();
        
        // Capture the current colored state as an image
        const coloredCutImage = new Image();
        coloredCutImage.src = canvas.toDataURL('image/png');
        
        // Prepare the base grey shape canvas
        prepareCanvasForFade();
        
        coloredCutImage.onload = () => {
            const fadeFrame = () => {
                const elapsed = Date.now() - fadeStartTime;
                const totalProgress = Math.min(elapsed / totalDuration, 1);
                
                let alpha;
                if (elapsed < holdDuration) {
                    // Hold phase: stay at full opacity
                    alpha = 1;
                } else {
                    // Fade phase: fade from 1 to 0 over fadeDuration
                    const fadeElapsed = elapsed - holdDuration;
                    const fadeProgress = Math.min(fadeElapsed / fadeDuration, 1);
                    alpha = 1 - fadeProgress;
                }
                
                // Clear canvas and draw base grey shape
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawGrid(ctx);
                renderShapeForCutting(parsedShapes, false, ctx);
                
                // Draw the colored cut result with fading alpha
                if (alpha > 0) {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(coloredCutImage, 0, 0);
                    ctx.restore();
                }
                
                if (totalProgress < 1) {
                    requestAnimationFrame(fadeFrame);
                } else {
                    // Animation complete - wait 300ms then show buttons
                    setTimeout(() => {
                        resolve();
                    }, 300);
                }
            };
            
            fadeFrame();
        };
    });
}

// Practice mode handler - simplified without staggered instructions
async function handlePracticeModeCut(areaResults) {
    console.log('🎮 Practice mode cut - simplified flow');
    
    // For practice mode, just show appropriate instruction based on cutting mechanism
    setTimeout(async () => {
        // Reset to initial instruction for next cut using practice mechanic
        const practiceMechanic = getPracticeMechanicName();
        const initialInstruction = getInitialInstruction(practiceMechanic);
        if (window.updateInstructionText) {
            window.updateInstructionText(initialInstruction, false);
            console.log('🎮 Practice mode - reset to initial instruction:', initialInstruction);
        }
        
        // Always show play button after any practice cut
        await showPlayButtonForPractice();
        
        // Reset canvas interaction for next practice cut AFTER fade completes
        resetPracticeForNextCut();
    }, 1000); // Simplified timing
}

// Practice mode fade animation - slower 1.5 second fade for render
async function performPracticeRenderFade() {
    return new Promise((resolve) => {
        const holdDuration = 500; // Hold for 0.5 seconds
        const fadeDuration = 1500; // Slower 1.5 second fade
        const totalDuration = holdDuration + fadeDuration;
        const fadeStartTime = Date.now();
        
        // The colored cut should already be rendered by handleCutAttempt()
        console.log('🎨 Practice fade - starting with existing colored cut on canvas');
        
        // Capture the current colored state as an image immediately
        const coloredCutImage = new Image();
        coloredCutImage.src = canvas.toDataURL('image/png');
        
        // Debug: Check if we have a currentVector and canvas state
        console.log('🎨 Practice fade - currentVector exists:', !!currentVector);
        console.log('🎨 Practice fade - canvas data URL length:', coloredCutImage.src.length);
        console.log('🎨 Practice fade - parsedShapes length:', parsedShapes.length);
        
        // DEBUG: Check if the canvas actually has colored pixels before capturing
        const debugImageData = ctx.getImageData(0, 0, 380, 380);
        const debugPixels = debugImageData.data;
        let bluePixelsInCanvas = 0;
        let greyPixelsInCanvas = 0;
        for (let i = 0; i < debugPixels.length; i += 4) {
            if (debugPixels[i] === 100 && debugPixels[i+1] === 150 && debugPixels[i+2] === 255) {
                bluePixelsInCanvas++;
            } else if (debugPixels[i] === 221 && debugPixels[i+1] === 221 && debugPixels[i+2] === 221) {
                greyPixelsInCanvas++;
            }
        }
        console.log('🎨 Canvas pixels before capture:', { bluePixelsInCanvas, greyPixelsInCanvas });
        
        // Prepare the base grey shape canvas
        prepareCanvasForFade();
        
        // Add error handler for image loading
        coloredCutImage.onerror = () => {
            console.error('🎨 Failed to load colored cut image');
            resolve(); // Still resolve to prevent hanging
        };
        
        coloredCutImage.onload = () => {
            console.log('🎨 Colored cut image loaded successfully for practice fade');
            console.log('🎨 Image dimensions:', coloredCutImage.width, 'x', coloredCutImage.height);
            const fadeFrame = () => {
                const elapsed = Date.now() - fadeStartTime;
                const totalProgress = Math.min(elapsed / totalDuration, 1);
                
                let alpha;
                if (elapsed < holdDuration) {
                    // Hold phase: stay at full opacity
                    alpha = 1;
                } else {
                    // Slower fade phase: fade from 1 to 0 over fadeDuration
                    const fadeElapsed = elapsed - holdDuration;
                    const fadeProgress = Math.min(fadeElapsed / fadeDuration, 1);
                    alpha = 1 - fadeProgress;
                }
                
                // Clear canvas and draw grid
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawGrid(ctx);
                
                // Draw the colored cut result with fading alpha
                if (alpha > 0 && coloredCutImage.complete) {
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(coloredCutImage, 0, 0);
                    ctx.restore();
                    if (elapsed % 500 < 50) { // Log every half second to avoid spam
                        console.log('🎨 Drawing colored cut image with alpha:', alpha);
                    }
                } 
                
                // As alpha decreases, fade in the base grey shape
                if (alpha < 1) {
                    ctx.save();
                    ctx.globalAlpha = 1 - alpha; // Inverse alpha for base shape
                    renderShapeForCutting(parsedShapes, false, ctx);
                    ctx.restore();
                    if (elapsed % 500 < 50) {
                        console.log('🎨 Drawing base grey shape with alpha:', 1 - alpha);
                    }
                } else if (elapsed % 500 < 50) {
                    console.log('🎨 Skipping base grey shape - colored cut at full alpha');
                }
                
                if (totalProgress < 1) {
                    requestAnimationFrame(fadeFrame);
                } else {
                    // Animation complete
                    resolve();
                }
            };
            
            fadeFrame();
        };
    });
}

// v3.0 - Perform lock-in display - fades the cut back to full opacity over 1 second
async function performLockInFadeAnimation(areaResults) {
    return new Promise((resolve) => {
        const duration = 1000; // 1 second
        const startTime = performance.now();
        
        function animateFrame(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Clear canvas and draw base grey shape
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid(ctx);
            renderShapeForCutting(parsedShapes, false, ctx);
            
            // Fade the cut from 0.3 opacity back to 1.0 opacity
            const startOpacity = 0.3;
            const endOpacity = 1.0;
            const currentOpacity = startOpacity + (endOpacity - startOpacity) * progress;
            
            // Re-render the vector cut with gradually increasing opacity
            renderVectorCutResultWithOpacity(areaResults, currentOpacity);
            
            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                resolve();
            }
        }
        
        requestAnimationFrame(animateFrame);
    });
}


// Show committed result instantly (for reduced motion)
function showCommittedResultInstant(attemptResult, todaysAverage) {
    const resultsContainer = document.querySelector('.results-container');
    const existingResult = resultsContainer.querySelector('.attempt-result');
    if (existingResult) {
        existingResult.remove();
    }
    
    createCommittedResultDisplay(attemptResult, todaysAverage, resultsContainer, false);
    
    // For post-play restoration, immediately show the table contents
    const attemptsToShow = currentAttempts && currentAttempts.length > 0 ? currentAttempts : [attemptResult];
    // Immediately populate the table without animation delay
    animateStatsTable(attemptsToShow, todaysAverage);
}

// Show committed result with fade-in animation
function showCommittedResultWithFadeIn(attemptResult, todaysAverage) {
    const resultsContainer = document.querySelector('.results-container');
    const existingResult = resultsContainer.querySelector('.attempt-result');
    if (existingResult) {
        existingResult.remove();
    }
    
    createCommittedResultDisplay(attemptResult, todaysAverage, resultsContainer, true);
}

// Create the new medal-based stats table that populates with animation
function createMedalStatsTable(attempts, todaysAverage, resultsContainer) {
    console.log('🏅 Creating medal stats table with:', {
        attemptsCount: attempts?.length,
        attempts: attempts,
        todaysAverage,
        resultsContainer: !!resultsContainer
    });
    
    const resultDiv = document.createElement('div');
    resultDiv.className = 'attempt-result';
    resultDiv.id = 'medalStatsTable';
    
    // Create the table structure (invisible table)
    resultDiv.innerHTML = `
        <div class="attempt-info">
            <div class="medal-stats-table">
                <div class="stats-row" id="attempt1Row" style="opacity: 0;">
                    <div class="medal">🥇</div>
                    <div class="attempt-split" id="attempt1Split">--.- % / --.- %</div>
                </div>
                <div class="stats-row" id="attempt2Row" style="opacity: 0;">
                    <div class="medal">🥈</div>
                    <div class="attempt-split" id="attempt2Split">--.- % / --.- %</div>
                </div>
                <div class="stats-row" id="attempt3Row" style="opacity: 0;">
                    <div class="medal">🥉</div>
                    <div class="attempt-split" id="attempt3Split">--.- % / --.- %</div>
                </div>
            </div>
        </div>
    `;
    
    if (resultsContainer) {
        // CORRECT POSITIONING: Medal stats always go after results table, before progress circles
        const resultsTable = resultsContainer.querySelector('.results-table');
        const progressCircles = resultsContainer.querySelector('#progressCircles');
        
        // Use dedicated container for consistent positioning
        const dynamicContainer = document.getElementById('dynamicResultsContainer');
        if (dynamicContainer) {
            dynamicContainer.appendChild(resultDiv);
            console.log('🏅 Medal stats positioned in dedicated container');
        } else {
            // Fallback: append to results container
            resultsContainer.appendChild(resultDiv);
            console.log('⚠️ Fallback: Medal stats appended to results container');
        }
    } else {
        console.error('🏅 No results container found!');
    }
    return resultDiv;
}

// Animate the stats table population coordinated with fade-in
async function animateStatsTable(attempts, todaysAverage) {
    const animationDelay = 300; // Delay between each row
    
    // First, rank attempts by how close they are to 50/50
    const rankedAttempts = [...attempts].map((attempt, index) => ({
        ...attempt,
        originalIndex: index,
        // Calculate how far from perfect 50/50 split
        accuracy: Math.abs(50 - attempt.leftPercentage)
    })).sort((a, b) => a.accuracy - b.accuracy);
    
    // Medals are fixed: gold at top, silver middle, bronze bottom
    const medals = ['🥇', '🥈', '🥉'];
    
    // Populate attempt rows in ranked order (best to worst)
    for (let i = 0; i < Math.min(rankedAttempts.length, 3); i++) {
        const attempt = rankedAttempts[i]; // Use ranked attempts instead of original order
        const rowId = `attempt${i + 1}Row`;
        const splitId = `attempt${i + 1}Split`;
        const medal = medals[i]; // Medal corresponds to position in ranking
        
        setTimeout(() => {
            const row = document.getElementById(rowId);
            const split = document.getElementById(splitId);
            const medalDiv = row?.querySelector('.medal');
            
            if (row && split) {
                // Medal is already set in HTML, but update if needed
                if (medalDiv) {
                    medalDiv.textContent = medal;
                }
                
                // Update the split text with the ranked attempt's data
                split.innerHTML = `<span style="color: #000000;">${attempt.leftPercentage.toFixed(1)}%</span> / <span style="color: #000000;">${attempt.rightPercentage.toFixed(1)}%</span>`;
                
                // Fade in the row
                row.style.transition = 'opacity 400ms ease-out';
                row.style.opacity = '1';
            }
        }, i * animationDelay);
    }
}

// Legacy function - now redirects to new medal stats table
function createCommittedResultDisplay(attemptResult, todaysAverage, resultsContainer, withFadeIn) {
    console.log('🏅 Creating committed result display with:', {
        currentAttempts: currentAttempts?.length,
        attemptResult,
        todaysAverage,
        withFadeIn
    });
    
    // Use currentAttempts if available, otherwise create array with just the best attempt
    const attemptsToShow = currentAttempts && currentAttempts.length > 0 ? currentAttempts : [attemptResult];
    
    // Use the new medal stats table instead
    createMedalStatsTable(attemptsToShow, todaysAverage, resultsContainer);
    
    // Trigger animation if requested
    if (withFadeIn) {
        setTimeout(() => {
            animateStatsTable(attemptsToShow, todaysAverage);
        }, 200);
    }
}

// v3.0 - Show attempt result beneath canvas (percentages only)
function showAttemptResult(leftPercentage, rightPercentage) {
    // Round percentages to whole numbers
    const leftRounded = Math.round(leftPercentage);
    const rightRounded = Math.round(rightPercentage);

    console.log('🧪 Cut results:', leftRounded, rightRounded);

    // Check for perfect 50/50 cut in daily mode only (any split that rounds to 50/50)
    if (!isPracticeMode && leftRounded === 50 && rightRounded === 50) {
        console.log('🎯 Perfect 50/50 cut achieved in daily mode!');

        // Trigger fireworks animation!
        if (window.completeView && window.completeView.createConfetti) {
            // Trigger fireworks - consistent celebration for all shapes
            window.completeView.createConfetti(
                window.innerWidth / 2,
                window.innerHeight / 2,
                '#FFD700' // Gold base color
            );
            console.log('🎉 Fireworks triggered for perfect cut!');
        }

        // Track perfect cut
        if (window.AuthService && !window.AuthService.isGuest) {
            window.AuthService.trackPerfectCut();
        }
    }
    
    // Test lab mode - create result display like v3.2
    if (window.isPracticeMode) {
        // Clear any table body content that might show old results
        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
        }
        
        // Create or update attempt result display
        const resultsContainer = document.querySelector('.results-container');
        if (!resultsContainer) return;
        
        // Remove previous attempt results
        const previousAttemptResults = document.querySelectorAll('.attempt-result');
        previousAttemptResults.forEach(result => {
            result.remove();
        });
        
        // Create new attempt result like v3.2
        createNewAttemptResult(leftPercentage, rightPercentage);
        return;
    }
    
    // Daily mode - create percentage display
    if (isDailyMode || isDemoMode) {
        const resultsContainer = document.querySelector('.results-container');
        if (!resultsContainer) return;
        
        // Remove previous attempt results
        const previousAttemptResults = document.querySelectorAll('.attempt-result');
        previousAttemptResults.forEach(result => {
            result.remove();
        });
        
        // Create new attempt result for daily mode
        createNewAttemptResult(leftPercentage, rightPercentage);
        return;
    }
    
    // Continue with normal game logic...
}

// Expose showAttemptResult to global scope for mechanics to access
window.showAttemptResult = showAttemptResult;

// Special result display for double circle mechanic (3 percentages)
function showDoubleCircleResult(innerPercentage, middlePercentage, outerPercentage) {
    console.log('🧪 Double Circle results:', innerPercentage.toFixed(1), middlePercentage.toFixed(1), outerPercentage.toFixed(1));
    
    // Test lab mode - create result display for 3 splits
    if (window.isPracticeMode) {
        // Clear any table body content that might show old results
        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
        }
        
        // Create or update attempt result display
        const resultsContainer = document.querySelector('.results-container');
        if (!resultsContainer) return;
        
        // Remove previous attempt results
        const previousAttemptResults = document.querySelectorAll('.attempt-result');
        previousAttemptResults.forEach(result => {
            result.remove();
        });
        
        // Create new attempt result for 3 splits
        createDoubleCircleResult(innerPercentage, middlePercentage, outerPercentage, resultsContainer);
        return;
    }
    
    // Continue with normal game logic...
}

// Helper function to create double circle result element (3 percentages)
function createDoubleCircleResult(innerPercentage, middlePercentage, outerPercentage, resultsContainer) {
    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Show three percentages: blue% / orange% / grey%
    const blueColor = 'rgb(100, 150, 255)';
    const orangeColor = 'rgb(255, 165, 0)';
    const greyColor = '#999999';  // Consistent grey - matches separator

    const resultDiv = document.createElement('div');
    resultDiv.className = 'attempt-result';
    resultDiv.innerHTML = `
        <div class="attempt-info">
            <div class="split-display-large">
                <span style="color: ${blueColor}; font-weight: bold;">${innerPercentage.toFixed(1)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: ${orangeColor}; font-weight: bold;">${middlePercentage.toFixed(1)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: ${greyColor}; font-weight: bold;">${outerPercentage.toFixed(1)}%</span>
            </div>
        </div>
    `;
    
    // Always use fixed percentage area - NO EXCEPTIONS
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (!fixedPercentageArea) {
        console.error('❌ Fixed percentage area not found');
        return;
    }
    
    // Clear any existing percentages from fixed area
    fixedPercentageArea.innerHTML = '';
    
    // Add to FIXED percentage area
    fixedPercentageArea.appendChild(resultDiv);
    
    console.log('✅ Double Circle percentages displayed in FIXED area:', innerPercentage.toFixed(1), middlePercentage.toFixed(1), outerPercentage.toFixed(1));
}

// Expose double circle result function to global scope
window.showDoubleCircleResult = showDoubleCircleResult;

// Helper function to create new attempt result element
function createNewAttemptResult(leftPercentage, rightPercentage) {
    // Only skip split display creation if the completion view is already active
    // This allows the final cut result to show initially, but prevents it during restoration when completion is loading
    const isCompletionViewActive = window.completeView && typeof window.completeView.isActive === 'function' && window.completeView.isActive();

    if (isCompletionViewActive) {
        console.log('🎮 Completion view is active - skipping split display creation to prevent interference');
        return;
    }

    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;
    console.log(`📱 Split display font size: ${splitFontSize}px (viewport: ${window.innerWidth}x${window.innerHeight})`);

    // CRITICAL: Ensure smaller percentage is ALWAYS on the left with the color
    // Swap if needed so smaller value is first
    let smallerPercentage, largerPercentage;
    if (leftPercentage <= rightPercentage) {
        smallerPercentage = leftPercentage;
        largerPercentage = rightPercentage;
    } else {
        smallerPercentage = rightPercentage;
        largerPercentage = leftPercentage;
    }

    // Use practice mode colors if in practice mode, otherwise use daily mode colors
    let smallerColor, largerColor;
    if (window.isPracticeMode) {
        const darkGreyColor = 'rgb(97, 96, 95)';  // #61605f
        const greyColor = '#999999';  // Consistent grey - matches separator

        // Smaller percentage (on left) gets the colored text
        smallerColor = darkGreyColor;
        largerColor = greyColor;

        console.log('🎯 Practice mode colors: smaller=' + Math.round(smallerPercentage) + '% (dark grey), larger=' + Math.round(largerPercentage) + '% (grey)');
    } else {
        // Daily mode - use shape-based color for smaller percentage
        const shapeColor = getDailyCutShadingColor();
        smallerColor = `rgb(${shapeColor.r}, ${shapeColor.g}, ${shapeColor.b})`;  // Shape-based color for smaller percentage
        largerColor = '#999999';             // Consistent grey for larger percentage

        console.log('🎯 Daily mode colors: smaller=' + Math.round(smallerPercentage) + '% (shape color), larger=' + Math.round(largerPercentage) + '% (grey)');
    }

    // Always use fixed percentage area - NO EXCEPTIONS
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (!fixedPercentageArea) {
        console.error('❌ Fixed percentage area not found');
        return;
    }

    // Clear any existing percentages from fixed area
    fixedPercentageArea.innerHTML = '';

    const resultDiv = document.createElement('div');
    resultDiv.className = 'attempt-result';
    resultDiv.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';

    resultDiv.innerHTML = `
        <div class="attempt-info" style="display: flex !important; flex-direction: column !important; align-items: center !important;">
            <div class="split-display-large" style="display: flex !important; justify-content: center !important; align-items: center !important; font-size: ${splitFontSize}px !important; font-weight: 700 !important; min-height: 60px !important;">
                <span style="color: ${smallerColor} !important; font-weight: bold !important; font-size: ${splitFontSize}px !important; display: inline-block !important; visibility: visible !important;">${Math.round(smallerPercentage)}%</span><span style="color: #999999 !important; font-weight: bold !important; font-size: ${splitFontSize}px !important; display: inline-block !important; visibility: visible !important; margin: 0 5px !important;"> / </span><span style="color: ${largerColor} !important; font-weight: bold !important; font-size: ${splitFontSize}px !important; display: inline-block !important; visibility: visible !important;">${Math.round(largerPercentage)}%</span>
            </div>
        </div>
    `;

    // FIXED POSITIONING: Percentages ALWAYS go to fixed area
    fixedPercentageArea.style.setProperty('visibility', 'visible', 'important');  // Force visible
    fixedPercentageArea.style.setProperty('display', 'flex', 'important');  // Force displayed
    fixedPercentageArea.style.setProperty('opacity', '1', 'important');  // Force opaque
    fixedPercentageArea.appendChild(resultDiv);

    // DEBUG: Log computed styles and position
    const computedStyle = window.getComputedStyle(fixedPercentageArea);
    console.log('🔍 FixedPercentageArea computed styles:', {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        position: computedStyle.position,
        top: computedStyle.top,
        left: computedStyle.left,
        width: computedStyle.width,
        height: computedStyle.height,
        zIndex: computedStyle.zIndex,
        backgroundColor: computedStyle.backgroundColor,
        overflow: computedStyle.overflow
    });

    // DEBUG: Check bounding box
    const rect = fixedPercentageArea.getBoundingClientRect();
    console.log('🔍 FixedPercentageArea bounding box:', {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
    });
    console.log('✅ Percentage splits positioned in FIXED area: smaller=' + smallerPercentage.toFixed(1) + '% (LEFT, colored), larger=' + largerPercentage.toFixed(1) + '% (RIGHT, grey)');

    // Debug: Log what was actually added
    console.log('📊 DEBUG - Fixed area HTML:', fixedPercentageArea.innerHTML);
    console.log('📊 DEBUG - Result div HTML:', resultDiv.innerHTML);
    console.log('📊 DEBUG - Split display element:', resultDiv.querySelector('.split-display-large'));

    // Force immediate display
    const splitDisplay = resultDiv.querySelector('.split-display-large');
    if (splitDisplay) {
        splitDisplay.style.setProperty('display', 'flex', 'important');
        splitDisplay.style.setProperty('visibility', 'visible', 'important');
        splitDisplay.style.setProperty('opacity', '1', 'important');
        console.log('📊 DEBUG - Forced split display styles applied');
    }
}

// Animate the replacement of percentages with horizontal slide effect
function animatePercentageReplacement(existingResult, leftPercentage, rightPercentage, resultsContainer) {
    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Show both percentages: blue% / grey%
    const blueColor = 'rgb(100, 150, 255)';
    const greyColor = '#666666'; // Darker grey for better visibility

    // Get the container for the percentage display
    const attemptInfo = existingResult.querySelector('.attempt-info');
    if (!attemptInfo) return;

    const currentDisplayLarge = attemptInfo.querySelector('.split-display-large');
    if (!currentDisplayLarge) return;

    // Get the current span element
    const currentSpan = currentDisplayLarge.querySelector('span');
    if (!currentSpan) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Get the original dimensions and position
    const containerWidth = currentDisplayLarge.offsetWidth || 200; // Fallback width
    const containerHeight = currentDisplayLarge.offsetHeight || 80; // Fallback height
    
    // If reduced motion is preferred, skip animation
    if (prefersReducedMotion) {
        currentSpan.textContent = `${percentage.toFixed(1)}%`;
        currentSpan.style.color = color;
        return;
    }
    
    // Create a sliding container that will hold both old and new numbers
    const slidingContainer = document.createElement('div');
    slidingContainer.style.position = 'relative';
    slidingContainer.style.width = (containerWidth * 2) + 'px'; // Double width to hold both numbers
    slidingContainer.style.height = containerHeight + 'px';
    slidingContainer.style.left = '0px';
    slidingContainer.style.transition = 'left 0.35s cubic-bezier(0.4, 0.0, 0.2, 1)'; // Smoother easing
    
    // Set up the main container as a clipping mask with responsive dimensions
    currentDisplayLarge.style.overflow = 'hidden';
    currentDisplayLarge.style.position = 'relative';
    currentDisplayLarge.style.width = '100%';
    currentDisplayLarge.style.maxWidth = containerWidth + 'px';
    currentDisplayLarge.style.height = containerHeight + 'px';
    currentDisplayLarge.style.minHeight = '1.2em'; // Responsive minimum height
    
    // Create old number positioned at left side of sliding container
    const oldSpan = document.createElement('span');
    oldSpan.innerHTML = currentSpan.innerHTML; // Preserve existing content formatting
    oldSpan.style.position = 'absolute';
    oldSpan.style.left = '0px';
    oldSpan.style.top = '0px';
    oldSpan.style.width = containerWidth + 'px';
    oldSpan.style.textAlign = 'center';
    oldSpan.style.whiteSpace = 'nowrap';
    
    // Create new number positioned at right side of sliding container with blue% / grey%
    const newSpan = document.createElement('span');
    newSpan.innerHTML = `<span style="color: ${blueColor}; font-weight: bold; font-size: ${splitFontSize}px;">${leftPercentage.toFixed(1)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px;">${rightPercentage.toFixed(1)}%</span>`;
    newSpan.style.position = 'absolute';
    newSpan.style.left = containerWidth + 'px';
    newSpan.style.top = '0px';
    newSpan.style.width = containerWidth + 'px';
    newSpan.style.textAlign = 'center';
    newSpan.style.whiteSpace = 'nowrap';
    
    // Add both spans to sliding container
    slidingContainer.appendChild(oldSpan);
    slidingContainer.appendChild(newSpan);
    
    // Replace current content with sliding container
    currentSpan.remove();
    currentDisplayLarge.appendChild(slidingContainer);
    
    // Trigger animation on next frame
    requestAnimationFrame(() => {
        // Slide the entire container left, revealing new number and hiding old number
        slidingContainer.style.left = -containerWidth + 'px';
        
        // Clean up after animation
        setTimeout(() => {
            // Replace sliding container with just the new span
            slidingContainer.remove();

            const finalSpan = document.createElement('span');
            finalSpan.innerHTML = `<span style="color: ${blueColor}; font-weight: bold; font-size: ${splitFontSize}px;">${leftPercentage.toFixed(1)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px;">${rightPercentage.toFixed(1)}%</span>`;

            currentDisplayLarge.appendChild(finalSpan);
            
            // Reset container styles
            currentDisplayLarge.style.overflow = '';
            currentDisplayLarge.style.position = '';
            currentDisplayLarge.style.width = '';
            currentDisplayLarge.style.maxWidth = '';
            currentDisplayLarge.style.height = '';
            currentDisplayLarge.style.minHeight = '';
        }, 350); // Match the 0.35s transition duration
    });
}

// Confetti animation for perfect cuts
function triggerConfettiAnimation(isFinalCut = false) {
    return new Promise((resolve) => {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'];
        const confettiContainer = document.body;
        const confettiPieces = [];
        // Reduce pieces for final cut to speed up animation
        const numPieces = isFinalCut ? 50 : 100;
        const duration = isFinalCut ? 2000 : 4000; // Shorter duration for final cut

        console.log(`🎉 Starting confetti animation (${isFinalCut ? 'FINAL CUT - quick' : 'normal'} mode)`);

        // Create confetti pieces
        for (let i = 0; i < numPieces; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = Math.random() * 10 + 5 + 'px';
            confetti.style.height = Math.random() * 10 + 5 + 'px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * window.innerWidth + 'px';
            confetti.style.top = '-20px';
            confetti.style.opacity = '1';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '9999';
            confetti.style.borderRadius = '50%';

            // Random rotation and animation properties
            const rotation = Math.random() * 360;
            // Faster fall speed for final cut
            const fallSpeed = isFinalCut ? Math.random() * 5 + 4 : Math.random() * 3 + 2;
            const horizontalDrift = (Math.random() - 0.5) * 4;

            confetti.style.transform = `rotate(${rotation}deg)`;
            confettiContainer.appendChild(confetti);

            confettiPieces.push({
                element: confetti,
                x: parseFloat(confetti.style.left),
                y: -20,
                fallSpeed: fallSpeed,
                horizontalDrift: horizontalDrift,
                rotation: rotation,
                rotationSpeed: (Math.random() - 0.5) * 10
            });
        }

        let animationFrame = null;

        // Animate confetti
        function animateConfetti() {
            let activePieces = 0;

            confettiPieces.forEach(piece => {
                if (piece.y < window.innerHeight + 20) {
                    piece.y += piece.fallSpeed;
                    piece.x += piece.horizontalDrift;
                    piece.rotation += piece.rotationSpeed;

                    piece.element.style.top = piece.y + 'px';
                    piece.element.style.left = piece.x + 'px';
                    piece.element.style.transform = `rotate(${piece.rotation}deg)`;

                    // Fade out as it falls
                    const opacity = Math.max(0, 1 - (piece.y / window.innerHeight));
                    piece.element.style.opacity = opacity;

                    activePieces++;
                }
            });

            if (activePieces > 0) {
                animationFrame = requestAnimationFrame(animateConfetti);
            } else {
                // Clean up confetti pieces
                confettiPieces.forEach(piece => {
                    if (piece.element.parentNode) {
                        piece.element.parentNode.removeChild(piece.element);
                    }
                });
                console.log('🎉 Confetti animation completed and cleaned up');
                resolve(); // Resolve promise when animation completes
            }
        }

        // Start animation
        animationFrame = requestAnimationFrame(animateConfetti);

        // Clean up after duration as failsafe and resolve promise
        setTimeout(() => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
            confettiPieces.forEach(piece => {
                if (piece.element.parentNode) {
                    piece.element.parentNode.removeChild(piece.element);
                }
            });
            console.log('🎉 Confetti animation force-cleaned after timeout');
            resolve(); // Ensure promise resolves even if animation didn't complete naturally
        }, duration);
    });
}

// v3.0 - Show Try Again and Lock In buttons - DISABLED for automatic flow
function showAttemptButtons() {
    console.log('🔘 showAttemptButtons called - but buttons are disabled for automatic flow');
    // Button functionality has been removed - game automatically proceeds to next attempt
    return;
}

// v3.0 - Handle Try Again button
function handleTryAgain() {
    console.log('🔄 Try Again clicked - current attempt count:', attemptCount, 'of', maxAttempts);
    
    // Track retry action
    if (window.Analytics) {
        window.Analytics.trackRetryAction();
    }
    
    // Attempt count is already incremented when cut is made, no need to increment here
    
    // Remove attempt buttons
    const buttonsDiv = document.querySelector('.attempt-buttons');
    if (buttonsDiv) {
        buttonsDiv.remove();
    }
    
    // Show CUT popup for next attempt
    showCutPopup();
    
    // Reset vector state
    resetVectorState();
    
    // Clear canvas and redraw shape
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    renderShapeForCutting(parsedShapes);
    
    // DON'T show goal again - keep current percentages displayed
    // DON'T remove attempt result display - keep percentages visible
    
    // DAILY MODE: Do NOT automatically re-enable canvas - require user progression buttons
    // BUT: Practice mode should always re-enable even if launched mid-daily-game
    if (isDailyMode && !window.isPracticeMode) {
        console.log('🚫 DAILY MODE: Canvas remains inactive - waiting for user progression button');
        // Keep canvas disabled - only progression buttons should re-enable
        canvas.style.pointerEvents = 'none';
        isInteractionEnabled = false;
        gameState = 'awaiting_choice';
        return;
    }
    
    // NON-DAILY MODE: Re-enable canvas interaction for automatic flow
    canvas.style.pointerEvents = 'auto';
    isInteractionEnabled = true;
    gameState = 'cutting';
    
    // Save the new during-play state immediately
    console.log('💾 Saving during-play state after Retry decision');
    
    // Ensure displayedPercentages is saved correctly for restoration
    if (currentAttempts.length > 0) {
        const latestAttempt = currentAttempts[currentAttempts.length - 1];
        const displayData = {
            leftPercentage: latestAttempt.leftPercentage,
            rightPercentage: latestAttempt.rightPercentage,
            tryNumber: currentAttempts.length + 1 // Next try number
        };
        localStorage.setItem(STORAGE_KEYS.displayedPercentages, JSON.stringify(displayData));
        console.log('💾 Saved displayedPercentages for restoration:', displayData);
    }
    
    saveGameState();
    saveStructuredGameState();
}

// v3.0 - Handle Lock In button
async function handleLockIn() {
    console.log('🔒 Lock In clicked - finalizing score');
    console.log('📊 All attempts for comparison:', currentAttempts.map(a => ({
        attempt: a.attemptNumber,
        leftPercent: a.leftPercentage.toFixed(1),
        rightPercent: a.rightPercentage.toFixed(1),
        deviation: (Math.abs(a.leftPercentage - 50) + Math.abs(a.rightPercentage - 50)).toFixed(1)
    })));
    
    // Get the best attempt (closest to 50%/50%)
    const finalAttempt = findBestAttempt(currentAttempts);
    if (!finalAttempt) {
        console.error('No attempt to lock in');
        return;
    }
    
    finalLockedScore = finalAttempt;
    
    // Update currentVector to be the best attempt's cut vector for final rendering
    currentVector = finalAttempt.cutVector;
    
    // Render the best attempt's cut visually on the canvas
    const bestAttemptAreaResults = {
        leftPercentage: finalAttempt.leftPercentage,
        rightPercentage: finalAttempt.rightPercentage,
        leftArea: finalAttempt.splitAreas.left,
        rightArea: finalAttempt.splitAreas.right
    };
    
    // CRITICAL: Clear canceled line drawing flag just before rendering to ensure visual shading works
    if (window.canceledLineDrawing) {
        console.log('🔧 Final result: Clearing canceledLineDrawing flag just before rendering to fix shading');
        window.canceledLineDrawing = false;
    }
    
    renderVectorCutResult(bestAttemptAreaResults);
    
    // Animation removed - direct rendering for daily game mode
    
    // Remove attempt buttons
    const buttonsDiv = document.querySelector('.attempt-buttons');
    if (buttonsDiv) {
        buttonsDiv.remove();
    }
    
    // Start both animations simultaneously:
    // 1. Box animation around percentage (1 second)
    // 2. Cut fade-in animation (1 second)
    await performLockInFadeAnimation(finalAttempt.areaResults);
    
    // After animations complete, show share button and thanks message
    showPostLockInElements();
    
    // Submit to Supabase
    try {
        await supabaseClient.submitAttemptV3(
            currentDate,
            finalAttempt.leftPercentage,
            finalAttempt.rightPercentage,
            attemptCount
        );
        console.log('✅ Score submitted successfully');
        
        // Note: Daily scores will be saved during final completion, not here
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
    
    // Show final state
    gameState = 'locked'; 
    saveGameState(); // Save final game state
    saveStructuredGameState(); // Save structured final state
    await showFinalState();
}

// v3.0 - Show final game state with share option
async function showFinalState() {
    // Don't clear committed results - they should remain visible with post-lock-in elements
    
    // Game complete - no stats popup in v3.0
}

// v3.0 - Show share button and thanks message after lock-in animation
function showPostLockInElements() {
    const resultsContainer = document.querySelector('.results-container');
    if (!resultsContainer) {
        console.error('Results container not found');
        return;
    }
    
    // Create container for post-lock-in elements
    const postLockInContainer = document.createElement('div');
    postLockInContainer.className = 'post-lockin-container';
    
    // Create share button
    const shareButton = document.createElement('button');
    shareButton.className = 'post-lockin-share-btn';
    shareButton.textContent = 'Share';
    shareButton.onclick = handleShare;
    
    // Add share button to container
    postLockInContainer.appendChild(shareButton);
    
    // Add container to results
    resultsContainer.appendChild(postLockInContainer);
    
    // Show countdown overlay on canvas
    const countdownOverlay = document.getElementById('countdownOverlay');
    if (countdownOverlay) {
        countdownOverlay.style.display = 'block';
    }
    
    // Start the countdown timer
    startNextGameCountdown();
    
    // Trigger pop-in animation
    setTimeout(() => {
        postLockInContainer.classList.add('visible');
    }, 100); // Small delay for smooth appearance
}


// v3.0 - Countdown timer for next game
function startNextGameCountdown() {
    const countdownDisplay = document.getElementById('countdownDisplay');
    if (!countdownDisplay) return;
    
    function updateCountdown() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0); // Set to midnight
        
        const timeUntilTomorrow = tomorrow - now;
        
        if (timeUntilTomorrow <= 0) {
            // It's already the next day
            countdownDisplay.textContent = 'New game available now!';
            return;
        }
        
        const hours = Math.floor(timeUntilTomorrow / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilTomorrow % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilTomorrow % (1000 * 60)) / 1000);
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        countdownDisplay.textContent = `New shapes in ${timeString}`;
    }
    
    // Update immediately
    updateCountdown();
    
    // Update every second
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    // Store interval for cleanup if needed
    if (!window.gameCountdownInterval) {
        window.gameCountdownInterval = countdownInterval;
    }
}



// Keep old function for reference but it won't be used in v3.0
async function handleSingleCut() {
    // This function is deprecated in v3.0
    console.warn('handleSingleCut called but should not be used in v3.0');
}

async function handleShape3TwoCuts() {
    // Hide goal commentary now that the second cut is made
    hideGoalCommentary();
    
    // Calculate four quadrants using both cutting vectors
    const quadrantResults = calculateFourQuadrants(firstCutVector, currentVector);
    
    // Calculate score based on all four quadrants
    const score = ShapeTypeHandler.calculateShape3ScoreWithQuadrants(quadrantResults.percentages);
    const commentary = getPlayfulCommentary(score);
    
    // Store result with quadrant data
    const result = {
        shape: currentShapeIndex,
        quadrants: quadrantResults.quadrants,
        quadrantPercentages: quadrantResults.percentages,
        score: score,
        cuts: 2,
        cutVector: { ...currentVector },
        firstCutVector: { ...firstCutVector },
        originalShape: currentGeoJSON,
        splitAreas: {
            quadrants: quadrantResults.quadrants
        },
        timestamp: new Date().toISOString()
    };
    
    gameResults.push(result);
    
    // Submit score to Supabase
    try {
        await supabaseClient.submitScore(
            currentDate,
            currentShapeIndex,
            score,
            quadrantResults.percentages.q1,
            quadrantResults.percentages.q2
        );
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
    
    // Render the result with four-quadrant color coding
    renderShape3QuadrantResult(quadrantResults, firstCutVector, currentVector);
    
    // Capture screenshot of the rendered result for replay mode
    captureShapeScreenshot(currentShapeIndex);
    
    // Update displays
    updateResultsTable();
    
    // Show commentary in instruction location
    console.log('🎯 Showing cut commentary:', commentary);
    if (window.updateInstructionText) {
        window.updateInstructionText(commentary, true); // true for bold styling
        console.log('🎯 Commentary sent to updateInstructionText');
    } else {
        console.error('🎯 updateInstructionText not available');
    }
    
    // Set replay index to current shape when entering results state
    replayShapeIndex = currentShapeIndex;
    console.log('🎯 Set replayShapeIndex to', replayShapeIndex, 'when entering results state for shape', currentShapeIndex);
    
    gameState = 'results';
    
    // Check if all shapes are completed and trigger end game
    if (gameResults.length === (window.devvitTotalShapes || 10)) {
        console.log('🔄 All shapes completed - triggering endGame');
        // Reduced delay before showing stats popup
        setTimeout(() => {
            endGame();
        }, 500);
    }
}

function handleMiss() {
    console.log('handleMiss() called - showing miss commentary');
    
    // Reset vector state first (without hiding commentary)
    isDrawingVector = false;
    vectorStart = null;
    vectorEnd = null;
    currentVector = null;
    vectorCutActive = false;
    dragDistance = 0;
    
    // Show miss commentary in instruction location
    if (window.updateInstructionText) {
        window.updateInstructionText('Try again', true); // true for bold styling
    }
    
    // Redraw original shape
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    renderShapeForCutting(parsedShapes);
    
    // Redraw first cut if applicable
    if (currentShapeIndex === 3 && firstCutVector) {
        drawPreviousVector(firstCutVector);
    }
    
    gameState = 'cutting';
}

function resetVectorState() {
    isDrawingVector = false;
    vectorStart = null;
    vectorEnd = null;
    currentVector = null;
    vectorCutActive = false;
    dragDistance = 0;
    hideCommentary();
}

// Removed showCutResult function - not needed in v3.0


function showCommentary(text, autoHide = false) {
    console.log('showCommentary() called with text:', text);
    const commentaryOverlay = document.getElementById('commentaryOverlay');
    const commentaryText = document.getElementById('commentaryText');
    
    if (commentaryOverlay && commentaryText) {
        commentaryText.textContent = text;
        commentaryOverlay.style.display = 'block';
        commentaryOverlay.style.visibility = 'visible';
        commentaryOverlay.style.opacity = '1';
        commentaryOverlay.style.zIndex = '1000';
        
        // Auto-hide after 3 seconds for "try again" messages
        if (autoHide) {
            setTimeout(() => {
                commentaryOverlay.style.display = 'none';
            }, 3000);
        }
    }
}

function hideCommentary() {
    const commentaryOverlay = document.getElementById('commentaryOverlay');
    if (commentaryOverlay) {
        commentaryOverlay.style.display = 'none';
    }
}

// Generate playful commentary based on cut accuracy score
function getPlayfulCommentary(score) {
    if (score >= 100) {
        return "PERFECT CUT!!! 💯";
    } else if (score >= 95) {
        return "Almost perfect! 🎉";
    } else if (score >= 85) {
        return "Clean cut! ✂️";
    } else if (score >= 70) {
        return "Close shave! 🔪";
    } else if (score >= 50) {
        return "Not bad! 👍";
    } else {
        return "Shapes can be hard... 😅";
    }
}

// Button visibility management
function showPlayButton() {
    const buttonsContainer = document.querySelector('.buttons-below-canvas');
    if (buttonsContainer) {
        // Don't change display property - maintain consistent layout
        buttonsContainer.style.opacity = '1';
        buttonsContainer.style.visibility = 'visible';
        buttonsContainer.style.pointerEvents = 'auto';
    }
}

function showGoalDisplay() {
    // Test lab version - no instructional text needed
    const goalDisplay = document.getElementById('goalDisplay');
    if (goalDisplay) {
        goalDisplay.style.display = 'none';
    }
}

function showGoalDisplayWithPreviousResult(displayedPercentages) {
    console.log('🎨 showGoalDisplayWithPreviousResult called with:', displayedPercentages);
    const goalDisplay = document.getElementById('goalDisplay');
    const goalTextEl = document.getElementById('goalText');
    
    console.log('🎨 Goal display elements:', {
        goalDisplay: !!goalDisplay,
        goalTextEl: !!goalTextEl
    });
    
    if (goalDisplay && goalTextEl) {
        // If displayedPercentages parameter is provided, use it
        if (displayedPercentages && displayedPercentages.leftPercentage != null) {
            const bluePercent = displayedPercentages.leftPercentage.toFixed(1);
            const greyPercent = displayedPercentages.rightPercentage.toFixed(1);
            
            console.log('🎨 Setting goal display with percentages:', {
                bluePercent,
                greyPercent,
                goalTextElBefore: goalTextEl.innerHTML
            });
            
            // Show the previous result in the goal area
            const percentageHTML = `<span style="color: rgb(100, 150, 255); font-weight: bold;">${bluePercent}%</span> <span style="color: #777777; font-weight: bold;">/ ${greyPercent}%</span>`;
            goalTextEl.innerHTML = percentageHTML;
            goalDisplay.style.display = 'block';
            goalDisplay.style.opacity = '1';
            
            // CRITICAL: Override CSS opacity: 0 for goal text
            goalTextEl.style.opacity = '1';
            goalTextEl.style.transition = 'none'; // Remove animation transition
            
            console.log('🎨 Goal display updated:', {
                newHTML: percentageHTML,
                goalTextElAfter: goalTextEl.innerHTML,
                goalDisplayStyle: {
                    display: goalDisplay.style.display,
                    opacity: goalDisplay.style.opacity
                }
            });
        } else if (currentAttempts.length > 0) {
            // Otherwise get the last attempt to show its results
            const lastAttempt = currentAttempts[currentAttempts.length - 1];
            const bluePercent = lastAttempt.leftPercentage.toFixed(1);
            const greyPercent = lastAttempt.rightPercentage.toFixed(1);
            
            // Show the previous result in the goal area
            goalTextEl.innerHTML = `<span style="color: rgb(100, 150, 255); font-weight: bold;">${bluePercent}%</span> <span style="color: #777777; font-weight: bold;">/ ${greyPercent}%</span>`;
            goalDisplay.style.display = 'block';
            goalDisplay.style.opacity = '1';
            
            // CRITICAL: Override CSS opacity: 0 for goal text
            goalTextEl.style.opacity = '1';
            goalTextEl.style.transition = 'none';
        } else {
            // Fallback to normal goal display if no attempts
            showGoalDisplay();
        }
    }
}

function showAttemptDisplay() {
    const attemptDisplay = document.getElementById('attemptDisplay');
    const attemptTextEl = document.getElementById('attemptText');
    
    if (attemptDisplay && attemptTextEl) {
        // Show the NEXT attempt they're about to make
        const nextAttempt = attemptCount + 1;
        const tryText = nextAttempt === 1 ? '1st Try' : nextAttempt === 2 ? '2nd Try' : '3rd Try';
        attemptTextEl.textContent = tryText;
        attemptDisplay.style.display = 'block';
        attemptDisplay.style.opacity = '1';
    }
}

function hidePlayButton() {
    console.log('🚫 Hiding play button immediately...');
    
    // Hide old location but maintain layout space
    const buttonsContainer = document.querySelector('.buttons-below-canvas');
    if (buttonsContainer) {
        // Use opacity/visibility instead of display:none to maintain spacing
        buttonsContainer.style.opacity = '0';
        buttonsContainer.style.visibility = 'hidden';
        buttonsContainer.style.pointerEvents = 'none';
        console.log('✅ Old play button location hidden');
    }
    
    // Hide new location in results container
    const initialPlayButton = document.getElementById('initialPlayButton');
    if (initialPlayButton) {
        initialPlayButton.style.visibility = 'hidden';
        console.log('✅ Initial play button hidden - display: none applied');
    } else {
        console.error('❌ initialPlayButton not found!');
    }
}

function showPlayButtonBelowGoal() {
    console.log('🔧 Showing play button below canvas for practise mode...');
    
    // Check if we already have a play button positioned below canvas
    let belowCanvasBtn = document.getElementById('playBtnBelowCanvas');
    
    if (!belowCanvasBtn) {
        // Create a new play button positioned below canvas
        belowCanvasBtn = document.createElement('button');
        belowCanvasBtn.id = 'playBtnBelowCanvas';
        belowCanvasBtn.className = 'canvas-play-button';
        belowCanvasBtn.textContent = 'Play';
        
        // Add click handler to start regular game (not practice)
        belowCanvasBtn.addEventListener('click', function() {
            console.log('🎮 Play button below canvas clicked - starting regular game');
            // Exit practice mode and start regular game
            isPracticeMode = false;
            window.isPracticeMode = false; // Reset global for mechanics to access
            isPractiseMode = false; // Legacy compatibility
            isDailyMode = true; // CRITICAL: Enable daily mode restrictions
            localStorage.removeItem('dailyShapes_practiceMode');
            console.log('🎯 TRANSITION: Practice->Daily mode, isDailyMode set to', isDailyMode);
            handlePlayButtonClickOld();
        });
        
        // Insert after the canvas container, before results container
        const canvasContainer = document.querySelector('.canvas-container');
        const resultsContainer = document.querySelector('.results-container');
        canvasContainer.parentNode.insertBefore(belowCanvasBtn, resultsContainer);
    }
    
    // Show the button with proper styling and centering
    belowCanvasBtn.style.display = 'block';
    // Remove inline margin - let CSS handle consistent positioning
    belowCanvasBtn.style.opacity = '1';
    belowCanvasBtn.style.backgroundColor = 'rgb(100, 150, 255)'; // Ensure blue color is preserved
    belowCanvasBtn.style.color = 'white';
    belowCanvasBtn.style.position = 'static'; // Ensure it doesn't affect layout
    console.log('✅ Play button shown below canvas with blue color');
}

// Phase 1: Initial cutting instructions
function showPhase1Instructions() {
    // Hide the welcome message
    const goalDisplay = document.getElementById('goalDisplay');
    if (goalDisplay) {
        goalDisplay.style.display = 'none';
    }
    
    // Remove any existing play button
    const existingPlayBtn = document.getElementById('playBtnBelowCanvas');
    if (existingPlayBtn) {
        existingPlayBtn.remove();
    }
    
    // Check if phase 1 instructions already exist
    let phase1Instructions = document.getElementById('phase1Instructions');
    
    if (!phase1Instructions) {
        // Create phase 1 instructions element
        phase1Instructions = document.createElement('div');
        phase1Instructions.id = 'phase1Instructions';
        phase1Instructions.className = 'practice-instructions practice-phase-1';
        phase1Instructions.innerHTML = `
            <strong>Tap and drag</strong> across the grey shapes to make a cut. <strong>Release</strong> to complete your cut.
        `;
        
        // Insert before results container
        const resultsContainer = document.querySelector('.results-container');
        if (resultsContainer) {
            resultsContainer.parentNode.insertBefore(phase1Instructions, resultsContainer);
        }
    }
    
    // Show the instructions with fade in
    phase1Instructions.style.display = 'block';
    phase1Instructions.style.opacity = '0';
    phase1Instructions.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        phase1Instructions.style.opacity = '1';
    }, 100);
    
    console.log('📋 Phase 1 instructions displayed');
}

// Fade out phase 1 instructions
async function fadeOutPhase1Instructions() {
    return new Promise((resolve) => {
        const phase1Instructions = document.getElementById('phase1Instructions');
        if (phase1Instructions) {
            phase1Instructions.style.transition = 'opacity 0.5s ease';
            phase1Instructions.style.opacity = '0';
            
            setTimeout(() => {
                phase1Instructions.style.display = 'none';
                resolve();
            }, 500);
        } else {
            resolve();
        }
    });
}

// Phase 2: Show percentage split and conditional explanation
async function showPhase2Instructions(areaResults) {
    // First show the percentage split (always show this)
    showPracticePercentageSplit(areaResults);
    
    // Only show explanation text on first practice cut
    if (isFirstPracticeCut) {
        // Wait a moment, then show phase 2 instructions
        setTimeout(() => {
            let phase2Instructions = document.getElementById('phase2Instructions');
            
            if (!phase2Instructions) {
                // Create phase 2 instructions element
                phase2Instructions = document.createElement('div');
                phase2Instructions.id = 'phase2Instructions';
                phase2Instructions.className = 'practice-instructions practice-phase-2';
                phase2Instructions.innerHTML = `
                    Percentages show how close you are to <strong>50% / 50%</strong>.
                `;
                
                // Insert after percentage display
                const percentageDisplay = document.getElementById('practicePercentageDisplay');
                if (percentageDisplay) {
                    percentageDisplay.parentNode.insertBefore(phase2Instructions, percentageDisplay.nextSibling);
                } else {
                    // Fallback: insert before results container
                    const resultsContainer = document.querySelector('.results-container');
                    if (resultsContainer) {
                        resultsContainer.parentNode.insertBefore(phase2Instructions, resultsContainer);
                    }
                }
            }
            
            // Show the instructions with fade in
            phase2Instructions.style.display = 'block';
            phase2Instructions.style.opacity = '0';
            phase2Instructions.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                phase2Instructions.style.opacity = '1';
            }, 100);
            
            console.log('📋 Phase 2 instructions displayed (first cut)');
        }, 1000); // Wait 1 second after cut is made
        
        // Mark that we've shown the first cut explanation
        isFirstPracticeCut = false;
    } else {
        console.log('📋 Skipping phase 2 instructions - not first cut');
    }
}

// Fade render and percentages
async function fadeRenderAndPercentages() {
    console.log('🎨 Fading render and percentages');
    
    // Fade the canvas render
    await performPracticeRenderFade();
    
    // Fade the percentage display
    return new Promise((resolve) => {
        const percentageDisplay = document.getElementById('practicePercentageDisplay');
        const phase2Instructions = document.getElementById('phase2Instructions');
        
        let fadePromises = [];
        
        if (percentageDisplay) {
            fadePromises.push(new Promise((resolvePercentage) => {
                percentageDisplay.style.transition = 'opacity 0.5s ease';
                percentageDisplay.style.opacity = '0';
                
                setTimeout(() => {
                    percentageDisplay.style.display = 'none';
                    resolvePercentage();
                }, 500);
            }));
        }
        
        if (phase2Instructions) {
            fadePromises.push(new Promise((resolveInstructions) => {
                phase2Instructions.style.transition = 'opacity 0.5s ease';
                phase2Instructions.style.opacity = '0';
                
                setTimeout(() => {
                    phase2Instructions.style.display = 'none';
                    resolveInstructions();
                }, 500);
            }));
        }
        
        // Wait for all fade promises to complete, or just wait 500ms if nothing to fade
        if (fadePromises.length > 0) {
            Promise.all(fadePromises).then(resolve);
        } else {
            setTimeout(resolve, 500);
        }
    });
}

// Show final practice instructions
async function showFinalPracticeInstructions() {
    console.log('📋 Showing final practice instructions');
    
    let finalInstructions = document.getElementById('finalPracticeInstructions');
    
    if (!finalInstructions) {
        // Create final instructions element
        finalInstructions = document.createElement('div');
        finalInstructions.id = 'finalPracticeInstructions';
        finalInstructions.className = 'practice-instructions practice-phase-final';
        finalInstructions.innerHTML = `
            Make unlimited cuts to practice and tap <strong style="color: rgb(100, 150, 255);">Play</strong> when you're ready.
        `;
        
        // Insert directly after canvas container, before buttons
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.parentNode.insertBefore(finalInstructions, canvasContainer.nextSibling);
        } else {
            // Fallback: insert before results container
            const resultsContainer = document.querySelector('.results-container');
            if (resultsContainer) {
                resultsContainer.parentNode.insertBefore(finalInstructions, resultsContainer);
            }
        }
    }
    
    // Show the instructions with fade in
    finalInstructions.style.display = 'block';
    finalInstructions.style.opacity = '0';
    finalInstructions.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        finalInstructions.style.opacity = '1';
    }, 100);
    
    console.log('📋 Final practice instructions displayed');
    return Promise.resolve();
}

// Show play button for practice mode
async function showPlayButtonForPractice() {
    console.log('🔧 Showing play button for practice mode completion');
    
    // Create a dedicated play button positioned after results container
    let practicePlayBtn = document.getElementById('practicePlayBtn');
    
    if (!practicePlayBtn) {
        practicePlayBtn = document.createElement('button');
        practicePlayBtn.id = 'practicePlayBtn';
        practicePlayBtn.className = 'canvas-play-button';
        practicePlayBtn.textContent = 'Play';
        practicePlayBtn.style.backgroundColor = 'rgb(100, 150, 255)';
        practicePlayBtn.style.color = 'white';
        // Remove inline margin - let CSS handle consistent positioning
        practicePlayBtn.style.display = 'block';
        practicePlayBtn.style.position = 'fixed';
        practicePlayBtn.style.top = '540px';
        practicePlayBtn.style.left = '50%';
        practicePlayBtn.style.transform = 'translateX(-50%)';
        practicePlayBtn.style.zIndex = '1000';
        
        // Add click handler for practice completion
        practicePlayBtn.onclick = async function() {
            console.log('🎮 Practice play button clicked');
            
            // Hide the play button immediately when clicked
            practicePlayBtn.style.display = 'none';
            
            // Clear any existing practice elements
            const existingElements = [
                'phase1Instructions',
                'phase2Instructions', 
                'finalPracticeInstructions',
                'practicePercentageDisplay',
                'playBtnBelowCanvas',
                'practicePlayBtn'
            ];
            
            existingElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                }
            });
            
            // Fade out demo shape first if in practice mode
            await fadeOutDemoShape();
            
            // Small pause before daily shape starts fading in
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Exit practice mode and start regular game
            isPracticeMode = false;
            window.isPracticeMode = false; // Reset global for mechanics to access
            isPractiseMode = false; // Legacy compatibility
            isDailyMode = true; // CRITICAL: Enable daily mode restrictions
            localStorage.removeItem('dailyShapes_practiceMode');
            console.log('🎯 TRANSITION: Practice->Daily mode, isDailyMode set to', isDailyMode);
            handlePlayButtonClickOld();
        };
        
        // Append to body since we're using fixed positioning
        document.body.appendChild(practicePlayBtn);
    }
    
    // Show the dedicated practice play button
    practicePlayBtn.style.display = 'block';
    practicePlayBtn.style.opacity = '1';
    
    // Hide the original buttons container but maintain layout space during practice
    const buttonsContainer = document.querySelector('.buttons-below-canvas');
    if (buttonsContainer) {
        buttonsContainer.style.opacity = '0';
        buttonsContainer.style.visibility = 'hidden';
        buttonsContainer.style.pointerEvents = 'none';
    }
    
    console.log('✅ Practice play button positioned below results container');
}

// Function to fade out demo shape when transitioning from practice to play
async function fadeOutDemoShape() {
    return new Promise((resolve) => {
        console.log('🎮 Fading out demo shape...');
        
        // Simple fade: clear canvas and show only grid
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        // Brief delay for visual transition
        setTimeout(() => {
            resolve();
        }, 300);
    });
}

// Animation functions removed - using direct rendering for daily game mode


// Function to fade out welcome text when Play or Practice is tapped
function fadeOutWelcomeText() {
    const goalDisplay = document.getElementById('goalDisplay');
    const welcomeOverlay = document.getElementById('welcomeOverlay');
    
    // Hide goal display if it exists
    if (goalDisplay && goalDisplay.style.display !== 'none') {
        console.log('🎮 Fading out goal display...');
        
        goalDisplay.style.transition = 'opacity 0.5s ease-out';
        goalDisplay.style.opacity = '0';
        
        // Hide completely after fade
        setTimeout(() => {
            goalDisplay.style.display = 'none';
        }, 500);
    }
    
    // Hide welcome overlay
    if (welcomeOverlay && welcomeOverlay.style.visibility !== 'hidden') {
        console.log('🎮 Fading out welcome overlay...');
        
        welcomeOverlay.style.transition = 'opacity 0.5s ease-out';
        welcomeOverlay.style.opacity = '0';
        
        // Hide completely after fade
        setTimeout(() => {
            welcomeOverlay.style.visibility = 'hidden';
        }, 500);
    }
}

// Reset practice mode for next cut
function resetPracticeForNextCut() {
    console.log('🔄 Resetting practice mode for next cut');
    
    // Reset cut state
    currentVector = null;
    vectorCutActive = false;
    gameState = 'cutting';
    isInteractionEnabled = true;
    
    // Re-enable canvas interaction
    if (canvas) {
        canvas.style.pointerEvents = 'auto';
    }
    
    console.log('✅ Practice mode reset - ready for next cut');
}

// Fade out final instructions only (keep play button visible)
async function fadeOutFinalInstructionsOnly() {
    return new Promise((resolve) => {
        const finalInstructions = document.getElementById('finalPracticeInstructions');
        
        if (finalInstructions) {
            finalInstructions.style.transition = 'opacity 0.3s ease';
            finalInstructions.style.opacity = '0';
            
            setTimeout(() => {
                finalInstructions.style.display = 'none';
                resolve();
            }, 300);
        } else {
            resolve();
        }
    });
}

// Fade out final instructions and play button when subsequent cuts are made
async function fadeOutFinalInstructionsAndButton() {
    return new Promise((resolve) => {
        const finalInstructions = document.getElementById('finalPracticeInstructions');
        const practicePlayBtn = document.getElementById('practicePlayBtn');
        
        let fadePromises = [];
        
        if (finalInstructions) {
            fadePromises.push(new Promise((resolveFinal) => {
                finalInstructions.style.transition = 'opacity 0.3s ease';
                finalInstructions.style.opacity = '0';
                
                setTimeout(() => {
                    finalInstructions.style.display = 'none';
                    resolveFinal();
                }, 300);
            }));
        }
        
        if (practicePlayBtn) {
            fadePromises.push(new Promise((resolveButton) => {
                practicePlayBtn.style.transition = 'opacity 0.3s ease';
                practicePlayBtn.style.opacity = '0';
                
                setTimeout(() => {
                    practicePlayBtn.style.display = 'none';
                    resolveButton();
                }, 300);
            }));
        }
        
        // Wait for all fade promises to complete, or resolve immediately if nothing to fade
        if (fadePromises.length > 0) {
            Promise.all(fadePromises).then(resolve);
        } else {
            resolve();
        }
    });
}

// Show percentage split for practice mode using original styling
function showPracticePercentageSplit(areaResults) {
    console.log('📊 Showing practice percentage split');

    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Always reuse the same percentage display element for consistent positioning
    let percentageDisplay = document.getElementById('practicePercentageDisplay');

    if (!percentageDisplay) {
        // Create percentage display element positioned directly under canvas
        percentageDisplay = document.createElement('div');
        percentageDisplay.id = 'practicePercentageDisplay';
        percentageDisplay.className = 'attempt-result';

        // Insert directly after canvas container (same position for all cuts)
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.parentNode.insertBefore(percentageDisplay, canvasContainer.nextSibling);
        }
    }

    // Use practice mode matching styles - dark grey for consistency
    const leftColor = '#666666';  // Dark grey for practice mode (matches other days)
    const greyColor = '#999999'; // Lighter grey for right side

    percentageDisplay.innerHTML = `
        <div class="attempt-info">
            <div class="split-display-large">
                <span style="color: ${leftColor}; font-weight: bold; font-size: ${splitFontSize}px;">${areaResults.leftPercentage.toFixed(1)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px;">${areaResults.rightPercentage.toFixed(1)}%</span>
            </div>
        </div>
    `;
    
    // Show the display with fade in (reset any previous fade state)
    percentageDisplay.style.display = 'block';
    percentageDisplay.style.opacity = '0';
    percentageDisplay.style.transition = 'opacity 0.5s ease';
    percentageDisplay.style.textAlign = 'center';
    // Remove inline margin - let CSS handle consistent positioning
    
    setTimeout(() => {
        percentageDisplay.style.opacity = '1';
    }, 100);
    
    console.log('✅ Practice percentage split displayed with original styling');
}

// Initialize practice mode - can be called on fresh start or refresh
async function initializePracticeMode() {
    try {
        console.log('🎮 Initializing practice mode...');
        
        // Set practice mode
        isPractiseMode = true;
        isFirstPracticeCut = true; // Reset for new practice session
        hasShownFinalInstructions = false; // Reset final instructions flag
        localStorage.setItem('dailyShapes_practiceMode', 'true');
        
        // Hide the original buttons container but maintain layout space
        const buttonsContainer = document.querySelector('.buttons-below-canvas');
        if (buttonsContainer) {
            buttonsContainer.style.visibility = 'hidden';
            buttonsContainer.style.opacity = '0';
            buttonsContainer.style.pointerEvents = 'none';
        }
        
        // Immediately show the practice play button
        await showPlayButtonForPractice();
        
        const goalDisplay = document.getElementById('goalDisplay');
        if (goalDisplay) {
            goalDisplay.style.display = 'none';
        }
        
        // Clear any existing practice elements
        const existingElements = [
            'phase1Instructions',
            'phase2Instructions', 
            'finalPracticeInstructions',
            'practicePercentageDisplay',
            'playBtnBelowCanvas',
            'practicePlayBtn'
        ];
        
        existingElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });
        
        // Load and setup demo shape
        await loadPractiseShape();
        
    } catch (error) {
        console.error('💥 Error initializing practice mode:', error);
        showCommentary('Failed to initialize practice mode. Please refresh the page.', false);
    }
}

async function loadPractiseShape() {
    try {
        console.log('🎮 Loading demo-shape.geojson for practise mode...');
        
        // Set game state to cutting mode for practise
        gameState = 'cutting';
        isInteractionEnabled = true;
        
        // Reset attempt tracking for practice (unlimited cuts)
        currentAttempts = [];
        attemptCount = 0;
        
        // Load demo-shape.geojson
        const response = await fetch('./demo-shape.geojson');
        if (!response.ok) {
            throw new Error(`Failed to load demo-shape.geojson: ${response.status}`);
        }
        
        const geoJSON = await response.text();
        currentGeoJSON = JSON.parse(geoJSON);
        
        // Parse and render the practice shape
        const parseResult = parseGeometry(currentGeoJSON);
        parsedShapes = parseResult.shapes;
        
        // Start with clear canvas for fade-in animation
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Show shape immediately (no fade-in)
        renderShapeForCutting(parsedShapes, false);
        isShapeAnimationComplete = true;
        
        // Enable canvas interaction for practice cutting
        isShapeAnimationComplete = true; // Mark animation as complete for practice mode
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            console.log('🔧 Canvas interaction enabled for practise mode');
        }
        
        // Show phase 1 cutting instructions
        showPhase1Instructions();
        
        console.log('✅ Practice shape loaded and ready for cutting');
        if (window.debugLogger) {
            debugLogger.log('Practice mode shape loaded successfully');
        }
        
    } catch (error) {
        console.error('💥 Error loading practice shape:', error);
        if (window.debugLogger) {
            debugLogger.error('Practice shape loading failed', error);
        }
        // Show error message
        showCommentary('Failed to load practice shape. Please refresh the page.', false);
    }
}

// Fade in animation for grid and shape in practice mode
async function fadeInGridAndShape() {
    return new Promise((resolve) => {
        const fadeDuration = 800; // 0.8 second fade in
        const fadeStartTime = Date.now();
        let frameCount = 0;
        
        console.log('🎬 Starting fadeInGridAndShape animation...');
        
        // Set animation flag to suppress excessive logging
        window.isAnimating = true;
        
        const fadeFrame = () => {
            frameCount++;
            const elapsed = Date.now() - fadeStartTime;
            const progress = Math.min(elapsed / fadeDuration, 1);
            const alpha = progress; // 0 to 1
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw with increasing opacity
            ctx.save();
            ctx.globalAlpha = alpha;
            drawGrid();
            renderShapeForCutting(parsedShapes, false);
            ctx.restore();
            
            if (progress < 1) {
                requestAnimationFrame(fadeFrame);
            } else {
                // Clear animation flag
                window.isAnimating = false;
                isShapeAnimationComplete = true; // Mark animation as complete
                console.log(`✅ fadeInGridAndShape animation completed! Frames: ${frameCount}, Duration: ${elapsed}ms`);
                
                // Enable interaction after animation completes
                setInteractionEnabled(true);
                const canvasElement = document.getElementById('geoCanvas');
                if (canvasElement) {
                    canvasElement.style.pointerEvents = 'auto';
                }
                console.log('🎯 Canvas interaction enabled after fade-in animation completed');
                
                resolve();
            }
        };
        
        fadeFrame();
    });
}

// v3.0 - Removed swipe instruction text (not needed for single shape per day)

// v3.0 - Removed swipe indicators (not needed for single shape per day)

// v3.0 - No swipe indicators to hide

function updateSwipeArrows() {
    const leftArrow = document.getElementById('leftArrow');
    const rightArrow = document.getElementById('rightArrow');
    
    if (!leftArrow || !rightArrow) {
        console.error('🚫 Arrow elements not found');
        return;
    }
    
    console.log('🔄 Updating arrows for replayShapeIndex:', replayShapeIndex);
    
    // Linear arrangement: Shape 1 [left end] ← Shape 2 ← Shape 3 [right end]
    
    // Left arrow shows when we can swipe right to go backward (when not at shape 1)
    if (replayShapeIndex > 1) {
        leftArrow.style.display = 'block';
        console.log('👈 Left arrow shown - can swipe to shape', replayShapeIndex - 1);
    } else {
        leftArrow.style.display = 'none';
        console.log('👈 Left arrow hidden - at first shape');
    }
    
    // Right arrow shows when we can swipe left to go forward (when not at last shape)
    const totalShapesForReplay = window.devvitTotalShapes || 10;
    if (replayShapeIndex < totalShapesForReplay) {
        rightArrow.style.display = 'block';
        console.log('👉 Right arrow shown - can swipe to shape', replayShapeIndex + 1);
    } else {
        rightArrow.style.display = 'none';
        console.log('👉 Right arrow hidden - at last shape');
    }

    console.log('🔄 Arrow state for shape ' + replayShapeIndex + ': left=' + (replayShapeIndex > 1 ? 'visible' : 'hidden') + ' (can go to ' + (replayShapeIndex - 1) + '), right=' + (replayShapeIndex < totalShapesForReplay ? 'visible' : 'hidden') + ' (can go to ' + (replayShapeIndex + 1) + ')');
}

// Replay functionality (variables declared above)
let swipeStartX = 0;
let swipeStartY = 0;
let swipeMinDistance = 30;

function setupReplayNavigation() {
    // Setup swipe gestures for replay navigation
    setupSwipeGestures();
}

function setupSwipeGestures() {
    if (!canvas) {
        console.log('No canvas found for swipe setup');
        return;
    }
    
    console.log('Setting up swipe gestures for replay mode');
    
    // Log current swipe capability status
    const gameCompleted = gameState === 'finished' && gameResults.length === (window.devvitTotalShapes || 10);
    console.log('🔧 Swipe capability status:');
    console.log('  - isReplayMode:', isReplayMode);
    console.log('  - gameState:', gameState);
    console.log('  - gameResults.length:', gameResults.length);
    console.log('  - gameCompleted:', gameCompleted);
    console.log('  - replayShapeIndex:', replayShapeIndex);
    console.log('  - Swipes will work when: all 10 shapes completed (gameState: results or finished)');
    
    // Use canvas container primarily to avoid conflicts with canvas game events
    const canvasContainer = document.querySelector('.canvas-container');
    const targets = [];
    
    if (canvasContainer) {
        targets.push(canvasContainer);
        console.log('Primary target: canvas container for swipes');
    } else {
        targets.push(canvas);
        console.log('Fallback target: canvas for swipes (container not found)');
    }
    
    targets.forEach(target => {
        console.log('🔧 Setting up swipe listeners on:', target.tagName || target.id || 'element');
        
        // Remove any existing swipe listeners first
        target.removeEventListener('touchstart', handleSwipeTouchStart);
        target.removeEventListener('touchend', handleSwipeTouchEnd);
        target.removeEventListener('mousedown', handleSwipeMouseStart);
        target.removeEventListener('mouseup', handleSwipeMouseEnd);
        console.log('  - Removed existing listeners');
        
        // Add touch listeners
        target.addEventListener('touchstart', handleSwipeTouchStart, { 
            passive: false, 
            capture: true 
        });
        target.addEventListener('touchend', handleSwipeTouchEnd, { 
            passive: false, 
            capture: true 
        });
        console.log('  - Added touch listeners (touchstart, touchend)');
        
        // Add mouse listeners for desktop testing
        target.addEventListener('mousedown', handleSwipeMouseStart);
        target.addEventListener('mouseup', handleSwipeMouseEnd);
        console.log('  - Added mouse listeners (mousedown, mouseup)');
        
        // Add a test click listener to verify events are working
        target.addEventListener('click', function(e) {
            console.log('🧪 CLICK TEST - Event detected on:', target.tagName || target.id);
        });
        console.log('  - Added test click listener');
        
        console.log('✅ All swipe listeners attached to:', target.tagName || target.id || 'element');
    });
}

function handleSwipeTouchStart(event) {
    console.log('🟢 TOUCH START EVENT DETECTED - isReplayMode:', isReplayMode);
    
    // Allow swipes when all 10 shapes are completed (either in 'results' or 'finished' state)
    const gameCompleted = gameResults.length === (window.devvitTotalShapes || 10) && (gameState === 'results' || gameState === 'finished');
    const canSwipe = gameCompleted;
    
    if (!canSwipe) {
        console.log('Swipes disabled. Current state:', {
            gameState: gameState,
            gameResultsLength: gameResults.length,
            isReplayMode: isReplayMode,
            gameCompleted: gameCompleted
        });
        return;
    }
    
    console.log('✅ Swipes enabled! Game completed, processing touch...');
    
    // Stop event from bubbling
    event.stopPropagation();
    
    const touch = event.touches[0];
    if (!touch) {
        console.log('No touch found in event');
        return;
    }
    
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
    
    console.log('Swipe start recorded:', swipeStartX, swipeStartY);
}

function handleSwipeTouchEnd(event) {
    console.log('🟢 TOUCH END EVENT DETECTED - isReplayMode:', isReplayMode);
    
    // Allow swipes when all 10 shapes are completed (either in 'results' or 'finished' state)
    const gameCompleted = gameResults.length === (window.devvitTotalShapes || 10) && (gameState === 'results' || gameState === 'finished');
    const canSwipe = gameCompleted;
    
    if (!canSwipe) {
        console.log('Swipes disabled. Current state:', {
            gameState: gameState,
            gameResultsLength: gameResults.length,
            isReplayMode: isReplayMode,
            gameCompleted: gameCompleted
        });
        return;
    }
    
    // Stop event from bubbling
    event.stopPropagation();
    event.preventDefault();
    
    const touch = event.changedTouches[0];
    if (!touch) {
        console.log('No touch found in changedTouches');
        return;
    }
    
    const swipeEndX = touch.clientX;
    const swipeEndY = touch.clientY;
    
    console.log('Swipe end coordinates:', swipeEndX, swipeEndY);
    console.log('Swipe start was:', swipeStartX, swipeStartY);
    
    const deltaX = swipeEndX - swipeStartX;
    const deltaY = swipeEndY - swipeStartY;
    
    console.log('Swipe deltas - X:', deltaX, 'Y:', deltaY);
    console.log('Absolute deltas - X:', Math.abs(deltaX), 'Y:', Math.abs(deltaY));
    console.log('Min distance required:', swipeMinDistance);
    console.log('Current shape index:', replayShapeIndex);
    
    // More lenient swipe detection
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const isLongEnough = Math.abs(deltaX) > swipeMinDistance;
    
    console.log('Is horizontal swipe:', isHorizontalSwipe);
    console.log('Is long enough:', isLongEnough);
    
    if (isHorizontalSwipe && isLongEnough) {
        console.log('✅ Valid swipe detected!');
        
        if (deltaX > 0) {
            // Swipe right - see image "to the left" (previous/lower numbered shape)
            console.log('➡️ Swiping right to see previous shape');
            if (replayShapeIndex > 1) {
                replayShapeIndex--;
                console.log('📍 Moving to shape:', replayShapeIndex);
                // Show replay shape (we know all results exist since game is completed)
                showReplayShape(replayShapeIndex);
                updateSwipeArrows();
            } else {
                console.log('🚫 Already at first shape (1)');
            }
        } else {
            // Swipe left - see image "to the right" (next/higher numbered shape)
            console.log('⬅️ Swiping left to see next shape');
            const totalShapesSwipe = window.devvitTotalShapes || 10;
            if (replayShapeIndex < totalShapesSwipe) {
                replayShapeIndex++;
                console.log('📍 Moving to shape:', replayShapeIndex);
                // Show replay shape (we know all results exist since game is completed)
                showReplayShape(replayShapeIndex);
                updateSwipeArrows();
            } else {
                console.log('🚫 Already at last shape (' + totalShapesSwipe + ')');
            }
        }
    } else {
        console.log('❌ Invalid swipe - horizontal:', isHorizontalSwipe, 'long enough:', isLongEnough);
    }
}

// Mouse event handlers for desktop testing
function handleSwipeMouseStart(event) {
    console.log('🟢 MOUSE DOWN EVENT DETECTED - isReplayMode:', isReplayMode);
    console.log('🔍 Current replayShapeIndex at mouse start:', replayShapeIndex);
    
    // Allow swipes when all 10 shapes are completed (either in 'results' or 'finished' state)
    const gameCompleted = gameResults.length === (window.devvitTotalShapes || 10) && (gameState === 'results' || gameState === 'finished');
    const canSwipe = gameCompleted;
    
    if (!canSwipe) {
        console.log('Swipes disabled. Current state:', {
            gameState: gameState,
            gameResultsLength: gameResults.length,
            isReplayMode: isReplayMode,
            gameCompleted: gameCompleted
        });
        return;
    }
    
    console.log('✅ Mouse swipes enabled! Game completed, processing mouse down...');
    
    swipeStartX = event.clientX;
    swipeStartY = event.clientY;
    
    console.log('Mouse swipe start recorded:', swipeStartX, swipeStartY);
}

function handleSwipeMouseEnd(event) {
    console.log('🟢 MOUSE UP EVENT DETECTED - isReplayMode:', isReplayMode);
    console.log('🔍 Current replayShapeIndex at mouse end:', replayShapeIndex);
    
    // Allow swipes when all 10 shapes are completed (either in 'results' or 'finished' state)
    const gameCompleted = gameResults.length === (window.devvitTotalShapes || 10) && (gameState === 'results' || gameState === 'finished');
    const canSwipe = gameCompleted;
    
    if (!canSwipe) {
        console.log('Swipes disabled. Current state:', {
            gameState: gameState,
            gameResultsLength: gameResults.length,
            isReplayMode: isReplayMode,
            gameCompleted: gameCompleted
        });
        return;
    }
    
    const swipeEndX = event.clientX;
    const swipeEndY = event.clientY;
    
    console.log('Mouse swipe end coordinates:', swipeEndX, swipeEndY);
    console.log('Mouse swipe start was:', swipeStartX, swipeStartY);
    
    const deltaX = swipeEndX - swipeStartX;
    const deltaY = swipeEndY - swipeStartY;
    
    console.log('Mouse swipe deltas - X:', deltaX, 'Y:', deltaY);
    
    // Same logic as touch
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const isLongEnough = Math.abs(deltaX) > swipeMinDistance;
    
    console.log('Mouse - Is horizontal swipe:', isHorizontalSwipe);
    console.log('Mouse - Is long enough:', isLongEnough);
    
    if (isHorizontalSwipe && isLongEnough) {
        console.log('✅ Valid mouse swipe detected!');
        
        if (deltaX > 0) {
            // Swipe right - see image "to the left" (previous/lower numbered shape)
            console.log('➡️ Mouse swiping right to see previous shape');
            if (replayShapeIndex > 1) {
                replayShapeIndex--;
                console.log('📍 Moving to shape:', replayShapeIndex);
                // Show replay shape (we know all results exist since game is completed)
                showReplayShape(replayShapeIndex);
                updateSwipeArrows();
            } else {
                console.log('🚫 Already at first shape (1)');
            }
        } else {
            // Swipe left - see image "to the right" (next/higher numbered shape)
            console.log('⬅️ Mouse swiping left to see next shape');
            const totalShapesMouseSwipe = window.devvitTotalShapes || 10;
            if (replayShapeIndex < totalShapesMouseSwipe) {
                replayShapeIndex++;
                console.log('📍 Moving to shape:', replayShapeIndex);
                // Show replay shape (we know all results exist since game is completed)
                showReplayShape(replayShapeIndex);
                updateSwipeArrows();
            } else {
                console.log('🚫 Already at last shape (' + totalShapesMouseSwipe + ')');
            }
        }
    } else {
        console.log('❌ Invalid mouse swipe - horizontal:', isHorizontalSwipe, 'long enough:', isLongEnough);
    }
}

function showReplayShape(shapeIndex) {
    if (gameResults[shapeIndex - 1]) {
        const result = gameResults[shapeIndex - 1];
        console.log('🔍 showReplayShape for shape', shapeIndex, 'with result:', result);
        console.log('🔍 splitAreas data:', result.splitAreas);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Check if we have a captured screenshot for this shape
        if (shapeScreenshots[shapeIndex]) {
            console.log('📸 Using captured screenshot for shape', shapeIndex);
            displayShapeScreenshot(shapeIndex);
        } else {
            console.log('📸 No screenshot available for shape', shapeIndex, ', falling back to render');
            // Fallback to previous rendering method
            if (result.splitAreas) {
                renderSplitResult(result.splitAreas, shapeIndex);
            } else {
                // If no split areas, draw basic grid and shape outline
                drawGrid();
                if (result.originalShape) {
                    drawShapeOutlineFromGeoJSON(result.originalShape);
                }
                // Still draw cut vectors even if no split areas
                if (result.cutVector) {
                    drawVector(result.cutVector.start, result.cutVector.end);
                    console.log('🎨 Drew cut vector for shape', shapeIndex, 'without split areas');
                }
                if (shapeIndex === 3 && result.firstCutVector) {
                    drawVector(result.firstCutVector.start, result.firstCutVector.end);
                    console.log('🎨 Drew first cut vector for shape 3 without split areas');
                }
            }
        }
        
        // Cut vectors are now drawn by the pixel-based rendering functions
        
        // Don't enable replay mode here - wait until stats popup is closed
        canvas.style.pointerEvents = 'none';
        
        // Ensure no buttons are shown during replay mode - clear any button text and hide
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.style.display = 'none';
            playBtn.textContent = '';
            playBtn.disabled = true;
            playBtn.classList.remove('again');
        }
        hidePlayButton();
        
        // Update arrows to show correct navigation options
        updateSwipeArrows();
        
        // Highlight the current shape in the results table
        highlightCurrentShapeInTable(shapeIndex);
        
        console.log('🔄 Replay mode activated for shape:', shapeIndex);
        console.log('🔄 isReplayMode is now:', isReplayMode);
        console.log('🔄 gameState is:', gameState);
    }
}

function renderSplitResult(splitAreas, shapeIndex) {
    console.log('🎨 renderSplitResult called for shape', shapeIndex, 'with splitAreas:', splitAreas);
    
    // Get the result data to access cut vectors
    const result = gameResults[shapeIndex - 1];
    if (!result) {
        console.log('🎨 No result data available for shape', shapeIndex);
        return;
    }
    
    // Always clear the canvas first to remove any previous renders
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Use pixel-based rendering like during gameplay
    console.log('🔍 Checking rendering conditions for shape', shapeIndex);
    console.log('🔍 result.firstCutVector:', !!result.firstCutVector);
    console.log('🔍 result.cutVector:', !!result.cutVector);
    console.log('🔍 splitAreas structure:', splitAreas);
    
    if (shapeIndex === 3 && result.firstCutVector && result.cutVector) {
        console.log('🎨 Rendering pixel-based quadrant colors for shape 3');
        // This function handles clearing, grid, colors, outlines, and vectors
        renderReplayQuadrantColors(result.firstCutVector, result.cutVector, result.originalShape);
    } else if (result.cutVector && (shapeIndex === 1 || shapeIndex === 2)) {
        // For shapes 1 and 2, render binary colors if we have a cut vector
        console.log('🎨 Rendering pixel-based binary colors for shape', shapeIndex);
        // This function handles clearing, grid, colors, outlines, and vectors
        renderReplayBinaryColors(result.cutVector, shapeIndex, result.originalShape);
    } else {
        console.log('🎨 No color rendering - conditions not met');
        console.log('🔍 Shape:', shapeIndex, 'Has cutVector:', !!result.cutVector, 'Has firstCutVector:', !!result.firstCutVector);
        
        // If no pixel rendering, draw basic elements
        drawGrid();
        if (result.originalShape) {
            drawShapeOutlineFromGeoJSON(result.originalShape);
        }
        // Draw cut vectors if available for THIS specific shape only
        if (result.cutVector) {
            drawVector(result.cutVector.start, result.cutVector.end);
        }
        // Only draw first cut vector if this IS shape 3
        if (shapeIndex === 3 && result.firstCutVector) {
            drawVector(result.firstCutVector.start, result.firstCutVector.end);
        }
    }
}

// Removed old renderQuadrantColors function - replaced with pixel-based rendering

// Old overlay functions - replaced with pixel-based rendering
// These simple rectangle overlays didn't properly follow shape boundaries
/*
function renderBinaryOverlay() { ... }
function renderQuadrantOverlay() { ... }  
function drawHalfShapeOverlay() { ... }
function drawQuadrantOverlay() { ... }
*/

function drawPolygonFill(coordinates) {
    if (!coordinates || coordinates.length === 0) return;
    
    ctx.beginPath();
    ctx.moveTo(coordinates[0][0], coordinates[0][1]);
    
    for (let i = 1; i < coordinates.length; i++) {
        ctx.lineTo(coordinates[i][0], coordinates[i][1]);
    }
    
    ctx.closePath();
    ctx.fill();
}

// Pixel-based color rendering for replay mode
function renderReplayBinaryColors(cutVector, shapeIndex, originalShape) {
    console.log('🎨 Starting pixel-based binary color rendering for shape', shapeIndex);
    
    // Get shape mask to only color pixels inside the shape
    const shapeMaskData = getShapeMaskData(originalShape);
    if (!shapeMaskData) {
        console.error('🎨 Could not get shape mask data');
        return;
    }
    
    const resultImageData = ctx.createImageData(380, 380);
    const resultPixels = resultImageData.data;
    
    // First pass: color pixels directly intersected by cut vector
    for (let y = 0; y < 380; y++) {
        for (let x = 0; x < 380; x++) {
            const pixelIndex = (y * 380 + x) * 4;
            
            // Check if pixel is inside the shape
            if (shapeMaskData[pixelIndex] > 128) { // Shape pixel
                // Determine which side of the cut vector this pixel is on
                const side = getPixelSideOfVector(x, y, cutVector.start, cutVector.end,
                    cutVector.end.x - cutVector.start.x, cutVector.end.y - cutVector.start.y);
                
                if (side === 'left') {
                    // Shape-based color for left side (daily mode) or practice mode color
                    const color = getDailyCutShadingColor();
                    resultPixels[pixelIndex] = color.r;     // R
                    resultPixels[pixelIndex + 1] = color.g; // G
                    resultPixels[pixelIndex + 2] = color.b; // B
                    resultPixels[pixelIndex + 3] = 255;     // A
                } else if (side === 'right') {
                    // Grey for right side (matching renderVectorCutResult)
                    resultPixels[pixelIndex] = 221;     // R
                    resultPixels[pixelIndex + 1] = 221; // G
                    resultPixels[pixelIndex + 2] = 221; // B
                    resultPixels[pixelIndex + 3] = 255; // A
                } else {
                    // On the cut line - black
                    resultPixels[pixelIndex] = 0;       // R
                    resultPixels[pixelIndex + 1] = 0;   // G
                    resultPixels[pixelIndex + 2] = 0;   // B
                    resultPixels[pixelIndex + 3] = 255; // A
                }
            } else {
                // Outside shape - transparent
                resultPixels[pixelIndex] = 0;       // R
                resultPixels[pixelIndex + 1] = 0;   // G
                resultPixels[pixelIndex + 2] = 0;   // B
                resultPixels[pixelIndex + 3] = 0;   // A (transparent)
            }
        }
    }
    
    // Second pass: assign floating shape pieces to nearest colored region
    assignFloatingPiecesToNearestSide(resultPixels, shapeMaskData, canvas.width, canvas.height, 'binary');
    
    // Clear canvas and draw grid first (so it appears behind shapes)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    // Create temporary canvas for colored pixels with transparency
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(resultImageData, 0, 0);
    
    // Draw the colored result on top of grid with transparency preserved
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Draw shape outlines on top
    drawShapeOutlinesFromGeoJSON(originalShape);
    
    // Draw the specific cut vector for this shape on top
    drawVector(cutVector.start, cutVector.end);
    
    console.log('🎨 Binary color rendering complete');
}

function renderReplayQuadrantColors(firstCutVector, secondCutVector, originalShape) {
    console.log('🎨 Starting pixel-based quadrant color rendering for shape 3');
    
    // Get shape mask to only color pixels inside the shape
    const shapeMaskData = getShapeMaskData(originalShape);
    if (!shapeMaskData) {
        console.error('🎨 Could not get shape mask data');
        return;
    }
    
    const resultImageData = ctx.createImageData(380, 380);
    const resultPixels = resultImageData.data;
    
    // Define quadrant colors (same as gameplay)
    const quadrantColors = {
        1: { r: 255, g: 100, b: 100 }, // Red
        2: { r: 100, g: 150, b: 255 }, // Blue  
        3: { r: 100, g: 200, b: 100 }, // Green
        4: { r: 255, g: 200, b: 100 }  // Yellow
    };
    
    // First pass: color pixels directly intersected by cut vectors
    for (let y = 0; y < 380; y++) {
        for (let x = 0; x < 380; x++) {
            const pixelIndex = (y * 380 + x) * 4;
            
            // Check if pixel is inside the shape
            if (shapeMaskData[pixelIndex] > 128) { // Shape pixel
                // Determine which side of each cut vector this pixel is on
                const dx1 = firstCutVector.end.x - firstCutVector.start.x;
                const dy1 = firstCutVector.end.y - firstCutVector.start.y;
                const side1 = getPixelSideOfVector(x, y, firstCutVector.start, firstCutVector.end, dx1, dy1);
                
                const dx2 = secondCutVector.end.x - secondCutVector.start.x;
                const dy2 = secondCutVector.end.y - secondCutVector.start.y;
                const side2 = getPixelSideOfVector(x, y, secondCutVector.start, secondCutVector.end, dx2, dy2);
                
                let quadrant;
                if (side1 === 'right' && side2 === 'right') {
                    quadrant = 1;
                } else if (side1 === 'left' && side2 === 'right') {
                    quadrant = 2;
                } else if (side1 === 'left' && side2 === 'left') {
                    quadrant = 3;
                } else if (side1 === 'right' && side2 === 'left') {
                    quadrant = 4;
                } else {
                    // On a cut line - black
                    resultPixels[pixelIndex] = 0;       // R
                    resultPixels[pixelIndex + 1] = 0;   // G
                    resultPixels[pixelIndex + 2] = 0;   // B
                    resultPixels[pixelIndex + 3] = 255; // A
                    continue;
                }
                
                const color = quadrantColors[quadrant];
                resultPixels[pixelIndex] = color.r;     // R
                resultPixels[pixelIndex + 1] = color.g; // G
                resultPixels[pixelIndex + 2] = color.b; // B
                resultPixels[pixelIndex + 3] = 255;     // A
            } else {
                // Outside shape - transparent
                resultPixels[pixelIndex] = 0;       // R
                resultPixels[pixelIndex + 1] = 0;   // G
                resultPixels[pixelIndex + 2] = 0;   // B
                resultPixels[pixelIndex + 3] = 0;   // A (transparent)
            }
        }
    }
    
    // Second pass: assign floating shape pieces to nearest colored region
    assignFloatingPiecesToNearestSide(resultPixels, shapeMaskData, canvas.width, canvas.height, 'quadrant', quadrantColors);
    
    // Clear canvas and draw grid first (so it appears behind shapes)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    // Create temporary canvas for colored pixels with transparency
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(resultImageData, 0, 0);
    
    // Draw the colored result on top of grid with transparency preserved
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Draw shape outlines on top
    drawShapeOutlinesFromGeoJSON(originalShape);
    
    // Draw both cut vectors for shape 3 on top
    drawVector(firstCutVector.start, firstCutVector.end);
    drawVector(secondCutVector.start, secondCutVector.end);
    
    console.log('🎨 Quadrant color rendering complete');
}

// Function to assign floating shape pieces to nearest colored region
function assignFloatingPiecesToNearestSide(resultPixels, shapeMaskData, width, height, mode, quadrantColors = null) {
    console.log('🧩 Starting floating piece assignment for mode:', mode);
    
    // Create a visited array to track processed pixels
    const visited = new Array(width * height).fill(false);
    
    // Define colors for binary mode
    const binaryColors = {
        left: { r: 100, g: 150, b: 255 }, // Blue
        right: { r: 255, g: 100, b: 100 } // Red
    };
    
    // Helper function to check if a pixel is colored (not transparent and not black outline)
    function isPixelColored(pixelIndex) {
        const r = resultPixels[pixelIndex];
        const g = resultPixels[pixelIndex + 1];
        const b = resultPixels[pixelIndex + 2];
        const a = resultPixels[pixelIndex + 3];
        
        // Transparent or black outline pixels are not considered colored regions
        return a > 0 && !(r === 0 && g === 0 && b === 0);
    }
    
    // Helper function to check if a pixel is an uncolored shape pixel
    function isUncoloredShapePixel(pixelIndex) {
        return shapeMaskData[pixelIndex] > 128 && !isPixelColored(pixelIndex);
    }
    
    // Flood fill to find connected uncolored regions
    function floodFillRegion(startX, startY) {
        const region = [];
        const stack = [{x: startX, y: startY}];
        
        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const pixelIndex = (y * width + x) * 4;
            
            if (x < 0 || x >= width || y < 0 || y >= height || visited[y * width + x]) {
                continue;
            }
            
            if (!isUncoloredShapePixel(pixelIndex)) {
                continue;
            }
            
            visited[y * width + x] = true;
            region.push({x, y, pixelIndex});
            
            // Check 4-connected neighbors
            stack.push({x: x + 1, y: y});
            stack.push({x: x - 1, y: y});
            stack.push({x: x, y: y + 1});
            stack.push({x: x, y: y - 1});
        }
        
        return region;
    }
    
    // Find nearest colored pixel to a region
    function findNearestColoredPixel(region) {
        let minDistance = Infinity;
        let nearestColoredPixel = null;
        
        for (const regionPixel of region) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelIndex = (y * width + x) * 4;
                    
                    if (isPixelColored(pixelIndex)) {
                        const distance = Math.sqrt(
                            Math.pow(x - regionPixel.x, 2) + Math.pow(y - regionPixel.y, 2)
                        );
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestColoredPixel = {x, y, pixelIndex};
                        }
                    }
                }
            }
        }
        
        return nearestColoredPixel;
    }
    
    // Process all uncolored shape regions
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            
            if (!visited[y * width + x] && isUncoloredShapePixel(pixelIndex)) {
                console.log('🧩 Found uncolored region at:', x, y);
                
                // Find the connected component
                const region = floodFillRegion(x, y);
                
                if (region.length > 0) {
                    console.log('🧩 Region size:', region.length, 'pixels');
                    
                    // Find the nearest colored pixel
                    const nearestPixel = findNearestColoredPixel(region);
                    
                    if (nearestPixel) {
                        // Get the color of the nearest pixel
                        const nearestR = resultPixels[nearestPixel.pixelIndex];
                        const nearestG = resultPixels[nearestPixel.pixelIndex + 1];
                        const nearestB = resultPixels[nearestPixel.pixelIndex + 2];
                        
                        console.log('🧩 Assigning region to color:', nearestR, nearestG, nearestB);
                        
                        // Color all pixels in the region with the same color
                        for (const regionPixel of region) {
                            resultPixels[regionPixel.pixelIndex] = nearestR;
                            resultPixels[regionPixel.pixelIndex + 1] = nearestG;
                            resultPixels[regionPixel.pixelIndex + 2] = nearestB;
                            resultPixels[regionPixel.pixelIndex + 3] = 255; // Opaque
                        }
                    }
                }
            }
        }
    }
    
    console.log('🧩 Floating piece assignment complete');
}

// Screenshot capture system for replay mode
let shapeScreenshots = {}; // Store captured screenshots by shape index

function captureShapeScreenshot(shapeIndex) {
    try {
        // Capture the current canvas state as a data URL
        const screenshotDataURL = canvas.toDataURL('image/png');
        shapeScreenshots[shapeIndex] = screenshotDataURL;
        console.log('📸 Captured screenshot for shape', shapeIndex);
    } catch (error) {
        console.error('📸 Failed to capture screenshot for shape', shapeIndex, ':', error);
    }
}

function displayShapeScreenshot(shapeIndex) {
    const screenshot = shapeScreenshots[shapeIndex];
    if (!screenshot) {
        console.error('📸 No screenshot available for shape', shapeIndex);
        return;
    }
    
    // Create an image object to load the screenshot
    const img = new Image();
    img.onload = function() {
        // Clear canvas and draw the screenshot
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        console.log('📸 Successfully displayed screenshot for shape', shapeIndex);
    };
    img.onerror = function() {
        console.error('📸 Failed to load screenshot for shape', shapeIndex);
    };
    img.src = screenshot;
}

function getShapeMaskData(geoJSON = null) {
    // Create a temporary canvas to render the shape mask
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Use provided geoJSON or fall back to global parsedShapes
    let shapesToUse;
    let useDirectCoordinates = false;
    if (geoJSON) {
        console.log('🔍 GeoJSON provided for mask generation:', geoJSON);
        console.log('🔍 GeoJSON features count:', geoJSON.features?.length);
        geoJSON.features?.forEach((feature, i) => {
            console.log(`🔍 Feature ${i}: type=${feature.geometry?.type}, coordinates=${feature.geometry?.coordinates?.length} parts`);
        });
        
        const parseResult = parseGeometry(geoJSON);
        shapesToUse = parseResult.shapes;
        useDirectCoordinates = parseResult.useDirectCoordinates;
        console.log('🎨 Parsed', shapesToUse.length, 'shapes from provided GeoJSON for mask generation');
    } else {
        shapesToUse = parsedShapes;
        console.log('🎨 Using global parsedShapes for mask generation with', shapesToUse.length, 'shapes');
    }
    
    if (!shapesToUse.length) {
        console.error('🎨 No shapes available for mask generation');
        return null;
    }
    
    // Log each shape's details
    shapesToUse.forEach((shape, i) => {
        console.log(`🔍 Shape ${i + 1}: outerRing=${shape.outerRing?.length} points, holes=${shape.holes?.length || 0}`);
        if (shape.holes?.length > 0) {
            shape.holes.forEach((hole, j) => {
                console.log(`  🔍 Hole ${j + 1}: ${hole.length} points`);
            });
        }
    });
    
    // Calculate bounds and scaling (same as main rendering)
    const bounds = calculateBounds(shapesToUse);
    const scale = calculateScale(bounds, useDirectCoordinates);
    const offset = calculateOffset(bounds, scale, useDirectCoordinates);
    
    console.log('🔍 Mask rendering - bounds:', bounds, 'scale:', scale, 'offset:', offset);
    
    // Fill the shape in white on black background
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    tempCtx.fillStyle = 'white';
    shapesToUse.forEach((shape, index) => {
        console.log('🎨 Drawing shape', index + 1, 'for mask with', shape.outerRing?.length, 'outer ring points');
        tempCtx.beginPath();
        drawRingForPixelAnalysis(tempCtx, shape.outerRing, scale, offset);
        tempCtx.fill();
        
        // Handle holes
        if (shape.holes && shape.holes.length > 0) {
            console.log('🎨 Drawing', shape.holes.length, 'holes for shape', index + 1);
            tempCtx.fillStyle = 'black';
            shape.holes.forEach((hole, holeIndex) => {
                console.log('🎨 Drawing hole', holeIndex + 1, 'with', hole.length, 'points');
                tempCtx.beginPath();
                drawRingForPixelAnalysis(tempCtx, hole, scale, offset);
                tempCtx.fill();
            });
            tempCtx.fillStyle = 'white';
        }
    });
    
    // Debug: Count white pixels to verify shapes were drawn
    const maskImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    let whitePixelCount = 0;
    for (let i = 0; i < maskImageData.data.length; i += 4) {
        if (maskImageData.data[i] > 128) whitePixelCount++;
    }
    console.log('🎨 Mask generated with', whitePixelCount, 'shape pixels out of', tempCanvas.width * tempCanvas.height, 'total pixels');
    
    // Debug: Also log the pixel distribution to see if we have distinct regions
    let blackPixels = 0;
    for (let i = 0; i < maskImageData.data.length; i += 4) {
        if (maskImageData.data[i] < 128) blackPixels++;
    }
    console.log('🎨 Mask composition: white (shape)=', whitePixelCount, ', black (background/holes)=', blackPixels);
    
    return maskImageData.data;
}

// Testing mode feedback function
function showTestingModeFeedback(message) {
    console.log('🧪 Testing mode feedback:', message);
    
    // Show visual feedback on canvas or commentary overlay
    const commentaryOverlay = document.getElementById('commentaryOverlay');
    const commentaryText = document.getElementById('commentaryText');
    
    if (commentaryOverlay && commentaryText) {
        commentaryText.textContent = message;
        commentaryOverlay.style.display = 'block';
        
        // Hide after 2 seconds
        setTimeout(() => {
            commentaryOverlay.style.display = 'none';
        }, 2000);
    }
    
    // Also log to debug logger if available
    if (window.debugLogger) {
        window.debugLogger.log('Swipe testing feedback: ' + message, null, 'info');
    }
}

// Note: Testing mode shape loading removed - swipes only work after game completion

// Goal row management functions
// v3.0 - Show goal beneath canvas
function showGoalBeneathCanvas() {
    const resultsContainer = document.querySelector('.results-container');
    if (resultsContainer) {
        resultsContainer.style.display = 'block';
        
        // Hide the old table
        const table = resultsContainer.querySelector('.results-table');
        if (table) {
            table.style.display = 'none';
        }
        
        // Hide the goal display - no longer showing GOAL text when game starts
        const goalDisplay = document.getElementById('goalDisplay');
        if (goalDisplay) {
            goalDisplay.style.display = 'none';
        }
        
        // Show progress circles when game starts
        showProgressCircles();
        
        // Canvas interaction will be enabled after fade-in animation completes
        console.log('📋 Canvas interaction will be enabled after fade-in animation');
    }
}

// Show progress circles when game starts
function showProgressCircles() {
    const progressCircles = document.getElementById('progressCircles');
    if (progressCircles) {
        progressCircles.style.display = 'flex';
        progressCircles.style.opacity = '0';
        // Trigger fade-in after a brief delay
        setTimeout(() => {
            progressCircles.style.transition = 'opacity 0.5s ease';
            progressCircles.style.opacity = '1';
        }, 100);
    }
}

// Show CUT popup for 1 second then fade away
function showCutPopup() {
    console.log('🔪 Showing CUT popup');
    
    const cutPopup = document.getElementById('cutPopup');
    if (!cutPopup) {
        console.error('❌ CUT popup element not found');
        return;
    }
    
    // Show popup
    cutPopup.classList.add('show');
    
    // Hide after 2 seconds
    setTimeout(() => {
        cutPopup.classList.remove('show');
        console.log('🔪 CUT popup hidden');
    }, 2000);
}

// Ensure progress circles are visible only during active gameplay (called during state restoration)
function ensureProgressCirclesVisible() {
    const progressCircles = document.getElementById('progressCircles');
    
    // Only show progress circles during active gameplay states, not on end game page
    const shouldShowCircles = attemptCount >= 1 && 
                             gameState !== 'locked' && 
                             gameState !== 'finished' && 
                             gameState !== 'completed';
    
    if (progressCircles && shouldShowCircles) {
        progressCircles.style.display = 'flex';
        progressCircles.style.opacity = '1';
        
        // Update circle states based on current attemptCount
        updateProgressCircles(attemptCount);
        
        console.log('✅ Progress circles ensured visible and updated for game state:', gameState);
    } else if (progressCircles) {
        // Hide progress circles on end game page or when game is finished
        progressCircles.style.display = 'none';
        console.log('🔵 Progress circles hidden for game state:', gameState);
    }
}


// Show 1st Try display with CSS-based positioning
function showFirstTryDisplay() {
    // DISABLED: 1st Try display is turned off
    console.log('⚠️ 1st Try display is disabled (showFirstTryDisplay)');
    return; // Exit early - no Try 1 display created
    
    /* ORIGINAL CODE (DISABLED):
    const resultsContainer = document.querySelector('.results-container');
    
    if (resultsContainer) {
        // Create new attempt display element
        const attemptDisplay = document.createElement('div');
        attemptDisplay.id = 'attemptDisplay1st';
        attemptDisplay.className = 'attempt-display';
        
        const attemptTextEl = document.createElement('div');
        attemptTextEl.className = 'attempt-text';
        attemptTextEl.textContent = '1st Try';
        
        attemptDisplay.appendChild(attemptTextEl);
        
        // Use dedicated container for consistent positioning
        const dynamicContainer = document.getElementById('dynamicResultsContainer');
        if (dynamicContainer) {
            dynamicContainer.appendChild(attemptDisplay);
            console.log('✅ Attempt display positioned in dedicated container');
        } else {
            // Fallback: append to results container
            resultsContainer.appendChild(attemptDisplay);
            console.log('⚠️ Fallback: Attempt display appended to results container');
        }
        
        // Set initial opacity to 0 for fade-in animation
        attemptDisplay.style.opacity = '0';
        
        // Fade in the Try 1 display
        setTimeout(() => {
            attemptDisplay.style.transition = 'opacity 0.5s ease';
            attemptDisplay.style.opacity = '1';
        }, 150);
        
        console.log('✅ 1st Try display created with CSS positioning');
    }
    */
}

// Show Try 1 display (copy of Try 2/3 implementation but positioned after results table)
function showTry1Display() {
    // DISABLED: Try 1 display is turned off
    console.log('⚠️ Try 1 display is disabled');
    
    // Still show progress circles if needed
    const progressCirclesForAnimation = document.getElementById('progressCircles');
    if (progressCirclesForAnimation) {
        progressCirclesForAnimation.style.display = 'flex';
        progressCirclesForAnimation.style.opacity = '0';
        // Trigger fade-in after a brief delay
        setTimeout(() => {
            progressCirclesForAnimation.style.transition = 'opacity 0.5s ease';
            progressCirclesForAnimation.style.opacity = '1';
        }, 150);
    }
    
    return; // Exit early - no Try 1 display created
    
    /* ORIGINAL CODE (DISABLED):
    try {
        const resultsContainer = document.querySelector('.results-container');
        
        if (!resultsContainer) {
            console.error('❌ Results container not found for Try 1 display');
            return;
        }
        
        // Remove any existing attempt display first (but not our 1st Try display)
        const existingAttemptDisplay = document.getElementById('attemptDisplay');
        if (existingAttemptDisplay) {
            existingAttemptDisplay.remove();
        }
        // Note: attemptDisplay1st remains untouched
        
        // Create new attempt display positioned like Try 2/3
        const attemptDisplay = document.createElement('div');
        attemptDisplay.id = 'attemptDisplay1st';
        attemptDisplay.className = 'attempt-display';
        
        const attemptTextEl = document.createElement('div');
        attemptTextEl.id = 'attemptText1st';
        attemptTextEl.className = 'attempt-text';
        attemptTextEl.textContent = '1st Try';
        
        attemptDisplay.appendChild(attemptTextEl);
        
        // Use dedicated container for consistent positioning
        const dynamicContainer = document.getElementById('dynamicResultsContainer');
        if (dynamicContainer) {
            dynamicContainer.appendChild(attemptDisplay);
            console.log('✅ Second attempt display positioned in dedicated container');
        } else {
            // Fallback: append to results container
            resultsContainer.appendChild(attemptDisplay);
            console.log('⚠️ Fallback: Second attempt display appended to results container');
        }
        
        // Set initial opacity to 0 for fade-in animation
        attemptDisplay.style.display = 'block';
        attemptDisplay.style.opacity = '0';
        
        // Fade in the Try 1 display
        setTimeout(() => {
            attemptDisplay.style.transition = 'opacity 0.5s ease';
            attemptDisplay.style.opacity = '1';
        }, 100);
        
        // Show progress circles with fade-in animation
        const progressCirclesForAnimation = document.getElementById('progressCircles');
        if (progressCirclesForAnimation) {
            progressCirclesForAnimation.style.display = 'flex';
            progressCirclesForAnimation.style.opacity = '0';
            // Trigger fade-in after a brief delay
            setTimeout(() => {
                progressCirclesForAnimation.style.transition = 'opacity 0.5s ease';
                progressCirclesForAnimation.style.opacity = '1';
            }, 150);
        }
        
        console.log('✅ Try 1 display created successfully');
        
    } catch (error) {
        console.error('❌ Error in showTry1Display:', error);
        // Don't let this break the entire game flow
    }
    */
}

// Fade out 1st Try display when first cut starts (but keep circles visible)
function fadeFirstTryDisplay() {
    const attemptDisplay = document.getElementById('attemptDisplay1st');
    
    if (attemptDisplay) {
        attemptDisplay.style.transition = 'opacity 0.3s ease';
        attemptDisplay.style.opacity = '0';
        
        setTimeout(() => {
            attemptDisplay.style.display = 'none';
        }, 300);
    }
    
    // Note: Progress circles remain visible until final best cut fade
}

// Goal display functions (now uses dedicated goal display below table)
function showGoalAsCommentary() {
    const goalDisplay = document.getElementById('goalDisplay');
    const goalTextEl = document.getElementById('goalText');
    const attemptDisplay = document.getElementById('attemptDisplay');
    const attemptTextEl = document.getElementById('attemptText');
    
    if (goalDisplay && goalTextEl) {
        // Get goal text and format with GOAL on its own line
        const fullGoalText = ShapeTypeHandler.getGoalText(currentShapeIndex);
        const goalDescription = fullGoalText.replace(/^Goal:\s*/, '') + ' (50% / 50%)'; // Remove "Goal:" prefix and add target percentages
        const goalText = '<strong>GOAL</strong><br><span class="goal-description">' + goalDescription + '</span>';
        
        goalTextEl.innerHTML = goalText;
        
        // Start the animations
        goalDisplay.style.display = 'block';
        goalDisplay.style.opacity = '1';
        goalDisplay.classList.add('animate-in');
        
        // Add text fade-in class after a small delay to ensure DOM is ready
        setTimeout(() => {
            goalTextEl.classList.add('fade-in');
        }, 50);
    }
    
    // Show attempt display
    if (attemptDisplay && attemptTextEl) {
        // Update attempt text based on current attempt
        const attemptNumber = v3GameState.currentAttempt;
        const attemptTexts = ['1st Try', '2nd Try', '3rd Try'];
        attemptTextEl.textContent = attemptTexts[attemptNumber - 1] || '1st Try';
        
        attemptDisplay.style.display = 'block';
        attemptDisplay.style.opacity = '1';
    }
}

// Show "Try again" message in the attempt display location
function showTryAgainMessage() {
    const attemptDisplay = document.getElementById('attemptDisplay');
    const attemptTextEl = document.getElementById('attemptText');
    
    console.log('🚫 showTryAgainMessage called:', {
        attemptDisplayExists: !!attemptDisplay,
        attemptTextExists: !!attemptTextEl,
        attemptDisplayVisible: attemptDisplay?.style.display,
        attemptTextContent: attemptTextEl?.textContent
    });
    
    // Hide any split displays that might be showing for invalid cuts
    const splitDisplays = document.querySelectorAll('.split-display-large, .attempt-result');
    splitDisplays.forEach(display => {
        if (display.id !== 'attemptDisplay') { // Don't hide the "Try again" display itself
            display.style.display = 'none';
            console.log('🚫 Hiding split display element:', display.id || display.className);
        }
    });
    
    // Also hide practice percentage display specifically
    const practicePercentageDisplay = document.getElementById('practicePercentageDisplay');
    if (practicePercentageDisplay) {
        practicePercentageDisplay.style.display = 'none';
        console.log('🚫 Hiding practice percentage display');
    }
    
    // Hide fixed percentage area content that might show scores
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (fixedPercentageArea) {
        fixedPercentageArea.innerHTML = '';
        console.log('🚫 Clearing fixed percentage area');
    }
    
    if (attemptDisplay && attemptTextEl) {
        attemptTextEl.textContent = 'Try again';
        attemptDisplay.style.display = 'block';
        attemptDisplay.style.opacity = '1';
        attemptDisplay.style.transition = '';
        console.log('🚫 Try again message set successfully');
    } else {
        console.error('🚫 Cannot show try again message - elements missing:', {
            attemptDisplay: !!attemptDisplay,
            attemptTextEl: !!attemptTextEl
        });
    }
}

// Hide the try again message (used when starting a new cut)
function hideTryAgainMessage() {
    const attemptDisplay = document.getElementById('attemptDisplay');
    
    if (attemptDisplay && attemptDisplay.style.display !== 'none') {
        attemptDisplay.style.transition = 'opacity 0.3s ease-out';
        attemptDisplay.style.opacity = '0';
        
        setTimeout(() => {
            if (attemptDisplay.style.opacity === '0') {
                attemptDisplay.style.display = 'none';
                attemptDisplay.style.opacity = '1';
                attemptDisplay.style.transition = '';
            }
        }, 300);
    }
}

function hideGoalCommentary() {
    const goalDisplay = document.getElementById('goalDisplay');
    const goalTextEl = document.getElementById('goalText');
    const attemptDisplay = document.getElementById('attemptDisplay');
    
    // Check if this is the final completion (shape 10, attempt 1)
    const isFinalCompletion = (currentShapeNumber >= 10 && currentAttemptNumber >= 1);
    
    // Start fading all three elements simultaneously with identical timing
    const fadeOutTransition = 'opacity 0.3s ease-out';
    const fadeOutDuration = 300;
    
    // Set transitions for all elements first
    if (goalDisplay && goalDisplay.style.display !== 'none') {
        goalDisplay.style.transition = fadeOutTransition;
    }
    
    if (goalTextEl && goalDisplay && goalDisplay.style.display !== 'none') {
        goalTextEl.style.transition = fadeOutTransition;
    }
    
    if (attemptDisplay && attemptDisplay.style.display !== 'none') {
        attemptDisplay.style.transition = fadeOutTransition;
    }
    
    // If this is the final completion, also fade progress tracker
    const progressCircles = document.getElementById('progressCircles');
    if (isFinalCompletion && progressCircles) {
        console.log('🔵 Starting progress tracker fade out (matching percentage fade timing)');
        progressCircles.style.transition = fadeOutTransition;
    }
    
    // Start all fade-outs simultaneously on next frame
    requestAnimationFrame(() => {
        if (goalDisplay && goalDisplay.style.display !== 'none') {
            goalDisplay.style.opacity = '0';
        }
        
        if (goalTextEl && goalDisplay && goalDisplay.style.display !== 'none') {
            goalTextEl.style.opacity = '0';
        }
        
        if (attemptDisplay && attemptDisplay.style.display !== 'none') {
            attemptDisplay.style.opacity = '0';
        }
        
        // Fade progress tracker if this is final completion
        if (isFinalCompletion && progressCircles) {
            progressCircles.style.opacity = '0';
        }
    });
    
    // After the fade transition completes, hide and reset all elements
    setTimeout(() => {
        if (goalDisplay && goalDisplay.style.opacity === '0') {
            goalDisplay.style.display = 'none';
            goalDisplay.style.opacity = '1';
            goalDisplay.style.transition = '';
            
            // Reset animation classes for next time
            goalDisplay.classList.remove('animate-in');
        }
        
        if (goalTextEl && goalTextEl.style.opacity === '0') {
            goalTextEl.style.opacity = '1';
            goalTextEl.style.transition = '';
            goalTextEl.classList.remove('fade-in');
        }
        
        if (attemptDisplay && attemptDisplay.style.opacity === '0') {
            attemptDisplay.style.display = 'none';
            attemptDisplay.style.opacity = '1';
            attemptDisplay.style.transition = '';
        }
        
        // Complete progress tracker fade if this is final completion
        if (isFinalCompletion && progressCircles && progressCircles.style.opacity === '0') {
            progressCircles.style.display = 'none';
            console.log('🔵 Progress tracker fade completed (matching percentage fade timing)');
        }
    }, fadeOutDuration);
}

function fadeOutCommentary() {
    const commentaryOverlay = document.getElementById('commentaryOverlay');
    if (commentaryOverlay && commentaryOverlay.style.display !== 'none') {
        commentaryOverlay.style.transition = 'opacity 0.3s ease-out';
        commentaryOverlay.style.opacity = '0';
        setTimeout(() => {
            commentaryOverlay.style.display = 'none';
            commentaryOverlay.style.opacity = '1';
            commentaryOverlay.style.transition = '';
        }, 300);
    }
}

// Results table functions
function updateResultsTable() {
    // Remove goal row before adding result
    hideGoalCommentary();
    const tbody = document.getElementById('resultsTableBody');
    const lastResult = gameResults[gameResults.length - 1];
    
    const row = document.createElement('tr');
    
    // Shape number
    const shapeCell = document.createElement('td');
    shapeCell.textContent = currentShapeIndex;
    row.appendChild(shapeCell);
    
    // Splits (with colors)
    const splitsCell = document.createElement('td');
    if (currentShapeIndex === 3 && lastResult.quadrantPercentages) {
        // Display four percentages in two-line format
        const q1 = lastResult.quadrantPercentages.q1.toFixed(1);
        const q2 = lastResult.quadrantPercentages.q2.toFixed(1);
        const q3 = lastResult.quadrantPercentages.q3.toFixed(1);
        const q4 = lastResult.quadrantPercentages.q4.toFixed(1);
        splitsCell.className = 'split-multi-line';
        splitsCell.innerHTML = `<span class="split-q1">${q1}%</span> / <span class="split-q2">${q2}%</span><br><span class="split-q3">${q3}%</span> / <span class="split-q4">${q4}%</span>`;
    } else {
        // Shape 1 and 2 display with color coding
        splitsCell.innerHTML = `<span class="split-left">${lastResult.leftPercentage.toFixed(1)}%</span> / <span class="split-right">${lastResult.rightPercentage.toFixed(1)}%</span>`;
    }
    row.appendChild(splitsCell);
    
    // Score (with /100 suffix)
    const scoreCell = document.createElement('td');
    scoreCell.textContent = `${lastResult.score.toFixed(1)}/100`;
    row.appendChild(scoreCell);
    
    tbody.appendChild(row);
    
    // Show appropriate button after result is added (with 1.5s delay)
    setTimeout(() => {
        if (currentShapeIndex < 10) {
            const playBtn = document.getElementById('playBtn');
            if (playBtn) {
                playBtn.textContent = 'Next';
                playBtn.disabled = false;
                playBtn.classList.remove('again', 'disabled');
                showPlayButton();
            }
        }
    }, 1500);
}

function clearTableRows() {
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';
}

function highlightCurrentShapeInTable(shapeIndex) {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) {
        console.warn('🚫 Results table body not found');
        return;
    }
    
    // Remove existing highlights
    const allRows = tbody.querySelectorAll('tr');
    allRows.forEach(row => {
        row.classList.remove('current-shape');
    });
    
    // Add highlight to the current shape's row
    // Note: rows are 0-indexed, but shapes are 1-indexed
    const targetRow = allRows[shapeIndex - 1];
    if (targetRow && !targetRow.classList.contains('goal-row')) {
        targetRow.classList.add('current-shape');
        console.log('✨ Highlighted table row for shape', shapeIndex);
    } else {
        console.warn('🚫 Could not find table row for shape', shapeIndex);
    }
}

function removeTableHighlights() {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;
    
    const allRows = tbody.querySelectorAll('tr');
    allRows.forEach(row => {
        row.classList.remove('current-shape');
    });
    console.log('🧹 Removed all table highlights');
}

function getScoreEmoji(score) {
    if (score === 100.0) return '🎯';
    if (score >= 99.0) return '✂️';
    if (score >= 97.0) return '🔪';
    if (score >= 94.0) return '👌';
    if (score >= 90.0) return '🙂';
    if (score >= 85.0) return '🤔';
    if (score >= 75.0) return '😞';
    return '🪓';
}

// Preserve all existing geometry and rendering functions
function parseGeometry(geoJSON) {
    const shapes = [];

    function transformCoord(coord) {
        // Simple coordinate transformation - no scaling
        // Canvas is always 380x380, CSS handles visual scaling
        return [coord[0], coord[1]];
    }
    
    geoJSON.features.forEach((feature, featureIndex) => {
        console.log(`🔍 Processing feature ${featureIndex}: ${feature.geometry?.type}`);
        const geometry = feature.geometry;
        
        if (geometry.type === 'Polygon') {
            let coordinates = geometry.coordinates;
            
            // Handle deeply nested coordinates (fix for malformed GeoJSON)
            while (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]) && Array.isArray(coordinates[0][0][0])) {
                console.warn('⚠️ Detected deeply nested coordinates, flattening...');
                coordinates = coordinates[0];
            }
            
            let outerRing = coordinates[0];
            let holes = coordinates.slice(1);
            
            // Apply global transformation to all coordinates
            outerRing = outerRing.map(transformCoord);
            holes = holes.map(hole => hole.map(transformCoord));
            
            const shape = {
                type: 'polygon',
                coordinates: [outerRing, ...holes],
                outerRing: outerRing,
                holes: holes
            };
            shapes.push(shape);
            console.log(`✅ Added Polygon shape with ${outerRing.length} vertices`);
            console.log(`   First transformed coord: [${outerRing[0][0].toFixed(1)}, ${outerRing[0][1].toFixed(1)}]`);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polygon, polygonIndex) => {
                let polygonCoords = polygon;
                
                // Handle deeply nested coordinates (fix for malformed GeoJSON)
                while (Array.isArray(polygonCoords[0]) && Array.isArray(polygonCoords[0][0]) && Array.isArray(polygonCoords[0][0][0])) {
                    console.warn('⚠️ Detected deeply nested MultiPolygon coordinates, flattening...');
                    polygonCoords = polygonCoords[0];
                }
                
                let outerRing = polygonCoords[0];
                let holes = polygonCoords.slice(1);
                
                // Validate polygon has valid coordinates
                if (!outerRing || outerRing.length < 3) {
                    console.warn(`⚠️ Skipping invalid polygon ${polygonIndex + 1}: insufficient coordinates (${outerRing?.length || 0})`);
                    return;
                }
                
                // Apply global transformation to all coordinates
                outerRing = outerRing.map(transformCoord);
                holes = holes.map(hole => hole.map(transformCoord));
                
                // Validate transformed coordinates
                const validCoords = outerRing.filter(coord => coord && coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));
                if (validCoords.length !== outerRing.length) {
                    console.warn(`⚠️ Polygon ${polygonIndex + 1} has ${outerRing.length - validCoords.length} invalid coordinates`);
                    outerRing = validCoords;
                }
                
                if (outerRing.length < 3) {
                    console.warn(`⚠️ Skipping polygon ${polygonIndex + 1}: too few valid coordinates after transformation (${outerRing.length})`);
                    return;
                }
                
                const shape = {
                    type: 'polygon',
                    coordinates: [outerRing, ...holes],
                    outerRing: outerRing,
                    holes: holes
                };
                shapes.push(shape);
                console.log(`✅ Added MultiPolygon shape ${polygonIndex + 1} with ${outerRing.length} vertices`);
                console.log(`   First transformed coord: [${outerRing[0][0].toFixed(1)}, ${outerRing[0][1].toFixed(1)}]`);
            });
        } else {
            console.warn(`⚠️ Unsupported geometry type: ${geometry.type} in feature ${featureIndex}. Only Polygon and MultiPolygon are supported for shape rendering.`);
            if (geometry.type === 'Point') {
                console.log(`📍 Point coordinates: [${geometry.coordinates[0].toFixed(1)}, ${geometry.coordinates[1].toFixed(1)}] - Points are typically used for metadata, not shapes.`);
            }
        }
    });
    
    console.log(`🎨 parseGeometry SUMMARY: extracted ${shapes.length} total shapes from ${geoJSON.features.length} features`);
    shapes.forEach((shape, i) => {
        const bounds = {
            minX: Math.min(...shape.outerRing.map(p => p[0])),
            maxX: Math.max(...shape.outerRing.map(p => p[0])),
            minY: Math.min(...shape.outerRing.map(p => p[1])),
            maxY: Math.max(...shape.outerRing.map(p => p[1]))
        };
        console.log(`🔍 Shape ${i + 1}: ${shape.outerRing.length} points, ${shape.holes?.length || 0} holes, bounds: [${bounds.minX.toFixed(1)},${bounds.minY.toFixed(1)}] to [${bounds.maxX.toFixed(1)},${bounds.maxY.toFixed(1)}]`);
    });
    
    // Return shapes in v2.0 format
    return {
        shapes: shapes,
        useDirectCoordinates: false
    };
}

function calculateBounds(shapes) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    console.log('🔍 calculateBounds called with', shapes.length, 'shapes');
    
    shapes.forEach((shape, shapeIndex) => {
        console.log(`🔍 Shape ${shapeIndex}:`, {
            hasOuterRing: !!shape.outerRing,
            outerRingLength: shape.outerRing?.length,
            firstPoint: shape.outerRing?.[0],
            outerRingType: Array.isArray(shape.outerRing) ? 'array' : typeof shape.outerRing
        });
        
        if (!shape.outerRing || !Array.isArray(shape.outerRing)) {
            console.log('❌ Shape', shapeIndex, 'has invalid outerRing');
            return;
        }
        
        // Check outer ring
        shape.outerRing.forEach(([x, y], pointIndex) => {
            if (pointIndex < 3) {
                console.log(`🔍 Shape ${shapeIndex} point ${pointIndex}:`, [x, y], typeof x, typeof y);
            }
            if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            } else if (pointIndex < 3) {
                console.log('❌ Invalid coordinate at point', pointIndex, ':', [x, y]);
            }
        });
        
        // Check holes
        if (shape.holes) {
            shape.holes.forEach(hole => {
                hole.forEach(([x, y]) => {
                    if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                });
            });
        }
    });
    
    console.log('🔍 calculateBounds result:', { minX, minY, maxX, maxY });
    return { minX, minY, maxX, maxY };
}

function calculateScale(bounds, useDirectCoordinates = false) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    if (!window.isAnimating) {
        console.log(`📐 Shape bounds: ${width.toFixed(1)}x${height.toFixed(1)} (minX: ${bounds.minX.toFixed(1)}, minY: ${bounds.minY.toFixed(1)})`);
        console.log('📐 Using 1:1 scaling (coordinate scaling handled during parsing)');
    }
    return 1.0;
}

function calculateOffset(bounds, scale, useDirectCoordinates = false) {
    
    if (!window.isAnimating) {
        console.log('📐 Canvas size: 380x380 (logical)');
        console.log(`📐 Shape bounds: minX=${bounds.minX.toFixed(1)}, minY=${bounds.minY.toFixed(1)}, maxX=${bounds.maxX.toFixed(1)}, maxY=${bounds.maxY.toFixed(1)}`);
    }
    
    // Shapes are already positioned in a 380x380 coordinate system
    // No centering needed - use shapes as positioned in the GeoJSON
    const offsetX = 0;
    const offsetY = 0;
    
    if (!window.isAnimating) {
        console.log(`📐 Using original shape positioning: offset (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
    }
    return {
        x: offsetX,
        y: offsetY
    };
}

// Create a mock cut vector that attempts to approximate the given percentages
function createMockCutVector(bounds, leftPercentage, rightPercentage) {
    console.log(`🎯 Creating mock cut vector for ${leftPercentage.toFixed(1)}%/${rightPercentage.toFixed(1)}%`);
    
    // For most cases, try to create a cut that would roughly split the shape
    // If left percentage is close to 50%, use a vertical cut near center
    // Otherwise, adjust the cut position based on the percentages
    
    const shapeWidth = bounds.maxX - bounds.minX;
    const shapeHeight = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    let cutVector;
    
    if (Math.abs(leftPercentage - 50) < 15) {
        // Close to 50/50 split - use a vertical cut near center
        const offset = (leftPercentage - 50) * shapeWidth / 100; // Adjust position slightly
        cutVector = {
            x1: centerX + offset,
            y1: bounds.minY - 50,
            x2: centerX + offset,
            y2: bounds.maxY + 50
        };
    } else if (Math.abs(leftPercentage - 50) < 25) {
        // Moderate split - use a diagonal cut
        const xOffset = (leftPercentage - 50) * shapeWidth / 200;
        cutVector = {
            x1: bounds.minX - 50,
            y1: centerY - shapeHeight * 0.3,
            x2: bounds.maxX + 50,
            y2: centerY + shapeHeight * 0.3 + xOffset
        };
    } else {
        // Extreme split - use a horizontal cut positioned based on percentage
        const yPosition = leftPercentage < 50 ? 
            centerY + shapeHeight * 0.2 : // Left is small, cut towards bottom
            centerY - shapeHeight * 0.2;  // Left is large, cut towards top
        
        cutVector = {
            x1: bounds.minX - 50,
            y1: yPosition,
            x2: bounds.maxX + 50,
            y2: yPosition
        };
    }
    
    console.log(`🎯 Mock cut vector created: (${cutVector.x1.toFixed(1)}, ${cutVector.y1.toFixed(1)}) to (${cutVector.x2.toFixed(1)}, ${cutVector.y2.toFixed(1)})`);
    return cutVector;
}

function drawPolygon(shape, scale, offset, context = ctx) {
    // Revert to original evenodd approach that was working
    context.beginPath();
    drawRing(shape.outerRing, scale, offset, context);
    
    // Draw holes (if any) - they will be part of the same path
    if (shape.holes && shape.holes.length > 0) {
        shape.holes.forEach(hole => {
            drawRing(hole, scale, offset, context);
        });
    }
    
    // Use evenodd fill rule to handle holes properly
    context.fill('evenodd');
    context.stroke();
}

function drawRing(ring, scale, offset, context = ctx) {
    if (ring.length < 2) return;

    const logicalHeight = 380;
    const [startX, startY] = ring[0];
    context.moveTo(startX * scale + offset.x, logicalHeight - (startY * scale + offset.y));

    for (let i = 1; i < ring.length; i++) {
        const [x, y] = ring[i];
        context.lineTo(x * scale + offset.x, logicalHeight - (y * scale + offset.y));
    }

    context.closePath();
}

function renderShapesForPixelAnalysis(ctx, shapes, useDirectCoordinates = false) {
    // CRITICAL: Do NOT clear canvas here - caller already cleared it and drew the grid
    // Clearing here would erase the grid lines that were just drawn

    if (shapes.length === 0) return;

    const bounds = calculateBounds(shapes);
    const scale = calculateScale(bounds, useDirectCoordinates);
    const offset = calculateOffset(bounds, scale, useDirectCoordinates);

    // CRITICAL: Draw shapes WITH outline for proper restoration
    ctx.fillStyle = '#dddddd';
    ctx.strokeStyle = '#000000';  // Black outline instead of transparent
    ctx.lineWidth = 2;            // Visible outline width

    shapes.forEach(shape => {
        drawPolygonForPixelAnalysis(ctx, shape, scale, offset);
    });
}

function drawPolygonForPixelAnalysis(ctx, shape, scale, offset) {
    // Revert to original evenodd approach for consistency with visual rendering
    ctx.beginPath();
    drawRingForPixelAnalysis(ctx, shape.outerRing, scale, offset);

    if (shape.holes && shape.holes.length > 0) {
        shape.holes.forEach(hole => {
            drawRingForPixelAnalysis(ctx, hole, scale, offset);
        });
    }

    ctx.fill('evenodd');
    ctx.stroke();  // CRITICAL: Actually draw the outline
}

function drawRingForPixelAnalysis(ctx, ring, scale, offset) {
    if (ring.length < 2) return;

    const logicalHeight = 380;
    const [startX, startY] = ring[0];
    ctx.moveTo(startX * scale + offset.x, logicalHeight - (startY * scale + offset.y));

    for (let i = 1; i < ring.length; i++) {
        const [x, y] = ring[i];
        ctx.lineTo(x * scale + offset.x, logicalHeight - (y * scale + offset.y));
    }

    ctx.closePath();
}

function calculatePixelBasedAreas(pixels, width, height, vector) {
    let leftArea = 0;
    let rightArea = 0;
    let totalShapePixels = 0;
    
    const lineStart = vector.start;
    const lineEnd = vector.end;
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            
            if (r === 221 && g === 221 && b === 221) {
                totalShapePixels++;
                
                const side = getPixelSideOfVector(x, y, lineStart, lineEnd, dx, dy);
                
                if (side === 'left') {
                    leftArea++;
                } else if (side === 'right') {
                    rightArea++;
                }
            }
        }
    }
    
    const leftPercentage = totalShapePixels > 0 ? (leftArea / totalShapePixels) * 100 : 0;
    const rightPercentage = totalShapePixels > 0 ? (rightArea / totalShapePixels) * 100 : 0;
    
    return {
        leftArea,
        rightArea,
        totalShapePixels,
        leftPercentage,
        rightPercentage
    };
}

function calculateFourQuadrants(vector1, vector2) {
    // Create temporary canvas for quadrant analysis
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Render shapes on temporary canvas - use practice mode shapes if in practice mode
    // CRITICAL: Practice mode must use practiceParsedShapes to avoid contamination
    const shapesToAnalyze = window.isPracticeMode ?
                           (window.practiceMode?.practiceParsedShapes || []) :
                           (parsedShapes || []);
    console.log(`🔍 CALCULATE FOUR QUADRANTS: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
    renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
    
    // Get pixel data
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    
    // Initialize quadrant counters
    let quadrant1 = 0; // Top-right
    let quadrant2 = 0; // Top-left  
    let quadrant3 = 0; // Bottom-left
    let quadrant4 = 0; // Bottom-right
    let totalShapePixels = 0;
    
    // Get vector parameters
    const line1Start = vector1.start;
    const line1End = vector1.end;
    const dx1 = line1End.x - line1Start.x;
    const dy1 = line1End.y - line1Start.y;
    
    const line2Start = vector2.start;
    const line2End = vector2.end;
    const dx2 = line2End.x - line2Start.x;
    const dy2 = line2End.y - line2Start.y;
    
    // Analyze each pixel
    for (let y = 0; y < tempCanvas.height; y++) {
        for (let x = 0; x < tempCanvas.width; x++) {
            const pixelIndex = (y * tempCanvas.width + x) * 4;
            
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            
            // Check if pixel is part of the shape (light gray)
            if (r === 221 && g === 221 && b === 221) {
                totalShapePixels++;
                
                // Determine which side of each vector the pixel is on
                const side1 = getPixelSideOfVector(x, y, line1Start, line1End, dx1, dy1);
                const side2 = getPixelSideOfVector(x, y, line2Start, line2End, dx2, dy2);
                
                // Assign to quadrant based on sides
                if (side1 === 'right' && side2 === 'right') {
                    quadrant1++; // Both vectors on right side
                } else if (side1 === 'left' && side2 === 'right') {
                    quadrant2++; // Vector 1 left, Vector 2 right
                } else if (side1 === 'left' && side2 === 'left') {
                    quadrant3++; // Both vectors on left side
                } else if (side1 === 'right' && side2 === 'left') {
                    quadrant4++; // Vector 1 right, Vector 2 left
                }
            }
        }
    }
    
    // Calculate percentages
    const percentages = totalShapePixels > 0 ? {
        q1: (quadrant1 / totalShapePixels) * 100,
        q2: (quadrant2 / totalShapePixels) * 100,
        q3: (quadrant3 / totalShapePixels) * 100,
        q4: (quadrant4 / totalShapePixels) * 100
    } : { q1: 0, q2: 0, q3: 0, q4: 0 };
    
    return {
        quadrants: { quadrant1, quadrant2, quadrant3, quadrant4 },
        percentages: percentages,
        totalShapePixels: totalShapePixels
    };
}

function getPixelSideOfVector(x, y, lineStart, lineEnd, dx, dy) {
    const crossProduct = (x - lineStart.x) * dy - (y - lineStart.y) * dx;

    // Calculate the distance from the point to the line for better line thickness
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    const distance = Math.abs(crossProduct) / lineLength;

    // Use a tolerance of 1 pixel to create a visible cut line
    // This matches the visual thickness of the cut in the shading
    const tolerance = 1.0;

    if (distance <= tolerance) {
        return 'on_line';
    } else if (crossProduct > 0) {
        return 'left';
    } else {
        return 'right';
    }
}

function renderPixelBasedCutResult(areaResults) {
    console.log('🎨 renderPixelBasedCutResult called');
    console.log('   leftArea type:', typeof areaResults.leftArea);
    console.log('   leftArea value:', areaResults.leftArea);
    console.log('   leftPercentage:', areaResults.leftPercentage);
    console.log('   rightPercentage:', areaResults.rightPercentage);

    // Check if leftArea/rightArea are pixel arrays or just counts
    const hasPixelArrays = Array.isArray(areaResults.leftArea) && Array.isArray(areaResults.rightArea);

    if (!hasPixelArrays) {
        console.log('⚠️ Triangle mechanic provided counts, not pixel arrays - cannot restore pixel shading');
        console.log('📊 Displaying percentages only');
        showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
        return;
    }

    console.log('✅ Has pixel arrays - leftArea pixels:', areaResults.leftArea.length);
    console.log('✅ Has pixel arrays - rightArea pixels:', areaResults.rightArea.length);

    // Get shapes with practice mode priority
    // CRITICAL: Practice mode must use practiceParsedShapes to avoid contamination
    const shapes = window.isPracticeMode ?
                  (window.practiceMode?.practiceParsedShapes || []) :
                  (parsedShapes || []);

    if (!shapes || shapes.length === 0) {
        console.log('🚫 No shapes available for pixel-based rendering');
        return;
    }

    // Clear canvas and draw grid
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // Render the base shapes first
    renderShapesForPixelAnalysis(ctx, shapes);

    // Get the current canvas image data
    const imageData = ctx.getImageData(0, 0, 380, 380);
    const pixels = imageData.data;

    // Create result image data for shading
    const resultImageData = ctx.createImageData(380, 380);
    const resultPixels = resultImageData.data;

    // Convert pixel arrays to Sets for fast lookup
    // CRITICAL: leftArea/rightArea contain BYTE indices, convert to pixel numbers
    const leftPixelSet = new Set(areaResults.leftArea.map(byteIndex => byteIndex / 4));
    const rightPixelSet = new Set(areaResults.rightArea.map(byteIndex => byteIndex / 4));

    // Determine which side is smaller and should be colored
    const colorLeftSide = areaResults.leftPercentage <= areaResults.rightPercentage;
    console.log('🎨 Applying pixel-based shading - coloring ' + (colorLeftSide ? 'LEFT' : 'RIGHT') + ' side (smaller)');
    console.log('   Left: ' + areaResults.leftPercentage.toFixed(1) + '%, Right: ' + areaResults.rightPercentage.toFixed(1) + '%');

    // Get the color to use for shading
    const shadingColor = getDailyCutShadingColor();

    // Apply shading based on pixel arrays
    for (let y = 0; y < 380; y++) {
        for (let x = 0; x < 380; x++) {
            const pixelIndex = (y * 380 + x) * 4;
            const pixelNumber = y * 380 + x;

            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            const a = pixels[pixelIndex + 3];

            // Check if this is a shape pixel (grey color)
            if (r === 221 && g === 221 && b === 221) {
                // Check if pixel is in left or right area
                const isLeft = leftPixelSet.has(pixelNumber);
                const isRight = rightPixelSet.has(pixelNumber);

                // Color the smaller area based on colorLeftSide flag
                const shouldColor = (isLeft && colorLeftSide) || (isRight && !colorLeftSide);

                if (shouldColor) {
                    // Color the smaller area with shape-based color
                    resultPixels[pixelIndex] = shadingColor.r;
                    resultPixels[pixelIndex + 1] = shadingColor.g;
                    resultPixels[pixelIndex + 2] = shadingColor.b;
                    resultPixels[pixelIndex + 3] = 255;
                } else {
                    // Keep grey for larger area or unclassified
                    resultPixels[pixelIndex] = 221;
                    resultPixels[pixelIndex + 1] = 221;
                    resultPixels[pixelIndex + 2] = 221;
                    resultPixels[pixelIndex + 3] = 255;
                }
            } else {
                // CRITICAL: Preserve grid lines and shape outlines by copying original pixel data
                // Instead of making non-shape pixels transparent, keep them as-is
                resultPixels[pixelIndex] = r;
                resultPixels[pixelIndex + 1] = g;
                resultPixels[pixelIndex + 2] = b;
                resultPixels[pixelIndex + 3] = a;
            }
        }
    }

    // Draw the shaded result (this now includes grid and outline)
    ctx.putImageData(resultImageData, 0, 0);

    console.log('✅ Pixel-based shading applied successfully');

    // Display split percentages
    showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
}

function renderVectorCutResult(areaResults) {
    // CRITICAL: Prevent rendering if cut was just canceled via right-click
    if (window.canceledLineDrawing) {
        console.log('🚫 renderVectorCutResult blocked - cut was canceled via right-click');
        return;
    }

    // CRITICAL: Check if pixel-based mechanic provided leftArea and rightArea directly
    // (Triangle mechanic and other pixel-based mechanics)
    if (areaResults && areaResults.leftArea && areaResults.rightArea) {
        console.log('🎨 Using pixel-based rendering (Triangle mechanic) - leftArea and rightArea provided');
        renderPixelBasedCutResult(areaResults);
        return;
    }

    // Store which side to color based on which percentage is smaller
    // This ensures the smaller area always gets colored
    window.colorSmallerSide = areaResults && areaResults.leftPercentage <= areaResults.rightPercentage;
    console.log('🎨 Coloring smaller side: ' + (window.colorSmallerSide ? 'left' : 'right') +
                ' (left=' + (areaResults?.leftPercentage || 0).toFixed(1) + '%, right=' + (areaResults?.rightPercentage || 0).toFixed(1) + '%)');

    // CRITICAL: Use the rendering vector from window if available (set by mechanic)
    const renderingVector = window.currentVector || currentVector;
    console.log('🎨🎨🎨 RENDER FUNCTION CALLED 🎨🎨🎨');
    console.log('📍 CHOOSING VECTOR FOR PIXEL ANALYSIS:');
    console.log('   🔧 window.currentVector exists:', !!window.currentVector);
    console.log('   🔧 Using vector:', window.currentVector ? 'window.currentVector (from mechanic)' : 'currentVector (main game)');
    console.log('📍 EXACT COORDINATES BEING USED FOR PIXEL ANALYSIS:');
    console.log('   🔴 renderingVector.start.x:', renderingVector?.start?.x);
    console.log('   🔴 renderingVector.start.y:', renderingVector?.start?.y);
    console.log('   🟢 renderingVector.end.x:', renderingVector?.end?.x);
    console.log('   🟢 renderingVector.end.y:', renderingVector?.end?.y);
    console.log('   📏 Vector length:', renderingVector?.start && renderingVector?.end ?
        Math.sqrt(Math.pow(renderingVector.end.x - renderingVector.start.x, 2) + Math.pow(renderingVector.end.y - renderingVector.start.y, 2)).toFixed(2) : 'N/A');
    console.log('🎨🎨🎨 END RENDER DEBUG 🎨🎨🎨');

    // Store the rendering vector for drawFinalVector to use
    currentVector = renderingVector;

    // Get shapes with practice mode priority
    // CRITICAL: Practice mode must use practiceParsedShapes to avoid contamination
    const shapes = window.isPracticeMode ?
                  (window.practiceMode?.practiceParsedShapes || []) :
                  (parsedShapes || []);

    if (!renderingVector || !shapes.length) {
        console.log('🚫 renderVectorCutResult early return - renderingVector:', !!renderingVector, 'shapes length:', shapes?.length);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');

    renderShapesForPixelAnalysis(tempCtx, shapes);

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;

    const resultImageData = ctx.createImageData(380, 380);
    const resultPixels = resultImageData.data;

    // Pre-normalize vector for diagonal cuts ONCE before pixel loop for performance
    let normalizedStart = renderingVector.start;
    let normalizedEnd = renderingVector.end;

    if (!renderingVector.isCircle) {
        // For diagonal ascending cuts (slope = -1), ensure we go from top-left to bottom-right
        if (Math.abs((normalizedEnd.y - normalizedStart.y) / (normalizedEnd.x - normalizedStart.x) + 1) < 0.1) {
            if (normalizedStart.x > normalizedEnd.x) {
                [normalizedStart, normalizedEnd] = [normalizedEnd, normalizedStart];
                console.log('🔄 Pre-normalized diagonal vector for consistent left-side coloring');
            }
        }
    }

    for (let y = 0; y < 380; y++) {
        for (let x = 0; x < 380; x++) {
            const pixelIndex = (y * 380 + x) * 4;
            
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            
            if (r === 221 && g === 221 && b === 221) {
                let side;
                
                // Handle circle cuts differently from line cuts
                if (renderingVector.isCircle && renderingVector.circle) {
                    // For circle cuts, determine if pixel is inside or outside the circle
                    const circle = renderingVector.circle;
                    const distanceFromCenter = Math.sqrt(
                        Math.pow(x - circle.center.x, 2) + Math.pow(y - circle.center.y, 2)
                    );
                    
                    if (distanceFromCenter <= circle.radius) {
                        side = 'left';  // Inside circle = left side (gets colored)
                    } else {
                        side = 'right'; // Outside circle = right side (stays grey)
                    }
                } else {
                    // Regular line cut - use pre-normalized vector for performance
                    side = getPixelSideOfVector(x, y, normalizedStart, normalizedEnd,
                        normalizedEnd.x - normalizedStart.x, normalizedEnd.y - normalizedStart.y);
                }

                // Color the smaller side based on window.colorSmallerSide flag
                const shouldColor = (side === 'left' && window.colorSmallerSide) || (side === 'right' && !window.colorSmallerSide);

                if (shouldColor) {
                    // Color the smaller side (shape-based for daily, yellow for practice)
                    const color = getDailyCutShadingColor();
                    resultPixels[pixelIndex] = color.r;     // R
                    resultPixels[pixelIndex + 1] = color.g; // G
                    resultPixels[pixelIndex + 2] = color.b; // B
                    resultPixels[pixelIndex + 3] = 255;     // A
                } else if (side === 'on_line') {
                    // Cut line remains black
                    resultPixels[pixelIndex] = 0;
                    resultPixels[pixelIndex + 1] = 0;
                    resultPixels[pixelIndex + 2] = 0;
                    resultPixels[pixelIndex + 3] = 255;
                } else {
                    // Larger side remains grey
                    resultPixels[pixelIndex] = 221;
                    resultPixels[pixelIndex + 1] = 221;
                    resultPixels[pixelIndex + 2] = 221;
                    resultPixels[pixelIndex + 3] = 255;
                }
            } else {
                // Background pixels - set to white
                resultPixels[pixelIndex] = 255;
                resultPixels[pixelIndex + 1] = 255;
                resultPixels[pixelIndex + 2] = 255;
                resultPixels[pixelIndex + 3] = 255;
            }
        }
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    // Draw grid lines over the result (without clearing the background)
    drawGridLinesOnly();
    
    drawShapeOutlines();
    drawFinalVector();
}

// v3.0 - Render vector cut result with controllable opacity for fade animation
function renderVectorCutResultWithOpacity(areaResults, opacity) {
    // CRITICAL: Flag clearing now happens BEFORE this function is called
    // This blocking check was causing persistent canvas shading issues
    console.log('🎨 renderVectorCutResultWithOpacity called, isPracticeMode:', isPracticeMode, 'opacity:', opacity);

    // Get shapes with practice mode priority
    // CRITICAL: Practice mode must use practiceParsedShapes to avoid contamination
    const shapes = window.isPracticeMode ?
                  (window.practiceMode?.practiceParsedShapes || []) :
                  (parsedShapes || []);

    if (!currentVector || !shapes.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');

    renderShapesForPixelAnalysis(tempCtx, shapes);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    
    const resultImageData = ctx.createImageData(380, 380);
    const resultPixels = resultImageData.data;
    
    // Convert opacity to alpha value (0-255)
    const alpha = Math.round(opacity * 255);
    
    for (let y = 0; y < 380; y++) {
        for (let x = 0; x < 380; x++) {
            const pixelIndex = (y * 380 + x) * 4;
            
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            
            if (r === 221 && g === 221 && b === 221) {
                let side;
                
                // Handle circle cuts differently from line cuts
                if (renderingVector.isCircle && renderingVector.circle) {
                    // For circle cuts, determine if pixel is inside or outside the circle
                    const circle = renderingVector.circle;
                    const distanceFromCenter = Math.sqrt(
                        Math.pow(x - circle.center.x, 2) + Math.pow(y - circle.center.y, 2)
                    );
                    
                    if (distanceFromCenter <= circle.radius) {
                        side = 'left';  // Inside circle = left side (gets colored)
                    } else {
                        side = 'right'; // Outside circle = right side (stays grey)
                    }
                } else {
                    // Regular line cut
                    side = getPixelSideOfVector(x, y, renderingVector.start, renderingVector.end, 
                        renderingVector.end.x - renderingVector.start.x, renderingVector.end.y - renderingVector.start.y);
                }
                
                if (side === 'left') {
                    // Color left side (blue for daily, yellow for practice) with controlled opacity
                    if (window.isPracticeMode) {
                        // Yellow color #FAB06A for practice mode
                        resultPixels[pixelIndex] = 250;
                        resultPixels[pixelIndex + 1] = 176;
                        resultPixels[pixelIndex + 2] = 106;
                        resultPixels[pixelIndex + 3] = alpha;
                    } else {
                        // Blue color for daily mode
                        resultPixels[pixelIndex] = 100;
                        resultPixels[pixelIndex + 1] = 150;
                        resultPixels[pixelIndex + 2] = 255;
                        resultPixels[pixelIndex + 3] = alpha;
                    }
                } else if (side === 'on_line') {
                    // Cut line remains black with full opacity
                    resultPixels[pixelIndex] = 0;
                    resultPixels[pixelIndex + 1] = 0;
                    resultPixels[pixelIndex + 2] = 0;
                    resultPixels[pixelIndex + 3] = 255;
                } else {
                    // Right side remains grey with full opacity
                    resultPixels[pixelIndex] = 221;
                    resultPixels[pixelIndex + 1] = 221;
                    resultPixels[pixelIndex + 2] = 221;
                    resultPixels[pixelIndex + 3] = 255;
                }
            } else {
                // Background remains white
                resultPixels[pixelIndex] = 255;
                resultPixels[pixelIndex + 1] = 255;
                resultPixels[pixelIndex + 2] = 255;
                resultPixels[pixelIndex + 3] = 255;
            }
        }
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    // Draw grid lines over the result (without clearing the background)
    drawGridLinesOnly();
    
    drawShapeOutlines();
    drawFinalVector();
}

function renderShape3QuadrantResult(quadrantResults, vector1, vector2) {
    // Get shapes with practice mode priority
    // CRITICAL: Practice mode must use practiceParsedShapes to avoid contamination
    const shapes = window.isPracticeMode ?
                  (window.practiceMode?.practiceParsedShapes || []) :
                  (parsedShapes || []);

    if (!vector1 || !vector2 || !shapes.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');

    console.log(`🔍 RENDER SHAPE 3 QUADRANT: Using ${shapes.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
    renderShapesForPixelAnalysis(tempCtx, shapes);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    
    const resultImageData = ctx.createImageData(380, 380);
    const resultPixels = resultImageData.data;
    
    // Define four harmonious colors for quadrants
    const quadrantColors = {
        1: { r: 255, g: 100, b: 100 }, // Red
        2: { r: 100, g: 150, b: 255 }, // Blue  
        3: { r: 100, g: 200, b: 100 }, // Green
        4: { r: 255, g: 200, b: 100 }  // Yellow
    };
    
    // Get vector parameters
    const dx1 = vector1.end.x - vector1.start.x;
    const dy1 = vector1.end.y - vector1.start.y;
    const dx2 = vector2.end.x - vector2.start.x;
    const dy2 = vector2.end.y - vector2.start.y;
    
    for (let y = 0; y < 380; y++) {
        for (let x = 0; x < 380; x++) {
            const pixelIndex = (y * 380 + x) * 4;
            
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            
            if (r === 221 && g === 221 && b === 221) {
                // Determine which quadrant this pixel belongs to
                const side1 = getPixelSideOfVector(x, y, vector1.start, vector1.end, dx1, dy1);
                const side2 = getPixelSideOfVector(x, y, vector2.start, vector2.end, dx2, dy2);
                
                let quadrant;
                if (side1 === 'right' && side2 === 'right') {
                    quadrant = 1;
                } else if (side1 === 'left' && side2 === 'right') {
                    quadrant = 2;
                } else if (side1 === 'left' && side2 === 'left') {
                    quadrant = 3;
                } else if (side1 === 'right' && side2 === 'left') {
                    quadrant = 4;
                } else {
                    // On line - use black
                    resultPixels[pixelIndex] = 0;
                    resultPixels[pixelIndex + 1] = 0;
                    resultPixels[pixelIndex + 2] = 0;
                    resultPixels[pixelIndex + 3] = 255;
                    continue;
                }
                
                const color = quadrantColors[quadrant];
                resultPixels[pixelIndex] = color.r;
                resultPixels[pixelIndex + 1] = color.g;
                resultPixels[pixelIndex + 2] = color.b;
                resultPixels[pixelIndex + 3] = 255;
            } else {
                // Background - white
                resultPixels[pixelIndex] = 255;
                resultPixels[pixelIndex + 1] = 255;
                resultPixels[pixelIndex + 2] = 255;
                resultPixels[pixelIndex + 3] = 255;
            }
        }
    }
    
    ctx.putImageData(resultImageData, 0, 0);
    
    // Draw grid lines over the result (without clearing the background)
    drawGridLinesOnly();
    
    drawShapeOutlines();
    // Draw both cuts as finalized solid black lines
    drawFinalizedVector(vector1);
    drawFinalizedVector(vector2);
}

function drawShapeOutlines() {
    // Get shapes with practice mode priority - check multiple sources
    // CRITICAL: Practice mode MUST use practiceParsedShapes, NOT window.parsedShapes (which contains daily shapes)
    let shapes;
    if (window.isPracticeMode) {
        // Use practice mode shapes ONLY
        shapes = (window.practiceMode && window.practiceMode.practiceParsedShapes) ||
                 (window.PracticeMode && window.PracticeMode.originalShapes) ||
                 [];
    } else {
        shapes = parsedShapes || [];
    }

    console.log('🎨 drawShapeOutlines called - isPracticeMode:', window.isPracticeMode, 'shapes.length:', shapes.length);
    console.log('🎨 Shape sources checked:', {
        'practiceMode.practiceParsedShapes': window.practiceMode?.practiceParsedShapes?.length || 0,
        'PracticeMode.originalShapes': window.PracticeMode?.originalShapes?.length || 0,
        'parsedShapes': parsedShapes?.length || 0
    });

    if (!shapes.length) {
        console.warn('⚠️ drawShapeOutlines: No shapes to draw!');
        return;
    }

    const bounds = calculateBounds(shapes);
    const scale = calculateScale(bounds);
    const offset = calculateOffset(bounds, scale);

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'transparent';
    ctx.setLineDash([]);

    shapes.forEach(shape => {
        drawPolygonOutline(shape, scale, offset);
    });

    console.log('✅ drawShapeOutlines: Drew', shapes.length, 'shape outlines');
    ctx.restore();
}

function drawShapeOutlinesFromGeoJSON(geoJSON) {
    if (!geoJSON) {
        console.warn('🎨 No GeoJSON provided to drawShapeOutlinesFromGeoJSON');
        return;
    }
    
    const parseResult = parseGeometry(geoJSON);
    const shapesToDraw = parseResult.shapes;
    if (!shapesToDraw.length) {
        console.warn('🎨 No shapes parsed from GeoJSON');
        return;
    }
    
    const bounds = calculateBounds(shapesToDraw);
    const scale = calculateScale(bounds, parseResult.useDirectCoordinates);
    const offset = calculateOffset(bounds, scale, parseResult.useDirectCoordinates);
    
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'transparent';
    ctx.setLineDash([]);
    
    shapesToDraw.forEach(shape => {
        drawPolygonOutline(shape, scale, offset);
    });
    
    ctx.restore();
    console.log('🎨 Drew shape outlines from provided GeoJSON');
}

function drawPolygonOutline(shape, scale, offset) {
    ctx.beginPath();
    drawRingForPixelAnalysis(ctx, shape.outerRing, scale, offset);
    ctx.stroke();
    
    if (shape.holes && shape.holes.length > 0) {
        shape.holes.forEach(hole => {
            ctx.beginPath();
            drawRingForPixelAnalysis(ctx, hole, scale, offset);
            ctx.stroke();
        });
    }
}

function drawFinalVector() {
    if (!currentVector) return;
    
    // Skip drawing vector line for shape-based mechanics that draw their own shapes
    if (currentMechanic && currentMechanic.name) {
        const isShapeBasedMechanic = currentMechanic.name.includes('Circle Cut') || 
                                   currentMechanic.name.includes('Triangle') || 
                                   currentMechanic.name.includes('Square');
        if (isShapeBasedMechanic) {
            console.log('🚫 Skipping vector line drawing for shape-based mechanic:', currentMechanic.name);
            return;
        }
    }
    
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.moveTo(currentVector.start.x, currentVector.start.y);
    ctx.lineTo(currentVector.end.x, currentVector.end.y);
    ctx.stroke();
    
    ctx.restore();
}

// Draw any vector as a finalized cut (solid black, 3px width)
function drawFinalizedVector(vector) {
    if (!vector) return;
    
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.moveTo(vector.start.x, vector.start.y);
    ctx.lineTo(vector.end.x, vector.end.y);
    ctx.stroke();
    
    ctx.restore();
}

function updateStatus(message) {
    // Keep for debugging if needed
    console.log('📋 Status:', message);
    const statusEl = document.getElementById('statusMessage');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

// ======================
// ANIMATED MENU SYSTEM
// ======================

let menuState = {
    isExpanded: false,
    selectedOption: null,
    isLoggedIn: false, // Will be updated by auth system
    isInitialized: false // Prevent double initialization
};

function initializeAnimatedMenu() {
    // Prevent double initialization
    if (menuState.isInitialized) {
        console.log('🔵 Menu already initialized, skipping...');
        return;
    }

    console.log('🔵 Initializing animated menu...');
    console.trace('🔵 MENU INIT CALL STACK:');
    const animatedMenuButton = document.getElementById('animatedMenuButton');
    const menuDropdown = document.getElementById('menuDropdown');

    console.log('🔵 Menu elements:', { animatedMenuButton, menuDropdown });

    // Check if elements exist
    if (!animatedMenuButton) {
        console.error('🔵 ERROR: animatedMenuButton not found!');
        return;
    }
    if (!menuDropdown) {
        console.error('🔵 ERROR: menuDropdown not found!');
        return;
    }
    
    // Handle main menu button click
    if (animatedMenuButton) {
        animatedMenuButton.addEventListener('click', handleMenuButtonClick);
        console.log('🔵 Click listener added to main button');

        // Test if button is responsive
        animatedMenuButton.addEventListener('click', function() {
            console.log('🔵 DEBUG: Menu button clicked!');
        });

        // Add touch/mouse visual feedback
        let isPressed = false;
        let isTouchDevice = false;

        // Touch events for mobile
        animatedMenuButton.ontouchstart = (e) => {
            e.preventDefault(); // Prevent mouse events
            isTouchDevice = true;
            isPressed = true;
            animatedMenuButton.style.transform = 'scale(0.95)';
        };

        animatedMenuButton.ontouchend = (e) => {
            e.preventDefault(); // Prevent mouse events
            animatedMenuButton.style.transform = 'scale(1)';
            isPressed = false;
            // Trigger click manually for touch devices
            setTimeout(() => animatedMenuButton.click(), 10);
        };

        // Mouse events for desktop (only if not touch)
        animatedMenuButton.onmouseenter = () => {
            if (!isTouchDevice && !isPressed) {
                animatedMenuButton.style.transform = 'scale(1.05)';
            }
        };
        animatedMenuButton.onmouseleave = () => {
            if (!isTouchDevice) {
                animatedMenuButton.style.transform = 'scale(1)';
                isPressed = false;
            }
        };
        animatedMenuButton.onmousedown = () => {
            if (!isTouchDevice) {
                isPressed = true;
                animatedMenuButton.style.transform = 'scale(0.95)';
            }
        };
        animatedMenuButton.onmouseup = () => {
            if (!isTouchDevice) {
                animatedMenuButton.style.transform = 'scale(1)';
                isPressed = false;
            }
        };
    } else {
        console.error('🔴 animatedMenuButton not found!');
    }
    
    // Handle dropdown menu item clicks
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const action = e.currentTarget.dataset.action;
            console.log('🔵 Menu item clicked:', action);
            
            // Handle each action directly
            if (action === 'account') {
                handleOption1Click();
            } else if (action === 'daily') {
                handleOption2Click();
            } else if (action === 'competition') {
                handleOption3Click();
            } else if (action === 'practice') {
                handleOption4Click();
            }
            
            // Close menu after action
            collapseMenu();
        });
    });
    
    // Note: selectedButton removed - dropdown menu handles all interactions
    
    // Add click-away handler to close menu when clicking outside
    document.addEventListener('click', function(event) {
        const menuButton = document.getElementById('animatedMenuButton');
        const menuDropdown = document.getElementById('menuDropdown');
        
        // Check if menu is expanded and click was outside both button and dropdown
        if (menuState.isExpanded && 
            menuButton && 
            menuDropdown && 
            !menuButton.contains(event.target) && 
            !menuDropdown.contains(event.target)) {
            console.log('🔵 Clicked outside menu - closing dropdown');
            collapseMenu();
        }
    });
    
    // Update menu visibility based on login status
    updateMenuVisibility();
}

function handleMenuButtonClick(e) {
    if (e) e.stopPropagation(); // Prevent event bubbling
    console.log('🔵 Menu button clicked, isExpanded:', menuState.isExpanded);
    console.log('🔵 Menu state:', menuState);
    if (menuState.isExpanded) {
        // Just collapse the menu - no profile action
        collapseMenu();
    } else {
        expandMenu();
    }
}

// handleSelectedButtonClick removed - no longer needed with dropdown system

function expandMenu() {
    console.log('🔵 Expanding dropdown menu...');
    const animatedMenuButton = document.getElementById('animatedMenuButton');
    const menuDropdown = document.getElementById('menuDropdown');
    
    console.log('🔵 animatedMenuButton:', animatedMenuButton);
    console.log('🔵 menuDropdown:', menuDropdown);
    
    // Add expanded state (keep hamburger icon)
    animatedMenuButton.classList.add('expanded');
    
    // Show dropdown menu
    menuDropdown.style.display = 'block';
    setTimeout(() => {
        menuDropdown.classList.add('show');
    }, 10); // Small delay for smooth animation
    
    console.log('🔵 Dropdown menu expanded');
    menuState.isExpanded = true;
}

function collapseMenu() {
    const animatedMenuButton = document.getElementById('animatedMenuButton');
    const menuDropdown = document.getElementById('menuDropdown');
    
    // Remove expanded state (keep hamburger icon visible)
    animatedMenuButton.classList.remove('expanded');
    
    // Hide dropdown menu
    menuDropdown.classList.remove('show');
    setTimeout(() => {
        menuDropdown.style.display = 'none';
    }, 300); // Wait for animation to complete
    
    menuState.isExpanded = false;
}

// Old menu functions removed - dropdown system handles actions directly

function updateMenuVisibility() {
    console.log('🔵 Updating menu visibility, isLoggedIn:', menuState.isLoggedIn);
    const menuDropdown = document.getElementById('menuDropdown');

    console.log('🔵 Menu dropdown:', menuDropdown);

    // Dropdown menu is always available, visibility controlled by expand/collapse
    if (menuDropdown) {
        console.log('🔵 Menu dropdown ready');
    }
}

function updateLoginStatus(isLoggedIn) {
    menuState.isLoggedIn = isLoggedIn;
    updateMenuVisibility();
}

function showAuthRequiredPopup(feature) {
    const featureMessages = {
        'archive': "To practice with previous shapes, you'll need a free account",
        'competition': "To play in or create a competition with mates, you'll need a free account"
    };
    
    const customMessage = featureMessages[feature] || `To access ${feature}, you'll need a free account`;
    
    if (typeof openAuthModal === 'function') {
        // Show the auth modal with signup mode and custom message
        openAuthModal('signup', customMessage);
    } else {
        // Fallback to alert
        alert(customMessage);
    }
}

// Reset menu to initial state
function resetMenu() {
    const animatedMenuButton = document.getElementById('animatedMenuButton');
    const menuOptions = document.getElementById('menuOptions');
    const selectedOption = document.getElementById('selectedOption');
    const hamburgerIcon = animatedMenuButton.querySelector('.hamburger-icon');
    
    // Reset to initial state
    animatedMenuButton.style.display = 'flex';
    animatedMenuButton.classList.remove('hidden');
    animatedMenuButton.classList.remove('expanded');
    menuOptions.classList.remove('expanded');
    selectedOption.style.display = 'none';
    
    // Hamburger icon is handled by CSS
    
    menuState.isExpanded = false;
    menuState.selectedOption = null;
}

// ====================================================================
// COMPREHENSIVE VISUAL STATE RESTORATION FUNCTIONS
// ====================================================================

function restoreCompleteVisualState(restoredState) {
    console.log('🎨 Restoring complete visual state for scenario:', restoredState.scenarioNumber);

    // CRITICAL: Prefer canvas image restoration for accurate color/grid preservation
    // Canvas image captures the exact rendering from the mechanic, including proper colors and grid overlay
    if (window.pendingCanvasRestoration || restoredState.canvasData) {
        console.log('🎨 Using saved canvas image for accurate restoration (preferred for Triangle mechanic)');
        restoreVisualState(restoredState);

        // Draw triangle line on top if available
        if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
            const lastAttempt = restoredState.currentAttempts[restoredState.currentAttempts.length - 1];
            if (lastAttempt && lastAttempt.trianglePoints && lastAttempt.trianglePoints.length === 3) {
                // Wait for canvas image to load, then draw triangle
                setTimeout(() => {
                    console.log('✏️ Drawing triangle cut line on top of restored canvas');
                    const ctx = window.ctx;
                    ctx.save();
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.moveTo(lastAttempt.trianglePoints[0].x, lastAttempt.trianglePoints[0].y);
                    ctx.lineTo(lastAttempt.trianglePoints[1].x, lastAttempt.trianglePoints[1].y);
                    ctx.lineTo(lastAttempt.trianglePoints[2].x, lastAttempt.trianglePoints[2].y);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.restore();
                    console.log('✅ Triangle cut line drawn on restored canvas');
                }, 150);
            }
        }
        return;
    }

    // Fallback: Recreate cut visualization from attempt data if no canvas image available
    if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
        const lastAttempt = restoredState.currentAttempts[restoredState.currentAttempts.length - 1];
        if (lastAttempt && lastAttempt.cutVector && lastAttempt.leftPercentage !== undefined) {
            console.log('🎨 No canvas image - recreating cut visualization from attempt data (fallback)');
            restoreCutVisualization(restoredState);

            // Clear restoration flags
            if (window.pendingCanvasRestoration) {
                window.pendingCanvasRestoration = null;
                window.isRestoringGameState = false;
                console.log('🔄 Cleared pendingCanvasRestoration after cut visualization');
            }
            return;
        }
    }

    // Fallback: Use canvas image restoration if cut visualization data is not available
    const canvasDataSource = restoredState.canvasData || window.pendingCanvasRestoration;
    if (canvasDataSource && window.canvas && window.ctx) {
        console.log('🎨 Using canvas image restoration (fallback method)');
        const img = new Image();
        img.onload = function() {
            window.ctx.clearRect(0, 0, canvas.width, canvas.height);
            window.ctx.drawImage(img, 0, 0);
            console.log('✅ Canvas shaded state restored from saved image');

            // Clear the pending restoration since we've used it
            if (window.pendingCanvasRestoration) {
                window.pendingCanvasRestoration = null;
                window.isRestoringGameState = false;
                console.log('🔄 Cleared pendingCanvasRestoration after use');
            }
        };
        img.src = canvasDataSource;
    } else {
        console.log('⚠️ No restoration data available - showing unshaded shape only');
    }
    
    // 2. Restore percentage scores display
    let lastAttempt = null;

    // CRITICAL FIX: Calculate the correct attempt index based on scenario
    // The totalCuts includes both cuts made AND button clicks
    // For odd totalCuts (1,3,5,7,9,11): Cut just made - show that attempt
    // For even totalCuts (2,4,6,8,10): Button clicked - not applicable for split display

    const currentShape = restoredState.currentShape || window.currentShapeNumber || 1;
    const currentAttempt = restoredState.currentAttempt || window.currentAttemptNumber || 1;
    const totalCuts = restoredState.totalCutsMade || window.totalCutsMade || 0;

    // Calculate the correct attempt index based on current shape/attempt
    // Shape 1: attempts[0] and attempts[1]
    // Shape 2: attempts[2] and attempts[3]
    // Shape 3: attempts[4] and attempts[5]
    const baseIndex = (currentShape - 1) * 2;
    const targetAttemptIndex = baseIndex + (currentAttempt - 1);

    console.log(`🎯 Finding correct attempt for Shape ${currentShape}, Cut ${currentAttempt}`);
    console.log(`   Total cuts made: ${totalCuts}, target index: ${targetAttemptIndex}`);

    // Try multiple sources for attempt data
    let attempts = null;
    if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
        attempts = restoredState.currentAttempts;
    } else if (window.currentAttempts && window.currentAttempts.length > 0) {
        attempts = window.currentAttempts;
    } else if (typeof currentAttempts !== 'undefined' && currentAttempts.length > 0) {
        attempts = currentAttempts;
    }

    if (attempts && targetAttemptIndex >= 0 && targetAttemptIndex < attempts.length) {
        lastAttempt = attempts[targetAttemptIndex];
        console.log(`✅ Found correct attempt at index ${targetAttemptIndex}:`, lastAttempt);
    } else {
        console.warn(`⚠️ Could not find attempt at index ${targetAttemptIndex}, attempts array length: ${attempts?.length || 0}`);

        // FALLBACK: If the exact index doesn't exist, use the most recent available attempt
        // This handles cases where Cut 2 wasn't saved but Cut 1 was
        if (attempts && attempts.length > 0) {
            // Use the last available attempt as fallback
            const fallbackIndex = Math.min(attempts.length - 1, targetAttemptIndex);
            lastAttempt = attempts[fallbackIndex];
            console.log(`🔄 FALLBACK: Using attempt at index ${fallbackIndex} for Shape ${currentShape}, Cut ${currentAttempt}`);
        }
    }
    
    if (lastAttempt && lastAttempt.leftPercentage && lastAttempt.rightPercentage) {
        console.log('📊 Restoring percentage display:', lastAttempt.leftPercentage + '%', lastAttempt.rightPercentage + '%');
        showPercentageResults(lastAttempt.leftPercentage, lastAttempt.rightPercentage);
    } else {
        console.log('⚠️ No attempt data found for percentage restoration');
        console.log('📊 Debug - Available sources:', {
            restoredStateAttempts: restoredState.currentAttempts?.length || 0,
            windowCurrentAttempts: window.currentAttempts?.length || 0,
            localCurrentAttempts: typeof currentAttempts !== 'undefined' ? currentAttempts.length : 'undefined'
        });
        
        // FALLBACK: For cut completed scenarios, try to show last saved percentages or neutral state
        if (restoredState.scenarioNumber === 1 || restoredState.scenarioNumber === 3 || restoredState.scenarioNumber === 5 || restoredState.scenarioNumber === 7 || restoredState.scenarioNumber === 9) {
            console.log('📊 Restoring cut state for completed scenario', restoredState.scenarioNumber);

            // Try to get saved percentages from dailyGameState or SimpleRefresh
            let leftPercentage = 50;
            let rightPercentage = 50;

            if (window.dailyGameState && window.dailyGameState.cuts && window.dailyGameState.cuts.length > 0) {
                const lastCut = window.dailyGameState.cuts[window.dailyGameState.cuts.length - 1];
                if (lastCut && lastCut.leftPercentage !== undefined && lastCut.rightPercentage !== undefined) {
                    leftPercentage = lastCut.leftPercentage;
                    rightPercentage = lastCut.rightPercentage;
                    console.log('📊 Using saved cut results:', leftPercentage, rightPercentage);
                }
            }

            // Show the percentages without any placeholder messages
            showPercentageResults(leftPercentage, rightPercentage);
        }
    }
    
    // 3. Ensure canvas is properly disabled for interaction (awaiting choice state)
    const canvasElement = document.getElementById('geoCanvas');
    if (canvasElement) {
        canvasElement.style.pointerEvents = 'none';
        console.log('🚫 Canvas interaction disabled - awaiting button choice');
    }
}

function restoreCutVisualization(restoredState) {
    // Attempt to recreate the cut visualization from the saved data
    if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
        const lastAttempt = restoredState.currentAttempts[restoredState.currentAttempts.length - 1];

        // Check if we have percentage data (splitAreas and cutVector might vary by mechanic)
        if (lastAttempt && lastAttempt.leftPercentage !== undefined) {
            console.log('🎨 Recreating cut visualization from attempt data');
            console.log('   - leftPercentage:', lastAttempt.leftPercentage);
            console.log('   - rightPercentage:', lastAttempt.rightPercentage);
            console.log('   - splitAreas exists:', !!lastAttempt.splitAreas);

            // Check if we have splitAreas (pixel-based mechanics like Triangle)
            if (lastAttempt.splitAreas && lastAttempt.splitAreas.left && lastAttempt.splitAreas.right) {
                console.log('🎨 Using pixel-based rendering for Triangle/shape-based mechanic');

                // For pixel-based mechanics, use renderVectorCutResult with area data
                // This works because renderVectorCutResult can handle both vector and pixel-based cuts
                if (typeof renderVectorCutResult === 'function' && window.canvas && window.ctx) {
                    const areaResults = {
                        leftPercentage: lastAttempt.leftPercentage,
                        rightPercentage: lastAttempt.rightPercentage,
                        leftArea: lastAttempt.splitAreas.left,
                        rightArea: lastAttempt.splitAreas.right
                    };

                    // Set cutVector if available (for line drawing)
                    if (lastAttempt.cutVector) {
                        window.currentVector = lastAttempt.cutVector;
                    }

                    // CRITICAL: Clear canceled line drawing flag
                    if (window.canceledLineDrawing) {
                        console.log('🔧 Restoration: Clearing canceledLineDrawing flag');
                        window.canceledLineDrawing = false;
                    }

                    renderVectorCutResult(areaResults);

                    // CRITICAL: Draw triangle line if triangle points are available
                    if (lastAttempt.trianglePoints && lastAttempt.trianglePoints.length === 3) {
                        console.log('✏️ Drawing triangle cut line from saved points');
                        const ctx = window.ctx;
                        ctx.save();
                        ctx.strokeStyle = '#000000'; // Black triangle outline
                        ctx.lineWidth = 3;
                        ctx.setLineDash([]);

                        ctx.beginPath();
                        ctx.moveTo(lastAttempt.trianglePoints[0].x, lastAttempt.trianglePoints[0].y);
                        ctx.lineTo(lastAttempt.trianglePoints[1].x, lastAttempt.trianglePoints[1].y);
                        ctx.lineTo(lastAttempt.trianglePoints[2].x, lastAttempt.trianglePoints[2].y);
                        ctx.closePath();
                        ctx.stroke();
                        ctx.restore();
                        console.log('✅ Triangle cut line drawn');
                    }

                    return;
                }
            }

            // Check if we have a proper vector with start/end (vector-based mechanics)
            if (lastAttempt.cutVector && lastAttempt.cutVector.start && lastAttempt.cutVector.end) {
                console.log('🎨 Using renderVectorCutResult for vector-based mechanic');

                // Set up the global variables needed for visualization
                window.currentVector = lastAttempt.cutVector;

                // CRITICAL: Clear canceled line drawing flag just before rendering
                if (window.canceledLineDrawing) {
                    console.log('🔧 Restoration: Clearing canceledLineDrawing flag');
                    window.canceledLineDrawing = false;
                }

                if (typeof renderVectorCutResult === 'function' && window.canvas && window.ctx) {
                    const areaResults = {
                        leftPercentage: lastAttempt.leftPercentage,
                        rightPercentage: lastAttempt.rightPercentage,
                        leftArea: lastAttempt.splitAreas?.left || null,
                        rightArea: lastAttempt.splitAreas?.right || null
                    };
                    renderVectorCutResult(areaResults);
                    return;
                }
            }

            // Fallback - just show the unshaded shape
            console.log('⚠️ No compatible visualization method - showing unshaded shape');
            if (typeof redrawCanvas === 'function') {
                redrawCanvas();
            }
        } else {
            console.log('⚠️ Missing cut data - redrawing clean shape');
            if (typeof redrawCanvas === 'function') {
                redrawCanvas();
            }
        }
    }
}

function drawCutLine(cutVector) {
    // Draw a simple cut line for fallback visualization
    if (!window.ctx || !cutVector) return;
    
    console.log('🔸 Drawing fallback cut line');
    window.ctx.save();
    window.ctx.strokeStyle = '#ff6b6b';
    window.ctx.lineWidth = 3;
    window.ctx.setLineDash([5, 5]);
    
    window.ctx.beginPath();
    window.ctx.moveTo(cutVector.start.x, cutVector.start.y);
    window.ctx.lineTo(cutVector.end.x, cutVector.end.y);
    window.ctx.stroke();
    
    window.ctx.restore();
}

function restoreAttemptCommentary(restoredState) {
    console.log('💬 Restoring attempt commentary for scenario:', restoredState.scenarioNumber);
    
    // Find the commentary for the last completed attempt
    if (restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
        const lastAttempt = restoredState.currentAttempts[restoredState.currentAttempts.length - 1];
        if (lastAttempt && lastAttempt.commentary) {
            console.log('📝 Displaying commentary:', lastAttempt.commentary);
            showCommentaryText(lastAttempt.commentary);
        } else if (lastAttempt && lastAttempt.leftPercentage && lastAttempt.rightPercentage) {
            // Generate commentary if not saved
            const commentary = generateCommentary(lastAttempt.leftPercentage, lastAttempt.rightPercentage);
            console.log('📝 Generated commentary:', commentary);
            showCommentaryText(commentary);
        }
    }
}

function showCommentaryText(commentary) {
    // Use the instruction area like normal gameplay, don't create separate elements
    if (typeof updateInstructionText === 'function') {
        updateInstructionText(commentary, true); // true = bold styling for commentary
        console.log('💬 Commentary displayed in instruction area:', commentary);
    } else {
        console.log('⚠️ updateInstructionText not available, commentary not displayed:', commentary);
    }
}

function generateCommentary(leftPercentage, rightPercentage) {
    const diff = Math.abs(leftPercentage - rightPercentage);
    
    if (diff <= 2) {
        return "Perfect! Nearly equal split.";
    } else if (diff <= 5) {
        return "Excellent! Very close to 50/50.";
    } else if (diff <= 10) {
        return "Good attempt! Getting closer to the center.";
    } else if (diff <= 20) {
        return "Not quite centered, but you're learning!";
    } else {
        return "Keep practicing!";
    }
}

function showPercentageResults(leftPercentage, rightPercentage) {
    // Use existing percentage display if available
    if (typeof displayPercentages === 'function') {
        displayPercentages(leftPercentage, rightPercentage);
        return;
    }

    // Always use the fixed percentage area inside results container - NO EXCEPTIONS
    const fixedPercentageArea = document.getElementById('fixedPercentageArea');
    if (!fixedPercentageArea) {
        console.log('⚠️ Fixed percentage area not found - creating fallback');
        return;
    }

    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Ensure the area is visible when we're adding content to it
    fixedPercentageArea.style.setProperty('visibility', 'visible', 'important');

    // Create result div matching the exact format from normal gameplay
    const resultDiv = document.createElement('div');
    resultDiv.className = 'attempt-result';

    // Match the exact colors from normal gameplay - use shape-based colors
    const shapeColors = {
        1: '#EDAE49', // Orange/gold
        2: '#D1495B', // Red
        3: '#00798C'  // Teal
    };
    const leftColor = shapeColors[currentShapeNumber] || '#EDAE49';
    const greyColor = '#666666'; // Darker grey for better visibility

    // Use the EXACT same HTML structure and styling as normal gameplay
    resultDiv.innerHTML = `
        <div class="attempt-info">
            <div class="split-display-large">
                <span style="color: ${leftColor}; font-weight: bold; font-size: ${splitFontSize}px;">${Math.round(leftPercentage)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px;">${Math.round(rightPercentage)}%</span>
            </div>
        </div>
    `;
    
    // Clear existing content and add the new result
    fixedPercentageArea.innerHTML = '';
    fixedPercentageArea.appendChild(resultDiv);
    
    console.log('✅ Percentage splits restored with normal appearance:', leftPercentage.toFixed(1), rightPercentage.toFixed(1));
}


// ====================================================================

// Initialize menu when DOM is loaded
// MOVED TO MAIN INITIALIZATION: Menu initialization moved to main DOMContentLoaded to prevent conflicts
// document.addEventListener('DOMContentLoaded', function() {
//     initializeAnimatedMenu();
//
//     // Listen for auth state changes to update menu visibility
//     document.addEventListener('authStateChange', function(e) {
//         const isLoggedIn = e.detail?.isLoggedIn || false;
//         updateLoginStatus(isLoggedIn);
//     });
//
//     // Also check initial auth state if available
//     setTimeout(() => {
//         if (window.AuthService && typeof window.AuthService.isLoggedIn === 'function') {
//             const isLoggedIn = window.AuthService.isLoggedIn();
//             updateLoginStatus(isLoggedIn);
//         }
//     }, 1000); // Wait for auth service to initialize
// });

// Test authentication functions
window.testSignup = async function(email = 'test@example.com', username = 'testuser', password = 'password123') {
    console.log('Testing signup with:', {email, username});
    
    // Ensure AuthService is available
    if (!window.AuthService) {
        console.error('AuthService not available');
        return;
    }
    
    const result = await window.AuthService.createUser(email, username, password);
    if (result.error) {
        console.error('Signup failed:', result.error);
        if (result.suggestion) {
            console.log('Suggestion:', result.suggestion);
        }
    } else {
        console.log('✅ Signup successful!', result);
    }
    return result;
};

// Debug functions for authentication status
window.checkAuth = function() {
    console.log('=== Authentication Status ===');
    console.log('AuthService exists:', !!window.AuthService);
    if (window.AuthService) {
        console.log('AuthService initialized:', window.AuthService.initialized);
        console.log('Is logged in:', window.AuthService.isLoggedIn());
        console.log('Is guest:', window.AuthService.isGuest);
        console.log('Current user:', window.AuthService.currentUser);
    }
    
    console.log('\nLocalStorage auth tokens:');
    console.log('userAuthToken:', localStorage.getItem('userAuthToken'));
    console.log('sb-auth-token:', localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token'));
    
    if (window.SupabaseConfig && window.SupabaseConfig.client) {
        window.SupabaseConfig.client.auth.getSession().then(({data}) => {
            console.log('\nSupabase session:', data.session);
        });
    }
    
    return 'Check console for auth details';
};

// Force login for testing (creates a demo session)
window.forceLogin = function(username = 'TestUser') {
    console.log('Creating demo session for testing...');
    
    // Set a demo auth token
    localStorage.setItem('userAuthToken', 'demo_token_' + Date.now());
    
    // Update AuthService state
    if (window.AuthService) {
        window.AuthService.isGuest = false;
        window.AuthService.currentUser = {
            id: 'demo_user_' + Date.now(),
            email: username.toLowerCase() + '@demo.com',
            username: username,
            isGuest: false
        };
        window.AuthService.initialized = true;
    }
    
    // Update AuthManager state as well
    if (window.AuthManager) {
        window.AuthManager.authService = window.AuthService;
    }
    
    // Trigger auth state change
    document.dispatchEvent(new CustomEvent('authStateChange', {
        detail: { isLoggedIn: true }
    }));
    
    // Update menu visibility
    if (window.updateLoginStatus) {
        window.updateLoginStatus(true);
    }
    
    // Update button states
    if (window.updateButtonStates) {
        window.updateButtonStates();
    }
    
    // Close any open auth popups
    if (window.closeAuthModal) {
        window.closeAuthModal();
    }
    
    // Refresh page sections that depend on auth
    if (window.CompetitionManager) {
        window.CompetitionManager.initialize();
    }
    
    console.log('✅ Demo session created. You are now "logged in" as:', username);
    console.log('Note: This is only for testing UI behavior. No actual authentication occurred.');
    console.log('Auth check result:', window.isUserSignedIn());
    return 'Demo login successful';
};

// Force logout for testing
window.forceLogout = function() {
    console.log('Clearing authentication...');
    
    // Clear auth tokens
    localStorage.removeItem('userAuthToken');
    localStorage.removeItem('sb-zxrfhumifazjxgikltkz-auth-token');
    
    // Reset AuthService state
    if (window.AuthService) {
        window.AuthService.isGuest = true;
        window.AuthService.currentUser = null;
        window.AuthService.initializeGuestMode();
    }
    
    // Trigger auth state change
    document.dispatchEvent(new CustomEvent('authStateChange', {
        detail: { isLoggedIn: false }
    }));
    
    // Update menu visibility
    if (window.updateLoginStatus) {
        window.updateLoginStatus(false);
    }
    
    console.log('✅ Logged out. You are now in guest mode.');
    return 'Logout successful';
};

// ===== PRACTICE MODE FUNCTIONS =====
// Copy existing functions EXACTLY with practice prefixes

function drawPracticeGrid(context = ctx) {
    context.save();
    
    // Fill canvas with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw black outline
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Only draw grid lines if game has started (not initial state)
    if (gameState !== 'initial') {
        // Grid lines
        context.strokeStyle = '#d0d0d0';
        context.lineWidth = 0.5;
        
        // Draw 14x14 grid with larger cells
        const gridSize = 14;
        const cellSize = canvas.width / gridSize;
        
        // Vertical lines
        for (let i = 0; i <= gridSize; i++) {
            const x = i * cellSize;
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, canvas.height);
            context.stroke();
        }
        
        // Horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            const y = i * cellSize;
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(canvas.width, y);
            context.stroke();
        }
    }
    
    context.restore();
}

function renderPracticeShapeForCutting(shapes, useDirectCoordinates = false, context = ctx) {
    // Check if the new PracticeMode class is active - if so, don't use old system
    if (window.PracticeMode && window.PracticeMode.isActive) {
        console.log('🎯 New PracticeMode system is active - skipping old rendering system');
        return;
    }
    
    // Only log during non-animation calls to reduce console spam
    if (!window.isAnimating) {
        console.log(`🎨 renderPracticeShapeForCutting called with ${shapes.length} shapes, useDirectCoordinates: ${useDirectCoordinates}`);
    }
    if (shapes.length === 0) {
        if (!window.isAnimating) {
            console.error('❌ No shapes to render!');
        }
        return;
    }
    
    // Calculate bounds for scaling and centering
    const bounds = calculateBounds(shapes);
    const scale = calculateScale(bounds, useDirectCoordinates);
    const offset = calculateOffset(bounds, scale, useDirectCoordinates);
    
    if (!window.isAnimating) {
        console.log(`🎨 Rendering with offset: (${offset.x.toFixed(1)}, ${offset.y.toFixed(1)}), scale: ${scale.toFixed(2)}`);
    }
    
    // Set drawing styles - lighter grey fill, black stroke
    context.save();
    context.fillStyle = '#dddddd';
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    
    // Draw each shape
    shapes.forEach((shape, index) => {
        drawPolygon(shape, scale, offset, context);
    });
    
    context.restore();
}

function calculatePracticePixelBasedAreas(pixels, width, height, vector) {
    let leftArea = 0;
    let rightArea = 0;
    let totalShapePixels = 0;
    
    const lineStart = vector.start;
    const lineEnd = vector.end;
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            
            if (r === 221 && g === 221 && b === 221) {
                totalShapePixels++;
                
                const side = getPixelSideOfVector(x, y, lineStart, lineEnd, dx, dy);
                
                if (side === 'left') {
                    leftArea++;
                } else if (side === 'right') {
                    rightArea++;
                }
            }
        }
    }
    
    const leftPercentage = totalShapePixels > 0 ? (leftArea / totalShapePixels) * 100 : 0;
    const rightPercentage = totalShapePixels > 0 ? (rightArea / totalShapePixels) * 100 : 0;
    
    return {
        leftArea,
        rightArea,
        totalShapePixels,
        leftPercentage,
        rightPercentage
    };
}

function renderPracticeVectorCutResult(areaResults) {
    if (!practiceMode.practiceCurrentVector || !practiceMode.practiceParsedShapes.length) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    renderShapesForPixelAnalysis(tempCtx, practiceMode.practiceParsedShapes);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    
    const resultImageData = ctx.createImageData(380, 380);
    const resultPixels = resultImageData.data;
    
    for (let y = 0; y < 380; y++) {
        for (let x = 0; x < 380; x++) {
            const pixelIndex = (y * 380 + x) * 4;
            
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            
            if (r === 221 && g === 221 && b === 221) {
                const side = getPixelSideOfVector(x, y, practiceMode.practiceCurrentVector.start, practiceMode.practiceCurrentVector.end,
                    practiceMode.practiceCurrentVector.end.x - practiceMode.practiceCurrentVector.start.x,
                    practiceMode.practiceCurrentVector.end.y - practiceMode.practiceCurrentVector.start.y);

                // Color the smaller side based on window.colorSmallerSide flag
                const shouldColor = (side === 'left' && window.colorSmallerSide) || (side === 'right' && !window.colorSmallerSide);

                if (shouldColor) {
                    // Color the smaller side (shape-based for daily, yellow for practice)
                    const color = getDailyCutShadingColor();
                    resultPixels[pixelIndex] = color.r;     // R
                    resultPixels[pixelIndex + 1] = color.g; // G
                    resultPixels[pixelIndex + 2] = color.b; // B
                    resultPixels[pixelIndex + 3] = 255;     // A
                } else if (side === 'on_line') {
                    // Cut line remains black
                    resultPixels[pixelIndex] = 0;       // R
                    resultPixels[pixelIndex + 1] = 0;   // G
                    resultPixels[pixelIndex + 2] = 0;   // B
                    resultPixels[pixelIndex + 3] = 255; // A
                } else {
                    // Larger side keeps original gray color
                    resultPixels[pixelIndex] = 221;     // R
                    resultPixels[pixelIndex + 1] = 221; // G
                    resultPixels[pixelIndex + 2] = 221; // B
                    resultPixels[pixelIndex + 3] = 255; // A
                }
            } else {
                // Background remains white
                resultPixels[pixelIndex] = 255;     // R
                resultPixels[pixelIndex + 1] = 255; // G
                resultPixels[pixelIndex + 2] = 255; // B
                resultPixels[pixelIndex + 3] = 255; // A
            }
        }
    }
    
    // Draw the result
    ctx.putImageData(resultImageData, 0, 0);
    
    // Draw cut vector as black line
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(practiceMode.practiceCurrentVector.start.x, practiceMode.practiceCurrentVector.start.y);
    ctx.lineTo(practiceMode.practiceCurrentVector.end.x, practiceMode.practiceCurrentVector.end.y);
    ctx.stroke();
    ctx.restore();
}

// OLD FUNCTION REMOVED - Now using practice-mode.js class system
function loadOldestPracticeShape() {
    // Deprecated: This function is replaced by practice-mode.js class initialization
    console.warn('⚠️ loadOldestPracticeShape is deprecated - use practice-mode.js class system');
    
    // Show instruction area for practice mode with practice-specific mechanic
    const practiceMechanic = getPracticeMechanicName();
    console.log('🎮 Practice mode using mechanic:', practiceMechanic);
    
    // Force show instruction area and set initial instruction for practice mechanic
    const instructionArea = document.getElementById('instructionArea');
    if (instructionArea) {
        instructionArea.style.display = 'flex';
        instructionArea.style.visibility = 'visible';
        console.log('🎮 Practice mode: Set instruction area display and visibility');
        const initialInstruction = getInitialInstruction(practiceMechanic);
        if (window.updateInstructionText) {
            window.updateInstructionText(initialInstruction, false);
            console.log('🎮 Practice mode initial instruction:', initialInstruction);
        }
    }
    
    // Shape loading now handled by practice-mode.js class system
}

async function loadPracticeShape(shapePath) {
    try {
        const response = await fetch(`./Practice Shapes/${shapePath}`);
        const geoJSON = await response.json();
        
        const parseResult = parseGeometry(geoJSON);
        practiceMode.practiceParsedShapes = parseResult.shapes;
        
        // Clear any existing cut results
        practiceMode.practiceCurrentVector = null;
        practiceMode.practiceVectorStart = null;
        practiceMode.practiceVectorEnd = null;
        
        // Clear percentage display area
        const percentageArea = document.getElementById('fixedPercentageArea');
        if (percentageArea) percentageArea.innerHTML = '';
        
        // Clear and redraw practice canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid(ctx);
        renderPracticeShapeForCutting(practiceMode.practiceParsedShapes);
        
        // Ensure canvas remains interactive after shape loading
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            console.log('🔧 Canvas interaction maintained after practice shape load');
        }
        
        // Update navigation buttons
        updatePracticeNavigationButtons();
        
        console.log('Practice shape loaded:', shapePath);
    } catch (error) {
        console.error('Failed to load practice shape:', shapePath, error);
    }
}

// DISABLED: Old practice mode function - replaced with new blank practice-mode.js system
// This function was causing daily mode mechanics to load in practice mode
/*
function enterPracticeMode() {
    if (!checkPracticeAccess()) return;

    // Set practice mode flags
    isPracticeMode = true;
    window.isPracticeMode = true; // Set global for mechanics to access
    isDailyMode = false;
    
    // Save current daily game state
    practiceMode.savedDailyGameState = {
        gameState: gameState,
        currentAttempts: [...currentAttempts],
        currentShapeNumber: currentShapeNumber,
        currentAttemptNumber: currentAttemptNumber,
        canvasContent: canvas.toDataURL() // Save current canvas state
    };
    
    // Hide daily game specific UI elements
    const progressDisplay = document.getElementById('demoProgressDisplay');
    if (progressDisplay) progressDisplay.style.visibility = 'hidden';
    
    // Hide welcome text and play/practice buttons
    const welcomeOverlay = document.querySelector('.welcome-overlay');
    if (welcomeOverlay) welcomeOverlay.style.visibility = 'hidden';
    
    const initialPlayButton = document.getElementById('initialPlayButton');
    if (initialPlayButton) initialPlayButton.style.visibility = 'hidden';
    
    // Also hide any other welcome-related elements
    const welcomeOverlayById = document.getElementById('welcomeOverlay');
    if (welcomeOverlayById) welcomeOverlayById.style.visibility = 'hidden';
    
    // Show practice mode UI elements
    document.getElementById('practiceModeIndicator').style.display = 'block';
    document.getElementById('practiceNavigation').style.display = 'flex';

    // Desktop full-screen mode: Move practice elements down by 50px
    if (window.innerWidth >= 769) {
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        const buttonsContainer = document.getElementById('buttonsContainer');

        if (fixedPercentageArea) {
            fixedPercentageArea.style.setProperty('margin-top', '55px', 'important');
            fixedPercentageArea.style.setProperty('position', 'relative', 'important');
        }

        if (buttonsContainer) {
            buttonsContainer.style.setProperty('margin-top', '50px', 'important');
            buttonsContainer.style.setProperty('margin-bottom', '0', 'important');
            buttonsContainer.style.setProperty('position', 'relative', 'important');
        }

        console.log('✅ Desktop: Moved practice mode elements down by 50px');
    }

    // Disable conflicting old practice navigation system
    window.OLD_PRACTICE_NAVIGATION_DISABLED = true;
    console.log('🔧 Old practice navigation disabled - using practice-mode.js system only');

    // DISABLED: Practice mode should be completely blank - no daily mode content
    // Clear and setup canvas for practice (same canvas, different content)
    // ctx.clearRect(0, 0, canvas.width, canvas.height);

    // DISABLED: Practice mode should not show daily shapes
    // Redraw the shapes so they're visible in practice mode
    // redrawCanvas();
    
    // Set practice canvas references to use main canvas
    practiceMode.practiceCanvas = canvas;
    practiceMode.practiceCtx = ctx;
    
    // Initialize practice mode cutting variables
    practiceMode.practiceCurrentVector = null;
    practiceMode.practiceIsDrawingVector = false;
    practiceMode.practiceVectorStart = null;
    practiceMode.practiceVectorEnd = null;
    
    // Clear any existing commentary from daily game
    const instructionText = document.getElementById('instructionText');
    if (instructionText) {
        instructionText.textContent = '';
        instructionText.style.fontWeight = 'normal';
        console.log('🧹 Cleared daily game commentary before practice mode');
    }
    
    // Set practice mode active EARLY
    practiceMode.isActive = true;
    
    // Enable interaction for practice mode - set animation complete FIRST
    isShapeAnimationComplete = true;
    setGameState('cutting');
    
    // Directly enable interaction for practice mode (bypass restrictions)
    isInteractionEnabled = true;
    window.isInteractionEnabled = true;
    
    // Explicitly enable canvas pointer-events for practice mode
    if (canvas) {
        canvas.style.pointerEvents = 'auto';
        console.log('🔧 Canvas pointer-events enabled for practice mode');
    }
    
    console.log('🔧 Practice mode interaction directly enabled - bypassing restrictions');
    
    // Debug: Log current canvas state
    console.log('🔍 DEBUG: Practice mode canvas state:', {
        canvas: !!canvas,
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
        canvasStyle: canvas?.style.cssText,
        canvasComputedStyle: canvas ? window.getComputedStyle(canvas).pointerEvents : 'no canvas',
        canvasEventListeners: canvas ? 'attached' : 'no canvas',
        practiceActive: practiceMode.isActive,
        gameState: gameState,
        isInteractionEnabled: isInteractionEnabled,
        isShapeAnimationComplete: isShapeAnimationComplete
    });
    
    // DISABLED: Old practice event listeners conflict with practice-mode.js
    // setupPracticeEventListeners();
    
    console.log('🔧 Practice mode initialized with interaction enabled');
    
    // Force test canvas interaction immediately
    setTimeout(() => {
        console.log('🔧 Testing canvas interaction after 1 second...');
        if (canvas) {
            // Check what element is at the canvas center position
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const elementAtCenter = document.elementFromPoint(centerX, centerY);
            
            console.log('🔍 Element at canvas center:', {
                element: elementAtCenter,
                tagName: elementAtCenter?.tagName,
                id: elementAtCenter?.id,
                className: elementAtCenter?.className,
                isCanvas: elementAtCenter === canvas,
                canvasRect: rect,
                canvasStyle: {
                    pointerEvents: canvas.style.pointerEvents,
                    position: window.getComputedStyle(canvas).position,
                    zIndex: window.getComputedStyle(canvas).zIndex
                }
            });
            
            // Test both click and mousedown events
            console.log('🔧 Testing CLICK event...');
            const testClickEvent = new MouseEvent('click', {
                clientX: centerX,
                clientY: centerY,
                bubbles: true
            });
            canvas.dispatchEvent(testClickEvent);
            
            setTimeout(() => {
                console.log('🔧 Testing MOUSEDOWN event...');
                const testMousedownEvent = new MouseEvent('mousedown', {
                    clientX: centerX,
                    clientY: centerY,
                    bubbles: true,
                    button: 0
                });
                canvas.dispatchEvent(testMousedownEvent);
                console.log('🔧 Programmatic mousedown dispatched to canvas');
            }, 500);
        }
    }, 1000);
    
    // DISABLED: Old practice shape loading conflicts with practice-mode.js
    // loadOldestPracticeShape();
    
    // Initialize the new practice-mode.js system instead
    if (window.PracticeMode && window.PracticeMode.open) {
        console.log('🔧 Initializing practice-mode.js system');
        window.PracticeMode.open();
    } else {
        console.error('❌ PracticeMode not available - check if practice-mode.js loaded');
    }
}
*/

function setupPracticeEventListeners() {
    if (!canvas) {
        console.error('❌ Cannot setup practice event listeners - canvas not found');
        return;
    }
    
    console.log('🔧 Setting up practice-specific event listeners');
    
    // Add a test click listener specifically for practice mode
    canvas.addEventListener('click', function practiceClickTest(e) {
        if (practiceMode.isActive) {
            console.log('🔍 DEBUG: Practice mode canvas CLICK detected!', {
                clientX: e.clientX,
                clientY: e.clientY,
                offsetX: e.offsetX,
                offsetY: e.offsetY,
                target: e.target.tagName,
                practiceActive: practiceMode.isActive,
                pointerEvents: canvas.style.pointerEvents
            });
        }

        // Close menu dropdown if it's open (for any mode)
        if (window.menuState && window.menuState.isExpanded) {
            console.log('🔵 Practice mode canvas clicked - closing menu dropdown');
            window.collapseMenu();
        }
    });
    
    // Add specific mousemove test for practice mode
    canvas.addEventListener('mousemove', function practiceMousemoveTest(e) {
        if (practiceMode.isActive && practiceMode.practiceIsDrawingVector) {
            console.log('🔍 DEBUG: Practice mode canvas MOUSEMOVE detected during drag!', {
                clientX: e.clientX,
                clientY: e.clientY,
                isDrawing: practiceMode.practiceIsDrawingVector
            });
            // Ensure event isn't prevented during practice mode drags
            e.stopPropagation();
        }
    });
    
    // Add a test mousedown listener specifically for practice mode
    canvas.addEventListener('mousedown', function practiceMousedownTest(e) {
        if (window.isPracticeMode) {
            console.log('🔍 DEBUG: Practice mode canvas MOUSEDOWN detected!', {
                clientX: e.clientX,
                clientY: e.clientY,
                offsetX: e.offsetX,
                offsetY: e.offsetY,
                button: e.button,
                practiceActive: practiceMode.isActive,
                isInteractionEnabled: isInteractionEnabled
            });
        }
    });
    
    // CRITICAL: Re-attach the main vector event handlers for practice mode
    // Remove existing listeners first to avoid duplicates
    canvas.removeEventListener('mousedown', handleVectorStart);
    canvas.removeEventListener('mousemove', handleVectorDrag);
    canvas.removeEventListener('mouseup', handleVectorEnd);
    
    // Re-attach with fresh listeners
    canvas.addEventListener('mousedown', handleVectorStart);
    canvas.addEventListener('mousemove', handleVectorDrag);
    canvas.addEventListener('mouseup', handleVectorEnd);
    
    // TEMP: Add very simple drag test - completely separate from main logic
    let tempDragStart = null;
    canvas.addEventListener('mousedown', function tempDragTest(e) {
        if (window.isPracticeMode) {
            tempDragStart = { x: e.clientX, y: e.clientY };
            console.log('🔍 TEMP: Mouse down for drag test', tempDragStart);
        }
    });
    
    canvas.addEventListener('mousemove', function tempDragMoveTest(e) {
        if (isPracticeMode && tempDragStart) {
            const dx = e.clientX - tempDragStart.x;
            const dy = e.clientY - tempDragStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            console.log('🔍 TEMP: Mouse move during drag', { distance, current: { x: e.clientX, y: e.clientY } });
        }
    });
    
    canvas.addEventListener('mouseup', function tempDragEndTest(e) {
        if (practiceMode.isActive && tempDragStart) {
            const dx = e.clientX - tempDragStart.x;
            const dy = e.clientY - tempDragStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            console.log('🔍 TEMP: Mouse up - total drag distance', distance);
            tempDragStart = null;
        }
    });
    
    console.log('✅ Practice-specific event listeners attached');
    console.log('🔧 Vector event handlers re-attached for practice mode');
}

function exitPracticeMode() {
    // CRITICAL: Deactivate the SimplePracticeMode instance 
    if (window.SimplePracticeMode && window.SimplePracticeMode.isActive) {
        console.log('🎯 Deactivating SimplePracticeMode instance...');
        window.SimplePracticeMode.isActive = false;
        if (window.SimplePracticeMode.close) {
            window.SimplePracticeMode.close();
        }
        console.log('✅ SimplePracticeMode instance deactivated');
    }
    
    // Hide practice mode UI elements
    document.getElementById('practiceModeIndicator').style.display = 'none';
    document.getElementById('practiceNavigation').style.display = 'none';

    // Desktop full-screen mode: Reset positioning when exiting practice mode
    if (window.innerWidth >= 769) {
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        const buttonsContainer = document.getElementById('buttonsContainer');

        if (fixedPercentageArea) {
            fixedPercentageArea.style.removeProperty('margin-top');
            fixedPercentageArea.style.removeProperty('position');
        }

        if (buttonsContainer) {
            buttonsContainer.style.removeProperty('margin-top');
            buttonsContainer.style.removeProperty('margin-bottom');
            buttonsContainer.style.removeProperty('position');
        }

        console.log('✅ Desktop: Reset practice mode element positioning');
    }
    
    // AGGRESSIVE: Remove floating navigation created by setupSimplePracticeButtons
    const floatingNav = document.getElementById('floatingPracticeNav');
    if (floatingNav) {
        floatingNav.remove();
        console.log('🚀 AGGRESSIVE: Cleaned up floating practice navigation on exit');
    }
    
    // Clear practice results from percentage area
    const percentageArea = document.getElementById('fixedPercentageArea');
    if (percentageArea) percentageArea.innerHTML = '';
    
    // Show daily game UI elements
    const progressDisplay = document.getElementById('demoProgressDisplay');
    if (progressDisplay) progressDisplay.style.display = 'block';
    
    // Show welcome overlay and play buttons if they were visible before
    const welcomeOverlay = document.querySelector('.welcome-overlay');
    if (welcomeOverlay) welcomeOverlay.style.visibility = 'visible';
    
    const initialPlayButton = document.getElementById('initialPlayButton');
    if (initialPlayButton) initialPlayButton.style.visibility = 'visible';
    
    const welcomeOverlayById = document.getElementById('welcomeOverlay');
    if (welcomeOverlayById) welcomeOverlayById.style.visibility = 'visible';
    
    // CRITICAL: Restore daily game counters before exiting practice mode
    if (practiceMode.savedDailyGameCounters) {
        window.totalCutsMade = practiceMode.savedDailyGameCounters.totalCutsMade;
        window.cutsMadeThisShape = practiceMode.savedDailyGameCounters.cutsMadeThisShape;
        window.currentShapeNumber = practiceMode.savedDailyGameCounters.currentShapeNumber;
        window.currentAttemptNumber = practiceMode.savedDailyGameCounters.currentAttemptNumber;
        
        // Also restore local variables
        totalCutsMade = practiceMode.savedDailyGameCounters.totalCutsMade;
        cutsMadeThisShape = practiceMode.savedDailyGameCounters.cutsMadeThisShape;
        currentShapeNumber = practiceMode.savedDailyGameCounters.currentShapeNumber;
        currentAttemptNumber = practiceMode.savedDailyGameCounters.currentAttemptNumber;
        
        console.log('🔄 Restored daily game counters via exitPracticeMode:', practiceMode.savedDailyGameCounters);
        
        // CRITICAL: Restore daily mode buttons if game was in progress
        if (practiceMode.savedDailyGameCounters.cutsMadeThisShape > 0) {
            // Determine what button should be shown based on restored state
            setTimeout(() => {
                if (gameState === 'awaiting_choice' || gameState === 'finished') {
                    createProgressionButton();
                    console.log('🔄 Restored daily mode button after exiting practice mode');
                }
            }, 100);
        }
    }
    
    // Restore daily game state and canvas content
    if (practiceMode.savedDailyGameState) {
        setGameState(practiceMode.savedDailyGameState.gameState);
        currentAttempts = practiceMode.savedDailyGameState.currentAttempts;
        currentShapeNumber = practiceMode.savedDailyGameState.currentShapeNumber;
        currentAttemptNumber = practiceMode.savedDailyGameState.currentAttemptNumber;
        
        // Restore canvas content
        if (practiceMode.savedDailyGameState.canvasContent) {
            const img = new Image();
            img.onload = function() {
                // Skip rendering if we just canceled a line drawing to prevent visual corruption
                if (window.canceledLineDrawing) {
                    console.log('🚫 Skipping practice mode canvas restoration due to recent cancel - preventing visual corruption');
                    return;
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = practiceMode.savedDailyGameState.canvasContent;
        } else {
            // If no saved canvas content, redraw the welcome screen
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
        }
        
        // Restore interaction state - but check daily mode cut limits first (1 cut per shape)
        const shouldEnableInteraction = practiceMode.savedDailyGameState.gameState === 'cutting' &&
                                       (!isDailyMode || window.cutsMadeThisShape < 1);

        if (isDailyMode && window.cutsMadeThisShape >= 1) {
            console.log('🚫 EXIT PRACTICE: Daily mode shape has reached cut limit, keeping canvas disabled');
            setInteractionEnabled(false);
            canvas.style.pointerEvents = 'none';
        } else {
            setInteractionEnabled(shouldEnableInteraction);
        }
    }
    
    practiceMode.isActive = false;
    practiceMode.savedDailyGameState = null;
    practiceMode.savedDailyGameCounters = null;

    // CRITICAL: Restore daily mode instruction after exiting practice mode
    if (window.gameState === 'cutting' || window.gameState === 'playing') {
        // Get the appropriate initial instruction for the current mechanic
        const mechanicName = getCurrentMechanicName();
        const initialInstruction = getInitialInstruction(mechanicName);
        if (window.updateInstructionText) {
            window.updateInstructionText(initialInstruction);
            console.log('📝 Restored daily mode instruction after exiting practice:', initialInstruction);
        }
    } else if (window.gameState === 'awaiting_choice' || window.gameState === 'finished') {
        // If there was a previous attempt, restore its commentary
        if (currentAttempts && currentAttempts.length > 0) {
            const lastAttempt = currentAttempts[currentAttempts.length - 1];
            if (lastAttempt && lastAttempt.commentary && window.updateInstructionText) {
                window.updateInstructionText(lastAttempt.commentary, true); // true for bold
                console.log('📝 Restored daily mode commentary after exiting practice:', lastAttempt.commentary);
            }
        }
    }
}

// Clean function to return to Daily Shapes from practice mode using SimpleRefresh system
function returnToDailyShapes() {
    console.log('🎯 Exiting practice mode and returning to Daily Shapes');
    
    // Reset practice mode flag and re-enable daily mode
    isPracticeMode = false;
    window.isPracticeMode = false; // Reset global for mechanics to access
    isDailyMode = true;
    
    // Hide account dropdown
    const accountDropdown = document.getElementById('accountDropdown');
    if (accountDropdown) accountDropdown.style.display = 'none';
    
    // Hide practice mode UI elements immediately
    document.getElementById('practiceModeIndicator').style.display = 'none';
    document.getElementById('practiceNavigation').style.display = 'none';

    // Desktop full-screen mode: Reset positioning when exiting practice mode
    if (window.innerWidth >= 769) {
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        const buttonsContainer = document.getElementById('buttonsContainer');

        if (fixedPercentageArea) {
            fixedPercentageArea.style.removeProperty('margin-top');
            fixedPercentageArea.style.removeProperty('position');
        }

        if (buttonsContainer) {
            buttonsContainer.style.removeProperty('margin-top');
            buttonsContainer.style.removeProperty('margin-bottom');
            buttonsContainer.style.removeProperty('position');
        }

        console.log('✅ Desktop: Reset practice mode element positioning');
    }
    
    // AGGRESSIVE: Remove floating navigation created by setupSimplePracticeButtons
    const floatingNav = document.getElementById('floatingPracticeNav');
    if (floatingNav) {
        floatingNav.remove();
        console.log('🚀 AGGRESSIVE: Cleaned up floating practice navigation on return to daily');
    }
    
    // Clear practice results from percentage area
    const percentageArea = document.getElementById('fixedPercentageArea');
    if (percentageArea) percentageArea.innerHTML = '';
    
    // CRITICAL: Restore daily game counters before exiting practice mode
    if (practiceMode.savedDailyGameCounters) {
        window.totalCutsMade = practiceMode.savedDailyGameCounters.totalCutsMade;
        window.cutsMadeThisShape = practiceMode.savedDailyGameCounters.cutsMadeThisShape;
        window.currentShapeNumber = practiceMode.savedDailyGameCounters.currentShapeNumber;
        window.currentAttemptNumber = practiceMode.savedDailyGameCounters.currentAttemptNumber;
        
        // Also restore local variables
        totalCutsMade = practiceMode.savedDailyGameCounters.totalCutsMade;
        cutsMadeThisShape = practiceMode.savedDailyGameCounters.cutsMadeThisShape;
        currentShapeNumber = practiceMode.savedDailyGameCounters.currentShapeNumber;
        currentAttemptNumber = practiceMode.savedDailyGameCounters.currentAttemptNumber;
        
        console.log('🔄 Restored daily game counters:', practiceMode.savedDailyGameCounters);
        
        // CRITICAL: Restore daily mode buttons if game was in progress
        if (practiceMode.savedDailyGameCounters.cutsMadeThisShape > 0) {
            // Determine what button should be shown based on restored state
            setTimeout(() => {
                if (gameState === 'awaiting_choice' || gameState === 'finished') {
                    createProgressionButton();
                    console.log('🔄 Restored daily mode button via returnToDailyShapes');
                }
            }, 100);
        }
    }
    
    // Set practice mode as inactive
    practiceMode.isActive = false;
    practiceMode.savedDailyGameState = null;
    practiceMode.savedDailyGameCounters = null;

    // CRITICAL FIX: Clear the canvas before restoring to prevent shading persistence
    if (window.ctx && window.canvas) {
        window.ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('🧹 Cleared canvas before restoring daily game state');
    }

    // Use SimpleRefresh system to restore daily game state exactly as if page was refreshed
    if (window.SimpleRefresh && window.SimpleRefresh.restore) {
        console.log('🔄 Using SimpleRefresh to restore daily game state');
        const restoredState = window.SimpleRefresh.restore();

        // CRITICAL: Restore the canvas visual state including cut shading
        if (restoredState && restoredState.canvasData) {
            console.log('🎨 Restoring canvas with cut shading...');
            restoreVisualState(restoredState);
        }
        
        // Restore percentage displays if they exist
        if (restoredState && restoredState.currentAttempts && restoredState.currentAttempts.length > 0) {
            const lastAttempt = restoredState.currentAttempts[restoredState.currentAttempts.length - 1];
            if (lastAttempt.leftPercentage !== undefined && lastAttempt.rightPercentage !== undefined) {
                updatePercentageDisplays(lastAttempt.leftPercentage, lastAttempt.rightPercentage);
            }
        }
    } else {
        // Fallback: redirect to fresh game state
        console.log('⚠️ SimpleRefresh not available, falling back to fresh state');
        window.location.reload();
    }

    // CRITICAL: Check if we should restore completion view after returning from practice mode
    // This ensures that if the user entered practice mode from the completion state,
    // the competitions/archives buttons are restored when they return
    setTimeout(() => {
        if (window.dailyGameState && (window.dailyGameState.dayComplete || window.dailyGameState.isGameComplete)) {
            console.log('🏆 Daily game was completed - restoring completion view after practice mode');
            if (window.completeView && window.showCompletionView) {
                window.showCompletionView();
            } else if (window.completeView) {
                // Build and show completion model
                const currentDayStats = getDayStats(currentDay);
                if (currentDayStats && window.buildCompletionModel) {
                    const completionModel = window.buildCompletionModel(currentDayStats);
                    window.completeView.show(completionModel);
                    console.log('✅ Completion view restored after practice mode exit');
                }
            }
        }
    }, 200); // Small delay to ensure daily mode is fully restored
}

function showPracticeResults(leftPercentage, rightPercentage) {
    // Calculate score using existing scoring system exactly
    const score = window.ScoringSystem.calculateCutScore(leftPercentage);

    // Format score: show "100/100" for perfect scores, "XX.X/100" for others
    const formattedScore = score === 100 ? '100' : score.toFixed(1);

    // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
    const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
    const splitFontSize = isSmallPhone ? 35 : 46;

    // Adjust score margin based on device size
    const isSpecificMobile = (window.innerWidth === 430 && window.innerHeight === 805) ||
                             (window.innerWidth === 390 && window.innerHeight === 715) ||
                             (window.innerWidth === 412 && window.innerHeight === 785) ||
                             (window.innerWidth === 360 && window.innerHeight === 630);

    // Add spacing for larger phones (e.g., Nothing 2A 413x815) to prevent score text collision with split display
    const isLargerPhone = window.innerWidth >= 400 && window.innerWidth <= 450 && window.innerHeight >= 700;

    const scoreMarginTop = isSpecificMobile ? '3px' : (isLargerPhone ? '8px' : '-17px');
    console.log('📊 showPracticeResults (line 20355) - Device:', window.innerWidth, 'x', window.innerHeight, 'isSpecificMobile:', isSpecificMobile, 'isLargerPhone:', isLargerPhone, 'scoreMarginTop:', scoreMarginTop);

    // Use existing fixedPercentageArea - practice mode shows only split display
    // Dark grey color for practice mode consistency, NO SCORE
    const percentageArea = document.getElementById('fixedPercentageArea');

    percentageArea.innerHTML = `
        <div style="text-align: center; margin: 16px 0; line-height: 1.5;">
            <div class="split-display-large" style="display: inline-block; white-space: nowrap;">
                <span style="color: #666666; font-weight: bold; font-size: ${splitFontSize}px;">${leftPercentage.toFixed(1)}%</span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span><span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px;">${rightPercentage.toFixed(1)}%</span>
            </div>
        </div>
    `;
}

// Practice mode navigation handlers
function setupPracticeNavigation() {
    const leftBtn = document.getElementById('practiceLeftBtn');
    const rightBtn = document.getElementById('practiceRightBtn');
    const randomBtn = document.getElementById('practiceRandomBtn');
    const resetBtn = document.getElementById('practiceResetBtn');
    
    // Remove existing listeners to prevent duplicates when called multiple times
    if (leftBtn) leftBtn.replaceWith(leftBtn.cloneNode(true));
    if (rightBtn) rightBtn.replaceWith(rightBtn.cloneNode(true));
    if (randomBtn) randomBtn.replaceWith(randomBtn.cloneNode(true));
    if (resetBtn) resetBtn.replaceWith(resetBtn.cloneNode(true));
    
    // Re-get elements after replacement
    const newLeftBtn = document.getElementById('practiceLeftBtn');
    const newRightBtn = document.getElementById('practiceRightBtn');
    const newRandomBtn = document.getElementById('practiceRandomBtn');
    const newResetBtn = document.getElementById('practiceResetBtn');
    
    if (newLeftBtn) {
        newLeftBtn.addEventListener('click', async () => {
            // Use new practice-mode.js class system only
            if (window.practiceMode && window.practiceMode.navigateShape) {
                await window.practiceMode.navigateShape('left');
            }
        });
    }
    
    if (newRightBtn) {
        newRightBtn.addEventListener('click', async () => {
            // Use new practice-mode.js class system only
            if (window.practiceMode && window.practiceMode.navigateShape) {
                await window.practiceMode.navigateShape('right');
            }
        });
    }
    
    if (newRandomBtn) {
        newRandomBtn.addEventListener('click', async () => {
            // Use new practice-mode.js class system only
            if (window.practiceMode && window.practiceMode.navigateShape) {
                await window.practiceMode.navigateShape('random');
            }
        });
    }
    
    if (newResetBtn) {
        newResetBtn.addEventListener('click', async () => {
            // Use new practice-mode.js class system only - reload current shape
            if (window.practiceMode && window.practiceMode.loadCurrentShape) {
                await window.practiceMode.loadCurrentShape();
            }
        });
    }
}

function updatePracticeNavigationButtons() {
    // Update both original buttons (if they exist) and floating buttons
    const leftBtn = document.getElementById('practiceLeftBtn');
    const rightBtn = document.getElementById('practiceRightBtn');
    const floatingLeftBtn = document.getElementById('floatingPracticeLeft');
    const floatingRightBtn = document.getElementById('floatingPracticeRight');
    
    // With wrap-around behavior, buttons are always enabled
    if (leftBtn) {
        leftBtn.disabled = false;
    }
    
    if (rightBtn) {
        rightBtn.disabled = false;
    }
    
    if (floatingLeftBtn) {
        floatingLeftBtn.disabled = false;
    }
    
    if (floatingRightBtn) {
        floatingRightBtn.disabled = false;
    }
}


function setupSimplePracticeButtons() {
    // DISABLED: This function conflicts with practice-mode.js navigation
    if (window.OLD_PRACTICE_NAVIGATION_DISABLED) {
        console.log('⚠️ setupSimplePracticeButtons disabled - using practice-mode.js system');
        return;
    }

    console.log('🚀 AGGRESSIVE: Creating completely new practice navigation directly in body...');

    // Remove any existing floating navigation
    const existingFloating = document.getElementById('floatingPracticeNav');
    if (existingFloating) {
        existingFloating.remove();
    }
    
    // Insert navigation directly into the buttons-below-canvas container to match original positioning
    const buttonsContainer = document.querySelector('.buttons-below-canvas') || document.getElementById('buttonsContainer');
    
    if (buttonsContainer) {
        // Create practice navigation with exact original styling
        const floatingNav = document.createElement('div');
        floatingNav.id = 'floatingPracticeNav';
        floatingNav.className = 'practice-navigation';
        floatingNav.innerHTML = `
            <button id="floatingPracticeLeft" class="practice-nav-btn" title="Previous Shape">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M16 20L8 12L16 4" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button id="floatingPracticeRandom" class="practice-nav-btn" title="Random Shape">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <text x="12" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="black">?</text>
                </svg>
            </button>
            <button id="floatingPracticeRight" class="practice-nav-btn" title="Next Shape">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M8 4L16 12L8 20" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
        
        // Apply maximum visibility styles to container to override any hiding
        floatingNav.style.cssText = `
            display: flex !important;
            gap: 12px !important;
            justify-content: center !important;
            margin: 10px 0 !important;
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 100 !important;
            pointer-events: auto !important;
        `;
        
        // Apply neobrutalist circular button styling to each button
        setTimeout(() => {
            const buttons = floatingNav.querySelectorAll('.practice-nav-btn');
            buttons.forEach(btn => {
                btn.style.cssText = `
                    width: 44px !important;
                    height: 44px !important;
                    border-radius: 50% !important;
                    border: 3px solid #000000 !important;
                    background-color: #ffffff !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    box-shadow: 3px 3px 0px #000000 !important;
                    position: relative !important;
                `;
                
                // Disable the CSS ::before pseudo-element that creates black squares
                const style = document.createElement('style');
                style.textContent = `
                    #${btn.id}::before,
                    #${btn.id}::after {
                        display: none !important;
                        content: none !important;
                    }
                `;
                document.head.appendChild(style);
                
                // Force SVG styling to override any CSS inheritance
                const svg = btn.querySelector('svg');
                const paths = btn.querySelectorAll('path');
                if (svg) {
                    svg.style.cssText = `
                        width: 24px !important;
                        height: 24px !important;
                        display: block !important;
                        pointer-events: none !important;
                    `;
                }
                paths.forEach(path => {
                    path.style.cssText = `
                        fill: none !important;
                        stroke: black !important;
                        stroke-width: 2.5px !important;
                        stroke-linecap: round !important;
                        stroke-linejoin: round !important;
                        pointer-events: none !important;
                    `;
                });
                
                // Hover and active states
                btn.addEventListener('mouseenter', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(-2px, -2px)';
                        btn.style.boxShadow = '5px 5px 0px #000000';
                    }
                });
                
                btn.addEventListener('mouseleave', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(0, 0)';
                        btn.style.boxShadow = '3px 3px 0px #000000';
                    }
                });
                
                btn.addEventListener('mousedown', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(1px, 1px)';
                        btn.style.boxShadow = '2px 2px 0px #000000';
                    }
                });
                
                btn.addEventListener('mouseup', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(-2px, -2px)';
                        btn.style.boxShadow = '5px 5px 0px #000000';
                    }
                });
            });
        }, 0);
        
        // Append to buttons container to maintain proper layout position
        buttonsContainer.appendChild(floatingNav);
        
        // Force the buttons container to be visible too
        buttonsContainer.style.setProperty('opacity', '1', 'important');
        buttonsContainer.style.setProperty('visibility', 'visible', 'important');
        buttonsContainer.style.setProperty('display', 'flex', 'important');
        
        console.log('🚀 AGGRESSIVE: Practice navigation inserted into buttons container with original styling');
    } else {
        // Fallback: create floating nav if buttons container not found
        const floatingNav = document.createElement('div');
        floatingNav.id = 'floatingPracticeNav';
        floatingNav.className = 'practice-navigation';
        floatingNav.innerHTML = `
            <button id="floatingPracticeLeft" class="practice-nav-btn" title="Previous Shape">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M16 20L8 12L16 4" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button id="floatingPracticeRandom" class="practice-nav-btn" title="Random Shape">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <text x="12" y="17" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="black">?</text>
                </svg>
            </button>
            <button id="floatingPracticeRight" class="practice-nav-btn" title="Next Shape">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M8 4L16 12L8 20" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
        
        floatingNav.style.cssText = `
            position: fixed !important;
            bottom: 100px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 100 !important;
            display: flex !important;
            gap: 12px !important;
            justify-content: center !important;
            margin: 10px 0 !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
        `;
        
        // Apply neobrutalist circular button styling to each button (fallback)
        setTimeout(() => {
            const buttons = floatingNav.querySelectorAll('.practice-nav-btn');
            buttons.forEach(btn => {
                btn.style.cssText = `
                    width: 44px !important;
                    height: 44px !important;
                    border-radius: 50% !important;
                    border: 3px solid #000000 !important;
                    background-color: #ffffff !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    box-shadow: 3px 3px 0px #000000 !important;
                    position: relative !important;
                `;
                
                // Disable the CSS ::before pseudo-element that creates black squares
                const style = document.createElement('style');
                style.textContent = `
                    #${btn.id}::before,
                    #${btn.id}::after {
                        display: none !important;
                        content: none !important;
                    }
                `;
                document.head.appendChild(style);
                
                // Force SVG styling to override any CSS inheritance (fallback)
                const svg = btn.querySelector('svg');
                const paths = btn.querySelectorAll('path');
                if (svg) {
                    svg.style.cssText = `
                        width: 24px !important;
                        height: 24px !important;
                        display: block !important;
                        pointer-events: none !important;
                    `;
                }
                paths.forEach(path => {
                    path.style.cssText = `
                        fill: none !important;
                        stroke: black !important;
                        stroke-width: 2.5px !important;
                        stroke-linecap: round !important;
                        stroke-linejoin: round !important;
                        pointer-events: none !important;
                    `;
                });
                
                // Hover and active states for fallback buttons
                btn.addEventListener('mouseenter', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(-2px, -2px)';
                        btn.style.boxShadow = '5px 5px 0px #000000';
                    }
                });
                
                btn.addEventListener('mouseleave', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(0, 0)';
                        btn.style.boxShadow = '3px 3px 0px #000000';
                    }
                });
                
                btn.addEventListener('mousedown', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(1px, 1px)';
                        btn.style.boxShadow = '2px 2px 0px #000000';
                    }
                });
                
                btn.addEventListener('mouseup', () => {
                    if (!btn.disabled) {
                        btn.style.transform = 'translate(-2px, -2px)';
                        btn.style.boxShadow = '5px 5px 0px #000000';
                    }
                });
            });
        }, 0);
        
        document.body.appendChild(floatingNav);
        console.log('🚀 AGGRESSIVE: Fallback floating navigation created');
    }
    
    
    // Verify the floating nav is visible
    setTimeout(() => {
        const floatingNav = document.getElementById('floatingPracticeNav');
        if (floatingNav) {
            const rect = floatingNav.getBoundingClientRect();
            console.log('🔍 AGGRESSIVE: Practice nav rect:', rect);
            console.log('🔍 AGGRESSIVE: Practice nav visible?', rect.width > 0 && rect.height > 0);
            console.log('🔍 AGGRESSIVE: Practice nav computed style:', {
                display: window.getComputedStyle(floatingNav).display,
                visibility: window.getComputedStyle(floatingNav).visibility,
                opacity: window.getComputedStyle(floatingNav).opacity,
                zIndex: window.getComputedStyle(floatingNav).zIndex
            });
        }
    }, 100);
    
    // Hide the original navigation container to prevent conflicts
    const navContainer = document.getElementById('practiceNavigation');
    if (navContainer) {
        navContainer.style.display = 'none';
        console.log('🚀 AGGRESSIVE: Hidden original navigation container to prevent conflicts');
    }
    
    // Setup event handlers for floating navigation buttons
    const floatingLeftBtn = document.getElementById('floatingPracticeLeft');
    const floatingRightBtn = document.getElementById('floatingPracticeRight');
    const floatingRandomBtn = document.getElementById('floatingPracticeRandom');
    
    console.log('🚀 AGGRESSIVE: Setting up floating button event handlers...');
    
    // Left button - previous shape
    if (floatingLeftBtn) {
        floatingLeftBtn.addEventListener('click', () => {
            console.log('🚀 AGGRESSIVE: Floating left button clicked, isPracticeMode:', isPracticeMode, 'currentIndex:', currentPracticeShapeIndex);
            if (window.isPracticeMode) {
                // Wrap around to last shape if currently on first shape
                if (currentPracticeShapeIndex === 0) {
                    currentPracticeShapeIndex = practiceShapes.length - 1;
                } else {
                    currentPracticeShapeIndex--;
                }
                // Reset counters for unlimited cutting on new shape
                totalCutsMade = 0;
                cutsMadeThisShape = 0;
                attemptCount = 0;
                // Clear results display
                document.getElementById('fixedPercentageArea').innerHTML = '';
                loadSimplePracticeShape(practiceShapes[currentPracticeShapeIndex]);
                // Force canvas activation after shape change
                isShapeAnimationComplete = true;
                setInteractionEnabled(true);
                canvas.style.pointerEvents = 'auto';
            }
        });
    }
    
    // Right button - next shape
    if (floatingRightBtn) {
        floatingRightBtn.addEventListener('click', () => {
            console.log('🚀 AGGRESSIVE: Floating right button clicked, isPracticeMode:', isPracticeMode, 'currentIndex:', currentPracticeShapeIndex);
            if (window.isPracticeMode) {
                // Wrap around to first shape if currently on last shape
                if (currentPracticeShapeIndex === practiceShapes.length - 1) {
                    currentPracticeShapeIndex = 0;
                } else {
                    currentPracticeShapeIndex++;
                }
                // Reset counters for unlimited cutting on new shape
                totalCutsMade = 0;
                cutsMadeThisShape = 0;
                attemptCount = 0;
                // Clear results display
                document.getElementById('fixedPercentageArea').innerHTML = '';
                loadSimplePracticeShape(practiceShapes[currentPracticeShapeIndex]);
                // Force canvas activation after shape change
                isShapeAnimationComplete = true;
                setInteractionEnabled(true);
                canvas.style.pointerEvents = 'auto';
            }
        });
    }
    
    // Random button - random shape
    if (floatingRandomBtn) {
        floatingRandomBtn.addEventListener('click', () => {
            console.log('🚀 AGGRESSIVE: Floating random button clicked, isPracticeMode:', isPracticeMode);
            if (window.isPracticeMode) {
                currentPracticeShapeIndex = Math.floor(Math.random() * practiceShapes.length);
                // Reset counters for unlimited cutting on new shape
                totalCutsMade = 0;
                cutsMadeThisShape = 0;
                attemptCount = 0;
                // Clear results display
                document.getElementById('fixedPercentageArea').innerHTML = '';
                loadSimplePracticeShape(practiceShapes[currentPracticeShapeIndex]);
                // Force canvas activation after shape change
                isShapeAnimationComplete = true;
                setInteractionEnabled(true);
                canvas.style.pointerEvents = 'auto';
            }
        });
    }
    
    
    console.log('✅ Practice navigation buttons set up successfully with original styling and positioning');
    
    // Update button states for the new floating buttons
    updatePracticeNavigationButtons();
}

// DISABLED: Old practice navigation conflicts with practice-mode.js
// Initialize practice navigation on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // setupPracticeNavigation(); // DISABLED
    // Don't set up practice buttons at page load - only when entering practice mode
    // setupSimplePracticeButtons(); 
});

// Practice mode vector drawing helpers
function drawPracticeCurrentVector() {
    if (!practiceMode.practiceVectorStart || !practiceMode.practiceVectorEnd) return;
    
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(practiceMode.practiceVectorStart.x, practiceMode.practiceVectorStart.y);
    ctx.lineTo(practiceMode.practiceVectorEnd.x, practiceMode.practiceVectorEnd.y);
    ctx.stroke();
    ctx.restore();
}

function executePracticeCut() {
    if (!practiceMode.practiceVectorStart || !practiceMode.practiceVectorEnd || !practiceMode.practiceParsedShapes.length) {
        console.warn('Cannot execute practice cut - missing required data');
        return;
    }
    
    // Create practice vector
    practiceMode.practiceCurrentVector = {
        start: practiceMode.practiceVectorStart,
        end: practiceMode.practiceVectorEnd
    };
    
    // Create temporary canvas for pixel analysis
    const tempCanvas = document.createElement('canvas');
    const canvasSize = getCanvasSize();
    tempCanvas.width = canvasSize;
    tempCanvas.height = canvasSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Render shapes for pixel analysis
    renderShapesForPixelAnalysis(tempCtx, practiceMode.practiceParsedShapes);
    
    // Calculate areas
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;
    const areaResults = calculatePracticePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, practiceMode.practiceCurrentVector);

    // CRITICAL: Validate that the cut actually divided the shape (not 0/100 or 100/0)
    const leftRounded = Math.round(areaResults.leftPercentage);
    const rightRounded = Math.round(areaResults.rightPercentage);

    if ((leftRounded === 0 && rightRounded === 100) || (leftRounded === 100 && rightRounded === 0)) {
        console.log('🚫 INVALID PRACTICE CUT: Cut resulted in 0/100 split - not rendering');

        // Clear the vector
        practiceMode.practiceVectorStart = null;
        practiceMode.practiceVectorEnd = null;
        practiceMode.practiceCurrentVector = null;

        // Re-enable canvas for next attempt
        if (window.practiceMode && typeof window.practiceMode.enableCanvasInteraction === 'function') {
            window.practiceMode.enableCanvasInteraction();
        }

        // Show "Try again" message
        if (window.updateInstructionText) {
            window.updateInstructionText('Try again', true);
        }

        return;
    }

    // Render the cut result
    renderPracticeVectorCutResult(areaResults);

    // Show results
    showPracticeResults(areaResults.leftPercentage, areaResults.rightPercentage);
    
    console.log('🔪 Practice cut executed:', {
        left: areaResults.leftPercentage.toFixed(1) + '%',
        right: areaResults.rightPercentage.toFixed(1) + '%',
        score: window.ScoringSystem.calculateCutScore(areaResults.leftPercentage).toFixed(1)
    });
}

// Cache version: v=20250915k

