const axios = require('axios');
const crypto = require('crypto');

class BinanceService {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = 'https://fapi.binance.com'; // Futures
    this.spotUrl = 'https://api.binance.com';  // Spot
  }

  sign(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  async request(url, params = {}) {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp, recvWindow: 5000 };
    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    
    const signature = this.sign(queryString);
    const fullUrl = `${url}?${queryString}&signature=${signature}`;

    const response = await axios.get(fullUrl, {
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    return response.data;
  }

  // Test API key validity
  async testConnection() {
    try {
      await axios.get(`${this.baseUrl}/fapi/v1/ping`);
      const account = await this.request(`${this.baseUrl}/fapi/v2/account`);
      return { 
        success: true, 
        totalBalance: parseFloat(account.totalWalletBalance || 0)
      };
    } catch (err) {
      console.error('Binance test error:', err.response?.data || err.message);
      return { 
        success: false, 
        error: err.response?.data?.msg || err.message 
      };
    }
  }

  // Get futures account balance
  async getBalance() {
    const account = await this.request(`${this.baseUrl}/fapi/v2/account`);
    return {
      totalBalance: parseFloat(account.totalWalletBalance),
      availableBalance: parseFloat(account.availableBalance),
      unrealizedPnl: parseFloat(account.totalUnrealizedProfit),
    };
  }

  // Fetch leverage map for all positions from positionRisk
  // Returns { BTCUSDT: 75, ETHUSDT: 20, ... }
  async getLeverageMap() {
    try {
      const positions = await this.request(`${this.baseUrl}/fapi/v2/positionRisk`);
      const map = {};
      for (const p of positions) {
        const lev = parseInt(p.leverage);
        if (lev && lev > 0) {
          map[p.symbol] = lev;
        }
      }
      return map;
    } catch (e) {
      console.error('getLeverageMap error:', e.message);
      return {};
    }
  }

  // Get closed futures positions (orders history)
  async getClosedPositions(startTime = null) {
    const params = { limit: 500 };
    if (startTime) params.startTime = startTime;

    const income = await this.request(`${this.baseUrl}/fapi/v1/income`, {
      incomeType: 'REALIZED_PNL',
      limit: 1000,
      ...(startTime && { startTime })
    });

    return income;
  }

  // Parse and normalize trades into our format
  async getNormalizedTrades(lastSyncTime = null) {
    const startTime = lastSyncTime ? new Date(lastSyncTime).getTime() : null;
    
    // Get income (PnL events)
    const incomeData = await this.request(`${this.baseUrl}/fapi/v1/income`, {
      incomeType: 'REALIZED_PNL',
      limit: 1000,
      ...(startTime && { startTime })
    });

    if (!incomeData.length) return [];

    // Fetch leverage map once for all symbols
    const leverageMap = await this.getLeverageMap();

    const symbols = [...new Set(incomeData.map(i => i.symbol))];
    const normalizedTrades = [];

    for (const symbol of symbols) {
      try {
        const trades = await this.request(`${this.baseUrl}/fapi/v1/userTrades`, {
          symbol,
          limit: 1000,
          ...(startTime && { startTime })
        });

        // Pass leverage for this symbol (from positionRisk)
        const symbolLeverage = leverageMap[symbol] || 1;
        const grouped = this.groupTradesIntoPositions(trades, symbol, symbolLeverage);
        normalizedTrades.push(...grouped);
        
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        console.error(`Error for ${symbol}:`, e.message);
      }
    }

    return normalizedTrades;
  }

  groupTradesIntoPositions(trades, symbol, symbolLeverage = 1) {
    if (!trades.length) return [];

    // Sort by time
    trades.sort((a, b) => a.time - b.time);

    const positions = [];
    let currentPosition = null;
    let runningQty = 0;

    for (const trade of trades) {
      const qty = parseFloat(trade.qty);
      const price = parseFloat(trade.price);
      const isBuy = trade.side === 'BUY';
      const pnl = parseFloat(trade.realizedPnl || 0);

      if (currentPosition === null) {
        // Opening new position — use symbolLeverage from positionRisk
        currentPosition = {
          symbol,
          side: isBuy ? 'LONG' : 'SHORT',
          type: 'FUTURES',
          entryPrice: price,
          quantity: qty,
          openTime: new Date(trade.time),
          closeTime: null,
          exitPrice: null,
          pnl: 0,
          commission: Math.abs(parseFloat(trade.commission || 0)),
          leverage: symbolLeverage,
          exchangeTradeId: trade.orderId?.toString(),
          entryPoints: [{
            type: 'entry',
            price,
            quantity: qty,
            time: new Date(trade.time)
          }]
        };
        runningQty = qty;
      } else {
        const isClosing = (currentPosition.side === 'LONG' && !isBuy) ||
                         (currentPosition.side === 'SHORT' && isBuy);

        if (isClosing) {
          runningQty -= qty;
          currentPosition.pnl += pnl;
          currentPosition.commission += Math.abs(parseFloat(trade.commission || 0));
          
          if (currentPosition.entryPoints) {
            currentPosition.entryPoints.push({
              type: 'exit',
              price,
              quantity: qty,
              time: new Date(trade.time)
            });
          }

          if (runningQty <= 0.0001) {
            currentPosition.closeTime = new Date(trade.time);
            currentPosition.exitPrice = price;
            // Compute duration in seconds
            currentPosition.duration = Math.round(
              (currentPosition.closeTime - currentPosition.openTime) / 1000
            );
            positions.push({ ...currentPosition });
            currentPosition = null;
            runningQty = 0;
          }
        } else {
          // Adding to position (DCA)
          const totalQty = runningQty + qty;
          currentPosition.entryPrice = (currentPosition.entryPrice * runningQty + price * qty) / totalQty;
          currentPosition.quantity = totalQty;
          currentPosition.commission += Math.abs(parseFloat(trade.commission || 0));
          runningQty = totalQty;
          
          if (currentPosition.entryPoints) {
            currentPosition.entryPoints.push({
              type: 'add',
              price,
              quantity: qty,
              time: new Date(trade.time)
            });
          }
        }
      }
    }

    // If there's still an open position
    if (currentPosition !== null) {
      currentPosition.status = 'open';
      positions.push(currentPosition);
    }

    return positions.filter(p => p.exitPrice !== null || p.status === 'open');
  }

  // Get open positions
  async getOpenPositions() {
    const positions = await this.request(`${this.baseUrl}/fapi/v2/positionRisk`);
    return positions.filter(p => parseFloat(p.positionAmt) !== 0).map(p => ({
      symbol: p.symbol,
      side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
      entryPrice: parseFloat(p.entryPrice),
      markPrice: parseFloat(p.markPrice),
      pnl: parseFloat(p.unRealizedProfit),
      leverage: parseInt(p.leverage),
      quantity: Math.abs(parseFloat(p.positionAmt)),
      liquidationPrice: parseFloat(p.liquidationPrice),
      status: 'open'
    }));
  }
}

module.exports = BinanceService;
