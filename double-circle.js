// Double Circle Cut Mechanic
// Draw two circles to divide shapes into 3 areas: inner circle, between circles, outside both

console.log('🔧 Double Circle mechanic file loaded');

const DoubleCircleMechanic = {
    name: "Double Circle Cut",
    description: "Draw two circles to create 3 areas - draws first circle, then second circle",
    
    // Mechanic state
    stage: 'first-circle', // 'first-circle', 'second-circle', 'complete'
    circles: [], // Array of {center: {x, y}, radius: number}
    isDrawing: false,
    currentCenter: null,
    currentRadius: 0,
    
    // Colors for the three areas
    INNER_COLOR: { r: 100, g: 150, b: 255 }, // Blue (inside first circle) - will be overridden in practice mode
    INNER_COLOR_PRACTICE: { r: 250, g: 176, b: 106 }, // Golden yellow for practice mode
    MIDDLE_COLOR: { r: 255, g: 165, b: 0 }, // Orange (between circles)
    OUTER_COLOR: { r: 221, g: 221, b: 221 }, // Grey (outside both circles)
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Double Circle Cut mechanic');
        this.reset();
        this.setupCancellationListeners();
    },
    
    // Reset mechanic state
    reset() {
        this.stage = 'first-circle';
        this.circles = [];
        this.isDrawing = false;
        this.currentCenter = null;
        this.currentRadius = 0;
    },
    
    // Setup cancellation listeners (right-click desktop, second finger mobile)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.isDrawing || this.stage !== 'first-circle') {
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
            if (this.isDrawing || this.stage !== 'first-circle') {
                this.cancelDraw();
            }
            return false;
        }
        
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        this.currentCenter = {
            x: clientX - canvasRect.left,
            y: clientY - canvasRect.top
        };
        
        this.isDrawing = true;
        this.currentRadius = 0;
        
        console.log(`🎯 Double Circle: Start drawing ${this.stage} at center`, this.currentCenter);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.currentCenter) return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling circle draw');
            this.cancelDraw();
            return true; // Handled
        }
        
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        const currentPoint = {
            x: clientX - canvasRect.left,
            y: clientY - canvasRect.top
        };
        
        // Calculate radius from center to current point
        this.currentRadius = Math.sqrt(
            Math.pow(currentPoint.x - this.currentCenter.x, 2) + 
            Math.pow(currentPoint.y - this.currentCenter.y, 2)
        );
        
        // Redraw preview
        this.drawPreview();
        return true; // Handled
    },
    
    // Handle end of interaction (mouse up / touch end)
    async handleEnd(event) {
        if (!this.isDrawing || !this.currentCenter) {
            this.reset();
            return false;
        }
        
        // Minimum radius check
        if (this.currentRadius < 10) {
            console.log('🚫 Double Circle: Circle too small, ignoring');
            this.isDrawing = false;
            this.drawPreview();
            return false;
        }
        
        // Add the completed circle
        this.circles.push({
            center: this.currentCenter,
            radius: this.currentRadius
        });
        
        console.log(`✅ Double Circle: ${this.stage} completed`, this.circles[this.circles.length - 1]);
        
        this.isDrawing = false;
        
        if (this.stage === 'first-circle') {
            // Move to second circle
            this.stage = 'second-circle';
            this.drawPreview();
            console.log('🔧 Ready for second circle');
            return true;
        } else if (this.stage === 'second-circle') {
            // Execute the cut with both circles
            console.log('✂️ Double Circle: Executing cut with both circles');
            this.stage = 'complete';
            return await this.executeCut();
        }
        
        return false;
    },
    
    // Draw preview of current state
    drawPreview() {
        // Redraw base canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (typeof renderShapeForCutting === 'function' && parsedShapes) {
            renderShapeForCutting(parsedShapes);
        }
        
        // Draw completed circles (solid)
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        
        this.circles.forEach((circle, index) => {
            ctx.beginPath();
            ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Label the circles
            ctx.fillStyle = '#000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${index + 1}`, circle.center.x, circle.center.y);
        });
        
        // Draw current circle being drawn (dashed)
        if (this.isDrawing && this.currentRadius > 0) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.arc(this.currentCenter.x, this.currentCenter.y, this.currentRadius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw center point
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(this.currentCenter.x, this.currentCenter.y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Draw instruction text
        this.drawInstructions();
    },
    
    // Draw instruction text
    drawInstructions() {
        let instruction = '';
        switch (this.stage) {
            case 'first-circle':
                instruction = 'Draw first circle (drag from center)';
                break;
            case 'second-circle':
                instruction = 'Draw second circle (drag from center)';
                break;
            case 'complete':
                instruction = 'Executing cut...';
                break;
        }
        
        if (instruction) {
            ctx.save();
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const textWidth = ctx.measureText(instruction).width;
            const padding = 10;
            const x = canvas.width / 2;
            const y = 10;
            
            // Draw background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(x - textWidth/2 - padding, y, textWidth + padding*2, 30);
            
            // Draw text
            ctx.fillStyle = '#333';
            ctx.fillText(instruction, x, y + 8);
            
            ctx.restore();
        }
    },
    
    // Execute the actual cut
    async executeCut() {
        try {
            console.log('🔧 Double Circle executeCut called');
            
            if (this.circles.length !== 2 || !parsedShapes || parsedShapes.length === 0) {
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
            
            // Calculate areas for three regions
            const areaResults = this.calculateAreas();
            console.log('📊 Area calculation results:', areaResults);
            
            // Store the results globally
            window.currentCircles = this.circles;
            window.currentAreaResults = areaResults;
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // Show the results with three percentages
            if (typeof window.showDoubleCircleResult === 'function') {
                window.showDoubleCircleResult(areaResults.innerPercentage, areaResults.middlePercentage, areaResults.outerPercentage);
            } else if (typeof window.showAttemptResult === 'function') {
                // Fallback to regular display (showing just inner vs outer+middle)
                window.showAttemptResult(areaResults.innerPercentage, areaResults.middlePercentage + areaResults.outerPercentage);
            }
            
            return true;
        } catch (error) {
            console.error('Error executing double circle cut:', error);
            return false;
        } finally {
            this.reset();
        }
    },
    
    // Validate if the cut actually divides the shape
    validateCut() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 DOUBLE CIRCLE MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        const areaResults = this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height);
        
        // Check if all three areas have some content
        if (areaResults.innerPercentage < 0.1 && areaResults.middlePercentage < 0.1 && areaResults.outerPercentage < 0.1) {
            console.log('Invalid cut detected - no shape division:', areaResults);
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
        
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 DOUBLE CIRCLE MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
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
        
        shapes.forEach(shape => {
            drawPolygonForPixelAnalysis(context, shape, scale, offset);
        });
        
        context.restore();
    },
    
    // Calculate pixel-based areas for three regions
    calculatePixelBasedAreas(pixels, width, height) {
        let innerArea = 0;    // Inside first circle
        let middleArea = 0;   // Between circles
        let outerArea = 0;    // Outside both circles
        let totalShapePixels = 0;
        
        const circle1 = this.circles[0];
        const circle2 = this.circles[1];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    // Calculate distances to both circle centers
                    const dist1 = Math.sqrt(
                        Math.pow(x - circle1.center.x, 2) + 
                        Math.pow(y - circle1.center.y, 2)
                    );
                    const dist2 = Math.sqrt(
                        Math.pow(x - circle2.center.x, 2) + 
                        Math.pow(y - circle2.center.y, 2)
                    );
                    
                    // Determine which region this pixel belongs to
                    const insideCircle1 = dist1 < circle1.radius;
                    const insideCircle2 = dist2 < circle2.radius;
                    
                    if (insideCircle1 && insideCircle2) {
                        // Inside both circles - belongs to the smaller circle's region
                        if (circle1.radius <= circle2.radius) {
                            innerArea++; // Circle 1 is smaller, so this is inner
                        } else {
                            // Circle 2 is smaller, need to determine logic
                            // For simplicity, let's say overlapping area goes to inner
                            innerArea++;
                        }
                    } else if (insideCircle1) {
                        innerArea++; // Inside circle 1 only
                    } else if (insideCircle2) {
                        // Inside circle 2 only - could be inner or middle depending on which circle is which
                        // For now, let's treat the first drawn circle as defining "inner"
                        middleArea++;
                    } else {
                        outerArea++; // Outside both circles
                    }
                }
            }
        }
        
        const innerPercentage = totalShapePixels > 0 ? (innerArea / totalShapePixels) * 100 : 0;
        const middlePercentage = totalShapePixels > 0 ? (middleArea / totalShapePixels) * 100 : 0;
        const outerPercentage = totalShapePixels > 0 ? (outerArea / totalShapePixels) * 100 : 0;
        
        return {
            innerArea,
            middleArea,
            outerArea,
            totalShapePixels,
            innerPercentage,
            middlePercentage,
            outerPercentage
        };
    },
    
    // Render the cut result with colored areas
    renderCutResult(areaResults) {
        if (this.circles.length !== 2 || !parsedShapes.length) return;
        
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
        console.log(`🔍 DOUBLE CIRCLE MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        const resultImageData = ctx.createImageData(canvas.width, canvas.height);
        const resultPixels = resultImageData.data;
        
        const circle1 = this.circles[0];
        const circle2 = this.circles[1];
        
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    // Calculate distances to both circle centers
                    const dist1 = Math.sqrt(
                        Math.pow(x - circle1.center.x, 2) + 
                        Math.pow(y - circle1.center.y, 2)
                    );
                    const dist2 = Math.sqrt(
                        Math.pow(x - circle2.center.x, 2) + 
                        Math.pow(y - circle2.center.y, 2)
                    );
                    
                    // Determine which region and color accordingly
                    const insideCircle1 = dist1 < circle1.radius - 1;
                    const insideCircle2 = dist2 < circle2.radius - 1;
                    const onBoundary1 = Math.abs(dist1 - circle1.radius) < 2;
                    const onBoundary2 = Math.abs(dist2 - circle2.radius) < 2;
                    
                    if (onBoundary1 || onBoundary2) {
                        // On circle boundary - black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
                        resultPixels[pixelIndex + 3] = 255;
                    } else if (insideCircle1 && insideCircle2) {
                        // Inside both circles - use inner color (blue for daily, yellow for practice)
                        if (window.isPracticeMode) {
                            resultPixels[pixelIndex] = this.INNER_COLOR_PRACTICE.r;
                            resultPixels[pixelIndex + 1] = this.INNER_COLOR_PRACTICE.g;
                            resultPixels[pixelIndex + 2] = this.INNER_COLOR_PRACTICE.b;
                            resultPixels[pixelIndex + 3] = 255;
                        } else {
                            resultPixels[pixelIndex] = this.INNER_COLOR.r;
                            resultPixels[pixelIndex + 1] = this.INNER_COLOR.g;
                            resultPixels[pixelIndex + 2] = this.INNER_COLOR.b;
                            resultPixels[pixelIndex + 3] = 255;
                        }
                    } else if (insideCircle1 || insideCircle2) {
                        // Inside one circle - use middle color (orange)
                        resultPixels[pixelIndex] = this.MIDDLE_COLOR.r;
                        resultPixels[pixelIndex + 1] = this.MIDDLE_COLOR.g;
                        resultPixels[pixelIndex + 2] = this.MIDDLE_COLOR.b;
                        resultPixels[pixelIndex + 3] = 255;
                    } else {
                        // Outside both circles - use outer color (grey)
                        resultPixels[pixelIndex] = this.OUTER_COLOR.r;
                        resultPixels[pixelIndex + 1] = this.OUTER_COLOR.g;
                        resultPixels[pixelIndex + 2] = this.OUTER_COLOR.b;
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
        
        // Draw grid lines over the result
        drawGridLinesOnly();
        
        // Draw shape outlines and final circles
        if (typeof drawShapeOutlines === 'function') {
            drawShapeOutlines();
        }
        
        this.drawFinalCircles();
    },
    
    // Draw the final circles
    drawFinalCircles() {
        if (this.circles.length === 0) return;
        
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        this.circles.forEach(circle => {
            ctx.beginPath();
            ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, 2 * Math.PI);
            ctx.stroke();
        });
        
        ctx.restore();
    }
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DoubleCircleMechanic;
} else {
    window.DoubleCircleMechanic = DoubleCircleMechanic;
}