import { defineStore } from 'pinia';
import { api } from '../services/api.js';
import { disconnectAdminSocket } from '../services/socket.js';

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'ADMIN' | 'DRIVER' | 'PASSENGER';
  avatarUrl?: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('admin_token') || '',
    user: JSON.parse(localStorage.getItem('admin_user') || 'null') as AdminUser | null,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && state.user?.role === 'ADMIN',
  },

  actions: {
    async login(phone: string, password: string) {
      this.loading = true;
      try {
        const { data } = await api.post('/auth/login', { phone, password });

        if (data.user.role !== 'ADMIN') {
          throw new Error('Solo los administradores pueden acceder a este panel');
        }

        this.token = data.accessToken;
        this.user = data.user;

        localStorage.setItem('admin_token', this.token);
        localStorage.setItem('admin_user', JSON.stringify(this.user));

        return data;
      } finally {
        this.loading = false;
      }
    },

    async fetchMe() {
      if (!this.token) return;
      try {
        const { data } = await api.get('/auth/me');
        this.user = data;
        localStorage.setItem('admin_user', JSON.stringify(this.user));
      } catch {
        this.logout();
      }
    },

    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      disconnectAdminSocket();
    },
  },
});
