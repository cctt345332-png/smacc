import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
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
    final odometerData = await _askOdometer(data['run']?['odometer']);
    if (odometerData == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.apiClient.post('/inventory/mandatory-stocktake/rep/submit', {
        'lines': payload,
        'odometer': odometerData['odometer'],
        'odometer_photo_data': odometerData['photo_data'],
        'odometer_photo_name': odometerData['photo_name'],
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

  Future<Map<String, dynamic>?> _askOdometer(dynamic previous) async {
    final photo = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 1800,
      maxHeight: 1800,
    );
    if (photo == null) return null;
    final bytes = await photo.readAsBytes();
    final photoData = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    final controller = TextEditingController(text: previous?.toString() ?? '');
    final value = await showDialog<int>(
      context: context,
      barrierDismissible: false,
      builder: (context) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          title: const Text('تسجيل قراءة عداد المركبة'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'أدخل قراءة العداد الحالية. هذه الخطوة مطلوبة لإرسال الجرد وحساب موعد تغيير الزيت القادم.',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                autofocus: true,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'قراءة العداد بالكيلومتر',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('إلغاء'),
            ),
            FilledButton(
              onPressed: () {
                final number = int.tryParse(controller.text.trim());
                if (number != null && number >= 0)
                  Navigator.pop(context, number);
              },
              child: const Text('تأكيد ورفع الجرد'),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (value == null) return null;
    return {
      'odometer': value,
      'photo_data': photoData,
      'photo_name': photo.name,
    };
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
                'تم رفع الجرد للإدارة، ويمكنك الآن متابعة استخدام التطبيق.',
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

  void _handleCapture(BarcodeCapture capture) {
    // نفس منطق شاشة الفاتورة: الكرتون قد يحتوي عدة باركودات،
    // لذلك نأخذ أول باركود رقمي طويل يمثل IMEI 1 فقط.
    final code = capture.barcodes
        .map((barcode) => barcode.rawValue?.trim())
        .whereType<String>()
        .firstWhere(
          (value) => RegExp(r'^\d{14,16}$').hasMatch(value),
          orElse: () => '',
        );
    if (code.isEmpty ||
        _serials.any((serial) => _normalize(serial) == _normalize(code))) {
      return;
    }
    setState(() => _serials.add(code));
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Expanded(
        flex: 6,
        child: Stack(
          fit: StackFit.expand,
          children: [
            MobileScanner(
              controller: _controller,
              tapToFocus: true,
              fit: BoxFit.cover,
              onDetect: _handleCapture,
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
              top: 14,
              left: 12,
              right: 12,
              child: SafeArea(
                bottom: false,
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'امسح باركود IMEI 1 فقط\nالباركود الطويل الموجود بجانب IMEI 1',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          shadows: [Shadow(color: Colors.black, blurRadius: 5)],
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _controller.toggleTorch,
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
              bottom: 12,
              left: 18,
              right: 18,
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => _controller.setZoomScale(0.8),
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
                        shadows: [Shadow(color: Colors.black, blurRadius: 5)],
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => _controller.setZoomScale(2.5),
                    icon: const Icon(
                      Icons.zoom_in,
                      color: Colors.white,
                      size: 30,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      Expanded(
        flex: 4,
        child: Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'تم تصوير ${_serials.length} سيريال',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  Text(
                    'مطابق ${_serials.where(_existsInSystem).length} / غير موجود ${_serials.where((s) => !_existsInSystem(s)).length}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Expanded(
                child: _serials.isEmpty
                    ? const Center(
                        child: Text(
                          'صوّر السيريال وسيظهر هنا فورًا مع حالته',
                          style: TextStyle(color: Colors.black54),
                        ),
                      )
                    : ListView.separated(
                        itemCount: _serials.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, index) {
                          final serial = _serials[index];
                          final exists = _existsInSystem(serial);
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(
                              exists ? Icons.check_circle : Icons.error,
                              color: exists
                                  ? Colors.green.shade700
                                  : Colors.red.shade700,
                            ),
                            title: Text(
                              serial,
                              textDirection: TextDirection.ltr,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            subtitle: Text(
                              exists
                                  ? 'موجود في النظام لهذا الصنف والمستودع'
                                  : 'غير موجود في النظام لهذا الصنف والمستودع',
                              style: TextStyle(
                                color: exists
                                    ? Colors.green.shade700
                                    : Colors.red.shade700,
                              ),
                            ),
                          );
                        },
                      ),
              ),
              SizedBox(
                height: 44,
                child: FilledButton.icon(
                  onPressed: () =>
                      Navigator.pop(context, List<String>.from(_serials)),
                  icon: const Icon(Icons.check),
                  label: const Text('تم'),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
