import { defineRouter } from '#q-app';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';

export default defineRouter(() => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE),
  });

  // Guard de autenticación para administradores
  Router.beforeEach((to, _from, next) => {
    const token = localStorage.getItem('admin_token');
    const isPublic = to.matched.some((record) => record.meta?.public);

    if (!token && !isPublic) {
      next('/login');
    } else if (token && to.path === '/login') {
      next('/');
    } else {
      next();
    }
  });

  return Router;
});
