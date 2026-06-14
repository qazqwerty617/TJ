'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, TrendingUp, Brain, BarChart2,
  BookOpen, Settings, RefreshCw, LogOut, Menu, X, Wifi, Target
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import GlobalDisciplineTimer from '@/components/GlobalDisciplineTimer';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
  { href: '/trades', icon: TrendingUp, label: 'Сделки' },
  { href: '/analytics', icon: BarChart2, label: 'Аналитика' },
  { href: '/psychology', icon: Brain, label: 'Психология' },
  { href: '/goals', icon: Target, label: 'Цели' },
  { href: '/journal', icon: BookOpen, label: 'Дневник' },
  { href: '/settings', icon: Settings, label: 'Настройки' },
];

// Only bottom 5 tabs for mobile
const mobileNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Главная' },
  { href: '/trades', icon: TrendingUp, label: 'Сделки' },
  { href: '/goals', icon: Target, label: 'Цели' },
  { href: '/psychology', icon: Brain, label: 'Психо' },
  { href: '/journal', icon: BookOpen, label: 'Дневник' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, loadUser, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Hard safety: if isLoading doesn't resolve in 3s, force it off
    const timeout = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isLoading) {
        useAuthStore.setState({ isLoading: false });
      }
    }, 3000);

    loadUser().then(() => {
      clearTimeout(timeout);
      const { user } = useAuthStore.getState();
      if (!user) router.replace('/login');
    }).catch(() => {
      clearTimeout(timeout);
      router.replace('/login');
    });

    return () => clearTimeout(timeout);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/api/exchanges/sync');
      toast.success('Синхронизация запущена! Данные обновятся через минуту.');
    } catch {
      toast.error('Ошибка синхронизации');
    } finally {
      setTimeout(() => setSyncing(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0A0A0F', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 900, background: 'linear-gradient(135deg,#00D4AA,#00B894)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          📒 TJ
        </div>
        <RefreshCw size={20} className="spin" style={{ color: 'var(--green)' }} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <GlobalDisciplineTimer />
      <div className="app-container">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99, backdropFilter: 'blur(2px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1>📒 TJ</h1>
              <p>Торговый Журнал</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              className="mobile-only"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-group-label">Меню</div>
            {navItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-item ${pathname === href || pathname.startsWith(href + '/') ? 'active' : ''}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}

            <div className="nav-group-label" style={{ marginTop: 8 }}>Биржи</div>
            <button className="nav-item" onClick={handleSync} disabled={syncing}>
              <RefreshCw size={17} className={syncing ? 'spin' : ''} />
              {syncing ? 'Синхронизация...' : 'Обновить данные'}
            </button>
            <Link href="/settings/exchanges" className="nav-item">
              <Wifi size={17} />
              Подключить биржу
            </Link>
          </nav>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--green-dim)', border: '1px solid var(--border-active)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: 'var(--green)', fontWeight: 700
              }}>
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'T'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name || 'Трейдер'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm w-full" onClick={logout}>
              <LogOut size={14} /> Выйти
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content">
          {/* Mobile top header */}
          <div className="mobile-header">
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              <Menu size={22} />
            </button>
            <span style={{ fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#00D4AA,#00B894)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              📒 TJ Journal
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={handleSync}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                title="Синхронизация"
              >
                <RefreshCw size={18} className={syncing ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="mobile-bottom-nav">
          {mobileNavItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`bottom-nav-item ${pathname === href || pathname.startsWith(href + '/') ? 'active' : ''}`}
            >
              <Icon size={22} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
