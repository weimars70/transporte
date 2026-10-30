import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('@/pages/DashboardPage.vue') },
      { path: 'live-map', component: () => import('@/pages/LiveMapPage.vue') },
      { path: 'drivers', component: () => import('@/pages/DriversPage.vue') },
      { path: 'fare-settings', component: () => import('@/pages/FareSettingsPage.vue') },
      { path: 'trips', component: () => import('@/pages/TripsPage.vue') },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue'),
  },
];

export default routes;
