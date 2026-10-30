<template>
  <div class="login-wrapper flex flex-center">
    <div class="login-card q-pa-xl glass-card text-center">
      <div class="q-mb-md">
        <q-avatar size="72px" color="primary" text-color="white" icon="local_taxi" class="shadow-5" />
      </div>

      <h4 class="text-h4 text-weight-bolder q-my-none">Panel Administrador</h4>
      <p class="text-grey-7 q-mt-xs q-mb-lg">Transporte Uber / InDrive Management</p>

      <q-form @submit.prevent="handleLogin" class="q-gutter-md">
        <q-input
          v-model="phone"
          label="Teléfono del Admin"
          placeholder="Ej: 70000000"
          outlined
          rounded
          dense
          lazy-rules
          :rules="[(val) => !!val || 'El teléfono es obligatorio']"
        >
          <template #prepend>
            <q-icon name="phone" color="primary" />
          </template>
        </q-input>

        <q-input
          v-model="password"
          label="Contraseña"
          type="password"
          outlined
          rounded
          dense
          lazy-rules
          :rules="[(val) => !!val || 'La contraseña es obligatoria']"
        >
          <template #prepend>
            <q-icon name="lock" color="primary" />
          </template>
        </q-input>

        <div class="q-pt-sm">
          <q-btn
            label="Ingresar al Panel"
            type="submit"
            color="primary"
            rounded
            unelevated
            class="full-width q-py-sm text-weight-bold"
            :loading="authStore.loading"
          />
        </div>
      </q-form>

      <div class="q-mt-lg text-caption text-grey-6">
        Credenciales iniciales: <strong>70000000</strong> / <strong>admin123</strong>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useAuthStore } from '../stores/auth.js';

const $q = useQuasar();
const router = useRouter();
const authStore = useAuthStore();

const phone = ref('70000000');
const password = ref('admin123');

async function handleLogin() {
  try {
    await authStore.login(phone.value, password.value);
    $q.notify({
      type: 'positive',
      message: 'Bienvenido al panel de control',
      position: 'top-right',
    });
    router.push('/');
  } catch (err: any) {
    $q.notify({
      type: 'negative',
      message: err.message || 'Error al iniciar sesión',
      position: 'top-right',
    });
  }
}
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  background: radial-gradient(circle at 10% 20%, rgba(0, 102, 255, 0.08) 0%, rgba(240, 244, 255, 0.95) 90%);
}
.body--dark .login-wrapper {
  background: radial-gradient(circle at 10% 20%, rgba(0, 50, 150, 0.2) 0%, rgba(15, 18, 25, 0.98) 90%);
}
.login-card {
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.07);
}
</style>
