import 'package:flutter/material.dart';

import '../data/api_client.dart';
import 'detail_screen.dart';

const _purple = Color(0xFF3E0865);

enum CompanyRecordKind { invoices, payments }

class CompanyRecordsScreen extends StatefulWidget {
  const CompanyRecordsScreen({
    required this.apiClient,
    required this.kind,
    this.apiPath,
    this.titleOverride,
    this.enableDetails = true,
    super.key,
  });
  final ApiClient apiClient;
  final CompanyRecordKind kind;
  final String? apiPath;
  final String? titleOverride;
  final bool enableDetails;
  @override
  State<CompanyRecordsScreen> createState() => _CompanyRecordsScreenState();
}

class _CompanyRecordsScreenState extends State<CompanyRecordsScreen> {
  final search = TextEditingController();
  List<Map<String, dynamic>> all = [];
  List<Map<String, dynamic>> visible = [];
  bool loading = true;
  Object? error;
  String status = '';
  String rep = '';
  DateTime? from;
  DateTime? to;

  bool get invoices => widget.kind == CompanyRecordKind.invoices;
  String get path =>
      widget.apiPath ?? (invoices ? '/sales/invoices' : '/sales/payments');
  String get title =>
      widget.titleOverride ?? (invoices ? 'فواتير الشركة' : 'سندات الشركة');

  @override
  void initState() {
    super.initState();
    search.addListener(applyFilters);
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final rows = await widget.apiClient.getList(path);
      all = rows.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      applyFilters();
      if (mounted) setState(() => loading = false);
    } catch (e) {
      if (mounted)
        setState(() {
          error = e;
          loading = false;
        });
    }
  }

  void applyFilters() {
    final q = search.text.trim().toLowerCase();
    visible = all.where((x) {
      final searchable = [
        x['invoice_number'],
        x['buyer_name_ar'],
        x['payment_number'],
        x['customer_name_ar'],
        x['customer_name'],
        x['rep_name'],
        x['rep_code'],
        x['invoice_number'],
      ].where((v) => v != null).join(' ').toLowerCase();
      final dateValue = x[invoices ? 'issue_date' : 'payment_date'];
      final date = DateTime.tryParse('$dateValue');
      return (q.isEmpty || searchable.contains(q)) &&
          (status.isEmpty || '${x['status']}' == status) &&
          (rep.isEmpty || '${x['rep_name'] ?? ''}' == rep) &&
          (from == null ||
              (date != null &&
                  !date.isBefore(
                    DateTime(from!.year, from!.month, from!.day),
                  ))) &&
          (to == null ||
              (date != null &&
                  !date.isAfter(
                    DateTime(to!.year, to!.month, to!.day, 23, 59, 59),
                  )));
    }).toList();
    if (mounted) setState(() {});
  }

  List<String> get reps =>
      all
          .map((x) => '${x['rep_name'] ?? ''}')
          .where((x) => x.trim().isNotEmpty && x != 'null')
          .toSet()
          .toList()
        ..sort();
  List<String> get statuses =>
      all
          .map((x) => '${x['status'] ?? ''}')
          .where((x) => x.trim().isNotEmpty && x != 'null')
          .toSet()
          .toList()
        ..sort();

  String label(String key) =>
      const {
        'invoice_number': 'رقم الفاتورة',
        'buyer_name_ar': 'العميل',
        'customer_name_ar': 'العميل',
        'payment_number': 'رقم السند',
        'payment_type': 'نوع السند',
        'rep_name': 'المندوب',
        'status': 'الحالة',
        'total': 'الإجمالي',
        'paid_amount': 'المدفوع',
        'amount': 'المبلغ',
        'payment_method': 'طريقة الدفع',
        'issue_date': 'تاريخ الفاتورة',
        'payment_date': 'تاريخ السند',
      }[key] ??
      key;

  String translated(dynamic value) {
    if (value == null || '$value' == 'null' || '$value'.trim().isEmpty) {
      return invoices ? '—' : 'سند قبض';
    }
    const values = {
      'draft': 'مسودة',
      'submitted': 'بانتظار المراجعة',
      'approved': 'موافق عليها',
      'confirmed': 'مؤكدة',
      'paid': 'مدفوعة',
      'partial': 'مدفوعة جزئياً',
      'rejected': 'مرفوضة',
      'cancelled': 'ملغاة',
      'receipt': 'سند قبض',
      'discount': 'سند خصم',
      'cash': 'نقداً',
      'bank_transfer': 'تحويل بنكي',
      'transfer': 'تحويل بنكي',
      'cheque': 'شيك',
      'mada': 'مدى',
    };
    return values['${value}'.toLowerCase()] ?? '$value';
  }

  String money(dynamic value) =>
      '${double.tryParse('$value')?.toStringAsFixed(2) ?? '0.00'} ر.س';
  String dateText(dynamic value) =>
      DateTime.tryParse('$value')?.toIso8601String().split('T').first ?? '—';

  double get visibleTotal => visible.fold<double>(0, (sum, row) {
    final value = row[invoices ? 'total' : 'amount'];
    return sum + (double.tryParse('$value') ?? 0);
  });

  Future<void> chooseDate(bool start) async {
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      initialDate: start ? (from ?? DateTime.now()) : (to ?? DateTime.now()),
    );
    if (selected == null) return;
    setState(() {
      if (start)
        from = selected;
      else
        to = selected;
    });
    applyFilters();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : error != null
        ? Center(
            child: Text(
              'تعذر تحميل $title\n$error',
              textAlign: TextAlign.center,
            ),
          )
        : Column(
            children: [
              _filters(),
              Expanded(
                child: visible.isEmpty
                    ? const Center(child: Text('لا توجد نتائج مطابقة للفلاتر'))
                    : RefreshIndicator(
                        onRefresh: load,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(14, 0, 14, 20),
                          itemCount: visible.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (_, i) => _card(visible[i]),
                        ),
                      ),
              ),
            ],
          ),
  );

  Widget _filters() => Padding(
    padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
    child: Column(
      children: [
        TextField(
          controller: search,
          textDirection: TextDirection.rtl,
          decoration: InputDecoration(
            labelText: invoices
                ? 'بحث برقم الفاتورة أو العميل'
                : 'بحث برقم السند أو العميل أو المندوب',
            prefixIcon: const Icon(Icons.search),
            border: const OutlineInputBorder(),
            suffixIcon: search.text.isEmpty
                ? null
                : IconButton(
                    onPressed: search.clear,
                    icon: const Icon(Icons.clear),
                  ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            if (invoices)
              Expanded(
                child: _dropdown('الحالة', status, statuses, (v) {
                  setState(() => status = v ?? '');
                  applyFilters();
                }),
              )
            else
              Expanded(
                child: _dropdown('المندوب', rep, reps, (v) {
                  setState(() => rep = v ?? '');
                  applyFilters();
                }),
              ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => chooseDate(false),
                icon: const Icon(Icons.event),
                label: Text(to == null ? 'إلى تاريخ' : dateText(to)),
              ),
            ),
          ],
        ),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => chooseDate(true),
                icon: const Icon(Icons.event),
                label: Text(from == null ? 'من تاريخ' : dateText(from)),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${visible.length} سجل',
              style: const TextStyle(color: Colors.black54),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            'مجموع النتائج المحددة: ${visibleTotal.toStringAsFixed(2)} ر.س',
            style: const TextStyle(color: _purple, fontWeight: FontWeight.w800),
          ),
        ),
      ],
    ),
  );

  Widget _dropdown(
    String labelText,
    String selected,
    List<String> options,
    ValueChanged<String?> onChanged,
  ) => DropdownButtonFormField<String>(
    initialValue: selected.isEmpty ? null : selected,
    isExpanded: true,
    decoration: InputDecoration(
      labelText: labelText,
      border: const OutlineInputBorder(),
    ),
    items: [
      const DropdownMenuItem(value: '', child: Text('الكل')),
      ...options.map(
        (x) => DropdownMenuItem(
          value: x,
          child: Text(labelText == 'الحالة' ? translated(x) : x),
        ),
      ),
    ],
    onChanged: onChanged,
  );

  Widget _card(Map<String, dynamic> x) {
    final id = x['id']?.toString();
    final fields = invoices
        ? <String>[
            'invoice_number',
            'rep_name',
            'status',
            'total',
            'paid_amount',
            'issue_date',
          ]
        : <String>[
            'payment_number',
            'payment_type',
            'rep_name',
            'amount',
            'payment_method',
            'payment_date',
          ];
    final titleValue =
        (x['buyer_name_ar'] ??
                x['customer_name_ar'] ??
                x['customer_name'] ??
                x['buyer_name'] ??
                'بدون عميل')
            .toString();
    return InkWell(
      onTap: !widget.enableDetails || id == null
          ? null
          : () => Navigator.push<void>(
              context,
              MaterialPageRoute<void>(
                builder: (_) => DetailScreen(
                  apiClient: widget.apiClient,
                  title: 'تفاصيل $title',
                  path: '$path/$id',
                ),
              ),
            ),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFE5DDE9)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      titleValue,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_left, color: _purple),
                ],
              ),
              const SizedBox(height: 8),
              ...fields.map((key) {
                final raw = key == 'customer_name_ar'
                    ? (x['customer_name_ar'] ?? x['customer_name'])
                    : x[key];
                final display =
                    key == 'status' ||
                        key == 'payment_type' ||
                        key == 'payment_method'
                    ? translated(raw)
                    : key == 'issue_date' || key == 'payment_date'
                    ? dateText(raw)
                    : ['total', 'paid_amount', 'amount'].contains(key)
                    ? money(raw)
                    : (raw == null || '$raw' == 'null' ? '—' : '$raw');
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      Text(
                        '${label(key)}: ',
                        style: const TextStyle(
                          color: Colors.black54,
                          fontSize: 12,
                        ),
                      ),
                      Expanded(
                        child: Text(
                          display,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}
