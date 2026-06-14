'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Reminder {
  id: string;
  message: string;
  intervalMinutes: number;
  isActive: boolean;
  timeLeftSeconds: number;
  isRinging: boolean;
}

export default function GlobalDisciplineTimer() {
  const soundCooldownRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [stopData, setStopData] = useState<{ shouldStop: boolean; warnings: string[] }>({
    shouldStop: false,
    warnings: [],
  });
  const [showStopOverlay, setShowStopOverlay] = useState(false);
  const lastDismissedRef = useRef<number>(0);

  // Background check for risk rules every 30 seconds
  useEffect(() => {
    const checkRisk = async () => {
      try {
        const token = localStorage.getItem('tj_token');
        if (!token) return;

        const res = await api.get('/api/psychology/check');
        const data = res.data;
        setStopData({ shouldStop: data.shouldStop, warnings: data.warnings || [] });
        
        if (data.shouldStop) {
          // If 5 minutes have passed since last dismiss, show it again
          const now = Date.now();
          if (now - lastDismissedRef.current > 5 * 60 * 1000) {
            setShowStopOverlay(true);
          }
        } else {
          setShowStopOverlay(false);
        }
      } catch (err) {
        console.error('Global risk check failed:', err);
      }
    };

    // Run immediately on mount
    checkRisk();

    const interval = setInterval(checkRisk, 30000);
    return () => clearInterval(interval);
  }, []);

  // Play beautiful, calming zen chord cascade using Web Audio API
  const playAlertSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, audioCtx.currentTime);
      filter.Q.setValueAtTime(1, audioCtx.currentTime);
      filter.connect(audioCtx.destination);

      // E Major Zen bell chord
      const frequencies = [164.81, 207.65, 246.94, 329.63, 415.30];
      const duration = 3.0; 

      frequencies.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.detune.setValueAtTime((index - 2) * 6, audioCtx.currentTime);

        osc.connect(gainNode);
        gainNode.connect(filter);

        const startTime = audioCtx.currentTime + index * 0.1;
        const attack = 0.3;
        const volume = 0.12 - index * 0.015;

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
      });
    } catch (err) {
      console.error('Global Audio synthesis failed:', err);
    }
  };

  const triggerNotification = (message: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Дисциплинарный Контроль 🧠', {
        body: message,
        icon: '/favicon.ico',
        requireInteraction: true,
      });
    }

    // Trigger visual toast popup globally
    toast(message, {
      duration: 12000,
      icon: '🧠',
      style: {
        background: '#1A1A2E',
        color: 'var(--yellow)',
        border: '1px solid rgba(255,165,2,0.3)',
        fontSize: '14px',
        fontWeight: 700,
      }
    });
  };

  useEffect(() => {
    const tick = setInterval(() => {
      if (typeof window === 'undefined') return;

      const saved = localStorage.getItem('discipline_reminders_v2');
      if (!saved) return;

      let reminders: Reminder[] = [];
      try {
        reminders = JSON.parse(saved);
      } catch {
        return;
      }

      let isAnyRinging = false;
      let hasChanges = false;

      const next = reminders.map(r => {
        if (!r.isActive) return r;

        if (r.isRinging) {
          isAnyRinging = true;
          return r;
        }

        const nextTime = r.timeLeftSeconds - 1;
        if (nextTime <= 0) {
          triggerNotification(r.message);
          isAnyRinging = true;
          hasChanges = true;
          return {
            ...r,
            timeLeftSeconds: Math.round(r.intervalMinutes * 60),
            isRinging: true,
          };
        }

        hasChanges = true;
        return { ...r, timeLeftSeconds: nextTime };
      });

      if (hasChanges || isAnyRinging) {
        localStorage.setItem('discipline_reminders_v2', JSON.stringify(next));
      }

      // Looping sound play if any is ringing
      if (isAnyRinging) {
        if (soundCooldownRef.current <= 0) {
          playAlertSound();
          soundCooldownRef.current = 4; // every 4 seconds
        } else {
          soundCooldownRef.current -= 1;
        }
      } else {
        soundCooldownRef.current = 0;
      }
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  if (showStopOverlay) {
    return (
      <div className="stop-overlay" style={{ pointerEvents: 'all' }}>
        <div className="stop-icon" style={{ fontSize: 80, animation: 'shake 0.5s ease-in-out infinite' }}>🛑</div>
        <h2 className="stop-title" style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginTop: 16, textAlign: 'center' }}>
          СТОП! СДЕЛКИ БЛОКИРОВАНЫ
        </h2>
        <div className="stop-subtitle" style={{ 
          fontSize: 15, color: '#ffeaec', background: 'rgba(0,0,0,0.3)', 
          padding: '16px 24px', borderRadius: 12, margin: '20px auto', 
          maxWidth: 500, whiteSpace: 'pre-line', border: '1px solid rgba(255,255,255,0.1)',
          lineHeight: 1.5, textAlign: 'center'
        }}>
          {stopData.warnings.join('\n') || 'Вы превысили свой дневной лимит риска.'}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.5, textAlign: 'center', padding: '0 20px' }}>
          Журнал заблокирован. Закрой торговый терминал, выключи мониторы и отойди от рабочего места. Твоя дисциплина важнее сиюминутных эмоций.
        </p>
        <button
          style={{ 
            padding: '12px 32px', background: 'rgba(0,0,0,0.4)', 
            border: '2px solid rgba(255,255,255,0.3)', borderRadius: 12, 
            color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 600,
            transition: 'all 0.2s'
          }}
          onClick={() => {
            setShowStopOverlay(false);
            lastDismissedRef.current = Date.now();
          }}
        >
          Я понял, закрыть предупреждение на 5 минут
        </button>
      </div>
    );
  }

  return null;
}
