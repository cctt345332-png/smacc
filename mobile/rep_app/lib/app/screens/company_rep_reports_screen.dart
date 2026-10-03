import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../data/api_client.dart';

const _repPurple = Color(0xFF3E0865);

class CompanyRepReportsScreen extends StatefulWidget {
  const CompanyRepReportsScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<CompanyRepReportsScreen> createState() =>
      _CompanyRepReportsScreenState();
}

class _CompanyRepReportsScreenState extends State<CompanyRepReportsScreen> {
  bool loading = true;
  Object? error;
  List<dynamic> reps = [], invoices = [], payments = [], customers = [];
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
      final data = await Future.wait<Object>([
        widget.apiClient.getList('/reps'),
        widget.apiClient.getList('/sales/invoices'),
        widget.apiClient.getList('/sales/payments'),
        widget.apiClient.getList('/sales/customers'),
      ]);
      if (!mounted) return;
      setState(() {
        reps = data[0] as List<dynamic>;
        invoices = data[1] as List<dynamic>;
        payments = data[2] as List<dynamic>;
        customers = data[3] as List<dynamic>;
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

  double n(dynamic v) => double.tryParse('$v') ?? 0;
  Map<String, dynamic> rep(String? id) => reps
      .map((x) => Map<String, dynamic>.from(x as Map))
      .firstWhere(
        (x) => x['id']?.toString() == id,
        orElse: () => <String, dynamic>{},
      );
  String customerName(dynamic id) {
    for (final item in customers) {
      final c = Map<String, dynamic>.from(item as Map);
      if (c['id']?.toString() == id?.toString())
        return '${c['name_ar'] ?? c['customer_number'] ?? '—'}';
    }
    return '—';
  }

  List<Map<String, dynamic>> get rows {
    final result = <Map<String, dynamic>>[];
    for (final raw in invoices) {
      final inv = Map<String, dynamic>.from(raw as Map);
      if (repId != null && inv['rep_id']?.toString() != repId) continue;
      final status = '${inv['status']}'.toLowerCase();
      if (['draft', 'rejected', 'cancelled'].contains(status)) continue;
      result.add({
        'kind': 'فاتورة',
        'number': inv['invoice_number'] ?? '—',
        'customer': inv['buyer_name_ar'] ?? customerName(inv['customer_id']),
        'amount': n(inv['total']),
        'date': inv['issue_date'] ?? inv['created_at'],
      });
    }
    for (final raw in payments) {
      final p = Map<String, dynamic>.from(raw as Map);
      if (repId != null && p['rep_id']?.toString() != repId) continue;
      result.add({
        'kind': p['payment_type'] == 'discount' ? 'سند خصم' : 'سند قبض',
        'number': p['payment_number'] ?? '—',
        'customer': p['customer_name_ar'] ?? customerName(p['customer_id']),
        'amount': n(p['amount']),
        'date': p['payment_date'] ?? p['created_at'],
      });
    }
    result.sort((a, b) => '${b['date']}'.compareTo('${a['date']}'));
    return result;
  }

  String money(double v) => '${v.toStringAsFixed(2)} ر.س';
  String selectedName() => rep(repId)['full_name']?.toString() ?? 'كل المناديب';

  Future<void> printReport() async {
    final arabic = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSansArabic-Regular.ttf'),
    );
    final latin = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSans-Regular.ttf'),
    );
    final data = rows;
    final pdf = pw.Document(title: 'حركة المندوبين');
    pdf.addPage(
      pw.MultiPage(
        textDirection: pw.TextDirection.rtl,
        theme: pw.ThemeData.withFont(
          base: arabic,
          bold: arabic,
          fontFallback: [latin],
        ),
        build: (_) => [
          pw.Text(
            'تقرير حركة المندوبين',
            style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold),
          ),
          pw.Text('المندوب: $selectedName()'),
          pw.SizedBox(height: 12),
          pw.TableHelper.fromTextArray(
            headers: const ['التاريخ', 'النوع', 'المرجع', 'العميل', 'المبلغ'],
            data: data
                .map(
                  (r) => [
                    '${r['date'] ?? '—'}'.split('T').first,
                    r['kind'],
                    r['number'],
                    r['customer'],
                    money(r['amount'] as double),
                  ],
                )
                .toList(),
          ),
        ],
      ),
    );
    await Printing.sharePdf(
      bytes: await pdf.save(),
      filename: 'تقرير-حركة-$selectedName().pdf',
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = rows;
    final sales = data
        .where((x) => x['kind'] == 'فاتورة')
        .fold<double>(0, (s, x) => s + (x['amount'] as double));
    final collected = data
        .where((x) => x['kind'] == 'سند قبض')
        .fold<double>(0, (s, x) => s + (x['amount'] as double));
    return Scaffold(
      appBar: AppBar(
        title: const Text('حركة المندوبين'),
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
                      ...reps.map((x) {
                        final r = Map<String, dynamic>.from(x as Map);
                        return DropdownMenuItem<String?>(
                          value: r['id']?.toString(),
                          child: Text(
                            '${r['full_name'] ?? r['name_ar'] ?? 'مندوب'}',
                          ),
                        );
                      }),
                    ],
                    onChanged: (v) => setState(() => repId = v),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: _metric('الفواتير', money(sales))),
                      Expanded(child: _metric('المحصل', money(collected))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: data.isEmpty ? null : printReport,
                    icon: const Icon(Icons.print),
                    label: const Text('طباعة حركة المندوب'),
                  ),
                  const SizedBox(height: 8),
                  if (data.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(30),
                        child: Text('لا توجد حركة'),
                      ),
                    ),
                  ...data.map(
                    (r) => Card(
                      elevation: 0,
                      child: ListTile(
                        title: Text(
                          '${r['kind']} • ${r['number']}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '${r['customer']}\n${r['date'] ?? '—'}'
                              .split('T')
                              .first,
                        ),
                        trailing: Text(
                          money(r['amount'] as double),
                          style: const TextStyle(
                            color: _repPurple,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _metric(String title, String value) => Card(
    elevation: 0,
    color: const Color(0xFFF1EAF5),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Text(title),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              color: _repPurple,
            ),
          ),
        ],
      ),
    ),
  );
}
