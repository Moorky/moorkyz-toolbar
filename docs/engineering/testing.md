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

The project is still a specification draft and has no package manifest or application test pipeline. The CLI regression suite uses Node's built-in test runner:

```powershell
node --test tests/tooling/moorkyz-cli.test.cjs
```

`pnpm test`, `pnpm check`, browser tests, lint, typecheck, and build remain unavailable until the corresponding application/tooling is implemented. Do not report these planned commands as having passed.

## Reporting

For each required check, record the exact command and one of `PASS`, `FAIL`, `NOT RUN` (with reason), or `N/A` in the task audit. Report any baseline failure separately from a regression caused by the task.
