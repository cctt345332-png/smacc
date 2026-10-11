import 'package:flutter/material.dart';

import '../data/api_client.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.apiClient.getList('/notifications');
      if (!mounted) return;
      setState(() {
        _items = rows
            .whereType<Map<String, dynamic>>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _markRead(int index) async {
    final item = _items[index];
    if (item['is_read'] == true) return;
    final id = item['id']?.toString();
    if (id == null || id.isEmpty) return;
    try {
      await widget.apiClient.post('/notifications/$id/read', {});
      if (mounted) setState(() => _items[index] = {...item, 'is_read': true});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الإشعارات'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _ErrorState(message: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 180),
                        Center(child: Text('لا توجد إشعارات حالياً')),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(14),
                      itemCount: _items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final item = _items[index];
                        final unread = item['is_read'] != true;
                        final severity = item['severity']?.toString();
                        final color = severity == 'critical'
                            ? Colors.red
                            : severity == 'warning'
                            ? Colors.orange
                            : Theme.of(context).colorScheme.primary;
                        return Card(
                          elevation: unread ? 2 : 0,
                          color: unread ? color.withValues(alpha: 0.07) : null,
                          child: ListTile(
                            onTap: () => _markRead(index),
                            leading: CircleAvatar(
                              backgroundColor: color.withValues(alpha: 0.14),
                              child: Icon(Icons.notifications, color: color),
                            ),
                            title: Text(
                              item['title_ar']?.toString() ?? 'إشعار',
                              style: TextStyle(
                                fontWeight: unread
                                    ? FontWeight.w800
                                    : FontWeight.w500,
                              ),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 5),
                              child: Text(
                                item['message_ar']?.toString() ?? '',
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            trailing: unread
                                ? const Icon(Icons.circle, size: 10)
                                : null,
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off, size: 42),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
        ],
      ),
    ),
  );
}

class NotificationBell extends StatefulWidget {
  const NotificationBell({required this.apiClient, super.key});
  final ApiClient apiClient;

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int _count = 0;

  @override
  void initState() {
    super.initState();
    _loadCount();
  }

  Future<void> _loadCount() async {
    try {
      final result = await widget.apiClient.getMap('/notifications/count');
      if (mounted)
        setState(() => _count = (result['count'] as num?)?.toInt() ?? 0);
    } catch (_) {}
  }

  Future<void> _open() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => NotificationsScreen(apiClient: widget.apiClient),
      ),
    );
    _loadCount();
  }

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      IconButton(
        tooltip: 'الإشعارات',
        onPressed: _open,
        icon: const Icon(Icons.notifications_outlined),
      ),
      if (_count > 0)
        Positioned(
          top: 5,
          right: 5,
          child: Container(
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            padding: const EdgeInsets.symmetric(horizontal: 3),
            decoration: const BoxDecoration(
              color: Colors.red,
              shape: BoxShape.circle,
            ),
            child: Text(
              _count > 99 ? '99+' : '$_count',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
    ],
  );
}
