/**
 * GameEngine - Core game state machine for Daily Shapes on Reddit.
 * Manages game flow, canvas interaction, mechanic switching, and score tracking.
 *
 * States: 'initial' | 'cutting' | 'awaiting_choice' | 'finished'
 */

const GameEngine = {
    // =============================================
    // GAME STATE
    // =============================================

    /** Current game state */
    gameState: 'initial',

    /** Whether canvas interaction is enabled */
    isInteractionEnabled: false,

    /** Current shape index (0, 1, 2) */
    currentShapeIndex: 0,

    /** Current attempt for this shape (0 or 1) */
    currentAttempt: 0,

    /** Total cuts made this game */
    totalCutsMade: 0,

    /** Cuts made on the current shape */
    cutsMadeThisShape: 0,

    /** Scores per attempt: [[shape0_att0, shape0_att1], [shape1_att0, shape1_att1], ...] */
    shapeScores: [[], [], []],

    /** All cut scores in order */
    allCutScores: [],

    /** Whether the game has been completed today */
    isCompleted: false,

    /** Whether we're in practice mode */
    isPracticeMode: false,

    // =============================================
    // CONFIGURATION
    // =============================================

    /** Number of shapes per day */
    SHAPES_PER_DAY: 3,

    /** Max attempts per shape */
    MAX_ATTEMPTS: 2,

    /** Canvas element ID */
    CANVAS_ID: 'geoCanvas',

    /** Canvas size (internal resolution) */
    CANVAS_SIZE: 380,

    /** Per-shape shading colors (RGB) for daily mode */
    SHAPE_COLORS: [
        { r: 237, g: 174, b: 73 },  // Shape 1: Orange/gold (#EDAE49)
        { r: 209, g: 73, b: 91 },   // Shape 2: Red (#D1495B)
        { r: 0, g: 121, b: 140 },   // Shape 3: Teal (#00798C)
    ],

    /** Practice mode color */
    PRACTICE_COLOR: { r: 250, g: 176, b: 106 }, // Golden (#FAB06A)

    // =============================================
    // REFERENCES
    // =============================================

    /** Canvas element */
    canvas: null,

    /** Canvas 2D context */
    ctx: null,

    /** Current mechanic object */
    currentMechanic: null,

    /** Current mechanic name */
    currentMechanicName: '',

    /** Parsed shapes for current shape being cut */
    parsedShapes: [],

    /** All 3 daily shapes (GeoJSON strings) */
    dailyShapes: [],

    /** Init data from Devvit */
    initData: null,

    // =============================================
    // INITIALIZATION
    // =============================================

    /**
     * Initialize the game engine.
     * Called after Devvit bridge provides init data.
     */
    init(initData) {
        this.initData = initData;
        this.dailyShapes = initData.shapes || [];

        // Set up canvas
        this.canvas = document.getElementById(this.CANVAS_ID);
        if (!this.canvas) {
            console.error('Canvas element not found:', this.CANVAS_ID);
            return;
        }

        this.canvas.width = this.CANVAS_SIZE;
        this.canvas.height = this.CANVAS_SIZE;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Expose globals for mechanics compatibility
        window.canvas = this.canvas;
        window.ctx = this.ctx;
        window.parsedShapes = this.parsedShapes;
        window.gameState = this.gameState;
        window.isInteractionEnabled = this.isInteractionEnabled;
        window.isPracticeMode = false;

        // Set up global helper functions used by mechanics
        window.redrawCanvas = () => this.redrawCanvas();
        window.drawGrid = () => ShapeRenderer.drawGrid(this.ctx, this.CANVAS_SIZE);
        window.drawGridLinesOnly = () => ShapeRenderer.drawGridLinesOnly(this.ctx, this.CANVAS_SIZE);
        window.drawShapeOutlines = () => ShapeRenderer.drawShapeOutlines(this.ctx, this.parsedShapes);
        window.renderShapeForCutting = (shapes) => ShapeRenderer.renderShapeForCutting(this.ctx, shapes);
        window.getDailyCutShadingColor = () => this.getCurrentShapeColor();
        window.showTryAgainMessage = () => UIManager.showTryAgainMessage();
        window.hideTryAgainMessage = () => UIManager.hideTryAgainMessage();
        window.hideGoalCommentary = () => {};
        window.showAttemptResult = (left, right) => this.handleCutResult(left, right);
        window.handleCutAttempt = () => this.handleCutAttempt();
        window.handleShapeBasedCutAttempt = (areaResults) => {
            this.handleCutResult(areaResults.leftPercentage, areaResults.rightPercentage);
        };
        window.updateInstructionText = (text) => UIManager.updateInstruction(text);
        window.getDynamicInstruction = (mechanic, phase) => UIManager.getDynamicInstruction(mechanic, phase);
        window.getInitialInstruction = (mechanic) => UIManager.getInitialInstruction(mechanic);

        // Set up canvas event listeners
        this.setupEventListeners();

        // Check for existing progress
        if (initData.existingScore !== null && initData.existingScore !== undefined) {
            this.isCompleted = true;
            this.setGameState('finished');
            UIManager.showCompletionView(initData.existingScore, initData.leaderboard);
        } else if (initData.existingProgress) {
            this.restoreProgress(JSON.parse(initData.existingProgress));
        } else {
            // Draw initial state
            this.setGameState('initial');
            this.redrawCanvas();
            UIManager.showWelcomeScreen(initData);
        }
    },

    // =============================================
    // STATE MANAGEMENT
    // =============================================

    setGameState(newState) {
        this.gameState = newState;
        window.gameState = newState;
    },

    setInteractionEnabled(enabled) {
        this.isInteractionEnabled = enabled;
        window.isInteractionEnabled = enabled;

        if (this.canvas) {
            this.canvas.style.pointerEvents = enabled ? 'auto' : 'none';
        }
    },

    /** Get the shading color for the current shape */
    getCurrentShapeColor() {
        if (this.isPracticeMode) {
            return this.PRACTICE_COLOR;
        }
        return this.SHAPE_COLORS[this.currentShapeIndex] || this.SHAPE_COLORS[0];
    },

    // =============================================
    // GAME FLOW
    // =============================================

    /** Start the daily game */
    startGame() {
        this.currentShapeIndex = 0;
        this.currentAttempt = 0;
        this.totalCutsMade = 0;
        this.cutsMadeThisShape = 0;
        this.shapeScores = [[], [], []];
        this.allCutScores = [];
        this.isCompleted = false;
        this.isPracticeMode = false;
        window.isPracticeMode = false;

        this.loadShape(0);
    },

    /** Load a shape by index and set up the mechanic */
    loadShape(shapeIndex) {
        this.currentShapeIndex = shapeIndex;
        this.currentAttempt = 0;
        this.cutsMadeThisShape = 0;

        if (shapeIndex >= this.dailyShapes.length) {
            console.error('Shape index out of range:', shapeIndex, 'of', this.dailyShapes.length);
            return;
        }

        // Parse the GeoJSON
        const geojson = JSON.parse(this.dailyShapes[shapeIndex]);
        const parseResult = ShapeRenderer.parseGeometry(geojson);
        this.parsedShapes = parseResult.shapes;
        window.parsedShapes = this.parsedShapes;
        window.currentGeoJSON = geojson;

        // Initialize the mechanic
        this.initMechanic(this.initData.mechanic);

        // Update UI
        UIManager.updateProgress(shapeIndex, 0);
        UIManager.updateInstruction(UIManager.getInitialInstruction(this.currentMechanicName));

        // Set state and draw
        this.setGameState('cutting');
        this.setInteractionEnabled(true);
        this.redrawCanvas();
    },

    /** Initialize the cutting mechanic for today */
    initMechanic(mechanicName) {
        this.currentMechanicName = mechanicName;

        // Map mechanic name to object
        const mechanicMap = {
            'DefaultMechanic': window.DefaultMechanic,
            'HorizontalOnlyMechanic': window.HorizontalOnlyMechanic,
            'VerticalOnlyMechanic': window.VerticalOnlyMechanic,
            'DiagonalAscendingMechanic': window.DiagonalAscendingMechanic,
            'CircleCutMechanic': window.CircleCutMechanic,
            'ThreePointTriangleMechanic': window.ThreePointTriangleMechanic,
            'RotatingSquareMechanic': window.RotatingSquareMechanic,
            'RotatingShapeVectorMechanic': window.RotatingShapeVectorMechanic,
        };

        this.currentMechanic = mechanicMap[mechanicName] || window.DefaultMechanic;
        window.currentMechanic = this.currentMechanic;

        if (this.currentMechanic && this.currentMechanic.init) {
            this.currentMechanic.init();
        }
    },

    /** Handle result when a cut is completed by a mechanic */
    handleCutAttempt() {
        // The mechanic stores results in window.currentAreaResults
        const areaResults = window.currentAreaResults;
        if (!areaResults) {
            console.error('No area results available');
            return;
        }

        this.handleCutResult(areaResults.leftPercentage, areaResults.rightPercentage);
    },

    /** Process a cut result */
    handleCutResult(leftPercentage, rightPercentage) {
        if (this.isPracticeMode) {
            this.handlePracticeCutResult(leftPercentage, rightPercentage);
            return;
        }

        // Calculate score
        const score = Scoring.calculateCutScore(leftPercentage, rightPercentage);
        const isPerfect = Scoring.isPerfectCut(leftPercentage, rightPercentage);
        const commentary = Scoring.getCommentary(score);

        // Record the score
        this.shapeScores[this.currentShapeIndex].push(score);
        this.allCutScores.push(score);
        this.cutsMadeThisShape++;
        this.totalCutsMade++;
        this.currentAttempt++;

        // Disable interaction while showing result
        this.setInteractionEnabled(false);
        this.setGameState('awaiting_choice');

        // Show the result UI
        UIManager.showCutResult({
            leftPercentage,
            rightPercentage,
            score,
            isPerfect,
            commentary,
            shapeIndex: this.currentShapeIndex,
            attempt: this.currentAttempt,
            shapeColor: this.getCurrentShapeColor()
        });

        // Save progress
        this.saveProgress();

        // Determine next action
        if (this.currentAttempt < this.MAX_ATTEMPTS) {
            // More attempts available for this shape
            UIManager.showProgressionButton('Next Attempt', () => this.handleNextAttempt());
        } else if (this.currentShapeIndex < this.SHAPES_PER_DAY - 1) {
            // More shapes to go
            UIManager.showProgressionButton('Next Shape', () => this.handleNextShape());
        } else {
            // Game complete!
            setTimeout(() => this.completeGame(), 500);
        }
    },

    /** Advance to the next attempt on the same shape */
    handleNextAttempt() {
        UIManager.hideProgressionButton();
        UIManager.hideCutResult();

        // Re-initialize mechanic if needed
        if (this.currentMechanic && this.currentMechanic.reset) {
            this.currentMechanic.reset();
        }
        if (this.currentMechanic && this.currentMechanic.init) {
            this.currentMechanic.init();
        }

        // Restart rotation for rotating mechanic
        if (this.currentMechanic && this.currentMechanic.restartRotationForNextAttempt) {
            this.currentMechanic.restartRotationForNextAttempt();
        }

        UIManager.updateProgress(this.currentShapeIndex, this.currentAttempt);
        UIManager.updateInstruction(UIManager.getInitialInstruction(this.currentMechanicName));

        this.setGameState('cutting');
        this.setInteractionEnabled(true);
        this.redrawCanvas();
    },

    /** Advance to the next shape */
    handleNextShape() {
        UIManager.hideProgressionButton();
        UIManager.hideCutResult();

        this.loadShape(this.currentShapeIndex + 1);
    },

    /** Complete the game and show final scores */
    async completeGame() {
        this.isCompleted = true;
        this.setGameState('finished');
        this.setInteractionEnabled(false);

        const total = Scoring.calculateDayTotal(this.allCutScores);

        // Submit score to Devvit backend
        const result = await DevvitBridge.submitScore(
            this.initData.dayKey,
            this.allCutScores,
            total
        );

        // Show completion UI
        UIManager.showCompletionView(total, null, {
            shapeScores: this.shapeScores,
            allCutScores: this.allCutScores,
            rank: result?.rank,
            totalPlayers: result?.total,
            dayNumber: this.initData.dayNumber
        });
    },

    // =============================================
    // PRACTICE MODE
    // =============================================

    handlePracticeCutResult(leftPercentage, rightPercentage) {
        const score = Scoring.calculateCutScore(leftPercentage, rightPercentage);
        const commentary = Scoring.getCommentary(score);

        UIManager.showCutResult({
            leftPercentage,
            rightPercentage,
            score,
            isPerfect: Scoring.isPerfectCut(leftPercentage, rightPercentage),
            commentary,
            shapeIndex: 0,
            attempt: 0,
            shapeColor: this.PRACTICE_COLOR
        });

        // Re-enable interaction after a short delay
        setTimeout(() => {
            UIManager.hideCutResult();
            this.setInteractionEnabled(true);
            this.redrawCanvas();
        }, 2000);
    },

    // =============================================
    // CANVAS
    // =============================================

    /** Redraw the canvas (grid + current shape) */
    redrawCanvas() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE);

        // Draw grid (only when in game, not on initial screen)
        if (this.gameState !== 'initial') {
            ShapeRenderer.drawGrid(this.ctx, this.CANVAS_SIZE);
        }

        // Draw the current shape
        if (this.parsedShapes && this.parsedShapes.length > 0) {
            ShapeRenderer.renderShapeForCutting(this.ctx, this.parsedShapes);
        }
    },

    // =============================================
    // EVENT LISTENERS
    // =============================================

    setupEventListeners() {
        if (!this.canvas) return;

        // Remove old listeners via clone
        const newCanvas = this.canvas.cloneNode(true);
        this.canvas.parentNode.replaceChild(newCanvas, this.canvas);
        this.canvas = newCanvas;
        this.ctx = newCanvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Re-expose globals
        window.canvas = this.canvas;
        window.ctx = this.ctx;

        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this._handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this._handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._handleEnd(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this._handleStart(e);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this._handleMove(e);
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._handleEnd(e);
        }, { passive: false });
    },

    _handleStart(event) {
        if (!this.currentMechanic || !this.isInteractionEnabled) return;
        if (this.gameState !== 'cutting') return;

        // Only left-click for mouse
        if (event.button !== undefined && event.button !== 0) return;

        // Daily mode: limit cuts per shape
        if (!this.isPracticeMode && this.cutsMadeThisShape >= this.MAX_ATTEMPTS) return;

        const canvasRect = this.canvas.getBoundingClientRect();
        this.currentMechanic.handleStart(event, canvasRect);
    },

    _handleMove(event) {
        if (!this.currentMechanic || !this.isInteractionEnabled) return;
        if (this.gameState !== 'cutting') return;

        const canvasRect = this.canvas.getBoundingClientRect();
        this.currentMechanic.handleMove(event, canvasRect);
    },

    _handleEnd(event) {
        if (!this.currentMechanic) return;
        if (this.gameState !== 'cutting') return;

        this.currentMechanic.handleEnd(event);
    },

    // =============================================
    // PROGRESS SAVE/RESTORE
    // =============================================

    saveProgress() {
        if (!this.initData) return;

        DevvitBridge.saveProgress(this.initData.dayKey, {
            currentShapeIndex: this.currentShapeIndex,
            currentAttempt: this.currentAttempt,
            shapeScores: this.shapeScores,
            allCutScores: this.allCutScores,
            totalCutsMade: this.totalCutsMade,
        });
    },

    restoreProgress(progress) {
        if (!progress) return;

        this.currentShapeIndex = progress.currentShapeIndex || 0;
        this.currentAttempt = progress.currentAttempt || 0;
        this.shapeScores = progress.shapeScores || [[], [], []];
        this.allCutScores = progress.allCutScores || [];
        this.totalCutsMade = progress.totalCutsMade || 0;
        this.cutsMadeThisShape = this.currentAttempt;

        // Reload the current shape
        this.loadShape(this.currentShapeIndex);
    }
};

window.GameEngine = GameEngine;
