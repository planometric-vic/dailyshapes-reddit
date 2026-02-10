// Diagonal Ascending Cut Mechanic (45° Left to Right)
// Only allows diagonal cuts that rise from left to right at 45 degrees

const DiagonalAscendingMechanic = {
    name: "Diagonal Ascending Cut",
    description: "Draw only 45° diagonal lines rising left to right",
    
    // Mechanic state
    isDrawing: false,
    startPoint: null,
    endPoint: null,
    currentVector: null,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Diagonal Ascending Cut mechanic');
        this.reset();
        this.setupDesktopUndoListeners();
    },
    
    // Setup right-click listener for desktop undo functionality
    setupDesktopUndoListeners() {
        console.log('🔧 Setting up desktop undo listeners for diagonal-ascending');
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            console.log('❌ Canvas not found for diagonal-ascending undo listeners');
            return;
        }
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            console.log('🔄 Diagonal-ascending contextmenu triggered, isDrawing:', this.isDrawing);
            if (this.isDrawing) {
                console.log('🔄 Right-click detected - canceling diagonal line draw');
                this.cancelDraw();
            }
        });
        console.log('✅ Diagonal-ascending undo listener added');
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.currentVector = null;
    },
    
    
    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling diagonal line');
        this.reset();
        this.practiceAwareRedraw();
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
        if (!isInteractionEnabled) return false;

        // Update instruction after first touch
        if (window.updateInstructionText && window.getDynamicInstruction) {
            const dynamicInstruction = window.getDynamicInstruction('DiagonalAscendingMechanic', 'first_touch');
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
        
        // Calculate the 45° diagonal line through this point
        // Line equation: y = -x + (startY + startX)
        const intercept = this.startPoint.y + this.startPoint.x;
        
        // Find where this diagonal intersects canvas bounds
        const intersections = this.calculateDiagonalIntersections(intercept);
        
        if (intersections.length >= 2) {
            this.currentVector = {
                start: intersections[0],
                end: intersections[1]
            };
        }
        
        this.isDrawing = true;

        // Draw the initial diagonal line
        this.drawPreview();
        
        console.log('🎯 Diagonal Ascending mechanic: 45° line created through point', this.startPoint);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.startPoint) return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling diagonal line');
            this.cancelDraw();
            return true; // Handled
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
        
        // Update position to track finger/mouse
        const newPoint = {
            x: relativeX * scaleX,
            y: relativeY * scaleY
        };
        
        // Calculate new diagonal through this point
        const intercept = newPoint.y + newPoint.x;
        
        // Find where this diagonal intersects canvas bounds
        const intersections = this.calculateDiagonalIntersections(intercept);
        
        if (intersections.length >= 2) {
            this.currentVector = {
                start: intersections[0],
                end: intersections[1]
            };
        }
        
        // Redraw canvas with updated line position
        this.drawPreview();
        return true; // Handled
    },
    
    // Calculate where 45° diagonal line intersects canvas bounds
    calculateDiagonalIntersections(intercept) {
        const intersections = [];
        
        // Left edge (x = 0): y = intercept
        const leftY = intercept;
        if (leftY >= 0 && leftY <= canvas.height) {
            intersections.push({ x: 0, y: leftY });
        }
        
        // Top edge (y = 0): x = intercept
        const topX = intercept;
        if (topX >= 0 && topX <= canvas.width) {
            intersections.push({ x: topX, y: 0 });
        }
        
        // Right edge (x = canvas.width): y = -canvas.width + intercept
        const rightY = -canvas.width + intercept;
        if (rightY >= 0 && rightY <= canvas.height) {
            intersections.push({ x: canvas.width, y: rightY });
        }
        
        // Bottom edge (y = canvas.height): x = -canvas.height + intercept
        const bottomX = -canvas.height + intercept;
        if (bottomX >= 0 && bottomX <= canvas.width) {
            intersections.push({ x: bottomX, y: canvas.height });
        }
        
        return intersections;
    },
    
    // Handle end of interaction (mouse up / touch end)
    async handleEnd(event) {
        if (!this.isDrawing || !this.currentVector) {
            this.reset();
            return false;
        }
        
        console.log('✂️ Diagonal Ascending mechanic: Executing 45° diagonal cut');
        
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
        
        // Draw diagonal preview line
        ctx.save();
        ctx.strokeStyle = '#000000'; // Black for diagonal ascending
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
            console.log('🔧 Diagonal Ascending mechanic executeCut called');
            
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
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // Call the main game's cut handling flow for demo mode
            console.log('🔥 DIAGONAL MECHANIC: About to check for handleCutAttempt');
            console.log('🔥 window.handleCutAttempt exists:', typeof window.handleCutAttempt);
            console.log('🔥 isDemoMode:', window.isDemoMode);
            
            if (typeof window.handleCutAttempt === 'function') {
                console.log('🔥 DIAGONAL MECHANIC: Calling main handleCutAttempt flow');
                // Set the global variables that handleCutAttempt expects
                window.currentVector = this.currentVector;
                // Call the main game flow
                window.handleCutAttempt();
            } else if (typeof window.showAttemptResult === 'function') {
                console.log('🔥 DIAGONAL MECHANIC: Fallback - calling showAttemptResult directly');
                // Fallback for test lab mode
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            } else {
                console.log('🔥 DIAGONAL MECHANIC: No cut handling function found!');
            }
            
            return true;
        } catch (error) {
            console.error('Error executing diagonal ascending cut:', error);
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
        
        // For 45° ascending diagonal: y = -x + intercept
        // Rearranged: x + y = intercept
        // Points where x + y < intercept are on the "left" (above/left of line)
        // Points where x + y > intercept are on the "right" (below/right of line)
        const intercept = vector.start.y + vector.start.x;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    const pixelSum = x + y;
                    
                    if (pixelSum < intercept) {
                        leftArea++; // Above/left of diagonal
                    } else if (pixelSum > intercept) {
                        rightArea++; // Below/right of diagonal
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
    renderCutResult(areaResults) {
        // Get shapes with practice mode priority
        const shapes = window.isPracticeMode ?
                      (window.PracticeMode?.practiceParsedShapes || []) :
                      ((typeof parsedShapes !== 'undefined') ? parsedShapes : []);

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
        const intercept = this.currentVector.start.y + this.currentVector.start.x;
        let geometricUpperLeftCount = 0;
        let geometricLowerRightCount = 0;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                if (pixels[pixelIndex] === 221) {
                    const pixelSum = x + y;
                    if (pixelSum < intercept - 1) {
                        geometricUpperLeftCount++;
                    } else if (pixelSum > intercept + 1) {
                        geometricLowerRightCount++;
                    }
                }
            }
        }

        // Color whichever geometric side is smaller
        const colorUpperLeft = geometricUpperLeftCount <= geometricLowerRightCount;

        console.log(`🎨 Diagonal-ascending rendering: geometricUpperLeft=${geometricUpperLeftCount}, geometricLowerRight=${geometricLowerRightCount}, colorUpperLeft=${colorUpperLeft}`);
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
                    const pixelSum = x + y;
                    const isUpperLeft = pixelSum < intercept - 1;
                    const isLowerRight = pixelSum > intercept + 1;
                    const isOnLine = !isUpperLeft && !isLowerRight;

                    if (isOnLine) {
                        // On the cut line - black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
                        resultPixels[pixelIndex + 3] = 255;
                    } else if ((isUpperLeft && colorUpperLeft) || (isLowerRight && !colorUpperLeft)) {
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

    // Practice mode aware redraw that uses correct shapes
    practiceAwareRedraw() {
        console.log('🔄 Practice-aware redraw called (diagonal-ascending)');

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

    // Note: Using global calculateBounds, calculateScale, calculateOffset functions for consistency
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiagonalAscendingMechanic;
} else {
    window.DiagonalAscendingMechanic = DiagonalAscendingMechanic;
}

// Cache version: v=20250915b