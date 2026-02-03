import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fuel_loan_agent/auth_provider.dart';
import 'package:fuel_loan_agent/api/client.dart';
import 'package:fuel_loan_agent/config.dart';
import 'package:fuel_loan_agent/screens/loan_detail_screen.dart';

class IssueLoanScreen extends StatefulWidget {
  const IssueLoanScreen({this.riderId, super.key});

  final int? riderId;

  @override
  State<IssueLoanScreen> createState() => _IssueLoanScreenState();
}

class _IssueLoanScreenState extends State<IssueLoanScreen> {
  final _formKey = GlobalKey<FormState>();
  final _riderIdController = TextEditingController(text: '');
  final _principalController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.riderId != null) _riderIdController.text = widget.riderId.toString();
  }

  @override
  void dispose() {
    _riderIdController.dispose();
    _principalController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    _error = null;
    if (!_formKey.currentState!.validate()) return;
    final riderId = int.tryParse(_riderIdController.text.trim());
    if (riderId == null) {
      setState(() => _error = 'Invalid rider ID');
      return;
    }
    final principal = double.tryParse(_principalController.text.trim());
    if (principal == null || principal <= 0) {
      setState(() => _error = 'Invalid principal amount');
      return;
    }
    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final client = ApiClient(Config.apiBaseUrl, () => auth.token);
    final res = await client.post('/api/loans', {
      'rider_id': riderId,
      'principal_amount': principal,
    });
    setState(() => _loading = false);
    if (!mounted) return;
    if (res.isOk && res.data != null) {
      final loanId = res.data!['loan_id'] as int?;
      if (loanId != null) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => LoanDetailScreen(loanId: loanId),
          ),
        );
      } else {
        Navigator.pop(context, true);
      }
    } else {
      setState(() => _error = res.error ?? 'Failed to create loan');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Issue loan')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _riderIdController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Rider ID',
                  hintText: 'Enter rider ID',
                  prefixIcon: Icon(Icons.person),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Rider ID is required';
                  if (int.tryParse(v.trim()) == null) return 'Enter a valid number';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _principalController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Principal amount (UGX)',
                  hintText: 'e.g. 50000',
                  prefixIcon: Icon(Icons.attach_money),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Amount is required';
                  final n = double.tryParse(v.trim());
                  if (n == null || n <= 0) return 'Enter a valid amount';
                  return null;
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Create loan'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
