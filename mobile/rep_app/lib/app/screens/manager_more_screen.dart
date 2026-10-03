import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../data/api_client.dart';

const _brand = Color(0xFF3E0865);

class RepTrackingScreen extends StatefulWidget {
  const RepTrackingScreen({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  State<RepTrackingScreen> createState() => _RepTrackingScreenState();
}

class _RepTrackingScreenState extends State<RepTrackingScreen> {
  bool loading = true;
  Object? error;
  List<Map<String, dynamic>> live = [];
  List<Map<String, dynamic>> history = [];
  String? selectedId;
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await Future.wait<Object>([
        widget.apiClient.getList('/reps/locations/live'),
        if (selectedId != null)
          widget.apiClient.getList('/reps/$selectedId/locations'),
      ]);
      if (!mounted) return;
      final points = (result.first as List)
          .map((x) => Map<String, dynamic>.from(x as Map))
          .toList();
      final route = selectedId == null
          ? <Map<String, dynamic>>[]
          : (result.length > 1 ? (result[1] as List) : <dynamic>[])
                .map((x) => Map<String, dynamic>.from(x as Map))
                .toList();
      setState(() {
        live = points;
        history = route;
        loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e;
          loading = false;
        });
      }
    }
  }

  Future<void> select(Map<String, dynamic> item) async {
    setState(() => selectedId = item['rep_id']?.toString());
    await load();
    if (!mounted) return;
    final lat = double.tryParse('${item['latitude']}');
    final lon = double.tryParse('${item['longitude']}');
    if (lat != null && lon != null) {
      _mapController.move(LatLng(lat, lon), 14);
    }
  }

  String time(dynamic value) {
    if (value == null) return '—';
    return value.toString().replaceFirst('T', ' ').split('.').first;
  }

  String number(dynamic value, [int digits = 5]) =>
      double.tryParse('$value')?.toStringAsFixed(digits) ?? '—';

  @override
  Widget build(BuildContext context) {
    final markers = live
        .map((item) {
          final lat = double.tryParse('${item['latitude']}');
          final lon = double.tryParse('${item['longitude']}');
          if (lat == null || lon == null) return null;
          return Marker(
            point: LatLng(lat, lon),
            width: 150,
            height: 58,
            child: GestureDetector(
              onTap: () => select(item),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: item['is_moving'] == true ? Colors.green : _brand,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${item['rep_name'] ?? 'مندوب'}',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                    ),
                  ),
                  Icon(
                    Icons.location_on,
                    color: item['is_moving'] == true ? Colors.green : _brand,
                    size: 30,
                  ),
                ],
              ),
            ),
          );
        })
        .whereType<Marker>()
        .toList();
    final routePoints = history
        .map((item) {
          final lat = double.tryParse('${item['latitude']}');
          final lon = double.tryParse('${item['longitude']}');
          return lat != null && lon != null ? LatLng(lat, lon) : null;
        })
        .whereType<LatLng>()
        .toList();
    final center = markers.isNotEmpty
        ? markers.first.point
        : const LatLng(24.7136, 46.6753);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'تتبع المندوبين',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
          ? Center(
              child: Text(
                'تعذر تحميل التتبع\n$error',
                textAlign: TextAlign.center,
              ),
            )
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: SizedBox(
                      height: 330,
                      child: FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: center,
                          initialZoom: 6,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName:
                                'com.lucistudio.flutter_starter_template',
                          ),
                          if (routePoints.length > 1)
                            PolylineLayer(
                              polylines: [
                                Polyline(
                                  points: routePoints,
                                  strokeWidth: 4,
                                  color: Colors.deepOrange,
                                ),
                              ],
                            ),
                          MarkerLayer(markers: markers),
                          const RichAttributionWidget(
                            attributions: [
                              TextSourceAttribution(
                                'OpenStreetMap contributors',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _summary(
                          'المتصلون الآن',
                          '${live.length}',
                          Icons.people_alt_outlined,
                        ),
                      ),
                      Expanded(
                        child: _summary(
                          'نقاط المسار',
                          '${history.length}',
                          Icons.route_outlined,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (live.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(18),
                        child: Text('لا توجد نقاط تتبع حديثة خلال آخر ساعتين'),
                      ),
                    ),
                  ...live.map((item) => _liveCard(item)),
                ],
              ),
            ),
    );
  }

  Widget _summary(String label, String value, IconData icon) => Card(
    elevation: 0,
    child: ListTile(
      leading: Icon(icon, color: _brand),
      title: Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(label),
    ),
  );

  Widget _liveCard(Map<String, dynamic> item) {
    final selected = selectedId == item['rep_id']?.toString();
    return Card(
      color: selected ? const Color(0xFFF1E9F7) : null,
      child: ListTile(
        onTap: () => select(item),
        leading: CircleAvatar(
          backgroundColor: item['is_moving'] == true
              ? Colors.green.shade100
              : Colors.grey.shade200,
          child: Icon(
            item['is_moving'] == true
                ? Icons.directions_run
                : Icons.person_pin_circle,
            color: _brand,
          ),
        ),
        title: Text(
          '${item['rep_name'] ?? 'مندوب'}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          'آخر تحديث: ${time(item['recorded_at'])}\nالموقع: ${number(item['latitude'])}, ${number(item['longitude'])}',
        ),
        isThreeLine: true,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              item['is_moving'] == true ? 'يتحرك' : 'متوقف',
              style: TextStyle(
                color: item['is_moving'] == true
                    ? Colors.green
                    : Colors.black54,
                fontSize: 11,
              ),
            ),
            const Icon(Icons.chevron_left),
          ],
        ),
      ),
    );
  }
}

class RepAttendanceAdminScreen extends StatefulWidget {
  const RepAttendanceAdminScreen({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  State<RepAttendanceAdminScreen> createState() =>
      _RepAttendanceAdminScreenState();
}

class _RepAttendanceAdminScreenState extends State<RepAttendanceAdminScreen> {
  late DateTime date;
  bool loading = true;
  Object? error;
  List<Map<String, dynamic>> records = [];
  Map<String, dynamic> summary = {};

  @override
  void initState() {
    super.initState();
    date = DateTime.now();
    load();
  }

  String iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await widget.apiClient.getMap(
        '/reps/attendance?date=${iso(date)}',
      );
      if (!mounted) return;
      setState(() {
        records = ((data['records'] as List?) ?? [])
            .map((x) => Map<String, dynamic>.from(x as Map))
            .toList();
        summary = Map<String, dynamic>.from((data['summary'] as Map?) ?? {});
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

  String time(dynamic value) => value == null
      ? 'لم يسجل'
      : value.toString().replaceFirst('T', ' ').split('.').first;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'حضور المناديب',
        style: TextStyle(fontWeight: FontWeight.w800),
      ),
      actions: [
        IconButton(onPressed: load, icon: const Icon(Icons.refresh)),
        IconButton(
          onPressed: () async {
            final picked = await showDatePicker(
              context: context,
              firstDate: DateTime(2024),
              lastDate: DateTime.now(),
              initialDate: date,
              locale: const Locale('ar'),
            );
            if (picked != null) {
              setState(() => date = picked);
              load();
            }
          },
          icon: const Icon(Icons.calendar_month),
        ),
      ],
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : error != null
        ? Center(
            child: Text(
              'تعذر تحميل الحضور\n$error',
              textAlign: TextAlign.center,
            ),
          )
        : RefreshIndicator(
            onRefresh: load,
            child: ListView(
              padding: const EdgeInsets.all(14),
              children: [
                Text(
                  'التاريخ: ${iso(date)}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _stat(
                        'الحاضرون',
                        summary['present'] ?? 0,
                        Colors.green,
                      ),
                    ),
                    Expanded(
                      child: _stat(
                        'لم يسجلوا',
                        summary['absent'] ?? 0,
                        Colors.orange,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...records.map(
                  (item) => Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: item['status'] == 'present'
                            ? Colors.green.shade100
                            : Colors.orange.shade100,
                        child: Icon(
                          item['status'] == 'present'
                              ? Icons.check
                              : Icons.schedule,
                          color: item['status'] == 'present'
                              ? Colors.green
                              : Colors.orange,
                        ),
                      ),
                      title: Text(
                        '${item['rep_name'] ?? 'مندوب'}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        '${item['rep_code'] ?? ''}\nوقت تسجيل الحضور: ${time(item['check_in_at'])}',
                      ),
                      isThreeLine: true,
                    ),
                  ),
                ),
                if (records.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(30),
                    child: Center(child: Text('لا يوجد مناديب')),
                  ),
              ],
            ),
          ),
  );

  Widget _stat(String label, dynamic value, Color color) => Card(
    elevation: 0,
    child: ListTile(
      leading: Icon(Icons.circle, color: color, size: 14),
      title: Text(
        '$value',
        style: TextStyle(fontWeight: FontWeight.w800, color: color),
      ),
      subtitle: Text(label),
    ),
  );
}
