import 'driver_model.dart';

class UserModel {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String role;
  final String? avatarUrl;
  final double rating;
  final int ratingCount;
  final DriverModel? driver;

  UserModel({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    required this.role,
    this.avatarUrl,
    this.rating = 5.0,
    this.ratingCount = 0,
    this.driver,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      email: json['email'],
      role: json['role'] ?? 'DRIVER',
      avatarUrl: json['avatarUrl'],
      rating: (json['rating'] is num) ? (json['rating'] as num).toDouble() : 5.0,
      ratingCount: json['ratingCount'] ?? 0,
      driver: json['driver'] != null ? DriverModel.fromJson(json['driver']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'email': email,
      'role': role,
      'avatarUrl': avatarUrl,
      'rating': rating,
      'ratingCount': ratingCount,
      'driver': driver?.toJson(),
    };
  }
}
