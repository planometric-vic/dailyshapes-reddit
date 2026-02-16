/**
 * Weekly Leaderboard UI for Daily Shapes (Reddit/Devvit)
 * Neobrutalist style - bold borders, stark typography, minimal color
 */

(function() {
    var container = document.getElementById('weeklyLeaderboard');
    if (!container) return;

    var currentUsername = '';
    var leaderboardData = [];
    var userScore = 0;
    var userRank = -1;

    function render() {
        var html = '<div class="lb-header">THIS WEEK</div>';
        html += '<div class="lb-table">';

        if (leaderboardData.length === 0) {
            html += '<div class="lb-empty">No scores yet</div>';
        } else {
            for (var i = 0; i < leaderboardData.length; i++) {
                var entry = leaderboardData[i];
                var isUser = entry.username === currentUsername;
                var cls = 'lb-row' + (isUser ? ' lb-row-user' : '') + (i === 0 ? ' lb-row-first' : '');
                html += '<div class="' + cls + '">';
                html += '<span class="lb-rank">' + entry.rank + '</span>';
                html += '<span class="lb-name">' + escapeHtml(truncName(entry.username)) + '</span>';
                html += '<span class="lb-score">' + entry.score + '</span>';
                html += '</div>';
            }
        }

        html += '</div>';

        // Show user's row at bottom if not in top 20
        var userInTop = false;
        for (var j = 0; j < leaderboardData.length; j++) {
            if (leaderboardData[j].username === currentUsername) {
                userInTop = true;
                break;
            }
        }

        if (!userInTop && currentUsername && userRank > 0) {
            html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user">';
            html += '<span class="lb-rank">' + userRank + '</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">' + userScore + '</span>';
            html += '</div>';
        } else if (!userInTop && currentUsername) {
            html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user lb-row-norank">';
            html += '<span class="lb-rank">-</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">0</span>';
            html += '</div>';
        }

        container.innerHTML = html;
    }

    function truncName(name) {
        return name.length > 14 ? name.substring(0, 13) + '\u2026' : name;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Public API
    window.WeeklyLeaderboard = {
        /** Store data and re-render (but don't change visibility) */
        update: function(data) {
            if (data.username) currentUsername = data.username;
            if (data.weeklyLeaderboard) leaderboardData = data.weeklyLeaderboard;
            if (data.userWeeklyScore !== undefined) userScore = data.userWeeklyScore;
            if (data.userWeeklyRank !== undefined) userRank = data.userWeeklyRank;
            render();
        },
        /** Show the leaderboard (after game completion) */
        show: function() {
            render();
            container.style.display = 'block';
            // Hide game controls since we're in the completion view
            var els = ['demoProgressDisplay', 'fixedPercentageArea', 'fixedButtonArea'];
            for (var i = 0; i < els.length; i++) {
                var el = document.getElementById(els[i]);
                if (el) el.style.display = 'none';
            }
        },
        /** Hide the leaderboard (during gameplay) */
        hide: function() {
            container.style.display = 'none';
        },
        refresh: function() {
            if (window.DevvitBridge) {
                window.DevvitBridge.getWeeklyLeaderboard().then(function(data) {
                    if (data) {
                        leaderboardData = data.weeklyLeaderboard || [];
                        userScore = data.userWeeklyScore || 0;
                        userRank = data.userWeeklyRank || -1;
                        render();
                    }
                });
            }
        }
    };

    // Listen for init data - store but don't show (leaderboard hidden during gameplay)
    window.addEventListener('devvit-init', function(e) {
        var d = e.detail;
        currentUsername = d.username || '';
        leaderboardData = d.weeklyLeaderboard || [];
        userScore = d.userWeeklyScore || 0;
        userRank = d.userWeeklyRank || -1;
        // Pre-render content but keep container hidden
        render();
    });

    // Listen for score saved (includes updated leaderboard data)
    window.addEventListener('devvit-score-saved', function(e) {
        var d = e.detail;
        if (d.weeklyLeaderboard) leaderboardData = d.weeklyLeaderboard;
        if (d.userWeeklyScore !== undefined) userScore = d.userWeeklyScore;
        if (d.userWeeklyRank !== undefined) userRank = d.userWeeklyRank;
        // Update data but don't show - wait for game completion
        render();
    });

    // Listen for explicit weekly leaderboard response
    window.addEventListener('devvit-weekly-leaderboard', function(e) {
        var d = e.detail;
        if (d.weeklyLeaderboard) leaderboardData = d.weeklyLeaderboard;
        if (d.userWeeklyScore !== undefined) userScore = d.userWeeklyScore;
        if (d.userWeeklyRank !== undefined) userRank = d.userWeeklyRank;
        render();
    });
})();
