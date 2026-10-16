# Moorkyz Toolbar portal

The portal is a separate Next.js consumer of the workspace library. The landing
page mounts `@moorkyz/toolbar` directly; its context picker updates the SDK's
action configuration and the host routes actions to real page sections.

## Development

From the repository root:

- `pnpm --filter @moorkyz/portal dev` builds the toolbar package and starts the
  Next.js development server.
- `pnpm --filter @moorkyz/portal lint`
- `pnpm --filter @moorkyz/portal typecheck`
- `pnpm --filter @moorkyz/portal build`

The project and its public API remain in development. The install command on
the page is identified as a future public-release command. Runtime search,
theme tokens, and Development Studio modules are not claimed as available.
The portal itself supports a local light/dark appearance preference.

Production requests receive a per-request nonce-based Content Security Policy.
The page uses dynamic rendering so Next.js can nonce its runtime scripts. The
production policy allows no inline scripts, unsafe-inline styles, or
`unsafe-eval`; development permits `unsafe-eval` only for Next.js diagnostics.
