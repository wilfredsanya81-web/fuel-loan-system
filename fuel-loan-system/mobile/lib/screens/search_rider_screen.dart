import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fuel_loan_agent/auth_provider.dart';
import 'package:fuel_loan_agent/api/client.dart';
import 'package:fuel_loan_agent/config.dart';
import 'package:fuel_loan_agent/screens/issue_loan_screen.dart';

class SearchRiderScreen extends StatefulWidget {
  const SearchRiderScreen({super.key});

  @override
  State<SearchRiderScreen> createState() => _SearchRiderScreenState();
}

class _SearchRiderScreenState extends State<SearchRiderScreen> {
  final _queryController = TextEditingController();
  List<dynamic> _riders = [];
  bool _loading = false;
  String? _error;
  bool _searched = false;

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final q = _queryController.text.trim();
    if (q.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
      _searched = true;
    });
    final auth = context.read<AuthProvider>();
    final client = ApiClient(Config.apiBaseUrl, () => auth.token);
    final res = await client.get('/api/riders/search?q=${Uri.encodeComponent(q)}');
    setState(() {
      _loading = false;
      if (res.isOk) {
        _riders = (res.data?['riders'] as List?) ?? [];
        _error = null;
      } else {
        _riders = [];
        _error = res.error;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _queryController,
            decoration: InputDecoration(
              labelText: 'Search rider (name, phone, national ID, bike)',
              hintText: 'e.g. John or 0700123456',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.search),
                onPressed: _loading ? null : _search,
              ),
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _search(),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else if (_error != null)
            Center(
              child: Column(
                children: [
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  const SizedBox(height: 8),
                  FilledButton(onPressed: _search, child: const Text('Retry')),
                ],
              ),
            )
          else if (_searched && _riders.isEmpty)
            const Center(child: Text('No riders found'))
          else if (_riders.isNotEmpty)
            Expanded(
              child: ListView.builder(
                itemCount: _riders.length,
                itemBuilder: (context, i) {
                  final r = _riders[i] as Map<String, dynamic>;
                  final name = r['full_name'] ?? '—';
                  final phone = r['phone_number'] ?? '—';
                  final status = r['status'] ?? '—';
                  final riderId = r['rider_id'] as int?;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(name.toString()),
                      subtitle: Text('$phone · $status'),
                      trailing: status == 'ACTIVE'
                          ? FilledButton(
                              onPressed: riderId != null
                                  ? () => Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) => IssueLoanScreen(riderId: riderId),
                                        ),
                                      )
                                  : null,
                              child: const Text('Issue loan'),
                            )
                          : null,
                      onTap: riderId != null
                          ? () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => IssueLoanScreen(riderId: riderId),
                                ),
                              )
                          : null,
                    ),
                  );
                },
              ),
            )
          else
            const SizedBox.shrink(),
        ],
      ),
    );
  }
}
