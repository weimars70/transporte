<template>
  <q-page class="q-pa-lg">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="text-h4 text-weight-bolder q-my-none">Historial Global de Viajes</h4>
        <div class="text-grey-7 q-mt-xs">Control de viajes solicitados, asignaciones manuales y monitoreo en vivo</div>
      </div>

      <div class="row q-gutter-sm items-center">
        <q-btn
          unelevated
          rounded
          color="primary"
          icon="add_circle"
          label="Programar Servicio"
          class="text-weight-bold q-px-md"
          @click="openNewTripDialog"
        />

        <q-select
          v-model="selectedStatus"
          dense
          outlined
          rounded
          emit-value
          map-options
          :options="[
            { label: 'Todos los estados', value: '' },
            { label: 'Solicitados (Pendientes)', value: 'REQUESTED' },
            { label: 'Aceptados / En camino', value: 'ACCEPTED' },
            { label: 'En curso', value: 'IN_PROGRESS' },
            { label: 'Completados', value: 'COMPLETED' },
            { label: 'Cancelados', value: 'CANCELLED' },
          ]"
          @update:model-value="loadTrips"
          style="min-width: 200px"
        />
        <q-btn flat round icon="refresh" :loading="loading" @click="loadTrips">
          <q-tooltip>Recargar viajes</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Tabla de Viajes -->
    <q-card class="glass-card q-pa-md shadow-2">
      <q-table
        :rows="trips"
        :columns="columns"
        row-key="id"
        flat
        :loading="loading"
        v-model:pagination="pagination"
        @request="onRequest"
      >
        <template #body-cell-id="props">
          <q-td :props="props" class="text-caption text-grey-7 font-mono">
            #{{ props.value.slice(0, 8) }}
          </q-td>
        </template>

        <template #body-cell-passenger="props">
          <q-td :props="props">
            <div class="text-weight-bold">{{ props.row.passenger?.name || 'Anónimo' }}</div>
            <div class="text-caption text-grey-7">
              <q-icon name="phone" size="12px" class="q-mr-xs" />{{ props.row.passenger?.phone }}
            </div>
          </q-td>
        </template>

        <template #body-cell-driver="props">
          <q-td :props="props">
            <div v-if="props.row.driver">
              <div class="text-weight-bold text-primary">{{ props.row.driver?.user?.name }}</div>
              <div class="text-caption text-grey-7">
                {{ props.row.driver?.vehicle?.brand }} {{ props.row.driver?.vehicle?.model }} ({{ props.row.driver?.vehicle?.plate }})
              </div>
            </div>
            <span v-else class="text-grey-6 italic">Sin asignar</span>
          </q-td>
        </template>

        <template #body-cell-route="props">
          <q-td :props="props">
            <div class="ellipsis" style="max-width: 240px">
              <q-icon name="trip_origin" size="14px" color="primary" class="q-mr-xs" />
              <span>{{ props.row.originAddress }}</span>
            </div>
            <div class="ellipsis text-grey-7 q-mt-xs" style="max-width: 240px">
              <q-icon name="location_on" size="14px" color="negative" class="q-mr-xs" />
              <span>{{ props.row.destAddress }}</span>
            </div>
          </q-td>
        </template>

        <template #body-cell-fare="props">
          <q-td :props="props" class="text-right">
            <div class="text-weight-bolder text-primary text-subtitle1">
              ${{ Number(props.row.finalFare ?? props.row.estimatedFare ?? 0).toFixed(2) }}
            </div>
            <div class="text-caption text-grey-6">
              {{ ((props.row.distanceMeters || 0) / 1000).toFixed(1) }} km · {{ Math.round((props.row.durationSeconds || 0) / 60) }} min
            </div>
          </q-td>
        </template>

        <template #body-cell-status="props">
          <q-td :props="props" class="text-center">
            <q-chip
              dense
              size="sm"
              :color="statusColor(props.value)"
              text-color="white"
              class="text-weight-bold q-px-sm"
            >
              {{ props.value }}
            </q-chip>
          </q-td>
        </template>

        <!-- Acciones: Botón de asignación manual -->
        <template #body-cell-actions="props">
          <q-td :props="props" class="text-center">
            <q-btn
              v-if="props.row.status === 'REQUESTED' || (!props.row.driver && props.row.status !== 'CANCELLED' && props.row.status !== 'COMPLETED')"
              unelevated
              rounded
              dense
              size="sm"
              color="accent"
              text-color="white"
              icon="person_add"
              label="Asignar"
              class="q-px-sm text-weight-bold"
              @click="openAssignDialog(props.row)"
            >
              <q-tooltip>Asignar conductor manualmente</q-tooltip>
            </q-btn>
            <div v-else-if="props.row.driver" class="text-caption text-positive text-weight-bold">
              <q-icon name="check_circle" size="16px" /> Asignado
            </div>
            <span v-else class="text-grey-5">-</span>
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- Modal: Programar / Crear Nuevo Servicio -->
    <q-dialog v-model="newTripDialog" persistent>
      <q-card style="min-width: 580px; max-width: 95vw; border-radius: 16px;">
        <q-card-section class="row items-center q-pb-none">
          <div class="row items-center">
            <q-avatar icon="local_taxi" color="primary" text-color="dark" size="md" class="q-mr-sm" />
            <div>
              <div class="text-h6 text-weight-bolder">Programar Nuevo Servicio</div>
              <div class="text-caption text-grey-7">Genera una solicitud y asígnala al instante o déjala para conductores</div>
            </div>
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-md">
          <q-form @submit.prevent="submitNewTrip" class="q-gutter-y-md">
            <!-- Datos del Pasajero -->
            <div class="text-subtitle2 text-weight-bold text-primary">1. Datos del Pasajero</div>
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="newTripForm.passengerName"
                  label="Nombre del Pasajero *"
                  outlined
                  dense
                  :rules="[val => !!val || 'El nombre es obligatorio']"
                />
              </div>
              <div class="col-12 col-sm-6">
                <q-input
                  v-model="newTripForm.passengerPhone"
                  label="Teléfono del Pasajero *"
                  outlined
                  dense
                  placeholder="ej. +59170012345"
                  :rules="[val => !!val || 'El teléfono es obligatorio']"
                />
              </div>
            </div>

            <!-- Datos de Origen -->
            <div class="text-subtitle2 text-weight-bold text-primary q-mt-md">2. Punto de Recogida (Origen)</div>
            <q-input
              v-model="newTripForm.originAddress"
              label="Dirección de Origen *"
              placeholder="Ej: Av. San Martín y Calle 4"
              outlined
              dense
              :rules="[val => !!val || 'Dirección de origen obligatoria']"
            >
              <template #prepend>
                <q-icon name="trip_origin" color="primary" />
              </template>
            </q-input>

            <!-- Datos de Destino -->
            <div class="text-subtitle2 text-weight-bold text-primary q-mt-md">3. Punto de Destino</div>
            <q-input
              v-model="newTripForm.destAddress"
              label="Dirección de Destino *"
              placeholder="Ej: Ventura Mall, 4to Anillo"
              outlined
              dense
              :rules="[val => !!val || 'Dirección de destino obligatoria']"
            >
              <template #prepend>
                <q-icon name="location_on" color="negative" />
              </template>
            </q-input>

            <!-- Configuración del Servicio -->
            <div class="text-subtitle2 text-weight-bold text-primary q-mt-md">4. Configuración del Servicio</div>
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-sm-4">
                <q-select
                  v-model="newTripForm.vehicleType"
                  :options="[
                    { label: 'Auto (CAR)', value: 'CAR' },
                    { label: 'Moto (MOTO)', value: 'MOTO' },
                  ]"
                  emit-value
                  map-options
                  label="Tipo de Vehículo"
                  outlined
                  dense
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-select
                  v-model="newTripForm.payment"
                  :options="[
                    { label: 'Efectivo', value: 'CASH' },
                    { label: 'Tarjeta', value: 'CARD' },
                    { label: 'Billetera', value: 'WALLET' },
                  ]"
                  emit-value
                  map-options
                  label="Método de Pago"
                  outlined
                  dense
                />
              </div>
              <div class="col-12 col-sm-4">
                <q-input
                  v-model.number="newTripForm.fare"
                  type="number"
                  step="0.5"
                  label="Tarifa Fija ($)"
                  outlined
                  dense
                  hint="Opcional: cálculo auto"
                />
              </div>
            </div>

            <!-- Asignación Inmediata de Conductor -->
            <div class="text-subtitle2 text-weight-bold text-primary q-mt-md">5. Asignar Conductor de Inmediato (Opcional)</div>
            <q-select
              v-model="newTripForm.driverId"
              :options="driverOptions"
              emit-value
              map-options
              label="Seleccionar Conductor"
              outlined
              dense
              hint="Si seleccionas uno, el viaje se asignará directamente a su teléfono"
            />

            <!-- Botones de Acción -->
            <div class="row justify-end q-gutter-sm q-mt-lg">
              <q-btn flat label="Cancelar" v-close-popup :disable="submittingTrip" />
              <q-btn
                unelevated
                color="primary"
                label="Crear y Despachar Servicio"
                type="submit"
                :loading="submittingTrip"
                class="text-weight-bold q-px-lg"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Modal: Asignar Conductor Manualmente a un viaje existente -->
    <q-dialog v-model="assignDialog" persistent>
      <q-card style="min-width: 440px; border-radius: 16px;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6 text-weight-bolder">Asignar Conductor</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-md" v-if="selectedTrip">
          <div class="bg-grey-9 text-grey-2 q-pa-sm rounded-borders q-mb-md">
            <div class="row justify-between">
              <span class="text-caption text-grey-4">Pasajero:</span>
              <span class="text-weight-bold">{{ selectedTrip.passenger?.name }}</span>
            </div>
            <div class="row justify-between q-mt-xs">
              <span class="text-caption text-grey-4">Origen:</span>
              <span class="ellipsis" style="max-width: 250px">{{ selectedTrip.originAddress }}</span>
            </div>
            <div class="row justify-between q-mt-xs">
              <span class="text-caption text-grey-4">Destino:</span>
              <span class="ellipsis" style="max-width: 250px">{{ selectedTrip.destAddress }}</span>
            </div>
            <div class="row justify-between q-mt-xs">
              <span class="text-caption text-grey-4">Tarifa:</span>
              <span class="text-weight-bolder text-primary">
                ${{ Number(selectedTrip.finalFare ?? selectedTrip.estimatedFare ?? 0).toFixed(2) }}
              </span>
            </div>
          </div>

          <div class="q-gutter-y-md">
            <q-select
              v-model="assignDriverId"
              :options="driverOptionsFiltered"
              emit-value
              map-options
              label="Selecciona un conductor activo *"
              outlined
              dense
              :loading="loadingDrivers"
            />

            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn flat label="Cancelar" v-close-popup :disable="submittingAssign" />
              <q-btn
                unelevated
                color="accent"
                label="Confirmar Asignación"
                :loading="submittingAssign"
                :disable="!assignDriverId"
                class="text-weight-bold q-px-md"
                @click="confirmAssignDriver"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import { api } from '../services/api.js';
import { getAdminSocket } from '../services/socket.js';

const $q = useQuasar();

const loading = ref(false);
const trips = ref<any[]>([]);
const selectedStatus = ref('');
const pagination = ref({
  page: 1,
  rowsPerPage: 15,
  rowsNumber: 0,
});

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const },
  { name: 'passenger', label: 'Pasajero', field: 'passenger', align: 'left' as const },
  { name: 'driver', label: 'Conductor', field: 'driver', align: 'left' as const },
  { name: 'route', label: 'Ruta', field: 'route', align: 'left' as const },
  { name: 'mode', label: 'Modalidad', field: 'pricingMode', align: 'center' as const },
  { name: 'fare', label: 'Precio', field: 'fare', align: 'right' as const },
  { name: 'status', label: 'Estado', field: 'status', align: 'center' as const },
  { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' as const },
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

// -------------------------------------------------------------
//  Conductores aprobados para asignación
// -------------------------------------------------------------
const approvedDrivers = ref<any[]>([]);
const loadingDrivers = ref(false);

async function loadApprovedDrivers() {
  loadingDrivers.value = true;
  try {
    const { data } = await api.get('/admin/drivers?status=APPROVED&pageSize=100');
    approvedDrivers.value = data.items || [];
  } catch (err) {
    console.error('Error cargando conductores:', err);
  } finally {
    loadingDrivers.value = false;
  }
}

const driverOptions = computed(() => {
  const list = [
    { label: 'Ninguno (Despacho automático / Asignar luego)', value: '' }
  ];
  for (const d of approvedDrivers.value) {
    const name = d.user?.name || 'Conductor';
    const veh = d.vehicle ? `${d.vehicle.brand} ${d.vehicle.model} (${d.vehicle.plate})` : 'Sin vehículo';
    const online = d.isOnline ? '🟢 En línea' : '⚪ Desconectado';
    list.push({
      label: `${name} - ${veh} [${online}]`,
      value: d.id,
    });
  }
  return list;
});

const driverOptionsFiltered = computed(() => {
  return approvedDrivers.value.map((d) => {
    const name = d.user?.name || 'Conductor';
    const veh = d.vehicle ? `${d.vehicle.brand} ${d.vehicle.model} (${d.vehicle.plate})` : 'Sin vehículo';
    const online = d.isOnline ? '🟢 En línea' : '⚪ Desconectado';
    return {
      label: `${name} - ${veh} [${online}]`,
      value: d.id,
    };
  });
});

// -------------------------------------------------------------
//  Cargar Viajes
// -------------------------------------------------------------
async function loadTrips() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(pagination.value.page),
      pageSize: String(pagination.value.rowsPerPage),
    });
    if (selectedStatus.value) params.append('status', selectedStatus.value);

    const { data } = await api.get(`/admin/trips?${params.toString()}`);
    trips.value = data.items;
    pagination.value.rowsNumber = data.total;
  } catch (err) {
    console.error('Error cargando viajes:', err);
  } finally {
    loading.value = false;
  }
}

function onRequest(props: any) {
  pagination.value.page = props.pagination.page;
  pagination.value.rowsPerPage = props.pagination.rowsPerPage;
  loadTrips();
}

// -------------------------------------------------------------
//  Modal: Crear / Programar Viaje
// -------------------------------------------------------------
const newTripDialog = ref(false);
const submittingTrip = ref(false);
const newTripForm = ref({
  passengerName: '',
  passengerPhone: '',
  originAddress: '',
  destAddress: '',
  vehicleType: 'CAR',
  payment: 'CASH',
  fare: null as number | null,
  driverId: '',
});

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(address.trim());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return { lat, lng };
      }
    }
  } catch {
    // Fallback al geocodificador del backend
  }
  return null;
}

function openNewTripDialog() {
  newTripForm.value = {
    passengerName: '',
    passengerPhone: '',
    originAddress: '',
    destAddress: '',
    vehicleType: 'CAR',
    payment: 'CASH',
    fare: null,
    driverId: '',
  };
  loadApprovedDrivers();
  newTripDialog.value = true;
}

async function submitNewTrip() {
  submittingTrip.value = true;
  try {
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(newTripForm.value.originAddress),
      geocodeAddress(newTripForm.value.destAddress),
    ]);

    const payload: any = {
      passengerName: newTripForm.value.passengerName,
      passengerPhone: newTripForm.value.passengerPhone,
      originAddress: newTripForm.value.originAddress,
      destAddress: newTripForm.value.destAddress,
      vehicleType: newTripForm.value.vehicleType,
      payment: newTripForm.value.payment,
    };

    if (originCoords) {
      payload.originLat = originCoords.lat;
      payload.originLng = originCoords.lng;
    }
    if (destCoords) {
      payload.destLat = destCoords.lat;
      payload.destLng = destCoords.lng;
    }

    if (newTripForm.value.fare && newTripForm.value.fare > 0) {
      payload.fare = Number(newTripForm.value.fare);
    }
    if (newTripForm.value.driverId) {
      payload.driverId = newTripForm.value.driverId;
    }

    await api.post('/admin/trips', payload);

    $q.notify({
      type: 'positive',
      message: 'Servicio programado y despachado con éxito',
      position: 'top-right',
    });

    newTripDialog.value = false;
    loadTrips();
  } catch (err: any) {
    const msg = err.response?.data?.message || 'Error al programar el servicio';
    $q.notify({
      type: 'negative',
      message: Array.isArray(msg) ? msg.join(', ') : msg,
      position: 'top-right',
    });
  } finally {
    submittingTrip.value = false;
  }
}

// -------------------------------------------------------------
//  Modal: Asignar Conductor
// -------------------------------------------------------------
const assignDialog = ref(false);
const submittingAssign = ref(false);
const selectedTrip = ref<any>(null);
const assignDriverId = ref('');

function openAssignDialog(trip: any) {
  selectedTrip.value = trip;
  assignDriverId.value = '';
  loadApprovedDrivers();
  assignDialog.value = true;
}

async function confirmAssignDriver() {
  if (!selectedTrip.value || !assignDriverId.value) return;

  submittingAssign.value = true;
  try {
    await api.patch(`/admin/trips/${selectedTrip.value.id}/assign`, {
      driverId: assignDriverId.value,
    });

    $q.notify({
      type: 'positive',
      message: 'Conductor asignado exitosamente',
      position: 'top-right',
    });

    assignDialog.value = false;
    loadTrips();
  } catch (err: any) {
    const msg = err.response?.data?.message || 'Error al asignar conductor';
    $q.notify({
      type: 'negative',
      message: Array.isArray(msg) ? msg.join(', ') : msg,
      position: 'top-right',
    });
  } finally {
    submittingAssign.value = false;
  }
}

// -------------------------------------------------------------
//  WebSocket Realtime Listener
// -------------------------------------------------------------
let socket: any = null;

onMounted(() => {
  loadTrips();
  loadApprovedDrivers();

  socket = getAdminSocket();
  if (socket) {
    socket.on('admin:trip', (data: any) => {
      console.log('🔄 [AdminSocket] Actualización de viaje recibida:', data);
      loadTrips();
    });
  }
});

onUnmounted(() => {
  if (socket) {
    socket.off('admin:trip');
  }
});
</script>

<style scoped>
.font-mono {
  font-family: monospace;
}
</style>
