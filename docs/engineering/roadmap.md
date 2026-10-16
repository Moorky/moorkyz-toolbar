# Implementation-ready milestone plan (contract-first)

**Status:** proposed execution ordering under approved Q80 method; no code, deployment or release has been performed. Every milestone has an evidence-backed gate and a focused audit. Feature completeness, not a date commitment, determines readiness.

## M0 — Repository inventory and specification baseline
**Prerequisites:** none. **Deliver:** check repository/branches/CI/dependencies/licenses; archive original 80 questions; reconcile abbreviated ledger; establish workspace conventions, AGENTS.md, docs, audit and ADR templates, no scope creep.
**Exit:** no conflicting policy; all binding decisions traceable; baseline checks run or recorded as absent; no public contract unresolved without owner/status.

## M1 — Public contracts, schemas, and quality harness
**Prerequisites:** M0. **Deliver:** versioned config schema/defaults, result/error types, controller lifecycle, capability/context/command/navigation interfaces, extension manifests, theme and placement schema, feature loader boundaries; contract-driven docs plan; pnpm workspaces, CI skeleton and test fixtures.
**Exit:** typed compile fixtures for vanilla and one framework; schema round-trip and negative tests; explicit disabled-feature behavior; approved surface and authorization semantics. Public API names remain draft until reviewed.

## M2 — Minimal production-quality dock
**Prerequisites:** M1. **Deliver:** framework-neutral state and DOM renderer; default bottom anchor, accessible Home/actions/navigation, Shadow default/Light opt-in, safe-area handling, SSR-safe import, manual collapse/restore and cleanup.
**Exit:** keyboard/screen-reader smoke scenarios; no external requests; no optional background work; mount/unmount memory tests; restrictive CSP fixture passes chosen approach.

## M3 — Capability, context, commands and surfaces
**Prerequisites:** M1–M2. **Deliver:** namespaced transactional capability registry, hierarchical context, stable active controls, typed commands with concurrency/cancel/timeout, host navigation adapters, surface stack/focus/dismissal, errors and fail-closed permission checks.
**Exit:** race/abort/revocation/duplicate registry/error tests, stale-result handling, host ownership retained, accessibility intact.

## M4 — Adaptive composition, input, motion and placement
**Prerequisites:** M2–M3. **Deliver:** constraint-based scrollable composition, stable anchors, overflow fades/conditional chevrons, touch and input arbiters, native-first morph transitions, velocity retargeting, mount controller for viewport/container/fullscreen.
**Exit:** zoom/RTL/portrait/landscape/fullscreen/keyboard/large-text scenarios, no browser gesture hijacking, reduced motion, performance profiling and clean disposal.

## M5 — Themes, customization and persistence
**Prerequisites:** M2–M4. **Deliver:** approved themes/tokens, direct and settings customization, edit-only rearrangement, schema-versioned local preferences with migrations/in-memory fallback; never auto restore collapsed dock.
**Exit:** deterministic preference round trips, accessible theme contrast, storage fallback and migration corruption tests; no behavior learning.

## M6 — Optional capabilities and resilient lifecycle
**Prerequisites:** M3–M5. **Deliver:** search federation, optional AI adapter, Task Center as host-state presentation, notification/attention engine, progressive discovery, optional diagnostic inspector, optional host spatial coordination, optional offline integration/queue, advanced gestures and lifecycle coordination. Each independently controllable.
**Exit:** default flags match decision registry; disabled features create no owned resources or unwanted network requests; safe retries only; circuit breakers/recovery tested; permissions never bypassed.

## M7 — Adapters, extensions and consumer compatibility
**Prerequisites:** M1–M6. **Deliver:** framework adapter entry points, trusted extension SDK, explicit experimental namespace, representative Vanilla/React/Next.js/Vue/Angular consumer fixtures where supported; CLI boundary scaffolding.
**Exit:** real apps compile/run using published-style exports, SSR import safe, extension fault containment, package bundle isolation and CSP/focus compatibility.

## M8 — Public developer portal and complete Development Studio
**Prerequisites:** M2–M7. **Deliver:** `toolbar.moorkyz.com` codebase with actual library-powered bottom navigation and demos; docs/version selector, live configurator/code sync, Scenario Lab, Theme/Extension/A11y studios, component lab and optional Inspector, local-first draft recovery.
**Exit:** website exercises all supported capabilities via real package and stable fixtures; simulated faults/replay/export work; no privileged arbitrary code; portal deps never leak into library.

## M9 — Generator, CLI and non-destructive upgrade path
**Prerequisites:** M1, M7–M8. **Deliver:** manifest-driven runnable starter projects, universal and optional composable presets, generator integrated with Studio, safe CLI (`init`, `validate`, `doctor`, etc.), previewable upgrade diffs and migration docs.
**Exit:** fixture matrix project generation/build/test; strict no-overwrite tests; offline/local workflows supported; no credentials in exports; CLI absent from browser bundle.

## M10 — Full hardening, security review and release-candidate evidence
**Prerequisites:** M2–M9. **Deliver:** extended browser/device/framework matrix, WCAG 2.2 AA audit, core/overall coverage gates, CSP/Trusted Types review, malicious content and failure injection, package/supply-chain checks, performance baseline+approved budgets, upgrade compatibility and audit report.
**Exit:** all mandatory gates pass or explicit written exception is recorded for a non-critical eligible issue; no known critical security/a11y blocker; complete docs and rollback/recovery notes.

## M11 — Separate release authorization gate (not execution authorization)
**Prerequisites:** M10. **Deliver:** release candidate summary, exact package/site hosting/domain choices, deployment costs, signing/publishing ownership, immutable artifact/checksums, rollback plan and requested authorization.
**Exit:** without explicit user consent, **stop**. Do not publish npm package, deploy website, sign artifacts, spend money or integrate into other Moorkyz apps. Approved release tasks would be a separate authorized phase.

## Per-milestone developer-agent task pattern
1. Check prerequisites / scopes / binding decisions.
2. Implement the smallest fully tested slice; include positive, negative, focus, cleanup and disabled-feature cases.
3. Execute static/functional/performance/security checks applicable to slice.
4. Update docs/schema, attach audit evidence and explain deviations.
5. Commit locally if inside an authorized repo; no push/deploy unless approved.
6. Mark milestone ready only after exit evidence, never from code completion alone.

## Example first implementation ticket (M1-001)
**Title:** Versioned configuration schema and feature-gate contract.
**Inputs:** decisions Q28, Q33–Q35, Q54–Q59, Q64, Q74, Q76–Q80.
**Tasks:** define feature flag schema/defaults; separate mandatory invariants; typed validation diagnostics; test unknown/invalid values; test runtime toggling and lazy-loader semantics; generate Studio/CLI schema fixture; document migration policy.
**Acceptance:** defaults exactly as approved; spatial/offline false; schema validation produces stable error codes; JSON config round-trip succeeds; disabling modules yields zero feature-owned listeners/timers/network requests; no browser API at module import; independent browser consumer fixture passes.
