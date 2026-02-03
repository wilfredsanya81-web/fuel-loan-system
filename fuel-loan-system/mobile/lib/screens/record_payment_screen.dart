import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fuel_loan_agent/auth_provider.dart';
import 'package:fuel_loan_agent/api/client.dart';
import 'package:fuel_loan_agent/config.dart';

class RecordPaymentScreen extends StatefulWidget {
  const RecordPaymentScreen({required this.loanId, super.key});

  final int loanId;

  @override
  State<RecordPaymentScreen> createState() => _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends State<RecordPaymentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  String _method = 'CASH';
  bool _loading = false;
  String? _error;

  static const _methods = ['CASH', 'MTN', 'AIRTEL', 'BANK', 'OTHER'];

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    _error = null;
    if (!_formKey.currentState!.validate()) return;
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Invalid amount');
      return;
    }
    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final client = ApiClient(Config.apiBaseUrl, () => auth.token);
    final res = await client.post('/api/loans/${widget.loanId}/payments', {
      'amount_paid': amount,
      'payment_method': _method,
    });
    setState(() => _loading = false);
    if (!mounted) return;
    if (res.isOk) {
      Navigator.pop(context, true);
    } else {
      setState(() => _error = res.error ?? 'Payment failed');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Record payment · Loan #${widget.loanId}')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Amount (UGX)',
                  hintText: 'e.g. 55000',
                  prefixIcon: Icon(Icons.attach_money),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Amount is required';
                  final n = double.tryParse(v.trim());
                  if (n == null || n <= 0) return 'Enter a valid amount';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _method,
                decoration: const InputDecoration(
                  labelText: 'Payment method',
                  prefixIcon: Icon(Icons.payment),
                ),
                items: _methods.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                onChanged: (v) => setState(() => _method = v ?? 'CASH'),
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
                    : const Text('Record payment'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
