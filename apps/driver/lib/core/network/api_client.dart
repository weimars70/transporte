import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/storage_service.dart';

class ApiResponse {
  final bool isSuccess;
  final int statusCode;
  final dynamic data;
  final String? errorMessage;

  ApiResponse({
    required this.isSuccess,
    required this.statusCode,
    this.data,
    this.errorMessage,
  });
}

class ApiClient {
  static Future<Map<String, String>> _buildHeaders() async {
    final token = await StorageService.getToken();
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static ApiResponse _processResponse(http.Response response) {
    dynamic body;
    final trimmed = response.body.trim();
    if (trimmed.isEmpty || trimmed == 'null') {
      body = null;
    } else {
      try {
        body = jsonDecode(response.body);
      } catch (_) {
        body = response.body;
      }
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return ApiResponse(
        isSuccess: true,
        statusCode: response.statusCode,
        data: body,
      );
    } else {
      String message = 'Ocurrió un error inesperado';
      if (body is Map && body.containsKey('message')) {
        final msg = body['message'];
        message = msg is List ? msg.join(', ') : msg.toString();
      }
      return ApiResponse(
        isSuccess: false,
        statusCode: response.statusCode,
        data: body,
        errorMessage: message,
      );
    }
  }

  static Future<ApiResponse> get(String url) async {
    try {
      final headers = await _buildHeaders();
      final res = await http.get(Uri.parse(url), headers: headers);
      return _processResponse(res);
    } catch (e) {
      return ApiResponse(isSuccess: false, statusCode: 500, errorMessage: e.toString());
    }
  }

  static Future<ApiResponse> post(String url, Map<String, dynamic> data) async {
    try {
      final headers = await _buildHeaders();
      final res = await http.post(
        Uri.parse(url),
        headers: headers,
        body: jsonEncode(data),
      );
      return _processResponse(res);
    } catch (e) {
      return ApiResponse(isSuccess: false, statusCode: 500, errorMessage: e.toString());
    }
  }

  static Future<ApiResponse> patch(String url, Map<String, dynamic> data) async {
    try {
      final headers = await _buildHeaders();
      final res = await http.patch(
        Uri.parse(url),
        headers: headers,
        body: jsonEncode(data),
      );
      return _processResponse(res);
    } catch (e) {
      return ApiResponse(isSuccess: false, statusCode: 500, errorMessage: e.toString());
    }
  }
}
