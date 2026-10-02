import 'package:flutter/material.dart';

import 'data/api_client.dart';
import 'data/session_store.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'screens/rep_lists.dart';
import 'screens/rep_extra.dart';

class App extends StatefulWidget {
  const App({required this.apiClient, required this.sessionStore, super.key});
  final ApiClient apiClient;
  final SessionStore sessionStore;
  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  bool get _signedIn => widget.sessionStore.token?.isNotEmpty == true;
  void _onSignedIn() => setState(() {});
  Future<void> _logout() async {
    await widget.sessionStore.clear();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) => !_signedIn
      ? LoginScreen(apiClient: widget.apiClient, onSignedIn: _onSignedIn)
      : RepShell(apiClient: widget.apiClient);
}

class RepShell extends StatefulWidget {
  const RepShell({required this.apiClient, super.key});
  final ApiClient apiClient;
  @override
  State<RepShell> createState() => _RepShellState();
}

class _RepShellState extends State<RepShell> {
  int _index = 0;
  void _openMore() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => _MoreMenu(apiClient: widget.apiClient),
  );
  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      DashboardScreen(
        apiClient: widget.apiClient,
        onOpen: (page) => Navigator.push<void>(
          context,
          MaterialPageRoute<void>(builder: (_) => page),
        ),
      ),
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
      CustomersScreen(apiClient: widget.apiClient),
      RepListScreen(
        apiClient: widget.apiClient,
        title: 'مخزوني',
        path: '/reps/me/stock',
        fields: const ['item_name', 'item_sku', 'available_qty', 'sale_price'],
      ),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          if (i == 4) {
            _openMore();
          } else {
            setState(() => _index = i);
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long_rounded),
            label: 'الفواتير',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people_rounded),
            label: 'العملاء',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2_rounded),
            label: 'المخزون',
          ),
          NavigationDestination(
            icon: Icon(Icons.more_horiz_rounded),
            label: 'المزيد',
          ),
        ],
      ),
    );
  }
}

class _MoreMenu extends StatelessWidget {
  const _MoreMenu({required this.apiClient});
  final ApiClient apiClient;
  void _push(BuildContext context, Widget page) {
    Navigator.pop(context);
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(builder: (_) => page),
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Align(
            alignment: Alignment.centerRight,
            child: Text(
              'المزيد',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 8),
          _tile(
            context,
            Icons.payments_outlined,
            'سندات القبض',
            RepListScreen(
              apiClient: apiClient,
              title: 'سندات القبض',
              path: '/sales/payments',
              fields: const [
                'payment_number',
                'payment_type',
                'invoice_number',
                'amount',
                'payment_method',
              ],
            ),
          ),
          _tile(
            context,
            Icons.local_shipping_outlined,
            'مناقلات المخزون',
            RepListScreen(
              apiClient: apiClient,
              title: 'مناقلاتي',
              path: '/reps/me/transfers',
              fields: const ['date', 'direction', 'product_name', 'quantity'],
            ),
          ),
          _tile(
            context,
            Icons.account_balance_outlined,
            'كشوفات حساب العملاء',
            CustomerStatementsScreen(apiClient: apiClient),
          ),
          _tile(
            context,
            Icons.fact_check_outlined,
            'الحضور والانصراف',
            AttendanceScreen(apiClient: apiClient),
          ),
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('الملف الشخصي'),
            onTap: () => _push(context, ProfileScreen(apiClient: apiClient)),
          ),
        ],
      ),
    ),
  );
  Widget _tile(
    BuildContext context,
    IconData icon,
    String title,
    Widget page,
  ) => ListTile(
    leading: Icon(icon, color: const Color(0xFF3E0865)),
    title: Text(title),
    trailing: const Icon(Icons.chevron_left),
    onTap: () => _push(context, page),
  );
}
