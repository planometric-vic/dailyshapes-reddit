// Scoring System with Commentary for Daily Shapes v4.0
// Handles score calculations, commentary, and perfect cut celebrations

class ScoringSystem {
    constructor() {
        this.perfectCutThreshold = 0.1; // Allow 0.1% tolerance for "perfect" cuts
        this.celebrationActive = false;
    }
    
    // Calculate individual cut score using new formula
    // Score = 100 - (|50 - percentage|) × 2
    calculateCutScore(percentage) {
        if (typeof percentage !== 'number' || isNaN(percentage)) {
            return 0;
        }

        const deviation = Math.abs(50 - percentage);

        // Perfect split detection: if very close to 50%, award exact 100
        if (deviation <= 0.05) {
            return 100.0;
        }

        const score = Math.max(0, 100 - (deviation * 2));

        return Number(score.toFixed(1));
    }
    
    // Calculate daily score from all cut scores
    calculateDailyScore(allCutScores) {
        if (!Array.isArray(allCutScores) || allCutScores.length === 0) {
            return 0;
        }
        
        const validScores = allCutScores.filter(score => 
            typeof score === 'number' && !isNaN(score)
        );
        
        if (validScores.length === 0) {
            return 0;
        }
        
        const sum = validScores.reduce((total, score) => total + score, 0);
        return Number((sum / validScores.length).toFixed(1));
    }
    
    // Get commentary message based on score
    getCommentaryForScore(score) {
        const scoreNum = Number(score);
        
        if (scoreNum === 100) {
            return this.getRandomFromArray([
                "PERFECT CUT! 🎯", 
                "Flawless! ✨", 
                "Bullseye! 🏹",
                "Incredible! 🔥",
                "Masterful! ⭐"
            ]);
        } else if (scoreNum >= 96) {
            return this.getRandomFromArray([
                "Nearly perfect! 👌", 
                "Razor sharp! ⚡", 
                "So close! 🔥",
                "Outstanding! 🎉",
                "Brilliant! 💎"
            ]);
        } else if (scoreNum >= 80) {
            return this.getRandomFromArray([
                "Nice cut! 👍", 
                "Getting there! 💪", 
                "Not bad! 😊",
                "Good work! 👏",
                "Solid! 💫"
            ]);
        } else if (scoreNum >= 50) {
            return this.getRandomFromArray([
                "Keep trying! 🎯", 
                "Practice makes perfect! 📈", 
                "You'll get it! 💫",
                "Getting warmer! 🌡️",
                "Don't give up! 🚀"
            ]);
        } else {
            return this.getRandomFromArray([
                "Shapes can be tricky! 😅", 
                "Try a different angle! 🔄", 
                "Every cut teaches! 📚",
                "Keep experimenting! 🧪",
                "You're learning! 🎓"
            ]);
        }
    }
    
    // Get random element from array
    getRandomFromArray(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    // Check if cut qualifies as "perfect" (very close to 50/50)
    isPerfectCut(leftPercentage, rightPercentage) {
        const leftDiff = Math.abs(50 - leftPercentage);
        const rightDiff = Math.abs(50 - rightPercentage);
        
        return leftDiff <= this.perfectCutThreshold && rightDiff <= this.perfectCutThreshold;
    }
    
    // Show commentary overlay with message
    showCommentary(message, duration = 2000) {
        const commentaryOverlay = document.getElementById('commentaryOverlay');
        const commentaryText = document.getElementById('commentaryText');
        
        if (commentaryOverlay && commentaryText) {
            commentaryText.textContent = message;
            commentaryOverlay.style.display = 'flex';
            commentaryOverlay.style.opacity = '1';
            
            // Add animation class
            commentaryOverlay.classList.add('commentary-show');
            
            // Hide after duration
            setTimeout(() => {
                commentaryOverlay.style.opacity = '0';
                setTimeout(() => {
                    commentaryOverlay.style.display = 'none';
                    commentaryOverlay.classList.remove('commentary-show');
                }, 300);
            }, duration);
        }
    }
    
    // Trigger perfect cut celebration animation
    async triggerPerfectCutCelebration(cutLine = null) {
        if (this.celebrationActive) return;
        
        this.celebrationActive = true;
        console.log('🎉 PERFECT CUT CELEBRATION!');
        
        try {
            // Show special perfect cut commentary
            this.showCommentary("PERFECT CUT! 🎯", 3000);
            
            // Create golden burst effect
            this.createGoldenBurst(cutLine);
            
            // Canvas glow effect
            this.addCanvasGlow();
            
            // Confetti effect
            this.createConfetti();
            
            // Perfect cut text animation
            this.showPerfectCutText();
            
            // Play celebration for 3 seconds
            setTimeout(() => {
                this.celebrationActive = false;
                this.cleanupCelebration();
            }, 3000);
            
        } catch (error) {
            console.error('Error in perfect cut celebration:', error);
            this.celebrationActive = false;
        }
    }
    
    // Create golden burst particle effect
    createGoldenBurst(cutLine) {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Create particle container
        const particleContainer = document.createElement('div');
        particleContainer.className = 'perfect-cut-particles';
        particleContainer.style.position = 'fixed';
        particleContainer.style.top = '0';
        particleContainer.style.left = '0';
        particleContainer.style.width = '100%';
        particleContainer.style.height = '100%';
        particleContainer.style.pointerEvents = 'none';
        particleContainer.style.zIndex = '9999';
        document.body.appendChild(particleContainer);
        
        // Create multiple golden particles
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'golden-particle';
            particle.style.position = 'absolute';
            particle.style.width = '8px';
            particle.style.height = '8px';
            particle.style.backgroundColor = '#FFD700';
            particle.style.borderRadius = '50%';
            particle.style.boxShadow = '0 0 10px #FFD700';
            
            // Random position around center
            const angle = (Math.PI * 2 * i) / 20;
            const distance = 50 + Math.random() * 100;
            const startX = centerX + Math.cos(angle) * 20;
            const startY = centerY + Math.sin(angle) * 20;
            const endX = centerX + Math.cos(angle) * distance;
            const endY = centerY + Math.sin(angle) * distance;
            
            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';
            
            // Animate particle
            particle.animate([
                { 
                    left: startX + 'px', 
                    top: startY + 'px', 
                    opacity: 1,
                    transform: 'scale(1)'
                },
                { 
                    left: endX + 'px', 
                    top: endY + 'px', 
                    opacity: 0,
                    transform: 'scale(0)'
                }
            ], {
                duration: 1500,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            });
            
            particleContainer.appendChild(particle);
        }
        
        // Store reference for cleanup
        this.particleContainer = particleContainer;
    }
    
    // Add golden glow to canvas
    addCanvasGlow() {
        const canvas = document.getElementById('geoCanvas');
        if (!canvas) return;
        
        canvas.style.boxShadow = '0 0 30px #FFD700, 0 0 60px rgba(255, 215, 0, 0.5)';
        canvas.style.transition = 'box-shadow 0.5s ease-in-out';
        
        // Store original shadow for cleanup
        this.originalBoxShadow = canvas.style.boxShadow;
    }
    
    // Create confetti falling effect
    createConfetti() {
        const confettiContainer = document.createElement('div');
        confettiContainer.className = 'confetti-container';
        confettiContainer.style.position = 'fixed';
        confettiContainer.style.top = '0';
        confettiContainer.style.left = '0';
        confettiContainer.style.width = '100%';
        confettiContainer.style.height = '100%';
        confettiContainer.style.pointerEvents = 'none';
        confettiContainer.style.zIndex = '9998';
        document.body.appendChild(confettiContainer);
        
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
        
        // Create falling confetti pieces
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'absolute';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-10px';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            
            // Animate falling
            confetti.animate([
                { 
                    top: '-10px', 
                    transform: 'rotate(0deg)',
                    opacity: 1 
                },
                { 
                    top: window.innerHeight + 'px', 
                    transform: 'rotate(720deg)',
                    opacity: 0 
                }
            ], {
                duration: 3000 + Math.random() * 2000,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            });
            
            confettiContainer.appendChild(confetti);
        }
        
        this.confettiContainer = confettiContainer;
    }
    
    // Show perfect cut text animation
    showPerfectCutText() {
        const textElement = document.createElement('div');
        textElement.className = 'perfect-cut-text';
        textElement.innerHTML = '✨ PERFECT CUT! ✨';
        textElement.style.position = 'fixed';
        textElement.style.top = '30%';
        textElement.style.left = '50%';
        textElement.style.transform = 'translate(-50%, -50%)';
        textElement.style.fontSize = '2.5rem';
        textElement.style.fontWeight = 'bold';
        textElement.style.color = '#FFD700';
        textElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        textElement.style.textAlign = 'center';
        textElement.style.zIndex = '10000';
        textElement.style.pointerEvents = 'none';
        document.body.appendChild(textElement);
        
        // Bounce animation
        textElement.animate([
            { 
                transform: 'translate(-50%, -50%) scale(0)',
                opacity: 0
            },
            { 
                transform: 'translate(-50%, -50%) scale(1.2)',
                opacity: 1
            },
            { 
                transform: 'translate(-50%, -50%) scale(1)',
                opacity: 1
            },
            { 
                transform: 'translate(-50%, -50%) scale(0)',
                opacity: 0
            }
        ], {
            duration: 3000,
            easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        });
        
        this.perfectCutText = textElement;
    }
    
    // Clean up celebration effects
    cleanupCelebration() {
        // Remove particle effects
        if (this.particleContainer) {
            this.particleContainer.remove();
            this.particleContainer = null;
        }
        
        if (this.confettiContainer) {
            this.confettiContainer.remove();
            this.confettiContainer = null;
        }
        
        if (this.perfectCutText) {
            this.perfectCutText.remove();
            this.perfectCutText = null;
        }
        
        // Reset canvas glow
        const canvas = document.getElementById('geoCanvas');
        if (canvas) {
            canvas.style.boxShadow = '4px 4px 0px #000000';
            canvas.style.transition = '';
        }
    }
    
    // Process cut result and show appropriate feedback
    processCutResult(leftPercentage, rightPercentage) {
        // Calculate score
        const score = this.calculateCutScore(leftPercentage);
        
        // Check for perfect cut
        const isPerfect = this.isPerfectCut(leftPercentage, rightPercentage);
        
        // Get commentary
        const commentary = this.getCommentaryForScore(score);
        
        // Show celebration if perfect
        if (isPerfect) {
            setTimeout(() => {
                this.triggerPerfectCutCelebration();
            }, 100);
        } else {
            // Show regular commentary
            setTimeout(() => {
                this.showCommentary(commentary);
            }, 500);
        }
        
        return {
            score,
            isPerfect,
            commentary,
            leftPercentage,
            rightPercentage
        };
    }
    
    // Calculate shape average from two attempts
    calculateShapeAverage(attempt1Score, attempt2Score) {
        const scores = [attempt1Score, attempt2Score].filter(s => 
            typeof s === 'number' && !isNaN(s)
        );
        
        if (scores.length === 0) return 0;
        
        const sum = scores.reduce((total, score) => total + score, 0);
        return Number((sum / scores.length).toFixed(1));
    }
    
    // Get all scores from game state
    getAllScores(gameState) {
        const scores = [];
        
        for (let i = 1; i <= 3; i++) {
            const shapeKey = `shape${i}`;
            const shapeResults = gameState.shapeResults[shapeKey];
            
            if (shapeResults) {
                if (shapeResults.attempt1?.score !== undefined) {
                    scores.push(shapeResults.attempt1.score);
                }
                if (shapeResults.attempt2?.score !== undefined) {
                    scores.push(shapeResults.attempt2.score);
                }
            }
        }
        
        return scores;
    }
    
    // Get score summary for display
    getScoreSummary(gameState) {
        const summary = {
            shapes: {},
            totalScores: [],
            dailyAverage: 0,
            perfectCuts: 0,
            isComplete: gameState.isCompleted
        };
        
        for (let i = 1; i <= 3; i++) {
            const shapeKey = `shape${i}`;
            const shapeResults = gameState.shapeResults[shapeKey];
            
            if (shapeResults) {
                const attempt1 = shapeResults.attempt1?.score;
                const attempt2 = shapeResults.attempt2?.score;
                
                summary.shapes[shapeKey] = {
                    attempt1,
                    attempt2,
                    average: this.calculateShapeAverage(attempt1, attempt2)
                };
                
                // Add to total scores
                if (attempt1 !== undefined) {
                    summary.totalScores.push(attempt1);
                    if (shapeResults.attempt1?.isPerfect) {
                        summary.perfectCuts++;
                    }
                }
                if (attempt2 !== undefined) {
                    summary.totalScores.push(attempt2);
                    if (shapeResults.attempt2?.isPerfect) {
                        summary.perfectCuts++;
                    }
                }
            }
        }
        
        // Calculate daily average
        summary.dailyAverage = this.calculateDailyScore(summary.totalScores);
        
        return summary;
    }
}

// Create singleton instance
const scoringSystem = new ScoringSystem();

// Export to window for global access
if (typeof window !== 'undefined') {
    window.ScoringSystem = scoringSystem;
}