import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';

class DriverProfileScreen extends StatelessWidget {
  const DriverProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final driver = user?.driver;
    final vehicle = driver?.vehicle;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Perfil de Conductor'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Avatar y Nombre
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 46,
                    backgroundColor: AppTheme.primary.withValues(alpha: 0.15),
                    child: Text(
                      user?.name.isNotEmpty == true ? user!.name[0] : 'C',
                      style: const TextStyle(fontSize: 34, fontWeight: FontWeight.bold, color: AppTheme.primary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user?.name ?? 'Conductor',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?.phone ?? '',
                    style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: driver?.isApproved == true
                          ? AppTheme.primary.withValues(alpha: 0.15)
                          : AppTheme.warning.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      driver?.status ?? 'PENDING',
                      style: TextStyle(
                        color: driver?.isApproved == true ? AppTheme.primary : AppTheme.warning,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Estadísticas rápidas
            Row(
              children: [
                Expanded(
                  child: _statCard('Calificación', '${user?.rating.toStringAsFixed(1)} ★', Icons.star_rounded, Colors.amber),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: _statCard('Viajes', '${driver?.totalTrips ?? 0}', Icons.local_taxi_rounded, AppTheme.accent),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Tarjeta de Vehículo
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.directions_car_rounded, color: AppTheme.primary, size: 20),
                        SizedBox(width: 8),
                        Text('Información del Vehículo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ],
                    ),
                    const Divider(color: AppTheme.border, height: 20),
                    _infoRow('Tipo', vehicle?.type == 'MOTO' ? 'Motocicleta' : 'Automóvil'),
                    _infoRow('Marca y Modelo', '${vehicle?.brand ?? ''} ${vehicle?.model ?? ''}'),
                    _infoRow('Placa', vehicle?.plate ?? '---'),
                    _infoRow('Color', vehicle?.color ?? '---'),
                    _infoRow('Año', '${vehicle?.year ?? '---'}'),
                    _infoRow('Licencia', driver?.licenseNumber ?? '---'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),

            // Cerrar Sesión
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.danger,
                side: const BorderSide(color: AppTheme.danger),
              ),
              onPressed: () async {
                await auth.logout();
                if (context.mounted) {
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (route) => false,
                  );
                }
              },
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Cerrar Sesión'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
    );
  }
}
