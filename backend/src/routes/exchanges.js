const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt } = require('../lib/crypto');
const BinanceService = require('../services/binanceService');
const syncService = require('../services/syncService');

const SUPPORTED_EXCHANGES = {
  binance:  { name: 'Binance',    emoji: '🟡', live: true,  type: 'Futures + Spot' },
  bybit:    { name: 'Bybit',      emoji: '🟠', live: false, type: 'Futures + Spot' },
  okx:      { name: 'OKX',        emoji: '⚫', live: false, type: 'Futures + Spot' },
  bitget:   { name: 'Bitget',     emoji: '🔵', live: false, type: 'Futures + Spot' },
  gateio:   { name: 'Gate.io',    emoji: '🟢', live: false, type: 'Futures + Spot' },
  mexc:     { name: 'MEXC',       emoji: '🔴', live: false, type: 'Futures + Spot' },
  hyperliquid: { name: 'Hyperliquid', emoji: '🟣', live: false, type: 'Perp DEX' },
};

const router = express.Router();
router.use(authenticate);

// GET /api/exchanges — list all connections
router.get('/', async (req, res) => {
  try {
    const connections = await prisma.exchangeConnection.findMany({
      where: { userId: req.user.id },
      select: {
        id: true, exchange: true, label: true,
        isActive: true, lastSyncAt: true, createdAt: true
      }
    });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения бирж' });
  }
});

// POST /api/exchanges — add new exchange
router.post('/', async (req, res) => {
  try {
    const { exchange, apiKey, apiSecret, label } = req.body;

    if (!exchange || !apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Биржа, API Key и Secret обязательны' });
    }

    const exchangeInfo = SUPPORTED_EXCHANGES[exchange];
    if (!exchangeInfo) {
      return res.status(400).json({ error: 'Неизвестная биржа' });
    }

    // Test connection first (only for live exchanges)
    let testResult = { success: true, totalBalance: null };
    if (exchange === 'binance' && exchangeInfo.live) {
      const binance = new BinanceService(apiKey, apiSecret);
      testResult = await binance.testConnection();
    }

    if (!testResult.success) {
      return res.status(400).json({ 
        error: `Ошибка подключения к ${exchange}: ${testResult.error || 'Проверь API ключи'}` 
      });
    }

    const connection = await prisma.exchangeConnection.create({
      data: {
        userId: req.user.id,
        exchange,
        label: label || exchange,
        apiKeyEncrypted: encrypt(apiKey),
        apiSecretEncrypted: encrypt(apiSecret),
      },
      select: { id: true, exchange: true, label: true, isActive: true, createdAt: true }
    });

    // Start initial sync (only for live exchanges)
    if (exchangeInfo.live) {
      syncService.syncExchange({ 
        ...connection, 
        apiKeyEncrypted: encrypt(apiKey), 
        apiSecretEncrypted: encrypt(apiSecret),
        userId: req.user.id 
      }).catch(console.error);
    }

    res.status(201).json({ 
      connection,
      balance: testResult.totalBalance,
      message: exchangeInfo.live
        ? 'Биржа подключена! Начинаем синхронизацию...'
        : `${exchangeInfo.name} подключён. Автосинхронизация будет доступна в ближайшем обновлении.`
    });
  } catch (err) {
    console.error('Add exchange error:', err);
    res.status(500).json({ error: 'Ошибка добавления биржи' });
  }
});

// POST /api/exchanges/sync — manual sync
router.post('/sync', async (req, res) => {
  try {
    const results = await syncService.syncForUser(req.user.id);
    res.json({ message: 'Синхронизация запущена', exchanges: results });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка синхронизации' });
  }
});

// GET /api/exchanges/:id/balance
router.get('/:id/balance', async (req, res) => {
  try {
    const connection = await prisma.exchangeConnection.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!connection) return res.status(404).json({ error: 'Биржа не найдена' });

    const apiKey = decrypt(connection.apiKeyEncrypted);
    const apiSecret = decrypt(connection.apiSecretEncrypted);

    let balance = {};
    if (connection.exchange === 'binance') {
      const binance = new BinanceService(apiKey, apiSecret);
      balance = await binance.getBalance();
    }

    res.json(balance);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения баланса' });
  }
});

// DELETE /api/exchanges/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.exchangeConnection.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ message: 'Биржа отключена' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления биржи' });
  }
});

module.exports = router;
