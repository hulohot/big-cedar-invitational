// HuloPredict API Client
const API_BASE = 'http://192.168.5.208:3000';
const WS_URL = 'ws://192.168.5.208:3000';

class HuloPredictAPI {
    constructor() {
        this.userId = this.getOrCreateUserId();
        this.ws = null;
        this.listeners = [];
        this.reconnectInterval = 3000;
    }

    getOrCreateUserId() {
        let userId = localStorage.getItem('hulopredict_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('hulopredict_user_id', userId);
        }
        return userId;
    }

    // REST API calls
    async getPlayers() {
        const res = await fetch(`${API_BASE}/api/players`);
        return res.json();
    }

    async getPriceHistory(playerName) {
        const res = await fetch(`${API_BASE}/api/price-history/${encodeURIComponent(playerName)}`);
        return res.json();
    }

    async getPortfolio() {
        const res = await fetch(`${API_BASE}/api/portfolio/${this.userId}`);
        return res.json();
    }

    async executeTrade(playerName, tradeType, amount) {
        const res = await fetch(`${API_BASE}/api/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: this.userId,
                playerName,
                tradeType,
                amount
            })
        });
        return res.json();
    }

    // WebSocket for real-time updates
    connectWebSocket(onUpdate) {
        this.ws = new WebSocket(WS_URL);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'market_update') {
                onUpdate(data.players);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(() => this.connectWebSocket(onUpdate), this.reconnectInterval);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Create global instance
const api = new HuloPredictAPI();
