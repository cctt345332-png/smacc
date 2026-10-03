import 'package:flutter/material.dart';

import '../data/api_client.dart';

const _purple = Color(0xFF3E0865);
const _green = Color(0xFF147D58);

class CompanyDashboardScreen extends StatefulWidget {
  const CompanyDashboardScreen({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  State<CompanyDashboardScreen> createState() => _CompanyDashboardScreenState();
}

class _CompanyDashboardScreenState extends State<CompanyDashboardScreen> {
  Map<String, dynamic> summary = {};
  List<dynamic> reps = [], invoices = [], payments = [];
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
        widget.apiClient.getMap('/sales/invoices/system-summary'),
        widget.apiClient.getList('/reps'),
        widget.apiClient.getList('/sales/invoices'),
        widget.apiClient.getList('/sales/payments'),
      ]);
      if (!mounted) return;
      setState(() {
        summary = Map<String, dynamic>.from(result[0] as Map);
        reps = result[1] as List<dynamic>;
        invoices = result[2] as List<dynamic>;
        payments = result[3] as List<dynamic>;
        loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e;
          loading = false;
        });
      }
    }
  }

  String money(dynamic value) =>
      '${(num.tryParse('$value') ?? 0).toStringAsFixed(2)} ر.س';

  bool _isCurrentMonth(dynamic value) {
    final date = DateTime.tryParse(value?.toString() ?? '');
    if (date == null) return false;
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'لوحة مدير الشركة',
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
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  _WelcomeCard(summary: summary),
                  const SizedBox(height: 14),
                  _SectionTitle(
                    title: 'ملخص الشركة',
                    icon: Icons.insights_outlined,
                  ),
                  const SizedBox(height: 8),
                  _MetricGrid(summary: summary, money: money),
                  const SizedBox(height: 18),
                  _SectionTitle(title: 'المناديب', icon: Icons.groups_outlined),
                  const SizedBox(height: 8),
                  if (reps.isEmpty)
                    const _Empty(text: 'لا يوجد مناديب مسجلون')
                  else
                    ..._sortedRepTiles(),
                ],
              ),
            ),
    );
  }

  List<Widget> _sortedRepTiles() {
    final items = reps.map((x) => Map<String, dynamic>.from(x as Map)).toList();
    final stats = <String, Map<String, num>>{};
    for (final raw in invoices) {
      final item = Map<String, dynamic>.from(raw as Map);
      final status = '${item['status'] ?? ''}'.toLowerCase();
      final id = item['rep_id']?.toString();
      if (id == null ||
          !_isCurrentMonth(item['issue_date']) ||
          ['draft', 'rejected', 'cancelled'].contains(status))
        continue;
      stats.putIfAbsent(id, () => {'sales': 0, 'collected': 0});
      stats[id]!['sales'] =
          stats[id]!['sales']! + (num.tryParse('${item['total'] ?? 0}') ?? 0);
    }
    for (final raw in payments) {
      final item = Map<String, dynamic>.from(raw as Map);
      final id = item['rep_id']?.toString();
      final type =
          '${item['payment_type'] ?? item['voucher_type'] ?? 'receipt'}'
              .toLowerCase();
      if (id == null ||
          !_isCurrentMonth(item['payment_date']) ||
          type == 'discount') {
        continue;
      }
      stats.putIfAbsent(id, () => {'sales': 0, 'collected': 0});
      stats[id]!['collected'] =
          stats[id]!['collected']! +
          (num.tryParse('${item['amount'] ?? 0}') ?? 0);
    }
    for (final item in items) {
      final values =
          stats[item['id']?.toString()] ?? {'sales': 0, 'collected': 0};
      item['sales_total'] = values['sales'] ?? 0;
      item['total_collected'] = values['collected'] ?? 0;
    }
    items.sort(
      (a, b) =>
          (a['sales_total'] as num).compareTo(b['sales_total'] as num) * -1,
    );
    return items.map((item) => _RepTile(rep: item)).toList();
  }
}

class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard({required this.summary});
  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    color: _purple,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white24,
            child: Icon(Icons.business_rounded, color: Colors.white, size: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'مرحباً بك في لوحة الشركة',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'أداء الشهر الحالي • ${summary['invoice_count'] ?? 0} فاتورة مؤكدة',
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

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.summary, required this.money});
  final Map<String, dynamic> summary;
  final String Function(dynamic) money;

  @override
  Widget build(BuildContext context) {
    final metrics = [
      (
        'مبيعات الشهر',
        money(summary['sales_total']),
        Icons.trending_up,
        _green,
      ),
      (
        'المحصل',
        money(summary['total_collected']),
        Icons.payments_outlined,
        _green,
      ),
      (
        'إجمالي الذمم',
        money(summary['outstanding_total']),
        Icons.account_balance_wallet_outlined,
        const Color(0xFFB06A00),
      ),
      (
        'الرصيد الافتتاحي',
        money(summary['opening_balance']),
        Icons.history,
        const Color(0xFF8E4A18),
      ),
      (
        'الربح التقديري',
        money(summary['estimated_gross_profit']),
        Icons.auto_graph,
        _purple,
      ),
      (
        'عملاء جدد',
        '${summary['new_customers'] ?? 0}',
        Icons.person_add_alt_1,
        const Color(0xFF356B63),
      ),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: metrics.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.48,
      ),
      itemBuilder: (_, index) {
        final item = metrics[index];
        return Card(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFE7DFEB)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(13),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(item.$3, color: item.$4),
                Text(
                  item.$1,
                  style: const TextStyle(color: Colors.black54, fontSize: 12),
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Text(
                    item.$2,
                    style: TextStyle(
                      color: item.$4,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _RepTile extends StatelessWidget {
  const _RepTile({required this.rep});
  final Map<String, dynamic> rep;

  @override
  Widget build(BuildContext context) {
    final name = (rep['full_name'] ?? rep['name'] ?? rep['name_ar'] ?? 'مندوب')
        .toString();
    final code = (rep['rep_code'] ?? rep['code'] ?? '').toString();
    final zone = (rep['zone'] ?? rep['city'] ?? '').toString();
    final sales =
        num.tryParse('${rep['sales_total'] ?? rep['total_sales'] ?? 0}') ?? 0;
    final collected =
        num.tryParse('${rep['total_collected'] ?? rep['collected'] ?? 0}') ?? 0;
    final target = num.tryParse('${rep['target_monthly'] ?? 0}') ?? 0;
    final progress = target <= 0
        ? 0.0
        : (sales / target).clamp(0.0, 1.0).toDouble();
    final progressPercent = target <= 0 ? null : (sales / target * 100).round();
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(15),
        side: const BorderSide(color: Color(0xFFE7DFEB)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
        child: Column(
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: Color(0xFFEFE7F5),
                child: Icon(Icons.person_outline, color: _purple),
              ),
              title: Text(
                name,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                [code, zone].where((x) => x.isNotEmpty).join(' • '),
              ),
              trailing: Text(
                '${sales.toStringAsFixed(0)} ر.س',
                style: const TextStyle(
                  color: _purple,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            LinearProgressIndicator(
              value: progress,
              color: _purple,
              backgroundColor: const Color(0xFFEFE7F5),
            ),
            const SizedBox(height: 5),
            Row(
              children: [
                Expanded(
                  child: Text(
                    target > 0
                        ? 'الهدف الشهري: ${target.toStringAsFixed(2)} ر.س  •  الإنجاز: $progressPercent%'
                        : 'الهدف الشهري غير محدد',
                    style: const TextStyle(fontSize: 10, color: Colors.black54),
                  ),
                ),
                Text(
                  'المحصل: ${collected.toStringAsFixed(2)} ر.س',
                  style: const TextStyle(fontSize: 10, color: Colors.black54),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.icon});
  final String title;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, color: _purple),
      const SizedBox(width: 8),
      Text(
        title,
        style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
      ),
    ],
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Center(
      child: Text(text, style: const TextStyle(color: Colors.black54)),
    ),
  );
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.error, required this.retry});
  final Object error;
  final Future<void> Function() retry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 42),
          const SizedBox(height: 10),
          Text(
            'تعذر تحميل بيانات لوحة الشركة\n$error',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 14),
          FilledButton(onPressed: retry, child: const Text('إعادة المحاولة')),
        ],
      ),
    ),
  );
}
