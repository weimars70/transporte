<template>
  <q-page class="q-pa-lg">
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="text-h4 text-weight-bolder q-my-none">Gestión de Conductores</h4>
        <div class="text-grey-7 q-mt-xs">Aprobación de licencias, vehículos y control de suspensiones</div>
      </div>

      <div class="row q-gutter-sm">
        <q-btn-toggle
          v-model="currentFilter"
          rounded
          unelevated
          toggle-color="primary"
          color="grey-3"
          text-color="grey-8"
          :options="[
            { label: 'Todos', value: '' },
            { label: 'Pendientes', value: 'PENDING' },
            { label: 'Aprobados', value: 'APPROVED' },
            { label: 'Suspendidos', value: 'SUSPENDED' },
          ]"
          @update:model-value="loadDrivers"
        />
        <q-btn flat round icon="refresh" :loading="loading" @click="loadDrivers" />
      </div>
    </div>

    <!-- Tabla de Conductores -->
    <q-card class="glass-card q-pa-md">
      <q-table
        :rows="drivers"
        :columns="columns"
        row-key="id"
        flat
        :loading="loading"
        no-data-label="No hay conductores en esta sección"
      >
        <template #body-cell-user="props">
          <q-td :props="props">
            <div class="row items-center q-gutter-x-sm">
              <q-avatar size="32px" color="primary" text-color="white">
                {{ props.row.user?.name?.charAt(0) || 'C' }}
              </q-avatar>
              <div>
                <div class="text-weight-bold">{{ props.row.user?.name }}</div>
                <div class="text-caption text-grey-7">{{ props.row.user?.phone }}</div>
              </div>
            </div>
          </q-td>
        </template>

        <template #body-cell-vehicle="props">
          <q-td :props="props">
            <div v-if="props.row.vehicle">
              <q-badge :color="props.row.vehicle.type === 'CAR' ? 'blue' : 'purple'" class="q-mr-xs">
                {{ props.row.vehicle.type }}
              </q-badge>
              <strong>{{ props.row.vehicle.brand }} {{ props.row.vehicle.model }}</strong>
              <div class="text-caption text-grey-7">
                Placa: <span class="text-weight-bold">{{ props.row.vehicle.plate }}</span> ({{ props.row.vehicle.color }})
              </div>
            </div>
            <span v-else class="text-grey-6">Sin vehículo</span>
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props">
            <q-chip
              dense
              size="sm"
              :color="statusColor(props.value)"
              text-color="white"
              class="text-weight-bold"
            >
              {{ props.value }}
            </q-chip>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="q-gutter-xs text-right">
            <q-btn
              v-if="props.row.status !== 'APPROVED'"
              label="Aprobar"
              color="positive"
              dense
              unelevated
              size="sm"
              icon="check_circle"
              class="q-px-sm"
              @click="updateStatus(props.row.id, 'APPROVED')"
            />
            <q-btn
              v-if="props.row.status === 'PENDING'"
              label="Rechazar"
              color="negative"
              flat
              dense
              size="sm"
              icon="cancel"
              @click="updateStatus(props.row.id, 'REJECTED')"
            />
            <q-btn
              v-if="props.row.status === 'APPROVED'"
              label="Suspender"
              color="warning"
              flat
              dense
              size="sm"
              icon="block"
              @click="updateStatus(props.row.id, 'SUSPENDED')"
            />
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../services/api.js';

const $q = useQuasar();
const loading = ref(false);
const drivers = ref<any[]>([]);
const currentFilter = ref('');

const columns = [
  { name: 'user', label: 'Conductor', field: 'user', align: 'left' as const },
  { name: 'license', label: 'Licencia', field: 'licenseNumber', align: 'left' as const },
  { name: 'vehicle', label: 'Vehículo', field: 'vehicle', align: 'left' as const },
  { name: 'trips', label: 'Viajes', field: 'totalTrips', align: 'center' as const },
  { name: 'rating', label: 'Calificación', field: (row: any) => row.user?.rating?.toFixed(1) || '5.0', align: 'center' as const },
  { name: 'status', label: 'Estado', field: 'status', align: 'center' as const },
  { name: 'actions', label: 'Acciones', field: 'actions', align: 'right' as const },
];

function statusColor(status: string) {
  switch (status) {
    case 'APPROVED': return 'positive';
    case 'PENDING': return 'warning';
    case 'SUSPENDED': return 'orange-9';
    case 'REJECTED': return 'negative';
    default: return 'grey';
  }
}

async function loadDrivers() {
  loading.value = true;
  try {
    const url = currentFilter.value
      ? `/admin/drivers?status=${currentFilter.value}`
      : '/admin/drivers';
    const { data } = await api.get(url);
    drivers.value = data.items;
  } catch (err) {
    console.error('Error cargando conductores:', err);
  } finally {
    loading.value = false;
  }
}

async function updateStatus(driverId: string, status: string) {
  try {
    await api.patch(`/admin/drivers/${driverId}/status`, { status });
    $q.notify({
      type: 'positive',
      message: `Conductor actualizado a: ${status}`,
      position: 'top-right',
    });
    loadDrivers();
  } catch (err: any) {
    $q.notify({
      type: 'negative',
      message: err.message || 'Error al actualizar estado',
      position: 'top-right',
    });
  }
}

onMounted(() => {
  loadDrivers();
});
</script>
