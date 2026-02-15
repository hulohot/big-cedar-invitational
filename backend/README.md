# HuloPredict Backend

Real-time prediction market backend for Big Cedar Invitational.

## Features

- **Singleton Market**: All users see the same prices calculated by the server
- **SQLite Database**: Persistent storage of portfolios, trades, and price history
- **WebSocket**: Real-time price updates to all connected clients
- **Security**: Rate limiting, CORS, helmet protection
- **Auto-start**: Systemd service for automatic startup

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start the Server

```bash
./start.sh
```

Or manually:
```bash
node server.js
```

Server will be available at:
- API: `http://192.168.5.208:3000`
- WebSocket: `ws://192.168.5.208:3000`

### 3. Auto-start on Boot (Optional)

```bash
# Copy service file
sudo cp hulopredict.service /etc/systemd/system/

# Enable and start
sudo systemctl enable hulopredict
sudo systemctl start hulopredict

# Check status
sudo systemctl status hulopredict
```

## API Endpoints

- `GET /api/players` - Get all players with current prices
- `GET /api/price-history/:playerName` - Get chart data
- `GET /api/portfolio/:userId` - Get user's portfolio
- `POST /api/trade` - Execute a trade

## Database

SQLite database file: `hulopredict.db`

Tables:
- `players` - Current market data
- `users` - User accounts with cash balance
- `portfolios` - Shares owned by users
- `trades` - Trade history
- `price_history` - Chart data

## Security

- Rate limiting: 100 requests per 15 minutes per IP
- CORS: Only allows local network IPs
- Helmet: Security headers
- No external database dependencies (SQLite)

## File Structure

```
backend/
├── server.js          # Express + WebSocket server
├── market.js          # Singleton market calculator
├── database.js        # SQLite wrapper
├── api-client.js      # Frontend client (copy to frontend)
├── package.json       # Dependencies
├── start.sh           # Startup script
├── hulopredict.service # Systemd service
└── hulopredict.db     # SQLite database (created on first run)
```
