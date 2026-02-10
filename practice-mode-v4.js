/**
 * Practice Mode Module for Daily Shapes v4.0 - Migration Compatible
 * Enhanced with Supabase bucket integration, date restrictions, and caching
 */

class PracticeModeV4 {
    constructor() {
        this.isActive = false;
        this.currentShapeIndex = 0;
        this.practiceShapes = [];
        this.currentCutData = null;
        this.hasActiveCut = false;
        this.shapeCache = new Map(); // Cache for loaded shapes
        this.availableDates = []; // Available practice dates (yesterday and older)
        console.log('🎯 Practice Mode v4.0 initialized with Supabase integration');
    }

    /**
     * Check if user is authenticated
     */
    checkUserAuthentication() {
        // Method 1: Check AuthManager
        if (window.AuthManager && window.AuthManager.isLoggedIn && window.AuthManager.isLoggedIn()) {
            return true;
        }

        // Method 2: Check Supabase token in localStorage
        const supabaseToken = localStorage.getItem('sb-zxrfhumifazjxgikltkz-auth-token');
        if (supabaseToken) {
            try {
                const tokenData = JSON.parse(supabaseToken);
                if (tokenData && tokenData.access_token) {
                    return true;
                }
            } catch (e) {
                // Invalid token format
            }
        }

        // Method 3: Check auth-service state
        if (window.AuthService && window.AuthService.isLoggedIn && window.AuthService.isLoggedIn()) {
            return true;
        }

        return false;
    }

    /**
     * Convert date to YYMMDD format
     */
    formatDateToYYMMDD(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        const year = d.getFullYear().toString().slice(-2);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Get yesterday's date in YYMMDD format
     */
    getYesterdayYYMMDD() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this.formatDateToYYMMDD(yesterday);
    }

    /**
     * Generate available practice dates (yesterday and older only)
     */
    generateAvailableDates() {
        const dates = [];
        const today = new Date();

        // Generate dates from yesterday going backwards 30 days
        for (let i = 1; i <= 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(this.formatDateToYYMMDD(date));
        }

        this.availableDates = dates;
        console.log(`📅 Generated ${dates.length} available practice dates (yesterday and older)`);
        return dates;
    }

    /**
     * Load available practice shapes with date restrictions
     */
    async loadPracticeShapes() {
        console.log('📁 Loading practice shapes with date restrictions...');

        // Generate available dates first
        this.generateAvailableDates();

        // Build practice shapes list for available dates
        this.practiceShapes = [];

        // Add shapes for each available date
        for (const dateStr of this.availableDates) {
            for (let shapeNum = 1; shapeNum <= 3; shapeNum++) {
                const shapeName = `${dateStr}-${String(shapeNum).padStart(2, '0')}`;
                this.practiceShapes.push({
                    name: shapeName,
                    date: dateStr,
                    shapeNumber: shapeNum,
                    supabasePath: `${shapeName}.geojson`,
                    cached: false
                });
            }
        }

        console.log(`✅ Generated ${this.practiceShapes.length} practice shapes from ${this.availableDates.length} dates`);

        // Auto-select yesterday's shape 03 as default
        const yesterdayStr = this.getYesterdayYYMMDD();
        const defaultShapeIndex = this.practiceShapes.findIndex(
            shape => shape.date === yesterdayStr && shape.shapeNumber === 3
        );

        if (defaultShapeIndex >= 0) {
            this.currentShapeIndex = defaultShapeIndex;
            console.log(`🎯 Auto-selected yesterday's shape 03: ${this.practiceShapes[defaultShapeIndex].name}`);
        } else {
            // Fallback to most recent shape 03
            const mostRecentShape03 = this.practiceShapes.find(shape => shape.shapeNumber === 3);
            if (mostRecentShape03) {
                this.currentShapeIndex = this.practiceShapes.indexOf(mostRecentShape03);
                console.log(`🎯 Fallback to most recent shape 03: ${mostRecentShape03.name}`);
            }
        }

        return this.practiceShapes;
    }

    /**
     * Load shape from Supabase with caching
     */
    async loadShapeFromSupabase(shape) {
        const cacheKey = shape.name;

        // Check cache first
        if (this.shapeCache.has(cacheKey)) {
            console.log(`💾 Using cached shape: ${shape.name}`);
            return this.shapeCache.get(cacheKey);
        }

        try {
            const { data, error } = await supabaseClient.storage
                .from('Daily Shapes')
                .download(shape.supabasePath);

            if (error) {
                throw new Error(`Supabase error: ${error.message}`);
            }

            const text = await data.text();
            const geojsonData = JSON.parse(text);

            // Handle Sunday shapes - ignore rotation data in practice mode
            if (geojsonData.features) {
                geojsonData.features = geojsonData.features.filter(feature => {
                    // Filter out rotation center for Sunday shapes in practice mode
                    return !(feature.properties &&
                           feature.properties.type === 'reference' &&
                           feature.properties.corner === 'rotation-center');
                });
                console.log('🔄 Sunday shape rotation data filtered out for practice mode');
            }

            // Cache the loaded shape
            this.shapeCache.set(cacheKey, geojsonData);
            shape.cached = true;
            console.log(`💾 Cached shape: ${shape.name}`);

            return geojsonData;
        } catch (error) {
            console.error(`❌ Failed to load shape from Supabase: ${shape.name}`, error);
            throw error;
        }
    }

    /**
     * Load the current shape into the canvas
     */
    async loadCurrentShape() {
        const shape = this.practiceShapes[this.currentShapeIndex];
        console.log(`📐 Loading practice shape: ${shape.name}`);

        try {
            let geojsonData;

            // Try loading from Supabase first
            if (window.SupabaseConfig && window.SupabaseConfig.isReady()) {
                geojsonData = await this.loadShapeFromSupabase(shape);
            } else {
                // Fallback to local files (for development)
                console.log('⚠️ Supabase not available, using local fallback');
                const response = await fetch(`Practice Shapes/${shape.name}.geojson`);
                if (!response.ok) {
                    throw new Error(`Failed to load shape: ${response.status}`);
                }
                geojsonData = await response.json();
            }

            console.log(`✅ Practice shape loaded: ${shape.name}`);

            // Clear any previous data
            window.currentGeoJSON = null;
            window.parsedShapes = [];

            // Set the new shape data
            window.currentGeoJSON = geojsonData;

            // Use existing parseGeometry function if available, otherwise use our fallback
            if (window.parseGeometry && typeof window.parseGeometry === 'function') {
                console.log('🔧 Using main parseGeometry function');
                const parseResult = window.parseGeometry(geojsonData);

                if (parseResult && parseResult.shapes) {
                    window.parsedShapes = parseResult.shapes;
                    console.log(`📊 Main parser found ${window.parsedShapes.length} shapes`);
                } else {
                    console.warn('⚠️ Main parser did not return expected format, using fallback');
                    window.parsedShapes = [];
                }
            } else {
                // Fallback parsing
                console.log('🔧 Using fallback parseGeometry');
                if (geojsonData.features) {
                    geojsonData.features.forEach((feature, index) => {
                        if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                            const parsedShape = this.parseGeometry(feature.geometry);
                            if (parsedShape) {
                                window.parsedShapes.push(parsedShape);
                            }
                        }
                    });
                }
                console.log(`📊 Fallback parser found ${window.parsedShapes.length} shapes`);
            }

            // Ensure we have shapes to render
            if (!window.parsedShapes || window.parsedShapes.length === 0) {
                console.error('❌ No shapes parsed - practice mode cannot render');
                return;
            }

            // CRITICAL: Store original shapes for circle cutting mechanism
            this.originalShapes = JSON.parse(JSON.stringify(window.parsedShapes));
            console.log('🔒 Practice mode: Stored original shapes for cutting mechanism:', this.originalShapes.length);

            // Render the shape
            this.renderPracticeShape();

            // Enable canvas interaction
            this.enableCanvasInteraction();

            // Ensure practice instruction is shown for new shape
            setTimeout(() => {
                this.restorePracticeInstruction();
            }, 200);

        } catch (error) {
            console.error('❌ Error loading practice shape:', error);
        }
    }

    /**
     * Parse geometry using the same logic as daily mode
     */
    parseGeometry(geometry) {
        if (geometry.type === 'Polygon') {
            return {
                type: 'polygon',
                coordinates: geometry.coordinates[0] // Just the outer ring
            };
        } else if (geometry.type === 'MultiPolygon') {
            // Flatten MultiPolygon coordinates
            const coords = geometry.coordinates.flat(2);
            return {
                type: 'polygon',
                coordinates: coords
            };
        }
        return null;
    }

    /**
     * Create practice navigation buttons (left, random, right)
     */
    createNavigationButtons() {
        // Remove existing navigation if present
        const existingNav = document.getElementById('practiceNavigation');
        if (existingNav) {
            existingNav.remove();
        }

        // Create navigation container
        const navContainer = document.createElement('div');
        navContainer.id = 'practiceNavigation';
        navContainer.className = 'practice-navigation';
        navContainer.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 56px;
            margin: 8px 0 5px 0;
            position: relative;
            z-index: 100;
        `;

        // Button styles
        const buttonStyle = `
            border-radius: 50%;
            border: 2px solid #333;
            background: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            user-select: none;
        `;

        // Left button (<)
        const leftBtn = document.createElement('button');
        leftBtn.innerHTML = '<';
        leftBtn.setAttribute('style', buttonStyle + 'width: 32px !important; height: 32px !important; font-size: 16px !important; font-weight: bold !important;');
        leftBtn.title = 'Previous shape';
        leftBtn.onclick = () => this.navigateShape('left');

        // Random button (?)
        const randomBtn = document.createElement('button');
        randomBtn.innerHTML = '?';
        randomBtn.setAttribute('style', buttonStyle + 'width: 32px !important; height: 32px !important; font-size: 16px !important; font-weight: bold !important;');
        randomBtn.title = 'Random shape';
        randomBtn.onclick = () => this.navigateShape('random');

        // Right button (>)
        const rightBtn = document.createElement('button');
        rightBtn.innerHTML = '>';
        rightBtn.setAttribute('style', buttonStyle + 'width: 32px !important; height: 32px !important; font-size: 16px !important; font-weight: bold !important;');
        rightBtn.title = 'Next shape';
        rightBtn.onclick = () => this.navigateShape('right');

        // Add hover and click effects
        [leftBtn, randomBtn, rightBtn].forEach(btn => {
            let isPressed = false;
            let isTouchDevice = false;

            // Touch events for mobile
            btn.ontouchstart = (e) => {
                e.preventDefault();
                isTouchDevice = true;
                isPressed = true;
                btn.style.backgroundColor = '#f0f0f0';
                btn.style.transform = 'scale(0.95)';
            };

            btn.ontouchend = (e) => {
                e.preventDefault();
                btn.style.backgroundColor = 'white';
                btn.style.transform = 'scale(1)';
                isPressed = false;
                setTimeout(() => btn.click(), 10);
            };

            // Mouse events for desktop (only if not touch)
            btn.onmouseenter = () => {
                if (!isTouchDevice && !isPressed) {
                    btn.style.backgroundColor = '#f0f0f0';
                    btn.style.transform = 'scale(1.1)';
                }
            };
            btn.onmouseleave = () => {
                if (!isTouchDevice) {
                    btn.style.backgroundColor = 'white';
                    btn.style.transform = 'scale(1)';
                    isPressed = false;
                }
            };
            btn.onmousedown = () => {
                if (!isTouchDevice) {
                    isPressed = true;
                    btn.style.transform = 'scale(0.95)';
                }
            };
            btn.onmouseup = () => {
                if (!isTouchDevice) {
                    btn.style.transform = 'scale(1)';
                    isPressed = false;
                }
            };
        });

        navContainer.appendChild(leftBtn);
        navContainer.appendChild(randomBtn);
        navContainer.appendChild(rightBtn);

        return navContainer;
    }

    /**
     * Navigate between shapes
     */
    async navigateShape(direction) {
        console.log(`🔄 Navigating ${direction}`);

        // Clear any existing cut
        this.clearCutShading();

        const totalShapes = this.practiceShapes.length;

        switch (direction) {
            case 'left':
                this.currentShapeIndex = (this.currentShapeIndex - 1 + totalShapes) % totalShapes;
                break;
            case 'right':
                this.currentShapeIndex = (this.currentShapeIndex + 1) % totalShapes;
                break;
            case 'random':
                this.currentShapeIndex = Math.floor(Math.random() * totalShapes);
                break;
        }

        await this.loadCurrentShape();
    }

    /**
     * Get current day mechanic mapping - uses actual current day
     */
    getCurrentDayMechanic() {
        // Use actual current day of week for practice mode
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Convert Sunday (0) to 7 for mapping
        const currentDemoDay = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;

        // Day to mechanic mapping (PRACTICE MODE SPECIFIC)
        // NOTE: Sunday uses DefaultWithUndoMechanic instead of RotatingShapeVectorMechanic
        const dayMechanics = {
            1: 'DefaultWithUndoMechanic',      // Monday
            2: 'HorizontalOnlyMechanic',       // Tuesday
            3: 'DiagonalAscendingMechanic',    // Wednesday
            4: 'CircleCutMechanic',            // Thursday
            5: 'ThreePointTriangleMechanic',   // Friday
            6: 'RotatingSquareMechanic',       // Saturday
            7: 'DefaultWithUndoMechanic'       // Sunday (Practice mode uses Straight Line, not Rotating Vector)
        };

        const mechanicName = dayMechanics[currentDemoDay];

        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const dayName = dayNames[currentDayOfWeek];

        console.log(`🗓️ Practice mode: ${dayName} (day ${currentDemoDay}) → ${mechanicName}`);
        console.log(`🗓️ Practice mode using actual current day: ${currentDayOfWeek}`);

        return {
            day: currentDemoDay,
            dayName: dayName,
            mechanicName: mechanicName
        };
    }

    /**
     * Load the appropriate mechanic for today's practice mode
     */
    loadTodaysMechanic() {
        const dayInfo = this.getCurrentDayMechanic();
        const mechanicName = dayInfo.mechanicName;

        console.log(`🔧 Loading practice mechanic for ${dayInfo.dayName}: ${mechanicName}`);

        // Try to get the mechanic from global scope
        const MechanicObject = window[mechanicName];
        console.log(`🔧 DEBUG: MechanicObject found:`, !!MechanicObject, `type:`, typeof MechanicObject);

        if (MechanicObject && typeof MechanicObject === 'object') {
            // It's an object - use it directly
            window.currentMechanic = MechanicObject;

            // Also update the local currentMechanic variable that event handlers use
            if (typeof window.setCurrentMechanic === 'function') {
                window.setCurrentMechanic(MechanicObject);
                console.log(`🔧 PRACTICE MODE: Updated both local and global currentMechanic via helper function`);
            }

            // Initialize the mechanic if it has an init method
            if (typeof window.currentMechanic.init === 'function') {
                window.currentMechanic.init();
                console.log(`🔧 Practice mode: ${mechanicName} initialized`);
            }

            return true;
        } else {
            console.warn(`⚠️ Practice mode: ${mechanicName} not found, using fallback`);
            return false;
        }
    }

    /**
     * Render practice shape using existing canvas functionality
     */
    renderPracticeShape() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas || !window.parsedShapes.length) return;

        // Clear the canvas first to prevent stacking
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the grid first (essential for proper canvas display)
        if (window.drawGrid && typeof window.drawGrid === 'function') {
            window.drawGrid();
        }

        // Use existing shape rendering function if available
        if (window.renderShapeForCutting) {
            window.renderShapeForCutting(window.parsedShapes, false);
        } else {
            // Fallback rendering
            this.fallbackRenderShape(canvas);
        }

        console.log('🎨 Practice shape rendered with grid');
    }

    /**
     * Fallback shape rendering if main function not available
     */
    fallbackRenderShape(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid first for fallback rendering
        if (window.drawGrid && typeof window.drawGrid === 'function') {
            window.drawGrid();
        }

        // Simple shape rendering
        window.parsedShapes.forEach(shape => {
            if (shape.coordinates && shape.coordinates.length > 0) {
                ctx.beginPath();
                ctx.moveTo(shape.coordinates[0][0], shape.coordinates[0][1]);

                for (let i = 1; i < shape.coordinates.length; i++) {
                    ctx.lineTo(shape.coordinates[i][0], shape.coordinates[i][1]);
                }

                ctx.closePath();
                ctx.fillStyle = '#e6f3ff';
                ctx.fill();
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }

    /**
     * Enable canvas interaction for unlimited cutting
     */
    enableCanvasInteraction() {
        window.isInteractionEnabled = true;
        window.gameState = 'cutting';

        // Ensure canvas properties are set correctly
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            canvas.style.pointerEvents = 'auto';
            canvas.style.cursor = 'crosshair';
        }

        // Load today's mechanic dynamically
        const mechanicLoaded = this.loadTodaysMechanic();

        if (!mechanicLoaded) {
            // Fallback to basic cutting functionality
            console.warn('⚠️ No mechanic loaded, setting up basic cutting fallback');
            window.currentMechanic = {
                performVectorCut: function() {
                    console.log('🔧 Using fallback vector cut in practice mode');
                    if (window.performVectorCut) {
                        return window.performVectorCut();
                    }
                }
            };
        }

        console.log('✅ Canvas interaction enabled for practice mode:', {
            isInteractionEnabled: window.isInteractionEnabled,
            gameState: window.gameState,
            hasMechanic: !!window.currentMechanic,
            mechanicName: window.currentMechanic?.name || 'fallback'
        });
    }

    /**
     * Handle cut made in practice mode
     */
    handleCutMade(cutData) {
        console.log('✂️ Cut made in practice mode');

        // Store cut data
        this.currentCutData = cutData;
        this.hasActiveCut = true;

        console.log('✅ Practice cut processed with percentages:', cutData);

        // Show the split display immediately for practice mode
        this.showSplitDisplay(cutData);

        // Restore practice instruction after cut is processed
        setTimeout(() => {
            this.restorePracticeInstruction();
        }, 500);
    }

    /**
     * Show split display for practice mode cut
     */
    showSplitDisplay(cutData) {
        // Use existing split display creation - ALWAYS prefer main function
        if (window.createNewAttemptResult && typeof window.createNewAttemptResult === 'function') {
            console.log('🎯 Practice mode: Using main createNewAttemptResult function');
            // Call with percentages directly
            window.createNewAttemptResult(
                cutData.leftPercentage || 50,
                cutData.rightPercentage || 50
            );
        } else {
            console.warn('⚠️ Practice mode: Main createNewAttemptResult not available, using fallback');
            // Fallback split display
            this.createFallbackSplitDisplay(cutData);
        }
    }

    /**
     * Create fallback split display with correct colors for practice mode
     */
    createFallbackSplitDisplay(cutData) {
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        if (!fixedPercentageArea) return;

        // Detect iPhone SE (375x547) and use smaller font size (24% smaller = 35px)
        const isSmallPhone = window.innerWidth <= 375 && window.innerHeight <= 600;
        const splitFontSize = isSmallPhone ? 35 : 46;

        // Use practice mode colors that match the visual shading
        const yellowColor = 'rgb(250, 176, 106)';  // Match practice mode shading #FAB06A
        const greyColor = 'rgb(221, 221, 221)';    // Match practice mode right side

        fixedPercentageArea.innerHTML = `
            <div class="split-display-large">
                <span style="color: ${yellowColor}; font-weight: bold; font-size: ${splitFontSize}px;">${cutData.leftPercentage?.toFixed(1) || '50.0'}%</span>
                <span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span>
                <span style="color: ${greyColor}; font-weight: bold; font-size: ${splitFontSize}px;">${cutData.rightPercentage?.toFixed(1) || '50.0'}%</span>
            </div>
        `;

        fixedPercentageArea.style.display = 'block';
        fixedPercentageArea.style.visibility = 'visible';
    }

    /**
     * Clear cut shading and split display
     */
    clearCutShading() {
        console.log('🧹 CLEAR CUT SHADING CALLED for practice mode');

        // Don't clear if triangle cut is active - preserve triangle rendering
        if (window.triangleCutActive && window.triangleCutResult) {
            console.log('🔒 PROTECTION ACTIVATED: Preserving triangle cut result - not clearing');
            return;
        }

        // Always clear split display and score
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        if (fixedPercentageArea) {
            fixedPercentageArea.innerHTML = '';
        }

        // Clear any split display elements that might exist
        const splitDisplays = document.querySelectorAll('.split-display, .split-display-large, .attempt-result');
        splitDisplays.forEach(display => {
            display.innerHTML = '';
        });

        // Redraw the shape without shading
        this.renderPracticeShape();

        // Reset cut state
        this.currentCutData = null;
        this.hasActiveCut = false;

        // Restore practice mode instruction after clearing
        this.restorePracticeInstruction();

        console.log('🧹 Cut shading, split display, and score cleared');
    }

    /**
     * Restore practice mode instruction text
     */
    restorePracticeInstruction() {
        if (this.practiceInstruction && window.updateInstructionText) {
            setTimeout(() => {
                window.updateInstructionText(this.practiceInstruction);
                console.log('📝 Practice mode instruction restored:', this.practiceInstruction);
            }, 100);
        }
    }

    /**
     * Clear shape cache (for memory management)
     */
    clearCache() {
        this.shapeCache.clear();
        console.log('💾 Practice mode shape cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.shapeCache.size,
            keys: Array.from(this.shapeCache.keys()),
            availableDates: this.availableDates.length,
            totalShapes: this.practiceShapes.length
        };
    }

    /**
     * Hide daily mode specific elements
     */
    hideDailyModeElements() {
        const elementsToHide = [
            'demoProgressDisplay',
            'initialPlayButton',
            'nextShapeBtn',
            'nextAttemptBtn',
            'fixedButtonArea',
            'welcomeMessage',
            'initialPlayContainer',
            'goalDisplay',
            'progressCircles',
            'progressTracker',
            'completion-countdown',
            'welcomeOverlay'
        ];

        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
                element.style.pointerEvents = 'none';
                element.innerHTML = '';
            }
        });

        // Clear fixedPercentageArea content but keep it available for practice mode
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        if (fixedPercentageArea) {
            fixedPercentageArea.innerHTML = '';
            fixedPercentageArea.style.display = 'block';
        }

        console.log('🚫 Daily mode elements cleared for practice mode');
    }

    /**
     * Open practice mode
     */
    async open() {
        console.log('🎮 Opening practice mode v4.0...');

        // Check if user is logged in
        const isLoggedIn = this.checkUserAuthentication();
        if (!isLoggedIn) {
            alert('Please log in to access Practice mode');
            return;
        }

        // Save current daily game state
        if (window.SimpleRefresh && window.SimpleRefresh.save && window.isDailyMode && window.gameState !== 'initial') {
            console.log('💾 Saving daily game state before entering practice mode');
            window.SimpleRefresh.save();
        }

        this.isActive = true;

        // Set practice mode flags FIRST
        window.isPracticeMode = true;
        window.isDailyMode = false;
        window.gameState = 'cutting';
        window.isInteractionEnabled = true;

        console.log('🔄 Practice mode flags set:', { isPracticeMode: window.isPracticeMode, isDailyMode: window.isDailyMode, gameState: window.gameState });

        // Ensure canvas is visible and ready
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            canvas.style.display = 'block';
            canvas.style.pointerEvents = 'auto';
            console.log('🎨 Canvas made visible and interactive for practice mode');
        }

        // Hide daily mode specific elements
        this.hideDailyModeElements();

        // Load practice shapes with date restrictions
        await this.loadPracticeShapes();

        // Create and position navigation buttons
        const navigation = this.createNavigationButtons();
        console.log('🔘 Navigation buttons created');

        // Show practice mode indicator
        const indicator = document.getElementById('practiceModeIndicator');
        if (indicator) {
            indicator.style.display = 'block';
        }

        // Add navigation to DOM
        let canvasContainer = document.getElementById('canvas-container') ||
                            document.getElementById('canvasContainer') ||
                            document.querySelector('.canvas-container') ||
                            document.querySelector('#geoCanvas')?.parentElement;

        if (canvasContainer && navigation) {
            const parent = canvasContainer.parentNode;
            parent.insertBefore(navigation, canvasContainer.nextSibling);
            console.log('🔘 Navigation buttons added to DOM after canvas container');
        } else {
            // Fallback: add to main container or body
            console.warn('⚠️ Canvas container not found, adding navigation to main container');
            const mainContainer = document.querySelector('.main-container') ||
                                document.querySelector('main') ||
                                document.body;
            if (mainContainer && navigation) {
                mainContainer.appendChild(navigation);
                console.log('🔘 Navigation buttons added to fallback container');
            }
        }

        // Load the auto-selected shape (yesterday's shape 03 or fallback)
        await this.loadCurrentShape();

        // Make instruction area visible for practice mode
        const instructionArea = document.getElementById('instructionArea');
        if (instructionArea) {
            instructionArea.style.display = 'flex';
            instructionArea.style.visibility = 'visible';
            console.log('📝 Practice mode: Instruction area made visible');
        }

        // Set proper instruction text for practice mode based on current mechanic
        const dayInfo = this.getCurrentDayMechanic();
        if (window.getInitialInstruction && window.updateInstructionText && typeof window.updateInstructionText === 'function') {
            const initialInstruction = window.getInitialInstruction(dayInfo.mechanicName);
            window.updateInstructionText(initialInstruction);
            console.log('📝 Practice mode instruction set:', initialInstruction);

            // Store the instruction so we can restore it after cuts
            this.practiceInstruction = initialInstruction;
        } else {
            console.warn('⚠️ getInitialInstruction or updateInstructionText not available for practice mode');
        }

        console.log(`✅ Practice mode v4.0 opened with shape: ${this.practiceShapes[this.currentShapeIndex].name}`);
        console.log(`📅 Available practice dates: ${this.availableDates.length} (from ${this.availableDates[0]} to ${this.availableDates[this.availableDates.length - 1]})`);
        console.log(`💾 Shape cache size: ${this.shapeCache.size} shapes`);
    }

    /**
     * Close practice mode and restore daily mode
     */
    close() {
        console.log('🔚 Closing practice mode v4.0...');

        this.isActive = false;

        // Clear practice mode flags
        window.isPracticeMode = false;
        window.isDailyMode = true;

        // Hide practice mode indicator
        const indicator = document.getElementById('practiceModeIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }

        // Remove navigation
        const navigation = document.getElementById('practiceNavigation');
        if (navigation) {
            navigation.remove();
        }

        // Clear any active cuts
        this.clearCutShading();

        console.log(`✅ Practice mode v4.0 closed with cache stats: ${this.shapeCache.size} shapes cached`);
        console.log(`📊 Total shapes available: ${this.practiceShapes.length} across ${this.availableDates.length} dates`);

        // Optional: Clear cache on close to free memory
        // this.clearCache();
    }
}

// Initialize practice mode v4.0 and make it globally available
window.PracticeModeV4 = new PracticeModeV4();

// Hook into mouse and touch events to clear cuts when starting a new cut
document.addEventListener('mousedown', function(e) {
    if (window.isPracticeMode && window.PracticeModeV4 && window.PracticeModeV4.isActive && window.PracticeModeV4.hasActiveCut) {
        const canvas = document.getElementById('geoCanvas');
        if (canvas && e.target === canvas) {
            console.log('🧹 Practice mode v4.0: Clearing previous cut before new cut');
            window.PracticeModeV4.clearCutShading();
        }
    }
});

document.addEventListener('touchstart', function(e) {
    if (window.isPracticeMode && window.PracticeModeV4 && window.PracticeModeV4.isActive && window.PracticeModeV4.hasActiveCut) {
        const canvas = document.getElementById('geoCanvas');
        if (canvas && e.target === canvas) {
            console.log('🧹 Practice mode v4.0: Clearing previous cut before new cut (touch)');
            window.PracticeModeV4.clearCutShading();
        }
    }
});

console.log('✅ Practice Mode v4.0 module loaded with Supabase integration');