import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../data/api_client.dart';

const _stockPurple = Color(0xFF3E0865);

class StockCountScreen extends StatefulWidget {
  const StockCountScreen({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  State<StockCountScreen> createState() => _StockCountScreenState();
}

class _StockCountScreenState extends State<StockCountScreen> {
  late Future<List<dynamic>> _future;
  late Future<void> _filtersFuture;
  bool _busy = false;
  String? _warehouseId;
  String? _repId;
  List<Map<String, dynamic>> _warehouses = [];
  List<Map<String, dynamic>> _reps = [];

  bool get _canFilter =>
      widget.apiClient.sessionStore.isCompanyManager ||
      widget.apiClient.sessionStore.isSupervisor;

  @override
  void initState() {
    super.initState();
    _filtersFuture = _loadFilters();
    _reload();
  }

  Future<void> _loadFilters() async {
    if (!_canFilter) return;
    final warehouseRows = await widget.apiClient.getList(
      '/inventory/warehouses',
    );
    final repPath = widget.apiClient.sessionStore.isSupervisor
        ? '/supervisors/me/reps'
        : '/reps';
    final repRows = await widget.apiClient.getList(repPath);
    if (!mounted) return;
    setState(() {
      _warehouses = warehouseRows
          .map((row) => Map<String, dynamic>.from(row as Map))
          .toList();
      _reps = repRows
          .map((row) => Map<String, dynamic>.from(row as Map))
          .where((row) => row['is_active'] != false)
          .toList();
    });
  }

  void _reload() {
    final params = <String, String>{};
    if (_warehouseId != null) params['warehouse_id'] = _warehouseId!;
    if (_repId != null) params['rep_id'] = _repId!;
    final query = Uri(queryParameters: params).query;
    _future = widget.apiClient.getList(
      '/inventory/stock${query.isEmpty ? '' : '?$query'}',
    );
  }

  String _repNameForWarehouse(String? warehouseId) {
    if (warehouseId == null) return '—';
    final rep = _reps
        .where((row) => row['warehouse_id']?.toString() == warehouseId)
        .firstOrNull;
    return rep?['full_name']?.toString() ?? '—';
  }

  num _number(dynamic value) => num.tryParse('$value') ?? 0;

  Future<void> _serialCount(Map<String, dynamic> row) async {
    final warehouseId = row['warehouse_id']?.toString();
    final productId = row['item_id']?.toString();
    if (warehouseId == null || productId == null) return;
    try {
      final rawRows = await widget.apiClient.getList(
        '/inventory/serials/by-warehouse?warehouse_id=${Uri.encodeQueryComponent(warehouseId)}&product_id=${Uri.encodeQueryComponent(productId)}',
      );
      final rows = rawRows
          .map((raw) => Map<String, dynamic>.from(raw as Map))
          .toList();
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (context) => SafeArea(
          child: SizedBox(
            height: MediaQuery.of(context).size.height * .78,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'سيريالات ${row['item_name'] ?? ''}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => _printSerials(row, rows),
                        icon: const Icon(Icons.print),
                        tooltip: 'طباعة السيريالات',
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text(
                      '${rows.length} سيريال — ${row['warehouse_name'] ?? ''}',
                      style: const TextStyle(color: Colors.black54),
                    ),
                  ),
                ),
                const Divider(),
                Expanded(
                  child: rows.isEmpty
                      ? const Center(child: Text('لا توجد سيريالات متاحة'))
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: rows.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 6),
                          itemBuilder: (_, index) {
                            final serial =
                                rows[index]['serial_number']?.toString() ?? '—';
                            return Card(
                              elevation: 0,
                              child: ListTile(
                                leading: CircleAvatar(
                                  radius: 15,
                                  child: Text('${index + 1}'),
                                ),
                                title: SelectableText(
                                  serial,
                                  textAlign: TextAlign.left,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: .4,
                                  ),
                                ),
                                subtitle: Text(
                                  'الحالة: ${rows[index]['condition'] ?? 'جديد'}',
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      );
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
    }
  }

  Future<void> _count(Map<String, dynamic> row) async {
    final controller = TextEditingController(
      text: '${_number(row['quantity'])}',
    );
    final notesController = TextEditingController();
    final result = await showDialog<List<String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('جرد ${row['item_name'] ?? 'الصنف'}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('المستودع: ${row['warehouse_name'] ?? '—'}'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'الكمية الفعلية'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: notesController,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'ملاحظات (اختياري)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, [controller.text, notesController.text]),
            child: const Text('حفظ الجرد'),
          ),
        ],
      ),
    );
    controller.dispose();
    notesController.dispose();
    if (result == null || result.isEmpty) return;
    final quantity = num.tryParse(result[0]);
    if (quantity == null || quantity < 0) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('أدخل كمية صحيحة')));
      return;
    }
    setState(() => _busy = true);
    try {
      final response = await widget.apiClient.post('/inventory/stock-count', {
        'item_id': row['item_id'],
        'warehouse_id': row['warehouse_id'],
        'counted_qty': quantity,
        'notes': result.length > 1 ? result[1] : null,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response['message']?.toString() ?? 'تم حفظ الجرد'),
          ),
        );
        setState(_reload);
      }
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _history() async {
    try {
      final rows = await widget.apiClient.getList(
        '/inventory/stock-count/history',
      );
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (context) => SafeArea(
          child: SizedBox(
            height: MediaQuery.of(context).size.height * .75,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'سجل عمليات الجرد',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                if (rows.isEmpty) const Text('لا توجد عمليات جرد مسجلة'),
                ...rows.map((raw) {
                  final row = Map<String, dynamic>.from(raw as Map);
                  return Card(
                    child: ListTile(
                      title: Text(
                        '${row['item_name'] ?? '—'} — ${row['warehouse_name'] ?? '—'}',
                      ),
                      subtitle: Text(
                        'السابق: ${row['previous_qty']}  |  الفعلي: ${row['counted_qty']}  |  الفرق: ${row['diff_qty']}',
                      ),
                      trailing: Text(
                        '${row['counted_at'] ?? ''}'
                            .replaceFirst('T', '\n')
                            .split('.')
                            .first,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        ),
      );
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$error')));
    }
  }

  Future<List<pw.Font>> _pdfFonts() async {
    final arabic = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSansArabic-Regular.ttf'),
    );
    final latin = pw.Font.ttf(
      await rootBundle.load('assets/fonts/NotoSans-Regular.ttf'),
    );
    return [arabic, latin];
  }

  Future<void> _print(List<dynamic> rawRows) async {
    final fonts = await _pdfFonts();
    final rows = rawRows
        .map((raw) => Map<String, dynamic>.from(raw as Map))
        .toList();
    await Printing.layoutPdf(
      onLayout: (format) async {
        final doc = pw.Document();
        doc.addPage(
          pw.MultiPage(
            pageFormat: format,
            theme: pw.ThemeData.withFont(
              base: fonts[0],
              fontFallback: [fonts[1]],
            ),
            textDirection: pw.TextDirection.rtl,
            header: (_) => pw.Text(
              'جرد المخزون / Stock Count',
              style: pw.TextStyle(
                font: fonts[0],
                fontFallback: [fonts[1]],
                fontSize: 18,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            build: (_) => [
              pw.SizedBox(height: 12),
              pw.TableHelper.fromTextArray(
                headerStyle: pw.TextStyle(
                  font: fonts[0],
                  fontFallback: [fonts[1]],
                  fontWeight: pw.FontWeight.bold,
                ),
                cellStyle: pw.TextStyle(
                  font: fonts[0],
                  fontFallback: [fonts[1]],
                  fontSize: 9,
                ),
                headers: const [
                  'الصنف / Item',
                  'المستودع / Warehouse',
                  'المندوب / Rep',
                  'الكمية / Qty',
                  'القيمة / Value',
                ],
                data: rows
                    .map(
                      (row) => [
                        row['item_name'] ?? '—',
                        row['warehouse_name'] ?? '—',
                        _repNameForWarehouse(row['warehouse_id']?.toString()),
                        '${row['quantity'] ?? 0}',
                        '${row['stock_value'] ?? 0} SAR',
                      ],
                    )
                    .toList(),
              ),
            ],
          ),
        );
        return doc.save();
      },
    );
  }

  Future<void> _printSerials(
    Map<String, dynamic> row,
    List<Map<String, dynamic>> serials,
  ) async {
    final fonts = await _pdfFonts();
    await Printing.layoutPdf(
      onLayout: (format) async {
        final doc = pw.Document();
        doc.addPage(
          pw.MultiPage(
            pageFormat: format,
            theme: pw.ThemeData.withFont(
              base: fonts[0],
              fontFallback: [fonts[1]],
            ),
            textDirection: pw.TextDirection.rtl,
            header: (_) => pw.Text(
              'سيريالات الصنف / Serial Numbers',
              style: pw.TextStyle(
                font: fonts[0],
                fontFallback: [fonts[1]],
                fontSize: 17,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            build: (_) => [
              pw.Text(
                '${row['item_name'] ?? ''} — ${row['warehouse_name'] ?? ''}',
                style: pw.TextStyle(
                  font: fonts[0],
                  fontFallback: [fonts[1]],
                  fontSize: 11,
                ),
              ),
              pw.SizedBox(height: 10),
              pw.TableHelper.fromTextArray(
                headerStyle: pw.TextStyle(
                  font: fonts[0],
                  fontFallback: [fonts[1]],
                  fontWeight: pw.FontWeight.bold,
                ),
                cellStyle: pw.TextStyle(
                  font: fonts[0],
                  fontFallback: [fonts[1]],
                  fontSize: 10,
                ),
                headers: const ['#', 'Serial Number', 'الحالة / Condition'],
                data: serials
                    .asMap()
                    .entries
                    .map(
                      (entry) => [
                        '${entry.key + 1}',
                        entry.value['serial_number'] ?? '—',
                        entry.value['condition'] ?? 'new',
                      ],
                    )
                    .toList(),
              ),
            ],
          ),
        );
        return doc.save();
      },
    );
  }

  Widget _filters() => FutureBuilder<void>(
    future: _filtersFuture,
    builder: (context, snapshot) {
      if (!_canFilter || snapshot.connectionState != ConnectionState.done)
        return const SizedBox.shrink();
      return Card(
        elevation: 0,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'فلاتر الجرد',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: _stockPurple,
                ),
              ),
              const SizedBox(height: 8),
              if (!widget.apiClient.sessionStore.isSupervisor)
                DropdownButtonFormField<String>(
                  initialValue: _warehouseId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'المستودع'),
                  items: [
                    const DropdownMenuItem(
                      value: null,
                      child: Text('كل المستودعات'),
                    ),
                    ..._warehouses.map(
                      (row) => DropdownMenuItem(
                        value: row['id']?.toString(),
                        child: Text(
                          row['name_ar']?.toString() ?? '—',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _warehouseId = value;
                      if (value != null)
                        _repId = _reps
                            .where(
                              (r) => r['warehouse_id']?.toString() == value,
                            )
                            .firstOrNull?['id']
                            ?.toString();
                    });
                    setState(_reload);
                  },
                ),
              if (!widget.apiClient.sessionStore.isSupervisor)
                const SizedBox(height: 8),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _repId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'المندوب'),
                items: [
                  const DropdownMenuItem(
                    value: null,
                    child: Text('كل المناديب'),
                  ),
                  ..._reps.map(
                    (row) => DropdownMenuItem(
                      value: row['id']?.toString(),
                      child: Text(
                        '${row['full_name'] ?? '—'}  •  ${row['rep_code'] ?? ''}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
                onChanged: (value) {
                  setState(() {
                    _repId = value;
                    if (value != null)
                      _warehouseId = _reps
                          .where((r) => r['id']?.toString() == value)
                          .firstOrNull?['warehouse_id']
                          ?.toString();
                  });
                  setState(_reload);
                },
              ),
            ],
          ),
        ),
      );
    },
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'المخزون والجرد',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(
          onPressed: _history,
          tooltip: 'سجل الجرد',
          icon: const Icon(Icons.history),
        ),
        IconButton(
          onPressed: () => setState(_reload),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: FutureBuilder<List<dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError)
          return Center(
            child: Text(
              'تعذر تحميل المخزون\n${snapshot.error}',
              textAlign: TextAlign.center,
            ),
          );
        final rows = snapshot.data ?? <dynamic>[];
        return RefreshIndicator(
          onRefresh: () async => setState(_reload),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 90),
            itemCount: rows.length + 2,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              if (index == 0) return _filters();
              if (index == 1)
                return Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${rows.length} صنف / مستودع',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Colors.black54,
                        ),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: _busy ? null : () => _print(rows),
                      icon: const Icon(Icons.print, size: 18),
                      label: const Text('طباعة الجرد'),
                      style: FilledButton.styleFrom(
                        backgroundColor: _stockPurple,
                      ),
                    ),
                  ],
                );
              final row = Map<String, dynamic>.from(rows[index - 2] as Map);
              final isSerial = row['item_tracking']?.toString() == 'serial';
              return Card(
                elevation: 0,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              row['item_name']?.toString() ?? '—',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          Text(
                            '${row['available_qty'] ?? 0}',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: _stockPurple,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        '${row['warehouse_name'] ?? '—'}  •  ${_repNameForWarehouse(row['warehouse_id']?.toString())}  •  ${row['item_sku'] ?? ''}',
                      ),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('الكمية: ${row['quantity'] ?? 0}'),
                          Text('قيمة المخزون: ${row['stock_value'] ?? 0} ر.س'),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (isSerial)
                        OutlinedButton.icon(
                          onPressed: _busy ? null : () => _serialCount(row),
                          icon: const Icon(Icons.pin_outlined),
                          label: const Text('جرد السيريالات وعرض الأرقام'),
                        )
                      else
                        OutlinedButton.icon(
                          onPressed: _busy ? null : () => _count(row),
                          icon: const Icon(Icons.fact_check_outlined),
                          label: const Text('تسجيل الجرد'),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    ),
  );
}
