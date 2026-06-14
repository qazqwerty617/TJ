'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Lazy load LiveChart (uses browser-only APIs)
const LiveChart = dynamic(() => import('@/components/LiveChart'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Activity size={28} className="spin" style={{ margin: '0 auto 10px' }} />
        <div style={{ fontSize: 13 }}>Подключение к Binance...</div>
      </div>
    </div>
  ),
});

// Lazy load TradeChart (browser-only)
const TradeChart = dynamic(() => import('@/components/TradeChart'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0D18', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        <Activity size={28} className="spin" style={{ margin: '0 auto 10px', color: '#00D4AA' }} />
        <div style={{ fontSize: 13 }}>Загрузка графика...</div>
      </div>
    </div>
  ),
});

const SETUP_TAGS = ['breakout', 'retest', 'rejection', 'knife', 'density', 'scalp', 'fomo', 'revenge', 'level', 'trend', 'news', 'squeeze'];
const EMOTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function TradePage() {
  const { id } = useParams();
  const router = useRouter();
  const [trade, setTrade] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    setupTags: [] as string[],
    whyEntered: '',
    whatWentWrong: '',
    whatWentRight: '',
    notes: '',
    emotionBefore: 0,
    emotionAfter: 0,
    stopLoss: '',
    takeProfit: '',
    // manual entry fields
    symbol: '',
    side: 'LONG',
    entryPrice: '',
    exitPrice: '',
    quantity: '',
    leverage: '1',
    pnl: '',
    commission: '',
    openTime: '',
    closeTime: '',
  });

  const [checklist, setChecklist] = useState({
    stopLossSet: false,
    riskCalculated: false,
    ruleChecked: false,
    emotionCalm: false,
  });

  useEffect(() => {
    // Set default openTime in client side to avoid hydration mismatches
    setForm(f => ({
      ...f,
      openTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    }));
  }, []);

  useEffect(() => {
    if (id) {
      if (id === 'new') {
        setTrade({
          id: 'new',
          status: 'closed',
          side: 'LONG',
          symbol: '',
          entryPrice: 0,
          quantity: 0,
          openTime: new Date().toISOString(),
          isManual: true,
        });
        setLoading(false);
      } else {
        loadTrade();
      }
    }
  }, [id]);

  const loadTrade = async () => {
    try {
      const res = await api.get(`/api/trades/${id}`);
      setTrade(res.data);
      setForm({
        setupTags: res.data.setupTags || [],
        whyEntered: res.data.whyEntered || '',
        whatWentWrong: res.data.whatWentWrong || '',
        whatWentRight: res.data.whatWentRight || '',
        notes: res.data.notes || '',
        emotionBefore: res.data.emotionBefore || 0,
        emotionAfter: res.data.emotionAfter || 0,
        stopLoss: res.data.stopLoss?.toString() || '',
        takeProfit: res.data.takeProfit?.toString() || '',
        // populate manual fields if it is editable
        symbol: res.data.symbol || '',
        side: res.data.side || 'LONG',
        entryPrice: res.data.entryPrice?.toString() || '',
        exitPrice: res.data.exitPrice?.toString() || '',
        quantity: res.data.quantity?.toString() || '',
        leverage: res.data.leverage?.toString() || '1',
        pnl: res.data.pnl?.toString() || '',
        commission: res.data.commission?.toString() || '',
        openTime: res.data.openTime ? format(new Date(res.data.openTime), "yyyy-MM-dd'T'HH:mm") : '',
        closeTime: res.data.closeTime ? format(new Date(res.data.closeTime), "yyyy-MM-dd'T'HH:mm") : '',
      });
    } catch (err) {
      toast.error('Сделка не найдена');
      router.push('/trades');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      setupTags: f.setupTags.includes(tag)
        ? f.setupTags.filter(t => t !== tag)
        : [...f.setupTags, tag]
    }));
  };

  const handleSave = async () => {
    const isNew = id === 'new';

    // Validation
    if (isNew) {
      if (!form.symbol.trim()) {
        toast.error('Укажи валютную пару (например, BTCUSDT)!');
        return;
      }
      if (!form.entryPrice || parseFloat(form.entryPrice) <= 0) {
        toast.error('Укажи цену входа!');
        return;
      }
      if (!form.quantity || parseFloat(form.quantity) <= 0) {
        toast.error('Укажи количество!');
        return;
      }
      if (!form.openTime) {
        toast.error('Укажи время входа!');
        return;
      }
    }

    const isOpenStatus = isNew ? !form.closeTime : trade.status === 'open';
    if (!isOpenStatus && !form.whyEntered.trim()) {
      toast.error('Укажи ПОЧЕМУ ты вошёл в сделку!');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const payload = {
          symbol: form.symbol.toUpperCase(),
          side: form.side,
          entryPrice: parseFloat(form.entryPrice),
          exitPrice: form.exitPrice ? parseFloat(form.exitPrice) : null,
          quantity: parseFloat(form.quantity),
          leverage: parseInt(form.leverage) || 1,
          stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : null,
          takeProfit: form.takeProfit ? parseFloat(form.takeProfit) : null,
          pnl: form.pnl ? parseFloat(form.pnl) : null,
          commission: form.commission ? parseFloat(form.commission) : null,
          openTime: new Date(form.openTime).toISOString(),
          closeTime: form.closeTime ? new Date(form.closeTime).toISOString() : null,
          setupTags: form.setupTags,
          whyEntered: form.whyEntered,
          whatWentWrong: form.whatWentWrong,
          whatWentRight: form.whatWentRight,
          notes: form.notes,
          emotionBefore: form.emotionBefore || null,
          emotionAfter: form.emotionAfter || null,
        };

        const res = await api.post('/api/trades', payload);
        toast.success('✅ Сделка создана!');
        router.push(`/trades/${res.data.id}`);
      } else {
        await api.patch(`/api/trades/${id}`, {
          ...form,
          stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : null,
          takeProfit: form.takeProfit ? parseFloat(form.takeProfit) : null,
        });
        toast.success('✅ Сделка сохранена!');
        loadTrade();
      }
    } catch (err) {
      console.error(err);
      toast.error('Ошибка сохранения сделки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <Activity size={28} className="spin" style={{ color: 'var(--green)' }} />
    </div>
  );

  if (!trade) return null;

  const isNew = id === 'new';
  const isOpen = isNew ? !form.closeTime : trade.status === 'open';
  const pnlPositive = isNew ? (parseFloat(form.pnl) || 0) >= 0 : (trade.pnl || 0) >= 0;

  const margin = trade.entryPrice && trade.quantity && trade.leverage ? (trade.entryPrice * trade.quantity) / trade.leverage : 0;
  const calcPnlPct = trade.pnl != null && margin > 0 ? (trade.pnl / margin) * 100 : null;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isNew ? (form.symbol || 'Новая сделка') : trade.symbol}
              <span className={`badge badge-${isNew ? form.side.toLowerCase() : trade.side.toLowerCase()}`}>
                {isNew ? form.side : trade.side}
              </span>
              {isOpen && (
                <span style={{
                  fontSize: 12, background: 'rgba(61,121,255,0.15)', color: 'var(--blue)',
                  padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  {isNew ? 'PLAN' : 'LIVE'}
                </span>
              )}
              {trade.isAnnotated && !isOpen && (
                <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Разобрана</span>
              )}
            </h2>
            <p>
              {isNew ? 'Ручной ввод параметров сделки' : (
                <>
                  {format(new Date(trade.openTime), 'd MMMM yyyy HH:mm', { locale: ru })}
                  {trade.closeTime && ` → ${format(new Date(trade.closeTime), 'HH:mm')}`}
                  {' '} · x{trade.leverage} плечо
                </>
              )}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Сохраняю...' : isNew ? 'Создать сделку' : 'Сохранить'}
        </button>
      </div>

      <div className="page-content">

        {/* ═══ LIVE CHART (only for existing open trades) ═══ */}
        {isOpen && !isNew && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 8px #00D4AA', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Real-Time Chart — {trade.symbol}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Binance Futures · Цена обновляется каждую секунду</span>
            </div>
            <LiveChart
              symbol={trade.symbol}
              entryPrice={trade.entryPrice}
              stopLoss={parseFloat(form.stopLoss) || trade.stopLoss || null}
              takeProfit={parseFloat(form.takeProfit) || trade.takeProfit || null}
              side={trade.side}
              quantity={trade.quantity}
              leverage={trade.leverage}
            />
          </div>
        )}

        {/* ═══ CLOSED TRADE STATS (only for existing closed trades) ═══ */}
        {!isOpen && !isNew && (
          <div className="trade-details-stats-grid">
            {[
              { label: 'P&L', value: `${pnlPositive ? '+' : ''}${(trade.pnl || 0).toFixed(2)} $`, color: pnlPositive ? 'var(--green)' : 'var(--red)' },
              { label: 'Вход', value: trade.entryPrice?.toFixed(4), color: 'var(--text-primary)' },
              { label: 'Выход', value: trade.exitPrice?.toFixed(4) ?? '—', color: 'var(--text-primary)' },
              { label: 'Объём', value: `${trade.quantity} шт`, color: 'var(--text-secondary)' },
              { label: 'Комиссия', value: `-${(trade.commission || 0).toFixed(3)} $`, color: 'var(--red)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="stat-card" style={{ padding: '14px 16px' }}>
                <div className="stat-label">{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 6, fontFamily: 'monospace' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid-2" style={{ gap: 20 }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Manual Entry Parameters (only when creating a new trade) */}
            {isNew && (
              <div className="card">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                  Параметры сделки
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Тикер (Инструмент)</label>
                      <input className="form-input" placeholder="BTCUSDT" value={form.symbol}
                        onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Направление</label>
                      <select className="form-select" value={form.side}
                        onChange={e => setForm({ ...form, side: e.target.value })}>
                        <option value="LONG">LONG</option>
                        <option value="SHORT">SHORT</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Цена входа</label>
                      <input className="form-input" type="number" step="any" placeholder="64000.5" value={form.entryPrice}
                        onChange={e => setForm({ ...form, entryPrice: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Цена выхода</label>
                      <input className="form-input" type="number" step="any" placeholder="65200.0" value={form.exitPrice}
                        onChange={e => setForm({ ...form, exitPrice: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Объём (Количество монет)</label>
                      <input className="form-input" type="number" step="any" placeholder="0.5" value={form.quantity}
                        onChange={e => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Плечо</label>
                      <input className="form-input" type="number" placeholder="10" value={form.leverage}
                        onChange={e => setForm({ ...form, leverage: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Чистый P&L ($)</label>
                      <input className="form-input" type="number" step="any" placeholder="+25.5" value={form.pnl}
                        onChange={e => setForm({ ...form, pnl: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Комиссия ($)</label>
                      <input className="form-input" type="number" step="any" placeholder="0.75" value={form.commission}
                        onChange={e => setForm({ ...form, commission: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Время входа (открытия)</label>
                      <input className="form-input" type="datetime-local" value={form.openTime}
                        onChange={e => setForm({ ...form, openTime: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Время выхода (закрытия)</label>
                      <input className="form-input" type="datetime-local" placeholder="Опционально (для закрытой сделки)" value={form.closeTime}
                        onChange={e => setForm({ ...form, closeTime: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SL/TP (always shown) */}
            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                Стоп-лосс и Тейк-профит
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--red)' }}>🔴 Stop Loss</label>
                  <input className="form-input" type="number" step="any" placeholder="Цена стопа"
                    value={form.stopLoss} onChange={e => setForm({ ...form, stopLoss: e.target.value })} />
                  {form.stopLoss && (form.entryPrice || parseFloat(form.entryPrice) > 0) && (
                    <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                      Риск: {(Math.abs((parseFloat(form.entryPrice) || trade.entryPrice) - parseFloat(form.stopLoss)) / (parseFloat(form.entryPrice) || trade.entryPrice) * 100 * (parseInt(form.leverage) || trade.leverage)).toFixed(2)}% от депозита
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--green)' }}>🟢 Take Profit</label>
                  <input className="form-input" type="number" step="any" placeholder="Цена тейка"
                    value={form.takeProfit} onChange={e => setForm({ ...form, takeProfit: e.target.value })} />
                  {form.takeProfit && form.stopLoss && (
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                      R:R = {(Math.abs((parseFloat(form.entryPrice) || trade.entryPrice) - parseFloat(form.takeProfit)) / Math.abs((parseFloat(form.entryPrice) || trade.entryPrice) - parseFloat(form.stopLoss))).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Pre-flight Self-Control Checklist */}
            {(isNew || isOpen) && (
              <div className="card">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--green)' }} /> Пре-флайт Чек-лист (Самоконтроль)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { key: 'stopLossSet', text: 'Установлен ли системный Стоп-Лосс?' },
                    { key: 'riskCalculated', text: 'Размер риска на сделку не превышает 1-2%?' },
                    { key: 'ruleChecked', text: 'Сделка соответствует торговой системе/сетапу?' },
                    { key: 'emotionCalm', text: 'Эмоциональное состояние стабильно (нет FOMO/тильта)?' },
                  ].map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={checklist[item.key as keyof typeof checklist] || false}
                        onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        style={{
                          width: 16, height: 16, borderRadius: 4, border: '1px solid var(--border)',
                          accentColor: 'var(--green)', cursor: 'pointer'
                        }}
                      />
                      <span style={{ color: checklist[item.key as keyof typeof checklist] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Real Candlestick Chart (closed trades only) */}
            {!isOpen && !isNew && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>📊 График сделки</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Binance Futures · 600 свечей · маркеры входа/выхода</span>
                </div>
                <TradeChart
                  symbol={trade.symbol}
                  entryPrice={trade.entryPrice}
                  exitPrice={trade.exitPrice}
                  stopLoss={parseFloat(form.stopLoss) || trade.stopLoss || null}
                  takeProfit={parseFloat(form.takeProfit) || trade.takeProfit || null}
                  side={trade.side}
                  openTime={trade.openTime}
                  closeTime={trade.closeTime}
                  pnl={trade.pnl}
                  pnlPercent={calcPnlPct}
                  entryPoints={trade.entryPoints}
                  quantity={trade.quantity}
                  leverage={trade.leverage}
                />
              </div>
            )}

            {/* Entry points list */}
            {!isNew && (trade.entryPoints || []).length > 0 && (
              <div className="card">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                  Точки сделки
                </div>
                {trade.entryPoints.map((p: any, i: number) => {
                  const colors: Record<string, string> = { entry: 'var(--green)', exit: 'var(--red)', add: 'var(--yellow)', reduce: 'var(--blue)' };
                  const labels: Record<string, string> = { entry: '▲ Вход', exit: '▼ Выход', add: '+ Докупка', reduce: '- Сокращение' };
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: colors[p.type] || 'var(--text-secondary)' }}>
                        {labels[p.type] || p.type}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{p.price?.toFixed(4)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {format(new Date(p.time), 'HH:mm:ss')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Annotation Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Setup Tags */}
            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                Сетап (тип сделки)
              </div>
              <div className="tags-wrap">
                {SETUP_TAGS.map(tag => (
                  <button key={tag} className={`tag ${form.setupTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => toggleTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Why entered */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                  Почему вошёл?
                </div>
                {!isOpen && (
                  <span style={{ fontSize: 10, background: 'var(--red-dim)', color: 'var(--red)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                    ОБЯЗАТЕЛЬНО
                  </span>
                )}
              </div>
              <textarea className="form-textarea"
                placeholder={isOpen
                  ? 'Опиши свой план — цель, уровень, почему вошёл именно сейчас?'
                  : 'Что ты видел на графике? Уровень? Пробой? Отскок? Будь конкретен.'}
                value={form.whyEntered}
                onChange={e => setForm({ ...form, whyEntered: e.target.value })}
                style={{ minHeight: 90 }}
              />
            </div>

            {!isOpen && (
              <>
                <div className="card">
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                    Что пошло не так?
                  </div>
                  <textarea className="form-textarea"
                    placeholder="Что сделал неправильно? Поспешил? Снял стоп? Передержал?"
                    value={form.whatWentWrong}
                    onChange={e => setForm({ ...form, whatWentWrong: e.target.value })}
                  />
                </div>

                <div className="card">
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                    Что сделал правильно?
                  </div>
                  <textarea className="form-textarea"
                    placeholder="Что было хорошо в этой сделке?"
                    value={form.whatWentRight}
                    onChange={e => setForm({ ...form, whatWentRight: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Emotions */}
            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                Эмоциональное состояние
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>До входа (1=плохо, 10=отлично)</div>
                <div className="mood-scale">
                  {EMOTIONS.map(n => (
                    <button key={n} className={`mood-btn ${form.emotionBefore === n ? 'selected' : ''} ${n <= 3 ? 'red' : ''}`}
                      onClick={() => setForm({ ...form, emotionBefore: n })}>{n}</button>
                  ))}
                </div>
              </div>
              {!isOpen && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>После выхода</div>
                  <div className="mood-scale">
                    {EMOTIONS.map(n => (
                      <button key={n} className={`mood-btn ${form.emotionAfter === n ? 'selected' : ''}`}
                        onClick={() => setForm({ ...form, emotionAfter: n })}>{n}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                Дополнительные заметки
              </div>
              <textarea className="form-textarea"
                placeholder="Любые мысли о сделке..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <button className="btn btn-primary btn-lg w-full" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Сохраняю...' : isNew ? '💾 Создать сделку' : isOpen ? '💾 Сохранить план' : '💾 Сохранить разбор'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
