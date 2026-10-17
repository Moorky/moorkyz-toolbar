# M7 trusted extensions and optional framework adapters

> Implemented, reversible **draft**, not an approved stable public contract.
> Decisions: Q16, Q18–Q20, Q28, Q31, Q34–Q35, Q55, Q58–Q60,
> Q64 and Q78. No default feature or permission changes.

## Optional entry points

| Subpath                         | Runtime exports                  | Framework dependency |
| ------------------------------- | -------------------------------- | -------------------- |
| `@moorkyz/toolbar/extensions`   | `createTrustedExtensionRegistry` | None                 |
| `@moorkyz/toolbar/experimental` | `createExperimentalNamespace`    | None                 |
| `@moorkyz/toolbar/vue`          | `useToolbar`                     | Vue 3.5              |
| `@moorkyz/toolbar/angular`      | `injectToolbar`                  | Angular 20.2         |

The root must not re-export adapter modules. Vue and Angular are optional peers,
not mandatory dependencies; consumers that never import these subpaths must not
resolve or load their frameworks. All modules are safe to import without browser
globals. No entry point starts a timer, listener, network request or toolbar on
import. There is no executable portal integration in this slice.

## Trusted extension contract

```ts
const extensions = createTrustedExtensionRegistry({
  enabled: true, // false by default
  authorize: ({ extensionId, operation, actionId }) =>
    extensionId === "notes" &&
    (operation === "activate" || actionId === "notes.open"),
  dispatchAction: host.dispatchAction,
});

const registered = await extensions.register({
  manifest: {
    schemaVersion: "1.0",
    id: "notes",
    trust: "trusted",
    actions: [{ id: "notes.open", label: "Open notes" }],
  },
  initialize(scope) {
    // Trusted setup may own resources; always register cleanup immediately.
    scope.onDispose(() => releaseHostOwnedResource());
  },
});
```

The manifest is copied, validated through the existing configuration contract,
and deeply frozen. Only `id` and a nonblank `label` are accepted for each action.
Action IDs use the existing configuration's dot-compatible vocabulary:
`extension-id.action` (not the command registry's separate `namespace:name`
vocabulary). Each manifest can contain at most 64 actions, with labels no longer
than 256 characters. Actions cannot carry executable handlers, arbitrary payloads,
raw HTML, mutable core state, permissions or host objects.

The frozen setup scope contains only the immutable manifest, lifetime
`AbortSignal`, `dispatchAction(id)` and `onDispose(cleanup)`. It cannot register
commands, override another owner, change core feature flags, reset a circuit or
grant itself authority. The only behavior path is the host's existing
`ToolbarHost.dispatchAction` contract, with a manifest-declared action ID; the
host must continue to enforce its own command policy and current authorization.
Unknown action IDs and absent dispatchers fail closed.

Authorization is deny-by-default and synchronous: only literal `true` permits
use, never a truthy object or promise. The host explicitly approves activation
and every action, with fresh approval immediately before dispatch and after
completion. Thrown authorization checks are denial, not leaked exceptions.
Call `revoke(id)` on an authentication/permission event for immediate removal,
abort and cleanup. `getActions()` also checks current authorization and revokes
stale entries. The host alone projects returned descriptors into its toolbar
configuration. To avoid stale displayed descriptors, refresh that projection
after registration/removal or auth changes; route extension buttons through
`registry.dispatchAction(id)`, which uses the same scoped checks as the setup
scope. Never route these controls directly around the scoped dispatch contract.

Dispatch is unavailable until initialization completes. Concurrent duplicate
registrations are rejected. Initialization failure rolls back resources and
actions. Async initialization can be cancelled immediately even when the
initializer never resolves; late cleanup registrations run immediately and late
rejections are contained. Cleanup is idempotent, reverse-registration-order,
and continues after a disposer throws; accidentally async disposer rejections
are also contained. Register synchronous resource-release callbacks rather than
depending on asynchronous cleanup completion.

The host-only handle exposes `id`, `status`, and `dispose()`. Registry
`setEnabled(false)` and `dispose()` terminate active/initializing extensions,
remove actions, abort pending results, and release owned cleanups. Re-enabling
never restarts an extension automatically. Revocation cannot forcibly undo a
host operation that has already started: hosts remain responsible for
cooperative command cancellation and side-effect authorization.

Initialization and dispatch failures count toward a per-identity consecutive
failure circuit (default 3; host-configurable integer 1–10). A successful
dispatch resets the count. The circuit is permanent for that registry lifetime;
there are no retries, timers, implicit resets or privilege escalation. Host
creation of a new registry is the explicit recovery boundary. At most 64
identities are retained per registry lifetime, 64 disposers per activation, and
16 pending dispatches per extension. Results use bounded, redacted SDK messages,
not thrown extension/host error contents. Extensions do not affect each other's
failure counts, resources or action ownership.

**Not a sandbox:** trusted JavaScript runs in the host realm and can access
ambient JavaScript/DOM APIs independently of the SDK. Capability scoping cannot
make hostile code safe. Never pass untrusted Extension Studio JavaScript into
`register()`, use `eval`/`Function`, or execute arbitrary user-authored code in the
privileged portal. An isolated runner remains separately blocked by V13.

## Experimental namespace

`createExperimentalNamespace()` defaults to disabled. Its disabled
`createExtensionRegistry()` does not inspect host options, initialize extensions,
authorize, schedule, fetch or retain running resources. Explicit `true` permits
creation of an enabled trusted registry, but does not bypass host authorization,
scope validation, cleanup or the circuit breaker. It does not change the core
configuration's independent `experimental: false` default. Draft names may
change before public approval; experimental compatibility is not stable SemVer.

## Vue

Call `useToolbar(targetRef, configurationRefOrGetter?, hostRefOrGetter?)` inside
`setup()`. It returns readonly shallow refs `controller` and `error`. The first
mount is in `onMounted`, never during SSR. Replacing configuration updates the
existing controller transactionally; replacing the host or target disposes the
old instance before mounting a fresh one. Null targets release their controller.
Use stable host references and replace configuration references (in-place nested
mutation is not watched). Unmount stops the watcher and disposes exactly once.
Configuration/mount failures leave no mounted controller and expose structured
errors; invalid update patches preserve the existing valid toolbar.

`examples/vue-consumer` is a real render-function Vue app fixture: no SFC compiler
or bundler is required for its typecheck. Its `mountConsumer(element)` returns an
unmount function. The same component can be passed to Vue's server renderer.

## Angular

Call `injectToolbar(configurationGetter?, hostGetter?)` in a component/directive
injection context whose `ElementRef` is the toolbar mount target. The returned
`controller` and `error` are readonly Angular signals. Angular's
`afterNextRender` owns the first browser-only mount (it does not run in SSR).
An Angular effect tracks configuration/host signals; configuration replacement
updates the controller, host replacement disposes/remounts. `DestroyRef` destroys
the effect and pending render callback and disposes the controller. This adapter
uses Angular APIs directly and requires neither an Angular compiler dependency
nor library decorators/`ngc`.

`examples/angular-consumer` provides a standalone component and a fixture-only
JIT bootstrap (`mountConsumer()` returns asynchronous cleanup). Its host document
must contain `<mzk-consumer-toolbar>`. The fixture uses
`experimentalDecorators: true`; the library itself does not need that setting.
Angular's compiler/platform packages belong only to the fixture/test tooling.
Angular compiler-driven AOT and future Angular majors are not certified here.

## Parent integration and verification

Add the four export entries above with `types: ./dist/<name>.d.ts` and
`import: ./dist/<name>.js`. Add optional peers `vue: >=3.5.0 <4` and
`@angular/core: >=20.2.0 <21`, marking both `optional: true` in
`peerDependenciesMeta`. Development validation uses Vue `3.5.44`,
`@vue/server-renderer 3.5.44`, Angular common/core/compiler/platform-browser/
platform-server `20.3.34`, and `rxjs 7.8.2`. Existing `src/**/*.ts`
library tsconfig includes these entries without modification.

After parent-owned manifest/lock integration and dependency restoration, build
the library, run the three new adapter/extension test files, and typecheck both
consumer projects. Shared full checks, package/bundle isolation, cross-browser
accessibility/CSP, coverage accounting, audit and the single commit are owned by
the coordinator. No framework compatibility result is implied by documentation:
use actual recorded test evidence.
