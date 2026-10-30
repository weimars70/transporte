import 'dart:async';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/api_client.dart';
import '../core/network/socket_service.dart';
import '../models/trip_model.dart';

class TripProvider extends ChangeNotifier {
  TripModel? _incomingTrip;
  TripModel? _activeTrip;
  bool _isLoading = false;
  String? _errorMessage;

  StreamSubscription? _newTripSub;
  StreamSubscription? _unavailableTripSub;
  StreamSubscription? _updatedTripSub;

  TripModel? get incomingTrip => _incomingTrip;
  TripModel? get activeTrip => _activeTrip;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  TripProvider() {
    _initSocketListeners();
  }

  void _initSocketListeners() {
    _newTripSub = SocketService.onTripNew.listen((data) {
      try {
        final trip = TripModel.fromJson(data);
        // Si no tenemos un viaje activo, mostrar la solicitud entrante
        if (_activeTrip == null) {
          _incomingTrip = trip;
          notifyListeners();
        }
      } catch (e) {
        debugPrint('Error parseando trip:new: $e');
      }
    });

    _unavailableTripSub = SocketService.onTripUnavailable.listen((tripId) {
      if (_incomingTrip != null && _incomingTrip!.id == tripId) {
        _incomingTrip = null;
        notifyListeners();
      }
    });

    _updatedTripSub = SocketService.onTripUpdated.listen((data) {
      try {
        final trip = TripModel.fromJson(data);
        if (_activeTrip != null && _activeTrip!.id == trip.id) {
          if (trip.status == 'COMPLETED' || trip.status == 'CANCELLED') {
            _activeTrip = null;
          } else {
            _activeTrip = trip;
          }
          notifyListeners();
        } else if (_activeTrip == null &&
            (trip.status == 'ACCEPTED' || trip.status == 'ARRIVED' || trip.status == 'IN_PROGRESS')) {
          _activeTrip = trip;
          _incomingTrip = null;
          SocketService.joinTrip(trip.id);
          notifyListeners();
        }
      } catch (e) {
        debugPrint('Error parseando trip:updated: $e');
      }
    });
  }

  void dismissIncoming() {
    _incomingTrip = null;
    notifyListeners();
  }

  Future<void> checkActiveTrip() async {
    try {
      final res = await ApiClient.get(ApiConstants.activeTrip);
      debugPrint('🔍 [TripProvider] checkActiveTrip response: ${res.statusCode} data: ${res.data}');
      if (res.isSuccess && res.data != null && res.data is Map && (res.data as Map).isNotEmpty) {
        _activeTrip = TripModel.fromJson(Map<String, dynamic>.from(res.data as Map));
        debugPrint('✅ [TripProvider] Viaje activo cargado: ${_activeTrip!.id} status: ${_activeTrip!.status}');
        SocketService.joinTrip(_activeTrip!.id);
        notifyListeners();
      } else {
        _activeTrip = null;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('❌ [TripProvider] Error en checkActiveTrip: $e');
    }
  }

  Future<bool> acceptTrip(String tripId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiClient.post(ApiConstants.acceptTrip(tripId), {});
      if (res.isSuccess && res.data != null) {
        _activeTrip = TripModel.fromJson(res.data);
        _incomingTrip = null;
        SocketService.joinTrip(_activeTrip!.id);
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.errorMessage ?? 'No se pudo aceptar el viaje';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> makeOffer(String tripId, double amount) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiClient.post(ApiConstants.makeOffer(tripId), {
        'amount': amount,
      });

      if (res.isSuccess) {
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.errorMessage ?? 'Error al enviar oferta';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> markArrived(String tripId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiClient.post(ApiConstants.arriveTrip(tripId), {});
      if (res.isSuccess && res.data != null) {
        _activeTrip = TripModel.fromJson(res.data);
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> startTrip(String tripId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiClient.post(ApiConstants.startTrip(tripId), {});
      if (res.isSuccess && res.data != null) {
        _activeTrip = TripModel.fromJson(res.data);
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> completeTrip(String tripId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiClient.post(ApiConstants.completeTrip(tripId), {});
      if (res.isSuccess) {
        _activeTrip = null;
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> cancelTrip(String tripId, String reason) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await ApiClient.post(ApiConstants.cancelTrip(tripId), {
        'reason': reason,
      });
      if (res.isSuccess) {
        _activeTrip = null;
        _isLoading = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
    _isLoading = false;
    notifyListeners();
    return false;
  }

  @override
  void dispose() {
    _newTripSub?.cancel();
    _unavailableTripSub?.cancel();
    _updatedTripSub?.cancel();
    super.dispose();
  }
}
