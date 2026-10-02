import 'package:flutter/material.dart';
import '../data/api_client.dart';
import 'rep_forms.dart';
import 'detail_screen.dart';

const _purple = Color(0xFF3E0865);

class RepListScreen extends StatefulWidget {
  const RepListScreen({
    required this.apiClient,
    required this.title,
    required this.path,
    required this.fields,
    this.empty = 'لا توجد بيانات',
    super.key,
  });
  final ApiClient apiClient;
  final String title;
  final String path;
  final List<String> fields;
  final String empty;
  @override
  State<RepListScreen> createState() => _RepListScreenState();
}

class _RepListScreenState extends State<RepListScreen> {
  late Future<List<dynamic>> future;
  @override
  void initState() {
    super.initState();
    reload();
  }

  void reload() {
    future = widget.apiClient.getList(widget.path);
  }

  String value(Map<String, dynamic> x, String key) {
    final v = x[key];
    if (v == null || '$v'.isEmpty) return '—';
    const translated = {
      'draft': 'مسودة',
      'submitted': 'بانتظار المراجعة',
      'approved': 'موافق عليها',
      'confirmed': 'مؤكدة',
      'rejected': 'مرفوضة',
      'cancelled': 'ملغاة',
      'paid': 'مدفوعة',
      'partial': 'مدفوعة جزئياً',
      'overdue': 'متأخرة السداد',
      'cash': 'نقداً',
      'bank_transfer': 'تحويل بنكي',
      'transfer': 'تحويل بنكي',
      'cheque': 'شيك',
      'check': 'شيك',
      'mada': 'مدى',
      'stc_pay': 'STC Pay',
      'credit_card': 'بطاقة',
      'receipt': 'سند قبض',
      'discount': 'سند خصم',
    };
    if (translated.containsKey('$v')) return translated['$v']!;
    if ([
      'total',
      'paid_amount',
      'amount',
      'sale_price',
      'outstanding',
    ].contains(key))
      return '$v ر.س';
    return '$v';
  }

  String label(String key) =>
      const {
        'invoice_number': 'رقم الفاتورة',
        'buyer_name_ar': 'العميل',
        'status': 'الحالة',
        'total': 'الإجمالي',
        'paid_amount': 'المدفوع',
        'payment_number': 'رقم السند',
        'payment_type': 'نوع السند',
        'invoice_id': 'الفاتورة',
        'amount': 'المبلغ',
        'payment_method': 'طريقة الدفع',
        'item_name': 'الصنف',
        'item_sku': 'رمز الصنف',
        'available_qty': 'الكمية المتاحة',
        'sale_price': 'سعر البيع',
        'date': 'التاريخ',
        'direction': 'الاتجاه',
      }[key] ??
      key;
  String? detailPath(Map<String, dynamic> x) {
    final id = x['id']?.toString();
    if (id == null) return null;
    if (widget.path == '/sales/invoices') return '/sales/invoices/$id';
    if (widget.path == '/sales/payments') return '/sales/payments/$id';
    if (widget.path == '/reps/me/stock') return '/inventory/items/$id';
    return null;
  }

  Future<void> openCreate() async {
    final page = widget.path == '/sales/invoices'
        ? InvoiceCreateScreen(apiClient: widget.apiClient)
        : PaymentCreateScreen(apiClient: widget.apiClient);
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => page),
    );
    if (ok == true && mounted) setState(reload);
  }

  Future<void> editInvoice(String invoiceId) async {
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => InvoiceCreateScreen(
          apiClient: widget.apiClient,
          invoiceId: invoiceId,
        ),
      ),
    );
    if (ok == true && mounted) setState(reload);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.title,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          if (widget.path == '/sales/invoices' ||
              widget.path == '/sales/payments')
            IconButton(
              onPressed: openCreate,
              icon: const Icon(Icons.add_circle_outline),
            ),
          IconButton(
            onPressed: () => setState(reload),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<List<dynamic>>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done)
            return const Center(child: CircularProgressIndicator());
          if (snap.hasError)
            return _Error(
              message: 'تعذر تحميل ${widget.title}\n${snap.error}',
              retry: () => setState(reload),
            );
          final rows = snap.data ?? [];
          if (rows.isEmpty) return Center(child: Text(widget.empty));
          return RefreshIndicator(
            onRefresh: () async => setState(reload),
            child: ListView.separated(
              padding: const EdgeInsets.all(14),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final x = Map<String, dynamic>.from(rows[i] as Map);
                final path = detailPath(x);
                final card = Card(
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
                                value(x, widget.fields.first),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            if (widget.path == '/sales/invoices' &&
                                [
                                  'draft',
                                  'rejected',
                                ].contains(x['status']?.toString()))
                              IconButton(
                                tooltip: 'تعديل الفاتورة',
                                onPressed: x['id'] == null
                                    ? null
                                    : () => editInvoice(x['id'].toString()),
                                icon: const Icon(Icons.edit_outlined),
                                color: _purple,
                              ),
                            Icon(
                              path == null
                                  ? Icons.info_outline
                                  : Icons.chevron_left,
                              color: _purple,
                            ),
                          ],
                        ),
                        const SizedBox(height: 9),
                        ...widget.fields
                            .skip(1)
                            .map(
                              (key) => Padding(
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
                                        value(x, key),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
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
                return InkWell(
                  onTap: path == null
                      ? null
                      : () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => DetailScreen(
                              apiClient: widget.apiClient,
                              title: 'تفاصيل ${widget.title}',
                              path: path,
                            ),
                          ),
                        ),
                  child: card,
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  late Future<List<dynamic>> future;
  @override
  void initState() {
    super.initState();
    load();
  }

  void load() {
    future = widget.apiClient.getList('/sales/customers');
  }

  Future<void> add() async {
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CustomerFormScreen(apiClient: widget.apiClient),
      ),
    );
    if (ok == true && mounted) setState(load);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'العملاء',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(onPressed: add, icon: const Icon(Icons.person_add_alt_1)),
        IconButton(
          onPressed: () => setState(load),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: FutureBuilder<List<dynamic>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snap.hasError)
          return _Error(
            message: 'تعذر تحميل العملاء\n${snap.error}',
            retry: () => setState(load),
          );
        final rows = snap.data ?? [];
        return ListView.separated(
          padding: const EdgeInsets.all(14),
          itemCount: rows.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final x = Map<String, dynamic>.from(rows[i] as Map);
            final id = x['id']?.toString();
            return Card(
              elevation: 0,
              child: ListTile(
                onTap: id == null
                    ? null
                    : () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => CustomerDetailScreen(
                            apiClient: widget.apiClient,
                            customer: x,
                          ),
                        ),
                      ),
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFF0EAF4),
                  child: Icon(Icons.business_outlined, color: _purple),
                ),
                title: Text(
                  '${x['name_ar'] ?? '—'}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  '${x['phone'] ?? 'بدون جوال'} • ${x['address_city'] ?? '—'}',
                ),
                trailing: const Icon(Icons.chevron_left),
              ),
            );
          },
        );
      },
    ),
  );
}

class CustomerDetailScreen extends StatelessWidget {
  const CustomerDetailScreen({
    required this.apiClient,
    required this.customer,
    super.key,
  });
  final ApiClient apiClient;
  final Map<String, dynamic> customer;
  String displayValue(String key, dynamic value) {
    if (value == null || '$value'.isEmpty) return '—';
    if (key == 'customer_type') {
      return const {
            'individual': 'فرد',
            'company': 'شركة',
            'government': 'جهة حكومية',
          }['$value'] ??
          '$value';
    }
    if (key == 'created_at') {
      try {
        return DateTime.parse('$value').toLocal().toString().split(' ').first;
      } catch (_) {}
    }
    if (key == 'credit_limit' || key == 'opening_balance') return '$value ر.س';
    return '$value';
  }

  bool hidden(String key) => const {
    'id',
    'uuid',
    'rep_id',
    'tenant_id',
    'ar_account_id',
  }.contains(key);
  String label(String key) =>
      const {
        'id': 'المعرّف',
        'name_ar': 'الاسم بالعربي',
        'name_en': 'الاسم بالإنجليزي',
        'customer_number': 'رقم العميل',
        'customer_type': 'نوع العميل',
        'phone': 'الجوال',
        'phone2': 'جوال إضافي',
        'email': 'البريد الإلكتروني',
        'vat_number': 'الرقم الضريبي',
        'cr_number': 'السجل التجاري',
        'national_id': 'رقم الهوية',
        'address_street': 'الشارع',
        'address_building': 'رقم المبنى',
        'address_city': 'المدينة',
        'address_district': 'الحي',
        'address_postal': 'الرمز البريدي',
        'credit_limit': 'حد الائتمان',
        'opening_balance': 'الرصيد الافتتاحي',
        'created_at': 'تاريخ الإنشاء',
      }[key] ??
      'بيانات إضافية';
  @override
  Widget build(BuildContext context) {
    final fields = customer.entries
        .where(
          (e) =>
              !hidden(e.key) &&
              !RegExp(r'^[0-9a-fA-F-]{20,}$').hasMatch('${e.value}'),
        )
        .map(
          (e) => Card(
            elevation: 0,
            child: ListTile(
              title: Text(
                label(e.key),
                style: const TextStyle(color: Colors.black54, fontSize: 12),
              ),
              subtitle: Text(
                displayValue(e.key, e.value),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
          ),
        )
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'تفاصيل العميل',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ...fields,
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: customer['id'] == null
                ? null
                : () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CustomerStatementsView(
                        apiClient: apiClient,
                        initialCustomerId: customer['id'].toString(),
                      ),
                    ),
                  ),
            icon: const Icon(Icons.account_balance),
            label: const Text('عرض كشف حساب العميل'),
          ),
        ],
      ),
    );
  }
}

class CustomerStatementsView extends StatefulWidget {
  const CustomerStatementsView({
    required this.apiClient,
    this.initialCustomerId,
    super.key,
  });
  final ApiClient apiClient;
  final String? initialCustomerId;
  @override
  State<CustomerStatementsView> createState() => _CustomerStatementsViewState();
}

class _CustomerStatementsViewState extends State<CustomerStatementsView> {
  late Future<List<dynamic>> customers;
  String? id;
  Future<Map<String, dynamic>>? statement;
  @override
  void initState() {
    super.initState();
    id = widget.initialCustomerId;
    customers = widget.apiClient.getList('/sales/customers');
    if (id != null) loadStatement();
  }

  void loadStatement() {
    if (id != null) {
      final now = DateTime.now().toIso8601String();
      setState(
        () => statement = widget.apiClient.getMap(
          '/sales/customers/$id/statement?from_date=2020-01-01T00:00:00&to_date=${Uri.encodeQueryComponent(now)}',
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'كشف حساب العميل',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    body: FutureBuilder<List<dynamic>>(
      future: customers,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snap.hasError)
          return _Error(
            message: 'تعذر تحميل العملاء\n${snap.error}',
            retry: () => setState(
              () => customers = widget.apiClient.getList('/sales/customers'),
            ),
          );
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<String>(
              initialValue: id,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'اختر العميل',
                border: OutlineInputBorder(),
              ),
              items: snap.data!.map((x) {
                final m = Map<String, dynamic>.from(x as Map);
                return DropdownMenuItem(
                  value: '${m['id']}',
                  child: Text(
                    '${m['name_ar'] ?? '—'}',
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }).toList(),
              onChanged: (v) => setState(() {
                id = v;
                statement = null;
              }),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: id == null ? null : loadStatement,
              icon: const Icon(Icons.receipt_long),
              label: const Text('عرض كشف الحساب'),
            ),
            if (statement != null)
              FutureBuilder<Map<String, dynamic>>(
                future: statement,
                builder: (context, ss) {
                  if (ss.connectionState != ConnectionState.done)
                    return const Padding(
                      padding: EdgeInsets.all(30),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  if (ss.hasError)
                    return _Error(
                      message: 'تعذر جلب كشف الحساب\n${ss.error}',
                      retry: loadStatement,
                    );
                  final raw = ss.data ?? {};
                  final data = raw['data'] is Map
                      ? Map<String, dynamic>.from(raw['data'] as Map)
                      : raw;
                  final summary =
                      (data['summary'] as Map?)?.cast<String, dynamic>() ??
                      data;
                  final rows = (data['transactions'] as List?) ?? [];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 16),
                      Text(
                        'إجمالي الفواتير: ${summary['total_invoiced'] ?? 0} ر.س',
                      ),
                      Text('المقبوض: ${summary['total_paid'] ?? 0} ر.س'),
                      Text(
                        'الرصيد المتبقي: ${summary['closing_balance'] ?? summary['outstanding'] ?? 0} ر.س',
                      ),
                      const Divider(),
                      ...rows.map((r) {
                        final m = Map<String, dynamic>.from(r as Map);
                        return ListTile(
                          title: Text(
                            '${m['description_ar'] ?? m['description'] ?? 'حركة حساب'}',
                          ),
                          subtitle: Text('${m['date'] ?? '—'}'),
                          trailing: Text(
                            '${m['balance'] ?? m['amount'] ?? m['debit'] ?? m['credit'] ?? 0} ر.س',
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

class RepMapScreen extends StatelessWidget {
  const RepMapScreen({
    required this.apiClient,
    required this.title,
    required this.path,
    super.key,
  });
  final ApiClient apiClient;
  final String title, path;
  @override
  Widget build(BuildContext context) =>
      DetailScreen(apiClient: apiClient, title: title, path: path);
}

class _Error extends StatelessWidget {
  const _Error({required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 46, color: Colors.redAccent),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: retry,
            icon: const Icon(Icons.refresh),
            label: const Text('إعادة المحاولة'),
          ),
        ],
      ),
    ),
  );
}
