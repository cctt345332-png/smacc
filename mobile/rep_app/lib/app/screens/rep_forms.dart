import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../data/api_client.dart';
import 'rep_extra.dart';

const _brand = Color(0xFF3E0865);

class CustomerFormScreen extends StatefulWidget {
  const CustomerFormScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<CustomerFormScreen> createState() => _CustomerFormScreenState();
}

class _CustomerFormScreenState extends State<CustomerFormScreen> {
  final _form = GlobalKey<FormState>();
  final Map<String, TextEditingController> c = {
    for (final k in [
      'name_ar',
      'name_en',
      'phone',
      'phone2',
      'email',
      'vat_number',
      'cr_number',
      'national_id',
      'owner_name',
      'owner_national_id',
      'license_number',
      'activity_type',
      'address_street',
      'address_building',
      'address_city',
      'address_district',
      'address_postal',
      'address_additional',
      'website',
      'credit_limit',
      'payment_terms_days',
      'opening_balance',
      'notes',
    ])
      k: TextEditingController(),
  };
  String type = 'company';
  bool saving = false;
  @override
  void dispose() {
    for (final x in c.values) x.dispose();
    super.dispose();
  }

  String? requiredName(String? v) =>
      v == null || v.trim().isEmpty ? 'هذا الحقل مطلوب' : null;
  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => saving = true);
    final data = <String, dynamic>{
      'customer_type': type,
      for (final e in c.entries)
        if (e.value.text.trim().isNotEmpty) e.key: e.value.text.trim(),
    };
    for (final k in ['credit_limit', 'opening_balance'])
      data[k] = double.tryParse(c[k]!.text) ?? 0;
    data['payment_terms_days'] =
        int.tryParse(c['payment_terms_days']!.text) ?? 30;
    try {
      await widget.apiClient.post('/sales/customers', data);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('تم إنشاء العميل بنجاح')));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget field(
    String key,
    String label, {
    bool number = false,
    int lines = 1,
    String? Function(String?)? validator,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: c[key],
      keyboardType: number
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      maxLines: lines,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        filled: true,
        fillColor: Colors.white,
      ),
    ),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'عميل جديد',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'البيانات الأساسية',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: type,
            decoration: const InputDecoration(
              labelText: 'نوع العميل',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(value: 'company', child: Text('شركة')),
              DropdownMenuItem(value: 'individual', child: Text('فرد')),
            ],
            onChanged: (v) => setState(() => type = v ?? 'company'),
          ),
          const SizedBox(height: 12),
          field('name_ar', 'الاسم بالعربي *', validator: requiredName),
          field('name_en', 'الاسم بالإنجليزي'),
          field('phone', 'الجوال'),
          field('phone2', 'جوال إضافي'),
          field('email', 'البريد الإلكتروني'),
          const Divider(height: 28),
          const Text(
            'البيانات النظامية',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          field('vat_number', 'الرقم الضريبي'),
          field('cr_number', 'السجل التجاري'),
          field('national_id', 'رقم الهوية'),
          field('owner_name', 'اسم المالك'),
          field('owner_national_id', 'هوية المالك'),
          field('license_number', 'رقم الرخصة'),
          field('activity_type', 'نوع النشاط'),
          const Divider(height: 28),
          const Text(
            'العنوان والتواصل',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          field('address_street', 'الشارع'),
          field('address_building', 'رقم المبنى'),
          field('address_city', 'المدينة'),
          field('address_district', 'الحي'),
          field('address_postal', 'الرمز البريدي'),
          field('address_additional', 'العنوان الإضافي'),
          field('website', 'الموقع الإلكتروني'),
          const Divider(height: 28),
          const Text(
            'الحدود المالية',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          field('credit_limit', 'حد الائتمان', number: true),
          field('payment_terms_days', 'مدة السداد بالأيام', number: true),
          field('opening_balance', 'الرصيد الافتتاحي', number: true),
          field('notes', 'ملاحظات', lines: 3),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: saving ? null : _save,
            icon: const Icon(Icons.save_outlined),
            label: Text(saving ? 'جاري الحفظ...' : 'حفظ العميل'),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: _brand,
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    ),
  );
}

class InvoiceCreateScreen extends StatefulWidget {
  const InvoiceCreateScreen({
    required this.apiClient,
    this.invoiceId,
    super.key,
  });
  final ApiClient apiClient;
  final String? invoiceId;
  @override
  State<InvoiceCreateScreen> createState() => _InvoiceCreateScreenState();
}

class _InvoiceCreateScreenState extends State<InvoiceCreateScreen> {
  late Future<List<dynamic>> _customers;
  late Future<List<dynamic>> _stock;
  String? customerId;
  String payment = 'cash';
  String? itemId;
  String itemName = '';
  bool serialTracking = false;
  List<dynamic> serials = [];
  List<String> selectedSerialIds = [];
  final issue = TextEditingController(
    text: DateTime.now().toIso8601String().substring(0, 10),
  );
  final due = TextEditingController();
  final notes = TextEditingController();
  final qty = TextEditingController(text: '1');
  final price = TextEditingController();
  final discount = TextEditingController(text: '0');
  final vat = TextEditingController(text: '15');
  bool saving = false;

  bool get editing => widget.invoiceId != null;

  static const int defaultCreditDays = 21;

  void _calculateDueDate() {
    final issueDate = DateTime.tryParse(issue.text.trim());
    if (issueDate == null) return;
    final calculated = issueDate.add(const Duration(days: defaultCreditDays));
    final value =
        '${calculated.year.toString().padLeft(4, '0')}-'
        '${calculated.month.toString().padLeft(2, '0')}-'
        '${calculated.day.toString().padLeft(2, '0')}';
    if (due.text != value) due.text = value;
  }

  @override
  void initState() {
    super.initState();
    _customers = widget.apiClient.getList('/sales/customers');
    _stock = widget.apiClient.getList('/reps/me/stock');
    if (editing) _loadExistingInvoice();
  }

  Future<void> _loadExistingInvoice() async {
    try {
      final raw = await widget.apiClient.getMap(
        '/sales/invoices/${widget.invoiceId}',
      );
      final invoice = raw['data'] is Map
          ? Map<String, dynamic>.from(raw['data'] as Map)
          : raw;
      final lines = invoice['lines'] is List
          ? invoice['lines'] as List
          : const <dynamic>[];
      final line = lines.isEmpty
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(lines.first as Map);
      final vatRate = double.tryParse('${line['vat_rate'] ?? 15}') ?? 15;
      final rawSerials = line['serial_ids_json'];
      List<String> serialIds = [];
      if (rawSerials is List) {
        serialIds = rawSerials.map((x) => '$x').toList();
      } else if (rawSerials != null && '$rawSerials'.isNotEmpty) {
        try {
          final decoded = jsonDecode('$rawSerials');
          if (decoded is List) serialIds = decoded.map((x) => '$x').toList();
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        customerId = invoice['customer_id']?.toString();
        payment = invoice['invoice_payment_method']?.toString() ?? 'cash';
        issue.text =
            '${invoice['issue_date'] ?? DateTime.now().toIso8601String()}'
                .substring(0, 10);
        due.text = invoice['due_date'] == null
            ? ''
            : '${invoice['due_date']}'.substring(0, 10);
        if (payment == 'credit' && due.text.isEmpty) _calculateDueDate();
        notes.text = invoice['notes']?.toString() ?? '';
        itemId = line['inventory_item_id']?.toString();
        itemName = line['description_ar']?.toString() ?? '';
        qty.text = '${line['quantity'] ?? 1}';
        price.text =
            ((double.tryParse('${line['unit_price'] ?? 0}') ?? 0) *
                    (1 + vatRate / 100))
                .toStringAsFixed(2);
        discount.text = '${line['discount_pct'] ?? 0}';
        vat.text = '$vatRate';
        selectedSerialIds = serialIds;
        serialTracking = serialIds.isNotEmpty;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذر تحميل الفاتورة للتعديل: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    for (final x in [issue, due, notes, qty, price, discount, vat]) x.dispose();
    super.dispose();
  }

  double get total {
    final q = double.tryParse(qty.text) ?? 0,
        p = double.tryParse(price.text) ?? 0,
        d = double.tryParse(discount.text) ?? 0;
    // السعر المدخل شامل الضريبة؛ لا نضيف الضريبة مرة ثانية على الإجمالي.
    return q * p * (1 - d / 100);
  }

  Future<void> _chooseSerials() async {
    if (itemId == null) return;
    final result = await Navigator.push<List<String>>(
      context,
      MaterialPageRoute<List<String>>(
        builder: (_) => SerialPicker(
          apiClient: widget.apiClient,
          productId: itemId!,
          selected: selectedSerialIds,
        ),
      ),
    );
    if (result != null && mounted) {
      setState(() {
        selectedSerialIds = result;
        qty.text = result.length.toString();
      });
    }
  }

  Future<void> _selectItem(String? value, List<dynamic> stock) async {
    if (value == null) return;
    final m = stock
        .map((x) => Map<String, dynamic>.from(x as Map))
        .firstWhere(
          (x) => (x['item_id'] ?? x['id']).toString() == value,
          orElse: () => <String, dynamic>{},
        );
    final isSerial =
        m['item_tracking'] == 'serial' || m['tracking_type'] == 'serial';
    setState(() {
      itemId = value;
      itemName = (m['item_name'] ?? m['name_ar'] ?? '').toString();
      serialTracking = isSerial;
      selectedSerialIds = [];
      serials = [];
      price.text = (m['sale_price'] ?? 0).toString();
      qty.text = isSerial ? '0' : '1';
    });
    if (isSerial) {
      try {
        final rows = await widget.apiClient.getAvailableSerials(value);
        if (mounted) setState(() => serials = rows);
      } catch (_) {}
    }
  }

  Future<void> _scanSerial() async {
    if (serials.isEmpty) return;
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
                // كرتون الجوال يحتوي عدة باركودات؛ نأخذ رقم IMEI (أرقام فقط، 14–16 خانة)
                // بدلاً من باركود المنتج الكبير أو QR.
                final code = capture.barcodes
                    .map((b) => b.rawValue?.trim())
                    .whereType<String>()
                    .firstWhere(
                      (v) => RegExp(r'^\d{14,16}$').hasMatch(v),
                      orElse: () => '',
                    );
                if (code.isEmpty) return;
                handled = true;
                final normalized = code
                    .replaceAll(RegExp(r'\s'), '')
                    .toLowerCase();
                var found = serials
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
                    final remote = await widget.apiClient.searchSerials(code);
                    found = remote
                        .map((x) => Map<String, dynamic>.from(x as Map))
                        .where((x) => '${x['product_id']}' == itemId)
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
                if (found.isNotEmpty && mounted) {
                  final id = found.first['id'].toString();
                  if (!selectedSerialIds.contains(id)) {
                    setState(() {
                      selectedSerialIds.add(id);
                      qty.text = selectedSerialIds.length.toString();
                      if (found.first['sale_price'] != null)
                        price.text = found.first['sale_price'].toString();
                    });
                  }
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('تم التعرف على IMEI 1: $code')),
                  );
                } else if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'IMEI 1 غير موجود في مخزون هذا الجهاز: $code',
                      ),
                    ),
                  );
                }
                if (sheetContext.mounted) Navigator.pop(sheetContext);
              },
            ),
            IgnorePointer(
              child: Center(
                child: Container(
                  width: 320,
                  height: 120,
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
                        'امسح باركود IMEI 1 فقط\nالباركود الطويل الموجود بجانب IMEI 1',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
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
                        'قرّب الكاميرا حتى يظهر الباركود واضحاً',
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

  Future<void> _save({bool submit = false}) async {
    if (customerId == null || itemId == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('اختر العميل والصنف أولاً')));
      return;
    }
    if (serialTracking && selectedSerialIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('اختر سيريالاً واحداً على الأقل للجهاز')),
      );
      return;
    }
    setState(() => saving = true);
    final q = double.tryParse(qty.text) ?? 1,
        p = double.tryParse(price.text) ?? 0,
        t = double.tryParse(vat.text) ?? 15,
        d = double.tryParse(discount.text) ?? 0;
    final payload = {
      'customer_id': customerId,
      'invoice_type': 'simplified',
      'invoice_payment_method': payment,
      'credit_days': payment == 'credit' ? defaultCreditDays : null,
      'issue_date': '${issue.text}T00:00:00',
      'supply_date': '${issue.text}T00:00:00',
      'due_date': payment == 'credit' && due.text.isNotEmpty
          ? '${due.text}T00:00:00'
          : null,
      'notes': notes.text.trim().isEmpty ? null : notes.text.trim(),
      'lines': [
        {
          'description_ar': itemName,
          'quantity': q,
          'unit_price': p / (1 + t / 100),
          'discount_pct': d,
          'vat_rate': t,
          'vat_category': 'S',
          'line_order': 0,
          'inventory_item_id': itemId,
          if (serialTracking) 'serial_ids': selectedSerialIds,
        },
      ],
    };
    try {
      final result = editing
          ? await widget.apiClient.patch(
              '/sales/invoices/${widget.invoiceId}',
              payload,
            )
          : await widget.apiClient.post('/sales/invoices', payload);
      if (submit && result['id'] != null)
        await widget.apiClient.post('/reps/me/invoices/${result['id']}/submit');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              submit
                  ? 'تم إرسال الفاتورة للمراجعة'
                  : editing
                  ? 'تم حفظ تعديل الفاتورة'
                  : 'تم حفظ الفاتورة كمسودة',
            ),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget _dropdownText(String text) =>
      Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, softWrap: false);
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          editing ? 'تعديل فاتورة المبيعات' : 'فاتورة مبيعات جديدة',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: FutureBuilder<List<dynamic>>(
        future: Future.wait([_customers, _stock]),
        builder: (context, snap) {
          if (!snap.hasData)
            return const Center(child: CircularProgressIndicator());
          final customers = snap.data![0] as List<dynamic>;
          final stock = snap.data![1] as List<dynamic>;
          return Directionality(
            textDirection: TextDirection.rtl,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'بيانات الفاتورة',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: customerId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'العميل *',
                    border: OutlineInputBorder(),
                  ),
                  items: customers.map((x) {
                    final m = Map<String, dynamic>.from(x as Map);
                    return DropdownMenuItem(
                      value: m['id']?.toString(),
                      child: _dropdownText(m['name_ar']?.toString() ?? '—'),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => customerId = v),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: payment,
                  decoration: const InputDecoration(
                    labelText: 'طريقة الدفع',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('نقدي')),
                    DropdownMenuItem(value: 'credit', child: Text('آجل')),
                  ],
                  onChanged: (v) {
                    setState(() {
                      payment = v ?? 'cash';
                      if (payment == 'credit') {
                        _calculateDueDate();
                      } else {
                        due.clear();
                      }
                    });
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: issue,
                  textDirection: TextDirection.ltr,
                  onChanged: (_) {
                    if (payment == 'credit') {
                      setState(_calculateDueDate);
                    }
                  },
                  decoration: const InputDecoration(
                    labelText: 'تاريخ الإصدار',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (payment == 'credit') ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: due,
                    textDirection: TextDirection.ltr,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'تاريخ الاستحقاق',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
                const Divider(height: 32),
                const Text(
                  'الصنف',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: itemId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'الصنف من مخزون المندوب *',
                    border: OutlineInputBorder(),
                  ),
                  items: stock.map((x) {
                    final m = Map<String, dynamic>.from(x as Map);
                    final name =
                        '${m['item_name'] ?? m['name_ar'] ?? '—'} — المتاح: ${m['available_qty'] ?? m['quantity'] ?? 0}';
                    return DropdownMenuItem(
                      value: (m['item_id'] ?? m['id'])?.toString(),
                      child: _dropdownText(name),
                    );
                  }).toList(),
                  onChanged: (v) => _selectItem(v, stock),
                ),
                if (serialTracking)
                  Card(
                    color: const Color(0xFFFFF7E6),
                    child: ListTile(
                      leading: const Icon(
                        Icons.devices_other,
                        color: Colors.orange,
                      ),
                      title: Text(
                        'جهاز مسرّل — المحدد: ${selectedSerialIds.length}',
                      ),
                      subtitle: const Text('اختر سيريالاً لكل جهاز'),
                      trailing: Wrap(
                        children: [
                          IconButton(
                            onPressed: _scanSerial,
                            icon: const Icon(Icons.qr_code_scanner),
                          ),
                          IconButton(
                            onPressed: _chooseSerials,
                            icon: const Icon(Icons.list_alt),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: qty,
                        readOnly: serialTracking,
                        decoration: const InputDecoration(
                          labelText: 'الكمية',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: price,
                        decoration: const InputDecoration(
                          labelText: 'السعر شامل الضريبة',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: discount,
                        decoration: const InputDecoration(
                          labelText: 'الخصم %',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: vat,
                        decoration: const InputDecoration(
                          labelText: 'الضريبة %',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notes,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'ملاحظات',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  color: const Color(0xFFF4EFF7),
                  child: ListTile(
                    title: const Text('الإجمالي'),
                    trailing: Text(
                      '${total.toStringAsFixed(2)} ر.س',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: _brand,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: saving ? null : _save,
                  child: Text(editing ? 'حفظ التعديل' : 'حفظ كمسودة'),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: saving ? null : () => _save(submit: true),
                  style: FilledButton.styleFrom(
                    backgroundColor: _brand,
                    minimumSize: const Size.fromHeight(50),
                  ),
                  child: Text(saving ? 'جاري الحفظ...' : 'إرسال للمراجعة'),
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }
}

class PaymentCreateScreen extends StatefulWidget {
  const PaymentCreateScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<PaymentCreateScreen> createState() => _PaymentCreateScreenState();
}

class _PaymentCreateScreenState extends State<PaymentCreateScreen> {
  late Future<List<List<Map<String, dynamic>>>> _data;
  final amount = TextEditingController();
  final reference = TextEditingController();
  final notes = TextEditingController();
  String mode = 'invoice', method = 'cash';
  String? invoiceId, customerId;
  bool saving = false, loadingBalance = false;
  List<Map<String, dynamic>> customerInvoices = [];
  double? customerBalance;
  String? balanceError;
  @override
  void initState() {
    super.initState();
    _data = _loadData();
  }

  Future<List<Map<String, dynamic>>> _safeList(String path) async {
    try {
      final rows = await widget.apiClient.getList(path);
      return rows
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  Future<List<List<Map<String, dynamic>>>> _loadData() async {
    final invoices = await _safeList('/sales/invoices');
    final customers = await _safeList('/sales/customers');
    return [invoices, customers];
  }

  @override
  void dispose() {
    amount.dispose();
    reference.dispose();
    notes.dispose();
    super.dispose();
  }

  double remaining(Map<String, dynamic> x) =>
      (double.tryParse('${x['total'] ?? 0}') ?? 0) -
      (double.tryParse('${x['paid_amount'] ?? 0}') ?? 0);
  void chooseInvoice(String? id, List<Map<String, dynamic>> rows) {
    final inv = rows.where((x) => '${x['id']}' == id).firstOrNull;
    setState(() {
      invoiceId = id;
      if (inv != null) amount.text = remaining(inv).toStringAsFixed(2);
    });
  }

  Future<void> chooseCustomer(
    String? id,
    List<Map<String, dynamic>> invoices,
  ) async {
    final selected = invoices
        .where((x) => '${x['customer_id']}' == id)
        .toList();
    setState(() {
      customerId = id;
      invoiceId = selected.length == 1 ? '${selected.first['id']}' : null;
      customerInvoices = selected;
      customerBalance = null;
      balanceError = null;
      loadingBalance = id != null;
      amount.clear();
    });
    if (id == null) return;
    try {
      final now = DateTime.now().toIso8601String();
      final response = await widget.apiClient.getMap(
        '/sales/customers/$id/statement?from_date=2000-01-01T00:00:00&to_date=${Uri.encodeQueryComponent(now)}',
      );
      final summary = response['summary'];
      final balance = summary is Map
          ? double.tryParse('${summary['closing_balance']}')
          : null;
      if (balance == null) throw Exception('closing_balance missing');
      if (!mounted) return;
      setState(() {
        customerBalance = balance;
        loadingBalance = false;
        if (mode == 'discount' || selected.length == 1)
          amount.text = balance.toStringAsFixed(2);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loadingBalance = false;
        balanceError = 'تعذر جلب الرصيد النهائي من كشف الحساب';
      });
    }
  }

  Future<void> _save() async {
    final selectedInvoice = mode == 'discount'
        ? null
        : mode == 'invoice'
        ? invoiceId
        : (customerInvoices.length == 1
              ? '${customerInvoices.first['id']}'
              : invoiceId);
    final entered = double.tryParse(amount.text) ?? 0;
    if (selectedInvoice == null &&
        !(mode == 'discount' && customerId != null)) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('اختر الفاتورة')));
      return;
    }
    if (entered <= 0) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('أدخل مبلغاً صحيحاً')));
      return;
    }
    setState(() => saving = true);
    try {
      await widget.apiClient.post('/sales/payments', {
        'invoice_id': selectedInvoice,
        'customer_id': customerId,
        'payment_type': mode == 'discount' ? 'discount' : 'receipt',
        'payment_date': DateTime.now().toIso8601String(),
        'amount': entered,
        'payment_method': method,
        'reference': reference.text.trim().isEmpty
            ? null
            : reference.text.trim(),
        'notes': notes.text.trim().isEmpty ? null : notes.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              mode == 'discount' ? 'تم إنشاء سند الخصم' : 'تم إنشاء سند القبض',
            ),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('تعذر إنشاء السند: $e')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        mode == 'discount' ? 'سند خصم جديد' : 'سند قبض جديد',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    body: FutureBuilder<List<List<Map<String, dynamic>>>>(
      future: _data,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snap.hasError)
          return Center(
            child: Text(
              'تعذر تحميل بيانات السند\n${snap.error}',
              textAlign: TextAlign.center,
            ),
          );
        final invoices = snap.data![0]
            .where((x) => remaining(x) > .01)
            .toList();
        final customers = snap.data![1];
        final visibleInvoices = mode == 'customer'
            ? customerInvoices
            : invoices;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(child: _modeButton('عن طريق الفاتورة', 'invoice')),
                const SizedBox(width: 8),
                Expanded(child: _modeButton('عن طريق العميل', 'customer')),
                const SizedBox(width: 8),
                Expanded(child: _modeButton('سند خصم', 'discount')),
              ],
            ),
            const SizedBox(height: 16),
            if (mode == 'invoice') ...[
              const Text(
                'الفاتورة *',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              _invoiceDropdown(visibleInvoices),
            ] else ...[
              DropdownButtonFormField<String>(
                initialValue: customers.any((x) => '${x['id']}' == customerId)
                    ? customerId
                    : null,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'العميل *',
                  border: OutlineInputBorder(),
                ),
                items: customers
                    .map<DropdownMenuItem<String>>(
                      (x) => DropdownMenuItem<String>(
                        value: '${x['id']}',
                        child: Text(
                          '${x['name_ar'] ?? '—'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) => chooseCustomer(v, invoices),
              ),
              if (customerId != null) ...[
                if (loadingBalance)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                Card(
                  margin: const EdgeInsets.only(top: 12),
                  color: const Color(0xFFF4EFF7),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'رصيد العميل المستحق',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 5),
                            if (loadingBalance)
                              const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 3,
                                ),
                              )
                            else if (balanceError != null)
                              Text(
                                balanceError!,
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 12,
                                ),
                              )
                            else
                              Text(
                                '${(customerBalance ?? 0).toStringAsFixed(2)} ر.س',
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: _brand,
                                ),
                              ),
                          ],
                        ),
                        Text(
                          '${customerInvoices.length} فاتورة',
                          style: const TextStyle(
                            color: Colors.black54,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (customerInvoices.length > 1) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'اختر الفاتورة *',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  _invoiceDropdown(customerInvoices),
                ],
              ],
            ],
            const SizedBox(height: 12),
            TextField(
              controller: amount,
              decoration: InputDecoration(
                labelText: mode == 'discount'
                    ? 'مبلغ الخصم (ر.س) *'
                    : 'المبلغ المقبوض (ر.س) *',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            if (mode != 'discount') ...[
              DropdownButtonFormField<String>(
                initialValue: method,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'طريقة الدفع',
                  border: OutlineInputBorder(),
                ),
                items: const <DropdownMenuItem<String>>[
                  DropdownMenuItem<String>(value: 'cash', child: Text('نقداً')),
                  DropdownMenuItem<String>(
                    value: 'bank_transfer',
                    child: Text('تحويل بنكي'),
                  ),
                  DropdownMenuItem<String>(value: 'cheque', child: Text('شيك')),
                  DropdownMenuItem<String>(value: 'mada', child: Text('مدى')),
                  DropdownMenuItem<String>(
                    value: 'stc_pay',
                    child: Text('STC Pay'),
                  ),
                  DropdownMenuItem<String>(
                    value: 'credit_card',
                    child: Text('بطاقة'),
                  ),
                ],
                onChanged: (v) => setState(() => method = v ?? 'cash'),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: reference,
              decoration: const InputDecoration(
                labelText: 'المرجع / رقم الشيك / التحويل',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: notes,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'ملاحظات',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: saving ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: _brand,
                minimumSize: const Size.fromHeight(52),
              ),
              child: Text(saving ? 'جاري الحفظ...' : 'حفظ سند القبض'),
            ),
          ],
        );
      },
    ),
  );
  Widget _invoiceDropdown(
    List<Map<String, dynamic>> rows,
  ) => DropdownButtonFormField<String>(
    initialValue: rows.any((x) => '${x['id']}' == invoiceId) ? invoiceId : null,
    isExpanded: true,
    decoration: const InputDecoration(
      labelText: 'الفاتورة *',
      border: OutlineInputBorder(),
    ),
    items: rows
        .map<DropdownMenuItem<String>>(
          (x) => DropdownMenuItem<String>(
            value: '${x['id']}',
            child: Text(
              '${x['invoice_number'] ?? '—'} — ${x['buyer_name_ar'] ?? ''} — المتبقي ${remaining(x).toStringAsFixed(2)} ر.س',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        )
        .toList(),
    onChanged: (v) => chooseInvoice(v, rows),
  );
  Widget _modeButton(String label, String value) => OutlinedButton(
    onPressed: () => setState(() {
      mode = value;
      invoiceId = null;
      customerId = null;
      customerInvoices = [];
      customerBalance = null;
      balanceError = null;
      amount.clear();
    }),
    style: OutlinedButton.styleFrom(
      side: BorderSide(
        width: 2,
        color: mode == value ? _brand : Colors.grey.shade300,
      ),
      backgroundColor: mode == value ? const Color(0xFFF4EFF7) : null,
    ),
    child: Text(label, textAlign: TextAlign.center),
  );
}
