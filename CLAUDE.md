# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Big Cedar Invitational is a golf tournament website for a private event at Big Cedar Lodge (March 20-22, 2026). It includes:

- **Static frontend** - Tournament info, schedule, player profiles, live Branson Cup standings
- **Prediction market** - Real-time trading platform for betting on player outcomes (Kalshi-style)
- **Score uploader** - OCR-powered scorecard upload using Tesseract.js with IndexedDB storage

## Architecture

### Frontend (Static HTML)
- `index.html` - Main tournament page with schedule, room assignments, player cards
- `prediction-market.html` - Trading UI with Chart.js charts, WebSocket for real-time updates
- `scorer.html` - OCR score uploader using Tesseract.js, stores locally in IndexedDB
- `players/` - Individual player profile pages
- `courses/` - Course information pages

### Backend (`backend/`)
Express + WebSocket server with SQLite database.

**Key files:**
- `server.js` - Express server, REST API routes, WebSocket broadcast
- `market.js` - Singleton market calculator, price movements, trade execution
- `database.js` - SQLite wrapper for users, portfolios, trades, price history

**Database tables:** `players`, `users`, `portfolios`, `trades`, `price_history`

## Development Commands

### Backend Server
```bash
cd backend
npm install
npm start          # Production: node server.js
npm run dev        # Development: nodemon server.js
```

Server runs on port 3000 (configurable via PORT env var).

### Frontend
Static HTML files - open directly in browser or use any static file server.

## API Endpoints

- `GET /api/players` - All players with current prices
- `GET /api/price-history/:playerName` - Chart data for a player
- `GET /api/portfolio/:userId` - User's portfolio
- `GET /api/trades?limit=N` - Recent trades
- `GET /api/volume` - Total trading volume
- `POST /api/trade` - Execute trade (userId, playerName, tradeType, amount)

## Key Implementation Details

### Prediction Market
- Binary options: buy YES (player wins) or NO (player doesn't win) shares
- Prices as percentages (YES price + NO price = 100%)
- WebSocket broadcasts market updates and trades to all clients
- User IDs stored in localStorage (`hulopredict_user_id`)
- Demo mode when backend unreachable

### Score Uploader
- Uses Tesseract.js for client-side OCR
- Auto-detects course name and player names from screenshot
- Validates course matches tournament schedule
- Stores scores in IndexedDB (client-side only)

### Teams
- **Heavy Rain** (Room 1): Thomas, Cole, Conrad, Justin
- **The Sandbaggers** (Room 2): Ethan, Garrett, Dylan, Estes
- Team logos: `images/heavy-rain-team1.png`, `images/sandbaggers-team2.png`
