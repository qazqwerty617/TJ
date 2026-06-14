const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Вычислить текущий прогресс цели на основе реальных сделок
async function calcProgress(goal, userId) {
  if (goal.targetType === 'custom') {
    return { current: null, percent: null };
  }

  const now = new Date();
  const start = goal.startDate || getPeriodStart(goal.period, now);
  const end = goal.endDate || getPeriodEnd(goal.period, now);

  const trades = await prisma.trade.findMany({
    where: {
      userId,
      status: 'closed',
      closeTime: { gte: start, lte: end }
    },
    select: { pnl: true, commission: true }
  });

  const netPnl = trades.reduce((s, t) => s + (t.pnl || 0) - (t.commission || 0), 0);
  const wins = trades.filter(t => (t.pnl || 0) - (t.commission || 0) > 0).length;
  const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

  let current = 0;
  if (goal.targetType === 'pnl') current = Math.round(netPnl * 100) / 100;
  else if (goal.targetType === 'pnl_percent') {
    const deposit = goal.depositAmount || 1;
    current = Math.round((netPnl / deposit) * 10000) / 100; // rounded to 2 decimal %
  }
  else if (goal.targetType === 'winrate') current = winRate;
  else if (goal.targetType === 'trades') current = trades.length;

  const percent = goal.targetValue > 0
    ? Math.min(100, Math.round((current / goal.targetValue) * 100))
    : 0;

  const isCompleted = goal.targetValue != null && current >= goal.targetValue;

  return { current, percent, isCompleted };
}

function getPeriodStart(period, now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === 'day') { return d; }
  if (period === 'month') { d.setDate(1); return d; }
  if (period === 'quarter') {
    const q = Math.floor(d.getMonth() / 3);
    d.setMonth(q * 3, 1); return d;
  }
  if (period === 'halfyear') {
    d.setMonth(d.getMonth() < 6 ? 0 : 6, 1); return d;
  }
  if (period === 'year') { d.setMonth(0, 1); return d; }
  return d;
}

function getPeriodEnd(period, now) {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  if (period === 'day') { return d; }
  if (period === 'month') {
    d.setMonth(d.getMonth() + 1, 0); return d;
  }
  if (period === 'quarter') {
    const q = Math.floor(d.getMonth() / 3);
    d.setMonth(q * 3 + 3, 0); return d;
  }
  if (period === 'halfyear') {
    d.setMonth(d.getMonth() < 6 ? 5 : 11, 31); return d;
  }
  if (period === 'year') { d.setMonth(11, 31); return d; }
  return d;
}

// GET /api/goals — все цели + прогресс
router.get('/', async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    const result = await Promise.all(goals.map(async (goal) => {
      const progress = await calcProgress(goal, req.user.id);

      // Авто-закрытие если достигли
      if (progress.isCompleted && !goal.isCompleted) {
        await prisma.goal.update({
          where: { id: goal.id },
          data: { isCompleted: true, completedAt: new Date() }
        });
        goal.isCompleted = true;
        goal.completedAt = new Date();
        goal.justCompleted = true; // Сигнал для уведомления
      }

      return {
        ...goal,
        current: progress.current,
        percent: progress.percent,
        justCompleted: goal.justCompleted || false,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки целей' });
  }
});

// POST /api/goals — создать цель
router.post('/', async (req, res) => {
  try {
    const { title, period, targetType, targetValue, depositAmount, customNote, unit, startDate, endDate } = req.body;

    if (!title || !period || !targetType) {
      return res.status(400).json({ error: 'Название, период и тип обязательны' });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: req.user.id,
        title,
        period,
        targetType,
        targetValue: targetValue ? parseFloat(targetValue) : null,
        depositAmount: depositAmount ? parseFloat(depositAmount) : null,
        customNote,
        unit,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      }
    });

    res.status(201).json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания цели' });
  }
});

// PATCH /api/goals/:id — обновить (например пометить как уведомлённую)
router.patch('/:id', async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!goal) return res.status(404).json({ error: 'Цель не найдена' });

    const updated = await prisma.goal.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления цели' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!goal) return res.status(404).json({ error: 'Цель не найдена' });

    await prisma.goal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления цели' });
  }
});

module.exports = router;
