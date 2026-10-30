double? _parseDouble(dynamic val) {
  if (val == null) return null;
  if (val is num) return val.toDouble();
  if (val is String) return double.tryParse(val);
  return null;
}

int? _parseInt(dynamic val) {
  if (val == null) return null;
  if (val is num) return val.toInt();
  if (val is String) return int.tryParse(val);
  return null;
}

class PassengerSummary {
  final String id;
  final String name;
  final String phone;
  final double rating;
  final String? avatarUrl;

  PassengerSummary({
    required this.id,
    required this.name,
    required this.phone,
    this.rating = 5.0,
    this.avatarUrl,
  });

  factory PassengerSummary.fromJson(Map<String, dynamic> json) {
    return PassengerSummary(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Pasajero',
      phone: json['phone']?.toString() ?? '',
      rating: _parseDouble(json['rating']) ?? 5.0,
      avatarUrl: json['avatarUrl']?.toString(),
    );
  }
}

class TripModel {
  final String id;
  final String passengerId;
  final String? driverId;
  final String status; // REQUESTED, ACCEPTED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED
  final String pricingMode; // FIXED, BIDDING
  final String vehicleType; // CAR, MOTO
  final String payment; // CASH, CARD, WALLET
  final double originLat;
  final double originLng;
  final String originAddress;
  final double destLat;
  final double destLng;
  final String destAddress;
  final double distanceKm;
  final int durationMin;
  final double? proposedFare;
  final double? finalFare;
  final PassengerSummary? passenger;

  TripModel({
    required this.id,
    required this.passengerId,
    this.driverId,
    required this.status,
    required this.pricingMode,
    required this.vehicleType,
    this.payment = 'CASH',
    required this.originLat,
    required this.originLng,
    required this.originAddress,
    required this.destLat,
    required this.destLng,
    required this.destAddress,
    required this.distanceKm,
    required this.durationMin,
    this.proposedFare,
    this.finalFare,
    this.passenger,
  });

  bool get isBidding => pricingMode == 'BIDDING';
  bool get isRequested => status == 'REQUESTED';
  bool get isAccepted => status == 'ACCEPTED';
  bool get isArrived => status == 'ARRIVED';
  bool get isInProgress => status == 'IN_PROGRESS';
  bool get isCompleted => status == 'COMPLETED';

  double get displayFare => finalFare ?? proposedFare ?? 0.0;

  factory TripModel.fromJson(Map<String, dynamic> json) {
    final distMeters = _parseDouble(json['distanceMeters']);
    final distKm = _parseDouble(json['distanceKm']) ?? (distMeters != null ? distMeters / 1000.0 : 0.0);

    final durSecs = _parseInt(json['durationSeconds']);
    final durMin = _parseInt(json['durationMin']) ?? (durSecs != null ? (durSecs / 60).round() : 0);

    final finalFareVal = _parseDouble(json['finalFare']) ?? _parseDouble(json['estimatedFare']);
    final proposedFareVal = _parseDouble(json['proposedFare']);

    return TripModel(
      id: json['id']?.toString() ?? '',
      passengerId: json['passengerId']?.toString() ?? '',
      driverId: json['driverId']?.toString(),
      status: json['status']?.toString() ?? 'REQUESTED',
      pricingMode: json['pricingMode']?.toString() ?? 'FIXED',
      vehicleType: json['vehicleType']?.toString() ?? 'CAR',
      payment: json['payment']?.toString() ?? 'CASH',
      originLat: _parseDouble(json['originLat']) ?? 0.0,
      originLng: _parseDouble(json['originLng']) ?? 0.0,
      originAddress: json['originAddress']?.toString() ?? 'Origen',
      destLat: _parseDouble(json['destLat']) ?? 0.0,
      destLng: _parseDouble(json['destLng']) ?? 0.0,
      destAddress: json['destAddress']?.toString() ?? 'Destino',
      distanceKm: distKm,
      durationMin: durMin,
      proposedFare: proposedFareVal,
      finalFare: finalFareVal,
      passenger: json['passenger'] != null
          ? PassengerSummary.fromJson(Map<String, dynamic>.from(json['passenger']))
          : null,
    );
  }
}
