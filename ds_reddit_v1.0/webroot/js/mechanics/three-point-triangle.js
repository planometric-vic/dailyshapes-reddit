/**
 * Three-Point Triangle Cut Mechanic
 * Click/tap to set the CENTER of an equilateral triangle.
 * Drag to expand the radius AND rotate the triangle.
 * The drag point snaps to an edge midpoint (radius = dragDistance * 2).
 * Rotation angle: atan2(dy, dx) + PI/6.
 * Release to execute the cut.
 * Pixels inside vs outside the triangle are counted using barycentric coordinates.
 */

const ThreePointTriangleMechanic = {
    name: 'Equilateral Triangle Cut',
    description: 'Click and drag to create an expanding equilateral triangle from center',

    // State
    isDrawing: false,
    centerPoint: null,
    currentPoint: null,
    radius: 0,
    rotation: 0,
    currentTriangle: null,

    // Visual
    LINE_COLOR: '#000',
    LINE_WIDTH: 2,
    PREVIEW_DASH: [5, 5],
    FINAL_LINE_WIDTH: 3,

    // Constraints
    MIN_RADIUS: 10,

    init() {
        this.reset();
        this.setupCancellationListeners();
    },

    reset() {
        this.isDrawing = false;
        this.centerPoint = null;
        this.currentPoint = null;
        this.radius = 0;
        this.rotation = 0;
        this.currentTriangle = null;
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
            window.updateInstructionText(window.getInitialInstruction('ThreePointTriangleMechanic'));
        }
    },

    showCancelFeedback() {
        const canvasEl = document.getElementById('geoCanvas');
        if (!canvasEl) return;
        const msg = document.createElement('div');
        msg.textContent = 'Triangle Canceled';
        msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'background:rgba(255,0,0,0.8);color:white;padding:8px 16px;border-radius:4px;' +
            'font-size:14px;font-weight:bold;pointer-events:none;z-index:1000;';
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
        this.currentPoint = null;
        this.radius = 0;
        this.rotation = 0;
        this.currentTriangle = null;

        if (window.updateInstructionText && window.getDynamicInstruction) {
            window.updateInstructionText(window.getDynamicInstruction('ThreePointTriangleMechanic', 'first_touch'));
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

        this.currentPoint = this.getCanvasCoordinates(event, canvasRect);

        var dx = this.currentPoint.x - this.centerPoint.x;
        var dy = this.currentPoint.y - this.centerPoint.y;
        var dragDistance = Math.sqrt(dx * dx + dy * dy);

        // Drag point snaps to an edge midpoint: radius = dragDistance * 2
        this.radius = dragDistance * 2;

        // Rotation angle: atan2(dy, dx) + PI/6
        this.rotation = Math.atan2(dy, dx) + Math.PI / 6;

        // Generate the triangle vertices
        this.currentTriangle = this.createEquilateralTriangle(this.centerPoint, this.radius, this.rotation);

        this.drawPreview();
        return true;
    },

    async handleEnd(event) {
        if (!this.isDrawing || !this.centerPoint) return false;
        this.isDrawing = false;

        if (!this.currentTriangle || this.radius < this.MIN_RADIUS) {
            if (window.showTryAgainMessage) window.showTryAgainMessage();
            this.reset();
            if (window.redrawCanvas) window.redrawCanvas();
            return false;
        }

        return await this.executeCut();
    },

    // ---- Coordinate helpers ----

    getCanvasCoordinates(event, canvasRect) {
        var clientX, clientY;
        if (event.type.startsWith('touch')) {
            clientX = event.touches[0]?.clientX || event.changedTouches[0]?.clientX;
            clientY = event.touches[0]?.clientY || event.changedTouches[0]?.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        var c = document.getElementById('geoCanvas');
        var scaleX = c.width / canvasRect.width;
        var scaleY = c.height / canvasRect.height;
        return {
            x: (clientX - canvasRect.left) * scaleX,
            y: (clientY - canvasRect.top) * scaleY
        };
    },

    // ---- Triangle geometry ----

    createEquilateralTriangle(center, radius, rotation) {
        var vertices = [];
        for (var i = 0; i < 3; i++) {
            var angle = (-Math.PI / 2) + rotation + (i * 2 * Math.PI / 3);
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

    /**
     * Point-in-triangle test using barycentric coordinates.
     * v0 = C - A, v1 = B - A, v2 = P - A
     * Dot products: dot00, dot01, dot02, dot11, dot12
     * invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
     * u = (dot11 * dot02 - dot01 * dot12) * invDenom
     * v = (dot00 * dot12 - dot01 * dot02) * invDenom
     * Inside when u >= 0, v >= 0, u + v <= 1
     */
    isPointInsideTriangle(px, py, triangle) {
        var p0 = triangle.points[0];
        var p1 = triangle.points[1];
        var p2 = triangle.points[2];

        // v0 = C - A
        var v0x = p2.x - p0.x;
        var v0y = p2.y - p0.y;
        // v1 = B - A
        var v1x = p1.x - p0.x;
        var v1y = p1.y - p0.y;
        // v2 = P - A
        var v2x = px - p0.x;
        var v2y = py - p0.y;

        // Dot products
        var dot00 = v0x * v0x + v0y * v0y;
        var dot01 = v0x * v1x + v0y * v1y;
        var dot02 = v0x * v2x + v0y * v2y;
        var dot11 = v1x * v1x + v1y * v1y;
        var dot12 = v1x * v2x + v1y * v2y;

        // Barycentric coordinates
        var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        return (u >= 0) && (v >= 0) && (u + v <= 1);
    },

    // ---- Preview ----

    drawPreview() {
        if (!this.centerPoint || !this.currentTriangle) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        if (window.parsedShapes) renderShapeForCutting(window.parsedShapes);

        var tri = this.currentTriangle.points;

        // Dashed triangle outline
        ctx.save();
        ctx.strokeStyle = this.LINE_COLOR;
        ctx.lineWidth = this.LINE_WIDTH;
        ctx.setLineDash(this.PREVIEW_DASH);
        ctx.beginPath();
        ctx.moveTo(tri[0].x, tri[0].y);
        ctx.lineTo(tri[1].x, tri[1].y);
        ctx.lineTo(tri[2].x, tri[2].y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Center dot
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.centerPoint.x, this.centerPoint.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();

        // Edge midpoint indicator (midpoint of first edge, where the drag point snaps)
        if (this.currentPoint && this.radius > 0) {
            var edgeMidX = (tri[0].x + tri[1].x) / 2;
            var edgeMidY = (tri[0].y + tri[1].y) / 2;
            ctx.save();
            ctx.fillStyle = '#666';
            ctx.beginPath();
            ctx.arc(edgeMidX, edgeMidY, 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
        }
    },

    // ---- Cut execution ----

    async executeCut() {
        if (!this.currentTriangle) return false;

        var shapesToUse = this.getShapesForAnalysis();
        if (!shapesToUse || shapesToUse.length === 0) return false;

        // Validate
        var isValid = this.validateCut(shapesToUse);
        if (!isValid) {
            this.handleInvalidCut();
            return false;
        }

        // Calculate areas
        var areaResults = this.calculateAreas(shapesToUse);

        // Render result
        this.renderCutResult(areaResults, shapesToUse);

        // Store globally for handleCutAttempt
        window.currentTriangle = this.currentTriangle;
        window.currentAreaResults = areaResults;
        window.currentVector = null;

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
        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        var tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        var imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        var result = this.calculatePixelBasedAreas(imageData.data, tempCanvas.width, tempCanvas.height);

        return result.leftPercentage >= 0.1 && result.rightPercentage >= 0.1;
    },

    handleInvalidCut() {
        this.reset();
        if (window.showTryAgainMessage) window.showTryAgainMessage();
        if (window.redrawCanvas) window.redrawCanvas();
        if (window.updateInstructionText && window.getInitialInstruction) {
            window.updateInstructionText(window.getInitialInstruction('ThreePointTriangleMechanic'));
        }
    },

    calculateAreas(shapes) {
        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        var tempCtx = tempCanvas.getContext('2d');

        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        var imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        return this.calculatePixelBasedAreas(imageData.data, tempCanvas.width, tempCanvas.height);
    },

    renderShapesForPixelAnalysis(context, shapes) {
        context.save();
        context.fillStyle = '#dddddd';
        var bounds = calculateBounds(shapes);
        var scale = calculateScale(bounds, false);
        var offset = calculateOffset(bounds, scale, false);
        shapes.forEach(function(shape) { drawPolygonForPixelAnalysis(context, shape, scale, offset); });
        context.restore();
    },

    /**
     * Count shape pixels that fall inside vs outside the triangle
     * using the barycentric coordinate point-in-triangle test.
     * Grey pixels (r=221, g=221, b=221) represent shape area.
     */
    calculatePixelBasedAreas(pixels, width, height) {
        var insideArea = 0;
        var outsideArea = 0;
        var totalShapePixels = 0;
        var triangle = this.currentTriangle;

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var idx = (y * width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    totalShapePixels++;
                    if (this.isPointInsideTriangle(x, y, triangle)) {
                        insideArea++;
                    } else {
                        outsideArea++;
                    }
                }
            }
        }

        var insidePct = totalShapePixels > 0 ? (insideArea / totalShapePixels) * 100 : 0;
        var outsidePct = totalShapePixels > 0 ? (outsideArea / totalShapePixels) * 100 : 0;

        // Normalize: smaller percentage is always leftPercentage
        if (insidePct > outsidePct) {
            return {
                leftArea: outsideArea,
                rightArea: insideArea,
                totalShapePixels: totalShapePixels,
                leftPercentage: outsidePct,
                rightPercentage: insidePct
            };
        }
        return {
            leftArea: insideArea,
            rightArea: outsideArea,
            totalShapePixels: totalShapePixels,
            leftPercentage: insidePct,
            rightPercentage: outsidePct
        };
    },

    // ---- Render cut result ----

    renderCutResult(areaResults, shapes) {
        if (!this.currentTriangle || !shapes || !shapes.length) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // Render shapes to an offscreen canvas for pixel analysis
        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        var tempCtx = tempCanvas.getContext('2d');
        this.renderShapesForPixelAnalysis(tempCtx, shapes);
        var pixels = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;

        var triangle = this.currentTriangle;

        // Determine which GEOMETRIC side (inside vs outside triangle) has fewer pixels
        var geoInside = 0;
        var geoOutside = 0;
        for (var y = 0; y < canvas.height; y++) {
            for (var x = 0; x < canvas.width; x++) {
                var idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    if (this.isPointInsideTriangle(x, y, triangle)) {
                        geoInside++;
                    } else {
                        geoOutside++;
                    }
                }
            }
        }
        var colorInsideSide = geoInside <= geoOutside;

        // Build the result image
        var result = ctx.createImageData(canvas.width, canvas.height);
        var rp = result.data;
        var color = window.getDailyCutShadingColor ? window.getDailyCutShadingColor() : { r: 100, g: 150, b: 255 };

        for (var y = 0; y < canvas.height; y++) {
            for (var x = 0; x < canvas.width; x++) {
                var idx = (y * canvas.width + x) * 4;
                if (pixels[idx] === 221 && pixels[idx + 1] === 221 && pixels[idx + 2] === 221) {
                    var inside = this.isPointInsideTriangle(x, y, triangle);

                    if ((inside && colorInsideSide) || (!inside && !colorInsideSide)) {
                        // Smaller area gets the shading color
                        rp[idx]     = color.r;
                        rp[idx + 1] = color.g;
                        rp[idx + 2] = color.b;
                        rp[idx + 3] = 255;
                    } else {
                        // Larger area stays grey
                        rp[idx]     = 221;
                        rp[idx + 1] = 221;
                        rp[idx + 2] = 221;
                        rp[idx + 3] = 255;
                    }
                } else {
                    // Background: white
                    rp[idx]     = 255;
                    rp[idx + 1] = 255;
                    rp[idx + 2] = 255;
                    rp[idx + 3] = 255;
                }
            }
        }

        ctx.putImageData(result, 0, 0);
        drawGridLinesOnly();
        if (typeof drawShapeOutlines === 'function') drawShapeOutlines();
        this.drawFinalTriangle();
    },

    drawFinalTriangle() {
        if (!this.currentTriangle || this.currentTriangle.points.length !== 3) return;
        var tri = this.currentTriangle.points;

        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = this.FINAL_LINE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(tri[0].x, tri[0].y);
        ctx.lineTo(tri[1].x, tri[1].y);
        ctx.lineTo(tri[2].x, tri[2].y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThreePointTriangleMechanic;
} else {
    window.ThreePointTriangleMechanic = ThreePointTriangleMechanic;
}
