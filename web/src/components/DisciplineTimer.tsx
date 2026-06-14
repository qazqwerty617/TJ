'use client';

import { useState, useEffect } from 'react';
import { Clock, Bell, Trash2, Plus, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Reminder {
  id: string;
  message: string;
  intervalMinutes: number;
  isActive: boolean;
  timeLeftSeconds: number;
  isRinging: boolean;
}

const DEFAULT_REMINDERS: Reminder[] = [
  {
    id: 'default-1',
    message: 'Сделай перерыв на 5 минут и разомнись! Отдохни от графика.',
    intervalMinutes: 45,
    isActive: false,
    timeLeftSeconds: 45 * 60,
    isRinging: false,
  },
  {
    id: 'default-2',
    message: 'Торгуй строго по стратегии! Не совершай эмоциональных входов.',
    intervalMinutes: 9, // 0.15 часа
    isActive: false,
    timeLeftSeconds: 9 * 60,
    isRinging: false,
  }
];

export default function DisciplineTimer() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [newInterval, setNewInterval] = useState('15');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showAddForm, setShowAddForm] = useState(false);

  // Load reminders on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
      
      const saved = localStorage.getItem('discipline_reminders_v2');
      if (saved) {
        try {
          setReminders(JSON.parse(saved));
        } catch {
          setReminders(DEFAULT_REMINDERS);
        }
      } else {
        setReminders(DEFAULT_REMINDERS);
      }
    }
  }, []);

  // Tick every second to synchronize UI state with background LocalStorage ticking
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem('discipline_reminders_v2');
      if (saved) {
        try {
          setReminders(JSON.parse(saved));
        } catch {}
      }
    }, 1000);
    return () => clearInterval(syncInterval);
  }, []);

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') {
        toast.success('Уведомления включены!');
      } else {
        toast.error('Уведомления заблокированы в браузере.');
      }
    }
  };

  const addReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseFloat(newInterval);
    if (!newMsg.trim() || isNaN(mins) || mins <= 0) {
      toast.error('Введите корректный текст и интервал');
      return;
    }

    const newItem: Reminder = {
      id: Math.random().toString(36).substring(2, 9),
      message: newMsg,
      intervalMinutes: mins,
      isActive: true,
      timeLeftSeconds: Math.round(mins * 60),
      isRinging: false,
    };

    setReminders(prev => {
      const updated = [...prev, newItem];
      localStorage.setItem('discipline_reminders_v2', JSON.stringify(updated));
      return updated;
    });

    setNewMsg('');
    setShowAddForm(false);
    toast.success('Напоминание успешно добавлено!');
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem('discipline_reminders_v2', JSON.stringify(updated));
      return updated;
    });
    toast.success('Напоминание удалено');
  };

  const toggleActive = (id: string) => {
    setReminders(prev => {
      const updated = prev.map(r => {
        if (r.id === id) {
          const active = !r.isActive;
          return {
            ...r,
            isActive: active,
            timeLeftSeconds: Math.round(r.intervalMinutes * 60),
            isRinging: false,
          };
        }
        return r;
      });
      localStorage.setItem('discipline_reminders_v2', JSON.stringify(updated));
      return updated;
    });
  };

  const dismissAlert = (id: string) => {
    setReminders(prev => {
      const updated = prev.map(r => {
        if (r.id === id) {
          return {
            ...r,
            isRinging: false,
            timeLeftSeconds: Math.round(r.intervalMinutes * 60),
          };
        }
        return r;
      });
      localStorage.setItem('discipline_reminders_v2', JSON.stringify(updated));
      return updated;
    });
    toast.success('Напоминание сброшено, пошел новый круг!');
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={18} color="var(--green)" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>⏰ Менеджер Дисциплинарных Напоминаний</span>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          {permission !== 'granted' && (
            <button className="btn btn-secondary btn-sm" onClick={requestPermission} style={{ color: 'var(--yellow)', borderColor: 'rgba(255,165,2,0.2)' }}>
              <Bell size={13} /> Включить Push-уведомления
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={14} /> Создать напоминание
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
        Периодически напоминает о перерывах, отдыхе и стратегии, чтобы предотвратить тильт. Сигнал будет повторяться каждые 4 секунды, пока ты не нажмешь «Принял». Работает глобально на любой вкладке журнала.
      </p>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={addReminder} style={{ 
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', 
          borderRadius: 12, padding: 16, marginBottom: 20 
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Интервал (минуты)</label>
              <input 
                className="form-input" 
                type="number" 
                step="any"
                min="0.1" 
                value={newInterval} 
                onChange={e => setNewInterval(e.target.value)} 
                required
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                Например: <b>9</b> (для 0.15 ч) или <b>45</b> мин.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Сообщение / Правило стратегии</label>
              <input 
                className="form-input" 
                placeholder="Например: Сделай перерыв и отойди от терминала!" 
                value={newMsg} 
                onChange={e => setNewMsg(e.target.value)} 
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Сохранить напоминание
            </button>
          </div>
        </form>
      )}

      {/* Reminders List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {reminders.map(r => (
          <div key={r.id} style={{
            background: r.isRinging ? 'rgba(255,71,87,0.1)' : 'var(--bg-elevated)',
            border: `1px solid ${r.isRinging ? 'var(--red)' : r.isActive ? 'var(--border-active)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            transition: 'all 0.3s ease',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ 
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', 
                  color: r.isActive ? 'var(--green)' : 'var(--text-muted)',
                  background: r.isActive ? 'var(--green-dim)' : 'rgba(255,255,255,0.05)',
                  padding: '2px 8px', borderRadius: 4
                }}>
                  Раз в {r.intervalMinutes} мин
                </span>
                {r.isActive && !r.isRinging && (
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    ⏳ Осталось: {formatTime(r.timeLeftSeconds)}
                  </span>
                )}
              </div>
              <p style={{ 
                fontSize: 14, fontWeight: 500, 
                color: r.isRinging ? 'var(--red)' : 'var(--text-primary)',
                lineHeight: 1.4
              }}>
                {r.message}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {r.isRinging ? (
                <button 
                  className="btn btn-danger btn-sm pulse" 
                  onClick={() => dismissAlert(r.id)}
                  style={{ 
                    animationDuration: '1s',
                    boxShadow: '0 0 15px rgba(255,71,87,0.4)',
                    background: 'var(--red)',
                    color: '#fff',
                    fontWeight: 800
                  }}
                >
                  <CheckCircle size={14} /> Принял (Сбросить)
                </button>
              ) : (
                <button
                  onClick={() => toggleActive(r.id)}
                  style={{
                    background: r.isActive ? 'var(--green)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${r.isActive ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 20, padding: '4px 14px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    color: r.isActive ? '#000' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  {r.isActive ? 'Активен' : 'Выкл'}
                </button>
              )}

              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => deleteReminder(r.id)}
                style={{ padding: 8, color: 'var(--text-muted)', borderColor: 'transparent', background: 'transparent' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        {reminders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
            Напоминаний пока нет. Нажмите «Создать напоминание», чтобы настроить уведомления.
          </div>
        )}
      </div>
    </div>
  );
}
