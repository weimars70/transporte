# UrbanRide - Sistema de Transporte (Tipo Uber / InDrive)

Plataforma integral de transporte con backend en **NestJS**, panel administrativo en **Vue 3 + Quasar** y arquitectura lista para apps móviles en **Flutter**. Soporta tanto tarifas calculadas automáticamente (estilo Uber) como subasta de ofertas en tiempo real (estilo InDrive).

---

## 🏛️ Estructura del Proyecto

```
transporte/
├── backend/                # API REST + WebSockets en NestJS con Prisma y Redis
│   ├── prisma/             # Esquema de base de datos (PostgreSQL) y script de seed
│   └── src/
│       ├── admin/          # Gestión de conductores, métricas y tarifas
│       ├── auth/           # Registro (pasajero/conductor) y autenticación JWT
│       ├── common/         # Guards, decoradores, tipos, haversine y serializador
│       ├── drivers/        # Geolocalización en Redis GEO y despacho
│       ├── pricing/        # Rutas de Google Maps / fallback y cálculo de tarifas
│       ├── realtime/       # Gateway Socket.IO en tiempo real (salas y eventos)
│       └── trips/          # Flujo de viajes, ofertas y tareas programadas
│
├── admin/                  # Panel web administrativo en Vue 3 + Quasar + Pinia + Vite
│   └── src/
│       ├── layouts/        # Layout responsivo con soporte de modo oscuro
│       ├── pages/
│       │   ├── DashboardPage.vue     # Métricas y actividad reciente en vivo
│       │   ├── LiveMapPage.vue       # Radar satelital con Leaflet y Socket.IO
│       │   ├── DriversPage.vue       # Aprobación y suspensión de conductores
│       │   ├── FareSettingsPage.vue  # Configuración de tarifas fijas y subasta
│       │   ├── TripsPage.vue         # Auditoría global de viajes
│       │   └── LoginPage.vue         # Acceso administrativo
│       └── services/       # Clientes Axios y Socket.IO
│
└── apps/                   # Directorio reservado para las aplicaciones Flutter
    ├── passenger/          # App móvil del Pasajero (próximo paso)
    └── driver/             # App móvil del Conductor con GPS en segundo plano
```

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
- **Node.js** v22 o superior
- **PostgreSQL** (base de datos local o servicio como Supabase/Neon)
- **Redis** (local, Memurai en Windows o Redis Cloud)

### 2. Configurar y Ejecutar el Backend

```bash
cd backend

# 1. Copiar variables de entorno
cp .env.example .env
# Ajustar DATABASE_URL y REDIS_URL en .env si es necesario

# 2. Generar cliente Prisma y sincronizar base de datos
npm run db:push

# 3. Poblar administrador inicial y tarifas
npm run db:seed

# 4. Iniciar en modo desarrollo
npm run start:dev
```

- **API Base:** `http://localhost:3000/api`
- **Documentación Swagger interactiva:** `http://localhost:3000/docs`
- **Credenciales Admin por defecto:**
  - Teléfono: `70000000`
  - Contraseña: `admin123`

### 3. Ejecutar el Panel Administrativo (Quasar)

```bash
cd admin

# Iniciar servidor de desarrollo (puerto 9000)
npm run dev
```

Abre tu navegador en `http://localhost:9000` e inicia sesión con las credenciales de administrador.

---

### 4. Ejecutar la Aplicación del Conductor (Flutter)

```bash
cd apps/driver

# Descargar dependencias
flutter pub get

# Iniciar en emulador o dispositivo físico
flutter run
```

> **Consejo de Conexión:**
> - En **Emulador Android**: Usa la URL por defecto `http://10.0.2.2:3000`.
> - En **Dispositivo Físico**: Configura la IP local de tu PC (ej. `http://192.168.1.X:3000`) desde el botón de configuración de servidor en la pantalla de inicio de sesión de la app.

---

## 📡 Eventos en Tiempo Real (Socket.IO)

| Evento | Emisor | Receptor | Descripción |
|---|---|---|---|
| `driver:location` | Conductor | Servidor / Pasajero | Envío de coordenadas GPS periódicas |
| `trip:new` | Servidor | Conductores cercanos | Notificación de nueva solicitud de viaje |
| `trip:offer` | Conductor | Pasajero | Contraoferta de precio (modo InDrive) |
| `trip:updated` | Servidor | Pasajero y Conductor | Cambio de estado (`ACCEPTED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) |
| `admin:driver-location` | Servidor | Panel Admin | Actualización del radar satelital en vivo |
