import axios from 'axios';
import { Notify } from 'quasar';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para inyectar Token Bearer
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para errores globales y expiración de sesión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || 'Error en la solicitud';

    if (status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (status >= 400 && status < 500) {
      Notify.create({
        type: 'negative',
        message: Array.isArray(message) ? message.join(', ') : message,
        position: 'top-right',
      });
    }

    return Promise.reject(error);
  },
);

export default api;
