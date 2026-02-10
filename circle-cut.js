// Circle Cut Mechanic
// Draw circles from center point to cut shapes

const CircleCutMechanic = {
    name: "Circle Cut",
    description: "Draw circles from center point to cut shapes",
    
    // Mechanic state
    isDrawing: false,
    centerPoint: null,
    radius: 0,
    currentCircle: null,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Circle Cut mechanic');
        this.reset();
        this.setupCancellationListeners();
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawing = false;
        this.centerPoint = null;
        this.radius = 0;
        this.currentCircle = null;
    },
    
    // Setup cancellation listeners (right-click desktop, second finger mobile)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.isDrawing) {
                console.log('🔄 Right-click detected - canceling circle draw');
                this.cancelDraw();
            }
        });
    },
    
    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling circle draw');
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
        this.radius = 0;
        this.currentCircle = null;
        
        // Update instruction after first touch
        if (window.updateInstructionText && window.getDynamicInstruction) {
            const dynamicInstruction = window.getDynamicInstruction('CircleCutMechanic', 'first_touch');
            window.updateInstructionText(dynamicInstruction);
        }
        
        console.log('🎯 Circle mechanic: Start drawing at center', this.centerPoint);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.centerPoint) return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling circle draw');
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
        
        const currentPoint = {
            x: relativeX * scaleX,
            y: relativeY * scaleY
        };
        
        // Calculate radius from center to current point
        this.radius = Math.sqrt(
            Math.pow(currentPoint.x - this.centerPoint.x, 2) + 
            Math.pow(currentPoint.y - this.centerPoint.y, 2)
        );
        
        // Create current circle for preview
        this.currentCircle = {
            center: this.centerPoint,
            radius: this.radius
        };
        
        // Redraw canvas with preview
        this.drawPreview();
        return true; // Handled
    },
    
    // Handle end of interaction (mouse up / touch end)
    async handleEnd(event) {
        if (!this.isDrawing || !this.centerPoint || this.radius < 5) {
            console.log('🚫 Circle mechanic: Circle too small, ignoring');
            this.reset();
            redrawCanvas();
            return false;
        }
        
        console.log('⭕ Circle mechanic: Executing circle cut', {
            center: this.centerPoint,
            radius: this.radius
        });
        
        // Create circle cut data
        const circleData = {
            center: this.centerPoint,
            radius: this.radius,
            type: 'circle'
        };
        
        // Reset state
        this.reset();
        
        // Execute cut using custom circle logic
        return await this.executeCircleCut(circleData);
    },
    
    // Draw preview during drag
    drawPreview() {
        if (!this.currentCircle) return;
        
        // Redraw base canvas
        redrawCanvas();
        
        // Draw preview circle
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);

        ctx.beginPath();
        ctx.arc(
            this.currentCircle.center.x,
            this.currentCircle.center.y,
            this.currentCircle.radius,
            0,
            2 * Math.PI
        );
        ctx.stroke();

        // Draw center point
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(this.currentCircle.center.x, this.currentCircle.center.y, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.restore();
    },
    
    // Execute circle cut with proper area calculation
    async executeCircleCut(circleData) {
        try {
            console.log('🔧 Circle mechanic executeCircleCut called');

            // CRITICAL: Check for practice mode FIRST to avoid daily shape contamination
            let shapesToUse;

            if (window.isPracticeMode) {
                console.log('🎯 Circle mechanic: In practice mode, using practice shapes only');

                // Priority 1: Use window.parsedShapes (should be practice shapes only)
                if (window.parsedShapes && window.parsedShapes.length > 0) {
                    shapesToUse = window.parsedShapes;
                    console.log('🔄 Using window.parsedShapes (practice shapes):', shapesToUse.length);
                }
                // Priority 2: Use practice mode stored shapes
                else if (window.PracticeMode && window.PracticeMode.originalShapes) {
                    shapesToUse = window.PracticeMode.originalShapes;
                    console.log('🔄 Using practice mode stored shapes:', shapesToUse.length);
                }
                // Priority 3: Parse from currentGeoJSON as fallback
                else if (window.currentGeoJSON && window.parseGeometry) {
                    console.log('📐 Parsing shapes from currentGeoJSON as practice mode fallback...');
                    const parseResult = window.parseGeometry(window.currentGeoJSON);
                    if (parseResult && parseResult.shapes) {
                        shapesToUse = parseResult.shapes;
                        console.log('🔄 Parsed practice shapes from currentGeoJSON:', shapesToUse.length);
                    }
                }
            } else {
                // Daily mode - use global parsedShapes
                console.log('🏠 Circle mechanic: In daily mode, using global parsedShapes');
                shapesToUse = parsedShapes;
                console.log('🔄 Using daily mode parsedShapes:', shapesToUse?.length || 0);
            }

            if (!circleData || !shapesToUse || shapesToUse.length === 0) {
                console.error('Missing required data for cut - circleData:', !!circleData, 'shapesToUse:', shapesToUse?.length || 0);
                console.error('🔍 Debug info - parsedShapes:', parsedShapes?.length || 0, 'isPracticeMode:', window.isPracticeMode, 'practiceShapes:', window.PracticeMode?.originalShapes?.length || 0);
                return false;
            }

            // CRITICAL: Preserve original shapes before any processing
            const originalShapes = JSON.parse(JSON.stringify(shapesToUse));
            console.log('🔒 Circle mechanic: Preserved original shapes', originalShapes.length);

            // Store for validation and rendering
            this.currentCircle = circleData;
            this.originalShapes = originalShapes; // Store for later use

            // First validate the cut
            const isValidCut = this.validateCut();
            console.log('🔍 Cut validation result:', isValidCut);

            if (!isValidCut) {
                console.log('❌ Invalid cut detected - not counting attempt');
                this.handleInvalidCut();
                return false;
            }

            console.log('✅ Valid cut detected - proceeding with attempt');

            // Calculate areas using original shapes
            const areaResults = this.calculateAreas();
            console.log('📊 Area calculation results:', areaResults);

            // Validate that cut is not 0/100 split
            const leftRounded = Math.round(areaResults.leftPercentage);
            const rightRounded = Math.round(areaResults.rightPercentage);

            if ((leftRounded === 0 && rightRounded === 100) || (leftRounded === 100 && rightRounded === 0)) {
                console.log('🚫 INVALID CUT: Circle cut resulted in 0/100 split - treating as invalid');
                this.handleInvalidCut();
                return false;
            }

            // Store the results globally
            window.currentCircle = circleData;
            window.currentAreaResults = areaResults;

            // Render the cut result with current circle data and original shapes
            this.renderCutResult(areaResults, circleData);

            // Call the main game's cut handling flow for demo mode
            console.log('🔥 CIRCLE MECHANIC: About to check for handleCutAttempt');
            console.log('🔥 window.handleCutAttempt exists:', typeof window.handleCutAttempt);
            console.log('🔥 isDemoMode:', window.isDemoMode);

            if (typeof window.handleCutAttempt === 'function') {
                console.log('🔥 CIRCLE MECHANIC: Using circle-specific area results, bypassing vector system');
                // Store circle-specific results globally
                window.currentCircleData = circleData;
                window.currentAreaResults = areaResults;

                // CRITICAL: Restore original shapes to prevent shape switching
                window.parsedShapes = originalShapes;

                // For practice mode, handle cut result display directly
                if (window.isPracticeMode && window.PracticeMode) {
                    console.log('🔧 Practice mode: Handling cut result display directly');
                    // Create a synthetic vector from the circle for rendering purposes
                    const syntheticVector = {
                        start: { x: circleData.center.x - circleData.radius, y: circleData.center.y },
                        end: { x: circleData.center.x + circleData.radius, y: circleData.center.y },
                        isCircle: true,
                        circle: circleData
                    };
                    window.currentVector = syntheticVector;

                    // Call practice mode handler directly
                    window.PracticeMode.handleCutMade({
                        leftPercentage: areaResults.leftPercentage,
                        rightPercentage: areaResults.rightPercentage
                    });
                } else {
                    window.currentVector = null; // Prevent vector-based calculation for daily mode

                    // Call demo flow directly with our area results
                    if (typeof window.handleShapeBasedCutAttempt === 'function') {
                        window.handleShapeBasedCutAttempt(areaResults);
                    } else {
                        // Fallback: call main flow but it will use our stored results
                        window.handleCutAttempt();
                    }
                }
            } else if (typeof window.showAttemptResult === 'function') {
                console.log('🔥 CIRCLE MECHANIC: Fallback - calling showAttemptResult directly');
                // Fallback for test lab mode
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            } else {
                console.log('🔥 CIRCLE MECHANIC: No cut handling function found!');
            }

            return true;
        } catch (error) {
            console.error('Error executing circle cut:', error);
            return false;
        }
    },
    
    // Validate if the cut actually divides the shape
    validateCut() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Use preserved original shapes for validation
        // Use practice mode shapes if in practice mode
        const shapesToUse = window.isPracticeMode ?
                           (this.originalShapes || window.parsedShapes || []) :
                           (this.originalShapes || parsedShapes || []);
        console.log(`🔍 CIRCLE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
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
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Use preserved original shapes for area calculation
        // Use practice mode shapes if in practice mode
        const shapesToUse = window.isPracticeMode ?
                           (this.originalShapes || window.parsedShapes || []) :
                           (this.originalShapes || parsedShapes || []);
        console.log(`🔍 CIRCLE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
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
    
    // Calculate pixel-based areas for circle cut - OPTIMIZED VERSION
    calculatePixelBasedAreas(pixels, width, height) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;

        const center = this.currentCircle.center;
        const radius = this.currentCircle.radius;
        const radiusSquared = radius * radius; // Avoid Math.sqrt for performance
        const centerX = center.x;
        const centerY = center.y;

        for (let y = 0; y < height; y++) {
            const dy = y - centerY;
            const dySquared = dy * dy;
            const rowStart = y * width * 4;

            for (let x = 0; x < width; x++) {
                const pixelIndex = rowStart + x * 4;
                const r = pixels[pixelIndex];

                // Quick check for shape pixels
                if (r === 221) {
                    totalShapePixels++;

                    // Calculate distance squared (avoid Math.sqrt)
                    const dx = x - centerX;
                    const distanceSquared = dx * dx + dySquared;

                    if (distanceSquared <= radiusSquared) {
                        insideArea++; // Inside circle
                    } else {
                        outsideArea++; // Outside circle
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
    
    // Render the cut result with colored areas - OPTIMIZED VERSION
    renderCutResult(areaResults, currentCircleData) {
        // Use the passed circle data or fall back to stored circle
        const circleToUse = currentCircleData || this.currentCircle;

        // CRITICAL: Use preserved original shapes, not current parsedShapes
        // Use practice mode shapes if in practice mode
        const shapesToUse = window.isPracticeMode ?
                           (this.originalShapes || window.parsedShapes || []) :
                           (this.originalShapes || parsedShapes || []);
        console.log(`🔍 CIRCLE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
        if (!circleToUse || !shapesToUse.length) return;

        console.log('🚀 OPTIMIZED: Starting fast circle rendering with preserved shapes:', shapesToUse.length);
        const startTime = performance.now();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // Check practice mode once outside the pixel loop for performance
        const isInPracticeMode = window.isPracticeMode ||
                               (window.SimplePracticeMode && window.SimplePracticeMode.isActive);

        // Pre-calculate circle properties for optimization
        const center = circleToUse.center;
        const radius = circleToUse.radius;
        const radiusSquared = radius * radius; // Avoid Math.sqrt in inner loop
        const innerRadiusSquared = (radius - 1) * (radius - 1);
        const outerRadiusSquared = (radius + 1) * (radius + 1);

        // Extract centerX and centerY early for use in loops
        const centerX = center.x;
        const centerY = center.y;

        // CRITICAL: We need to determine which GEOMETRIC side is actually smaller
        // Count pixels to see which is actually inside vs outside

        // Create temporary canvas for shape analysis - use preserved shapes
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapesToUse);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        let geometricInsideCount = 0;
        let geometricOutsideCount = 0;

        for (let y = 0; y < canvas.height; y++) {
            const dy = y - centerY;
            const dySquared = dy * dy;
            const rowStart = y * canvas.width * 4;
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = rowStart + x * 4;
                if (pixels[pixelIndex] === 221) {
                    const dx = x - centerX;
                    const distanceSquared = dx * dx + dySquared;
                    if (distanceSquared <= radiusSquared) {
                        geometricInsideCount++;
                    } else {
                        geometricOutsideCount++;
                    }
                }
            }
        }

        // Color whichever geometric side is smaller
        const colorInside = geometricInsideCount <= geometricOutsideCount;

        console.log(`🎨 Circle rendering: geometricInside=${geometricInsideCount}, geometricOutside=${geometricOutsideCount}, colorInside=${colorInside}`);
        console.log(`   areaResults: leftPercentage=${areaResults.leftPercentage.toFixed(1)}%, rightPercentage=${areaResults.rightPercentage.toFixed(1)}%`);

        // Define colors once - use shape-based color for daily mode
        const color = window.getDailyCutShadingColor ? window.getDailyCutShadingColor() : { r: 100, g: 150, b: 255 };
        const smallerAreaColor = [color.r, color.g, color.b, 255];
        const largerAreaColor = [221, 221, 221, 255]; // Grey
        const boundaryColor = [0, 0, 0, 255];         // Black
        const backgroundWhite = [255, 255, 255, 255]; // White

        const resultImageData = ctx.createImageData(canvas.width, canvas.height);
        const resultPixels = resultImageData.data;

        // Optimized pixel processing with reduced calculations
        const width = canvas.width;
        const height = canvas.height;

        for (let y = 0; y < height; y++) {
            const dy = y - centerY;
            const dySquared = dy * dy;
            const rowStart = y * width * 4;

            for (let x = 0; x < width; x++) {
                const pixelIndex = rowStart + x * 4;
                const r = pixels[pixelIndex];

                // Quick check: if not grey (shape), set to white background
                if (r !== 221) {
                    resultPixels[pixelIndex] = 255;     // R
                    resultPixels[pixelIndex + 1] = 255; // G
                    resultPixels[pixelIndex + 2] = 255; // B
                    resultPixels[pixelIndex + 3] = 255; // A
                    continue;
                }

                // This is a shape pixel, calculate distance efficiently
                const dx = x - centerX;
                const distanceSquared = dx * dx + dySquared;

                let pixelColor;
                const isInside = distanceSquared < innerRadiusSquared;
                const isOutside = distanceSquared > outerRadiusSquared;

                if (!isInside && !isOutside) {
                    // On boundary
                    pixelColor = boundaryColor;
                } else if ((isInside && colorInside) || (isOutside && !colorInside)) {
                    // Color the smaller area
                    pixelColor = smallerAreaColor;
                } else {
                    // Larger area stays grey
                    pixelColor = largerAreaColor;
                }

                resultPixels[pixelIndex] = pixelColor[0];
                resultPixels[pixelIndex + 1] = pixelColor[1];
                resultPixels[pixelIndex + 2] = pixelColor[2];
                resultPixels[pixelIndex + 3] = pixelColor[3];
            }
        }

        ctx.putImageData(resultImageData, 0, 0);

        const renderTime = performance.now() - startTime;
        console.log(`🚀 OPTIMIZED: Circle rendering completed in ${renderTime.toFixed(2)}ms`);

        // Draw grid lines over the result (without clearing the background)
        drawGridLinesOnly();

        // Draw shape outlines and final circle using global functions
        if (typeof drawShapeOutlines === 'function') {
            drawShapeOutlines();
        }

        this.drawFinalCircle(circleToUse);
    },
    
    
    // Draw the final circle
    drawFinalCircle(currentCircleData) {
        // Use the passed circle data or fall back to stored circle
        const circleToUse = currentCircleData || this.currentCircle;
        if (!circleToUse) return;
        
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(
            circleToUse.center.x,
            circleToUse.center.y,
            circleToUse.radius,
            0,
            2 * Math.PI
        );
        ctx.stroke();
        
        ctx.restore();
    },
    
    // Note: Using global calculateBounds, calculateScale, calculateOffset functions for consistency
    
    // Helper: Convert circle to polygon points
    circleToPolygon(center, radius, segments = 32) {
        const points = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            points.push({
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle)
            });
        }
        return points;
    }
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CircleCutMechanic;
} else {
    window.CircleCutMechanic = CircleCutMechanic;
}