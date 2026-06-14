const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/analytics/overview — overall stats
router.get('/overview', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = { userId: req.user.id, status: 'closed' };
    if (from || to) {
      where.closeTime = {};
      if (from) where.closeTime.gte = new Date(from);
      if (to) where.closeTime.lte = new Date(to);
    }

    const trades = await prisma.trade.findMany({
      where,
      select: { pnl: true, commission: true, openTime: true, closeTime: true, side: true, symbol: true, leverage: true, quantity: true, entryPrice: true, exitPrice: true }
    });

    const netPnl = (t) => (t.pnl || 0) - (t.commission || 0);
    const totalPnl = trades.reduce((sum, t) => sum + netPnl(t), 0);
    const totalCommission = trades.reduce((sum, t) => sum + (t.commission || 0), 0);
    const wins = trades.filter(t => netPnl(t) > 0);
    const losses = trades.filter(t => netPnl(t) < 0);
    
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length) : 0;

    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : null;

    res.json({
      totalTrades: trades.length,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length > 0 ? Math.round((wins.length / trades.length) * 100) : 0,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: profitFactor ? Math.round(profitFactor * 100) / 100 : null,
      rrRatio: avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : null,
      bestTrade: wins.length > 0 ? Math.max(...wins.map(t => netPnl(t))) : 0,
      worstTrade: losses.length > 0 ? Math.min(...losses.map(t => netPnl(t))) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка аналитики' });
  }
});

// GET /api/analytics/equity — equity curve data
router.get('/equity', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = { userId: req.user.id, status: 'closed' };
    if (from) where.closeTime = { gte: new Date(from) };
    if (to) where.closeTime = { ...where.closeTime, lte: new Date(to) };

    const trades = await prisma.trade.findMany({
      where,
      orderBy: { closeTime: 'asc' },
      select: { pnl: true, commission: true, closeTime: true, symbol: true, side: true }
    });

    let cumulative = 0;
    const equity = trades.map(t => {
      const net = (t.pnl || 0) - (t.commission || 0);
      cumulative += net;
      return {
        time: t.closeTime,
        pnl: Math.round(net * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
        symbol: t.symbol,
        side: t.side,
      };
    });

    res.json(equity);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка equity curve' });
  }
});

// GET /api/analytics/by-symbol — PnL by symbol
router.get('/by-symbol', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      select: { symbol: true, pnl: true, commission: true }
    });

    const bySymbol = {};
    for (const t of trades) {
      const net = (t.pnl || 0) - (t.commission || 0);
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { symbol: t.symbol, pnl: 0, count: 0, wins: 0 };
      bySymbol[t.symbol].pnl += net;
      bySymbol[t.symbol].count++;
      if (net > 0) bySymbol[t.symbol].wins++;
    }

    const result = Object.values(bySymbol)
      .map(s => ({
        ...s,
        pnl: Math.round(s.pnl * 100) / 100,
        winRate: Math.round((s.wins / s.count) * 100)
      }))
      .sort((a, b) => b.pnl - a.pnl);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка аналитики по символам' });
  }
});

// GET /api/analytics/by-tag — PnL by setup tag
router.get('/by-tag', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      select: { setupTags: true, pnl: true, commission: true }
    });

    const byTag = {};
    for (const t of trades) {
      const net = (t.pnl || 0) - (t.commission || 0);
      for (const tag of (t.setupTags || [])) {
        if (!byTag[tag]) byTag[tag] = { tag, pnl: 0, count: 0, wins: 0 };
        byTag[tag].pnl += net;
        byTag[tag].count++;
        if (net > 0) byTag[tag].wins++;
      }
    }

    const result = Object.values(byTag)
      .map(t => ({
        ...t,
        pnl: Math.round(t.pnl * 100) / 100,
        winRate: Math.round((t.wins / t.count) * 100)
      }))
      .sort((a, b) => b.pnl - a.pnl);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка аналитики по сетапам' });
  }
});

// GET /api/analytics/by-hour — PnL by hour of day
router.get('/by-hour', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      select: { openTime: true, pnl: true, commission: true }
    });

    const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, pnl: 0, count: 0, wins: 0 }));

    for (const t of trades) {
      const net = (t.pnl || 0) - (t.commission || 0);
      const hour = new Date(t.openTime).getHours();
      byHour[hour].pnl += net;
      byHour[hour].count++;
      if (net > 0) byHour[hour].wins++;
    }

    res.json(byHour.map(h => ({
      ...h,
      pnl: Math.round(h.pnl * 100) / 100,
      winRate: h.count > 0 ? Math.round((h.wins / h.count) * 100) : 0
    })));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка аналитики по часам' });
  }
});

// GET /api/analytics/calendar — heatmap data
router.get('/calendar', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const trades = await prisma.trade.findMany({
      where: {
        userId: req.user.id,
        status: 'closed',
        closeTime: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        }
      },
      select: { closeTime: true, pnl: true, commission: true }
    });

    const byDay = {};
    for (const t of trades) {
      const net = (t.pnl || 0) - (t.commission || 0);
      const day = t.closeTime.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { date: day, pnl: 0, count: 0 };
      byDay[day].pnl += net;
      byDay[day].count++;
    }

    res.json(Object.values(byDay).map(d => ({
      ...d,
      pnl: Math.round(d.pnl * 100) / 100
    })));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка calendar heatmap' });
  }
});

// GET /api/analytics/monthly — monthly P&L comparison
router.get('/monthly', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      select: { closeTime: true, pnl: true, commission: true },
      orderBy: { closeTime: 'asc' }
    });

    const byMonth = {};
    for (const t of trades) {
      const net = (t.pnl || 0) - (t.commission || 0);
      const month = t.closeTime.toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { month, pnl: 0, count: 0, wins: 0 };
      byMonth[month].pnl += net;
      byMonth[month].count++;
      if (net > 0) byMonth[month].wins++;
    }

    res.json(Object.values(byMonth).map(m => ({
      ...m,
      pnl: Math.round(m.pnl * 100) / 100,
      winRate: m.count > 0 ? Math.round((m.wins / m.count) * 100) : 0
    })));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка месячной аналитики' });
  }
});

// GET /api/analytics/streak — last 20 trades for streak visualization
router.get('/streak', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      orderBy: { closeTime: 'desc' },
      take: 30,
      select: { pnl: true, commission: true, symbol: true, closeTime: true, leverage: true }
    });

    const netPnl = (t) => (t.pnl || 0) - (t.commission || 0);

    let currentStreak = 0;
    let streakType = null;
    const results = [];

    for (const t of trades) {
      const net = netPnl(t);
      const isWin = net > 0;
      results.push({
        symbol: t.symbol,
        pnl: Math.round(net * 100) / 100,
        isWin,
        closeTime: t.closeTime,
        leverage: t.leverage,
      });

      if (streakType === null) {
        streakType = isWin ? 'win' : 'loss';
        currentStreak = 1;
      } else if ((streakType === 'win') === isWin) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({
      recent: results,
      currentStreak,
      streakType,
      totalWins: results.filter(r => r.isWin).length,
      totalLosses: results.filter(r => !r.isWin).length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка streak' });
  }
});

// GET /api/analytics/drawdown — max drawdown + Sharpe ratio
router.get('/drawdown', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      orderBy: { closeTime: 'asc' },
      select: { pnl: true, commission: true, closeTime: true }
    });

    const netPnls = trades.map(t => (t.pnl || 0) - (t.commission || 0));

    // Max Drawdown
    let peak = 0, cumulative = 0, maxDrawdown = 0, maxDrawdownPct = 0;
    let drawdownStart = null, drawdownEnd = null, peakTime = null;
    for (let i = 0; i < netPnls.length; i++) {
      cumulative += netPnls[i];
      if (cumulative > peak) {
        peak = cumulative;
        peakTime = trades[i].closeTime;
      }
      const dd = peak - cumulative;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
        drawdownEnd = trades[i].closeTime;
        drawdownStart = peakTime;
      }
    }

    // Sharpe Ratio (simplified, risk-free rate = 0)
    const n = netPnls.length;
    const mean = n > 0 ? netPnls.reduce((s, p) => s + p, 0) / n : 0;
    const variance = n > 1 ? netPnls.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / (n - 1) : 0;
    const stdDev = Math.sqrt(variance);
    const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : null; // annualized

    // Recovery factor
    const totalPnl = netPnls.reduce((s, p) => s + p, 0);
    const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : null;

    res.json({
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
      sharpeRatio: sharpe ? Math.round(sharpe * 100) / 100 : null,
      recoveryFactor: recoveryFactor ? Math.round(recoveryFactor * 100) / 100 : null,
      drawdownStart,
      drawdownEnd,
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка drawdown' });
  }
});

// GET /api/analytics/by-weekday — PnL by day of week
router.get('/by-weekday', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      select: { openTime: true, pnl: true, commission: true }
    });

    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const byDay = Array.from({ length: 7 }, (_, i) => ({ day: days[i], dayNum: i, pnl: 0, count: 0, wins: 0 }));

    for (const t of trades) {
      const net = (t.pnl || 0) - (t.commission || 0);
      const dow = new Date(t.openTime).getDay();
      byDay[dow].pnl += net;
      byDay[dow].count++;
      if (net > 0) byDay[dow].wins++;
    }

    // Reorder: Mon-Fri-Sat-Sun (Mon first)
    const ordered = [byDay[1], byDay[2], byDay[3], byDay[4], byDay[5], byDay[6], byDay[0]];

    res.json(ordered.map(d => ({
      ...d,
      pnl: Math.round(d.pnl * 100) / 100,
      winRate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0
    })));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка аналитики по дням' });
  }
});

// GET /api/analytics/by-leverage — PnL grouped by leverage ranges
router.get('/by-leverage', async (req, res) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { userId: req.user.id, status: 'closed' },
      select: { leverage: true, pnl: true, commission: true }
    });

    const buckets = {
      'x1-x5': { label: 'x1–x5', pnl: 0, count: 0, wins: 0 },
      'x6-x10': { label: 'x6–x10', pnl: 0, count: 0, wins: 0 },
      'x11-x20': { label: 'x11–x20', pnl: 0, count: 0, wins: 0 },
      'x21-x50': { label: 'x21–x50', pnl: 0, count: 0, wins: 0 },
      'x50+': { label: 'x50+', pnl: 0, count: 0, wins: 0 },
    };

    for (const t of trades) {
      const net = (t.pnl || 0) - (t.commission || 0);
      const lev = t.leverage || 1;
      let key;
      if (lev <= 5) key = 'x1-x5';
      else if (lev <= 10) key = 'x6-x10';
      else if (lev <= 20) key = 'x11-x20';
      else if (lev <= 50) key = 'x21-x50';
      else key = 'x50+';
      buckets[key].pnl += net;
      buckets[key].count++;
      if (net > 0) buckets[key].wins++;
    }

    res.json(Object.values(buckets).map(b => ({
      ...b,
      pnl: Math.round(b.pnl * 100) / 100,
      winRate: b.count > 0 ? Math.round((b.wins / b.count) * 100) : 0
    })));
  } catch (err) {
    res.status(500).json({ error: 'Ошибка аналитики по плечу' });
  }
});

module.exports = router;
