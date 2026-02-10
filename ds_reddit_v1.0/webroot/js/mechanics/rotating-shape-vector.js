/**
 * Rotating Shape Vector Cut Mechanic
 * Combines the straight-line cut (DefaultMechanic) with continuously rotating shapes.
 *
 * Rotation: The shape rotates around a fixed center (190, 190) at one revolution
 * per 12 seconds. When the user completes a drag to define a cut line, rotation
 * stops and the line is applied to the current rotated position.
 *
 * Cut: Identical to DefaultMechanic -- click-and-drag draws a straight line that
 * is extended to the canvas bounds; cross-product pixel analysis determines the
 * area on each side.
 */

const RotatingShapeVectorMechanic = {
    name: 'Rotating Shape Vector Cut',
    description: 'Draw a straight line while the shape rotates continuously',

    // ---- Drawing state (matches DefaultMechanic) ----
    isDrawing: false,
    startPoint: null,
    endPoint: null,
    currentVector: null,
    dragDistance: 0,
    MIN_DRAG_DISTANCE: 10,

    // ---- Visual constants ----
    LINE_COLOR: '#000',
    LINE_WIDTH: 2,
    PREVIEW_DASH: [5, 5],
    FINAL_LINE_WIDTH: 3,

    // ---- Rotation state ----
    rotationCenter: { x: 190, y: 190 },
    rotationAngle: 0,
    rotationSpeed: (2 * Math.PI) / 12000, // 1 revolution per 12 000 ms
    animationId: null,
    lastFrameTime: 0,
    isRotating: false,
    rotationPausedForDemo: false,
    rotationWatchdog: null,

    // ---- Original (unrotated) shapes ----
    originalShapes: null,

    // ================================================================
    // LIFECYCLE
    // ================================================================

    init() {
        this.reset();
        this.setupDesktopUndoListeners();
        this.setupRotation();
    },

    reset() {
        this.resetDrawingState();
        this.stopRotation();
        this.rotationAngle = 0;
        this.originalShapes = null;
        this.rotationPausedForDemo = false;
        this.clearWatchdog();
    },

    /** Reset only drawing state -- leaves rotation intact. */
    resetDrawingState() {
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.currentVector = null;
        this.dragDistance = 0;
    },

    // ================================================================
    // DESKTOP UNDO (right-click to cancel)
    // ================================================================

    setupDesktopUndoListeners() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;

        canvasEl.addEventListener('contextmenu', () => {
            if (this.isDrawing) {
                this.cancelLineDraw();
            }
        });
    },

    cancelLineDraw() {
        this.resetDrawingState();

        // Ensure rotation resumes if it was interrupted
        if (!this.isRotating && this.originalShapes && this.rotationCenter) {
            this.startRotation();
        }

        if (!this.isRotating) {
            this.drawCurrentState();
        }

        this.showCancelFeedback();

        if (window.updateInstructionText && window.getInitialInstruction) {
            window.updateInstructionText(window.getInitialInstruction('RotatingShapeVectorMechanic'));
        }
    },

    showCancelFeedback() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;
        const msg = document.createElement('div');
        msg.textContent = 'Line Canceled';
        msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:rgba(255,0,0,0.8);color:white;padding:8px 16px;border-radius:4px;' +
            'font-size:14px;font-weight:bold;pointer-events:none;z-index:1000;';
        const rect = canvasEl.getBoundingClientRect();
        msg.style.top = (rect.top + rect.height / 2) + 'px';
        msg.style.left = (rect.left + rect.width / 2) + 'px';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1000);
    },

    // ================================================================
    // ROTATION SETUP & CONTROL
    // ================================================================

    /** Initialise rotation: store the original shapes and start the animation loop. */
    setupRotation() {
        this.rotationCenter = { x: 190, y: 190 };

        const shapes = window.parsedShapes;
        if (shapes && shapes.length > 0) {
            this.originalShapes = JSON.parse(JSON.stringify(shapes));
            this.startRotation();
        } else {
            this.originalShapes = [];
        }

        this.drawCurrentState();
        this.setupRotationWatchdog();
    },

    startRotation() {
        if (this.isRotating) return;
        if (!this.originalShapes || this.originalShapes.length === 0) return;
        this.isRotating = true;
        this.lastFrameTime = performance.now();
        this.animateRotation();
    },

    stopRotation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isRotating = false;
    },

    /** requestAnimationFrame loop -- updates rotation and redraws every frame. */
    animateRotation() {
        if (!this.isRotating) return;

        const now = performance.now();
        const dt = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Advance rotation angle
        this.rotationAngle += this.rotationSpeed * dt;
        if (this.rotationAngle >= 2 * Math.PI) {
            this.rotationAngle -= 2 * Math.PI;
        }

        // Apply rotation to shapes and redraw
        this.updateRotatedShapes();
        this.drawCurrentState();

        this.animationId = requestAnimationFrame(() => this.animateRotation());
    },

    /** Rotate all shape coordinates and write them into window.parsedShapes. */
    updateRotatedShapes() {
        if (!this.originalShapes || !this.rotationCenter) return;

        const rotated = this.originalShapes.map(shape => {
            if (shape.outerRing) {
                const copy = JSON.parse(JSON.stringify(shape));
                copy.outerRing = shape.outerRing.map(coord => {
                    const rp = this.rotatePoint(
                        { x: coord[0], y: coord[1] },
                        this.rotationCenter,
                        this.rotationAngle
                    );
                    return [rp.x, rp.y];
                });
                if (shape.holes) {
                    copy.holes = shape.holes.map(hole =>
                        hole.map(coord => {
                            const rp = this.rotatePoint(
                                { x: coord[0], y: coord[1] },
                                this.rotationCenter,
                                this.rotationAngle
                            );
                            return [rp.x, rp.y];
                        })
                    );
                }
                return copy;
            }
            return shape;
        });

        // Update the global parsedShapes so everything renders the rotated version
        window.parsedShapes = rotated;
        // Also update parsedShapes if it exists as a bare global (legacy compat)
        if (typeof parsedShapes !== 'undefined') {
            try { parsedShapes = rotated; } catch (_) { /* strict-mode safe */ }
        }
    },

    /** Rotate a point around a centre by the given angle (radians). */
    rotatePoint(point, center, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return {
            x: dx * cos - dy * sin + center.x,
            y: dx * sin + dy * cos + center.y
        };
    },

    // ---- Watchdog ----

    /** Every 2 s, check that rotation is running when it should be. */
    setupRotationWatchdog() {
        this.clearWatchdog();
        this.rotationWatchdog = setInterval(() => {
            if (this.rotationPausedForDemo) return;
            if (window.isPracticeMode) return;

            const shapes = window.parsedShapes;
            if (!this.originalShapes || this.originalShapes.length === 0) {
                if (shapes && shapes.length > 0) {
                    this.originalShapes = JSON.parse(JSON.stringify(shapes));
                }
            }
            if (!this.rotationCenter) {
                this.rotationCenter = { x: 190, y: 190 };
            }
            if (this.originalShapes && this.originalShapes.length > 0 && !this.isRotating) {
                this.startRotation();
            }
        }, 2000);
    },

    clearWatchdog() {
        if (this.rotationWatchdog) {
            clearInterval(this.rotationWatchdog);
            this.rotationWatchdog = null;
        }
    },

    /** Called by the game engine between attempts to resume rotation. */
    restartRotationForNextAttempt() {
        this.rotationPausedForDemo = false;

        if (!this.originalShapes) {
            const shapes = window.parsedShapes;
            if (shapes && shapes.length > 0) {
                this.originalShapes = JSON.parse(JSON.stringify(shapes));
            }
        }
        if (!this.rotationCenter) {
            this.rotationCenter = { x: 190, y: 190 };
        }

        if (this.rotationCenter && this.originalShapes && this.originalShapes.length > 0) {
            this.startRotation();
            this.drawCurrentState();
            if (window.updateInstructionText && window.getInitialInstruction) {
                window.updateInstructionText(window.getInitialInstruction('RotatingShapeVectorMechanic'));
            }
        }
    },

    // ================================================================
    // INTERACTION HANDLERS (mouse + touch)
    // ================================================================

    handleStart(event, canvasRect) {
        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;

        // Multi-touch cancels any active draw
        if (event.touches && event.touches.length > 1) {
            if (this.isDrawing) this.cancelLineDraw();
            return false;
        }

        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (window.hideTryAgainMessage) window.hideTryAgainMessage();

        this.startPoint = this.getCanvasCoordinates(event, canvasRect);
        this.isDrawing = true;
        this.endPoint = null;
        this.currentVector = null;
        this.dragDistance = 0;

        if (window.updateInstructionText && window.getDynamicInstruction) {
            window.updateInstructionText(
                window.getDynamicInstruction('RotatingShapeVectorMechanic', 'first_touch')
            );
        }
        return true;
    },

    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.startPoint) return false;
        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;

        if (event.touches && event.touches.length > 1) {
            this.cancelLineDraw();
            return true;
        }

        this.endPoint = this.getCanvasCoordinates(event, canvasRect);

        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        this.dragDistance = Math.sqrt(dx * dx + dy * dy);

        // The animation loop redraws every frame (including the preview),
        // so there is no need to explicitly call drawCurrentState here.
        return true;
    },

    async handleEnd(event) {
        if (!this.isDrawing || !this.startPoint) {
            this.resetDrawingState();
            return false;
        }

        this.isDrawing = false;

        if (!this.endPoint) {
            this.endPoint = this.startPoint;
        }

        // Too-short drag -- treat as a tap
        if (this.dragDistance < this.MIN_DRAG_DISTANCE) {
            if (window.showTryAgainMessage) window.showTryAgainMessage();
            this.resetDrawingState();
            // Restart rotation if it was somehow stopped
            if (!this.isRotating && this.originalShapes && this.rotationCenter) {
                this.startRotation();
            }
            if (!this.isRotating) this.drawCurrentState();
            return false;
        }

        // Normalize direction: always left-to-right
        let normStart = this.startPoint;
        let normEnd = this.endPoint;
        if (normStart.x > normEnd.x) {
            normStart = this.endPoint;
            normEnd = this.startPoint;
        }

        this.currentVector = this.extendVectorToCanvasBounds(normStart, normEnd);

        // Stop rotation before executing the cut
        this.stopRotation();

        return await this.executeCut();
    },

    // ================================================================
    // COORDINATE HELPERS
    // ================================================================

    getCanvasCoordinates(event, canvasRect) {
        let clientX, clientY;
        if (event.type.startsWith('touch')) {
            clientX = event.touches[0]?.clientX || event.changedTouches[0]?.clientX;
            clientY = event.touches[0]?.clientY || event.changedTouches[0]?.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        const c = document.getElementById('geoCanvas');
        const scaleX = c.width / canvasRect.width;
        const scaleY = c.height / canvasRect.height;
        return {
            x: (clientX - canvasRect.left) * scaleX,
            y: (clientY - canvasRect.top) * scaleY
        };
    },

    extendVectorToCanvasBounds(start, end) {
        const c = document.getElementById('geoCanvas');
        const w = c.width;
        const h = c.height;
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        if (Math.abs(dx) < 0.001) return { start: { x: start.x, y: 0 }, end: { x: start.x, y: h } };
        if (Math.abs(dy) < 0.001) return { start: { x: 0, y: start.y }, end: { x: w, y: start.y } };

        const slope = dy / dx;
        const intercept = start.y - slope * start.x;
        const pts = [];

        const leftY = intercept;
        if (leftY >= 0 && leftY <= h) pts.push({ x: 0, y: leftY });
        const rightY = slope * w + intercept;
        if (rightY >= 0 && rightY <= h) pts.push({ x: w, y: rightY });
        const topX = -intercept / slope;
        if (topX >= 0 && topX <= w) pts.push({ x: topX, y: 0 });
        const botX = (h - intercept) / slope;
        if (botX >= 0 && botX <= w) pts.push({ x: botX, y: h });

        if (pts.length >= 2) return { start: pts[0], end: pts[1] };
        return { start, end };
    },

    // ================================================================
    // DRAWING
    // ================================================================

    /** Full redraw: grid, rotated shapes, optional vector preview. */
    drawCurrentState() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        const shapes = window.parsedShapes;
        if (shapes && shapes.length > 0 && typeof renderShapeForCutting === 'function') {
            renderShapeForCutting(shapes);
        }

        // Draw the drag preview line while the user is drawing
        if (this.isDrawing && this.startPoint && this.endPoint) {
            this.drawPreview();
        }
    },

    drawPreview() {
        if (!this.startPoint || !this.endPoint) return;

        ctx.save();
        ctx.strokeStyle = this.LINE_COLOR;
        ctx.lineWidth = this.LINE_WIDTH;
        ctx.setLineDash(this.PREVIEW_DASH);
        ctx.beginPath();
        ctx.moveTo(this.startPoint.x, this.startPoint.y);
        ctx.lineTo(this.endPoint.x, this.endPoint.y);
        ctx.stroke();
        ctx.restore();
    },

    drawFinalVector() {
        if (!this.currentVector) return;
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = this.FINAL_LINE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
        ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y);
        ctx.stroke();
        ctx.restore();
    },

    // ================================================================
    // CUT EXECUTION
    // ================================================================

    async executeCut() {
        if (!this.currentVector) return false;

        const shapes = this.getShapesForAnalysis();
        if (!shapes || shapes.length === 0) return false;

        // Validate
        const isValid = this.validateCut(shapes);
        if (!isValid) {
            this.handleInvalidCut();
            return false;
        }

        // Calculate areas
        const areaResults = this.calculateAreas(shapes);

        // Render the result
        this.renderCutResult(areaResults, shapes);

        // Store globally for the game engine
        window.currentVector = this.currentVector;
        window.currentAreaResults = areaResults;

        // Pause rotation so the result stays visible until the game engine resumes it
        this.rotationPausedForDemo = true;

        // Trigger game engine flow
        if (window.isPracticeMode && window.PracticeMode) {
            window.PracticeMode.handleCutMade({
                leftPercentage: areaResults.leftPercentage,
                rightPercentage: areaResults.rightPercentage
            });
        } else if (typeof window.handleCutAttempt === 'function') {
            window.handleCutAttempt();
        }

        // Reset drawing state only (rotation is paused, not destroyed)
        this.resetDrawingState();
        return true;
    },

    getShapesForAnalysis() {
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            return window.PracticeMode.originalShapes;
        }
        return window.parsedShapes || [];
    },

    validateCut(shapes) {
        const tc = document.createElement('canvas');
        tc.width = canvas.width;
        tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        const id = tctx.getImageData(0, 0, tc.width, tc.height);
        const result = this.calculatePixelBasedAreas(id.data, tc.width, tc.height);
        return result.leftPercentage >= 0.1 && result.rightPercentage >= 0.1;
    },

    handleInvalidCut() {
        this.resetDrawingState();
        if (window.showTryAgainMessage) window.showTryAgainMessage();

        // Resume rotation after an invalid cut
        if (!this.isRotating && this.originalShapes && this.rotationCenter) {
            this.startRotation();
        }
        if (!this.isRotating) {
            this.drawCurrentState();
        }

        if (window.updateInstructionText && window.getInitialInstruction) {
            window.updateInstructionText(window.getInitialInstruction('RotatingShapeVectorMechanic'));
        }
    },

    calculateAreas(shapes) {
        const tc = document.createElement('canvas');
        tc.width = canvas.width;
        tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        const id = tctx.getImageData(0, 0, tc.width, tc.height);
        return this.calculatePixelBasedAreas(id.data, tc.width, tc.height);
    },

    renderShapesForPixelAnalysis(context, shapes) {
        context.save();
        context.fillStyle = '#dddddd';
        const bounds = calculateBounds(shapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        shapes.forEach(shape => drawPolygonForPixelAnalysis(context, shape, scale, offset));
        context.restore();
    },

    calculatePixelBasedAreas(pixels, width, height) {
        let leftArea = 0;
        let rightArea = 0;
        let totalShapePixels = 0;
        const ls = this.currentVector.start;
        const le = this.currentVector.end;
        const dx = le.x - ls.x;
        const dy = le.y - ls.y;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    totalShapePixels++;
                    const cross = (x - ls.x) * dy - (y - ls.y) * dx;
                    if (cross > 0) leftArea++;
                    else if (cross < 0) rightArea++;
                }
            }
        }

        let leftPct = totalShapePixels > 0 ? (leftArea / totalShapePixels) * 100 : 0;
        let rightPct = totalShapePixels > 0 ? (rightArea / totalShapePixels) * 100 : 0;

        // Normalize: smaller percentage is always "left"
        if (leftPct > rightPct) {
            return {
                leftArea: rightArea,
                rightArea: leftArea,
                totalShapePixels,
                leftPercentage: rightPct,
                rightPercentage: leftPct
            };
        }
        return { leftArea, rightArea, totalShapePixels, leftPercentage: leftPct, rightPercentage: rightPct };
    },

    // ================================================================
    // RENDER CUT RESULT
    // ================================================================

    renderCutResult(areaResults, shapes) {
        if (!this.currentVector || !shapes.length) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        const tc = document.createElement('canvas');
        tc.width = canvas.width;
        tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        const pixels = tctx.getImageData(0, 0, tc.width, tc.height).data;

        // Determine which geometric side is smaller so we can shade it
        const dx = this.currentVector.end.x - this.currentVector.start.x;
        const dy = this.currentVector.end.y - this.currentVector.start.y;
        let geoLeft = 0;
        let geoRight = 0;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221) {
                    const cross = (x - this.currentVector.start.x) * dy -
                                  (y - this.currentVector.start.y) * dx;
                    if (cross > 0) geoLeft++;
                    else if (cross < 0) geoRight++;
                }
            }
        }
        const colorLeftSide = geoLeft <= geoRight;

        const result = ctx.createImageData(canvas.width, canvas.height);
        const rp = result.data;
        const color = window.getDailyCutShadingColor
            ? window.getDailyCutShadingColor()
            : { r: 100, g: 150, b: 255 };

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    const cross = (x - this.currentVector.start.x) * dy -
                                  (y - this.currentVector.start.y) * dx;
                    if (Math.abs(cross) < 1) {
                        // On the cut line
                        rp[idx] = 0; rp[idx + 1] = 0; rp[idx + 2] = 0; rp[idx + 3] = 255;
                    } else if ((cross > 0 && colorLeftSide) || (cross < 0 && !colorLeftSide)) {
                        // Smaller area -- shade with the daily color
                        rp[idx] = color.r; rp[idx + 1] = color.g; rp[idx + 2] = color.b; rp[idx + 3] = 255;
                    } else {
                        // Larger area -- grey
                        rp[idx] = 221; rp[idx + 1] = 221; rp[idx + 2] = 221; rp[idx + 3] = 255;
                    }
                } else {
                    // Background -- white
                    rp[idx] = 255; rp[idx + 1] = 255; rp[idx + 2] = 255; rp[idx + 3] = 255;
                }
            }
        }

        ctx.putImageData(result, 0, 0);
        drawGridLinesOnly();
        if (typeof drawShapeOutlines === 'function') drawShapeOutlines();
        this.drawFinalVector();
    }
};

// ================================================================
// EXPORT
// ================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RotatingShapeVectorMechanic;
} else {
    window.RotatingShapeVectorMechanic = RotatingShapeVectorMechanic;
}
