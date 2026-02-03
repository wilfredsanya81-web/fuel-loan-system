import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fuel_loan_agent/api/client.dart';

class AuthProvider with ChangeNotifier {
  AuthProvider() {
    _loadStored();
  }

  static const _keyToken = 'auth_token';
  static const _keyUserId = 'user_id';
  static const _keyRole = 'role';
  static const _keyName = 'full_name';

  bool _isLoading = true;
  bool _isAuthenticated = false;
  String? _token;
  int? _userId;
  String? _role;
  String? _fullName;

  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  String? get token => _token;
  int? get userId => _userId;
  String? get role => _role;
  String? get fullName => _fullName;

  Future<void> _loadStored() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_keyToken);
    _userId = prefs.getInt(_keyUserId);
    _role = prefs.getString(_keyRole);
    _fullName = prefs.getString(_keyName);
    _isAuthenticated = _token != null && _token!.isNotEmpty;
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String baseUrl, String phone, String password) async {
    _isLoading = true;
    notifyListeners();
    final client = ApiClient(baseUrl, () => null);
    final res = await client.post('/api/auth/login', {'phone_number': phone, 'password': password});
    _isLoading = false;
    if (!res.isOk) {
      notifyListeners();
      return false;
    }
    final data = res.data!;
    _token = data['token'] as String?;
    final user = data['user'] as Map<String, dynamic>?;
    if (_token != null && user != null) {
      _userId = user['user_id'] as int?;
      _role = user['role'] as String?;
      _fullName = user['full_name'] as String?;
      _isAuthenticated = true;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyToken, _token!);
      if (_userId != null) await prefs.setInt(_keyUserId, _userId!);
      if (_role != null) await prefs.setString(_keyRole, _role!);
      if (_fullName != null) await prefs.setString(_keyName, _fullName!);
    }
    notifyListeners();
    return _isAuthenticated;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyRole);
    await prefs.remove(_keyName);
    _token = null;
    _userId = null;
    _role = null;
    _fullName = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
