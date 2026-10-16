# AGENTS.md — Moorkyz Toolbar

## Mission and status
Build the reusable `@moorkyz/toolbar` library and the `toolbar.moorkyz.com` portal as a complete, tested product **before integrating the library into other Moorkyz applications**. This package is a **draft specification**, not permission to release or modify external repositories.

## Source of truth
1. User-approved decisions in `docs/decisions/decision-register.md`.
2. Approved versioned public contracts in `docs/contracts/` (once explicitly approved); follow higher-level decisions on conflicts.
3. System/design/security and quality specs in `docs/architecture/`, `docs/design/`, `docs/portal/`, `docs/engineering/`.
4. Code and tests for implementation details (never override product requirements).
If ambiguity persists, record it in `docs/engineering/open-validations.md`; only block on material risk or irreversibility.

## Change authority: risk-tiered
**Autonomous:** private implementation details, local refactors, reversible optimization, tests, fixture design, documentation repairs and bug fixes preserving contracts. Record significant decisions and evidence in the audit.
**Approval required:** public API breaking changes; switching accepted architecture choices; defaults of optional features; mandatory dependencies; security/permissions/telemetry/data handling; cost/infrastructure; externally visible scope expansions; publishing, deployment, signing and production release; integration into other Moorkyz projects.
**Never bypass:** mandatory accessibility; deny-by-default authorization; no default telemetry; license/secret scanning; protected data; dependency gate failures without documented approval.

## For each meaningful change
1. Read the relevant decisions/specs and inspect current repository code and tests. Do not assume scaffolding exists.
2. Describe impact, affected public contracts and feature flags; prefer the smallest reversible change.
3. Write/adjust tests before considering the slice complete, including failure, cleanup, keyboard, permissions and disabled-feature paths where relevant.
4. Run formatting, lint, typecheck, unit, integration, build, and focused security/a11y/performance checks appropriate to the slice. Treat missing gates as missing work.
5. Create a task-scoped report in `docs/audits/` from `docs/audits/TEMPLATE.md`, recording exact commands and observed results, risks, gaps, and rollback. An agent self-audit is not independent security certification.
6. For each completed agent task, make one focused local commit containing only that task's changes and audit, after applicable checks pass and when Git state permits. **Do not push** unless separately authorized. Never stage unrelated user changes or claim a commit that was not made.
7. On an architectural blocker, produce a concise options analysis instead of guessing. Do not auto-deploy, publish packages, register domains, or spend money.

## Engineering invariants
- `@moorkyz/toolbar`: one published package, tree-shakeable subpaths, optional Node CLI entry; CLI code not bundled into browsers.
- Default core is framework-neutral, responsive, accessible, SSR-safe, local-first, with no external network demand.
- Optional features must not activate, schedule work, poll, fetch or retain resources while disabled. Spatial coordination is explicitly **off by default**.
- Preserve deterministic state, stable interaction targets, host command authority, non-destructive upgrades, and locally scoped persistence.
- Maintain WCAG 2.2 AA targets and previously selected test coverage gates (>=90% core branch; >=85% overall), subject to unambiguous metric definitions.
- Respect reduced-motion; no user-behavior tracking/learning; no default remote telemetry.

## Engineering guidance
- Follow [agent workflow](docs/engineering/agent-workflow.md), [coding standards](docs/engineering/coding-standards.md), [testing guidance](docs/engineering/testing.md), [security and dependency policy](docs/engineering/security-and-dependencies.md), and [Moorkyz CLI guidance](docs/engineering/moorkyz-cli.md) as relevant.
- GitHub Copilot reads the concise workspace entrypoint in `.github/copilot-instructions.md`; this root `AGENTS.md` remains the authoritative project contract.
- The task-audit skill in `.github/skills/task-audit/` is an end-of-task workflow aid, not a replacement for these requirements.

## Useful commands
- `.\moorkyz.cmd help`, `.\moorkyz.cmd doctor`, and `.\moorkyz.cmd audit "task title"` are available for local repository management.
- `node --test tests/tooling/moorkyz-cli.test.cjs` runs the dependency-free CLI regression tests.
- Moorkyz lifecycle and package-check commands require a root `package.json` with the requested scripts; this draft repository does not yet have one.
- `pnpm check` for the full repo verification pipeline.
- `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm typecheck`.
- Internal `moorkyz start|stop|help` workflow is distinct from the public `moorkyz-toolbar` consumer CLI.
The pnpm commands above remain planned until matching package scripts and project tooling exist. Do not describe them as functioning today.
