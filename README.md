# 🐍 PolygonSniper

**The first serious token sniper bot for Polygon.**

Monitors QuickSwap and Uniswap V3 for new pair listings in real-time and executes instant snipe buys the moment a new token launches. Built for speed, built for Polygon.

---

## Features

- ⚡ Real-time new pair detection via WebSocket (QuickSwap V2 + Uniswap V3)
- 🎯 Instant snipe execution with configurable buy delay
- 📈 Auto take-profit / stop-loss position management
- 🛡️ Slippage protection
- 🔄 Auto-retry on failed transactions
- 💰 $PRIME tax — 1% of every profitable trade feeds the War Chest
- 📋 Full trade logging (console + file)
- 🏃 Runs on any device with Node.js (PC, Mac, Linux, Android via Termux)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure

```bash
cp .env.copy .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Your wallet's private key (use a dedicated sniper wallet) |
| `RPC_ENDPOINT` | Polygon HTTPS RPC (Alchemy/QuickNode recommended) |
| `RPC_WEBSOCKET_ENDPOINT` | Polygon WebSocket RPC |
| `BUY_AMOUNT` | MATIC to spend per snipe (default: 0.5) |
| `SLIPPAGE` | Slippage % (default: 10) |
| `TAKE_PROFIT` | Auto-sell at X% profit (default: 50) |
| `STOP_LOSS` | Auto-sell at X% loss (default: 20) |
| `PRIME_TAX_WALLET` | War Chest address for 1% profit tax |

### 3. Run

```bash
# Development
npm run dev

# Production (build first)
npm run build
npm start
```

---

## Running on Android (Termux)

```bash
pkg install nodejs
git clone https://github.com/kevinleestites2-dev/PolygonSniper
cd PolygonSniper
npm install
cp .env.copy .env
# edit .env with your values
npm run dev
```

---

## ⚠️ Risk Warning

This is experimental software. Crypto trading is high risk. Never snipe with funds you can't afford to lose. Always use a dedicated wallet. The authors are not responsible for any losses.

---

## $PRIME Tax

Every profitable trade sends 1% to the `PRIME_TAX_WALLET` address. This feeds the Pantheon War Chest. Disable with `PRIME_TAX_ENABLED=false`.

---

## License

MIT — fork it, use it, build on it.
