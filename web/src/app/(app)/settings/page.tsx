'use client';

import Link from 'next/link';
import { Wifi, Brain, User, Bell } from 'lucide-react';

const settings = [
  {
    href: '/settings/exchanges',
    icon: Wifi,
    title: 'Биржи',
    description: 'Подключение Binance и других бирж через API',
    color: 'var(--yellow)',
  },
  {
    href: '/psychology',
    icon: Brain,
    title: 'Психология и правила',
    description: 'Риск-менеджмент, дневной лимит, утренний чек-ин',
    color: 'var(--green)',
  },
  {
    href: '/settings/profile',
    icon: User,
    title: 'Профиль',
    description: 'Имя, email и настройки аккаунта',
    color: 'var(--blue)',
  },
];

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>⚙️ Настройки</h2>
          <p>Управление аккаунтом и подключениями</p>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
          {settings.map(({ href, icon: Icon, title, description, color }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
