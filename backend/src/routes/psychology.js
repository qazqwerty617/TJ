const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/psychology/rules — get risk rules
router.get('/rules', async (req, res) => {
  try {
    const rules = await prisma.riskRules.findUnique({
      where: { userId: req.user.id }
    });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения правил' });
  }
});

// PUT /api/psychology/rules — update risk rules
router.put('/rules', async (req, res) => {
  try {
    const {
      maxDailyLossPercent, maxDailyLossUsd, maxTradesPerDay,
      maxLeverage, requireStopLoss, maxConsecutiveLosses,
      tradingHoursStart, tradingHoursEnd, motivationalMessages
    } = req.body;

    const rules = await prisma.riskRules.upsert({
      where: { userId: req.user.id },
      update: {
        maxDailyLossPercent, maxDailyLossUsd, maxTradesPerDay,
        maxLeverage, requireStopLoss, maxConsecutiveLosses,
        tradingHoursStart, tradingHoursEnd,
        ...(motivationalMessages && { motivationalMessages })
      },
      create: {
        userId: req.user.id,
        maxDailyLossPercent: maxDailyLossPercent ?? 5,
        maxDailyLossUsd,
        maxTradesPerDay: maxTradesPerDay ?? 4,
        maxLeverage: maxLeverage ?? 10,
        requireStopLoss: requireStopLoss ?? true,
        maxConsecutiveLosses: maxConsecutiveLosses ?? 3,
        tradingHoursStart,
        tradingHoursEnd,
        motivationalMessages: motivationalMessages || []
      }
    });

    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления правил' });
  }
});

// GET /api/psychology/check — real-time trading check
router.get('/check', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [rules, todayTrades, journal] = await Promise.all([
      prisma.riskRules.findUnique({ where: { userId: req.user.id } }),
      prisma.trade.findMany({
        where: {
          userId: req.user.id,
          closeTime: { gte: today, lt: tomorrow },
          status: 'closed'
        },
        select: { pnl: true, commission: true },
        orderBy: { closeTime: 'desc' }
      }),
      prisma.dailyJournal.findUnique({
        where: { userId_date: { userId: req.user.id, date: today } }
      })
    ]);

    // Net PnL (subtract commission) — consistent with analytics routes
    const netPnl = (t) => (t.pnl || 0) - (t.commission || 0);
    const totalDailyPnl = todayTrades.reduce((sum, t) => sum + netPnl(t), 0);
    const tradesCount = todayTrades.length;

    // Consecutive losses (most recent first)
    let consecutiveLosses = 0;
    for (const t of todayTrades) {
      if (netPnl(t) < 0) consecutiveLosses++;
      else break;
    }

    const warnings = [];
    let shouldStop = false;

    if (rules) {
      // Check max trades per day
      if (tradesCount >= (rules.maxTradesPerDay || 4)) {
        warnings.push(`🚫 Лимит сделок на сегодня (${rules.maxTradesPerDay}) исчерпан!`);
        shouldStop = true;
      }

      // Check consecutive losses
      if (consecutiveLosses >= (rules.maxConsecutiveLosses || 3)) {
        warnings.push(`🚫 ${consecutiveLosses} убыточных сделок подряд. Стоп!`);
        shouldStop = true;
      }

      // Check daily loss in USD
      if (rules.maxDailyLossUsd && totalDailyPnl <= -Math.abs(rules.maxDailyLossUsd)) {
        warnings.push(`🚫 Достигнут дневной лимит убытка: -$${Math.abs(totalDailyPnl).toFixed(2)} (лимит: $${rules.maxDailyLossUsd})`);
        shouldStop = true;
      }

      // Check daily loss in % (if deposit is configured)
      if (rules.maxDailyLossPercent && rules.depositAmount && rules.depositAmount > 0) {
        const lossPercent = Math.abs(totalDailyPnl / rules.depositAmount) * 100;
        if (totalDailyPnl < 0 && lossPercent >= rules.maxDailyLossPercent) {
          warnings.push(`🚫 Дневной убыток ${lossPercent.toFixed(1)}% превысил лимит ${rules.maxDailyLossPercent}% от депозита`);
          shouldStop = true;
        }
      }

      // Check trading hours
      const currentHour = new Date().getHours();
      if (rules.tradingHoursStart !== null && rules.tradingHoursEnd !== null &&
          rules.tradingHoursStart !== undefined && rules.tradingHoursEnd !== undefined) {
        if (currentHour < rules.tradingHoursStart || currentHour >= rules.tradingHoursEnd) {
          warnings.push(`⏰ Сейчас не твоё время торговли (${rules.tradingHoursStart}:00 - ${rules.tradingHoursEnd}:00)`);
        }
      }
    }

    // Check journal check-in
    if (journal && journal.shouldTrade === false) {
      warnings.push('⚠️ По утреннему чек-ину — сегодня лучше не торговать');
    }

    // Get random motivational message
    const messages = rules?.motivationalMessages || [];
    const randomMessage = messages.length > 0
      ? messages[Math.floor(Math.random() * messages.length)]
      : null;

    res.json({
      shouldStop,
      warnings,
      dailyStats: {
        pnl: Math.round(totalDailyPnl * 100) / 100,
        trades: tradesCount,
        consecutiveLosses
      },
      motivationalMessage: randomMessage,
      rules
    });
  } catch (err) {
    console.error('Psychology check error:', err);
    res.status(500).json({ error: 'Ошибка проверки психологии' });
  }
});

// GET /api/psychology/logs — history
router.get('/logs', async (req, res) => {
  try {
    const logs = await prisma.psychologyLog.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
      take: 50
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения логов' });
  }
});

// POST /api/psychology/logs — add log event
router.post('/logs', async (req, res) => {
  try {
    const { eventType, message, data } = req.body;

    const log = await prisma.psychologyLog.create({
      data: { userId: req.user.id, eventType, message, data }
    });

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка записи лога' });
  }
});

module.exports = router;
