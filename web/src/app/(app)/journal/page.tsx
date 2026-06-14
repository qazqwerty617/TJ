'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RefreshCw, Plus } from 'lucide-react';

const EMOTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function JournalPage() {
  const [journals, setJournals] = useState<any[]>([]);
  const [today, setToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ morningNotes: '', eveningNotes: '', lessonsLearned: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [j, t] = await Promise.all([
        api.get('/api/journal?limit=30'),
        api.get('/api/journal/today'),
      ]);
      setJournals(j.data);
      setToday(t.data);
      setSelected(t.data);
      setForm({
        morningNotes: t.data?.morningNotes || '',
        eveningNotes: t.data?.eveningNotes || '',
        lessonsLearned: t.data?.lessonsLearned || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveToday = async () => {
    setSaving(true);
    try {
      await api.put('/api/journal/today', form);
      toast.success('✅ Запись сохранена!');
      loadAll();
      setEditMode(false);
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const getMoodEmoji = (score: number) => {
    if (!score) return '—';
    if (score <= 2) return '😞';
    if (score <= 4) return '😐';
    if (score <= 6) return '🙂';
    if (score <= 8) return '😊';
    return '🤩';
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <RefreshCw size={28} className="spin" style={{ color: 'var(--green)' }} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📓 Дневник</h2>
          <p>Ежедневные записи и рефлексия</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setSelected(today); setEditMode(true); }}>
          <Plus size={14} /> Запись сегодня
        </button>
      </div>

      <div className="page-content">
        <div className="grid-2" style={{ gap: 20 }}>
          {/* Journal list */}
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>История записей</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {journals.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 14 }}>Нет записей. Начни с сегодняшнего дня!</p>
                </div>
              ) : (
                journals.map((j) => (
                  <div
                    key={j.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      border: selected?.id === j.id ? '1px solid var(--border-active)' : '1px solid var(--border)',
                      background: selected?.id === j.id ? 'var(--green-dim)' : 'var(--bg-card)',
                    }}
                    onClick={() => { setSelected(j); setEditMode(false); setForm({ morningNotes: j.morningNotes || '', eveningNotes: j.eveningNotes || '', lessonsLearned: j.lessonsLearned || '' }); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {format(new Date(j.date), 'd MMMM yyyy', { locale: ru })}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                          {j.tradesCount || 0} сделок ·{' '}
                          <span style={{ color: (j.dailyPnl || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                            {(j.dailyPnl || 0) >= 0 ? '+' : ''}{(j.dailyPnl || 0).toFixed(2)} $
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 28 }}>{getMoodEmoji(j.moodScore)}</div>
                    </div>
                    {j.morningNotes && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.morningNotes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected journal detail */}
          {selected && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {format(new Date(selected.date), 'd MMMM yyyy', { locale: ru })}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(!editMode)}>
                  {editMode ? 'Отмена' : 'Редактировать'}
                </button>
              </div>

              {/* Stats */}
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-label">Настроение</div>
                  <div style={{ fontSize: 24, marginTop: 4 }}>{getMoodEmoji(selected.moodScore)} {selected.moodScore || '—'}</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-label">P&L дня</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: (selected.dailyPnl || 0) >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
                    {(selected.dailyPnl || 0) >= 0 ? '+' : ''}{(selected.dailyPnl || 0).toFixed(2)} $
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-label">Сделок</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{selected.tradesCount || 0}</div>
                </div>
              </div>

              {/* Checkin info */}
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    {selected.sleptWell ? '✅' : selected.sleptWell === false ? '❌' : '—'}
                    <span style={{ color: 'var(--text-muted)' }}>Сон</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    {selected.pressureToEarn ? '⚠️' : selected.pressureToEarn === false ? '✅' : '—'}
                    <span style={{ color: 'var(--text-muted)' }}>Давление</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    {selected.shouldTrade === false ? '🚫 Не торговал' : selected.shouldTrade ? '✅ Торговал' : '—'}
                  </div>
                </div>
              </div>

              {editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">📅 Утром: план на день</label>
                    <textarea className="form-textarea"
                      placeholder="Что планируешь делать сегодня? Какие пары смотришь? Какие уровни?"
                      value={form.morningNotes}
                      onChange={e => setForm({ ...form, morningNotes: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">🌙 Вечером: итоги дня</label>
                    <textarea className="form-textarea"
                      placeholder="Как прошёл день? Выполнил ли план?"
                      value={form.eveningNotes}
                      onChange={e => setForm({ ...form, eveningNotes: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">💡 Что узнал сегодня?</label>
                    <textarea className="form-textarea"
                      placeholder="Главный урок дня..."
                      value={form.lessonsLearned}
                      onChange={e => setForm({ ...form, lessonsLearned: e.target.value })} />
                  </div>
                  <button className="btn btn-primary w-full" onClick={saveToday} disabled={saving}>
                    {saving ? 'Сохраняю...' : '💾 Сохранить запись'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: '📅 Утренний план', value: selected.morningNotes },
                    { label: '🌙 Итоги дня', value: selected.eveningNotes },
                    { label: '💡 Урок дня', value: selected.lessonsLearned },
                  ].map(({ label, value }) => (
                    <div key={label} className="card">
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                        {label}
                      </div>
                      <p style={{ fontSize: 14, color: value ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.6, fontStyle: value ? 'normal' : 'italic' }}>
                        {value || 'Не заполнено'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
