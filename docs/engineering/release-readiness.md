# M6–M11 implementation and release-readiness evidence

**Release status: NOT READY / NOT AUTHORIZED.** This records a local development
slice, not permission to publish, deploy, sign, spend, push or integrate another
Moorkyz application. Public contracts remain drafts.

## Current milestone outcome

Subsequent website/Playground work adds four real application templates, ten
structural presets, complete supported design editing, local recovery, a
Playground-first website and a dedicated Studio. Its scoped checks and MVP
hardening evidence are recorded separately in task audits and the
[portal README](../../packages/portal/README.md). The M10/M11 acceptance
and authorization holds in this dossier remain unchanged; earlier milestone
test totals below describe that earlier slice, not current whole-workspace
certification.

The completed local website/Playground acceptance is documented in the
[MVP acceptance audit](../audits/2026-10-17T06-04-23Z-website-mvp-acceptance.md):
198 Node tests, 183 three-engine browser cases, all build/type/lint/format gates,
SDK coverage thresholds, bundle isolation and bounded dependency/source checks
passed. It adds no distribution authorization and does not close the manual
or independent M10/M11 holds below.

| Milestone | Delivered in this slice | Remaining acceptance |
|---|---|---|
| M6 | Explicit in-memory safe-retry queue with current authorization, bounded attempts and circuit breaking; separately imported local Inspector; authorized gesture profiles; mounted visibility/BFCache reconciliation; existing search/AI/tasks/notifications/discovery/offline/spatial behavior retained | Persisted offline queues remain intentionally unsupported pending host retention/session approval. Manual device/lifecycle acceptance is part of M10. |
| M7 | Trusted scoped extension SDK with failure containment, cleanup, revocation and breaker; explicit experimental namespace; optional Vue and Angular adapters alongside React/Next.js and Vanilla; compile and actual mount/unmount fixtures; isolated exports | Stable API and exact supported version ranges still require contract/matrix approval. Trusted same-realm extensions are not a sandbox. |
| M8 | Real-package configuration JSON/visual synchronization, versioned import/export with confirmed replacement, searchable versioned preview reference, custom theme authoring/import/export under the existing CSP nonce, scenario import/replay, trusted recipe gallery, optional local Inspector, local starter gallery, explicit existing draft recovery | Arbitrary user-authored JavaScript remains unavailable; the Studio uses the documented static safe fallback. Share links, arbitrary historical-version migrations and additional generated frameworks are not claimed. Manual usability/accessibility and container acceptance remain open. |
| M9 | Browser-safe shared generator; five presets; runnable Vanilla JavaScript starter; optional consumer CLI with `init`, isolated-child `add`, `validate`, `doctor`, `upgrade`, `examples`, `version`, `help`; JSON/noninteractive/dry-run behavior; manifest integrity, exclusive writes, collision/symlink/traversal rejection, preview-first upgrades and backups | Only Vanilla generation is validated. `add` deliberately does not rewrite an existing host app. No React/Next/Vue/Angular starter-generation promise is made by the adapter fixtures. |
| M10 | Automated three-browser matrix, axe checks, malicious-data and strict CSP/Trusted Types fixtures, bounded source/credential scan, dependency advisory check, library coverage thresholds, browser/CLI dependency isolation and measured bundle baselines | **BLOCKED for RC:** manual screen-reader/touch/device checks, approved metric/platform scope and numerical performance budgets, distribution-notice review, independent release review and Docker engine/container execution. |
| M11 | This authorization dossier, exact local packaging workflow, immutable artifact SHA-256/source-revision metadata tool, hosting proposal and rollback/approval checklist | **HOLD:** M10 must pass, then a separate explicit release authorization is required. No release action is performed. |

The implementation and automated evidence are complete for the scoped local
slice. The full M10/M11 milestone exits cannot honestly be marked complete from
an agent session alone.

## Verification

- `pnpm check`: lint, formatting, package/Next.js production build, 190 Node
  tests, 120 browser tests (40 each in Chromium, Firefox and WebKit), and
  library/Vanilla/React/Vue/Angular/portal typechecks passed. The final additional
  package-surface regression also passes; the task audit records the final
  complete Node rerun. The persisted browser report has zero skipped, unexpected
  or flaky cases.
- `node scripts/verify-coverage.mjs`: enforced core branch >=90% and emitted
  library line/branch/function >=85% thresholds. The measured headless-core
  branch coverage was **94.79%**; emitted-library coverage was **88.64% lines,
  86.03% branches, 95.21% functions**, including the final package-surface test.
- Frozen restore with `pnpm install --frozen-lockfile --ignore-scripts` passed.
- `pnpm audit --json`: zero reported advisories, 220 resolved dependencies.
  This is registry evidence at execution time, not a future guarantee.
- `node scripts/verify-source.mjs`: selected credential patterns and forbidden
  library eval/HTML-assignment sinks; no findings. This is a deliberately bounded
  scan, not an independent penetration test or comprehensive secret scanner.
- Package dry-run includes the optional CLI, emitted types, stylesheet and
  Apache license. The default browser root imports no framework, portal or CLI.

### Reproducible coverage definition

Node 22.18.0 native V8 instrumentation measures emitted JavaScript, without
changing assertions or excluding failure branches:

- Headless core: configuration, capability registry, context resolver, command
  executor and surface stack. All five files are included in the branch gate.
- Overall emitted library: every loaded `packages/toolbar/dist/*.js` module,
  including DOM renderer, optional capabilities, adapters and generator.
- The Node-only CLI is exercised by filesystem/runtime integration tests.
  Portal JSX and separate CLI source are **not** represented by the emitted
  library percentage. No whole-workspace coverage claim is made. Final metric
  scope approval remains V03.

### Tested compatibility, not a universal support claim

| Surface | Observed version |
|---|---|
| Node / pnpm / TypeScript | 22.18.0 / 11.8.0 / 6.0.3 |
| Chromium | 156.0.8078.4 |
| Firefox | 157.0 |
| WebKit | 27.2 |
| React / Next.js portal | 19.3.1 / 16.4.0 |
| Vue | 3.5.44 |
| Angular / RxJS | 20.3.34 / 7.8.2 |

Tests run on Windows in this environment. CI configures Linux with the same
three browser engines, but that remote CI execution is not claimed here.
Viewport/RTL/large-text/reduced-motion, both DOM modes, SSR, native keyboard
input, disposal and optional-feature paths are automated. Real mobile hardware,
screen readers and manual WCAG 2.2 AA assessment remain required.

Cross-browser findings fixed in this slice: pinned auxiliary controls could
leave Firefox's action viewport at zero width; all non-collapse controls now
share the natural scroll area while collapsed host actions remain hidden and
auxiliary controls retain their previous availability. Row scrolling affects
only its own container. WebKit exposed input loss before hydration, native
secondary-button contrast and submit-button focus differences; Studio controls
remain disabled/inert until hydrated, secondary buttons have explicit
backgrounds, and AI submission retains an owned keyboard dismissal target.

### Performance baseline, not approved budgets

`node scripts/measure-bundles.mjs` bundles representative consumers with esbuild
0.28.2, minified ES2022 ESM and gzip level 9:

| Consumer | Minified bytes | Gzip bytes |
|---|---:|---:|
| Configuration validator | 7,226 | 2,560 |
| DOM dock | 77,520 | 17,955 |
| Federated search | 5,196 | 1,634 |
| AI adapter | 2,331 | 798 |
| Explicit Inspector subpath | 647 | 385 |
| Explicit generator subpath | 15,717 | 6,130 |

The dock retains its implemented optional renderer paths even when runtime
flags are false; runtime inactivity is not the same as byte exclusion.
The bundle script verifies contributing module isolation. Browser tests also
sample 100 mount/update/dispose cycles and attach median/p95 observations to
the JSON browser report. Numerical performance budgets require user approval;
these measurements do not constitute an approved regression budget.

For the observed 100-cycle mount/update/dispose fixture, median/p95 durations
were 0.6/1.2 ms in Chromium and 2/4 ms in both Firefox and WebKit. These samples
were taken in a shared development environment and are not device-wide or idle
memory certification.

## Package preparation and immutable evidence

After the focused local commit and a successful build:

```powershell
pnpm --filter @moorkyz/toolbar pack --pack-destination <local-evidence-directory>
node scripts\prepare-release-evidence.mjs <local-package.tgz> <local-evidence-directory>
```

This creates a local tarball only. The evidence tool requires committed, clean
package inputs, records their source revision/scope, records whether unrelated
worktree changes exist, and exclusively creates `release-evidence.json` and
`SHA256SUMS`; it never overwrites an existing evidence record. Unrelated user
changes are neither included nor reverted. Evidence outputs belong outside the
repository. They are checksums, **not signatures** or release approval.

## Proposed release and required decisions

- Package: one Apache-2.0 `@moorkyz/toolbar` package, version currently `0.1.0`.
  There is no authorization to publish it or claim stable contracts.
- Site: `toolbar.moorkyz.com`, using the repository's existing Coolify/Docker
  Next.js standalone design. Existing CI deploys on an authorized push to
  `master`; this task does not trigger it or alter deployment authority.
- Costs: **not verified/approved**. Existing server capacity, monthly cost,
  domain/DNS/TLS ownership and any incremental spend need the owner's decision.
- Publishing/signing: npm scope access, release owner, credentials/OIDC design,
  signing provenance and signing authority are **not approved** by this task.
- Notices: new framework/bundler choices are MIT and RxJS is Apache-2.0.
  The full inventory also contains existing MPL-2.0, CC-BY-4.0 and native Sharp
  Apache/LGPL components. Required distribution notices/source obligations must
  be reviewed for the exact package/image/platform before release.
- Container: Docker CLI is installed, but the local Docker Desktop Linux engine
  is unavailable. The image/HTTP container smoke gate was **NOT RUN**, not passed.
- Approval request: only after the remaining M10 evidence is accepted, authorize
  the exact artifact hash, source revision, supported contracts/platforms,
  notices, infrastructure/cost, release owner and rollback target in writing.
  Publishing, deployment, signing, spending and external-product integration
  require their own explicitly scoped permissions.

## Rollback and recovery

- Local implementation: revert the focused task commit in a new commit; never
  reset or overwrite unrelated user work.
- Generated projects: preview upgrades first; retain generator-created backups,
  keep edited files unchanged and review every proposed diff before `--apply`.
- Preferences/drafts: versioned validation and explicit recovery preserve
  unsupported/corrupt saved data; no silent migration or destructive reset.
- Package: keep the last accepted tarball/checksum and pin consumer versions;
  any publication/deprecation action needs separate authorization.
- Site: retain the last known healthy image and use Coolify's existing rollback
  procedure after deployment authority and target image are confirmed.
