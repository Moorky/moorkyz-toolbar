# Moorkyz Toolbar portal

The portal is a separate Next.js consumer of the workspace library. The landing
page mounts `@moorkyz/toolbar` directly. The first website/Playground vertical
slice adds a Modern Workspace task application, real SDK command dispatch,
configuration history, explicit versioned local save/restore, schema/policy
validation, and a personalized Vanilla Quick Start powered by the shared SDK
generator. The existing context picker and SDK-backed Studio labs remain
available below it.

## Website and Playground status

- The compact hero leads directly to the Playground. The adaptive header hides
  on downward scroll, returns on upward scroll/focus, and respects reduced motion.
  Branding uses the existing favicon asset.
- One global light/dark preference controls the website and new Workspace
  preview/SDK/generation without replacing the chosen built-in token family.
- The eight-section settings accordion exposes only supported functionality.
  The first slice has **one application and one structural style**; six SDK token
  families are palettes, not six distinct geometry styles.
- Workspace commands focus task creation, toggle completed visibility, and clear
  completed sample tasks. Tasks are page-local, bounded to 50, and resettable.
  Configuration undo/redo does not replay application commands.
- Save is explicit and configuration-only. Existing local drafts need confirmed
  replacement; restore is explicit, validated, confirmed and undoable. Corrupt or
  future-version drafts remain untouched. Storage failures retain in-memory work.
- JSON edits retain the last valid preview/code until applied. Imports cannot
  activate optional systems, escape the preview container or authorize commands.
- Quick Start reflects applied configuration and the global theme. Its versioned
  JSON export contains generated files and integrity metadata; it is not a ZIP,
  installer or automatic filesystem writer. The included README explains local
  SDK usage before publication. Generated host actions report IDs; the task app
  itself is not generated.

Next slices add three more distinct applications, 8–12 structural styles, manual
light/dark variants, geometry/action editing, resizable/fullscreen workspace and
the remaining website composition/explorers. DM Sans/DM Mono font assets are not
yet vendored; current typography uses local/system fallbacks. Existing Studio
labs retain independent experimental controls; synchronizing all advanced custom
theme experiments with the global variant is still pending.

## Development

From the repository root:

- `pnpm --filter @moorkyz/portal dev` builds the toolbar package and starts the
  Next.js development server.
- `pnpm --filter @moorkyz/portal lint`
- `pnpm --filter @moorkyz/portal typecheck`
- `pnpm --filter @moorkyz/portal build`

The project and its public API remain in development. Only Vanilla starter
generation is validated; adapter fixtures are not framework generators.
See [release readiness](../../docs/engineering/release-readiness.md) for the
unchanged M10/M11 holds. This slice is not the completed website MVP or release
authorization.

Focused checks (after `pnpm build`):

```powershell
node --test tests\tooling\playground-model.test.js
pnpm exec playwright test 'playground\.spec\.js|portal\.spec\.js|studio\.spec\.js' --workers=3
```

Playwright file arguments are regex selectors, not Windows filesystem paths.
The Playground suite executes the exported Vanilla files against the actual
built SDK and verifies action dispatch and `pagehide` disposal.

Production requests receive a per-request nonce-based Content Security Policy.
The page uses dynamic rendering so Next.js can nonce its runtime scripts. The
production policy allows no inline scripts, unsafe-inline styles, or
`unsafe-eval`; development permits `unsafe-eval` only for Next.js diagnostics.
