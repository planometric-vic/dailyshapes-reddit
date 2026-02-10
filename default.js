// Default Vector Cut Mechanic
// Original straight line cutting from point A to point B - extracted from main game

console.log('🔧 Default mechanic file loaded with v3.2 integration');

const DefaultMechanic = {
    name: "Default Vector Cut",
    description: "Draw straight lines to cut shapes - original game mechanic",
    
    // Mechanic state (matching original variable names)
    isDrawingVector: false,
    vectorStart: null,
    vectorEnd: null,
    currentVector: null,
    vectorCutActive: false,
    dragDistance: 0,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Default Vector Cut mechanic');
        this.reset();
        this.setupCancellationListeners();
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawingVector = false;
        this.vectorStart = null;
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;
    },
    
    // Setup cancellation listeners (right-click desktop, second finger mobile)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.isDrawingVector) {
                console.log('🔄 Right-click detected - canceling line draw');
                this.cancelDraw();
            }
        });
    },
    
    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling draw');
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
        if (!isInteractionEnabled || gameState !== 'cutting') {
            console.log('Default mechanic: Vector start ignored - interaction not enabled or wrong state');
            return false;
        }
        
        // Check for multi-touch cancellation
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleStart - canceling if drawing');
            if (this.isDrawingVector) {
                this.cancelDraw();
            }
            return false;
        }
        
        // Hide any commentary when user starts cutting
        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (typeof hideTryAgainMessage === 'function') hideTryAgainMessage();
        
        this.isDrawingVector = true;
        this.vectorStart = this.getCanvasCoordinates(event, canvasRect);
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;
        
        console.log('🎯 Default mechanic: Start drawing vector at', this.vectorStart);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawingVector || !this.vectorStart || gameState !== 'cutting') return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling line draw');
            this.cancelDraw();
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
        if (!this.isDrawingVector || !this.vectorStart || gameState !== 'cutting') {
            this.reset();
            return false;
        }
        
        this.isDrawingVector = false;
        if (!this.vectorEnd) {
            this.vectorEnd = this.vectorStart; // Handle case where no move occurred
        }
        
        // Check if this was a proper drag (not just a tap)
        if (this.dragDistance < 10) {
            console.log('🚫 Default mechanic: Cut too short, showing try again');
            
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
            
            // Calculate extended vector that spans the entire canvas
            this.currentVector = this.extendVectorToCanvasBounds(normalizedStart, normalizedEnd);
            this.vectorCutActive = true;
            
            console.log('✂️ Default mechanic: Executing vector cut', this.currentVector);
            
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
        if (typeof renderShapeForCutting === 'function' && parsedShapes) {
            renderShapeForCutting(parsedShapes);
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
        
        return {
            x: clientX - canvasRect.left,
            y: clientY - canvasRect.top
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
            console.log('🔧 Default mechanic performVectorCut called');
            
            if (!this.currentVector || !parsedShapes || parsedShapes.length === 0) {
                console.error('Missing required data for cut');
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
            window.currentVector = this.currentVector;
            window.currentAreaResults = areaResults;
            
            // Set global currentVector for drawFinalVector function
            if (typeof window !== 'undefined') {
                globalThis.currentVector = this.currentVector;
            }
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // For test lab mode, directly show the results
            if (typeof window.showAttemptResult === 'function') {
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            }
            
            return true;
        } catch (error) {
            console.error('Error executing default vector cut:', error);
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
        
        // Render shapes on temporary canvas
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 DEFAULT MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
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
        
        // Redraw original shape
        redrawCanvas();
    },
    
    // Calculate areas using pixel-based method
    calculateAreas() {
        // Create a temporary canvas to render shapes for pixel analysis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Render shapes on temporary canvas
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 DEFAULT MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
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
        if (!this.currentVector || !parsedShapes.length) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 DEFAULT MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
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
                    
                    // Always color only the left side (practice mode vs daily mode)
                    if (side === 'left') {
                        // Check if in practice mode - use golden yellow (#FAB06A = 250, 176, 106)
                        if (window.isPracticeMode) {
                            resultPixels[pixelIndex] = 250;     // #FAB06A for practice mode
                            resultPixels[pixelIndex + 1] = 176;
                            resultPixels[pixelIndex + 2] = 106;
                            resultPixels[pixelIndex + 3] = 255;
                        } else {
                            // Color left side blue for daily mode
                            resultPixels[pixelIndex] = 100;     // R
                            resultPixels[pixelIndex + 1] = 150; // G
                            resultPixels[pixelIndex + 2] = 255; // B
                            resultPixels[pixelIndex + 3] = 255; // A
                        }
                    } else if (side === 'on_line') {
                        // Cut line remains black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
                        resultPixels[pixelIndex + 3] = 255;
                    } else {
                        // Right side remains grey
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
    module.exports = DefaultMechanic;
} else {
    window.DefaultMechanic = DefaultMechanic;
}