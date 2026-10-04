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
  late Future<List<dynamic>> reps;
  final customerSearch = TextEditingController();
  String? customerId;
  String? repId;
  DateTime fromDate = DateTime(2020, 1, 1);
  DateTime toDate = DateTime.now();
  Future<Map<String, dynamic>>? statement;
  List<Map<String, dynamic>> statements = [];
  bool loadingAll = false;

  @override
  void initState() {
    super.initState();
    customers = widget.apiClient.getList('/sales/customers');
    reps = widget.apiClient.getList('/reps');
    customerSearch.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    customerSearch.dispose();
    super.dispose();
  }

  String money(dynamic v) =>
      (double.tryParse('${v ?? 0}') ?? 0).toStringAsFixed(2);
  String dateText(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  String dateQuery(DateTime value, {bool end = false}) =>
      '${dateText(value)}T${end ? '23:59:59' : '00:00:00'}';
  String customerName(Map<String, dynamic> data) {
    final c = (data['customer'] as Map?)?.cast<String, dynamic>();
    return c?['name_ar']?.toString() ?? 'العميل';
  }

  String _movementType(Map<String, dynamic> movement) {
    switch (movement['type']?.toString()) {
      case 'invoice':
        return 'فاتورة مبيعات';
      case 'payment':
        return 'سند قبض';
      case 'discount':
        return 'سند خصم';
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

  Future<void> _loadStatements(List<dynamic> customerList) async {
    setState(() {
      loadingAll = true;
      statement = null;
      statements = [];
    });
    try {
      final source = repId == null
          ? customerList
          : await widget.apiClient.getList(
              '/sales/customers?rep_id=${Uri.encodeQueryComponent(repId!)}',
            );
      final selected = source
          .map((x) => Map<String, dynamic>.from(x as Map))
          .where((c) {
            if (customerId != null && c['id']?.toString() != customerId)
              return false;
            return true;
          })
          .toList();
      if (selected.isEmpty) throw Exception('لا يوجد عملاء مطابقون للفلاتر');
      final result = await Future.wait(
        selected.map(
          (c) => widget.apiClient.getMap(
            '/sales/customers/${c['id']}/statement?from_date=${Uri.encodeQueryComponent(dateQuery(fromDate))}&to_date=${Uri.encodeQueryComponent(dateQuery(toDate, end: true))}',
          ),
        ),
      );
      if (!mounted) return;
      setState(() {
        statements = result;
        loadingAll = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          loadingAll = false;
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _pickDate(bool from) async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
      initialDate: from ? fromDate : toDate,
      locale: const Locale('ar'),
    );
    if (picked == null) return;
    setState(() {
      if (from) {
        fromDate = picked;
        if (toDate.isBefore(fromDate)) toDate = fromDate;
      } else {
        toDate = picked;
        if (toDate.isBefore(fromDate)) fromDate = toDate;
      }
      statement = null;
      statements = [];
    });
  }

  Future<void> _shareAllStatementsPdf(List<Map<String, dynamic>> data) async {
    final ar = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSansArabic-Regular.ttf'),
    );
    final latin = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSans-Regular.ttf'),
    );
    final rows = <List<String>>[];
    for (final item in data) {
      final name = customerName(item);
      for (final raw in (item['transactions'] as List? ?? [])) {
        final m = Map<String, dynamic>.from(raw as Map);
        rows.add([
          name,
          '${m['date'] ?? '—'}'.split('T').first,
          _movementType(m),
          '${m['reference'] ?? '—'}',
          money(m['debit'] ?? 0),
          money(m['credit'] ?? 0),
          money(m['balance'] ?? m['running_balance'] ?? 0),
        ]);
      }
    }
    final pdf = pw.Document(title: 'كشوف حساب العملاء');
    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        textDirection: pw.TextDirection.rtl,
        theme: pw.ThemeData.withFont(base: ar, bold: ar, fontFallback: [latin]),
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
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'كشوف حساب العملاء',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                  color: const PdfColor.fromInt(0xFF3E0865),
                ),
              ),
              pw.Text(
                'الفترة: ${dateText(fromDate)} — ${dateText(toDate)}',
                style: const pw.TextStyle(fontSize: 9),
              ),
            ],
          ),
        ),
        build: (_) => [
          pw.SizedBox(height: 12),
          pw.TableHelper.fromTextArray(
            headers: const [
              'العميل',
              'التاريخ',
              'النوع',
              'المرجع',
              'مدين',
              'دائن',
              'الرصيد',
            ],
            data: rows,
            headerStyle: pw.TextStyle(
              fontWeight: pw.FontWeight.bold,
              color: const PdfColor.fromInt(0xFF3E0865),
            ),
            headerDecoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFFF4EFF7),
            ),
            cellStyle: const pw.TextStyle(fontSize: 8),
            cellAlignment: pw.Alignment.centerRight,
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
      filename: 'كشوف-حساب-العملاء.pdf',
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'كشوفات حساب العملاء',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          onPressed: statements.isEmpty
              ? null
              : () => _shareAllStatementsPdf(statements),
          icon: const Icon(Icons.print),
          tooltip: 'طباعة الكشوف',
        ),
      ],
    ),
    body: FutureBuilder<List<dynamic>>(
      future: customers,
      builder: (context, customerSnap) {
        if (!customerSnap.hasData)
          return const Center(child: CircularProgressIndicator());
        final customerList = customerSnap.data!;
        return FutureBuilder<List<dynamic>>(
          future: reps,
          builder: (context, repSnap) {
            if (!repSnap.hasData)
              return const Center(child: CircularProgressIndicator());
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: customerSearch,
                  textDirection: TextDirection.rtl,
                  decoration: InputDecoration(
                    labelText: 'بحث عن العميل بالاسم أو الرقم',
                    prefixIcon: const Icon(Icons.search),
                    border: const OutlineInputBorder(),
                    suffixIcon: customerSearch.text.isEmpty
                        ? null
                        : IconButton(
                            onPressed: customerSearch.clear,
                            icon: const Icon(Icons.clear),
                          ),
                  ),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String?>(
                  initialValue: customerId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'العميل — اتركه فارغًا للكل',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('كل العملاء'),
                    ),
                    ...customerList
                        .where((x) {
                          final m = Map<String, dynamic>.from(x as Map);
                          final q = customerSearch.text.trim().toLowerCase();
                          if (q.isEmpty || m['id']?.toString() == customerId)
                            return true;
                          return '${m['name_ar'] ?? ''} ${m['name_en'] ?? ''} ${m['customer_number'] ?? ''}'
                              .toLowerCase()
                              .contains(q);
                        })
                        .map((x) {
                          final m = Map<String, dynamic>.from(x as Map);
                          return DropdownMenuItem<String?>(
                            value: m['id']?.toString(),
                            child: Text(
                              '${m['name_ar'] ?? '—'}${m['customer_number'] == null ? '' : ' — ${m['customer_number']}'}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }),
                  ],
                  onChanged: (v) => setState(() {
                    customerId = v;
                    statements = [];
                    statement = null;
                  }),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String?>(
                  initialValue: repId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'المندوب — اختياري',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('كل المناديب'),
                    ),
                    ...repSnap.data!.map((x) {
                      final m = Map<String, dynamic>.from(x as Map);
                      return DropdownMenuItem<String?>(
                        value: m['id']?.toString(),
                        child: Text(
                          m['full_name']?.toString() ??
                              m['name_ar']?.toString() ??
                              '—',
                        ),
                      );
                    }),
                  ],
                  onChanged: (v) => setState(() {
                    repId = v;
                    statements = [];
                    statement = null;
                  }),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(true),
                        icon: const Icon(Icons.date_range),
                        label: Text('من ${dateText(fromDate)}'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(false),
                        icon: const Icon(Icons.event),
                        label: Text('إلى ${dateText(toDate)}'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: loadingAll
                      ? null
                      : () => _loadStatements(customerList),
                  icon: const Icon(Icons.receipt_long),
                  label: Text(
                    loadingAll
                        ? 'جاري تحميل الكشوف...'
                        : 'عرض الكشوف حسب الفلاتر',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: _brand,
                    minimumSize: const Size.fromHeight(50),
                  ),
                ),
                if (statements.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => _shareAllStatementsPdf(statements),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: Text(
                      'طباعة ${statements.length == 1 ? 'كشف العميل' : 'كل الكشوف'}',
                    ),
                  ),
                  const Divider(),
                  ...statements.map((data) {
                    final summary =
                        (data['summary'] as Map?)?.cast<String, dynamic>() ??
                        data;
                    final rows = (data['transactions'] as List?) ?? [];
                    return Card(
                      child: ExpansionTile(
                        initiallyExpanded: statements.length == 1,
                        title: Text(
                          customerName(data),
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          'الفواتير: ${money(summary['total_invoiced'])} ر.س  •  المقبوض: ${money(summary['total_paid'])} ر.س  •  المتبقي: ${money(summary['outstanding'] ?? summary['closing_balance'])} ر.س',
                        ),
                        children: [
                          ...rows.map((r) {
                            final m = Map<String, dynamic>.from(r as Map);
                            final debit =
                                double.tryParse('${m['debit'] ?? 0}') ?? 0;
                            final credit =
                                double.tryParse('${m['credit'] ?? 0}') ?? 0;
                            final amount = debit > 0 ? debit : credit;
                            return ListTile(
                              title: Text(_movementType(m)),
                              subtitle: Text(
                                '${_movementDescription(m)}\n${('${m['date'] ?? '—'}').split('T').first}',
                              ),
                              trailing: Text(
                                '${debit > 0 ? 'مدين' : 'دائن'}\n${money(amount)} ر.س',
                                textAlign: TextAlign.end,
                              ),
                            );
                          }),
                          if (rows.isEmpty)
                            const Padding(
                              padding: EdgeInsets.all(16),
                              child: Text('لا توجد حركات في الفترة المحددة'),
                            ),
                        ],
                      ),
                    );
                  }),
                ],
              ],
            );
          },
        );
      },
    ),
  );
}
