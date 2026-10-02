import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../data/api_client.dart';

const _brand = Color(0xFF3E0865);

class SerialPicker extends StatefulWidget {
  const SerialPicker({
    required this.apiClient,
    required this.productId,
    required this.selected,
    super.key,
  });
  final ApiClient apiClient;
  final String productId;
  final List<String> selected;
  @override
  State<SerialPicker> createState() => _SerialPickerState();
}

class _SerialPickerState extends State<SerialPicker> {
  late Future<List<dynamic>> _future;
  final search = TextEditingController();
  final chosen = <String>{};
  List<dynamic> all = [];
  @override
  void initState() {
    super.initState();
    chosen.addAll(widget.selected);
    _future = widget.apiClient.getAvailableSerials(widget.productId).then((v) {
      all = v;
      return v;
    });
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _addCode(String code) async {
    final clean = code.trim();
    final normalized = clean.replaceAll(RegExp(r'[\s-]'), '').toLowerCase();
    var found = all
        .map((x) => Map<String, dynamic>.from(x as Map))
        .where(
          (x) =>
              '${x['serial_number']}'
                  .replaceAll(RegExp(r'[\s-]'), '')
                  .toLowerCase() ==
              normalized,
        )
        .toList();
    if (found.isEmpty) {
      try {
        final remote = await widget.apiClient.searchSerials(clean);
        found = remote
            .map((x) => Map<String, dynamic>.from(x as Map))
            .where((x) => '${x['product_id']}' == widget.productId)
            .map(
              (x) => <String, dynamic>{
                'id': x['serial_id'],
                'serial_number': x['serial_number'],
                'sale_price': x['sale_price'],
              },
            )
            .toList();
      } catch (_) {}
    }
    if (found.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('السيريال غير متاح: $code')));
      return;
    }
    if (!mounted) return;
    setState(() => chosen.add(found.first['id'].toString()));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('تم التقاط السيريال: ${found.first['serial_number']}'),
      ),
    );
  }

  Future<void> _scan() async {
    final controller = MobileScannerController(
      formats: const [BarcodeFormat.all],
    );
    var handled = false;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SizedBox(
        height: 560,
        child: Stack(
          fit: StackFit.expand,
          children: [
            MobileScanner(
              controller: controller,
              tapToFocus: true,
              fit: BoxFit.cover,
              onDetect: (capture) async {
                if (handled || capture.barcodes.isEmpty) return;
                final code = capture.barcodes.first.rawValue?.trim();
                if (code == null || code.length < 4) return;
                handled = true;
                await _addCode(code);
                if (sheetContext.mounted) Navigator.pop(sheetContext);
              },
            ),
            IgnorePointer(
              child: Center(
                child: Container(
                  width: 310,
                  height: 115,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.greenAccent, width: 3),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 18,
              left: 12,
              right: 12,
              child: SafeArea(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'وجّه الإطار على باركود IMEI أو S/N في الكرتون\nاضغط على الباركود للتركيز',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: controller.toggleTorch,
                      icon: const Icon(
                        Icons.flash_on,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              bottom: 18,
              left: 24,
              right: 24,
              child: SafeArea(
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => controller.setZoomScale(0.8),
                      icon: const Icon(
                        Icons.zoom_out,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'قرّب الكاميرا حتى يظهر الخط واضحاً',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => controller.setZoomScale(2.5),
                      icon: const Icon(
                        Icons.zoom_in,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'اختيار السيريالات',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          onPressed: _scan,
          icon: const Icon(Icons.qr_code_scanner_rounded),
        ),
      ],
    ),
    body: FutureBuilder<List<dynamic>>(
      future: _future,
      builder: (context, snap) {
        if (!snap.hasData)
          return const Center(child: CircularProgressIndicator());
        final q = search.text.trim().toLowerCase();
        final rows = snap.data!
            .where(
              (x) =>
                  q.isEmpty ||
                  '${(x as Map)['serial_number']}'.toLowerCase().contains(q),
            )
            .toList();
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(14),
              child: TextField(
                controller: search,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  labelText: 'بحث برقم السيريال',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Text(
                    'المحدد: ${chosen.length}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => setState(chosen.clear),
                    child: const Text('مسح المحدد'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: rows.length,
                itemBuilder: (_, i) {
                  final x = Map<String, dynamic>.from(rows[i] as Map);
                  final id = x['id'].toString();
                  final checked = chosen.contains(id);
                  return CheckboxListTile(
                    value: checked,
                    onChanged: (_) => setState(
                      () => checked ? chosen.remove(id) : chosen.add(id),
                    ),
                    title: Text(
                      x['serial_number']?.toString() ?? '—',
                      textDirection: TextDirection.ltr,
                    ),
                    subtitle: Text('السعر: ${x['sale_price'] ?? '—'} ر.س'),
                    secondary: const Icon(
                      Icons.devices_other_outlined,
                      color: _brand,
                    ),
                  );
                },
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: FilledButton(
                  onPressed: () => Navigator.pop(context, chosen.toList()),
                  style: FilledButton.styleFrom(
                    backgroundColor: _brand,
                    minimumSize: const Size.fromHeight(50),
                  ),
                  child: const Text('تأكيد السيريالات'),
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  late Future<Map<String, dynamic>> _future;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = widget.apiClient.getMap('/reps/me/attendance/today');
  }

  String _time(dynamic v) => v == null
      ? 'لم يسجل'
      : v.toString().replaceFirst('T', ' ').split('.').first;
  Future<void> _checkIn() async {
    setState(() => busy = true);
    try {
      await widget.apiClient.post('/reps/me/attendance/check-in', {});
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('تم تسجيل حضورك بنجاح')));
        setState(_load);
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'الحضور والانصراف',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          onPressed: () => setState(_load),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) {
        if (!snap.hasData)
          return const Center(child: CircularProgressIndicator());
        final x = snap.data!;
        final present = x['check_in_at'] != null;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: present
                  ? const Color(0xFFEAF7EE)
                  : const Color(0xFFFFF7E6),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      present ? 'تم تسجيل الحضور' : 'لم يتم تسجيل الحضور',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text('تاريخ الحضور: ${x['attendance_date'] ?? '—'}'),
                    Text('وقت الحضور: ${_time(x['check_in_at'])}'),
                    if (x['check_in_latitude'] != null)
                      const Text('تم حفظ الموقع الجغرافي للحضور'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (!present)
              FilledButton.icon(
                onPressed: busy ? null : _checkIn,
                icon: const Icon(Icons.login_rounded),
                label: Text(busy ? 'جاري التسجيل...' : 'تسجيل حضور اليوم'),
                style: FilledButton.styleFrom(
                  backgroundColor: _brand,
                  minimumSize: const Size.fromHeight(52),
                ),
              ),
            const SizedBox(height: 18),
            const Text(
              'يسمح النظام بتسجيل الحضور خلال الفترة المحددة من الإدارة.',
              style: TextStyle(color: Colors.black54),
            ),
          ],
        );
      },
    ),
  );
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<Map<String, dynamic>> _future;
  @override
  void initState() {
    super.initState();
    _future = widget.apiClient.getMap('/reps/me/profile');
  }

  String _val(Map<String, dynamic> x, String k) =>
      x[k]?.toString().trim().isNotEmpty == true ? x[k].toString() : '—';
  Widget _row(String label, String value) => Card(
    elevation: 0,
    child: ListTile(
      title: Text(
        label,
        style: const TextStyle(color: Colors.black54, fontSize: 12),
      ),
      subtitle: Text(
        value,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'الملف الشخصي',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) {
        if (!snap.hasData)
          return const Center(child: CircularProgressIndicator());
        final x = snap.data!;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const CircleAvatar(
              radius: 42,
              backgroundColor: Color(0xFFF0EAF4),
              child: Icon(Icons.person, size: 46, color: _brand),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                _val(x, 'full_name'),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 18),
            _row('كود المندوب', _val(x, 'rep_code')),
            _row('رقم الجوال', _val(x, 'phone')),
            _row('المنطقة', _val(x, 'zone')),
            _row('المستودع', _val(x, 'warehouse_name')),
            _row('لوحة المركبة', _val(x, 'vehicle_plate')),
            _row('نوع المركبة', _val(x, 'vehicle_type')),
            _row('الهدف الشهري', '${_val(x, 'target_monthly')} ر.س'),
            _row('نسبة العمولة', '${_val(x, 'commission_pct')}%'),
          ],
        );
      },
    ),
  );
}

class CustomerStatementsScreen extends StatefulWidget {
  const CustomerStatementsScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<CustomerStatementsScreen> createState() =>
      _CustomerStatementsScreenState();
}

class _CustomerStatementsScreenState extends State<CustomerStatementsScreen> {
  late Future<List<dynamic>> customers;
  String? customerId;
  Future<Map<String, dynamic>>? statement;
  @override
  void initState() {
    super.initState();
    customers = widget.apiClient.getList('/sales/customers');
  }

  String money(dynamic v) =>
      (double.tryParse('${v ?? 0}') ?? 0).toStringAsFixed(2);

  Future<void> _shareStatementPdf(Map<String, dynamic> data) async {
    final fontData = await rootBundle.load(
      'assets/fonts/NotoSansArabic-Regular.ttf',
    );
    final font = pw.Font.ttf(fontData);
    final latinFontData = await rootBundle.load(
      'assets/fonts/NotoSans-Regular.ttf',
    );
    final latinFont = pw.Font.ttf(latinFontData);
    final logoData = await rootBundle.load('assets/branding/masar_logo.png');
    var logoBytes = logoData.buffer.asUint8List();
    Map<String, dynamic> company = {};
    try {
      company = await widget.apiClient.getMap('/settings/company');
      final logoSource = company['logo_data']?.toString();
      if (logoSource != null && logoSource.startsWith('data:image/')) {
        final comma = logoSource.indexOf(',');
        if (comma > 0) {
          logoBytes = Uint8List.fromList(
            base64Decode(logoSource.substring(comma + 1)),
          );
        }
      }
    } catch (_) {
      // Keep the bundled logo only if the company settings cannot be loaded.
    }
    final logo = pw.MemoryImage(logoBytes);
    final summary = (data['summary'] as Map?)?.cast<String, dynamic>() ?? data;
    final rows = (data['transactions'] as List?) ?? [];
    final customer = (data['customer'] as Map?)?.cast<String, dynamic>() ?? {};
    final customerName = customer['name_ar']?.toString() ?? '—';
    final customerNumber = customer['customer_number']?.toString() ?? '—';
    final companyName =
        company['name_ar']?.toString() ?? company['name']?.toString() ?? 'مسار';
    final companyDetail = [
      company['vat_number'] == null
          ? ''
          : 'الرقم الضريبي: ${company['vat_number']}',
      company['cr_number'] == null
          ? ''
          : 'السجل التجاري: ${company['cr_number']}',
      company['address_city']?.toString() ?? '',
    ].where((value) => value.isNotEmpty).join(' · ');
    final now = DateTime.now();
    final generated =
        '${now.day.toString().padLeft(2, '0')}-${now.month.toString().padLeft(2, '0')}-${now.year}';
    final period = '2020-01-01 — ${now.toIso8601String().split('T').first}';
    final pdf = pw.Document(title: 'كشف حساب $customerName', author: 'مسار');

    String cell(dynamic value) => value?.toString() ?? '—';
    String transactionType(Map<String, dynamic> m) {
      switch (m['type']?.toString()) {
        case 'invoice':
          return 'فاتورة';
        case 'payment':
          return 'سند قبض';
        case 'opening_balance':
          return 'رصيد افتتاحي';
        default:
          return cell(m['type']);
      }
    }

    String transactionDescription(Map<String, dynamic> m) {
      var value = cell(m['description_ar'] ?? m['description']);
      value = value.replaceAll('PaymentMethod.CASH', 'طريقة الدفع: نقدًا');
      value = value.replaceAll('PaymentMethod.BANK', 'طريقة الدفع: تحويل بنكي');
      value = value.replaceAll('PaymentMethod.CARD', 'طريقة الدفع: بطاقة');
      value = value.replaceAll('Opening balance', 'رصيد افتتاحي');
      value = value.replaceAll('Sales invoice', 'فاتورة مبيعات');
      return value;
    }

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        textDirection: pw.TextDirection.rtl,
        theme: pw.ThemeData.withFont(
          base: font,
          bold: font,
          fontFallback: [latinFont],
        ),
        margin: const pw.EdgeInsets.fromLTRB(28, 24, 28, 30),
        header: (context) => pw.Container(
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
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Row(
                  children: [
                    pw.Container(
                      width: 44,
                      height: 44,
                      padding: const pw.EdgeInsets.all(2),
                      decoration: pw.BoxDecoration(
                        border: pw.Border.all(
                          color: const PdfColor.fromInt(0xFFD5C8DD),
                        ),
                      ),
                      child: pw.Image(logo, fit: pw.BoxFit.contain),
                    ),
                    pw.SizedBox(width: 7),
                    pw.Column(
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
                          companyDetail.isEmpty
                              ? 'نظام مسار المحاسبي'
                              : companyDetail,
                          style: const pw.TextStyle(
                            fontSize: 8,
                            color: PdfColor.fromInt(0xFF75617F),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    pw.Text(
                      'كشف حساب عميل',
                      style: pw.TextStyle(
                        fontSize: 17,
                        fontWeight: pw.FontWeight.bold,
                        color: const PdfColor.fromInt(0xFF3E0865),
                      ),
                    ),
                    pw.Text(
                      'كشف حساب العميل',
                      style: const pw.TextStyle(
                        fontSize: 9,
                        color: PdfColor.fromInt(0xFF75617F),
                      ),
                    ),
                  ],
                ),
              ),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text(
                      'رمز التقرير: CST-${customerNumber == '—' ? '' : customerNumber}',
                      style: const pw.TextStyle(
                        fontSize: 8,
                        color: PdfColor.fromInt(0xFF75617F),
                      ),
                    ),
                    pw.Text(
                      'تاريخ الطباعة: $generated',
                      style: const pw.TextStyle(
                        fontSize: 8,
                        color: PdfColor.fromInt(0xFF75617F),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        footer: (context) => pw.Row(
          children: [
            _pdfSign('إعداد: المحاسب'),
            _pdfSign('مراجعة: المدير المالي'),
            _pdfSign('اعتماد: الإدارة'),
            _pdfSign('صفحة ${context.pageNumber} من ${context.pagesCount}'),
          ],
        ),
        build: (context) => [
          pw.Container(
            margin: const pw.EdgeInsets.only(top: 10, bottom: 8),
            padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: pw.BoxDecoration(
              color: const PdfColor.fromInt(0xFFF4EFF7),
              border: pw.Border.all(color: PdfColor.fromInt(0xFFD5C8DD)),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'الفترة: $period',
                  style: pw.TextStyle(
                    fontSize: 9,
                    fontWeight: pw.FontWeight.bold,
                    color: const PdfColor.fromInt(0xFF3E0865),
                  ),
                ),
                pw.Text(
                  '$customerName  —  رقم العميل: $customerNumber',
                  style: pw.TextStyle(
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          pw.Row(
            children: [
              _pdfMetric(
                'الرصيد الافتتاحي',
                '${money(summary['opening_balance'])} ر.س',
                const PdfColor.fromInt(0xFF3E0865),
              ),
              _pdfMetric(
                'إجمالي الفواتير',
                '${money(summary['total_invoiced'])} ر.س',
                const PdfColor.fromInt(0xFF3E0865),
              ),
              _pdfMetric(
                'المقبوض',
                '${money(summary['total_paid'])} ر.س',
                const PdfColor.fromInt(0xFF6F4A84),
              ),
              _pdfMetric(
                'الرصيد المستحق',
                '${money(summary['closing_balance'] ?? summary['outstanding'])} ر.س',
                const PdfColor.fromInt(0xFFB42318),
              ),
            ],
          ),
          pw.SizedBox(height: 9),
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: pw.BoxDecoration(
              color: const PdfColor.fromInt(0xFFEFE8F3),
              border: pw.Border.all(color: PdfColor.fromInt(0xFFCDBED6)),
            ),
            child: pw.Text(
              'حركات الحساب',
              style: pw.TextStyle(
                fontSize: 10,
                fontWeight: pw.FontWeight.bold,
                color: const PdfColor.fromInt(0xFF3E0865),
              ),
            ),
          ),
          pw.TableHelper.fromTextArray(
            headers: [
              'التاريخ',
              'النوع',
              'المرجع',
              'البيان',
              'مدين',
              'دائن',
              'الرصيد',
            ],
            data: rows.map((r) {
              final m = Map<String, dynamic>.from(r as Map);
              return [
                cell(m['date']),
                transactionType(m),
                cell(m['reference']),
                transactionDescription(m),
                money(m['debit'] ?? (m['type'] == 'invoice' ? m['amount'] : 0)),
                money(
                  m['credit'] ?? (m['type'] == 'payment' ? m['amount'] : 0),
                ),
                money(m['balance'] ?? m['running_balance']),
              ];
            }).toList(),
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
    await Printing.sharePdf(
      bytes: await pdf.save(),
      filename: 'كشف-حساب-$customerName.pdf',
    );
  }

  pw.Widget _pdfSign(String label) => pw.Expanded(
    child: pw.Container(
      margin: const pw.EdgeInsets.symmetric(horizontal: 6),
      padding: const pw.EdgeInsets.only(top: 5),
      decoration: const pw.BoxDecoration(
        border: pw.Border(
          top: pw.BorderSide(color: PdfColor.fromInt(0xFFD5C8DD)),
        ),
      ),
      child: pw.Text(
        label,
        textAlign: pw.TextAlign.center,
        style: const pw.TextStyle(
          fontSize: 8,
          color: PdfColor.fromInt(0xFF75617F),
        ),
      ),
    ),
  );

  pw.Widget _pdfMetric(String label, String value, PdfColor color) =>
      pw.Expanded(
        child: pw.Container(
          margin: const pw.EdgeInsets.symmetric(horizontal: 4),
          padding: const pw.EdgeInsets.all(9),
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: const PdfColor.fromInt(0xFFE5DDE9)),
            borderRadius: pw.BorderRadius.circular(7),
          ),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text(
                label,
                style: const pw.TextStyle(
                  fontSize: 8,
                  color: PdfColor.fromInt(0xFF6B7280),
                ),
              ),
              pw.SizedBox(height: 3),
              pw.Text(
                value,
                style: pw.TextStyle(
                  fontSize: 11,
                  fontWeight: pw.FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      );

  String _movementType(Map<String, dynamic> movement) {
    switch (movement['type']?.toString()) {
      case 'invoice':
        return 'فاتورة مبيعات';
      case 'payment':
        return 'سند قبض';
      case 'opening_balance':
        return 'رصيد افتتاحي';
      default:
        return 'حركة حساب';
    }
  }

  String _movementDescription(Map<String, dynamic> movement) {
    var value =
        movement['description_ar']?.toString() ??
        movement['description']?.toString() ??
        '';
    value = value.replaceAll('PaymentMethod.CASH', 'طريقة الدفع: نقدًا');
    value = value.replaceAll('PaymentMethod.BANK', 'طريقة الدفع: تحويل بنكي');
    value = value.replaceAll('PaymentMethod.CARD', 'طريقة الدفع: بطاقة');
    return value;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'كشوفات حساب العملاء',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: FutureBuilder<List<dynamic>>(
        future: customers,
        builder: (context, snap) {
          if (!snap.hasData)
            return const Center(child: CircularProgressIndicator());
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              DropdownButtonFormField<String>(
                initialValue: customerId,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'اختر العميل',
                  border: OutlineInputBorder(),
                ),
                items: snap.data!.map((x) {
                  final m = Map<String, dynamic>.from(x as Map);
                  return DropdownMenuItem(
                    value: m['id'].toString(),
                    child: Text(
                      m['name_ar']?.toString() ?? '—',
                      overflow: TextOverflow.ellipsis,
                    ),
                  );
                }).toList(),
                onChanged: (v) => setState(() {
                  customerId = v;
                  statement = null;
                }),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: customerId == null
                    ? null
                    : () {
                        final now = DateTime.now().toIso8601String();
                        setState(() {
                          statement = widget.apiClient.getMap(
                            '/sales/customers/$customerId/statement?from_date=2020-01-01T00:00:00&to_date=${Uri.encodeQueryComponent(now)}',
                          );
                        });
                      },
                icon: const Icon(Icons.receipt_long),
                label: const Text('عرض كشف الحساب'),
                style: FilledButton.styleFrom(
                  backgroundColor: _brand,
                  minimumSize: const Size.fromHeight(50),
                ),
              ),
              if (statement != null)
                FutureBuilder<Map<String, dynamic>>(
                  future: statement,
                  builder: (context, ss) {
                    if (!ss.hasData)
                      return const Padding(
                        padding: EdgeInsets.all(30),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    final data = ss.data!;
                    final summary =
                        (data['summary'] as Map?)?.cast<String, dynamic>() ??
                        data;
                    final rows = (data['transactions'] as List?) ?? [];
                    return Column(
                      children: [
                        const SizedBox(height: 18),
                        Text(
                          'إجمالي الفواتير: ${money(summary['total_invoiced'])} ر.س',
                        ),
                        Text('المقبوض: ${money(summary['total_paid'])} ر.س'),
                        Text(
                          'المتبقي: ${money(summary['outstanding'] ?? summary['closing_balance'])} ر.س',
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: () => _shareStatementPdf(data),
                          icon: const Icon(Icons.picture_as_pdf_outlined),
                          label: const Text('تحميل / مشاركة كشف الحساب PDF'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _brand,
                            side: const BorderSide(color: _brand),
                          ),
                        ),
                        const Divider(),
                        ...rows.map((r) {
                          final m = Map<String, dynamic>.from(r as Map);
                          final debit =
                              double.tryParse('${m['debit'] ?? 0}') ?? 0;
                          final credit =
                              double.tryParse('${m['credit'] ?? 0}') ?? 0;
                          final rawAmount =
                              double.tryParse('${m['amount'] ?? 0}') ?? 0;
                          final amount = debit > 0
                              ? debit
                              : credit > 0
                              ? credit
                              : rawAmount;
                          return ListTile(
                            title: Text(
                              _movementType(m),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              '${_movementDescription(m)}\n${m['date']?.toString() ?? '—'}',
                            ),
                            trailing: Text(
                              '${debit > 0 ? 'مدين' : 'دائن'}\n${money(amount)} ر.س',
                              textAlign: TextAlign.end,
                            ),
                          );
                        }),
                      ],
                    );
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}
