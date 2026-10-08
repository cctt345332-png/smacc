import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;

import '../data/api_client.dart';

const _expenseBrand = Color(0xFF3E0865);

class RepExpensesScreen extends StatefulWidget {
  const RepExpensesScreen({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  State<RepExpensesScreen> createState() => _RepExpensesScreenState();
}

class _ExpenseAttachment {
  _ExpenseAttachment({
    required this.name,
    required this.type,
    required this.size,
    required this.bytes,
  });
  final String name;
  final String type;
  final int size;
  final Uint8List bytes;
}

class _RepExpensesScreenState extends State<RepExpensesScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _description = TextEditingController();
  DateTime _date = DateTime.now();
  String _category = 'fuel';
  String _paymentMethod = 'rep_advance';
  List<_ExpenseAttachment> _attachments = [];
  List<dynamic> _expenses = [];
  bool _loading = true;
  bool _saving = false;

  static const categories = <String, String>{
    'fuel': 'وقود',
    'vehicle_maintenance': 'صيانة سيارة',
    'shipping': 'شحن وتوصيل',
    'hospitality': 'ضيافة',
    'communications': 'اتصالات',
    'parking': 'مواقف',
    'travel': 'سفر',
    'other': 'مصروفات أخرى',
  };
  static const paymentMethods = <String, String>{
    'rep_advance': 'عهدة المندوب',
    'cash': 'نقداً',
    'bank_transfer': 'تحويل بنكي',
    'mada': 'مدى',
    'credit_card': 'بطاقة',
    'stc_pay': 'STC Pay',
    'cheque': 'شيك',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _amount.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final result = await widget.apiClient.getList('/expenses');
      if (mounted) setState(() => _expenses = result);
    } catch (error) {
      if (mounted) _show(error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickAttachments() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf'],
    );
    if (result == null) return;
    final selected = <_ExpenseAttachment>[];
    for (final file in result.files) {
      final originalBytes = file.bytes;
      if (originalBytes == null) continue;
      final prepared = _prepareAttachment(
        file.name,
        file.extension,
        originalBytes,
      );
      final bytes = prepared.bytes;
      if (bytes.length > 5 * 1024 * 1024) {
        _show('حجم الملف ${file.name} أكبر من 5 ميجابايت');
        continue;
      }
      selected.add(
        _ExpenseAttachment(
          name: prepared.name,
          type: prepared.type,
          size: bytes.length,
          bytes: bytes,
        ),
      );
    }
    if (!mounted) return;
    setState(
      () => _attachments = [..._attachments, ...selected].take(5).toList(),
    );
    if (_attachments.length >= 5 && selected.length > 5)
      _show('الحد الأقصى للمرفقات خمسة ملفات');
  }

  ({String name, String type, Uint8List bytes}) _prepareAttachment(
    String name,
    String? extension,
    Uint8List bytes,
  ) {
    final isImage = const {
      'jpg',
      'jpeg',
      'png',
    }.contains((extension ?? '').toLowerCase());
    if (!isImage) {
      return (name: name, type: _contentType(extension), bytes: bytes);
    }
    try {
      final decoded = img.decodeImage(bytes);
      if (decoded == null) {
        return (name: name, type: _contentType(extension), bytes: bytes);
      }
      final resized = decoded.width > 1600
          ? img.copyResize(decoded, width: 1600)
          : decoded;
      var quality = 82;
      var compressed = Uint8List.fromList(
        img.encodeJpg(resized, quality: quality),
      );
      while (compressed.length > 1_800_000 && quality > 45) {
        quality -= 10;
        compressed = Uint8List.fromList(
          img.encodeJpg(resized, quality: quality),
        );
      }
      final baseName = name.replaceFirst(RegExp(r'\.[^.]+$'), '');
      return (name: '$baseName.jpg', type: 'image/jpeg', bytes: compressed);
    } catch (_) {
      return (name: name, type: _contentType(extension), bytes: bytes);
    }
  }

  String _contentType(String? extension) {
    switch ((extension ?? '').toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }

  Future<void> _chooseDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      locale: const Locale('ar'),
      helpText: 'تاريخ المصروف',
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_attachments.length > 5) {
      _show('الحد الأقصى للمرفقات خمسة ملفات');
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.apiClient.post('/expenses', {
        'expense_date': DateTime(
          _date.year,
          _date.month,
          _date.day,
        ).toIso8601String(),
        'category': _category,
        'amount': double.parse(_amount.text.trim()),
        'payment_method': _paymentMethod,
        'description': _description.text.trim().isEmpty
            ? null
            : _description.text.trim(),
        'attachments': _attachments
            .map(
              (file) => {
                'file_name': file.name,
                'content_type': file.type,
                'file_size': file.size,
                'file_data': base64Encode(file.bytes),
              },
            )
            .toList(),
      });
      if (!mounted) return;
      _amount.clear();
      _description.clear();
      setState(() {
        _attachments = [];
        _date = DateTime.now();
      });
      _show('تم إرسال المصروف للإدارة للمراجعة');
      await _load();
    } catch (error) {
      if (mounted) _show(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _show(String message) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(message)));

  String _status(String value) => switch (value) {
    'approved' => 'معتمد',
    'rejected' => 'مرفوض',
    _ => 'بانتظار المراجعة',
  };

  Color _statusColor(String value) => switch (value) {
    'approved' => Colors.green,
    'rejected' => Colors.red,
    _ => Colors.orange,
  };

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('مصاريفي'), centerTitle: true),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          _buildForm(),
          const SizedBox(height: 22),
          const Text(
            'سجل المصاريف',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              ),
            )
          else if (_expenses.isEmpty)
            const _EmptyExpenses()
          else
            ..._expenses.map(
              (expense) => _ExpenseCard(
                expense: Map<String, dynamic>.from(expense as Map),
                status: _status,
                statusColor: _statusColor,
              ),
            ),
        ],
      ),
    ),
  );

  Widget _buildForm() => Card(
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(color: Colors.grey.shade200),
    ),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'إضافة مصروف جديد',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: _expenseBrand,
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'المبلغ',
                prefixText: 'ر.س ',
                border: OutlineInputBorder(),
              ),
              validator: (value) =>
                  double.tryParse(value?.trim() ?? '') == null ||
                      double.parse(value!.trim()) <= 0
                  ? 'أدخل مبلغاً صحيحاً'
                  : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: const InputDecoration(
                labelText: 'نوع المصروف',
                border: OutlineInputBorder(),
              ),
              items: categories.entries
                  .map(
                    (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => _category = value ?? _category),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _paymentMethod,
              decoration: const InputDecoration(
                labelText: 'طريقة الدفع',
                border: OutlineInputBorder(),
              ),
              items: paymentMethods.entries
                  .map(
                    (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                  )
                  .toList(),
              onChanged: (value) =>
                  setState(() => _paymentMethod = value ?? _paymentMethod),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _chooseDate,
              icon: const Icon(Icons.calendar_month),
              label: Text(
                'تاريخ المصروف: ${_date.day.toString().padLeft(2, '0')}-${_date.month.toString().padLeft(2, '0')}-${_date.year}',
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _description,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'الوصف أو الملاحظات (اختياري)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _attachments.length >= 5 ? null : _pickAttachments,
              icon: const Icon(Icons.attach_file),
              label: Text('إضافة مرفق (${_attachments.length}/5)'),
            ),
            if (_attachments.isNotEmpty) ...[
              const SizedBox(height: 8),
              ..._attachments.asMap().entries.map(
                (entry) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: Icon(
                    entry.value.type == 'application/pdf'
                        ? Icons.picture_as_pdf
                        : Icons.image,
                    color: _expenseBrand,
                  ),
                  title: Text(
                    entry.value.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    '${(entry.value.size / 1024).toStringAsFixed(0)} KB',
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () =>
                        setState(() => _attachments.removeAt(entry.key)),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _saving ? null : _submit,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send),
              label: Text(_saving ? 'جاري الإرسال...' : 'إرسال للإدارة'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _EmptyExpenses extends StatelessWidget {
  const _EmptyExpenses();
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.all(30),
    child: Center(child: Text('لا توجد مصاريف مسجلة بعد')),
  );
}

class _ExpenseCard extends StatelessWidget {
  const _ExpenseCard({
    required this.expense,
    required this.status,
    required this.statusColor,
  });
  final Map<String, dynamic> expense;
  final String Function(String) status;
  final Color Function(String) statusColor;
  @override
  Widget build(BuildContext context) {
    final state = '${expense['status'] ?? 'pending'}';
    final date = DateTime.tryParse('${expense['expense_date'] ?? ''}');
    final amount = NumberFormatHelper.format(expense['amount']);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      color: const Color(0xFFFDF8FF),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${expense['expense_number'] ?? '—'}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: _expenseBrand,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor(state).withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    status(state),
                    style: TextStyle(
                      color: statusColor(state),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${categoriesForCard[expense['category']] ?? expense['category'] ?? '—'} • $amount ر.س',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            if (date != null)
              Text(
                'التاريخ: ${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}',
              ),
            if ('${expense['description'] ?? ''}'.trim().isNotEmpty)
              Text(
                '${expense['description']}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            if (expense['rejection_reason'] != null)
              Text(
                'سبب الرفض: ${expense['rejection_reason']}',
                style: const TextStyle(color: Colors.red),
              ),
          ],
        ),
      ),
    );
  }

  static const categoriesForCard = <String, String>{
    'fuel': 'وقود',
    'vehicle_maintenance': 'صيانة سيارة',
    'shipping': 'شحن وتوصيل',
    'hospitality': 'ضيافة',
    'communications': 'اتصالات',
    'parking': 'مواقف',
    'travel': 'سفر',
    'other': 'مصروفات أخرى',
  };
}

class NumberFormatHelper {
  static String format(dynamic value) =>
      double.tryParse('$value')?.toStringAsFixed(2) ?? '0.00';
}
