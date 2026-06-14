'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, Zap, AlertTriangle,
  CheckCircle2, RefreshCw, BookOpen, Activity, Clock, Wallet,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [equity, setEquity] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [psychCheck, setPsychCheck] = useState<any>(null);
  const [bySymbol, setBySymbol] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [unannotated, setUnannotated] = useState(0);
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const year = new Date().getFullYear();
      const [statsRes, equityRes, tradesRes, psychRes, symRes, monRes, unannotRes, calendarRes, streakRes] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/analytics/equity'),
        api.get('/api/trades?limit=8&sortBy=openTime&sortOrder=desc'),
        api.get('/api/psychology/check'),
        api.get('/api/analytics/by-symbol'),
        api.get('/api/analytics/monthly'),
        api.get('/api/trades?annotated=false&status=closed&limit=1'),
        api.get(`/api/analytics/calendar?year=${year}`),
        api.get('/api/analytics/streak'),
      ]);
      setStats(statsRes.data);
      setEquity(equityRes.data.slice(-80));
      setRecentTrades(tradesRes.data.trades);
      setPsychCheck(psychRes.data);
      setBySymbol(symRes.data.slice(0, 6));
      setMonthly(monRes.data.slice(-6));
      setUnannotated(unannotRes.data.pagination?.total || 0);
      setCalendarData(calendarRes.data);
      setStreak(streakRes.data);

      // Try to load exchange balance (non-critical)
      api.get('/api/exchanges').then(async (exRes) => {
        const active = exRes.data?.[0];
        if (active?.id) {
          api.get(`/api/exchanges/${active.id}/balance`)
            .then(r => setBalance(r.data))
            .catch(() => {});
        }
      }).catch(() => {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', flexDirection: 'column', gap: 12 }}>
      <RefreshCw size={32} className="spin" style={{ color: 'var(--green)' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Загрузка дашборда...</p>
    </div>
  );

  const pnlPositive = (stats?.totalPnl || 0) >= 0;
  const todayPnl = psychCheck?.dailyStats?.pnl || 0;

  const EquityTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{d.symbol} · {d.side}</div>
        <div style={{ fontWeight: 700, color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(2)} $
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>Баланс: <b>{d.cumulative.toFixed(2)} $</b></div>
      </div>
    );
  };

  const renderCalendar = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay();
    if (firstDayOfWeek === 0) firstDayOfWeek = 7;

    const cells = [];
    for (let i = 1; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      const dayData = calendarData.find(c => c.date === dateStr) || { pnl: 0, count: 0 };
      cells.push({ day: d, dateStr, pnl: dayData.pnl, count: dayData.count });
    }

    return { cells, monthName: format(monthDate, 'LLLL yyyy', { locale: ru }) };
  };

  const calendar = renderCalendar(calendarMonth);
  const today = new Date();
  const isCurrentMonth = calendarMonth.getMonth() === today.getMonth() && calendarMonth.getFullYear() === today.getFullYear();

  // Monthly summary for calendar month
  const monthStr = `${calendarMonth.getFullYear()}-${(calendarMonth.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthStats = (() => {
    const days = calendarData.filter(c => c.date.startsWith(monthStr));
    const pnl = days.reduce((s, d) => s + d.pnl, 0);
    const count = days.reduce((s, d) => s + d.count, 0);
    const profit = days.filter(d => d.pnl > 0).length;
    const loss = days.filter(d => d.pnl < 0).length;
    return { pnl, count, profit, loss };
  })();

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Дашборд
            {psychCheck?.shouldStop && (
              <span style={{ fontSize: 13, background: 'var(--red-dim)', color: 'var(--red)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                🛑 СТОП НА СЕГОДНЯ
              </span>
            )}
          </h2>
          <p>{format(new Date(), 'EEEE, d MMMM yyyy', { locale: ru })}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {unannotated > 0 && (
            <Link href="/trades?annotated=false" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,165,2,0.1)', border: '1px solid rgba(255,165,2,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', fontWeight: 600, cursor: 'pointer' }}>
                <BookOpen size={14} />
                {unannotated} без разбора
              </div>
            </Link>
          )}
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <RefreshCw size={14} /> Обновить
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* Psychology warnings */}
        {psychCheck?.shouldStop && (
          <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={18} color="var(--red)" style={{ marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 14, marginBottom: 6 }}>🚫 Стоп — не торгуй сегодня</div>
              {psychCheck.warnings.map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{w}</div>
              ))}
            </div>
            <Link href="/psychology" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              Психология →
            </Link>
          </div>
        )}

        {/* Motivational */}
        {psychCheck?.motivationalMessage && !psychCheck?.shouldStop && (
          <div style={{ background: 'var(--green-dim)', border: '1px solid var(--border-active)', borderRadius: 10, padding: '10px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--green)', fontStyle: 'italic' }}>💡 {psychCheck.motivationalMessage}</p>
          </div>
        )}

        {/* ═══ STAT CARDS ROW ═══ */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {/* Total PnL */}
          <div className={`stat-card ${pnlPositive ? 'green' : 'red'}`}>
            <div className="stat-icon" style={{ background: pnlPositive ? 'var(--green-dim)' : 'var(--red-dim)' }}>
              {pnlPositive ? <TrendingUp size={18} color="var(--green)" /> : <TrendingDown size={18} color="var(--red)" />}
            </div>
            <div className="stat-label">Общий P&L</div>
            <div className={`stat-value ${pnlPositive ? 'positive' : 'negative'}`} style={{ fontSize: 26 }}>
              {pnlPositive ? '+' : ''}{stats?.totalPnl?.toFixed(2)}$
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {stats?.totalTrades} закрытых сделок
            </div>
          </div>

          {/* Today */}
          <div className={`stat-card ${todayPnl >= 0 ? 'green' : 'red'}`}>
            <div className="stat-icon" style={{ background: todayPnl >= 0 ? 'var(--green-dim)' : 'var(--red-dim)' }}>
              <Activity size={18} color={todayPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
            </div>
            <div className="stat-label">Сегодня</div>
            <div className={`stat-value ${todayPnl >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: 26 }}>
              {todayPnl >= 0 ? '+' : ''}{todayPnl.toFixed(2)}$
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {psychCheck?.dailyStats?.trades || 0} сд · {psychCheck?.dailyStats?.consecutiveLosses || 0} стопов подряд
            </div>
          </div>

          {/* Win Rate */}
          <div className="stat-card blue">
            <div className="stat-icon" style={{ background: 'rgba(61,121,255,0.1)' }}>
              <Target size={18} color="var(--blue)" />
            </div>
            <div className="stat-label">Win Rate</div>
            <div className="stat-value neutral" style={{ fontSize: 26 }}>{stats?.winRate ?? 0}%</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {stats?.wins} ✅ / {stats?.losses} ❌
            </div>
          </div>

          {/* Profit Factor */}
          <div className="stat-card yellow">
            <div className="stat-icon" style={{ background: 'rgba(255,165,2,0.1)' }}>
              <Zap size={18} color="var(--yellow)" />
            </div>
            <div className="stat-label">Profit Factor</div>
            <div className="stat-value neutral" style={{ fontSize: 26 }}>{stats?.profitFactor ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              R:R = {stats?.rrRatio ?? '—'}
            </div>
          </div>

          {/* Exchange Balance */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(161,89,255,0.1)' }}>
              <Wallet size={18} color="#a159ff" />
            </div>
            <div className="stat-label">Баланс биржи</div>
            {balance ? (
              <>
                <div className="stat-value neutral" style={{ fontSize: 22 }}>{balance.totalBalance?.toFixed(2)}$</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Своб: {balance.availableBalance?.toFixed(2)}$ ·{' '}
                  <span style={{ color: balance.unrealizedPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {balance.unrealizedPnl >= 0 ? '+' : ''}{balance.unrealizedPnl?.toFixed(2)}$ нереал.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="stat-value neutral" style={{ fontSize: 16, color: 'var(--text-muted)' }}>—</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  <Link href="/settings/exchanges" style={{ color: 'var(--green)' }}>Подключи биржу</Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══ MAIN ROW: Equity + Quick Stats ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="chart-container">
            <div className="chart-header">
              <span className="chart-title">Кривая капитала</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{equity.length} сделок</span>
            </div>
            {equity.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
                <TrendingUp size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ fontSize: 14 }}>Нет данных. <Link href="/settings/exchanges" style={{ color: 'var(--green)' }}>Подключи биржу</Link></p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={equity} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip content={<EquityTooltip />} />
                  <Area type="monotone" dataKey="cumulative" stroke="#00D4AA" strokeWidth={2.5} fill="url(#eq)" dot={false} activeDot={{ r: 4, fill: '#00D4AA', stroke: 'white', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>
              Показатели
            </div>
            {[
              { label: '🏆 Лучшая', value: `+${(stats?.bestTrade || 0).toFixed(2)} $`, color: 'var(--green)' },
              { label: '💔 Худшая', value: `${(stats?.worstTrade || 0).toFixed(2)} $`, color: 'var(--red)' },
              { label: '📈 Ср. профит', value: `+${(stats?.avgWin || 0).toFixed(2)} $`, color: 'var(--green)' },
              { label: '📉 Ср. убыток', value: `-${(stats?.avgLoss || 0).toFixed(2)} $`, color: 'var(--red)' },
              { label: '💸 Комиссии', value: `-${(stats?.totalCommission || 0).toFixed(2)} $`, color: 'var(--yellow)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}
            <Link href="/psychology" style={{ marginTop: 14, textDecoration: 'none' }}>
              <div style={{ padding: '10px 14px', background: psychCheck?.shouldStop ? 'var(--red-dim)' : 'var(--green-dim)', border: `1px solid ${psychCheck?.shouldStop ? 'rgba(255,71,87,0.3)' : 'var(--border-active)'}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: psychCheck?.shouldStop ? 'var(--red)' : 'var(--green)' }}>
                  {psychCheck?.shouldStop ? '🛑 Стоп сегодня' : '✅ Можно торговать'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Психология →</span>
              </div>
            </Link>
          </div>
        </div>

        {/* ═══ SECOND ROW: Symbol + Monthly ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="chart-container">
            <div className="chart-header">
              <span className="chart-title">Топ пары</span>
              <Link href="/analytics" style={{ fontSize: 12, color: 'var(--green)', textDecoration: 'none' }}>Вся аналитика →</Link>
            </div>
            {bySymbol.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {bySymbol.map((s) => (
                  <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, minWidth: 80 }}>{s.symbol}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, Math.abs(s.pnl) / Math.max(...bySymbol.map((x: any) => Math.abs(x.pnl))) * 100)}%`, background: s.pnl >= 0 ? 'var(--green)' : 'var(--red)', transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace', minWidth: 65, textAlign: 'right' }}>
                      {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}$
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{s.winRate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="chart-container">
            <div className="chart-header"><span className="chart-title">По месяцам</span></div>
            {monthly.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthly} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                        <div style={{ fontWeight: 700 }}>{d.month}</div>
                        <div style={{ color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(2)} $</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.count} сд · WR {d.winRate}%</div>
                      </div>
                    );
                  }} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {monthly.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#00D4AA' : '#FF4757'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ═══ COMPACT CALENDAR HEATMAP ═══ */}
        <div className="card" style={{ marginBottom: 20 }}>
          {/* Calendar header with navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                📅 {calendar.monthName}
              </span>
              <button
                onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}
                disabled={isCurrentMonth}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: isCurrentMonth ? 'var(--border)' : 'var(--text-muted)', cursor: isCurrentMonth ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
            {/* Month summary pills */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: monthStats.pnl >= 0 ? 'var(--green)' : 'var(--red)', background: monthStats.pnl >= 0 ? 'var(--green-dim)' : 'var(--red-dim)', padding: '3px 10px', borderRadius: 20 }}>
                {monthStats.pnl >= 0 ? '+' : ''}{monthStats.pnl.toFixed(2)}$
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '3px 10px', borderRadius: 20 }}>
                {monthStats.count} сделок
              </span>
              {monthStats.profit > 0 && <span style={{ fontSize: 11, color: 'var(--green)' }}>✅ {monthStats.profit} дн.</span>}
              {monthStats.loss > 0 && <span style={{ fontSize: 11, color: 'var(--red)' }}>❌ {monthStats.loss} дн.</span>}
            </div>
          </div>

          {/* Weekdays */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 5 }}>
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(w => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', paddingBottom: 4 }}>{w}</div>
            ))}
          </div>

          {/* Days — compact fixed height */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
            {calendar.cells.map((cell, idx) => {
              if (!cell) return <div key={`e-${idx}`} />;

              const isToday = isCurrentMonth && cell.day === today.getDate();
              const hasTrades = cell.count > 0;
              const isProfit = cell.pnl > 0;
              const isLoss = cell.pnl < 0;

              let bg = 'var(--bg-elevated)';
              let border = '1px solid var(--border)';
              let textColor = 'var(--text-muted)';

              if (hasTrades) {
                if (isProfit) { bg = 'rgba(0,212,170,0.15)'; border = '1px solid rgba(0,212,170,0.5)'; textColor = 'var(--green)'; }
                else if (isLoss) { bg = 'rgba(255,71,87,0.15)'; border = '1px solid rgba(255,71,87,0.5)'; textColor = 'var(--red)'; }
                else { bg = 'rgba(255,165,2,0.15)'; border = '1px solid rgba(255,165,2,0.4)'; textColor = 'var(--yellow)'; }
              }
              if (isToday) border = '2px solid var(--green)';

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => hasTrades && router.push(`/trades?date=${cell.dateStr}`)}
                  title={hasTrades ? `${cell.day}: ${cell.pnl > 0 ? '+' : ''}${cell.pnl.toFixed(2)}$ (${cell.count} сд.)` : `${cell.day}: сделок нет`}
                  style={{
                    background: bg, border, borderRadius: 6,
                    height: 48, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: hasTrades ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--green)' : textColor }}>
                    {cell.day}
                  </span>
                  {hasTrades && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: textColor, fontFamily: 'monospace', lineHeight: 1 }}>
                      {cell.pnl > 0 ? '+' : ''}{Math.round(cell.pnl)}$
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ STREAK TRACKER ═══ */}
        {streak && streak.recent.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>🔥 Серия сделок</span>
                {/* Current streak badge */}
                <div style={{
                  padding: '4px 14px', borderRadius: 20, fontWeight: 800, fontSize: 14,
                  background: streak.streakType === 'win' ? 'var(--green-dim)' : 'var(--red-dim)',
                  border: `1px solid ${streak.streakType === 'win' ? 'var(--border-active)' : 'rgba(255,71,87,0.3)'}`,
                  color: streak.streakType === 'win' ? 'var(--green)' : 'var(--red)',
                }}>
                  {streak.streakType === 'win' ? '🔥' : '❄️'} {streak.currentStreak} {streak.streakType === 'win' ? 'побед подряд' : 'убытков подряд'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Последние {streak.recent.length} сделок: {streak.totalWins}✅ {streak.totalLosses}❌
              </div>
            </div>

            {/* Trade bubbles */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {[...streak.recent].reverse().map((t: any, i: number) => {
                const isWin = t.isWin;
                const size = Math.min(52, Math.max(32, 32 + Math.abs(t.pnl) / 10));
                return (
                  <div
                    key={i}
                    title={`${t.symbol} ${t.pnl > 0 ? '+' : ''}${t.pnl}$ x${t.leverage}`}
                    style={{
                      width: size, height: size,
                      borderRadius: '50%',
                      background: isWin
                        ? `radial-gradient(circle at 35% 35%, rgba(0,212,170,0.9), rgba(0,180,148,0.7))`
                        : `radial-gradient(circle at 35% 35%, rgba(255,71,87,0.9), rgba(200,40,60,0.7))`,
                      border: `2px solid ${isWin ? 'rgba(0,212,170,0.6)' : 'rgba(255,71,87,0.6)'}`,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      cursor: 'default',
                      boxShadow: isWin
                        ? `0 2px 10px rgba(0,212,170,0.3)`
                        : `0 2px 10px rgba(255,71,87,0.3)`,
                      transition: 'transform 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <span style={{ fontSize: Math.max(8, size / 4.5), fontWeight: 800, color: '#fff', lineHeight: 1.1, fontFamily: 'monospace' }}>
                      {t.pnl > 0 ? '+' : ''}{Math.abs(t.pnl) >= 100 ? Math.round(t.pnl) : t.pnl.toFixed(1)}
                    </span>
                    {size > 38 && (
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>x{t.leverage}</span>
                    )}
                  </div>
                );
              })}

              {/* Streak continuation indicator */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: `2px dashed ${streak.streakType === 'win' ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: streak.streakType === 'win' ? 'rgba(0,212,170,0.5)' : 'rgba(255,71,87,0.5)',
                fontSize: 18, flexShrink: 0,
              }}>
                ?
              </div>
            </div>

            {/* Win rate bar for last N trades */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                <span>Win rate последних {streak.recent.length} сделок</span>
                <span style={{ fontWeight: 700, color: streak.totalWins / streak.recent.length >= 0.5 ? 'var(--green)' : 'var(--red)' }}>
                  {Math.round(streak.totalWins / streak.recent.length * 100)}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${streak.totalWins / streak.recent.length * 100}%`, background: 'var(--green)', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ RECENT TRADES ═══ */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>
              Последние сделки
              {unannotated > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(255,165,2,0.15)', color: 'var(--yellow)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                  {unannotated} без разбора
                </span>
              )}
            </h3>
            <Link href="/trades" style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none', fontWeight: 500 }}>Все сделки →</Link>
          </div>

          {recentTrades.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 14 }}>Сделок нет. <Link href="/settings/exchanges" style={{ color: 'var(--green)' }}>Подключи биржу</Link> или <Link href="/trades/new" style={{ color: 'var(--green)' }}>добавь вручную</Link>.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Пара</th>
                    <th>Напр.</th>
                    <th>Плечо</th>
                    <th>Дата</th>
                    <th>P&L</th>
                    <th>Сетап</th>
                    <th>Разобр.</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr key={trade.id} onClick={() => router.push(`/trades/${trade.id}`)}>
                      <td>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{trade.symbol}</span>
                        {trade.status === 'open' && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(61,121,255,0.15)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>OPEN</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${trade.side.toLowerCase()}`}>
                          {trade.side === 'LONG' ? '↑' : '↓'} {trade.side}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          color: trade.leverage >= 50 ? 'var(--red)' : trade.leverage >= 20 ? 'var(--yellow)' : 'var(--green)',
                          fontWeight: 700, fontSize: 13, fontFamily: 'monospace'
                        }}>
                          x{trade.leverage}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDistanceToNow(new Date(trade.openTime), { locale: ru, addSuffix: true })}
                      </td>
                      <td>
                        {trade.status === 'open' ? (
                          <span style={{ color: 'var(--blue)', fontSize: 12 }}>Открыта</span>
                        ) : (
                          <span style={{ fontWeight: 700, color: (trade.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace' }}>
                            {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}$
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(trade.setupTags || []).slice(0, 2).map((t: string) => (
                            <span key={t} className="tag" style={{ fontSize: 10, padding: '2px 7px' }}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {trade.status === 'open' ? (
                          <span style={{ fontSize: 12, color: 'var(--blue)' }}>—</span>
                        ) : trade.isAnnotated ? (
                          <CheckCircle2 size={14} color="var(--green)" />
                        ) : (
                          <span style={{ color: 'var(--yellow)', fontSize: 14, fontWeight: 700 }}>!</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
