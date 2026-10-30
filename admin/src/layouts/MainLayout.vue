<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Navbar Superior -->
    <q-header class="bg-white text-grey-9 shadow-1" :class="{ 'bg-dark text-white': $q.dark.isActive }">
      <q-toolbar class="q-px-md">
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title class="row items-center q-gutter-x-sm">
          <q-avatar size="32px" color="primary" text-color="white" icon="local_taxi" />
          <span class="text-weight-bolder text-subtitle1">UrbanRide Admin</span>
        </q-toolbar-title>

        <div class="row items-center q-gutter-x-sm">
          <!-- Dark mode switch -->
          <q-btn
            flat
            round
            dense
            :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
            @click="$q.dark.toggle()"
          >
            <q-tooltip>{{ $q.dark.isActive ? 'Modo Claro' : 'Modo Oscuro' }}</q-tooltip>
          </q-btn>

          <!-- Perfil de usuario y Logout -->
          <q-btn flat no-caps class="q-px-sm">
            <q-avatar size="32px" color="primary" text-color="white" class="q-mr-xs">
              {{ authStore.user?.name?.charAt(0) || 'A' }}
            </q-avatar>
            <span class="text-weight-bold text-body2">{{ authStore.user?.name || 'Administrador' }}</span>

            <q-menu>
              <q-list style="min-width: 140px">
                <q-item clickable v-close-popup @click="handleLogout">
                  <q-item-section avatar>
                    <q-icon name="logout" color="negative" />
                  </q-item-section>
                  <q-item-section class="text-negative">Cerrar sesión</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <!-- Barra lateral de navegación -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="250"
      class="bg-grey-1"
      :class="{ 'bg-dark': $q.dark.isActive }"
    >
      <div class="q-pa-md text-center">
        <div class="text-subtitle2 text-weight-bold">Control Central</div>
        <div class="text-caption text-grey-7">Gestión de Transporte</div>
      </div>

      <q-separator />

      <q-list class="q-py-sm">
        <q-item clickable v-ripple to="/" exact active-class="text-primary text-weight-bold bg-blue-1">
          <q-item-section avatar>
            <q-icon name="dashboard" />
          </q-item-section>
          <q-item-section>Dashboard</q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/live-map" active-class="text-primary text-weight-bold bg-blue-1">
          <q-item-section avatar>
            <q-icon name="satellite_alt" />
          </q-item-section>
          <q-item-section>Radar en Vivo</q-item-section>
          <q-item-section side>
            <q-badge color="positive" rounded />
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/drivers" active-class="text-primary text-weight-bold bg-blue-1">
          <q-item-section avatar>
            <q-icon name="badge" />
          </q-item-section>
          <q-item-section>Conductores</q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/fare-settings" active-class="text-primary text-weight-bold bg-blue-1">
          <q-item-section avatar>
            <q-icon name="tune" />
          </q-item-section>
          <q-item-section>Tarifas y Modelo</q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/trips" active-class="text-primary text-weight-bold bg-blue-1">
          <q-item-section avatar>
            <q-icon name="receipt_long" />
          </q-item-section>
          <q-item-section>Historial de Viajes</q-item-section>
        </q-item>
      </q-list>

      <div class="absolute-bottom q-pa-md text-caption text-grey-6 text-center">
        v1.0.0 · Uber & InDrive Clone
      </div>
    </q-drawer>

    <!-- Contenido dinámico -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const authStore = useAuthStore();
const leftDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>
