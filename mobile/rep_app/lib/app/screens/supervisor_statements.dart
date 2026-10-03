import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../data/api_client.dart';

const _purple = Color(0xFF3E0865);
String _money(dynamic v) =>
    '${(num.tryParse("$v") ?? 0).toStringAsFixed(2)} ر.س';
String _date(dynamic v) => v == null ? '—' : '${v.toString()}'.split('T').first;
int _days(dynamic v) => int.tryParse('$v') ?? 0;
String _movementAmount(Map<String, dynamic> movement) {
  final amount = num.tryParse('${movement['amount'] ?? ''}') ?? 0;
  final debit = num.tryParse('${movement['debit'] ?? ''}') ?? 0;
  final credit = num.tryParse('${movement['credit'] ?? ''}') ?? 0;
  return _money(amount != 0 ? amount : (debit != 0 ? debit : credit));
}

class SupervisorStatementsScreen extends StatefulWidget {
  const SupervisorStatementsScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<SupervisorStatementsScreen> createState() =>
      _SupervisorStatementsScreenState();
}

class _SupervisorStatementsScreenState
    extends State<SupervisorStatementsScreen> {
  List<Map<String, dynamic>> rows = [], reps = [];
  String? repId;
  String query = '';
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
      final result = await Future.wait<Object>([
        widget.apiClient.getList(
          '/supervisors/me/customer-statements?from_date=2020-01-01T00:00:00&to_date=${Uri.encodeQueryComponent(now.toIso8601String())}',
        ),
        widget.apiClient.getList('/supervisors/me/reps'),
      ]);
      if (mounted)
        setState(() {
          rows = (result[0] as List)
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          reps = (result[1] as List)
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  List<Map<String, dynamic>> get filtered => rows.where((r) {
    final c = Map<String, dynamic>.from((r['customer'] as Map?) ?? {});
    return (repId == null || '${r['rep_id']}' == repId) &&
        (query.isEmpty ||
            '${c['name_ar']} ${c['customer_number']}'.contains(query));
  }).toList();
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'كشوفات العملاء',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(14),
            children: [
              TextField(
                textDirection: TextDirection.rtl,
                decoration: const InputDecoration(
                  labelText: 'بحث باسم العميل أو رقمه',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (v) => setState(() => query = v.trim()),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: repId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'المندوب'),
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
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: filtered.isEmpty
                    ? null
                    : () => _shareStatementsPdf(filtered),
                icon: const Icon(Icons.print),
                label: const Text('طباعة كشوف العملاء المعروضة'),
              ),
              const SizedBox(height: 10),
              if (filtered.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(30),
                    child: Text('لا توجد كشوفات'),
                  ),
                ),
              ...filtered.map(
                (r) => _StatementTile(
                  data: r,
                  onOpen: () => Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => SupervisorStatementDetailScreen(
                        apiClient: widget.apiClient,
                        data: r,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
  );
  Future<void> _shareStatementsPdf(List<Map<String, dynamic>> data) async =>
      _sharePdf(
        widget.apiClient,
        title: 'كشف عملاء المناديب',
        filename: 'كشوف-عملاء-المناديب.pdf',
        headers: const [
          'العميل',
          'المندوب',
          'المشرف',
          'الفواتير',
          'المقبوض',
          'الرصيد',
        ],
        rows: data.map((r) {
          final c = Map<String, dynamic>.from((r['customer'] as Map?) ?? {});
          final s = Map<String, dynamic>.from((r['summary'] as Map?) ?? {});
          return <String>[
            '${c['name_ar'] ?? '—'}',
            '${r['rep_name'] ?? r['rep_code'] ?? '—'}',
            '${r['supervisor_name'] ?? '—'}',
            _money(s['total_invoiced']),
            _money(s['total_paid']),
            _money(s['closing_balance'] ?? s['outstanding']),
          ];
        }).toList(),
      );
}

class _StatementTile extends StatelessWidget {
  const _StatementTile({required this.data, required this.onOpen});
  final Map<String, dynamic> data;
  final VoidCallback onOpen;
  @override
  Widget build(BuildContext context) {
    final c = Map<String, dynamic>.from((data['customer'] as Map?) ?? {});
    final s = Map<String, dynamic>.from((data['summary'] as Map?) ?? {});
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: onOpen,
        leading: const Icon(Icons.account_balance_wallet, color: _purple),
        title: Text(
          '${c['name_ar'] ?? '—'}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          'رقم العميل: ${c['customer_number'] ?? '—'}\nمندوب: ${data['rep_name'] ?? data['rep_code'] ?? '—'}\nمشرف: ${data['supervisor_name'] ?? '—'}',
        ),
        isThreeLine: true,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _money(s['closing_balance'] ?? s['outstanding']),
              style: const TextStyle(
                color: Color(0xFFB43D32),
                fontWeight: FontWeight.w800,
              ),
            ),
            const Text('فتح الكشف', style: TextStyle(fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

class SupervisorStatementDetailScreen extends StatelessWidget {
  const SupervisorStatementDetailScreen({
    required this.apiClient,
    required this.data,
    super.key,
  });
  final ApiClient apiClient;
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final c = Map<String, dynamic>.from((data['customer'] as Map?) ?? {});
    final s = Map<String, dynamic>.from((data['summary'] as Map?) ?? {});
    final tx = (data['transactions'] as List?) ?? [];
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'كشف ${c['name_ar'] ?? 'العميل'}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(onPressed: () => _print(), icon: const Icon(Icons.print)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          Card(
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${c['name_ar'] ?? '—'}',
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text('رقم العميل: ${c['customer_number'] ?? '—'}'),
                  Text('مندوب: ${data['rep_name'] ?? data['rep_code'] ?? '—'}'),
                  const Divider(),
                  Text('إجمالي الفواتير: ${_money(s['total_invoiced'])}'),
                  Text('المقبوض: ${_money(s['total_paid'])}'),
                  Text(
                    'الرصيد المستحق: ${_money(s['closing_balance'] ?? s['outstanding'])}',
                    style: const TextStyle(
                      color: Color(0xFFB43D32),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'حركة الحساب',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          ...tx.map((x) {
            final m = Map<String, dynamic>.from(x as Map);
            final type = m['type'] == 'payment'
                ? 'سند قبض'
                : m['type'] == 'discount'
                ? 'سند خصم'
                : m['type'] == 'invoice'
                ? 'فاتورة'
                : 'رصيد افتتاحي';
            return Card(
              elevation: 0,
              child: ListTile(
                title: Text(
                  type,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  '${_date(m['date'])}\n${m['description_ar'] ?? m['description'] ?? '—'}',
                ),
                isThreeLine: true,
                trailing: Text(_movementAmount(m)),
              ),
            );
          }),
        ],
      ),
    );
  }

  Future<void> _print() async {
    final c = Map<String, dynamic>.from((data['customer'] as Map?) ?? {});
    final tx = (data['transactions'] as List?) ?? [];
    await _sharePdf(
      apiClient,
      title:
          'كشف حساب ${c['name_ar'] ?? ''} - مندوب ${data['rep_name'] ?? data['rep_code'] ?? '—'}',
      filename: 'كشف-حساب-${c['customer_number'] ?? 'عميل'}.pdf',
      headers: const [
        'العميل',
        'المندوب',
        'المشرف',
        'التاريخ',
        'النوع',
        'المرجع',
        'البيان',
        'مدين',
        'دائن',
        'الرصيد',
      ],
      rows: tx.map((x) {
        final m = Map<String, dynamic>.from(x as Map);
        final type = m['type'] == 'payment'
            ? 'سند قبض'
            : m['type'] == 'discount'
            ? 'سند خصم'
            : m['type'] == 'invoice'
            ? 'فاتورة'
            : 'رصيد افتتاحي';
        return <String>[
          '${c['name_ar'] ?? '—'}',
          '${data['rep_name'] ?? data['rep_code'] ?? '—'}',
          '${data['supervisor_name'] ?? '—'}',
          _date(m['date']),
          type,
          '${m['reference'] ?? '—'}',
          '${m['description_ar'] ?? m['description'] ?? '—'}',
          _money(m['debit']),
          _money(m['credit']),
          _money(m['balance'] ?? m['running_balance']),
        ];
      }).toList(),
    );
  }
}

class SupervisorAgingScreen extends StatefulWidget {
  const SupervisorAgingScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<SupervisorAgingScreen> createState() => _SupervisorAgingScreenState();
}

class _SupervisorAgingScreenState extends State<SupervisorAgingScreen> {
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
      final result = await Future.wait<Object>([
        widget.apiClient.getList(
          '/supervisors/me/aging?as_of=${Uri.encodeQueryComponent(DateTime.now().toIso8601String())}',
        ),
        widget.apiClient.getList('/supervisors/me/reps'),
      ]);
      if (mounted)
        setState(() {
          rows = (result[0] as List)
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          reps = (result[1] as List)
              .map((x) => Map<String, dynamic>.from(x as Map))
              .toList();
          loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  List<Map<String, dynamic>> get filtered => repId == null
      ? rows
      : rows.where((x) => '${x['rep_id']}' == repId).toList();
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'أعمار الديون',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
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
                decoration: const InputDecoration(labelText: 'المندوب'),
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
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: filtered.isEmpty
                    ? null
                    : () => _sharePdf(
                        widget.apiClient,
                        title: 'تقرير أعمار الديون',
                        filename: 'أعمار-الديون.pdf',
                        headers: const [
                          'العميل',
                          'المندوب',
                          'المشرف',
                          'الفاتورة',
                          'تاريخ الإصدار',
                          'الإجمالي',
                          'المتبقي',
                          'أيام التأخير',
                        ],
                        rows: filtered
                            .map(
                              (r) => <String>[
                                '${r['customer_name'] ?? '—'}',
                                '${r['rep_name'] ?? '—'}',
                                '${r['supervisor_name'] ?? '—'}',
                                '${r['invoice_number'] ?? '—'}',
                                _date(r['issue_date']),
                                _money(r['invoice_total']),
                                _money(r['outstanding']),
                                '${r['overdue_days'] ?? 0}',
                              ],
                            )
                            .toList(),
                      ),
                icon: const Icon(Icons.print),
                label: const Text('طباعة تقرير أعمار الديون'),
              ),
              const SizedBox(height: 10),
              ...filtered.map(
                (r) => Card(
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(
                      Icons.schedule,
                      color: _days(r['overdue_days']) > 0
                          ? Colors.red
                          : Colors.green,
                    ),
                    title: Text(
                      '${r['invoice_number'] ?? '—'} • ${r['customer_name'] ?? '—'}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      'المندوب: ${r['rep_name'] ?? '—'}\nالمشرف: ${r['supervisor_name'] ?? '—'}\nتاريخ الإصدار: ${_date(r['issue_date'])}',
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _money(r['outstanding']),
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          '${r['overdue_days'] ?? 0} يوم',
                          style: TextStyle(
                            color: _days(r['overdue_days']) > 0
                                ? Colors.red
                                : Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
  );
}

Future<void> _sharePdf(
  ApiClient api, {
  required String title,
  required String filename,
  required List<String> headers,
  required List<List<String>> rows,
}) async {
  final ar = pw.Font.ttf(
    await rootBundle.load('assets/fonts/NotoSansArabic-Regular.ttf'),
  );
  final latin = pw.Font.ttf(
    await rootBundle.load('assets/fonts/NotoSans-Regular.ttf'),
  );
  final logoData = await rootBundle.load('assets/branding/masar_logo.png');
  Uint8List logoBytes = logoData.buffer.asUint8List();
  var companyName = 'مسار';
  var details = 'نظام مسار المحاسبي';
  try {
    final company = await api.getMap('/settings/company');
    companyName = '${company['name_ar'] ?? company['name'] ?? companyName}';
    details = [
      company['vat_number'] == null
          ? ''
          : 'الرقم الضريبي: ${company['vat_number']}',
      company['cr_number'] == null
          ? ''
          : 'السجل التجاري: ${company['cr_number']}',
      company['address_city']?.toString() ?? '',
    ].where((x) => x.isNotEmpty).join(' · ');
    final source = company['logo_data']?.toString();
    if (source != null && source.startsWith('data:image/')) {
      logoBytes = Uint8List.fromList(
        base64Decode(source.substring(source.indexOf(',') + 1)),
      );
    }
  } catch (_) {}
  final logo = pw.MemoryImage(logoBytes);
  final pdf = pw.Document(title: title, author: companyName);
  pdf.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      textDirection: pw.TextDirection.rtl,
      theme: pw.ThemeData.withFont(base: ar, bold: ar, fontFallback: [latin]),
      margin: const pw.EdgeInsets.fromLTRB(28, 24, 28, 30),
      header: (_) => pw.Container(
        padding: const pw.EdgeInsets.only(bottom: 8),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            bottom: pw.BorderSide(
              color: PdfColor.fromInt(0xFF3E0865),
              width: 2,
            ),
          ),
        ),
        child: pw.Row(
          children: [
            pw.Container(
              width: 44,
              height: 44,
              padding: const pw.EdgeInsets.all(2),
              child: pw.Image(logo),
            ),
            pw.SizedBox(width: 8),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    companyName,
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                      color: const PdfColor.fromInt(0xFF3E0865),
                    ),
                  ),
                  pw.Text(
                    details.isEmpty ? 'نظام مسار المحاسبي' : details,
                    style: const pw.TextStyle(
                      fontSize: 8,
                      color: PdfColor.fromInt(0xFF75617F),
                    ),
                  ),
                ],
              ),
            ),
            pw.Expanded(
              child: pw.Center(
                child: pw.Text(
                  title,
                  style: pw.TextStyle(
                    fontSize: 17,
                    fontWeight: pw.FontWeight.bold,
                    color: const PdfColor.fromInt(0xFF3E0865),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      build: (_) => [
        pw.SizedBox(height: 12),
        pw.TableHelper.fromTextArray(
          headers: headers,
          data: rows,
          headerStyle: pw.TextStyle(
            fontWeight: pw.FontWeight.bold,
            color: const PdfColor.fromInt(0xFF3E0865),
            fontSize: 8,
          ),
          headerDecoration: const pw.BoxDecoration(
            color: PdfColor.fromInt(0xFFF5F0F7),
          ),
          cellStyle: const pw.TextStyle(fontSize: 8),
          cellAlignment: pw.Alignment.centerRight,
          cellPadding: const pw.EdgeInsets.symmetric(
            horizontal: 4,
            vertical: 5,
          ),
          border: pw.TableBorder.all(
            color: const PdfColor.fromInt(0xFFCDBED6),
            width: .6,
          ),
        ),
      ],
    ),
  );
  await Printing.sharePdf(bytes: await pdf.save(), filename: filename);
}
