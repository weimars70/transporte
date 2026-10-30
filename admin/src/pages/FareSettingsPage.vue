<template>
  <q-page class="q-pa-lg">
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="text-h4 text-weight-bolder q-my-none">Configuración de Tarifas y Modelo</h4>
        <div class="text-grey-7 q-mt-xs">
          Reglas de cálculo (estilo Uber) y parámetros de negociación/subasta (estilo InDrive)
        </div>
      </div>
      <q-btn flat round icon="refresh" :loading="loading" @click="loadSettings" />
    </div>

    <div class="row q-col-gutter-lg">
      <div v-for="setting in settings" :key="setting.vehicleType" class="col-12 col-md-6">
        <q-card class="glass-card q-pa-lg">
          <div class="row items-center justify-between q-mb-md">
            <div class="row items-center q-gutter-x-sm">
              <q-avatar
                size="44px"
                :color="setting.vehicleType === 'CAR' ? 'primary' : 'purple'"
                text-color="white"
                :icon="setting.vehicleType === 'CAR' ? 'directions_car' : 'two_wheeler'"
              />
              <div>
                <div class="text-h6 text-weight-bold">
                  {{ setting.vehicleType === 'CAR' ? 'Automóvil Estándar' : 'Motocicleta' }}
                </div>
                <div class="text-caption text-grey-7">Moneda: {{ setting.currency }}</div>
              </div>
            </div>

            <q-badge
              :color="setting.biddingEnabled ? 'positive' : 'grey-7'"
              class="q-pa-xs text-weight-bold"
            >
              {{ setting.biddingEnabled ? 'Subasta InDrive Activada' : 'Tarifa Fija Exclusiva' }}
            </q-badge>
          </div>

          <q-separator class="q-mb-md" />

          <q-form @submit.prevent="saveSetting(setting)" class="q-gutter-y-sm">
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input
                  v-model.number="setting.baseFare"
                  type="number"
                  step="0.1"
                  label="Tarifa Base ($)"
                  outlined
                  dense
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model.number="setting.minimumFare"
                  type="number"
                  step="0.1"
                  label="Tarifa Mínima ($)"
                  outlined
                  dense
                />
              </div>
            </div>

            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input
                  v-model.number="setting.perKm"
                  type="number"
                  step="0.05"
                  label="Precio por Km ($)"
                  outlined
                  dense
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model.number="setting.perMinute"
                  type="number"
                  step="0.05"
                  label="Precio por Minuto ($)"
                  outlined
                  dense
                />
              </div>
            </div>

            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input
                  v-model.number="setting.bookingFee"
                  type="number"
                  step="0.1"
                  label="Cargo por Servicio ($)"
                  outlined
                  dense
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model.number="setting.commissionPct"
                  type="number"
                  min="0"
                  max="50"
                  label="Comisión Plataforma (%)"
                  outlined
                  dense
                />
              </div>
            </div>

            <!-- Parámetros de Ofertas InDrive -->
            <div class="q-mt-md q-pa-sm rounded-borders bg-grey-1 text-grey-9">
              <div class="row items-center justify-between">
                <div>
                  <div class="text-subtitle2 text-weight-bold">Permitir Ofertas del Pasajero</div>
                  <div class="text-caption text-grey-7">El pasajero puede proponer su propio precio</div>
                </div>
                <q-toggle v-model="setting.biddingEnabled" color="primary" />
              </div>

              <div v-if="setting.biddingEnabled" class="q-mt-sm">
                <q-slider
                  v-model="setting.minBidPercent"
                  :min="40"
                  :max="100"
                  label
                  :label-value="`Oferta mínima permitida: ${setting.minBidPercent}% de la estimada`"
                  color="primary"
                />
                <div class="text-caption text-grey-7">
                  Límite inferior para evitar ofertas irrisorias: {{ setting.minBidPercent }}%
                </div>
              </div>
            </div>

            <div class="text-right q-mt-md">
              <q-btn
                label="Guardar Cambios"
                type="submit"
                color="primary"
                unelevated
                rounded
                icon="save"
                :loading="saving"
              />
            </div>
          </q-form>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../services/api.js';

const $q = useQuasar();
const loading = ref(false);
const saving = ref(false);
const settings = ref<any[]>([]);

async function loadSettings() {
  loading.value = true;
  try {
    const { data } = await api.get('/admin/fare-settings');
    settings.value = data;
  } catch (err) {
    console.error('Error cargando tarifas:', err);
  } finally {
    loading.value = false;
  }
}

async function saveSetting(item: any) {
  saving.value = true;
  try {
    await api.put(`/admin/fare-settings/${item.vehicleType}`, {
      baseFare: Number(item.baseFare),
      perKm: Number(item.perKm),
      perMinute: Number(item.perMinute),
      minimumFare: Number(item.minimumFare),
      bookingFee: Number(item.bookingFee),
      biddingEnabled: item.biddingEnabled,
      minBidPercent: Number(item.minBidPercent),
      commissionPct: Number(item.commissionPct),
    });

    $q.notify({
      type: 'positive',
      message: `Tarifas para ${item.vehicleType} actualizadas correctamente`,
      position: 'top-right',
    });
  } catch (err: any) {
    $q.notify({
      type: 'negative',
      message: err.message || 'Error al guardar tarifas',
      position: 'top-right',
    });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadSettings();
});
</script>
