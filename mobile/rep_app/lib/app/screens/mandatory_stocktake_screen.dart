import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../data/api_client.dart';

class MandatoryStocktakeScreen extends StatefulWidget {
  const MandatoryStocktakeScreen({required this.apiClient, this.onSubmitted, super.key});
  final ApiClient apiClient;
  final VoidCallback? onSubmitted;

  @override
  State<MandatoryStocktakeScreen> createState() => _MandatoryStocktakeScreenState();
}

class _MandatoryStocktakeScreenState extends State<MandatoryStocktakeScreen> {
  late Future<Map<String, dynamic>> _future;
  final Map<String, TextEditingController> _qtyControllers = {};
  final Map<String, List<String>> _serials = {};
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = widget.apiClient.getMap('/inventory/mandatory-stocktake/rep/current');
  }

  @override
  void dispose() {
    for (final controller in _qtyControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _qtyController(String id, dynamic systemQty) {
    return _qtyControllers.putIfAbsent(
      id,
      () => TextEditingController(text: systemQty?.toString() ?? ''),
    );
  }

  Future<String?> _scanSerial() async {
    return Navigator.push<String>(
      context,
      MaterialPageRoute<String>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('تصوير السيريال')),
          body: MobileScanner(
            onDetect: (capture) {
              final code = capture.barcodes.isNotEmpty
                  ? capture.barcodes.first.rawValue?.trim()
                  : null;
              if (code != null && code.isNotEmpty && Navigator.canPop(context)) {
                Navigator.pop(context, code);
              }
            },
          ),
        ),
      ),
    );
  }

  Future<void> _addSerial(String lineId) async {
    final serial = await _scanSerial();
    if (!mounted || serial == null || serial.isEmpty) return;
    final list = _serials.putIfAbsent(lineId, () => <String>[]);
    if (list.contains(serial)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('السيريال مكرر في الجرد')));
      return;
    }
    setState(() => list.add(serial));
  }

  Future<void> _submit(Map<String, dynamic> data) async {
    final lines = List<Map<String, dynamic>>.from(data['lines'] as List? ?? const []);
    final payload = <Map<String, dynamic>>[];
    for (final line in lines) {
      final id = line['id'].toString();
      final tracking = line['tracking_type']?.toString();
      if (tracking == 'serial') {
        payload.add({'line_id': id, 'counted_serials': _serials[id] ?? <String>[]});
      } else {
        final text = _qtyController(id, line['system_qty']).text.trim();
        final value = num.tryParse(text);
        if (value == null || value < 0) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('أدخل كمية صحيحة للصنف: ${line['item_name'] ?? ''}')),
          );
          return;
        }
        payload.add({'line_id': id, 'counted_qty': value});
      }
    }
    setState(() { _busy = true; _error = null; });
    try {
      await widget.apiClient.post('/inventory/mandatory-stocktake/rep/submit', {'lines': payload});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم رفع الجرد للإدارة بنجاح')));
      widget.onSubmitted?.call();
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('الجرد الأسبوعي الإلزامي'),
          backgroundColor: const Color(0xFF3E0865),
          foregroundColor: Colors.white,
        ),
        body: FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _message('تعذر تحميل الجرد. تحقق من الاتصال ثم أعد المحاولة.', retry: true);
            }
            final data = snapshot.data ?? <String, dynamic>{};
            if (data['locked'] != true) {
              return _message('لا يوجد جرد إلزامي حاليًا.');
            }
            final run = Map<String, dynamic>.from(data['run'] as Map? ?? const {});
            final lines = List<Map<String, dynamic>>.from(data['lines'] as List? ?? const []);
            if (run['status'] == 'submitted') {
              return _message('تم رفع الجرد للإدارة، وسيعود التطبيق للعمل بعد اعتماد الإدارة.', done: true);
            }
            return Column(
              children: [
                Container(
                  width: double.infinity,
                  color: Colors.amber.shade50,
                  padding: const EdgeInsets.all(14),
                  child: const Text(
                    'لا يمكن استخدام بقية التطبيق قبل إكمال جرد المخزون ورفعه للإدارة. صوّر كل سيريال أو أدخل الكمية الفعلية ثم اضغط رفع الجرد.',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                if (_error != null)
                  Padding(padding: const EdgeInsets.all(8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
                Expanded(
                  child: lines.isEmpty
                      ? const Center(child: Text('لا توجد أصناف مسجلة لهذا الجرد'))
                      : ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: lines.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, index) => _lineCard(lines[index]),
                        ),
                ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
                    child: SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _busy ? null : () => _submit(data),
                        icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.cloud_upload_outlined),
                        label: Text(_busy ? 'جاري الرفع...' : 'رفع الجرد للإدارة'),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _lineCard(Map<String, dynamic> line) {
    final id = line['id'].toString();
    final serial = line['tracking_type'] == 'serial';
    final serials = _serials[id] ?? <String>[];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(line['item_name']?.toString() ?? 'صنف', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            Text('${line['sku'] ?? ''} — ${line['warehouse_name'] ?? ''}', style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 8),
            if (serial) ...[
              Text('الموجود في النظام: ${line['system_qty'] ?? 0} سيريال | تم تصويره: ${serials.length}'),
              const SizedBox(height: 8),
              OutlinedButton.icon(onPressed: _busy ? null : () => _addSerial(id), icon: const Icon(Icons.camera_alt_outlined), label: const Text('تصوير وإضافة سيريال')),
              if (serials.isNotEmpty)
                Wrap(spacing: 6, runSpacing: 4, children: serials.map((s) => Chip(label: Text(s), onDeleted: _busy ? null : () => setState(() => serials.remove(s)))).toList()),
            ] else
              TextField(
                controller: _qtyController(id, line['system_qty']),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'الكمية الفعلية', border: OutlineInputBorder()),
              ),
          ],
        ),
      ),
    );
  }

  Widget _message(String text, {bool retry = false, bool done = false}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(done ? Icons.check_circle_outline : Icons.fact_check_outlined, size: 54, color: done ? Colors.green : const Color(0xFF3E0865)),
          const SizedBox(height: 16),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          if (retry) ...[
            const SizedBox(height: 16),
            FilledButton(onPressed: () => setState(() => _future = widget.apiClient.getMap('/inventory/mandatory-stocktake/rep/current')), child: const Text('إعادة المحاولة')),
          ],
        ]),
      ),
    );
  }
}
