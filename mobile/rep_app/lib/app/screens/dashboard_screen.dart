import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../data/api_client.dart';
import 'notifications_screen.dart';
import 'rep_forms.dart';
import 'rep_lists.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    required this.apiClient,
    required this.onOpen,
    super.key,
  });
  final ApiClient apiClient;
  final void Function(Widget page) onOpen;
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? profile, summary;
  Object? error;
  bool loading = true;
  Timer? _locationTimer;
  @override
  void initState() {
    super.initState();
    _load();
    _sendLocation();
    _locationTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => _sendLocation(),
    );
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    super.dispose();
  }

  Future<void> _sendLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
      await widget.apiClient.post('/reps/me/location', {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
        'speed': position.speed,
        'heading': position.heading,
        'recorded_at': DateTime.now().toUtc().toIso8601String(),
        'is_moving': position.speed > 1,
      });
    } catch (_) {
      // التتبع اختياري ولا يمنع المندوب من استخدام التطبيق.
    }
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final r = await Future.wait([
        widget.apiClient.getMap('/reps/me/profile'),
        widget.apiClient.getMap('/reps/me/summary'),
      ]);
      if (mounted)
        setState(() {
          profile = r[0];
          summary = r[1];
          loading = false;
        });
    } catch (e) {
      if (mounted)
        setState(() {
          error = e;
          loading = false;
        });
    }
  }

  String money(dynamic v) =>
      '${(num.tryParse('$v') ?? 0).toStringAsFixed(2)} ر.س';
  String text(String k, [String fallback = '—']) =>
      (profile?[k] ?? summary?[k])?.toString() ?? fallback;
  Widget action(IconData icon, String label, Widget page, Color color) =>
      InkWell(
        onTap: () => widget.onOpen(page),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE5DDE9)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 21,
                backgroundColor: color.withValues(alpha: .12),
                child: Icon(icon, color: color),
              ),
              const SizedBox(height: 7),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );
  Widget quickActions() => GridView.count(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisCount: 3,
    crossAxisSpacing: 8,
    mainAxisSpacing: 8,
    childAspectRatio: .95,
    children: [
      action(
        Icons.add_shopping_cart,
        'إنشاء فاتورة',
        InvoiceCreateScreen(apiClient: widget.apiClient),
        const Color(0xFF3E0865),
      ),
      action(
        Icons.post_add,
        'إنشاء سند قبض',
        PaymentCreateScreen(apiClient: widget.apiClient),
        const Color(0xFF147D58),
      ),
      action(
        Icons.receipt_long,
        'عرض الفواتير',
        RepListScreen(
          apiClient: widget.apiClient,
          title: 'الفواتير',
          path: '/sales/invoices',
          fields: const [
            'invoice_number',
            'buyer_name_ar',
            'status',
            'total',
            'paid_amount',
          ],
        ),
        const Color(0xFFB06A00),
      ),
      action(
        Icons.people,
        'عرض العملاء',
        CustomersScreen(apiClient: widget.apiClient),
        const Color(0xFF356B63),
      ),
      action(
        Icons.inventory_2,
        'بطاقة الصنف',
        RepListScreen(
          apiClient: widget.apiClient,
          title: 'مخزوني',
          path: '/reps/me/stock',
          fields: const [
            'item_name',
            'item_sku',
            'available_qty',
            'sale_price',
          ],
        ),
        const Color(0xFF8B3D75),
      ),
      action(
        Icons.payments,
        'عرض السندات',
        RepListScreen(
          apiClient: widget.apiClient,
          title: 'سندات القبض',
          path: '/sales/payments',
          fields: const [
            'payment_number',
            'invoice_id',
            'amount',
            'payment_method',
          ],
        ),
        const Color(0xFF2D6A9F),
      ),
    ],
  );
  Widget metrics() => GridView.count(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisCount: 2,
    crossAxisSpacing: 10,
    mainAxisSpacing: 10,
    childAspectRatio: 1.55,
    children: [
      _Metric(
        label: 'إجمالي المبيعات',
        value: money(summary?['total_sales']),
        icon: Icons.trending_up,
        color: const Color(0xFF147D58),
      ),
      _Metric(
        label: 'الفواتير',
        value: '${summary?['invoice_count'] ?? 0}',
        icon: Icons.receipt_long,
        color: const Color(0xFF3E0865),
      ),
      _Metric(
        label: 'المبالغ المحصلة',
        value: money(summary?['total_collected']),
        icon: Icons.payments,
        color: const Color(0xFFB06A00),
      ),
      _Metric(
        label: 'المتبقي للتحصيل',
        value: money(summary?['outstanding']),
        icon: Icons.warning_amber,
        color: const Color(0xFFB43D32),
      ),
    ],
  );

  Widget monthlyTarget() {
    final target = num.tryParse('${summary?['target_monthly'] ?? 0}') ?? 0;
    final sales = num.tryParse('${summary?['monthly_sales'] ?? 0}') ?? 0;
    final progress = target > 0 ? (sales / target).clamp(0, 1).toDouble() : 0.0;
    final percentage = target > 0 ? (sales / target * 100).round() : 0;
    final remaining = target > sales ? target - sales : 0;
    final reached = target > 0 && sales >= target;
    final commissionPct =
        num.tryParse('${summary?['commission_pct'] ?? 0}') ?? 0;
    final commission =
        num.tryParse('${summary?['monthly_commission'] ?? 0}') ?? 0;
    final accent = reached ? const Color(0xFF147D58) : const Color(0xFF3E0865);

    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE5DDE9)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: accent.withValues(alpha: .12),
                  child: Icon(
                    reached ? Icons.emoji_events_outlined : Icons.flag_outlined,
                    color: accent,
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'الهدف الشهري',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
                ),
                Text(
                  target > 0 ? '$percentage%' : 'غير محدد',
                  style: TextStyle(fontWeight: FontWeight.w800, color: accent),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: target > 0 ? progress : 0,
                minHeight: 10,
                backgroundColor: const Color(0xFFEDE7F0),
                color: reached
                    ? const Color(0xFF147D58)
                    : const Color(0xFF6C2B8B),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: Text('المحقق: ${money(sales)}')),
                Text('الهدف: ${money(target)}'),
              ],
            ),
            if (target > 0 && !reached) ...[
              const SizedBox(height: 5),
              Text(
                'المتبقي: ${money(remaining)}',
                style: const TextStyle(color: Colors.black54, fontSize: 12),
              ),
            ],
            if (reached) ...[
              const SizedBox(height: 5),
              const Text(
                'تم تحقيق الهدف الشهري',
                style: TextStyle(
                  color: Color(0xFF147D58),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            if (commissionPct > 0) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: reached
                      ? const Color(0xFFEAF8F1)
                      : const Color(0xFFF7F2F8),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  reached
                      ? 'العمولة المستحقة هذا الشهر: ${money(commission)} (${commissionPct.toStringAsFixed(2)}%)'
                      : 'نسبة العمولة ${commissionPct.toStringAsFixed(2)}% وتُحتسب بعد تجاوز الهدف الشهري',
                  style: TextStyle(
                    color: reached
                        ? const Color(0xFF147D58)
                        : const Color(0xFF5A187E),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (error != null) {
      body = Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: Colors.black38),
            const SizedBox(height: 12),
            const Text('تعذر تحميل بياناتك'),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('إعادة المحاولة'),
            ),
          ],
        ),
      );
    } else {
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF3E0865), Color(0xFF6C2B8B)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.white24,
                    child: Icon(Icons.person, color: Colors.white, size: 30),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'مرحبًا بك،',
                          style: TextStyle(color: Colors.white70),
                        ),
                        Text(
                          text('full_name', 'مندوب المبيعات'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 21,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          '${text('rep_code')} • ${text('zone', text('warehouse_name'))}',
                          style: const TextStyle(color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            monthlyTarget(),
            const SizedBox(height: 18),
            const Text(
              'إجراءات سريعة',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            quickActions(),
            const SizedBox(height: 18),
            const Text(
              'ملخص الأداء',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            metrics(),
            const SizedBox(height: 16),
            Card(
              elevation: 0,
              child: ListTile(
                leading: const Icon(
                  Icons.inventory_2,
                  color: Color(0xFF3E0865),
                ),
                title: const Text(
                  'مخزوني الحالي',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(text('warehouse_name')),
                trailing: Text(
                  '${summary?['stock_qty'] ?? 0}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'لوحة المندوب',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          NotificationBell(apiClient: widget.apiClient),
          IconButton(
            onPressed: loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: body,
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label, value;
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: const BorderSide(color: Color(0xFFE5DDE9)),
    ),
    child: Padding(
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
          FittedBox(
            child: Text(
              value,
              style: TextStyle(fontWeight: FontWeight.w800, color: color),
            ),
          ),
        ],
      ),
    ),
  );
}
