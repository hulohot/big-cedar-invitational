const database = require('./database');

// Singleton market state - single source of truth for all prices
class Market {
    constructor() {
        this.players = [];
        this.priceHistory = {}; // { playerName: [percent, percent, ...] }
        this.historyLength = 50;
        this.lastUpdate = Date.now();
        
        // Seeded random for consistent price movements
        this.seed = 0xB1C2026; // Big Cedar 2026
    }

    // Seeded random number generator (Mulberry32)
    random() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    async init() {
        // Load players from DB or use defaults
        const dbPlayers = await database.getPlayers();
        
        if (dbPlayers.length === 0) {
            // Default initial players
            const defaultPlayers = [
                { name: 'Thomas Reynolds', color: '#1a5f4a', percent: 38, score: -8, holes: 18 },
                { name: 'Justin Settlemoir', color: '#d4af37', percent: 22, score: -6, holes: 18 },
                { name: 'Cole Parton', color: '#ffb81c', percent: 15, score: -4, holes: 18 },
                { name: 'Ethan Brugger', color: '#006747', percent: 12, score: -3, holes: 18 },
                { name: 'Conrad Murray', color: '#5c8a6e', percent: 8, score: -2, holes: 18 },
                { name: 'Garrett Story', color: '#4a7c59', percent: 3, score: -1, holes: 18 },
                { name: 'Dylan Huber', color: '#2d5016', percent: 1, score: 0, holes: 18 },
                { name: 'Burke Estes', color: '#6b8e23', percent: 1, score: 0, holes: 18 }
            ];
            
            await database.initPlayersIfEmpty(defaultPlayers);
            for (const p of defaultPlayers) {
                await new Promise((resolve, reject) => {
                    database.db.run(
                        'INSERT OR IGNORE INTO players (name, color, percent, score) VALUES (?, ?, ?, ?)',
                        [p.name, p.color, p.percent, p.score],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            this.players = defaultPlayers;
        } else {
            this.players = dbPlayers;
        }

        // Initialize price history
        for (const p of this.players) {
            const history = await database.getPriceHistory(p.name, this.historyLength);
            if (history.length < this.historyLength) {
                // Generate fake history if not enough data
                this.priceHistory[p.name] = this.generateFakeHistory(p.percent);
            } else {
                this.priceHistory[p.name] = history.map(h => h.percent / 100);
            }
        }

        console.log('Market initialized with', this.players.length, 'players');
    }

    generateFakeHistory(currentPercent) {
        const history = [];
        let price = currentPercent / 100;
        for (let i = 0; i < this.historyLength; i++) {
            price += (this.random() - 0.5) * 0.02;
            price = Math.max(0.01, Math.min(0.99, price));
            history.push(price);
        }
        return history;
    }

    getPlayers() {
        return this.players;
    }

    getPlayer(name) {
        return this.players.find(p => p.name === name);
    }

    getPriceHistory(playerName) {
        return this.priceHistory[playerName] || [];
    }

    // Update prices - called periodically
    async updatePrices() {
        // Random price movements
        for (const p of this.players) {
            const change = (this.random() - 0.5) * 3;
            p.percent = Math.round(Math.max(1, Math.min(50, p.percent + change)));
            
            // Update history
            if (!this.priceHistory[p.name]) {
                this.priceHistory[p.name] = [];
            }
            this.priceHistory[p.name].push(p.percent / 100);
            if (this.priceHistory[p.name].length > this.historyLength) {
                this.priceHistory[p.name].shift();
            }
            
            // Save to database
            await database.updatePlayerPercent(p.name, p.percent);
            await database.addPriceHistory(p.name, p.percent);
        }

        // Keep sorted by percent
        this.players.sort((a, b) => b.percent - a.percent);
        this.lastUpdate = Date.now();
        
        return this.players;
    }

    // Execute a trade - binary options style
    async executeTrade(userId, playerName, tradeType, amount) {
        const player = this.getPlayer(playerName);
        if (!player) {
            throw new Error('Player not found');
        }

        const user = await database.getOrCreateUser(userId);
        
        if (tradeType === 'yes') {
            // Buy YES shares at current YES price (player.percent / 100)
            const yesPrice = player.percent / 100;
            const yesShares = amount / yesPrice;

            if (user.cash < amount) {
                throw new Error('Insufficient funds');
            }

            const newCash = user.cash - amount;
            await database.updateUserCash(userId, newCash);

            const result = await database.updatePortfolio(userId, playerName, 'yes', yesShares, yesPrice);
            await database.recordTrade(userId, playerName, 'yes', yesShares, yesPrice, amount);

            return {
                success: true,
                tradeType: 'yes',
                shares: yesShares,
                price: yesPrice,
                newCash: newCash,
                totalYesShares: result.yesShares,
                totalNoShares: result.noShares
            };
        } else if (tradeType === 'no') {
            // Buy NO shares at current NO price ((100 - player.percent) / 100)
            const noPrice = (100 - player.percent) / 100;
            const noShares = amount / noPrice;

            if (user.cash < amount) {
                throw new Error('Insufficient funds');
            }

            const newCash = user.cash - amount;
            await database.updateUserCash(userId, newCash);

            const result = await database.updatePortfolio(userId, playerName, 'no', noShares, noPrice);
            await database.recordTrade(userId, playerName, 'no', noShares, noPrice, amount);

            return {
                success: true,
                tradeType: 'no',
                shares: noShares,
                price: noPrice,
                newCash: newCash,
                totalYesShares: result.yesShares,
                totalNoShares: result.noShares
            };
        } else {
            throw new Error('Invalid trade type');
        }
    }

    // Get user portfolio with current values
    async getUserPortfolio(userId) {
        const user = await database.getOrCreateUser(userId);
        const portfolio = await database.getPortfolio(userId);
        
        let totalValue = user.cash;
        const holdings = portfolio.map(p => {
            const player = this.getPlayer(p.player_name);
            const yesCurrentValue = p.yes_shares * (player.percent / 100);
            const noCurrentValue = p.no_shares * ((100 - player.percent) / 100);
            const positionValue = yesCurrentValue + noCurrentValue;
            totalValue += positionValue;
            
            return {
                name: p.player_name,
                yesShares: p.yes_shares || 0,
                noShares: p.no_shares || 0,
                avgYesPrice: p.avg_yes_price || 0,
                avgNoPrice: p.avg_no_price || 0,
                currentValue: positionValue
            };
        });

        return {
            cash: user.cash,
            holdings: holdings,
            totalValue: totalValue
        };
    }
}

// Export singleton instance
module.exports = new Market();
