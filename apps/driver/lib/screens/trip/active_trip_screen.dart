import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/driver_provider.dart';
import '../../providers/trip_provider.dart';

class ActiveTripScreen extends StatefulWidget {
  const ActiveTripScreen({super.key});

  @override
  State<ActiveTripScreen> createState() => _ActiveTripScreenState();
}

class _ActiveTripScreenState extends State<ActiveTripScreen> {
  final MapController _mapController = MapController();
  Map<String, dynamic>? _completionSummary;
  bool _isFinishing = false;

  void _callPassenger(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _showCancelDialog() {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('Cancelar Viaje'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Indica el motivo de la cancelación:',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: 'Motivo (ej. Pasajero no se presentó)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Volver'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () async {
              final tripProv = context.read<TripProvider>();
              final active = tripProv.activeTrip;
              if (active != null) {
                await tripProv.cancelTrip(
                  active.id,
                  reasonController.text.trim().isNotEmpty
                      ? reasonController.text.trim()
                      : 'Cancelado por conductor',
                );
              }
              if (ctx.mounted) {
                Navigator.pop(ctx);
              }
              if (mounted) {
                Navigator.pop(context);
              }
            },
            child: const Text('Confirmar Cancelación'),
          ),
        ],
      ),
    );
  }

  Widget _buildCompletedScreen() {
    final fare = _completionSummary?['fare'] ?? 0.0;
    final payment = _completionSummary?['payment'] ?? 'CASH';
    final passenger = _completionSummary?['passenger'] ?? 'Pasajero';

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: AppTheme.primary,
                  size: 64,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                '¡Viaje Finalizado!',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Servicio completado para $passenger',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppTheme.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.border),
                  boxShadow: const [
                    BoxShadow(color: Colors.black45, blurRadius: 16, offset: Offset(0, 4)),
                  ],
                ),
                child: Column(
                  children: [
                    const Text(
                      'TOTAL A COBRAR',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textSecondary,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '\$${fare is num ? fare.toStringAsFixed(2) : fare}',
                      style: const TextStyle(
                        fontSize: 42,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.primary,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceLight,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.payments_rounded, size: 16, color: AppTheme.primary),
                          const SizedBox(width: 8),
                          Text(
                            'Método: $payment',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: const Color(0xFF0F172A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  onPressed: () {
                    if (Navigator.canPop(context)) {
                      Navigator.pop(context);
                    }
                  },
                  child: const Text(
                    'Volver al Mapa Principal',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tripProv = context.watch<TripProvider>();
    final driverProv = context.watch<DriverProvider>();
    final trip = tripProv.activeTrip;

    // Si el viaje ya finalizó o fue cancelado
    if (trip == null) {
      if (_completionSummary != null) {
        return _buildCompletedScreen();
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && Navigator.canPop(context)) {
          Navigator.pop(context);
        }
      });
      return const Scaffold(
        body: Center(
          child: Text(
            'Viaje finalizado',
            style: TextStyle(color: Colors.white, fontSize: 16),
          ),
        ),
      );
    }

    final driverPos = driverProv.currentPosition;
    final mapCenter = driverPos != null
        ? LatLng(driverPos.latitude, driverPos.longitude)
        : LatLng(trip.originLat, trip.originLng);

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
              MarkerLayer(
                markers: [
                  // Marcador de Origen
                  Marker(
                    point: LatLng(trip.originLat, trip.originLng),
                    width: 40,
                    height: 40,
                    child: const Icon(Icons.radio_button_checked, color: AppTheme.primary, size: 30),
                  ),
                  // Marcador de Destino
                  Marker(
                    point: LatLng(trip.destLat, trip.destLng),
                    width: 40,
                    height: 40,
                    child: const Icon(Icons.location_on_rounded, color: AppTheme.danger, size: 36),
                  ),
                  // Marcador del Conductor (GPS)
                  if (driverPos != null)
                    Marker(
                      point: LatLng(driverPos.latitude, driverPos.longitude),
                      width: 44,
                      height: 44,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 8)],
                        ),
                        child: const Icon(Icons.navigation_rounded, color: Colors.white, size: 22),
                      ),
                    ),
                ],
              ),
            ],
          ),

          // Botón superior de cancelar / ayuda
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  CircleAvatar(
                    backgroundColor: AppTheme.surface.withValues(alpha: 0.9),
                    child: IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white),
                      onPressed: _showCancelDialog,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.surface.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Text(
                      trip.status == 'ACCEPTED'
                          ? 'En camino al pasajero'
                          : trip.status == 'ARRIVED'
                              ? 'Esperando al pasajero'
                              : 'Viaje en progreso',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Panel Inferior con Acciones del Conductor
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppTheme.border),
                boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 16, offset: Offset(0, 4))],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Datos del Pasajero
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: AppTheme.surfaceLight,
                        child: Text(
                          trip.passenger?.name.isNotEmpty == true ? trip.passenger!.name[0] : 'P',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              trip.passenger?.name ?? 'Pasajero',
                              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              'Tarifa: \$${trip.displayFare.toStringAsFixed(2)} • ${trip.payment}',
                              style: const TextStyle(fontSize: 13, color: AppTheme.primary, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      // Botón de Llamar
                      IconButton.filled(
                        style: IconButton.styleFrom(
                          backgroundColor: AppTheme.primary.withValues(alpha: 0.2),
                          foregroundColor: AppTheme.primary,
                        ),
                        onPressed: () => _callPassenger(trip.passenger?.phone),
                        icon: const Icon(Icons.phone_rounded),
                      ),
                    ],
                  ),
                  const Divider(color: AppTheme.border, height: 24),

                  // Dirección objetivo
                  Row(
                    children: [
                      Icon(
                        trip.status == 'IN_PROGRESS' ? Icons.location_on_rounded : Icons.radio_button_checked,
                        color: trip.status == 'IN_PROGRESS' ? AppTheme.danger : AppTheme.primary,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          trip.status == 'IN_PROGRESS' ? trip.destAddress : trip.originAddress,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Botón de Acción según Estado
                  if (trip.status == 'ACCEPTED')
                    ElevatedButton.icon(
                      onPressed: tripProv.isLoading ? null : () => tripProv.markArrived(trip.id),
                      icon: const Icon(Icons.place_rounded),
                      label: const Text('He llegado al punto de recogida'),
                    )
                  else if (trip.status == 'ARRIVED')
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.accent),
                      onPressed: tripProv.isLoading ? null : () => tripProv.startTrip(trip.id),
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: const Text('Iniciar Viaje'),
                    )
                  else if (trip.status == 'IN_PROGRESS')
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.danger,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      onPressed: (tripProv.isLoading || _isFinishing)
                          ? null
                          : () async {
                              setState(() => _isFinishing = true);
                              final fare = trip.displayFare;
                              final payment = trip.payment;
                              final passenger = trip.passenger?.name ?? 'Pasajero';

                              setState(() {
                                _completionSummary = {
                                  'fare': fare,
                                  'payment': payment,
                                  'passenger': passenger,
                                };
                              });

                              final ok = await tripProv.completeTrip(trip.id);
                              if (context.mounted) {
                                setState(() => _isFinishing = false);
                                if (!ok) {
                                  setState(() => _completionSummary = null);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(tripProv.errorMessage ?? 'Error al finalizar el viaje'),
                                      backgroundColor: AppTheme.danger,
                                    ),
                                  );
                                }
                              }
                            },
                      icon: _isFinishing
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.flag_rounded),
                      label: Text(_isFinishing ? 'Finalizando...' : 'Finalizar Viaje y Cobrar'),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
