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
    var ROW_HEIGHT = 19; // estimated px per row (padding 4 + font ~14 + border 1)
    var computedMaxRows = 12; // will be recalculated on show()

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
        weekly: { title: 'WEEKLY COMP (MON-SUN)', subtitle: weekDateRange, label: 'Scores' },
        wins:   { title: 'GAMES WON', subtitle: weekDateRange, label: 'Wins' },
        cuts:   { title: 'PERFECT CUTS', subtitle: weekDateRange, label: 'Perfect Cuts' }
    };

    /** Calculate how many rows fit by measuring actual rendered elements */
    function calculateMaxRows(containerHeight) {
        // Measure actual header and tabs heights from the rendered DOM
        var header = container.querySelector('.lb-header');
        var tabsEl = container.querySelector('.lb-tabs');
        var headerHeight = header ? header.getBoundingClientRect().height : 40;
        var tabsHeight = tabsEl ? tabsEl.getBoundingClientRect().height : 30;
        var availableHeight = containerHeight - headerHeight - tabsHeight;
        if (availableHeight < ROW_HEIGHT) return 3; // minimum
        // +1 row: rows flex-grow to fill the table, so we can fit one more
        return Math.floor(availableHeight / ROW_HEIGHT) + 1;
    }

    function renderTable(tabKey) {
        var t = tabs[tabKey];
        var html = '';
        var maxRows = computedMaxRows;

        // For wins and cuts tabs: determine shared row count (max of both data lengths)
        // and show empty rows if no data, but always match each other's row count
        var isStatTab = (tabKey === 'wins' || tabKey === 'cuts');
        if (isStatTab) {
            var winsLen = tabs.wins.data.length;
            var cutsLen = tabs.cuts.data.length;
            var sharedDataLen = Math.max(winsLen, cutsLen);
            // If neither tab has data, both show all empty rows
            if (sharedDataLen === 0) {
                for (var e = 0; e < maxRows; e++) {
                    html += '<div class="lb-row lb-row-empty">';
                    html += '<span class="lb-rank">&nbsp;</span>';
                    html += '<span class="lb-name">&nbsp;</span>';
                    html += '<span class="lb-score">&nbsp;</span>';
                    html += '</div>';
                }
                return html;
            }
        }

        // Check if user is already in the data
        var userInTop = false;
        var userDataIndex = -1;
        for (var j = 0; j < t.data.length; j++) {
            if (t.data[j].username === currentUsername) {
                userInTop = true;
                userDataIndex = j;
                break;
            }
        }

        // Determine how many data rows to show
        var needsUserRow = !userInTop && currentUsername;
        // Reserve one slot for user row + separator if user not in top
        var dataSlots = needsUserRow ? Math.max(1, maxRows - 1) : maxRows;
        var dataToShow = Math.min(t.data.length, dataSlots);

        // If user IS in the data but beyond visible range, expand to include them
        if (userInTop && userDataIndex >= dataSlots) {
            dataToShow = Math.min(t.data.length, maxRows);
        }

        // For stat tabs, ensure both tabs render the same total row count
        var targetRows = maxRows;
        if (isStatTab) {
            var winsRows = tabs.wins.data.length;
            var cutsRows = tabs.cuts.data.length;
            var maxDataRows = Math.max(winsRows, cutsRows);
            // Both tabs use the same target: max data rows + user row if needed, capped at maxRows
            if (needsUserRow) {
                targetRows = Math.min(Math.max(maxDataRows + 1, 2), maxRows);
            } else {
                targetRows = Math.min(Math.max(maxDataRows, 1), maxRows);
            }
        }

        var rowCount = 0;

        // Data rows
        for (var i = 0; i < dataToShow; i++) {
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
        if (!userInTop && currentUsername && t.userRank > 0) {
            // Pad with empty rows to push user to the bottom
            for (var k = rowCount; k < targetRows - 1; k++) {
                html += '<div class="lb-row lb-row-empty">';
                html += '<span class="lb-rank">&nbsp;</span>';
                html += '<span class="lb-name">&nbsp;</span>';
                html += '<span class="lb-score">&nbsp;</span>';
                html += '</div>';
                rowCount++;
            }
            if (t.data.length > 0) html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user">';
            html += '<span class="lb-rank">' + t.userRank + '</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">' + Math.round(t.userScore) + '</span>';
            html += '</div>';
            rowCount++;
        } else if (!userInTop && currentUsername && !isStatTab) {
            // User with no rank yet (only for weekly scores tab, not wins/cuts)
            for (var k2 = rowCount; k2 < targetRows - 1; k2++) {
                html += '<div class="lb-row lb-row-empty">';
                html += '<span class="lb-rank">&nbsp;</span>';
                html += '<span class="lb-name">&nbsp;</span>';
                html += '<span class="lb-score">&nbsp;</span>';
                html += '</div>';
                rowCount++;
            }
            if (t.data.length > 0) html += '<div class="lb-separator"></div>';
            html += '<div class="lb-row lb-row-user lb-row-norank">';
            html += '<span class="lb-rank">-</span>';
            html += '<span class="lb-name">' + escapeHtml(truncName(currentUsername)) + '</span>';
            html += '<span class="lb-score">0</span>';
            html += '</div>';
            rowCount++;
        } else {
            // User is in top or no user - pad remaining with empty rows
            for (var k3 = rowCount; k3 < targetRows; k3++) {
                html += '<div class="lb-row lb-row-empty">';
                html += '<span class="lb-rank">&nbsp;</span>';
                html += '<span class="lb-name">&nbsp;</span>';
                html += '<span class="lb-score">&nbsp;</span>';
                html += '</div>';
            }
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

        // Table body
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

    /** Measure actual row height from a rendered row element */
    function measureRowHeight() {
        var row = container.querySelector('.lb-row');
        if (row) {
            var h = row.getBoundingClientRect().height;
            if (h > 0) ROW_HEIGHT = h;
        }
    }

    // Public API
    window.WeeklyLeaderboard = {
        update: function(data) {
            updateFromData(data);
            render();
        },
        show: function() {
            // Initial render with default row count
            render();
            container.style.display = 'flex';

            // Hide game controls first so layout settles correctly
            var els = ['demoProgressDisplay', 'fixedPercentageArea', 'fixedButtonArea'];
            for (var i = 0; i < els.length; i++) {
                var el = document.getElementById(els[i]);
                if (el) el.style.display = 'none';
            }

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
                // Desktop: CSS align-self:stretch fills the grid area to match canvas.
                // After layout settles, measure the container and calculate row count.
                requestAnimationFrame(function() {
                    var actualHeight = container.offsetHeight;
                    if (actualHeight > 0) {
                        measureRowHeight();
                        computedMaxRows = calculateMaxRows(actualHeight);
                        render();
                    }
                });
            }
        },
        hide: function() {
            container.style.display = 'none';
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
