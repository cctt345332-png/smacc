import 'package:flutter/material.dart';
import '../data/api_client.dart';

class VehicleMaintenanceScreen extends StatefulWidget {
  const VehicleMaintenanceScreen({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<VehicleMaintenanceScreen> createState() => _VehicleMaintenanceScreenState();
}

class _VehicleMaintenanceScreenState extends State<VehicleMaintenanceScreen> {
  late Future<Map<String, dynamic>> _future;
  final _odometer = TextEditingController();
  final _oilOdometer = TextEditingController();
  final _amount = TextEditingController(text: '0');
  final _oilType = TextEditingController();
  final _vendor = TextEditingController();
  final _notes = TextEditingController();
  bool _busy = false;
  @override
  void initState() { super.initState(); _load(); }
  void _load() { _future = widget.apiClient.getMap('/vehicle-maintenance/me'); }
  @override
  void dispose() { for (final c in [_odometer, _oilOdometer, _amount, _oilType, _vendor, _notes]) { c.dispose(); } super.dispose(); }
  Future<void> _saveOdometer() async {
    final value = int.tryParse(_odometer.text.trim());
    if (value == null) return;
    setState(() => _busy = true);
    try { await widget.apiClient.patch('/vehicle-maintenance/me/odometer', {'odometer': value}); _odometer.clear(); setState(_load); } catch (e) { _error(e); } finally { if (mounted) setState(() => _busy = false); }
  }
  Future<void> _saveOil() async {
    final value = int.tryParse(_oilOdometer.text.trim());
    if (value == null) return;
    setState(() => _busy = true);
    try { await widget.apiClient.post('/vehicle-maintenance/me/maintenance', {'service_date': DateTime.now().toIso8601String().substring(0, 10), 'odometer': value, 'amount': double.tryParse(_amount.text) ?? 0, 'oil_type': _oilType.text.trim(), 'vendor_name': _vendor.text.trim(), 'notes': _notes.text.trim()}); _oilOdometer.clear(); _amount.text = '0'; _oilType.clear(); _vendor.clear(); _notes.clear(); setState(_load); } catch (e) { _error(e); } finally { if (mounted) setState(() => _busy = false); }
  }
  void _error(Object e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'))); }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('مركبتي وصيانتها', style: TextStyle(fontWeight: FontWeight.w800))),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return Center(child: Text('تعذر تحميل بيانات المركبة\n${snapshot.error}', textAlign: TextAlign.center));
        final data = snapshot.data ?? {}; final vehicle = (data['vehicle'] as Map?)?.cast<String, dynamic>() ?? {}; final records = (data['maintenance'] as List? ?? []).cast<Map>();
        final current = vehicle['current_odometer'] ?? 0; final due = vehicle['next_oil_due_km'];
        return RefreshIndicator(onRefresh: () async => setState(_load), child: ListView(padding: const EdgeInsets.all(16), children: [
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${vehicle['vehicle_type'] ?? 'مركبة'} ${vehicle['model'] ?? ''}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), Text('اللوحة: ${vehicle['plate_number'] ?? '—'}'), const SizedBox(height: 8), Text('قراءة العداد: $current كم', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)), if (due != null) Text('تغيير الزيت القادم عند: $due كم أو ${vehicle['next_oil_due_date'] ?? '—'}', style: const TextStyle(color: Colors.deepPurple, fontWeight: FontWeight.w700))])),
          const SizedBox(height: 12), _section('تحديث قراءة العداد', [_field(_odometer, 'القراءة الحالية بالكيلومتر', TextInputType.number), _button('حفظ قراءة العداد', _saveOdometer)]),
          const SizedBox(height: 12), _section('تسجيل تغيير الزيت', [_field(_oilOdometer, 'قراءة العداد وقت تغيير الزيت', TextInputType.number), _field(_oilType, 'نوع الزيت (اختياري)', TextInputType.text), _field(_vendor, 'محل الصيانة (اختياري)', TextInputType.text), _field(_amount, 'المبلغ (اختياري)', TextInputType.number), _field(_notes, 'ملاحظات (اختياري)', TextInputType.multiline), _button('حفظ تغيير الزيت', _saveOil)]),
          const SizedBox(height: 18), const Text('سجل الصيانة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), const SizedBox(height: 8), if (records.isEmpty) const Text('لا يوجد سجل صيانة بعد') else ...records.map((r) => Card(child: ListTile(leading: const Icon(Icons.oil_barrel_outlined), title: Text('تغيير زيت — ${r['service_date'] ?? ''}'), subtitle: Text('العداد: ${r['odometer'] ?? 0} كم${r['oil_type'] != null && '${r['oil_type']}'.isNotEmpty ? ' • ${r['oil_type']}' : ''}'), trailing: Text('${r['amount'] ?? 0} ر.س')))),
        ]));
      },
    ),
  );
  Widget _section(String title, List<Widget> children) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)), const SizedBox(height: 10), ...children])));
  Widget _field(TextEditingController c, String label, TextInputType type) => Padding(padding: const EdgeInsets.only(bottom: 10), child: TextField(controller: c, keyboardType: type, maxLines: type == TextInputType.multiline ? 3 : 1, decoration: InputDecoration(labelText: label, border: const OutlineInputBorder())));
  Widget _button(String label, VoidCallback action) => SizedBox(width: double.infinity, child: FilledButton(onPressed: _busy ? null : action, child: Text(_busy ? 'جاري الحفظ...' : label)));
}
