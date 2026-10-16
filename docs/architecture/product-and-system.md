# Product scope and system architecture

**Status:** architecture approved in principle; exact SDK shapes remain contract proposals.

## Product and principal actors
- **Host application:** any supported JavaScript/TypeScript web host; owns navigation, authentication, API access, user/session data, commands with business consequences, network retry eligibility and privileged runtime behavior.
- **Toolbar core:** framework-neutral TypeScript engine for capabilities, validated context, deterministic state, lifecycle, commands, permissions, placement, focus and event processing.
- **Renderers/adapters:** lightweight DOM renderer, optional framework adapters and optional Shadow/Light DOM mounting modes. React/Next.js is a portal choice, not a consumer requirement.
- **User:** controls explicit customization, collapse/restore, theme and other locally persisted preferences. No behavioral-learning tracking.
- **Extension author:** trusted developer; registers permitted typed extensions under validated capability contracts, without raw internal state access.
- **Portal developer:** interacts with live library demos, component lab, visual configuration, scenario simulator, accessibility studio, and generators.

## One-package / many-workspace design
- Public distribution: **one `@moorkyz/toolbar` npm package**, with optional subpath exports and a Node CLI binary. Source can live in a modular pnpm monorepo.
- Private portal workspace: Next.js + React + MDX, light-first UI; the actual workspace library must be consumed as a dependency for all demos, never reimplemented as a mock.
- Other internal workspaces: integration fixtures, test apps, typed generated contracts, build utilities; no mandatory additional public runtime package.
- Proposed build/tooling baseline to validate: TypeScript, pnpm, tsdown or equivalent package bundler, Vitest, Playwright, axe-core, Changesets, Renovate, GitHub Actions, lazy Monaco editor, browser-local IndexedDB for Studio drafts.

## Primary flow
```
Host configuration + feature policy + scoped context
           |                    |
       schema validator -> capability registry
           |                    |
  deterministic state <-- command / navigation controllers
           |                    |
    surface orchestrator / input arbitration / focus management
           |                    |
    responsive renderer + motion + placement + tokens
           |
        DOM mount boundary (Shadow default; Light opt-in)
```

### Responsibilities
- **Capability registry:** namespaces, scoped ownership, transactions and controlled overrides; feature flag and permission validation before becoming active.
- **Context resolver:** hierarchical resolution; active interactions remain stable while context changes; security revocation applies immediately.
- **Command engine:** typed results; per-command single-flight/queue/replace/parallel/drop policies, cancellation and timeouts; no implicit retries/side-effects.
- **Surface orchestrator:** bounded stack of panels/popovers/dialogs, predictable dismissal and focus; does not bypass browser or host overlays.
- **Input arbiter:** host-global shortcut authority, context/surface scopes, accessible pointer/touch/keyboard alternatives.
- **Placement controller:** fixed bottom default, viewport safe areas, optional host container/fullscreen and optional spatial coordination.
- **Persistence:** per-project local namespaces, versioned keys/migrations, in-memory fallback; persist explicit choices rather than ephemeral command/overlay state.
- **Lifecycle:** resource cleanup, BFCache/visibility/viewport/fullscreen reconciliation. Optional extension/background work follows host policies.

## Explicit exclusions
- No global account system, cloud preference sync, server requirement, arbitrary hosted AI, open extension marketplace, mandatory background task executor, automatic telemetry, secret collection, or usage-learning recommendation engine.
- No Phase 6 companion/native OS integration by implication; the unrelated research project's gates do not change toolbar scope.
- No automated release, package publish, domain deployment, signing or spend.

## Design principle
Minimum consumer path is install + register relevant actions + mount; advanced layers are progressive and optional. Developers are not forced to use Studio, CLI, framework adapters, optional feature implementations, or Moorkyz services.
