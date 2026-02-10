/**
 * Default (Straight Line) Cut Mechanic
 * Click and drag to draw a line; line extends to canvas edges.
 * Cross-product pixel analysis determines which side of the line each pixel falls on.
 */

const DefaultMechanic = {
    name: 'Straight Line Cut',
    description: 'Click and drag to draw a straight line across the shape',

    // State
    isDrawing: false,
    startPoint: null,
    endPoint: null,
    currentVector: null,
    MIN_DRAG_DISTANCE: 10,

    // Visual
    LINE_COLOR: '#000',
    LINE_WIDTH: 2,
    PREVIEW_DASH: [5, 5],
    FINAL_LINE_WIDTH: 3,

    init() {
        this.reset();
        this.setupCancellationListeners();
    },

    reset() {
        this.isDrawing = false;
        this.startPoint = null;
        this.endPoint = null;
        this.currentVector = null;
    },

    setupCancellationListeners() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;

        canvasEl.addEventListener('contextmenu', (event) => {
            if (this.isDrawing) {
                this.cancelDraw();
            }
        });
    },

    cancelDraw() {
        this.reset();
        if (window.redrawCanvas) window.redrawCanvas();
        this.showCancelFeedback();
        if (window.updateInstructionText && window.getInitialInstruction) {
            window.updateInstructionText(window.getInitialInstruction('DefaultMechanic'));
        }
    },

    showCancelFeedback() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;
        const msg = document.createElement('div');
        msg.textContent = 'Line Canceled';
        msg.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
            background:rgba(255,0,0,0.8);color:white;padding:8px 16px;border-radius:4px;
            font-size:14px;font-weight:bold;pointer-events:none;z-index:1000;`;
        const rect = canvasEl.getBoundingClientRect();
        msg.style.top = (rect.top + rect.height / 2) + 'px';
        msg.style.left = (rect.left + rect.width / 2) + 'px';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1000);
    },

    // ---- Interaction handlers ----

    handleStart(event, canvasRect) {
        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;

        if (event.touches && event.touches.length > 1) {
            if (this.isDrawing) this.cancelDraw();
            return false;
        }

        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (window.hideTryAgainMessage) window.hideTryAgainMessage();

        this.startPoint = this.getCanvasCoordinates(event, canvasRect);
        this.isDrawing = true;
        this.endPoint = null;
        this.currentVector = null;

        if (window.updateInstructionText && window.getDynamicInstruction) {
            window.updateInstructionText(window.getDynamicInstruction('DefaultMechanic', 'first_touch'));
        }
        return true;
    },

    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.startPoint) return false;
        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;

        if (event.touches && event.touches.length > 1) {
            this.cancelDraw();
            return true;
        }

        this.endPoint = this.getCanvasCoordinates(event, canvasRect);
        this.drawPreview();
        return true;
    },

    async handleEnd(event) {
        if (!this.isDrawing || !this.startPoint) return false;
        this.isDrawing = false;

        if (!this.endPoint) {
            this.reset();
            return false;
        }

        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.MIN_DRAG_DISTANCE) {
            if (window.showTryAgainMessage) window.showTryAgainMessage();
            this.reset();
            if (window.redrawCanvas) window.redrawCanvas();
            return false;
        }

        // Normalize direction (always left to right)
        let normStart = this.startPoint;
        let normEnd = this.endPoint;
        if (normStart.x > normEnd.x) {
            normStart = this.endPoint;
            normEnd = this.startPoint;
        }

        this.currentVector = this.extendVectorToCanvasBounds(normStart, normEnd);
        return await this.executeCut();
    },

    // ---- Coordinate helpers ----

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
        const w = c.width, h = c.height;
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

    // ---- Preview ----

    drawPreview() {
        if (!this.startPoint || !this.endPoint) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (window.parsedShapes) renderShapeForCutting(window.parsedShapes);

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

    // ---- Cut execution ----

    async executeCut() {
        if (!this.currentVector) return false;

        const shapesToUse = this.getShapesForAnalysis();
        if (!shapesToUse || shapesToUse.length === 0) return false;

        // Validate
        const isValid = this.validateCut(shapesToUse);
        if (!isValid) {
            this.handleInvalidCut();
            return false;
        }

        // Calculate areas
        const areaResults = this.calculateAreas(shapesToUse);

        // Render result
        this.renderCutResult(areaResults, shapesToUse);

        // Store globally for handleCutAttempt
        window.currentVector = this.currentVector;
        window.currentAreaResults = areaResults;

        // Trigger game engine flow
        if (window.isPracticeMode && window.PracticeMode) {
            window.PracticeMode.handleCutMade({
                leftPercentage: areaResults.leftPercentage,
                rightPercentage: areaResults.rightPercentage
            });
        } else if (typeof window.handleCutAttempt === 'function') {
            window.handleCutAttempt();
        }

        this.reset();
        return true;
    },

    getShapesForAnalysis() {
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            return window.PracticeMode.originalShapes;
        }
        return window.parsedShapes || [];
    },

    validateCut(shapes) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const result = this.calculatePixelBasedAreas(imageData.data, tempCanvas.width, tempCanvas.height);

        return result.leftPercentage >= 0.1 && result.rightPercentage >= 0.1;
    },

    handleInvalidCut() {
        this.reset();
        if (window.showTryAgainMessage) window.showTryAgainMessage();
        if (window.redrawCanvas) window.redrawCanvas();
        if (window.updateInstructionText && window.getInitialInstruction) {
            window.updateInstructionText(window.getInitialInstruction('DefaultMechanic'));
        }
    },

    calculateAreas(shapes) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        return this.calculatePixelBasedAreas(imageData.data, tempCanvas.width, tempCanvas.height);
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
        let leftArea = 0, rightArea = 0, totalShapePixels = 0;
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

        // Normalize: smaller is always "left"
        if (leftPct > rightPct) {
            return { leftArea: rightArea, rightArea: leftArea, totalShapePixels, leftPercentage: rightPct, rightPercentage: leftPct };
        }
        return { leftArea, rightArea, totalShapePixels, leftPercentage: leftPct, rightPercentage: rightPct };
    },

    // ---- Render cut result ----

    renderCutResult(areaResults, shapes) {
        if (!this.currentVector || !shapes.length) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        // Determine which geometric side is smaller
        const dx = this.currentVector.end.x - this.currentVector.start.x;
        const dy = this.currentVector.end.y - this.currentVector.start.y;
        let geoLeft = 0, geoRight = 0;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221) {
                    const cross = (x - this.currentVector.start.x) * dy - (y - this.currentVector.start.y) * dx;
                    if (cross > 0) geoLeft++;
                    else if (cross < 0) geoRight++;
                }
            }
        }
        const colorLeftSide = geoLeft <= geoRight;

        const result = ctx.createImageData(canvas.width, canvas.height);
        const rp = result.data;
        const color = window.getDailyCutShadingColor ? window.getDailyCutShadingColor() : { r: 100, g: 150, b: 255 };

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    const cross = (x - this.currentVector.start.x) * dy - (y - this.currentVector.start.y) * dx;
                    if (Math.abs(cross) < 1) {
                        rp[idx] = 0; rp[idx + 1] = 0; rp[idx + 2] = 0; rp[idx + 3] = 255;
                    } else if ((cross > 0 && colorLeftSide) || (cross < 0 && !colorLeftSide)) {
                        rp[idx] = color.r; rp[idx + 1] = color.g; rp[idx + 2] = color.b; rp[idx + 3] = 255;
                    } else {
                        rp[idx] = 221; rp[idx + 1] = 221; rp[idx + 2] = 221; rp[idx + 3] = 255;
                    }
                } else {
                    rp[idx] = 255; rp[idx + 1] = 255; rp[idx + 2] = 255; rp[idx + 3] = 255;
                }
            }
        }

        ctx.putImageData(result, 0, 0);
        drawGridLinesOnly();
        if (typeof drawShapeOutlines === 'function') drawShapeOutlines();
        this.drawFinalVector();
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
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DefaultMechanic;
} else {
    window.DefaultMechanic = DefaultMechanic;
}
