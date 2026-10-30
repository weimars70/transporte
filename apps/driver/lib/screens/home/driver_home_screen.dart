import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../../core/network/socket_service.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/driver_provider.dart';
import '../../providers/trip_provider.dart';
import '../profile/driver_profile_screen.dart';
import '../trip/active_trip_screen.dart';
import '../trip/incoming_request_sheet.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  final MapController _mapController = MapController();
  bool _sheetShown = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final auth = context.read<AuthProvider>();
      final driverProv = context.read<DriverProvider>();
      final tripProv = context.read<TripProvider>();
      await SocketService.connect();
      await auth.fetchProfile();
      if (mounted) {
        if (auth.driver != null) {
          driverProv.syncWithUser(auth.driver!.isOnline);
        }
        driverProv.initLocation();
        await tripProv.checkActiveTrip();
      }
    });
  }

  void _checkIncomingTrips(TripProvider tripProv) {
    if (tripProv.incomingTrip != null && !_sheetShown) {
      _sheetShown = true;
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => IncomingRequestSheet(trip: tripProv.incomingTrip!),
      ).whenComplete(() {
        _sheetShown = false;
        tripProv.dismissIncoming();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final driverProv = context.watch<DriverProvider>();
    final tripProv = context.watch<TripProvider>();

    final user = auth.user;
    final driver = user?.driver;
    final isApproved = driver?.isApproved ?? false;

    // Escuchar si hay una solicitud entrante
    _checkIncomingTrips(tripProv);

    final currentPos = driverProv.currentPosition;
    final mapCenter = currentPos != null
        ? LatLng(currentPos.latitude, currentPos.longitude)
        : const LatLng(-17.7833, -63.1821); // Coordenada por defecto

    return Scaffold(
      body: Stack(
        children: [
          // Mapa
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: mapCenter,
              initialZoom: 15.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.urbanride.driver',
              ),
              if (currentPos != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(currentPos.latitude, currentPos.longitude),
                      width: 48,
                      height: 48,
                      child: Container(
                        decoration: BoxDecoration(
                          color: driverProv.isOnline ? AppTheme.primary : AppTheme.surfaceLight,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: const [
                            BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 3)),
                          ],
                        ),
                        child: const Icon(
                          Icons.navigation_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),

          // Barra Superior: Perfil y Estado
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Perfil
                      GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const DriverProfileScreen()),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: AppTheme.surface.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                            border: Border.all(color: AppTheme.border),
                          ),
                          child: CircleAvatar(
                            radius: 20,
                            backgroundColor: AppTheme.primary.withValues(alpha: 0.2),
                            child: Text(
                              user?.name.isNotEmpty == true ? user!.name[0] : 'C',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
                            ),
                          ),
                        ),
                      ),

                      // Estado Online / Offline Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppTheme.surface.withValues(alpha: 0.95),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: driverProv.isOnline ? AppTheme.primary : AppTheme.border,
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: driverProv.isOnline ? AppTheme.primary : AppTheme.surfaceLight,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              driverProv.isOnline ? 'EN LÍNEA' : 'DESCONECTADO',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                                color: driverProv.isOnline ? AppTheme.primary : AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Botones de sincronización y recentrar
                      Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: AppTheme.surface.withValues(alpha: 0.9),
                            child: IconButton(
                              icon: const Icon(Icons.sync_rounded, color: Colors.white),
                              tooltip: 'Sincronizar y Buscar Viajes',
                              onPressed: () async {
                                final auth = context.read<AuthProvider>();
                                final tripProv = context.read<TripProvider>();
                                await SocketService.connect();
                                await auth.fetchProfile();
                                await tripProv.checkActiveTrip();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Sincronización completada'),
                                      duration: Duration(seconds: 2),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          CircleAvatar(
                            backgroundColor: AppTheme.surface.withValues(alpha: 0.9),
                            child: IconButton(
                              icon: const Icon(Icons.my_location_rounded, color: Colors.white),
                              onPressed: () {
                                if (currentPos != null) {
                                  _mapController.move(
                                    LatLng(currentPos.latitude, currentPos.longitude),
                                    16.0,
                                  );
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Alerta si está en estado PENDIENTE
                  if (!isApproved) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.warning.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 8)],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline_rounded, color: Colors.black87),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Cuenta en Revisión',
                                  style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                Text(
                                  'El administrador debe aprobar tu vehículo y licencia antes de recibir viajes.',
                                  style: TextStyle(color: Colors.black.withValues(alpha: 0.8), fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Banner de Viaje Activo
                  if (tripProv.activeTrip != null) ...[
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const ActiveTripScreen()),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 10)],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.local_taxi_rounded, color: Color(0xFF0F172A)),
                                SizedBox(width: 10),
                                Text(
                                  'Tienes un viaje activo en curso',
                                  style: TextStyle(
                                    color: Color(0xFF0F172A),
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Text(
                                'Ver',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Panel inferior de Acciones
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (tripProv.activeTrip != null) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF6366F1), // Indigo
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            elevation: 8,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          ),
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const ActiveTripScreen()),
                            );
                          },
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.navigation_rounded, size: 24, color: Colors.white),
                              const SizedBox(width: 10),
                              Text(
                                'ABRIR VIAJE ASIGNADO (\$${tripProv.activeTrip!.displayFare.toStringAsFixed(2)})',
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.surface,
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: AppTheme.border),
                        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 16)],
                      ),
                      child: SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: driverProv.isOnline ? AppTheme.danger : AppTheme.primary,
                            foregroundColor: driverProv.isOnline ? Colors.white : const Color(0xFF0F172A),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                          ),
                          onPressed: driverProv.isLoading
                              ? null
                              : () async {
                                  if (!isApproved) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Tu cuenta aún está en revisión por el administrador.'),
                                        backgroundColor: AppTheme.warning,
                                        behavior: SnackBarBehavior.floating,
                                      ),
                                    );
                                    return;
                                  }

                                  final success = await driverProv.toggleOnline(!driverProv.isOnline);
                                  if (!success && context.mounted) {
                                    final err = driverProv.errorMessage ?? 'No se pudo cambiar el estado';
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(err),
                                        backgroundColor: AppTheme.danger,
                                        behavior: SnackBarBehavior.floating,
                                        duration: const Duration(seconds: 4),
                                      ),
                                    );
                                  }
                                },
                          child: driverProv.isLoading
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      driverProv.isOnline ? Icons.power_settings_new_rounded : Icons.sensors_rounded,
                                      size: 24,
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      driverProv.isOnline ? 'DESCONECTARME' : 'CONECTARME AHORA',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
