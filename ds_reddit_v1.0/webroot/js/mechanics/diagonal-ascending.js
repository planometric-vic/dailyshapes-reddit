/**
 * Diagonal Ascending Cut Mechanic
 * Constrains the cut line to a 45-degree ascending diagonal (/).
 * User clicks and drags; the line is locked to the ascending diagonal angle.
 */

const DiagonalAscendingMechanic = {
    name: 'Diagonal Ascending Cut',
    description: 'Click and drag to place a diagonal (/) cut line',

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
            window.updateInstructionText(window.getDynamicInstruction('DiagonalAscendingMechanic', 'first_touch'));
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
        // Project onto ascending diagonal (slope = -1):
        // Move along y = -x + c (ascending from bottom-left to top-right)
        const dx = point.x - this.startPoint.x;
        const dy = point.y - this.startPoint.y;
        const proj = (dx - dy) / 2; // projected distance along ascending diagonal
        this.endPoint = {
            x: this.startPoint.x + proj,
            y: this.startPoint.y - proj
        };

        this.drawPreview();
        return true;
    },

    async handleEnd(event) {
        if (!this.isDrawing || !this.startPoint) return false;
        this.isDrawing = false;

        if (!this.endPoint) { this.reset(); return false; }

        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) < this.MIN_DRAG_DISTANCE) {
            if (window.showTryAgainMessage) window.showTryAgainMessage();
            this.reset();
            if (window.redrawCanvas) window.redrawCanvas();
            return false;
        }

        this.currentVector = this.extendDiagonalToCanvas(this.startPoint);
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
        const sx = c.width / canvasRect.width;
        const sy = c.height / canvasRect.height;
        return { x: (clientX - canvasRect.left) * sx, y: (clientY - canvasRect.top) * sy };
    },

    /** Extend ascending diagonal (slope = -1) from start to canvas edges */
    extendDiagonalToCanvas(start) {
        const w = canvas.width, h = canvas.height;
        // Line: y = -x + c, where c = start.x + start.y
        const c = start.x + start.y;
        const pts = [];

        // Left edge (x=0): y = c
        if (c >= 0 && c <= h) pts.push({ x: 0, y: c });
        // Right edge (x=w): y = c - w
        const rY = c - w;
        if (rY >= 0 && rY <= h) pts.push({ x: w, y: rY });
        // Top edge (y=0): x = c
        if (c >= 0 && c <= w) pts.push({ x: c, y: 0 });
        // Bottom edge (y=h): x = c - h
        const bX = c - h;
        if (bX >= 0 && bX <= w) pts.push({ x: bX, y: h });

        if (pts.length >= 2) return { start: pts[0], end: pts[1] };
        return { start: { x: 0, y: start.y }, end: { x: w, y: start.y } };
    },

    drawPreview() {
        if (!this.startPoint || !this.endPoint) return;

        const extended = this.extendDiagonalToCanvas(this.startPoint);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (window.parsedShapes) renderShapeForCutting(window.parsedShapes);

        ctx.save();
        ctx.strokeStyle = this.LINE_COLOR;
        ctx.lineWidth = this.LINE_WIDTH;
        ctx.setLineDash(this.PREVIEW_DASH);
        ctx.beginPath();
        ctx.moveTo(extended.start.x, extended.start.y);
        ctx.lineTo(extended.end.x, extended.end.y);
        ctx.stroke();
        ctx.restore();
    },

    // --- Cut execution (reuses DefaultMechanic pattern) ---

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
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) return window.PracticeMode.originalShapes;
        return window.parsedShapes || [];
    },

    validateCut(shapes) {
        const tc = document.createElement('canvas'); tc.width = canvas.width; tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        const r = this.calculatePixelBasedAreas(tctx.getImageData(0, 0, tc.width, tc.height).data, tc.width, tc.height);
        return r.leftPercentage >= 0.1 && r.rightPercentage >= 0.1;
    },

    handleInvalidCut() {
        this.reset();
        if (window.showTryAgainMessage) window.showTryAgainMessage();
        if (window.redrawCanvas) window.redrawCanvas();
    },

    calculateAreas(shapes) {
        const tc = document.createElement('canvas'); tc.width = canvas.width; tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        return this.calculatePixelBasedAreas(tctx.getImageData(0, 0, tc.width, tc.height).data, tc.width, tc.height);
    },

    renderShapesForPixelAnalysis(context, shapes) {
        context.save(); context.fillStyle = '#dddddd';
        const bounds = calculateBounds(shapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        shapes.forEach(shape => drawPolygonForPixelAnalysis(context, shape, scale, offset));
        context.restore();
    },

    calculatePixelBasedAreas(pixels, width, height) {
        let leftArea = 0, rightArea = 0, total = 0;
        const ls = this.currentVector.start, le = this.currentVector.end;
        const dx = le.x - ls.x, dy = le.y - ls.y;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    total++;
                    const cross = (x - ls.x) * dy - (y - ls.y) * dx;
                    if (cross > 0) leftArea++; else if (cross < 0) rightArea++;
                }
            }
        }
        let lp = total > 0 ? (leftArea / total) * 100 : 0;
        let rp = total > 0 ? (rightArea / total) * 100 : 0;
        if (lp > rp) return { leftArea: rightArea, rightArea: leftArea, totalShapePixels: total, leftPercentage: rp, rightPercentage: lp };
        return { leftArea, rightArea, totalShapePixels: total, leftPercentage: lp, rightPercentage: rp };
    },

    renderCutResult(areaResults, shapes) {
        if (!this.currentVector || !shapes.length) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height); drawGrid();
        const tc = document.createElement('canvas'); tc.width = canvas.width; tc.height = canvas.height;
        const tctx = tc.getContext('2d');
        this.renderShapesForPixelAnalysis(tctx, shapes);
        const pixels = tctx.getImageData(0, 0, tc.width, tc.height).data;
        const dx = this.currentVector.end.x - this.currentVector.start.x;
        const dy = this.currentVector.end.y - this.currentVector.start.y;
        let gL = 0, gR = 0;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            if (pixels[idx] === 221) { const c = (x - this.currentVector.start.x) * dy - (y - this.currentVector.start.y) * dx; if (c > 0) gL++; else if (c < 0) gR++; }
        }
        const colorLeft = gL <= gR;
        const result = ctx.createImageData(canvas.width, canvas.height); const rp = result.data;
        const color = window.getDailyCutShadingColor ? window.getDailyCutShadingColor() : { r: 100, g: 150, b: 255 };
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                const c = (x - this.currentVector.start.x) * dy - (y - this.currentVector.start.y) * dx;
                if (Math.abs(c) < 1) { rp[idx] = 0; rp[idx+1] = 0; rp[idx+2] = 0; rp[idx+3] = 255; }
                else if ((c > 0 && colorLeft) || (c < 0 && !colorLeft)) { rp[idx] = color.r; rp[idx+1] = color.g; rp[idx+2] = color.b; rp[idx+3] = 255; }
                else { rp[idx] = 221; rp[idx+1] = 221; rp[idx+2] = 221; rp[idx+3] = 255; }
            } else { rp[idx] = 255; rp[idx+1] = 255; rp[idx+2] = 255; rp[idx+3] = 255; }
        }
        ctx.putImageData(result, 0, 0); drawGridLinesOnly();
        if (typeof drawShapeOutlines === 'function') drawShapeOutlines();
        ctx.save(); ctx.strokeStyle = '#000000'; ctx.lineWidth = this.FINAL_LINE_WIDTH;
        ctx.beginPath(); ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
        ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y); ctx.stroke(); ctx.restore();
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = DiagonalAscendingMechanic;
else window.DiagonalAscendingMechanic = DiagonalAscendingMechanic;
