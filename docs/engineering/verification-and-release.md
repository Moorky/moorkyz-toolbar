# Verification, audits, releases and measurable acceptance

## Mandatory quality gates (approved intent)
- **Accessibility:** WCAG 2.2 AA target, automated axe checks **plus manual** keyboard/screen-reader/zoom/touch validation. Critical inaccessible extensions are rejected; guided remediation for noncritical issues.
- **Coverage:** at least **90% branch coverage of core** and at least **85% overall** coverage, with exact included modules and instrumentation chosen and documented at M1. Do not substitute line coverage for branch coverage.
- **Compatibility:** extended browser, OS, device and framework matrix; exact versions selected through evidence and documented before final release. Both Shadow and Light DOM included.
- **Performance:** measure representative consumer minified+compressed bundles, first mount, update latency, animation frame times, idle work, listener/memory leaks and optional module increments. Approve numerical budgets after reproducible baseline; then fail regressions unless explicitly approved/documented exception.
- **Security:** strict CSP, hostile content, trusted-types where available, URL policy, permission denial/revocation, storage corruption, extension faults, retry/idempotency, supply-chain dependency review.
- **Reliability:** deterministic context, stale response cancellation, concurrency, BFCache/visibility, fullscreen/keyboard, missing APIs, repeated mount/unmount, circuit-breakers, offline/online transitions.
- **DX:** compilation and runtime of generated consumer projects, docs code snippets typecheck, safe CLI upgrades, semver contract checks.

## Validation matrix (initial proposed dimensions)
| Dimension | Mandatory scenarios |
|---|---|
| Rendering | Shadow (default) + namespaced Light DOM, desktop/mobile, SSR import |
| Viewport | Narrow, medium, ultrawide, extreme browser zoom, landscape, RTL and large text |
| Input | Mouse, keyboard-only, trackpad, touch/pen, reduced motion, screen-reader scenarios |
| Host | Plain TS, React/Next.js, Vue, Angular (only mark supported after fixtures pass) |
| Security | CSP restrictive fixtures, XSS strings, disallowed URLs, unauthorized capabilities |
| Feature flags | Each disabled-feature cleanup and zero-work check, runtime enable/disable where supported |
| Context | Race, stale response, active gesture, permission revocation, manual collapse |
| Platform | Fullscreen, container mount, virtual keyboard, visibility/BFCache, offline and disposal |
| Generator | Fresh project / add-to-existing / upgrade dry-run, protected file collision |
| Extension | Unavailable APIs, registration collisions, render/async errors, repeated crash breaker |

## CI pipeline proposal
1. Format / lint / TypeScript strict type checking / docs or API generation verification.
2. Unit + property-based contract tests (feature validation, state, permissions, migrations).
3. Component/a11y tests and representative browser integration tests.
4. SSR and consumer test builds to verify optional exports, sizes and absent portal/CLI deps.
5. Generator and CLI fixtures on CI-supported OS targets; security dependency and secret scanning.
6. Performance measurement (controlled environment, multiple samples, noise policy, trend report); enforce approved thresholds.
7. Build reproducibility, public API compatibility and release candidate manifest.

A release candidate only advances after security/accessibility/compatibility/performance evidence is attached. Automation may prepare, but **cannot publish/deploy/sign/spend without explicit user approval**.

## Automated dependency and release preparation
Renovate for dependency updates with narrowly gated safe auto-merges; run all required tests, respect lockfile/source integrity, require manual review for breaking, security sensitive, ecosystem major updates. Changesets and CI prepare proposed changelogs and version bumps; OIDC credentialless publishing may be considered after explicitly approved release design, **not enabled by this package**.

## Audit artifacts
Per milestone attach an audit file based on [`audit-template.md`](audit-template.md) containing commits (if any), changes, tests run with actual logs, detected risks, unmet gates and corrective actions. Never label a gate PASS without executable evidence. Maintain an approval trail for exceptions, including scope, expiry and risk owner.

## Release gate (hard stop)
Final evidence package includes exact source revision, package contents, compatibility and coverage report, third-party dependency/license report, security review, SBOM if selected, deployment and rollback runbooks, cost estimate, owner, target host/domain and requested authorizations. **Do not assume these details are resolved.**
