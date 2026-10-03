import 'package:flutter/material.dart';

import '../data/api_client.dart';
import 'supervisor_statements.dart';

const _supervisorPurple = Color(0xFF3E0865);

class SupervisorShell extends StatefulWidget {
  const SupervisorShell({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<SupervisorShell> createState() => _SupervisorShellState();
}

class _SupervisorShellState extends State<SupervisorShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) {
    final pages = [
      SupervisorDashboardScreen(apiClient: widget.apiClient),
      SupervisorRecordsScreen(apiClient: widget.apiClient, kind: 'invoices'),
      SupervisorRecordsScreen(apiClient: widget.apiClient, kind: 'payments'),
      SupervisorReportsScreen(apiClient: widget.apiClient),
    ];
    return Scaffold(
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'الفواتير',
          ),
          NavigationDestination(
            icon: Icon(Icons.payments_outlined),
            selectedIcon: Icon(Icons.payments),
            label: 'السندات',
          ),
          NavigationDestination(
            icon: Icon(Icons.analytics_outlined),
            selectedIcon: Icon(Icons.analytics),
            label: 'التقارير',
          ),
        ],
      ),
    );
  }
}

class SupervisorDashboardScreen extends StatefulWidget {
  const SupervisorDashboardScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<SupervisorDashboardScreen> createState() =>
      _SupervisorDashboardScreenState();
}

class _SupervisorDashboardScreenState extends State<SupervisorDashboardScreen> {
  Map<String, dynamic>? summary;
  List<dynamic> reps = [];
  Object? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await Future.wait<Object>([
        widget.apiClient.getMap('/supervisors/me/summary'),
        widget.apiClient.getList('/supervisors/me/reps'),
      ]);
      if (!mounted) return;
      setState(() {
        summary = result[0] as Map<String, dynamic>;
        reps = result[1] as List<dynamic>;
        loading = false;
      });
    } catch (e) {
      if (mounted)
        setState(() {
          error = e;
          loading = false;
        });
    }
  }

  String money(dynamic value) =>
      '${(num.tryParse('$value') ?? 0).toStringAsFixed(2)} ر.س';
  List<Map<String, dynamic>> get repSummaries =>
      ((summary?['rep_summaries'] as List?) ?? [])
          .map((x) => Map<String, dynamic>.from(x as Map))
          .toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'لوحة المشرف',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
          ? _ErrorPanel(error: error!, retry: load)
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _Header(reps: reps.length, summary: summary ?? {}),
                  const SizedBox(height: 14),
                  _Metrics(summary: summary ?? {}, money: money),
                  const SizedBox(height: 18),
                  const Text(
                    'المناديب التابعون للمشرف',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  if (repSummaries.isEmpty)
                    const _Empty(text: 'لا يوجد مناديب مرتبطون بهذا المشرف'),
                  ...repSummaries.map(
                    (rep) => _RepCard(rep: rep, money: money),
                  ),
                  if (repSummaries.isEmpty && reps.isNotEmpty)
                    ...reps.map(
                      (x) => _RepCard(
                        rep: Map<String, dynamic>.from(x as Map),
                        money: money,
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.reps, required this.summary});
  final int reps;
  final Map<String, dynamic> summary;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: _supervisorPurple,
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 27,
            backgroundColor: Colors.white24,
            child: Icon(Icons.manage_accounts, color: Colors.white, size: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'مرحباً بك في لوحة المشرف',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  '$reps مندوب تابع لك • ${summary['payment_count'] ?? 0} سند',
                  style: const TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _Metrics extends StatelessWidget {
  const _Metrics({required this.summary, required this.money});
  final Map<String, dynamic> summary;
  final String Function(dynamic) money;
  @override
  Widget build(BuildContext context) {
    final cards = [
      (
        'إجمالي المبيعات',
        money(summary['total_sales']),
        Icons.trending_up,
        const Color(0xFF147D58),
      ),
      (
        'إجمالي المحصل',
        money(summary['total_collected']),
        Icons.payments,
        const Color(0xFF147D58),
      ),
      (
        'المتبقي',
        money(summary['outstanding']),
        Icons.warning_amber,
        const Color(0xFFB43D32),
      ),
      (
        'الفواتير',
        '${summary['invoice_count'] ?? 0}',
        Icons.receipt_long,
        _supervisorPurple,
      ),
    ];
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 1.45,
      children: cards
          .map(
            (c) => Card(
              elevation: 0,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(c.$3, color: c.$4),
                    const SizedBox(height: 8),
                    Text(c.$1, style: const TextStyle(color: Colors.black54)),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        c.$2,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: c.$4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _RepCard extends StatelessWidget {
  const _RepCard({required this.rep, required this.money});
  final Map<String, dynamic> rep;
  final String Function(dynamic) money;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    margin: const EdgeInsets.only(bottom: 10),
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          Row(
            children: [
              const CircleAvatar(
                backgroundColor: Color(0xFFEDE2F2),
                child: Icon(Icons.person, color: _supervisorPurple),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${rep['full_name'] ?? rep['name'] ?? '—'}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      '${rep['rep_code'] ?? '—'}',
                      style: const TextStyle(color: Colors.black54),
                    ),
                  ],
                ),
              ),
              Text(
                '${rep['invoice_count'] ?? 0} فاتورة',
                style: const TextStyle(
                  color: _supervisorPurple,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const Divider(height: 22),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _SmallStat('المبيعات', money(rep['total_sales'])),
              _SmallStat('المحصل', money(rep['total_collected'])),
              _SmallStat('المتبقي', money(rep['outstanding'])),
            ],
          ),
        ],
      ),
    ),
  );
}

class _SmallStat extends StatelessWidget {
  const _SmallStat(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(label, style: const TextStyle(fontSize: 11, color: Colors.black54)),
      const SizedBox(height: 3),
      Text(
        value,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
      ),
    ],
  );
}

class SupervisorRecordsScreen extends StatefulWidget {
  const SupervisorRecordsScreen({
    required this.apiClient,
    required this.kind,
    super.key,
  });
  final ApiClient apiClient;
  final String kind;
  @override
  State<SupervisorRecordsScreen> createState() =>
      _SupervisorRecordsScreenState();
}

class _SupervisorRecordsScreenState extends State<SupervisorRecordsScreen> {
  List<Map<String, dynamic>> rows = [], reps = [];
  String? repId;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final result = await Future.wait([
        widget.apiClient.getList('/supervisors/me/${widget.kind}'),
        widget.apiClient.getList('/supervisors/me/reps'),
      ]);
      if (mounted)
        setState(() {
          rows = result[0]
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          reps = result[1]
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  String money(dynamic x) =>
      '${(num.tryParse('$x') ?? 0).toStringAsFixed(2)} ر.س';
  @override
  Widget build(BuildContext context) {
    final filtered = repId == null
        ? rows
        : rows.where((x) => '${x['rep_id']}' == repId).toList();
    final title = widget.kind == 'invoices'
        ? 'فواتير المناديب'
        : 'سندات المناديب';
    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(14),
              children: [
                DropdownButtonFormField<String>(
                  initialValue: repId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'فرز حسب المندوب',
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: null,
                      child: Text('كل المناديب'),
                    ),
                    ...reps.map(
                      (r) => DropdownMenuItem(
                        value: '${r['id']}',
                        child: Text('${r['full_name'] ?? r['rep_code']}'),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => repId = v),
                ),
                const SizedBox(height: 12),
                if (filtered.isEmpty) const _Empty(text: 'لا توجد بيانات'),
                ...filtered.map(
                  (x) => _RecordCard(
                    row: x,
                    invoice: widget.kind == 'invoices',
                    money: money,
                  ),
                ),
              ],
            ),
    );
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({
    required this.row,
    required this.invoice,
    required this.money,
  });
  final Map<String, dynamic> row;
  final bool invoice;
  final String Function(dynamic) money;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    margin: const EdgeInsets.only(bottom: 8),
    child: ListTile(
      leading: Icon(
        invoice ? Icons.receipt_long : Icons.payments,
        color: _supervisorPurple,
      ),
      title: Text(
        '${row[invoice ? 'invoice_number' : 'payment_number'] ?? '—'}',
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(
        '${row['buyer_name_ar'] ?? row['customer_name'] ?? '—'}\nالمندوب: ${row['rep_name'] ?? '—'}',
      ),
      isThreeLine: true,
      trailing: Text(
        money(row[invoice ? 'total' : 'amount']),
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
  );
}

class SupervisorReportsScreen extends StatefulWidget {
  const SupervisorReportsScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<SupervisorReportsScreen> createState() =>
      _SupervisorReportsScreenState();
}

class _SupervisorReportsScreenState extends State<SupervisorReportsScreen> {
  List<Map<String, dynamic>> rows = [], reps = [];
  String? repId;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    final now = DateTime.now();
    try {
      final result = await Future.wait([
        widget.apiClient.getList(
          '/supervisors/me/customer-statements?from_date=2020-01-01T00:00:00&to_date=${Uri.encodeQueryComponent(now.toIso8601String())}',
        ),
        widget.apiClient.getList('/supervisors/me/reps'),
      ]);
      if (mounted)
        setState(() {
          rows = result[0]
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          reps = result[1]
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = repId == null
        ? rows
        : rows.where((x) => '${x['rep_id']}' == repId).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'تقارير العملاء',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(14),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => SupervisorStatementsScreen(
                              apiClient: widget.apiClient,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.account_balance_wallet),
                        label: const Text('كشوفات العملاء'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => SupervisorAgingScreen(
                              apiClient: widget.apiClient,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.schedule),
                        label: const Text('أعمار الديون'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: repId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'تقرير عملاء المندوب',
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: null,
                      child: Text('كل المناديب'),
                    ),
                    ...reps.map(
                      (r) => DropdownMenuItem(
                        value: '${r['id']}',
                        child: Text('${r['full_name'] ?? r['rep_code']}'),
                      ),
                    ),
                  ],
                  onChanged: (v) => setState(() => repId = v),
                ),
                const SizedBox(height: 12),
                if (filtered.isEmpty) const _Empty(text: 'لا توجد كشوفات'),
                ...filtered.map((x) => _StatementCard(data: x)),
              ],
            ),
    );
  }
}

class _StatementCard extends StatelessWidget {
  const _StatementCard({required this.data});
  final Map<String, dynamic> data;
  String money(dynamic x) =>
      '${(num.tryParse('$x') ?? 0).toStringAsFixed(2)} ر.س';
  @override
  Widget build(BuildContext context) {
    final customer = Map<String, dynamic>.from(
      (data['customer'] as Map?) ?? {},
    );
    final summary = Map<String, dynamic>.from((data['summary'] as Map?) ?? {});
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(
          Icons.account_balance_wallet,
          color: _supervisorPurple,
        ),
        title: Text(
          '${customer['name_ar'] ?? '—'}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          'مندوب: ${data['rep_name'] ?? data['full_name'] ?? data['rep_code'] ?? '—'}\nمشرف: ${data['supervisor_name'] ?? '—'}\nالفواتير: ${money(summary['total_invoiced'])} • المقبوض: ${money(summary['total_paid'])}',
        ),
        isThreeLine: true,
        trailing: Text(
          money(summary['closing_balance'] ?? summary['outstanding']),
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xFFB43D32),
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(28),
    child: Center(
      child: Text(text, style: const TextStyle(color: Colors.black54)),
    ),
  );
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.error, required this.retry});
  final Object error;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 42, color: Colors.red),
          const SizedBox(height: 10),
          Text('تعذر تحميل لوحة المشرف\n$error', textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(onPressed: retry, child: const Text('إعادة المحاولة')),
        ],
      ),
    ),
  );
}
