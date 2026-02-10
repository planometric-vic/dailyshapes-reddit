// Two-Point Vector Cut Mechanic
// Allows users to tap two points to define a vector, then drag the control points to adjust before cutting

console.log('🔧 Two-Point Vector mechanic file loaded');

const TwoPointVectorMechanic = {
    name: "Two-Point Vector Cut",
    description: "Tap two points to create a line, drag points to adjust, tap elsewhere to cut",
    
    // Mechanic state
    state: 'waiting', // 'waiting', 'first-point', 'adjusting', 'cutting'
    controlPoints: [], // Array of {x, y} control points
    currentVector: null,
    draggedPoint: null, // Which control point is being dragged
    dragStartOffset: null, // Offset from point center when drag started
    
    // Visual constants
    CONTROL_POINT_RADIUS: 12, // Large enough for easy tapping
    CONTROL_POINT_COLOR: '#ff6b35',
    CONTROL_POINT_BORDER: '#fff',
    LINE_COLOR: '#000',
    LINE_WIDTH: 2,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Two-Point Vector Cut mechanic');
        this.reset();
        this.setupCancellationListeners();
    },
    
    // Reset mechanic state
    reset() {
        this.state = 'waiting';
        this.controlPoints = [];
        this.currentVector = null;
        this.draggedPoint = null;
        this.dragStartOffset = null;
    },
    
    // Setup cancellation listeners (right-click desktop, second finger mobile)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.state !== 'waiting') {
                console.log('🔄 Right-click detected - canceling two-point vector');
                this.cancelDraw();
            }
        });
    },
    
    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling two-point vector draw');
        this.reset();
        redrawCanvas();
        this.showCancelFeedback();
    },
    
    // Show brief visual feedback that the draw was canceled
    showCancelFeedback() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        const message = document.createElement('div');
        message.textContent = 'Vector Canceled';
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
            console.log('Two-Point Vector mechanic: Start ignored - interaction not enabled or wrong state');
            return false;
        }
        
        // Check for multi-touch cancellation
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleStart - canceling if drawing');
            if (this.state !== 'waiting') {
                this.cancelDraw();
            }
            return false;
        }
        
        const point = this.getCanvasCoordinates(event, canvasRect);
        console.log(`🎯 Two-Point Vector: handleStart at (${point.x}, ${point.y}), state: ${this.state}`);
        
        // Hide any commentary when user starts interacting
        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (typeof hideTryAgainMessage === 'function') hideTryAgainMessage();
        
        switch (this.state) {
            case 'waiting':
                // Place first control point
                this.controlPoints = [point];
                this.state = 'first-point';
                this.drawPreview();
                console.log('🔧 First control point placed');
                return true;
                
            case 'first-point':
                // Place second control point
                this.controlPoints.push(point);
                this.state = 'adjusting';
                this.updateVector();
                this.drawPreview();
                console.log('🔧 Second control point placed, entering adjust mode');
                return true;
                
            case 'adjusting':
                // Check if user clicked on a control point to drag it
                const hitPoint = this.getHitControlPoint(point);
                if (hitPoint !== -1) {
                    this.draggedPoint = hitPoint;
                    this.dragStartOffset = {
                        x: point.x - this.controlPoints[hitPoint].x,
                        y: point.y - this.controlPoints[hitPoint].y
                    };
                    console.log(`🔧 Started dragging control point ${hitPoint}`);
                    return true;
                } else {
                    // User clicked elsewhere - execute the cut
                    console.log('🔧 User clicked elsewhere - executing cut');
                    return this.executeCut();
                }
        }
        
        return false;
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!isInteractionEnabled || gameState !== 'cutting') return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling');
            this.cancelDraw();
            return true; // Handled
        }
        
        const point = this.getCanvasCoordinates(event, canvasRect);
        
        if (this.state === 'adjusting' && this.draggedPoint !== null) {
            // Update the dragged control point position
            this.controlPoints[this.draggedPoint] = {
                x: point.x - this.dragStartOffset.x,
                y: point.y - this.dragStartOffset.y
            };
            
            // Keep control points within canvas bounds
            this.controlPoints[this.draggedPoint].x = Math.max(this.CONTROL_POINT_RADIUS, 
                Math.min(canvas.width - this.CONTROL_POINT_RADIUS, this.controlPoints[this.draggedPoint].x));
            this.controlPoints[this.draggedPoint].y = Math.max(this.CONTROL_POINT_RADIUS, 
                Math.min(canvas.height - this.CONTROL_POINT_RADIUS, this.controlPoints[this.draggedPoint].y));
            
            this.updateVector();
            this.drawPreview();
            return true;
        }
        
        return false;
    },
    
    // Handle end of interaction (mouse up / touch end)
    handleEnd(event) {
        if (this.state === 'adjusting' && this.draggedPoint !== null) {
            // Stop dragging
            console.log(`🔧 Stopped dragging control point ${this.draggedPoint}`);
            this.draggedPoint = null;
            this.dragStartOffset = null;
            return true;
        }
        
        return false;
    },
    
    // Get canvas coordinates from event
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
    
    // Check if a point hits a control point (returns index or -1)
    getHitControlPoint(point) {
        for (let i = 0; i < this.controlPoints.length; i++) {
            const cp = this.controlPoints[i];
            const distance = Math.sqrt(
                Math.pow(point.x - cp.x, 2) + 
                Math.pow(point.y - cp.y, 2)
            );
            
            if (distance <= this.CONTROL_POINT_RADIUS * 1.5) { // Slightly larger hit area
                return i;
            }
        }
        return -1;
    },
    
    // Update the current vector based on control points
    updateVector() {
        if (this.controlPoints.length >= 2) {
            this.currentVector = this.extendVectorToCanvasBounds(
                this.controlPoints[0], 
                this.controlPoints[1]
            );
        }
    },
    
    // Draw preview of current state
    drawPreview() {
        // Redraw base canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (typeof renderShapeForCutting === 'function' && parsedShapes) {
            renderShapeForCutting(parsedShapes);
        }
        
        // Draw vector line if we have two points
        if (this.controlPoints.length >= 2 && this.currentVector) {
            ctx.save();
            ctx.strokeStyle = this.LINE_COLOR;
            ctx.lineWidth = this.LINE_WIDTH;
            ctx.setLineDash([5, 5]);
            
            ctx.beginPath();
            ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
            ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Draw control points
        ctx.save();
        this.controlPoints.forEach((point, index) => {
            // Draw point border
            ctx.fillStyle = this.CONTROL_POINT_BORDER;
            ctx.beginPath();
            ctx.arc(point.x, point.y, this.CONTROL_POINT_RADIUS + 2, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw point fill
            ctx.fillStyle = this.draggedPoint === index ? '#ff4500' : this.CONTROL_POINT_COLOR;
            ctx.beginPath();
            ctx.arc(point.x, point.y, this.CONTROL_POINT_RADIUS, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw point number
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((index + 1).toString(), point.x, point.y);
        });
        ctx.restore();
        
        // Draw instruction text
        this.drawInstructions();
    },
    
    // Draw instruction text based on current state
    drawInstructions() {
        let instruction = '';
        switch (this.state) {
            case 'waiting':
                instruction = 'Tap to place first control point';
                break;
            case 'first-point':
                instruction = 'Tap to place second control point';
                break;
            case 'adjusting':
                instruction = 'Drag points to adjust line, tap elsewhere to cut';
                break;
        }
        
        if (instruction) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
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
    
    // Execute the cut
    async executeCut() {
        if (this.controlPoints.length < 2 || !this.currentVector) {
            console.log('❌ Cannot execute cut - insufficient control points');
            return false;
        }
        
        console.log('✂️ Two-Point Vector: Executing cut', this.currentVector);
        this.state = 'cutting';
        
        try {
            // Validate the cut
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
            window.currentVector = this.currentVector;
            window.currentAreaResults = areaResults;
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // Show the results
            if (typeof window.showAttemptResult === 'function') {
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            }
            
            return true;
        } catch (error) {
            console.error('Error executing two-point vector cut:', error);
            return false;
        } finally {
            this.reset();
        }
    },
    
    // Extend vector to canvas bounds (same as default mechanic)
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
        console.log(`🔍 TWO-POINT VECTOR MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
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
        this.state = 'adjusting'; // Return to adjusting mode
        
        if (typeof showTryAgainMessage === 'function') showTryAgainMessage();
        this.drawPreview();
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
        console.log(`🔍 TWO-POINT VECTOR MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
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
        console.log(`🔍 TWO-POINT VECTOR MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
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
                    
                    if (side === 'left') {
                        // Check if in practice mode - use golden yellow (#FAB06A = 250, 176, 106)
                        if (window.isPracticeMode) {
                            resultPixels[pixelIndex] = 250;    // #FAB06A for practice mode
                            resultPixels[pixelIndex + 1] = 176;
                            resultPixels[pixelIndex + 2] = 106;
                            resultPixels[pixelIndex + 3] = 255;
                        } else {
                            // Blue for daily mode left side
                            resultPixels[pixelIndex] = 100;
                            resultPixels[pixelIndex + 1] = 150;
                            resultPixels[pixelIndex + 2] = 255;
                            resultPixels[pixelIndex + 3] = 255;
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
        
        // Draw grid lines over the result
        drawGridLinesOnly();
        
        // Draw shape outlines and final vector
        if (typeof drawShapeOutlines === 'function') {
            drawShapeOutlines();
        }
        
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
    }
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TwoPointVectorMechanic;
} else {
    window.TwoPointVectorMechanic = TwoPointVectorMechanic;
}