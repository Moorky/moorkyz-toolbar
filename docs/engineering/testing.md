# Testing and Verification Guidance

Testing depth follows the changed behavior and its risk. This document complements `docs/engineering/verification-and-release.md`; the latter contains Toolbar-specific measurable gates and release criteria.

## Principles

- Test observable behavior and approved contracts rather than private implementation details.
- Keep tests deterministic, isolated, and runnable in arbitrary order without production services.
- Cover meaningful success, failure, boundary, cleanup, keyboard, permission, and disabled-feature cases where relevant.
- A passing test suite is not proof of security, accessibility conformance, browser compatibility, or performance.
- Do not weaken assertions, skip a failing test, or silence a tool to manufacture a pass.

## Match evidence to the change

| Change | Appropriate evidence |
|---|---|
| Documentation or decision record | Link/readability review; docs checks if configured |
| Pure logic, state, schema, or helpers | Typecheck, lint/format, focused unit and boundary tests |
| Renderer, interaction, adapters, or portal UI | Component/integration tests, keyboard and accessibility checks, representative browser tests |
| Persistence or migration | Corrupt/legacy input, migration, cleanup, isolation, and recovery tests |
| Optional feature lifecycle | Disabled-path zero-work/resource checks; enable/disable/dispose and failure tests |
| Permission, security, or host integration | Adversarial input, unauthorized and revocation cases, safe error behavior, focused security review |
| Public package or build boundary | Browser/SSR import checks, consumer fixture build, export and bundle isolation |

For toolbar code, prioritize host-owned authorization, deterministic state, SSR-safe imports, Shadow and Light DOM where relevant, keyboard and reduced-motion behavior, and repeated mount/disable/dispose cleanup.

## Test environment safety

- Use synthetic fixtures, isolated temporary directories, and disposable test services only.
- Never reset an unknown or production database, use real credentials, or trigger real external messages/payments as part of a test.
- Avoid unnecessary network access. Tests should not silently contact Moorkyz services.
- Clean up child processes, files, observers, timers, listeners, and test artifacts even after failure.

## Current repository commands

The pnpm workspace now provides the following commands:

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm test:coverage
pnpm check:source
pnpm measure:bundles
pnpm test
pnpm lint
pnpm typecheck
pnpm build
node --test tests/tooling/moorkyz-cli.test.cjs
```

`pnpm check` runs lint, formatting, Node tests, Chromium/Firefox/WebKit Playwright
and axe checks, package/portal builds, and all consumer/package/portal typechecks.
The JSON browser report at `test-results/browser-results.json` retains per-engine
results and performance attachments. Coverage, bounded source scanning and bundle
isolation have separate commands and CI gates; exact scopes and residual manual,
performance, supply-chain and container requirements are in the
[release dossier](release-readiness.md). Do not claim whole-workspace coverage,
independent security review or manual accessibility certification from these checks.

## Reporting

For each required check, record the exact command and one of `PASS`, `FAIL`, `NOT RUN` (with reason), or `N/A` in the task audit. Report any baseline failure separately from a regression caused by the task.
