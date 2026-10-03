import 'package:flutter/material.dart';

import '../data/api_client.dart';
import 'rep_extra.dart';
import 'company_rep_reports_screen.dart';

const _purple = Color(0xFF3E0865);

class CompanyReportsScreen extends StatelessWidget {
  const CompanyReportsScreen({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'تقارير الشركة',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'التقارير المالية',
          style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        const Text(
          'اختر التقرير المطلوب لعرض حركة العملاء والذمم بالتفصيل.',
          style: TextStyle(color: Colors.black54),
        ),
        const SizedBox(height: 18),
        _ReportTile(
          icon: Icons.account_balance_wallet_outlined,
          title: 'كشوفات حساب العملاء',
          subtitle: 'كشف عميل واحد أو جميع العملاء مع حركة الحساب والطباعة',
          onTap: () => Navigator.push<void>(
            context,
            MaterialPageRoute(
              builder: (_) => CustomerStatementsScreen(apiClient: apiClient),
            ),
          ),
        ),
        _ReportTile(
          icon: Icons.schedule_outlined,
          title: 'أعمار الديون',
          subtitle: 'الفواتير المستحقة، المسدد، المتبقي، وعدد أيام الفاتورة',
          onTap: () => Navigator.push<void>(
            context,
            MaterialPageRoute(
              builder: (_) => CompanyAgingScreen(apiClient: apiClient),
            ),
          ),
        ),
        _ReportTile(
          icon: Icons.groups_outlined,
          title: 'حركة المندوبين',
          subtitle: 'فواتير وسندات كل مندوب مع الفلترة والطباعة',
          onTap: () => Navigator.push<void>(
            context,
            MaterialPageRoute(
              builder: (_) => CompanyRepReportsScreen(apiClient: apiClient),
            ),
          ),
        ),
      ],
    ),
  );
}

class _ReportTile extends StatelessWidget {
  const _ReportTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    margin: const EdgeInsets.only(bottom: 12),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(17),
      side: const BorderSide(color: Color(0xFFE5DDE9)),
    ),
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFEFE7F5),
        child: Icon(icon, color: _purple),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 5),
        child: Text(subtitle),
      ),
      trailing: const Icon(Icons.chevron_left),
      onTap: onTap,
    ),
  );
}

class CompanyAgingScreen extends StatefulWidget {
  const CompanyAgingScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<CompanyAgingScreen> createState() => _CompanyAgingScreenState();
}

class _CompanyAgingScreenState extends State<CompanyAgingScreen> {
  bool loading = true;
  Object? error;
  List<Map<String, dynamic>> rows = [];
  List<dynamic> customers = [];
  List<dynamic> reps = [];
  List<dynamic> invoices = [];
  List<dynamic> payments = [];
  String? customerId;
  String? repId;

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
        widget.apiClient.getList('/sales/invoices'),
        widget.apiClient.getList('/sales/payments'),
        widget.apiClient.getList('/sales/customers'),
        widget.apiClient.getList('/reps'),
      ]);
      invoices = result[0] as List<dynamic>;
      payments = result[1] as List<dynamic>;
      customers = result[2] as List<dynamic>;
      reps = result[3] as List<dynamic>;
      _calculate(invoices, payments);
      if (mounted) setState(() => loading = false);
    } catch (e) {
      if (mounted)
        setState(() {
          error = e;
          loading = false;
        });
    }
  }

  void _calculate(List<dynamic> invoices, List<dynamic> payments) {
    final now = DateTime.now();
    final customerNames = <String, String>{};
    final repNames = <String, String>{};
    for (final item in customers) {
      final c = Map<String, dynamic>.from(item as Map);
      customerNames[c['id'].toString()] =
          (c['name_ar'] ?? c['customer_number'] ?? '—').toString();
    }
    for (final item in reps) {
      final r = Map<String, dynamic>.from(item as Map);
      repNames[r['id'].toString()] =
          (r['full_name'] ?? r['name_ar'] ?? r['name'] ?? '—').toString();
    }
    final direct = <String, double>{};
    for (final item in payments) {
      final p = Map<String, dynamic>.from(item as Map);
      if (p['invoice_id'] == null && p['customer_id'] != null) {
        direct[p['customer_id'].toString()] =
            (direct[p['customer_id'].toString()] ?? 0) + _number(p['amount']);
      }
    }
    final result = <Map<String, dynamic>>[];
    for (final item in invoices) {
      final inv = Map<String, dynamic>.from(item as Map);
      final status = '${inv['status']}'.toLowerCase();
      if (['draft', 'submitted', 'rejected', 'cancelled'].contains(status))
        continue;
      if (customerId != null && inv['customer_id']?.toString() != customerId)
        continue;
      if (repId != null && inv['rep_id']?.toString() != repId) continue;
      final sold = _number(inv['total']);
      if (sold <= .01) continue;
      final invoicePaid = payments
          .where((p) {
            final x = Map<String, dynamic>.from(p as Map);
            return x['invoice_id']?.toString() == inv['id']?.toString();
          })
          .fold<double>(
            0,
            (sum, p) =>
                sum + _number(Map<String, dynamic>.from(p as Map)['amount']),
          );
      final key = inv['customer_id']?.toString() ?? '';
      final directPaid = (direct[key] ?? 0).clamp(0, sold - invoicePaid);
      direct[key] = (direct[key] ?? 0) - directPaid;
      final paid = invoicePaid + directPaid;
      final date =
          DateTime.tryParse('${inv['issue_date'] ?? inv['created_at']}') ?? now;
      final balance = sold - paid;
      if (balance <= .01) continue;
      result.add({
        'customer': inv['buyer_name_ar'] ?? customerNames[key] ?? '—',
        'rep': repNames[inv['rep_id']?.toString()] ?? '—',
        'invoice': inv['invoice_number'] ?? '—',
        'date': date,
        'sold': sold,
        'paid': paid,
        'balance': balance,
        'days': now
            .difference(DateTime(date.year, date.month, date.day))
            .inDays,
      });
    }
    result.sort((a, b) => (b['days'] as int).compareTo(a['days'] as int));
    rows = result;
  }

  void _calculateFromCurrentData() {
    _calculate(invoices, payments);
    setState(() {});
  }

  double _number(dynamic value) => double.tryParse('$value') ?? 0;
  String money(dynamic value) => '${(value as num).toStringAsFixed(2)} ر.س';

  @override
  Widget build(BuildContext context) {
    final total = rows.fold<double>(0, (s, r) => s + (r['balance'] as double));
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'أعمار الديون',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
          ? Center(
              child: Text(
                'تعذر تحميل التقرير\n$error',
                textAlign: TextAlign.center,
              ),
            )
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  DropdownButtonFormField<String?>(
                    initialValue: customerId,
                    decoration: const InputDecoration(
                      labelText: 'العميل',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('كل العملاء'),
                      ),
                      ...customers.map((item) {
                        final c = Map<String, dynamic>.from(item as Map);
                        return DropdownMenuItem<String?>(
                          value: c['id']?.toString(),
                          child: Text(
                            '${c['name_ar'] ?? c['customer_number'] ?? '—'}',
                          ),
                        );
                      }),
                    ],
                    onChanged: (value) {
                      setState(() {
                        customerId = value;
                      });
                      load();
                    },
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String?>(
                    initialValue: repId,
                    decoration: const InputDecoration(
                      labelText: 'المندوب',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('كل المناديب'),
                      ),
                      ...reps.map((item) {
                        final r = Map<String, dynamic>.from(item as Map);
                        return DropdownMenuItem<String?>(
                          value: r['id']?.toString(),
                          child: Text(
                            '${r['full_name'] ?? r['name_ar'] ?? r['name'] ?? 'مندوب'}',
                          ),
                        );
                      }),
                    ],
                    onChanged: (value) {
                      setState(() => repId = value);
                      _calculateFromCurrentData();
                    },
                  ),
                  const SizedBox(height: 12),
                  Card(
                    elevation: 0,
                    color: const Color(0xFFF1EAF5),
                    child: ListTile(
                      title: const Text(
                        'إجمالي المتبقي',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      trailing: Text(
                        money(total),
                        style: const TextStyle(
                          color: _purple,
                          fontWeight: FontWeight.w900,
                          fontSize: 17,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (rows.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(30),
                      child: Center(
                        child: Text(
                          'لا توجد فواتير مستحقة ضمن البيانات الحالية',
                        ),
                      ),
                    ),
                  ...rows.map(_rowCard),
                ],
              ),
            ),
    );
  }

  Widget _rowCard(Map<String, dynamic> row) => Card(
    elevation: 0,
    margin: const EdgeInsets.only(bottom: 8),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(14),
      side: const BorderSide(color: Color(0xFFE5DDE9)),
    ),
    color: (row['days'] as int) >= 30
        ? const Color(0xFFFFE7E5)
        : (row['days'] as int) > 21
        ? const Color(0xFFFFF3D6)
        : Colors.white,
    child: Padding(
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${row['customer']}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                money(row['balance']),
                style: const TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'الفاتورة: ${row['invoice']}  •  التاريخ: ${(row['date'] as DateTime).toIso8601String().split('T').first}',
          ),
          Text('المندوب: ${row['rep']}'),
          Text(
            'العمر: ${row['days']} يوم  •  الإجمالي: ${money(row['sold'])}  •  المسدد: ${money(row['paid'])}',
            style: TextStyle(
              color: (row['days'] as int) >= 30
                  ? Colors.red.shade800
                  : (row['days'] as int) > 21
                  ? Colors.orange.shade900
                  : null,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );
}
