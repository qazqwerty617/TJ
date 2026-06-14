'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Wifi, ExternalLink, Lock, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const ALL_EXCHANGES = [
  {
    id: 'binance',
    name: 'Binance',
    color: '#F3BA2F',
    bg: 'rgba(243,186,47,0.08)',
    border: 'rgba(243,186,47,0.25)',
    logo: '🟡',
    type: 'Futures + Spot',
    live: true,
    apiUrl: 'https://www.binance.com/ru/my/settings/api-management',
    description: 'Крупнейшая биржа в мире. Самая высокая ликвидность.',
  },
  {
    id: 'bybit',
    name: 'Bybit',
    color: '#F7A600',
    bg: 'rgba(247,166,0,0.08)',
    border: 'rgba(247,166,0,0.2)',
    logo: '🟠',
    type: 'Futures + Spot',
    live: false,
    apiUrl: 'https://www.bybit.com/ru-RU/user/api-management',
    description: 'Популярна для скальпинга, удобный интерфейс.',
  },
  {
    id: 'okx',
    name: 'OKX',
    color: '#FFFFFF',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.12)',
    logo: '⚫',
    type: 'Futures + Spot',
    live: false,
    apiUrl: 'https://www.okx.com/account/my-api',
    description: 'Низкие комиссии, хорошая ликвидность альтов.',
  },
  {
    id: 'bitget',
    name: 'Bitget',
    color: '#00F0FF',
    bg: 'rgba(0,240,255,0.05)',
    border: 'rgba(0,240,255,0.15)',
    logo: '🔵',
    type: 'Futures + Spot',
    live: false,
    apiUrl: 'https://www.bitget.com/account/newapi',
    description: 'Растущая биржа с хорошими условиями для трейдинга.',
  },
  {
    id: 'gateio',
    name: 'Gate.io',
    color: '#2ECC71',
    bg: 'rgba(46,204,113,0.06)',
    border: 'rgba(46,204,113,0.2)',
    logo: '🟢',
    type: 'Futures + Spot',
    live: false,
    apiUrl: 'https://www.gate.io/myaccount/api_key_manage',
    description: 'Большой выбор альтов и низкие комиссии.',
  },
  {
    id: 'mexc',
    name: 'MEXC',
    color: '#00D4FF',
    bg: 'rgba(0,212,255,0.05)',
    border: 'rgba(0,212,255,0.15)',
    logo: '🔵',
    type: 'Futures + Spot',
    live: false,
    apiUrl: 'https://www.mexc.com/user/openapi',
    description: 'Листинг новых токенов, низкий порог входа.',
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    color: '#A855F7',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.2)',
    logo: '🟣',
    type: 'Perp DEX',
    live: false,
    apiUrl: 'https://app.hyperliquid.xyz/',
    description: 'Децентрализованная биржа фьючерсов, топ ликвидность DEX.',
  },
];

export default function ExchangeSettingsPage() {
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [forms, setForms] = useState<Record<string, { apiKey: string; apiSecret: string; label: string }>>({});

  useEffect(() => { loadExchanges(); }, []);

  const loadExchanges = async () => {
    try {
      const res = await api.get('/api/exchanges');
      setExchanges(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getForm = (id: string) => forms[id] || { apiKey: '', apiSecret: '', label: '' };
  const setForm = (id: string, data: any) => setForms(f => ({ ...f, [id]: { ...getForm(id), ...data } }));

  const addExchange = async (exchangeId: string) => {
    const form = getForm(exchangeId);
    if (!form.apiKey || !form.apiSecret) {
      toast.error('Введи API Key и Secret Key');
      return;
    }
    setTestingConnection(true);
    try {
      const res = await api.post('/api/exchanges', {
        exchange: exchangeId,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        label: form.label || ALL_EXCHANGES.find(e => e.id === exchangeId)?.name,
      });
      toast.success(`✅ ${res.data.message}`);
      setForms(f => ({ ...f, [exchangeId]: { apiKey: '', apiSecret: '', label: '' } }));
      setAddingId(null);
      loadExchanges();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка подключения');
    } finally {
      setTestingConnection(false);
    }
  };

  const deleteExchange = async (id: string) => {
    if (!confirm('Удалить подключение? Данные сделок останутся.')) return;
    try {
      await api.delete(`/api/exchanges/${id}`);
      toast.success('Биржа отключена');
      loadExchanges();
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const syncAll = async () => {
    try {
      await api.post('/api/exchanges/sync');
      toast.success('🔄 Синхронизация запущена! Данные обновятся через 1-2 минуты.');
    } catch {
      toast.error('Ошибка синхронизации');
    }
  };

  const connectedIds = new Set(exchanges.map(e => e.exchange));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🔌 Подключение бирж</h2>
          <p>API ключи шифруются AES-256 и хранятся на твоём сервере</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={syncAll}>
            <RefreshCw size={14} /> Синхронизировать всё
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* Connected exchanges */}
        {exchanges.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
              Подключённые биржи
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {exchanges.map((ex) => {
                const info = ALL_EXCHANGES.find(e => e.id === ex.exchange);
                return (
                  <div key={ex.id} className="connected-exchange-card" style={{
                    background: info?.bg || 'var(--bg-card)',
                    border: `1px solid ${info?.border || 'var(--border)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ fontSize: 28 }}>{info?.logo}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.label || info?.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {info?.type} ·{' '}
                          {ex.lastSyncAt
                            ? `Синхр. ${format(new Date(ex.lastSyncAt), 'dd.MM в HH:mm', { locale: ru })}`
                            : 'Ещё не синхронизировано'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {ex.isActive
                        ? <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                            <CheckCircle2 size={14} /> Активна
                          </div>
                        : <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)' }}>
                            <XCircle size={14} /> Неактивна
                          </div>
                      }
                      <button className="btn btn-danger btn-sm" onClick={() => deleteExchange(ex.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All exchanges grid */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
          Все поддерживаемые биржи
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {ALL_EXCHANGES.map((ex) => {
            const isConnected = connectedIds.has(ex.id);
            const isAdding = addingId === ex.id;
            const form = getForm(ex.id);

            return (
              <div key={ex.id} style={{
                background: isConnected ? ex.bg : 'var(--bg-card)',
                border: `1px solid ${isConnected ? ex.border : 'var(--border)'}`,
                borderRadius: 14,
                padding: 18,
                transition: 'all 0.2s',
              }}>
                {/* Exchange header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 26 }}>{ex.logo}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</span>
                        {ex.live ? (
                          <span style={{ fontSize: 10, background: 'var(--green-dim)', color: 'var(--green)', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
                            LIVE
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: 20, fontWeight: 500 }}>
                            Скоро
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ex.type}</div>
                    </div>
                  </div>

                  {isConnected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                      <CheckCircle2 size={15} /> Подключена
                    </div>
                  ) : (
                    <a href={ex.apiUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
                      Создать API <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                  {ex.description}
                </p>

                {/* Connect form */}
                {!isConnected && (
                  <>
                    {isAdding ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {!ex.live && (
                          <div style={{ padding: '8px 12px', background: 'rgba(255,165,2,0.08)', border: '1px solid rgba(255,165,2,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)' }}>
                            ⚠️ Автосинхронизация для {ex.name} в разработке. API ключи будут сохранены.
                          </div>
                        )}
                        <input
                          className="form-input"
                          style={{ fontSize: 12 }}
                          placeholder="Название (необязательно)"
                          value={form.label}
                          onChange={e => setForm(ex.id, { label: e.target.value })}
                        />
                        <input
                          className="form-input"
                          style={{ fontSize: 12 }}
                          placeholder="API Key"
                          value={form.apiKey}
                          onChange={e => setForm(ex.id, { apiKey: e.target.value })}
                        />
                        <input
                          className="form-input"
                          type="password"
                          style={{ fontSize: 12 }}
                          placeholder="Secret Key"
                          value={form.apiSecret}
                          onChange={e => setForm(ex.id, { apiSecret: e.target.value })}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => addExchange(ex.id)}
                            disabled={testingConnection}
                          >
                            {testingConnection ? <><RefreshCw size={13} className="spin" /> Проверка...</> : <><Wifi size={13} /> Подключить</>}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setAddingId(null)}>
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm w-full"
                        style={{ borderColor: ex.live ? ex.border : 'var(--border)' }}
                        onClick={() => setAddingId(ex.id)}
                      >
                        <Plus size={13} /> {ex.live ? 'Подключить' : 'Сохранить ключи'}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Security block */}
        <div style={{
          marginTop: 28, padding: '16px 20px',
          background: 'rgba(61,121,255,0.05)', border: '1px solid rgba(61,121,255,0.18)',
          borderRadius: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--blue)', marginBottom: 12 }}>
            <Lock size={16} /> Безопасность API ключей
          </div>
          <div className="grid-2" style={{ gap: 8 }}>
            {[
              'API ключи шифруются AES-256 перед сохранением в базу',
              'Используется только Read-Only доступ — торговля невозможна',
              'Никогда не давай права на вывод средств или торговлю',
              'Данные хранятся на твоём VPS и никуда не передаются',
            ].map((text) => (
              <div key={text} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--green)', marginTop: 1 }}>✓</span>
                {text}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
