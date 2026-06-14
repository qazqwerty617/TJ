'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Filter, Plus, RefreshCw, TrendingUp, TrendingDown, X, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const SETUP_TAGS = ['breakout', 'retest', 'rejection', 'knife', 'density', 'scalp', 'fomo', 'revenge', 'level', 'trend'];

export default function TradesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trades, setTrades] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filters, setFilters] = useState({ symbol: '', side: '', status: '', tag: '', annotated: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const d = searchParams.get('date');
    setSelectedDate(d || null);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const fetchTrades = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20', sortBy: 'openTime', sortOrder: 'desc' });
        if (filters.symbol) params.append('symbol', filters.symbol);
        if (filters.side) params.append('side', filters.side);
        if (filters.status) params.append('status', filters.status);
        if (filters.tag) params.append('tag', filters.tag);
        if (filters.annotated) params.append('annotated', filters.annotated);
        if (selectedDate) {
          params.append('date', selectedDate);
        }
        const res = await api.get(`/api/trades?${params}`);
        if (active) {
          setTrades(res.data.trades);
          setPagination(res.data.pagination);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTrades();
    return () => { active = false; };
  }, [page, filters, selectedDate, refreshTrigger]);

  const loadTrades = () => setRefreshTrigger(p => p + 1);
  const pnlColor = (pnl: number) => (pnl >= 0 ? 'var(--green)' : 'var(--red)');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Сделки</h2>
          <p>Всего {pagination.total} сделок</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={13} /> Фильтры
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadTrades}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          <a href="/trades/new" className="btn btn-primary btn-sm">
            <Plus size={13} /> Добавить
          </a>
        </div>
      </div>

      <div className="page-content">
        {/* Date filter badge */}
        {selectedDate && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--green-dim)', border: '1px solid var(--border-active)', borderRadius: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
              📅 {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: ru })}
            </span>
            <button onClick={() => { setSelectedDate(null); router.push('/trades'); }}
              style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Filters panel */}
        {showFilters && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Пара</label>
                <input className="form-input" placeholder="BTCUSDT" value={filters.symbol}
                  onChange={e => setFilters({ ...filters, symbol: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Направление</label>
                <select className="form-select" value={filters.side}
                  onChange={e => setFilters({ ...filters, side: e.target.value })}>
                  <option value="">Все</option>
                  <option value="LONG">Long</option>
                  <option value="SHORT">Short</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Статус</label>
                <select className="form-select" value={filters.status}
                  onChange={e => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">Все</option>
                  <option value="closed">Закрытые</option>
                  <option value="open">Открытые</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Сетап</label>
                <select className="form-select" value={filters.tag}
                  onChange={e => setFilters({ ...filters, tag: e.target.value })}>
                  <option value="">Все</option>
                  {SETUP_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Заметки</label>
                <select className="form-select" value={filters.annotated}
                  onChange={e => setFilters({ ...filters, annotated: e.target.value })}>
                  <option value="">Все</option>
                  <option value="true">Разобраны</option>
                  <option value="false">Без заметок</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setPage(1); loadTrades(); }}>Применить</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ symbol: '', side: '', status: '', tag: '', annotated: '' })}>Сбросить</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p>Загрузка сделок...</p>
          </div>
        ) : (
          <>
            {/* ─── DESKTOP TABLE ─── */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Пара</th>
                    <th>Направление</th>
                    <th>Дата</th>
                    <th>Вход</th>
                    <th>Выход</th>
                    <th>Плечо</th>
                    <th>P&L</th>
                    <th>P&L %</th>
                    <th>Сетапы</th>
                    <th>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        Сделок не найдено.{' '}
                        <a href="/settings/exchanges" style={{ color: 'var(--green)' }}>Подключи биржу</a>.
                      </td>
                    </tr>
                  ) : (
                    trades.map((trade) => (
                      <tr key={trade.id} onClick={() => router.push(`/trades/${trade.id}`)}>
                        <td>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{trade.symbol}</span>
                          {trade.status === 'open' && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(61,121,255,0.15)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>LIVE</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${trade.side.toLowerCase()}`}>
                            {trade.side === 'LONG' ? '↑' : '↓'} {trade.side}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {format(new Date(trade.openTime), 'dd.MM HH:mm')}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{trade.entryPrice?.toFixed(4)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {trade.exitPrice?.toFixed(4) ?? <span style={{ color: 'var(--blue)' }}>—</span>}
                        </td>
                        <td style={{ color: 'var(--yellow)', fontWeight: 600 }}>x{trade.leverage}</td>
                        <td style={{ fontWeight: 700, color: pnlColor(trade.pnl || 0), fontFamily: 'monospace' }}>
                          {trade.status === 'open' ? <span style={{ color: 'var(--blue)', fontSize: 12 }}>Открыта</span>
                            : <>{(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}$</>}
                        </td>
                        <td style={{ color: pnlColor(trade.pnlPercent || 0), fontFamily: 'monospace', fontSize: 12 }}>
                          {trade.pnlPercent ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(trade.setupTags || []).slice(0, 2).map((t: string) => (
                              <span key={t} className="tag" style={{ fontSize: 10, padding: '1px 6px' }}>{t}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          {trade.isAnnotated
                            ? <span style={{ color: 'var(--green)', fontSize: 16 }}>✓</span>
                            : <span style={{ color: 'var(--yellow)', fontSize: 16 }}>!</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ─── MOBILE CARD LIST ─── */}
            <div className="trade-card-list">
              {trades.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <TrendingUp size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                  <p style={{ fontSize: 14 }}>Сделок не найдено</p>
                  <a href="/settings/exchanges" style={{ color: 'var(--green)', fontSize: 13, display: 'block', marginTop: 8 }}>Подключить биржу →</a>
                </div>
              ) : (
                trades.map((trade) => (
                  <div key={trade.id} className="trade-card" onClick={() => router.push(`/trades/${trade.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 15 }}>{trade.symbol}</span>
                        <span className={`badge badge-${trade.side.toLowerCase()}`}>
                          {trade.side === 'LONG' ? '↑' : '↓'} {trade.side}
                        </span>
                        {trade.status === 'open' && (
                          <span style={{ fontSize: 10, background: 'rgba(61,121,255,0.15)', color: 'var(--blue)', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>LIVE</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 16, color: trade.status === 'open' ? 'var(--blue)' : pnlColor(trade.pnl || 0) }}>
                          {trade.status === 'open' ? 'Открыта'
                            : `${(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}$`}
                        </span>
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>{format(new Date(trade.openTime), 'dd.MM HH:mm')}</span>
                      <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>x{trade.leverage}</span>
                      <span>{trade.entryPrice?.toFixed(2)}</span>
                      {trade.pnlPercent && (
                        <span style={{ color: pnlColor(trade.pnlPercent), fontWeight: 600 }}>
                          {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </span>
                      )}
                      {!trade.isAnnotated && trade.status !== 'open' && (
                        <span style={{ color: 'var(--yellow)', fontWeight: 700, marginLeft: 'auto' }}>! Разбери</span>
                      )}
                    </div>
                    {(trade.setupTags || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {(trade.setupTags || []).slice(0, 3).map((t: string) => (
                          <span key={t} className="tag" style={{ fontSize: 10, padding: '1px 6px' }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Назад</button>
                <span style={{ padding: '7px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
                  {page} / {pagination.pages}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>Вперёд →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
