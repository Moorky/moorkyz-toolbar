# Optional recovery, inspection and custom theme drafts

These additions are implemented **draft contracts**, not approved stable public
APIs. They preserve the decision-register defaults and do not authorize a
release or integration with another product.

## Recovery

`@moorkyz/toolbar/recovery` exports `createRecoveryQueue()`. It starts disabled,
owns only in-memory state, and never installs connectivity listeners, timers,
storage, network clients or a service worker. The host explicitly enables it,
admits a safe-to-retry job with an idempotency key, then calls `drain(true)` after
confirming connectivity. Each attempt checks current host authorization.

An unsuccessful attempt returns a structured failure. A later explicit drain
may retry; there is no automatic replay. The attempt bound is 1–5 (default 3);
exhaustion removes the failed job and opens a circuit requiring explicit reset.
Authorization failure or denial removes the job without retry. A session admits
at most 1–100 distinct idempotency keys (default 50), including completed keys,
to bound memory and reject duplicate admission. Disabling clears the session
and aborts active work; disposal is terminal. Uncooperative host work cannot be
forcibly stopped, but its late result is ignored.

Hosts must enforce idempotency in their execution system. The queue cannot
guarantee exactly-once side effects. Never designate payments, deletion or
publication as retry-safe merely to admit them. Persisted queues and cross-session
replay remain unsupported pending V09's retention/session policy approval.

## Inspection and gestures

`@moorkyz/toolbar/inspector` exports `createDockInspector(target, recorder)`.
Construction creates no DOM or listeners. Enabling mounts a labeled static
snapshot of an explicitly supplied local recorder; refresh is explicit, never a
poll. Only already-redacted records are rendered, as text. Disabling/disposal
removes the panel. The host separately controls recorder consent and clearing.
The subpath is absent from default consumer bundles.

`@moorkyz/toolbar/gesture-profile` exports `createGestureActionProfile(policy)`.
It maps already-recognized left/right intent to host action IDs only after an
explicit gate and current host authorization. It never observes input itself,
retains history, suppresses native gestures or grants permission. Hosts must
provide equivalent keyboard/button controls and handle the returned failures.

Mounted controllers now reconcile visibility and BFCache through the existing
lifecycle coordinator. Suspension clears/aborts local search and AI presentation,
then signals optional `onSuspend`; resumption signals `onResume`. Host jobs are
not cancelled or replayed, and manually collapsed docks stay collapsed. Mount
cleanup removes all lifecycle listeners, including failed-mount cleanup.

## Custom themes

`validateThemeFile()` accepts only `{ version: 1, theme, tokens }`; names are
bounded identifiers and tokens are the existing six `#RRGGBB` values. Unknown
versions/properties, symbols, accessors, unsafe CSS values and insufficient text,
hover-text or focus contrast are rejected.

`controller.updateThemeTokens(tokens)` validates atomically and requires an
explicit `host.styleNonce` for the host's existing CSP. It adds a uniquely scoped
nonce-bearing stylesheet, never an inline style attribute or unsafe CSS input.
Passing `null` removes the override. Disposal removes it. No CSP is loosened;
the host must provide a nonce actually authorized by its policy. Built-in
configuration and persisted preferences remain independent of this
non-serializable host styling permission.

The portal Theme Studio uses its per-response CSP nonce, confirms custom token
application, validates portable imports and exports data only. Invalid drafts do
not replace the last applied preview.

## Studio data boundaries

The full JSON workbench and visual feature controls share `validateConfiguration`.
Imports are bounded to 64 KiB, require a versioned envelope, and need explicit
confirmation before preview replacement. Downloads contain only configuration,
never callbacks, host results, credentials or executable code. Existing explicit
local draft save/restore/delete remains available; no implicit upload or sync is
added. Scenario imports validate the version, exact fields and bounded simulated
clock before accepting a snapshot for deliberate replay.

Documentation clearly labels 0.1.0 as a development preview; there is no invented
stable release. The local Inspector displays synthetic redacted fixture events,
not captured user behavior.
