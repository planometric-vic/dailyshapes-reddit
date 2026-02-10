/**
 * Circle Cut Mechanic
 * Click/tap to set the center of a circle, drag to expand the radius, release to cut.
 * Pixel-based analysis determines which pixels fall inside vs outside the circle.
 * The smaller area gets colored, the larger stays grey.
 */

const CircleCutMechanic = {
    name: 'Circle Cut',
    description: 'Click to set center, drag to expand radius, release to cut',

    // State
    isDrawing: false,
    centerPoint: null,
    radius: 0,
    currentCircle: null,
    MIN_RADIUS: 5,

    // Visual
    CIRCLE_COLOR: '#000',
    CIRCLE_WIDTH: 2,
    PREVIEW_DASH: [5, 5],
    FINAL_CIRCLE_WIDTH: 3,
    CENTER_DOT_RADIUS: 3,

    // ---- Lifecycle ----

    init() {
        this.reset();
        this.setupCancellationListeners();
    },

    reset() {
        this.isDrawing = false;
        this.centerPoint = null;
        this.radius = 0;
        this.currentCircle = null;
    },

    setupCancellationListeners() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;

        canvasEl.addEventListener('contextmenu', () => {
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
            window.updateInstructionText(window.getInitialInstruction('CircleCutMechanic'));
        }
    },

    showCancelFeedback() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;
        const msg = document.createElement('div');
        msg.textContent = 'Circle Canceled';
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

        this.centerPoint = this.getCanvasCoordinates(event, canvasRect);
        this.isDrawing = true;
        this.radius = 0;
        this.currentCircle = null;

        if (window.updateInstructionText && window.getDynamicInstruction) {
            window.updateInstructionText(window.getDynamicInstruction('CircleCutMechanic', 'first_touch'));
        }
        return true;
    },

    handleMove(event, canvasRect) {
        if (!this.isDrawing || !this.centerPoint) return false;
        if (!window.isInteractionEnabled || window.gameState !== 'cutting') return false;

        if (event.touches && event.touches.length > 1) {
            this.cancelDraw();
            return true;
        }

        const currentPoint = this.getCanvasCoordinates(event, canvasRect);

        // Calculate radius as distance from center to current drag point
        const dx = currentPoint.x - this.centerPoint.x;
        const dy = currentPoint.y - this.centerPoint.y;
        this.radius = Math.sqrt(dx * dx + dy * dy);

        this.currentCircle = {
            center: this.centerPoint,
            radius: this.radius
        };

        this.drawPreview();
        return true;
    },

    async handleEnd(event) {
        if (!this.isDrawing || !this.centerPoint) return false;
        this.isDrawing = false;

        if (this.radius < this.MIN_RADIUS) {
            if (window.showTryAgainMessage) window.showTryAgainMessage();
            this.reset();
            if (window.redrawCanvas) window.redrawCanvas();
            return false;
        }

        this.currentCircle = {
            center: this.centerPoint,
            radius: this.radius
        };

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

    // ---- Preview ----

    drawPreview() {
        if (!this.currentCircle) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (window.parsedShapes) renderShapeForCutting(window.parsedShapes);

        ctx.save();
        ctx.strokeStyle = this.CIRCLE_COLOR;
        ctx.lineWidth = this.CIRCLE_WIDTH;
        ctx.setLineDash(this.PREVIEW_DASH);

        // Dashed circle preview
        ctx.beginPath();
        ctx.arc(
            this.currentCircle.center.x,
            this.currentCircle.center.y,
            this.currentCircle.radius,
            0,
            2 * Math.PI
        );
        ctx.stroke();

        // Solid center dot
        ctx.setLineDash([]);
        ctx.fillStyle = this.CIRCLE_COLOR;
        ctx.beginPath();
        ctx.arc(
            this.currentCircle.center.x,
            this.currentCircle.center.y,
            this.CENTER_DOT_RADIUS,
            0,
            2 * Math.PI
        );
        ctx.fill();

        ctx.restore();
    },

    // ---- Cut execution ----

    async executeCut() {
        if (!this.currentCircle) return false;

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
        window.currentCircle = this.currentCircle;
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
            window.updateInstructionText(window.getInitialInstruction('CircleCutMechanic'));
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

    /**
     * Pixel-based area calculation for circle cut.
     * For each grey (#ddd) shape pixel, check if its distance from the circle center
     * is less than or equal to the radius (inside) or greater (outside).
     * The smaller percentage is normalized to "left" for consistent scoring.
     */
    calculatePixelBasedAreas(pixels, width, height) {
        let insideArea = 0;
        let outsideArea = 0;
        let totalShapePixels = 0;

        const centerX = this.currentCircle.center.x;
        const centerY = this.currentCircle.center.y;
        const radiusSquared = this.currentCircle.radius * this.currentCircle.radius;

        for (let y = 0; y < height; y++) {
            const dy = y - centerY;
            const dySquared = dy * dy;

            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    totalShapePixels++;

                    const dx = x - centerX;
                    const distanceSquared = dx * dx + dySquared;

                    if (distanceSquared <= radiusSquared) {
                        insideArea++;
                    } else {
                        outsideArea++;
                    }
                }
            }
        }

        const insidePct = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        const outsidePct = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;

        // Normalize: smaller percentage is always "left"
        if (insidePct > outsidePct) {
            return {
                leftArea: outsideArea,
                rightArea: insideArea,
                totalShapePixels,
                leftPercentage: outsidePct,
                rightPercentage: insidePct
            };
        }
        return {
            leftArea: insideArea,
            rightArea: outsideArea,
            totalShapePixels,
            leftPercentage: insidePct,
            rightPercentage: outsidePct
        };
    },

    // ---- Render cut result ----

    renderCutResult(areaResults, shapes) {
        if (!this.currentCircle || !shapes.length) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        // Determine which geometric side (inside vs outside) is smaller
        const centerX = this.currentCircle.center.x;
        const centerY = this.currentCircle.center.y;
        const radiusSquared = this.currentCircle.radius * this.currentCircle.radius;

        let geoInside = 0;
        let geoOutside = 0;
        for (let y = 0; y < canvas.height; y++) {
            const dy = y - centerY;
            const dySquared = dy * dy;
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221) {
                    const dx = x - centerX;
                    if (dx * dx + dySquared <= radiusSquared) {
                        geoInside++;
                    } else {
                        geoOutside++;
                    }
                }
            }
        }
        const colorInsideSide = geoInside <= geoOutside;

        // Build the result image
        const result = ctx.createImageData(canvas.width, canvas.height);
        const rp = result.data;
        const color = window.getDailyCutShadingColor
            ? window.getDailyCutShadingColor()
            : { r: 100, g: 150, b: 255 };

        // Pre-compute boundary thresholds for a 1px-wide circle edge
        const innerRadiusSq = (this.currentCircle.radius - 1) * (this.currentCircle.radius - 1);
        const outerRadiusSq = (this.currentCircle.radius + 1) * (this.currentCircle.radius + 1);

        for (let y = 0; y < canvas.height; y++) {
            const dy = y - centerY;
            const dySquared = dy * dy;

            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;

                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    const dx = x - centerX;
                    const distSq = dx * dx + dySquared;

                    const isInside = distSq < innerRadiusSq;
                    const isOutside = distSq > outerRadiusSq;

                    if (!isInside && !isOutside) {
                        // On circle boundary -- draw black
                        rp[idx] = 0; rp[idx + 1] = 0; rp[idx + 2] = 0; rp[idx + 3] = 255;
                    } else if ((isInside && colorInsideSide) || (isOutside && !colorInsideSide)) {
                        // Smaller area -- color it
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
        this.drawFinalCircle();
    },

    drawFinalCircle() {
        if (!this.currentCircle) return;
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = this.FINAL_CIRCLE_WIDTH;
        ctx.beginPath();
        ctx.arc(
            this.currentCircle.center.x,
            this.currentCircle.center.y,
            this.currentCircle.radius,
            0,
            2 * Math.PI
        );
        ctx.stroke();
        ctx.restore();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CircleCutMechanic;
} else {
    window.CircleCutMechanic = CircleCutMechanic;
}
