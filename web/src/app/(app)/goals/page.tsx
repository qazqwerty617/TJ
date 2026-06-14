'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Target, Plus, Trash2, CheckCircle2, Clock, TrendingUp,
  Star, Trophy, Calendar, RefreshCw, Bell, BellOff
} from 'lucide-react';

type Goal = {
  id: string;
  title: string;
  period: string;
  targetType: string;
  targetValue: number | null;
  depositAmount: number | null;
  customNote: string | null;
  unit: string | null;
  startDate: string | null;
  endDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  current: number | null;
  percent: number | null;
  justCompleted: boolean;
  createdAt: string;
};

const PERIODS = [
  { value: 'day', label: 'День', icon: '📅' },
  { value: 'month', label: 'Месяц', icon: '🗓️' },
  { value: 'quarter', label: 'Квартал', icon: '📊' },
  { value: 'halfyear', label: 'Полгода', icon: '📈' },
  { value: 'year', label: 'Год', icon: '🏆' },
  { value: 'custom', label: 'Своя дата', icon: '✏️' },
];

const TYPES = [
  { value: 'pnl', label: 'Профит ($)', unit: '$', icon: '💰' },
  { value: 'pnl_percent', label: '% от депозита', unit: '%', icon: '📊' },
  { value: 'winrate', label: 'Win Rate', unit: '%', icon: '🎯' },
  { value: 'trades', label: 'Кол-во сделок', unit: 'сделок', icon: '📋' },
  { value: 'custom', label: 'Своя цель', unit: null, icon: '⭐' },
];

const PERIOD_COLORS: Record<string, string> = {
  day: '#3D79FF',
  month: '#00D4AA',
  quarter: '#FFA502',
  halfyear: '#FF6B81',
  halfYear: '#FF6B81',
  year: '#A29BFE',
  custom: '#FDCB6E',
};

function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

function sendNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png' });
  }
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [form, setForm] = useState({
    title: '',
    period: 'month',
    targetType: 'pnl',
    targetValue: '',
    depositAmount: '',
    customNote: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    requestNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifGranted(Notification.permission === 'granted');
    }
    loadGoals();
  }, []);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/goals');
      const data: Goal[] = res.data;
      setGoals(data);

      // Уведомление о только что достигнутых целях
      for (const g of data) {
        if (g.justCompleted) {
          toast.success(`🏆 Цель достигнута: ${g.title}!`, { duration: 6000 });
          sendNotification('🏆 Цель достигнута!', g.title);
        }
      }
    } catch {
      toast.error('Ошибка загрузки целей');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Введи название цели');

    const type = TYPES.find(t => t.value === form.targetType);
    try {
      await api.post('/api/goals', {
        title: form.title,
        period: form.period,
        targetType: form.targetType,
        targetValue: form.targetValue ? parseFloat(form.targetValue) : null,
        depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null,
        customNote: form.customNote || null,
        unit: type?.unit || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      toast.success('Цель создана!');
      setShowForm(false);
      setForm({ title: '', period: 'month', targetType: 'pnl', targetValue: '', depositAmount: '', customNote: '', startDate: '', endDate: '' });
      loadGoals();
    } catch {
      toast.error('Ошибка создания цели');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить цель?')) return;
    try {
      await api.delete(`/api/goals/${id}`);
      toast.success('Цель удалена');
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const handleRequestNotif = async () => {
    const perm = await Notification.requestPermission();
    setNotifGranted(perm === 'granted');
    if (perm === 'granted') toast.success('Уведомления включены!');
    else toast.error('Уведомления отклонены');
  };

  const activeGoals = goals.filter(g => !g.isCompleted);
  const completedGoals = goals.filter(g => g.isCompleted);

  const periodLabel = (p: string) => PERIODS.find(x => x.value === p)?.label || p;
  const periodIcon = (p: string) => PERIODS.find(x => x.value === p)?.icon || '🎯';
  const typeIcon = (t: string) => TYPES.find(x => x.value === t)?.icon || '⭐';

  const selectedType = TYPES.find(t => t.value === form.targetType);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Target size={22} color="var(--green)" /> Цели
          </h2>
          <p>Ставь цели — достигай их. Система уведомит когда выполнишь.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!notifGranted && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRequestNotif}
              title="Включить уведомления"
            >
              <Bell size={14} /> Уведомления
            </button>
          )}
          {notifGranted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)', padding: '6px 12px', background: 'var(--green-dim)', borderRadius: 8, border: '1px solid var(--border-active)' }}>
              <Bell size={12} /> Уведомления вкл.
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={loadGoals} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Новая цель
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* Форма создания */}
        {showForm && (
          <div style={{ marginBottom: 24, padding: 24, background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-active)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Новая цель</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Название */}
              <div className="form-group">
                <label className="form-label">Название цели</label>
                <input
                  className="form-input"
                  placeholder="Например: Заработать $1000 в этом месяце"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              {/* Период */}
              <div className="form-group">
                <label className="form-label">Период</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {PERIODS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm({ ...form, period: p.value })}
                      style={{
                        padding: '10px 8px',
                        background: form.period === p.value ? `${PERIOD_COLORS[p.value]}22` : 'var(--bg-elevated)',
                        border: `1px solid ${form.period === p.value ? PERIOD_COLORS[p.value] : 'var(--border)'}`,
                        borderRadius: 8,
                        color: form.period === p.value ? PERIOD_COLORS[p.value] : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: form.period === p.value ? 700 : 400,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Кастомные даты */}
              {form.period === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">С даты</label>
                    <input className="form-input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">По дату</label>
                    <input className="form-input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Тип цели */}
              <div className="form-group">
                <label className="form-label">Тип цели</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, targetType: t.value })}
                      style={{
                        padding: '12px 10px',
                        background: form.targetType === t.value ? 'var(--green-dim)' : 'var(--bg-elevated)',
                        border: `1px solid ${form.targetType === t.value ? 'var(--border-active)' : 'var(--border)'}`,
                        borderRadius: 8,
                        color: form.targetType === t.value ? 'var(--green)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: form.targetType === t.value ? 700 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Целевое значение или описание */}
              {form.targetType !== 'custom' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">
                      Целевое значение {selectedType?.unit ? `(${selectedType.unit})` : ''}
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      placeholder={
                        form.targetType === 'pnl' ? '1000'
                          : form.targetType === 'pnl_percent' ? '10'
                          : form.targetType === 'winrate' ? '60'
                          : '20'
                      }
                      value={form.targetValue}
                      onChange={e => setForm({ ...form, targetValue: e.target.value })}
                    />
                  </div>

                  {/* Поле депозита — только для % от депозита */}
                  {form.targetType === 'pnl_percent' && (
                    <div className="form-group">
                      <label className="form-label">Размер депозита ($)</label>
                      <input
                        className="form-input"
                        type="number"
                        step="1"
                        placeholder="Например: 5000"
                        value={form.depositAmount}
                        onChange={e => setForm({ ...form, depositAmount: e.target.value })}
                        required
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        💡 Введи текущий размер твоего депозита. Прогресс будет считаться как % профита от него.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Описание цели</label>
                  <textarea
                    className="form-input"
                    placeholder="Опиши свою цель подробно..."
                    value={form.customNote}
                    onChange={e => setForm({ ...form, customNote: e.target.value })}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={14} /> Создать цель
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && !showForm ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', flexDirection: 'column', gap: 12 }}>
            <RefreshCw size={28} className="spin" style={{ color: 'var(--green)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Загрузка целей...</p>
          </div>
        ) : (
          <>
            {/* Активные цели */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Target size={16} color="var(--green)" />
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Активные цели ({activeGoals.length})</h3>
              </div>

              {activeGoals.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
                  <Target size={40} style={{ opacity: 0.2, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14, marginBottom: 12 }}>У тебя пока нет активных целей</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                    <Plus size={13} /> Поставить первую цель
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {activeGoals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onDelete={handleDelete} periodLabel={periodLabel} periodIcon={periodIcon} typeIcon={typeIcon} />
                  ))}
                </div>
              )}
            </div>

            {/* Выполненные цели */}
            {completedGoals.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Trophy size={16} color="var(--yellow)" />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--yellow)' }}>
                    Достигнутые цели ({completedGoals.length})
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {completedGoals.map(goal => (
                    <GoalCard key={goal.id} goal={goal} onDelete={handleDelete} periodLabel={periodLabel} periodIcon={periodIcon} typeIcon={typeIcon} completed />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GoalCard({ goal, onDelete, periodLabel, periodIcon, typeIcon, completed = false }: {
  goal: Goal;
  onDelete: (id: string) => void;
  periodLabel: (p: string) => string;
  periodIcon: (p: string) => string;
  typeIcon: (t: string) => string;
  completed?: boolean;
}) {
  const color = PERIOD_COLORS[goal.period] || '#00D4AA';
  const percent = goal.percent ?? 0;
  const hasProgress = goal.targetType !== 'custom' && goal.targetValue != null;

  return (
    <div
      style={{
        background: completed
          ? 'linear-gradient(135deg, rgba(253,203,110,0.08), rgba(253,203,110,0.03))'
          : 'var(--bg-card)',
        border: `1px solid ${completed ? 'rgba(253,203,110,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      className="card-hover"
    >
      {/* Accent bar top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: completed ? 'var(--yellow)' : color, opacity: 0.8 }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{typeIcon(goal.targetType)}</span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 10px',
                borderRadius: 20,
                background: `${color}22`,
                color,
                fontWeight: 600,
                border: `1px solid ${color}44`,
              }}
            >
              {periodIcon(goal.period)} {periodLabel(goal.period)}
            </span>
            {completed && (
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: 'rgba(253,203,110,0.15)', color: 'var(--yellow)', fontWeight: 600, border: '1px solid rgba(253,203,110,0.3)' }}>
                ✅ Достигнута
              </span>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {goal.title}
          </div>
        </div>
        <button
          onClick={() => onDelete(goal.id)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, marginLeft: 8, opacity: 0.5, transition: 'opacity 0.15s' }}
          title="Удалить"
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Кастомная цель */}
      {goal.targetType === 'custom' && goal.customNote && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5, fontStyle: 'italic', borderLeft: `2px solid ${color}`, paddingLeft: 10 }}>
          {goal.customNote}
        </div>
      )}

      {/* Progress bar */}
      {hasProgress && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Прогресс</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: completed ? 'var(--yellow)' : color, fontFamily: 'monospace' }}>
              {goal.current != null ? `${goal.current > 0 ? '+' : ''}${goal.current}${goal.unit ? ` ${goal.unit}` : ''}` : '—'}
              {' / '}
              {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ''}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, percent))}%`,
                background: completed
                  ? 'linear-gradient(90deg, var(--yellow), #FDCB6E)'
                  : `linear-gradient(90deg, ${color}, ${color}99)`,
                borderRadius: 4,
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{percent}%</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} />
          {goal.period === 'custom' && goal.endDate
            ? `до ${new Date(goal.endDate).toLocaleDateString('ru')}`
            : `Период: ${periodLabel(goal.period)}`
          }
        </div>
        {completed && goal.completedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--yellow)' }}>
            <CheckCircle2 size={11} />
            {new Date(goal.completedAt).toLocaleDateString('ru')}
          </div>
        )}
      </div>
    </div>
  );
}
