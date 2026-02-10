// Complete Practice Mode Fix
// Properly handles grid, shape rendering, holes, and shading

class PracticeModeCompleteFix {
    constructor() {
        this.canvas = document.getElementById('geoCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    }

    /**
     * Process and render a practice cut using daily game's exact system
     */
    async processPracticeCut(start, end) {
        console.log('🎯 Processing practice cut using daily game system');
        
        // Set up the cut vector in the daily game's format
        const cutVector = this.extendVectorToCanvasBounds(start, end);
        
        // Temporarily store original states
        const originalPracticeMode = window.isPractiseMode;
        const originalGameState = window.gameState;
        const originalDemoMode = window.isDemoMode;
        const originalInteractionEnabled = window.isInteractionEnabled;
        
        console.log('🔧 Original states:', {
            isPractiseMode: originalPracticeMode,
            gameState: originalGameState,
            isDemoMode: originalDemoMode,
            isInteractionEnabled: originalInteractionEnabled
        });
        
        try {
            // Set up environment for daily game's cut processing
            window.currentVector = cutVector;
            window.gameState = 'cutting';
            // CRITICAL: Also set the local gameState variable that handleCutAttempt actually checks
            if (window.setGameState && typeof window.setGameState === 'function') {
                window.setGameState('cutting');
            }
            // CRITICAL: Enable interaction that handleCutAttempt checks
            // The setInteractionEnabled function checks a local isShapeAnimationComplete variable we can't access
            // So we need to bypass it entirely and set the interaction state directly
            window.isInteractionEnabled = true;
            // Also try to set the local variable directly if possible
            if (typeof isInteractionEnabled !== 'undefined') {
                isInteractionEnabled = true;
            }
            
            // CRITICAL: Set both window and local scope variables for demo/practice modes
            window.isPractiseMode = false;
            window.isDemoMode = false;
            // Also try to access the main.js local variables directly if possible
            if (typeof isPractiseMode !== 'undefined') {
                isPractiseMode = false;
            }
            if (typeof isDemoMode !== 'undefined') {
                isDemoMode = false;
            }
            
            console.log('🔧 Modified states for handleCutAttempt:', {
                isPractiseMode: window.isPractiseMode,
                gameState: window.gameState,
                isDemoMode: window.isDemoMode,
                isInteractionEnabled: window.isInteractionEnabled
            });
            
            // Call the daily game's handleCutAttempt function which handles all the rendering
            await window.handleCutAttempt();
            
            console.log('✅ handleCutAttempt completed successfully');
            
            // After the daily game processes the cut, extract and display results
            if (window.currentAttempts && window.currentAttempts.length > 0) {
                const lastAttempt = window.currentAttempts[window.currentAttempts.length - 1];
                this.displayPracticeResults({
                    leftPercentage: lastAttempt.leftPercentage,
                    rightPercentage: lastAttempt.rightPercentage,
                    score: 100 - Math.abs(50 - lastAttempt.leftPercentage) * 2
                });
                console.log('✅ Practice results displayed');
            }
            
        } catch (error) {
            console.error('Error in daily game cut processing:', error);
            // Fallback to our implementation
            this.fallbackProcessing(cutVector);
        } finally {
            // Always restore original states
            window.isPractiseMode = originalPracticeMode;
            window.gameState = originalGameState;
            // CRITICAL: Also restore the local gameState variable
            if (window.setGameState && typeof window.setGameState === 'function') {
                window.setGameState(originalGameState);
            }
            // CRITICAL: Restore interaction state
            // Since we bypassed setInteractionEnabled, restore directly
            window.isInteractionEnabled = originalInteractionEnabled;
            // Also restore local variable if possible
            if (typeof isInteractionEnabled !== 'undefined') {
                isInteractionEnabled = originalInteractionEnabled;
            }
            // Restore demo/practice mode states  
            window.isDemoMode = originalDemoMode;
            // Also restore local scope variables if possible
            if (typeof isPractiseMode !== 'undefined') {
                isPractiseMode = originalPracticeMode;
            }
            if (typeof isDemoMode !== 'undefined') {
                isDemoMode = originalDemoMode;
            }
            
            console.log('🔧 States restored to original values:', {
                isPractiseMode: window.isPractiseMode,
                gameState: window.gameState,
                isDemoMode: window.isDemoMode,
                isInteractionEnabled: window.isInteractionEnabled
            });
        }
        
        return null; // Results handled above
    }
    
    /**
     * Fallback processing if daily game integration fails
     */
    fallbackProcessing(cutVector) {
        const result = this.calculateAccurateCutResult(cutVector);
        this.displayPracticeResults(result);
        this.renderCompleteResult(result, cutVector);
        return result;
    }

    /**
     * Render the complete result with proper layering
     */
    renderCompleteResult(result, cutVector) {
        if (!this.ctx || !window.parsedShapes) return;
        
        console.log('🎨 Rendering complete result with proper layering');
        
        // Step 1: Clear canvas and draw grid (includes white background)
        this.drawGrid();
        
        // Step 2: Draw the base shape using main game's coordinate system
        this.drawBaseShapeWithScaling();
        
        // Step 3: Apply shading for cut areas (with proper clipping for holes)
        this.applyShadingWithScaling(cutVector);
        
        // Step 4: Draw the cut line
        this.drawCutLine(cutVector);
    }

    /**
     * Draw grid - match main game implementation
     */
    drawGrid() {
        this.ctx.save();
        
        // Fill canvas with white background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw black outline
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Grid lines (match main game - 14x14 grid)
        this.ctx.strokeStyle = '#d0d0d0';
        this.ctx.lineWidth = 0.5;
        
        const gridSize = 14;
        const cellSize = this.canvas.width / gridSize;
        
        // Vertical lines
        for (let i = 0; i <= gridSize; i++) {
            const x = i * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let i = 0; i <= gridSize; i++) {
            const y = i * cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    /**
     * Draw the base shape using main game's scaling system
     */
    drawBaseShapeWithScaling() {
        // Temporarily override gameState to ensure grid lines are drawn
        const originalGameState = window.gameState;
        window.gameState = 'playing';
        
        // Use the main game's renderShapeForCutting function if available
        if (window.renderShapeForCutting) {
            window.renderShapeForCutting(window.parsedShapes);
        } else {
            // Fallback to manual rendering
            this.ctx.save();
            this.ctx.fillStyle = '#dddddd';
            this.ctx.strokeStyle = '#000000';
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
                }
            });
            
            this.ctx.restore();
        }
        
        // Restore original gameState
        window.gameState = originalGameState;
    }

    /**
     * Apply shading with proper scaling and clipping
     */
    applyShadingWithScaling(cutVector) {
        // Create clipping path for shape boundaries (excluding holes)
        this.ctx.save();
        
        // Set up clipping path for outer shape minus holes
        window.parsedShapes.forEach(shape => {
            if (shape.outerRing) {
                // Start with outer ring
                this.ctx.beginPath();
                shape.outerRing.forEach((point, index) => {
                    if (index === 0) {
                        this.ctx.moveTo(point[0], point[1]);
                    } else {
                        this.ctx.lineTo(point[0], point[1]);
                    }
                });
                this.ctx.closePath();
                
                // Add holes as reverse winding to exclude from clip
                if (shape.holes && shape.holes.length > 0) {
                    shape.holes.forEach(hole => {
                        // Move to first point of hole
                        this.ctx.moveTo(hole[0][0], hole[0][1]);
                        // Draw hole in reverse order to create exclusion
                        for (let i = hole.length - 1; i >= 0; i--) {
                            this.ctx.lineTo(hole[i][0], hole[i][1]);
                        }
                        this.ctx.closePath();
                    });
                }
            }
        });
        
        // Apply the clipping
        this.ctx.clip('evenodd');
        
        // Draw left side shading (blue tint) within clipped area
        this.ctx.fillStyle = 'rgba(100, 149, 237, 0.4)'; // Cornflower blue
        this.ctx.beginPath();
        
        // Create left side polygon
        const leftPoints = this.createSidePolygon(cutVector, true);
        leftPoints.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fill();
        
        // Draw right side shading (grey tint) within clipped area
        this.ctx.fillStyle = 'rgba(160, 160, 160, 0.3)';
        this.ctx.beginPath();
        
        // Create right side polygon
        const rightPoints = this.createSidePolygon(cutVector, false);
        rightPoints.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore(); // Remove clipping
    }


    /**
     * Draw the cut line
     */
    drawCutLine(cutVector) {
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
     * Extend vector to canvas bounds
     */
    extendVectorToCanvasBounds(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        if (Math.abs(dx) < 0.001) {
            return {
                start: { x: start.x, y: 0 },
                end: { x: start.x, y: this.canvas.height }
            };
        }
        
        if (Math.abs(dy) < 0.001) {
            return {
                start: { x: 0, y: start.y },
                end: { x: this.canvas.width, y: start.y }
            };
        }
        
        const slope = dy / dx;
        const intercept = start.y - slope * start.x;
        const intersections = [];
        
        // Check all four edges
        const leftY = intercept;
        if (leftY >= 0 && leftY <= this.canvas.height) {
            intersections.push({ x: 0, y: leftY });
        }
        
        const rightY = slope * this.canvas.width + intercept;
        if (rightY >= 0 && rightY <= this.canvas.height) {
            intersections.push({ x: this.canvas.width, y: rightY });
        }
        
        const topX = (0 - intercept) / slope;
        if (topX >= 0 && topX <= this.canvas.width) {
            intersections.push({ x: topX, y: 0 });
        }
        
        const bottomX = (this.canvas.height - intercept) / slope;
        if (bottomX >= 0 && bottomX <= this.canvas.width) {
            intersections.push({ x: bottomX, y: this.canvas.height });
        }
        
        if (intersections.length >= 2) {
            return {
                start: intersections[0],
                end: intersections[1]
            };
        }
        
        return { start, end };
    }

    /**
     * Calculate accurate cut result
     */
    calculateAccurateCutResult(cutVector) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Render shapes as black
        tempCtx.fillStyle = '#000000';
        
        if (window.parsedShapes && window.parsedShapes.length > 0) {
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
        
        // Count pixels
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        let leftPixels = 0;
        let rightPixels = 0;
        let totalPixels = 0;
        
        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const pixelIndex = (y * tempCanvas.width + x) * 4;
                
                if (pixels[pixelIndex + 3] > 0) {
                    totalPixels++;
                    
                    if (this.isPointLeftOfLine(x, y, cutVector.start, cutVector.end)) {
                        leftPixels++;
                    } else {
                        rightPixels++;
                    }
                }
            }
        }
        
        const leftPercentage = totalPixels > 0 ? (leftPixels / totalPixels) * 100 : 50;
        const rightPercentage = totalPixels > 0 ? (rightPixels / totalPixels) * 100 : 50;

        // Calculate score with perfect split detection
        const error = Math.abs(50 - leftPercentage);
        let score;
        if (error <= 0.05) {  // Perfect split detection: if very close to 50/50, award exact 100
            score = 100.0;
        } else {
            score = 100 - error * 2;
        }
        
        return {
            leftPercentage,
            rightPercentage,
            score: Math.max(0, score),
            leftPixels,
            rightPixels,
            totalPixels
        };
    }

    /**
     * Check if point is left of line
     */
    isPointLeftOfLine(px, py, lineStart, lineEnd) {
        return ((lineEnd.x - lineStart.x) * (py - lineStart.y) - 
                (lineEnd.y - lineStart.y) * (px - lineStart.x)) > 0;
    }

    /**
     * Create polygon for one side of cut
     */
    createSidePolygon(cutVector, isLeft) {
        const points = [];
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        points.push(cutVector.start);
        points.push(cutVector.end);
        
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
        
        return this.sortPolygonPoints(points);
    }

    /**
     * Sort polygon points
     */
    sortPolygonPoints(points) {
        const centroid = points.reduce((acc, p) => ({
            x: acc.x + p.x / points.length,
            y: acc.y + p.y / points.length
        }), { x: 0, y: 0 });
        
        return points.sort((a, b) => {
            const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
            const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
            return angleA - angleB;
        });
    }

    /**
     * Display results
     */
    displayPracticeResults(results) {
        console.log('📊 Displaying practice results:', results);
        
        const percentageDisplay = document.getElementById('practicePercentageDisplay');
        if (!percentageDisplay) return;
        
        percentageDisplay.innerHTML = '';
        
        const blueColor = 'rgb(100, 150, 255)';
        const greyColor = '#999999';
        
        const splitDisplay = document.createElement('div');
        splitDisplay.className = 'split-display-large';
        splitDisplay.innerHTML = `
            <span style="color: ${blueColor}; font-weight: bold;">${results.leftPercentage.toFixed(1)}%</span>
            <span style="color: ${greyColor}; font-weight: bold; font-size: 45%; vertical-align: 25%; line-height: 1;"> / ${results.rightPercentage.toFixed(1)}%</span>
        `;
        
        percentageDisplay.appendChild(splitDisplay);
        
        const scoreDisplay = document.createElement('div');
        scoreDisplay.style.cssText = 'margin-top: 8px; font-size: 18px; font-weight: bold; color: #333;';
        scoreDisplay.textContent = `${results.score.toFixed(1)}/100`;
        percentageDisplay.appendChild(scoreDisplay);

        // Trigger confetti animation for perfect cuts in practice mode
        if (results.score >= 100) {
            console.log('🎉 Perfect cut in practice mode! Triggering confetti animation');
            if (window.triggerConfettiAnimation && typeof window.triggerConfettiAnimation === 'function') {
                window.triggerConfettiAnimation();
            } else {
                console.warn('🎉 triggerConfettiAnimation function not available');
            }
        }

        percentageDisplay.style.display = 'block';
    }
}

window.PracticeModeCompleteFix = PracticeModeCompleteFix;