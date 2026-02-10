/**
 * Shape Renderer - GeoJSON parsing, canvas rendering, and geometry utilities.
 * Extracted from the original Daily Shapes main.js.
 *
 * All shapes exist in a 380x380 coordinate space.
 */

const ShapeRenderer = {
    /** Canvas internal size (always 380x380) */
    CANVAS_SIZE: 380,

    /** Grid configuration */
    GRID_SIZE: 14,
    GRID_COLOR: '#d0d0d0',
    GRID_LINE_WIDTH: 0.5,

    /** Shape rendering defaults */
    SHAPE_FILL: '#dddddd',
    SHAPE_STROKE: '#000000',
    SHAPE_STROKE_WIDTH: 2,

    /**
     * Parse GeoJSON FeatureCollection into renderable shapes.
     * @param {object} geojson - GeoJSON FeatureCollection
     * @returns {{ shapes: Array, useDirectCoordinates: boolean }}
     */
    parseGeometry(geojson) {
        const shapes = [];

        if (!geojson || !geojson.features) {
            console.error('Invalid GeoJSON: missing features');
            return { shapes: [], useDirectCoordinates: false };
        }

        for (const feature of geojson.features) {
            if (!feature.geometry) continue;

            const geomType = feature.geometry.type;
            const coords = feature.geometry.coordinates;

            // Skip Point features (corner references, rotation centers)
            if (geomType === 'Point') continue;

            if (geomType === 'Polygon') {
                const outerRing = coords[0] || [];
                const holes = coords.slice(1) || [];
                shapes.push({
                    type: 'polygon',
                    coordinates: coords,
                    outerRing: outerRing,
                    holes: holes
                });
            } else if (geomType === 'MultiPolygon') {
                for (const polygon of coords) {
                    const outerRing = polygon[0] || [];
                    const holes = polygon.slice(1) || [];
                    shapes.push({
                        type: 'polygon',
                        coordinates: polygon,
                        outerRing: outerRing,
                        holes: holes
                    });
                }
            }
        }

        return { shapes, useDirectCoordinates: false };
    },

    /**
     * Calculate bounding box of shapes.
     * @param {Array} shapes - Parsed shapes
     * @returns {{ minX, minY, maxX, maxY }}
     */
    calculateBounds(shapes) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const shape of shapes) {
            if (!shape.outerRing) continue;
            for (const coord of shape.outerRing) {
                const x = coord[0], y = coord[1];
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        return { minX, minY, maxX, maxY };
    },

    /**
     * Calculate scale factor for shapes (identity for 380x380 pre-positioned shapes).
     */
    calculateScale(_bounds, _useDirectCoords) {
        return 1.0;
    },

    /**
     * Calculate offset for shapes (identity for 380x380 pre-positioned shapes).
     */
    calculateOffset(_bounds, _scale, _useDirectCoords) {
        return { x: 0, y: 0 };
    },

    /**
     * Draw the background grid on the canvas.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} canvasSize
     */
    drawGrid(ctx, canvasSize) {
        const cellSize = canvasSize / this.GRID_SIZE;

        ctx.save();
        ctx.strokeStyle = this.GRID_COLOR;
        ctx.lineWidth = this.GRID_LINE_WIDTH;

        for (let i = 0; i <= this.GRID_SIZE; i++) {
            const pos = i * cellSize;

            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, canvasSize);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(canvasSize, pos);
            ctx.stroke();
        }

        ctx.restore();
    },

    /**
     * Draw grid lines only (over existing content, no background clear).
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} canvasSize
     */
    drawGridLinesOnly(ctx, canvasSize) {
        this.drawGrid(ctx, canvasSize);
    },

    /**
     * Render a shape for cutting (grey fill, black outline).
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} shapes - Parsed shapes to render
     */
    renderShapeForCutting(ctx, shapes) {
        if (!shapes || shapes.length === 0) return;

        const scale = 1.0;
        const offset = { x: 0, y: 0 };
        const logicalHeight = this.CANVAS_SIZE;

        ctx.save();

        for (const shape of shapes) {
            if (!shape.outerRing || shape.outerRing.length === 0) continue;

            ctx.fillStyle = this.SHAPE_FILL;
            ctx.strokeStyle = this.SHAPE_STROKE;
            ctx.lineWidth = this.SHAPE_STROKE_WIDTH;

            ctx.beginPath();

            // Draw outer ring (with Y-axis flip for screen coordinates)
            const outerRing = shape.outerRing;
            const startX = outerRing[0][0] * scale + offset.x;
            const startY = logicalHeight - (outerRing[0][1] * scale + offset.y);
            ctx.moveTo(startX, startY);

            for (let i = 1; i < outerRing.length; i++) {
                const x = outerRing[i][0] * scale + offset.x;
                const y = logicalHeight - (outerRing[i][1] * scale + offset.y);
                ctx.lineTo(x, y);
            }
            ctx.closePath();

            // Draw holes (if any)
            if (shape.holes && shape.holes.length > 0) {
                for (const hole of shape.holes) {
                    if (hole.length === 0) continue;
                    const hStartX = hole[0][0] * scale + offset.x;
                    const hStartY = logicalHeight - (hole[0][1] * scale + offset.y);
                    ctx.moveTo(hStartX, hStartY);

                    for (let i = 1; i < hole.length; i++) {
                        const x = hole[i][0] * scale + offset.x;
                        const y = logicalHeight - (hole[i][1] * scale + offset.y);
                        ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                }
            }

            // Fill with evenodd rule (handles holes correctly)
            ctx.fill('evenodd');
            ctx.stroke();
        }

        ctx.restore();
    },

    /**
     * Render shapes for pixel-based area analysis (flat grey fill, no stroke).
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} shapes
     */
    drawPolygonForPixelAnalysis(ctx, shape, scale, offset) {
        if (!shape.outerRing || shape.outerRing.length === 0) return;

        const logicalHeight = this.CANVAS_SIZE;

        ctx.beginPath();

        // Outer ring
        const outerRing = shape.outerRing;
        ctx.moveTo(
            outerRing[0][0] * scale + offset.x,
            logicalHeight - (outerRing[0][1] * scale + offset.y)
        );
        for (let i = 1; i < outerRing.length; i++) {
            ctx.lineTo(
                outerRing[i][0] * scale + offset.x,
                logicalHeight - (outerRing[i][1] * scale + offset.y)
            );
        }
        ctx.closePath();

        // Holes
        if (shape.holes) {
            for (const hole of shape.holes) {
                if (hole.length === 0) continue;
                ctx.moveTo(
                    hole[0][0] * scale + offset.x,
                    logicalHeight - (hole[0][1] * scale + offset.y)
                );
                for (let i = 1; i < hole.length; i++) {
                    ctx.lineTo(
                        hole[i][0] * scale + offset.x,
                        logicalHeight - (hole[i][1] * scale + offset.y)
                    );
                }
                ctx.closePath();
            }
        }

        ctx.fill('evenodd');
    },

    /**
     * Draw shape outlines on top of cut result.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} shapes
     */
    drawShapeOutlines(ctx, shapes) {
        if (!shapes || shapes.length === 0) return;

        const logicalHeight = this.CANVAS_SIZE;

        ctx.save();
        ctx.strokeStyle = this.SHAPE_STROKE;
        ctx.lineWidth = this.SHAPE_STROKE_WIDTH;

        for (const shape of shapes) {
            if (!shape.outerRing || shape.outerRing.length === 0) continue;

            ctx.beginPath();
            const ring = shape.outerRing;
            ctx.moveTo(ring[0][0], logicalHeight - ring[0][1]);
            for (let i = 1; i < ring.length; i++) {
                ctx.lineTo(ring[i][0], logicalHeight - ring[i][1]);
            }
            ctx.closePath();
            ctx.stroke();

            // Draw hole outlines
            if (shape.holes) {
                for (const hole of shape.holes) {
                    if (hole.length === 0) continue;
                    ctx.beginPath();
                    ctx.moveTo(hole[0][0], logicalHeight - hole[0][1]);
                    for (let i = 1; i < hole.length; i++) {
                        ctx.lineTo(hole[i][0], logicalHeight - hole[i][1]);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    }
};

// Expose globally for mechanics compatibility
window.ShapeRenderer = ShapeRenderer;

// Global function aliases used by mechanics
window.calculateBounds = (shapes) => ShapeRenderer.calculateBounds(shapes);
window.calculateScale = (bounds, useDirectCoords) => ShapeRenderer.calculateScale(bounds, useDirectCoords);
window.calculateOffset = (bounds, scale, useDirectCoords) => ShapeRenderer.calculateOffset(bounds, scale, useDirectCoords);
window.drawPolygonForPixelAnalysis = (ctx, shape, scale, offset) => ShapeRenderer.drawPolygonForPixelAnalysis(ctx, shape, scale, offset);
window.parseGeometry = (geojson) => ShapeRenderer.parseGeometry(geojson);
