// Default Vector Cut with Undo Mechanic
// Based on default mechanic but allows canceling/undoing line draws with right-click or second finger tap

console.log('🔧 Default with Undo mechanic file loaded');

const DefaultWithUndoMechanic = {
    name: "Default Vector Cut with Undo",
    description: "Draw straight lines to cut shapes - right-click or tap with second finger to cancel",
    
    // Mechanic state (matching original variable names)
    isDrawingVector: false,
    vectorStart: null,
    vectorEnd: null,
    currentVector: null,
    vectorCutActive: false,
    dragDistance: 0,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Default Vector Cut with Undo mechanic');
        this.reset();
        this.setupDesktopUndoListeners();
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawingVector = false;
        this.vectorStart = null;
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;
        
        // CRITICAL FIX: Clear global currentVector to prevent showing old cut lines
        // This was causing cut shading to repeatedly show the first cut instead of current cuts
        window.currentVector = null;
        globalThis.currentVector = null;
        console.log('🔧 RESET: Cleared global currentVector to prevent stale cut rendering');
    },
    
    // Setup right-click listener for desktop undo functionality
    setupDesktopUndoListeners() {
        const canvas = document.getElementById('geoCanvas');
        console.log('🔧 setupDesktopUndoListeners - canvas element found:', !!canvas, canvas?.id);
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            // Always prevent default to avoid context menu in device emulation
            event.preventDefault();
            event.stopPropagation();
            
            if (this.isDrawingVector) {
                console.log('🔄 Right-click detected - canceling line draw');
                this.cancelLineDraw();
            }
            return false;
        });
        
        console.log('🔧 Right-click listener added to canvas');
    },
    
    // Cancel the current line drawing and return to ready state
    cancelLineDraw() {
        console.log('🚫 Canceling line draw');
        
        // Reset all state immediately
        this.isDrawingVector = false;
        this.vectorStart = null;
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;
        
        // CRITICAL: Clear BOTH local and global currentVector to prevent rendering issues
        if (window.currentVector) {
            console.log('🔧 Clearing global currentVector to prevent stale rendering');
            window.currentVector = null;
        }
        if (globalThis.currentVector) {
            globalThis.currentVector = null;
        }
        
        // CRITICAL: Clear the restoreGameState flag to prevent canvas state corruption
        if (window.restoreGameState) {
            console.log('🔧 Clearing restoreGameState flag to prevent canvas corruption');
            window.restoreGameState = false;
        }
        
        // CRITICAL: Clear saved visual states that could be corrupted
        if (window.dailyGameState) {
            console.log('🔧 Clearing corrupted visual states after cancel');
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
            console.log('🔧 Clearing global shadedCanvasState after cancel');
            window.shadedCanvasState = null;
        }
        
        // Set a flag to prevent visual state restoration until next valid cut
        window.canceledLineDrawing = true;

        // Redraw canvas to clear the preview line and show clean shape
        redrawCanvas();

        // Clear the canceled flag after a short delay to allow new cuts
        setTimeout(() => {
            console.log('🔧 Cleared canceledLineDrawing flag - ready for new cut');
            window.canceledLineDrawing = false;
        }, 100);

        // Show brief feedback message
        this.showCancelFeedback();
    },
    
    // Show brief visual feedback that the line was canceled
    showCancelFeedback() {
        // Create a temporary message
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        const message = document.createElement('div');
        message.textContent = 'Line Canceled';
        message.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            animation: fadeInOut 1s ease-in-out;
        `;
        
        // Add CSS animation if not already present
        if (!document.getElementById('cancelFeedbackStyles')) {
            const style = document.createElement('style');
            style.id = 'cancelFeedbackStyles';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    30% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    70% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Position relative to canvas
        const canvasRect = canvas.getBoundingClientRect();
        message.style.position = 'fixed';
        message.style.top = (canvasRect.top + canvasRect.height / 2) + 'px';
        message.style.left = (canvasRect.left + canvasRect.width / 2) + 'px';
        
        document.body.appendChild(message);
        
        // Remove after animation
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 1000);
    },
    
    // Handle start of interaction (mouse down / touch start)
    handleStart(event, canvasRect) {
        // Check if we're in practice mode and use appropriate state variables
        const isPractice = window.isPracticeMode;
        const interactionEnabled = isPractice ? window.isInteractionEnabled : isInteractionEnabled;
        const currentGameState = isPractice ? window.gameState : gameState;

        console.log('📱 MECHANIC handleStart called - isPractice:', isPractice, 'interactionEnabled:', interactionEnabled, 'gameState:', currentGameState);
        console.log('📱 MECHANIC handleStart - event type:', event.type, 'event target:', event.target?.tagName, event.target?.id);
        console.log('📱 MECHANIC handleStart - canvasRect:', canvasRect);

        if (!interactionEnabled || currentGameState !== 'cutting') {
            console.log('🚫 Default with Undo mechanic: Vector start BLOCKED - interaction enabled:', interactionEnabled, 'gameState:', currentGameState);
            return false;
        }
        console.log('✅ Default with Undo mechanic: Vector start ALLOWED');
        
        // Update instruction after first touch
        if (window.updateInstructionText && window.getDynamicInstruction) {
            const dynamicInstruction = window.getDynamicInstruction('DefaultWithUndoMechanic', 'first_touch');
            window.updateInstructionText(dynamicInstruction);
        }
        
        // Check for multi-touch cancellation
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleStart - canceling if drawing');
            if (this.isDrawingVector) {
                this.cancelLineDraw();
            }
            return false;
        }
        
        // Hide any commentary when user starts cutting
        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (typeof hideTryAgainMessage === 'function') hideTryAgainMessage();
        
        // Clear the canceled line drawing flag since we're starting a new valid cut
        if (window.canceledLineDrawing) {
            console.log('🔧 Clearing canceledLineDrawing flag - new cut starting');
            window.canceledLineDrawing = false;
        }
        
        this.isDrawingVector = true;
        this.vectorStart = this.getCanvasCoordinates(event, canvasRect);
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;
        
        console.log('🎯 Default with Undo mechanic: Start drawing vector at', this.vectorStart);
        console.log('🎯 MECHANIC STATE: isDrawingVector =', this.isDrawingVector);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        // Check appropriate game state for practice mode
        const currentGameState = window.isPracticeMode ? window.gameState : gameState;
        if (!this.isDrawingVector || !this.vectorStart || currentGameState !== 'cutting') return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling line draw');
            this.cancelLineDraw();
            return true; // Handled
        }
        
        this.vectorEnd = this.getCanvasCoordinates(event, canvasRect);
        
        // Calculate drag distance
        const dx = this.vectorEnd.x - this.vectorStart.x;
        const dy = this.vectorEnd.y - this.vectorStart.y;
        this.dragDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Only show preview if drag distance is significant
        if (this.dragDistance > 5) {
            this.drawPreview();
        }
        
        return true; // Handled
    },
    
    // Handle end of interaction (mouse up / touch end)
    handleEnd(event) {
        // Check appropriate game state for practice mode
        const currentGameState = window.isPracticeMode ? window.gameState : gameState;
        if (!this.isDrawingVector || !this.vectorStart || currentGameState !== 'cutting') {
            this.reset();
            return false;
        }
        
        this.isDrawingVector = false;
        if (!this.vectorEnd) {
            this.vectorEnd = this.vectorStart; // Handle case where no move occurred
        }
        
        // Check if this was a proper drag (not just a tap)
        if (this.dragDistance < 10) {
            console.log('🚫 Default with Undo mechanic: Cut too short, showing try again');
            
            // Show try again message and reset
            if (typeof showTryAgainMessage === 'function') showTryAgainMessage();
            this.reset();
            redrawCanvas();
            return false;
        }
        
        if (this.vectorStart && this.vectorEnd) {
            // Normalize vector direction for consistent left/right calculation
            let normalizedStart = this.vectorStart;
            let normalizedEnd = this.vectorEnd;
            
            // Always ensure consistent direction: if start.x > end.x, swap them
            if (this.vectorStart.x > this.vectorEnd.x) {
                normalizedStart = this.vectorEnd;
                normalizedEnd = this.vectorStart;
            }
            
            // Calculate extended vector that spans the entire canvas for calculations
            this.currentVector = this.extendVectorToCanvasBounds(normalizedStart, normalizedEnd);
            this.vectorCutActive = true;
            
            // Store EXTENDED vector for final rendering to show full cut line
            const extendedVector = {
                start: { ...this.currentVector.start },
                end: { ...this.currentVector.end }
            };
            
            // Update global currentVector with EXTENDED cut line for visual rendering
            window.currentVector = extendedVector;
            globalThis.currentVector = extendedVector;
            console.log('🔧 Updated global currentVector for rendering (EXTENDED COORDS):');
            console.log('   - start:', extendedVector.start);
            console.log('   - end:', extendedVector.end);
            console.log('🔧 Extended vector for calculations:');
            console.log('   - start:', this.currentVector.start);
            console.log('   - end:', this.currentVector.end);
            
            console.log('✂️ Default with Undo mechanic: Executing vector cut', this.currentVector);
            
            // Perform the cut calculation using original game logic
            return this.performVectorCut();
        }
        
        this.reset();
        return false;
    },
    
    // Draw preview during drag (matching original style)
    drawPreview() {
        if (!this.vectorStart || !this.vectorEnd) return;

        // Redraw base canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        // Get shapes with compatibility check - prioritize practice mode shapes
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes :
                       (window.parsedShapes || globalThis.parsedShapes || []));
        if (typeof renderShapeForCutting === 'function' && shapes) {
            renderShapeForCutting(shapes);
        }
        
        // Draw current vector preview (matching original style)
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(this.vectorStart.x, this.vectorStart.y);
        ctx.lineTo(this.vectorEnd.x, this.vectorEnd.y);
        ctx.stroke();
        
        ctx.restore();
    },
    
    // Get canvas coordinates (matching original implementation)
    getCanvasCoordinates(event, canvasRect) {
        let clientX, clientY;
        
        if (event.type.startsWith('touch')) {
            clientX = event.touches[0]?.clientX || event.changedTouches[0]?.clientX;
            clientY = event.touches[0]?.clientY || event.changedTouches[0]?.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        // Get pointer position relative to canvas display area
        const relativeX = clientX - canvasRect.left;
        const relativeY = clientY - canvasRect.top;
        
        // Get canvas element to check internal resolution
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            // Fallback to original calculation if canvas not found
            return { x: relativeX, y: relativeY };
        }
        
        // Scale from display size to canvas internal resolution
        // Canvas internal size is 380x380, but CSS may display it differently
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        
        return {
            x: relativeX * scaleX,
            y: relativeY * scaleY
        };
    },
    
    // Extend vector to canvas bounds (matching original implementation)
    extendVectorToCanvasBounds(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        // Handle vertical line
        if (Math.abs(dx) < 0.001) {
            return {
                start: { x: start.x, y: 0 },
                end: { x: start.x, y: canvas.height }
            };
        }
        
        // Handle horizontal line
        if (Math.abs(dy) < 0.001) {
            return {
                start: { x: 0, y: start.y },
                end: { x: canvas.width, y: start.y }
            };
        }
        
        // Calculate slope and intercept
        const slope = dy / dx;
        const intercept = start.y - slope * start.x;
        
        // Find intersections with canvas boundaries
        const intersections = [];
        
        // Left edge (x = 0)
        const leftY = intercept;
        if (leftY >= 0 && leftY <= canvas.height) {
            intersections.push({ x: 0, y: leftY });
        }
        
        // Right edge (x = canvas.width)
        const rightY = slope * canvas.width + intercept;
        if (rightY >= 0 && rightY <= canvas.height) {
            intersections.push({ x: canvas.width, y: rightY });
        }
        
        // Top edge (y = 0)
        const topX = (0 - intercept) / slope;
        if (topX >= 0 && topX <= canvas.width) {
            intersections.push({ x: topX, y: 0 });
        }
        
        // Bottom edge (y = canvas.height)
        const bottomX = (canvas.height - intercept) / slope;
        if (bottomX >= 0 && bottomX <= canvas.width) {
            intersections.push({ x: bottomX, y: canvas.height });
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
    },
    
    // Execute the actual cut using original game logic
    async performVectorCut() {
        try {
            console.log('🔧 Default with Undo mechanic performVectorCut called');
            
            // DEBUG: Check what's available
            console.log('🔍 DEBUGGING GLOBAL VARIABLES:');
            console.log('  - window.parsedShapes exists:', !!window.parsedShapes);
            console.log('  - window.parsedShapes length:', window.parsedShapes?.length || 'undefined');
            console.log('  - globalThis.parsedShapes exists:', !!globalThis.parsedShapes);
            console.log('  - globalThis.parsedShapes length:', globalThis.parsedShapes?.length || 'undefined');
            
            // Check for parsedShapes in multiple scopes (practice mode compatibility)
            let shapes = [];
            
            // CRITICAL: Check for practice mode shapes FIRST to avoid contamination
            if (window.isPracticeMode && window.PracticeMode?.practiceParsedShapes && Array.isArray(window.PracticeMode.practiceParsedShapes)) {
                shapes = window.PracticeMode.practiceParsedShapes;
                console.log('🔧 Using PracticeMode.practiceParsedShapes:', shapes.length);
                console.log('🔧 First shape sample:', shapes[0]);
            } else if (window.parsedShapes && Array.isArray(window.parsedShapes)) {
                shapes = window.parsedShapes;
                console.log('🔧 Using window.parsedShapes:', shapes.length);
                console.log('🔧 First shape sample:', shapes[0]);
            } else if (globalThis.parsedShapes && Array.isArray(globalThis.parsedShapes)) {
                shapes = globalThis.parsedShapes;
                console.log('🔧 Using globalThis.parsedShapes:', shapes.length);
                console.log('🔧 First shape sample:', shapes[0]);
            } else {
                // Try to access parsedShapes directly (for daily mode)
                try {
                    if (typeof parsedShapes !== 'undefined' && parsedShapes && Array.isArray(parsedShapes)) {
                        shapes = parsedShapes;
                        console.log('🔧 Using direct parsedShapes:', shapes.length);
                        console.log('🔧 First shape sample:', shapes[0]);
                    }
                } catch (e) {
                    console.log('🔧 Direct parsedShapes access failed, using empty array');
                }
            }
            
            console.log('🔧 Final shapes before validation:', shapes.length, shapes);
            
            if (!this.currentVector || !shapes || shapes.length === 0) {
                console.error('Missing required data for cut. Shapes found:', shapes?.length || 0);
                return false;
            }
            
            // First validate the cut
            const isValidCut = this.validateCut();
            console.log('🔍 Cut validation result:', isValidCut);
            
            if (!isValidCut) {
                console.log('❌ Invalid cut detected - not counting attempt');
                this.handleInvalidCut();
                return false;
            }
            
            console.log('✅ Valid cut detected - proceeding with attempt');
            
            // Calculate areas
            const areaResults = this.calculateAreas();
            console.log('📊 Area calculation results:', areaResults);
            console.log('🔧 isPractiseMode:', isPractiseMode);
            console.log('🔧 window.showAttemptResult exists:', typeof window.showAttemptResult);
            
            // Store the results globally for the main game to use
            // Use EXTENDED vector for visual rendering to show full cut line
            const extendedVector = {
                start: { ...this.currentVector.start },
                end: { ...this.currentVector.end }
            };
            window.currentVector = extendedVector;
            window.currentAreaResults = areaResults;
            
            // Set global currentVector for drawFinalVector function
            if (typeof window !== 'undefined') {
                globalThis.currentVector = extendedVector;
            }
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // Call the main game's cut handling flow
            console.log('🔥 MECHANIC: About to check for handleCutAttempt');
            console.log('🔥 window.handleCutAttempt exists:', typeof window.handleCutAttempt);
            console.log('🔥 isDemoMode:', window.isDemoMode);
            
            if (typeof window.handleCutAttempt === 'function') {
                console.log('🔥 MECHANIC: Calling main handleCutAttempt flow');
                // Set the global variables that handleCutAttempt expects
                // Use EXTENDED vector for visual rendering to show full cut line
                const extendedVector = {
                    start: { ...this.currentVector.start },
                    end: { ...this.currentVector.end }
                };
                window.currentVector = extendedVector;
                // Call the main game flow
                window.handleCutAttempt();
            } else if (typeof window.showAttemptResult === 'function') {
                console.log('🔥 MECHANIC: Fallback - calling showAttemptResult directly');
                // Fallback for test lab mode
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            } else {
                console.log('🔥 MECHANIC: No cut handling function found!');
            }
            
            return true;
        } catch (error) {
            console.error('Error executing default with undo vector cut:', error);
            return false;
        } finally {
            this.reset();
        }
    },
    
    // Validate if the cut actually divides the shape
    validateCut() {
        // Create a temporary canvas to render shapes for pixel analysis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Get shapes with compatibility check - prioritize practice mode shapes
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes :
                       (window.parsedShapes || globalThis.parsedShapes || []));
        
        // Render shapes on temporary canvas
        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        // Calculate areas on each side of the vector
        const areaResults = this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, this.currentVector);
        
        // Check for invalid cut (no actual division)
        // Use small tolerance for floating point comparison
        if (areaResults.leftPercentage < 0.1 || areaResults.rightPercentage < 0.1) {
            console.log('Invalid cut detected - no actual division:', areaResults.leftPercentage, areaResults.rightPercentage);
            return false;
        }
        
        return true;
    },
    
    // Handle invalid cuts
    handleInvalidCut() {
        console.log('🚫 Invalid cut - allowing recut without counting');

        // Reset vector state but keep game in cutting mode
        this.reset();

        // Show try again message
        if (typeof showTryAgainMessage === 'function') showTryAgainMessage();

        // Redraw original shape with practice mode awareness
        this.practiceAwareRedraw();
    },

    // Practice mode aware redraw that uses correct shapes
    practiceAwareRedraw() {
        console.log('🔄 Practice-aware redraw called');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // Get shapes with practice mode priority
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes :
                       (window.parsedShapes || globalThis.parsedShapes || []));

        console.log('🔄 Redrawing with shapes:', shapes.length, 'isPracticeMode:', window.isPracticeMode);

        // Render the correct shapes
        if (shapes && shapes.length > 0 && typeof renderShapeForCutting === 'function') {
            renderShapeForCutting(shapes);
        }
    },

    // Calculate areas using pixel-based method
    calculateAreas() {
        // Create a temporary canvas to render shapes for pixel analysis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Get shapes with practice mode priority
        // CRITICAL: Practice mode MUST use practiceParsedShapes to avoid contamination
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes :
                       (window.parsedShapes || globalThis.parsedShapes || []));

        console.log('🔍 CALCULATE AREAS DEBUG:');
        console.log('  - window.isPracticeMode:', window.isPracticeMode);
        console.log('  - window.parsedShapes length:', window.parsedShapes ? window.parsedShapes.length : 'undefined');
        console.log('  - local parsedShapes length:', typeof parsedShapes !== 'undefined' ? parsedShapes.length : 'undefined');
        console.log('  - shapes to use length:', shapes.length);
        
        // Render shapes on temporary canvas
        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        // Calculate areas on each side of the vector
        return this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, this.currentVector);
    },
    
    // Render shapes for pixel analysis (grey fill)
    renderShapesForPixelAnalysis(context, shapes) {
        context.save();
        context.fillStyle = '#dddddd'; // Grey fill for shape detection
        
        // Use global functions for consistent bounds and scaling
        const bounds = calculateBounds(shapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        
        // Use the global drawPolygonForPixelAnalysis function for consistency
        shapes.forEach(shape => {
            drawPolygonForPixelAnalysis(context, shape, scale, offset);
        });
        
        context.restore();
    },
    
    // Calculate pixel-based areas
    calculatePixelBasedAreas(pixels, width, height, vector) {
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
                    
                    const side = this.getPixelSideOfVector(x, y, lineStart, lineEnd, dx, dy);
                    
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

        // CRITICAL: Ensure smaller area is always in leftArea/leftPercentage for consistent shading
        // This ensures the smaller area gets colored on the canvas
        if (leftPercentage > rightPercentage) {
            // Swap so smaller is always "left"
            return {
                leftArea: rightArea,
                rightArea: leftArea,
                totalShapePixels,
                leftPercentage: rightPercentage,
                rightPercentage: leftPercentage
            };
        }

        return {
            leftArea,
            rightArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Determine which side of the vector a pixel is on
    getPixelSideOfVector(x, y, lineStart, lineEnd, dx, dy) {
        const crossProduct = (x - lineStart.x) * dy - (y - lineStart.y) * dx;
        
        if (crossProduct > 0) {
            return 'left';
        } else if (crossProduct < 0) {
            return 'right';
        } else {
            return 'on_line';
        }
    },
    
    // Render the cut result with colored areas
    renderCutResult(areaResults) {
        // Get shapes with practice mode priority
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes :
                       (window.parsedShapes || globalThis.parsedShapes || []));
        if (!this.currentVector || !shapes.length) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        this.renderShapesForPixelAnalysis(tempCtx, shapes);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        // CRITICAL: We need to determine which GEOMETRIC side is actually smaller
        // Count the pixels on each geometric side to figure out which should be colored
        let geometricLeftCount = 0;
        let geometricRightCount = 0;
        const dx = this.currentVector.end.x - this.currentVector.start.x;
        const dy = this.currentVector.end.y - this.currentVector.start.y;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                if (pixels[pixelIndex] === 221) {
                    const side = this.getPixelSideOfVector(x, y, this.currentVector.start, this.currentVector.end, dx, dy);
                    if (side === 'left') {
                        geometricLeftCount++;
                    } else if (side === 'right') {
                        geometricRightCount++;
                    }
                }
            }
        }

        // Color whichever geometric side is smaller
        const colorLeftSide = geometricLeftCount <= geometricRightCount;

        console.log(`🎨 Default-with-undo rendering: geometricLeft=${geometricLeftCount}, geometricRight=${geometricRightCount}, colorLeftSide=${colorLeftSide}`);
        console.log(`   areaResults: leftPercentage=${areaResults.leftPercentage.toFixed(1)}%, rightPercentage=${areaResults.rightPercentage.toFixed(1)}%`);

        const resultImageData = ctx.createImageData(canvas.width, canvas.height);
        const resultPixels = resultImageData.data;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];

                if (r === 221 && g === 221 && b === 221) {
                    const side = this.getPixelSideOfVector(x, y, this.currentVector.start, this.currentVector.end,
                        this.currentVector.end.x - this.currentVector.start.x,
                        this.currentVector.end.y - this.currentVector.start.y);

                    if (side === 'on_line') {
                        // Cut line remains black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
                        resultPixels[pixelIndex + 3] = 255;
                    } else if ((side === 'left' && colorLeftSide) || (side === 'right' && !colorLeftSide)) {
                        // Color the smaller area
                        const color = window.getDailyCutShadingColor ? window.getDailyCutShadingColor() : { r: 100, g: 150, b: 255 };
                        resultPixels[pixelIndex] = color.r;     // R
                        resultPixels[pixelIndex + 1] = color.g; // G
                        resultPixels[pixelIndex + 2] = color.b; // B
                        resultPixels[pixelIndex + 3] = 255;     // A
                    } else {
                        // Larger area remains grey
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
        
        // Draw shape outlines and final vector using global functions
        if (typeof drawShapeOutlines === 'function') {
            drawShapeOutlines();
        }
        
        // Draw the final cut vector
        this.drawFinalVector();
    },
    
    // Draw the final cut vector
    drawFinalVector() {
        if (!this.currentVector) return;
        
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
        ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y);
        ctx.stroke();
        
        ctx.restore();
    },
    
    // Note: Using global calculateBounds, calculateScale, calculateOffset functions for consistency
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DefaultWithUndoMechanic;
} else {
    window.DefaultWithUndoMechanic = DefaultWithUndoMechanic;
}

// Cache version: v=20250915e