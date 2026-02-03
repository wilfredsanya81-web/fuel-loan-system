import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fuel_loan_agent/auth_provider.dart';
import 'package:fuel_loan_agent/api/client.dart';
import 'package:fuel_loan_agent/config.dart';
import 'package:fuel_loan_agent/screens/record_payment_screen.dart';

class LoanDetailScreen extends StatefulWidget {
  const LoanDetailScreen({required this.loanId, super.key});

  final int loanId;

  @override
  State<LoanDetailScreen> createState() => _LoanDetailScreenState();
}

class _LoanDetailScreenState extends State<LoanDetailScreen> {
  Map<String, dynamic>? _loan;
  Map<String, dynamic>? _rider;
  List<dynamic> _payments = [];
  bool _loading = true;
  String? _error;

  Future<void> _load() async {
    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final client = ApiClient(Config.apiBaseUrl, () => auth.token);
    final res = await client.get('/api/loans/${widget.loanId}');
    setState(() {
      _loading = false;
      if (res.isOk && res.data != null) {
        _loan = res.data!['loan'] as Map<String, dynamic>?;
        _rider = res.data!['rider'] as Map<String, dynamic>?;
        _payments = (res.data!['payments'] as List?) ?? [];
        _error = null;
      } else {
        _error = res.error;
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null || _loan == null) {
      return Scaffold(
        appBar: AppBar(title: Text('Loan #${widget.loanId}')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_error ?? 'Loan not found', style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 16),
              FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    final status = _loan!['status'] as String? ?? '—';
    final canPay = status == 'ACTIVE' || status == 'OVERDUE';
    return Scaffold(
      appBar: AppBar(title: Text('Loan #${widget.loanId}')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _row('Status', status),
                    _row('Principal', '${_loan!['principal_amount']} UGX'),
                    _row('Service charge', '${_loan!['service_charge']} UGX'),
                    _row('Outstanding', '${_loan!['outstanding_balance']} UGX'),
                    _row('Total penalty', '${_loan!['total_penalty']} UGX'),
                    _row('Due at', _formatDate(_loan!['due_at'])),
                  ],
                ),
              ),
            ),
            if (_rider != null) ...[
              const SizedBox(height: 12),
              Card(
                child: ListTile(
                  title: Text(_rider!['full_name']?.toString() ?? '—'),
                  subtitle: Text(_rider!['phone_number']?.toString() ?? '—'),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text('Payments (${_payments.length})', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ...(_payments.isEmpty
                ? [const ListTile(title: Text('No payments yet'))]
                : _payments.map((p) {
                    final pay = p as Map<String, dynamic>;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 4),
                      child: ListTile(
                        title: Text('${pay['amount_paid']} UGX'),
                        subtitle: Text('${pay['payment_method']} · ${_formatDate(pay['payment_time'])}'),
                      ),
                    );
                  })),
            if (canPay) ...[
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => RecordPaymentScreen(loanId: widget.loanId),
                  ),
                ).then((_) => _load()),
                icon: const Icon(Icons.payment),
                label: const Text('Record payment'),
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: const TextStyle(fontWeight: FontWeight.w500)), Text(value)],
      ),
    );
  }

  String _formatDate(dynamic v) {
    if (v == null) return '—';
    final s = v.toString();
    if (s.length >= 19) return s.substring(0, 19).replaceFirst('T', ' ');
    if (s.length >= 10) return s.substring(0, 10);
    return s;
  }
}
