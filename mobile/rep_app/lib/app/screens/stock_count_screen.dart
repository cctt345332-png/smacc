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
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    _future = widget.apiClient.getList('/inventory/stock');
  }

  num _number(dynamic value) => num.tryParse('$value') ?? 0;

  Future<void> _count(Map<String, dynamic> row) async {
    if (row['item_tracking']?.toString() == 'serial') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('الأصناف ذات السيريال تُجرد من إدارة السيريالات'),
        ),
      );
      return;
    }
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

  Future<void> _print(List<dynamic> rawRows) async {
    final fontData = await rootBundle.load(
      'assets/fonts/NotoSansArabic-Regular.ttf',
    );
    final font = pw.Font.ttf(fontData);
    final rows = rawRows
        .map((raw) => Map<String, dynamic>.from(raw as Map))
        .toList();
    await Printing.layoutPdf(
      onLayout: (format) async {
        final doc = pw.Document();
        doc.addPage(
          pw.MultiPage(
            pageFormat: format,
            theme: pw.ThemeData.withFont(base: font),
            textDirection: pw.TextDirection.rtl,
            header: (_) => pw.Text(
              'جرد المخزون',
              style: pw.TextStyle(
                font: font,
                fontSize: 18,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
            build: (_) => [
              pw.SizedBox(height: 12),
          pw.TableHelper.fromTextArray(
                headerStyle: pw.TextStyle(
                  font: font,
                  fontWeight: pw.FontWeight.bold,
                ),
                cellStyle: pw.TextStyle(font: font, fontSize: 9),
                headers: const [
                  'الصنف',
                  'المستودع',
                  'الكمية',
                  'المتاح',
                  'القيمة',
                ],
                data: rows
                    .map(
                      (row) => [
                        row['item_name'] ?? '—',
                        row['warehouse_name'] ?? '—',
                        '${row['quantity'] ?? 0}',
                        '${row['available_qty'] ?? 0}',
                        '${row['stock_value'] ?? 0} ر.س',
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
        if (rows.isEmpty)
          return const Center(child: Text('لا يوجد مخزون متاح'));
        return RefreshIndicator(
          onRefresh: () async => setState(_reload),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 90),
            itemCount: rows.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              if (index == 0) {
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
              }
              final row = Map<String, dynamic>.from(rows[index - 1] as Map);
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
                        '${row['warehouse_name'] ?? '—'}  •  ${row['item_sku'] ?? ''}',
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
                      OutlinedButton.icon(
                        onPressed: _busy || isSerial ? null : () => _count(row),
                        icon: const Icon(Icons.fact_check_outlined),
                        label: Text(
                          isSerial
                              ? 'جرد السيريالات من إدارة السيريالات'
                              : 'تسجيل الجرد',
                        ),
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
