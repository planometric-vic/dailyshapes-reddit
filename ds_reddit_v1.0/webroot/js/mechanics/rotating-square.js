/**
 * Rotating Square Cut Mechanic
 * Click/tap to set the center of a square, then drag to expand and rotate it.
 *
 * - Size = distance from center to drag point (half-diagonal)
 * - Rotation = atan2(dy, dx) from center to drag point
 * - Must drag at least 15px AND size >= 30 to register
 * - Pixel-based area analysis determines inside vs outside split
 * - The geometrically smaller side is shaded with the daily color
 */

const RotatingSquareMechanic = {
    name: 'Rotating Square Cut',
    description: 'Click to set a center, drag to size and rotate a square cut',

    // State
    isDrawing: false,
    hasMoved: false,
    centerPoint: null,
    currentPoint: null,
    size: 0,
    rotation: 0,
    currentSquare: null,

    // Thresholds
    MIN_DRAG_DISTANCE: 15,
    MIN_SQUARE_SIZE: 30,

    // Visual
    LINE_COLOR: '#000000',
    LINE_WIDTH: 3,
    PREVIEW_DASH: [6, 6],
    INDICATOR_DASH: [2, 2],
    CENTER_DOT_RADIUS: 3,

    // -----------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------

    init() {
        this.reset();
        this.setupCancellationListeners();
    },

    reset() {
        this.isDrawing = false;
        this.hasMoved = false;
        this.centerPoint = null;
        this.currentPoint = null;
        this.size = 0;
        this.rotation = 0;
        this.currentSquare = null;
    },

    // -----------------------------------------------------------------
    // Cancellation
    // -----------------------------------------------------------------

    setupCancellationListeners() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;

        canvasEl.addEventListener('contextmenu', () => {
            if (this.isDrawing) this.cancelDraw();
        });
    },

    cancelDraw() {
        this.reset();
        if (window.redrawCanvas) window.redrawCanvas();
        this.showCancelFeedback();
    },

    showCancelFeedback() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;

        const msg = document.createElement('div');
        msg.textContent = 'Draw Canceled';
        msg.style.cssText =
            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:rgba(255,0,0,0.8);color:white;padding:8px 16px;border-radius:4px;' +
            'font-size:14px;font-weight:bold;pointer-events:none;z-index:1000;';

        const rect = canvasEl.getBoundingClientRect();
        msg.style.top = (rect.top + rect.height / 2) + 'px';
        msg.style.left = (rect.left + rect.width / 2) + 'px';

        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1000);
    },

    // -----------------------------------------------------------------
    // Interaction handlers
    // -----------------------------------------------------------------

    handleStart(event, canvasRect) {
        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;

        // Multi-touch cancellation
        if (event.touches && event.touches.length > 1) {
            if (this.isDrawing) this.cancelDraw();
            return false;
        }

        if (window.hideTryAgainMessage) window.hideTryAgainMessage();

        this.centerPoint = this.getCanvasCoordinates(event, canvasRect);
        this.isDrawing = true;
        this.hasMoved = false;
        this.size = 0;
        this.rotation = 0;
        this.currentSquare = null;

        if (window.updateInstructionText && window.getDynamicInstruction) {
            window.updateInstructionText(
                window.getDynamicInstruction('RotatingSquareMechanic', 'first_touch')
            );
        }

        return true;
    },

    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.centerPoint) return false;

        // Multi-touch cancellation during drag
        if (event.touches && event.touches.length > 1) {
            this.cancelDraw();
            return true;
        }

        this.currentPoint = this.getCanvasCoordinates(event, canvasRect);

        const dx = this.currentPoint.x - this.centerPoint.x;
        const dy = this.currentPoint.y - this.centerPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.MIN_DRAG_DISTANCE) {
            this.hasMoved = true;
        }

        // Size is the half-diagonal (distance from center to drag point)
        this.size = distance;

        // Rotation derived from drag angle
        this.rotation = Math.atan2(dy, dx);

        this.currentSquare = {
            center: this.centerPoint,
            size: this.size,
            rotation: this.rotation
        };

        this.drawPreview();
        return true;
    },

    async handleEnd(event) {
        if (!this.isDrawing || !this.centerPoint || !this.hasMoved ||
            this.size < this.MIN_SQUARE_SIZE) {
            this.reset();
            if (window.redrawCanvas) window.redrawCanvas();
            return false;
        }

        const squareData = {
            center: { x: this.centerPoint.x, y: this.centerPoint.y },
            size: this.size,
            rotation: this.rotation,
            type: 'rotating-square'
        };

        this.reset();
        return await this.executeSquareCut(squareData);
    },

    // -----------------------------------------------------------------
    // Coordinate helper
    // -----------------------------------------------------------------

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

    // -----------------------------------------------------------------
    // Preview
    // -----------------------------------------------------------------

    drawPreview() {
        if (!this.currentSquare) return;

        // Redraw base canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (window.parsedShapes) renderShapeForCutting(window.parsedShapes);

        const sq = this.currentSquare;
        const half = sq.size;

        ctx.save();

        // Transform to square center, apply rotation
        ctx.translate(sq.center.x, sq.center.y);
        ctx.rotate(sq.rotation);

        // Dashed square outline
        ctx.strokeStyle = this.LINE_COLOR;
        ctx.lineWidth = this.LINE_WIDTH;
        ctx.setLineDash(this.PREVIEW_DASH);
        ctx.beginPath();
        ctx.rect(-half, -half, half * 2, half * 2);
        ctx.stroke();

        // Center dot
        ctx.setLineDash([]);
        ctx.fillStyle = this.LINE_COLOR;
        ctx.beginPath();
        ctx.arc(0, 0, this.CENTER_DOT_RADIUS, 0, 2 * Math.PI);
        ctx.fill();

        // Diagonal indicator line (center to drag direction)
        ctx.setLineDash(this.INDICATOR_DASH);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(half, 0);
        ctx.stroke();

        ctx.restore();
    },

    // -----------------------------------------------------------------
    // Cut execution
    // -----------------------------------------------------------------

    async executeSquareCut(squareData) {
        if (!squareData) return false;

        const shapes = this.getShapesForAnalysis();
        if (!shapes || shapes.length === 0) return false;

        // Store for geometry tests during pixel analysis
        this.currentSquare = squareData;

        // Validate
        const isValid = this.validateCut(shapes);
        if (!isValid) {
            this.handleInvalidCut();
            return false;
        }

        // Calculate areas
        const areaResults = this.calculateAreas(shapes);

        // Render result
        this.renderCutResult(areaResults, shapes);

        // Store globally for handleCutAttempt
        window.currentSquareData = squareData;
        window.currentAreaResults = areaResults;
        window.currentVector = null; // Prevent vector-based calculation

        // Trigger game engine flow
        if (window.isPracticeMode && window.PracticeMode) {
            window.PracticeMode.handleCutMade({
                leftPercentage: areaResults.leftPercentage,
                rightPercentage: areaResults.rightPercentage
            });
        } else if (typeof window.handleCutAttempt === 'function') {
            window.handleCutAttempt();
        }

        return true;
    },

    // -----------------------------------------------------------------
    // Shape selection (practice mode aware)
    // -----------------------------------------------------------------

    getShapesForAnalysis() {
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            return window.PracticeMode.originalShapes;
        }
        return window.parsedShapes || [];
    },

    // -----------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------

    validateCut(shapes) {
        const tc = document.createElement('canvas');
        tc.width = canvas.width;
        tc.height = canvas.height;
        const tctx = tc.getContext('2d');

        this.renderShapesForPixelAnalysis(tctx, shapes);

        const imageData = tctx.getImageData(0, 0, tc.width, tc.height);
        const result = this.calculatePixelBasedAreas(imageData.data, tc.width, tc.height);

        return result.leftPercentage >= 0.1 && result.rightPercentage >= 0.1;
    },

    handleInvalidCut() {
        this.reset();
        if (window.showTryAgainMessage) window.showTryAgainMessage();
        if (window.redrawCanvas) window.redrawCanvas();
    },

    // -----------------------------------------------------------------
    // Area calculation
    // -----------------------------------------------------------------

    calculateAreas(shapes) {
        const tc = document.createElement('canvas');
        tc.width = canvas.width;
        tc.height = canvas.height;
        const tctx = tc.getContext('2d');

        this.renderShapesForPixelAnalysis(tctx, shapes);

        const imageData = tctx.getImageData(0, 0, tc.width, tc.height);
        return this.calculatePixelBasedAreas(imageData.data, tc.width, tc.height);
    },

    // -----------------------------------------------------------------
    // Pixel analysis helpers
    // -----------------------------------------------------------------

    renderShapesForPixelAnalysis(context, shapes) {
        context.save();
        context.fillStyle = '#dddddd';
        const bounds = calculateBounds(shapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        shapes.forEach(shape => drawPolygonForPixelAnalysis(context, shape, scale, offset));
        context.restore();
    },

    /**
     * Point-inside-square test.
     * Translates the point into the square's local (unrotated) coordinate
     * system and checks axis-aligned containment.
     */
    isPointInsideSquare(x, y, center, size, rotation) {
        const dx = x - center.x;
        const dy = y - center.y;
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;
        return Math.abs(rotatedX) <= size && Math.abs(rotatedY) <= size;
    },

    /**
     * Point-on-border test.
     * Returns true when |rotatedX| or |rotatedY| is within 1.5 px of `size`
     * while the point is still inside (or on the edge of) the square.
     */
    isPointOnSquareBorder(x, y, center, size, rotation) {
        const dx = x - center.x;
        const dy = y - center.y;
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const rotatedX = dx * cos - dy * sin;
        const rotatedY = dx * sin + dy * cos;

        const onVerticalEdge =
            Math.abs(Math.abs(rotatedX) - size) < 1.5 && Math.abs(rotatedY) <= size;
        const onHorizontalEdge =
            Math.abs(Math.abs(rotatedY) - size) < 1.5 && Math.abs(rotatedX) <= size;

        return onVerticalEdge || onHorizontalEdge;
    },

    /**
     * Count shape pixels inside vs outside the square.
     * Normalizes so the smaller percentage is always "left".
     */
    calculatePixelBasedAreas(pixels, width, height) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;

        const center = this.currentSquare.center;
        const size = this.currentSquare.size;
        const rotation = this.currentSquare.rotation;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];

                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;

                    if (this.isPointInsideSquare(x, y, center, size, rotation)) {
                        insideArea++;
                    } else {
                        outsideArea++;
                    }
                }
            }
        }

        const insidePct = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        const outsidePct = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;

        // Normalize: smaller is always "left"
        if (insidePct <= outsidePct) {
            return {
                leftArea: insideArea,
                rightArea: outsideArea,
                totalShapePixels,
                leftPercentage: insidePct,
                rightPercentage: outsidePct
            };
        }
        return {
            leftArea: outsideArea,
            rightArea: insideArea,
            totalShapePixels,
            leftPercentage: outsidePct,
            rightPercentage: insidePct
        };
    },

    // -----------------------------------------------------------------
    // Render cut result
    // -----------------------------------------------------------------

    renderCutResult(areaResults, shapes) {
        if (!this.currentSquare || !shapes || shapes.length === 0) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // Render shapes into an off-screen canvas for pixel analysis
        const tc = document.createElement('canvas');
        tc.width = canvas.width;
        tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);

        const imageData = tctx.getImageData(0, 0, tc.width, tc.height);
        const pixels = imageData.data;

        const center = this.currentSquare.center;
        const size = this.currentSquare.size;
        const rotation = this.currentSquare.rotation;

        // Determine which GEOMETRIC side has fewer pixels so we color that one
        let geometricInsideCount = 0;
        let geometricOutsideCount = 0;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221) {
                    if (this.isPointInsideSquare(x, y, center, size, rotation)) {
                        geometricInsideCount++;
                    } else {
                        geometricOutsideCount++;
                    }
                }
            }
        }

        const colorInside = geometricInsideCount <= geometricOutsideCount;
        const color = window.getDailyCutShadingColor
            ? window.getDailyCutShadingColor()
            : { r: 100, g: 150, b: 255 };

        // Build result image
        const result = ctx.createImageData(canvas.width, canvas.height);
        const rp = result.data;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;

                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    const isInside = this.isPointInsideSquare(x, y, center, size, rotation);
                    const isOnBorder = this.isPointOnSquareBorder(x, y, center, size, rotation);

                    if (isOnBorder) {
                        // Square boundary -- black
                        rp[idx] = 0; rp[idx + 1] = 0; rp[idx + 2] = 0; rp[idx + 3] = 255;
                    } else if ((isInside && colorInside) || (!isInside && !colorInside)) {
                        // Smaller area -- daily color
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

        // Overlay grid lines, shape outlines, and final square
        drawGridLinesOnly();
        if (typeof drawShapeOutlines === 'function') drawShapeOutlines();
        this.drawFinalSquare();
    },

    /**
     * Draw the solid square outline over the final cut result.
     */
    drawFinalSquare() {
        if (!this.currentSquare) return;

        const half = this.currentSquare.size;

        ctx.save();
        ctx.translate(this.currentSquare.center.x, this.currentSquare.center.y);
        ctx.rotate(this.currentSquare.rotation);

        ctx.strokeStyle = this.LINE_COLOR;
        ctx.lineWidth = this.LINE_WIDTH;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.rect(-half, -half, half * 2, half * 2);
        ctx.stroke();

        ctx.restore();
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RotatingSquareMechanic;
} else {
    window.RotatingSquareMechanic = RotatingSquareMechanic;
}
