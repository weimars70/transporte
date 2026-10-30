import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/storage_service.dart';
import '../../core/theme/app_theme.dart';
import '../../models/vehicle_model.dart';
import '../../providers/auth_provider.dart';
import '../home/driver_home_screen.dart';

class RegisterDriverScreen extends StatefulWidget {
  const RegisterDriverScreen({super.key});

  @override
  State<RegisterDriverScreen> createState() => _RegisterDriverScreenState();
}

class _RegisterDriverScreenState extends State<RegisterDriverScreen> {
  final _formKey = GlobalKey<FormState>();

  // Datos personales
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController(text: '+591');
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _licenseController = TextEditingController();

  // Datos del vehículo
  String _vehicleType = 'CAR';
  final _brandController = TextEditingController();
  final _modelController = TextEditingController();
  final _colorController = TextEditingController();
  final _plateController = TextEditingController();
  final _yearController = TextEditingController(text: '2022');

  int _currentStep = 0;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _licenseController.dispose();
    _brandController.dispose();
    _modelController.dispose();
    _colorController.dispose();
    _plateController.dispose();
    _yearController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();

    final vehicle = VehicleModel(
      type: _vehicleType,
      brand: _brandController.text.trim(),
      model: _modelController.text.trim(),
      color: _colorController.text.trim(),
      plate: _plateController.text.trim().toUpperCase(),
      year: int.tryParse(_yearController.text.trim()) ?? 2020,
    );

    final success = await auth.registerDriver(
      name: _nameController.text.trim(),
      phone: _phoneController.text.trim(),
      email: _emailController.text.trim().isNotEmpty ? _emailController.text.trim() : null,
      password: _passwordController.text,
      licenseNumber: _licenseController.text.trim(),
      vehicle: vehicle,
    );

    if (success && mounted) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: AppTheme.surface,
          icon: const Icon(Icons.check_circle_outline_rounded, color: AppTheme.primary, size: 54),
          title: const Text('¡Registro Exitoso!'),
          content: const Text(
            'Tu cuenta y vehículo han sido registrados en el sistema. Tu perfil se encuentra en estado "Pendiente" y el administrador lo aprobará en breve.',
            textAlign: TextAlign.center,
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const DriverHomeScreen()),
                );
              },
              child: const Text('Continuar a la App'),
            ),
          ],
        ),
      );
    } else if (mounted && auth.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage!),
          backgroundColor: AppTheme.danger,
        ),
      );
    }
  }

  void _showServerSettings() {
    final serverController = TextEditingController(text: ApiConstants.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('Configuración del Servidor'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Ajusta la URL del backend:\n• Por cable USB (adb reverse): http://localhost:3000\n• Por Wi-Fi: http://192.168.1.3:3000',
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: serverController,
              decoration: const InputDecoration(labelText: 'URL Base del Backend'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = serverController.text.trim();
              if (newUrl.isNotEmpty) {
                ApiConstants.baseUrl = newUrl;
                await StorageService.saveCustomBaseUrl(newUrl);
              }
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Registro de Conductor'),
        actions: [
          IconButton(
            tooltip: 'Configuración de Servidor',
            icon: const Icon(Icons.settings_outlined),
            onPressed: _showServerSettings,
          ),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: Stepper(
            type: StepperType.horizontal,
            currentStep: _currentStep,
            onStepContinue: () {
              if (_currentStep == 0) {
                if (_nameController.text.isEmpty ||
                    _phoneController.text.isEmpty ||
                    _passwordController.text.isEmpty ||
                    _licenseController.text.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Por favor completa todos los campos requeridos')),
                  );
                  return;
                }
                setState(() => _currentStep = 1);
              } else {
                _submit();
              }
            },
            onStepCancel: () {
              if (_currentStep > 0) {
                setState(() => _currentStep = 0);
              } else {
                Navigator.pop(context);
              }
            },
            controlsBuilder: (context, details) {
              return Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        onPressed: auth.isLoading ? null : details.onStepContinue,
                        child: auth.isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.background),
                              )
                            : Text(_currentStep == 0 ? 'Siguiente: Vehículo' : 'Completar Registro'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton(
                      onPressed: details.onStepCancel,
                      child: Text(_currentStep == 0 ? 'Cancelar' : 'Atrás'),
                    ),
                  ],
                ),
              );
            },
            steps: [
              // Paso 1: Datos Personales y Licencia
              Step(
                title: const Text('Conductor'),
                isActive: _currentStep >= 0,
                state: _currentStep > 0 ? StepState.complete : StepState.indexed,
                content: Column(
                  children: [
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Nombre Completo *',
                        prefixIcon: Icon(Icons.person_outline_rounded),
                      ),
                      validator: (v) => (v == null || v.trim().length < 3) ? 'Ingresa tu nombre' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Teléfono Móvil *',
                        prefixIcon: Icon(Icons.phone_rounded),
                      ),
                      validator: (v) => (v == null || v.trim().length < 6) ? 'Ingresa tu teléfono' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Correo Electrónico (opcional)',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Contraseña *',
                        prefixIcon: Icon(Icons.lock_outline_rounded),
                      ),
                      validator: (v) => (v == null || v.length < 6) ? 'Mínimo 6 caracteres' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _licenseController,
                      decoration: const InputDecoration(
                        labelText: 'Número de Licencia de Conducir *',
                        prefixIcon: Icon(Icons.badge_outlined),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Ingresa tu licencia' : null,
                    ),
                  ],
                ),
              ),

              // Paso 2: Datos del Vehículo
              Step(
                title: const Text('Vehículo'),
                isActive: _currentStep >= 1,
                state: _currentStep == 1 ? StepState.indexed : StepState.complete,
                content: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tipo de Vehículo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            label: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.directions_car_rounded, size: 18),
                                SizedBox(width: 8),
                                Text('Automóvil'),
                              ],
                            ),
                            selected: _vehicleType == 'CAR',
                            selectedColor: AppTheme.primary,
                            onSelected: (_) => setState(() => _vehicleType = 'CAR'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ChoiceChip(
                            label: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.two_wheeler_rounded, size: 18),
                                SizedBox(width: 8),
                                Text('Motocicleta'),
                              ],
                            ),
                            selected: _vehicleType == 'MOTO',
                            selectedColor: AppTheme.accent,
                            onSelected: (_) => setState(() => _vehicleType = 'MOTO'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _brandController,
                      decoration: const InputDecoration(
                        labelText: 'Marca (ej. Toyota, Suzuki, Honda) *',
                        prefixIcon: Icon(Icons.drive_file_rename_outline_rounded),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _modelController,
                      decoration: const InputDecoration(
                        labelText: 'Modelo (ej. Corolla, Swift, CB190) *',
                        prefixIcon: Icon(Icons.car_rental_rounded),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _plateController,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              labelText: 'Placa *',
                              prefixIcon: Icon(Icons.pin_rounded),
                            ),
                            validator: (v) => (v == null || v.trim().length < 4) ? 'Placa inválida' : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _colorController,
                            decoration: const InputDecoration(
                              labelText: 'Color *',
                              prefixIcon: Icon(Icons.color_lens_outlined),
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _yearController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Año del Vehículo *',
                        prefixIcon: Icon(Icons.calendar_month_rounded),
                      ),
                      validator: (v) {
                        final y = int.tryParse(v ?? '');
                        if (y == null || y < 1980 || y > 2030) return 'Año no válido';
                        return null;
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
