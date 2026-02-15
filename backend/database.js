const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'hulopredict.db');

class Database {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Connected to SQLite database');
            }
        });
    }

    async initTables() {
        return new Promise((resolve, reject) => {
            // Players table - stores current market data
            this.db.run(`
                CREATE TABLE IF NOT EXISTS players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    color TEXT NOT NULL,
                    percent INTEGER NOT NULL DEFAULT 0,
                    score INTEGER DEFAULT 0,
                    holes INTEGER DEFAULT 18,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(err);
                
                // Users table - each device/user
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT UNIQUE NOT NULL,
                        cash REAL DEFAULT 1000.00,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) return reject(err);
                    
                    // Portfolios table - shares owned by users
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS portfolios (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT NOT NULL,
                            player_name TEXT NOT NULL,
                            yes_shares REAL DEFAULT 0,
                            no_shares REAL DEFAULT 0,
                            avg_yes_price REAL DEFAULT 0,
                            avg_no_price REAL DEFAULT 0,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(user_id, player_name)
                        )
                    `, (err) => {
                        if (err) return reject(err);
                        
                        // Trades table - history of all trades
                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS trades (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                user_id TEXT NOT NULL,
                                player_name TEXT NOT NULL,
                                type TEXT NOT NULL,
                                shares REAL NOT NULL,
                                price REAL NOT NULL,
                                amount REAL NOT NULL,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `, (err) => {
                            if (err) return reject(err);
                            
                            // Price history for charts
                            this.db.run(`
                                CREATE TABLE IF NOT EXISTS price_history (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    player_name TEXT NOT NULL,
                                    percent INTEGER NOT NULL,
                                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                                )
                            `, (err) => {
                                if (err) reject(err);
                                else {
                                    console.log('Database tables initialized');
                                    resolve();
                                }
                            });
                        });
                    });
                });
            });
        });
    }

    // Player operations
    getPlayers() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM players ORDER BY percent DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    updatePlayerPercent(name, percent) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE players SET percent = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?',
                [percent, name],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // User operations
    getOrCreateUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve(row);
                } else {
                    // Create new user
                    this.db.run(
                        'INSERT INTO users (user_id, cash) VALUES (?, 1000.00)',
                        [userId],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ user_id: userId, cash: 1000.00 });
                        }
                    );
                }
            });
        });
    }

    updateUserCash(userId, cash) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET cash = ? WHERE user_id = ?',
                [cash, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    // Portfolio operations
    getPortfolio(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM portfolios WHERE user_id = ? AND (yes_shares > 0 OR no_shares > 0)',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    updatePortfolio(userId, playerName, positionType, shares, avgPrice) {
        return new Promise((resolve, reject) => {
            // Get current portfolio first
            this.db.get(
                'SELECT * FROM portfolios WHERE user_id = ? AND player_name = ?',
                [userId, playerName],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    let yesShares = row ? row.yes_shares : 0;
                    let noShares = row ? row.no_shares : 0;
                    let avgYesPrice = row ? row.avg_yes_price : 0;
                    let avgNoPrice = row ? row.avg_no_price : 0;
                    
                    if (positionType === 'yes') {
                        // Calculate new average price for YES shares
                        if (yesShares > 0) {
                            avgYesPrice = ((yesShares * avgYesPrice) + (shares * avgPrice)) / (yesShares + shares);
                        } else {
                            avgYesPrice = avgPrice;
                        }
                        yesShares += shares;
                    } else {
                        // Calculate new average price for NO shares
                        if (noShares > 0) {
                            avgNoPrice = ((noShares * avgNoPrice) + (shares * avgPrice)) / (noShares + shares);
                        } else {
                            avgNoPrice = avgPrice;
                        }
                        noShares += shares;
                    }
                    
                    this.db.run(
                        `INSERT INTO portfolios (user_id, player_name, yes_shares, no_shares, avg_yes_price, avg_no_price, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(user_id, player_name) 
                         DO UPDATE SET yes_shares = ?, no_shares = ?, avg_yes_price = ?, avg_no_price = ?, updated_at = CURRENT_TIMESTAMP`,
                        [userId, playerName, yesShares, noShares, avgYesPrice, avgNoPrice, yesShares, noShares, avgYesPrice, avgNoPrice],
                        (err) => {
                            if (err) reject(err);
                            else resolve({ yesShares, noShares });
                        }
                    );
                }
            );
        });
    }

    // Trade operations
    recordTrade(userId, playerName, type, shares, price, amount) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO trades (user_id, player_name, type, shares, price, amount) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, playerName, type, shares, price, amount],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    getRecentTrades(limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT t.*, u.user_id as trader_id 
                 FROM trades t 
                 JOIN users u ON t.user_id = u.user_id 
                 ORDER BY t.created_at DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    getTotalVolume() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT SUM(amount) as total_volume FROM trades',
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.total_volume || 0);
                }
            );
        });
    }

    // Price history
    addPriceHistory(playerName, percent) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO price_history (player_name, percent) VALUES (?, ?)',
                [playerName, percent],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    getPriceHistory(playerName, limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT percent, timestamp FROM price_history WHERE player_name = ? ORDER BY timestamp DESC LIMIT ?',
                [playerName, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.reverse());
                }
            );
        });
    }

    // Initialize players if empty
    async initPlayersIfEmpty(players) {
        const existing = await this.getPlayers();
        if (existing.length === 0) {
            const stmt = this.db.prepare('INSERT INTO players (name, color, percent, score) VALUES (?, ?, ?, ?)');
            for (const p of players) {
                stmt.run(p.name, p.color, p.percent, p.score);
            }
            stmt.finalize();
            console.log('Initialized players');
        }
    }
}

module.exports = new Database();
