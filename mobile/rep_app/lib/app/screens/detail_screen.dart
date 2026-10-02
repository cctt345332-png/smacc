import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../data/api_client.dart';

const detailBrand = Color(0xFF3E0865);

class DetailScreen extends StatefulWidget {
  const DetailScreen({
    required this.apiClient,
    required this.title,
    required this.path,
    super.key,
  });
  final ApiClient apiClient;
  final String title;
  final String path;
  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  late Future<Map<String, dynamic>> future;
  @override
  void initState() {
    super.initState();
    future = _loadDetails();
  }

  Future<Map<String, dynamic>> _loadDetails() async {
    final raw = await widget.apiClient.getMap(widget.path);
    final data = raw['data'] is Map
        ? Map<String, dynamic>.from(raw['data'] as Map)
        : Map<String, dynamic>.from(raw);
    if (widget.path.contains('/invoices/')) {
      await _resolveInvoiceSerials(data);
    } else if (widget.path.contains('/payments/')) {
      await _resolvePaymentReferences(data);
    }
    return {'data': data};
  }

  Future<void> _resolveInvoiceSerials(Map<String, dynamic> data) async {
    final lines = data['lines'];
    if (lines is! List) return;
    for (final entry in lines) {
      if (entry is! Map) continue;
      final line = Map<String, dynamic>.from(entry);
      final raw = line['serial_ids_json'];
      final ids = _decodeList(raw);
      if (ids.isEmpty) continue;
      final resolved = <String>[];
      for (final id in ids) {
        try {
          final serial = await widget.apiClient.getSerial(id);
          final number = serial['serial_number'];
          if (number != null && '$number'.isNotEmpty) resolved.add('$number');
        } catch (_) {}
      }
      line['serial_ids_json'] = resolved;
      entry
        ..clear()
        ..addAll(line);
    }
  }

  Future<void> _resolvePaymentReferences(Map<String, dynamic> data) async {
    final customerId = data['customer_id'];
    if (_looksLikeId(customerId)) {
      try {
        final customer = await widget.apiClient.getMap(
          '/sales/customers/$customerId',
        );
        final c = customer['data'] is Map ? customer['data'] as Map : customer;
        data['customer_name_ar'] = c['name_ar'];
        data['customer_number'] = c['customer_number'];
      } catch (_) {}
    }
    final invoiceId = data['invoice_id'];
    if (_looksLikeId(invoiceId)) {
      try {
        final invoice = await widget.apiClient.getMap(
          '/sales/invoices/$invoiceId',
        );
        final i = invoice['data'] is Map ? invoice['data'] as Map : invoice;
        data['invoice_number'] = i['invoice_number'];
        data['buyer_name_ar'] = i['buyer_name_ar'];
      } catch (_) {}
    }
  }

  List<String> _decodeList(dynamic raw) {
    if (raw is List) return raw.map((x) => '$x').toList();
    if (raw == null || '$raw'.isEmpty) return [];
    try {
      final decoded = jsonDecode('$raw');
      return decoded is List ? decoded.map((x) => '$x').toList() : [];
    } catch (_) {
      return [];
    }
  }

  bool _looksLikeId(dynamic value) =>
      value != null && RegExp(r'^[0-9a-fA-F-]{20,}$').hasMatch('$value');
  bool _hiddenKey(String key) => const {
    'id',
    'uuid',
    'customer_id',
    'invoice_id',
    'product_id',
    'inventory_item_id',
    'serial_item_id',
    'warehouse_id',
    'tenant_id',
    'rep_id',
    'user_id',
    'ar_account_id',
  }.contains(key);

  String label(String key) =>
      const {
        'id': 'المعرّف',
        'invoice_number': 'رقم الفاتورة',
        'payment_number': 'رقم السند',
        'payment_type': 'نوع السند',
        'name_ar': 'الاسم بالعربي',
        'name_en': 'الاسم بالإنجليزي',
        'buyer_name_ar': 'اسم العميل',
        'phone': 'رقم الجوال',
        'email': 'البريد الإلكتروني',
        'status': 'حالة الفاتورة',
        'total': 'الإجمالي',
        'paid_amount': 'المبلغ المدفوع',
        'amount': 'المبلغ',
        'payment_method': 'طريقة الدفع',
        'payment_date': 'تاريخ السند',
        'issue_date': 'تاريخ الإصدار',
        'due_date': 'تاريخ الاستحقاق',
        'supply_date': 'تاريخ التوريد',
        'item_name': 'اسم الصنف',
        'item_sku': 'رمز الصنف',
        'available_qty': 'الكمية المتاحة',
        'sale_price': 'سعر البيع',
        'customer_id': 'معرّف العميل',
        'invoice_id': 'معرّف الفاتورة',
        'notes': 'ملاحظات',
        'address_city': 'المدينة',
        'vat_number': 'الرقم الضريبي',
        'credit_limit': 'حد الائتمان',
        'outstanding': 'المبلغ المتبقي',
        'quantity': 'الكمية',
        'created_at': 'تاريخ الإنشاء',
        'uuid': 'المعرّف الإلكتروني',
        'invoice_type': 'نوع الفاتورة',
        'currency_code': 'العملة',
        'buyer_address': 'عنوان العميل',
        'taxable_amount': 'المبلغ الخاضع للضريبة',
        'vat_category': 'فئة الضريبة',
        'buyer_vat_number': 'الرقم الضريبي للعميل',
        'subtotal': 'الإجمالي قبل الضريبة',
        'discount_amount': 'قيمة الخصم',
        'discount_pct': 'نسبة الخصم',
        'vat_amount': 'قيمة الضريبة',
        'vat_rate': 'نسبة الضريبة',
        'grand_total': 'الإجمالي النهائي',
        'remaining': 'المتبقي',
        'reference': 'المرجع',
        'description': 'الوصف',
        'description_ar': 'الوصف',
        'description_en': 'الوصف بالإنجليزية',
        'lines': 'أصناف الفاتورة',
        'invoice_lines': 'أصناف الفاتورة',
        'product_id': 'معرّف الصنف',
        'product_name': 'اسم الصنف',
        'unit': 'الوحدة',
        'unit_price': 'سعر الوحدة',
        'line_total': 'إجمالي الصنف',
        'serial_ids': 'السيريالات',
        'serial_ids_json': 'السيريالات',
        'serial_number': 'رقم السيريال',
        'tracking_type': 'نوع التتبع',
        'item_tracking': 'تتبع الصنف',
        'warehouse_id': 'معرّف المستودع',
        'warehouse_name': 'اسم المستودع',
        'customer_number': 'رقم العميل',
        'customer_type': 'نوع العميل',
        'customer_name_ar': 'اسم العميل',
        'condition': 'حالة الجهاز',
        'address_street': 'الشارع',
        'address_building': 'رقم المبنى',
        'address_district': 'الحي',
        'address_postal': 'الرمز البريدي',
        'address_additional': 'العنوان الإضافي',
        'cr_number': 'السجل التجاري',
        'national_id': 'رقم الهوية',
        'debit': 'مدين',
        'credit': 'دائن',
        'balance': 'الرصيد',
        'total_invoiced': 'إجمالي الفواتير',
        'total_paid': 'إجمالي المقبوض',
        'closing_balance': 'الرصيد الختامي',
        'transactions': 'حركات الحساب',
      }[key] ??
      _fallbackLabel(key);
  String _fallbackLabel(String key) {
    final k = key.toLowerCase();
    if (k.contains('date')) return 'التاريخ';
    if (k.contains('name')) return 'الاسم';
    if (k.contains('number')) return 'الرقم';
    if (k.contains('amount') || k.contains('total')) return 'المبلغ';
    if (k.contains('price')) return 'السعر';
    if (k.contains('qty') || k.contains('quantity')) return 'الكمية';
    if (k.contains('address')) return 'العنوان';
    if (k.contains('phone') || k.contains('mobile')) return 'رقم الجوال';
    return 'بيانات إضافية';
  }

  String value(String key, dynamic v) {
    if (v == null || '$v'.isEmpty) return '—';
    const statuses = {
      'draft': 'مسودة',
      'submitted': 'بانتظار المراجعة',
      'approved': 'معتمدة',
      'confirmed': 'مؤكدة',
      'paid': 'مدفوعة بالكامل',
      'partial': 'مدفوعة جزئياً',
      'overdue': 'متأخرة السداد',
      'cancelled': 'ملغاة',
    };
    const methods = {
      'cash': 'نقداً',
      'bank_transfer': 'تحويل بنكي',
      'transfer': 'تحويل بنكي',
      'cheque': 'شيك',
      'check': 'شيك',
      'mada': 'مدى',
      'stc_pay': 'STC Pay',
      'credit_card': 'بطاقة',
    };
    const voucherTypes = {'receipt': 'سند قبض', 'discount': 'سند خصم'};
    const invoiceTypes = {
      'standard': 'فاتورة ضريبية',
      'simplified': 'فاتورة ضريبية مبسطة',
      'credit_note': 'إشعار دائن',
      'debit_note': 'إشعار مدين',
    };
    const customerTypes = {
      'company': 'شركة',
      'individual': 'فرد',
      'government': 'جهة حكومية',
    };
    const trackingTypes = {
      'quantity': 'بالكمية',
      'serial': 'بالسيريال',
      'batch': 'بالتشغيلة',
    };
    if (key == 'status') return statuses['$v'] ?? '$v';
    if (key == 'payment_method') return methods['$v'] ?? '$v';
    if (key == 'payment_type' || key == 'voucher_type')
      return voucherTypes['$v'] ?? '$v';
    if (key == 'invoice_type') return invoiceTypes['$v'] ?? '$v';
    if (key == 'customer_type') return customerTypes['$v'] ?? '$v';
    if (key == 'condition')
      return const {
            'new': 'جديد',
            'used': 'مستعمل',
            'refurbished': 'مجدد',
          }['$v'] ??
          '$v';
    if (key == 'currency_code' && '$v'.toUpperCase() == 'SAR')
      return 'ريال سعودي';
    if (key == 'tracking_type' || key == 'item_tracking')
      return trackingTypes['$v'] ?? '$v';
    if (key == 'serial_ids_json' || key == 'serial_ids') return _serials(v);
    if (key.endsWith('_date') ||
        key == 'created_at' ||
        key == 'issue_date' ||
        key == 'supply_date' ||
        key == 'due_date') {
      try {
        return DateTime.parse('$v').toLocal().toString().split(' ').first;
      } catch (_) {}
    }
    if ([
      'total',
      'paid_amount',
      'amount',
      'sale_price',
      'outstanding',
      'credit_limit',
      'subtotal',
      'discount_amount',
      'vat_amount',
      'grand_total',
      'remaining',
      'unit_price',
      'line_total',
    ].contains(key))
      return '${_number(v)} ر.س';
    if (key == 'quantity' || key == 'vat_rate' || key == 'discount_pct')
      return _number(v, suffix: key == 'quantity' ? '' : '%');
    return '$v';
  }

  String _number(dynamic v, {String suffix = ''}) {
    final n = double.tryParse('$v');
    return n == null ? '$v' : '${n.toStringAsFixed(2)}$suffix';
  }

  Widget _field(String key, dynamic v) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label(key),
          style: const TextStyle(fontSize: 11, color: Colors.black54),
        ),
        const SizedBox(height: 3),
        Text(
          value(key, v),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
  Widget _row(String a, dynamic av, String b, dynamic bv) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      children: [_field(a, av), const SizedBox(width: 14), _field(b, bv)],
    ),
  );
  Widget _card({required String title, required Widget child}) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    elevation: 0,
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: detailBrand,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    ),
  );

  Widget _invoiceView(Map<String, dynamic> d) {
    final lines = (d['lines'] is List)
        ? (d['lines'] as List)
              .whereType<Map>()
              .map((x) => Map<String, dynamic>.from(x))
              .toList()
        : <Map<String, dynamic>>[];
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        _card(
          title: 'بيانات الفاتورة',
          child: Column(
            children: [
              _row(
                'invoice_number',
                d['invoice_number'],
                'status',
                d['status'],
              ),
              _row(
                'buyer_name_ar',
                d['buyer_name_ar'],
                'buyer_vat_number',
                d['buyer_vat_number'],
              ),
              _row(
                'issue_date',
                d['issue_date'],
                'supply_date',
                d['supply_date'],
              ),
              _row(
                'due_date',
                d['due_date'],
                'invoice_type',
                d['invoice_type'],
              ),
            ],
          ),
        ),
        _card(
          title: 'ملخص المبالغ',
          child: Column(
            children: [
              _row(
                'subtotal',
                d['subtotal'],
                'discount_amount',
                d['discount_amount'],
              ),
              _row(
                'taxable_amount',
                d['taxable_amount'],
                'vat_amount',
                d['vat_amount'],
              ),
              _row('total', d['total'], 'paid_amount', d['paid_amount']),
              _row(
                'remaining',
                (double.tryParse('${d['total'] ?? 0}') ?? 0) -
                    (double.tryParse('${d['paid_amount'] ?? 0}') ?? 0),
                'currency_code',
                d['currency_code'],
              ),
            ],
          ),
        ),
        if (d['buyer_address'] != null || d['notes'] != null)
          _card(
            title: 'معلومات إضافية',
            child: Column(
              children: [
                _row('buyer_address', d['buyer_address'], 'notes', d['notes']),
              ],
            ),
          ),
        _card(
          title: 'أصناف الفاتورة (${lines.length})',
          child: lines.isEmpty
              ? const Text('لا توجد أصناف مسجلة في هذه الفاتورة')
              : Column(
                  children: [
                    for (var i = 0; i < lines.length; i++)
                      _lineCard(i + 1, lines[i]),
                  ],
                ),
        ),
      ],
    );
  }

  String _voucherType(Map<String, dynamic> d) =>
      '${d['payment_type'] ?? d['voucher_type'] ?? 'receipt'}'.toLowerCase();
  String _voucherTitle(Map<String, dynamic> d) =>
      _voucherType(d) == 'discount' ? 'سند خصم' : 'سند قبض';

  String _paymentMethodAr(dynamic method) =>
      const {
        'cash': 'نقداً',
        'bank_transfer': 'تحويل بنكي',
        'cheque': 'شيك',
        'mada': 'مدى',
        'stc_pay': 'STC Pay',
      }['${method ?? ''}'] ??
      '${method ?? '—'}';

  pw.Widget _pdfRow(String label, dynamic value) => pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 7),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [pw.Text('$value'), pw.Text('$label')],
    ),
  );

  Future<void> _printPayment(Map<String, dynamic> d) async {
    final doc = pw.Document();
    final arabic = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSansArabic-Regular.ttf'),
    );
    final latin = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSans-Regular.ttf'),
    );
    Map<String, dynamic> company = {};
    try {
      final raw = await widget.apiClient.getMap('/settings/company');
      company = Map<String, dynamic>.from(
        raw['data'] is Map ? raw['data'] as Map : raw,
      );
    } catch (_) {}
    pw.MemoryImage? logo;
    final logoData = company['logo_data'];
    if (logoData is String && logoData.isNotEmpty) {
      try {
        logo = pw.MemoryImage(
          base64Decode(
            logoData.contains(',') ? logoData.split(',').last : logoData,
          ),
        );
      } catch (_) {}
    }
    final discount = _voucherType(d) == 'discount';
    final title = discount ? 'سند خصم' : 'سند قبض';
    final date = '${d['payment_date'] ?? d['voucher_date'] ?? ''}'
        .split('T')
        .first;
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        theme: pw.ThemeData.withFont(base: arabic, fontFallback: [latin]),
        build: (_) => pw.Directionality(
          textDirection: pw.TextDirection.rtl,
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  if (logo != null) pw.Image(logo!, height: 55),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.end,
                    children: [
                      pw.Text(
                        '${company['name_ar'] ?? company['name'] ?? 'اسم الشركة'}',
                        style: pw.TextStyle(
                          fontSize: 15,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.Text(
                        title,
                        style: pw.TextStyle(
                          fontSize: 22,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.deepPurple,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              pw.SizedBox(height: 16),
              pw.Divider(color: PdfColors.deepPurple),
              pw.Container(
                padding: const pw.EdgeInsets.all(14),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: PdfColors.grey300),
                ),
                child: pw.Column(
                  children: [
                    _pdfRow(
                      'رقم السند',
                      d['payment_number'] ?? d['voucher_number'] ?? '—',
                    ),
                    _pdfRow('التاريخ', date),
                    _pdfRow(
                      'العميل',
                      d['customer_name_ar'] ?? d['party_name'] ?? '—',
                    ),
                    _pdfRow(
                      discount ? 'قيمة الخصم' : 'المبلغ',
                      '${d['amount'] ?? 0} ${d['currency_code'] ?? 'SAR'}',
                    ),
                    if (!discount)
                      _pdfRow(
                        'طريقة الدفع',
                        _paymentMethodAr(d['payment_method']),
                      ),
                    if (d['description_ar'] != null)
                      _pdfRow('البيان', d['description_ar']),
                  ],
                ),
              ),
              pw.Spacer(),
              pw.Divider(),
              pw.Text(
                '${company['name_ar'] ?? company['name'] ?? 'SMACC'}',
                textAlign: pw.TextAlign.center,
                style: const pw.TextStyle(fontSize: 9),
              ),
            ],
          ),
        ),
      ),
    );
    await Printing.layoutPdf(onLayout: (_) async => doc.save());
  }

  Widget _paymentView(Map<String, dynamic> d) {
    final discount = _voucherType(d) == 'discount';
    final date = '${d['payment_date'] ?? d['voucher_date'] ?? ''}'
        .split('T')
        .first;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: const Color(0xFFF8F1FA),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _voucherTitle(d),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: detailBrand,
                  ),
                ),
                const SizedBox(height: 14),
                _row(
                  'رقم السند',
                  d['payment_number'] ?? d['voucher_number'] ?? '—',
                  'التاريخ',
                  date,
                ),
                _row(
                  'العميل',
                  d['customer_name_ar'] ?? d['party_name'] ?? '—',
                  discount ? 'قيمة الخصم' : 'المبلغ',
                  '${d['amount'] ?? 0} ر.س',
                ),
                if (!discount)
                  _row(
                    'طريقة الدفع',
                    _paymentMethodAr(d['payment_method']),
                    'المرجع',
                    d['reference'] ?? '—',
                  ),
                if (d['description_ar'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      '${d['description_ar']}',
                      textAlign: TextAlign.right,
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        OutlinedButton.icon(
          onPressed: () => _printPayment(d),
          icon: const Icon(Icons.print),
          label: Text('معاينة / طباعة ${_voucherTitle(d)}'),
        ),
      ],
    );
  }

  Widget _lineCard(int index, Map<String, dynamic> line) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFF8F5FA),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFE5D8EA)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'الصنف $index: ${line['description_ar'] ?? 'بدون اسم'}',
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: detailBrand,
          ),
        ),
        const SizedBox(height: 8),
        _row('quantity', line['quantity'], 'unit', line['unit'] ?? 'قطعة'),
        _row(
          'unit_price',
          line['unit_price'],
          'discount_pct',
          line['discount_pct'],
        ),
        _row('vat_rate', line['vat_rate'], 'vat_amount', line['vat_amount']),
        _row(
          'total',
          line['total'],
          'serial_ids_json',
          _serials(line['serial_ids_json']),
        ),
      ],
    ),
  );
  String _serials(dynamic raw) {
    if (raw == null || '$raw'.isEmpty) return '—';
    if (raw is List) {
      return raw
          .asMap()
          .entries
          .map((e) => 'سيريال ${e.key + 1}: ${e.value}')
          .join('\n');
    }
    try {
      final x = jsonDecode('$raw');
      if (x is List)
        return x
            .asMap()
            .entries
            .map((e) => 'سيريال ${e.key + 1}: ${e.value}')
            .join('\n');
    } catch (_) {}
    return 'سيريال: $raw';
  }

  Widget _mapFields(Map data) => Column(
    children: data.entries
        .where((e) => !_hiddenKey(e.key.toString()) && !_looksLikeId(e.value))
        .map(
          (e) => Card(
            elevation: 0,
            margin: const EdgeInsets.only(bottom: 6),
            child: ListTile(
              dense: true,
              title: Text(
                label(e.key.toString()),
                style: const TextStyle(color: Colors.black54, fontSize: 12),
              ),
              subtitle: Text(
                value(e.key.toString(), e.value),
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        )
        .toList(),
  );

  Widget _generic(String key, dynamic v) {
    if (_hiddenKey(key) || _looksLikeId(v)) return const SizedBox.shrink();
    if (v is Map) return _card(title: label(key), child: _mapFields(v));
    if (v is List)
      return _card(
        title: '${label(key)} (${v.length})',
        child: Column(
          children: v
              .map(
                (x) => x is Map
                    ? _card(title: 'تفاصيل الحركة', child: _mapFields(x))
                    : (_looksLikeId(x) ? const SizedBox.shrink() : Text('$x')),
              )
              .toList(),
        ),
      );
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          label(key),
          style: const TextStyle(color: Colors.black54, fontSize: 12),
        ),
        subtitle: Text(
          value(key, v),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.title,
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          onPressed: () => setState(() => future = _loadDetails()),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snap.hasError)
          return Center(
            child: Text(
              'تعذر تحميل التفاصيل\n${snap.error}',
              textAlign: TextAlign.center,
            ),
          );
        final raw = snap.data ?? <String, dynamic>{};
        final data = raw['data'] is Map
            ? Map<String, dynamic>.from(raw['data'] as Map)
            : raw;
        return widget.path.contains('/invoices/')
            ? _invoiceView(data)
            : widget.path.contains('/payments/')
            ? _paymentView(data)
            : ListView(
                padding: const EdgeInsets.all(16),
                children: data.entries
                    .map((e) => _generic(e.key, e.value))
                    .toList(),
              );
      },
    ),
  );
}
