const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/journal — list journals
router.get('/', async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    
    const journals = await prisma.dailyJournal.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    res.json(journals);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения журнала' });
  }
});

// GET /api/journal/today — today's journal
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let journal = await prisma.dailyJournal.findUnique({
      where: { userId_date: { userId: req.user.id, date: today } }
    });

    if (!journal) {
      // Auto-create for today
      journal = await prisma.dailyJournal.create({
        data: { userId: req.user.id, date: today }
      });
    }

    // Enrich with today's trade stats
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const trades = await prisma.trade.findMany({
      where: {
        userId: req.user.id,
        openTime: { gte: today, lt: tomorrow },
        status: 'closed'
      },
      select: { pnl: true }
    });

    const dailyPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = trades.filter(t => (t.pnl || 0) > 0).length;

    res.json({
      ...journal,
      dailyPnl: Math.round(dailyPnl * 100) / 100,
      tradesCount: trades.length,
      winCount: wins
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения журнала дня' });
  }
});

// PUT /api/journal/today — update today's journal
router.put('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const {
      moodScore, sleptWell, pressureToEarn,
      morningNotes, eveningNotes, lessonsLearned
    } = req.body;

    // Calculate if should trade based on check-in
    let shouldTrade = true;
    if (moodScore !== undefined && moodScore < 4) shouldTrade = false;
    if (sleptWell === false) shouldTrade = false;
    if (pressureToEarn === true) shouldTrade = false;

    const data = {};
    if (moodScore !== undefined) data.moodScore = moodScore;
    if (sleptWell !== undefined) data.sleptWell = sleptWell;
    if (pressureToEarn !== undefined) data.pressureToEarn = pressureToEarn;
    if (shouldTrade !== undefined) data.shouldTrade = shouldTrade;
    if (morningNotes !== undefined) data.morningNotes = morningNotes;
    if (eveningNotes !== undefined) data.eveningNotes = eveningNotes;
    if (lessonsLearned !== undefined) data.lessonsLearned = lessonsLearned;

    const journal = await prisma.dailyJournal.upsert({
      where: { userId_date: { userId: req.user.id, date: today } },
      update: data,
      create: { userId: req.user.id, date: today, ...data }
    });

    // If shouldn't trade, log psychology event
    if (!shouldTrade && (moodScore !== undefined || sleptWell !== undefined || pressureToEarn !== undefined)) {
      await prisma.psychologyLog.create({
        data: {
          userId: req.user.id,
          eventType: 'checkin',
          message: `Система рекомендует не торговать сегодня. Настроение: ${moodScore}/10`,
          data: { moodScore, sleptWell, pressureToEarn }
        }
      });
    }

    res.json({ ...journal, shouldTrade });
  } catch (err) {
    console.error('Journal update error:', err);
    res.status(500).json({ error: 'Ошибка обновления журнала' });
  }
});

// GET /api/journal/:date — specific date journal
router.get('/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    date.setHours(0, 0, 0, 0);

    const journal = await prisma.dailyJournal.findUnique({
      where: { userId_date: { userId: req.user.id, date } }
    });

    if (!journal) return res.status(404).json({ error: 'Запись не найдена' });

    res.json(journal);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения записи' });
  }
});

module.exports = router;
