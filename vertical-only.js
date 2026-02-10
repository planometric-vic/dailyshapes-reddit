// Vertical Only Cut Mechanic
// Only allows vertical cuts across the shape

const VerticalOnlyMechanic = {
    name: "Vertical Only Cut",
    description: "Draw only vertical lines to cut shapes",
    
    // Mechanic state
    isDrawing: false,
    startPoint: null,
    endPoint: null,
    currentVector: null,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Vertical Only Cut mechanic');
        this.reset();
        this.setupCancellationListeners();
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.currentVector = null;
    },
    
    // Setup cancellation listeners (right-click desktop, second finger mobile)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.isDrawing) {
                console.log('🔄 Right-click detected - canceling vertical line');
                this.cancelDraw();
            }
        });
    },
    
    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling vertical line');
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
        
        this.startPoint = {
            x: clientX - canvasRect.left,
            y: clientY - canvasRect.top
        };
        
        // Immediately create full-height vertical line at the touch X position
        this.endPoint = {
            x: this.startPoint.x,  // Same X coordinate
            y: canvas.height // Full height
        };
        
        // Create full-height vector immediately
        this.currentVector = {
            start: { x: this.startPoint.x, y: 0 },
            end: { x: this.startPoint.x, y: canvas.height }
        };
        
        this.isDrawing = true;
        
        // Draw the initial full-height line
        this.drawPreview();
        
        console.log('🎯 Vertical mechanic: Full-height line created at X =', this.startPoint.x);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.startPoint) return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling vertical line');
            this.cancelDraw();
            return true; // Handled
        }
        
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        
        // Update X position of the full-height vertical line to track finger
        const newX = clientX - canvasRect.left;
        
        // Keep X within canvas bounds
        const clampedX = Math.max(0, Math.min(canvas.width, newX));
        
        // Update the full-height line position
        this.startPoint.x = clampedX;
        this.endPoint.x = clampedX;
        
        // Update the full-height vector
        this.currentVector = {
            start: { x: clampedX, y: 0 },
            end: { x: clampedX, y: canvas.height }
        };
        
        // Redraw canvas with updated line position
        this.drawPreview();
        return true; // Handled
    },
    
    // Handle end of interaction (mouse up / touch end)
    async handleEnd(event) {
        if (!this.isDrawing || !this.currentVector) {
            this.reset();
            return false;
        }
        
        console.log('✂️ Vertical mechanic: Executing vertical cut at X =', this.currentVector.start.x);
        
        // Store the cut vector
        const cutVector = this.currentVector;
        
        // Reset drawing state
        this.isDrawing = false;
        
        // Execute cut using existing game logic
        return await this.executeCut(cutVector);
    },
    
    // Draw preview during drag
    drawPreview() {
        if (!this.currentVector) return;
        
        // Redraw base canvas
        redrawCanvas();
        
        // Draw full-height vertical preview line
        ctx.save();
        ctx.strokeStyle = '#ff00ff'; // Magenta for vertical
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.setLineDash([8, 4]);
        
        ctx.beginPath();
        ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
        ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y);
        ctx.stroke();
        
        // Add visual indicators at the edges of the line to show it spans full height
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(this.currentVector.start.x, this.currentVector.start.y + 8, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.currentVector.end.x, this.currentVector.end.y - 8, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.restore();
    },
    
    // Execute the actual cut
    async executeCut(vector) {
        try {
            console.log('🔧 Vertical mechanic executeCut called');
            
            if (!vector || !parsedShapes || parsedShapes.length === 0) {
                console.error('Missing required data for cut');
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
            
            // Calculate areas
            const areaResults = this.calculateAreas();
            console.log('📊 Area calculation results:', areaResults);
            
            // Store the results globally
            window.currentVector = vector;
            window.currentAreaResults = areaResults;
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // For test lab mode, directly show the results
            if (typeof window.showAttemptResult === 'function') {
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            }
            
            return true;
        } catch (error) {
            console.error('Error executing vertical cut:', error);
            return false;
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
        console.log(`🔍 VERTICAL MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
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
        console.log(`🔍 VERTICAL MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
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
                    
                    // For vertical cuts, just check if pixel is left or right of the line
                    if (x < lineStart.x) {
                        leftArea++; // Left
                    } else if (x > lineStart.x) {
                        rightArea++; // Right
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
        console.log(`🔍 VERTICAL MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
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
                    if (x < this.currentVector.start.x) {
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
                    } else if (x > this.currentVector.start.x) {
                        // Grey for right
                        resultPixels[pixelIndex] = 221;
                        resultPixels[pixelIndex + 1] = 221;
                        resultPixels[pixelIndex + 2] = 221;
                        resultPixels[pixelIndex + 3] = 255;
                    } else {
                        // On the cut line - black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
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
    module.exports = VerticalOnlyMechanic;
} else {
    window.VerticalOnlyMechanic = VerticalOnlyMechanic;
}