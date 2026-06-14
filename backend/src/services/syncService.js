const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { decrypt } = require('../lib/crypto');
const BinanceService = require('./binanceService');

class SyncService {
  constructor() {
    this.isSyncing = new Set();
  }

  startAutoSync() {
    // Sync every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 Auto-sync started...');
      await this.syncAllUsers();
    });
    console.log('📡 Auto-sync scheduled (every 5 minutes)');
  }

  async syncAllUsers() {
    try {
      const connections = await prisma.exchangeConnection.findMany({
        where: { isActive: true }
      });

      for (const connection of connections) {
        if (!this.isSyncing.has(connection.id)) {
          await this.syncExchange(connection);
        }
      }
    } catch (err) {
      console.error('Sync all users error:', err);
    }
  }

  async syncExchange(connection) {
    this.isSyncing.add(connection.id);

    try {
      const apiKey = decrypt(connection.apiKeyEncrypted);
      const apiSecret = decrypt(connection.apiSecretEncrypted);

      let trades = [];

      if (connection.exchange === 'binance') {
        const binance = new BinanceService(apiKey, apiSecret);
        trades = await binance.getNormalizedTrades(connection.lastSyncAt);
      }
      // Add more exchanges here...

      let newCount = 0;
      let updatedCount = 0;

      for (const trade of trades) {
        const { entryPoints, ...tradeData } = trade;

        // Try to find existing trade by exchangeTradeId
        const existing = trade.exchangeTradeId
          ? await prisma.trade.findFirst({
              where: {
                userId: connection.userId,
                exchangeTradeId: trade.exchangeTradeId,
              }
            })
          : null;

        if (existing) {
          // Update existing trade — especially leverage, status, closeTime, exitPrice
          const needsUpdate =
            existing.leverage !== tradeData.leverage ||
            existing.status !== (tradeData.status || 'closed') ||
            (tradeData.closeTime && !existing.closeTime) ||
            (tradeData.exitPrice && !existing.exitPrice);

          if (needsUpdate) {
            await prisma.trade.update({
              where: { id: existing.id },
              data: {
                leverage: tradeData.leverage || existing.leverage,
                status: tradeData.status || existing.status,
                closeTime: tradeData.closeTime || existing.closeTime,
                exitPrice: tradeData.exitPrice || existing.exitPrice,
                pnl: tradeData.pnl !== undefined ? tradeData.pnl : existing.pnl,
                commission: tradeData.commission !== undefined ? tradeData.commission : existing.commission,
                duration: tradeData.duration || existing.duration,
              }
            });
            updatedCount++;
          }
        } else {
          // Create new trade
          const created = await prisma.trade.create({
            data: {
              ...tradeData,
              userId: connection.userId,
              exchangeId: connection.id,
              setupTags: tradeData.setupTags || [],
              ruleViolations: [],
            }
          });

          // Create entry/exit points
          if (entryPoints && entryPoints.length > 0) {
            await prisma.tradePoint.createMany({
              data: entryPoints.map(p => ({
                tradeId: created.id,
                type: p.type,
                price: p.price,
                quantity: p.quantity || null,
                time: p.time,
              }))
            });
          }

          newCount++;
        }
      }

      // Update last sync time
      await prisma.exchangeConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date() }
      });

      if (newCount > 0 || updatedCount > 0) {
        console.log(`✅ Exchange ${connection.id}: +${newCount} new, ${updatedCount} updated trades`);
      }

    } catch (err) {
      console.error(`❌ Sync error for exchange ${connection.id}:`, err.message);
    } finally {
      this.isSyncing.delete(connection.id);
    }
  }

  async syncForUser(userId) {
    const connections = await prisma.exchangeConnection.findMany({
      where: { userId, isActive: true }
    });

    const results = [];
    for (const conn of connections) {
      await this.syncExchange(conn);
      results.push({ exchangeId: conn.id, exchange: conn.exchange });
    }

    return results;
  }
}

module.exports = new SyncService();
