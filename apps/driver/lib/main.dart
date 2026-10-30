import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/driver_provider.dart';
import 'providers/trip_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/driver_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Bloquear orientación en vertical para experiencia óptima de conductor
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  // Barra de estado transparente
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  final authProvider = AuthProvider();
  await authProvider.initAuth();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ChangeNotifierProvider<DriverProvider>(create: (_) => DriverProvider()),
        ChangeNotifierProvider<TripProvider>(create: (_) => TripProvider()),
      ],
      child: const UrbanRideDriverApp(),
    ),
  );
}

class UrbanRideDriverApp extends StatelessWidget {
  const UrbanRideDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return MaterialApp(
      title: 'UrbanRide Conductor',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: auth.isAuthenticated ? const DriverHomeScreen() : const LoginScreen(),
    );
  }
}
