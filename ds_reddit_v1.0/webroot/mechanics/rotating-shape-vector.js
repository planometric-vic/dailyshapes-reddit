// Rotating Shape Vector Cut Mechanic
// Two-point vector cutting mechanic combined with continuously rotating shapes
// Only works with shapes prefixed with "r-" that contain rotation center reference points

console.log('🔧 Rotating Shape Vector Cut mechanic file loaded');

const RotatingShapeVectorMechanic = {
    name: "Rotating Shape Vector Cut",
    description: "Default cutting with undo functionality and continuously rotating shapes (r-shape# only)",
    
    // Mechanic state (using default-with-undo pattern)
    isDrawingVector: false,
    vectorStart: null,
    vectorEnd: null,
    currentVector: null,
    vectorCutActive: false,
    dragDistance: 0,
    
    // Rotation state
    rotationCenter: null, // {x, y} center point for rotation
    rotationAngle: 0, // Current rotation angle in radians
    rotationSpeed: (2 * Math.PI) / 12000, // 1 revolution per 12 seconds (radians per millisecond)
    animationId: null,
    lastFrameTime: 0,
    isRotating: false,
    rotationPausedForDemo: false, // Flag to prevent auto-restart during demo flow
    
    // Original shape data (before rotation)
    originalShapes: null,
    
    // Visual constants
    LINE_COLOR: '#000',
    LINE_WIDTH: 2,
    
    // Initialize the mechanic
    init() {
        console.log('🔧 Initializing Rotating Shape Vector Cut mechanic');
        console.log('🔧 parsedShapes available:', !!parsedShapes, parsedShapes?.length);
        this.reset();
        this.setupDesktopUndoListeners();
        
        // Check if current shapes are compatible
        if (!this.isCompatibleWithCurrentShapes()) {
            console.warn('⚠️ Current shapes are not compatible with rotating mechanic - but proceeding anyway');
        }
        
        // Clear any demo pause flag from previous shapes
        this.rotationPausedForDemo = false;

        // Find rotation center and start rotation (unless restoring game state)
        if (window.isRestoringGameState) {
            console.log('🔧 Skipping setupRotation() - waiting for canvas restoration to complete');
            // Just store the original shapes without starting rotation
            // Check both local parsedShapes and window.parsedShapes
            const shapesToStore = parsedShapes || window.parsedShapes;
            if (shapesToStore && shapesToStore.length > 0) {
                this.originalShapes = JSON.parse(JSON.stringify(shapesToStore));
                this.rotationCenter = { x: 190, y: 190 };
                console.log('🔄 Stored original shapes and rotation center for later restoration');
            } else {
                console.log('⚠️ No shapes available to store during restoration');
            }
        } else {
            console.log('🔧 About to call setupRotation()');
            this.setupRotation();
            console.log('🔧 Called setupRotation(), isRotating:', this.isRotating);
        }
    },
    
    // Reset mechanic state
    reset() {
        this.isDrawingVector = false;
        this.vectorStart = null;
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;

        // Stop rotation and clear pause flag
        this.stopRotation();
        this.rotationAngle = 0;
        this.rotationCenter = null;
        this.originalShapes = null;
        this.rotationPausedForDemo = false;

        // Clear instruction tracking
        this.lastInstruction = null;

        // Clear watchdog
        if (this.rotationWatchdog) {
            clearInterval(this.rotationWatchdog);
            this.rotationWatchdog = null;
        }
    },
    
    // Reset only the drawing state, keeping rotation intact
    resetDrawingState() {
        this.isDrawingVector = false;
        this.vectorStart = null;
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;
    },
    
    // Setup right-click listener for desktop undo functionality
    setupDesktopUndoListeners() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        // Right-click listener for desktop (context menu prevention is handled globally)
        canvas.addEventListener('contextmenu', (event) => {
            if (this.isDrawingVector) {
                console.log('🔄 Right-click detected - canceling line draw');
                this.cancelLineDraw();
            }
        });
    },
    
    // Cancel the current line drawing and return to ready state
    cancelLineDraw() {
        console.log('🚫 Canceling line draw');
        
        // Reset only drawing state, keep rotation running
        this.resetDrawingState();
        
        // Ensure rotation is running - only restart if actually stopped
        if (!this.isRotating) {
            if (!this.rotationCenter || !this.originalShapes) {
                console.warn('⚠️ Missing rotation data during cancel, reinitializing...');
                this.setupRotation();
                return; // setupRotation() will handle starting rotation
            }
            
            console.log('🔄 Rotation was stopped, restarting after cancel');
            this.startRotation();
        } else {
            console.log('🔄 Rotation is running, continuing normally');
        }
        
        // Canvas will be redrawn by animation loop or draw manually if not rotating
        if (!this.isRotating) {
            this.drawCurrentState();
        }
        
        // Show brief feedback message
        this.showCancelFeedback();
    },
    
    // Show brief visual feedback that the line was canceled
    showCancelFeedback() {
        // Create a temporary message
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        const message = document.createElement('div');
        message.textContent = 'Line Canceled';
        message.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            animation: fadeInOut 1s ease-in-out;
        `;
        
        // Add CSS animation if not already present
        if (!document.getElementById('cancelFeedbackStyles')) {
            const style = document.createElement('style');
            style.id = 'cancelFeedbackStyles';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    30% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    70% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Position relative to canvas
        const canvasRect = canvas.getBoundingClientRect();
        message.style.position = 'fixed';
        message.style.top = (canvasRect.top + canvasRect.height / 2) + 'px';
        message.style.left = (canvasRect.left + canvasRect.width / 2) + 'px';
        
        document.body.appendChild(message);
        
        // Remove after animation
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 1000);
    },
    
    // Check if current shapes are compatible (r-shape# naming and have rotation center)
    isCompatibleWithCurrentShapes() {
        // Prioritize practice mode shapes if available
        let shapesToCheck = parsedShapes;
        if (window.isPracticeMode && window.PracticeMode && window.PracticeMode.originalShapes) {
            shapesToCheck = window.PracticeMode.originalShapes;
            console.log('🔍 Checking practice mode shapes for compatibility');
        }

        if (!shapesToCheck || shapesToCheck.length === 0) {
            console.log('🔍 No shapes loaded');
            return false;
        }
        
        // In demo mode, we're on day 7 (Sunday) if this mechanic is loaded
        // Day 7 shapes should have rotation centers
        console.log('🔍 Checking for rotation center in day 7 shapes');
        
        // FIXED: Skip broken findRotationCenter check - we calculate from bounds in setupRotation instead
        console.log('🔧 ROTATION FIX: Skipping GeoJSON rotation center check - will calculate from actual shape bounds');
        // const hasRotationCenter = this.findRotationCenter();
        // if (!hasRotationCenter) {
        //     console.log('🔍 No rotation center found in shape data - treating as regular shape');
        //     // For demo, we'll allow it to work without rotation if no center found
        //     return true;  // Allow mechanic to work even without rotation center
        // }
        
        console.log('✅ Shapes are compatible with rotating mechanic');
        return true;
    },
    
    // Find rotation center in shape data
    findRotationCenter() {
        // Try different global variables where raw GeoJSON might be stored
        const possibleSources = [
            window.rawGeoJSON,
            window.currentGeoJSON,
            currentGeoJSON, // Try without window prefix
            globalThis.currentGeoJSON
        ];
        
        for (const source of possibleSources) {
            if (source && source.features) {
                console.log('🔍 Checking source with', source.features.length, 'features');
                for (const feature of source.features) {
                    if (feature.properties && 
                        feature.properties.type === 'reference' && 
                        feature.properties.corner === 'rotation-center') {
                        
                        // Extract coordinates from the reference point
                        if (feature.geometry && feature.geometry.coordinates) {
                            const coords = feature.geometry.coordinates;
                            this.rotationCenter = {
                                x: coords[0],
                                y: coords[1]
                            };
                            console.log('🎯 Found rotation center at:', this.rotationCenter);
                            return true;
                        }
                    }
                }
            }
        }
        
        // Fallback: check parsedShapes in case the structure is different
        if (parsedShapes) {
            for (const shape of parsedShapes) {
                if (shape.properties && 
                    shape.properties.type === 'reference' && 
                    shape.properties.corner === 'rotation-center') {
                    
                    // Extract coordinates from the reference point
                    if (shape.geometry && shape.geometry.coordinates) {
                        const coords = shape.geometry.coordinates;
                        this.rotationCenter = {
                            x: coords[0],
                            y: coords[1]
                        };
                        console.log('🎯 Found rotation center at:', this.rotationCenter);
                        return true;
                    }
                }
            }
        }
        
        console.log('🔍 Checked rawGeoJSON features:', window.rawGeoJSON?.features?.length || 'not available');
        console.log('🔍 Checked parsedShapes:', parsedShapes?.length || 'not available');
        
        // Debug: Log what we actually have
        if (window.rawGeoJSON?.features) {
            console.log('🔍 Available features in rawGeoJSON:');
            window.rawGeoJSON.features.forEach((feature, i) => {
                console.log(`  Feature ${i}:`, feature.properties, feature.geometry?.coordinates);
            });
        }
        
        return false;
    },
    
    // Setup rotation animation
    setupRotation() {
        // Set rotation center to 190,190 as per GeoJSON reference coordinates (user requirement)
        this.rotationCenter = {
            x: 190,
            y: 190
        };
        console.log('🎯 Using fixed rotation center as per user requirement:', this.rotationCenter);
        
        // Legacy code for reference (now overridden by fixed center)
        // First try to find GeoJSON reference points as per user requirement
        console.log('🔧 ROTATION SETUP: Looking for GeoJSON reference coordinates first');
        
        if (this.findRotationCenter()) {
            console.log('🔧 Found GeoJSON reference, but overriding with fixed center 190,190');
            // Override with fixed center
            this.rotationCenter = {
                x: 190,
                y: 190
            };
        } else {
            console.log('🔧 No GeoJSON reference found - using fixed center 190,190');
        }
        
        // Legacy fallback code (no longer needed with fixed center)
        if (false && !this.rotationCenter && parsedShapes && parsedShapes.length > 0) {
            // Calculate bounding box center
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            console.log('🔍 DEBUG: parsedShapes structure:', parsedShapes);
            for (let i = 0; i < parsedShapes.length; i++) {
                const shape = parsedShapes[i];
                console.log(`🔍 DEBUG: shape ${i}:`, shape);
                
                // Try different ways to access the points
                let points = null;
                if (shape.points && Array.isArray(shape.points)) {
                    points = shape.points;
                } else if (shape.outerRing && Array.isArray(shape.outerRing)) {
                    // For parsed shapes with outerRing structure
                    points = shape.outerRing;
                } else if (Array.isArray(shape)) {
                    points = shape;
                } else if (shape.coordinates && Array.isArray(shape.coordinates)) {
                    // Handle coordinates array - if it's nested, use the first array
                    if (shape.coordinates.length > 0 && Array.isArray(shape.coordinates[0])) {
                        points = shape.coordinates[0]; // Use outer ring
                    } else {
                        points = shape.coordinates;
                    }
                }
                
                console.log(`🔍 DEBUG: extracted points for shape ${i}:`, points);
                
                if (points && Array.isArray(points)) {
                    // Check if points is a nested array (like from coordinates or outerRing)
                    // outerRing gives us Array(522) where each element is [x, y]
                    if (points.length > 0 && Array.isArray(points[0])) {
                        // It's an array of coordinate pairs
                        for (let j = 0; j < points.length; j++) {
                            const point = points[j];
                            if (Array.isArray(point) && point.length >= 2) {
                                const x = point[0];
                                const y = point[1];
                                if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
                                    minX = Math.min(minX, x);
                                    minY = Math.min(minY, y);
                                    maxX = Math.max(maxX, x);
                                    maxY = Math.max(maxY, y);
                                }
                            }
                        }
                    } else {
                        // It's a direct array of points or nested structure
                        for (let j = 0; j < points.length; j++) {
                            const point = points[j];
                            let x, y;
                            
                            if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
                                x = point.x;
                                y = point.y;
                            } else if (Array.isArray(point) && point.length >= 2) {
                                x = point[0];
                                y = point[1];
                            } else {
                                console.warn(`🔍 DEBUG: Unrecognized point format at ${i}-${j}:`, point);
                                continue;
                            }
                            
                            if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
                                minX = Math.min(minX, x);
                                minY = Math.min(minY, y);
                                maxX = Math.max(maxX, x);
                                maxY = Math.max(maxY, y);
                            }
                        }
                    }
                }
            }
            this.rotationCenter = {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            };
            console.log('📍 Calculated rotation center:', this.rotationCenter);
        } else if (!this.rotationCenter) {
            console.error('❌ Cannot setup rotation - no shapes available');
            return;
        }
        
        // Store original shapes for rotation calculations
        if (parsedShapes && parsedShapes.length > 0) {
            this.originalShapes = JSON.parse(JSON.stringify(parsedShapes));
            console.log('🔄 Stored original shapes:', this.originalShapes.length);
        } else {
            console.log('🔄 No shapes available yet, will initialize when shapes are loaded');
            this.originalShapes = [];
        }
        console.log('🔄 Rotation center:', this.rotationCenter);

        // Start rotation animation only if we have shapes
        if (this.originalShapes.length > 0) {
            this.startRotation();
        } else {
            console.log('🔄 Deferring rotation start until shapes are available');
        }
        
        // Initial draw
        this.drawCurrentState();
        
        // Set initial instruction text using centralized system
        if (window.updateInstructionText && window.getInitialInstruction) {
            const initialInstruction = window.getInitialInstruction('RotatingShapeVectorMechanic');
            window.updateInstructionText(initialInstruction);
        }
        
        // Set up watchdog to ensure rotation never stops
        this.setupRotationWatchdog();

        // Save rotation state for refresh protection
        if (window.SimpleRefresh && window.SimpleRefresh.save) {
            window.SimpleRefresh.save();
        }

        console.log('🔄 Rotation animation started');
    },
    
    // Setup watchdog to ensure rotation never stops
    setupRotationWatchdog() {
        // Check every 2 seconds if rotation is still running (reduced logging)
        this.rotationWatchdog = setInterval(() => {
            // CRITICAL: Block all rotation activity during practice mode
            if (window.isPracticeMode || (window.practiceMode && window.practiceMode.isActive)) {
                // Silently return - no need to log every 2 seconds
                return;
            }

            if (this.rotationPausedForDemo) {
                // Silently return - no need to log every 2 seconds
                return;
            }

            // Check if shapes are available but not stored
            const availableShapes = parsedShapes || window.parsedShapes;
            if (availableShapes && availableShapes.length > 0) {
                // If we don't have originalShapes stored, store them now
                if (!this.originalShapes || this.originalShapes.length === 0) {
                    console.log('🔍 WATCHDOG: Found shapes, storing as originalShapes');
                    this.originalShapes = JSON.parse(JSON.stringify(availableShapes));
                }

                // If we don't have rotation center, set it
                if (!this.rotationCenter) {
                    console.log('🔍 WATCHDOG: Setting rotation center');
                    this.rotationCenter = { x: 190, y: 190 };
                }

                // If rotation should be active but isn't, restart it
                if (this.rotationCenter && this.originalShapes && this.originalShapes.length > 0 && !this.isRotating) {
                    console.warn('⚠️ WATCHDOG: Rotation stopped unexpectedly, restarting...');
                    this.startRotation();
                }
            }
        }, 2000);
    },

    // CRITICAL: Clean up all rotation state when entering practice mode
    enterPracticeMode() {
        console.log('🔄 ROTATING MECHANIC: Entering practice mode - stopping all rotation');

        // Store current state for restoration
        this.savedDailyState = {
            isRotating: this.isRotating,
            rotationAngle: this.rotationAngle,
            rotationCenter: this.rotationCenter,
            originalShapes: this.originalShapes ? JSON.parse(JSON.stringify(this.originalShapes)) : null,
            rotationPausedForDemo: this.rotationPausedForDemo
        };
        console.log('💾 ROTATING MECHANIC: Saved daily state for restoration');

        // Stop rotation completely
        this.stopRotation();

        // Clear watchdog
        if (this.rotationWatchdog) {
            clearInterval(this.rotationWatchdog);
            this.rotationWatchdog = null;
        }

        // CRITICAL: Reset canvas context to ensure practice mode drawing works properly
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            // Clear any canvas state that might interfere with practice mode
            ctx.setLineDash([]); // Clear any line dash patterns
            ctx.strokeStyle = '#000000'; // Reset stroke color
            ctx.lineWidth = 2; // Reset to standard line width
            ctx.globalAlpha = 1; // Reset transparency
            console.log('🎨 ROTATING MECHANIC: Canvas context reset for practice mode');
        }

        // Reset rotation state but keep center for potential restoration
        this.isRotating = false;
        this.rotationPausedForDemo = true; // Prevent restart
        this.originalShapes = null; // Don't interfere with practice mode shapes

        console.log('🔄 ROTATING MECHANIC: Practice mode entry complete - rotation stopped');
    },

    // CRITICAL: Restore rotation state when returning to daily mode
    exitPracticeMode() {
        console.log('🔄 ROTATING MECHANIC: Exiting practice mode - restoring daily state');

        if (this.savedDailyState) {
            // Store the rotation flag before clearing
            const wasRotating = this.savedDailyState.isRotating;

            // Restore saved state
            this.rotationAngle = this.savedDailyState.rotationAngle || 0;
            this.rotationCenter = this.savedDailyState.rotationCenter;
            this.originalShapes = this.savedDailyState.originalShapes;
            this.rotationPausedForDemo = this.savedDailyState.rotationPausedForDemo;

            console.log('🔄 ROTATING MECHANIC: Daily state restored');

            // Clear saved state
            this.savedDailyState = null;

            // Restart rotation if it was previously running
            if (wasRotating && this.rotationCenter && this.originalShapes) {
                console.log('🔄 ROTATING MECHANIC: Restarting rotation after practice mode exit');
                this.startRotation();
            }
        } else {
            console.log('🔄 ROTATING MECHANIC: No saved daily state - setting up fresh rotation');
            // No saved state - reinitialize if we're on day 7
            if (window.currentDay === 7 && parsedShapes && parsedShapes.length > 0) {
                this.setupRotation();
            }
        }

        // Restart watchdog
        this.setupRotationWatchdog();

        console.log('🔄 ROTATING MECHANIC: Practice mode exit complete');
    },

    // CRITICAL: Initialize rotation when shapes become available
    initializeWithShapes() {
        console.log('🔄 ROTATING MECHANIC: Initializing with newly loaded shapes');

        if (!parsedShapes || parsedShapes.length === 0) {
            console.log('🔄 ROTATING MECHANIC: Still no shapes available');
            return false;
        }

        // Store original shapes for rotation calculations
        this.originalShapes = JSON.parse(JSON.stringify(parsedShapes));
        console.log('🔄 ROTATING MECHANIC: Stored', this.originalShapes.length, 'shapes for rotation');

        // Ensure rotation center is set
        if (!this.rotationCenter) {
            this.rotationCenter = { x: 190, y: 190 };
            console.log('🔄 ROTATING MECHANIC: Set rotation center:', this.rotationCenter);
        }

        // Start rotation if not in practice mode AND not restoring game state
        if (!window.isPracticeMode && !this.isRotating && !window.isRestoringGameState) {
            console.log('🔄 ROTATING MECHANIC: Starting rotation with loaded shapes');
            this.startRotation();
            return true;
        } else if (window.isRestoringGameState) {
            console.log('🔄 ROTATING MECHANIC: Deferring rotation start - waiting for canvas restoration');
            return true;
        }

        console.log('🔄 ROTATING MECHANIC: Shapes initialized, rotation deferred (practice mode or already rotating)');
        return true;
    },

    // CRITICAL: Force a complete restart of the rotation mechanic (for mode switching)
    forceRestart() {
        console.log('🔄 ROTATING MECHANIC: Force restart requested');

        // Stop everything
        this.stopRotation();

        // Clear instruction tracking to prevent spam
        this.lastInstruction = null;

        // Only restart if we have shapes and not in practice mode
        if (parsedShapes && parsedShapes.length > 0 && !window.isPracticeMode) {
            console.log('🔄 ROTATING MECHANIC: Reinitializing after force restart');

            // Reinitialize with current shapes
            this.originalShapes = JSON.parse(JSON.stringify(parsedShapes));

            // Ensure rotation center is set
            if (!this.rotationCenter) {
                this.rotationCenter = { x: 190, y: 190 };
            }

            // Start fresh rotation
            this.rotationAngle = 0;
            this.rotationPausedForDemo = false;

            // Start rotation
            this.startRotation();
            console.log('🔄 ROTATING MECHANIC: Force restart complete');
            return true;
        } else {
            console.log('🔄 ROTATING MECHANIC: Force restart skipped (no shapes or practice mode)');
            return false;
        }
    },
    
    // Start rotation animation
    startRotation() {
        // CRITICAL: Block all rotation during practice mode
        if (window.isPracticeMode || (window.practiceMode && window.practiceMode.isActive)) {
            console.log('🚫 Blocking rotation - practice mode active');
            return;
        }
        
        // Check if we're in demo mode and on day 7 (Sunday)
        // In demo mode, currentDay = 7 means Sunday with rotating shapes
        if (window.isDemoMode && window.currentDay === 7) {
            console.log('✅ Demo mode day 7 - allowing rotation');
        } else if (!window.isDemoMode) {
            console.log('✅ Not in demo mode - allowing rotation for testing');
        } else if (window.currentDay !== 7) {
            console.log('🚫 Blocking rotation - not day 7 in demo mode (current day:', window.currentDay, ')');
            return;
        }
        
        if (this.isRotating) {
            console.log('🔄 Rotation already running, ignoring start request');
            return;
        }
        
        console.log('🔄 Starting rotation animation');
        this.isRotating = true;
        window.isAnimating = true; // Reduce logging during rotation
        this.lastFrameTime = performance.now();
        this.animateRotation();

        // Save rotation state for refresh protection
        if (window.SimpleRefresh && window.SimpleRefresh.save) {
            window.SimpleRefresh.save();
        }
    },
    
    // Stop rotation animation
    stopRotation() {
        if (this.animationId) {
            console.log('🔄 Stopping rotation animation');
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            window.isAnimating = false; // Re-enable normal logging
        }
        this.isRotating = false;
    },
    
    // Animation loop for rotation
    animateRotation() {
        // Check if we should be rotating
        if (window.isDemoMode && window.currentDay !== 7) {
            console.log('🚫 Stopping rotation animation - not day 7 in demo mode (current day:', window.currentDay, ')');
            this.stopRotation();
            return;
        }
        
        if (!this.isRotating) {
            console.log('❌ Animation stopped - isRotating is false');
            return;
        }
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Update rotation angle
        this.rotationAngle += this.rotationSpeed * deltaTime;
        
        // Keep angle within 0-2π range
        if (this.rotationAngle >= 2 * Math.PI) {
            this.rotationAngle -= 2 * Math.PI;
        }
        
        // Debug: Log rotation angle every 300 frames (roughly 5 seconds) - reduced for performance
        if (Math.floor(currentTime / 16) % 300 === 0) {
            // Log rotation angle less frequently (every 5 degrees)
            const angleDegrees = (this.rotationAngle * 180 / Math.PI) % 360;
            if (!this.lastLoggedAngle || Math.abs(angleDegrees - this.lastLoggedAngle) >= 5) {
                console.log('🔄 Rotation angle:', angleDegrees.toFixed(1) + '°');
                this.lastLoggedAngle = angleDegrees;
            }
        }
        
        // Apply rotation to shapes and redraw
        this.updateRotatedShapes();
        this.drawCurrentState();
        
        // Continue animation
        this.animationId = requestAnimationFrame(() => this.animateRotation());
        
        // Extra safety: If we ever lose the animation ID, something went wrong
        if (!this.animationId) {
            console.error('❌ Lost animation ID - attempting to restart rotation');
            setTimeout(() => this.startRotation(), 100);
        }
    },
    
    // Update parsedShapes with current rotation
    updateRotatedShapes() {
        // CRITICAL: Don't modify parsedShapes during practice mode
        if (window.isPracticeMode || (window.PracticeMode && window.PracticeMode.isActive)) {
            console.log('🔄 ROTATION: Skipping shape updates during practice mode');
            return;
        }

        if (!this.originalShapes || !this.rotationCenter) {
            console.log('🔄 Cannot update rotated shapes - missing originalShapes or rotationCenter');
            return;
        }

        // Removed frequent console logs to improve performance

        // Create rotated version of shapes - ONLY update if not in practice mode
        parsedShapes = this.originalShapes.map((shape, index) => {
            // Skip reference points
            if (shape.properties && shape.properties.type === 'reference') {
                return shape;
            }

            // Rotate polygon shapes (check for outerRing property which indicates parsed shape)
            if (shape.outerRing) {
                const rotatedShape = JSON.parse(JSON.stringify(shape));

                // Rotate outer ring - convert coordinates to points
                rotatedShape.outerRing = shape.outerRing.map(coord => {
                    const point = { x: coord[0], y: coord[1] };
                    const rotatedPoint = this.rotatePoint(point, this.rotationCenter, this.rotationAngle);
                    return [rotatedPoint.x, rotatedPoint.y];
                });

                // Rotate holes if they exist
                if (shape.holes && shape.holes.length > 0) {
                    rotatedShape.holes = shape.holes.map(hole =>
                        hole.map(coord => {
                            const point = { x: coord[0], y: coord[1] };
                            const rotatedPoint = this.rotatePoint(point, this.rotationCenter, this.rotationAngle);
                            return [rotatedPoint.x, rotatedPoint.y];
                        })
                    );
                }

                return rotatedShape;
            }

            return shape;
        });
    },
    
    // Rotate a point around a center by given angle
    rotatePoint(point, center, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // Translate to origin
        const x = point.x - center.x;
        const y = point.y - center.y;
        
        // Rotate
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;
        
        // Translate back
        return {
            x: rotatedX + center.x,
            y: rotatedY + center.y
        };
    },
    
    // Draw current state (shapes + vector preview)
    drawCurrentState() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // Render rotated shapes - check both local and window parsedShapes
        const shapesToRender = parsedShapes || window.parsedShapes;
        if (typeof renderShapeForCutting === 'function' && shapesToRender && shapesToRender.length > 0) {
            renderShapeForCutting(shapesToRender);
        }
        
        // Draw vector preview if drawing (removed distance check for immediate visibility)
        if (this.isDrawingVector && this.vectorStart && this.vectorEnd) {
            this.drawPreview();
        }
        
        // Update external instruction text
        this.updateInstructionText();
        
        // Draw rotation indicator (removed per user request)
        // this.drawRotationIndicator();
    },
    
    // Draw preview during drag (matching default-with-undo style)
    drawPreview() {
        if (!this.vectorStart || !this.vectorEnd) return;
        
        // Draw current vector preview (matching default-with-undo style)
        ctx.save();
        ctx.strokeStyle = this.LINE_COLOR;
        ctx.lineWidth = this.LINE_WIDTH;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(this.vectorStart.x, this.vectorStart.y);
        ctx.lineTo(this.vectorEnd.x, this.vectorEnd.y);
        ctx.stroke();
        
        ctx.restore();
    },
    
    // Draw rotation indicator
    drawRotationIndicator() {
        if (!this.rotationCenter) return;
        
        // Use rotation center coordinates directly (they're already in canvas space)
        const centerX = this.rotationCenter.x;
        const centerY = this.rotationCenter.y;
        
        ctx.save();
        
        // Draw rotation center point
        ctx.fillStyle = '#ff9900';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw rotation arrow
        ctx.strokeStyle = '#ff9900';
        ctx.lineWidth = 2;
        const radius = 20;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, this.rotationAngle, this.rotationAngle + Math.PI * 1.5);
        ctx.stroke();
        
        // Draw arrow head
        const arrowX = centerX + radius * Math.cos(this.rotationAngle + Math.PI * 1.5);
        const arrowY = centerY + radius * Math.sin(this.rotationAngle + Math.PI * 1.5);
        
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8 * Math.cos(this.rotationAngle + Math.PI * 1.2), 
                   arrowY - 8 * Math.sin(this.rotationAngle + Math.PI * 1.2));
        ctx.lineTo(arrowX - 8 * Math.cos(this.rotationAngle + Math.PI * 1.8), 
                   arrowY - 8 * Math.sin(this.rotationAngle + Math.PI * 1.8));
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    },
    
    // Handle start of interaction (mouse down / touch start)
    handleStart(event, canvasRect) {
        if (!isInteractionEnabled || gameState !== 'cutting') {
            console.log('Rotating Shape Vector mechanic: Start ignored - interaction not enabled or wrong state');
            return false;
        }
        
        if (!this.isCompatibleWithCurrentShapes()) {
            console.log('Rotating Shape Vector mechanic: Shapes not compatible');
            return false;
        }
        
        // Check for multi-touch cancellation
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleStart - canceling if drawing');
            if (this.isDrawingVector) {
                this.cancelLineDraw();
                return true; // Return true since we handled the cancellation
            }
            return false;
        }
        
        // Hide any commentary when user starts cutting
        if (typeof hideGoalCommentary === 'function') hideGoalCommentary();
        if (typeof hideTryAgainMessage === 'function') hideTryAgainMessage();
        
        this.isDrawingVector = true;
        this.vectorStart = this.getCanvasCoordinates(event, canvasRect);
        this.vectorEnd = null;
        this.currentVector = null;
        this.vectorCutActive = false;
        this.dragDistance = 0;
        
        // Update instruction after first touch
        if (window.updateInstructionText && window.getDynamicInstruction) {
            const dynamicInstruction = window.getDynamicInstruction('RotatingShapeVectorMechanic', 'first_touch');
            window.updateInstructionText(dynamicInstruction);
        }
        
        console.log('🎯 Rotating Shape Vector mechanic: Start drawing vector at', this.vectorStart);
        return true; // Handled
    },
    
    // Handle drag/move during interaction
    handleMove(event, canvasRect) {
        if (!this.isDrawingVector || !this.vectorStart || gameState !== 'cutting') return false;
        
        // Check for multi-touch cancellation during move
        if (event.touches && event.touches.length > 1) {
            console.log('🔄 Multi-touch detected in handleMove - canceling line draw');
            this.cancelLineDraw();
            return true; // Handled
        }
        
        this.vectorEnd = this.getCanvasCoordinates(event, canvasRect);
        
        // Calculate drag distance
        const dx = this.vectorEnd.x - this.vectorStart.x;
        const dy = this.vectorEnd.y - this.vectorStart.y;
        this.dragDistance = Math.sqrt(dx * dx + dy * dy);
        
        // Note: Don't call drawCurrentState() here as rotation animation handles redrawing
        // The rotation animation loop will pick up the updated vectorEnd and dragDistance
        // and draw the preview automatically via drawCurrentState()
        
        return true; // Handled
    },
    
    // Handle end of interaction (mouse up / touch end)
    handleEnd(event) {
        if (!this.isDrawingVector || !this.vectorStart || gameState !== 'cutting') {
            // Don't reset everything - just reset drawing state to preserve rotation
            this.resetDrawingState();
            return false;
        }
        
        this.isDrawingVector = false;
        if (!this.vectorEnd) {
            this.vectorEnd = this.vectorStart; // Handle case where no move occurred
        }
        
        // Check if this was a proper drag (not just a tap)
        if (this.dragDistance < 10) {
            console.log('🚫 Rotating Shape Vector mechanic: Cut too short, showing try again');
            
            // Show try again message in instruction area
            if (window.updateInstructionText) {
                window.updateInstructionText('Try again', true); // true for bold styling
            }
            this.resetDrawingState();
            
            // Ensure rotation is running - only restart if actually stopped
            if (!this.isRotating) {
                if (!this.rotationCenter || !this.originalShapes) {
                    console.warn('⚠️ Missing rotation data during short cut, reinitializing...');
                    this.setupRotation();
                    return false; // setupRotation() will handle starting rotation
                }
                
                console.log('🔄 Rotation was stopped, restarting after short cut');
                this.startRotation();
            } else {
                console.log('🔄 Rotation is running, continuing normally after short cut');
            }
            
            // Canvas will be redrawn by animation loop or draw manually if not rotating
            if (!this.isRotating) {
                this.drawCurrentState();
            }
            
            return false;
        }
        
        if (this.vectorStart && this.vectorEnd) {
            // Normalize vector direction for consistent left/right calculation
            let normalizedStart = this.vectorStart;
            let normalizedEnd = this.vectorEnd;
            
            // Always ensure consistent direction: if start.x > end.x, swap them
            if (this.vectorStart.x > this.vectorEnd.x) {
                normalizedStart = this.vectorEnd;
                normalizedEnd = this.vectorStart;
            }
            
            // Calculate extended vector that spans the entire canvas
            this.currentVector = this.extendVectorToCanvasBounds(normalizedStart, normalizedEnd);
            this.vectorCutActive = true;
            
            console.log('✂️ Rotating Shape Vector mechanic: Executing vector cut', this.currentVector);
            
            // Stop rotation before executing cut
            this.stopRotation();
            
            // Perform the cut calculation
            return this.executeCut();
        }
        
        // Don't reset everything - just reset drawing state to preserve rotation
        this.resetDrawingState();
        return false;
    },
    
    // Get canvas coordinates from event
    getCanvasCoordinates(event, canvasRect) {
        let clientX, clientY;
        
        if (event.type.startsWith('touch')) {
            clientX = event.touches[0]?.clientX || event.changedTouches[0]?.clientX;
            clientY = event.touches[0]?.clientY || event.changedTouches[0]?.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        // Get pointer position relative to canvas display area
        const relativeX = clientX - canvasRect.left;
        const relativeY = clientY - canvasRect.top;
        
        // Get canvas element to check internal resolution
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) {
            // Fallback to original calculation if canvas not found
            return { x: relativeX, y: relativeY };
        }
        
        // Scale from display size to canvas internal resolution
        // Canvas internal size is 380x380, but CSS may display it differently
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        
        return {
            x: relativeX * scaleX,
            y: relativeY * scaleY
        };
    },
    
    
    // Extend vector to canvas bounds (same as default mechanic)
    extendVectorToCanvasBounds(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        
        // Handle vertical line
        if (Math.abs(dx) < 0.001) {
            return {
                start: { x: start.x, y: 0 },
                end: { x: start.x, y: canvas.height }
            };
        }
        
        // Handle horizontal line
        if (Math.abs(dy) < 0.001) {
            return {
                start: { x: 0, y: start.y },
                end: { x: canvas.width, y: start.y }
            };
        }
        
        // Calculate slope and intercept
        const slope = dy / dx;
        const intercept = start.y - slope * start.x;
        
        // Find intersections with canvas boundaries
        const intersections = [];
        
        // Left edge (x = 0)
        const leftY = intercept;
        if (leftY >= 0 && leftY <= canvas.height) {
            intersections.push({ x: 0, y: leftY });
        }
        
        // Right edge (x = canvas.width)
        const rightY = slope * canvas.width + intercept;
        if (rightY >= 0 && rightY <= canvas.height) {
            intersections.push({ x: canvas.width, y: rightY });
        }
        
        // Top edge (y = 0)
        const topX = (0 - intercept) / slope;
        if (topX >= 0 && topX <= canvas.width) {
            intersections.push({ x: topX, y: 0 });
        }
        
        // Bottom edge (y = canvas.height)
        const bottomX = (canvas.height - intercept) / slope;
        if (bottomX >= 0 && bottomX <= canvas.width) {
            intersections.push({ x: bottomX, y: canvas.height });
        }
        
        // Return the two intersection points
        if (intersections.length >= 2) {
            return {
                start: intersections[0],
                end: intersections[1]
            };
        }
        
        // Fallback to original points if no intersections found
        return { start, end };
    },
    
    // Update instruction text using external instruction area (like other mechanics)
    updateInstructionText() {
        if (!window.updateInstructionText || !window.getDynamicInstruction) return;

        let instruction = '';
        if (this.isDrawingVector) {
            // Use centralized system for during cut instruction
            instruction = window.getDynamicInstruction('RotatingShapeVectorMechanic', 'first_touch');
        } else {
            // Use centralized system for initial instruction
            instruction = window.getInitialInstruction('RotatingShapeVectorMechanic');
        }

        // Update instruction text if it has changed and we're not in practice mode
        if (instruction && !window.isPracticeMode && this.lastInstruction !== instruction) {
            window.updateInstructionText(instruction);
            this.lastInstruction = instruction;
        }
    },
    
    // Execute the cut (using default-with-undo pattern)
    async executeCut() {
        if (!this.currentVector) {
            console.log('❌ Cannot execute cut - no current vector');
            return false;
        }
        
        console.log('✂️ Rotating Shape Vector: Executing cut', this.currentVector);
        
        try {
            // Validate the cut
            const isValidCut = this.validateCut();
            console.log('🔍 Cut validation result:', isValidCut);
            
            if (!isValidCut) {
                console.log('❌ Invalid cut detected - not counting attempt');
                this.handleInvalidCut();
                return false;
            }
            
            console.log('✅ Valid cut detected - proceeding with attempt');
            
            // Update instruction to show processing
            if (window.updateInstructionText) {
                window.updateInstructionText('Processing cut...');
            }
            
            // Calculate areas
            const areaResults = this.calculateAreas();
            console.log('📊 Area calculation results:', areaResults);
            
            // Store the results globally
            window.currentVector = this.currentVector;
            window.currentAreaResults = areaResults;
            
            // Set global currentVector for drawFinalVector function
            if (typeof window !== 'undefined') {
                globalThis.currentVector = this.currentVector;
            }
            
            // Render the cut result
            this.renderCutResult(areaResults);
            
            // Call the main game's cut handling flow
            console.log('🔥 ROTATING MECHANIC: About to check for handleCutAttempt');
            console.log('🔥 window.handleCutAttempt exists:', typeof window.handleCutAttempt);
            console.log('🔥 isDemoMode:', window.isDemoMode);
            
            if (typeof window.handleCutAttempt === 'function') {
                console.log('🔥 ROTATING MECHANIC: Calling main handleCutAttempt flow');
                // Set the global variables that handleCutAttempt expects
                window.currentVector = this.currentVector;
                // Pause rotation until demo flow explicitly restarts it
                this.rotationPausedForDemo = true;
                console.log('🔥 ROTATING MECHANIC: Rotation paused for demo flow');
                // Call the main game flow
                window.handleCutAttempt();
            } else if (typeof window.showAttemptResult === 'function') {
                console.log('🔥 ROTATING MECHANIC: Fallback - calling showAttemptResult directly');
                // For test lab mode, restart rotation automatically
                this.startRotation();
                window.showAttemptResult(areaResults.leftPercentage, areaResults.rightPercentage);
            } else {
                console.log('🔥 ROTATING MECHANIC: No cut handling function found!');
            }
            
            return true;
        } catch (error) {
            console.error('Error executing rotating shape vector cut:', error);
            return false;
        } finally {
            // Don't reset here in demo mode - let the main game handle it
            // The rotation should continue for the next attempt or shape
            console.log('🌀 Rotating mechanic executeCut complete - not resetting to preserve rotation');
        }
    },
    
    // Validate if the cut actually divides the shape
    validateCut() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 ROTATING MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        const areaResults = this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, this.currentVector);
        
        if (areaResults.leftPercentage < 0.1 || areaResults.rightPercentage < 0.1) {
            console.log('Invalid cut detected - no actual division:', areaResults.leftPercentage, areaResults.rightPercentage);
            return false;
        }
        
        return true;
    },
    
    // Handle invalid cuts
    handleInvalidCut() {
        console.log('🚫 Invalid cut - allowing recut without counting');
        
        // Show try again message in instruction area
        if (window.updateInstructionText) {
            window.updateInstructionText('Try again', true); // true for bold styling
        }
        
        // Reset only drawing state, keep rotation running
        this.resetDrawingState();
        
        // Ensure rotation is running - only restart if actually stopped
        if (!this.isRotating) {
            if (!this.rotationCenter || !this.originalShapes) {
                console.warn('⚠️ Missing rotation data during invalid cut, reinitializing...');
                this.setupRotation();
                return; // setupRotation() will handle starting rotation
            }
            
            console.log('🔄 Rotation was stopped, restarting after invalid cut');
            this.startRotation();
        } else {
            console.log('🔄 Rotation is running, continuing normally after invalid cut');
        }
        
        
        // Canvas will be redrawn by animation loop or draw manually if not rotating
        if (!this.isRotating) {
            this.drawCurrentState();
        }
    },
    
    // Calculate areas using pixel-based method
    calculateAreas() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 ROTATING MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;
        
        return this.calculatePixelBasedAreas(pixels, tempCanvas.width, tempCanvas.height, this.currentVector);
    },
    
    // Render shapes for pixel analysis (grey fill)
    renderShapesForPixelAnalysis(context, shapes) {
        context.save();
        context.fillStyle = '#dddddd';
        
        const bounds = calculateBounds(shapes);
        const scale = calculateScale(bounds, false);
        const offset = calculateOffset(bounds, scale, false);
        
        shapes.forEach(shape => {
            drawPolygonForPixelAnalysis(context, shape, scale, offset);
        });
        
        context.restore();
    },
    
    // Calculate pixel-based areas
    calculatePixelBasedAreas(pixels, width, height, vector) {
        let leftArea = 0;
        let rightArea = 0;
        let totalShapePixels = 0;
        
        const lineStart = vector.start;
        const lineEnd = vector.end;
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                if (r === 221 && g === 221 && b === 221) {
                    totalShapePixels++;
                    
                    const side = this.getPixelSideOfVector(x, y, lineStart, lineEnd, dx, dy);
                    
                    if (side === 'left') {
                        leftArea++;
                    } else if (side === 'right') {
                        rightArea++;
                    }
                }
            }
        }
        
        const leftPercentage = totalShapePixels > 0 ? (leftArea / totalShapePixels) * 100 : 0;
        const rightPercentage = totalShapePixels > 0 ? (rightArea / totalShapePixels) * 100 : 0;

        // CRITICAL: Ensure smaller area is always in leftArea/leftPercentage for consistent shading
        // This ensures the smaller area gets colored on the canvas
        if (leftPercentage > rightPercentage) {
            // Swap so smaller is always "left"
            return {
                leftArea: rightArea,
                rightArea: leftArea,
                totalShapePixels,
                leftPercentage: rightPercentage,
                rightPercentage: leftPercentage
            };
        }

        return {
            leftArea,
            rightArea,
            totalShapePixels,
            leftPercentage,
            rightPercentage
        };
    },
    
    // Determine which side of the vector a pixel is on
    getPixelSideOfVector(x, y, lineStart, lineEnd, dx, dy) {
        const crossProduct = (x - lineStart.x) * dy - (y - lineStart.y) * dx;
        
        if (crossProduct > 0) {
            return 'left';
        } else if (crossProduct < 0) {
            return 'right';
        } else {
            return 'on_line';
        }
    },
    
    // Render the cut result with colored areas
    renderCutResult(areaResults) {
        if (!this.currentVector || !parsedShapes.length) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Use practice mode shapes if in practice mode
        const shapesToAnalyze = window.isPracticeMode ?
                               (window.practiceMode?.practiceParsedShapes || []) :
                               (parsedShapes || []);
        console.log(`🔍 ROTATING MECHANIC: Using ${shapesToAnalyze.length} shapes for pixel analysis (isPracticeMode: ${window.isPracticeMode})`);
        this.renderShapesForPixelAnalysis(tempCtx, shapesToAnalyze);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        // CRITICAL: We need to determine which GEOMETRIC side is actually smaller
        // Count the pixels on each geometric side to figure out which should be colored
        let geometricLeftCount = 0;
        let geometricRightCount = 0;
        const dx = this.currentVector.end.x - this.currentVector.start.x;
        const dy = this.currentVector.end.y - this.currentVector.start.y;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                if (pixels[pixelIndex] === 221) {
                    const side = this.getPixelSideOfVector(x, y, this.currentVector.start, this.currentVector.end, dx, dy);
                    if (side === 'left') {
                        geometricLeftCount++;
                    } else if (side === 'right') {
                        geometricRightCount++;
                    }
                }
            }
        }

        // Color whichever geometric side is smaller
        const colorLeftSide = geometricLeftCount <= geometricRightCount;

        console.log(`🎨 Rotating vector rendering: geometricLeft=${geometricLeftCount}, geometricRight=${geometricRightCount}, colorLeftSide=${colorLeftSide}`);
        console.log(`   areaResults: leftPercentage=${areaResults.leftPercentage.toFixed(1)}%, rightPercentage=${areaResults.rightPercentage.toFixed(1)}%`);

        const resultImageData = ctx.createImageData(canvas.width, canvas.height);
        const resultPixels = resultImageData.data;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];

                if (r === 221 && g === 221 && b === 221) {
                    const side = this.getPixelSideOfVector(x, y, this.currentVector.start, this.currentVector.end,
                        this.currentVector.end.x - this.currentVector.start.x,
                        this.currentVector.end.y - this.currentVector.start.y);

                    if (side === 'on_line') {
                        // Cut line remains black
                        resultPixels[pixelIndex] = 0;
                        resultPixels[pixelIndex + 1] = 0;
                        resultPixels[pixelIndex + 2] = 0;
                        resultPixels[pixelIndex + 3] = 255;
                    } else if ((side === 'left' && colorLeftSide) || (side === 'right' && !colorLeftSide)) {
                        // Color the smaller area
                        const color = window.getDailyCutShadingColor ? window.getDailyCutShadingColor() : { r: 100, g: 150, b: 255 };
                        resultPixels[pixelIndex] = color.r;
                        resultPixels[pixelIndex + 1] = color.g;
                        resultPixels[pixelIndex + 2] = color.b;
                        resultPixels[pixelIndex + 3] = 255;
                    } else {
                        // Larger area remains grey
                        resultPixels[pixelIndex] = 221;
                        resultPixels[pixelIndex + 1] = 221;
                        resultPixels[pixelIndex + 2] = 221;
                        resultPixels[pixelIndex + 3] = 255;
                    }
                } else {
                    // Background pixels - set to white
                    resultPixels[pixelIndex] = 255;
                    resultPixels[pixelIndex + 1] = 255;
                    resultPixels[pixelIndex + 2] = 255;
                    resultPixels[pixelIndex + 3] = 255;
                }
            }
        }
        
        ctx.putImageData(resultImageData, 0, 0);
        
        // Draw grid lines over the result
        drawGridLinesOnly();
        
        // Draw shape outlines and final vector
        if (typeof drawShapeOutlines === 'function') {
            drawShapeOutlines();
        }
        
        this.drawFinalVector();
    },
    
    // Draw the final cut vector
    drawFinalVector() {
        if (!this.currentVector) return;
        
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(this.currentVector.start.x, this.currentVector.start.y);
        ctx.lineTo(this.currentVector.end.x, this.currentVector.end.y);
        ctx.stroke();
        
        ctx.restore();
    },
    
    // Method to restart rotation for demo flow (called when Next Attempt is clicked)
    restartRotationForNextAttempt() {
        console.log('🔄 ROTATION: Demo flow requesting rotation restart');
        // Clear demo pause flag to allow rotation
        this.rotationPausedForDemo = false;

        // BUGFIX: If originalShapes is missing, try to restore from parsedShapes
        if (!this.originalShapes && (parsedShapes || window.parsedShapes)) {
            const shapesToStore = parsedShapes || window.parsedShapes;
            console.log('🔧 ROTATION BUGFIX: originalShapes missing, capturing from parsedShapes');
            this.originalShapes = JSON.parse(JSON.stringify(shapesToStore));
        }

        // BUGFIX: If rotationCenter is missing, set it to the fixed center
        if (!this.rotationCenter) {
            console.log('🔧 ROTATION BUGFIX: rotationCenter missing, setting to fixed center');
            this.rotationCenter = { x: 190, y: 190 };
        }

        if (this.rotationCenter && this.originalShapes) {
            console.log('🔄 ROTATION: Clearing previous cut shading and restarting rotation');
            // Clear any previous shading and restart rotation
            this.startRotation();
            this.drawCurrentState();
            // Reset instruction text for next attempt using centralized system
            if (window.updateInstructionText && window.getInitialInstruction) {
                const initialInstruction = window.getInitialInstruction('RotatingShapeVectorMechanic');
                window.updateInstructionText(initialInstruction);
            }
        } else {
            console.warn('⚠️ ROTATION: Cannot restart - missing rotation data', {
                hasCenter: !!this.rotationCenter,
                hasOriginalShapes: !!this.originalShapes,
                parsedShapesAvailable: !!(parsedShapes || window.parsedShapes)
            });
        }
    },
    
    // Restore rotation state from saved data (for practice mode recovery)
    restoreRotationState(rotState) {
        console.log('🔄 ROTATION: Restoring rotation state from practice mode', rotState);
        
        // Stop any current rotation first
        this.stopRotation();
        
        // Restore rotation properties
        this.rotationAngle = rotState.rotationAngle || 0;
        this.rotationCenter = rotState.rotationCenter;
        
        // If we have original shapes saved, restore them
        if (rotState.originalShapes && rotState.originalShapes.length > 0) {
            console.log('🔄 ROTATION: Restoring original shapes from saved state');
            this.originalShapes = rotState.originalShapes;
        } else {
            // If no original shapes saved, capture current parsedShapes as original
            console.log('🔄 ROTATION: No saved original shapes, capturing current parsedShapes');
            if (window.parsedShapes && window.parsedShapes.length > 0) {
                this.originalShapes = window.parsedShapes.map(shape => ({ ...shape }));
            }
        }
        
        // Ensure rotation center is set
        if (!this.rotationCenter) {
            console.log('🔄 ROTATION: No saved rotation center, using default');
            this.rotationCenter = { x: 190, y: 190 };
        }
        
        // Restart rotation if it was active
        if (rotState.isRotating && this.originalShapes && this.originalShapes.length > 0) {
            console.log('🔄 ROTATION: Restarting rotation animation from saved state');
            this.startRotation();
        } else {
            console.log('🔄 ROTATION: Rotation was not active or no shapes available, drawing static state');
            this.drawCurrentState();
        }
    }
};

// Export for module loading
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RotatingShapeVectorMechanic;
} else {
    window.RotatingShapeVectorMechanic = RotatingShapeVectorMechanic;
}