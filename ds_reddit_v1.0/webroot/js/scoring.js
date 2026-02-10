/**
 * Scoring system for Daily Shapes.
 *
 * Scoring rules:
 *   - Per attempt: score = the smaller of the two percentage halves (0-50)
 *   - Perfect 50/50 bonus: +50 points (total 100 for a perfect cut)
 *   - 3 shapes x 2 attempts = 6 total attempts
 *   - Max possible score: 600 (6 perfect cuts)
 */

const Scoring = {
    /**
     * Calculate score for a single cut.
     * @param {number} leftPercentage - Percentage of shape on left/smaller side
     * @param {number} rightPercentage - Percentage of shape on right/larger side
     * @returns {number} Score for this cut (0-100)
     */
    calculateCutScore(leftPercentage, rightPercentage) {
        const leftRounded = Math.round(leftPercentage);
        const rightRounded = Math.round(rightPercentage);

        // Perfect cut: both sides round to exactly 50
        if (leftRounded === 50 && rightRounded === 50) {
            return 100; // 50 base + 50 bonus
        }

        // Score is the smaller of the two rounded percentages
        return Math.min(leftRounded, rightRounded);
    },

    /**
     * Check if a cut is perfect (50/50).
     * @param {number} leftPercentage
     * @param {number} rightPercentage
     * @returns {boolean}
     */
    isPerfectCut(leftPercentage, rightPercentage) {
        return Math.round(leftPercentage) === 50 && Math.round(rightPercentage) === 50;
    },

    /**
     * Get commentary text for a score.
     * @param {number} score - The cut score (0-100)
     * @returns {string} Commentary text
     */
    getCommentary(score) {
        if (score === 100) return 'PERFECT CUT!!!';
        if (score >= 49) return 'Amazing!';
        if (score >= 47) return 'Excellent!';
        if (score >= 45) return 'Great job!';
        if (score >= 42) return 'Nice cut!';
        if (score >= 38) return 'Good effort!';
        if (score >= 33) return 'Not bad!';
        if (score >= 25) return 'Keep trying!';
        return 'Shapes can be hard...';
    },

    /**
     * Calculate the total score for a completed day.
     * @param {number[]} cutScores - Array of scores for each cut attempt
     * @returns {number} Total score
     */
    calculateDayTotal(cutScores) {
        return cutScores.reduce((sum, score) => sum + score, 0);
    },

    /**
     * Format a percentage for display.
     * @param {number} percentage
     * @returns {string}
     */
    formatPercentage(percentage) {
        return Math.round(percentage) + '%';
    },

    /**
     * Format a score for display.
     * @param {number} score
     * @returns {string}
     */
    formatScore(score) {
        return String(score);
    }
};

window.Scoring = Scoring;
