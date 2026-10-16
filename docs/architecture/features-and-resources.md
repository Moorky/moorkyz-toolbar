# Feature flags, runtime resources and recovery

## Canonical approved defaults
Feature configuration is developer-controlled, with safe built-in defaults. Existing approved baseline:

```json
{
  "features": {
    "search": true,
    "ai": false,
    "tasks": false,
    "notifications": false,
    "discovery": false,
    "platform": true,
    "customize": true
  }
}
```

Additional **approved behavior**, with proposed names: `spatialCoordination: false`, `offline: false`, `diagnostics: false`, `advancedGestures: false`, `experimental: false`. Key names require confirmation with the M1 schema; behavior and default-disabled status do not.

### Mandatory vs optional
Always enforced: accessibility fundamentals, keyboard operability, permissions, safe navigation/content handling, deterministic core state, lifecycle cleanup, basic responsive positioning/safe areas, reduced-motion support, secure error handling. These must never be controlled by convenience flags.

Optional: search activation, AI adapters, tasks, notifications, discovery, optional platform integrations, advanced gestures, user customization UI, deep diagnostics/Inspector, offline queue, spatial host coordination, experimental SDK integration. Note: selecting a **preset does not override these flags**.

## Disabled-feature invariant
A disabled optional module must create **zero module-specific** timers, network requests, observers, subscriptions, feature DOM, long-running computations or user-state writes. Its resources are fully disposed when disabled at runtime. Baseline core listeners remain when essential for active core behavior.

**Bundle-cost distinction:** a runtime false flag prevents initialization; only static imports/subpath exports/dynamic boundaries plus consumer bundler behavior can exclude code from distribution. Tests must verify both execution and representative consumer build size. Runtime enabling a feature not shipped in the bundle requires an explicit supported lazy loader; do not imply magic runtime code downloads.

## Lifecycle and allocation policy
- Mount creates a per-instance resource scope. Disposal cancels owned transitions, listeners, subscriptions, observers and active mount resources.
- Page-hidden: suspend nonessential UI work; host-owned commands continue only as their declared policy allows. BFCache restore and visibility resumption reconcile safely.
- Context change: latest valid context may replace stale presentation; commands retain their own concurrency semantics; permissions revocations act immediately.
- Manual collapse is sticky and must not be undone by signals, notifications, focus changes, or reconnection.
- Extension failure: contain at supported boundaries; repeated failures trigger circuit breaking; critical authorization failure denies action.

## Offline integration (independently opt-in)
No default service worker, data cache, queue or connectivity polling. With explicit offline capability, host can provide connectivity hints, approved cache adapters and retry/queue policies. Retry only designated safe/idempotent commands within bounded limits and current authorization; never replay payments/deletions/publish operations by default. Persisted queues require explicit host storage/data-retention contracts.

## Spatial integration (independently opt-in)
**`spatialCoordination` off by default.** When enabled, host registers exclusion zones and may opt into content offsets; bounded placement avoids disruptive movement and loops. When off, no feature-specific observers/registrations execute. Basic viewport/container mounting, safe areas, manual collapse and accessibility still work. The toolbar does not scan arbitrary page DOM or force host root padding.

## No usage learning and no default telemetry
No collection of behavioral profiles, recommendation learning, or usage-derived automatic customization. Developer-owned local diagnostics only when enabled, with redaction and no remote reporting by default. Shareable config links never leak secrets or sensitive host state.
