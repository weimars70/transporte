class ApiConstants {
  // Para dispositivo físico conectado por USB (con adb reverse) o emulador, usamos localhost:3000.
  // También se puede usar la IP local en Wi-Fi (ej. http://192.168.1.3:3000).
  static String get defaultBaseUrl {
    return 'http://localhost:3000';
  }

  // Base URL activa (se puede actualizar en tiempo de ejecución o ajustes)
  static String baseUrl = defaultBaseUrl;

  static String get apiBaseUrl => '$baseUrl/api';
  static String get socketUrl => baseUrl;

  // Endpoints Auth
  static String get login => '$apiBaseUrl/auth/login';
  static String get registerDriver => '$apiBaseUrl/auth/register-driver';
  static String get me => '$apiBaseUrl/auth/me';

  // Endpoints Conductor
  static String get driverProfile => '$apiBaseUrl/drivers/me';
  static String get setOnline => '$apiBaseUrl/drivers/me/online';

  // Endpoints Viajes
  static String get availableTrips => '$apiBaseUrl/trips/available';
  static String get activeTrip => '$apiBaseUrl/trips/active';
  static String get tripHistory => '$apiBaseUrl/trips/history';

  static String acceptTrip(String id) => '$apiBaseUrl/trips/$id/accept';
  static String makeOffer(String id) => '$apiBaseUrl/trips/$id/offers';
  static String arriveTrip(String id) => '$apiBaseUrl/trips/$id/arrive';
  static String startTrip(String id) => '$apiBaseUrl/trips/$id/start';
  static String completeTrip(String id) => '$apiBaseUrl/trips/$id/complete';
  static String cancelTrip(String id) => '$apiBaseUrl/trips/$id/cancel';
}
