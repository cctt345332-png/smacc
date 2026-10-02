# app_ui

The design system for the Flutter starter template — generic, app-agnostic
visual building blocks exported through `package:app_ui/app_ui.dart`.

Contents (`lib/src/`):

- `theme/` — Material 3 theming and design tokens (spacing, radii, sizes, motion durations).
- `widgets/` — reusable generic widgets (`AppButton`, `AppScaffold`, `AppAdaptiveScaffold`, `AppNetworkImage`, …).
- `layout/` — responsive primitives such as `AppBreakpoints`.
- `animation/` — animation helpers.
- `extensions/` — UI-related `BuildContext`/widget extensions.

These widgets carry **no business meaning**. Keep app services, DI, analytics,
session state, platform integrations, and feature-specific widgets out of this
package — those belong in the root app or the relevant workspace package.
