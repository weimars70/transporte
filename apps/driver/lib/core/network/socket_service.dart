import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/api_constants.dart';
import '../services/storage_service.dart';

class SocketService {
  static io.Socket? _socket;
  static bool get isConnected => _socket?.connected ?? false;

  // Stream Controllers para notificar a los providers
  static final _tripNewController = StreamController<Map<String, dynamic>>.broadcast();
  static final _tripUnavailableController = StreamController<String>.broadcast();
  static final _tripUpdatedController = StreamController<Map<String, dynamic>>.broadcast();
  static final _driverStatusController = StreamController<String>.broadcast();

  static Stream<Map<String, dynamic>> get onTripNew => _tripNewController.stream;
  static Stream<String> get onTripUnavailable => _tripUnavailableController.stream;
  static Stream<Map<String, dynamic>> get onTripUpdated => _tripUpdatedController.stream;
  static Stream<String> get onDriverStatusChanged => _driverStatusController.stream;

  static Future<void> connect() async {
    if (_socket != null && _socket!.connected) return;

    final token = await StorageService.getToken();
    if (token == null) return;

    _socket = io.io(
      ApiConstants.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .enableReconnection()
          .setAuth({'token': token})
          .setExtraHeaders({'Authorization': 'Bearer $token'})
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('🚀 [SocketService] Conectado al servidor WebSocket');
    });

    _socket!.onDisconnect((_) {
      debugPrint('🔌 [SocketService] Desconectado del servidor WebSocket');
    });

    _socket!.on('connected', (data) {
      debugPrint('✅ [SocketService] Autenticación WebSocket exitosa: $data');
    });

    _socket!.on('trip:new', (data) {
      debugPrint('🔔 [SocketService] Nueva solicitud de viaje recibida: $data');
      if (data is Map<String, dynamic>) {
        _tripNewController.add(data);
      } else if (data is Map) {
        _tripNewController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('trip:unavailable', (data) {
      debugPrint('⚠️ [SocketService] Viaje no disponible: $data');
      final tripId = data is Map ? (data['tripId'] ?? '') : data.toString();
      _tripUnavailableController.add(tripId);
    });

    _socket!.on('trip:updated', (data) {
      debugPrint('🔄 [SocketService] Viaje actualizado: $data');
      if (data is Map<String, dynamic>) {
        _tripUpdatedController.add(data);
      } else if (data is Map) {
        _tripUpdatedController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('driver:status-changed', (data) {
      debugPrint('🛡️ [SocketService] Estado de conductor cambiado: $data');
      final status = data is Map ? (data['status'] ?? '') : data.toString();
      _driverStatusController.add(status);
    });
  }

  static void emitDriverLocation({
    required double lat,
    required double lng,
    double? heading,
  }) {
    if (_socket == null || !_socket!.connected) return;

    _socket!.emit('driver:location', {
      'lat': lat,
      'lng': lng,
      if (heading != null) 'heading': heading,
    });
  }

  static void joinTrip(String tripId) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('trip:join', {'tripId': tripId});
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }
}
