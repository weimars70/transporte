import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../models/trip_model.dart';
import '../../providers/trip_provider.dart';
import 'active_trip_screen.dart';

class IncomingRequestSheet extends StatefulWidget {
  final TripModel trip;

  const IncomingRequestSheet({super.key, required this.trip});

  @override
  State<IncomingRequestSheet> createState() => _IncomingRequestSheetState();
}

class _IncomingRequestSheetState extends State<IncomingRequestSheet> {
  late double _offeredAmount;
  final _customAmountController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _offeredAmount = widget.trip.displayFare;
    _customAmountController.text = _offeredAmount.toStringAsFixed(0);
  }

  @override
  void dispose() {
    _customAmountController.dispose();
    super.dispose();
  }

  void _accept() async {
    final tripProv = context.read<TripProvider>();
    final ok = await tripProv.acceptTrip(widget.trip.id);
    if (ok && mounted) {
      Navigator.pop(context);
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const ActiveTripScreen()),
      );
    }
  }

  void _sendOffer() async {
    final tripProv = context.read<TripProvider>();
    final ok = await tripProv.makeOffer(widget.trip.id, _offeredAmount);
    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Oferta enviada por \$${_offeredAmount.toStringAsFixed(2)}'),
          backgroundColor: AppTheme.primary,
        ),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final trip = widget.trip;
    final tripProv = context.watch<TripProvider>();

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Barra indicadora superior
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: AppTheme.surfaceLight,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Encabezado: Tipo de Viaje y Tarifa
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: trip.isBidding
                            ? AppTheme.accent.withValues(alpha: 0.2)
                            : AppTheme.primary.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        trip.isBidding ? 'SUBASTA (InDrive)' : 'TARIFA FIJA (Uber)',
                        style: TextStyle(
                          color: trip.isBidding ? AppTheme.accent : AppTheme.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${trip.distanceKm.toStringAsFixed(1)} km',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
                Text(
                  '\$${trip.displayFare.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Pasajero
            if (trip.passenger != null)
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppTheme.surfaceLight,
                    child: Text(
                      trip.passenger!.name.isNotEmpty ? trip.passenger!.name[0] : 'P',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          trip.passenger!.name,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                        ),
                        Row(
                          children: [
                            const Icon(Icons.star_rounded, color: Colors.amber, size: 16),
                            const SizedBox(width: 4),
                            Text(
                              trip.passenger!.rating.toStringAsFixed(1),
                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            const Divider(color: AppTheme.border, height: 28),

            // Ruta: Origen y Destino
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    const Icon(Icons.radio_button_checked, color: AppTheme.primary, size: 18),
                    Container(width: 2, height: 32, color: AppTheme.border),
                    const Icon(Icons.location_on_rounded, color: AppTheme.danger, size: 20),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        trip.originAddress,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        trip.destAddress,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Si es subasta (InDrive), mostrar selector de contraofertas
            if (trip.isBidding) ...[
              const Text(
                'Tu Oferta al Pasajero:',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _bidChip(trip.displayFare - 2),
                  _bidChip(trip.displayFare),
                  _bidChip(trip.displayFare + 2),
                  _bidChip(trip.displayFare + 5),
                ],
              ),
              const SizedBox(height: 18),
            ],

            // Botones de Acción
            Row(
              children: [
                IconButton(
                  onPressed: () {
                    tripProv.dismissIncoming();
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.close_rounded, color: AppTheme.textSecondary),
                  tooltip: 'Rechazar',
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: tripProv.isLoading ? null : (trip.isBidding ? _sendOffer : _accept),
                    child: tripProv.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.background),
                          )
                        : Text(
                            trip.isBidding ? 'Ofertar \$${_offeredAmount.toStringAsFixed(0)}' : 'Aceptar Viaje',
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _bidChip(double amount) {
    final isSelected = (_offeredAmount - amount).abs() < 0.1;
    return ChoiceChip(
      label: Text('\$${amount.toStringAsFixed(0)}'),
      selected: isSelected,
      selectedColor: AppTheme.accent,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppTheme.textPrimary,
        fontWeight: FontWeight.bold,
      ),
      onSelected: (_) {
        setState(() => _offeredAmount = amount);
      },
    );
  }
}
