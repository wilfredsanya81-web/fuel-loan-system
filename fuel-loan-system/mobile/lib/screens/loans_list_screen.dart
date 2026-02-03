import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fuel_loan_agent/auth_provider.dart';
import 'package:fuel_loan_agent/api/client.dart';
import 'package:fuel_loan_agent/config.dart';
import 'package:fuel_loan_agent/screens/loan_detail_screen.dart';

class LoansListScreen extends StatefulWidget {
  const LoansListScreen({super.key});

  @override
  State<LoansListScreen> createState() => _LoansListScreenState();
}

class _LoansListScreenState extends State<LoansListScreen> {
  List<dynamic> _active = [];
  List<dynamic> _overdue = [];
  bool _loading = true;
  String? _error;

  Future<void> _load() async {
    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final client = ApiClient(Config.apiBaseUrl, () => auth.token);
    final activeRes = await client.get('/api/loans/active');
    final overdueRes = await client.get('/api/loans/overdue');
    setState(() {
      _loading = false;
      if (activeRes.isOk && overdueRes.isOk) {
        _active = (activeRes.data?['loans'] as List?) ?? [];
        _overdue = (overdueRes.data?['loans'] as List?) ?? [];
        _error = null;
      } else {
        _error = activeRes.error ?? overdueRes.error;
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
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 16),
            FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry')),
          ],
        ),
      );
    }
    final all = [..._overdue, ..._active];
    if (all.isEmpty) {
      return const Center(child: Text('No active or overdue loans'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: all.length,
        itemBuilder: (context, i) {
          final loan = all[i] as Map<String, dynamic>;
          final loanId = loan['loan_id'] as int?;
          final status = loan['status'] as String? ?? '—';
          final principal = loan['principal_amount'];
          final outstanding = loan['outstanding_balance'];
          final dueAt = loan['due_at'];
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              title: Text('Loan #$loanId'),
              subtitle: Text(
                'Outstanding: $outstanding UGX · Due: ${dueAt != null ? _formatDate(dueAt) : "—"} · $status',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: loanId != null
                  ? () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => LoanDetailScreen(loanId: loanId),
                        ),
                      ).then((_) => _load())
                  : null,
            ),
          );
        },
      ),
    );
  }

  String _formatDate(dynamic v) {
    if (v == null) return '—';
    final s = v.toString();
    if (s.length >= 10) return s.substring(0, 10);
    return s;
  }
}
