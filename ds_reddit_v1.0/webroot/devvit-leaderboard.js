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

    /** Compute "FEB 16 \u2013 FEB 22, 2026" for the current Mon\u2013Sun week */
    function getWeekDateRange() {
        var now = new Date();
        var day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
        var diffToMon = day === 0 ? -6 : 1 - day;
        var monday = new Date(now);
        monday.setDate(now.getDate() + diffToMon);
        var sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        var monStr = months[monday.getMonth()] + ' ' + monday.getDate();
        var sunStr = months[sunday.getMonth()] + ' ' + sunday.getDate();
        var year = sunday.getFullYear();
        return monStr + ' \u2013 ' + sunStr + ', ' + year;
    }

    var weekDateRange = getWeekDateRange();

    var tabConfig = {
        weekly: { title: 'WEEKLY COMP (MONDAY \u2013 SUNDAY)', subtitle: weekDateRange, label: 'Scores' },
        wins:   { title: 'GAMES WON', subtitle: weekDateRange, label: 'Wins' },
        cuts:   { title: 'PERFECT CUTS', subtitle: weekDateRange, label: 'Perfect Cuts' }
    };

    var MIN_ROWS = 10; // fixed row count so all tabs look identical

    function renderTable(tabKey) {
        var t = tabs[tabKey];
        var html = '';
        var rowCount = 0;

        // Data rows
        for (var i = 0; i < t.data.length; i++) {
            var entry = t.data[i];
            var isUser = entry.username === currentUsername;
            var cls = 'lb-row' + (isUser ? ' lb-row-user' : '') + (i === 0 ? ' lb-row-first' : '');
            html += '<div class="' + cls + '">';
            html += '<span class="lb-rank">' + entry.rank + '</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(entry.username)) + '</span>';
            html += '<span class="lb-score">' + Math.round(entry.score) + '</span>';
            html += '</div>';
            rowCount++;
        }

        // User row at bottom if not in top entries
        var userInTop = false;
        for (var j = 0; j < t.data.length; j++) {
            if (t.data[j].username === currentUsername) {
                userInTop = true;
                break;
            }
        }

        if (!userInTop && currentUsername && t.userRank > 0) {
            // Only show separator when there are data rows above
            if (t.data.length > 0) html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user">';
            html += '<span class="lb-rank">' + t.userRank + '</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">' + Math.round(t.userScore) + '</span>';
            html += '</div>';
            rowCount++;
        } else if (!userInTop && currentUsername) {
            // Only show separator when there are data rows above
            if (t.data.length > 0) html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user lb-row-norank">';
            html += '<span class="lb-rank">-</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">0</span>';
            html += '</div>';
            rowCount++;
        }

        // Pad with empty rows so every tab has the same height
        for (var k = rowCount; k < MIN_ROWS; k++) {
            html += '<div class="lb-row lb-row-empty">';
            html += '<span class="lb-rank">&nbsp;</span>';
            html += '<span class="lb-name">&nbsp;</span>';
            html += '<span class="lb-score">&nbsp;</span>';
            html += '</div>';
        }

        return html;
    }

    function render() {
        var cfg = tabConfig[activeTab];
        // Header with close button (close only visible in mobile modal mode via CSS)
        var html = '<div class="lb-header">' + cfg.title;
        html += '<button class="lb-close-btn">&times;</button>';
        html += '<div class="lb-subtitle">' + cfg.subtitle + '</div>';
        html += '</div>';

        // Table body (padded to MIN_ROWS)
        html += '<div class="lb-table">';
        html += renderTable(activeTab);
        html += '</div>';

        // Tab buttons — always at the bottom
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

        // Bind close button
        var closeBtn = container.querySelector('.lb-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                window.WeeklyLeaderboard.hide();
            });
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
            container.style.display = 'flex';

            if (window.innerWidth < 600) {
                // Mobile: show as modal popup
                container.classList.add('lb-modal-mode');
                if (!document.querySelector('.lb-backdrop')) {
                    var backdrop = document.createElement('div');
                    backdrop.className = 'lb-backdrop';
                    backdrop.addEventListener('click', function() {
                        window.WeeklyLeaderboard.hide();
                    });
                    document.body.appendChild(backdrop);
                }
            } else {
                // Desktop: match leaderboard height to canvas
                var canvas = document.getElementById('geoCanvas');
                if (canvas) {
                    container.style.height = canvas.offsetHeight + 'px';
                }
            }

            // Hide game controls since we're in the completion view
            var els = ['demoProgressDisplay', 'fixedPercentageArea', 'fixedButtonArea'];
            for (var i = 0; i < els.length; i++) {
                var el = document.getElementById(els[i]);
                if (el) el.style.display = 'none';
            }
        },
        hide: function() {
            container.style.display = 'none';
            container.style.height = '';
            container.classList.remove('lb-modal-mode');
            var backdrop = document.querySelector('.lb-backdrop');
            if (backdrop) backdrop.remove();
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
