/**
 * UIManager - Handles all UI updates, views, and transitions for Daily Shapes on Reddit.
 * Adapted for the Reddit webview context (no header, no auth, compact layout).
 */

const UIManager = {
    // =============================================
    // INSTRUCTION SYSTEM
    // =============================================

    /** Mechanic instruction text map */
    INSTRUCTIONS: {
        DefaultMechanic: {
            initial: 'Click and drag to draw a cut line',
            first_touch: 'Release to cut'
        },
        HorizontalOnlyMechanic: {
            initial: 'Click and drag to place a horizontal cut',
            first_touch: 'Release to cut'
        },
        DiagonalAscendingMechanic: {
            initial: 'Click and drag to place a diagonal cut',
            first_touch: 'Release to cut'
        },
        CircleCutMechanic: {
            initial: 'Click and drag to draw a circle cut',
            first_touch: 'Release to cut'
        },
        ThreePointTriangleMechanic: {
            initial: 'Click and drag to draw a triangle cut',
            first_touch: 'Drag to resize and rotate, release to cut'
        },
        RotatingSquareMechanic: {
            initial: 'Click and drag to draw a square cut',
            first_touch: 'Drag to resize and rotate, release to cut'
        },
        RotatingShapeVectorMechanic: {
            initial: 'Click and drag to cut the rotating shape',
            first_touch: 'Release to cut'
        }
    },

    getInitialInstruction(mechanicName) {
        const inst = this.INSTRUCTIONS[mechanicName];
        return inst ? inst.initial : 'Click and drag to cut';
    },

    getDynamicInstruction(mechanicName, phase) {
        const inst = this.INSTRUCTIONS[mechanicName];
        if (!inst) return 'Release to cut';
        return inst[phase] || inst.initial;
    },

    // =============================================
    // UI UPDATE METHODS
    // =============================================

    updateInstruction(text) {
        const el = document.getElementById('instruction-text');
        if (el) el.textContent = text || '';
    },

    /** Update progress dots: 3 shapes x 2 attempts each */
    updateProgress(shapeIndex, attemptIndex) {
        const dots = document.querySelectorAll('.progress-dot');
        dots.forEach((dot, i) => {
            const dotShape = Math.floor(i / 2);
            const dotAttempt = i % 2;
            dot.classList.remove('active', 'completed');

            if (dotShape < shapeIndex) {
                dot.classList.add('completed');
            } else if (dotShape === shapeIndex && dotAttempt < attemptIndex) {
                dot.classList.add('completed');
            } else if (dotShape === shapeIndex && dotAttempt === attemptIndex) {
                dot.classList.add('active');
            }
        });

        // Update shape label
        const label = document.getElementById('shape-label');
        if (label) label.textContent = `Shape ${shapeIndex + 1} of 3`;
    },

    // =============================================
    // CUT RESULT DISPLAY
    // =============================================

    showCutResult({ leftPercentage, rightPercentage, score, isPerfect, commentary, shapeIndex, attempt, shapeColor }) {
        const container = document.getElementById('cut-result');
        if (!container) return;

        const smaller = Math.min(leftPercentage, rightPercentage);
        const larger = Math.max(leftPercentage, rightPercentage);

        container.innerHTML = `
            <div class="split-display">
                <span class="split-small" style="color:rgb(${shapeColor.r},${shapeColor.g},${shapeColor.b})">${Math.round(smaller)}%</span>
                <span class="split-divider">/</span>
                <span class="split-large">${Math.round(larger)}%</span>
            </div>
            <div class="score-display">
                <span class="score-value">${score}</span>
                <span class="score-label">pts</span>
            </div>
            <div class="commentary">${commentary}</div>
        `;
        container.style.display = 'block';

        if (isPerfect) {
            this.showPerfectCutEffect();
        }
    },

    hideCutResult() {
        const container = document.getElementById('cut-result');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
    },

    showPerfectCutEffect() {
        // Simple confetti-like effect
        const container = document.getElementById('game-container');
        if (!container) return;

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti-particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 0.5 + 's';
            particle.style.backgroundColor = ['#EDAE49', '#D1495B', '#00798C', '#FFD700'][Math.floor(Math.random() * 4)];
            container.appendChild(particle);
            setTimeout(() => particle.remove(), 1500);
        }
    },

    // =============================================
    // PROGRESSION BUTTON
    // =============================================

    showProgressionButton(text, onClick) {
        const container = document.getElementById('progression-area');
        if (!container) return;

        container.innerHTML = `<button class="btn-progression">${text}</button>`;
        container.style.display = 'flex';

        const btn = container.querySelector('.btn-progression');
        if (btn) btn.addEventListener('click', onClick);
    },

    hideProgressionButton() {
        const container = document.getElementById('progression-area');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
    },

    // =============================================
    // TRY AGAIN MESSAGE
    // =============================================

    showTryAgainMessage() {
        const el = document.getElementById('instruction-text');
        if (el) {
            el.textContent = 'Try again';
            el.classList.add('try-again');
            setTimeout(() => el.classList.remove('try-again'), 2000);
        }
    },

    hideTryAgainMessage() {
        const el = document.getElementById('instruction-text');
        if (el) el.classList.remove('try-again');
    },

    // =============================================
    // WELCOME SCREEN
    // =============================================

    showWelcomeScreen(initData) {
        const overlay = document.getElementById('welcome-overlay');
        if (!overlay) return;

        const mechanicFriendly = {
            'DefaultMechanic': 'Straight Line',
            'HorizontalOnlyMechanic': 'Horizontal Line',
            'DiagonalAscendingMechanic': 'Diagonal Line',
            'CircleCutMechanic': 'Circle Cut',
            'ThreePointTriangleMechanic': 'Triangle Cut',
            'RotatingSquareMechanic': 'Square Cut',
            'RotatingShapeVectorMechanic': 'Rotating Shape'
        };

        const mechanicName = mechanicFriendly[initData.mechanic] || initData.mechanic;

        overlay.innerHTML = `
            <div class="welcome-content">
                <h1 class="welcome-title">DAILY SHAPES</h1>
                <div class="welcome-day">#${initData.dayNumber}</div>
                <div class="welcome-mechanic">${mechanicName}</div>
                <p class="welcome-desc">Cut 3 shapes in half. 2 attempts each.</p>
                <button class="btn-play" id="btn-start-game">PLAY</button>
            </div>
        `;
        overlay.style.display = 'flex';

        document.getElementById('btn-start-game').addEventListener('click', () => {
            overlay.style.display = 'none';
            GameEngine.startGame();
        });
    },

    // =============================================
    // COMPLETION VIEW
    // =============================================

    showCompletionView(totalScore, leaderboard, details) {
        const overlay = document.getElementById('completion-overlay');
        if (!overlay) return;

        let scoresHTML = '';
        if (details && details.shapeScores) {
            const colors = ['#EDAE49', '#D1495B', '#00798C'];
            const colorNames = ['Shape 1', 'Shape 2', 'Shape 3'];
            details.shapeScores.forEach((scores, i) => {
                const shapeTotal = scores.reduce((a, b) => a + b, 0);
                scoresHTML += `
                    <div class="shape-score-row">
                        <span class="shape-dot" style="background:${colors[i]}"></span>
                        <span class="shape-name">${colorNames[i]}</span>
                        <span class="shape-attempts">${scores.join(' + ')}</span>
                        <span class="shape-total">${shapeTotal}</span>
                    </div>
                `;
            });
        }

        let rankHTML = '';
        if (details && details.rank && details.rank > 0) {
            rankHTML = `<div class="rank-info">Rank: #${details.rank} of ${details.totalPlayers}</div>`;
        }

        overlay.innerHTML = `
            <div class="completion-content">
                <h2 class="completion-title">Day Complete!</h2>
                <div class="completion-total">
                    <span class="total-score">${totalScore}</span>
                    <span class="total-label">points</span>
                </div>
                <div class="shape-scores">${scoresHTML}</div>
                ${rankHTML}
                <button class="btn-share" id="btn-share">Share Result</button>
                <button class="btn-leaderboard" id="btn-view-leaderboard">View Leaderboard</button>
            </div>
        `;
        overlay.style.display = 'flex';

        document.getElementById('btn-share')?.addEventListener('click', () => {
            this.shareResult(totalScore, details);
        });

        document.getElementById('btn-view-leaderboard')?.addEventListener('click', () => {
            this.showLeaderboard();
        });
    },

    // =============================================
    // LEADERBOARD
    // =============================================

    async showLeaderboard() {
        const dayKey = GameEngine.initData?.dayKey;
        if (!dayKey) return;

        const entries = await DevvitBridge.getLeaderboard(dayKey);
        const overlay = document.getElementById('leaderboard-overlay');
        if (!overlay) return;

        let rows = '';
        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                const isMe = entry.username === GameEngine.initData?.username;
                rows += `
                    <div class="lb-row ${isMe ? 'lb-row-me' : ''}">
                        <span class="lb-rank">#${entry.rank}</span>
                        <span class="lb-name">${entry.username}</span>
                        <span class="lb-score">${entry.score}</span>
                    </div>
                `;
            });
        } else {
            rows = '<div class="lb-empty">No scores yet. Be the first!</div>';
        }

        overlay.innerHTML = `
            <div class="leaderboard-content">
                <h2 class="lb-title">Leaderboard</h2>
                <div class="lb-list">${rows}</div>
                <button class="btn-close-lb" id="btn-close-lb">Close</button>
            </div>
        `;
        overlay.style.display = 'flex';

        document.getElementById('btn-close-lb')?.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
    },

    // =============================================
    // SHARE
    // =============================================

    shareResult(totalScore, details) {
        const dayNum = details?.dayNumber || '?';
        let text = `Daily Shapes #${dayNum} - ${totalScore} pts\n`;

        if (details && details.shapeScores) {
            const emojis = ['🟡', '🔴', '🔵'];
            details.shapeScores.forEach((scores, i) => {
                text += `${emojis[i]} ${scores.join(' + ')} = ${scores.reduce((a, b) => a + b, 0)}\n`;
            });
        }

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Copied to clipboard!');
            });
        }
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
};

window.UIManager = UIManager;
