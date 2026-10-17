# `@moorkyz/toolbar`

**Pre-release implementation draft.** The configuration and controller names in this package are not yet an approved stable public contract. The library and portal are under active development; this package has not been published.

The root entry is framework-neutral, imports without browser globals, and has no production runtime dependencies. Framework adapters are optional subpaths with peer dependencies scoped to those entries.

## Workspace use

Build the package from the repository root:

```sh
pnpm --filter @moorkyz/toolbar build
```

The workspace fixtures in `examples/vanilla-consumer`, `examples/react-consumer`,
`examples/vue-consumer` and `examples/angular-consumer` show typed usage. The
Next.js portal exercises the React entry point. Adapter fixtures are not
automatically promises of generated framework starters.

## Additional optional draft entry points

These additions remain pre-release contracts and do not change feature defaults:

| Entry                              | Purpose                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@moorkyz/toolbar/vue`             | `useToolbar()` owns Vue mount/update/unmount; Vue is an optional peer.                                                                                                                                                    |
| `@moorkyz/toolbar/angular`         | `injectToolbar()` owns Angular render/update/destruction; Angular is an optional peer.                                                                                                                                    |
| `@moorkyz/toolbar/extensions`      | Explicitly enabled, host-authorized trusted registry with scoped actions, revocation, cleanup and bounded fault containment. Same-realm code is not sandboxed.                                                            |
| `@moorkyz/toolbar/experimental`    | Explicit experimental namespace, disabled by default; no permission bypass.                                                                                                                                               |
| `@moorkyz/toolbar/inspector`       | Explicitly mounted static snapshots from an already-redacted local diagnostics recorder; no polling or telemetry.                                                                                                         |
| `@moorkyz/toolbar/recovery`        | Disabled-by-default, in-memory safe/idempotent job admission and explicit host-confirmed draining; authorization each attempt, bounded retries, cancellation and circuit breaker. No persisted queue or automatic replay. |
| `@moorkyz/toolbar/gesture-profile` | Explicitly enabled gesture-to-host-action mapping with current authorization; keyboard/button alternatives remain required.                                                                                               |
| `@moorkyz/toolbar/generator`       | Local, manifest-driven Vanilla starter source generation with shared configuration validation. No install, network or source execution.                                                                                   |

The package also contains the optional Node-only `moorkyz-toolbar` consumer
binary (`help`, `version`, `examples`, `init`, `add`, `validate`, `doctor`,
`upgrade`). It never enters a browser entry point. Use `--dry-run` to preview
creation; upgrades preview by default and require `--apply`. Existing
destinations, symlinks and edited generated files are not silently overwritten.
`add` creates an isolated child starter rather than rewriting a host project.
The CLI is tested on Node 22.18.0; it does not install dependencies for you.

Mounted controllers expose optional `onSuspend`/`onResume` host lifecycle
notifications; local search/AI presentation is cancelled on suspension without
restoring a collapsed dock or replaying host commands. Custom token files use
`validateThemeFile()`. Applying validated tokens through
`controller.updateThemeTokens()` requires a host-authorized `styleNonce` for its
existing CSP; passing `null` removes the scoped override. The package never
loosens that policy.

## Mount a toolbar

```ts
import { createToolbar } from "@moorkyz/toolbar";

const hostRouter = {
  navigate(actionId: string) {
    window.location.hash = actionId;
  },
};

const toolbar = createToolbar(
  {
    actions: [
      { id: "home", label: "Home" },
      { id: "projects", label: "Projects" },
    ],
  },
  {
    dispatchAction(actionId) {
      // Route or execute only through host-owned application code.
      hostRouter.navigate(actionId);
    },
  },
);

const mounted = toolbar.mount(document.body);
if (!mounted.ok) {
  throw new Error(mounted.error.message);
}

// On host teardown:
toolbar.dispose();
```

Mounting defaults to Shadow DOM; set `renderMode: "light"` to opt into scoped class-based Light DOM styling. The controller loads only its same-package CSS asset when mounted, writes labels using text nodes, and never performs network requests to remote services. Actions are disabled unless the host provides `dispatchAction`; navigation and authorization remain host-owned.

`update()` applies a validated partial patch; supplied action lists replace the existing list, while supplied feature flags merge with existing flags. Omitted fields are preserved. A mounted instance cannot switch between Shadow and Light DOM; create a new controller to change modes. Collapse is explicit and does not auto-restore.

Placement defaults to the viewport bottom. `placement: { mode: "container" }` positions relative to the host-provided positioned mount container; `mode: "fullscreen"` positions inside the host's fullscreen root, which the host enters and exits through the Fullscreen API. Narrow action rows retain native horizontal scrolling and expose labeled start/end scroll buttons only when content overflows.

## React adapter

Importing the root package does not load React. React applications can opt into the separate `@moorkyz/toolbar/react` entry point, which requires React 18 or newer as an optional peer:

```tsx
import { useMemo } from "react";
import { ToolbarMount } from "@moorkyz/toolbar/react";

function App({ dispatchAction }: { dispatchAction: (id: string) => void }) {
  const configuration = useMemo(
    () => ({ actions: [{ id: "home", label: "Home" }] }),
    [],
  );
  const host = useMemo(() => ({ dispatchAction }), [dispatchAction]);
  return <ToolbarMount configuration={configuration} host={host} />;
}
```

The adapter owns mount/dispose through an effect and renders an empty mount target during server rendering. It can expose the controller with `onController` and report a structured mount error with `onMountError`; without an error callback, mount failures throw from the effect. Changing the identity of `configuration`, `host`, or either callback recreates the controller, so memoize stable values.

A manually collapsed dock remains collapsed across those ownership replacements.
Only explicit expansion restores it; changing theme, callbacks, host or isolation
mode does not implicitly expand the toolbar. The replacement still disposes the
old controller and notifies its owner with `null` before delivering the new one.

## Themes and local preferences

The built-in customization control lets users choose a theme and color scheme and reorder actions with labeled earlier/later buttons. Actions are not dispatched while edit mode is active. `features: { customize: false }` hides customization and prevents preference-store reads and writes. The controller also exposes `updateUserPreferences()` for host settings UIs; it accepts a complete preference value.

Persistence is explicit and application-scoped; the library never accesses browser storage by default:

```ts
import {
  createBrowserPreferenceStorage,
  createToolbarPreferenceStore,
  createToolbar,
} from "@moorkyz/toolbar";

const configuration = {
  actions: [{ id: "home", label: "Home" }],
};
const preferenceStore = createToolbarPreferenceStore(
  "my-application",
  createBrowserPreferenceStorage(window),
);
const toolbar = createToolbar(configuration, {
  dispatchAction(actionId) {
    // Delegate only to the host application's own router/command policy.
    console.info("Host action:", actionId);
  },
  preferenceStore,
  onPreferenceError(diagnostic) {
    // Report locally; diagnostics are never sent to a remote service.
    console.warn(diagnostic.code, diagnostic.message);
  },
});
```

Create the browser adapter only in a browser-owned lifecycle. Storage failures, invalid data, and migration problems are reported through `onPreferenceError` and an accessible toolbar alert; valid choices remain active in memory. Without a host adapter, customization is session-only and the controller reports that persistence is unavailable. Stored preferences use a versioned application namespace and never contain host callbacks or action data beyond their identifiers.

## Host-owned Task Center

The Task Center is optional and defaults off. Enable `features.tasks` and send validated status snapshots with `updateTasks()`; the toolbar only displays task ID, label, and status. It never starts, polls, retries, or executes task work. At most 100 plain data items are accepted, labels are rendered as text, and invalid snapshots return structured task diagnostics. Disabling the flag removes the task UI and clears the in-memory snapshot; disposal also clears it.

```ts
const toolbar = createToolbar({ features: { tasks: true } });
toolbar.mount(document.body);

const result = toolbar.updateTasks([
  { id: "build", label: "Build project", status: "running" },
]);
if (!result.ok) {
  console.error(result.error.taskDiagnostics);
}
```

The host remains responsible for task execution, authorization, freshness, and deciding when to publish a snapshot. With `features.tasks: false`, the controller does not validate or retain task data and creates no Task Center DOM.

## Federated search providers

`createFederatedSearchCoordinator()` queries only the host-provided providers when called. Its required feature gate and per-provider authorization policy fail closed; provider declarations are not inspected until the first enabled query. The library has no built-in search endpoint, cache, or network request. Providers receive the normalized query and an `AbortSignal`, return bounded plain-text records, and remain responsible for cooperative cancellation and data access.

```ts
import { createFederatedSearchCoordinator } from "@moorkyz/toolbar";

const search = createFederatedSearchCoordinator(
  [
    {
      id: "portal:docs",
      async search(query, signal) {
        return docsIndex.search(query, { signal });
      },
    },
  ],
  {
    isEnabled: () => currentFeatures.search,
    authorize: (providerId, query) => hostPolicy.canSearch(providerId, query),
  },
);

const controller = new AbortController();
const outcome = await search.search("keyboard shortcuts", controller.signal);
```

The coordinator preserves provider order, returns partial results with per-provider diagnostics, and exposes result IDs/text only—no navigable URLs or executable callbacks. The host decides how a selected result maps to its own commands. Query/result caps are documented in the draft contract.

When `features.search` is enabled (the current default), the toolbar provides a keyboard-accessible, user-opened Search panel. It locally matches configured action labels/IDs and uses an optional host `searchCoordinator` only after query submission. Provider results are selectable only through the host's `onSearchResult` callback. Closing the panel, disabling search, or disposing the toolbar aborts in-flight work and clears the displayed query/results; search state is never persisted.

## Opt-in pointer gestures

`createGestureManager()` is disabled unless the host explicitly enables it. It recognizes only touch/pen horizontal swipes on the caller-provided element, ignores browser-edge starts and interactive controls, never calls `preventDefault()`, and removes its four scoped pointer listeners when disabled or disposed. The manager reports a bounded direction/distance intent; the host decides what it means and must retain keyboard/pointer alternatives.

```ts
import { createGestureManager } from "@moorkyz/toolbar";

const gestures = createGestureManager(toolbarHostElement, {
  enabled: currentFeatures.advancedGestures,
  onGesture(intent) {
    hostGesturePolicy.handle(intent);
  },
});
```

It does not change `touch-action`, attach global listeners, move focus, or perform toolbar commands itself.

For the built-in dock, set `features.advancedGestures: true` and provide the host's `onGesture` callback; the controller creates and disposes the scoped manager with the toolbar lifecycle. The flag remains false by default. Every mapped action must still have a keyboard/button alternative.

## Host-coordinated spatial placement

Spatial coordination is opt-in. `createSpatialCoordinator()` starts disabled and accepts only explicit host-provided exclusion rectangles; it never scans the page, observes geometry, inserts DOM, or changes host padding. When enabled, it returns a deterministic safe anchor/rectangle for the host to apply through its own placement policy.

```ts
import { createSpatialCoordinator } from "@moorkyz/toolbar";

const spatial = createSpatialCoordinator(currentFeatures.spatialCoordination);
spatial.registerZone({
  id: "app:virtual-keyboard",
  x: 0,
  y: window.innerHeight - keyboardHeight,
  width: window.innerWidth,
  height: keyboardHeight,
});
const placement = spatial.resolve(
  { width: window.innerWidth, height: window.innerHeight },
  { width: 360, height: 72 },
  "bottom-center",
);
```

For a mounted toolbar, enable `features.spatialCoordination` and provide `getSpatialViewport()` in the host. The host-supplied zone and viewport coordinate spaces must match, and safe-area values must match the dock's CSS safe insets; represent additional reserved margins as exclusion zones. Refresh zones when their geometry changes. The controller measures only its own dock, applies one of the six supported anchors through scoped CSS attributes, and listens for viewport resize only while enabled with at least one zone. It never scans the page, mutates host padding, or moves the dock when no safe candidate exists; it returns a structured warning and calls `onSpatialError`. Disabling coordination clears zones, placement state, and resize listeners.

```ts
const toolbar = createToolbar(
  { features: { spatialCoordination: true } },
  {
    getSpatialViewport: () => hostLayout.getViewportFrame(),
    onSpatialError(error) {
      reportLayoutConflict(error.code);
    },
  },
);
toolbar.mount(target);
toolbar.updateSpatialZones(hostExclusionZones);
```

## Host-fed offline status

The offline flag remains false by default. This slice only displays a host-supplied connectivity hint; it does not read `navigator.onLine`, listen for connectivity events, poll, queue commands, retry, or persist data. When enabled, call `updateConnectivityStatus("online" | "offline" | "unknown")`. Disabling the flag removes the status display and resets its state.

Queueing and retrying commands remain blocked pending the host idempotency, authorization, and storage-retention validation recorded in `docs/engineering/open-validations.md` (V09).

## Host-authorized AI adapter

AI remains disabled by default. `createHostAuthorizedAIAdapter()` requires a host-supplied provider plus an explicit feature gate and authorization callback; the library has no bundled model, remote endpoint, automatic retry, cache, or telemetry.

```ts
import { createHostAuthorizedAIAdapter } from "@moorkyz/toolbar";

const ai = createHostAuthorizedAIAdapter(hostAIProvider, {
  isEnabled: () => currentFeatures.ai,
  authorize: () => hostPolicy.canUseAI(),
});
const controller = new AbortController();
const outcome = await ai.complete(userPrompt, controller.signal);
```

When `features.ai` is explicitly enabled, the toolbar exposes a user-opened AI panel. It does not call the provider when the panel opens: the user must submit a prompt. The provider receives only that prompt and signal, must honor cancellation cooperatively, and must return bounded plain text. Closing the panel, disabling AI, or disposing the toolbar aborts work and clears the prompt/response. The host owns context selection, data handling, provider/network policy, and safe text presentation.

## Quiet notification center

Notifications are disabled by default. When enabled, the host supplies snapshots through `updateNotifications()`. The dock shows an unread count but never opens a panel, displays a toast, changes collapse state, or marks items read on its own; the user opens the panel, while the host remains authoritative for notification state. Items are text-only and are cleared when the feature is disabled or the toolbar is disposed.

```ts
toolbar.update({ features: { notifications: true } });
toolbar.updateNotifications([
  {
    id: "sync-recovered",
    title: "Sync restored",
    message: "Your changes are syncing again.",
    severity: "success",
    unread: true,
  },
]);
```

The notification list is neither persisted nor automatically announced while closed. With `features.notifications: false`, incoming values are not inspected and no notification UI is created.

## Skippable discovery hints

Discovery is disabled by default. When enabled, the host may provide a bounded list of hints with `updateDiscoveryHints()`. The Tips panel opens only when the user activates it; updating hints never opens the panel, expands a collapsed dock, records completion, or learns from usage. Hints contain plain text and are cleared when discovery is disabled or the toolbar is disposed.

```ts
toolbar.update({ features: { discovery: true } });
toolbar.updateDiscoveryHints([
  {
    id: "keyboard",
    title: "Keyboard navigation",
    message: "Use the arrow keys to move between toolbar controls.",
  },
]);
```

The host owns when hints are appropriate and how they are updated. The controller stores no discovery history or completion state.

## Opt-in local diagnostics

The diagnostics recorder is in-memory only and starts disabled. The host must enable it from its current `features.diagnostics` policy and provide a redactor before any record can be accepted. Disabling or disposing clears the buffer; no timestamps, causes, prompts, network requests, or persistence are added by the recorder.

```ts
import { createLocalDiagnosticsRecorder } from "@moorkyz/toolbar";

const diagnostics = createLocalDiagnosticsRecorder({
  capacity: 50,
  redact: (_code, message) => redactSecrets(message),
});
diagnostics.setEnabled(currentFeatures.diagnostics);
const result = diagnostics.record({
  code: "HOST_WARNING",
  severity: "warning",
  message: "A local diagnostic message",
});
```

The redactor is mandatory. Stored messages are limited to 500 characters; the default buffer holds at most 50 records. The SDK does not include a diagnostics panel or send reports anywhere.

## Host-coordinated page lifecycle

The optional lifecycle coordinator observes only the host document's visibility and its window's `pagehide`/`pageshow` events. It invokes host callbacks once per active/suspended transition and removes all listeners on `dispose()`. Creating the coordinator is explicit; the toolbar does not add global lifecycle listeners automatically.

```ts
import { createLifecycleCoordinator } from "@moorkyz/toolbar";

const lifecycle = createLifecycleCoordinator(document, {
  onSuspend(reason) {
    hostFeatures.suspendNonessentialWork(reason);
  },
  onResume(reason) {
    hostFeatures.reconcile(reason);
  },
});

// On host teardown:
lifecycle.dispose();
```

The host decides what work is nonessential and how to reconcile after BFCache restoration; the coordinator does not stop host-owned commands or perform background work itself.

Feature flags and configuration diagnostics are draft contracts. Recognizing a feature flag does not mean that the feature module is implemented or activated. See the repository [implementation status](../../docs/engineering/implementation-status.md) and [SDK/schema contract](../../docs/contracts/sdk-and-schema.md).
