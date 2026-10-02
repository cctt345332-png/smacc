# App (`app`)

This directory serves as the root configuration layer for the Flutter application. It glues together the various core systems (theming, routing, localization) and features into a unified `MaterialApp`.

## Key Files

### `app.dart`
This file contains the `App` widget, which is the root of the Flutter widget tree. 
It is responsible for:
- Wrapping the application in global state providers (like `ThemeBloc`, `AuthBloc`, etc.).
- Configuring the `MaterialApp.router` with the central router instance.
- Applying global theming and localization delegates.
- Setting up navigation observers (e.g., for analytics tracking).

### `router.dart`
This file defines the application's declarative routing configuration, utilizing `go_router`.
It handles:
- Defining the route hierarchy (using `GoRoute` and `ShellRoute`).
- Route redirection logic (e.g., redirecting unauthenticated users to a login screen, or bypassing the splash screen once the app initializes).
- Parsing URL paths into strongly-typed route objects (using `go_router_builder`).

### `router.g.dart`
This is a generated file created by the `go_router_builder` package. It contains the boilerplate code required to enable strongly-typed routing. 
> [!WARNING]
> **Do not modify `router.g.dart` manually.** If you change route paths or add new routes in `router.dart`, you must regenerate this file.

## Regenerating Routing Code

If you make changes to your `router.dart` file that involve `@TypedGoRoute` annotations, you need to regenerate the `router.g.dart` file. Run the following command from the root of your project:

```bash
fvm dart run build_runner build --delete-conflicting-outputs
```
