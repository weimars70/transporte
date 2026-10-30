import 'dart:async';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/network/api_client.dart';
import '../core/network/socket_service.dart';
import '../core/services/storage_service.dart';
import '../models/driver_model.dart';
import '../models/user_model.dart';
import '../models/vehicle_model.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isLoading = false;
  String? _errorMessage;
  StreamSubscription? _statusSubscription;

  UserModel? get user => _user;
  DriverModel? get driver => _user?.driver;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    _statusSubscription = SocketService.onDriverStatusChanged.listen((status) {
      updateDriverStatus(status);
    });
  }

  @override
  void dispose() {
    _statusSubscription?.cancel();
    super.dispose();
  }

  Future<void> initAuth() async {
    final token = await StorageService.getToken();
    final customUrl = await StorageService.getCustomBaseUrl();
    if (customUrl != null && customUrl.isNotEmpty) {
      ApiConstants.baseUrl = customUrl;
    }

    if (token != null && token.isNotEmpty) {
      _user = await StorageService.getUser();
      notifyListeners();
      await fetchProfile();
      await SocketService.connect();
    }
  }

  Future<bool> login(String phone, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiClient.post(ApiConstants.login, {
        'phone': phone.trim(),
        'password': password,
      });

      if (res.isSuccess && res.data != null) {
        final token = res.data['accessToken'];
        final userData = UserModel.fromJson(res.data['user']);

        if (userData.role != 'DRIVER') {
          _errorMessage = 'Esta cuenta no está registrada como conductor';
          _isLoading = false;
          notifyListeners();
          return false;
        }

        await StorageService.saveToken(token);
        await StorageService.saveUser(userData);
        _user = userData;

        await SocketService.connect();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.errorMessage ?? 'Error al iniciar sesión';
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

  Future<bool> registerDriver({
    required String name,
    required String phone,
    String? email,
    required String password,
    required String licenseNumber,
    required VehicleModel vehicle,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final payload = {
        'name': name.trim(),
        'phone': phone.trim(),
        if (email != null && email.isNotEmpty) 'email': email.trim(),
        'password': password,
        'licenseNumber': licenseNumber.trim(),
        'vehicle': vehicle.toJson(),
      };

      final res = await ApiClient.post(ApiConstants.registerDriver, payload);

      if (res.isSuccess && res.data != null) {
        final token = res.data['accessToken'];
        final userData = UserModel.fromJson(res.data['user']);

        await StorageService.saveToken(token);
        await StorageService.saveUser(userData);
        _user = userData;

        await SocketService.connect();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.errorMessage ?? 'Error al registrar conductor';
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

  Future<void> fetchProfile() async {
    try {
      final res = await ApiClient.get(ApiConstants.me);
      if (res.isSuccess && res.data != null) {
        _user = UserModel.fromJson(res.data);
        await StorageService.saveUser(_user!);
        notifyListeners();
      }
    } catch (_) {}
  }

  void updateDriverStatus(String status) {
    if (_user != null && _user!.driver != null) {
      final currentDriver = _user!.driver!;
      final updatedDriver = DriverModel(
        id: currentDriver.id,
        status: status,
        isOnline: status == 'APPROVED' ? currentDriver.isOnline : false,
        licenseNumber: currentDriver.licenseNumber,
        totalTrips: currentDriver.totalTrips,
        vehicle: currentDriver.vehicle,
      );

      _user = UserModel(
        id: _user!.id,
        name: _user!.name,
        phone: _user!.phone,
        email: _user!.email,
        role: _user!.role,
        avatarUrl: _user!.avatarUrl,
        rating: _user!.rating,
        ratingCount: _user!.ratingCount,
        driver: updatedDriver,
      );
      StorageService.saveUser(_user!);
      notifyListeners();
    }
  }

  Future<void> logout() async {
    SocketService.disconnect();
    await StorageService.clearAll();
    _user = null;
    notifyListeners();
  }
}
