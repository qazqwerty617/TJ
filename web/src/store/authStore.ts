import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('tj_token', res.data.token);
    localStorage.setItem('tj_user', JSON.stringify(res.data.user));
    set({ user: res.data.user, token: res.data.token });
  },

  register: async (email, password, name) => {
    const res = await api.post('/api/auth/register', { email, password, name });
    localStorage.setItem('tj_token', res.data.token);
    localStorage.setItem('tj_user', JSON.stringify(res.data.user));
    set({ user: res.data.user, token: res.data.token });
  },

  logout: () => {
    localStorage.removeItem('tj_token');
    localStorage.removeItem('tj_user');
    set({ user: null, token: null });
    window.location.href = '/login';
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem('tj_token');
      const cachedUser = localStorage.getItem('tj_user');

      let userObj = null;
      if (cachedUser) {
        try { userObj = JSON.parse(cachedUser); } catch {}
      }

      if (!token) {
        set({ user: null, token: null, isLoading: false });
        return;
      }

      // If we have token and cached user, set it and resolve immediately (non-blocking)
      if (userObj) {
        set({ user: userObj, token, isLoading: false });
        
        // Verify in the background
        api.get('/api/auth/me')
          .then((res) => {
            localStorage.setItem('tj_user', JSON.stringify(res.data));
            set({ user: res.data });
          })
          .catch((err) => {
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
              localStorage.removeItem('tj_token');
              localStorage.removeItem('tj_user');
              set({ user: null, token: null });
            }
          });
        return;
      }

      // If we have token but NO cached user, wait for API verify but with a strict 2s timeout
      const verifyPromise = api.get('/api/auth/me');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2000)
      );

      const res = await Promise.race([verifyPromise, timeoutPromise]);
      localStorage.setItem('tj_user', JSON.stringify(res.data));
      set({ user: res.data, token, isLoading: false });
    } catch (err: any) {
      // Clear invalid token/cache and stop loading
      localStorage.removeItem('tj_token');
      localStorage.removeItem('tj_user');
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
