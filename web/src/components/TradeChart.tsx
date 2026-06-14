'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  ColorType,
  CandlestickSeries,
  SeriesMarker,
  createSeriesMarkers,
} from 'lightweight-charts';

interface EntryPoint {
  id: string;
  type: 'entry' | 'exit' | 'add' | 'reduce' | 'stop' | 'target';
  price: number;
  quantity?: number | null;
  time: string;
  note?: string | null;
}

interface TradeChartProps {
  symbol: string;
  entryPrice: number;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  side: 'LONG' | 'SHORT';
  openTime: string;
  closeTime?: string | null;
  pnl?: number | null;
  pnlPercent?: number | null;
  entryPoints?: EntryPoint[];
  quantity?: number;
  leverage?: number;
}

const INTERVALS = [
  { label: '1м', value: '1m' },
  { label: '3м', value: '3m' },
  { label: '5м', value: '5m' },
  { label: '15м', value: '15m' },
  { label: '30м', value: '30m' },
  { label: '1ч', value: '1h' },
];

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
};

async function fetchKlines(symbol: string, interval: string, limit = 600): Promise<CandlestickData[]> {
  try {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((k: any[]) => ({
      time: Math.floor(k[0] / 1000) as Time,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
    }));
  } catch {
    return [];
  }
}

// Calculate weighted average entry price from entry + add points
function calcAvgEntry(
  mainEntry: number,
  mainQty: number,
  entryPoints: EntryPoint[]
): { avgPrice: number; totalQty: number } {
  const allEntries = entryPoints.filter(p => p.type === 'entry' || p.type === 'add');
  if (allEntries.length === 0) {
    return { avgPrice: mainEntry, totalQty: mainQty };
  }

  let totalValue = 0;
  let totalQty = 0;
  for (const p of allEntries) {
    const qty = p.quantity ?? mainQty;
    totalValue += p.price * qty;
    totalQty += qty;
  }
  // If no entry points have quantity, fall back to main
  if (totalQty === 0) return { avgPrice: mainEntry, totalQty: mainQty };
  return { avgPrice: totalValue / totalQty, totalQty };
}

export default function TradeChart({
  symbol,
  entryPrice,
  exitPrice,
  stopLoss,
  takeProfit,
  side,
  openTime,
  closeTime,
  pnl,
  pnlPercent,
  entryPoints = [],
  quantity = 0,
  leverage = 1,
}: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [interval, setIntervalVal] = useState('5m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pnlPositive = (pnl ?? 0) >= 0;

  // Derived: avg entry from entryPoints
  const { avgPrice, totalQty } = calcAvgEntry(entryPrice, quantity, entryPoints);
  const hasAvgEntry = Math.abs(avgPrice - entryPrice) > 0.0001;

  // Count adds
  const addPoints = entryPoints.filter(p => p.type === 'add');
  const reducePoints = entryPoints.filter(p => p.type === 'reduce');

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Build Chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: { background: { type: ColorType.Solid, color: '#0D0D18' }, textColor: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: 'Inter, monospace' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      crosshair: { mode: 1, vertLine: { color: 'rgba(255,255,255,0.25)', width: 1, style: 3 }, horzLine: { color: 'rgba(255,255,255,0.25)', width: 1, style: 3 } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
    });

    const candlesSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00D4AA', downColor: '#FF4757', borderUpColor: '#00D4AA', borderDownColor: '#FF4757', wickUpColor: '#00D4AA', wickDownColor: '#FF4757',
    });

    chartRef.current = chart;
    candleRef.current = candlesSeries;

    // 2. Lines
    candlesSeries.createPriceLine({ price: entryPrice, color: side === 'LONG' ? '#00D4AA' : '#FF6B81', lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: `Вход ${side} @ ${entryPrice}` });
    if (hasAvgEntry) candlesSeries.createPriceLine({ price: avgPrice, color: '#FDCB6E', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `Ср.вход @ ${avgPrice.toFixed(4)}` });
    if (exitPrice) candlesSeries.createPriceLine({ price: exitPrice, color: pnlPositive ? '#00D4AA' : '#FF4757', lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: `Выход @ ${exitPrice}` });
    if (stopLoss) candlesSeries.createPriceLine({ price: stopLoss, color: 'rgba(255,71,87,0.75)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `SL @ ${stopLoss}` });
    if (takeProfit) candlesSeries.createPriceLine({ price: takeProfit, color: 'rgba(0,212,170,0.65)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `TP @ ${takeProfit}` });

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    // 3. Load Data
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchKlines(symbol, interval, 600);
        if (!isMounted) return;
        if (!data.length) {
          setError('Нет данных от Binance Futures. Символ может не торговаться на фьючерсах.');
          return;
        }

        candlesSeries.setData(data);

        const intSec = INTERVAL_MS[interval] / 1000;
        const snap = (ts: number): Time => {
          const snapped = Math.floor(ts / intSec) * intSec;
          const exists = data.find(c => (c.time as number) === snapped);
          if (exists) return snapped as Time;
          const before = data.filter(c => (c.time as number) <= ts);
          return (before.length ? before[before.length - 1].time : data[0].time) as Time;
        };

        const entryTs = Math.floor(new Date(openTime).getTime() / 1000);
        const exitTs = closeTime ? Math.floor(new Date(closeTime).getTime() / 1000) : null;
        const markers: SeriesMarker<Time>[] = [];

        markers.push({ time: snap(entryTs), position: side === 'LONG' ? 'belowBar' : 'aboveBar', color: side === 'LONG' ? '#00D4AA' : '#FF6B81', shape: side === 'LONG' ? 'arrowUp' : 'arrowDown', text: `▲ Вход ${entryPrice}`, size: 2 });
        for (const pt of entryPoints) {
          const ptTs = Math.floor(new Date(pt.time).getTime() / 1000);
          if (pt.type === 'add') markers.push({ time: snap(ptTs), position: side === 'LONG' ? 'belowBar' : 'aboveBar', color: '#FFA502', shape: side === 'LONG' ? 'arrowUp' : 'arrowDown', text: `+ Докупка ${pt.price}`, size: 1 });
          else if (pt.type === 'reduce') markers.push({ time: snap(ptTs), position: side === 'LONG' ? 'aboveBar' : 'belowBar', color: '#74B9FF', shape: side === 'LONG' ? 'arrowDown' : 'arrowUp', text: `↓ Сокр. ${pt.price}`, size: 1 });
        }
        if (exitTs && exitPrice) {
          markers.push({ time: snap(exitTs), position: side === 'LONG' ? 'aboveBar' : 'belowBar', color: pnlPositive ? '#00D4AA' : '#FF4757', shape: side === 'LONG' ? 'arrowDown' : 'arrowUp', text: `▼ Выход ${exitPrice}`, size: 2 });
        }

        markers.sort((a, b) => (a.time as number) - (b.time as number));
        // v5 API: use createSeriesMarkers instead of series.setMarkers
        createSeriesMarkers(candlesSeries, markers);

        const first = data[0].time as number;
        const last = data[data.length - 1].time as number;
        const tradeCenter = exitTs ? Math.floor((entryTs + exitTs) / 2) : entryTs;
        const visibleRange = intSec * 80;
        chart.timeScale().setVisibleRange({ from: Math.max(first, tradeCenter - visibleRange / 2) as Time, to: Math.min(last, tradeCenter + visibleRange / 2) as Time });
      } catch (e: any) {
        if (isMounted) setError('Ошибка загрузки: ' + (e.message || e));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
      ro.disconnect();
      try { chart.remove(); } catch (e) {}
      if (chartRef.current === chart) { chartRef.current = null; candleRef.current = null; }
    };
  }, [symbol, interval, entryPrice, exitPrice, stopLoss, takeProfit, side, openTime, closeTime, pnlPositive, avgPrice, hasAvgEntry, JSON.stringify(entryPoints)]);

  return (
    <div style={{ background: '#0D0D18', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* ─── Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: '#111121',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 8,
      }}>
        {/* Left: symbol + side + PnL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 15, fontFamily: 'monospace', color: '#fff' }}>{symbol}</span>

          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
            background: side === 'LONG' ? 'rgba(0,212,170,0.15)' : 'rgba(255,71,87,0.15)',
            color: side === 'LONG' ? '#00D4AA' : '#FF4757',
            border: `1px solid ${side === 'LONG' ? 'rgba(0,212,170,0.4)' : 'rgba(255,71,87,0.4)'}`,
          }}>
            {side === 'LONG' ? '↑ LONG' : '↓ SHORT'}
          </span>

          {/* PnL $ */}
          {pnl != null && (
            <span style={{
              fontSize: 14, fontWeight: 800, fontFamily: 'monospace',
              color: pnlPositive ? '#00D4AA' : '#FF4757',
              background: pnlPositive ? 'rgba(0,212,170,0.12)' : 'rgba(255,71,87,0.12)',
              padding: '3px 12px', borderRadius: 20,
              border: `1px solid ${pnlPositive ? 'rgba(0,212,170,0.35)' : 'rgba(255,71,87,0.35)'}`,
            }}>
              {pnlPositive ? '+' : ''}{pnl.toFixed(2)}$
            </span>
          )}

          {/* PnL % */}
          {pnlPercent != null && (
            <span style={{
              fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
              color: pnlPositive ? '#00D4AA' : '#FF4757',
              opacity: 0.85,
            }}>
              {pnlPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Right: interval selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setIntervalVal(value)}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: interval === value ? '#00D4AA' : 'rgba(255,255,255,0.06)',
                color: interval === value ? '#000' : 'rgba(255,255,255,0.55)',
                border: interval === value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Legend row ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '7px 16px', background: '#0D0D18',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        fontSize: 11, flexWrap: 'wrap',
      }}>
        <span style={{ color: side === 'LONG' ? '#00D4AA' : '#FF6B81', fontWeight: 700 }}>
          {side === 'LONG' ? '▲' : '▼'} Вход: {entryPrice}
        </span>

        {hasAvgEntry && (
          <span style={{ color: '#FDCB6E', fontWeight: 700 }}>
            ∅ Ср. вход: {avgPrice.toFixed(4)}
          </span>
        )}

        {addPoints.length > 0 && (
          <span style={{ color: '#FFA502', fontWeight: 600 }}>
            + Докупки: {addPoints.length}× ({addPoints.map(p => p.price).join(', ')})
          </span>
        )}

        {reducePoints.length > 0 && (
          <span style={{ color: '#74B9FF', fontWeight: 600 }}>
            ↓ Сокр.: {reducePoints.length}×
          </span>
        )}

        {exitPrice && (
          <span style={{ color: pnlPositive ? '#00D4AA' : '#FF4757', fontWeight: 700 }}>
            {side === 'LONG' ? '▼' : '▲'} Выход: {exitPrice}
          </span>
        )}

        {stopLoss && <span style={{ color: 'rgba(255,71,87,0.75)' }}>— SL: {stopLoss}</span>}
        {takeProfit && <span style={{ color: 'rgba(0,212,170,0.65)' }}>— TP: {takeProfit}</span>}

        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
          Binance Futures · 600 свечей
        </span>
      </div>

      {/* ─── Stats mini-bar ─── */}
      {(pnl != null || hasAvgEntry || addPoints.length > 0) && (
        <div style={{
          display: 'flex', gap: 0,
          background: '#111121', borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          {[
            pnl != null && {
              label: 'PnL',
              value: `${pnlPositive ? '+' : ''}${pnl.toFixed(2)} $`,
              color: pnlPositive ? '#00D4AA' : '#FF4757',
            },
            pnlPercent != null && {
              label: 'PnL %',
              value: `${pnlPositive ? '+' : ''}${pnlPercent.toFixed(2)}%`,
              color: pnlPositive ? '#00D4AA' : '#FF4757',
            },
            hasAvgEntry && {
              label: 'Ср. цена',
              value: avgPrice.toFixed(4),
              color: '#FDCB6E',
            },
            addPoints.length > 0 && {
              label: 'Докупок',
              value: `${addPoints.length} шт`,
              color: '#FFA502',
            },
            exitPrice && entryPrice && {
              label: side === 'LONG' ? 'Движение' : 'Движение',
              value: (() => {
                const base = hasAvgEntry ? avgPrice : entryPrice;
                const pct = ((exitPrice - base) / base * 100) * (side === 'LONG' ? 1 : -1);
                return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
              })(),
              color: (() => {
                const base = hasAvgEntry ? avgPrice : entryPrice;
                const pct = ((exitPrice - base) / base) * (side === 'LONG' ? 1 : -1);
                return pct >= 0 ? '#00D4AA' : '#FF4757';
              })(),
            },
          ].filter(Boolean).map((item: any) => (
            <div key={item.label} style={{
              flex: 1, padding: '8px 12px', textAlign: 'center',
              borderRight: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Chart canvas ─── */}
      <div style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(13,13,24,0.85)', backdropFilter: 'blur(4px)', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#00D4AA', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Загрузка 600 свечей...</span>
          </div>
        )}
        {error && !loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(13,13,24,0.9)', gap: 12, padding: 24, textAlign: 'center',
          }}>
            <span style={{ fontSize: 28 }}>⚠️</span>
            <span style={{ fontSize: 13, color: 'rgba(255,71,87,0.9)', maxWidth: 320 }}>{error}</span>
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  );
}
