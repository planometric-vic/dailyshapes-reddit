// Perfect Cut v2.0 - Shape Type Handlers
// Handles different puzzle types and scoring logic

class ShapeTypeHandler {
    static getShapeConfig(shapeIndex) {
        return PUZZLE_CONFIG.puzzle_types[shapeIndex] || PUZZLE_CONFIG.puzzle_types[1];
    }
    
    static getGoalText(shapeIndex) {
        const config = this.getShapeConfig(shapeIndex);
        switch(shapeIndex) {
            case 1:
                return 'Goal: Make <strong>one cut</strong> to divide the grey shapes into <strong>two equal areas</strong>';
            case 2:
                // Generate random target ratio for Shape 2, show smaller percentage
                const ratio = this.getShape2Ratio();
                const smallerPercentage = Math.min(ratio.left, ratio.right);
                return `Goal: Make <strong>one cut</strong> so that <strong>${smallerPercentage}%</strong> of the grey shapes are on one side`;
            case 3:
                return 'Goal: Make <strong>two cuts</strong> to divide the grey shapes into <strong>four equal areas</strong>';
            default:
                return 'Goal: Make <strong>one cut</strong> to divide the grey shapes into <strong>two equal areas</strong>';
        }
    }
    
    static getShape2Ratio() {
        // Generate consistent ratio based on local date for Shape 2
        const localDate = DateUtils.getCurrentLocalDate();
        const seed = this.hashCode(localDate + '_shape2');
        const random = this.seededRandom(seed);
        
        // Generate ratios like 90/10, 80/20, 75/25, etc.
        const ratios = [
            { left: 90, right: 10 },
            { left: 80, right: 20 },
            { left: 75, right: 25 },
            { left: 70, right: 30 },
            { left: 65, right: 35 },
            { left: 60, right: 40 }
        ];
        
        const index = Math.floor(random * ratios.length);
        return ratios[index];
    }
    
    static calculateScore(shapeIndex, leftPercentage, rightPercentage, cutsPerformed = 1) {
        switch(shapeIndex) {
            case 1:
                return this.calculateShape1Score(leftPercentage, rightPercentage);
            case 2:
                return this.calculateShape2Score(leftPercentage, rightPercentage);
            case 3:
                return this.calculateShape3Score(leftPercentage, rightPercentage, cutsPerformed);
            default:
                return this.calculateShape1Score(leftPercentage, rightPercentage);
        }
    }
    
    static calculateShape1Score(leftPercentage, rightPercentage) {
        // Standard 50/50 scoring
        const perfect = 50.0;
        const error = Math.abs(leftPercentage - perfect);

        // Perfect split detection: if very close to 50/50, award exact 100
        if (error <= 0.05) {  // Within 0.05% of perfect
            return 100.0;
        }

        const score = Math.max(0, 100 - (error * 2));
        return Math.round(score * 10) / 10;
    }
    
    static calculateShape2Score(leftPercentage, rightPercentage) {
        // Variable ratio scoring with bidirectional support
        const targetRatio = this.getShape2Ratio();
        const targetLeft = targetRatio.left;
        const targetRight = targetRatio.right;
        
        // Calculate error for both possible orientations
        // Option 1: left matches targetLeft, right matches targetRight
        const option1Error = Math.abs(leftPercentage - targetLeft) + Math.abs(rightPercentage - targetRight);
        
        // Option 2: left matches targetRight, right matches targetLeft (bidirectional)
        const option2Error = Math.abs(leftPercentage - targetRight) + Math.abs(rightPercentage - targetLeft);
        
        // Use the better of the two orientations
        const bestError = Math.min(option1Error, option2Error) / 2;
        
        const score = Math.max(0, 100 - (bestError * 2));
        return Math.round(score * 10) / 10;
    }
    
    static calculateShape3Score(leftPercentage, rightPercentage, cutsPerformed) {
        // Legacy support for backward compatibility
        if (cutsPerformed < 2) {
            return 0; // No score until both cuts are made
        }
        
        // Simplified scoring for backward compatibility
        const target = 25.0;
        const quarters = [leftPercentage, rightPercentage, 25, 25]; // Approximate for legacy calls
        
        // Calculate average error from 25% target
        let totalError = 0;
        quarters.forEach(quarter => {
            totalError += Math.abs(quarter - target);
        });
        
        const avgError = totalError / quarters.length;
        const score = Math.max(0, 100 - (avgError * 2));
        return Math.round(score * 10) / 10;
    }
    
    static calculateShape3ScoreWithQuadrants(quadrantPercentages) {
        // Real Shape 3 scoring with four quadrants
        const target = 25.0;
        const quarters = [
            quadrantPercentages.q1,
            quadrantPercentages.q2,
            quadrantPercentages.q3,
            quadrantPercentages.q4
        ];
        
        // Calculate average deviation from perfect 25% for each quadrant
        let totalError = 0;
        quarters.forEach(quarter => {
            totalError += Math.abs(quarter - target);
        });
        
        const avgError = totalError / quarters.length;
        const score = Math.max(0, 100 - (avgError * 2));
        return Math.round(score * 10) / 10;
    }
    
    static getCommentary(shapeIndex, score) {
        if (score === 100.0) {
            const messages = ["Perfect cut! 🥇", "Dead centre! 🎯", "Flawless! ✨"];
            return messages[Math.floor(Math.random() * messages.length)];
        } else if (score >= 98.0) {
            const messages = ["So close! 🔍", "Sharp eye! 👁️", "Almost perfect! ⭐"];
            return messages[Math.floor(Math.random() * messages.length)];
        } else if (score >= 90.0) {
            const messages = ["Nice slice! ✂️", "Not bad! 😎", "Good work! 👍"];
            return messages[Math.floor(Math.random() * messages.length)];
        } else {
            const messages = ["Good try! 💪", "Next one's yours! 🎲", "Keep going! 🚀"];
            return messages[Math.floor(Math.random() * messages.length)];
        }
    }
    
    static shouldShowResult(shapeIndex, cutsPerformed) {
        const config = this.getShapeConfig(shapeIndex);
        return cutsPerformed >= config.cuts;
    }
    
    static getProgressText(shapeIndex, totalShapes = 10) {
        return `Shape ${shapeIndex} of ${totalShapes}`;
    }
    
    // Utility functions for consistent random generation
    static hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    
    static seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
}

// Export for module systems or global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShapeTypeHandler;
} else {
    window.ShapeTypeHandler = ShapeTypeHandler;
}

// Log successful loading
console.log('✅ ShapeTypeHandler loaded successfully');