// Three Point Triangle Cut Mechanic - Drag and Expand Style
// Click and hold to define center, drag to expand equilateral triangle size

console.log('🔧 Three Point Triangle mechanic file loaded (Drag & Expand style)');

const ThreePointTriangleMechanic = {
    name: "Equilateral Triangle Cut",
    description: "Click and drag to create an expanding equilateral triangle from center",

    // Mechanic state
    isDrawing: false,
    centerPoint: null,
    currentPoint: null,
    radius: 0, // Distance from center to vertices
    rotation: 0, // Rotation angle in radians
    currentTriangle: null,
    originalShapes: null,

    // Visual constants
    LINE_COLOR: '#000',
    LINE_WIDTH: 2,
    MIN_RADIUS: 10, // Minimum triangle size to execute cut

    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Equilateral Triangle Cut mechanic (Drag & Expand)');
        this.reset();
        this.setupCancellationListeners();
    },

    // Reset mechanic state
    reset() {
        this.isDrawing = false;
        this.centerPoint = null;
        this.currentPoint = null;
        this.radius = 0;
        this.rotation = 0;
        this.currentTriangle = null;

        // DO NOT clear triangle protection flags here!
        // They need to persist until handleCutAttempt completes to prevent double-rendering
        console.log('🔧 RESET: Preserving triangle protection flags for handleCutAttempt:', {
            triangleCutActive: window.triangleCutActive,
            hasResult: !!window.triangleCutResult
        });
    },

    // Setup cancellation listeners (right-click desktop, second finger mobile)
    setupCancellationListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;

        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.isDrawing) {
                console.log('🔄 Right-click detected - canceling triangle draw');
                this.cancelDraw();
            }
        });
    },

    // Cancel the current drawing
    cancelDraw() {
        console.log('🚫 Canceling triangle draw');
        this.reset();
        this.redrawCanvas();
        this.showCancelFeedback();

        // Reset instruction to initial state
        if (window.updateInstructionText && window.getInitialInstruction) {
            const initialInstruction = window.getInitialInstruction('ThreePointTriangleMechanic');
            window.updateInstructionText(initialInstruction);
        }
    },

    // Show brief visual feedback that the draw was canceled
    showCancelFeedback() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const message = document.createElement('div');
        message.textContent = isMobile ? 'Triangle Canceled' : 'Triangle Canceled (Right-click to cancel)';
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

    // Redraw canvas helper
    redrawCanvas() {
        if (typeof ctx !== 'undefined' && typeof canvas !== 'undefined') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (typeof drawGrid === 'function') drawGrid();

            // Use appropriate shapes based on mode
            let shapesToRender = parsedShapes;
            if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
                shapesToRender = window.PracticeMode.originalShapes;
            }

            if (typeof renderShapeForCutting === 'function' && shapesToRender) {
                renderShapeForCutting(shapesToRender);
            }
        }
    },

    // Handle start of interaction (mouse down / touch start)
    handleStart(event, canvasRect) {
        // Use window-scoped variables for global state
        const isEnabled = window.isInteractionEnabled || false;
        const state = window.gameState || '';

        console.log('🔧 Triangle mechanic handleStart - checking state:', {
            isEnabled,
            state,
            shouldProcess: isEnabled && state === 'cutting'
        });

        if (!isEnabled || state !== 'cutting') {
            console.log('Triangle mechanic: Start ignored - interaction not enabled or wrong state');
            return false;
        }

        // Check for multi-touch cancellation
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleStart - canceling if drawing');
            if (this.isDrawing) {
                this.cancelDraw();
            }
            return false;
        }

        // Hide any commentary when user starts interacting
        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (typeof hideTryAgainMessage === 'function') hideTryAgainMessage();

        // Clear any existing triangle cut before starting new one
        if (window.triangleCutActive) {
            console.log('🧹 Triangle: Starting new cut - clearing previous result');
            window.triangleCutActive = false;
            window.triangleCutResult = null;
            // Allow practice mode to clear and reset
            if (window.isPracticeMode && window.PracticeMode) {
                window.PracticeMode.hasActiveCut = false;
            }
        }

        const point = this.getCanvasCoordinates(event, canvasRect);
        console.log(`🎯 Triangle: handleStart at center (${point.x}, ${point.y})`);

        this.centerPoint = point;
        this.isDrawing = true;
        this.currentPoint = null;
        this.radius = 0;
        this.rotation = 0;
        this.currentTriangle = null;

        // Update instruction after first touch
        if (window.updateInstructionText && window.getDynamicInstruction) {
            const dynamicInstruction = window.getDynamicInstruction('ThreePointTriangleMechanic', 'first_touch');
            window.updateInstructionText(dynamicInstruction);
        }

        console.log('🔧 Triangle center placed, ready to expand and rotate');
        return true;
    },

    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.centerPoint) return false;

        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;

        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling triangle draw');
            this.cancelDraw();
            return true;
        }

        const point = this.getCanvasCoordinates(event, canvasRect);
        this.currentPoint = point;

        // Calculate distance from center to drag point
        const dx = this.currentPoint.x - this.centerPoint.x;
        const dy = this.currentPoint.y - this.centerPoint.y;
        const dragDistance = Math.sqrt(dx * dx + dy * dy);

        // For an equilateral triangle, the apothem (distance from center to edge midpoint) = radius / 2
        // So: dragDistance = radius / 2
        // Therefore: radius = 2 * dragDistance
        // This locks the drag point exactly to the edge midpoint at 1:1 scale
        this.radius = dragDistance * 2;

        // Calculate rotation angle based on drag position
        // For an equilateral triangle, the perpendicular to an edge is offset by 60° (π/3) from the first vertex
        // So we rotate by: drag_angle - 60° + 90° = drag_angle + 30° (π/6)
        this.rotation = Math.atan2(dy, dx) + Math.PI / 6;

        // Generate equilateral triangle vertices with rotation
        this.currentTriangle = this.createEquilateralTriangle(this.centerPoint, this.radius, this.rotation);

        // Redraw canvas with preview
        this.drawPreview();
        return true;
    },

    // Handle end of interaction (mouse up / touch end)
    async handleEnd(event) {
        if (!this.isDrawing || !this.centerPoint || this.radius < this.MIN_RADIUS) {
            console.log('🚫 Triangle mechanic: Triangle too small or not drawing, ignoring');
            this.reset();
            this.redrawCanvas();
            return false;
        }

        console.log('🔺 Triangle mechanic: Executing triangle cut', {
            center: this.centerPoint,
            radius: this.radius,
            triangle: this.currentTriangle
        });

        // Execute the cut
        return await this.executeCut();
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

        // Get the canvas element
        const canvas = document.getElementById('geoCanvas');

        // Calculate the scaling factors between actual canvas size and displayed size
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;

        // Apply scaling to get correct canvas coordinates
        return {
            x: (clientX - canvasRect.left) * scaleX,
            y: (clientY - canvasRect.top) * scaleY
        };
    },

    // Create equilateral triangle from center, radius, and rotation
    // Vertices are placed at 120-degree intervals, rotated by the drag angle
    createEquilateralTriangle(center, radius, rotation) {
        const vertices = [];

        // Start angle at -90 degrees (pointing up) + rotation from drag
        // Then 120-degree intervals for remaining vertices
        for (let i = 0; i < 3; i++) {
            const angle = (-Math.PI / 2) + rotation + (i * 2 * Math.PI / 3);
            vertices.push({
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle)
            });
        }

        return {
            points: vertices,
            type: 'triangle',
            center: center,
            radius: radius,
            rotation: rotation
        };
    },

    // Draw preview of current state
    drawPreview() {
        // Redraw base canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // Always prioritize practice mode shapes when in practice mode
        let shapesToRender = parsedShapes;
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            shapesToRender = window.PracticeMode.originalShapes;
        }

        if (typeof renderShapeForCutting === 'function' && shapesToRender) {
            renderShapeForCutting(shapesToRender);
        }

        // Draw the triangle preview if we have one
        if (this.currentTriangle && this.currentTriangle.points.length === 3) {
            ctx.save();
            ctx.strokeStyle = this.LINE_COLOR;
            ctx.lineWidth = this.LINE_WIDTH;
            ctx.setLineDash([5, 5]);

            ctx.beginPath();
            ctx.moveTo(this.currentTriangle.points[0].x, this.currentTriangle.points[0].y);
            ctx.lineTo(this.currentTriangle.points[1].x, this.currentTriangle.points[1].y);
            ctx.lineTo(this.currentTriangle.points[2].x, this.currentTriangle.points[2].y);
            ctx.closePath();

            ctx.stroke();
            ctx.restore();

            // Draw center point indicator
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.centerPoint.x, this.centerPoint.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();

            // Draw edge midpoint indicator (where the drag point snaps to)
            if (this.currentPoint && this.radius > 0) {
                // Calculate the midpoint of the first edge (between points 0 and 1)
                const edgeMidX = (this.currentTriangle.points[0].x + this.currentTriangle.points[1].x) / 2;
                const edgeMidY = (this.currentTriangle.points[0].y + this.currentTriangle.points[1].y) / 2;

                ctx.save();
                ctx.fillStyle = '#666';
                ctx.beginPath();
                ctx.arc(edgeMidX, edgeMidY, 3, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
            }
        }
    },

    // Execute the cut
    async executeCut() {
        if (!this.currentTriangle) {
            console.log('❌ Cannot execute cut - no triangle');
            return false;
        }

        // Always prioritize practice mode shapes when in practice mode
        let shapesToUse = window.isPracticeMode ?
                         (window.PracticeMode?.practiceParsedShapes || []) :
                         (parsedShapes || []);
        console.log(`🔍 TRIANGLE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            shapesToUse = window.PracticeMode.originalShapes;
            console.log('🎯 Practice mode: Using practice mode stored shapes:', shapesToUse.length);
        } else if (!parsedShapes || parsedShapes.length === 0) {
            console.log('🎯 No parsedShapes available, checking for fallback shapes');

            // Try to parse from currentGeoJSON as last resort
            if (window.currentGeoJSON && window.parseGeometry) {
                const parseResult = window.parseGeometry(window.currentGeoJSON);
                if (parseResult && parseResult.shapes) {
                    shapesToUse = parseResult.shapes;
                    console.log('🔄 Parsed shapes from currentGeoJSON:', shapesToUse.length);
                }
            }
        }

        if (!shapesToUse || shapesToUse.length === 0) {
            console.error('❌ Cannot execute cut - no shapes available');
            console.error('🔍 Debug info - parsedShapes:', parsedShapes?.length || 0, 'isPracticeMode:', window.isPracticeMode, 'practiceShapes:', window.PracticeMode?.originalShapes?.length || 0);
            return false;
        }

        // CRITICAL: Preserve original shapes before any processing
        const originalShapes = JSON.parse(JSON.stringify(shapesToUse));
        console.log('🔒 Triangle mechanic: Preserved original shapes', originalShapes.length);
        this.originalShapes = originalShapes;

        console.log('✂️ Triangle: Executing cut', this.currentTriangle);

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
            window.currentTriangle = this.currentTriangle;
            window.currentAreaResults = areaResults;

            // Render the cut result immediately
            console.log('🎨 Triangle: About to render cut result with shading');
            this.renderCutResult(areaResults);
            console.log('🎨 Triangle: Cut result rendering completed');

            // Call the main game's cut handling flow
            console.log('🔥 TRIANGLE MECHANIC: About to check for handleCutAttempt');
            console.log('🔥 window.handleCutAttempt exists:', typeof window.handleCutAttempt);

            if (typeof window.handleCutAttempt === 'function') {
                console.log('🔥 TRIANGLE MECHANIC: Using triangle-specific area results, bypassing vector system');
                // Store triangle-specific results globally
                window.currentTriangleData = this.currentTriangle;
                window.currentAreaResults = areaResults;

                // CRITICAL: Restore original shapes to prevent shape switching
                window.parsedShapes = originalShapes;

                // For practice mode, handle cut result display directly
                if (window.isPracticeMode && window.PracticeMode) {
                    console.log('🔧 Practice mode: Handling cut result display directly');
                    // Create a synthetic vector from the triangle for rendering purposes
                    const syntheticVector = {
                        start: { x: this.currentTriangle.points[0].x, y: this.currentTriangle.points[0].y },
                        end: { x: this.currentTriangle.points[2].x, y: this.currentTriangle.points[2].y },
                        isTriangle: true,
                        triangle: this.currentTriangle
                    };
                    window.currentVector = syntheticVector;

                    // Store triangle-specific rendering state
                    console.log('🔒 SETTING TRIANGLE PROTECTION: triangleCutActive = true');
                    window.triangleCutActive = true;
                    window.triangleCutResult = {
                        triangle: this.currentTriangle,
                        areaResults: areaResults,
                        originalShapes: this.originalShapes
                    };
                    console.log('🔒 TRIANGLE PROTECTION SET:', {
                        triangleCutActive: window.triangleCutActive,
                        hasResult: !!window.triangleCutResult,
                        timestamp: new Date().toISOString()
                    });

                    // Call practice mode handler directly
                    window.PracticeMode.handleCutMade({
                        leftPercentage: areaResults.leftPercentage,
                        rightPercentage: areaResults.rightPercentage
                    });
                } else {
                    window.currentVector = null; // Prevent vector-based calculation for daily mode

                    // CRITICAL: Set triangle protection flag for daily mode too
                    console.log('🔒 DAILY MODE: Setting triangle protection flags');
                    window.triangleCutActive = true;
                    window.triangleCutResult = {
                        triangle: this.currentTriangle,
                        areaResults: areaResults,
                        originalShapes: this.originalShapes
                    };

                    // Call demo flow directly with our area results
                    window.handleCutAttempt();
                }
            } else if (typeof window.showAttemptResult === 'function') {
                console.log('🔥 TRIANGLE MECHANIC: Fallback - calling showAttemptResult directly');
                // Fallback for test lab mode
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            } else {
                console.log('🔥 TRIANGLE MECHANIC: No cut handling function found!');
            }

            return true;
        } catch (error) {
            console.error('Error executing triangle cut:', error);
            return false;
        } finally {
            // Don't reset immediately in practice mode - let the protection persist
            if (!window.isPracticeMode) {
                this.reset();
            } else {
                console.log('🔒 Practice mode: Delaying reset to preserve triangle protection');
                // Only reset the triangle mechanic state, but preserve protection variables
                this.isDrawing = false;
                this.centerPoint = null;
                this.currentPoint = null;
                this.radius = 0;
                this.rotation = 0;
                this.currentTriangle = null;
            }
        }
    },

    // Validate if the cut actually divides the shape
    validateCut() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Use preserved shapes instead of global parsedShapes
        const shapesToValidate = this.originalShapes || parsedShapes;
        this.renderShapesForPixelAnalysis(tempCtx, shapesToValidate);

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
        console.log('🚫 Invalid cut - allowing re-cut without counting');
        this.reset();

        if (typeof showTryAgainMessage === 'function') showTryAgainMessage();
        this.redrawCanvas();

        // Reset instruction to initial state
        if (window.updateInstructionText && window.getInitialInstruction) {
            const initialInstruction = window.getInitialInstruction('ThreePointTriangleMechanic');
            window.updateInstructionText(initialInstruction);
        }
    },

    // Calculate areas using pixel-based method
    calculateAreas() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Use preserved shapes instead of global parsedShapes
        const shapesToCalculate = this.originalShapes || parsedShapes;
        this.renderShapesForPixelAnalysis(tempCtx, shapesToCalculate);

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

    // Check if a point is inside the triangle using barycentric coordinates
    isPointInsideTriangle(px, py, triangle) {
        const p1 = triangle.points[0];
        const p2 = triangle.points[1];
        const p3 = triangle.points[2];

        // Calculate vectors
        const v0x = p3.x - p1.x;
        const v0y = p3.y - p1.y;
        const v1x = p2.x - p1.x;
        const v1y = p2.y - p1.y;
        const v2x = px - p1.x;
        const v2y = py - p1.y;

        // Calculate dot products
        const dot00 = v0x * v0x + v0y * v0y;
        const dot01 = v0x * v1x + v0y * v1y;
        const dot02 = v0x * v2x + v0y * v2y;
        const dot11 = v1x * v1x + v1y * v1y;
        const dot12 = v1x * v2x + v1y * v2y;

        // Calculate barycentric coordinates
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        // Check if point is in triangle
        return (u >= 0) && (v >= 0) && (u + v <= 1);
    },

    // Calculate pixel-based areas
    calculatePixelBasedAreas(pixels, width, height) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;

        // CRITICAL: Save pixel indices for canvas restoration after refresh
        const leftPixelIndices = [];
        const rightPixelIndices = [];

        // Use preserved shapes instead of global parsedShapes for bounds calculation
        const shapesToUse = window.isPracticeMode ?
                           (this.originalShapes || window.parsedShapes || []) :
                           (this.originalShapes || parsedShapes || []);
        console.log(`🔍 TRIANGLE MECHANIC: Using ${shapesToUse.length} shapes for operation (isPracticeMode: ${window.isPracticeMode})`);
        const bounds = calculateBounds(shapesToUse);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);

        // Transform triangle points to shape coordinate space
        const transformedTriangle = {
            points: this.currentTriangle.points.map(point => ({
                x: (point.x - offset.x) / scale,
                y: (point.y - offset.y) / scale
            })),
            type: 'triangle'
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;

                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];

                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;

                    // Convert pixel coordinates to shape space for comparison
                    const shapeX = (x - offset.x) / scale;
                    const shapeY = (y - offset.y) / scale;

                    if (this.isPointInsideTriangle(shapeX, shapeY, transformedTriangle)) {
                        insideArea++;
                        leftPixelIndices.push(pixelIndex);
                    } else {
                        outsideArea++;
                        rightPixelIndices.push(pixelIndex);
                    }
                }
            }
        }

        const insidePercentage = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        const outsidePercentage = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;

        console.log(`🎨 Triangle mechanic: Saved ${leftPixelIndices.length} left pixels, ${rightPixelIndices.length} right pixels for restoration`);

        // CRITICAL: Ensure smaller area is always in leftArea/leftPercentage for consistent shading
        // This ensures the smaller area gets colored on the canvas
        if (insidePercentage > outsidePercentage) {
            // Swap so smaller is always "left"
            console.log(`🔄 Triangle mechanic: Swapping areas - inside (${insidePercentage.toFixed(1)}%) > outside (${outsidePercentage.toFixed(1)}%)`);
            return {
                leftArea: rightPixelIndices,    // Smaller area (outside triangle)
                rightArea: leftPixelIndices,    // Larger area (inside triangle)
                totalShapePixels,
                leftPercentage: outsidePercentage,
                rightPercentage: insidePercentage
            };
        }

        return {
            leftArea: leftPixelIndices,    // Smaller area (inside triangle) - ARRAY of pixel indices
            rightArea: rightPixelIndices,  // Larger area (outside triangle) - ARRAY of pixel indices
            totalShapePixels,
            leftPercentage: insidePercentage,
            rightPercentage: outsidePercentage
        };
    },

    // Check if a point is on the triangle edge
    isPointOnTriangleEdge(px, py, triangle, tolerance = 1) {
        const points = triangle.points;

        // Check each edge
        for (let i = 0; i < 3; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % 3];

            // Calculate distance from point to line segment
            const dist = this.pointToLineDistance(px, py, p1.x, p1.y, p2.x, p2.y);

            if (dist <= tolerance) {
                return true;
            }
        }

        return false;
    },

    // Calculate distance from point to line segment
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx === 0 && dy === 0) {
            // Line segment is a point
            return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
        }

        let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));

        const nearestX = x1 + t * dx;
        const nearestY = y1 + t * dy;

        return Math.sqrt(Math.pow(px - nearestX, 2) + Math.pow(py - nearestY, 2));
    },

    // Render the cut result with colored areas
    renderCutResult(areaResults) {
        console.log('🎨 renderCutResult called with:', areaResults);
        // Use preserved shapes instead of global parsedShapes
        const shapesToRender = this.originalShapes || parsedShapes;
        console.log('🎨 shapesToRender count:', shapesToRender?.length || 0);
        console.log('🎨 currentTriangle exists:', !!this.currentTriangle);

        if (!this.currentTriangle || !shapesToRender.length) {
            console.log('🚫 renderCutResult early return - missing triangle or shapes');
            return;
        }

        console.log('🎨 Clearing canvas and drawing grid');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapesToRender);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        const resultImageData = ctx.createImageData(canvas.width, canvas.height);
        const resultPixels = resultImageData.data;

        // Get transformation parameters for coordinate conversion
        const bounds = calculateBounds(shapesToRender);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);

        // Transform triangle points to shape coordinate space
        const transformedTriangle = {
            points: this.currentTriangle.points.map(point => ({
                x: (point.x - offset.x) / scale,
                y: (point.y - offset.y) / scale
            })),
            type: 'triangle'
        };

        // CRITICAL: We need to determine which GEOMETRIC side is actually smaller
        // Count pixels to see which is actually inside vs outside
        let geometricInsideCount = 0;
        let geometricOutsideCount = 0;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const r = pixels[pixelIndex];
                if (r === 221) {
                    const shapeX = (x - offset.x) / scale;
                    const shapeY = (y - offset.y) / scale;
                    if (this.isPointInsideTriangle(shapeX, shapeY, transformedTriangle)) {
                        geometricInsideCount++;
                    } else {
                        geometricOutsideCount++;
                    }
                }
            }
        }

        // Color whichever geometric side is smaller
        const colorInside = geometricInsideCount <= geometricOutsideCount;

        console.log(`🎨 Triangle rendering: geometricInside=${geometricInsideCount}, geometricOutside=${geometricOutsideCount}, colorInside=${colorInside}`);
        console.log(`   areaResults: leftPercentage=${areaResults.leftPercentage.toFixed(1)}%, rightPercentage=${areaResults.rightPercentage.toFixed(1)}%`);

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];

                if (r === 221 && g === 221 && b === 221) {
                    // Convert pixel coordinates to shape space for comparison
                    const shapeX = (x - offset.x) / scale;
                    const shapeY = (y - offset.y) / scale;

                    const isInside = this.isPointInsideTriangle(shapeX, shapeY, transformedTriangle);
                    const isOnEdge = this.isPointOnTriangleEdge(shapeX, shapeY, transformedTriangle);

                    if (isOnEdge) {
                        // On triangle edge - black
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

        console.log('🎨 Putting image data to canvas');
        ctx.putImageData(resultImageData, 0, 0);

        console.log('🎨 Drawing grid lines over result');
        // Draw grid lines over the result
        drawGridLinesOnly();

        // Draw shape outlines and final triangle
        if (typeof drawShapeOutlines === 'function') {
            drawShapeOutlines();
        }

        this.drawFinalTriangle();
    },

    // Draw the final triangle
    drawFinalTriangle() {
        if (!this.currentTriangle || this.currentTriangle.points.length !== 3) return;

        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = this.LINE_WIDTH;

        ctx.beginPath();
        ctx.moveTo(this.currentTriangle.points[0].x, this.currentTriangle.points[0].y);
        ctx.lineTo(this.currentTriangle.points[1].x, this.currentTriangle.points[1].y);
        ctx.lineTo(this.currentTriangle.points[2].x, this.currentTriangle.points[2].y);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
    }
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreePointTriangleMechanic;
} else {
    window.ThreePointTriangleMechanic = ThreePointTriangleMechanic;
}
