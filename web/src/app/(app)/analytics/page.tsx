'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { RefreshCw, Calendar, TrendingUp, Filter } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';

const PRESETS = [
  { label: 'Всё время', from: '', to: '' },
  { label: 'Сегодня', from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
  { label: '7 дней', from: format(subDays(new Date(), 7), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
  { label: '30 дней', from: format(subDays(new Date(), 30), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Этот месяц', from: format(startOfMonth(new Date()), 'yyyy-MM-dd'), to: format(endOfMonth(new Date()), 'yyyy-MM-dd') },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<any>(null);
  const [equity, setEquity] = useState<any[]>([]);
  const [bySymbol, setBySymbol] = useState<any[]>([]);
  const [byTag, setByTag] = useState<any[]>([]);
  const [byHour, setByHour] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  useEffect(() => { loadAll(); }, []);

  const loadAll = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const q = params.toString() ? `?${params.toString()}` : '';

      const [ov, eq, sym, tag, hour, cal, mon] = await Promise.all([
        api.get(`/api/analytics/overview${q}`),
        api.get(`/api/analytics/equity${q}`),
        api.get('/api/analytics/by-symbol'),
        api.get('/api/analytics/by-tag'),
        api.get('/api/analytics/by-hour'),
        api.get(`/api/analytics/calendar?year=${calYear}`),
        api.get('/api/analytics/monthly'),
      ]);
      setOverview(ov.data);
      setEquity(eq.data);
      setBySymbol(sym.data.slice(0, 12));
      setByTag(tag.data);
      setByHour(hour.data);
      setCalendar(cal.data);
      setMonthly(mon.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx];
    setActivePreset(idx);
    setDateFrom(p.from);
    setDateTo(p.to);
    loadAll(p.from, p.to);
  };

  const applyCustom = () => {
    setActivePreset(-1);
    loadAll(dateFrom, dateTo);
  };

  // Calendar render for a full year (GitHub-style)
  const renderYearCalendar = () => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const year = calYear;
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      let firstDow = new Date(year, m, 1).getDay();
      if (firstDow === 0) firstDow = 7;
      const cells = [];
      for (let i = 1; i < firstDow; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const data = calendar.find(c => c.date === ds) || { pnl: 0, count: 0 };
        cells.push({ day: d, dateStr: ds, pnl: data.pnl, count: data.count });
      }
      months.push({ month: m, cells });
    }
    return months;
  };

  const yearMonths = renderYearCalendar();
  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const today = new Date();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <RefreshCw size={28} className="spin" style={{ color: 'var(--green)' }} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Аналитика</h2>
          <p>Подробная статистика твоей торговли</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => loadAll()}>
          <RefreshCw size={14} /> Обновить
        </button>
      </div>

      <div className="page-content">

        {/* ═══ DATE FILTER ═══ */}
        <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(i)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${activePreset === i ? 'var(--green)' : 'var(--border)'}`,
                    background: activePreset === i ? 'var(--green-dim)' : 'var(--bg-elevated)',
                    color: activePreset === i ? 'var(--green)' : 'var(--text-secondary)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="form-input"
                style={{ width: 140, fontSize: 12, padding: '5px 10px' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="form-input"
                style={{ width: 140, fontSize: 12, padding: '5px 10px' }}
              />
              <button className="btn btn-primary btn-sm" onClick={applyCustom}>
                Применить
              </button>
            </div>
          </div>
        </div>

        {/* ═══ OVERVIEW STATS ═══ */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Всего сделок', value: overview?.totalTrades || 0, color: 'neutral', sub: `${overview?.wins || 0} прибыльных` },
            { label: 'Win Rate', value: `${overview?.winRate || 0}%`, color: 'neutral', sub: `${overview?.losses || 0} убыточных` },
            { label: 'Profit Factor', value: overview?.profitFactor ?? '—', color: 'neutral', sub: overview?.profitFactor >= 1.5 ? '✅ Хороший' : overview?.profitFactor ? '⚠️ Слабый' : '' },
            { label: 'R:R Ratio', value: overview?.rrRatio ?? '—', color: 'neutral', sub: '' },
            { label: 'Общий P&L', value: `${(overview?.totalPnl || 0) >= 0 ? '+' : ''}${(overview?.totalPnl || 0).toFixed(2)} $`, color: (overview?.totalPnl || 0) >= 0 ? 'positive' : 'negative', sub: `-${(overview?.totalCommission || 0).toFixed(2)}$ комиссий` },
            { label: 'Ср. прибыльная', value: `+${(overview?.avgWin || 0).toFixed(2)} $`, color: 'positive', sub: '' },
            { label: 'Ср. убыточная', value: `-${(overview?.avgLoss || 0).toFixed(2)} $`, color: 'negative', sub: '' },
            { label: 'Лучшая / Худшая', value: `+${(overview?.bestTrade || 0).toFixed(0)}$ / ${(overview?.worstTrade || 0).toFixed(0)}$`, color: 'neutral', sub: '' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className={`stat-value ${color}`} style={{ fontSize: 20 }}>{value}</div>
              {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* ═══ EQUITY CURVE ═══ */}
        <div className="chart-container" style={{ marginBottom: 20 }}>
          <div className="chart-header">
            <span className="chart-title">Кривая капитала</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{equity.length} сделок</span>
          </div>
          {equity.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Нет данных за выбранный период
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={equity}>
                <defs>
                  <linearGradient id="eq2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" hide />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{d.symbol} · {d.side}</div>
                      <div style={{ color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(2)} $</div>
                      <div style={{ color: 'var(--text-secondary)' }}>Баланс: <b>{d.cumulative.toFixed(2)} $</b></div>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="cumulative" stroke="#00D4AA" strokeWidth={2.5} fill="url(#eq2)" dot={false} activeDot={{ r: 4, fill: '#00D4AA', stroke: 'white', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ═══ BY SYMBOL + BY TAG ═══ */}
        <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
          <div className="chart-container">
            <div className="chart-header"><span className="chart-title">P&L по парам</span></div>
            {bySymbol.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>Нет данных</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, bySymbol.length * 36)}>
                <BarChart data={bySymbol} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} width={90} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{d.symbol}</div>
                        <div style={{ color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(2)} $</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>WR: {d.winRate}% · {d.count} сделок</div>
                      </div>
                    );
                  }} />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {bySymbol.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#00D4AA' : '#FF4757'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="chart-container">
            <div className="chart-header">
              <span className="chart-title">P&L по сетапам</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Теги сделок</span>
            </div>
            {byTag.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>
                Добавь теги к своим сделкам
              </div>
            ) : (
              <div>
                {byTag.map(t => (
                  <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="tag" style={{ fontSize: 11, minWidth: 80 }}>#{t.tag}</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, Math.abs(t.pnl) / Math.max(...byTag.map((x: any) => Math.abs(x.pnl))) * 100)}%`, background: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace', minWidth: 65, textAlign: 'right' }}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}$
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{t.winRate}%</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>{t.count}шт</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ BY HOUR ═══ */}
        <div className="chart-container" style={{ marginBottom: 20 }}>
          <div className="chart-header">
            <span className="chart-title">P&L по часам торговли</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>В какое время ты торгуешь лучше?</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byHour} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}:00`} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                if (d.count === 0) return null;
                return (
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700 }}>{d.hour}:00 – {d.hour + 1}:00</div>
                    <div style={{ color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(2)} $</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.count} сд · WR {d.winRate}%</div>
                  </div>
                );
              }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {byHour.map((e, i) => <Cell key={i} fill={e.count === 0 ? 'rgba(255,255,255,0.05)' : e.pnl >= 0 ? '#00D4AA' : '#FF4757'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ═══ MONTHLY ═══ */}
        {monthly.length > 0 && (
          <div className="chart-container" style={{ marginBottom: 20 }}>
            <div className="chart-header"><span className="chart-title">Помесячный P&L</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontWeight: 700 }}>{d.month}</div>
                      <div style={{ color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(2)} $</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.count} сд · WR {d.winRate}%</div>
                    </div>
                  );
                }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {monthly.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#00D4AA' : '#FF4757'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ═══ YEARLY CALENDAR HEATMAP ═══ */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} style={{ color: 'var(--green)' }} />
              Календарь P&L — {calYear}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🟢 Профит  🔴 Убыток</span>
              <button onClick={() => { setCalYear(y => y - 1); }} className="btn btn-secondary btn-sm" style={{ padding: '3px 10px' }}>← {calYear - 1}</button>
              {calYear < today.getFullYear() && (
                <button onClick={() => { setCalYear(y => y + 1); }} className="btn btn-secondary btn-sm" style={{ padding: '3px 10px' }}>{calYear + 1} →</button>
              )}
            </div>
          </div>

          {/* Year grid — 3 columns of months */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {yearMonths.map(({ month, cells }) => {
              const monthPnl = cells.filter(Boolean).reduce((s, c) => s + (c as any).pnl, 0);
              const hasTrades = cells.filter(Boolean).some(c => (c as any).count > 0);
              return (
                <div key={month} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{monthNames[month]}</span>
                    {hasTrades && (
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: monthPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {monthPnl >= 0 ? '+' : ''}{monthPnl.toFixed(0)}$
                      </span>
                    )}
                  </div>
                  {/* Days header mini */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
                    {['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((d, i) => (
                      <div key={i} style={{ textAlign: 'center', fontSize: 8, color: 'var(--border)', fontWeight: 600 }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                    {cells.map((cell, idx) => {
                      if (!cell) return <div key={`e-${idx}`} />;
                      const c = cell as any;
                      const isToday = calYear === today.getFullYear() && month === today.getMonth() && c.day === today.getDate();
                      let bg = 'rgba(255,255,255,0.05)';
                      if (c.count > 0) {
                        bg = c.pnl > 0 ? 'rgba(0,212,170,0.5)' : c.pnl < 0 ? 'rgba(255,71,87,0.5)' : 'rgba(255,165,2,0.5)';
                      }
                      if (isToday) bg = 'var(--green)';
                      return (
                        <div
                          key={c.dateStr}
                          onClick={() => c.count > 0 && router.push(`/trades?date=${c.dateStr}`)}
                          title={c.count > 0 ? `${c.day}: ${c.pnl > 0 ? '+' : ''}${c.pnl.toFixed(2)}$ (${c.count} сд.)` : `${c.day}`}
                          style={{
                            background: bg, borderRadius: 3,
                            height: 18,
                            cursor: c.count > 0 ? 'pointer' : 'default',
                            transition: 'opacity 0.15s',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
