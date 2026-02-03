import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:fuel_loan_agent/auth_provider.dart';

class ApiClient {
  ApiClient(this._baseUrl, this._getToken);

  final String _baseUrl;
  final String? Function() _getToken;

  Map<String, String> get _headers {
    final headers = {'Content-Type': 'application/json', 'Accept': 'application/json'};
    final token = _getToken();
    if (token != null) headers['Authorization'] = 'Bearer $token';
    return headers;
  }

  Future<ApiResponse> get(String path) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl$path'), headers: _headers);
      return _handleResponse(res);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }

  Future<ApiResponse> post(String path, Map<String, dynamic> body) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl$path'),
        headers: _headers,
        body: jsonEncode(body),
      );
      return _handleResponse(res);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }

  Future<ApiResponse> patch(String path, Map<String, dynamic> body) async {
    try {
      final res = await http.patch(
        Uri.parse('$_baseUrl$path'),
        headers: _headers,
        body: jsonEncode(body),
      );
      return _handleResponse(res);
    } catch (e) {
      return ApiResponse.error(e.toString());
    }
  }

  ApiResponse _handleResponse(http.Response res) {
    final body = res.body.isEmpty ? null : (jsonDecode(res.body) as Map<String, dynamic>?);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return ApiResponse(data: body);
    }
    final message = body?['error'] ?? body?['message'] ?? 'Request failed (${res.statusCode})';
    return ApiResponse.error(message is String ? message : 'Request failed');
  }
}

class ApiResponse {
  ApiResponse({this.data, this.error});

  final Map<String, dynamic>? data;
  final String? error;

  factory ApiResponse.error(String msg) => ApiResponse(error: msg);

  bool get isOk => error == null;
}
