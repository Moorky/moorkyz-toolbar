# `@moorkyz/toolbar`

**Pre-release implementation draft.** The configuration and controller names in this package are not yet an approved stable public contract. The library and portal are under active development; this package has not been published.

The core is framework-neutral, imports without browser globals, and has no production runtime dependencies.

## Workspace use

Build the package from the repository root:

```sh
pnpm --filter @moorkyz/toolbar build
```

The workspace fixtures in `examples/vanilla-consumer` and `examples/react-consumer` show typed usage. They are not published starter templates.

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

Feature flags and configuration diagnostics are draft contracts. Recognizing a feature flag does not mean that the feature module is implemented or activated. See the repository [implementation status](../../docs/engineering/implementation-status.md) and [SDK/schema contract](../../docs/contracts/sdk-and-schema.md).
