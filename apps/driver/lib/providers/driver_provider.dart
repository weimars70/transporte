import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../core/constants/api_constants.dart';
import '../core/network/api_client.dart';
import '../core/network/socket_service.dart';
import '../core/services/location_service.dart';

class DriverProvider extends ChangeNotifier {
  bool _isOnline = false;
  bool _isLoading = false;
  Position? _currentPosition;
  String? _errorMessage;

  StreamSubscription? _statusSubscription;

  bool get isOnline => _isOnline;
  bool get isLoading => _isLoading;
  Position? get currentPosition => _currentPosition;
  String? get errorMessage => _errorMessage;

  DriverProvider() {
    _initListener();
  }

  void _initListener() {
    _statusSubscription = SocketService.onDriverStatusChanged.listen((status) {
      if (status != 'APPROVED' && _isOnline) {
        _isOnline = false;
        LocationService.stopTracking();
        notifyListeners();
      }
    });
  }

  Future<void> initLocation() async {
    final pos = await LocationService.getCurrentPosition();
    if (pos != null) {
      _currentPosition = pos;
      notifyListeners();
    }
  }

  void syncWithUser(bool online) {
    _isOnline = online;
    notifyListeners();
  }

  Future<bool> toggleOnline(bool targetOnline) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      if (targetOnline) {
        final hasPermission = await LocationService.checkAndRequestPermission();
        if (!hasPermission) {
          _errorMessage = LocationService.lastError ?? 'Se requiere permiso de GPS para conectarse';
          _isLoading = false;
          notifyListeners();
          return false;
        }

        final pos = await LocationService.getCurrentPosition();
        if (pos != null) {
          _currentPosition = pos;
        }
      }

      final res = await ApiClient.patch(ApiConstants.setOnline, {
        'online': targetOnline,
      });

      if (res.isSuccess) {
        _isOnline = targetOnline;

        if (_isOnline) {
          _startGpsBroadcast();
        } else {
          LocationService.stopTracking();
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.errorMessage ?? 'No se pudo cambiar el estado en el servidor';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Error de conexión con el servidor ($e)';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void _startGpsBroadcast() {
    // Enviar posición inicial
    if (_currentPosition != null) {
      SocketService.emitDriverLocation(
        lat: _currentPosition!.latitude,
        lng: _currentPosition!.longitude,
        heading: _currentPosition!.heading,
      );
    }

    // Escuchar cambios de posición y transmitir cada 3-5s
    LocationService.startTracking(
      onLocationChanged: (pos) {
        _currentPosition = pos;
        notifyListeners();

        if (_isOnline) {
          SocketService.emitDriverLocation(
            lat: pos.latitude,
            lng: pos.longitude,
            heading: pos.heading,
          );
        }
      },
    );
  }

  @override
  void dispose() {
    _statusSubscription?.cancel();
    LocationService.stopTracking();
    super.dispose();
  }
}
