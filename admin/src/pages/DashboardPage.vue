<template>
  <q-page class="q-pa-lg">
    <!-- Header con Saludo y botón de refrescar -->
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="text-h4 text-weight-bolder q-my-none">Dashboard Operativo</h4>
        <div class="text-grey-7 q-mt-xs">Monitoreo en tiempo real de viajes, conductores y facturación</div>
      </div>
      <div class="q-gutter-sm">
        <q-btn
          icon="refresh"
          label="Actualizar"
          outline
          color="primary"
          rounded
          :loading="loading"
          @click="loadData"
        />
        <q-btn
          icon="map"
          label="Mapa en Vivo"
          color="primary"
          unelevated
          rounded
          to="/live-map"
        />
      </div>
    </div>

    <!-- Tarjetas de Métricas (KPIs) -->
    <div class="row q-col-gutter-md q-mb-xl">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card glass-card q-pa-md">
          <div class="row items-center justify-between">
            <div>
              <div class="text-caption text-weight-medium text-grey-7">INGRESOS HOY</div>
              <div class="text-h4 text-weight-bolder text-primary q-mt-xs">
                ${{ stats.revenue.today.toFixed(2) }}
              </div>
            </div>
            <q-avatar size="48px" color="blue-1" text-color="primary" icon="payments" />
          </div>
          <div class="text-caption text-grey-6 q-mt-sm">Tarifas de viajes finalizados</div>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card glass-card q-pa-md">
          <div class="row items-center justify-between">
            <div>
              <div class="text-caption text-weight-medium text-grey-7">VIAJES HOY</div>
              <div class="text-h4 text-weight-bolder text-secondary q-mt-xs">
                {{ stats.trips.today }}
              </div>
            </div>
            <q-avatar size="48px" color="teal-1" text-color="secondary" icon="route" />
          </div>
          <div class="text-caption text-grey-6 q-mt-sm">Total acumulado: {{ stats.trips.total }}</div>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card glass-card q-pa-md">
          <div class="row items-center justify-between">
            <div>
              <div class="text-caption text-weight-medium text-grey-7">CONDUCTORES ONLINE</div>
              <div class="text-h4 text-weight-bolder text-positive q-mt-xs">
                {{ stats.drivers.onlineNow }}
              </div>
            </div>
            <q-avatar size="48px" color="green-1" text-color="positive" icon="directions_car" />
          </div>
          <div class="text-caption text-grey-6 q-mt-sm">{{ stats.drivers.busyNow }} en viaje ahora</div>
        </q-card>
      </div>

      <div class="col-12 col-sm-6 col-md-3">
        <q-card class="stat-card glass-card q-pa-md">
          <div class="row items-center justify-between">
            <div>
              <div class="text-caption text-weight-medium text-grey-7">POR APROBAR</div>
              <div class="text-h4 text-weight-bolder text-warning q-mt-xs">
                {{ stats.drivers.pendingApproval }}
              </div>
            </div>
            <q-avatar size="48px" color="amber-1" text-color="warning" icon="pending_actions" />
          </div>
          <div class="text-caption text-grey-6 q-mt-sm">
            <router-link to="/drivers" class="text-primary text-weight-bold" style="text-decoration: none">
              Revisar registros &rarr;
            </router-link>
          </div>
        </q-card>
      </div>
    </div>

    <!-- Sección de Últimos Viajes en Curso -->
    <q-card class="glass-card q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6 text-weight-bold">Actividad Reciente</div>
        <q-btn flat dense rounded color="primary" label="Ver todos" to="/trips" />
      </div>

      <q-table
        :rows="recentTrips"
        :columns="columns"
        row-key="id"
        flat
        :loading="loading"
        no-data-label="No hay viajes registrados aún"
      >
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

        <template #body-cell-fare="props">
          <q-td :props="props" class="text-weight-bolder">
            ${{ (props.row.finalFare ?? props.row.estimatedFare).toFixed(2) }}
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { api } from '../services/api.js';
import { getAdminSocket } from '../services/socket.js';

const loading = ref(false);
const stats = ref({
  trips: { total: 0, today: 0, completed: 0 },
  drivers: { total: 0, pendingApproval: 0, onlineNow: 0, busyNow: 0 },
  passengers: { total: 0 },
  revenue: { today: 0 },
});

const recentTrips = ref<any[]>([]);

const columns = [
  { name: 'passenger', label: 'Pasajero', field: (row: any) => row.passenger?.name || 'N/A', align: 'left' as const },
  { name: 'driver', label: 'Conductor', field: (row: any) => row.driver?.user?.name || 'Buscando...', align: 'left' as const },
  { name: 'origin', label: 'Origen', field: 'originAddress', align: 'left' as const },
  { name: 'dest', label: 'Destino', field: 'destAddress', align: 'left' as const },
  { name: 'mode', label: 'Tipo', field: 'pricingMode', align: 'center' as const },
  { name: 'fare', label: 'Tarifa', field: 'finalFare', align: 'right' as const },
  { name: 'status', label: 'Estado', field: 'status', align: 'center' as const },
];

function statusColor(status: string) {
  switch (status) {
    case 'COMPLETED': return 'positive';
    case 'IN_PROGRESS': return 'primary';
    case 'ACCEPTED':
    case 'ARRIVED': return 'info';
    case 'REQUESTED': return 'warning';
    case 'CANCELLED': return 'negative';
    default: return 'grey';
  }
}

async function loadData() {
  loading.value = true;
  try {
    const [dashRes, tripsRes] = await Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/trips?pageSize=8'),
    ]);
    stats.value = dashRes.data;
    recentTrips.value = tripsRes.data.items;
  } catch (err) {
    console.error('Error al cargar dashboard:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
  const socket = getAdminSocket();
  socket.on('admin:trip', (trip: any) => {
    // Añadir o actualizar en la lista
    const idx = recentTrips.value.findIndex((t) => t.id === trip.id);
    if (idx >= 0) {
      recentTrips.value[idx] = trip;
    } else {
      recentTrips.value.unshift(trip);
      if (recentTrips.value.length > 8) recentTrips.value.pop();
    }
    stats.value.trips.today += 1;
  });
});

onUnmounted(() => {
  const socket = getAdminSocket();
  socket.off('admin:trip');
});
</script>
