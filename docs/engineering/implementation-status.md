# Implementation status

This checklist tracks delivery against the approved milestone roadmap. A milestone is complete only when its acceptance criteria have evidence; a code change or passing unit tests alone is not sufficient. No external product integration, publishing, deployment, signing, or paid infrastructure is authorized.

## Milestones

| Milestone | Status | Evidence / remaining exit criteria |
|---|---|---|
| M0 — Repository inventory and specification baseline | Complete | Initial inventory found a documentation-and-maintainer-CLI repository, no application/package workspace, and no third-party dependencies. Baseline CLI tests: `node --test tests/tooling/moorkyz-cli.test.cjs` (3/3 pass). Node.js v22.18.0 and pnpm 11.8.0 are available. The tracked specification manifest hashes match. See the task-scoped M0 audit in `docs/audits/`. |
| M1 — Public contracts, schemas, and quality harness | Complete | Added the pnpm workspace, strict TypeScript package, version `1.0` JSON Schema/validator, immutable normalized defaults, stable diagnostics, CI workflow, and compile fixtures for vanilla and React consumers. `pnpm check` passes (10 tests; package and both consumer typechecks pass). API names remain draft. |
| M2 — Minimal production-quality dock | In progress | SSR-safe controller, Shadow/Light mounting, local CSS, native labeled buttons, host-only action dispatch, roving keyboard controls, reduced-motion CSS, manual collapse, atomic partial updates, and disposal are covered by unit and Chromium tests. Real-browser narrow-viewport/CSP/axe checks and 50 mount/dispose cycles pass (21 Node tests and 9 Playwright tests in the integrated suite); manual assistive-technology smoke and broader device coverage remain. |
| M3 — Capability, context, commands, and surfaces | In progress | Added namespaced atomic capability transactions, hierarchical versioned context snapshots, a host-authorized command executor with five concurrency policies, required runtime input validators, timeout/cancellation/revocation, and a bounded nested surface stack returning focus-restoration targets. 23 focused M3 cases pass and the vanilla fixture compiles these APIs. Dedicated router adapters, DOM focus orchestration, and broader race/permission fixtures remain. |
| M4 — Adaptive composition, input, motion, and placement | In progress | Added viewport/container/fullscreen placement drafts, native overflow scrolling with conditional fades and labeled controls, size-observer cleanup, reduced-motion-aware scrolling, and opt-in host-authorized scoped keyboard shortcuts. The suite passes 51 Node and 11 Chromium tests, including 320px overflow and host-container positioning. Pointer/touch arbitration, advanced motion/retargeting, RTL/zoom/device/real-fullscreen matrix, and approved numeric budgets remain. |
| M5 — Themes, customization, and persistence | Complete | Added six built-in theme families and contrast token validation, an accessible edit mode for theme/scheme choice and action reordering, host settings API, opt-in namespaced storage, v0-to-v1 migration, memory fallback and visible diagnostics. `pnpm check` passes (67 Node tests, 14 Chromium tests including axe across built-in themes and edit mode); the portal exercises reload persistence through its explicit local namespace. `pnpm install --frozen-lockfile`, package `--dry-run`, and `git diff --check` pass. Theme Studio portability and extended device/assistive-technology validation remain in later milestones. |
| M6 — Optional capabilities and resilient lifecycle | Not started | Implement the approved optional features with independent gates, disabled-path no-work evidence, and reliable disposal. |
| M7 — Adapters, extensions, and consumer compatibility | Not started | Validate supported framework adapters, extension contracts, and consumer fixtures. |
| M8 — Public developer portal and Development Studio | In progress | Preserved and integrated the Next.js portal workspace after user direction. It mounts the real library, updates context actions, persists a local theme, and has CSP/axe/browser coverage. Versioned docs, configurator, labs, generator, and the complete local-first Studio remain. |
| M9 — Generator, CLI, and non-destructive upgrades | In progress | The maintainer CLI now selects the portal as its default local project and has regression coverage. The separate public consumer CLI, starter generator, preview-only upgrade assistant, and their conflict tests remain. |
| M10 — Hardening and release-candidate evidence | Not started | Satisfy applicable quality, security, accessibility, compatibility, performance, licensing, and supply-chain gates. |
| M11 — Separate release authorization gate | Not started | Prepare release-readiness evidence and request any further authorization. Publishing, deployment, signing, spending, and external integration remain prohibited without separate approval. |

## Baseline

- Baseline commit: `c888e53` (`docs: add Apache 2.0 license`)
- Starting branch: `master`
- Existing verification: `node --test tests/tooling/moorkyz-cli.test.cjs` — 3 tests passed.
- Existing repository helper: `.\moorkyz.cmd help`, `doctor`, `start`, `status`, `logs`, `stop`, and `audit`; `moorkyz.config.json` targets the portal workspace. The public consumer CLI is a separate future deliverable.
- Initial inspection found existing changes to `MANIFEST.json`, `README.md`, and `docs/engineering/repository-layout.md`, plus a new `LICENSE` and license audit. At baseline verification, commit `c888e53` contained the license and README change and the worktree was clean. Those existing changes were not authored or staged as implementation work here.

Update this file at each milestone boundary with actual evidence, gaps, and the resulting commit. Do not mark a future release gate complete because code has been written.
