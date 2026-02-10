// Rotating Square Cut Mechanic
// Draw squares from center point with size and rotation control

console.log('🔧 Rotating Square mechanic file loaded');

const RotatingSquareMechanic = {
    name: "Rotating Square Cut",
    description: "Draw squares from center point with size and rotation control",
    
    // Mechanic state
    isDrawing: false,
    centerPoint: null,
    currentPoint: null,
    size: 0,
    rotation: 0,
    currentSquare: null,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Rotating Square Cut mechanic');
        this.reset();
        this.setupCancellationListeners();
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawing = false;
        this.centerPoint = null;
        this.currentPoint = null;
        this.size = 0;
        this.rotation = 0;
        this.currentSquare = null;
    },
    
    // Setup cancellation listeners (right-click desktop, second finger mobile)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.isDrawing) {
                console.log('🔄 Right-click detected - canceling square draw');
                this.cancelDraw();
            }
        });
    },
    
    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling square draw');
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
        console.log('🔍 Rotating Square handleStart called', {
            isInteractionEnabled,
            currentlyDrawing: this.isDrawing
        });

        if (!isInteractionEnabled) return false;

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

        this.centerPoint = {
            x: relativeX * scaleX,
            y: relativeY * scaleY
        };

        this.isDrawing = true;
        this.hasMoved = false; // Track if user actually dragged
        this.size = 0;
        this.rotation = 0;
        this.currentSquare = null;

        // Update instruction after first touch
        if (window.updateInstructionText && window.getDynamicInstruction) {
            const dynamicInstruction = window.getDynamicInstruction('RotatingSquareMechanic', 'first_touch');
            window.updateInstructionText(dynamicInstruction);
        }

        console.log('🎯 Rotating Square mechanic: Start drawing at center', this.centerPoint, 'isDrawing:', this.isDrawing);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.centerPoint) return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling square draw');
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
        
        this.currentPoint = {
            x: relativeX * scaleX,
            y: relativeY * scaleY
        };
        
        // Calculate distance from center (this determines size)
        const dx = this.currentPoint.x - this.centerPoint.x;
        const dy = this.currentPoint.y - this.centerPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Mark that user has moved if distance is significant (increased threshold)
        if (distance > 15) {
            this.hasMoved = true;
        }

        // Size is distance from center to corner of square
        // So the side length is distance * sqrt(2)
        this.size = distance;

        // Calculate rotation angle based on drag position
        this.rotation = Math.atan2(dy, dx);

        // Create current square for preview
        this.currentSquare = {
            center: this.centerPoint,
            size: this.size,
            rotation: this.rotation
        };

        // Redraw canvas with preview
        this.drawPreview();
        return true; // Handled
    },
    
    // Handle end of interaction (mouse up / touch end)
    async handleEnd(event) {
        console.log('🔍 Rotating Square handleEnd called');

        // Require actual dragging - reject click-only interactions
        console.log('🔍 Rotating Square handleEnd check:', {
            isDrawing: this.isDrawing,
            hasCenterPoint: !!this.centerPoint,
            hasMoved: this.hasMoved,
            size: this.size
        });

        if (!this.isDrawing || !this.centerPoint || !this.hasMoved || this.size < 30) {
            console.log('🚫 Rotating Square mechanic: No drag detected or square too small, ignoring');
            this.reset();
            redrawCanvas();
            return false;
        }

        console.log('⬜ Rotating Square mechanic: Executing square cut', {
            center: this.centerPoint,
            size: this.size,
            rotation: this.rotation * 180 / Math.PI + '°'
        });
        
        // Create square cut data
        const squareData = {
            center: this.centerPoint,
            size: this.size,
            rotation: this.rotation,
            type: 'rotating-square'
        };
        
        // Reset state
        this.reset();
        
        // Execute cut using custom square logic
        return await this.executeSquareCut(squareData);
    },
    
    // Draw preview during drag
    drawPreview() {
        if (!this.currentSquare) return;

        // Redraw base canvas with practice mode shapes prioritized
        this.redrawCanvasForPreview();
        
        // Draw preview square
        ctx.save();
        
        // Translate to center and rotate
        ctx.translate(this.currentSquare.center.x, this.currentSquare.center.y);
        ctx.rotate(this.currentSquare.rotation);
        
        // Draw square centered at origin
        const halfSize = this.currentSquare.size;
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        
        ctx.beginPath();
        ctx.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
        ctx.stroke();
        
        // Draw center point
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw diagonal to show rotation
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(halfSize, 0);
        ctx.stroke();
        
        ctx.restore();
    },

    // Redraw canvas with practice mode shapes prioritized for preview
    redrawCanvasForPreview() {
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            console.log('🟡 Rotating Square: Using practice mode shapes for preview canvas');

            // Temporarily override parsedShapes with practice mode shapes
            const originalParsedShapes = parsedShapes;
            parsedShapes = window.PracticeMode.originalShapes;

            // Use the standard redrawCanvas function with practice mode shapes
            redrawCanvas();

            // Restore original parsedShapes
            parsedShapes = originalParsedShapes;
        } else {
            // For daily mode, use the standard redrawCanvas function
            redrawCanvas();
        }
    },

    // Execute square cut with proper area calculation
    async executeSquareCut(squareData) {
        try {
            console.log('🔧 Rotating Square mechanic executeSquareCut called');

            // Prioritize practice mode shapes
            // Use practice mode shapes if in practice mode
            let shapesToUse = window.isPracticeMode ?
                             (window.PracticeMode?.practiceParsedShapes || []) :
                             (parsedShapes || []);
            console.log(`🔍 ROTATING SQUARE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
            if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
                shapesToUse = window.PracticeMode.originalShapes;
                console.log('🟡 Rotating Square: Using practice mode shapes for cut calculation');
            } else if (!parsedShapes || parsedShapes.length === 0) {
                console.error('Missing required data for cut');
                return false;
            }

            if (!squareData || !shapesToUse || shapesToUse.length === 0) {
                console.error('Missing required data for cut');
                return false;
            }
            
            // Store for validation and rendering
            this.currentSquare = squareData;
            
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
            
            // Store the results globally
            window.currentSquare = squareData;
            window.currentAreaResults = areaResults;
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // Call the main game's cut handling flow for demo mode
            console.log('🔥 ROTATING SQUARE MECHANIC: About to check for handleCutAttempt');
            console.log('🔥 window.handleCutAttempt exists:', typeof window.handleCutAttempt);
            console.log('🔥 isDemoMode:', window.isDemoMode);
            
            if (typeof window.handleCutAttempt === 'function') {
                console.log('🔥 ROTATING SQUARE MECHANIC: Using square-specific area results, bypassing vector system');
                // Store square-specific results globally
                window.currentSquareData = this.currentSquare;
                window.currentAreaResults = areaResults;
                window.currentVector = null; // Prevent vector-based calculation
                
                // Call demo flow directly with our area results
                window.handleCutAttempt();
            } else if (typeof window.showAttemptResult === 'function') {
                console.log('🔥 ROTATING SQUARE MECHANIC: Fallback - calling showAttemptResult directly');
                // Fallback for test lab mode
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            } else {
                console.log('🔥 ROTATING SQUARE MECHANIC: No cut handling function found!');
            }
            
            return true;
        } catch (error) {
            console.error('Error executing rotating square cut:', error);
            return false;
        }
    },
    
    // Validate if the cut actually divides the shape
    validateCut() {
        // Prioritize practice mode shapes
        // Use practice mode shapes if in practice mode
        let shapesToUse = window.isPracticeMode ?
                         (window.PracticeMode?.practiceParsedShapes || []) :
                         (parsedShapes || []);
        console.log(`🔍 ROTATING SQUARE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            shapesToUse = window.PracticeMode.originalShapes;
            console.log('🟡 Rotating Square: Using practice mode shapes for validation');
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapesToUse);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        const areaResults = this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height);
        
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
        redrawCanvas();
    },
    
    // Calculate areas using pixel-based method
    calculateAreas() {
        // Prioritize practice mode shapes
        // Use practice mode shapes if in practice mode
        let shapesToUse = window.isPracticeMode ?
                         (window.PracticeMode?.practiceParsedShapes || []) :
                         (parsedShapes || []);
        console.log(`🔍 ROTATING SQUARE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            shapesToUse = window.PracticeMode.originalShapes;
            console.log('🟡 Rotating Square: Using practice mode shapes for area calculation');
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapesToUse);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        return this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height);
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
    
    // Check if a point is inside the rotated square
    isPointInsideSquare(x, y, center, size, rotation) {
        // Translate point to square's coordinate system
        const dx = x - center.x;
        const dy = y - center.y;
        
        // Rotate point back (inverse rotation)
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;
        
        // Check if point is inside square (now axis-aligned)
        return Math.abs(rotatedX) <= size && Math.abs(rotatedY) <= size;
    },
    
    // Calculate pixel-based areas for square cut
    calculatePixelBasedAreas(pixels, width, height) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;
        
        const center = this.currentSquare.center;
        const size = this.currentSquare.size;
        const rotation = this.currentSquare.rotation;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    if (this.isPointInsideSquare(x, y, center, size, rotation)) {
                        insideArea++; // Inside square
                    } else {
                        outsideArea++; // Outside square
                    }
                }
            }
        }
        
        const insidePercentage = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        const outsidePercentage = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;

        // CRITICAL: Ensure smaller percentage is always "left" for proper coloring and scoring
        let leftPercentage, rightPercentage, leftArea, rightArea;
        if (insidePercentage <= outsidePercentage) {
            // Inside is smaller or equal - assign to left
            leftPercentage = insidePercentage;
            rightPercentage = outsidePercentage;
            leftArea = insideArea;
            rightArea = outsideArea;
        } else {
            // Outside is smaller - swap so it becomes left
            leftPercentage = outsidePercentage;
            rightPercentage = insidePercentage;
            leftArea = outsideArea;
            rightArea = insideArea;
        }

        return {
            leftArea,
            rightArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Render the cut result with colored areas
    renderCutResult(areaResults) {
        // Prioritize practice mode shapes
        // Use practice mode shapes if in practice mode
        let shapesToUse = window.isPracticeMode ?
                         (window.PracticeMode?.practiceParsedShapes || []) :
                         (parsedShapes || []);
        console.log(`🔍 ROTATING SQUARE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            shapesToUse = window.PracticeMode.originalShapes;
            console.log('🟡 Rotating Square: Using practice mode shapes for rendering');
        }

        if (!this.currentSquare || !shapesToUse.length) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapesToUse);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        const center = this.currentSquare.center;
        const size = this.currentSquare.size;
        const rotation = this.currentSquare.rotation;

        // CRITICAL: We need to determine which GEOMETRIC side is actually smaller
        // Count pixels to see which is actually inside vs outside
        let geometricInsideCount = 0;
        let geometricOutsideCount = 0;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const r = pixels[pixelIndex];
                if (r === 221) {
                    if (this.isPointInsideSquare(x, y, center, size, rotation)) {
                        geometricInsideCount++;
                    } else {
                        geometricOutsideCount++;
                    }
                }
            }
        }

        // Color whichever geometric side is smaller
        const colorInside = geometricInsideCount <= geometricOutsideCount;

        console.log(`🎨 Rotating square rendering: geometricInside=${geometricInsideCount}, geometricOutside=${geometricOutsideCount}, colorInside=${colorInside}`);
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
                    const isInside = this.isPointInsideSquare(x, y, center, size, rotation);
                    const isOnBorder = this.isPointOnSquareBorder(x, y, center, size, rotation);

                    if (isOnBorder) {
                        // On the square boundary - black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
                        resultPixels[pixelIndex + 3] = 255;
                    } else if ((isInside && colorInside) || (!isInside && !colorInside)) {
                        // Color the smaller area (determined by colorInside flag)
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
        
        // Draw shape outlines and final square using global functions
        if (typeof drawShapeOutlines === 'function') {
            drawShapeOutlines();
        }
        
        this.drawFinalSquare();
    },
    
    // Check if point is on square border
    isPointOnSquareBorder(x, y, center, size, rotation) {
        // Translate point to square's coordinate system
        const dx = x - center.x;
        const dy = y - center.y;
        
        // Rotate point back (inverse rotation)
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;
        
        // Check if point is on border (within 1 pixel tolerance)
        const onVerticalEdge = Math.abs(Math.abs(rotatedX) - size) < 1.5 && Math.abs(rotatedY) <= size;
        const onHorizontalEdge = Math.abs(Math.abs(rotatedY) - size) < 1.5 && Math.abs(rotatedX) <= size;
        
        return onVerticalEdge || onHorizontalEdge;
    },
    
    // Draw the final square
    drawFinalSquare() {
        if (!this.currentSquare) return;
        
        ctx.save();
        
        // Translate to center and rotate
        ctx.translate(this.currentSquare.center.x, this.currentSquare.center.y);
        ctx.rotate(this.currentSquare.rotation);
        
        // Draw square centered at origin
        const halfSize = this.currentSquare.size;
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.rect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
        ctx.stroke();
        
        ctx.restore();
    }
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RotatingSquareMechanic;
} else {
    window.RotatingSquareMechanic = RotatingSquareMechanic;
}