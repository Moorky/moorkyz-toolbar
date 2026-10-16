# Open validations, assumptions and genuine blockers

> These are *engineering validations*, not a request to restart the 80-question architecture questionnaire. Agents should gather measurements and propose evidence-backed implementations autonomously within Q80's authority boundary. Approval is sought only for material/irreversible changes.

| ID | Need / ambiguity | Handling | When it blocks |
|---|---|---|---|
| V01 | Original Q1–Q64 full wording/selection-to-number mapping | Compare original transcript; this register holds paraphrased intent | Blocks archival exact-quote claim; not basic technical exploration |
| V02 | Final names/types for controller, schema, feature keys, extension API | M1 proposed contract review with consumer fixtures | Blocks claiming stable public API |
| V03 | Core type-specific coverage scope and browser/device version matrix | Define reproducible matrix and methods before RC | Blocks final release gate |
| V04 | Numerical bundle, latency and idle-work budgets | Establish measured baseline, then approve thresholds | Blocks performance-regression gate and RC |
| V05 | Strict CSP styling approach in both DOM modes | Spike on representative restrictive configurations; document nonce/external CSS strategy | Blocks renderer contract finalization if incompatible |
| V06 | Shadow-root overlays, popovers, focus, screen-reader support | Cross-mode integration and assistive tech tests | Blocks affected stable rendering capability |
| V07 | CLI exports and package layout: browser exclusion and size | Build representative consumer fixtures, compare results | Blocks npm packaging contract |
| V08 | Dynamic import model and runtime-enabled feature delivery | Test optional loader/feature presence semantics | Blocks dynamic feature switch promises |
| V09 | Safe, portable offline queue mechanism | Host-owned idempotency, auth/session and storage retention design | Blocks **offline queue option**; core and offline status can proceed |
| V10 | Service/hosting budget and deployment ownership | User authorization only when release planned | Blocks deployment/publishing; not source implementation |
| V11 | Exact framework adapter support | Validate real fixtures for each claimed framework | Blocks corresponding support claim |
| V12 | Generator 'add to existing' safety | Conflict detection and reviewable patch proof, no silent replace | Blocks public generator release |
| V13 | Isolated extension editor execution strategy | Threat model and isolated runner proof | Blocks executing user-authored code in portal; static demos can proceed |
| V14 | Updated licensing of all chosen dependencies | Review before adding them and for release | Blocks use of incompatible dependency |
| V15 | Absolute conformance of a11y in unusual browser/OS matrix | Automated + real manual testing | Blocks a11y certification claims |
| V16 | External repo state and existing CI conventions | Inspect repository before touching files; reconcile rather than overwrite | Blocks applying draft package to existing remote repo |

## Priority risk register
- **R1: Too many modules in v1.** Mitigation: progressively implemented and independently disabled, milestone gates; no external integrations before full library/portal validation.
- **R2: Browser-specific CSS/CSP assumptions.** Mitigation: early spikes, test both modes, avoid blanket guarantee across unsupported policies.
- **R3: Optional features still inflate minimal build.** Mitigation: real downstream bundler tests, module import graph review, clear docs distinguishing runtime off from excluded bundle.
- **R4: Developer Studio diverges from SDK.** Mitigation: generated contract schemas, real package-driven previews and fixture reuse.
- **R5: Accessory extension breaks host app.** Mitigation: trusted scope, bounded fault isolation, strict host-owned permissions and circuit breakers.
- **R6: Undo/retry/recovery causes side effects.** Mitigation: command execution policy and explicit host authorization/idempotency.
- **R7: Agent scope drift.** Mitigation: binding decision ledger, risk-tier approvals, audits and no-deploy hard stop.

## No additional architecture question required now
No missing choice is known to prevent M0/M1 documentation and contract design. If a technical validation reveals competing solutions with different security, user-facing feature semantics, release cost or irreversibility, document the tradeoff and request a *targeted* approval. Otherwise proceed within approved boundaries.
