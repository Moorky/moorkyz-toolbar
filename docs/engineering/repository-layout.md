# Proposed repository layout (not yet created in GitHub)

```text
moorkyz-toolbar/
├── AGENTS.md
├── README.md
├── LICENSE                        # Apache-2.0
├── package.json                   # Private workspace root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── docs/
│   ├── decisions/
│   ├── architecture/
│   ├── contracts/
│   ├── design/
│   ├── portal/
│   └── engineering/
├── packages/
│   └── toolbar/                   # SINGLE PUBLIC package: @moorkyz/toolbar
│       ├── src/
│       │   ├── core/              # State, context, capabilities, commands
│       │   ├── dom/               # Native renderer and mount contexts
│       │   ├── surfaces/          # Focus, overlay, expansion
│       │   ├── interaction/       # Input arbitration and motion
│       │   ├── placement/         # Core positioning; optional spatial module
│       │   ├── themes/            # Tokens and theme definitions
│       │   ├── persistence/       # Local, versioned preference handling
│       │   ├── features/          # Independently optional modules
│       │   ├── adapters/          # Optional framework exports
│       │   ├── cli/               # Node-only public CLI entry
│       │   └── experimental/      # Explicit opt-in only
│       └── tests/
├── apps/
│   └── portal/                    # Next.js/React/MDX, NOT a library dependency
├── examples/                      # Real consumer fixture apps
├── tooling/                       # Private generation and CI tooling
└── .github/
    ├── workflows/                 # CI, dependency safety and gated release prep
    └── ...
```

**Not fixed:** exact filenames, folder splits, build tool versions, runtime dependency set, and framework adapter implementation form. The architecture principle *is fixed*: one public library, private tooling/apps, strict runtime module isolation and contract-driven documentation. Inspect actual repo before applying structure to avoid overwriting pre-existing work.

## Implemented scaffold

The current repository has the private pnpm workspace, `packages/toolbar` TypeScript package, a Next.js consumer in `packages/portal`, vanilla/React consumer fixtures, and browser tests. The portal is a private workspace app, not a public package. The root CI workflow runs package/portal builds and workspace checks. Framework adapters, generator, and the rest of the proposed tree remain unimplemented until their roadmap milestones.

## Repo command distinction
`.\moorkyz.cmd start|stop|help` is the project-maintainer workflow for the portal. Public consumer tool is `pnpm exec moorkyz-toolbar ...`, from the single npm package. Neither is automatically authorized to deploy or publish.
