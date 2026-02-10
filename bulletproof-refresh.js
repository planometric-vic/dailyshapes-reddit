// Bulletproof Refresh Protection - Non-Invasive State Monitoring
// Preserves all existing game functionality while adding seamless refresh protection

window.BulletproofRefresh = {
    // 13 Possible Game States
    GAME_STATES: {
        'initial': 'Show Play button',
        'shape1_attempt1_ready': 'Shape 1 loaded, ready for first cut',
        'shape1_attempt1_done': 'Shape 1 first cut made, show Next Attempt button',
        'shape1_attempt2_ready': 'Shape 1 loaded, ready for second cut',
        'shape1_attempt2_done': 'Shape 1 second cut made, show Next Shape button',
        'shape2_attempt1_ready': 'Shape 2 loaded, ready for first cut',
        'shape2_attempt1_done': 'Shape 2 first cut made, show Next Attempt button',
        'shape2_attempt2_ready': 'Shape 2 loaded, ready for second cut',
        'shape2_attempt2_done': 'Shape 2 second cut made, show Next Shape button',
        'shape3_attempt1_ready': 'Shape 3 loaded, ready for first cut',
        'shape3_attempt1_done': 'Shape 3 first cut made, show Next Attempt button',
        'shape3_attempt2_ready': 'Shape 3 loaded, ready for second cut',
        'shape3_attempt2_done': 'Shape 3 second cut made, show View Results button',
        'complete': 'Game finished, show completion UI'
    },

    // Clear only corrupted data (not all data)
    clearCorruptedData: function() {
        // Only clear data if it's clearly corrupted (more than 6 total cuts)
        const keys = Object.keys(localStorage).filter(key => key.startsWith('bulletproofGame_'));
        keys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.cuts && data.cuts.length > 6) {
                    console.log('🧹 Clearing corrupted data with', data.cuts.length, 'cuts (max should be 6)');
                    localStorage.removeItem(key);
                }
            } catch (e) {
                console.log('🧹 Clearing malformed data:', key);
                localStorage.removeItem(key);
            }
        });
    },

    // Initialize monitoring system
    initialize: function() {
        this.clearCorruptedData(); // Clear any bad data first
        this.setupMonitoring();
        this.checkForExistingGame();
        console.log('🛡️ Bulletproof refresh protection initialized');
    },

    // Set up non-invasive monitoring
    setupMonitoring: function() {
        this.monitorShowAttemptResult();
        this.monitorButtonClicks();
        this.monitorPlayButton();
        this.monitorGameCompletion();
    },

    // Monitor showAttemptResult function (cut completion)
    monitorShowAttemptResult: function() {
        if (window.showAttemptResult && !window.showAttemptResult._monitored) {
            const original = window.showAttemptResult;
            
            window.showAttemptResult = function(leftPercentage, rightPercentage) {
                // Call original function exactly as before
                const result = original.apply(this, arguments);
                
                // After original completes, capture state
                setTimeout(() => {
                    window.BulletproofRefresh.captureStateAfterCut(leftPercentage, rightPercentage);
                }, 150);
                
                return result;
            };
            
            window.showAttemptResult._monitored = true;
            console.log('🔍 Monitoring showAttemptResult');
        }
    },

    // Monitor button clicks for progression
    monitorButtonClicks: function() {
        if (!document._bulletproofListener) {
            document.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const buttonText = e.target.textContent;
                    
                    if (buttonText.includes('Next Attempt') || 
                        buttonText.includes('Next Shape') || 
                        buttonText.includes('View Results')) {
                        
                        setTimeout(() => {
                            this.captureStateAfterButtonClick(buttonText);
                        }, 300);
                    }
                }
            });
            
            document._bulletproofListener = true;
            console.log('🔍 Monitoring button clicks');
        }
    },

    // Monitor Play button
    monitorPlayButton: function() {
        const playBtn = document.getElementById('playBtn');
        if (playBtn && !playBtn._monitored) {
            playBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.captureInitialGameStart();
                }, 100);
            });
            
            playBtn._monitored = true;
            console.log('🔍 Monitoring Play button');
        }
    },

    // Monitor game completion
    monitorGameCompletion: function() {
        // Monitor when stats popup is shown (game complete)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && 
                        (node.id === 'statsOverlay' || 
                         node.classList?.contains('stats-overlay'))) {
                        
                        setTimeout(() => {
                            this.captureGameCompletion();
                        }, 100);
                    }
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    },

    // Capture state after cut is made
    captureStateAfterCut: function(leftPercentage, rightPercentage) {
        // CRITICAL FIX: Prevent duplicate cut captures - aggressive blocking
        const shape = window.currentShapeNumber || 1;
        const attempt = window.currentAttemptNumber || 1;
        const cutKey = `${shape}-${attempt}`;
        const now = Date.now();
        
        // Block any duplicate shape/attempt combinations within 2 seconds
        if (this.lastCutKey === cutKey && (now - this.lastCutTime) < 2000) {
            console.log('🚫 DUPLICATE cut capture blocked:', cutKey, 'within 2000ms');
            return;
        }
        
        // Additional safety: block if we already have enough cuts for this shape/attempt
        const snapshot = this.getCurrentSnapshot();
        if (snapshot && snapshot.cuts) {
            const existingCuts = snapshot.cuts.filter(cut => cut.shape === shape && cut.attempt === attempt);
            if (existingCuts.length >= 1) {
                console.log('🚫 DUPLICATE cut blocked: Already have', existingCuts.length, 'cuts for Shape', shape, 'Attempt', attempt);
                return;
            }
        }
        
        console.log('📸 Cut capture proceeding for Shape', shape, 'Attempt', attempt);
        
        this.lastCutKey = cutKey;
        this.lastCutTime = now;
        
        // CRITICAL FIX: Read actual current state from window variables at the time of cut
        // (shape and attempt already declared above)
        
        console.log('📸 Capturing state after cut:');
        console.log('   Window variables:', { 
            currentShapeNumber: window.currentShapeNumber, 
            currentAttemptNumber: window.currentAttemptNumber 
        });
        console.log('   Using values:', { shape, attempt, leftPercentage, rightPercentage });
        
        // DIAGNOSTIC: Check all possible window variables
        console.log('🔍 ALL WINDOW GAME VARS:', {
            currentShapeNumber: window.currentShapeNumber,
            currentAttemptNumber: window.currentAttemptNumber,
            currentShapeIndex: window.currentShapeIndex,
            currentAttempt: window.currentAttempt,
            gameState: window.gameState
        });
        
        // Create cut record with EXACT current values
        const cutData = {
            shape: shape,
            attempt: attempt,
            leftPercent: leftPercentage,
            rightPercent: rightPercentage,
            score: this.calculateScore(leftPercentage, rightPercentage),
            cutVector: window.currentCutVector || null,
            canvasImageData: this.captureCanvasState(),
            timestamp: Date.now()
        };
        
        // Update snapshot with EXACT current values
        snapshot.cuts = snapshot.cuts || [];
        snapshot.cuts.push(cutData);
        snapshot.currentShapeIndex = shape;  // Use actual current shape
        snapshot.currentAttempt = attempt;   // Use actual current attempt
        snapshot.currentState = `shape${shape}_attempt${attempt}_done`;
        snapshot.lastCanvasState = cutData.canvasImageData;
        snapshot.lastPercentages = { left: leftPercentage, right: rightPercentage };
        snapshot.hasStarted = true;
        
        // CRITICAL FIX: Determine button type based on what cut was just made
        // If we just made attempt 1, show "Next Attempt"
        // If we just made attempt 2 and shape < 3, show "Next Shape" 
        // If we just made attempt 2 and shape = 3, show "View Results"
        if (attempt === 1) {
            snapshot.lastButtonType = "nextAttempt";
        } else if (attempt === 2 && shape < 3) {
            snapshot.lastButtonType = "nextShape";
        } else if (attempt === 2 && shape === 3) {
            snapshot.lastButtonType = "viewResults";
        } else {
            snapshot.lastButtonType = "nextAttempt"; // Safe fallback
        }
        
        console.log('📸 Final snapshot state:', {
            currentShapeIndex: snapshot.currentShapeIndex,
            currentAttempt: snapshot.currentAttempt,
            currentState: snapshot.currentState,
            lastButtonType: snapshot.lastButtonType
        });
        
        this.saveSnapshot(snapshot);
    },

    // Capture state after button click
    captureStateAfterButtonClick: function(buttonText) {
        const snapshot = this.getCurrentSnapshot();
        // CRITICAL: Read the UPDATED values after the button handler has executed
        // Don't use fallback values as they can mask progression issues
        const shape = window.currentShapeNumber;
        const attempt = window.currentAttemptNumber;
        
        console.log('📸 DEBUG: Raw window values - currentShapeNumber:', window.currentShapeNumber, 'currentAttemptNumber:', window.currentAttemptNumber);
        
        // Validate we have proper values before updating snapshot
        if (!shape || !attempt) {
            console.error('❌ CRITICAL: Invalid window variables after button click!', { shape, attempt });
            console.error('   This indicates a synchronization issue in handleNextShape or handleNextAttempt');
            return; // Don't update snapshot with invalid data
        }
        
        console.log('📸 Capturing UPDATED state after button click:', buttonText);
        console.log('   Existing snapshot before update:', { 
            currentShapeIndex: snapshot.currentShapeIndex,
            currentAttempt: snapshot.currentAttempt,
            currentState: snapshot.currentState,
            cuts: snapshot.cuts ? snapshot.cuts.length : 0
        });
        console.log('   Window variables AFTER button handler:', { 
            currentShapeNumber: window.currentShapeNumber, 
            currentAttemptNumber: window.currentAttemptNumber 
        });
        console.log('   Using VALIDATED values:', { shape, attempt });
        
        // CRITICAL: Only update progression state, preserve all existing cut data
        snapshot.currentShapeIndex = shape;
        snapshot.currentAttempt = attempt;
        snapshot.hasStarted = true; // Ensure this doesn't get lost
        
        // Determine the current state based on UPDATED values
        if (buttonText.includes('Next Attempt')) {
            snapshot.currentState = `shape${shape}_attempt${attempt}_ready`;
        } else if (buttonText.includes('Next Shape')) {
            snapshot.currentState = `shape${shape}_attempt${attempt}_ready`;
        } else if (buttonText.includes('View Results')) {
            snapshot.currentState = 'complete';
            snapshot.isComplete = true;
        }
        
        console.log('📸 Final snapshot after button click:', {
            currentShapeIndex: snapshot.currentShapeIndex,
            currentAttempt: snapshot.currentAttempt,
            currentState: snapshot.currentState,
            cuts: snapshot.cuts ? snapshot.cuts.length : 0,
            hasStarted: snapshot.hasStarted
        });
        
        this.saveSnapshot(snapshot);
    },

    // Capture initial game start
    captureInitialGameStart: function() {
        const snapshot = this.getCurrentSnapshot();
        snapshot.hasStarted = true;
        snapshot.currentState = 'shape1_attempt1_ready';
        snapshot.currentShapeIndex = 1;
        snapshot.currentAttempt = 1;
        
        console.log('📸 Game started');
        this.saveSnapshot(snapshot);
    },

    // Capture game completion
    captureGameCompletion: function() {
        const snapshot = this.getCurrentSnapshot();
        snapshot.currentState = 'complete';
        snapshot.isComplete = true;
        
        console.log('📸 Game completed');
        this.saveSnapshot(snapshot);
    },

    // Get current snapshot or create new one
    getCurrentSnapshot: function() {
        const today = this.getCurrentDate();
        let snapshot = this.loadSnapshot(today);
        
        if (!snapshot) {
            snapshot = {
                date: today,
                hasStarted: false,
                currentState: 'initial',
                cuts: [],
                currentShapeIndex: 1,
                currentAttempt: 1,
                lastCanvasState: null,
                lastPercentages: null,
                lastButtonType: null,
                isComplete: false,
                finalScore: null
            };
        }
        
        return snapshot;
    },

    // Capture canvas state
    captureCanvasState: function() {
        try {
            if (window.canvas) {
                return window.canvas.toDataURL('image/png');
            }
        } catch (error) {
            console.warn('Canvas capture failed:', error);
        }
        return null;
    },

    // Restore canvas state
    restoreCanvasState: function(imageData) {
        if (!imageData || !window.canvas || !window.ctx) return;
        
        try {
            const img = new Image();
            img.onload = function() {
                window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
                window.ctx.drawImage(img, 0, 0);
                console.log('✅ Canvas state restored');
            };
            img.src = imageData;
        } catch (error) {
            console.error('Canvas restore failed:', error);
        }
    },

    // Check for existing game on page load
    checkForExistingGame: function() {
        const today = this.getCurrentDate();
        console.log('🔍 Today\'s date key:', today);
        
        // Check what's in localStorage
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('bulletproofGame_'));
        console.log('🔍 All bulletproof keys in localStorage:', allKeys);
        
        const snapshot = this.loadSnapshot(today);
        
        console.log('🔍 Checking for existing game...');
        console.log('   Snapshot loaded:', snapshot);
        
        if (!snapshot) {
            console.log('🆕 No snapshot found - starting fresh');
            return;
        }
        
        console.log('   hasStarted:', snapshot.hasStarted);
        console.log('   isComplete:', snapshot.isComplete);
        console.log('   cuts array:', snapshot.cuts);
        console.log('   cuts length:', snapshot.cuts ? snapshot.cuts.length : 'N/A');
        console.log('   currentState:', snapshot.currentState);
        console.log('   currentShapeIndex:', snapshot.currentShapeIndex);
        console.log('   currentAttempt:', snapshot.currentAttempt);
        
        // DIAGNOSTIC: Examine the actual cut data to understand progression
        if (snapshot.cuts && snapshot.cuts.length > 0) {
            console.log('🔍 DIAGNOSTIC - Examining cut data:');
            snapshot.cuts.forEach((cut, index) => {
                console.log(`   Cut ${index + 1}: Shape ${cut.shape}, Attempt ${cut.attempt}, ${cut.leftPercent}%/${cut.rightPercent}%`);
            });
        }
        
        if (!snapshot.hasStarted) {
            console.log('🆕 Game not started - ready for fresh start');
            return;
        }
        
        if (snapshot.isComplete) {
            console.log('🏁 Game already completed today');
            return;
        }
        
        // Show continue popup if we have any game progress at all
        if (snapshot.hasStarted) {
            console.log('▶️ Game in progress detected - showing continue popup');
            console.log('   Will restore to:', snapshot.currentState);
            setTimeout(() => {
                this.showContinuePopup(snapshot);
            }, 1000);
            return;
        }
        
        console.log('🆕 No active progress - ready for new start');
    },

    // Show continue popup
    showContinuePopup: function(snapshot) {
        this.createContinuePopup();
        
        const popup = document.getElementById('bulletproofContinuePopup');
        const message = document.getElementById('bulletproofContinueMessage');
        const continueBtn = document.getElementById('bulletproofContinueBtn');
        
        // Set message
        message.textContent = this.generateContinueMessage(snapshot);
        
        // Show popup
        popup.style.display = 'flex';
        
        // Handle continue button
        continueBtn.onclick = () => {
            popup.style.display = 'none';
            this.restoreGameState(snapshot);
        };
    },

    // Create continue popup HTML
    createContinuePopup: function() {
        if (document.getElementById('bulletproofContinuePopup')) return;
        
        const popupHTML = `
            <div id="bulletproofContinuePopup" class="bulletproof-popup-overlay" style="
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                justify-content: center;
                align-items: center;
            ">
                <div class="bulletproof-popup" style="
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    text-align: center;
                    max-width: 400px;
                    margin: 20px;
                ">
                    <h3 style="margin: 0 0 15px 0; color: #333;">Daily Game In Progress</h3>
                    <p id="bulletproofContinueMessage" style="margin: 0 0 20px 0; color: #666; line-height: 1.4;"></p>
                    <div style="text-align: center;">
                        <button id="bulletproofContinueBtn" style="
                            padding: 12px 24px;
                            background: #4CAF50;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 16px;
                            font-weight: bold;
                        ">Continue</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', popupHTML);
    },

    // Generate continue message
    generateContinueMessage: function(snapshot) {
        const state = snapshot.currentState;
        
        const messages = {
            'shape1_attempt1_done': 'You have one more cut on Shape 1.',
            'shape1_attempt2_done': 'You have two more shapes to cut.',
            'shape2_attempt1_done': 'You have one more cut on Shape 2.',
            'shape2_attempt2_done': 'You have one more shape to cut.',
            'shape3_attempt1_done': 'You have one more cut on Shape 3.',
            'shape3_attempt2_done': 'You can view your final results.'
        };
        
        return messages[state] || 'Continue your daily game.';
    },

    // Restore game state
    restoreGameState: function(snapshot) {
        console.log('🔄 Restoring game state:', snapshot.currentState);
        console.log('🔄 Snapshot data:', snapshot);
        
        // Hide initial UI immediately
        const welcomeOverlay = document.getElementById('welcomeOverlay');
        if (welcomeOverlay) {
            welcomeOverlay.style.display = 'none';
            console.log('✅ Welcome overlay hidden');
        }
        
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.style.display = 'none';
            console.log('✅ Play button hidden');
        }
        
        // Set game variables first
        window.currentShapeNumber = snapshot.currentShapeIndex;
        window.currentAttemptNumber = snapshot.currentAttempt;
        window.gameState = 'playing';
        
        // CRITICAL: Restore cut counters from snapshot data
        if (snapshot.cuts) {
            const totalCuts = snapshot.cuts.length;
            const cutsThisShape = snapshot.cuts.filter(cut => 
                cut.shape === snapshot.currentShapeIndex
            ).length;
            
            // Update main.js counters immediately
            window.totalCutsMade = totalCuts;
            window.cutsMadeThisShape = cutsThisShape;
            
            console.log('✅ Restored cut counters - total:', totalCuts, 'thisShape:', cutsThisShape);
            
            // BULLETPROOF FIX: Only disable if we've truly reached the cut limit
            // For each shape, the actual cut limit is based on attempts, not raw cuts
            if (totalCuts >= 6) {
                window.gameState = 'complete';
                window.isInteractionEnabled = false;
                console.log('🔒 Game completed - interaction LOCKED');
            } else if (cutsThisShape >= 2) {
                // Current shape is complete, but game isn't over
                window.isInteractionEnabled = false;
                window.gameState = 'awaiting_choice';
                console.log('🔒 Current shape completed - awaiting next shape');
            }
        }
        
        // CRITICAL FIX: Only enable interaction if we haven't exceeded attempt limits
        // Each shape allows exactly 2 attempts - validate before enabling interaction
        if (snapshot.currentAttempt <= 2) {
            window.isInteractionEnabled = true;
            console.log('✅ Interaction enabled - valid attempt number:', snapshot.currentAttempt);
        } else {
            window.isInteractionEnabled = false;
            console.log('🚫 Interaction BLOCKED - invalid attempt number:', snapshot.currentAttempt, 'Max allowed: 2');
        }
        
        console.log('✅ Game variables set:', {
            shape: window.currentShapeNumber,
            attempt: window.currentAttemptNumber,
            gameState: window.gameState,
            interaction: window.isInteractionEnabled
        });
        
        // Load the correct shape using the existing game system
        this.loadShapeAndRestore(snapshot);
    },
    
    // Load shape and restore state
    loadShapeAndRestore: async function(snapshot) {
        const state = snapshot.currentState;
        console.log('🔺 Loading shape for restoration:', snapshot.currentShapeIndex);
        
        try {
            // Use the game's existing shape loading system
            if (window.loadDemoDay) {
                await window.loadDemoDay(window.currentDay || 4); // Use current day
                
                // CRITICAL FIX: Re-sync the main.js local variables after loadDemoDay resets them
                // The loadDemoDay function calls resetDemoGame() which resets currentShapeNumber=1, currentAttemptNumber=1
                // We need to restore them to the correct values from our snapshot
                console.log('🔄 Re-syncing main.js variables after loadDemoDay reset');
                console.log('   Before sync - main.js vars should be 1,1');
                console.log('   After sync - restoring to:', snapshot.currentShapeIndex, snapshot.currentAttempt);
                
                // Force the main.js local variables to match our snapshot
                if (window.syncBulletproofVariables) {
                    window.syncBulletproofVariables(snapshot.currentShapeIndex, snapshot.currentAttempt);
                }
                
                // CRITICAL: Re-sync cut counters after loadDemoDay reset them too
                if (snapshot.cuts) {
                    const totalCuts = snapshot.cuts.length;
                    const cutsThisShape = snapshot.cuts.filter(cut => 
                        cut.shape === snapshot.currentShapeIndex
                    ).length;
                    
                    window.totalCutsMade = totalCuts;
                    window.cutsMadeThisShape = cutsThisShape;
                    
                    console.log('🔄 Re-synced cut counters after loadDemoDay - total:', totalCuts, 'thisShape:', cutsThisShape);
                }
            }
            
            if (window.loadDemoShape) {
                await window.loadDemoShape(window.currentDay || 4, snapshot.currentShapeIndex);
            }
            
            console.log('✅ Shape loaded, restoring state...');
            
            // Wait a bit for shape to fully load
            setTimeout(() => {
                this.finalizeRestoration(snapshot, state);
            }, 300);
            
        } catch (error) {
            console.error('❌ Shape loading failed:', error);
            // Fallback - try direct shape loading
            setTimeout(() => {
                this.finalizeRestoration(snapshot, state);
            }, 300);
        }
    },
    
    // Finalize the restoration
    finalizeRestoration: function(snapshot, state) {
        console.log('🎯 Finalizing restoration for state:', state);
        
        // CRITICAL: Ensure progress UI exists and is properly updated
        setTimeout(() => {
            // First ensure the progress UI element exists
            if (window.createProgressUI) {
                window.createProgressUI();
                console.log('✅ Progress UI element created/recreated');
            }
            
            // Then update it with the correct values - add delay to ensure DOM is ready
            setTimeout(() => {
                if (window.updateProgressUI) {
                    window.updateProgressUI();
                    console.log('✅ Status bar updated to show correct progress (delayed)');
                    
                    // Verify the update worked
                    const progressDisplay = document.getElementById('demoProgressDisplay');
                    if (progressDisplay) {
                        console.log('✅ Progress display content:', progressDisplay.textContent);
                    } else {
                        console.log('❌ Progress display element not found after update');
                    }
                }
            }, 100);
        }, 150);
        
        if (state.includes('_done')) {
            // Completed state - show results and button
            console.log('📊 Restoring completed state with results');
            
            // Restore canvas if we have saved state
            if (snapshot.lastCanvasState) {
                this.restoreCanvasState(snapshot.lastCanvasState);
            }
            
            // Show percentages from last cut
            if (snapshot.lastPercentages) {
                setTimeout(() => {
                    this.showPercentages(snapshot.lastPercentages);
                }, 100);
            }
            
            // Disable interaction and wait for button click
            window.isInteractionEnabled = false;
            window.gameState = 'awaiting_choice';
            
            // Use the main game's button system instead of creating our own
            setTimeout(() => {
                if (window.createProgressionButton) {
                    window.createProgressionButton();
                    console.log('✅ Used main game createProgressionButton()');
                } else {
                    // Fallback to our own button system
                    this.createRestoredButton(snapshot.lastButtonType);
                }
            }, 200);
            
        } else if (state.includes('_ready')) {
            // Ready state - enable cutting only if within attempt limits
            console.log('✂️ Restoring ready state - checking attempt limits');
            
            window.gameState = 'cutting'; // CRITICAL FIX: Set to 'cutting' not 'playing'
            
            // CRITICAL FIX: Only enable interaction if we haven't exceeded attempt limits
            // AND if we haven't already made the maximum cuts for this shape
            if (snapshot.currentAttempt <= 2 && (!snapshot.cuts || 
                snapshot.cuts.filter(cut => cut.shape === snapshot.currentShapeIndex).length < 2)) {
                window.isInteractionEnabled = true;
                console.log('✅ Cutting enabled - valid attempt number:', snapshot.currentAttempt);
            } else {
                window.isInteractionEnabled = false;
                console.log('🚫 Cutting BLOCKED - attempt:', snapshot.currentAttempt, 'cuts on shape:', 
                    snapshot.cuts ? snapshot.cuts.filter(cut => cut.shape === snapshot.currentShapeIndex).length : 0);
            }
            
            // Make sure canvas is ready for interaction
            const canvas = document.getElementById('geoCanvas');
            if (canvas) {
                canvas.style.pointerEvents = 'auto';
                console.log('✅ Canvas interaction enabled');
            }
            
        } else if (state === 'complete') {
            // Complete state
            console.log('🏁 Restoring completed game');
            this.showCompletionUI();
        }
        
        // Update progress UI to match restored state
        if (window.updateProgressUI) {
            window.updateProgressUI();
        }
        
        console.log('✅ Restoration finalized');
    },
    
    // Create restored button
    createRestoredButton: function(buttonType) {
        const buttonText = buttonType === 'nextAttempt' ? 'Next Attempt' :
                          buttonType === 'nextShape' ? 'Next Shape' :
                          buttonType === 'viewResults' ? 'View Results' : 'Continue';
        
        console.log('🔘 Creating restored button:', buttonText);
        
        // Find results container
        const container = document.getElementById('resultsContainer');
        if (!container) {
            console.error('❌ Results container not found');
            return;
        }
        
        // Remove any existing buttons
        const existingButtons = container.querySelectorAll('button');
        existingButtons.forEach(btn => {
            if (btn.textContent.includes('Next') || btn.textContent.includes('Results')) {
                btn.remove();
            }
        });
        
        // Create button
        const buttonDiv = document.createElement('div');
        buttonDiv.style.cssText = 'margin: 15px 0; text-align: center;';
        
        const button = document.createElement('button');
        button.textContent = buttonText;
        button.className = 'progression-button';
        button.style.cssText = `
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        `;
        
        // Add click handler that uses existing game functions
        button.onclick = () => {
            if (buttonText === 'Next Attempt' && window.handleNextAttempt) {
                window.handleNextAttempt();
            } else if (buttonText === 'Next Shape' && window.handleNextShape) {
                window.handleNextShape();
            } else if (buttonText === 'View Results') {
                this.showCompletionUI();
            }
        };
        
        buttonDiv.appendChild(button);
        container.appendChild(buttonDiv);
        
        console.log('✅ Restored button created');
    },

    // Show percentages
    showPercentages: function(percentages) {
        if (window.showAttemptResult) {
            window.showAttemptResult(percentages.left, percentages.right);
        }
    },

    // Show button
    showButton: function(buttonType) {
        // The existing game will create its own buttons, we just ensure the state is correct
        setTimeout(() => {
            window.isInteractionEnabled = false; // Disable cutting, enable button
        }, 100);
    },

    // Show completion UI
    showCompletionUI: function() {
        if (window.showDayStatsPopup) {
            setTimeout(() => window.showDayStatsPopup(), 500);
        }
    },

    // Start new game (clear saved state)
    startNewGame: function() {
        const today = this.getCurrentDate();
        this.clearSnapshot(today);
        location.reload();
    },

    // Calculate score
    calculateScore: function(leftPercentage, rightPercentage) {
        const perfectSplit = 50.0;
        const leftDeviation = Math.abs(leftPercentage - perfectSplit);
        const rightDeviation = Math.abs(rightPercentage - perfectSplit);
        const averageDeviation = (leftDeviation + rightDeviation) / 2;
        const score = Math.max(0, 100 - (averageDeviation * 2));
        return Math.round(score * 10) / 10;
    },

    // Storage functions
    getCurrentDate: function() {
        // Use local date instead of UTC
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    saveSnapshot: function(snapshot) {
        const key = `bulletproofGame_${snapshot.date}`;
        try {
            localStorage.setItem(key, JSON.stringify(snapshot));
            console.log('💾 Snapshot saved:', {
                currentShapeIndex: snapshot.currentShapeIndex,
                currentAttempt: snapshot.currentAttempt,
                currentState: snapshot.currentState,
                hasStarted: snapshot.hasStarted,
                cuts: snapshot.cuts ? snapshot.cuts.length : 0
            });
            
            // DIAGNOSTIC: Show what cut data is being saved
            if (snapshot.cuts && snapshot.cuts.length > 0) {
                console.log('💾 Cut data being saved:');
                snapshot.cuts.forEach((cut, index) => {
                    console.log(`   Save Cut ${index + 1}: Shape ${cut.shape}, Attempt ${cut.attempt}`);
                });
            }
            
            // Immediately verify the save worked
            const verification = localStorage.getItem(key);
            if (verification) {
                const parsed = JSON.parse(verification);
                console.log('✅ Save verification:', {
                    shape: parsed.currentShapeIndex,
                    attempt: parsed.currentAttempt,
                    state: parsed.currentState
                });
            }
        } catch (error) {
            console.error('Failed to save snapshot:', error);
        }
    },

    loadSnapshot: function(date) {
        const key = `bulletproofGame_${date}`;
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to load snapshot:', error);
            return null;
        }
    },

    clearSnapshot: function(date) {
        const key = `bulletproofGame_${date}`;
        localStorage.removeItem(key);
    },

    // Emergency function to clear all bulletproof data
    clearAllData: function() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('bulletproofGame_'));
        keys.forEach(key => localStorage.removeItem(key));
        console.log('🗑️ Cleared all bulletproof data:', keys.length, 'items');
    },

    // Clean up old snapshots
    cleanupOldSnapshots: function() {
        const today = this.getCurrentDate();
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('bulletproofGame_') && !key.includes(today)) {
                localStorage.removeItem(key);
                console.log('🗑️ Cleaned up old snapshot:', key);
            }
        });
    },
    
    // Debug function to clear all bulletproof snapshots
    clearAllSnapshots: function() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('bulletproofGame_')) {
                localStorage.removeItem(key);
                console.log('🗑️ Debug: Cleared snapshot:', key);
            }
        });
    },
    
    // Debug function to show current game state
    debugGameState: function() {
        console.log('🐛 BULLETPROOF DEBUG - Current Game State:');
        console.log('   Window vars:', {
            currentShapeNumber: window.currentShapeNumber,
            currentAttemptNumber: window.currentAttemptNumber,
            totalCutsMade: window.totalCutsMade,
            cutsMadeThisShape: window.cutsMadeThisShape,
            gameState: window.gameState,
            isInteractionEnabled: window.isInteractionEnabled
        });
        
        const snapshot = this.getCurrentSnapshot();
        console.log('   Snapshot:', {
            currentShapeIndex: snapshot.currentShapeIndex,
            currentAttempt: snapshot.currentAttempt,
            currentState: snapshot.currentState,
            cuts: snapshot.cuts ? snapshot.cuts.length : 0,
            lastButtonType: snapshot.lastButtonType
        });
    }
};

// Initialize on page load
setTimeout(() => {
    window.BulletproofRefresh.initialize();
}, 1200);

// Make debug function globally accessible
window.debugBulletproof = () => window.BulletproofRefresh.debugGameState();
window.clearBulletproof = () => window.BulletproofRefresh.clearAllSnapshots();

console.log('🛡️ Bulletproof Refresh Protection loaded');
console.log('🐛 Debug functions available: window.debugBulletproof() and window.clearBulletproof()');