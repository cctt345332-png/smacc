import 'package:flutter/material.dart';

import 'data/api_client.dart';
import 'data/session_store.dart';
import 'screens/company_dashboard_screen.dart';
import 'screens/company_reports_screen.dart';
import 'screens/company_records_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'screens/manager_more_screen.dart';
import 'screens/rep_extra.dart';
import 'screens/rep_lists.dart';
import 'screens/supervisor_screen.dart';

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

  @override
  Widget build(BuildContext context) => !_signedIn
      ? LoginScreen(apiClient: widget.apiClient, onSignedIn: _onSignedIn)
      : widget.sessionStore.isSupervisor
      ? SupervisorShell(apiClient: widget.apiClient)
      : widget.sessionStore.isCompanyManager
      ? CompanyShell(apiClient: widget.apiClient, onSignedOut: _onSignedIn)
      : RepShell(apiClient: widget.apiClient);
}

class CompanyShell extends StatefulWidget {
  const CompanyShell({
    required this.apiClient,
    required this.onSignedOut,
    super.key,
  });
  final ApiClient apiClient;
  final VoidCallback onSignedOut;
  @override
  State<CompanyShell> createState() => _CompanyShellState();
}

class _CompanyShellState extends State<CompanyShell> {
  int index = 0;
  void _openMore() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (_) => _CompanyMoreMenu(
      apiClient: widget.apiClient,
      onSignedOut: widget.onSignedOut,
    ),
  );
  @override
  Widget build(BuildContext context) {
    final pages = [
      CompanyDashboardScreen(apiClient: widget.apiClient),
      CompanyRecordsScreen(
        apiClient: widget.apiClient,
        kind: CompanyRecordKind.invoices,
      ),
      CompanyRecordsScreen(
        apiClient: widget.apiClient,
        kind: CompanyRecordKind.payments,
      ),
      CompanyReportsScreen(apiClient: widget.apiClient),
    ];
    return Scaffold(
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) {
          if (value == 4) {
            _openMore();
          } else {
            setState(() => index = value);
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'الفواتير',
          ),
          NavigationDestination(
            icon: Icon(Icons.payments_outlined),
            selectedIcon: Icon(Icons.payments),
            label: 'السندات',
          ),
          NavigationDestination(
            icon: Icon(Icons.analytics_outlined),
            selectedIcon: Icon(Icons.analytics),
            label: 'التقارير',
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

class _CompanyMoreMenu extends StatelessWidget {
  const _CompanyMoreMenu({required this.apiClient, required this.onSignedOut});
  final ApiClient apiClient;
  final VoidCallback onSignedOut;
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
          ListTile(
            leading: const Icon(Icons.map_outlined),
            title: const Text('تتبع المندوبين'),
            subtitle: const Text('الخريطة الحية وتفاصيل المسار'),
            onTap: () =>
                _push(context, RepTrackingScreen(apiClient: apiClient)),
          ),
          ListTile(
            leading: const Icon(Icons.how_to_reg_outlined),
            title: const Text('حضور المناديب'),
            subtitle: const Text('وقت تسجيل الحضور لكل مندوب'),
            onTap: () =>
                _push(context, RepAttendanceAdminScreen(apiClient: apiClient)),
          ),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text(
              'تسجيل الخروج',
              style: TextStyle(color: Colors.red),
            ),
            onTap: () async {
              Navigator.pop(context);
              await apiClient.sessionStore.clear();
              onSignedOut();
            },
          ),
        ],
      ),
    ),
  );
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
          if (i == 4)
            _openMore();
          else
            setState(() => _index = i);
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
          ListTile(
            leading: const Icon(Icons.payments_outlined),
            title: const Text('سندات القبض'),
            onTap: () => _push(
              context,
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
          ),
          ListTile(
            leading: const Icon(Icons.account_balance_outlined),
            title: const Text('كشوفات حساب العملاء'),
            onTap: () =>
                _push(context, CustomerStatementsScreen(apiClient: apiClient)),
          ),
          ListTile(
            leading: const Icon(Icons.fact_check_outlined),
            title: const Text('الحضور والانصراف'),
            onTap: () => _push(context, AttendanceScreen(apiClient: apiClient)),
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
}
