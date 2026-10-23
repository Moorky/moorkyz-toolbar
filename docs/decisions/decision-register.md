# Architecture decision register — Q1–Q80

> **Decision status:** user confirmed in questionnaire. **Record status:** consolidated/paraphrased, not verbatim Q1–Q64 transcript. Where the original questionnaire uses fuller language, preserve that fuller language upon import. These summaries are binding on intent, not evidence of finalized API names.

| ID | Approved decision (short form) | Binding interpretation |
|---:|---|---|
| Q01 | Hybrid Smart Dock | Fixed bottom app-style navigation blended with contextual actions. |
| Q02 | Morphing Smart Dock | Smoothly transforms between compact navigation, search, controls and panels. |
| Q03 | Context-aware hybrid behavior | Contextual content adapts automatically; major interface morphs occur deliberately. |
| Q04 | Unified Adaptive Dock | Permanent anchors plus flexible action slots. |
| Q05 | Core anchors and overflow | Home, Projects, Search, context actions and More; narrow layouts scroll naturally. |
| Q06 | Hybrid Capability Engine | Typed registrations combined with live host application context. |
| Q07 | Explicit customization, no learning | User choices only; no usage-based behavioral tracking or learning. |
| Q08 | Manual persistent collapse | Dock slides below screen to restore handle; never auto-restores. |
| Q09 | Soft Glass Minimalism | Light/dark themes and restrained adaptive project identity. |
| Q10 | Fluid restrained motion | Spring-like ~220–350ms macro / ~120–180ms micro; reduced motion supported. |
| Q11 | Hybrid expansion surfaces | In-dock transforms, panels and popovers chosen by context. |
| Q12 | Intelligent bottom anchoring | Safe areas, keyboard and host exclusion zones respected. |
| Q13 | Progressive interaction | Pointer, keyboard and touch, explicit edit-mode dragging, contextual menus. |
| Q14 | Federated independent projects | Shared library across domains; application-local state. |
| Q15 | Local preference persistence | No default cloud account or cross-project preference sync. |
| Q16 | Trusted modular extension SDK | First-party and trusted integrations; no open marketplace. |
| Q17 | Adaptive spatial sizing | No artificial dock maximum width; use available viewport and scroll overflow. |
| Q18 | Resilient lifecycle and accessibility | Safe lifecycle resource ownership; accessibility is mandatory. |
| Q19 | Framework-neutral ecosystem | Core, adapters, SDK, optional CLI, tests and playground. |
| Q20 | Least-privilege security | Capability-scoped permissions; host authorization is authoritative. |
| Q21 | Production-grade quality | Controlled releases and production-oriented quality governance. |
| Q22 | Direct and settings-based customization | User can customize through direct edit affordances and settings. |
| Q23 | Optional progressive discovery | Helpful discovery is skippable and fully disableable. |
| Q24 | Optional contextual Task Center | Host owns actual background work; toolbar presents state. |
| Q25 | Federated search and optional AI | Search available; AI off by default and host authorized. |
| Q26 | Contextual Attention Engine | Respects focus and does not intrusively notify or auto-restore. |
| Q27 | Progressive platform integration | PWA and mobile considerations, safe area and optional platform integration. |
| Q28 | Independent developer feature flags | Optional features build/runtime configurable; disabled features do no work. |
| Q29 | Local configurable diagnostics | Dev-only Dock Inspector optional, excluded from production default; no telemetry. |
| Q30 | Extensible token-based theme system | Signature, Frosted Glass, Midnight, Warm Minimal, High Contrast, Project Adaptive. |
| Q31 | Deterministic typed state | Event-driven state, stale response protection and explicit transitions. |
| Q32 | Selective reactive rendering | Fine-grained subscriptions, batched updates, lazy modules. |
| Q33 | Project-first configuration | Simple defaults; optionally layered configuration. |
| Q34 | Versioned SDK and schemas | SemVer, explicit migration and deprecation policy. |
| Q35 | Single published npm package | `@moorkyz/toolbar`, internal modular subpath exports and optional adapters. |
| Q36 | Public Apache-2.0 project | Public GitHub contributions/PRs with controlled releases. |
| Q37 | Independent developer website | `toolbar.moorkyz.com`: documentation, real playground and developer tools. |
| Q38 | Website-first phased development | Complete/test library and dedicated portal before any other Moorkyz integration. |
| Q39 | Experience-led hybrid landing | Working dock as portal navigation plus interactive examples. |
| Q40 | Minimalist Product Canvas | Light-first portal with optional dark mode. |
| Q41 | Living Product Experience | Site sections demonstrate real contextual reactions, without forced interruptions. |
| Q42 | Progressive Product Story | Accessible homepage with technical depth discoverable throughout. |
| Q43 | Unified Development Studio | Configurator, component lab, simulator, theme studio, extension builder, inspector, tests, code generation. |
| Q44 | Synchronized visual/code configuration | Live preview; confirmation for disruptive changes; no privileged arbitrary code execution. |
| Q45 | Adaptive modular workspace | Resizable/collapsible/focus layouts with browser-local persistence. |
| Q46 | Deterministic Scenario Lab | Preset/custom contexts, controlled clock/faults/permissions, replay/export and regressions. |
| Q47 | Unified Extension Studio | Gallery and safe isolated custom code experiments, with controlled contracts. |
| Q48 | Local-first portable Studio | Local drafts/snapshots, schema-versioned files and optional shareable config links. |
| Q49 | Interactive versioned docs | Latest stable by default and explicit version selector. |
| Q50 | Complete Theme Design Studio | Portable theme files, safe share links, contrast checks and live preview. |
| Q51 | Unified portal shell | Isolated workspaces and restored local drafts/state. |
| Q52 | Evidence-driven engineering | Milestone audits and pre-release evidence reports. |
| Q53 | High-assurance release contract | Extended browser/device validation, WCAG 2.2 AA, >=90% core branch, >=85% overall coverage. |
| Q54 | Modular pnpm monorepo | One public library, Next.js portal, contract-driven docs, AGENTS.md, audits and scripts. |
| Q55 | TypeScript core and lightweight renderer | Framework-neutral core/DOM renderers, adapter strategy; Next.js React MDX portal. |
| Q56 | Risk-based dependency automation | Renovate, narrowly scoped safe auto-merge; Changesets and explicit publish/deploy approval. |
| Q57 | Hybrid declarative SDK/controller | Typed configuration and imperative controller with structured results/diagnostics. |
| Q58 | Scoped transactional capability registry | Namespaced identity and explicit host-authorized overrides. |
| Q59 | Hierarchical context / stable interaction | Context resolution with no disruptive control movement; instant permission revocation. |
| Q60 | Policy-driven command execution | Concurrency options, timeouts, cooperative cancellation, host-owned execution. |
| Q61 | Adaptive surface orchestrator | Bounded context-aware nested panels with focus/dismissal/lifecycle guarantees. |
| Q62 | Navigation contract / router adapters | Host routing plus optional secure cross-app handoff; no automatic state sync. |
| Q63 | Versioned policy-driven persistence | Selective safe migrations/recovery, per-project local namespaces, memory fallback. |
| Q64 | Accessibility by construction | Severity-based validation and guided fixes; block critical inaccessible extensions. |
| Q65 | Progressive DX + optional interactive learning | Minimal setup; skippable searchable exercises, examples and gradual mastery. |
| Q66 | Universal core + composable presets | Optional preset gallery and interactive starter gallery/project generator. |
| Q67 | Manifest-driven project generator | Versioned projects, developer-owned code and non-destructive upgrade assistant. |
| Q68 | Progressive CLI + safe hybrid interaction | Optional guided/automation CLI, dry runs, no silent overwrite, browser bundle isolation. |
| Q69 | Budget-aware progressive runtime | Tree shaking/lazy loading/selective rendering plus measured regression gates. |
| Q70 | Hybrid native-first motion | Web/native methods and velocity-aware interruption retargeting. |
| Q71 | Unified input arbitration | Host authority over globals; delegated contextual shortcut resolution. |
| Q72 | Adaptive intent-aware gestures | Native interaction defaults; advanced gesture profiles opt-in. |
| Q73 | Constraint-based responsive composition | Stable anchors and natural scroll; adaptive fades/conditional chevrons. |
| Q74 | Adaptive mount and spatial contract | Viewport default, container/fullscreen options; cooperative spatial contract *optional and off by default*. |
| Q75 | Resilient host-coordinated lifecycle | Visibility/suspension/reconciliation; selective suspend with host authority. |
| Q76 | Optional host-coordinated offline | Off by default; policy-driven safe retries and optional explicit offline queue. |
| Q77 | Layered fault isolation | Severity-based recovery and circuit breakers; fail closed for security. |
| Q78 | Capability-scoped hybrid extensions | Stable SDK with explicitly opt-in experimental APIs. |
| Q79 | Adaptive DOM isolation + CSP-first | Shadow DOM default / Light DOM opt-in; restrictive security-policy compatibility. |
| Q80 | Contract-first progressive implementation | Risk-tiered agent authority, explicit approvals for material changes and releases. |

## Cross-cutting decisions that must never be lost

- **Product names:** Moorkyz Toolbar; repo `moorkyz-toolbar`; single public npm package `@moorkyz/toolbar`; portal `toolbar.moorkyz.com`.
- **Primary product boundary:** build/test library and its portal first; no other Moorkyz integration before completion and separate approval.
- **Accessibility/security always on:** permissions, accessible focus/interaction, CSP-safe rendering, validation and fail-closed invariants cannot be disabled.
- **Independent optional modules:** including spatial coordination (default false), offline (default false), AI (false), tasks (false), notifications (false), discovery (false), diagnostics (optional). Disabled code has no initialization/polling/fetching/feature-observer cost.
- **Stable state and motion:** local explicit preferences, deterministic context, no usage-based personalization, reduced motion, manual collapse never auto-restores.
- **Host authority:** host owns sensitive commands, network/data operations and service workers. No silent command replay, permission bypass or direct privileged extension access.
- **Developer autonomy constraints:** changes to approved behavior/public contracts/security/features/scope/releases need approval. Avoid overwrites; use reviewable diffs.
- **Engineering quality:** WCAG 2.2 AA, core branch >=90%, overall >=85%, extended browser/device matrix, performance baselines then enforce approved budgets, milestone audit evidence.
- **Explicit release gates:** no deploy, npm publication, spending, signing or cross-product integration without new authorization.

## Change control

The record is append-only in meaning: a change to an approved choice should produce a new ADR describing motivation, impact, migration and explicit user approval. Editing prose for clarity without altering intent is permitted. The decision register outranks later implementation convenience.
## Explicit option selections from later questionnaire

### 2026-10-23: user-approved modular tools portal

The current task explicitly expands the portal landing into a modular tool
catalog and imports the supplied VideoCrunch application. Shared tool details
include title, release/updated metadata, description, use cases and setup; local
script tools insert a browsable source hierarchy immediately after description,
with console-style source, per-file copy/download and complete ZIP download.
The existing Toolbar playground and Studio remain available on dedicated routes.
The user chose a localhost web service with hosted/multi-user features off, and
the current live moorkyz.com footer without games pending a supplied reference.
This is not publishing, deployment, relicensing or a public SDK contract change.
See [implementation boundaries](../portal/modular-tools.md).
During verification the user explicitly approved the focused Next.js
16.4.0 -> 16.4.1 security patch and corresponding lockfile update after the build
and dependency audit identified two critical and one high advisory.

| Question | Selected architecture option | Selected policy / companion option |
|---:|---|---|
| Q64 | C: Accessibility-by-Construction System | B: Severity-Based Validation with Guided Fixes |
| Q65 | C: Progressive Developer Experience | B: Optional Interactive Learning Paths |
| Q66 | C: Universal Core + Composable Presets | C: Interactive Starter Gallery + Project Generator |
| Q67 | C: Versioned, Manifest-Driven Project Generator | B: Non-Destructive Upgrade Assistant |
| Q68 | C: Progressive Developer CLI | B: Safe Hybrid CLI |
| Q69 | C: Progressive, Budget-Aware Runtime | B: Measured Budgets + Regression Gates |
| Q70 | C: Hybrid Native-First Motion Orchestrator | C: Velocity-Aware Retargeting |
| Q71 | C: Unified Input Arbitration Engine | C: Explicit Host Authority + Context-Aware Resolution |
| Q72 | C: Adaptive Intent-Aware Gesture System | B: Essential Defaults + Opt-In Gesture Profiles |
| Q73 | C: Constraint-Based Adaptive Composition | B: Adaptive Fades + Conditional Chevrons |
| Q74 | C: Adaptive Mount & Placement Controller | C: Cooperative Spatial Layout Contract (**independently optional, off by default**) |
| Q75 | C: Resilient Host-Coordinated Lifecycle Engine | C: Selective Suspension with Host Authority |
| Q76 | C: Optional Host-Coordinated Offline Engine | C: Policy-Driven Retry & Optional Offline Queue |
| Q77 | C: Layered Fault-Isolation Architecture | C: Severity-Based Recovery & Circuit Breakers |
| Q78 | B: Capability-Scoped Hybrid Extension SDK | B: Stable SDK + Explicit Experimental APIs |
| Q79 | C: Adaptive DOM Isolation | B: Strict CSP-First Architecture |
| Q80 | B: Contract-First Progressive Implementation | B: Risk-Tiered Agent Authority |
