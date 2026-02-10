// Fixed Practice Mode Implementation
// Properly integrates with the game's cutting mechanics and displays results correctly

class PracticeModeFix {
    constructor() {
        this.canvas = document.getElementById('geoCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.currentShapes = [];
        this.currentCutVector = null;
        this.lastCutResult = null;
    }

    /**
     * Process a cut in practice mode using the game's actual mechanics
     */
    processPracticeCut(start, end) {
        console.log('🎯 Processing practice cut');
        
        // Extend vector to canvas bounds like the main game does
        const extendedVector = this.extendVectorToCanvasBounds(start, end);
        this.currentCutVector = extendedVector;
        
        // Calculate the cut result using pixel-based method
        const result = this.calculateAccurateCutResult(extendedVector);
        
        // Store the result
        this.lastCutResult = result;
        
        // Display the percentages
        this.displayPracticeResults(result);
        
        // Render the cut with proper shading
        this.renderCutWithShading(result, extendedVector);
        
        return result;
    }

    /**
     * Extend vector to canvas bounds (matching main game logic)
     */
    extendVectorToCanvasBounds(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        // Handle vertical line
        if (Math.abs(dx) < 0.001) {
            return {
                start: { x: start.x, y: 0 },
                end: { x: start.x, y: this.canvas.height }
            };
        }
        
        // Handle horizontal line
        if (Math.abs(dy) < 0.001) {
            return {
                start: { x: 0, y: start.y },
                end: { x: this.canvas.width, y: start.y }
            };
        }
        
        // Calculate slope and intercept
        const slope = dy / dx;
        const intercept = start.y - slope * start.x;
        
        // Find intersections with canvas boundaries
        const intersections = [];
        
        // Left edge (x = 0)
        const leftY = intercept;
        if (leftY >= 0 && leftY <= this.canvas.height) {
            intersections.push({ x: 0, y: leftY });
        }
        
        // Right edge (x = canvas.width)
        const rightY = slope * this.canvas.width + intercept;
        if (rightY >= 0 && rightY <= this.canvas.height) {
            intersections.push({ x: this.canvas.width, y: rightY });
        }
        
        // Top edge (y = 0)
        const topX = (0 - intercept) / slope;
        if (topX >= 0 && topX <= this.canvas.width) {
            intersections.push({ x: topX, y: 0 });
        }
        
        // Bottom edge (y = canvas.height)
        const bottomX = (this.canvas.height - intercept) / slope;
        if (bottomX >= 0 && bottomX <= this.canvas.width) {
            intersections.push({ x: bottomX, y: this.canvas.height });
        }
        
        // Return the two intersection points
        if (intersections.length >= 2) {
            return {
                start: intersections[0],
                end: intersections[1]
            };
        }
        
        // Fallback to original points
        return { start, end };
    }

    /**
     * Calculate accurate cut result using pixel-based analysis
     */
    calculateAccurateCutResult(cutVector) {
        // Create a temporary canvas for pixel analysis
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Render the shapes as a solid color
        tempCtx.fillStyle = '#000000';
        
        if (window.parsedShapes && window.parsedShapes.length > 0) {
            // Use the main game's parsed shapes
            window.parsedShapes.forEach(shape => {
                if (shape.outerRing) {
                    tempCtx.beginPath();
                    shape.outerRing.forEach((point, index) => {
                        if (index === 0) {
                            tempCtx.moveTo(point[0], point[1]);
                        } else {
                            tempCtx.lineTo(point[0], point[1]);
                        }
                    });
                    tempCtx.closePath();
                    tempCtx.fill();
                    
                    // Cut out holes
                    if (shape.holes && shape.holes.length > 0) {
                        tempCtx.globalCompositeOperation = 'destination-out';
                        shape.holes.forEach(hole => {
                            tempCtx.beginPath();
                            hole.forEach((point, index) => {
                                if (index === 0) {
                                    tempCtx.moveTo(point[0], point[1]);
                                } else {
                                    tempCtx.lineTo(point[0], point[1]);
                                }
                            });
                            tempCtx.closePath();
                            tempCtx.fill();
                        });
                        tempCtx.globalCompositeOperation = 'source-over';
                    }
                }
            });
        }
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        // Count pixels on each side of the cut
        let leftPixels = 0;
        let rightPixels = 0;
        let totalPixels = 0;
        
        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const pixelIndex = (y * tempCanvas.width + x) * 4;
                
                // Check if pixel is part of the shape (non-transparent)
                if (pixels[pixelIndex + 3] > 0) {
                    totalPixels++;
                    
                    // Determine which side of the cut line
                    if (this.isPointLeftOfLine(x, y, cutVector.start, cutVector.end)) {
                        leftPixels++;
                    } else {
                        rightPixels++;
                    }
                }
            }
        }
        
        // Calculate percentages
        const leftPercentage = totalPixels > 0 ? (leftPixels / totalPixels) * 100 : 50;
        const rightPercentage = totalPixels > 0 ? (rightPixels / totalPixels) * 100 : 50;
        const score = 100 - Math.abs(50 - leftPercentage) * 2;
        
        return {
            leftPercentage: leftPercentage,
            rightPercentage: rightPercentage,
            score: Math.max(0, score),
            leftPixels: leftPixels,
            rightPixels: rightPixels,
            totalPixels: totalPixels
        };
    }

    /**
     * Check if a point is on the left side of a line
     */
    isPointLeftOfLine(px, py, lineStart, lineEnd) {
        // Cross product to determine side
        return ((lineEnd.x - lineStart.x) * (py - lineStart.y) - 
                (lineEnd.y - lineStart.y) * (px - lineStart.x)) > 0;
    }

    /**
     * Render the cut result with proper shading
     */
    renderCutWithShading(result, cutVector) {
        if (!this.ctx || !window.parsedShapes) return;
        
        console.log('🎨 Rendering cut with shading');
        
        // Clear canvas and redraw grid
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        if (window.drawGrid) {
            window.drawGrid();
        } else {
            // Fallback grid drawing
            this.ctx.save();
            this.ctx.strokeStyle = '#e0e0e0';
            this.ctx.lineWidth = 1;
            
            // Draw vertical lines
            for (let x = 0; x <= this.canvas.width; x += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }
            
            // Draw horizontal lines
            for (let y = 0; y <= this.canvas.height; y += 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
        
        // First, draw the original shape
        this.ctx.save();
        this.ctx.fillStyle = '#F5F5F5';
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 2;
        
        window.parsedShapes.forEach(shape => {
            if (shape.outerRing) {
                this.ctx.beginPath();
                shape.outerRing.forEach((point, index) => {
                    if (index === 0) {
                        this.ctx.moveTo(point[0], point[1]);
                    } else {
                        this.ctx.lineTo(point[0], point[1]);
                    }
                });
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                
                // Draw holes as white (voids)
                if (shape.holes && shape.holes.length > 0) {
                    this.ctx.save();
                    this.ctx.fillStyle = '#FFFFFF';
                    this.ctx.strokeStyle = '#333333';
                    this.ctx.lineWidth = 2;
                    shape.holes.forEach(hole => {
                        this.ctx.beginPath();
                        hole.forEach((point, index) => {
                            if (index === 0) {
                                this.ctx.moveTo(point[0], point[1]);
                            } else {
                                this.ctx.lineTo(point[0], point[1]);
                            }
                        });
                        this.ctx.closePath();
                        this.ctx.fill();
                        this.ctx.stroke();
                    });
                    this.ctx.restore();
                }
            }
        });
        this.ctx.restore();
        
        // Now apply the shading using clipping regions
        this.ctx.save();
        
        // Create clipping path for the shape
        window.parsedShapes.forEach(shape => {
            if (shape.outerRing) {
                this.ctx.beginPath();
                shape.outerRing.forEach((point, index) => {
                    if (index === 0) {
                        this.ctx.moveTo(point[0], point[1]);
                    } else {
                        this.ctx.lineTo(point[0], point[1]);
                    }
                });
                this.ctx.closePath();
                
                // Don't include holes in clipping path - we want to exclude them from shading
            }
        });
        this.ctx.clip();
        
        // Draw left side shading (blue tint)
        this.ctx.save();
        this.ctx.beginPath();
        
        // Create a polygon for the left side
        const leftPoly = this.createSidePolygon(cutVector, true);
        leftPoly.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        
        this.ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';  // More opaque blue
        this.ctx.fill();
        this.ctx.restore();
        
        // Draw right side shading (grey tint)
        this.ctx.save();
        this.ctx.beginPath();
        
        // Create a polygon for the right side
        const rightPoly = this.createSidePolygon(cutVector, false);
        rightPoly.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        
        this.ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';  // Slightly more opaque grey
        this.ctx.fill();
        this.ctx.restore();
        
        this.ctx.restore(); // Remove clipping
        
        // Draw the cut line on top
        this.ctx.save();
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(cutVector.start.x, cutVector.start.y);
        this.ctx.lineTo(cutVector.end.x, cutVector.end.y);
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * Create a polygon for one side of the cut
     */
    createSidePolygon(cutVector, isLeft) {
        const points = [];
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // Add cut line points
        points.push(cutVector.start);
        points.push(cutVector.end);
        
        // Determine which corners to add based on cut orientation
        const dx = cutVector.end.x - cutVector.start.x;
        const dy = cutVector.end.y - cutVector.start.y;
        
        // Add canvas corners that are on the specified side
        const corners = [
            { x: 0, y: 0 },
            { x: canvasWidth, y: 0 },
            { x: canvasWidth, y: canvasHeight },
            { x: 0, y: canvasHeight }
        ];
        
        corners.forEach(corner => {
            const onLeft = this.isPointLeftOfLine(corner.x, corner.y, cutVector.start, cutVector.end);
            if (onLeft === isLeft) {
                points.push(corner);
            }
        });
        
        // Sort points to create a proper polygon
        return this.sortPolygonPoints(points);
    }

    /**
     * Sort polygon points in order
     */
    sortPolygonPoints(points) {
        // Find centroid
        const centroid = points.reduce((acc, p) => ({
            x: acc.x + p.x / points.length,
            y: acc.y + p.y / points.length
        }), { x: 0, y: 0 });
        
        // Sort by angle from centroid
        return points.sort((a, b) => {
            const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
            const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
            return angleA - angleB;
        });
    }

    /**
     * Display practice results
     */
    displayPracticeResults(results) {
        console.log('📊 Displaying practice results:', results);
        
        const percentageDisplay = document.getElementById('practicePercentageDisplay');
        if (!percentageDisplay) return;
        
        // Clear existing content
        percentageDisplay.innerHTML = '';
        
        // Create split display matching daily game style
        const blueColor = 'rgb(100, 150, 255)';
        const greyColor = '#999999';
        
        const splitDisplay = document.createElement('div');
        splitDisplay.className = 'split-display-large';
        splitDisplay.innerHTML = `
            <span style="color: ${blueColor}; font-weight: bold;">${results.leftPercentage.toFixed(1)}%</span>
            <span style="color: ${greyColor}; font-weight: bold; font-size: 45%; vertical-align: 25%; line-height: 1;"> / ${results.rightPercentage.toFixed(1)}%</span>
        `;
        
        percentageDisplay.appendChild(splitDisplay);
        
        // Add score display
        const scoreDisplay = document.createElement('div');
        scoreDisplay.style.cssText = 'margin-top: 8px; font-size: 18px; font-weight: bold; color: #333;';
        scoreDisplay.textContent = `${results.score.toFixed(1)}/100`;
        percentageDisplay.appendChild(scoreDisplay);
        
        percentageDisplay.style.display = 'block';
    }
}

// Export for use in the main practice mode
window.PracticeModeFix = PracticeModeFix;