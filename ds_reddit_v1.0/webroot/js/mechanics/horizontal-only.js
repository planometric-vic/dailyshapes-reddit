/**
 * Horizontal Only Cut Mechanic
 * Constrains the cut line to horizontal (constant Y).
 * User taps/clicks to place the horizontal line.
 */

const HorizontalOnlyMechanic = {
    name: 'Horizontal Cut',
    description: 'Tap to place a horizontal cut line',

    isDrawing: false,
    startPoint: null,
    endPoint: null,
    currentVector: null,
    MIN_DRAG_DISTANCE: 10,

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
        canvasEl.addEventListener('contextmenu', () => {
            if (this.isDrawing) this.cancelDraw();
        });
    },

    cancelDraw() {
        this.reset();
        if (window.redrawCanvas) window.redrawCanvas();
    },

    handleStart(event, canvasRect) {
        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;
        if (event.touches && event.touches.length > 1) {
            if (this.isDrawing) this.cancelDraw();
            return false;
        }

        if (window.hideTryAgainMessage) window.hideTryAgainMessage();

        this.startPoint = this.getCanvasCoordinates(event, canvasRect);
        this.isDrawing = true;

        if (window.updateInstructionText && window.getDynamicInstruction) {
            window.updateInstructionText(window.getDynamicInstruction('HorizontalOnlyMechanic', 'first_touch'));
        }
        return true;
    },

    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.startPoint) return false;
        if (event.touches && event.touches.length > 1) {
            this.cancelDraw();
            return true;
        }

        const point = this.getCanvasCoordinates(event, canvasRect);
        // Constrain to horizontal: same Y as start, X follows pointer
        this.endPoint = { x: point.x, y: this.startPoint.y };
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

        const dx = Math.abs(this.endPoint.x - this.startPoint.x);
        if (dx < this.MIN_DRAG_DISTANCE) {
            if (window.showTryAgainMessage) window.showTryAgainMessage();
            this.reset();
            if (window.redrawCanvas) window.redrawCanvas();
            return false;
        }

        // Horizontal line spans full canvas width
        const y = this.startPoint.y;
        this.currentVector = { start: { x: 0, y }, end: { x: canvas.width, y } };
        return await this.executeCut();
    },

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

    drawPreview() {
        if (!this.startPoint) return;
        const y = this.startPoint.y;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (window.parsedShapes) renderShapeForCutting(window.parsedShapes);

        ctx.save();
        ctx.strokeStyle = this.LINE_COLOR;
        ctx.lineWidth = this.LINE_WIDTH;
        ctx.setLineDash(this.PREVIEW_DASH);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.restore();
    },

    async executeCut() {
        if (!this.currentVector) return false;
        const shapes = this.getShapesForAnalysis();
        if (!shapes || shapes.length === 0) return false;

        const isValid = this.validateCut(shapes);
        if (!isValid) { this.handleInvalidCut(); return false; }

        const areaResults = this.calculateAreas(shapes);
        this.renderCutResult(areaResults, shapes);

        window.currentVector = this.currentVector;
        window.currentAreaResults = areaResults;

        if (window.isPracticeMode && window.PracticeMode) {
            window.PracticeMode.handleCutMade({ leftPercentage: areaResults.leftPercentage, rightPercentage: areaResults.rightPercentage });
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
        const tc = document.createElement('canvas');
        tc.width = canvas.width; tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        const id = tctx.getImageData(0, 0, tc.width, tc.height);
        const r = this.calculatePixelBasedAreas(id.data, tc.width, tc.height);
        return r.leftPercentage >= 0.1 && r.rightPercentage >= 0.1;
    },

    handleInvalidCut() {
        this.reset();
        if (window.showTryAgainMessage) window.showTryAgainMessage();
        if (window.redrawCanvas) window.redrawCanvas();
    },

    calculateAreas(shapes) {
        const tc = document.createElement('canvas');
        tc.width = canvas.width; tc.height = canvas.height;
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
        let leftArea = 0, rightArea = 0, totalShapePixels = 0;
        const ls = this.currentVector.start;
        const le = this.currentVector.end;
        const dx = le.x - ls.x, dy = le.y - ls.y;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    totalShapePixels++;
                    const cross = (x - ls.x) * dy - (y - ls.y) * dx;
                    if (cross > 0) leftArea++; else if (cross < 0) rightArea++;
                }
            }
        }

        let lp = totalShapePixels > 0 ? (leftArea / totalShapePixels) * 100 : 0;
        let rp = totalShapePixels > 0 ? (rightArea / totalShapePixels) * 100 : 0;

        if (lp > rp) return { leftArea: rightArea, rightArea: leftArea, totalShapePixels, leftPercentage: rp, rightPercentage: lp };
        return { leftArea, rightArea, totalShapePixels, leftPercentage: lp, rightPercentage: rp };
    },

    renderCutResult(areaResults, shapes) {
        if (!this.currentVector || !shapes.length) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        const tc = document.createElement('canvas');
        tc.width = canvas.width; tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        const pixels = tctx.getImageData(0, 0, tc.width, tc.height).data;

        const dx = this.currentVector.end.x - this.currentVector.start.x;
        const dy = this.currentVector.end.y - this.currentVector.start.y;

        let gL = 0, gR = 0;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221) {
                    const cross = (x - this.currentVector.start.x) * dy - (y - this.currentVector.start.y) * dx;
                    if (cross > 0) gL++; else if (cross < 0) gR++;
                }
            }
        }
        const colorLeft = gL <= gR;

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
                    } else if ((cross > 0 && colorLeft) || (cross < 0 && !colorLeft)) {
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
    module.exports = HorizontalOnlyMechanic;
} else {
    window.HorizontalOnlyMechanic = HorizontalOnlyMechanic;
}
