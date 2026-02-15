const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const market = require('./market');
const database = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS - allow GitHub Pages and local network
app.use(cors({
    origin: ['http://192.168.5.208:8082', 'http://localhost:8082', 'http://localhost:3000', 'https://hulohot.github.io', 'https://9ee7-72-204-20-47.ngrok-free.app'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.get('/api/players', async (req, res) => {
    try {
        const players = market.getPlayers();
        res.json({ players });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/price-history/:playerName', async (req, res) => {
    try {
        const history = market.getPriceHistory(req.params.playerName);
        res.json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/portfolio/:userId', async (req, res) => {
    try {
        const portfolio = await market.getUserPortfolio(req.params.userId);
        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/trades', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const trades = await database.getRecentTrades(limit);
        res.json({ trades });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/volume', async (req, res) => {
    try {
        const volume = await database.getTotalVolume();
        res.json({ volume });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/trade', async (req, res) => {
    try {
        const { userId, playerName, tradeType, amount } = req.body;
        
        if (!userId || !playerName || !tradeType || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await market.executeTrade(userId, playerName, tradeType, amount);
        
        // Broadcast trade to all clients
        broadcastTrade(result, userId, playerName, tradeType, amount);
        broadcastUpdate();
        
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// WebSocket
const clients = new Set();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection from', req.socket.remoteAddress);
    clients.add(ws);
    sendMarketData(ws);
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('WebSocket disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

function sendMarketData(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        const data = {
            type: 'market_update',
            players: market.getPlayers(),
            timestamp: Date.now()
        };
        ws.send(JSON.stringify(data));
    }
}

function broadcastUpdate() {
    const data = {
        type: 'market_update',
        players: market.getPlayers(),
        timestamp: Date.now()
    };
    
    const message = JSON.stringify(data);
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function broadcastTrade(tradeResult, userId, playerName, tradeType, amount) {
    const data = {
        type: 'trade_update',
        trade: {
            trader_id: userId,
            player_name: playerName,
            type: tradeType,
            amount: amount,
            shares: tradeResult.totalShares || tradeResult.remainingShares || 0,
            timestamp: new Date().toISOString()
        },
        timestamp: Date.now()
    };
    
    const message = JSON.stringify(data);
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Initialize and start
async function start() {
    try {
        // Initialize database tables first
        await database.initTables();
        
        // Then initialize market
        await market.init();
        
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`HuloPredict server running on http://0.0.0.0:${PORT}`);
            console.log(`WebSocket server ready for real-time updates`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

start();
