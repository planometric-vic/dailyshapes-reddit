/**
 * Practice Mode Module for Daily Shapes v4.0
 * Full practice mode implementation with unlimited cutting
 */

class PracticeMode {
    constructor() {
        this.isActive = false;
        this.currentShapeIndex = 0;
        this.practiceShapes = [];
        this.currentCutData = null;
        this.hasActiveCut = false;
        this.isNavigating = false;
        console.log('🎯 Practice Mode initialized');
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
     * Load available practice shapes from Supabase (excluding current date)
     */
    async loadPracticeShapes() {
        console.log('📁 Loading practice shapes from Supabase...');

        try {
            // Wait for Supabase integration to be ready
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds total
            while (!window.gameModeIntegration && attempts < maxAttempts) {
                console.log(`⏳ Waiting for Supabase integration... (attempt ${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            // Use the Supabase-integrated PracticeModeManager if available
            if (window.gameModeIntegration) {
                console.log('🔗 Supabase integration found, initializing PracticeModeManager');

                // Initialize practice mode if not already done
                if (!window.gameModeIntegration.practiceMode) {
                    console.log('🔄 Initializing practice mode in GameModeIntegration...');
                    await window.gameModeIntegration.initializePracticeMode();
                }

                const practiceModeManager = window.gameModeIntegration.practiceMode;

                // Initialize if not already done
                if (!practiceModeManager.isInitialized) {
                    await practiceModeManager.initialize();
                }

                // Get discovered available shapes from bucket
                const availableShapesList = practiceModeManager.getAvailableShapesList();
                this.practiceShapes = availableShapesList.map(shape => ({
                    name: shape.name,
                    dateStr: shape.dateStr,
                    shapeNumber: shape.shapeNumber,
                    shapeIndex: shape.index,
                    supabaseManager: practiceModeManager
                }));

                console.log(`✅ Found ${this.practiceShapes.length} practice shapes from Supabase bucket discovery`);
                return this.practiceShapes;

            } else {
                // Fallback to local shapes if Supabase integration not available
                console.log('⚠️ Supabase integration not available, using local shapes');
                console.log('🔍 Debug: window.gameModeIntegration =', window.gameModeIntegration);
                console.log('🔍 Debug: window.supabaseIntegrationActive =', window.supabaseIntegrationActive);

                this.practiceShapes = [
                    { name: '250828-01', file: 'Practice Shapes/250828-01.geojson' },
                    { name: '250828-02', file: 'Practice Shapes/250828-02.geojson' },
                    { name: '250828-03', file: 'Practice Shapes/250828-03.geojson' },
                    { name: '250829-01', file: 'Practice Shapes/250829-01.geojson' },
                    { name: '250829-02', file: 'Practice Shapes/250829-02.geojson' },
                    { name: '250829-03', file: 'Practice Shapes/250829-03.geojson' }
                ];

                console.log(`✅ Found ${this.practiceShapes.length} local practice shapes`);
                return this.practiceShapes;
            }

        } catch (error) {
            console.error('❌ Failed to load practice shapes from Supabase:', error);

            // Fallback to local shapes
            this.practiceShapes = [
                { name: '250828-01', file: 'Practice Shapes/250828-01.geojson' },
                { name: '250828-02', file: 'Practice Shapes/250828-02.geojson' },
                { name: '250828-03', file: 'Practice Shapes/250828-03.geojson' },
                { name: '250829-01', file: 'Practice Shapes/250829-01.geojson' },
                { name: '250829-02', file: 'Practice Shapes/250829-02.geojson' },
                { name: '250829-03', file: 'Practice Shapes/250829-03.geojson' }
            ];

            console.log(`✅ Using ${this.practiceShapes.length} fallback local shapes`);
            return this.practiceShapes;
        }
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

        // Button styles (size will be set separately with setProperty)
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
                e.preventDefault(); // Prevent mouse events
                isTouchDevice = true;
                isPressed = true;
                btn.style.backgroundColor = '#f0f0f0';
                btn.style.transform = 'scale(0.95)';
            };

            btn.ontouchend = (e) => {
                e.preventDefault(); // Prevent mouse events
                btn.style.backgroundColor = 'white';
                btn.style.transform = 'scale(1)';
                isPressed = false;
                // Trigger click manually for touch devices
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
     * CRITICAL: Clear all daily shape contamination before practice mode
     */
    clearDailyShapeContamination() {
        console.log('🧹 CRITICAL: Clearing all daily shape contamination before practice mode');

        // Clear all global shape storage
        window.parsedShapes = [];
        if (window.originalShapes) {
            window.originalShapes = [];
        }

        // Clear mechanic original shapes
        if (window.currentMechanic && window.currentMechanic.originalShapes) {
            console.log(`🧹 Clearing mechanic originalShapes (${window.currentMechanic.originalShapes.length} daily shapes)`);
            window.currentMechanic.originalShapes = [];
        }

        // Clear any cached geometry data
        if (window.shapeGeometry) {
            window.shapeGeometry = null;
        }

        // Clear current GeoJSON to prevent stale references
        if (window.currentGeoJSON) {
            window.currentGeoJSON = null;
        }

        console.log('✅ All daily shape contamination cleared');
    }

    /**
     * Setup practice mode canvas isolation
     */
    setupPracticeModeIsolation() {
        console.log('🎨 Setting up practice mode canvas isolation');

        // Store original redrawCanvas function
        if (window.redrawCanvas && !this.originalRedrawCanvas) {
            this.originalRedrawCanvas = window.redrawCanvas;
            console.log('🔒 Stored original redrawCanvas function');
        }

        // Override redrawCanvas for practice mode
        const self = this;
        window.redrawCanvas = function(ctx) {
            console.log('🎨 Practice mode: Using practice-specific canvas rendering');

            // Clear canvas first
            const canvas = document.getElementById('geoCanvas');
            if (canvas) {
                const context = ctx || canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);

                // Draw grid first
                if (window.drawGrid) {
                    window.drawGrid(context);
                }

                // Render practice shapes only
                self.renderPracticeShape();
            }
        };

        console.log('✅ Practice mode canvas isolation setup complete');
    }

    /**
     * CRITICAL: Continuously protect practice shapes from daily shape contamination
     */
    setupShapeProtection() {
        console.log('🛡️ Setting up aggressive shape protection for practice mode');

        // Override the renderShapesForPixelAnalysis function to add debugging
        if (!this.originalRenderShapesForPixelAnalysis && window.renderShapesForPixelAnalysis) {
            this.originalRenderShapesForPixelAnalysis = window.renderShapesForPixelAnalysis;
            window.renderShapesForPixelAnalysis = function(ctx, shapes, useDirectCoordinates = false) {
                console.log('🔍 PIXEL ANALYSIS DEBUG: renderShapesForPixelAnalysis called with:');
                console.log('   Shape count:', shapes?.length || 0);
                console.log('   isPracticeMode:', window.isPracticeMode);
                if (shapes && shapes.length > 0) {
                    console.log('   First shape vertices:', shapes[0]?.coordinates?.length || 'no coordinates');
                    if (shapes.length > 1) {
                        console.log('   Second shape vertices:', shapes[1]?.coordinates?.length || 'no coordinates');
                    }
                }
                console.log('   Stack trace:');
                console.trace();

                return self.originalRenderShapesForPixelAnalysis.call(this, ctx, shapes, useDirectCoordinates);
            };
            console.log('🔍 Installed renderShapesForPixelAnalysis debugging wrapper');
        }

        // Monitor and protect practice shapes every 100ms
        if (this.shapeProtectionInterval) {
            clearInterval(this.shapeProtectionInterval);
        }

        const self = this;
        this.shapeProtectionInterval = setInterval(() => {
            // CRITICAL: Only run protection if BOTH practice mode flags are true
            if (!window.isPracticeMode || !self.isActive) {
                // Stop protection if no longer in practice mode
                if (self.shapeProtectionInterval) {
                    clearInterval(self.shapeProtectionInterval);
                    self.shapeProtectionInterval = null;
                }
                return;
            }

            // Double check we're still in practice mode before modifying anything
            if (!window.isPracticeMode || !self.isActive) {
                return;
            }

            // Check if daily shapes have contaminated window.parsedShapes
            // Only check if we have practice shapes stored and they differ from current window.parsedShapes
            if (self.practiceParsedShapes && self.practiceParsedShapes.length > 0) {
                // Check if the shapes in window.parsedShapes are different from practice shapes
                let contaminated = false;

                if (!window.parsedShapes || window.parsedShapes.length !== self.practiceParsedShapes.length) {
                    contaminated = true;
                } else {
                    // Check if first shape reference differs (quick contamination check)
                    if (window.parsedShapes[0] !== self.practiceParsedShapes[0]) {
                        contaminated = true;
                    }
                }

                if (contaminated) {
                    console.log('🚨 CONTAMINATION DETECTED: Daily shapes found in window.parsedShapes during practice mode');
                    console.log('   Window shapes count:', window.parsedShapes?.length || 0);
                    console.log('   Practice shapes count:', self.practiceParsedShapes.length);
                    console.log('⚠️ Ignoring window.parsedShapes contamination - using practiceParsedShapes instead');

                    // DO NOT restore to window.parsedShapes - all code should use practiceParsedShapes
                    // The contamination is expected if daily mode ran first

                    // Fix mechanic shapes to use practice shapes
                    if (window.currentMechanic) {
                        window.currentMechanic.originalShapes = [...self.practiceParsedShapes];
                        console.log('🛡️ PROTECTION: Fixed mechanic originalShapes to use practice shapes');
                    }
                }
            }
        }, 100);

        console.log('🛡️ Shape protection monitoring started');
    }

    /**
     * Fallback function to restore saved daily shapes
     */
    restoreSavedDailyShapes() {
        if (this.savedDailyShapes && this.savedDailyShapes.length > 0) {
            window.parsedShapes = [...this.savedDailyShapes];
            console.log(`🔄 Fallback: Restored ${window.parsedShapes.length} daily shapes from saved data`);

            // Also restore mechanic original shapes
            if (window.currentMechanic) {
                window.currentMechanic.originalShapes = [...this.savedDailyShapes];
                console.log(`🔄 Fallback: Restored mechanic originalShapes for daily mode (${window.currentMechanic.originalShapes.length} shapes)`);
            }

            // Clear the saved shapes to prevent stale data
            this.savedDailyShapes = null;
        } else {
            console.warn('⚠️ No saved daily shapes to restore - daily mode may not render properly');
        }
    }

    /**
     * Clear all previous shape state before loading new shape
     */
    clearAllShapeState() {
        // Clear cut shading first
        this.clearCutShading();

        // Clear global parsed shapes for practice mode use
        // (Daily shapes should already be saved in open() method)
        if (window.parsedShapes) {
            window.parsedShapes = [];
            console.log('🧹 Cleared window.parsedShapes for new practice shape loading');
        }

        // Clear practice parsed shapes backup
        if (this.practiceParsedShapes) {
            this.practiceParsedShapes = [];
        }

        // Clear any cut data
        this.currentCutData = null;
        this.hasActiveCut = false;

        // Clear percentage display
        const percentageArea = document.getElementById('fixedPercentageArea');
        if (percentageArea) {
            percentageArea.innerHTML = '';
        }

        // DON'T clear canvas here - it will be re-rendered after new shape loads
        console.log('🧹 Cleared previous shape state (canvas will be re-rendered with new shape)');
    }

    /**
     * Navigate between shapes
     */
    async navigateShape(direction) {
        // Debounce navigation to prevent multiple rapid calls
        if (this.isNavigating) {
            console.log('⚠️ Navigation already in progress, ignoring...');
            return;
        }

        this.isNavigating = true;
        console.log(`🔄 Navigating ${direction}`);

        try {
            // Clear all previous shape state
            this.clearAllShapeState();

            // Use Supabase manager navigation if available
            if (this.practiceShapes.length > 0 && this.practiceShapes[0].supabaseManager) {
                const manager = this.practiceShapes[0].supabaseManager;
                let result = null;

                switch (direction) {
                    case 'left':
                        result = await manager.previousShape();
                        break;
                    case 'right':
                        result = await manager.nextShape();
                        break;
                    case 'random':
                        result = await manager.randomShape();
                        break;
                }

                if (result && !result.error) {
                    // Update our current index to match manager's index
                    const navInfo = manager.getNavigationInfo();
                    if (navInfo) {
                        this.currentShapeIndex = navInfo.shapeIndex;
                        console.log(`📍 Navigated to shape: ${navInfo.currentShapeName} (index ${navInfo.shapeIndex})`);
                    }

                    // Update the game with the new shape
                    await this.integrateShapeWithGame(result);
                    console.log(`✅ Shape ${navInfo?.currentShapeName} loaded and rendered immediately`);
                    return;
                } else {
                    console.log('⚠️ Navigation returned null/error - trying to reload current shape');
                    // Fallback: reload current shape to ensure something is displayed
                    await this.loadCurrentShape();
                    return;
                }
            }

            // Fallback to local navigation
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

        } catch (error) {
            console.error(`❌ Navigation error (${direction}):`, error);
            // Graceful fallback - reload current shape
            try {
                await this.loadCurrentShape();
            } catch (fallbackError) {
                console.error('❌ Fallback load also failed:', fallbackError);
            }
        } finally {
            // Small delay to ensure rendering completes before allowing next navigation
            setTimeout(() => {
                this.isNavigating = false;
                console.log('🔓 Navigation lock released - ready for next navigation');
            }, 100);
        }
    }

    /**
     * Integrate shape from Supabase manager with the game
     */
    async integrateShapeWithGame(shape) {
        if (!shape || shape.error) {
            console.error('Cannot integrate invalid shape');
            return;
        }

        // AGGRESSIVE: Clear ALL previous shape data first
        this.clearDailyShapeContamination();

        console.log(`📊 Integrating practice shape with ${Object.keys(shape).length} properties`);

        // Set the new practice shape data
        window.currentGeoJSON = shape;
        this.practiceCurrentGeoJSON = shape;

        // Parse the practice shape
        let practiceShapes = [];
        if (window.parseGeometry && typeof window.parseGeometry === 'function') {
            const parseResult = window.parseGeometry(shape);
            console.log(`📊 Main parser called for practice shape, result:`, parseResult);

            if (parseResult && parseResult.shapes && Array.isArray(parseResult.shapes)) {
                practiceShapes = parseResult.shapes;
                console.log(`📊 Parsed ${practiceShapes.length} practice shapes`);
            } else {
                console.warn('⚠️ parseGeometry did not return expected format for practice shape');
            }
        } else {
            console.warn('⚠️ parseGeometry not available');
        }

        // CRITICAL: Set ONLY the practice shapes in practice mode storage
        // DO NOT SET window.parsedShapes - that's for daily mode only!
        this.practiceParsedShapes = [...practiceShapes]; // practice mode shapes ONLY

        console.log(`🔒 FINAL CHECK: window.parsedShapes now contains ${window.parsedShapes.length} practice shapes only`);

        // Debug log the state before rendering
        console.log(`🔍 DEBUG: About to render shapes. practiceParsedShapes:`, this.practiceParsedShapes);

        // Store original shapes for cutting mechanism
        if (this.practiceParsedShapes && this.practiceParsedShapes.length > 0) {
            this.originalShapes = [...this.practiceParsedShapes];
            console.log(`🔒 Practice mode: Stored original shapes for cutting mechanism: ${this.originalShapes.length}`);

            // CRITICAL: Update mechanic originalShapes immediately with practice data
            if (window.currentMechanic) {
                window.currentMechanic.originalShapes = [...this.practiceParsedShapes];
                console.log(`🔒 CRITICAL: Updated mechanic originalShapes with practice data (${window.currentMechanic.originalShapes.length} shapes)`);
            }
        } else {
            console.error('❌ CRITICAL: No practice shapes available to store - this will cause cutting issues');
        }

        // Render the shape using standard rendering
        if (window.renderShapeForCutting && typeof window.renderShapeForCutting === 'function') {
            // Final check before rendering
            if (!this.practiceParsedShapes || this.practiceParsedShapes.length === 0) {
                console.warn('⚠️ window.parsedShapes is empty, attempting emergency parse...');

                // Emergency fallback parsing
                if (shape && shape.features) {
                    window.parsedShapes = [];
                    shape.features.forEach((feature, index) => {
                        if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                            const parsedShape = this.parseGeometry(feature.geometry);
                            if (parsedShape) {
                                window.parsedShapes.push(parsedShape);
                            }
                        }
                    });
                    console.log(`🆘 Emergency parser found ${window.parsedShapes.length} shapes`);
                }
            }

            // Clear canvas first, then render new shape using same sequence as redrawCanvas()
            const canvas = document.querySelector('#geoCanvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                console.log('🧹 Canvas cleared for new practice shape');

                // Draw grid FIRST (same order as redrawCanvas)
                if (window.drawGrid && typeof window.drawGrid === 'function') {
                    window.drawGrid();
                    console.log('🎨 Grid drawn first (matching redrawCanvas sequence)');
                } else {
                    console.warn('⚠️ drawGrid function not available');
                }

                // Then render shapes on top of grid
                console.log(`🎨 About to call renderShapeForCutting with ${this.practiceParsedShapes?.length || 0} practice shapes`);
                window.renderShapeForCutting(this.practiceParsedShapes, false);
                console.log('🎨 Practice shape rendered over grid');
            }

            // Force canvas refresh and focus to ensure visibility
            if (canvas) {
                canvas.scrollIntoView({ behavior: 'instant', block: 'center' });
                canvas.focus();
            }

            console.log('✅ Shape integration complete - new practice shape should be visible on canvas immediately');
        }

        // Load appropriate mechanic and update UI
        this.loadTodaysMechanic();
        this.enableCanvasInteraction();

        // Update instruction text using centralized function
        if (window.showInstructionArea && typeof window.showInstructionArea === 'function') {
            window.showInstructionArea();

            // Store the instruction for practice mode restoration
            const dayInfo = this.getCurrentDayMechanic();
            if (window.getInitialInstruction) {
                const initialInstruction = window.getInitialInstruction(dayInfo.mechanicName);
                this.practiceInstruction = initialInstruction;
                console.log('📝 Practice mode instruction stored in loadCurrentShape:', initialInstruction);
            }
        } else if (window.updateInstructionText && typeof window.updateInstructionText === 'function') {
            // Fallback to direct instruction update
            const dayInfo = this.getCurrentDayMechanic();
            if (window.getInitialInstruction) {
                const initialInstruction = window.getInitialInstruction(dayInfo.mechanicName);
                window.updateInstructionText(initialInstruction);
                this.practiceInstruction = initialInstruction;
                console.log('📝 Practice mode instruction set in loadCurrentShape (fallback):', initialInstruction);
            }
        }
    }

    /**
     * Load the current shape into the canvas
     */
    async loadCurrentShape() {
        // If using Supabase manager, get current shape from manager
        if (this.practiceShapes.length > 0 && this.practiceShapes[0].supabaseManager) {
            const manager = this.practiceShapes[0].supabaseManager;
            const currentShape = manager.getCurrentShape();

            if (currentShape && !currentShape.error) {
                await this.integrateShapeWithGame(currentShape);
                return;
            }
        }

        // Fallback to array-based loading
        const shape = this.practiceShapes[this.currentShapeIndex];
        console.log(`📐 Loading practice shape: ${shape.name}`);

        try {
            let geojsonData;

            // Use Supabase integration if available
            if (shape.supabaseManager) {
                console.log(`🔗 Loading ${shape.name} from Supabase via PracticeModeManager`);

                // Jump to the specific shape in the Supabase manager
                await shape.supabaseManager.jumpToShape(
                    shape.name.substr(0, 6), // Extract YYMMDD from name
                    parseInt(shape.name.substr(7, 2)) // Extract shape number
                );

                geojsonData = shape.supabaseManager.getCurrentShape();

                if (!geojsonData || geojsonData.error) {
                    throw new Error(`Failed to load from Supabase: ${geojsonData?.message || 'Unknown error'}`);
                }
            } else {
                // Fallback to local fetch for backwards compatibility
                console.log(`📁 Loading ${shape.name} from local file system (fallback)`);
                const response = await fetch(shape.file);
                if (!response.ok) {
                    throw new Error(`Failed to load shape: ${response.status}`);
                }
                geojsonData = await response.json();
            }

            console.log(`✅ Practice shape loaded: ${shape.name}`);

            // AGGRESSIVE: Clear ALL contamination first
            this.clearDailyShapeContamination();

            console.log(`📊 Loading practice shape: ${shape.name}`);

            // Set the new shape data
            window.currentGeoJSON = geojsonData;
            this.practiceCurrentGeoJSON = geojsonData;

            // Parse the practice shape
            let practiceShapes = [];
            if (window.parseGeometry && typeof window.parseGeometry === 'function') {
                // Use the main parseGeometry function from the game
                console.log('🔧 Using main parseGeometry function for practice');
                const parseResult = window.parseGeometry(geojsonData);

                if (parseResult && parseResult.shapes) {
                    practiceShapes = parseResult.shapes;
                    console.log(`📊 Main parser found ${practiceShapes.length} shapes`);
                } else {
                    console.warn('⚠️ Main parser did not return expected format, using fallback');
                }
            } else {
                // Fallback parsing
                console.log('🔧 Using fallback parseGeometry');
                if (geojsonData.features) {
                    geojsonData.features.forEach((feature, index) => {
                        if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                            const parsedShape = this.parseGeometry(feature.geometry);
                            if (parsedShape) {
                                practiceShapes.push(parsedShape);
                            }
                        }
                    });
                }
                console.log(`📊 Fallback parser found ${practiceShapes.length} shapes`);
            }

            // CRITICAL: Set ONLY the practice shapes in practice mode storage
            // DO NOT SET window.parsedShapes - that's for daily mode only!
            this.practiceParsedShapes = [...practiceShapes]; // practice mode shapes ONLY

            console.log(`🔒 FINAL CHECK: practiceParsedShapes now contains ${this.practiceParsedShapes.length} practice shapes`);

            // Ensure we have shapes to render
            if (!this.practiceParsedShapes || this.practiceParsedShapes.length === 0) {
                console.error('❌ No shapes parsed - practice mode cannot render');
                return;
            }

            // CRITICAL: Store original shapes for circle cutting mechanism
            this.originalShapes = [...this.practiceParsedShapes];
            console.log('🔒 Practice mode: Stored original shapes for cutting mechanism:', this.originalShapes.length);

            // CRITICAL: Update mechanic originalShapes immediately with practice data
            if (window.currentMechanic) {
                window.currentMechanic.originalShapes = [...this.practiceParsedShapes];
                console.log(`🔒 CRITICAL: Updated mechanic originalShapes with practice data (${window.currentMechanic.originalShapes.length} shapes)`);
            }

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
     * Render practice shape using existing canvas functionality
     */
    renderPracticeShape() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas || !this.practiceParsedShapes || !this.practiceParsedShapes.length) {
            console.warn('⚠️ Cannot render practice shape: missing canvas or shapes');
            return;
        }

        // Clear the canvas first to prevent stacking
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the grid FIRST (same order as redrawCanvas - essential for proper layering)
        if (window.drawGrid && typeof window.drawGrid === 'function') {
            window.drawGrid();
            console.log('🎨 Grid drawn first in renderPracticeShape');
        }

        // Use existing shape rendering function
        if (window.renderShapeForCutting) {
            window.renderShapeForCutting(this.practiceParsedShapes, false);
            console.log('🎨 Practice shapes rendered over grid');
        } else {
            // Fallback rendering
            this.fallbackRenderShape(canvas);
        }

        console.log(`🎨 Practice shape rendered with ${this.practiceParsedShapes.length} shapes`);
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
     * Get current day mechanic mapping - uses same day as daily mode
     */
    getCurrentDayMechanic() {
        // Use the same currentDay that daily mode uses (respects manual demo day setting)
        const currentDemoDay = window.currentDay || 1;

        // Day to mechanic mapping (PRACTICE MODE SPECIFIC)
        // NOTE: Sunday uses DefaultWithUndoMechanic instead of RotatingShapeVectorMechanic
        const dayMechanics = {
            1: 'DefaultWithUndoMechanic',      // Monday
            2: 'HorizontalOnlyMechanic',       // Tuesday
            3: 'CircleCutMechanic',            // Wednesday
            4: 'DiagonalAscendingMechanic',    // Thursday
            5: 'ThreePointTriangleMechanic',   // Friday
            6: 'RotatingSquareMechanic',       // Saturday
            7: 'DefaultWithUndoMechanic'       // Sunday (Practice mode uses Straight Line, not Rotating Vector)
        };

        const mechanicName = dayMechanics[currentDemoDay];

        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const dayName = dayNames[currentDemoDay === 7 ? 0 : currentDemoDay];

        console.log(`🗓️ Practice mode: ${dayName} (day ${currentDemoDay}) → ${mechanicName}`);
        console.log(`🗓️ Practice mode using same day as daily mode: window.currentDay = ${window.currentDay}`);

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
        console.log(`🔧 DEBUG: Available window mechanics:`, Object.keys(window).filter(key => key.includes('Mechanic')));

        if (MechanicObject && typeof MechanicObject === 'object') {
            // It's an object - use it directly
            window.currentMechanic = MechanicObject;

            // CRITICAL: Also update the local currentMechanic variable that event handlers use
            if (typeof window.setCurrentMechanic === 'function') {
                window.setCurrentMechanic(MechanicObject);
                console.log(`🔧 PRACTICE MODE: Updated both local and global currentMechanic via helper function`);
            } else {
                console.warn(`⚠️ PRACTICE MODE: setCurrentMechanic helper function not available`);
            }

            console.log(`🔧 DEBUG: window.currentMechanic set to:`, window.currentMechanic.name);

            // Initialize the mechanic if it has an init method
            if (typeof window.currentMechanic.init === 'function') {
                window.currentMechanic.init();
                console.log(`🔧 Practice mode: ${mechanicName} initialized`);
            }

            console.log(`🔧 DEBUG: Final currentMechanic check:`, !!window.currentMechanic, window.currentMechanic?.name);
            return true;
        } else {
            console.warn(`⚠️ Practice mode: ${mechanicName} not found, using fallback`);
            return false;
        }
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

        // Validate cut - reject 0/100 splits
        const leftRounded = Math.round(cutData.leftPercentage || 0);
        const rightRounded = Math.round(cutData.rightPercentage || 0);

        if ((leftRounded === 0 && rightRounded === 100) || (leftRounded === 100 && rightRounded === 0)) {
            console.log('🚫 INVALID PRACTICE CUT: Cut resulted in 0/100 split - not displaying');

            // Clear any cut data
            this.currentCutData = null;
            this.hasActiveCut = false;

            // Re-enable canvas interaction
            if (window.practiceMode && typeof window.practiceMode.enableCanvasInteraction === 'function') {
                window.practiceMode.enableCanvasInteraction();
            }

            // Show try again message
            if (window.updateInstructionText) {
                window.updateInstructionText('Try again', true);
            }

            return; // Exit early without displaying cut
        }

        // Store cut data
        this.currentCutData = cutData;
        this.hasActiveCut = true;

        console.log('✅ Practice cut processed with percentages:', cutData);

        // Show the split display immediately for practice mode
        this.showSplitDisplay(cutData);

        // Restore practice instruction after cut is processed
        setTimeout(() => {
            this.restorePracticeInstruction();
        }, 500); // Delay to allow cut processing to complete
    }

    /**
     * Show split display for practice mode cut
     */
    showSplitDisplay(cutData) {
        // Use existing split display creation - ALWAYS prefer main function
        if (window.createNewAttemptResult && typeof window.createNewAttemptResult === 'function') {
            console.log('🎯 Practice mode: Using main createNewAttemptResult function');
            // Call with percentages directly (main function expects leftPercentage, rightPercentage)
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

        // Use practice mode colors - dark grey to match other days
        const leftColor = 'rgb(102, 102, 102)';  // Dark grey #666666 (matches other days)
        const rightColor = 'rgb(153, 153, 153)';    // Light grey #999999

        fixedPercentageArea.innerHTML = `
            <div class="split-display-large">
                <span style="color: ${leftColor}; font-weight: bold; font-size: ${splitFontSize}px;">${Math.round(cutData.leftPercentage || 50)}%</span>
                <span style="color: #999999; font-weight: bold; font-size: ${splitFontSize}px; margin: 0 5px;"> / </span>
                <span style="color: ${rightColor}; font-weight: bold; font-size: ${splitFontSize}px;">${Math.round(cutData.rightPercentage || 50)}%</span>
            </div>
        `;

        fixedPercentageArea.style.display = 'block';
        fixedPercentageArea.style.visibility = 'visible';
    }

    /**
     * Clear triangle protection when starting new cuts
     */
    clearTriangleProtection() {
        if (window.triangleCutActive) {
            console.log('🧹 Practice mode: Clearing triangle protection for new cut');
            window.triangleCutActive = false;
            window.triangleCutResult = null;
        }
    }

    /**
     * Clear cut shading and split display
     */
    clearCutShading() {
        console.log('🧹 CLEAR CUT SHADING CALLED:', {
            triangleCutActive: window.triangleCutActive,
            hasTriangleCutResult: !!window.triangleCutResult,
            timestamp: new Date().toISOString(),
            stack: new Error().stack.split('\n').slice(1, 4).join('\n')
        });

        // Don't clear if triangle cut is active - preserve triangle rendering
        if (window.triangleCutActive && window.triangleCutResult) {
            console.log('🔒 PROTECTION ACTIVATED: Preserving triangle cut result - not clearing');
            return;
        }

        console.log('❌ NO PROTECTION: Proceeding with clearing cut shading');

        // Always clear split display and score, regardless of cut state
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        if (fixedPercentageArea) {
            fixedPercentageArea.innerHTML = '';
            // Keep it visible for practice mode (don't set display: none)
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
            }, 100); // Small delay to ensure other instruction updates have finished
        } else {
            // Fallback: generate instruction from current mechanic if stored instruction is missing
            console.log('⚠️ Practice instruction missing, generating from current mechanic');
            const dayInfo = this.getCurrentDayMechanic();
            if (dayInfo && window.getInitialInstruction && window.updateInstructionText) {
                const initialInstruction = window.getInitialInstruction(dayInfo.mechanicName);
                if (initialInstruction) {
                    setTimeout(() => {
                        window.updateInstructionText(initialInstruction);
                        this.practiceInstruction = initialInstruction; // Store for future use
                        console.log('📝 Practice mode instruction generated and stored:', initialInstruction);
                    }, 100);
                }
            }
        }
    }

    /**
     * Position practice elements to match daily mode layout
     */
    positionPracticeElements() {
        // Get the canvas container for reference positioning
        const canvasContainer = document.getElementById('canvas-container') || document.getElementById('canvasContainer');
        if (!canvasContainer) return;

        // Position navigation buttons where progress tracker would be
        const navigation = document.getElementById('practiceNavigation');
        if (navigation) {
            // Insert navigation after canvas, before any other elements
            const nextSibling = canvasContainer.nextElementSibling;
            if (nextSibling) {
                canvasContainer.parentNode.insertBefore(navigation, nextSibling);
            } else {
                canvasContainer.parentNode.appendChild(navigation);
            }

            // Desktop full-screen mode: Move navigation down by 90px (70px + 20px)
            if (window.innerWidth >= 769) {
                navigation.style.setProperty('margin-top', '90px', 'important');
                navigation.style.setProperty('position', 'relative', 'important');
            }
        }

        // Ensure fixed areas are properly positioned
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        if (fixedPercentageArea) {
            fixedPercentageArea.style.position = 'relative';
            // Desktop full-screen mode: Move down by 15px (50px - 35px), otherwise 10px
            if (window.innerWidth >= 769) {
                fixedPercentageArea.style.setProperty('margin-top', '15px', 'important');
            } else {
                fixedPercentageArea.style.marginTop = '10px';
            }
        }

        // Desktop full-screen mode: Move buttons container (score) up by 50px
        if (window.innerWidth >= 769) {
            const buttonsContainer = document.getElementById('buttonsContainer');
            if (buttonsContainer) {
                buttonsContainer.style.setProperty('margin-top', '-50px', 'important');
                buttonsContainer.style.setProperty('margin-bottom', '0', 'important');
                buttonsContainer.style.setProperty('position', 'relative', 'important');
            }
        }

        console.log('📐 Practice elements positioned to match daily mode');
    }

    /**
     * Open practice mode
     */
    async open() {
        console.log('🎮 Opening practice mode...');

        // Check if user is logged in
        const isLoggedIn = this.checkUserAuthentication();
        if (!isLoggedIn) {
            alert('Please log in to access Practice mode');
            return;
        }

        // DEBUG: Check what state we're coming from
        console.log('🔍 PRACTICE DEBUG: Opening practice mode with state:', {
            isDailyMode: window.isDailyMode,
            isPracticeMode: window.isPracticeMode,
            gameState: window.gameState,
            dailyGameComplete: window.dailyGameState ? window.dailyGameState.dayComplete : 'no dailyGameState',
            isGameComplete: window.dailyGameState ? window.dailyGameState.isGameComplete : 'no dailyGameState'
        });

        // Save current daily game state - always save if in daily mode
        if (window.SimpleRefresh && window.SimpleRefresh.save && window.isDailyMode) {
            console.log('💾 Saving daily game state before entering practice mode');
            console.log('📊 Current state before save:', {
                gameState: window.gameState,
                currentShapeIndex: window.currentShapeIndex,
                totalCuts: window.totalCuts,
                cutsThisShape: window.cutsThisShape
            });

            // Set flag to ensure canvas data (including cut shading) is saved
            window.aboutToEnterPracticeMode = true;
            window.SimpleRefresh.save();
            window.aboutToEnterPracticeMode = false; // Clear flag immediately after save

            console.log('✅ Daily game state saved successfully (including canvas data)');
        } else {
            console.log('⚠️ Cannot save daily game state:', {
                hasSimpleRefresh: !!window.SimpleRefresh,
                hasSaveFunction: !!(window.SimpleRefresh && window.SimpleRefresh.save),
                isDailyMode: window.isDailyMode
            });
        }

        this.isActive = true;

        // CRITICAL: Save daily shapes IMMEDIATELY before changing any flags or state
        if (window.parsedShapes && window.parsedShapes.length > 0) {
            this.savedDailyShapes = JSON.parse(JSON.stringify(window.parsedShapes));
            console.log(`🔒 IMMEDIATE: Saved ${this.savedDailyShapes.length} daily shapes before practice mode setup`);
        } else {
            console.log('⚠️ No daily shapes to save when entering practice mode');
        }

        // CRITICAL: Setup practice mode isolation BEFORE doing anything else
        this.setupPracticeModeIsolation();

        // CRITICAL: Setup continuous shape protection
        this.setupShapeProtection();

        // CRITICAL: Clear ALL daily shape contamination
        this.clearDailyShapeContamination();

        // Set practice mode flags FIRST
        window.isPracticeMode = true;
        window.isDailyMode = false;
        window.gameState = 'cutting'; // Set to cutting so canvas is active
        window.isInteractionEnabled = true;

        // Track practice mode activation event
        if (typeof gtag !== 'undefined') {
            gtag('event', 'practice_mode_started', {
                event_category: 'gameplay',
                event_label: 'practice_session_started'
            });
            console.log('📊 GA4: Tracked practice_mode_started event');
        }

        // Set current section to practice/archive mode
        if (typeof window.currentSection !== 'undefined') {
            window.currentSection = 'archive'; // Practice mode uses 'archive' section
        }

        // CRITICAL: Also force local variables in case they exist
        if (typeof isDailyMode !== 'undefined') {
            isDailyMode = false;
        }
        if (typeof isInteractionEnabled !== 'undefined') {
            isInteractionEnabled = true;
        }
        if (typeof gameState !== 'undefined') {
            gameState = 'cutting';
        }

        // CRITICAL: If rotating mechanic is active, stop it properly for practice mode
        if (window.currentMechanic && window.currentMechanic.name === "Rotating Shape Vector Cut") {
            console.log('🔄 PRACTICE MODE: Stopping rotating mechanic for practice mode');
            if (typeof window.currentMechanic.enterPracticeMode === 'function') {
                window.currentMechanic.enterPracticeMode();
            }
        }

        console.log('🔄 Practice mode flags set:', { isPracticeMode: window.isPracticeMode, isDailyMode: window.isDailyMode, gameState: window.gameState });

        // Ensure canvas is visible and ready
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            canvas.style.display = 'block';
            canvas.style.pointerEvents = 'auto';
            console.log('🎨 Canvas made visible and interactive for practice mode');
        }

        // Stop any running countdown timers by hiding complete view
        if (window.completeView && window.completeView.hide) {
            window.completeView.hide();
            console.log('⏰ Stopped daily countdown timer and hid completion view');
        }

        // Hide daily mode specific elements
        this.hideDailyModeElements();

        // Load practice shapes
        await this.loadPracticeShapes();

        // Create and position navigation buttons
        const navigation = this.createNavigationButtons();
        console.log('🔘 Navigation buttons created:', navigation);

        // Show practice mode indicator
        const indicator = document.getElementById('practiceModeIndicator');
        if (indicator) {
            indicator.style.display = 'block';
        }

        // Add navigation to DOM BEFORE positioning - try multiple possible container IDs
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

        // Update the header title to ensure correct date is shown
        if (window.updateDateTitle && typeof window.updateDateTitle === 'function') {
            window.updateDateTitle();
            console.log('🔄 Updated header title for practice mode');
        }

        // Load the first shape (index 0) - this should activate the canvas
        this.currentShapeIndex = 0;
        await this.loadCurrentShape();

        // ALWAYS set up instructions for practice mode - use multiple approaches to ensure success
        const dayInfo = this.getCurrentDayMechanic();

        // First: Use centralized function
        if (window.showInstructionArea && typeof window.showInstructionArea === 'function') {
            window.showInstructionArea();
            console.log('📝 Practice mode: Used centralized showInstructionArea function');
        } else {
            // Ensure instruction area is visible manually
            const instructionArea = document.getElementById('instructionArea');
            if (instructionArea) {
                instructionArea.style.display = 'flex';
                instructionArea.style.visibility = 'visible';
                console.log('📝 Practice mode: Instruction area made visible manually');
            }
        }

        // Second: ALWAYS set the instruction text directly
        if (dayInfo && window.getInitialInstruction && window.updateInstructionText) {
            const initialInstruction = window.getInitialInstruction(dayInfo.mechanicName);
            if (initialInstruction) {
                // Force instruction update
                window.updateInstructionText(initialInstruction);
                this.practiceInstruction = initialInstruction;
                console.log('📝 Practice mode instruction FORCED:', initialInstruction);
            } else {
                console.error('❌ No initial instruction available for mechanic:', dayInfo.mechanicName);
            }
        } else {
            console.error('❌ Required functions not available for practice mode instructions');
        }

        // CRITICAL: Force clean canvas state and interaction after loading
        this.resetCanvasForPractice();

        // Final positioning after everything is loaded
        this.positionPracticeElements();

        // FORCE desktop positioning after a short delay to override any other styles
        setTimeout(() => {
            console.log('🔍 LAYOUT CHECK: window.innerWidth =', window.innerWidth, 'window.innerHeight =', window.innerHeight);
            if (window.innerWidth >= 769) {
                const fixedPercentageArea = document.getElementById('fixedPercentageArea');
                const buttonsContainer = document.getElementById('buttonsContainer');
                const practiceNavigation = document.getElementById('practiceNavigation');

                console.log('🔍 ELEMENTS FOUND:', {
                    fixedPercentageArea: !!fixedPercentageArea,
                    buttonsContainer: !!buttonsContainer,
                    practiceNavigation: !!practiceNavigation
                });

                // Move practice navigation buttons down by 80px
                if (practiceNavigation) {
                    practiceNavigation.style.setProperty('margin-top', '80px', 'important');
                    practiceNavigation.style.setProperty('position', 'relative', 'important');
                    console.log('🔧 FORCED: practiceNavigation margin-top to 80px');
                }

                // Position split display absolutely to prevent layout shifts
                if (fixedPercentageArea) {
                    fixedPercentageArea.style.setProperty('position', 'absolute', 'important');
                    fixedPercentageArea.style.setProperty('top', '595px', 'important');
                    console.log('🔧 FORCED: fixedPercentageArea position absolute at top 595px');
                }

                // Move score (buttonsContainer) up by 50px
                if (buttonsContainer) {
                    buttonsContainer.style.setProperty('margin-top', '-50px', 'important');
                    buttonsContainer.style.setProperty('margin-bottom', '0', 'important');
                    buttonsContainer.style.setProperty('position', 'relative', 'important');
                    console.log('🔧 FORCED: buttonsContainer margin-top to -50px');
                }
            } else if (window.innerWidth >= 357 && window.innerWidth <= 375 && window.innerHeight >= 560 && window.innerHeight <= 600) {
                // iPhone SE 2 and similar (357x560 - 375x560) - use absolute positioning for split display to prevent layout shifts
                console.log('📱 iPhone SE 2 layout detected (357-375 x 560)');
                const fixedPercentageArea = document.getElementById('fixedPercentageArea');
                const practiceNavigation = document.getElementById('practiceNavigation');
                const buttonsContainer = document.getElementById('buttonsContainer');

                if (practiceNavigation) {
                    practiceNavigation.style.setProperty('margin-top', '-20px', 'important');
                    practiceNavigation.style.setProperty('position', 'relative', 'important');
                    console.log('🔧 FORCED: practiceNavigation margin-top to -20px for iPhone SE 2');
                }

                if (fixedPercentageArea) {
                    fixedPercentageArea.style.setProperty('position', 'absolute', 'important');
                    fixedPercentageArea.style.setProperty('top', '475px', 'important');
                    fixedPercentageArea.style.setProperty('left', '0', 'important');
                    fixedPercentageArea.style.setProperty('right', '0', 'important');
                    fixedPercentageArea.style.setProperty('width', '100%', 'important');
                    fixedPercentageArea.style.setProperty('z-index', '100', 'important');
                    console.log('🔧 FORCED: fixedPercentageArea position absolute at top 475px for iPhone SE 2');
                }

                if (buttonsContainer) {
                    buttonsContainer.style.setProperty('margin-top', '-25px', 'important');
                    buttonsContainer.style.setProperty('position', 'relative', 'important');
                    console.log('🔧 FORCED: buttonsContainer margin-top to -25px for iPhone SE 2');
                }
            } else if ((window.innerWidth === 430 && window.innerHeight === 805) ||
                       (window.innerWidth === 390 && window.innerHeight === 715) ||
                       (window.innerWidth === 412 && window.innerHeight === 785) ||
                       (window.innerWidth === 360 && window.innerHeight === 630)) {
                // Specific mobile layouts - adjust score text only
                console.log('📱 Specific mobile layout detected:', window.innerWidth, 'x', window.innerHeight);

                // Add style to move score text down 20px (this will be applied to the score div in main.js)
                const styleEl = document.createElement('style');
                styleEl.id = 'mobile-score-adjustment';
                styleEl.textContent = `
                    #practiceResultsOverlay .split-display-large + br + div,
                    .practice-results-content .split-display-large + br + div {
                        margin-top: 3px !important;
                    }
                `;
                document.head.appendChild(styleEl);
                console.log('🔧 Applied score text adjustment for mobile layout');
            } else {
                console.log('❌ NOT DESKTOP or iPhone SE 2: Window dimensions do not match');
            }
        }, 100);

        // Ensure practice mode instruction is properly set after opening
        // Use longer delay if coming from completed daily game to ensure all state is cleared
        const isFromCompletedGame = window.dailyGameState && (window.dailyGameState.dayComplete || window.dailyGameState.isGameComplete);
        const delay = isFromCompletedGame ? 500 : 200;

        console.log('🔍 PRACTICE DEBUG: Completion detection details:', {
            hasGameState: !!window.dailyGameState,
            dayComplete: window.dailyGameState ? window.dailyGameState.dayComplete : 'N/A',
            isGameComplete: window.dailyGameState ? window.dailyGameState.isGameComplete : 'N/A',
            isFromCompletedGame: isFromCompletedGame,
            gameState: window.gameState,
            currentSection: window.currentSection
        });

        setTimeout(() => {
            this.restorePracticeInstruction();
        }, delay);

        // IMMEDIATE INSTRUCTION RESTORATION - No delays, force it now
        this.immediateInstructionRestoration();

        // AGGRESSIVE BACKUP ATTEMPTS
        setTimeout(() => {
            this.immediateInstructionRestoration();
        }, 100);

        setTimeout(() => {
            this.immediateInstructionRestoration();
        }, 300);

        setTimeout(() => {
            this.immediateInstructionRestoration();
        }, 600);

        // SPECIAL HANDLING for completed game state
        console.log('🔍 PRACTICE DEBUG: Checking completion state - isFromCompletedGame:', isFromCompletedGame);
        if (isFromCompletedGame) {
            console.log('📝 Practice mode opened from completed daily game - using NUCLEAR option for instruction restoration');
            console.log('🔍 PRACTICE DEBUG: About to call nuclear restoration');

            // NUCLEAR OPTION: Force instructions immediately without any mode checks
            this.nuclearInstructionRestoration();

            // Multiple aggressive attempts with nuclear option
            setTimeout(() => {
                this.nuclearInstructionRestoration();
            }, 50);
            setTimeout(() => {
                this.nuclearInstructionRestoration();
            }, 100);
            setTimeout(() => {
                this.nuclearInstructionRestoration();
            }, 200);
            setTimeout(() => {
                this.nuclearInstructionRestoration();
            }, 400);
            setTimeout(() => {
                this.nuclearInstructionRestoration();
            }, 800);
            setTimeout(() => {
                this.nuclearInstructionRestoration();
            }, 1200);
            setTimeout(() => {
                this.nuclearInstructionRestoration();
            }, 1600);

            // Also try the regular method as backup
            setTimeout(() => {
                this.immediateInstructionRestoration();
            }, 50);
            setTimeout(() => {
                this.immediateInstructionRestoration();
            }, 150);
            setTimeout(() => {
                this.immediateInstructionRestoration();
            }, 500);
            setTimeout(() => {
                this.immediateInstructionRestoration();
            }, 1000);
        }

        // Start the periodic instruction monitor for practice mode
        if (window.startPracticeInstructionMonitor) {
            window.startPracticeInstructionMonitor();
        }

        // Add a timer to check if instruction area gets hidden after setup
        setTimeout(() => {
            const instructionArea = document.getElementById('instructionArea');
            const instructionText = document.getElementById('instructionText');
            console.log('🔍 PRACTICE DEBUG: Final check after 2 seconds:', {
                instructionAreaExists: !!instructionArea,
                instructionAreaDisplay: instructionArea ? instructionArea.style.display : 'N/A',
                instructionAreaVisibility: instructionArea ? instructionArea.style.visibility : 'N/A',
                instructionTextExists: !!instructionText,
                instructionTextContent: instructionText ? instructionText.textContent : 'N/A',
                instructionTextDisplay: instructionText ? instructionText.style.display : 'N/A'
            });
        }, 2000);

        console.log('✅ Practice mode opened with first shape loaded');
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
            'completion-countdown',   // Hide countdown timer
            'welcomeOverlay'          // Hide welcome overlay that blocks canvas
        ];

        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
                element.style.pointerEvents = 'none'; // Ensure no pointer blocking
                element.innerHTML = ''; // Clear content
            }
        });

        // Clear fixedPercentageArea content but keep it available for practice mode
        const fixedPercentageArea = document.getElementById('fixedPercentageArea');
        if (fixedPercentageArea) {
            fixedPercentageArea.innerHTML = ''; // Clear daily mode content
            fixedPercentageArea.style.display = 'block'; // Keep visible for practice mode
            console.log('🔄 Split display area cleared and ready for practice mode');
        }

        // Clear countdown from instruction area but keep the area for practice instructions
        const instructionArea = document.getElementById('instructionArea');
        if (instructionArea) {
            // Remove countdown content specifically
            const countdownElement = instructionArea.querySelector('#completion-countdown');
            if (countdownElement) {
                countdownElement.remove();
                console.log('🔄 Countdown removed from instruction area');
            }
            // Clear any countdown text that might be in the instruction area
            if (instructionArea.textContent && instructionArea.textContent.includes('New shapes in')) {
                instructionArea.innerHTML = '';
                console.log('🔄 Countdown text cleared from instruction area');
            }
        }

        // Hide progress display classes
        const progressElements = document.querySelectorAll('.progress-display, .progression-button, .attempt-buttons');
        progressElements.forEach(el => {
            el.style.display = 'none';
            el.innerHTML = ''; // Clear content
        });

        // Hide welcome content classes
        const welcomeElements = document.querySelectorAll('.welcome-content, .initial-play-container, .canvas-button-overlay');
        welcomeElements.forEach(el => {
            el.style.display = 'none';
        });

        // Hide any remaining Play/Practice buttons
        const playButtons = document.querySelectorAll('button[onclick*="startGame"], button[onclick*="openPractice"]');
        playButtons.forEach(btn => {
            btn.style.display = 'none';
        });

        // Clear any daily mode split result displays but preserve structure for practice mode
        const splitDisplays = document.querySelectorAll('.split-display, .split-display-large, .attempt-result');
        splitDisplays.forEach(display => {
            // Only clear content, don't hide the displays entirely as practice mode needs them
            display.innerHTML = '';
            // Keep them visible for practice mode to use
            if (display.style.display === 'none') {
                display.style.display = 'block';
            }
        });

        // Reset canvas interaction state completely
        window.currentVector = null;
        window.vectorCutActive = false;
        window.isDrawingVector = false;
        window.vectorStart = null;
        window.vectorEnd = null;

        console.log('🚫 Daily mode elements, split displays, and canvas state cleared');
    }

    /**
     * Reset canvas completely for practice mode
     */
    resetCanvasForPractice() {
        console.log('🎨 Resetting canvas for practice mode...');

        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            console.error('❌ Canvas not found for practice reset');
            return;
        }

        // CRITICAL: Reset canvas size and transform to standard 380x380
        // This is essential when entering from completion state which applies DPR scaling
        let ctx;
        if (window.setupCanvasForCrispRendering) {
            ctx = window.setupCanvasForCrispRendering(canvas);
            console.log('🎨 Canvas reset to standard 380x380 using setupCanvasForCrispRendering');
        } else {
            // Fallback if function not available
            ctx = canvas.getContext('2d');
            canvas.width = 380;
            canvas.height = 380;
            canvas.style.width = '380px';
            canvas.style.height = '380px';
            ctx.imageSmoothingEnabled = false;
            console.log('🎨 Canvas reset to standard 380x380 (fallback method)');
        }

        // CRITICAL: Reset transform to identity (removes any DPR scaling from completion view)
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        console.log('🎨 Canvas transform reset to identity matrix');

        // Clear everything from canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // CRITICAL: Reset canvas context drawing settings to default state
        ctx.setLineDash([]); // Clear any line dash patterns from daily mode
        ctx.strokeStyle = '#000000'; // Reset stroke color to black
        ctx.lineWidth = 1; // Reset line width to default
        ctx.fillStyle = '#000000'; // Reset fill color to black
        ctx.globalAlpha = 1; // Reset transparency to opaque
        ctx.lineCap = 'butt'; // Reset line cap to default
        ctx.lineJoin = 'miter'; // Reset line join to default

        console.log('🎨 Canvas context settings reset to defaults for practice mode');

        // CRITICAL: Update global canvas and context references
        window.canvas = canvas;
        window.ctx = ctx;
        console.log('🎨 Updated global canvas and ctx references');

        // Reset all canvas-related state variables completely
        window.currentVector = null;
        window.vectorCutActive = false;
        window.isDrawingVector = false;
        window.vectorStart = null;
        window.vectorEnd = null;
        window.dragDistance = 0;

        // Forcefully set practice mode interaction state
        window.gameState = 'cutting';
        window.isInteractionEnabled = true;

        // Also set local variables that might be checked
        if (typeof isInteractionEnabled !== 'undefined') {
            isInteractionEnabled = true;
        }
        if (typeof gameState !== 'undefined') {
            gameState = 'cutting';
        }

        canvas.style.pointerEvents = 'auto';
        canvas.style.cursor = 'crosshair';

        // Clear any main game state that might interfere
        if (window.currentAttempts) window.currentAttempts = [];
        if (window.attemptCount) window.attemptCount = 0;

        // Redraw grid and current practice shape
        if (window.drawGrid) window.drawGrid(ctx);
        this.renderPracticeShape();

        console.log('✅ Canvas completely reset for practice mode');
    }

    /**
     * Close practice mode and restore daily mode
     */
    async close() {
        console.log('🔚 Closing practice mode...');

        // Before closing, save current practice state
        const hadActiveCut = this.hasActiveCut;

        this.isActive = false;

        // Stop shape protection monitoring
        if (this.shapeProtectionInterval) {
            clearInterval(this.shapeProtectionInterval);
            this.shapeProtectionInterval = null;
            console.log('🛡️ Shape protection monitoring stopped');
        }

        // Clear practice shapes completely FIRST
        window.parsedShapes = [];
        this.originalShapes = [];
        this.practiceParsedShapes = [];

        // If had active cut, clear canvas completely
        if (hadActiveCut) {
            const canvas = document.getElementById('geoCanvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                console.log('🧹 Cleared canvas from active cut state');
            }
        }

        // Restore original redrawCanvas function
        if (this.originalRedrawCanvas) {
            window.redrawCanvas = this.originalRedrawCanvas;
            this.originalRedrawCanvas = null;
            console.log('🔄 Restored original redrawCanvas function');
        }

        // Restore original renderShapesForPixelAnalysis function
        if (this.originalRenderShapesForPixelAnalysis) {
            window.renderShapesForPixelAnalysis = this.originalRenderShapesForPixelAnalysis;
            this.originalRenderShapesForPixelAnalysis = null;
            console.log('🔄 Restored original renderShapesForPixelAnalysis function');
        }

        // Clear practice mode flags
        window.isPracticeMode = false;
        window.isDailyMode = true;

        // CRITICAL: Restore daily shapes by reloading from daily mode system
        if (window.DailyGameCore && window.DailyGameCore.getCurrentShapeData) {
            try {
                const dailyShapeData = await window.DailyGameCore.getCurrentShapeData();
                if (dailyShapeData) {
                    const parseResult = window.parseGeometry(dailyShapeData);
                    if (parseResult && parseResult.shapes) {
                        window.parsedShapes = parseResult.shapes;

                        if (window.currentMechanic) {
                            window.currentMechanic.originalShapes = [...parseResult.shapes];
                        }

                        console.log(`🔄 Restored ${parseResult.shapes.length} daily shapes from DailyGameCore`);
                    }
                }
            } catch (error) {
                console.error('❌ Failed to restore daily shapes from DailyGameCore:', error);
                // Fallback to saved shapes
                this.restoreSavedDailyShapes();
            }
        } else {
            // Fallback to saved shapes
            this.restoreSavedDailyShapes();
        }

        // CRITICAL: Restore section state and header title
        if (typeof window.currentSection !== 'undefined') {
            window.currentSection = 'daily';
        }

        // Restore the daily mode header title immediately
        if (window.updateDateTitle && typeof window.updateDateTitle === 'function') {
            window.updateDateTitle();
            console.log('🔄 Restored daily mode header title');
        }

        // CRITICAL: Set flag to indicate we returned from practice mode
        window.returnedFromPracticeMode = true;

        // CRITICAL: Restore daily game state using SimpleRefresh system
        if (window.SimpleRefresh && window.SimpleRefresh.restore) {
            console.log('🔄 Restoring daily game state using SimpleRefresh system...');
            const restoredState = window.SimpleRefresh.restore();

            if (restoredState) {
                console.log('✅ Daily game state restored successfully from SimpleRefresh');
                console.log('📊 Restored state:', {
                    gameState: restoredState.gameState,
                    currentShapeIndex: restoredState.currentShapeIndex,
                    totalCuts: restoredState.totalCuts,
                    cutsThisShape: restoredState.cutsThisShape
                });

                // Trigger UI updates to reflect restored state
                setTimeout(() => {
                    // Hide initial welcome buttons that should not be visible during active gameplay
                    if (typeof window.hideInitialWelcomeButtons === 'function') {
                        window.hideInitialWelcomeButtons();
                        console.log('🧹 Initial welcome buttons hidden after daily mode restoration');
                    }

                    if (typeof window.updateProgressDisplay === 'function') {
                        window.updateProgressDisplay();
                        console.log('🔄 Progress display updated after state restoration');
                    }

                    // Ensure canvas is properly restored with DAILY shapes (not demo shapes)
                    if (window.DailyGameCore && window.DailyGameCore.getShapeData && restoredState.currentShape) {
                        console.log('🔄 DAILY MODE: Restoring daily shape after exiting practice mode...');

                        // Load the correct daily shape from DailyGameCore
                        const dailyShapeData = window.DailyGameCore.getShapeData(restoredState.currentShape);
                        if (dailyShapeData) {
                            // Set the current shape data
                            window.currentGeoJSON = dailyShapeData;

                            // Parse the daily shape
                            const parseResult = window.parseGeometry(dailyShapeData);
                            console.log(`🔄 DAILY MODE: Re-parsed daily shape ${restoredState.currentShape} after practice exit:`, parseResult);

                            // Render the daily shape
                            window.renderShapeForCutting(window.parsedShapes, false);
                            console.log(`✅ DAILY MODE: Daily shape ${restoredState.currentShape} restored after practice mode exit`);
                        } else {
                            console.error(`❌ DAILY MODE: Failed to restore daily shape ${restoredState.currentShape} after practice exit`);
                            // Fallback to redrawCanvas
                            if (typeof window.redrawCanvas === 'function') {
                                window.redrawCanvas();
                                console.log('🎨 Fallback: Canvas redrawn after state restoration');
                            }
                        }
                    } else if (typeof window.redrawCanvas === 'function') {
                        window.redrawCanvas();
                        console.log('🎨 Canvas redrawn after state restoration');
                    }
                }, 100);
            } else {
                console.log('⚠️ No saved daily game state found in SimpleRefresh');
                // Even without restored state, ensure welcome buttons are hidden during active daily mode
                if (typeof window.hideInitialWelcomeButtons === 'function') {
                    window.hideInitialWelcomeButtons();
                    console.log('🧹 Initial welcome buttons hidden (fallback - no saved state)');
                }
            }
        } else {
            console.log('⚠️ SimpleRefresh system not available for state restoration');
            // Even without SimpleRefresh, ensure welcome buttons are hidden during active daily mode
            if (typeof window.hideInitialWelcomeButtons === 'function') {
                window.hideInitialWelcomeButtons();
                console.log('🧹 Initial welcome buttons hidden (fallback - no SimpleRefresh)');
            }
        }

        // CRITICAL: If rotating mechanic was previously active, restore it properly
        if (window.currentMechanic && window.currentMechanic.name === "Rotating Shape Vector Cut") {
            console.log('🔄 PRACTICE MODE EXIT: Restoring rotating mechanic for daily mode');
            if (typeof window.currentMechanic.exitPracticeMode === 'function') {
                window.currentMechanic.exitPracticeMode();
            }

            // Force a complete restart after a delay to ensure clean state
            setTimeout(() => {
                if (typeof window.currentMechanic.forceRestart === 'function') {
                    console.log('🔄 PRACTICE MODE EXIT: Force restarting rotating mechanic');
                    window.currentMechanic.forceRestart();
                }
            }, 500);
        }

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

        // Restore daily mode elements
        this.restoreDailyModeElements();

        // Restore daily mode content
        this.restoreDailyModeContent();

        // FINAL SAFETY: Ensure play/practice buttons are NEVER visible when exiting practice mode during active game
        if (typeof window.hideInitialWelcomeButtons === 'function') {
            window.hideInitialWelcomeButtons();
            console.log('🛡️ Final safety check: Play/Practice buttons force-hidden on practice mode exit');
        }

        // CRITICAL: Restore daily mode instructions after delay to ensure state is fully restored
        setTimeout(() => {
            this.restoreDailyModeInstructions();
        }, 300);

        // IMMEDIATE AGGRESSIVE INSTRUCTION RESTORATION for daily mode
        this.immediatelyRestoreDailyInstructions();

        // MULTIPLE AGGRESSIVE ATTEMPTS
        setTimeout(() => {
            this.immediatelyRestoreDailyInstructions();
        }, 50);

        setTimeout(() => {
            this.immediatelyRestoreDailyInstructions();
        }, 150);

        setTimeout(() => {
            this.immediatelyRestoreDailyInstructions();
        }, 300);

        setTimeout(() => {
            this.immediatelyRestoreDailyInstructions();
        }, 600);

        setTimeout(() => {
            this.immediatelyRestoreDailyInstructions();
        }, 1000);

        // Stop the periodic instruction monitor
        if (window.stopPracticeInstructionMonitor) {
            window.stopPracticeInstructionMonitor();
        }

        console.log('✅ Practice mode closed');
    }

    /**
     * Restore daily mode elements
     */
    restoreDailyModeElements() {
        const elementsToRestore = [
            'demoProgressDisplay',
            'nextShapeBtn',
            'nextAttemptBtn',
            'fixedButtonArea',
            'welcomeMessage'
        ];

        elementsToRestore.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = '';
            }
        });

        // Restore progress display classes
        const progressElements = document.querySelectorAll('.progress-display, .progression-button');
        progressElements.forEach(el => {
            el.style.display = '';
        });

        // Do NOT restore welcome content during active daily game
        // Welcome content (.welcome-content, .initial-play-container) should only be visible on fresh daily start
        console.log('🚫 Skipping welcome content restoration - only needed on fresh daily start');

        // Do NOT restore Play/Practice buttons when returning from practice mode
        // These buttons should only be visible on initial daily start, not during active games
        console.log('🚫 Skipping Play/Practice button restoration - these should only appear on fresh daily start');

        // Reset instruction area to initial state
        const instructionArea = document.getElementById('instructionArea');
        if (instructionArea) {
            // Keep instruction area visible - daily mode will handle showing it properly
            instructionArea.style.display = 'flex';
            // Don't hide it - let daily mode control visibility
            console.log('📝 Instruction area display set to flex, letting daily mode control visibility');
        }

        // Clear instruction text but will be restored later
        const instructionText = document.getElementById('instructionText');
        if (instructionText) {
            instructionText.textContent = '';
            instructionText.style.fontWeight = '';
            instructionText.style.textAlign = '';
            console.log('📝 Instruction text cleared for daily mode (will be restored)');
        }

        console.log('✅ Daily mode elements and welcome content restored');
    }

    /**
     * Restore daily mode content
     */
    restoreDailyModeContent() {
        console.log('🔄 Restoring daily mode content...');

        // CRITICAL: Force restoration of daily mode shapes if returning from practice
        if (window.returnedFromPracticeMode) {
            console.log('🔄 PRACTICE EXIT: Triggering daily mode shape reload');

            // For rotating mechanic, we need to restore the original daily shapes
            if (window.currentMechanic && window.currentMechanic.name === "Rotating Shape Vector Cut") {
                console.log('🔄 PRACTICE EXIT: Restoring rotating mechanic daily shapes');

                // Trigger a redraw of the daily canvas state
                setTimeout(() => {
                    if (typeof window.restoreCurrentGameState === 'function') {
                        console.log('🔄 PRACTICE EXIT: Calling restoreCurrentGameState');
                        window.restoreCurrentGameState();
                    } else if (window.redrawCanvas && typeof window.redrawCanvas === 'function') {
                        console.log('🔄 PRACTICE EXIT: Calling redrawCanvas fallback');
                        window.redrawCanvas();
                    }
                }, 200);
            } else {
                // For other mechanics, use standard redraw
                setTimeout(() => {
                    if (window.redrawCanvas && typeof window.redrawCanvas === 'function') {
                        window.redrawCanvas();
                        console.log('✅ Daily mode canvas content restored');
                    }
                }, 100);
            }
        } else {
            // Standard restoration path
            if (window.redrawCanvas && typeof window.redrawCanvas === 'function') {
                setTimeout(() => {
                    window.redrawCanvas();
                    console.log('✅ Daily mode canvas content restored');
                }, 100);
            }
        }
    }

    /**
     * Restore daily mode instructions based on current game state
     */
    restoreDailyModeInstructions() {
        console.log('📝 Restoring daily mode instructions...');

        // Ensure we're in daily mode
        if (window.isPracticeMode) {
            console.log('⚠️ Still in practice mode, skipping instruction restoration');
            return;
        }

        try {
            // Get current game state to determine appropriate instruction
            const currentGameState = window.gameState;
            const isInteractionEnabled = window.isInteractionEnabled;

            console.log('📝 Daily mode state check:', {
                gameState: currentGameState,
                isInteractionEnabled: isInteractionEnabled,
                totalCutsMade: window.totalCutsMade,
                cutsMadeThisShape: window.cutsMadeThisShape
            });

            // Get the current mechanic name for all scenarios
            const mechanicName = window.getCurrentMechanicName ? window.getCurrentMechanicName() : null;

            if (!mechanicName) {
                console.log('⚠️ No mechanic name available for instruction restoration');
                return;
            }

            // Determine what instruction to show based on game state
            if (currentGameState === 'cutting' || currentGameState === 'playing') {
                // Game is active and ready for cutting - show initial instruction
                const initialInstruction = window.getInitialInstruction ? window.getInitialInstruction(mechanicName) : null;
                if (initialInstruction && window.updateInstructionText) {
                    window.updateInstructionText(initialInstruction);
                    console.log('📝 Restored daily mode initial instruction:', initialInstruction);
                }
            } else if (currentGameState === 'awaiting_choice' || currentGameState === 'results') {
                // Game is waiting for user choice - try to restore commentary from last attempt
                const lastAttempt = window.currentAttempts && window.currentAttempts.length > 0
                    ? window.currentAttempts[window.currentAttempts.length - 1]
                    : null;

                if (lastAttempt && lastAttempt.commentary && window.updateInstructionText) {
                    window.updateInstructionText(lastAttempt.commentary, true); // true for bold
                    console.log('📝 Restored daily mode commentary:', lastAttempt.commentary);
                } else {
                    // Fallback: generate commentary from last cut if available
                    if (window.totalCutsMade > 0 && window.dailyGameState && window.dailyGameState.cuts) {
                        const lastCut = window.dailyGameState.cuts[window.dailyGameState.cuts.length - 1];
                        if (lastCut && lastCut.leftPercentage !== undefined && lastCut.rightPercentage !== undefined) {
                            const score = 100 - Math.abs(lastCut.leftPercentage - lastCut.rightPercentage);
                            const commentary = window.getPlayfulCommentary ? window.getPlayfulCommentary(score) : 'Cut completed!';
                            if (window.updateInstructionText) {
                                window.updateInstructionText(commentary, true);
                                console.log('📝 Generated daily mode commentary from last cut:', commentary);
                            }
                        }
                    }
                }
            } else if (currentGameState === 'finished' || currentGameState === 'locked') {
                // Game is complete - don't show instructions
                console.log('📝 Daily mode is complete, not restoring instructions');
            } else {
                // Default case - show initial instruction
                const initialInstruction = window.getInitialInstruction ? window.getInitialInstruction(mechanicName) : null;
                if (initialInstruction && window.updateInstructionText) {
                    window.updateInstructionText(initialInstruction);
                    console.log('📝 Restored daily mode initial instruction (default):', initialInstruction);
                }
            }

            // SAFETY: Force instruction restoration after additional delay if instruction area is still empty
            setTimeout(() => {
                const instructionText = document.getElementById('instructionText');
                if (instructionText && (!instructionText.textContent || instructionText.textContent.trim() === '')) {
                    console.log('🛡️ SAFETY: Instruction area still empty, forcing restoration');
                    const initialInstruction = window.getInitialInstruction ? window.getInitialInstruction(mechanicName) : null;
                    if (initialInstruction && window.updateInstructionText) {
                        window.updateInstructionText(initialInstruction);
                        console.log('🛡️ SAFETY: Force-restored instruction:', initialInstruction);
                    }
                }
            }, 1000);

        } catch (error) {
            console.error('❌ Error restoring daily mode instructions:', error);

            // Fallback: try to get basic initial instruction
            try {
                const mechanicName = window.getCurrentMechanicName ? window.getCurrentMechanicName() : null;
                if (mechanicName) {
                    const initialInstruction = window.getInitialInstruction ? window.getInitialInstruction(mechanicName) : null;
                    if (initialInstruction && window.updateInstructionText) {
                        window.updateInstructionText(initialInstruction);
                        console.log('📝 Fallback: Restored basic initial instruction:', initialInstruction);
                    }
                }
            } catch (fallbackError) {
                console.error('❌ Fallback instruction restoration also failed:', fallbackError);
            }
        }
    }

    /**
     * Force practice mode instruction restoration
     */
    forcePracticeInstructionRestoration() {
        if (!window.isPracticeMode) {
            // Not in practice mode, don't interfere
            return;
        }

        console.log('🛡️ FORCE: Attempting emergency practice instruction restoration');

        const instructionText = document.getElementById('instructionText');
        if (!instructionText) {
            console.error('🛡️ FORCE: Practice instruction text element not found');
            return;
        }

        // Check if instruction area is empty
        const currentText = instructionText.textContent?.trim() || '';
        if (currentText === '' || currentText === 'Loading...' || currentText === 'Click to start') {
            console.log('🛡️ FORCE: Practice instruction area is empty, forcing restoration');

            // Get current mechanic and force instruction
            try {
                const dayInfo = this.getCurrentDayMechanic();
                if (dayInfo && window.getInitialInstruction && window.updateInstructionText) {
                    const initialInstruction = window.getInitialInstruction(dayInfo.mechanicName);
                    if (initialInstruction) {
                        window.updateInstructionText(initialInstruction);
                        this.practiceInstruction = initialInstruction;
                        console.log('🛡️ FORCE: Emergency practice instruction restoration successful:', initialInstruction);
                        return;
                    }
                }

                // Fallback: use generic practice instruction
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const fallbackInstruction = isMobile ? 'Tap and hold to start cutting' : 'Click and hold to start cutting';
                window.updateInstructionText(fallbackInstruction);
                this.practiceInstruction = fallbackInstruction;
                console.log('🛡️ FORCE: Emergency practice fallback instruction set:', fallbackInstruction);

            } catch (error) {
                console.error('🛡️ FORCE: Emergency practice instruction restoration failed:', error);
            }
        } else {
            console.log('🛡️ FORCE: Practice instruction area has content, no restoration needed:', currentText);
        }
    }

    /**
     * NUCLEAR instruction restoration - bypasses ALL checks, forces practice instructions regardless of state
     * This is the most aggressive option for when practice mode is opened from completion state
     */
    nuclearInstructionRestoration() {
        console.log('☢️ NUCLEAR: Forcing practice instruction restoration - bypassing ALL checks');

        // First, ensure the instruction area is visible
        const instructionArea = document.getElementById('instructionArea');
        if (instructionArea) {
            instructionArea.style.display = 'flex';
            instructionArea.style.visibility = 'visible';
            instructionArea.style.opacity = '1';
            console.log('☢️ NUCLEAR: Made instruction area visible');
        }

        let instructionText = document.getElementById('instructionText');
        if (!instructionText) {
            console.log('☢️ NUCLEAR: Instruction text element not found - CREATING IT');

            // Create the missing instructionText element
            instructionText = document.createElement('div');
            instructionText.id = 'instructionText';
            instructionText.className = 'instruction-text';
            instructionText.style.textAlign = 'center';
            instructionText.style.padding = '10px';

            // Add it to the instruction area
            if (instructionArea) {
                instructionArea.appendChild(instructionText);
                console.log('☢️ NUCLEAR: Created instructionText element inside instructionArea');
            } else {
                // If no instruction area, add to document body as fallback
                document.body.appendChild(instructionText);
                console.log('☢️ NUCLEAR: Created instructionText element in document body');
            }
        }

        // Use the instructionText element we just ensured exists
        if (!instructionText) {
            console.error('☢️ NUCLEAR: Still cannot find instruction text element - aborting');
            return;
        }

        // Get current mechanic name - try EVERY possible source
        let mechanicName = null;

        // Try practice mode specific sources first
        if (this.practiceShapes && this.practiceShapes.length > 0) {
            const currentShape = this.practiceShapes[this.currentShapeIndex];
            if (currentShape && currentShape.day) {
                const dayNames = ['', 'Standard Vector Cut', 'Line Vector Cut', 'Shrinking Vector Cut',
                                'Drawing Vector Cut', 'Touch Vector Cut', 'Rotating Shape Vector Cut', 'Quadrant Vector Cut'];
                mechanicName = dayNames[currentShape.day] || 'Standard Vector Cut';
            }
        }

        // Try global sources
        if (!mechanicName && window.getCurrentMechanicName) {
            mechanicName = window.getCurrentMechanicName();
        }

        if (!mechanicName && window.currentMechanic && window.currentMechanic.name) {
            mechanicName = window.currentMechanic.name;
        }

        if (!mechanicName) {
            // Ultimate fallback - use current day
            const dayNames = ['', 'Standard Vector Cut', 'Line Vector Cut', 'Shrinking Vector Cut',
                            'Drawing Vector Cut', 'Touch Vector Cut', 'Rotating Shape Vector Cut', 'Quadrant Vector Cut'];
            const currentDay = window.currentDay || 1;
            mechanicName = dayNames[currentDay] || 'Standard Vector Cut';
        }

        // Force instruction immediately - try multiple sources
        let instruction = '';

        // Try the official instruction function
        if (window.getInitialInstruction) {
            instruction = window.getInitialInstruction(mechanicName);
        }

        // If that didn't work, create our own instruction
        if (!instruction || instruction.trim() === '') {
            instruction = `Practice cutting shapes with ${mechanicName}`;
        }

        // NUCLEAR FORCE - Set the instruction with maximum visibility
        instructionText.textContent = instruction;
        instructionText.style.fontWeight = 'normal';
        instructionText.style.textAlign = 'center';
        instructionText.style.opacity = '1';
        instructionText.style.display = 'block';
        instructionText.style.visibility = 'visible';
        instructionText.style.position = 'relative';
        instructionText.style.zIndex = '9999';
        instructionText.style.color = 'black';
        instructionText.style.backgroundColor = 'transparent';

        console.log('☢️ NUCLEAR: Practice instruction FORCEFULLY set:', instruction);
        console.log('☢️ NUCLEAR: Mechanic name used:', mechanicName);
        console.log('☢️ NUCLEAR: isPracticeMode flag:', window.isPracticeMode);
        console.log('☢️ NUCLEAR: Element visibility:', {
            opacity: instructionText.style.opacity,
            display: instructionText.style.display,
            visibility: instructionText.style.visibility
        });
    }

    /**
     * IMMEDIATE instruction restoration for practice mode - no conditions, just force it
     */
    immediateInstructionRestoration() {
        if (!window.isPracticeMode) {
            console.log('🛡️ IMMEDIATE: Not in practice mode, skipping');
            return;
        }

        console.log('🛡️ IMMEDIATE: Forcing practice instruction restoration NOW');

        // First, ensure the instruction area is visible
        const instructionArea = document.getElementById('instructionArea');
        if (instructionArea) {
            instructionArea.style.display = 'flex';
            instructionArea.style.visibility = 'visible';
            instructionArea.style.opacity = '1';
            console.log('🛡️ IMMEDIATE: Made instruction area visible');
        }

        let instructionText = document.getElementById('instructionText');
        if (!instructionText) {
            console.log('🛡️ IMMEDIATE: Instruction text element not found - CREATING IT');

            // Create the missing instructionText element
            instructionText = document.createElement('div');
            instructionText.id = 'instructionText';
            instructionText.className = 'instruction-text';

            // Add it to the instruction area
            if (instructionArea) {
                instructionArea.appendChild(instructionText);
                console.log('🛡️ IMMEDIATE: Created instructionText element inside instructionArea');
            } else {
                // If no instruction area, add to document body as fallback
                document.body.appendChild(instructionText);
                console.log('🛡️ IMMEDIATE: Created instructionText element in document body');
            }
        }

        // Get current mechanic name - try multiple sources
        let mechanicName = null;

        if (window.getCurrentMechanicName) {
            mechanicName = window.getCurrentMechanicName();
        }

        if (!mechanicName && window.currentMechanic && window.currentMechanic.name) {
            mechanicName = window.currentMechanic.name;
        }

        if (!mechanicName) {
            // Fallback - use current day to determine mechanic
            const dayNames = ['', 'Standard Vector Cut', 'Line Vector Cut', 'Shrinking Vector Cut',
                            'Drawing Vector Cut', 'Touch Vector Cut', 'Rotating Shape Vector Cut', 'Quadrant Vector Cut'];
            const currentDay = window.currentDay || 1;
            mechanicName = dayNames[currentDay] || 'Standard Vector Cut';
        }

        // Force instruction immediately
        let instruction = '';
        if (window.getInitialInstruction) {
            instruction = window.getInitialInstruction(mechanicName);
        } else {
            // Ultimate fallback
            instruction = `Practice cutting shapes with ${mechanicName}`;
        }

        // FORCE the instruction to appear - bypass ALL suppression
        instructionText.textContent = instruction;
        instructionText.style.fontWeight = 'normal';
        instructionText.style.opacity = '1';
        instructionText.style.display = 'block';
        instructionText.style.visibility = 'visible';

        console.log('🛡️ IMMEDIATE: Practice instruction forced:', instruction);
    }

    /**
     * IMMEDIATELY restore daily mode instructions - no conditions, just force it
     */
    immediatelyRestoreDailyInstructions() {
        if (window.isPracticeMode) {
            console.log('🛡️ IMMEDIATE DAILY: Still in practice mode, skipping');
            return;
        }

        console.log('🛡️ IMMEDIATE DAILY: Forcing daily instruction restoration NOW');

        const instructionText = document.getElementById('instructionText');
        if (!instructionText) {
            console.error('🛡️ IMMEDIATE DAILY: Instruction text element not found');
            return;
        }

        // Get current mechanic name
        let mechanicName = null;

        if (window.getCurrentMechanicName) {
            mechanicName = window.getCurrentMechanicName();
        }

        if (!mechanicName && window.currentMechanic && window.currentMechanic.name) {
            mechanicName = window.currentMechanic.name;
        }

        if (!mechanicName) {
            // Fallback - use current day to determine mechanic
            const dayNames = ['', 'Standard Vector Cut', 'Line Vector Cut', 'Shrinking Vector Cut',
                            'Drawing Vector Cut', 'Touch Vector Cut', 'Rotating Shape Vector Cut', 'Quadrant Vector Cut'];
            const currentDay = window.currentDay || 1;
            mechanicName = dayNames[currentDay] || 'Standard Vector Cut';
        }

        // Determine what instruction to show based on game state
        let instruction = '';

        // Check if we have a recent cut that should show commentary
        if (window.dailyGameState && window.dailyGameState.cuts && window.dailyGameState.cuts.length > 0) {
            const lastCut = window.dailyGameState.cuts[window.dailyGameState.cuts.length - 1];

            // Check if this cut was recent (within current session)
            if (lastCut && lastCut.leftPercentage !== undefined && lastCut.rightPercentage !== undefined) {
                const score = 100 - Math.abs(lastCut.leftPercentage - lastCut.rightPercentage);

                // Show commentary if we have the function
                if (window.getPlayfulCommentary) {
                    instruction = window.getPlayfulCommentary(score);

                    // FORCE the instruction to appear with bold styling for commentary
                    instructionText.textContent = instruction;
                    instructionText.style.fontWeight = 'bold';
                    instructionText.style.opacity = '1';
                    instructionText.style.display = 'block';
                    instructionText.style.visibility = 'visible';

                    console.log('🛡️ IMMEDIATE DAILY: Commentary forced:', instruction);
                    return;
                }
            }
        }

        // Default to initial instruction
        if (window.getInitialInstruction) {
            instruction = window.getInitialInstruction(mechanicName);
        } else {
            // Ultimate fallback
            instruction = `Cut the shape in half using ${mechanicName}`;
        }

        // FORCE the instruction to appear - bypass ALL suppression
        instructionText.textContent = instruction;
        instructionText.style.fontWeight = 'normal';
        instructionText.style.opacity = '1';
        instructionText.style.display = 'block';
        instructionText.style.visibility = 'visible';

        console.log('🛡️ IMMEDIATE DAILY: Initial instruction forced:', instruction);
    }

    /**
     * Force instruction restoration regardless of state - emergency fallback
     */
    forceInstructionRestoration() {
        if (window.isPracticeMode) {
            // We're still in practice mode, don't interfere
            return;
        }

        console.log('🛡️ FORCE: Attempting emergency instruction restoration');

        const instructionText = document.getElementById('instructionText');
        if (!instructionText) {
            console.error('🛡️ FORCE: Instruction text element not found');
            return;
        }

        // Check if instruction area is empty or has placeholder text
        const currentText = instructionText.textContent?.trim() || '';
        if (currentText === '' || currentText === 'Loading...' || currentText === 'Click to start') {
            console.log('🛡️ FORCE: Instruction area is empty or has placeholder, forcing restoration');

            // Get current mechanic and force instruction
            try {
                const mechanicName = window.getCurrentMechanicName ? window.getCurrentMechanicName() : null;
                if (mechanicName && window.getInitialInstruction && window.updateInstructionText) {
                    const initialInstruction = window.getInitialInstruction(mechanicName);
                    if (initialInstruction) {
                        window.updateInstructionText(initialInstruction);
                        console.log('🛡️ FORCE: Emergency instruction restoration successful:', initialInstruction);
                        return;
                    }
                }

                // Fallback: use generic instruction based on game state
                if (window.gameState === 'cutting' || window.gameState === 'playing') {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    const fallbackInstruction = isMobile ? 'Tap and hold to start cutting' : 'Click and hold to start cutting';
                    window.updateInstructionText(fallbackInstruction);
                    console.log('🛡️ FORCE: Emergency fallback instruction set:', fallbackInstruction);
                }
            } catch (error) {
                console.error('🛡️ FORCE: Emergency instruction restoration failed:', error);
            }
        } else {
            console.log('🛡️ FORCE: Instruction area has content, no restoration needed:', currentText);
        }
    }
}

// Initialize practice mode and make it globally available
window.PracticeMode = new PracticeMode();

// Override the practice button handlers
window.openPractice = function() {
    window.PracticeMode.open();
};

window.openPracticeMode = function() {
    window.PracticeMode.open();
};

// Hook into the canvas mouse events to clear cuts when starting a new cut
const originalSetupVectorCuttingListeners = window.setupVectorCuttingEventListeners;

// Hook into mouse down events to clear previous cuts in practice mode
document.addEventListener('mousedown', function(e) {
    if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.isActive && window.PracticeMode.hasActiveCut) {
        // Only clear if clicking on the canvas
        const canvas = document.getElementById('geoCanvas');
        if (canvas && e.target === canvas) {
            console.log('🧹 Practice mode: Clearing previous cut before new cut');
            window.PracticeMode.clearCutShading();
        }
    }
});

// Hook into touch events for mobile
document.addEventListener('touchstart', function(e) {
    if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.isActive && window.PracticeMode.hasActiveCut) {
        // Only clear if touching the canvas
        const canvas = document.getElementById('geoCanvas');
        if (canvas && e.target === canvas) {
            console.log('🧹 Practice mode: Clearing previous cut before new cut (touch)');
            window.PracticeMode.clearCutShading();
        }
    }
});

console.log('✅ Practice Mode module loaded');

// GLOBAL DEBUG FUNCTION - Force practice instructions regardless of any state
window.forceInstructionsNow = function() {
    console.log('🚨 GLOBAL FORCE: Forcing instructions to appear RIGHT NOW');

    // First, ensure the instruction area is visible
    const instructionArea = document.getElementById('instructionArea');
    if (instructionArea) {
        instructionArea.style.display = 'flex';
        instructionArea.style.visibility = 'visible';
        instructionArea.style.opacity = '1';
        console.log('🚨 GLOBAL FORCE: Made instruction area visible');
    }

    const instructionText = document.getElementById('instructionText');
    if (!instructionText) {
        console.error('🚨 GLOBAL FORCE: No instruction text element found');
        return;
    }

    // Get mechanic name from any source possible
    let mechanicName = 'Standard Vector Cut';

    if (window.getCurrentMechanicName) {
        mechanicName = window.getCurrentMechanicName() || mechanicName;
    }

    if (window.currentMechanic && window.currentMechanic.name) {
        mechanicName = window.currentMechanic.name || mechanicName;
    }

    // Create instruction
    let instruction = '';
    if (window.getInitialInstruction) {
        instruction = window.getInitialInstruction(mechanicName);
    }

    if (!instruction) {
        instruction = `Practice cutting shapes with ${mechanicName}`;
    }

    // FORCE IT
    instructionText.textContent = instruction;
    instructionText.style.display = 'block';
    instructionText.style.visibility = 'visible';
    instructionText.style.opacity = '1';
    instructionText.style.color = 'black';
    instructionText.style.fontWeight = 'normal';
    instructionText.style.textAlign = 'center';

    console.log('🚨 GLOBAL FORCE: Instruction set to:', instruction);
    console.log('🚨 GLOBAL FORCE: Current flags:', {
        isPracticeMode: window.isPracticeMode,
        isDailyMode: window.isDailyMode,
        gameState: window.gameState
    });
};

// Also make it available from practice mode instance
window.debugPracticeInstructions = function() {
    if (window.PracticeMode) {
        console.log('🔧 DEBUG: Calling nuclear restoration directly');
        window.PracticeMode.nuclearInstructionRestoration();
    } else {
        console.log('🔧 DEBUG: No PracticeMode instance, using global force');
        window.forceInstructionsNow();
    }
};

// PERIODIC INSTRUCTION CHECKER for practice mode
let practiceInstructionChecker = null;

window.startPracticeInstructionMonitor = function() {
    if (practiceInstructionChecker) {
        clearInterval(practiceInstructionChecker);
    }

    console.log('🔄 Starting practice instruction monitor');

    practiceInstructionChecker = setInterval(() => {
        if (window.isPracticeMode) {
            const instructionText = document.getElementById('instructionText');
            if (instructionText) {
                const currentText = instructionText.textContent?.trim() || '';
                if (currentText === '' || currentText === 'Loading...' || currentText === 'Click to start') {
                    console.log('🔄 MONITOR: Empty instruction detected in practice mode, forcing restoration');
                    window.forceInstructionsNow();
                }
            }
        } else {
            // Stop monitoring if we're not in practice mode
            if (practiceInstructionChecker) {
                clearInterval(practiceInstructionChecker);
                practiceInstructionChecker = null;
                console.log('🔄 MONITOR: Stopped - not in practice mode');
            }
        }
    }, 1000); // Check every second
};

window.stopPracticeInstructionMonitor = function() {
    if (practiceInstructionChecker) {
        clearInterval(practiceInstructionChecker);
        practiceInstructionChecker = null;
        console.log('🔄 MONITOR: Stopped manually');
    }
};

/**
 * Integration fix to resolve conflicts between practice systems
 */
function fixPracticeModeIntegration() {
    // Hide old navigation buttons that conflict with practice-mode.js
    const oldNavButtons = document.querySelectorAll('#floatingPracticeNav, .practice-navigation-old');
    oldNavButtons.forEach(btn => {
        if (btn.id !== 'practiceNavigation') {
            btn.style.display = 'none';
            console.log('🔧 Hid conflicting practice navigation:', btn.id);
        }
    });

    // Ensure only new practice navigation is visible
    const newPracticeNav = document.getElementById('practiceNavigation');
    if (newPracticeNav && window.isPracticeMode) {
        newPracticeNav.style.display = 'flex';
        console.log('✅ Practice navigation integration fixes applied');
    }
}

// Apply integration fixes when DOM is ready
document.addEventListener('DOMContentLoaded', fixPracticeModeIntegration);

// Also apply when entering practice mode
window.addEventListener('practicemode-entered', fixPracticeModeIntegration);

// Cache version: v=20250915o