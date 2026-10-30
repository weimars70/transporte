import 'vehicle_model.dart';

class DriverModel {
  final String id;
  final String status; // PENDING, APPROVED, REJECTED, SUSPENDED
  final bool isOnline;
  final String licenseNumber;
  final int totalTrips;
  final VehicleModel? vehicle;

  DriverModel({
    required this.id,
    required this.status,
    required this.isOnline,
    required this.licenseNumber,
    this.totalTrips = 0,
    this.vehicle,
  });

  bool get isApproved => status == 'APPROVED';
  bool get isPending => status == 'PENDING';
  bool get isSuspended => status == 'SUSPENDED';

  factory DriverModel.fromJson(Map<String, dynamic> json) {
    return DriverModel(
      id: json['id'] ?? '',
      status: json['status'] ?? 'PENDING',
      isOnline: json['isOnline'] ?? false,
      licenseNumber: json['licenseNumber'] ?? '',
      totalTrips: json['totalTrips'] ?? 0,
      vehicle: json['vehicle'] != null ? VehicleModel.fromJson(json['vehicle']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'isOnline': isOnline,
      'licenseNumber': licenseNumber,
      'totalTrips': totalTrips,
      'vehicle': vehicle?.toJson(),
    };
  }
}
