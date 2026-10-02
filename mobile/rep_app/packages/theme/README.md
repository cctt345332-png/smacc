# theme

Theme state management (mode + color scheme) for the Flutter starter template.
Exported through `package:theme/theme.dart`.

The barrel re-exports `flex_color_scheme`, so the app builds its themes from
this package's types.

## Public API

- `ThemeBloc` — manages the active `ThemeMode` and color scheme, persisting the
  user's choice to `SharedPreferences` and restoring it on launch.
- `ThemeState` — the persisted theme state.
- `CoreThemePackageModule` — the injectable micro-package module the app
  registers via `externalPackageModulesBefore`.

## Notes

`ThemeBloc` is a separate package from `app_ui` on purpose: keeping it here
avoids dragging `flutter_bloc`, `injectable`, and `shared_preferences` into the
pure design-system package. The theme *data* (`app_theme.dart`) still lives in
`app_ui`.

`ThemeBloc` depends on `AnalyticsService` and reads the `SharedPreferences`
provided by `storage`, so in the app's DI composition `theme` is
registered **after** both `analytics` and `storage`.
