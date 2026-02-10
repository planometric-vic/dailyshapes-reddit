/**
 * Daily Shapes v4.0 Competition UI Components
 * Handles competition builder, leaderboards, and competition interface
 */

class CompetitionUI {
    constructor() {
        this.currentView = 'competitions';
        this.selectedCompetition = null;
        this.leaderboardCache = new Map();
        this.refreshInterval = null;
    }

    /**
     * Initialize competition UI
     */
    initialize() {
        console.log('🎨 Initializing Competition UI...');
        this.createCompetitionStyles();
        this.setupEventListeners();
        console.log('✅ Competition UI initialized');
    }

    /**
     * Create CSS styles for competition interface
     */
    createCompetitionStyles() {
        const styles = `
            .competition-container {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 1000px;
                max-height: 80vh;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 1000;
                display: none;
                flex-direction: column;
                font-family: 'Arial', sans-serif;
                overflow: hidden;
            }

            .competition-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 999;
                display: none;
            }

            .competition-header {
                background: #2a5298;
                color: white;
                padding: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
            }

            .competition-title {
                color: white;
                font-size: 28px;
                font-weight: bold;
                margin: 0;
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                text-align: center;
            }

            .close-competition {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.3s ease;
                margin-left: auto;
                z-index: 1;
            }

            .close-competition:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
            }

            .competition-content {
                padding: 30px;
                overflow-y: visible;
                flex: 1;
                max-width: 1200px;
                margin: 0 auto;
            }

            .competition-nav {
                display: flex;
                gap: 15px;
                margin-bottom: 30px;
                justify-content: center;
            }

            .nav-button {
                background: #e0e0e0;
                border: none;
                color: #333;
                padding: 15px 25px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.3s ease;
                min-width: 150px;
            }

            .nav-button:hover, .nav-button.active {
                background: #d0d0d0;
                transform: translateY(-3px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }

            .competition-section {
                background: rgba(255, 255, 255, 0.95);
                border-radius: 15px;
                padding: 30px;
                margin-bottom: 20px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                display: none;
            }

            .competition-section.active {
                display: block;
                animation: fadeIn 0.5s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .section-title {
                color: #2a5298;
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 20px;
                text-align: center;
            }

            .competition-card {
                background: white;
                border: 2px solid #e0e0e0;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 15px;
                transition: all 0.3s ease;
                cursor: pointer;
            }

            .competition-card:hover {
                border-color: #2a5298;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(42, 82, 152, 0.1);
            }

            .competition-card.global {
                background: linear-gradient(135deg, #ffd700, #ffed4e);
                border-color: #ffb300;
            }

            .competition-card.global .card-title {
                color: #b8860b;
            }

            .card-title {
                font-size: 20px;
                font-weight: bold;
                color: #2a5298;
                margin-bottom: 10px;
            }

            .card-description {
                color: #666;
                margin-bottom: 15px;
                line-height: 1.5;
            }

            .card-meta {
                display: flex;
                flex-direction: column;
                gap: 6px;
                font-size: 14px;
                color: #888;
                margin-top: 10px;
            }

            .card-participants {
                background: #e8f4fd;
                color: #2a5298;
                padding: 5px 12px;
                border-radius: 15px;
                font-weight: bold;
            }

            .leaderboard-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                background: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                font-size: 14px;
                max-height: 500px;
                overflow-y: visible;
                display: block;
            }

            .leaderboard-table thead,
            .leaderboard-table tbody {
                display: table;
                width: 100%;
                table-layout: fixed;
            }

            .leaderboard-table th,
            .leaderboard-table td {
                padding: 12px 8px;
                text-align: left;
                border-bottom: 1px solid #eee;
                vertical-align: middle;
            }

            .leaderboard-table th {
                background: linear-gradient(135deg, #2a5298, #1e3c72);
                color: white;
                font-weight: bold;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                position: sticky;
                top: 0;
                z-index: 10;
                border-bottom: 2px solid #1e3c72;
            }

            .leaderboard-table tbody tr:nth-child(even) {
                background: #f8f9fa;
            }

            .leaderboard-table tbody tr:hover {
                background: #e3f2fd;
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(42, 82, 152, 0.1);
                transition: all 0.2s ease;
            }

            .leaderboard-table .top-three {
                background: linear-gradient(135deg, #fff3e0, #ffeb3b);
                font-weight: bold;
            }

            .leaderboard-table .top-three:hover {
                background: linear-gradient(135deg, #ffe0b2, #ffeb3b);
            }

            .rank-cell {
                width: 60px;
                font-weight: bold;
                font-size: 16px;
                text-align: center;
                color: #2a5298;
            }

            .award-cell {
                width: 50px;
                text-align: center;
                font-size: 20px;
            }

            .username-cell {
                width: 150px;
                font-weight: bold;
                color: #2a5298;
                padding-left: 12px;
            }

            .score-cell {
                width: 90px;
                text-align: center;
                font-weight: bold;
                color: #28a745;
                font-size: 15px;
            }

            .total-score-cell {
                width: 100px;
                text-align: center;
                font-weight: bold;
                color: #1976d2;
                font-size: 15px;
            }

            .days-cell {
                width: 80px;
                text-align: center;
                color: #666;
                font-size: 13px;
            }

            .builder-form {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 20px;
            }

            .form-group {
                margin-bottom: 20px;
            }

            .form-group.full-width {
                grid-column: 1 / -1;
            }

            .form-label {
                display: block;
                margin-bottom: 8px;
                font-weight: bold;
                color: #2a5298;
            }

            .form-input,
            .form-textarea,
            .form-select {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.3s ease;
                box-sizing: border-box;
            }

            .form-input:focus,
            .form-textarea:focus,
            .form-select:focus {
                border-color: #2a5298;
                outline: none;
            }

            .form-textarea {
                resize: vertical;
                min-height: 100px;
            }

            .form-checkbox {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
            }

            .form-checkbox input {
                width: 20px;
                height: 20px;
            }

            .create-button {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 25px;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 100%;
                margin-top: 20px;
            }

            .create-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3);
            }

            .create-button:disabled {
                background: #ccc;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .join-link-container {
                background: #f8f9fa;
                border: 2px dashed #2a5298;
                border-radius: 10px;
                padding: 20px;
                margin-top: 20px;
                text-align: center;
            }

            .join-link-input {
                width: 100%;
                padding: 10px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-family: monospace;
                font-size: 14px;
                margin: 10px 0;
            }

            .copy-link-button {
                background: #17a2b8;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            }

            .copy-link-button:hover {
                background: #138496;
            }

            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #2a5298;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 10px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .empty-state {
                text-align: center;
                padding: 40px;
                color: #666;
            }

            .empty-state-icon {
                font-size: 48px;
                margin-bottom: 15px;
                opacity: 0.5;
            }

            @media (max-width: 768px) {
                .competition-content {
                    padding: 15px;
                }
                
                .builder-form {
                    grid-template-columns: 1fr;
                }
                
                .competition-nav {
                    flex-direction: column;
                    align-items: center;
                }
                
                .nav-button {
                    width: 100%;
                    max-width: 250px;
                }
            }

            /* Responsive leaderboard table fixes */
            @media screen and (max-width: 767px) {
                .rank-cell {
                    width: 45px !important;
                    font-size: 0.75rem !important;
                    padding: 6px 3px !important;
                }

                .award-cell {
                    width: 35px !important;
                    font-size: 0.85rem !important;
                    padding: 6px 3px !important;
                }

                .username-cell {
                    width: 80px !important;
                    max-width: 80px !important;
                    font-size: 0.75rem !important;
                    padding: 6px 4px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                }

                .total-score-cell,
                .score-cell {
                    width: 95px !important;
                    min-width: 95px !important;
                    font-size: 0.75rem !important;
                    padding: 6px 8px 6px 4px !important;
                    text-align: right !important;
                }

                .days-cell {
                    width: 40px !important;
                    font-size: 0.7rem !important;
                    padding: 6px 3px !important;
                }
            }

            @media screen and (max-width: 480px) {
                .rank-cell {
                    width: 30px !important;
                    font-size: 0.65rem !important;
                    padding: 4px 2px !important;
                }

                .award-cell {
                    width: 25px !important;
                    font-size: 0.75rem !important;
                    padding: 4px 1px !important;
                }

                .username-cell {
                    width: 65px !important;
                    max-width: 65px !important;
                    font-size: 0.65rem !important;
                    padding: 4px 3px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                }

                .total-score-cell,
                .score-cell {
                    width: 100px !important;
                    min-width: 100px !important;
                    font-size: 0.65rem !important;
                    padding: 4px 8px 4px 3px !important;
                    text-align: right !important;
                }

                .days-cell {
                    display: none !important;
                }
            }

            @media screen and (max-width: 320px) {
                .rank-cell {
                    width: 20px !important;
                    font-size: 0.55rem !important;
                    padding: 2px 1px !important;
                }

                .award-cell {
                    width: 15px !important;
                    font-size: 0.6rem !important;
                    padding: 2px 0px !important;
                }

                .username-cell {
                    width: 40px !important;
                    max-width: 40px !important;
                    font-size: 0.55rem !important;
                    padding: 2px 1px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                    background: yellow !important; /* DEBUG: Should show yellow background */
                }

                .total-score-cell,
                .score-cell {
                    width: 110px !important;
                    min-width: 110px !important;
                    font-size: 0.55rem !important;
                    padding: 2px 8px 2px 2px !important;
                    text-align: right !important;
                    background: lightgreen !important; /* DEBUG: Should show green background */
                }
            }

            /* DEBUG: Add visible change for all mobile sizes */
            @media screen and (max-width: 767px) {
                .leaderboard-table {
                    border: 3px solid red !important; /* DEBUG: Should show red border */
                }
            }
        `;
        
        // Add styles to document
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // DEBUG: Log that styles were added
        console.log('🎨 CSS STYLES ADDED TO HEAD - Length:', styles.length);
        console.log('🎨 Style element in DOM:', document.head.contains(styleSheet));

        // DEBUG: Add styles with setTimeout to ensure DOM is ready
        setTimeout(() => {
            const leaderboardTables = document.querySelectorAll('.leaderboard-table');
            console.log('🎨 Found leaderboard tables:', leaderboardTables.length);

            const usernameCells = document.querySelectorAll('.username-cell');
            console.log('🎨 Found username cells:', usernameCells.length);

            const scoreCells = document.querySelectorAll('.total-score-cell, .score-cell');
            console.log('🎨 Found score cells:', scoreCells.length);

            // Force apply styles directly via JavaScript as backup
            usernameCells.forEach((cell, index) => {
                console.log(`🎨 Username cell ${index} current width:`, window.getComputedStyle(cell).width);
                cell.style.width = '40px';
                cell.style.maxWidth = '40px';
                cell.style.backgroundColor = 'yellow';
                cell.style.fontSize = '0.55rem';
                console.log(`🎨 Username cell ${index} after JS styling:`, window.getComputedStyle(cell).width);
            });

            scoreCells.forEach((cell, index) => {
                console.log(`🎨 Score cell ${index} current width:`, window.getComputedStyle(cell).width);
                cell.style.width = '110px';
                cell.style.minWidth = '110px';
                cell.style.backgroundColor = 'lightgreen';
                cell.style.fontSize = '0.55rem';
                console.log(`🎨 Score cell ${index} after JS styling:`, window.getComputedStyle(cell).width);
            });

        }, 1000);

        // DEBUG: Also try immediate application
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🎨 DOM CONTENT LOADED - Re-checking for tables');
            const tables = document.querySelectorAll('.leaderboard-table');
            console.log('🎨 Tables found on DOM ready:', tables.length);
        });
    }

    /**
     * Add leaderboard responsive styles
     */
    addLeaderboardStyles() {
        console.log('🎨 addLeaderboardStyles() called - adding mobile responsive CSS');

        const styles = `
            /* DEBUG: Add visible change for all mobile sizes */
            @media screen and (max-width: 767px) {
                .leaderboard-table {
                    border: 3px solid red !important; /* DEBUG: Should show red border */
                }
            }

            /* Responsive leaderboard table fixes */
            @media screen and (max-width: 767px) {
                .rank-cell {
                    width: 45px !important;
                    font-size: 0.75rem !important;
                    padding: 6px 3px !important;
                }

                .award-cell {
                    width: 35px !important;
                    font-size: 0.85rem !important;
                    padding: 6px 3px !important;
                }

                .username-cell {
                    width: 80px !important;
                    max-width: 80px !important;
                    font-size: 0.75rem !important;
                    padding: 6px 4px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                }

                .total-score-cell,
                .score-cell {
                    width: 95px !important;
                    min-width: 95px !important;
                    font-size: 0.75rem !important;
                    padding: 6px 8px 6px 4px !important;
                    text-align: right !important;
                }

                .days-cell {
                    width: 40px !important;
                    font-size: 0.7rem !important;
                    padding: 6px 3px !important;
                }
            }

            @media screen and (max-width: 480px) {
                .rank-cell {
                    width: 30px !important;
                    font-size: 0.65rem !important;
                    padding: 4px 2px !important;
                }

                .award-cell {
                    width: 25px !important;
                    font-size: 0.75rem !important;
                    padding: 4px 1px !important;
                }

                .username-cell {
                    width: 65px !important;
                    max-width: 65px !important;
                    font-size: 0.65rem !important;
                    padding: 4px 3px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                }

                .total-score-cell,
                .score-cell {
                    width: 100px !important;
                    min-width: 100px !important;
                    font-size: 0.65rem !important;
                    padding: 4px 8px 4px 3px !important;
                    text-align: right !important;
                }

                .days-cell {
                    display: none !important;
                }
            }

            @media screen and (max-width: 320px) {
                .rank-cell {
                    width: 20px !important;
                    font-size: 0.55rem !important;
                    padding: 2px 1px !important;
                }

                .award-cell {
                    width: 15px !important;
                    font-size: 0.6rem !important;
                    padding: 2px 0px !important;
                }

                .username-cell {
                    width: 40px !important;
                    max-width: 40px !important;
                    font-size: 0.55rem !important;
                    padding: 2px 1px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                    background: yellow !important; /* DEBUG: Should show yellow background */
                }

                .total-score-cell,
                .score-cell {
                    width: 110px !important;
                    min-width: 110px !important;
                    font-size: 0.55rem !important;
                    padding: 2px 8px 2px 2px !important;
                    text-align: right !important;
                    background: lightgreen !important; /* DEBUG: Should show green background */
                }
            }
        `;

        // Add styles to document
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        styleSheet.id = 'leaderboard-responsive-styles';
        document.head.appendChild(styleSheet);

        console.log('🎨 CSS STYLES ADDED TO HEAD - Length:', styles.length);
        console.log('🎨 Style element in DOM:', document.head.contains(styleSheet));

        // Force apply styles directly via JavaScript as backup
        setTimeout(() => {
            const leaderboardTables = document.querySelectorAll('.leaderboard-table');
            console.log('🎨 Found leaderboard tables:', leaderboardTables.length);

            const usernameCells = document.querySelectorAll('.username-cell');
            console.log('🎨 Found username cells:', usernameCells.length);

            const scoreCells = document.querySelectorAll('.total-score-cell, .score-cell');
            console.log('🎨 Found score cells:', scoreCells.length);

            // Force apply styles directly via JavaScript as backup for 320px screens
            if (window.innerWidth <= 320) {
                usernameCells.forEach((cell, index) => {
                    console.log(`🎨 Username cell ${index} current width:`, window.getComputedStyle(cell).width);
                    cell.style.width = '40px';
                    cell.style.maxWidth = '40px';
                    cell.style.backgroundColor = 'yellow';
                    cell.style.fontSize = '0.55rem';
                    console.log(`🎨 Username cell ${index} after JS styling:`, window.getComputedStyle(cell).width);
                });

                scoreCells.forEach((cell, index) => {
                    console.log(`🎨 Score cell ${index} current width:`, window.getComputedStyle(cell).width);
                    cell.style.width = '110px';
                    cell.style.minWidth = '110px';
                    cell.style.backgroundColor = 'lightgreen';
                    cell.style.fontSize = '0.55rem';
                    console.log(`🎨 Score cell ${index} after JS styling:`, window.getComputedStyle(cell).width);
                });
            }
        }, 1000);
    }

    /**
     * Apply dynamic responsive styles to newly created leaderboard tables
     */
    applyDynamicLeaderboardStyles() {
        console.log('🎨 applyDynamicLeaderboardStyles() called');
        console.log('🎨 Current screen width:', window.innerWidth);
        console.log('🎨 Current screen height:', window.innerHeight);

        // Target the specific leaderboard table that was just created
        const leaderboardTables = document.querySelectorAll('.leaderboard-table');
        console.log('🎨 Found leaderboard tables for dynamic styling:', leaderboardTables.length);

        // Debug: Log all tables found
        leaderboardTables.forEach((table, index) => {
            console.log(`🎨 Table ${index + 1}:`, table);
            console.log(`🎨 Table ${index + 1} parent:`, table.parentElement);
        });

        if (leaderboardTables.length === 0) {
            console.log('🎨 No leaderboard tables found, skipping dynamic styling');
            return;
        }

        // Apply styles directly via JavaScript for immediate effect
        leaderboardTables.forEach(table => {
            console.log('🎨 Applying dynamic styles to table:', table);

            // Only apply mobile styles if screen is narrow enough
            if (window.innerWidth <= 767) {
                console.log('🎨 Mobile screen detected, applying responsive styles');

                // Add debug styling to table
                table.style.border = '3px solid red';

                // Style rank cells
                const rankCells = table.querySelectorAll('.rank-cell');
                rankCells.forEach(cell => {
                    cell.style.width = '45px';
                    cell.style.fontSize = '0.75rem';
                    cell.style.padding = '6px 3px';
                });

                // Style award cells
                const awardCells = table.querySelectorAll('.award-cell');
                awardCells.forEach(cell => {
                    cell.style.width = '35px';
                    cell.style.fontSize = '0.85rem';
                    cell.style.padding = '6px 3px';
                });

                // Style username cells
                const usernameCells = table.querySelectorAll('.username-cell');
                usernameCells.forEach(cell => {
                    if (window.innerWidth <= 320) {
                        cell.style.width = '40px';
                        cell.style.maxWidth = '40px';
                        cell.style.fontSize = '0.55rem';
                        cell.style.backgroundColor = 'yellow'; // DEBUG
                    } else {
                        cell.style.width = '80px';
                        cell.style.maxWidth = '80px';
                        cell.style.fontSize = '0.75rem';
                    }
                    cell.style.padding = '6px 4px';
                    cell.style.overflow = 'hidden';
                    cell.style.textOverflow = 'ellipsis';
                    cell.style.whiteSpace = 'nowrap';
                });

                // Style score cells
                const scoreCells = table.querySelectorAll('.total-score-cell, .score-cell');
                scoreCells.forEach(cell => {
                    if (window.innerWidth <= 320) {
                        cell.style.width = '110px';
                        cell.style.minWidth = '110px';
                        cell.style.backgroundColor = 'lightgreen'; // DEBUG
                    } else {
                        cell.style.width = '95px';
                        cell.style.minWidth = '95px';
                    }
                    cell.style.fontSize = '0.75rem';
                    cell.style.padding = '6px 8px 6px 4px';
                    cell.style.textAlign = 'right';
                });

                // Style days cells
                const daysCells = table.querySelectorAll('.days-cell');
                daysCells.forEach(cell => {
                    cell.style.width = '40px';
                    cell.style.fontSize = '0.7rem';
                    cell.style.padding = '6px 3px';
                });

                console.log('🎨 Dynamic responsive styles applied successfully');
            }
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('.close-competition')) {
                this.hideCompetitionInterface();
            }
        });
    }

    /**
     * Show competition interface
     */
    showCompetitionInterface(skipJoinLinkCheck = false) {
        console.log('🏠 showCompetitionInterface called');
        let container = document.getElementById('competition-container');

        if (!container) {
            console.log('🏠 Container not found, creating new one');
            container = this.createCompetitionContainer();
        } else {
            console.log('🏠 Container found:', container);
        }

        console.log('🏠 Setting container display to flex');

        // Create backdrop if it doesn't exist
        let backdrop = document.getElementById('competition-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'competition-backdrop';
            backdrop.className = 'competition-backdrop';
            backdrop.onclick = () => this.hideCompetitionInterface();
            document.body.appendChild(backdrop);
        }

        // Show backdrop and container
        backdrop.style.display = 'block';
        container.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        console.log('🏠 Container after styling:', {
            display: container.style.display,
            visibility: container.style.visibility,
            opacity: container.style.opacity,
            zIndex: getComputedStyle(container).zIndex
        });
        
        // Only check for join link if explicitly requested (not when called after auth success)
        if (!skipJoinLinkCheck) {
            const joinCompetitionId = window.CompetitionManager?.parseJoinLink();
            if (joinCompetitionId) {
                this.handleJoinLink(joinCompetitionId);
                return;
            }
        }
        
        // Load competitions view after a small delay to ensure container is visible
        setTimeout(() => {
            this.loadCompetitionsView();
        }, 100);
    }

    /**
     * Hide competition interface
     */
    hideCompetitionInterface() {
        const container = document.getElementById('competition-container');
        const backdrop = document.getElementById('competition-backdrop');

        if (container) {
            container.style.display = 'none';
        }
        if (backdrop) {
            backdrop.style.display = 'none';
        }
        document.body.style.overflow = 'auto';

        // Clear refresh interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Create main competition container
     */
    createCompetitionContainer() {
        const container = document.createElement('div');
        container.id = 'competition-container';
        container.className = 'competition-container';
        
        container.innerHTML = `
            <div class="competition-header">
                <h1 class="competition-title">Competitions</h1>
                <button class="close-competition">✕ Close</button>
            </div>
            <div class="competition-content">
                <nav class="competition-nav">
                    <button class="nav-button active" data-view="competitions">My Competitions</button>
                    <button class="nav-button" data-view="past">Past Competitions</button>
                    <button class="nav-button" data-view="builder">Create Competition</button>
                </nav>
                
                <div id="competitions-section" class="competition-section active">
                    <h2 class="section-title">Your Competitions</h2>
                    <div id="competitions-list"></div>
                </div>
                
                <div id="past-section" class="competition-section">
                    <h2 class="section-title">Past Competitions</h2>
                    <div id="past-competitions-list"></div>
                </div>

                <div id="builder-section" class="competition-section">
                    <h2 class="section-title">Create Your Competition</h2>
                    <div id="competition-builder"></div>
                </div>
                
                <div id="leaderboard-section" class="competition-section">
                    <h2 class="section-title" id="leaderboard-title">Leaderboard</h2>
                    <div id="leaderboard-back-button" style="text-align: center; margin-bottom: 20px;">
                        <button class="nav-button" onclick="window.CompetitionUI.switchView('competitions')">← Back to Competitions</button>
                    </div>
                    <div id="leaderboard-display"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Setup navigation
        container.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });
        
        return container;
    }

    /**
     * Switch between views
     */
    switchView(view) {
        this.currentView = view;
        
        // Update navigation
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Update sections
        document.querySelectorAll('.competition-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const activeSection = document.getElementById(`${view}-section`);
        if (activeSection) {
            activeSection.classList.add('active');
        }
        
        // Load view data
        switch (view) {
            case 'competitions':
                this.loadCompetitionsView();
                break;
            case 'past':
                this.loadPastCompetitionsView();
                break;
            case 'leaderboard':
                this.loadLeaderboardView();
                break;
            case 'builder':
                this.loadBuilderView();
                break;
        }
    }

    /**
     * Load competitions view
     */
    async loadCompetitionsView() {
        console.log('🔍 loadCompetitionsView called');
        const container = document.getElementById('competitions-list');
        console.log('🔍 competitions-list container:', container);
        if (!container) {
            console.log('❌ competitions-list container not found!');
            return;
        }

        container.innerHTML = '<div class="loading-spinner"></div> <span style="font-size: 24px;">Loading competitions...</span>';
        console.log('🔍 Set loading spinner, about to load competitions...');
        
        try {
            console.log('🔍 CompetitionManager available:', !!window.CompetitionManager);

            // Always ensure global competition exists and is current
            await window.CompetitionManager?.ensureGlobalCompetitionExists();
            console.log('🔍 ensureGlobalCompetitionExists completed');

            // Load user competitions AND fetch participant counts
            await window.CompetitionManager?.loadUserCompetitions();
            console.log('🔍 loadUserCompetitions completed');

            // Explicitly ensure participant counts are fetched
            await window.CompetitionManager?.fetchParticipantCounts();
            console.log('🔍 fetchParticipantCounts completed');

            // Reload global competition to get updated participant count
            await window.CompetitionManager?.loadGlobalCompetition();
            console.log('🔍 reloaded global competition with participant count');

            // Get the current global competition
            const globalComp = window.CompetitionManager?.globalCompetition;
            console.log('🔍 globalComp:', globalComp);
            const userComps = window.CompetitionManager?.userCompetitions || [];
            
            let html = '';
            
            // ALWAYS show global competition at the top (even for unauthenticated users)
            if (globalComp) {
                // Check if user is participating in global competition
                const globalParticipation = userComps.find(p => p.competitions.id === globalComp.id);
                html += `<div class="section-divider" style="margin: 20px 0; text-align: center; font-weight: bold; color: #2a5298;">🌍 Daily Shapes Monthly Competition</div>`;
                html += this.renderCompetitionCard(globalComp, true, globalParticipation);
                
                // Auto-join user to global competition if authenticated but not participating
                if (window.AuthService?.currentUser && !globalParticipation) {
                    setTimeout(async () => {
                        try {
                            await window.CompetitionManager.autoJoinGlobalCompetition(window.AuthService.currentUser.id);
                            // Refresh the view after auto-join
                            this.loadCompetitionsView();
                        } catch (error) {
                            console.error('❌ Auto-join to global competition failed:', error);
                        }
                    }, 500);
                }
            } else {
                // Show placeholder global competition for unauthenticated users
                html += `<div class="section-divider" style="margin: 20px 0; text-align: center; font-weight: bold; color: #2a5298;">🌍 Daily Shapes Monthly Competition</div>`;
                html += this.renderPlaceholderGlobalCompetition();
            }
            
            // Filter out global competition from user competitions to avoid duplication
            const customComps = userComps.filter(p => !p.competitions.is_global);
            
            // Custom user competitions
            if (customComps.length > 0) {
                html += `<div class="section-divider" style="margin: 30px 0 20px 0; text-align: center; font-weight: bold; color: #2a5298;">📋 My Custom Competitions</div>`;
                customComps.forEach(participation => {
                    const comp = participation.competitions;
                    html += this.renderCompetitionCard(comp, false, participation);
                });
            }
            
            // Show empty state only if no competitions at all
            if (!globalComp && customComps.length === 0) {
                html = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏆</div>
                        <h3>Looks like you're not currently connected to any competitions</h3>
                        <button class="success-nav-btn primary" onclick="window.openCompetitionModal && window.showCreateCompetition ? (window.openCompetitionModal(), window.showCreateCompetition()) : console.log('Competition modal not available')" style="margin-top: 15px;">
                            <span class="btn-icon">➕</span>
                            Create Competition
                        </button>
                    </div>
                `;
            }
            
            container.innerHTML = html;

            // Debug: Log what we're actually rendering
            console.log('🔍 Competition cards rendered, checking participant counts...');
            console.log('🔍 CompetitionManager.globalCompetition:', window.CompetitionManager?.globalCompetition);
            console.log('🔍 CompetitionManager.userCompetitions:', window.CompetitionManager?.userCompetitions);
            if (globalComp) {
                console.log(`🔍 Global competition: ${globalComp.name} has participant_count: ${globalComp.participant_count}`);
            }
            customComps.forEach(participation => {
                if (participation.competitions) {
                    console.log(`🔍 Custom competition: ${participation.competitions.name} has participant_count: ${participation.competitions.participant_count}`);
                }
            });

        } catch (error) {
            console.error('❌ Error loading competitions:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h3>Error loading competitions</h3>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }

    /**
     * Load past competitions view
     */
    async loadPastCompetitionsView() {
        const container = document.getElementById('past-competitions-list');
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner"></div> <span style="font-size: 24px;">Loading past competitions...</span>';

        try {
            // Get user competitions that have ended
            await window.CompetitionManager?.loadUserCompetitions();
            const userCompetitions = window.CompetitionManager?.userCompetitions || [];

            // Filter for past competitions (ended competitions)
            const pastComps = userCompetitions.filter(participation => {
                const comp = participation.competitions;
                if (!comp) return false;
                const endDate = new Date(comp.end_date);
                return endDate < new Date();
            });

            let html = '';

            if (pastComps.length > 0) {
                html += `<div class="section-divider" style="margin: 20px 0; text-align: center; font-weight: bold; color: #2a5298;">📚 Completed Competitions</div>`;
                pastComps.forEach(participation => {
                    const comp = participation.competitions;
                    html += this.renderCompetitionCard(comp, false, participation);
                });
            } else {
                html = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📚</div>
                        <h3>No past competitions found</h3>
                        <p>Complete some competitions to see your history here!</p>
                    </div>
                `;
            }

            container.innerHTML = html;

        } catch (error) {
            console.error('❌ Error loading past competitions:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h3>Error loading past competitions</h3>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }

    /**
     * Render competition card
     */
    renderCompetitionCard(competition, isGlobal = false, participation = null) {
        const startDate = window.formatDateForUser ? window.formatDateForUser(competition.start_date) : new Date(competition.start_date).toLocaleDateString();
        const endDate = window.formatDateForUser ? window.formatDateForUser(competition.end_date) : new Date(competition.end_date).toLocaleDateString();
        const status = this.getCompetitionStatus(competition);
        const participantCount = competition.participant_count || 0;
        console.log(`🔍 Card debug for ${competition.name}:`);
        console.log(`  - competition object:`, competition);
        console.log(`  - participant_count: ${competition.participant_count}`);
        console.log(`  - calculated participantCount: ${participantCount}`);

        let participantInfo = '';
        if (participation) {
            participantInfo = `
                <div class="card-meta">
                    <span>Your Rank: #${participation.current_position || 'Unranked'}</span>
                    <span>Score: ${participation.average_score?.toFixed(1) || '0.0'}</span>
                    <span>Days: ${participation.days_played || 0}</span>
                </div>
            `;
        }
        
        // Add special styling and info for global competitions
        const globalInfo = isGlobal ? `
            <div style="text-align: center; margin: 10px 0; padding: 10px; background: rgba(255, 215, 0, 0.1); border-radius: 8px; border: 1px solid rgba(255, 215, 0, 0.3);">
                <div style="font-size: 14px; color: #b8860b; font-weight: bold;">🗓️ Resets monthly • 🌍 Global competition</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">Scores reset on the 1st of each month</div>
            </div>
        ` : '';
        
        return `
            <div class="competition-card ${isGlobal ? 'global' : ''}" onclick="window.CompetitionUI.selectCompetition('${competition.id}', '${competition.name.replace(/'/g, "\\'")}')">
                <div class="card-title">
                    ${isGlobal ? '🌍 ' : ''}${competition.name.toUpperCase()}
                </div>
                <div class="card-description">
                    ${competition.description || 'No description provided'}
                </div>
                ${globalInfo}
                <div class="card-meta">
                    <span style="color: #2a5298; font-weight: 500;">📅 ${startDate} - ${endDate}</span>
                    <span class="card-participants">👥 ${participantCount} player${participantCount !== 1 ? 's' : ''}</span>
                    <span class="card-status">${status}</span>
                </div>
                ${participantInfo}
                <div style="text-align: center; margin-top: 15px; color: #666; font-size: 14px;">
                    👆 Tap to view leaderboard
                </div>
            </div>
        `;
    }

    /**
     * Render placeholder global competition for unauthenticated users
     */
    renderPlaceholderGlobalCompetition() {
        const currentDate = new Date();
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const competitionName = `DS Global Comp ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        
        return `
            <div class="competition-card global" onclick="window.CompetitionUI.promptAuthForGlobal()">
                <div class="card-title">
                    🌍 ${competitionName}
                </div>
                <div class="card-description">
                    Official Daily Shapes global competition. Compete with players worldwide! Scores reset monthly.
                </div>
                <div style="text-align: center; margin: 10px 0; padding: 10px; background: rgba(255, 215, 0, 0.1); border-radius: 8px; border: 1px solid rgba(255, 215, 0, 0.3);">
                    <div style="font-size: 14px; color: #b8860b; font-weight: bold;">🗓️ Resets monthly • 🌍 Global competition</div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">Scores reset on the 1st of each month</div>
                </div>
                <div class="card-meta">
                    <span>📅 ${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01 - ${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}</span>
                    <span class="card-participants">👥 -- players</span>
                    <span class="card-status">Active</span>
                </div>
                <div style="text-align: center; margin-top: 15px; padding: 10px; background: rgba(42, 82, 152, 0.1); border-radius: 8px;">
                    <div style="color: #2a5298; font-weight: bold; font-size: 16px;">🔒 Sign in to join</div>
                    <div style="color: #666; font-size: 14px; margin-top: 5px;">👆 Tap to sign in and compete</div>
                </div>
            </div>
        `;
    }

    /**
     * Prompt authentication for global competition
     */
    promptAuthForGlobal() {
        if (window.showAuthenticationPopup) {
            // Store user's original intent
            localStorage.setItem('pendingUserAction', 'competitions');
            window.showAuthenticationPopup('Sign in to join the global monthly competition');
        } else {
            console.log('⚠️ Authentication popup not available');
        }
    }

    /**
     * Get competition status text
     */
    getCompetitionStatus(competition) {
        const now = new Date();
        const start = new Date(competition.start_date);
        const end = new Date(competition.end_date);
        
        if (now < start) return 'Upcoming';
        if (now > end) return 'Completed';
        return 'Active';
    }

    /**
     * Select competition for leaderboard view
     */
    async selectCompetition(competitionId, competitionName) {
        this.selectedCompetition = competitionId;
        
        // Update leaderboard title to just "Leaderboard"
        const titleElement = document.getElementById('leaderboard-title');
        if (titleElement) {
            titleElement.textContent = 'Leaderboard';
        }
        
        this.switchView('leaderboard');
        await this.loadLeaderboardForCompetition(competitionId);
    }

    /**
     * Load leaderboard view
     */
    async loadLeaderboardView() {
        // Load leaderboard for selected competition
        if (this.selectedCompetition) {
            await this.loadLeaderboardForCompetition(this.selectedCompetition);
        }
    }

    /**
     * Load leaderboard for specific competition
     */
    async loadLeaderboardForCompetition(competitionId) {
        const container = document.getElementById('leaderboard-display');
        if (!container) return;
        
        container.innerHTML = '<div class="loading-spinner"></div> Loading leaderboard...';
        
        try {
            const leaderboard = await window.CompetitionManager?.getCompetitionLeaderboard(competitionId);
            
            if (!leaderboard || leaderboard.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <h3>No players yet</h3>
                        <p>Be the first to join this competition!</p>
                    </div>
                `;
                return;
            }
            
            let html = `
                <table class="leaderboard-table">
                    <thead>
                        <tr>
                            <th class="rank-cell">Rank</th>
                            <th class="award-cell">🏆</th>
                            <th class="username-cell">Player</th>
                            <th class="total-score-cell">Score</th>
                            <th class="days-cell">Days</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            leaderboard.forEach((player, index) => {
                const rowClass = player.current_position <= 3 ? 'top-three' : '';
                html += `
                    <tr class="${rowClass}">
                        <td class="rank-cell">#${player.rank || (index + 1)}</td>
                        <td class="award-cell">${player.award}</td>
                        <td class="username-cell">${player.displayName}</td>
                        <td class="total-score-cell">${player.total_score?.toFixed(1) || '0.0'}</td>
                        <td class="days-cell">${player.days_played || 0}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            container.innerHTML = html;

            console.log('🎨 LEADERBOARD TABLE JUST CREATED - About to apply dynamic styles');
            console.log('🎨 Container innerHTML length:', container.innerHTML.length);
            console.log('🎨 Screen dimensions:', window.innerWidth, 'x', window.innerHeight);

            // Apply dynamic responsive styles to the newly created leaderboard table
            this.applyDynamicLeaderboardStyles();

            // Setup auto-refresh
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            this.refreshInterval = setInterval(() => {
                if (this.currentView === 'leaderboard' && this.selectedCompetition) {
                    this.loadLeaderboardForCompetition(this.selectedCompetition);
                }
            }, 30000); // Refresh every 30 seconds
            
        } catch (error) {
            console.error('❌ Error loading leaderboard:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <h3>Error loading leaderboard</h3>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }

    /**
     * Load competition builder view
     */
    loadBuilderView() {
        const container = document.getElementById('competition-builder');
        if (!container) return;
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];
        
        container.innerHTML = `
            <form class="builder-form" id="competition-builder-form">
                <div class="form-group">
                    <label class="form-label">Competition Name *</label>
                    <input type="text" class="form-input" id="comp-name" maxlength="100" required>
                </div>
                
                
                <div class="form-group">
                    <label class="form-label">Start Date *</label>
                    <input type="date" class="form-input" id="comp-start-date" value="${tomorrowStr}" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">End Date *</label>
                    <input type="date" class="form-input" id="comp-end-date" value="${nextWeekStr}" required>
                </div>
                
                <div class="form-group full-width">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" id="comp-description" maxlength="500" placeholder="Describe your competition..."></textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-checkbox">
                        <input type="checkbox" id="comp-public" checked>
                        <span>Public competition (others can find and join)</span>
                    </label>
                </div>
                
                <div class="form-group">
                    <label class="form-checkbox">
                        <input type="checkbox" id="comp-late-entries" checked>
                        <span>Allow late entries after start date</span>
                    </label>
                </div>
                
                <div class="form-group full-width">
                    <button type="submit" class="create-button" id="create-competition-btn">
                        🏆 Create Competition
                    </button>
                </div>
            </form>
            
            <div id="join-link-result" style="display: none;">
                <div class="join-link-container">
                    <h3>Competition Created Successfully!</h3>
                    <p>Share this link with others to join your competition:</p>
                    <input type="text" class="join-link-input" id="generated-join-link" readonly>
                    <button class="copy-link-button" onclick="window.CompetitionUI.copyJoinLink()">
                        📋 Copy Link
                    </button>
                </div>
            </div>
        `;
        
        // Setup form submission
        const form = document.getElementById('competition-builder-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleCreateCompetition(e));
        }
        
        // Setup date validation
        const startDateInput = document.getElementById('comp-start-date');
        const endDateInput = document.getElementById('comp-end-date');
        
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => {
                const startDate = new Date(startDateInput.value);
                const minEndDate = new Date(startDate);
                minEndDate.setDate(minEndDate.getDate() + 1);
                endDateInput.min = minEndDate.toISOString().split('T')[0];
                
                if (new Date(endDateInput.value) <= startDate) {
                    endDateInput.value = minEndDate.toISOString().split('T')[0];
                }
            });
        }
    }

    /**
     * Handle competition creation
     */
    async handleCreateCompetition(event) {
        event.preventDefault();
        
        if (!window.AuthService?.currentUser) {
            console.log('⚠️ User not authenticated for competition creation');
            if (window.showAuthenticationPopup) {
                // Store user's original intent
                localStorage.setItem('pendingUserAction', 'competitions');
                window.showAuthenticationPopup('Sign in to create competitions');
            }
            return;
        }
        
        const button = document.getElementById('create-competition-btn');
        const originalText = button.textContent;
        
        button.disabled = true;
        button.innerHTML = '<div class="loading-spinner"></div> Creating...';
        
        try {
            const competitionData = {
                name: document.getElementById('comp-name').value.trim(),
                description: document.getElementById('comp-description').value.trim(),
                startDate: document.getElementById('comp-start-date').value,
                endDate: document.getElementById('comp-end-date').value,
                isPublic: document.getElementById('comp-public').checked,
                allowLateEntries: document.getElementById('comp-late-entries').checked,
                scoringMethod: 'average_score'
            };
            
            const competition = await window.CompetitionManager?.createCompetition(
                competitionData,
                window.AuthService.currentUser.id
            );
            
            if (competition) {
                // Generate join link
                const joinLink = window.CompetitionManager.generateJoinLink(competition.id);
                
                // Show success message with join link
                document.getElementById('generated-join-link').value = joinLink;
                document.getElementById('join-link-result').style.display = 'block';
                
                // Reset form
                document.getElementById('competition-builder-form').reset();
                
                // Refresh user competitions
                await window.CompetitionManager.loadUserCompetitions();
            }
            
        } catch (error) {
            console.error('❌ Error creating competition:', error);
            
            // Show specific error message
            let errorMessage = 'Failed to create competition. ';
            if (error.message?.includes('authentication')) {
                errorMessage += 'Please make sure you are signed in.';
            } else if (error.message?.includes('duplicate')) {
                errorMessage += 'A competition with this name already exists.';
            } else {
                errorMessage += 'Please try again.';
            }
            
            console.error('❌ Competition creation error:', errorMessage);
            this.showErrorPopup(errorMessage);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    /**
     * Copy join link to clipboard
     */
    copyJoinLink() {
        const input = document.getElementById('generated-join-link');
        if (input) {
            input.select();
            document.execCommand('copy');
            
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        }
    }


    /**
     * Handle join link
     */
    async handleJoinLink(competitionId) {
        try {
            console.log('🔗 Processing join link for competition:', competitionId);
            
            // First, check if user is authenticated
            if (!window.AuthService?.currentUser) {
                console.log('👤 User not authenticated, storing join info for later');
                
                // Store the join info for after authentication
                sessionStorage.setItem('pendingJoinCompetitionId', competitionId);
                
                // Show authentication popup
                if (window.showAuthenticationPopup) {
                    // Store user's original intent
                    localStorage.setItem('pendingUserAction', 'competitions');
                    window.showAuthenticationPopup('Sign in to join this competition');
                } else {
                    console.log('⚠️ Authentication popup not available');
                }
                return;
            }
            
            // User is authenticated, proceed with join
            console.log('✅ User authenticated, proceeding with join');
            await this.proceedWithJoin(competitionId);
            
        } catch (error) {
            console.error('❌ Error handling join link:', error);
            console.error('❌ Failed to process join link. The competition may no longer exist.');
        }
    }
    
    /**
     * Proceed with joining competition (after authentication)
     */
    async proceedWithJoin(competitionId) {
        try {
            console.log('🔍 Fetching competition details:', competitionId);
            
            // Get competition details
            const competition = await window.CompetitionManager?.getCompetition(competitionId);
            
            if (!competition) {
                console.error('❌ Competition not found:', competitionId);
                console.error('❌ Competition not found. The competition may have been deleted or the link is invalid.');
                
                // Clear pending join data and URL
                sessionStorage.removeItem('pendingJoinCompetitionId');
                sessionStorage.removeItem('pendingJoinCompetitionName');
                window.CompetitionManager?.clearJoinLink();
                return;
            }
            
            console.log('✅ Competition found:', competition.name);
            console.log('🚀 Auto-joining competition...');
            
            const joinResult = await window.CompetitionManager.joinCompetition(
                competitionId,
                window.AuthService.currentUser.id
            );
            
            console.log('✅ Join result:', joinResult);
            
            // Refresh competitions and show the competitions interface
            await window.CompetitionManager.loadUserCompetitions();
            
            // Show the competition interface with updated data (skip join link check to avoid loop)
            this.showCompetitionInterface(true);
            
            // Clear pending join data and URL
            sessionStorage.removeItem('pendingJoinCompetitionId');
            sessionStorage.removeItem('pendingJoinCompetitionName');
            window.CompetitionManager?.clearJoinLink();
            
        } catch (error) {
            console.error('❌ Error joining competition:', error);
            
            // Clear pending join data and URL on error
            sessionStorage.removeItem('pendingJoinCompetitionId');
            sessionStorage.removeItem('pendingJoinCompetitionName');
            window.CompetitionManager?.clearJoinLink();
            
            // Show specific error message
            let errorMessage = '';
            if (error.message?.includes('already participating')) {
                console.log('ℹ️ User is already participating in this competition');
                errorMessage = 'You are already participating in this competition.';
            } else if (error.message?.includes('not found')) {
                console.error('❌ Competition not found. The competition may have been deleted.');
                errorMessage = 'Competition not found. The competition may have been deleted.';
            } else {
                console.error(`❌ Failed to join competition: ${error.message || 'Unknown error'}`);
                errorMessage = `Failed to join competition: ${error.message || 'Unknown error'}`;
            }
            
            if (errorMessage) {
                this.showErrorPopup(errorMessage);
            }
        }
    }
    
    /**
     * Handle authentication success (called after user signs in)
     */
    async handleAuthSuccess() {
        // Check if there's a pending join
        const pendingJoinId = sessionStorage.getItem('pendingJoinCompetitionId');
        if (pendingJoinId) {
            console.log('🔄 Processing pending competition join after authentication');
            await this.proceedWithJoin(pendingJoinId);
        }
    }

    /**
     * Show error message as small inline text without layout shifts
     */
    showErrorPopup(message) {
        // Find a suitable container to show the error
        const containers = [
            document.querySelector('.competition-modal-body'),
            document.querySelector('.success-modal-body'),
            document.querySelector('.competition-content'),
            document.querySelector('#competitionMainView')
        ];
        
        const container = containers.find(c => c && c.offsetParent !== null);
        
        if (container) {
            // Remove any existing error messages
            const existingErrors = container.querySelectorAll('.inline-error-message');
            existingErrors.forEach(error => error.remove());
            
            // Create small error text
            const errorEl = document.createElement('div');
            errorEl.className = 'inline-error-message';
            errorEl.style.cssText = `
                color: #dc3545 !important;
                font-size: 12px !important;
                line-height: 1.3 !important;
                margin: 8px 0 0 0 !important;
                padding: 0 !important;
                border: none !important;
                background: none !important;
                font-weight: normal !important;
                text-align: left !important;
                display: block !important;
                opacity: 0 !important;
                transition: opacity 0.3s ease !important;
            `;
            errorEl.textContent = message;
            
            // Insert at the top of the container
            container.insertBefore(errorEl, container.firstChild);
            
            // Fade in
            setTimeout(() => {
                errorEl.style.opacity = '1';
            }, 10);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorEl.parentNode) {
                    errorEl.style.opacity = '0';
                    setTimeout(() => {
                        if (errorEl.parentNode) {
                            errorEl.remove();
                        }
                    }, 300);
                }
            }, 5000);
            
        } else {
            // Fallback to console if no container found
            console.error('Competition error:', message);
        }
    }
}


// Initialize global competition UI
console.log('🔥 COMPETITION-UI.JS LOADED - DEBUG_FORCE_STYLES_JS - WITH DIRECT JS STYLING');
window.CompetitionUI = new CompetitionUI();

// DEBUG: Force call the styling function immediately
console.log('🔧 MANUALLY CALLING addLeaderboardStyles()...');
if (window.CompetitionUI && window.CompetitionUI.addLeaderboardStyles) {
    window.CompetitionUI.addLeaderboardStyles();
    console.log('✅ addLeaderboardStyles() called successfully');
} else {
    console.log('❌ addLeaderboardStyles() method not found');
}