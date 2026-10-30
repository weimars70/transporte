<template>
  <q-page class="live-map-page">
    <!-- Overlay de control superior -->
    <div class="map-controls q-pa-md">
      <q-card class="glass-card q-pa-sm row items-center justify-between no-wrap shadow-3">
        <div class="row items-center q-gutter-x-sm">
          <q-avatar size="36px" color="primary" text-color="white" icon="satellite_alt" />
          <div>
            <div class="text-subtitle2 text-weight-bold">Radar de Flota en Vivo</div>
            <div class="text-caption text-grey-7">
              {{ onlineCount }} disponibles · {{ busyCount }} en viaje
            </div>
          </div>
        </div>

        <div class="row items-center q-gutter-x-xs">
          <q-btn flat round dense icon="my_location" @click="centerOnFleet">
            <q-tooltip>Centrar flota</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="refresh" :loading="loading" @click="fetchPositions">
            <q-tooltip>Actualizar radar</q-tooltip>
          </q-btn>
        </div>
      </q-card>
    </div>

    <!-- Contenedor del Mapa Leaflet -->
    <div id="fleet-map" class="map-container"></div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import L from 'leaflet';
import { api } from '../services/api.js';
import { getAdminSocket } from '../services/socket.js';

interface DriverPoint {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  type: string;
  busy: boolean;
  ts: number;
}

const loading = ref(false);
const positions = ref<Map<string, DriverPoint>>(new Map());
let map: L.Map | null = null;
const markers = new Map<string, L.Marker>();

const onlineCount = computed(() => {
  return Array.from(positions.value.values()).filter((p) => !p.busy).length;
});

const busyCount = computed(() => {
  return Array.from(positions.value.values()).filter((p) => p.busy).length;
});

function createCarIcon(busy: boolean) {
  const color = busy ? '#ff9100' : '#00c853';
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background: #ffffff;
        border: 2px solid ${color};
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      ">
        <span class="material-icons" style="font-size: 20px; color: ${color};">
          directions_car
        </span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function updateMarker(p: DriverPoint) {
  positions.value.set(p.driverId, p);

  if (!map) return;

  const existingMarker = markers.get(p.driverId);
  if (existingMarker) {
    existingMarker.setLatLng([p.lat, p.lng]);
    existingMarker.setIcon(createCarIcon(p.busy));
  } else {
    const marker = L.marker([p.lat, p.lng], {
      icon: createCarIcon(p.busy),
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <strong style="font-size: 14px;">Conductor ID:</strong> ${p.driverId.slice(0, 8)}...<br/>
        <strong>Tipo:</strong> ${p.type}<br/>
        <strong>Estado:</strong> ${p.busy ? '<span style="color:#ff9100;font-weight:bold;">En Viaje</span>' : '<span style="color:#00c853;font-weight:bold;">Disponible</span>'}<br/>
        <small style="color: #666;">Lat: ${p.lat.toFixed(4)}, Lng: ${p.lng.toFixed(4)}</small>
      </div>
    `);

    markers.set(p.driverId, marker);
  }
}

async function fetchPositions() {
  loading.value = true;
  try {
    const { data } = await api.get('/admin/drivers/live-positions');
    data.forEach((p: DriverPoint) => {
      updateMarker(p);
    });
    if (data.length > 0 && map) {
      centerOnFleet();
    }
  } catch (err) {
    console.error('Error cargando posiciones:', err);
  } finally {
    loading.value = false;
  }
}

function centerOnFleet() {
  if (!map || positions.value.size === 0) return;
  const points = Array.from(positions.value.values()).map((p) => [p.lat, p.lng] as [number, number]);
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
}

onMounted(() => {
  // Inicializar mapa centrado (ej: Bogotá / centro regional genérico)
  map = L.map('fleet-map', {
    zoomControl: false,
  }).setView([4.6097, -74.0817], 13);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Tiles de OpenStreetMap / CartoDB Voyager de alta calidad
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
  }).addTo(map);

  fetchPositions();

  // Escuchar eventos en vivo desde NestJS
  const socket = getAdminSocket();
  socket.on('admin:driver-location', (point: DriverPoint) => {
    updateMarker(point);
  });
});

onUnmounted(() => {
  const socket = getAdminSocket();
  socket.off('admin:driver-location');
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
.live-map-page {
  position: relative;
  height: calc(100vh - 50px);
  width: 100%;
}
.map-container {
  height: 100%;
  width: 100%;
  z-index: 1;
}
.map-controls {
  position: absolute;
  top: 10px;
  left: 20px;
  z-index: 1000;
  max-width: 360px;
  width: 100%;
}
</style>
