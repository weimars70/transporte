class VehicleModel {
  final String? id;
  final String type; // CAR o MOTO
  final String brand;
  final String model;
  final String color;
  final String plate;
  final int year;

  VehicleModel({
    this.id,
    required this.type,
    required this.brand,
    required this.model,
    required this.color,
    required this.plate,
    required this.year,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) {
    return VehicleModel(
      id: json['id'],
      type: json['type'] ?? 'CAR',
      brand: json['brand'] ?? '',
      model: json['model'] ?? '',
      color: json['color'] ?? '',
      plate: json['plate'] ?? '',
      year: json['year'] is int ? json['year'] : int.tryParse(json['year']?.toString() ?? '') ?? 2020,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'brand': brand,
      'model': model,
      'color': color,
      'plate': plate,
      'year': year,
    };
  }
}
