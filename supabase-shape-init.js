/**
 * Supabase Shape Initialization Script
 * Loads and initializes the new storage system
 */

(function() {
    'use strict';

    console.log('🚀 Daily Shapes v4.0 - Supabase Integration Starting...');

    /**
     * Load required modules in order
     */
    async function loadModules() {
        const modules = [
            'shape-storage.js',
            'daily-mode-manager.js',
            'practice-mode-manager.js',
            'game-mode-integration.js'
        ];

        for (const module of modules) {
            try {
                await loadScript(module);
                console.log(`✅ Loaded: ${module}`);
            } catch (error) {
                console.error(`❌ Failed to load ${module}:`, error);
                return false;
            }
        }

        return true;
    }

    /**
     * Load a script dynamically
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize the game system
     */
    async function initializeGame() {
        try {
            // Wait for Supabase to be ready
            let retries = 0;
            let client = null;

            while (!client && retries < 10) {
                console.log(`⏳ Waiting for Supabase client... (attempt ${retries + 1})`);

                // Check multiple sources for the client
                if (window.supabaseClient) {
                    client = window.supabaseClient;
                } else if (window.SupabaseConfig && window.SupabaseConfig.client) {
                    client = window.SupabaseConfig.client;
                    window.supabaseClient = client; // Set global reference
                } else if (window.SupabaseConfig && window.SupabaseConfig.initialize) {
                    await window.SupabaseConfig.initialize();
                    client = window.SupabaseConfig.client;
                    if (client) {
                        window.supabaseClient = client; // Set global reference
                    }
                }

                if (!client) {
                    // Wait a bit before checking again
                    await new Promise(resolve => setTimeout(resolve, 500));
                    retries++;
                }
            }

            if (!client) {
                console.warn('⚠️ Supabase client not available after waiting - continuing in offline mode');
            } else {
                console.log('✅ Supabase client found and ready');
            }

            // Load modules
            const modulesLoaded = await loadModules();
            if (!modulesLoaded) {
                throw new Error('Failed to load required modules');
            }

            // Initialize game mode integration
            window.gameModeIntegration = new GameModeIntegration();
            const initialized = await window.gameModeIntegration.initialize();

            if (initialized) {
                console.log('✅ Daily Shapes v4.0 - Supabase Integration Complete');

                // Don't stop loading animation here - let main.js handle it
                // so it can properly show the welcome screen with callback

                // Dispatch ready event
                window.dispatchEvent(new CustomEvent('dailyShapesReady', {
                    detail: {
                        mode: window.gameModeIntegration.currentMode,
                        version: '4.0'
                    }
                }));

                // Update UI to show ready state
                updateUIReadyState();
            } else {
                throw new Error('Game mode initialization failed');
            }

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            handleInitializationError(error);
        }
    }

    /**
     * Update UI to show ready state
     */
    function updateUIReadyState() {
        // Add ready class to body
        document.body.classList.add('shapes-ready');

        // Update any loading indicators
        const loadingElements = document.querySelectorAll('.shape-loading');
        loadingElements.forEach(el => {
            el.classList.remove('shape-loading');
            el.classList.add('shape-loaded');
        });

        // Enable game controls
        enableGameControls();
    }

    /**
     * Enable game controls
     */
    function enableGameControls() {
        // Enable practice mode navigation buttons
        const practiceButtons = document.querySelectorAll('#practiceLeftBtn, #practiceRightBtn');
        practiceButtons.forEach(btn => {
            btn.disabled = false;
            btn.addEventListener('click', handlePracticeNavigation);
        });

        // Enable daily mode progression
        const progressButton = document.querySelector('#progressButton');
        if (progressButton) {
            progressButton.addEventListener('click', handleDailyProgression);
        }

        // Enable mode switcher
        const modeSwitcher = document.querySelector('#modeSwitcher');
        if (modeSwitcher) {
            modeSwitcher.addEventListener('change', handleModeSwitch);
        }
    }

    /**
     * Handle practice mode navigation
     */
    async function handlePracticeNavigation(event) {
        const button = event.target;
        const direction = button.id === 'practiceLeftBtn' ? 'previous' : 'next';

        if (window.gameModeIntegration) {
            button.disabled = true;

            try {
                const shape = await window.gameModeIntegration.navigatePractice(direction);

                if (shape) {
                    updateShapeDisplay(shape);
                }
            } catch (error) {
                console.error('Navigation error:', error);
            } finally {
                button.disabled = false;
            }
        }
    }

    /**
     * Handle daily mode progression
     */
    async function handleDailyProgression(event) {
        const button = event.target;

        if (window.gameModeIntegration) {
            button.disabled = true;

            try {
                const shape = await window.gameModeIntegration.progressDaily();

                if (shape) {
                    updateShapeDisplay(shape);
                } else {
                    // All shapes complete
                    showCompletionMessage();
                }
            } catch (error) {
                console.error('Progression error:', error);
            } finally {
                button.disabled = false;
            }
        }
    }

    /**
     * Handle mode switching
     */
    async function handleModeSwitch(event) {
        const newMode = event.target.value;

        if (window.gameModeIntegration) {
            try {
                await window.gameModeIntegration.switchMode(newMode);
                updateModeDisplay(newMode);
            } catch (error) {
                console.error('Mode switch error:', error);
            }
        }
    }

    /**
     * Update shape display
     */
    function updateShapeDisplay(shape) {
        // This would integrate with your existing shape rendering code
        console.log('📐 Shape updated:', shape);

        // Update shape info display
        const infoDisplay = document.querySelector('#shapeInfo');
        if (infoDisplay && shape.metadata) {
            infoDisplay.textContent = `Shape ${shape.metadata.shapeNumber} - ${shape.metadata.date}`;
        }
    }

    /**
     * Update mode display
     */
    function updateModeDisplay(mode) {
        const modeDisplay = document.querySelector('#currentMode');
        if (modeDisplay) {
            modeDisplay.textContent = mode === 'daily' ? 'Daily Mode' : 'Practice Mode';
        }

        // Show/hide relevant controls
        document.querySelectorAll('.practice-controls').forEach(el => {
            el.style.display = mode === 'practice' ? 'block' : 'none';
        });

        document.querySelectorAll('.daily-controls').forEach(el => {
            el.style.display = mode === 'daily' ? 'block' : 'none';
        });
    }

    /**
     * Show completion message
     */
    function showCompletionMessage() {
        const message = document.createElement('div');
        message.className = 'completion-message';
        message.innerHTML = `
            <h2>🎉 Daily Shapes Complete!</h2>
            <p>Great job! Come back tomorrow for new shapes.</p>
        `;
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            z-index: 10000;
        `;
        document.body.appendChild(message);
    }

    /**
     * Handle initialization errors
     */
    function handleInitializationError(error) {
        console.error('Failed to initialize Daily Shapes:', error);

        // Create fallback UI
        const fallbackMessage = document.createElement('div');
        fallbackMessage.id = 'fallback-message';
        fallbackMessage.innerHTML = `
            <p>⚠️ Unable to connect to shape server</p>
            <p>The game will continue with demo shapes.</p>
            <button onclick="location.reload()">Retry</button>
        `;
        fallbackMessage.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ff9900;
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
        `;
        document.body.appendChild(fallbackMessage);

        // Try to load demo mode
        if (window.loadDemoShapes) {
            window.loadDemoShapes();
        }
    }

    /**
     * Wait for DOM and Supabase to be ready
     */
    function waitForReady() {
        // Set flag to indicate Supabase integration is active
        window.supabaseIntegrationActive = true;

        // Override demo mode if it was set
        if (window.DailyGameCore) {
            window.DailyGameCore.disabled = false;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeGame);
        } else {
            // DOM already loaded
            setTimeout(initializeGame, 100); // Small delay to ensure other scripts are loaded
        }
    }

    // Start initialization
    waitForReady();

    // Listen for midnight reset events
    window.addEventListener('dailyModeReset', (event) => {
        console.log('🌙 Midnight reset detected:', event.detail);
        // Optionally refresh the page or update UI
    });

    // Expose API for external use
    window.DailyShapesAPI = {
        getCurrentMode: () => window.gameModeIntegration?.currentMode,
        getModeInfo: () => window.gameModeIntegration?.getModeInfo(),
        navigatePractice: (direction) => window.gameModeIntegration?.navigatePractice(direction),
        progressDaily: () => window.gameModeIntegration?.progressDaily(),
        switchMode: (mode) => window.gameModeIntegration?.switchMode(mode),
        getCache: () => window.ShapeStorage ? new ShapeStorage().getCacheStats() : null,
        clearCache: () => window.ShapeStorage ? new ShapeStorage().clearCache() : null
    };

    console.log('📦 Daily Shapes API available at window.DailyShapesAPI');

})();