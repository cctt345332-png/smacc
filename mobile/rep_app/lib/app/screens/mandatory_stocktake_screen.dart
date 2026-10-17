import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../data/api_client.dart';

class MandatoryStocktakeScreen extends StatefulWidget {
  const MandatoryStocktakeScreen({
    required this.apiClient,
    this.onSubmitted,
    super.key,
  });
  final ApiClient apiClient;
  final VoidCallback? onSubmitted;

  @override
  State<MandatoryStocktakeScreen> createState() =>
      _MandatoryStocktakeScreenState();
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
    _future = widget.apiClient.getMap(
      '/inventory/mandatory-stocktake/rep/current',
    );
  }

  @override
  void dispose() {
    for (final controller in _qtyControllers.values) controller.dispose();
    super.dispose();
  }

  TextEditingController _qtyController(String id, dynamic systemQty) =>
      _qtyControllers.putIfAbsent(
        id,
        () => TextEditingController(text: systemQty?.toString() ?? ''),
      );

  Future<List<String>> _scanSerials(List<String> expected) async {
    final result = await Navigator.push<List<String>>(
      context,
      MaterialPageRoute<List<String>>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('تصوير السيريالات المتتابع')),
          body: _SerialScannerPage(expected: expected),
        ),
      ),
    );
    return result ?? <String>[];
  }

  Future<void> _submit(Map<String, dynamic> data) async {
    final lines = List<Map<String, dynamic>>.from(
      data['lines'] as List? ?? const [],
    );
    final payload = <Map<String, dynamic>>[];
    for (final line in lines) {
      final id = line['id'].toString();
      if (line['tracking_type']?.toString() == 'serial') {
        payload.add({
          'line_id': id,
          'counted_serials': _serials[id] ?? <String>[],
        });
      } else {
        final value = num.tryParse(
          _qtyController(id, line['system_qty']).text.trim(),
        );
        if (value == null || value < 0) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'أدخل كمية صحيحة للصنف: ${line['item_name'] ?? ''}',
              ),
            ),
          );
          return;
        }
        payload.add({'line_id': id, 'counted_qty': value});
      }
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.apiClient.post('/inventory/mandatory-stocktake/rep/submit', {
        'lines': payload,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم رفع الجرد للإدارة بنجاح')),
      );
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
            if (snapshot.connectionState == ConnectionState.waiting)
              return const Center(child: CircularProgressIndicator());
            if (snapshot.hasError)
              return _message(
                'تعذر تحميل الجرد. تحقق من الاتصال ثم أعد المحاولة.',
                retry: true,
              );
            final data = snapshot.data ?? <String, dynamic>{};
            if (data['locked'] != true)
              return _message('لا يوجد جرد إلزامي حاليًا.');
            final run = Map<String, dynamic>.from(
              data['run'] as Map? ?? const {},
            );
            final lines = List<Map<String, dynamic>>.from(
              data['lines'] as List? ?? const [],
            );
            if (run['status'] == 'submitted')
              return _message(
                'تم رفع الجرد للإدارة، وسيعود التطبيق للعمل بعد اعتماد الإدارة.',
                done: true,
              );
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
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                Expanded(
                  child: lines.isEmpty
                      ? const Center(
                          child: Text('لا توجد أصناف مسجلة لهذا الجرد'),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: lines.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
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
                        icon: _busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.cloud_upload_outlined),
                        label: Text(
                          _busy ? 'جاري الرفع...' : 'رفع الجرد للإدارة',
                        ),
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
    final isSerial = line['tracking_type'] == 'serial';
    final serials = _serials[id] ?? <String>[];
    final expected = List<String>.from(
      line['expected_serials'] as List? ?? const [],
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              line['item_name']?.toString() ?? 'صنف',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            Text(
              '${line['sku'] ?? ''} — ${line['warehouse_name'] ?? ''}',
              style: const TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 8),
            if (isSerial) ...[
              Text(
                'الموجود في النظام: ${line['system_qty'] ?? 0} سيريال | تم تصويره: ${serials.length}',
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _scanAndMatch(id, expected),
                icon: const Icon(Icons.camera_alt_outlined),
                label: const Text('بدء تصوير ومطابقة السيريالات'),
              ),
              Text(
                'متبقي في النظام ولم يُصوّر: ${expected.where((s) => !_containsSerial(serials, s)).length} | مصوّر غير موجود بالنظام: ${serials.where((s) => !_containsSerial(expected, s)).length}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              if (serials.isNotEmpty)
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: serials
                      .map(
                        (s) => Chip(
                          backgroundColor: _containsSerial(expected, s)
                              ? Colors.green.shade100
                              : Colors.red.shade100,
                          avatar: Icon(
                            _containsSerial(expected, s)
                                ? Icons.check_circle
                                : Icons.error,
                            color: _containsSerial(expected, s)
                                ? Colors.green.shade800
                                : Colors.red.shade800,
                            size: 18,
                          ),
                          label: Text(
                            _containsSerial(expected, s)
                                ? 'موجود بالنظام: $s'
                                : 'غير موجود بالنظام: $s',
                          ),
                          onDeleted: _busy
                              ? null
                              : () => setState(() => serials.remove(s)),
                        ),
                      )
                      .toList(),
                ),
            ] else
              TextField(
                controller: _qtyController(id, line['system_qty']),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'الكمية الفعلية',
                  border: OutlineInputBorder(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _normalizeSerial(String value) =>
      value.replaceAll(RegExp(r'[\s-]'), '').toLowerCase();
  bool _containsSerial(List<String> values, String value) =>
      values.any((item) => _normalizeSerial(item) == _normalizeSerial(value));

  Future<void> _scanAndMatch(String lineId, List<String> expected) async {
    final scanned = await _scanSerials(expected);
    if (!mounted || scanned.isEmpty) return;
    final list = _serials.putIfAbsent(lineId, () => <String>[]);
    for (final serial in scanned) {
      if (serial.isNotEmpty && !_containsSerial(list, serial)) list.add(serial);
    }
    setState(() {});
  }

  Widget _message(String text, {bool retry = false, bool done = false}) =>
      Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                done ? Icons.check_circle_outline : Icons.fact_check_outlined,
                size: 54,
                color: done ? Colors.green : const Color(0xFF3E0865),
              ),
              const SizedBox(height: 16),
              Text(
                text,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (retry) ...[
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => setState(
                    () => _future = widget.apiClient.getMap(
                      '/inventory/mandatory-stocktake/rep/current',
                    ),
                  ),
                  child: const Text('إعادة المحاولة'),
                ),
              ],
            ],
          ),
        ),
      );
}

class _SerialScannerPage extends StatefulWidget {
  const _SerialScannerPage({required this.expected});
  final List<String> expected;
  @override
  State<_SerialScannerPage> createState() => _SerialScannerPageState();
}

class _SerialScannerPageState extends State<_SerialScannerPage> {
  final _controller = MobileScannerController();
  final _serials = <String>[];
  String _normalize(String value) =>
      value.replaceAll(RegExp(r'[\s-]'), '').toLowerCase();
  bool _existsInSystem(String value) =>
      widget.expected.any((item) => _normalize(item) == _normalize(value));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      MobileScanner(
        controller: _controller,
        tapToFocus: true,
        fit: BoxFit.cover,
        onDetect: (capture) {
          // الكرتون يحتوي عدة باركودات؛ نأخذ فقط الباركود الطويل الخاص بـ IMEI 1.
          final code = capture.barcodes
              .map((barcode) => barcode.rawValue?.trim())
              .whereType<String>()
              .firstWhere(
                (value) => RegExp(r'^\d{14,16}$').hasMatch(value),
                orElse: () => '',
              );
          if (code.isNotEmpty &&
              !_serials.any((serial) => _normalize(serial) == _normalize(code)))
            setState(() => _serials.add(code));
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
        left: 16,
        right: 16,
        child: SafeArea(
          child: Row(
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
                onPressed: _controller.toggleTorch,
                icon: const Icon(Icons.flash_on, color: Colors.white, size: 30),
              ),
            ],
          ),
        ),
      ),
      Positioned(
        bottom: 24,
        left: 16,
        right: 16,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'النظام: ${widget.expected.length} | تم تصوير IMEI 1: ${_serials.length} | مطابق: ${_serials.where(_existsInSystem).length} | غير موجود: ${_serials.where((s) => !_existsInSystem(s)).length}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                FilledButton.icon(
                  onPressed: () =>
                      Navigator.pop(context, List<String>.from(_serials)),
                  icon: const Icon(Icons.check),
                  label: const Text('تم'),
                ),
              ],
            ),
          ),
        ),
      ),
      Positioned(
        top: 24,
        left: 16,
        right: 16,
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: _serials
                  .map(
                    (serial) => Text(
                      '${_existsInSystem(serial) ? '✓ موجود في النظام' : '✕ غير موجود في مخزون هذا الصنف/المستودع'}: $serial',
                      style: TextStyle(
                        color: _existsInSystem(serial)
                            ? Colors.green.shade800
                            : Colors.red.shade800,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ),
    ],
  );
}
