/**
 * Leaderboard UI for Daily Shapes (Reddit/Devvit)
 * Three tabs: Weekly Comp, Games Won, Perfect Cuts
 * Neobrutalist style - bold borders, stark typography, minimal color
 */

(function() {
    var container = document.getElementById('weeklyLeaderboard');
    if (!container) return;

    var currentUsername = '';
    var activeTab = 'weekly';

    // Data for each tab
    var tabs = {
        weekly: { data: [], userScore: 0, userRank: -1 },
        wins:   { data: [], userScore: 0, userRank: -1 },
        cuts:   { data: [], userScore: 0, userRank: -1 }
    };

    var tabConfig = {
        weekly: { title: 'WEEKLY COMP', subtitle: 'MONDAY \u2013 SUNDAY', label: 'Scores' },
        wins:   { title: 'GAMES WON', subtitle: '', label: 'Wins' },
        cuts:   { title: 'PERFECT CUTS', subtitle: '', label: 'Perfect' }
    };

    function renderTable(tabKey) {
        var t = tabs[tabKey];
        var html = '';

        if (t.data.length === 0) {
            html += '<div class="lb-empty">No scores yet</div>';
        } else {
            for (var i = 0; i < t.data.length; i++) {
                var entry = t.data[i];
                var isUser = entry.username === currentUsername;
                var cls = 'lb-row' + (isUser ? ' lb-row-user' : '') + (i === 0 ? ' lb-row-first' : '');
                html += '<div class="' + cls + '">';
                html += '<span class="lb-rank">' + entry.rank + '</span>';
                html += '<span class="lb-name">' + escapeHtml(truncName(entry.username)) + '</span>';
                html += '<span class="lb-score">' + Math.round(entry.score) + '</span>';
                html += '</div>';
            }
        }

        // User row at bottom if not in top 20
        var userInTop = false;
        for (var j = 0; j < t.data.length; j++) {
            if (t.data[j].username === currentUsername) {
                userInTop = true;
                break;
            }
        }

        if (!userInTop && currentUsername && t.userRank > 0) {
            html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user">';
            html += '<span class="lb-rank">' + t.userRank + '</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">' + Math.round(t.userScore) + '</span>';
            html += '</div>';
        } else if (!userInTop && currentUsername) {
            html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user lb-row-norank">';
            html += '<span class="lb-rank">-</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">0</span>';
            html += '</div>';
        }

        return html;
    }

    function render() {
        var cfg = tabConfig[activeTab];
        var html = '<div class="lb-header">' + cfg.title;
        if (cfg.subtitle) {
            html += '<div class="lb-subtitle">' + cfg.subtitle + '</div>';
        }
        html += '</div>';

        html += '<div class="lb-table">';
        html += renderTable(activeTab);
        html += '</div>';

        // Tab buttons
        html += '<div class="lb-tabs">';
        var tabKeys = ['weekly', 'wins', 'cuts'];
        for (var i = 0; i < tabKeys.length; i++) {
            var key = tabKeys[i];
            var isActive = activeTab === key;
            html += '<button class="lb-tab' + (isActive ? ' lb-tab-active' : '') + '" data-tab="' + key + '">';
            html += tabConfig[key].label;
            html += '</button>';
        }
        html += '</div>';

        container.innerHTML = html;

        // Bind tab click events
        var tabBtns = container.querySelectorAll('.lb-tab');
        for (var j = 0; j < tabBtns.length; j++) {
            tabBtns[j].addEventListener('click', handleTabClick);
        }
    }

    function handleTabClick(e) {
        activeTab = e.currentTarget.getAttribute('data-tab');
        render();
    }

    function truncName(name) {
        return name.length > 14 ? name.substring(0, 13) + '\u2026' : name;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /** Update all tab data from a response object */
    function updateFromData(d) {
        if (d.username) currentUsername = d.username;
        if (d.weeklyLeaderboard) tabs.weekly.data = d.weeklyLeaderboard;
        if (d.userWeeklyScore !== undefined) tabs.weekly.userScore = d.userWeeklyScore;
        if (d.userWeeklyRank !== undefined) tabs.weekly.userRank = d.userWeeklyRank;
        if (d.weeklyWins) tabs.wins.data = d.weeklyWins;
        if (d.userWeeklyWins !== undefined) tabs.wins.userScore = d.userWeeklyWins;
        if (d.userWeeklyWinsRank !== undefined) tabs.wins.userRank = d.userWeeklyWinsRank;
        if (d.perfectCuts) tabs.cuts.data = d.perfectCuts;
        if (d.userPerfectCuts !== undefined) tabs.cuts.userScore = d.userPerfectCuts;
        if (d.userPerfectCutsRank !== undefined) tabs.cuts.userRank = d.userPerfectCutsRank;
    }

    // Public API
    window.WeeklyLeaderboard = {
        update: function(data) {
            updateFromData(data);
            render();
        },
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
        hide: function() {
            container.style.display = 'none';
        },
        refresh: function() {
            if (window.DevvitBridge) {
                window.DevvitBridge.getWeeklyLeaderboard().then(function(data) {
                    if (data) {
                        updateFromData(data);
                        render();
                    }
                });
            }
        }
    };

    // Listen for init data - store but don't show
    window.addEventListener('devvit-init', function(e) {
        updateFromData(e.detail);
        render();
    });

    // Listen for score saved
    window.addEventListener('devvit-score-saved', function(e) {
        updateFromData(e.detail);
        render();
    });

    // Listen for explicit leaderboard response
    window.addEventListener('devvit-weekly-leaderboard', function(e) {
        updateFromData(e.detail);
        render();
    });
})();
