/**
 * Simple Practice Mode for Daily Shapes v4.0
 * Basic implementation without complex canvas management
 */

console.log('🔧 SimplePracticeMode script loading...');

class SimplePracticeMode {
    constructor() {
        this.isActive = false;
        this.currentShapeIndex = 0;
        this.practiceShapes = [];
        this.currentVector = null;
        this.isDrawingVector = false;
        this.hasActiveCut = false;
    }

    /**
     * Check if user is authenticated
     */
    isUserLoggedIn() {
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
        
        // Method 3: Check AuthService
        if (window.AuthService && window.AuthService.isLoggedIn && window.AuthService.isLoggedIn()) {
            return true;
        }
        
        return false;
    }

    /**
     * Load practice shapes
     */
    async loadPracticeShapes() {
        const shapeFiles = [
            '250828-01.geojson',
            '250828-02.geojson', 
            '250828-03.geojson',
            '250829-01.geojson',
            '250829-02.geojson',
            '250829-03.geojson'
        ];
        
        for (const file of shapeFiles) {
            try {
                console.log(`Attempting to load: Practice Shapes/${file}`);
                const response = await fetch(`Practice Shapes/${file}`);
                console.log(`Response for ${file}: status ${response.status}, ok: ${response.ok}`);
                
                if (response.ok) {
                    const shapeData = await response.json();
                    console.log(`Successfully loaded ${file}: ${shapeData.features?.length || 0} features`);
                    this.practiceShapes.push({
                        filename: file,
                        data: shapeData,
                        name: file.replace('.geojson', '')
                    });
                } else {
                    console.error(`HTTP error loading ${file}: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                console.error(`Failed to load shape ${file}:`, error);
            }
        }
        
        console.log(`Loaded ${this.practiceShapes.length} practice shapes`);
        return this.practiceShapes.length > 0;
    }

    /**
     * Create practice UI
     */
    createUI() {
        // Hide welcome overlay completely
        const welcomeOverlay = document.getElementById('welcomeOverlay');
        if (welcomeOverlay) {
            welcomeOverlay.style.display = 'none';
        }
        
        // Hide welcome message if it exists
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
        
        // Hide progress display
        const progressDisplay = document.getElementById('demoProgressDisplay');
        if (progressDisplay) {
            progressDisplay.style.display = 'none';
        }
        
        // Create practice container positioned after canvas container
        let container = document.getElementById('practiceContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'practiceContainer';
            container.style.cssText = `
                width: 100%;
                max-width: 400px;
                margin: 20px auto;
                text-align: center;
                z-index: 1000;
                position: relative;
            `;
            
            // Insert after canvas container
            const canvasContainer = document.querySelector('.canvas-container');
            if (canvasContainer && canvasContainer.parentNode) {
                canvasContainer.parentNode.insertBefore(container, canvasContainer.nextSibling);
            }
        }
        
        // Add navigation buttons with vector graphics
        container.innerHTML = `
            <div style="display: flex; justify-content: center; gap: 15px; margin: 20px 0;">
                <button id="practicePrev" onclick="window.SimplePracticeMode.previousShape()" 
                        style="width: 50px; height: 50px; border-radius: 50%; background: white; border: 2px solid #333; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <button id="practiceRandom" onclick="window.SimplePracticeMode.randomShape()" 
                        style="width: 50px; height: 50px; border-radius: 50%; background: white; border: 2px solid #333; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2">
                        <rect x="3" y="3" width="6" height="6"/>
                        <rect x="15" y="3" width="6" height="6"/>
                        <rect x="3" y="15" width="6" height="6"/>
                        <rect x="15" y="15" width="6" height="6"/>
                        <circle cx="6" cy="6" r="1" fill="#333"/>
                        <circle cx="18" cy="18" r="1" fill="#333"/>
                        <circle cx="6" cy="18" r="1" fill="#333"/>
                        <circle cx="18" cy="6" r="1" fill="#333"/>
                    </svg>
                </button>
                <button id="practiceReset" onclick="window.SimplePracticeMode.resetCut()" 
                        style="width: 50px; height: 50px; border-radius: 50%; background: white; border: 2px solid #333; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2">
                        <path d="M1 4v6h6"/>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                </button>
                <button id="practiceNext" onclick="window.SimplePracticeMode.nextShape()" 
                        style="width: 50px; height: 50px; border-radius: 50%; background: white; border: 2px solid #333; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </button>
            </div>
            <div id="practicePercentageDisplay" style="text-align: center; margin: 20px 0; display: none; font-size: 24px;"></div>
            <button onclick="window.SimplePracticeMode.close()" 
                    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; margin: 20px; font-weight: bold;">
                Return to Game
            </button>
        `;
    }

    /**
     * Setup canvas event listeners
     */
    /**
     * Initialize practice mode integration with main game systems
     */
    initializePracticeIntegration() {
        // Store reference to canvas
        this.canvas = document.getElementById('geoCanvas');
        this.ctx = this.canvas?.getContext('2d');
        
        // Add practice-specific event listeners that will work with our state
        this.setupPracticeEventListeners();
        
        // Hook into the main game's result display system
        this.setupPracticeResultDisplay();
        
        console.log('✅ Practice mode integration initialized');
    }
    
    /**
     * Setup practice-specific event listeners
     */
    setupPracticeEventListeners() {
        if (!this.canvas) return;
        
        // Store references to handle removal later
        this.practiceMouseDown = (e) => this.handlePracticeMouseDown(e);
        this.practiceMouseMove = (e) => this.handlePracticeMouseMove(e);
        this.practiceMouseUp = (e) => this.handlePracticeMouseUp(e);
        
        // Add our own event listeners with higher priority
        this.canvas.addEventListener('mousedown', this.practiceMouseDown, true);
        this.canvas.addEventListener('mousemove', this.practiceMouseMove, true);
        this.canvas.addEventListener('mouseup', this.practiceMouseUp, true);
        
        // Also handle touch events
        this.canvas.addEventListener('touchstart', this.practiceMouseDown, true);
        this.canvas.addEventListener('touchmove', this.practiceMouseMove, true);
        this.canvas.addEventListener('touchend', this.practiceMouseUp, true);
        
        console.log('🎯 Practice event listeners attached');
    }
    
    /**
     * Handle mouse down in practice mode
     */
    handlePracticeMouseDown(e) {
        if (!window.practiceMode) return;
        
        console.log('🖱️ Practice mouse down detected');
        
        // Prevent event from bubbling to main game handlers
        e.stopPropagation();
        e.preventDefault();
        
        // Get click position
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
        
        // Store cut start position
        this.cutStart = { x, y };
        this.isCutting = true;
        
        console.log(`📍 Cut started at (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
    
    /**
     * Handle mouse move in practice mode
     */
    handlePracticeMouseMove(e) {
        if (!window.practiceMode || !this.isCutting || !this.cutStart) return;
        
        e.stopPropagation();
        e.preventDefault();
        
        // Get current position
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
        
        // Store last position for touchend events
        this.lastMoveX = x;
        this.lastMoveY = y;
        
        // Clear canvas and redraw shape
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Redraw grid
            if (window.drawGrid) {
                window.drawGrid();
            }
            
            // Redraw shape
            if (window.renderShapeForCutting && window.parsedShapes) {
                window.renderShapeForCutting(window.parsedShapes, true);
            }
            
            // Draw cut preview line
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.cutStart.x, this.cutStart.y);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }
    
    /**
     * Handle mouse up in practice mode
     */
    handlePracticeMouseUp(e) {
        if (!window.practiceMode || !this.isCutting || !this.cutStart) return;
        
        console.log('🖱️ Practice mouse up detected');
        
        e.stopPropagation();
        e.preventDefault();
        
        // Get end position - handle both mouse and touch events
        const rect = this.canvas.getBoundingClientRect();
        let x, y;
        
        if (e.type === 'touchend' && e.changedTouches && e.changedTouches[0]) {
            x = e.changedTouches[0].clientX - rect.left;
            y = e.changedTouches[0].clientY - rect.top;
        } else if (e.clientX !== undefined && e.clientY !== undefined) {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        } else {
            // Use last known position from move event
            x = this.lastMoveX || this.cutStart.x;
            y = this.lastMoveY || this.cutStart.y;
        }
        
        const cutEnd = { x, y };
        
        // Process the cut
        this.processPracticeCut(this.cutStart, cutEnd);
        
        // Reset cutting state
        this.isCutting = false;
        this.cutStart = null;
        this.lastMoveX = null;
        this.lastMoveY = null;
    }
    
    /**
     * Process a cut in practice mode
     */
    processPracticeCut(start, end) {
        console.log(`✂️ Processing cut from (${start.x.toFixed(1)}, ${start.y.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.y.toFixed(1)})`);
        
        // Calculate cut result using simple geometry since main game integration is problematic
        const result = this.calculatePracticeCutResult(start, end);
        
        // Display the result
        this.displayPracticeResults(result);
        
        // Render the cut result on canvas
        this.renderCutResult(result, start, end);
    }
    
    /**
     * Calculate cut result for practice mode
     */
    calculatePracticeCutResult(start, end) {
        // Simple perpendicular distance calculation for split percentage
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // Calculate where the line crosses the canvas
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        
        // Simple left/right split based on vertical position
        let leftArea, rightArea;
        
        // Calculate approximate areas based on cut line
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const perpAngle = angle + Math.PI / 2;
        
        // Estimate split based on center point
        const centerOffset = midX / canvasWidth;
        leftArea = centerOffset * 100;
        rightArea = (1 - centerOffset) * 100;
        
        // Add some variation based on angle
        const angleAdjust = Math.sin(angle) * 10;
        leftArea += angleAdjust;
        rightArea -= angleAdjust;
        
        // Ensure percentages are valid
        leftArea = Math.max(5, Math.min(95, leftArea));
        rightArea = 100 - leftArea;
        
        const score = 100 - Math.abs(50 - leftArea) * 2;
        
        return {
            leftPercentage: leftArea,
            rightPercentage: rightArea,
            score: Math.max(0, score)
        };
    }
    
    /**
     * Render cut result on canvas using pixel-by-pixel approach like daily game mode
     */
    renderCutResult(result, start, end) {
        if (!this.ctx) return;
        
        // Clear canvas and draw grid
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (window.drawGrid) {
            window.drawGrid();
        }
        
        // Create temporary canvas to render shapes for pixel analysis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Render shapes on temp canvas for pixel detection
        this.renderShapesForPixelAnalysis(tempCtx, this.currentShapes);
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        // Create result image data to match daily game mode rendering
        const resultImageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        const resultPixels = resultImageData.data;
        
        // Process pixels exactly like daily game mode
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                const pixelIndex = (y * this.canvas.width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                // Check if pixel is part of the shape (grey fill from renderShapesForPixelAnalysis)
                if (r === 221 && g === 221 && b === 221) {
                    // Determine which side of the cut line this pixel is on
                    if (this.isPixelLeftOfCutLine(x, y, start, end)) {
                        // Blue for left side (matches daily game mode color)
                        resultPixels[pixelIndex] = 100;
                        resultPixels[pixelIndex + 1] = 150;
                        resultPixels[pixelIndex + 2] = 255;
                        resultPixels[pixelIndex + 3] = 255;
                    } else {
                        // Grey for right side (unchanged)
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
        
        // Apply the colored result
        this.ctx.putImageData(resultImageData, 0, 0);
        
        // Draw grid lines over the result
        if (window.drawGridLinesOnly) {
            window.drawGridLinesOnly();
        }
        
        // Draw shape outlines
        if (window.drawShapeOutlines) {
            window.drawShapeOutlines();
        }
        
        // Draw the final cut vector
        this.drawFinalCutVector(start, end);
    }
    
    
    /**
     * Setup practice result display integration
     */
    setupPracticeResultDisplay() {
        // Store original result display function if it exists
        if (window.displayCutResults) {
            this.originalDisplayResults = window.displayCutResults;
        }
        
        // Override result display to show in practice UI
        window.displayCutResults = (results) => {
            console.log('🎯 Practice mode intercepting cut results:', results);
            this.displayPracticeResults(results);
            
            // Still call original if it existed (for compatibility)
            if (this.originalDisplayResults) {
                this.originalDisplayResults(results);
            }
        };
        
        // Also hook into any percentage display updates
        if (window.updatePercentageDisplay) {
            this.originalUpdatePercentage = window.updatePercentageDisplay;
            window.updatePercentageDisplay = (leftPercent, rightPercent, score) => {
                this.displayPracticeResults({
                    leftPercentage: leftPercent,
                    rightPercentage: rightPercent,
                    score: score
                });
                
                if (this.originalUpdatePercentage) {
                    this.originalUpdatePercentage(leftPercent, rightPercent, score);
                }
            };
        }
        
        // CRITICAL FIX: Override renderVectorCutResult for practice mode
        this.setupRenderOverride();
    }

    /**
     * Setup robust render override that survives daily mode initialization
     */
    setupRenderOverride() {
        // Store reference to current renderVectorCutResult (might have been overridden by daily mode)
        this.originalRenderVectorCutResult = window.renderVectorCutResult;
        
        // Create a robust override that checks practice mode state more reliably
        window.renderVectorCutResult = (areaResults) => {
            console.log('🎯 renderVectorCutResult called - checking practice mode state:', {
                practiceMode: window.practiceMode,
                simplePracticeModeActive: window.SimplePracticeMode && window.SimplePracticeMode.isActive,
                isActive: this.isActive
            });
            
            // More robust check: Use SimplePracticeMode global reference and multiple conditions
            const isPracticeModeActive = (window.practiceMode && this.isActive) || 
                                       (window.SimplePracticeMode && window.SimplePracticeMode.isActive);
            
            if (isPracticeModeActive) {
                console.log('🎯 Practice mode intercepting renderVectorCutResult:', areaResults);
                // Use practice mode's own rendering with proper cut shading
                if (window.currentVector) {
                    // Use the global SimplePracticeMode instance to ensure we have the right context
                    const practiceInstance = window.SimplePracticeMode || this;
                    practiceInstance.renderCutResult(areaResults, window.currentVector.start, window.currentVector.end);
                } else {
                    console.warn('⚠️ No currentVector available for practice mode rendering');
                }
                // Also display results in practice UI
                const practiceInstance = window.SimplePracticeMode || this;
                practiceInstance.displayPracticeResults(areaResults);
            } else if (this.originalRenderVectorCutResult) {
                // Call original function for daily mode
                console.log('🎯 Calling original renderVectorCutResult for daily mode');
                this.originalRenderVectorCutResult(areaResults);
            } else {
                console.warn('⚠️ No original renderVectorCutResult function available');
            }
        };
        
        console.log('🎯 Practice mode render override established');
    }

    /**
     * Load and display a shape
     */
    loadShape(index) {
        if (index < 0 || index >= this.practiceShapes.length) return;
        
        this.currentShapeIndex = index;
        const shape = this.practiceShapes[index];
        
        console.log(`Loading practice shape ${index + 1}:`, shape.name);
        
        // Set the shape data in the format the main game expects
        window.currentShapeData = shape.data;
        
        // Parse and set the shape data for the main game's rendering system
        if (shape.data && shape.data.features && shape.data.features.length > 0) {
            console.log(`Processing ${shape.data.features.length} features in GeoJSON`);
            
            const shapes = [];
            
            // Process all features - each feature is a separate shape
            shape.data.features.forEach((feature, featureIndex) => {
                if (feature.geometry && feature.geometry.coordinates) {
                    console.log(`Feature ${featureIndex + 1} coordinates:`, feature.geometry.coordinates);
                    
                    const coordinates = feature.geometry.coordinates;
                    
                    if (coordinates && coordinates[0] && coordinates[0][0] && coordinates[0][0][0]) {
                        const multiPolygon = coordinates[0][0]; // Get to the actual polygon level
                        
                        if (multiPolygon && multiPolygon.length > 0) {
                            // First polygon is the outer ring
                            const outerRing = multiPolygon[0];
                            console.log(`Feature ${featureIndex + 1}: Main shape with ${outerRing.length} points`);
                            
                            // Remaining polygons are holes within this feature
                            const holes = [];
                            for (let i = 1; i < multiPolygon.length; i++) {
                                if (multiPolygon[i] && multiPolygon[i].length > 0) {
                                    console.log(`Feature ${featureIndex + 1}: Adding hole with ${multiPolygon[i].length} points`);
                                    holes.push(multiPolygon[i]);
                                }
                            }
                            
                            // Create a shape for this feature
                            shapes.push({
                                outerRing: outerRing,
                                holes: holes
                            });
                            
                            console.log(`Feature ${featureIndex + 1}: Created shape with ${holes.length} holes`);
                        }
                    }
                }
            });
            
            console.log('Created shapes array:', shapes.length, 'shapes total');
            window.parsedShapes = shapes;
            
            // Also set the raw shape data
            window.currentShape = shape.data;
            
            // Use main game rendering system directly with reference coordinates
            if (window.renderShapeForCutting && window.parsedShapes && window.parsedShapes.length > 0) {
                // Clear canvas first
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                // Use main game's draw grid
                if (window.drawGrid) {
                    window.drawGrid(this.ctx);
                } else {
                    this.practiceDrawGrid();
                }
                
                // Use direct coordinates (reference coordinates from GeoJSON)
                console.log('Using main game renderShapeForCutting with useDirectCoordinates=true');
                console.log('Shapes to render:', window.parsedShapes);
                window.renderShapeForCutting(window.parsedShapes, true, this.ctx);
            } else {
                console.error('Main game rendering not available or no shapes parsed');
            }
        }
        
        // Load current day's mechanic for practice mode
        this.setupPracticeMechanic();
        
        // Enable canvas interaction
        this.enablePracticeInteraction();
        
        this.resetCut();
    }

    /**
     * Setup practice mechanic (use current day's mechanic)
     */
    setupPracticeMechanic() {
        // Define day mechanics mapping (PRACTICE MODE SPECIFIC)
        // IMPORTANT: Sunday uses DefaultWithUndoMechanic, NOT RotatingShapeVectorMechanic
        const dayMechanics = {
            1: 'DefaultWithUndoMechanic',      // Monday
            2: 'HorizontalOnlyMechanic',       // Tuesday
            3: 'DiagonalAscendingMechanic',    // Wednesday
            4: 'CircleCutMechanic',             // Thursday
            5: 'ThreePointTriangleMechanic',   // Friday
            6: 'RotatingSquareMechanic',       // Saturday
            7: 'DefaultWithUndoMechanic'       // Sunday - Practice always uses Straight Line Cutter
        };
        
        // Use current day from main game, or default to 1
        const currentDay = window.currentDay || new Date().getDay() || 7; // Sunday = 0, convert to 7
        const adjustedDay = currentDay === 0 ? 7 : currentDay;
        
        const mechanicClassName = dayMechanics[adjustedDay];
        console.log(`🔧 Practice mode loading mechanic for day ${adjustedDay} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][currentDay]}): ${mechanicClassName}`);
        
        if (mechanicClassName && window[mechanicClassName]) {
            window.currentMechanic = window[mechanicClassName];
            console.log('✅ Practice mechanic loaded:', window.currentMechanic.name);
        } else {
            console.warn('⚠️ Practice mechanic not found, using DefaultWithUndoMechanic');
            window.currentMechanic = window.DefaultWithUndoMechanic;
        }
    }
    
    /**
     * Enable canvas interaction for practice mode
     */
    enablePracticeInteraction() {
        // Store practice mode flag to prevent other systems from interfering
        window.practiceMode = true;
        
        // Enable interaction globally (sync with main game)
        window.isInteractionEnabled = true;
        if (window.enableCanvasInteraction) {
            window.enableCanvasInteraction();
        }
        
        // Ensure main game state is properly set for cutting
        if (window.parsedShapes && window.parsedShapes.length > 0) {
            window.gameState = 'playing'; // Set game state to allow cutting
        }
        
        // DO NOT call setupMechanicsEventListeners as it clones the canvas and breaks state
        // The event listeners should already be set up from main game initialization
        
        // Force state persistence with multiple retries to overcome any interference
        const applyPracticeState = () => {
            if (window.practiceMode) {
                window.isInteractionEnabled = true;
                window.gameState = 'playing';
                // Ensure mechanic stays loaded
                if (!window.currentMechanic && window.DefaultWithUndoMechanic) {
                    window.currentMechanic = window.DefaultWithUndoMechanic;
                }
                console.log('🔒 Practice mode state applied:', {
                    isInteractionEnabled: window.isInteractionEnabled,
                    gameState: window.gameState,
                    hasMechanic: !!window.currentMechanic,
                    mechanicName: window.currentMechanic?.name,
                    parsedShapes: window.parsedShapes?.length
                });
            }
        };
        
        // Apply state immediately and with delays to ensure persistence
        applyPracticeState();
        setTimeout(applyPracticeState, 50);
        setTimeout(applyPracticeState, 100);
        setTimeout(applyPracticeState, 200);
        
        console.log('🎯 Practice mode: Canvas interaction enabled');
        console.log('   Mechanic:', window.currentMechanic?.name);
        console.log('   Interaction enabled:', window.isInteractionEnabled);
        console.log('   Game state:', window.gameState);
        console.log('   Parsed shapes:', window.parsedShapes?.length || 0);
        console.log('   Practice mode flag:', window.practiceMode);
    }

    /**
     * Practice mode doesn't need custom cutting logic - 
     * the main game's event handlers will call performVectorCut()
     * which handles all the cutting mechanics properly.
     * 
     * We just need to ensure cut results are displayed in practice UI.
     */

    /**
     * Display cut results in practice UI (matches daily game format)
     */
    displayPracticeResults(results) {
        console.log('📊 Displaying practice results:', results);
        
        // Find practice percentage display area
        const percentageDisplay = document.getElementById('practicePercentageDisplay');
        if (!percentageDisplay) {
            console.warn('Practice percentage display area not found');
            return;
        }
        
        // Clear existing content
        percentageDisplay.innerHTML = '';
        
        // Create split display matching exact daily game style
        if (results.leftPercentage !== undefined && results.rightPercentage !== undefined) {
            // Use exact same colors as daily game mode
            const blueColor = 'rgb(100, 150, 255)';
            const greyColor = '#999999';
            
            const splitDisplay = document.createElement('div');
            splitDisplay.className = 'split-display-large';
            splitDisplay.innerHTML = `
                <span style="color: ${blueColor}; font-weight: bold;">${results.leftPercentage.toFixed(1)}%</span><span style="color: ${greyColor}; font-weight: bold; font-size: 45%; vertical-align: 25%; line-height: 1;"> / ${results.rightPercentage.toFixed(1)}%</span>
            `;
            // Add margin-bottom to split display to create space for score text below
            splitDisplay.style.marginBottom = '25px';

            percentageDisplay.appendChild(splitDisplay);
            percentageDisplay.style.display = 'block';
            
            // Calculate and display score with perfect split detection
            let score;
            const error = Math.abs(50 - results.leftPercentage);
            // Always apply perfect split detection: if very close to 50/50, award exact 100
            if (error <= 0.05) {
                score = 100.0;
            } else if (results.score !== undefined) {
                // Use the provided score if not a perfect cut
                score = results.score;
            } else {
                // Calculate standard score if none was provided
                score = 100 - error * 2;
            }

            this.hasActiveCut = true;
            console.log(`✅ Practice results displayed: ${results.leftPercentage.toFixed(1)}% / ${results.rightPercentage.toFixed(1)}%`);

            // Trigger confetti animation for perfect cuts in practice mode
            if (score >= 100) {
                console.log('🎉 Perfect cut in practice mode! Triggering confetti animation');
                if (window.triggerConfettiAnimation && typeof window.triggerConfettiAnimation === 'function') {
                    window.triggerConfettiAnimation();
                } else {
                    console.warn('🎉 triggerConfettiAnimation function not available');
                }
            }
        }
    }

    /**
     * Draw current shape
     */
    drawCurrentShape() {
        if (window.renderShapeForCutting && window.parsedShapes && window.parsedShapes.length > 0) {
            // Clear canvas first
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Use main game's draw grid
            if (window.drawGrid) {
                window.drawGrid(this.ctx);
            } else {
                this.practiceDrawGrid();
            }
            
            // Use direct coordinates (reference coordinates from GeoJSON)
            window.renderShapeForCutting(window.parsedShapes, true, this.ctx);
        } else if (window.parsedShapes && window.parsedShapes.length > 0) {
            this.renderShapeDirect(window.parsedShapes[0]);
        } else if (window.renderCurrentShape) {
            window.renderCurrentShape();
        }
    }

    /**
     * Draw preview line
     */
    drawPreviewLine() {
        if (!this.currentVector || !this.ctx) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
        this.ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y);
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * Direct shape rendering using exact copy of main game functions
     */
    renderShapeDirect(shapeData) {
        if (!this.ctx || !shapeData || !shapeData.coordinates) return;
        
        console.log('Direct rendering with coordinates:', shapeData.coordinates);
        
        // Clear canvas and draw grid exactly like main game
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.practiceDrawGrid();
        
        // Parse coordinates into main game format
        const parsedShapes = this.practiceParseGeoJSON(shapeData);
        console.log('Parsed shapes for rendering:', parsedShapes);
        
        if (parsedShapes && parsedShapes.length > 0) {
            this.practiceRenderShapeForCutting(parsedShapes);
        }
    }

    /**
     * Parse GeoJSON coordinates into main game format (isolated copy)
     */
    practiceParseGeoJSON(shapeData) {
        if (!shapeData || !shapeData.coordinates) return [];
        
        const coordinates = shapeData.coordinates;
        const shapes = [];
        
        console.log('Raw coordinates structure:', coordinates);
        
        // Handle deeply nested MultiPolygon format: coordinates[0][0][0] is the actual polygon array
        if (coordinates && coordinates[0] && coordinates[0][0] && coordinates[0][0][0]) {
            const multiPolygon = coordinates[0][0]; // Get to the actual polygon level
            
            multiPolygon.forEach(polygon => {
                if (polygon && Array.isArray(polygon) && polygon.length > 0) {
                    console.log('Processing polygon with', polygon.length, 'points');
                    shapes.push({
                        outerRing: polygon,
                        holes: [] // No holes for now
                    });
                }
            });
        }
        
        console.log('Parsed shapes:', shapes.length, 'shapes total');
        return shapes;
    }

    /**
     * Draw grid exactly like main game (isolated copy)
     */
    practiceDrawGrid() {
        this.ctx.save();
        
        // Fill canvas with white background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw black outline
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Grid lines - exactly like main game (always show in practice mode)
        this.ctx.strokeStyle = '#d0d0d0';
        this.ctx.lineWidth = 0.5;
        
        // Draw 14x14 grid with larger cells (exactly like main game)
        const gridSize = 14;
        const cellSize = this.canvas.width / gridSize;
        
        // Vertical lines
        for (let i = 0; i <= gridSize; i++) {
            const x = i * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            const y = i * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    /**
     * Render shapes exactly like main game (isolated copy)
     */
    practiceRenderShapeForCutting(shapes) {
        console.log(`Rendering ${shapes.length} shapes`);
        
        if (shapes.length === 0) {
            console.error('No shapes to render!');
            return;
        }
        
        // Calculate bounds for scaling and centering
        const bounds = this.practiceCalculateBounds(shapes);
        const scale = this.practiceCalculateScale(bounds);
        const offset = this.practiceCalculateOffset(bounds, scale);
        
        console.log('Bounds:', bounds, 'Scale:', scale, 'Offset:', offset);
        
        this.ctx.save();
        
        // Apply transformations
        this.ctx.translate(offset.x, offset.y);
        this.ctx.scale(scale, scale);
        
        // Render each shape
        shapes.forEach((shape, index) => {
            this.practiceDrawShape(shape, index);
        });
        
        this.ctx.restore();
    }

    /**
     * Calculate bounds (isolated copy)
     */
    practiceCalculateBounds(shapes) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        shapes.forEach(shape => {
            shape.outerRing.forEach(([x, y]) => {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            });
        });
        
        return { minX, minY, maxX, maxY };
    }

    /**
     * Calculate scale (isolated copy)
     */
    practiceCalculateScale(bounds) {
        const padding = 40;
        const availableWidth = this.canvas.width - (padding * 2);
        const availableHeight = this.canvas.height - (padding * 2);
        
        const shapeWidth = bounds.maxX - bounds.minX;
        const shapeHeight = bounds.maxY - bounds.minY;
        
        const scaleX = availableWidth / shapeWidth;
        const scaleY = availableHeight / shapeHeight;
        
        return Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size
    }

    /**
     * Calculate offset (isolated copy)
     */
    practiceCalculateOffset(bounds, scale) {
        const shapeWidth = (bounds.maxX - bounds.minX) * scale;
        const shapeHeight = (bounds.maxY - bounds.minY) * scale;
        
        const offsetX = (this.canvas.width - shapeWidth) / 2 - bounds.minX * scale;
        const offsetY = (this.canvas.height - shapeHeight) / 2 - bounds.minY * scale;
        
        return { x: offsetX, y: offsetY };
    }

    /**
     * Draw individual shape (isolated copy)
     */
    practiceDrawShape(shape, index) {
        // Main shape fill and stroke
        this.ctx.fillStyle = '#e8f4f8';
        this.ctx.strokeStyle = '#2196F3';
        this.ctx.lineWidth = 2;
        
        // Draw outer ring
        this.ctx.beginPath();
        const ring = shape.outerRing;
        if (ring && ring.length > 0) {
            this.ctx.moveTo(ring[0][0], ring[0][1]);
            for (let i = 1; i < ring.length; i++) {
                this.ctx.lineTo(ring[i][0], ring[i][1]);
            }
            this.ctx.closePath();
        }
        
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Basic shape rendering fallback
     */
    renderShapeBasic(coordinates) {
        if (!this.ctx || !coordinates) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#e8f4f8';
        this.ctx.strokeStyle = '#2196F3';
        this.ctx.lineWidth = 2;
        
        // Handle MultiPolygon format
        const polygons = coordinates[0] || coordinates;
        
        polygons.forEach(polygon => {
            if (!polygon || !polygon.length) return;
            
            this.ctx.beginPath();
            const firstPoint = polygon[0];
            this.ctx.moveTo(firstPoint[0], firstPoint[1]);
            
            for (let i = 1; i < polygon.length; i++) {
                const point = polygon[i];
                this.ctx.lineTo(point[0], point[1]);
            }
            
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
        });
    }

    /**
     * Navigation methods (arrows stop at edges per original requirements)
     */
    previousShape() {
        if (this.currentShapeIndex > 0) {
            this.loadShape(this.currentShapeIndex - 1);
        }
        // If at first shape (index 0), do nothing - don't wrap to last
    }

    nextShape() {
        if (this.currentShapeIndex < this.practiceShapes.length - 1) {
            this.loadShape(this.currentShapeIndex + 1);
        }
        // If at last shape, do nothing - don't wrap to first
    }

    randomShape() {
        const randomIndex = Math.floor(Math.random() * this.practiceShapes.length);
        this.loadShape(randomIndex);
    }

    resetCut() {
        console.log('🔄 Resetting practice cut');
        
        this.currentVector = null;
        this.hasActiveCut = false;
        
        // Clear practice percentage display
        const percentageDisplay = document.getElementById('practicePercentageDisplay');
        if (percentageDisplay) {
            percentageDisplay.style.display = 'none';
            percentageDisplay.innerHTML = '';
        }
        
        // Reset main game cut state if available
        if (window.resetCutState) {
            window.resetCutState();
        }
        
        // Clear any cut vectors in main game
        if (window.cutVector) {
            window.cutVector = null;
        }
        if (window.cutVectors) {
            window.cutVectors = [];
        }
        
        // Redraw clean shape using main game rendering
        if (window.renderShapeForCutting && window.parsedShapes) {
            const canvas = document.getElementById('geoCanvas');
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw grid
                if (window.drawGrid) {
                    window.drawGrid(ctx);
                }
                
                // Render clean shape
                window.renderShapeForCutting(window.parsedShapes, true, ctx);
            }
        }
        
        // Restore practice mode state after reset
        if (window.practiceMode) {
            setTimeout(() => {
                window.isInteractionEnabled = true;
                window.gameState = 'playing';
                console.log('🔒 Practice state restored after reset');
            }, 50);
        }
        
        console.log('✅ Practice cut reset complete');
    }

    /**
     * Open practice mode
     */
    async open() {
        if (!this.isUserLoggedIn()) {
            alert('Please log in to access practice mode');
            return;
        }
        
        console.log('Opening simple practice mode');
        
        this.isActive = true;
        
        // Load shapes
        const loaded = await this.loadPracticeShapes();
        if (!loaded) {
            alert('Failed to load practice shapes');
            this.close();
            return;
        }
        
        // Create UI
        this.createUI();
        
        // Initialize practice mode integration with main game
        this.initializePracticeIntegration();
        
        // CRITICAL: Re-establish render override after daily mode may have changed it
        this.setupRenderOverride();
        
        // Load first shape
        this.loadShape(0);
        
        console.log('Simple practice mode opened');
    }

    /**
     * Close practice mode
     */
    close() {
        console.log('Closing simple practice mode');
        
        this.isActive = false;
        
        // Clear practice mode flag
        window.practiceMode = false;
        
        // Restore original functions
        if (this.originalDisplayResults) {
            window.displayCutResults = this.originalDisplayResults;
        }
        if (this.originalUpdatePercentage) {
            window.updatePercentageDisplay = this.originalUpdatePercentage;
        }
        if (this.originalRenderVectorCutResult) {
            window.renderVectorCutResult = this.originalRenderVectorCutResult;
        }
        
        // Remove practice event listeners
        if (this.canvas && this.practiceMouseDown) {
            this.canvas.removeEventListener('mousedown', this.practiceMouseDown, true);
            this.canvas.removeEventListener('mousemove', this.practiceMouseMove, true);
            this.canvas.removeEventListener('mouseup', this.practiceMouseUp, true);
            this.canvas.removeEventListener('touchstart', this.practiceMouseDown, true);
            this.canvas.removeEventListener('touchmove', this.practiceMouseMove, true);
            this.canvas.removeEventListener('touchend', this.practiceMouseUp, true);
            console.log('🧹 Practice event listeners removed');
        }
        
        // Remove practice container
        const container = document.getElementById('practiceContainer');
        if (container) {
            container.remove();
        }
        
        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Clear global shape data
        window.currentShapeData = null;
        window.parsedShapes = null;
        window.currentShape = null;
        
        // Disable canvas interaction
        window.canvasInteractionEnabled = false;
        
        // Show welcome content
        const welcomeOverlay = document.getElementById('welcomeOverlay');
        if (welcomeOverlay) {
            welcomeOverlay.style.display = 'block';
        }
        
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.style.display = '';
        }
        
        // Show progress display if needed
        const progressDisplay = document.getElementById('demoProgressDisplay');
        if (progressDisplay) {
            progressDisplay.style.display = '';
        }
        
        // Restore main game
        if (window.showWelcomeScreen) {
            window.showWelcomeScreen();
        }
        
        // Restore daily game canvas state
        this.restoreDailyGameCanvas();
        
        console.log('Simple practice mode closed');
    }
    
    /**
     * Restore daily game canvas state when returning from practice mode
     */
    restoreDailyGameCanvas() {
        console.log('🔄 Restoring daily game canvas state from practice mode');
        
        // First try to restore from SimpleRefresh state
        if (window.SimpleRefresh) {
            const today = new Date().toISOString().split('T')[0];
            const saved = localStorage.getItem(`simple_refresh_${today}`);
            
            if (saved) {
                try {
                    const state = JSON.parse(saved);
                    
                    // Check if we have canvas data to restore
                    if (state.canvasData) {
                        console.log('🎨 Found saved canvas data, restoring...');
                        
                        // Create an image to restore the canvas
                        const img = new Image();
                        img.onload = () => {
                            if (window.canvas && window.ctx) {
                                // Clear canvas first
                                window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
                                // Draw the saved canvas state
                                window.ctx.drawImage(img, 0, 0);
                                console.log('✅ Daily game canvas state restored successfully');
                                
                                // Enable interaction if game is not complete
                                if (!state.dayComplete) {
                                    window.isInteractionEnabled = true;
                                    console.log('🖱️ Canvas interaction re-enabled');
                                }
                            }
                        };
                        img.src = state.canvasData;
                        return;
                    } else {
                        console.log('⚠️ No canvas data found in saved state');
                    }
                    
                    // If no canvas data but we have cut history, try to recreate visualization
                    if (state.cuts && state.cuts.length > 0) {
                        console.log('🔄 No canvas data - attempting to recreate cut visualization from history');
                        
                        // Restore game state variables first
                        window.currentShapeNumber = state.currentShape;
                        window.currentAttemptNumber = state.currentAttempt;
                        window.gameState = state.dayComplete ? 'finished' : 'playing';
                        window.currentGeoJSON = state.currentGeoJSON;
                        window.parsedShapes = state.parsedShapes;
                        
                        // Try to recreate the cuts if we have the necessary functions
                        if (window.loadShapeForDay && window.processPlayerCut && state.parsedShapes) {
                            setTimeout(() => {
                                try {
                                    // Load the shape first
                                    window.currentShapeNumber = state.currentShape;
                                    
                                    // Recreate cuts
                                    state.cuts.forEach((cut, index) => {
                                        if (cut && cut.startX !== undefined && cut.endX !== undefined) {
                                            console.log(`🔄 Recreating cut ${index + 1}:`, cut);
                                            window.processPlayerCut(cut.startX, cut.startY, cut.endX, cut.endY);
                                        }
                                    });
                                    
                                    console.log('✅ Cut visualization recreated from history');
                                } catch (e) {
                                    console.error('❌ Failed to recreate cuts:', e);
                                }
                            }, 100);
                        }
                    }
                } catch (e) {
                    console.error('❌ Failed to parse saved state:', e);
                }
            } else {
                console.log('⚠️ No saved state found for today');
            }
        }
        
        // Also try to restore from practice mode saved state if available
        if (window.savedDailyCanvasState) {
            console.log('🎨 Found saved daily canvas state from practice mode, restoring...');
            
            const img = new Image();
            img.onload = () => {
                if (window.canvas && window.ctx) {
                    window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
                    window.ctx.drawImage(img, 0, 0);
                    console.log('✅ Daily canvas state restored from practice mode save');
                }
            };
            img.src = window.savedDailyCanvasState;
            
            // Clear the saved state since we've used it
            window.savedDailyCanvasState = null;
        }
    }
    
    /**
     * Render shapes for pixel analysis (matches daily game mode approach)
     */
    renderShapesForPixelAnalysis(context, shapes) {
        if (!shapes || shapes.length === 0) return;
        
        context.save();
        context.fillStyle = "#dddddd"; // Same grey as daily game mode
        
        // Use current shapes data
        if (window.parsedShapes) {
            shapes = window.parsedShapes;
        }
        
        // Simple shape rendering for pixel analysis
        shapes.forEach(shape => {
            if (shape.outerRing && shape.outerRing.length > 0) {
                context.beginPath();
                const firstPoint = shape.outerRing[0];
                context.moveTo(firstPoint[0], firstPoint[1]);
                
                for (let i = 1; i < shape.outerRing.length; i++) {
                    const point = shape.outerRing[i];
                    context.lineTo(point[0], point[1]);
                }
                context.closePath();
                context.fill();
            }
        });
        
        context.restore();
    }
    
    /**
     * Calculate bounds of shapes
     */
    calculateShapeBounds(shapes) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        shapes.forEach(shape => {
            if (shape.outerRing) {
                shape.outerRing.forEach(point => {
                    minX = Math.min(minX, point[0]);
                    minY = Math.min(minY, point[1]);
                    maxX = Math.max(maxX, point[0]);
                    maxY = Math.max(maxY, point[1]);
                });
            }
        });
        
        return { minX, minY, maxX, maxY };
    }
    
    /**
     * Determine if a pixel is left of the cut line
     */
    isPixelLeftOfCutLine(x, y, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const px = x - start.x;
        const py = y - start.y;
        const cross = dx * py - dy * px;
        return cross > 0;
    }
    
    /**
     * Draw the final cut vector (matches daily game mode)
     */
    drawFinalCutVector(start, end) {
        this.ctx.save();
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        this.ctx.restore();
    }
}

// Create singleton
const simplePracticeMode = new SimplePracticeMode();

// Export to window
if (typeof window !== 'undefined') {
    window.SimplePracticeMode = simplePracticeMode;
    console.log('✅ SimplePracticeMode loaded and exported to window');
}
