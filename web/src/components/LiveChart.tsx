'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, ColorType, CandlestickSeries } from 'lightweight-charts';

interface LiveChartProps {
  symbol: string;          // e.g. "BTCUSDT"
  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  side: 'LONG' | 'SHORT';
  quantity: number;
  leverage: number;
  interval?: string;       // '1m' | '5m' | '15m'
}

interface TickerData {
  markPrice: number;
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  fundingRate: number;
}

const INTERVALS = [
  { label: '1м', value: '1m' },
  { label: '3м', value: '3m' },
  { label: '5м', value: '5m' },
  { label: '15м', value: '15m' },
  { label: '1ч', value: '1h' },
];

export default function LiveChart({
  symbol,
  entryPrice,
  stopLoss,
  takeProfit,
  side,
  quantity,
  leverage,
  interval: defaultInterval = '1m',
}: LiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const priceLineRef = useRef<any>(null);
  const entryLineRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);
  const tpLineRef = useRef<any>(null);

  const [ticker, setTicker] = useState<TickerData | null>(null);
  const [unrealizedPnl, setUnrealizedPnl] = useState<number | null>(null);
  const [pnlPercent, setPnlPercent] = useState<number | null>(null);
  const [interval, setInterval_] = useState(defaultInterval);
  const [connected, setConnected] = useState(false);

  // Store trade params in ref to avoid stale closures in WS callback
  const paramsRef = useRef({ entryPrice, side, quantity, leverage });
  useEffect(() => {
    paramsRef.current = { entryPrice, side, quantity, leverage };
  }, [entryPrice, side, quantity, leverage]);

  // Calculate unrealized PnL based on latest ref values
  const calcPnl = useCallback((currentPrice: number) => {
    const { entryPrice: entry, side: s, quantity: qty, leverage: lev } = paramsRef.current;
    const priceDiff = s === 'LONG'
      ? currentPrice - entry
      : entry - currentPrice;
    const pnl = priceDiff * qty;
    const margin = (entry * qty) / lev;
    const pnlPct = margin > 0 ? (pnl / margin) * 100 : 0;
    
    setUnrealizedPnl(Math.round(pnl * 100) / 100);
    setPnlPercent(Math.round(pnlPct * 100) / 100);
  }, []);

  // Load historical klines
  const loadHistory = useCallback(async (sym: string, intv: string) => {
    try {
      const res = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${intv}&limit=200`
      );
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((k: any[]) => ({
        time: Math.floor(k[0] / 1000) as Time,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
      })) as CandlestickData[];
    } catch {
      return [];
    }
  }, []);

  // Initialize chart canvas
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: '#13131F' },
        textColor: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00D4AA',
      downColor: '#FF4757',
      borderUpColor: '#00D4AA',
      borderDownColor: '#FF4757',
      wickUpColor: '#00D4AA',
      wickDownColor: '#FF4757',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Entry price line
    const entryLine = candleSeries.createPriceLine({
      price: entryPrice,
      color: '#00D4AA',
      lineWidth: 2,
      lineStyle: 1, // dashed
      axisLabelVisible: true,
      title: `Вход ${side} @ ${entryPrice}`,
    });
    entryLineRef.current = entryLine;

    // Stop loss line
    if (stopLoss) {
      const slLine = candleSeries.createPriceLine({
        price: stopLoss,
        color: '#FF4757',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `SL @ ${stopLoss}`,
      });
      slLineRef.current = slLine;
    }

    // Take profit line
    if (takeProfit) {
      const tpLine = candleSeries.createPriceLine({
        price: takeProfit,
        color: '#00B894',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `TP @ ${takeProfit}`,
      });
      tpLineRef.current = tpLine;
    }

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [entryPrice, stopLoss, takeProfit, side]);

  // Load history + connect WebSocket when symbol or interval changes
  useEffect(() => {
    const sym = symbol.toLowerCase();

    // Close existing WS
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }

    // Load history
    loadHistory(symbol, interval).then((candles) => {
      if (candleSeriesRef.current && candles.length > 0) {
        candleSeriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent();

        // Set initial PnL from last close
        const lastClose = candles[candles.length - 1]?.close;
        if (lastClose) calcPnl(lastClose);
      }
    });

    // Connect to Binance futures WebSocket — combined stream
    const streamUrl = `wss://fstream.binance.com/stream?streams=${sym}@kline_${interval}/${sym}@markPrice@1s/${sym}@bookTicker`;
    
    console.log(`Connecting WebSocket to: ${streamUrl}`);
    const ws = new WebSocket(streamUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected!');
      setConnected(true);
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = (e) => console.error('WebSocket Error:', e);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const streamName: string = msg.stream || '';
        const data = msg.data;

        // Kline update
        if (streamName.includes('@kline')) {
          const k = data.k;
          const candle: CandlestickData = {
            time: Math.floor(k.t / 1000) as Time,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          };
          candleSeriesRef.current?.update(candle);
        }

        // Mark price update (every 1 second)
        if (streamName.includes('@markPrice')) {
          const markPrice = parseFloat(data.p);
          const fundingRate = parseFloat(data.r || '0');

          setTicker(prev => {
            const next = {
              markPrice,
              bidPrice: prev?.bidPrice || markPrice,
              askPrice: prev?.askPrice || markPrice,
              midPrice: prev ? (prev.bidPrice + prev.askPrice) / 2 : markPrice,
              fundingRate,
            };
            return next;
          });

          calcPnl(markPrice);

          // Update live price line on chart
          if (candleSeriesRef.current) {
            if (priceLineRef.current) {
              try { candleSeriesRef.current.removePriceLine(priceLineRef.current); } catch {}
            }
            const priceLine = candleSeriesRef.current.createPriceLine({
              price: markPrice,
              color: '#FFFFFF',
              lineWidth: 1,
              lineStyle: 0, // solid
              axisLabelVisible: true,
              title: `Mark ${markPrice.toFixed(2)}`,
            });
            priceLineRef.current = priceLine;
          }
        }

        // Book ticker (bid/ask → mid price)
        if (streamName.includes('@bookTicker')) {
          const bid = parseFloat(data.b);
          const ask = parseFloat(data.a);
          const mid = (bid + ask) / 2;

          setTicker(prev => {
            const next = {
              bidPrice: bid,
              askPrice: ask,
              midPrice: mid,
              markPrice: prev?.markPrice || mid,
              fundingRate: prev?.fundingRate || 0,
            };
            return next;
          });
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol, interval, loadHistory, calcPnl]);

  const pnlPositive = (unrealizedPnl ?? 0) >= 0;
  const spread = ticker ? ticker.askPrice - ticker.bidPrice : 0;
  const spreadPercent = ticker ? (spread / ticker.midPrice) * 100 : 0;

  return (
    <div>
      {/* Top stats bar */}
      <div className="livechart-top-stats">
        {[
          {
            label: 'Цена (Mark)',
            value: ticker?.markPrice?.toFixed(symbol.includes('DOGE') || symbol.includes('XRP') ? 5 : 2) ?? '...',
            color: 'var(--text-primary)',
            big: true,
          },
          {
            label: 'Bid',
            value: ticker?.bidPrice?.toFixed(symbol.includes('DOGE') || symbol.includes('XRP') ? 5 : 2) ?? '...',
            color: 'var(--green)',
          },
          {
            label: 'Ask',
            value: ticker?.askPrice?.toFixed(symbol.includes('DOGE') || symbol.includes('XRP') ? 5 : 2) ?? '...',
            color: 'var(--red)',
          },
          {
            label: 'Mid Price',
            value: ticker?.midPrice?.toFixed(symbol.includes('DOGE') || symbol.includes('XRP') ? 5 : 2) ?? '...',
            color: 'var(--yellow)',
          },
          {
            label: 'Funding',
            value: ticker ? `${(ticker.fundingRate * 100).toFixed(4)}%` : '...',
            color: (ticker?.fundingRate ?? 0) >= 0 ? 'var(--red)' : 'var(--green)',
          },
        ].map(({ label, value, color, big }) => (
          <div key={label} style={{ padding: '10px 14px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: big ? 16 : 14, fontWeight: 700, color, fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div style={{ position: 'relative', border: '1px solid var(--border)', borderTop: 'none' }}>
        {/* Interval selector */}
        <div style={{
          position: 'absolute', top: 10, left: 12, zIndex: 10,
          display: 'flex', gap: 4,
        }}>
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setInterval_(value)}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: interval === value ? 'var(--green)' : 'rgba(0,0,0,0.6)',
                color: interval === value ? '#000' : 'rgba(255,255,255,0.6)',
                border: interval === value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Connection indicator */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 20,
          fontSize: 11, fontWeight: 600,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connected ? '#00D4AA' : '#FF4757',
            boxShadow: connected ? '0 0 6px #00D4AA' : 'none',
            animation: connected ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{ color: connected ? '#00D4AA' : '#FF4757' }}>
            {connected ? 'LIVE' : 'Connecting...'}
          </span>
        </div>

        {/* Spread info */}
        {ticker && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 20,
            fontSize: 10, color: 'rgba(255,255,255,0.5)',
          }}>
            Спред: {spread.toFixed(4)} ({spreadPercent.toFixed(4)}%)
          </div>
        )}

        <div ref={chartContainerRef} style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }} />
      </div>

      {/* Unrealized PnL bar */}
      <div className="livechart-pnl-grid">
        <div style={{
          padding: '14px 18px',
          background: pnlPositive ? 'rgba(0,212,170,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${pnlPositive ? 'rgba(0,212,170,0.25)' : 'rgba(255,71,87,0.25)'}`,
          borderRadius: 10,
          gridColumn: '1 / 3',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Нереализованный P&L
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: pnlPositive ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace', letterSpacing: '-1px' }}>
            {unrealizedPnl !== null ? `${pnlPositive ? '+' : ''}${unrealizedPnl.toFixed(2)} $` : '...'}
          </div>
          <div style={{ fontSize: 13, color: pnlPositive ? 'var(--green)' : 'var(--red)', marginTop: 4, fontWeight: 600 }}>
            {pnlPercent !== null ? `${pnlPositive ? '+' : ''}${pnlPercent.toFixed(2)}%` : ''}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              (ROE на плечо x{leverage})
            </span>
          </div>
        </div>

        <div style={{ padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Дистанция до SL
          </div>
          {stopLoss && ticker ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)', fontFamily: 'monospace' }}>
                {Math.abs(ticker.markPrice - stopLoss).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(Math.abs(ticker.markPrice - stopLoss) / ticker.markPrice * 100).toFixed(3)}% до стопа
              </div>
            </>
          ) : (
            <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>SL не задан</div>
          )}
        </div>

        <div style={{ padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Дистанция до TP
          </div>
          {takeProfit && ticker ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)', fontFamily: 'monospace' }}>
                {Math.abs(ticker.markPrice - takeProfit).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(Math.abs(ticker.markPrice - takeProfit) / ticker.markPrice * 100).toFixed(3)}% до тейка
              </div>
            </>
          ) : (
            <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>TP не задан</div>
          )}
        </div>
      </div>
    </div>
  );
}
