'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const { isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    // Check token directly — fast path, no extra API call
    const token = localStorage.getItem('tj_token');
    const cachedUser = localStorage.getItem('tj_user');

    if (token && cachedUser) {
      router.replace('/dashboard');
      return;
    }

    if (!token) {
      router.replace('/login');
      return;
    }

    // Has token but no cache — verify once
    loadUser().then(() => {
      const { user } = useAuthStore.getState();
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }).catch(() => {
      router.replace('/login');
    });
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0A0A0F' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 900, background: 'linear-gradient(135deg, #00D4AA, #00B894)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Trading Journal
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: 8, fontSize: 14 }}>Загрузка...</div>
      </div>
    </div>
  );
}
