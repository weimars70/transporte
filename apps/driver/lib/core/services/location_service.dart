import 'dart:async';
import 'package:geolocator/geolocator.dart';

class LocationService {
  static StreamSubscription<Position>? _positionSubscription;
  static String? lastError;

  static Future<bool> checkAndRequestPermission() async {
    lastError = null;
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      lastError = 'El GPS está desactivado. Por favor activa la ubicación en tu teléfono.';
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        lastError = 'Permiso de ubicación denegado por el usuario.';
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      lastError = 'Permiso de ubicación denegado permanentemente. Actívalo en Ajustes de la App.';
      return false;
    }

    return true;
  }

  static Future<Position?> getCurrentPosition() async {
    final hasPermission = await checkAndRequestPermission();
    if (!hasPermission) return null;

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 5),
        ),
      );
    } catch (_) {
      try {
        return await Geolocator.getLastKnownPosition();
      } catch (_) {
        return null;
      }
    }
  }

  static void startTracking({
    required Function(Position position) onLocationChanged,
    int intervalSeconds = 4,
    int distanceFilter = 5,
  }) {
    stopTracking();

    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5,
    );

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(onLocationChanged);
  }

  static void stopTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
  }
}
