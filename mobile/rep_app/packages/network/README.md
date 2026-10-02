# network

`Dio` HTTP client building blocks for the Flutter starter template. Exported
through `package:network/network.dart`.

Because the barrel re-exports `dio`, `retrofit`, and `firebase_performance`,
the app and features get their HTTP types from `network` and never depend
on those packages directly.

## Public API

- `NetworkModule` — provides the configured `Dio` instance (base URL and
  timeouts sourced from `EnvConfig`) with the interceptors attached.
- `RetryInterceptor` — retries transient failures with backoff.
- `PerformanceInterceptor` — records request timing via Firebase Performance.
- `CoreNetworkPackageModule` — the injectable micro-package module the app
  registers via `externalPackageModulesBefore`.
- Re-exports: `package:dio/dio.dart`, `package:retrofit/retrofit.dart`
  (hiding `Headers`/`HttpMethod`), `package:firebase_performance/...`.

## Notes

`NetworkModule` reads `EnvConfig`, so `config` must be registered
**before** `network` in the app's DI composition. Auth concerns (token
attach/refresh interceptors) stay in the auth feature, which adds them to the
`Dio` instance this package provides.
