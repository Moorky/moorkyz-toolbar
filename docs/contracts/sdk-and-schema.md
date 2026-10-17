# Contract-first SDK and schema design

> **Proposal, not a finalized stable API.** Some draft shapes have working implementations; finalize them during milestone M1 and publish machine-readable schemas/types with contract tests. Illustrative identifiers below are deliberately marked **proposed**.

## Public API design principles

1. **Minimum onboarding:** install package; define actions or host context; mount. No account, backend, CLI, or complex project scaffold needed.
2. **One coherent API:** typed declarative configuration + typed imperative controller; stable subpath exports where useful.
3. **Versioned contracts:** semantic versioning, generated docs tied to versions, schema migrations, deprecation guidance, deterministic validation errors.
4. **Boundary-aware behavior:** host permissions for commands/navigation; capability registry never grants authority itself.
5. **Portable inputs:** serializable configuration for Studio/generator, and non-serializable host callbacks registered through typed adapter hooks. Never serialize credentials or executable functions into share links.

## Candidate interface (illustrative)

```ts
// These symbols are DRAFTS: do not treat them as accepted export names.
interface ToolbarFeatureFlags {
  search: boolean; // true
  ai: boolean; // false
  tasks: boolean; // false
  notifications: boolean; // false
  discovery: boolean; // false
  platform: boolean; // true (base platform responsiveness)
  customize: boolean; // true
  spatialCoordination: boolean; // false, independent optional module
  offline: boolean; // false
  diagnostics: boolean; // false
  advancedGestures: boolean; // false
  experimental: boolean; // false
}
interface ToolbarConfiguration {
  schemaVersion: string;
  features?: Partial<ToolbarFeatureFlags>;
  actions?: ReadonlyArray<ActionDescriptor>;
  placement?: PlacementConfig; // bottom/viewport default
  theme?: ThemeReference;
  host?: HostIntegration; // callbacks/permissions, never serialized
}
interface ToolbarController {
  mount(target?: HTMLElement): Result<void>;
  update(patch: Partial<ToolbarConfiguration>): Result<void>;
  dispose(): void;
  // registerCapability, executeCommand, openSurface etc. to be specified
}
```

This is a **design seed**, not a claim that these interfaces are ready to compile. Real contract definition must settle sync/async lifecycle return semantics; permission vocabulary; typed generic context; cancellation; lifecycle ownership; error codes; namespaced action identifiers; host adapter boundaries; browser/SSR behavior and schema validation.

## Define before production implementations

| Contract               | Consumer / producer          | Conditions for approval                                                      |
| ---------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Config schema          | Host, CLI, Studio, generator | Version, defaults, canonical normalization, unknown-key policy               |
| Controller lifecycle   | Host -> core                 | SSR-safe import, idempotent mount/dispose, instance isolation                |
| Capability registry    | Extensions -> host/core      | Ownership, transactions, policy checks, namespace collision rules            |
| Context selector       | Host -> core                 | Typed hierarchical scopes, stale event invalidation, interaction-stability   |
| Command schema         | Host/controller/extensions   | Concurrency, cancellation, timeouts, retries off unless safe and explicit    |
| Navigation adapter     | Core -> host                 | Route ownership, URL validation, optional authenticated handoff              |
| Surface/focus contract | Core -> renderers            | Accessibility state, stack bounds, dismissal policy, error cleanup           |
| Input/gesture contract | Host + core + extensions     | Shortcut arbitration, touch/pointer intent, reserved browser interactions    |
| Mount/placement schema | Renderer/host                | viewport/container/fullscreen modes, safe areas, optional exclusion registry |
| Persistence schema     | User preferences             | Namespaced keys, version migrations, consent, storage fallback               |
| Extension manifest     | Extension author -> registry | trust level, optional imports, capability grants, cleanup, validation        |
| Theme/token schema     | Theme Studio + renderer      | accessible contrast, safe CSS values, portable versioned files               |
| Generator manifest     | Studio/CLI -> consumer       | compatible SDK/framework/template versions, checksums where appropriate      |
| Diagnostic codes       | SDK/CLI/Studio               | stable code, severity, remediation, safe redaction, no default telemetry     |

## Generated project contract

The generator emits a versioned local manifest with generator/template/config-schema/SDK versions, selected feature flags, source origin and migration metadata. The manifest must **not** claim that user-modified files can be safely overwritten. Upgrade assistance defaults to a dry-run/change preview and requires explicit consent to write changes. Do not embed secrets, user data, or authentication tokens.

## CLI contract

Optional Node binary exposed from the **same package**. Proposed commands: `init`, `add`, `validate`, `doctor`, `upgrade`, `examples`, `help`, `version`. `--dry-run`, non-interactive flags, structured output and correct exit codes are required where applicable. CLI modules must not be imported into browser entry points. Avoid silently modifying pre-existing files. Exact commands and flags are formalized via golden tests and docs.

## Compatibility and experimental policy

Stable SDK follows SemVer with documented migrations and deprecations. Explicit experimental namespace or subpath is optional, unmistakably labeled, tested and version-policy documented, and cannot bypass core security/accessibility checks. Never silently promote experimental behavior into stable defaults.

## M1 implemented draft

The workspace now contains an **implemented but unapproved draft** of the first configuration contract in `packages/toolbar/src/index.ts`, including a machine-readable JSON Schema. It is not a stable public API and may change before explicit contract approval. Validator key sets are derived from that schema object so the runtime validator and Studio/CLI consumers can share the same source.

- Schema version is `1.0`; omitted version normalizes to `1.0`, and unsupported versions fail validation.
- Feature defaults follow the approved baseline: `search`, `platform`, and `customize` are enabled; AI, tasks, notifications, discovery, spatial coordination, offline, diagnostics, advanced gestures, and experimental integrations are disabled.
- Unknown properties, non-boolean feature values, invalid render modes, malformed/duplicate action IDs, empty labels, prototype-bearing objects, and accessor properties produce stable diagnostic codes and paths.
- Action descriptors are data-only (`id`, `label`); host behavior and authorization callbacks are not serializable configuration.
- Validation normalizes defaults and returns immutable result data. Importing the contract module has no browser-global access or runtime side effects.
- Vanilla and React consumer fixtures compile against the package; the React example exercises the framework-neutral controller through an effect-owned mount/dispose lifecycle. CLI/Studio schema consumption, dedicated framework adapters, and approved public names are not yet implemented.
- The initial DOM controller now mounts to a host-owned element, uses Shadow DOM by default (Light DOM is opt-in), renders only text nodes and native buttons, dispatches actions only through a host callback, and provides manual collapse/restore, scoped keyboard navigation, atomic partial updates, and disposal. Update patches merge feature overrides and replace action lists only when supplied. Its stylesheet is a same-package asset (no inline styles or external URL).

See [`packages/toolbar/test/configuration.test.js`](../../packages/toolbar/test/configuration.test.js) for executable boundary tests. Feature-key names and diagnostics remain proposals until contract review; approved feature semantics and defaults may not be changed.

## M3 implemented drafts

The package now includes draft, framework-neutral primitives for the approved capability/context/command architecture:

- `createCapabilityRegistry()` commits each registration/removal transaction atomically, uses `namespace:name` identities and owner checks, and denies cross-owner replacement unless a host-provided authorization callback explicitly approves it.
- `createContextResolver(defaults)` resolves root-to-leaf scopes into versioned snapshots with a frozen top-level value. Scope IDs are namespaced, parent changes reject cycles, and context data rejects accessors and prototype-bearing objects. Context is descriptive only; it never grants command permission.
- `createCommandExecutor(policy)` returns typed handles with `parallel`, `single-flight`, `drop`, `replace`, and `queue` concurrency modes, required runtime input validators, optional timeouts, cooperative cancellation, host permission checks and active/queued-command cancellation on permission revocation. Permissioned commands fail closed when no host authorization policy is configured. Retries are not implemented.
- `createSurfaceStack()` maintains a bounded, nested surface order; only the top surface can close, dismissible policy is enforced for escape/outside/trigger dismissal, and close results carry the host's focus-restoration target. It does not install global listeners or move focus itself.

These are candidate API names and semantics, not approved stable exports. The initial dock's action callback remains the host-owned navigation boundary; the core accepts action identifiers, not arbitrary URLs, and does not route or authorize by itself. Dedicated router adapters, full DOM focus orchestration, extension registration adapters and richer command policy schemas remain incomplete. The vanilla consumer fixture compile-checks these M3 APIs.

Executable draft coverage is in [`capabilities.test.js`](../../packages/toolbar/test/capabilities.test.js), [`context.test.js`](../../packages/toolbar/test/context.test.js), [`commands.test.js`](../../packages/toolbar/test/commands.test.js), and [`surfaces.test.js`](../../packages/toolbar/test/surfaces.test.js).

## M4 implemented draft

The configuration now accepts `placement.mode` values `viewport` (default), `container`, and `fullscreen`, with a fixed `bottom` anchor. Container/fullscreen mounting stays inside the host-selected target; the SDK does not change host layout or invoke the Fullscreen API. The host must provide a positioned container; for fullscreen mode the mount target should be the host's fullscreen root. Narrow action rows keep native scrolling and show direction-aware labeled start/end controls plus fades only while content overflows. A mounted instance observes its action row for size changes and releases its observer/resize fallback and scroll listener on update/disposal. Reduced-motion preferences disable nonessential transitions and smooth scrolling.

`createShortcutManager(target, policy)` provides opt-in, root-scoped keyboard shortcuts. The host authorizes registrations and each dispatch; reserved browser/OS combinations, unmodified keys, editable fields, and already-prevented events are left alone. Equal-scope/priority collisions emit a diagnostic instead of selecting a registration by order. The key listener is installed only while registrations exist and is removed after the last unregister or disposal.

The placement names and exact composition are still proposed. Spatial coordination remains independently disabled and no page scanning or host-padding mutation is performed. Advanced pointer/touch gestures and numeric performance budgets remain open.

## M5 implemented draft

The current M5 slice exposes six built-in theme names and token validation in `packages/toolbar/src/themes.ts`. Foreground/background contrast is checked at 4.5:1 and focus/background at 3:1; the controller applies the built-in palettes in its local stylesheet and the portal browser tests exercise each theme. The customization control provides explicit theme/color-scheme cycling and earlier/later action reordering. While edit mode is active, action buttons do not dispatch host commands. Host settings surfaces can call `updateUserPreferences()` with a complete value.

`createToolbarPreferenceStore(namespace, adapter?)` stores schema version 1 values under a validated application namespace. It migrates the legacy version 0 light/dark theme representation, validates stored and caller-provided data without invoking accessors, retains corrupt storage as evidence, and reports read/write/migration diagnostics while retaining in-memory choices. `createBrowserPreferenceStorage(window)` is an explicit adapter; importing or constructing the toolbar never reads `window.localStorage`. If no adapter is supplied, user choices work for the controller instance but are reported as session-only. When `features.customize` is false, mounting does not read preferences, manual collapse/restore does not write preferences, and the customization control/API are disabled.

Manual collapse state is persisted when customization and an adapter are enabled, then restored as collapsed; the toolbar never auto-expands. Preference records contain no callbacks or action labels, only theme, color scheme, collapse state, and action identifiers. These exports and schema remain draft, not approved stable API. A portable custom-theme file format and the complete Theme Design Studio remain future work.

## M6 Task Center implemented draft

`features.tasks` remains false by default. When explicitly enabled, the toolbar displays a Task Center panel that accepts host-fed snapshots through `ToolbarController.updateTasks(snapshot)`. The toolbar does not start or execute tasks and does not subscribe, poll, fetch, retry, or persist task state; the host owns execution, authorization, and freshness. Snapshots are limited to 100 plain data records with unique bounded IDs, non-empty labels, and one of `queued`, `running`, `completed`, or `failed`. Unknown keys, accessors, sparse entries, duplicate IDs, malformed values, and oversized snapshots fail with structured `taskDiagnostics`. Labels are rendered as text.

Disabling the flag removes the feature UI and clears its in-memory snapshot; disposal also releases the snapshot. While disabled, `updateTasks()` returns `TASKS_DISABLED` before inspecting the supplied value. The runtime UI and browser accessibility checks are covered by the toolbar tests. This is a display-only M6 slice; task actions, progress controls, host event adapters, and broader lifecycle reconciliation are not implemented.

## M6 federated search coordinator draft

`createFederatedSearchCoordinator(providers, policy)` is a headless, explicit host adapter. It requires an `isEnabled()` gate and a per-provider `authorize(providerId, query)` callback; neither is inferred from toolbar configuration. When disabled, no provider authorization, provider declaration inspection, or search callback runs. Provider declarations are validated and snapshotted lazily on the first enabled query; providers are namespaced, unique, bounded to 16, and queried only after host authorization. Search input is trimmed and limited to 256 characters; each provider may return at most 20 records with unique IDs, plain-text titles (160 characters max), and optional summaries (500 characters max). Coordinator output preserves provider/result order, adds the source provider ID, and returns provider failures/denials/invalid records as structured diagnostics alongside successful partial results. Results contain no URLs or executable callbacks.

The caller supplies an `AbortSignal`; providers must cooperate with cancellation. The library has no built-in endpoint, cache, telemetry, or network call, and it does not navigate selected results. Host code owns provider data access, freshness, permission policy, and host-command mapping. When `features.search` is enabled, the controller presents an accessible, user-opened search panel that locally matches action labels/IDs and optionally invokes the host coordinator on explicit submission. Provider selections route only through the host callback. Closing, disabling, or disposing clears displayed query/results and cancels outstanding provider work; search data is never persisted. AI remains a headless adapter with no built-in interaction surface.

## M6 host-authorized AI adapter draft

`createHostAuthorizedAIAdapter(provider, policy)` requires an explicit provider, an `isEnabled()` gate, a host authorization callback, and an `AbortSignal` for each completion. The feature gate is evaluated before authorization or provider execution; authorization is evaluated for each request. The `ai` feature default remains false. When explicitly enabled, the controller shows a user-opened prompt panel; opening it does not invoke the provider. Prompt input is trimmed and limited to 8,000 characters; provider responses must be plain text, non-empty, and no more than 20,000 characters. Provider failures, cancellation, invalid data, disabled state, and denial return structured diagnostics. Providers must cooperatively honor cancellation. Closing the panel, disabling AI, or disposing the controller aborts in-flight work and clears prompt/response text.

The adapter does not select or augment prompts with host context, persist prompts/responses, retry, log usage, or contact a default AI service. Output is inserted as text, not HTML. Host code owns provider/network choice, authorization, sensitive-data handling, and any broader context policy.

## M6 quiet notification presentation draft

`features.notifications` remains false by default. When enabled, the host pushes a bounded snapshot through `ToolbarController.updateNotifications()`. Entries contain a unique ID, non-empty title (120 characters max), message (up to 500 characters; it may be empty), severity (`info`, `success`, `warning`, `error`), and host-owned `unread` state; at most 50 entries are accepted. Accessors, unknown keys, duplicate IDs, oversized text, sparse arrays, and invalid severity/state fail with structured `notificationDiagnostics`. Text is rendered with text nodes only.

New or changed snapshots do not open the notification panel, create toasts, announce content while closed, expand the dock, or mutate unread state. The user must activate the Notifications control to inspect entries. Disabling the feature clears its in-memory snapshot and UI; disposal also clears it. Notifications are not persisted, and the host remains authoritative for read state, freshness, and any corresponding actions. This presentation slice implements the non-intrusive Q26 behavior but not a notification delivery service or attention prioritizer.

## M6 opt-in local diagnostics recorder draft

`createLocalDiagnosticsRecorder({ redact, capacity? })` starts disabled and has no storage, timer, listener, network, or telemetry integration. The host explicitly enables it from its current `features.diagnostics` policy and must provide a redaction function. `record()` returns `DIAGNOSTICS_DISABLED` before inspecting input while off. Accepted records contain only a bounded uppercase diagnostic code, severity, and redacted message (500 characters max); causes, timestamps, arbitrary details, and prompts are not retained. Capacity defaults to 50 and cannot exceed 100. Disabling or disposing clears the in-memory buffer.

This is a local recorder primitive, not the developer Inspector UI. The host is responsible for selecting safe diagnostic messages, rendering the snapshot in a dev-only surface, and avoiding exposure in production. No remote reporting is implemented.

## M6 host-coordinated lifecycle draft

`createLifecycleCoordinator(document, callbacks)` is explicit and instance-scoped. It observes `visibilitychange`, `pagehide`, and `pageshow`, transitions between `active` and `suspended` only when effective visibility changes, exposes the current state, supports host-triggered `reconcile()`, and removes all listeners on `dispose()`. A document not currently `visible` initializes in `suspended` state without invoking a callback; the host can inspect the state and reconcile. Callback exceptions propagate to the event caller after the new state is set; handlers should therefore be idempotent.

The coordinator only signals host callbacks. It does not pause or cancel host-owned commands, install automatically from `createToolbar()`, or decide what work is essential. Hosts own selective suspension, authorization, and BFCache reconciliation policy.

## M6 opt-in pointer gesture draft

`createGestureManager(element, { enabled, onGesture })` attaches pointer listeners only for an explicitly enabled manager and only to the supplied element. The built-in controller creates this manager only when `features.advancedGestures` is true and the host provides `onGesture`; disabling the flag or disposing the controller removes the listeners. It recognizes touch/pen horizontal swipes after a 64px minimum and 1.5:1 horizontal dominance, ignores starts within 24px of viewport edges, mouse pointers, interactive/editable targets, cancelled pointers, and pre-prevented events, and never calls `preventDefault()` or changes `touch-action`. Disabling/disposal removes all four listeners and clears the active pointer. The callback receives only direction, pointer type, and distance; no event, coordinates, velocity, or user history is retained.

This helper reports intent only. Host code owns action mapping and must provide accessible keyboard/button alternatives. It does not call toolbar commands, alter focus, or attach global handlers.

## M6 cooperative spatial placement draft

`createSpatialCoordinator(enabled = false)` accepts explicit, host-provided exclusion rectangles only. When disabled, registration and resolution return `SPATIAL_DISABLED` before inspecting input; disabling clears registered zones. When enabled, the coordinator accepts at most 64 uniquely identified zones, validates finite bounded coordinates, and resolves a dock rectangle against the host-provided viewport, safe-area insets, and dock size. It tries the preferred anchor first, then a deterministic candidate order (`bottom-center`, `bottom-start`, `bottom-end`, `top-center`, `top-start`, `top-end`), avoiding registered rectangles with an 8px collision gap. No safe placement returns a structured result; the coordinator never hides or collapses the toolbar.

The mounted toolbar integration is gated by `features.spatialCoordination` (false by default). `ToolbarController.updateSpatialZones(snapshot)` accepts an atomic array of at most 64 explicit host zones. When the array is non-empty, the host must supply `getSpatialViewport()`, returning dimensions and safe-area insets in the same coordinate space as the zones. Safe-area insets must match the dock's CSS safe inset (`max(0.75rem, env(safe-area-inset-*, 0px))`); represent additional reserved margins as exclusion zones. The controller reads only its own dock dimensions, resolves placement, and applies one of six supported anchors through scoped CSS data attributes. It never scans the page, mutates host padding, or moves the dock when no safe candidate exists; that condition is exposed as a structured warning and `data-spatial-conflict`. Resize listeners exist only while the feature is enabled and zones are registered, and are removed on zone removal, feature disable, or disposal. Hosts own zone freshness and matching viewport coordinate spaces.

## M6 host-fed offline status draft

The existing `features.offline` flag remains false by default. When explicitly enabled, `ToolbarController.updateConnectivityStatus(status)` accepts only `unknown`, `online`, or `offline` from the host and shows a small static status label. It does not query browser connectivity APIs, install listeners, poll, queue work, retry, cache, persist, or automatically restore a collapsed toolbar. Disabling the feature clears the status and removes the label. Offline queue/retry remains blocked by open validation V09 pending host idempotency, authorization, and storage-retention decisions.

## M6 skippable discovery hints draft

`features.discovery` remains false by default. With it enabled, the host supplies at most 10 plain-text hints through `ToolbarController.updateDiscoveryHints()`. Each hint has a unique bounded ID, non-empty title (100 characters max), and message (400 characters max). Invalid records, accessors, unknown properties, sparse entries, and duplicates return structured `discoveryDiagnostics`. The controller adds a Tips button and a labeled panel but never opens it on its own; updates do not expand the dock, mutate completion state, persist hints, or infer user behavior. Disabling discovery removes its panel and clears its in-memory snapshot; disposal does the same.

## Schema validation gate

Schema definitions must be the shared source for typed validation, Studio controls, CLI validation, generator, reference docs and representative consumer fixtures. The code generator must not independently invent a second config interpretation.
