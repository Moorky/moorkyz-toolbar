# Moorkyz Toolbar — Architecture and Implementation Specification

> **Status:** Consolidation draft v0.1 · 2026-10-16 · draft specification for review; committed locally, not approved for release.
> **Product:** Moorkyz Toolbar · **Repository:** `moorkyz-toolbar` · **Public package:** `@moorkyz/toolbar` · **Developer portal:** `toolbar.moorkyz.com`.

**Product rule:** **Easy to start. Easy to use. Powerful to master.** Basic installation must work with minimal configuration, while advanced capabilities remain discoverable, documented, independently configurable, and testable.

**License:** Apache License 2.0. See [`LICENSE`](LICENSE).

This package consolidates the 80 confirmed architecture questionnaire decisions into an implementation plan. It contains **specification documents, not implemented software or finalized public API declarations**. Wherever a specific method, file name, feature key, performance threshold, or browser matrix has not been approved, the documents identify it as a *proposed contract* or *validation item*.

## Document authority and reading order

1. [`docs/decisions/decision-register.md`](docs/decisions/decision-register.md): binding record of decisions Q1–Q80. Changing an approved decision requires a new documented decision and approval; do not silently rewrite its meaning.
2. [`docs/architecture/product-and-system.md`](docs/architecture/product-and-system.md): system components, authority boundaries, product/non-product scope.
3. [`docs/contracts/sdk-and-schema.md`](docs/contracts/sdk-and-schema.md): contract-first SDK and schema design, proposal status and versioning rules.
4. [`docs/architecture/features-and-resources.md`](docs/architecture/features-and-resources.md): feature flags, lifecycle, feature loading, resource rules.
5. [`docs/design/interaction-and-visual-system.md`](docs/design/interaction-and-visual-system.md): UI/UX, animation, responsive layout, accessibility.
6. [`docs/architecture/security-and-trust.md`](docs/architecture/security-and-trust.md): isolation, CSP, trust and authorization.
7. [`docs/portal/development-studio.md`](docs/portal/development-studio.md): developer website and live tools.
8. [`docs/engineering/dependency-map.md`](docs/engineering/dependency-map.md): dependency and implementation order; conflict resolutions.
9. [`docs/engineering/roadmap.md`](docs/engineering/roadmap.md): milestone-based build plan and measurable acceptance gates.
10. [`docs/engineering/verification-and-release.md`](docs/engineering/verification-and-release.md): automated QA, audits, security and release approvals.
11. [`docs/engineering/open-validations.md`](docs/engineering/open-validations.md): remaining evidence-backed questions, blockers and non-blockers.
12. [`AGENTS.md`](AGENTS.md): agent instructions and risk-tiered change permissions.

## Scope and execution constraints

- Build the **complete reusable library** and its dedicated, interactive **developer website first**. The site must actually import and exercise the library. **Do not integrate into other Moorkyz applications before completion and validation.**
- One published npm package with modular exports; internal pnpm monorepo workspaces and an independent Next.js/React portal are permitted.
- Framework-neutral TypeScript core; do not impose React, Next.js, CLI, AI, user accounts, or server requirements on library consumers.
- Host owns navigation and business data/operations, authentication/authorization, background jobs, service workers, and privileged execution. SDK and extension boundaries are typed and policy-driven.
- Core accessibility, safe content handling, permission enforcement, and deterministic state cannot be turned off. Most advanced features can be turned off, with no initialization, polling, fetching, or feature-owned observer overhead when disabled.
- No behavior-based user learning, default remote telemetry, automatic network calls to Moorkyz, or cross-app preference synchronization.
- No publishing, deploying, production release, payment, signing, or integration into other products without **separate explicit user authorization**. Writing these docs grants none of those permissions.

## Baseline review checklist

- [ ] Reconcile any shortened entries in the decision register against the original Q1–Q64 transcript before marking the registry archival/exact wording.
- [ ] Approve public contract drafts and lock down supported exports, feature names, validation/error codes, and CLI behavior.
- [ ] Establish a measured performance baseline and approved numerical gates.
- [ ] Confirm supported browser/device/framework matrix and target Node/tool versions.
- [ ] Run security/CSP/Shadow DOM compatibility spikes before hardening those assumptions.
- [ ] Implement and independently test library + website; complete audits and secure explicit release authorization later.

## Implementation authorization

Question 80 chose **contract-first progressive implementation** and **risk-tiered agent authority**. Agents may resolve reversible internal engineering details; they must seek approval for material public-API changes, security weakening, feature-default changes, paid resources, scope changes, publishing, deployment, or cross-product integrations.
