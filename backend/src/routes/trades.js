const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/trades/stats/today — MUST be before /:id
router.get('/stats/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trades = await prisma.trade.findMany({
      where: {
        userId: req.user.id,
        closeTime: { gte: today, lt: tomorrow },
        status: 'closed'
      },
      select: { pnl: true, commission: true, side: true, symbol: true, openTime: true }
    });

    const netPnl = (t) => (t.pnl || 0) - (t.commission || 0);
    const totalPnl = trades.reduce((sum, t) => sum + netPnl(t), 0);
    const wins = trades.filter(t => netPnl(t) > 0).length;
    const losses = trades.filter(t => netPnl(t) < 0).length;

    const recentTrades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      orderBy: { closeTime: 'desc' },
      take: 10,
      select: { pnl: true, commission: true }
    });

    let consecutiveLosses = 0;
    for (const t of recentTrades) {
      if (netPnl(t) < 0) consecutiveLosses++;
      else break;
    }

    const rules = await prisma.riskRules.findUnique({
      where: { userId: req.user.id }
    });

    const maxTrades = rules?.maxTradesPerDay || 4;
    const shouldStop = trades.length >= maxTrades || consecutiveLosses >= (rules?.maxConsecutiveLosses || 3);

    res.json({
      date: today,
      totalPnl,
      trades: trades.length,
      wins,
      losses,
      winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
      consecutiveLosses,
      shouldStop,
      rules: {
        maxTrades,
        maxDailyLossPercent: rules?.maxDailyLossPercent || 5,
        requireStopLoss: rules?.requireStopLoss ?? true,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения статистики дня' });
  }
});

// GET /api/trades — list trades with filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      symbol, side, status,
      from, to, date,
      tag, minPnl, maxPnl,
      annotated,
      sortBy = 'openTime', sortOrder = 'desc'
    } = req.query;

    const where = { userId: req.user.id };

    if (symbol) where.symbol = { contains: symbol.toUpperCase() };
    if (side) where.side = side.toUpperCase();
    if (status) where.status = status;

    // Support both from/to range and specific date
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.openTime = { gte: d, lt: next };
    } else if (from || to) {
      where.openTime = {};
      if (from) where.openTime.gte = new Date(from);
      if (to) where.openTime.lte = new Date(to);
    }

    if (tag) where.setupTags = { has: tag };
    if (minPnl !== undefined) where.pnl = { ...where.pnl, gte: parseFloat(minPnl) };
    if (maxPnl !== undefined) where.pnl = { ...where.pnl, lte: parseFloat(maxPnl) };
    if (annotated !== undefined) where.isAnnotated = annotated === 'true';

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: { entryPoints: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.trade.count({ where })
    ]);

    res.json({
      trades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get trades error:', err);
    res.status(500).json({ error: 'Ошибка получения сделок' });
  }
});

// GET /api/trades/:id — single trade details
router.get('/:id', async (req, res) => {
  try {
    const trade = await prisma.trade.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { entryPoints: { orderBy: { time: 'asc' } } }
    });

    if (!trade) return res.status(404).json({ error: 'Сделка не найдена' });

    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения сделки' });
  }
});

// PATCH /api/trades/:id — update trade (annotations + core fields for manual trades)
router.patch('/:id', async (req, res) => {
  try {
    const {
      // Annotation fields
      setupTags, whyEntered, whatWentWrong, whatWentRight,
      notes, emotionBefore, emotionAfter, screenshot,
      stopLoss, takeProfit,
      // Core fields (allowed for manual trades and corrections)
      entryPrice, exitPrice, quantity, leverage, pnl, commission,
      openTime, closeTime, symbol, side
    } = req.body;

    const existing = await prisma.trade.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) return res.status(404).json({ error: 'Сделка не найдена' });

    const updateData = {};

    // Annotation fields
    if (setupTags !== undefined) updateData.setupTags = setupTags;
    if (whyEntered !== undefined) updateData.whyEntered = whyEntered;
    if (whatWentWrong !== undefined) updateData.whatWentWrong = whatWentWrong;
    if (whatWentRight !== undefined) updateData.whatWentRight = whatWentRight;
    if (notes !== undefined) updateData.notes = notes;
    if (emotionBefore !== undefined) updateData.emotionBefore = emotionBefore;
    if (emotionAfter !== undefined) updateData.emotionAfter = emotionAfter;
    if (screenshot !== undefined) updateData.screenshot = screenshot;
    if (stopLoss !== undefined) updateData.stopLoss = stopLoss !== null ? parseFloat(stopLoss) : null;
    if (takeProfit !== undefined) updateData.takeProfit = takeProfit !== null ? parseFloat(takeProfit) : null;

    // Core fields (always allow editing)
    if (entryPrice !== undefined) updateData.entryPrice = parseFloat(entryPrice);
    if (exitPrice !== undefined) updateData.exitPrice = exitPrice !== null ? parseFloat(exitPrice) : null;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (leverage !== undefined) updateData.leverage = parseInt(leverage);
    if (pnl !== undefined) updateData.pnl = pnl !== null ? parseFloat(pnl) : null;
    if (commission !== undefined) updateData.commission = commission !== null ? parseFloat(commission) : null;
    if (openTime !== undefined) updateData.openTime = new Date(openTime);
    if (closeTime !== undefined) {
      updateData.closeTime = closeTime !== null ? new Date(closeTime) : null;
      updateData.status = closeTime ? 'closed' : 'open';
    }
    if (symbol !== undefined) updateData.symbol = symbol.toUpperCase();
    if (side !== undefined) updateData.side = side.toUpperCase();

    // Mark as annotated if key fields filled
    if (whyEntered !== undefined || whatWentWrong !== undefined || whatWentRight !== undefined) {
      const newWhy = whyEntered !== undefined ? whyEntered : existing.whyEntered;
      const newWrong = whatWentWrong !== undefined ? whatWentWrong : existing.whatWentWrong;
      const newRight = whatWentRight !== undefined ? whatWentRight : existing.whatWentRight;
      if (newWhy && (newWrong || newRight)) {
        updateData.isAnnotated = true;
      }
    }

    const updated = await prisma.trade.update({
      where: { id: req.params.id },
      data: updateData,
      include: { entryPoints: true }
    });

    res.json(updated);
  } catch (err) {
    console.error('Update trade error:', err);
    res.status(500).json({ error: 'Ошибка обновления сделки' });
  }
});

// POST /api/trades — manually create trade
router.post('/', async (req, res) => {
  try {
    const {
      symbol, side, type = 'FUTURES',
      entryPrice, exitPrice, quantity, leverage = 1,
      stopLoss, takeProfit, pnl, commission,
      openTime, closeTime,
      setupTags = [], whyEntered, whatWentWrong, whatWentRight, notes,
      emotionBefore, emotionAfter
    } = req.body;

    if (!symbol || !side || !entryPrice || !quantity || !openTime) {
      return res.status(400).json({ error: 'Обязательные поля: symbol, side, entryPrice, quantity, openTime' });
    }

    const trade = await prisma.trade.create({
      data: {
        userId: req.user.id,
        symbol: symbol.toUpperCase(),
        side: side.toUpperCase(),
        type,
        entryPrice: parseFloat(entryPrice),
        exitPrice: exitPrice ? parseFloat(exitPrice) : null,
        quantity: parseFloat(quantity),
        leverage: parseInt(leverage),
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        pnl: pnl ? parseFloat(pnl) : null,
        commission: commission ? parseFloat(commission) : null,
        openTime: new Date(openTime),
        closeTime: closeTime ? new Date(closeTime) : null,
        status: closeTime ? 'closed' : 'open',
        setupTags,
        whyEntered, whatWentWrong, whatWentRight, notes,
        emotionBefore, emotionAfter,
        ruleViolations: [],
        isAnnotated: !!(whyEntered && (whatWentWrong || whatWentRight))
      }
    });

    res.status(201).json(trade);
  } catch (err) {
    console.error('Create trade error:', err);
    res.status(500).json({ error: 'Ошибка создания сделки' });
  }
});

// DELETE /api/trades/:id — delete trade
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.trade.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!existing) return res.status(404).json({ error: 'Сделка не найдена' });

    await prisma.trade.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления сделки' });
  }
});

module.exports = router;
