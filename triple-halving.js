// Triple Halving Mechanic
// After each cut, the smaller half disappears and only the larger half remains
// Requires 3 cuts total, progressively halving the remaining shape
// Works with any underlying cutting mechanic

console.log('🔧 Triple Halving mechanic file loaded');

const TripleHalvingMechanic = {
    name: "Triple Halving",
    description: "Cut the shape 3 times - smaller half disappears after each cut, leaving only the larger half",
    
    // Mechanic state
    cutCount: 0,
    maxCuts: 3,
    currentShapes: null, // Current remaining shapes after cuts
    originalShapes: null, // Store original shapes for reset
    underlyingMechanic: null, // The actual cutting mechanic to use
    
    // Available underlying mechanics
    availableMechanics: {
        'default': 'DefaultMechanic',
        'two-point-vector': 'TwoPointVectorMechanic',
        'horizontal-only': 'HorizontalOnlyMechanic',
        'vertical-only': 'VerticalOnlyMechanic',
        'diagonal-ascending': 'DiagonalAscendingMechanic',
        'diagonal-descending': 'DiagonalDescendingMechanic',
        'circle-cut': 'CircleCutMechanic',
        'rotating-square': 'RotatingSquareMechanic',
        'three-point-triangle': 'ThreePointTriangleMechanic'
    },
    
    // Initialize the mechanic
    init(underlyingMechanicName = 'default') {
        console.log('🔧 Initializing Triple Halving mechanic with underlying:', underlyingMechanicName);
        this.reset();
        this.setupCancellationListeners();
        
        // Set up the underlying cutting mechanic
        this.setupUnderlyingMechanic(underlyingMechanicName);
        
        // Store original shapes
        this.originalShapes = JSON.parse(JSON.stringify(parsedShapes));
        this.currentShapes = JSON.parse(JSON.stringify(parsedShapes));
        
        this.drawCurrentState();
    },
    
    // Setup the underlying cutting mechanic
    setupUnderlyingMechanic(mechanicName) {
        const mechanicClassName = this.availableMechanics[mechanicName];
        if (!mechanicClassName || !window[mechanicClassName]) {
            console.warn(`Unknown or unavailable mechanic: ${mechanicName}, falling back to default`);
            this.underlyingMechanic = window.DefaultMechanic;
        } else {
            this.underlyingMechanic = window[mechanicClassName];
        }
        
        // Initialize the underlying mechanic
        if (this.underlyingMechanic && typeof this.underlyingMechanic.init === 'function') {
            this.underlyingMechanic.init();
        }
        
        // CRITICAL: Override the underlying mechanic's performVectorCut method
        // The default mechanic calls this.performVectorCut() directly in handleEnd
        // So we need to intercept that call to route it through our triple halving logic
        if (this.underlyingMechanic && typeof this.underlyingMechanic.performVectorCut === 'function') {
            console.log('🔧 Overriding underlying mechanic performVectorCut method');
            this.underlyingMechanic.originalPerformVectorCut = this.underlyingMechanic.performVectorCut;
            this.underlyingMechanic.performVectorCut = this.executeTripleHalvingCut.bind(this);
        }
        
        // Add performVectorCut method to this mechanic so main.js will call it
        this.performVectorCut = this.executeTripleHalvingCut.bind(this);
        
        console.log('✅ Underlying mechanic set up:', this.underlyingMechanic?.name || 'Unknown');
    },
    
    // Reset mechanic state
    reset() {
        this.cutCount = 0;
        this.currentShapes = null;
        this.originalShapes = null;
        
        // Restore the original performVectorCut method if we overrode it
        if (this.underlyingMechanic && this.underlyingMechanic.originalPerformVectorCut) {
            console.log('🔧 Restoring original performVectorCut method');
            this.underlyingMechanic.performVectorCut = this.underlyingMechanic.originalPerformVectorCut;
            delete this.underlyingMechanic.originalPerformVectorCut;
        }
        
        this.underlyingMechanic = null;
        
        // Restore original shapes
        if (this.originalShapes) {
            parsedShapes = JSON.parse(JSON.stringify(this.originalShapes));
        }
    },
    
    // Setup cancellation listeners (delegates to underlying mechanic if needed)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for wrapper-level cancellation
        canvas.addEventListener('contextmenu', (event) => {
            // Delegate cancellation to underlying mechanic if it supports it
            if (this.underlyingMechanic && typeof this.underlyingMechanic.cancelDraw === 'function') {
                console.log('🔄 Right-click detected - delegating cancellation to underlying mechanic');
                this.underlyingMechanic.cancelDraw();
            }
        });
    },
    
    // Cancel the current drawing (delegate to underlying mechanic)
    cancelDraw() {
        console.log('🚫 Triple Halving: Canceling draw - delegating to underlying mechanic');
        if (this.underlyingMechanic && typeof this.underlyingMechanic.cancelDraw === 'function') {
            this.underlyingMechanic.cancelDraw();
        }
    },
    
    // Handle start of interaction - delegate to underlying mechanic
    handleStart(event, canvasRect) {
        if (!this.underlyingMechanic) {
            console.log('❌ No underlying mechanic available');
            return false;
        }
        
        // Check if we've completed all cuts
        if (this.cutCount >= this.maxCuts) {
            console.log('🎯 All cuts completed!');
            return false;
        }
        
        console.log(`🎯 Triple Halving: Cut ${this.cutCount + 1}/${this.maxCuts} starting`);
        
        // Hide any commentary when user starts interacting
        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (typeof hideTryAgainMessage === 'function') hideTryAgainMessage();
        
        // Delegate to underlying mechanic
        return this.underlyingMechanic.handleStart(event, canvasRect);
    },
    
    // Handle drag/move during interaction - delegate to underlying mechanic
    handleMove(event, canvasRect) {
        if (!this.underlyingMechanic) return false;
        return this.underlyingMechanic.handleMove(event, canvasRect);
    },
    
    // Handle end of interaction - delegate to underlying mechanic
    handleEnd(event) {
        if (!this.underlyingMechanic) return false;
        return this.underlyingMechanic.handleEnd(event);
    },
    
    // Execute triple halving cut (called by main.js performVectorCut)
    async executeTripleHalvingCut() {
        console.log('🎯 TRIPLE HALVING executeTripleHalvingCut called!');
        
        if (!this.underlyingMechanic) {
            console.log('❌ No underlying mechanic for cut execution');
            return false;
        }
        
        console.log(`✂️ Triple Halving: Executing cut ${this.cutCount + 1}/${this.maxCuts}`);
        
        // Execute the underlying mechanic's original performVectorCut
        if (this.underlyingMechanic && typeof this.underlyingMechanic.originalPerformVectorCut === 'function') {
            console.log('🔧 Calling underlying mechanic original performVectorCut');
            await this.underlyingMechanic.originalPerformVectorCut();
        } else {
            console.log('❌ No original performVectorCut method available');
            return false;
        }
        
        // Get the cut results from the global variables set by underlying mechanic
        const cutResult = window.currentAreaResults;
        if (!cutResult) {
            console.log('❌ No cut results available');
            return false;
        }
        
        console.log('📊 Cut areas:', cutResult);
        
        // Determine which half is larger
        const leftLarger = cutResult.leftPercentage > cutResult.rightPercentage;
        const largerPercentage = leftLarger ? cutResult.leftPercentage : cutResult.rightPercentage;
        const smallerPercentage = leftLarger ? cutResult.rightPercentage : cutResult.leftPercentage;
        
        console.log(`🔍 Cut result: left=${cutResult.leftPercentage.toFixed(1)}%, right=${cutResult.rightPercentage.toFixed(1)}%`);
        console.log(`🔍 Larger half: ${leftLarger ? 'left' : 'right'} (${largerPercentage.toFixed(1)}%)`);
        console.log(`🔍 Smaller half: ${leftLarger ? 'right' : 'left'} (${smallerPercentage.toFixed(1)}%)`);
        console.log(`🔍 Vector: from (${window.currentVector.start.x}, ${window.currentVector.start.y}) to (${window.currentVector.end.x}, ${window.currentVector.end.y})`);
        
        // CRITICAL DEBUG: Test which side we should actually keep by sampling a point
        const testPoint = { x: window.currentVector.start.x + 10, y: window.currentVector.start.y }; // Point slightly to the right of start
        const dx = window.currentVector.end.x - window.currentVector.start.x;
        const dy = window.currentVector.end.y - window.currentVector.start.y;
        const crossProduct = (testPoint.x - window.currentVector.start.x) * dy - (testPoint.y - window.currentVector.start.y) * dx;
        console.log(`🔍 Test point (${testPoint.x}, ${testPoint.y}) cross product: ${crossProduct} (${crossProduct > 0 ? 'left' : 'right'} side)`);
        
        // Increment cut count
        this.cutCount++;
        
        // Show results for this cut
        this.showCutResult(cutResult, this.cutCount, largerPercentage, smallerPercentage);
        
        // Actually modify the shape data to remove the smaller half
        this.modifyShapeData(leftLarger, cutResult);
        
        // Redraw with the modified shape data
        this.redrawModifiedShape();
        
        // Check if we've completed all cuts
        if (this.cutCount >= this.maxCuts) {
            console.log('🎉 All cuts completed! Final result achieved.');
            this.showFinalResult(largerPercentage);
        } else {
            console.log(`🔄 Cut ${this.cutCount} complete. Preparing for cut ${this.cutCount + 1}/${this.maxCuts}`);
            // Reset underlying mechanic for next cut
            if (this.underlyingMechanic && typeof this.underlyingMechanic.reset === 'function') {
                this.underlyingMechanic.reset();
            }
            
            // Add delay before next cut becomes available - keep the current visual result
            setTimeout(() => {
                // Don't redraw anything - keep the cut result visible with progress indicator
                this.drawProgressIndicatorOnly();
            }, 2000);
        }
        
        return true;
    },
    
    // Calculate cut areas using the underlying mechanic's method
    async calculateCutAreas() {
        if (!this.underlyingMechanic) return null;
        
        // Try different methods to get cut data from underlying mechanic
        let cutData = null;
        
        // Method 1: Check if mechanic has current vector/circle/triangle data
        if (this.underlyingMechanic.currentVector) {
            cutData = await this.calculateVectorCutAreas(this.underlyingMechanic.currentVector);
        } else if (this.underlyingMechanic.currentCircle) {
            cutData = await this.calculateCircleCutAreas(this.underlyingMechanic.currentCircle);
        } else if (this.underlyingMechanic.currentTriangle) {
            cutData = await this.calculateTriangleCutAreas(this.underlyingMechanic.currentTriangle);
        } else if (this.underlyingMechanic.currentSquare) {
            cutData = await this.calculateSquareCutAreas(this.underlyingMechanic.currentSquare);
        }
        
        // Method 2: Try to call underlying mechanic's calculateAreas method
        if (!cutData && typeof this.underlyingMechanic.calculateAreas === 'function') {
            try {
                cutData = this.underlyingMechanic.calculateAreas();
            } catch (error) {
                console.log('Could not use underlying mechanic calculateAreas:', error.message);
            }
        }
        
        return cutData;
    },
    
    // Calculate areas for vector-based cuts
    async calculateVectorCutAreas(vector) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        this.renderShapesForPixelAnalysis(tempCtx, this.currentShapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        return this.calculatePixelBasedAreasForVector(pixels, tempCanvas.width, tempCanvas.height, vector);
    },
    
    // Calculate areas for circle-based cuts
    async calculateCircleCutAreas(circle) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        this.renderShapesForPixelAnalysis(tempCtx, this.currentShapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        return this.calculatePixelBasedAreasForCircle(pixels, tempCanvas.width, tempCanvas.height, circle);
    },
    
    // Calculate areas for triangle-based cuts
    async calculateTriangleCutAreas(triangle) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        this.renderShapesForPixelAnalysis(tempCtx, this.currentShapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        return this.calculatePixelBasedAreasForTriangle(pixels, tempCanvas.width, tempCanvas.height, triangle);
    },
    
    // Calculate areas for square-based cuts
    async calculateSquareCutAreas(square) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        this.renderShapesForPixelAnalysis(tempCtx, this.currentShapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        return this.calculatePixelBasedAreasForSquare(pixels, tempCanvas.width, tempCanvas.height, square);
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
    
    // Pixel-based area calculation for vector cuts
    calculatePixelBasedAreasForVector(pixels, width, height, vector) {
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
                    
                    const crossProduct = (x - lineStart.x) * dy - (y - lineStart.y) * dx;
                    if (crossProduct >= 0) {
                        leftArea++;
                    } else {
                        rightArea++;
                    }
                }
            }
        }
        
        const leftPercentage = totalShapePixels > 0 ? (leftArea / totalShapePixels) * 100 : 0;
        const rightPercentage = totalShapePixels > 0 ? (rightArea / totalShapePixels) * 100 : 0;
        
        return {
            leftArea,
            rightArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Pixel-based area calculation for circle cuts
    calculatePixelBasedAreasForCircle(pixels, width, height, circle) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    const distance = Math.sqrt(Math.pow(x - circle.center.x, 2) + Math.pow(y - circle.center.y, 2));
                    if (distance <= circle.radius) {
                        insideArea++;
                    } else {
                        outsideArea++;
                    }
                }
            }
        }
        
        const leftPercentage = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        const rightPercentage = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;
        
        return {
            leftArea: insideArea,
            rightArea: outsideArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Pixel-based area calculation for triangle cuts
    calculatePixelBasedAreasForTriangle(pixels, width, height, triangle) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    if (this.isPointInsideTriangle(x, y, triangle)) {
                        insideArea++;
                    } else {
                        outsideArea++;
                    }
                }
            }
        }
        
        const leftPercentage = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        const rightPercentage = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;
        
        return {
            leftArea: insideArea,
            rightArea: outsideArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Pixel-based area calculation for square cuts
    calculatePixelBasedAreasForSquare(pixels, width, height, square) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    if (this.isPointInsideSquare(x, y, square)) {
                        insideArea++;
                    } else {
                        outsideArea++;
                    }
                }
            }
        }
        
        const leftPercentage = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        const rightPercentage = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;
        
        return {
            leftArea: insideArea,
            rightArea: outsideArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Check if point is inside triangle (barycentric coordinates)
    isPointInsideTriangle(px, py, triangle) {
        const p1 = triangle.points[0];
        const p2 = triangle.points[1];
        const p3 = triangle.points[2];
        
        const v0x = p3.x - p1.x;
        const v0y = p3.y - p1.y;
        const v1x = p2.x - p1.x;
        const v1y = p2.y - p1.y;
        const v2x = px - p1.x;
        const v2y = py - p1.y;
        
        const dot00 = v0x * v0x + v0y * v0y;
        const dot01 = v0x * v1x + v0y * v1y;
        const dot02 = v0x * v2x + v0y * v2y;
        const dot11 = v1x * v1x + v1y * v1y;
        const dot12 = v1x * v2x + v1y * v2y;
        
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        
        return (u >= 0) && (v >= 0) && (u + v <= 1);
    },
    
    // Check if point is inside square
    isPointInsideSquare(px, py, square) {
        // Translate point to square's coordinate system
        const dx = px - square.center.x;
        const dy = py - square.center.y;
        
        // Rotate point back (inverse rotation)
        const cos = Math.cos(-square.rotation);
        const sin = Math.sin(-square.rotation);
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;
        
        // Check if point is inside square (now axis-aligned)
        return Math.abs(rotatedX) <= square.size && Math.abs(rotatedY) <= square.size;
    },
    
    // Render only the larger half after a cut
    renderLargerHalfOnly(leftLarger, cutResult) {
        console.log(`🎨 Rendering larger half only (${leftLarger ? 'left' : 'right'} side)`);
        
        // Clear canvas and redraw grid
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        // First, render the full shape normally to get proper outlines
        if (typeof renderShapeForCutting === 'function' && this.currentShapes) {
            renderShapeForCutting(this.currentShapes);
        }
        
        // Now create a mask to hide the smaller half
        const cutTool = this.getCutToolInfo();
        if (!cutTool) {
            console.log('❌ No cut tool info available for masking');
            return;
        }
        
        // Create a temporary canvas to create the mask
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // Fill the entire mask with white (visible)
        maskCtx.fillStyle = 'white';
        maskCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the smaller half area in black (hidden)
        maskCtx.fillStyle = 'black';
        this.drawSmallerHalfMask(maskCtx, leftLarger, cutTool);
        
        // Apply the mask to hide the smaller half
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        
        // Create imageData from mask and apply it
        const maskImageData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        const maskPixels = maskImageData.data;
        
        // Apply pixel-by-pixel masking to preserve outlines
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const isInSmallerHalf = this.isPixelOnSmallerSide(x, y, leftLarger, cutTool);
                
                if (isInSmallerHalf) {
                    // Erase this pixel if it's on the smaller side
                    ctx.clearRect(x, y, 1, 1);
                }
            }
        }
        
        ctx.restore();
        
        // Draw the cut line to show where the cut was made
        this.drawCutLine(cutTool);
        
        // Draw grid lines over the result
        drawGridLinesOnly();
        
        // Draw the progress indicator immediately
        this.drawProgressIndicator();
        
        console.log('✅ Larger half rendered with outlines, smaller half removed');
    },
    
    // Get cut tool information from underlying mechanic
    getCutToolInfo() {
        if (this.underlyingMechanic.currentVector) {
            return { type: 'vector', data: this.underlyingMechanic.currentVector };
        } else if (this.underlyingMechanic.currentCircle) {
            return { type: 'circle', data: this.underlyingMechanic.currentCircle };
        } else if (this.underlyingMechanic.currentTriangle) {
            return { type: 'triangle', data: this.underlyingMechanic.currentTriangle };
        } else if (this.underlyingMechanic.currentSquare) {
            return { type: 'square', data: this.underlyingMechanic.currentSquare };
        }
        
        // Fallback - try to get from global variables
        if (window.currentVector) {
            return { type: 'vector', data: window.currentVector };
        }
        
        return null;
    },
    
    // Check if a pixel is on the larger side of the cut
    isPixelOnLargerSide(x, y, leftLarger, cutTool) {
        if (!cutTool) return true; // Keep all pixels if we can't determine cut
        
        if (cutTool.type === 'vector') {
            const vector = cutTool.data;
            const dx = vector.end.x - vector.start.x;
            const dy = vector.end.y - vector.start.y;
            const crossProduct = (x - vector.start.x) * dy - (y - vector.start.y) * dx;
            
            if (leftLarger) {
                return crossProduct > 0; // Left side is larger, keep left pixels
            } else {
                return crossProduct < 0; // Right side is larger, keep right pixels
            }
        } else if (cutTool.type === 'circle') {
            const circle = cutTool.data;
            const distance = Math.sqrt(Math.pow(x - circle.center.x, 2) + Math.pow(y - circle.center.y, 2));
            const isInside = distance <= circle.radius;
            
            if (leftLarger) {
                return isInside; // Inside is larger, keep inside pixels
            } else {
                return !isInside; // Outside is larger, keep outside pixels
            }
        } else if (cutTool.type === 'triangle') {
            const triangle = cutTool.data;
            const isInside = this.isPointInsideTriangle(x, y, triangle);
            
            if (leftLarger) {
                return isInside; // Inside is larger, keep inside pixels
            } else {
                return !isInside; // Outside is larger, keep outside pixels
            }
        } else if (cutTool.type === 'square') {
            const square = cutTool.data;
            const isInside = this.isPointInsideSquare(x, y, square);
            
            if (leftLarger) {
                return isInside; // Inside is larger, keep inside pixels
            } else {
                return !isInside; // Outside is larger, keep outside pixels
            }
        }
        
        return true; // Default to keeping the pixel
    },
    
    // Check if a pixel is on the smaller side of the cut (inverse of isPixelOnLargerSide)
    isPixelOnSmallerSide(x, y, leftLarger, cutTool) {
        return !this.isPixelOnLargerSide(x, y, leftLarger, cutTool);
    },
    
    // Draw a mask for the smaller half area that should be hidden
    drawSmallerHalfMask(context, leftLarger, cutTool) {
        if (cutTool.type === 'vector') {
            const vector = cutTool.data;
            
            // For vector cuts, use a large polygon that covers the entire smaller side
            context.beginPath();
            
            if (leftLarger) {
                // Right side is smaller - create polygon covering right side
                // Start from vector line and extend to canvas edges
                context.moveTo(vector.start.x, vector.start.y);
                context.lineTo(vector.end.x, vector.end.y);
                
                // Extend to canvas corners on the right side
                const dx = vector.end.x - vector.start.x;
                const dy = vector.end.y - vector.start.y;
                
                // Determine which canvas edges to connect to
                if (dx > 0) { // Line goes generally left to right
                    context.lineTo(canvas.width, vector.end.y);
                    context.lineTo(canvas.width, canvas.height);
                    context.lineTo(canvas.width, 0);
                    context.lineTo(vector.start.x, vector.start.y);
                } else { // Line goes generally right to left
                    context.lineTo(0, vector.end.y);
                    context.lineTo(0, canvas.height);
                    context.lineTo(0, 0);
                    context.lineTo(vector.start.x, vector.start.y);
                }
            } else {
                // Left side is smaller - create polygon covering left side
                context.moveTo(vector.start.x, vector.start.y);
                context.lineTo(vector.end.x, vector.end.y);
                
                const dx = vector.end.x - vector.start.x;
                
                // Determine which canvas edges to connect to  
                if (dx > 0) { // Line goes generally left to right
                    context.lineTo(0, vector.end.y);
                    context.lineTo(0, canvas.height);
                    context.lineTo(0, 0);
                    context.lineTo(vector.start.x, vector.start.y);
                } else { // Line goes generally right to left
                    context.lineTo(canvas.width, vector.end.y);
                    context.lineTo(canvas.width, canvas.height);
                    context.lineTo(canvas.width, 0);
                    context.lineTo(vector.start.x, vector.start.y);
                }
            }
            
            context.closePath();
            context.fill();
        }
        // Add support for other cut types as needed
    },
    
    // Draw the cut line to show where the division was made
    drawCutLine(cutTool) {
        if (cutTool.type === 'vector') {
            const vector = cutTool.data;
            
            ctx.save();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            
            ctx.beginPath();
            ctx.moveTo(vector.start.x, vector.start.y);
            ctx.lineTo(vector.end.x, vector.end.y);
            ctx.stroke();
            
            ctx.restore();
        }
        // Add support for other cut types as needed
    },
    
    // Draw current state
    drawCurrentState() {
        // During active cutting (after first cut), don't redraw the original shape
        if (this.cutCount > 0 && this.cutCount < this.maxCuts) {
            console.log('🚫 Preventing redraw during active cutting phase');
            // Only update the progress indicator
            this.drawProgressIndicatorOnly();
            return;
        }
        
        // Normal drawing for initial state or final state
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        // Render current remaining shapes
        if (typeof renderShapeForCutting === 'function' && this.currentShapes) {
            renderShapeForCutting(this.currentShapes);
        }
        
        // Let underlying mechanic draw its UI elements
        if (this.underlyingMechanic && typeof this.underlyingMechanic.drawCurrentState === 'function') {
            // Don't clear the canvas again, just add UI elements
            this.underlyingMechanic.drawCurrentState?.();
        }
        
        // Draw progress indicator
        this.drawProgressIndicator();
    },
    
    // Draw progress indicator
    drawProgressIndicator() {
        ctx.save();
        
        // Draw cut progress
        const progressText = `Cut ${this.cutCount}/${this.maxCuts} - ${this.maxCuts - this.cutCount} cuts remaining`;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        const textWidth = ctx.measureText(progressText).width;
        const padding = 10;
        const x = canvas.width / 2;
        const y = 10;
        
        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x - textWidth/2 - padding, y, textWidth + padding*2, 30);
        
        // Draw text
        ctx.fillStyle = '#fff';
        ctx.fillText(progressText, x, y + 8);
        
        // Draw instruction
        let instruction = '';
        if (this.cutCount === 0) {
            instruction = 'Make your first cut - smaller half will disappear';
        } else if (this.cutCount < this.maxCuts) {
            instruction = 'Cut the remaining shape in half again';
        } else {
            instruction = 'All cuts complete!';
        }
        
        ctx.font = '14px Arial';
        const instrWidth = ctx.measureText(instruction).width;
        const instrY = y + 40;
        
        // Draw instruction background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(x - instrWidth/2 - padding, instrY, instrWidth + padding*2, 25);
        
        // Draw instruction text
        ctx.fillStyle = '#333';
        ctx.fillText(instruction, x, instrY + 6);
        
        ctx.restore();
    },
    
    // Draw progress indicator without clearing canvas or redrawing shapes
    drawProgressIndicatorOnly() {
        // Clear only the progress indicator area first
        const padding = 10;
        const x = canvas.width / 2;
        const y = 10;
        
        ctx.save();
        
        // Clear the area where progress indicator will be drawn
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, 80); // Clear top area only
        
        // Redraw grid in the cleared area
        if (typeof drawGridLinesOnly === 'function') {
            ctx.save();
            ctx.beginPath();
            // Draw only horizontal grid lines in the cleared area
            for (let y = 0; y <= 80; y += 20) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            // Draw vertical grid lines in the cleared area
            for (let x = 0; x <= canvas.width; x += 20) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 80);
            }
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.restore();
        
        // Now draw the progress indicator
        this.drawProgressIndicator();
    },
    
    // Show cut result
    showCutResult(cutResult, cutNumber, largerPercentage, smallerPercentage) {
        console.log(`📊 Cut ${cutNumber} Result: Kept ${largerPercentage.toFixed(1)}%, Removed ${smallerPercentage.toFixed(1)}%`);
        
        // Show the result using the existing system
        if (typeof window.showAttemptResult === 'function') {
            window.showAttemptResult(largerPercentage, 0); // Show only the remaining percentage
        }
        
        // Update UI to show progress
        this.updateResultsDisplay(cutNumber, largerPercentage, smallerPercentage);
    },
    
    // Show final result
    showFinalResult(finalPercentage) {
        console.log(`🎉 Triple Halving Complete! Final remaining: ${finalPercentage.toFixed(1)}%`);
        
        // Calculate the theoretical result (1/8 = 12.5% of original)
        const theoreticalPercentage = 100 / Math.pow(2, this.maxCuts); // 100 / 8 = 12.5%
        const accuracy = 100 - Math.abs(finalPercentage - theoreticalPercentage);
        
        console.log(`🎯 Theoretical target: ${theoreticalPercentage.toFixed(1)}%, Accuracy: ${accuracy.toFixed(1)}%`);
        
        // Show completion message
        if (typeof showGoalCommentary === 'function') {
            showGoalCommentary(`Triple halving complete! Final size: ${finalPercentage.toFixed(1)}% of original`);
        }
    },
    
    // Update results display
    updateResultsDisplay(cutNumber, largerPercentage, smallerPercentage) {
        // This would update a results table showing each cut's results
        // For now, just log the information
        console.log(`Cut ${cutNumber}: Kept ${largerPercentage.toFixed(1)}%, Removed ${smallerPercentage.toFixed(1)}%`);
    },
    
    // Modify the actual shape data to remove the smaller half
    modifyShapeData(leftLarger, cutResult) {
        console.log('🔧 Modifying shape data to remove smaller half');
        
        const cutTool = this.getCutToolInfo();
        if (!cutTool) {
            console.error('❌ No cut tool info available for shape modification');
            return;
        }
        
        // Create new modified shapes by clipping each shape
        const modifiedShapes = [];
        
        for (const shape of this.currentShapes) {
            // Skip reference points (like rotation centers)
            if (shape.properties && shape.properties.type === 'reference') {
                modifiedShapes.push(shape);
                continue;
            }
            
            // Clip the shape to keep only the larger half
            const clippedShape = this.clipShapeToLargerHalf(shape, leftLarger, cutTool);
            if (clippedShape) {
                modifiedShapes.push(clippedShape);
            }
        }
        
        // Update current shapes and global parsedShapes
        this.currentShapes = modifiedShapes;
        parsedShapes = modifiedShapes;
        
        console.log(`✅ Shape data modified: ${modifiedShapes.length} shapes remaining`);
        
        // Debug: Calculate and log the total area after modification
        this.debugLogShapeArea();
    },
    
    // Debug method to log the current shape area
    debugLogShapeArea() {
        if (!this.currentShapes || this.currentShapes.length === 0) {
            console.log('🔍 DEBUG: No shapes to measure area');
            return;
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        this.renderShapesForPixelAnalysis(tempCtx, this.currentShapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        let totalArea = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            if (r === 221 && g === 221 && b === 221) {
                totalArea++;
            }
        }
        
        console.log(`🔍 DEBUG: Current shape total area: ${totalArea} pixels (cut ${this.cutCount}/${this.maxCuts})`);
    },
    
    // Create a shape that represents only the larger half using pixel sampling
    createLargerHalfShape(leftLarger, cutTool) {
        console.log('🔧 Creating larger half shape using pixel sampling approach');
        
        // Create a temporary canvas to analyze the current shape
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Render current shapes for analysis
        this.renderShapesForPixelAnalysis(tempCtx, this.currentShapes);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        // Find all pixels that belong to the larger half
        const largerHalfPixels = [];
        
        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const pixelIndex = (y * tempCanvas.width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                // Check if this is a shape pixel
                if (r === 221 && g === 221 && b === 221) {
                    // Check if this pixel is on the larger side
                    if (this.isPixelOnLargerSide(x, y, leftLarger, cutTool)) {
                        largerHalfPixels.push({x, y});
                    }
                }
            }
        }
        
        if (largerHalfPixels.length === 0) {
            console.log('⚠️ No pixels found for larger half');
            return null;
        }
        
        console.log(`🔍 Found ${largerHalfPixels.length} pixels in larger half`);
        
        // Convert pixel data back to shape coordinate space
        const bounds = calculateBounds(this.currentShapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        
        // Create a bounding box outline of the larger half
        const coords = largerHalfPixels.map(pixel => [
            (pixel.x - offset.x) / scale,
            (pixel.y - offset.y) / scale
        ]);
        
        // Find the convex hull or create a simple bounding polygon
        const hull = this.createSimpleBoundingPolygon(coords);
        
        if (hull.length < 3) {
            console.log('⚠️ Could not create valid polygon from pixels');
            return null;
        }
        
        // Create a new shape object
        return {
            type: 'Polygon',
            outerRing: hull,
            holes: [], // No holes for now
            properties: {
                type: 'shape',
                source: 'triple-halving-clipped'
            }
        };
    },
    
    // Create a simple bounding polygon from coordinate points
    createSimpleBoundingPolygon(coords) {
        if (coords.length === 0) return [];
        
        // Find bounding box
        let minX = coords[0][0], maxX = coords[0][0];
        let minY = coords[0][1], maxY = coords[0][1];
        
        for (const coord of coords) {
            minX = Math.min(minX, coord[0]);
            maxX = Math.max(maxX, coord[0]);
            minY = Math.min(minY, coord[1]);
            maxY = Math.max(maxY, coord[1]);
        }
        
        // Create a rectangle around the points (simple approach)
        return [
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY] // Close the polygon
        ];
    },
    
    // Clip a shape to keep only the larger half
    clipShapeToLargerHalf(shape, leftLarger, cutTool) {
        if (!shape.outerRing || shape.outerRing.length === 0) {
            console.log('⚠️ Skipping shape without outerRing');
            return shape;
        }
        
        if (cutTool.type === 'vector') {
            return this.clipShapeByVector(shape, leftLarger, cutTool.data);
        }
        
        // For other cut types, return the original shape for now
        // TODO: Implement clipping for circles, triangles, squares
        console.log('⚠️ Clipping not implemented for cut type:', cutTool.type);
        return shape;
    },
    
    // Clip a shape by a vector (line), keeping only the larger half
    clipShapeByVector(shape, leftLarger, vector) {
        console.log('✂️ Clipping shape by vector, keeping', leftLarger ? 'left' : 'right', 'side');
        
        const clippedShape = JSON.parse(JSON.stringify(shape)); // Deep copy
        
        // Clip the outer ring
        clippedShape.outerRing = this.clipPolygonByVector(shape.outerRing, leftLarger, vector);
        
        // Clip holes if they exist
        if (shape.holes && shape.holes.length > 0) {
            clippedShape.holes = shape.holes
                .map(hole => this.clipPolygonByVector(hole, leftLarger, vector))
                .filter(hole => hole && hole.length >= 3); // Keep only valid holes
        }
        
        // Only return the shape if the outer ring is still valid
        if (clippedShape.outerRing && clippedShape.outerRing.length >= 3) {
            // Additional validation: check if the clipped shape has reasonable area
            const area = this.calculatePolygonArea(clippedShape.outerRing);
            console.log(`🔍 DEBUG: Clipped shape area: ${area.toFixed(2)}`);
            
            if (area > 1.0) { // Minimum area threshold to avoid degenerate shapes
                return clippedShape;
            } else {
                console.log('⚠️ Clipped shape area too small, treating as completely clipped');
                return null;
            }
        }
        
        return null; // Shape was completely clipped away
    },
    
    // Calculate the area of a polygon using the shoelace formula
    calculatePolygonArea(polygon) {
        if (!polygon || polygon.length < 3) return 0;
        
        let area = 0;
        const n = polygon.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += polygon[i][0] * polygon[j][1];
            area -= polygon[j][0] * polygon[i][1];
        }
        
        return Math.abs(area) / 2;
    },
    
    // Clip a polygon by a vector line using Sutherland-Hodgman clipping algorithm
    clipPolygonByVector(polygon, leftLarger, vector) {
        if (!polygon || polygon.length < 3) return [];
        
        console.log('🔍 DEBUG: Clipping polygon with', polygon.length, 'vertices');
        console.log('🔍 DEBUG: Vector from', vector.start, 'to', vector.end);
        console.log('🔍 DEBUG: Keep left side:', leftLarger);
        
        // Since coordinate transforms use scale=1 and offset=0, canvas space = shape space
        // Work directly with the vector and polygon coordinates as they are
        
        // Convert polygon coordinates to points
        let points = polygon.map(coord => ({ x: coord[0], y: coord[1] }));
        
        console.log('🔍 DEBUG: First few shape points:', points.slice(0, 3));
        console.log('🔍 DEBUG: Vector points:', vector.start, vector.end);
        
        const dx = vector.end.x - vector.start.x;
        const dy = vector.end.y - vector.start.y;
        
        // Define the clipping line
        const clipLine = {
            start: vector.start,
            end: vector.end,
            dx: dx,
            dy: dy
        };
        
        // Determine which side to keep - corrected logic
        // The issue was the inverted logic was causing complete clipping
        const keepLeftSide = leftLarger; // CORRECT: If left is larger, keep left
        console.log(`🔍 DEBUG: leftLarger=${leftLarger}, keeping ${keepLeftSide ? 'LEFT' : 'RIGHT'} side (corrected logic)`);
        
        // Clip the polygon
        const clippedPoints = this.sutherHodgmanClip(points, clipLine, keepLeftSide);
        
        console.log('🔍 DEBUG: Clipped to', clippedPoints.length, 'points');
        
        // Convert back to coordinate arrays and ensure polygon is closed
        if (clippedPoints.length >= 3) {
            const result = clippedPoints.map(point => [point.x, point.y]);
            
            // Ensure the polygon is closed (first and last points are the same)
            const first = result[0];
            const last = result[result.length - 1];
            if (Math.abs(first[0] - last[0]) > 1e-6 || Math.abs(first[1] - last[1]) > 1e-6) {
                result.push([first[0], first[1]]);
            }
            
            console.log(`✅ Polygon clipped: ${polygon.length} → ${result.length} vertices`);
            console.log('🔍 DEBUG: First few result points:', result.slice(0, 3));
            console.log('🔍 DEBUG: Original vs clipped comparison:');
            console.log('🔍   Original first 3:', polygon.slice(0, 3));
            console.log('🔍   Clipped first 3:', result.slice(0, 3));
            return result;
        }
        
        console.log('⚠️ Polygon completely clipped away');
        return [];
    },
    
    // Sutherland-Hodgman polygon clipping algorithm
    sutherHodgmanClip(inputPoints, clipLine, keepLeftSide) {
        if (inputPoints.length === 0) return [];
        
        const outputPoints = [];
        
        for (let i = 0; i < inputPoints.length; i++) {
            const currentPoint = inputPoints[i];
            const prevPoint = inputPoints[i === 0 ? inputPoints.length - 1 : i - 1];
            
            const currentInside = this.isPointOnKeepSide(currentPoint, clipLine, keepLeftSide);
            const prevInside = this.isPointOnKeepSide(prevPoint, clipLine, keepLeftSide);
            
            if (currentInside) {
                if (!prevInside) {
                    // Entering: add intersection point
                    const intersection = this.lineIntersection(prevPoint, currentPoint, clipLine.start, clipLine.end);
                    if (intersection) {
                        outputPoints.push(intersection);
                    }
                }
                // Add current point
                outputPoints.push(currentPoint);
            } else if (prevInside) {
                // Exiting: add intersection point
                const intersection = this.lineIntersection(prevPoint, currentPoint, clipLine.start, clipLine.end);
                if (intersection) {
                    outputPoints.push(intersection);
                }
            }
        }
        
        return outputPoints;
    },
    
    // Check if a point is on the side we want to keep
    isPointOnKeepSide(point, clipLine, keepLeftSide) {
        const crossProduct = (point.x - clipLine.start.x) * clipLine.dy - (point.y - clipLine.start.y) * clipLine.dx;
        
        // DEBUG: Log the first few calculations to see what's happening
        if (!this.debugLogCount) this.debugLogCount = 0;
        if (this.debugLogCount < 5) {
            console.log('🔍 DEBUG: Point', point, 'cross product:', crossProduct, 'keepLeft:', keepLeftSide, 'result:', keepLeftSide ? (crossProduct >= 0) : (crossProduct <= 0));
            this.debugLogCount++;
        }
        
        if (keepLeftSide) {
            return crossProduct >= 0; // Keep left side (positive cross product)
        } else {
            return crossProduct <= 0; // Keep right side (negative cross product)
        }
    },
    
    // Calculate intersection point between two line segments
    lineIntersection(p1, p2, p3, p4) {
        const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        
        if (Math.abs(denom) < 1e-10) {
            return null; // Lines are parallel
        }
        
        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
        
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    },
    
    // Redraw the canvas with the modified shape data
    redrawModifiedShape() {
        console.log('🎨 Redrawing with modified shape data');
        
        // Clear canvas and redraw grid
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        // Render the modified shapes with proper outlines
        if (typeof renderShapeForCutting === 'function' && this.currentShapes) {
            renderShapeForCutting(this.currentShapes);
        }
        
        // Draw black outlines around the shapes to ensure they're properly closed
        this.drawShapeOutlines();
        
        // Draw grid lines over the result
        if (typeof drawGridLinesOnly === 'function') {
            drawGridLinesOnly();
        }
        
        // Draw the progress indicator
        this.drawProgressIndicator();
        
        console.log('✅ Canvas redrawn with modified shapes');
    },
    
    // Apply all cuts as masks to show only the remaining portion
    applyAllCutMasks() {
        console.log(`🎭 Applying ${this.appliedCuts.length} cut masks`);
        
        // Create a mask that shows only the pixels that survive all cuts
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // Start with all pixels visible (white)
        maskCtx.fillStyle = 'white';
        maskCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // For each cut, remove the smaller half from the mask
        for (const cut of this.appliedCuts) {
            this.applyCutToMask(maskCtx, cut);
        }
        
        // Apply the final mask to the canvas
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();
    },
    
    // Apply a single cut to the mask
    applyCutToMask(maskCtx, cut) {
        console.log(`🎭 Applying cut ${cut.cutNumber} to mask (keep ${cut.leftLarger ? 'left' : 'right'} side)`);
        
        // Set composite operation to remove pixels
        maskCtx.save();
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.fillStyle = 'black';
        
        if (cut.cutTool.type === 'vector') {
            const vector = cut.cutTool.data;
            
            // Create a large polygon covering the smaller half
            const polygonPoints = this.createSmallerHalfPolygon(vector, cut.leftLarger);
            
            maskCtx.beginPath();
            polygonPoints.forEach((point, index) => {
                if (index === 0) {
                    maskCtx.moveTo(point.x, point.y);
                } else {
                    maskCtx.lineTo(point.x, point.y);
                }
            });
            maskCtx.closePath();
            maskCtx.fill();
        }
        
        maskCtx.restore();
    },
    
    // Create a polygon that covers the smaller half of a vector cut
    createSmallerHalfPolygon(vector, leftLarger) {
        const points = [];
        
        // Start with the vector line
        points.push({x: vector.start.x, y: vector.start.y});
        points.push({x: vector.end.x, y: vector.end.y});
        
        // Extend to canvas edges on the smaller side
        const dx = vector.end.x - vector.start.x;
        const dy = vector.end.y - vector.start.y;
        
        if (leftLarger) {
            // Right side is smaller - extend to right edge
            if (dx >= 0) { // Vector goes left to right
                points.push({x: canvas.width, y: vector.end.y});
                points.push({x: canvas.width, y: canvas.height});
                points.push({x: canvas.width, y: 0});
            } else { // Vector goes right to left
                points.push({x: 0, y: vector.end.y});
                points.push({x: 0, y: canvas.height});
                points.push({x: 0, y: 0});
            }
        } else {
            // Left side is smaller - extend to left edge
            if (dx >= 0) { // Vector goes left to right
                points.push({x: 0, y: vector.end.y});
                points.push({x: 0, y: canvas.height});
                points.push({x: 0, y: 0});
            } else { // Vector goes right to left
                points.push({x: canvas.width, y: vector.end.y});
                points.push({x: canvas.width, y: canvas.height});
                points.push({x: canvas.width, y: 0});
            }
        }
        
        // Close the polygon by connecting back to start
        points.push({x: vector.start.x, y: vector.start.y});
        
        return points;
    },
    
    // Draw outlines around the remaining shape
    drawRemainingShapeOutlines() {
        if (!this.originalShapes || this.originalShapes.length === 0) return;
        
        // Only draw outlines where shapes are still visible after all cuts
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // Get rendering parameters
        const bounds = calculateBounds(this.originalShapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        
        for (const shape of this.originalShapes) {
            // Skip reference points
            if (shape.properties && shape.properties.type === 'reference') {
                continue;
            }
            
            if (shape.outerRing && shape.outerRing.length >= 3) {
                // Draw outer ring outline
                ctx.beginPath();
                for (let i = 0; i < shape.outerRing.length; i++) {
                    const coord = shape.outerRing[i];
                    const x = coord[0] * scale + offset.x;
                    const y = coord[1] * scale + offset.y;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
        
        // Draw cut lines to show where cuts were made
        if (this.appliedCuts) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            
            for (const cut of this.appliedCuts) {
                if (cut.cutTool.type === 'vector') {
                    const vector = cut.cutTool.data;
                    ctx.beginPath();
                    ctx.moveTo(vector.start.x, vector.start.y);
                    ctx.lineTo(vector.end.x, vector.end.y);
                    ctx.stroke();
                }
            }
        }
        
        ctx.restore();
    },
    
    // Draw black outlines around the modified shapes
    drawShapeOutlines() {
        if (!this.currentShapes || this.currentShapes.length === 0) return;
        
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // Get rendering parameters
        const bounds = calculateBounds(this.currentShapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        
        for (const shape of this.currentShapes) {
            // Skip reference points
            if (shape.properties && shape.properties.type === 'reference') {
                continue;
            }
            
            if (shape.outerRing && shape.outerRing.length >= 3) {
                // Draw outer ring outline
                ctx.beginPath();
                for (let i = 0; i < shape.outerRing.length; i++) {
                    const coord = shape.outerRing[i];
                    const x = coord[0] * scale + offset.x;
                    const y = coord[1] * scale + offset.y;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.stroke();
                
                // Draw holes outlines if they exist
                if (shape.holes && shape.holes.length > 0) {
                    for (const hole of shape.holes) {
                        if (hole.length >= 3) {
                            ctx.beginPath();
                            for (let i = 0; i < hole.length; i++) {
                                const coord = hole[i];
                                const x = coord[0] * scale + offset.x;
                                const y = coord[1] * scale + offset.y;
                                
                                if (i === 0) {
                                    ctx.moveTo(x, y);
                                } else {
                                    ctx.lineTo(x, y);
                                }
                            }
                            ctx.closePath();
                            ctx.stroke();
                        }
                    }
                }
            }
        }
        
        ctx.restore();
    }
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TripleHalvingMechanic;
} else {
    window.TripleHalvingMechanic = TripleHalvingMechanic;
}