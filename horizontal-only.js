// Horizontal Only Cut Mechanic
// Only allows horizontal cuts across the shape

const HorizontalOnlyMechanic = {
    name: "Horizontal Only Cut",
    description: "Draw only horizontal lines to cut shapes",
    
    // Mechanic state
    isDrawing: false,
    startPoint: null,
    endPoint: null,
    currentVector: null,
    lastEndTime: 0, // Track last handleEnd call to prevent rapid double-clicks
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Horizontal Only Cut mechanic');
        this.reset();
        this.setupDesktopUndoListeners();
    },
    
    // Setup right-click listener for desktop undo functionality
    setupDesktopUndoListeners() {
        console.log('🔧 Setting up desktop undo listeners for horizontal-only');
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            console.log('❌ Canvas not found for horizontal-only undo listeners');
            return;
        }
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            console.log('🔄 Horizontal-only contextmenu triggered, isDrawing:', this.isDrawing);
            if (this.isDrawing) {
                console.log('🔄 Right-click detected - canceling horizontal line draw');
                this.cancelDraw();
            }
        });
        console.log('✅ Horizontal-only undo listener added');
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.currentVector = null;
        this.lastEndTime = 0;
    },
    
    
    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling horizontal line');
        this.reset();
        redrawCanvas();
        this.showCancelFeedback();
    },
    
    // Show brief visual feedback that the draw was canceled
    showCancelFeedback() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        const message = document.createElement('div');
        message.textContent = 'Draw Canceled';
        message.style.cssText = `
            position: fixed;
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
        
        const canvasRect = canvas.getBoundingClientRect();
        message.style.top = (canvasRect.top + canvasRect.height / 2) + 'px';
        message.style.left = (canvasRect.left + canvasRect.width / 2) + 'px';
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 1000);
    },
    
    // Handle start of interaction (mouse down / touch start)
    handleStart(event, canvasRect) {
        console.log('🔍 HORIZONTAL DEBUG: handleStart called', {
            isInteractionEnabled: window.isInteractionEnabled,
            globalIsInteractionEnabled: isInteractionEnabled,
            practiceMode: window.practiceMode?.isActive
        });
        if (!isInteractionEnabled) {
            console.log('🔍 HORIZONTAL DEBUG: handleStart blocked - isInteractionEnabled is false');
            return false;
        }
        
        // Update instruction after first touch
        if (window.updateInstructionText && window.getDynamicInstruction) {
            const dynamicInstruction = window.getDynamicInstruction('HorizontalOnlyMechanic', 'first_touch');
            window.updateInstructionText(dynamicInstruction);
        }
        
        // Check for multi-touch cancellation
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleStart - canceling if drawing');
            if (this.isDrawing) {
                this.cancelDraw();
            }
            return false;
        }
        
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        // Get canvas element to check internal resolution
        const canvas = document.getElementById('geoCanvas');
        
        // Get pointer position relative to canvas display area
        const relativeX = clientX - canvasRect.left;
        const relativeY = clientY - canvasRect.top;
        
        // Scale from display size to canvas internal resolution
        const scaleX = canvas ? (canvas.width / canvasRect.width) : 1;
        const scaleY = canvas ? (canvas.height / canvasRect.height) : 1;
        
        this.startPoint = {
            x: relativeX * scaleX,
            y: relativeY * scaleY
        };
        
        // Immediately create full-width horizontal line at the touch Y position
        this.endPoint = {
            x: canvas.width, // Full width
            y: this.startPoint.y  // Same Y coordinate
        };
        
        // Create full-width vector immediately
        this.currentVector = {
            start: { x: 0, y: this.startPoint.y },
            end: { x: canvas.width, y: this.startPoint.y }
        };
        
        this.isDrawing = true;
        console.log('✏️ Horizontal mechanic: isDrawing set to true');
        
        // Draw the initial full-width line
        this.drawPreview();
        
        console.log('🎯 Horizontal mechanic: Full-width line created at Y =', this.startPoint.y);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        console.log('🔍 HORIZONTAL DEBUG: handleMove called', {
            isDrawing: this.isDrawing,
            hasStartPoint: !!this.startPoint,
            eventType: event.type
        });
        
        if (!this.isDrawing || !this.startPoint) {
            console.log('🔍 HORIZONTAL DEBUG: handleMove blocked - isDrawing:', this.isDrawing, 'startPoint:', !!this.startPoint);
            return false;
        }
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling horizontal line');
            this.cancelDraw();
            return true; // Handled
        }
        
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        // Get canvas element to check internal resolution
        const canvas = document.getElementById('geoCanvas');
        
        // Get pointer position relative to canvas display area
        const relativeY = clientY - canvasRect.top;
        
        // Scale from display size to canvas internal resolution
        const scaleY = canvas ? (canvas.height / canvasRect.height) : 1;
        
        // Update Y position of the full-width horizontal line to track finger
        const newY = relativeY * scaleY;
        
        // Keep Y within canvas bounds
        const clampedY = Math.max(0, Math.min(canvas.height, newY));
        
        // Update the full-width line position
        this.startPoint.y = clampedY;
        this.endPoint.y = clampedY;
        
        // Update the full-width vector
        this.currentVector = {
            start: { x: 0, y: clampedY },
            end: { x: canvas.width, y: clampedY }
        };
        
        // Redraw canvas with updated line position
        this.drawPreview();
        return true; // Handled
    },
    
    // Handle end of interaction (mouse up / touch end)
    async handleEnd(event) {
        const currentTime = Date.now();

        console.log('🔍 HORIZONTAL DEBUG: handleEnd called', {
            isDrawing: this.isDrawing,
            hasCurrentVector: !!this.currentVector,
            hasStartPoint: !!this.startPoint,
            eventType: event.type,
            timeSinceLastEnd: currentTime - this.lastEndTime
        });

        // Prevent rapid double-clicks (within 100ms)
        if (currentTime - this.lastEndTime < 100) {
            console.log('🔍 HORIZONTAL DEBUG: handleEnd blocked - too soon after last call');
            return false;
        }
        this.lastEndTime = currentTime;

        // More defensive check - if we have a startPoint, we can still proceed
        if (!this.isDrawing && !this.startPoint) {
            console.log('🔍 HORIZONTAL DEBUG: handleEnd blocked - no drawing state or start point');
            this.reset();
            return false;
        }

        // If we have a startPoint but no currentVector, recreate it
        if (!this.currentVector && this.startPoint) {
            console.log('🔍 HORIZONTAL DEBUG: Recreating currentVector from startPoint');
            const canvas = document.getElementById('geoCanvas');
            this.currentVector = {
                start: { x: 0, y: this.startPoint.y },
                end: { x: canvas.width, y: this.startPoint.y }
            };
        }

        if (!this.currentVector) {
            console.log('🔍 HORIZONTAL DEBUG: handleEnd failed - no vector available');
            this.reset();
            return false;
        }

        console.log('✂️ Horizontal mechanic: Executing horizontal cut at Y =', this.currentVector.start.y);

        // Store the cut vector
        const cutVector = this.currentVector;

        // Execute cut using existing game logic
        return await this.executeCut(cutVector);
    },
    
    // Draw preview during drag
    drawPreview() {
        if (!this.currentVector) return;

        // Redraw base canvas with practice mode awareness
        this.practiceAwareRedraw();
        
        // Draw full-width horizontal preview line
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.setLineDash([8, 4]);

        ctx.beginPath();
        ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
        ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y);
        ctx.stroke();

        ctx.restore();
    },
    
    // Execute the cut when called from external systems
    async performVectorCut() {
        if (!this.currentVector) {
            console.log('⚠️ No vector to cut');
            return false;
        }
        return await this.executeCut(this.currentVector);
    },
    
    // Execute the actual cut
    async executeCut(vector) {
        try {
            console.log('🔧 Horizontal mechanic executeCut called');
            
            // Get shapes with practice mode priority
            const shapes = window.isPracticeMode ?
                          (window.PracticeMode?.practiceParsedShapes || []) :
                          ((typeof parsedShapes !== 'undefined') ? parsedShapes : []);

            if (!vector || !shapes || shapes.length === 0) {
                console.error('Missing required data for cut. Shapes found:', shapes?.length || 0);
                this.reset(); // Reset drawing state
                return false;
            }
            
            // Store for validation
            this.currentVector = vector;
            
            // First validate the cut
            const isValidCut = this.validateCut();
            console.log('🔍 Cut validation result:', isValidCut);
            
            if (!isValidCut) {
                console.log('❌ Invalid cut detected - not counting attempt');
                this.handleInvalidCut();
                return false;
            }
            
            console.log('✅ Valid cut detected - proceeding with attempt');
            
            // Reset drawing state now that cut is committed
            this.isDrawing = false;
            
            // Calculate areas
            const areaResults = this.calculateAreas();
            console.log('📊 Area calculation results:', areaResults);
            
            // Store the results globally
            window.currentVector = vector;
            window.currentAreaResults = areaResults;
            
            // Render the cut result using the specific vector to avoid race conditions
            this.renderCutResult(areaResults, vector);
            
            // Call the main game's cut handling flow for demo mode
            console.log('🔥 HORIZONTAL MECHANIC: About to check for handleCutAttempt');
            console.log('🔥 window.handleCutAttempt exists:', typeof window.handleCutAttempt);
            console.log('🔥 isDemoMode:', window.isDemoMode);
            
            if (typeof window.handleCutAttempt === 'function') {
                console.log('🔥 HORIZONTAL MECHANIC: Calling main handleCutAttempt flow');
                // Set the global variables that handleCutAttempt expects
                window.currentVector = this.currentVector;
                // Call the main game flow
                window.handleCutAttempt();
            } else if (typeof window.showAttemptResult === 'function') {
                console.log('🔥 HORIZONTAL MECHANIC: Fallback - calling showAttemptResult directly');
                // Fallback for test lab mode
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            } else {
                console.log('🔥 HORIZONTAL MECHANIC: No cut handling function found!');
            }
            
            return true;
        } catch (error) {
            console.error('Error executing horizontal cut:', error);
            this.reset(); // Reset drawing state
            return false;
        }
    },
    
    // Validate if the cut actually divides the shape
    validateCut() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Get shapes with practice mode priority
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes : []);

        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        const areaResults = this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, this.currentVector);
        
        if (areaResults.leftPercentage < 0.1 || areaResults.rightPercentage < 0.1) {
            console.log('Invalid cut detected - no actual division:', areaResults.leftPercentage, areaResults.rightPercentage);
            return false;
        }
        
        return true;
    },
    
    // Handle invalid cuts
    handleInvalidCut() {
        console.log('🚫 Invalid cut - allowing recut without counting');
        this.reset();
        if (typeof showTryAgainMessage === 'function') showTryAgainMessage();
        this.practiceAwareRedraw();
    },

    // Practice mode aware redraw that uses correct shapes
    practiceAwareRedraw() {
        console.log('🔄 Practice-aware redraw called (horizontal)');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // Get shapes with practice mode priority
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes : []);

        console.log('🔄 Redrawing with shapes:', shapes.length, 'isPracticeMode:', window.isPracticeMode);

        // Render the correct shapes
        if (shapes && shapes.length > 0 && typeof renderShapeForCutting === 'function') {
            renderShapeForCutting(shapes);
        }
    },
    
    // Calculate areas using pixel-based method
    calculateAreas() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Get shapes with practice mode priority
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes : []);

        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        return this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, this.currentVector);
    },
    
    // Render shapes for pixel analysis (grey fill)
    renderShapesForPixelAnalysis(context, shapes) {
        context.save();
        context.fillStyle = '#dddddd';
        
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
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    // For horizontal cuts, just check if pixel is above or below the line
                    if (y < lineStart.y) {
                        leftArea++; // Above
                    } else if (y > lineStart.y) {
                        rightArea++; // Below
                    }
                }
            }
        }
        
        let calcLeftPercentage = totalShapePixels > 0 ? (leftArea / totalShapePixels) * 100 : 0;
        let calcRightPercentage = totalShapePixels > 0 ? (rightArea / totalShapePixels) * 100 : 0;

        // CRITICAL: Ensure smaller percentage is always "left" for proper coloring and scoring
        let leftPercentage, rightPercentage, finalLeftArea, finalRightArea;
        if (calcLeftPercentage <= calcRightPercentage) {
            // Left is smaller or equal - keep as is
            leftPercentage = calcLeftPercentage;
            rightPercentage = calcRightPercentage;
            finalLeftArea = leftArea;
            finalRightArea = rightArea;
        } else {
            // Right is smaller - swap so it becomes left
            leftPercentage = calcRightPercentage;
            rightPercentage = calcLeftPercentage;
            finalLeftArea = rightArea;
            finalRightArea = leftArea;
        }

        return {
            leftArea: finalLeftArea,
            rightArea: finalRightArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Render the cut result with colored areas
    renderCutResult(areaResults, cutVector = null) {
        const vectorToUse = cutVector || this.currentVector;

        // Get shapes with practice mode priority
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes : []);

        if (!vectorToUse || !shapes.length) return;

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
        let geometricAboveCount = 0;
        let geometricBelowCount = 0;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                if (pixels[pixelIndex] === 221) {
                    if (y < vectorToUse.start.y) {
                        geometricAboveCount++;
                    } else if (y > vectorToUse.start.y) {
                        geometricBelowCount++;
                    }
                }
            }
        }

        // Color whichever geometric side is smaller
        const colorAbove = geometricAboveCount <= geometricBelowCount;

        console.log(`🎨 Horizontal-only rendering: geometricAbove=${geometricAboveCount}, geometricBelow=${geometricBelowCount}, colorAbove=${colorAbove}`);
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
                    const isAbove = y < vectorToUse.start.y;
                    const isBelow = y > vectorToUse.start.y;
                    const isOnLine = !isAbove && !isBelow;

                    if (isOnLine) {
                        // On the cut line - black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
                        resultPixels[pixelIndex + 3] = 255;
                    } else if ((isAbove && colorAbove) || (isBelow && !colorAbove)) {
                        // Color the smaller area
                        const color = window.getDailyCutShadingColor ? window.getDailyCutShadingColor() : { r: 100, g: 150, b: 255 };
                        resultPixels[pixelIndex] = color.r;
                        resultPixels[pixelIndex + 1] = color.g;
                        resultPixels[pixelIndex + 2] = color.b;
                        resultPixels[pixelIndex + 3] = 255;
                    } else {
                        // Larger area - grey
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
        this.drawFinalVector(vectorToUse);
    },
    
    
    // Draw the final cut vector
    drawFinalVector(cutVector = null) {
        const vectorToUse = cutVector || this.currentVector;
        if (!vectorToUse) return;
        
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(vectorToUse.start.x, vectorToUse.start.y);
        ctx.lineTo(vectorToUse.end.x, vectorToUse.end.y);
        ctx.stroke();
        
        ctx.restore();
    },
    
    // Note: Using global calculateBounds, calculateScale, calculateOffset functions for consistency
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HorizontalOnlyMechanic;
} else {
    window.HorizontalOnlyMechanic = HorizontalOnlyMechanic;
}

// Cache version: v=20250915c