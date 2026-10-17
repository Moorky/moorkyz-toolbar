# Moorkyz Toolbar portal

The private Next.js portal consumes the real `@moorkyz/toolbar` package. SDK
contracts, feature defaults and framework-neutral architecture are unchanged.

## Functional Playground

- Four stateful local applications: Modern Workspace, Document Editor, Analytics
  Dashboard and Project Board. Toolbar commands operate actual local application
  state. Selection-aware formatting and board commands demonstrate host context.
- Ten structural presets, independently selectable from applications. Search,
  categories, favorites and reversible application/style changes are available.
- Manual light/dark token variants, contrast validation, opacity, blur, shadow,
  borders, font/icon sizing; the global theme selects a variant without replacing
  either palette. Translucency is validated against light and dark backdrops.
- Geometry includes intrinsic/explicit responsive width, height, gap, radius,
  position, alignment and offsets. Y=0 is bottom-attached. Explicit Edit Mode
  provides pointer/keyboard move and resize handles while commands are paused.
- Actions support add/remove/duplicate/rename/reorder, icons, tooltip, accessible
  name and allowlisted command selection. Incompatible/context-ineligible actions
  are disabled. Semantic action groups and arbitrary code are not SDK features.
- Versioned design JSON is separate from SDK configuration. Validate/import/
  export, last-valid preview, bounded undo/redo, confirmed reset/restore and
  configuration-only autosave are implemented. Application contents are never
  retained. Corrupt/newer autosaves remain preserved until explicit recovery.
- Desktop sidebar and mobile settings sheet resize by pointer or keyboard.
  Mobile is preview-first with separate Customize/Code views. Browser fullscreen
  has an explicitly reported expanded-view fallback and an accessible exit.
- Personalized Vanilla exports use the SDK generator and add validated styling/
  presentation files with recomputed SHA-256 integrity. Export is portable JSON
  containing source files, not an installer. The generated sample host reports
  action IDs; the four mini-applications are not part of the generated starter.

Only Vanilla generation is verified. React, Next.js, Vue and Angular consumer
fixtures are not additional framework generators. Before public distribution,
use the generated README's local SDK path workflow. The portal uses Light DOM
presentation hooks privately; these do not extend the public SDK schema.

## Development and verification

```powershell
pnpm --filter @moorkyz/portal dev
pnpm --filter @moorkyz/portal build
pnpm lint
pnpm format:check
pnpm typecheck
node --test tests\tooling\playground-design.test.js tests\tooling\playground-model.test.js
pnpm exec playwright test 'playground\.spec\.js' --workers=3
```

Run the production build before browser tests. Playwright selectors are regexes,
not backslash filesystem paths. Tests execute exported Vanilla presentation and
SDK lifecycle code, not merely inspect generated text.

Production uses a per-request nonce-based CSP with no unsafe inline scripts,
unsafe-inline styles or `unsafe-eval`. Development permits `unsafe-eval` only for
Next.js diagnostics. No visitor data is sent to a server.

The remaining website composition, fonts, compact Studio entry and explorers are
tracked in the [MVP plan](../../docs/engineering/website-mvp.md). Existing working
labs remain available during that slice. The [M10/M11 release
holds](../../docs/engineering/release-readiness.md) are unchanged; a validated
Playground is not production/distribution authorization.
