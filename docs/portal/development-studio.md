# `toolbar.moorkyz.com` — Developer portal and Development Studio

## Current implementation status
The private Next.js app in `packages/portal/` is an early portal foundation, not the complete Studio. It mounts the workspace library for page navigation, updates real actions from the context picker, offers a locally persisted light/dark site preference, includes a schema-validated visual configurator with a real toolbar preview and generated TypeScript configuration, and provides state-driven Component and Scenario Labs using the same library. The Scenario Lab simulates context, viewport, time, host authorization decisions, and host faults; snapshots are page-local and copied as data, never executed. Users can explicitly save, restore, or delete a versioned configuration draft in this browser; replacing or deleting a saved draft requires confirmation, ordinary edits are not written automatically, and no draft is uploaded. The production build applies a nonce-based CSP through the Next.js Proxy. The M8 acceptance gates for versioned docs, broader Scenario/Theme/Extension labs, generator, and robust migration/recovery remain open.

## Purpose
Deliver an actual product experience, not a marketing mock. The fixed bottom dock on this site **uses the actual `@moorkyz/toolbar` workspace library**. Website navigation, product narrative and context change demonstrate real capabilities. Portal light-first with optional dark mode; refined minimalist canvas and no showy unnecessary motion.

## Information architecture
| Area | User value | Production acceptance |
|---|---|---|
| Product landing | Live dock, demos, technical story | Dock works as actual page navigation and respects context |
| Docs/API | Search, versioned docs and runnable examples | Latest stable defaults; explicit version selector; doc/API contract parity |
| Getting started | Minimal install and framework recipes | Genuine framework-specific and vanilla fixtures pass smoke tests |
| Visual configurator | Feature flags, placement, actions, context | Real-time preview with validated schema; no arbitrary code execution |
| Component Lab | Components, states, keyboard/focus tests | Real components with reproducible state scenarios |
| Scenario Lab | Simulated app, viewport, faults, time, permissions | Deterministic replay/export and regression fixtures |
| Theme Design Studio | Tokens, themes, contrast, custom appearance | Accessible contrast checks, portable versioned theme files |
| Extension Studio | Typed extension recipes and safe experiments | Gallery; code execution isolated from privileged portal |
| Dock Inspector | Opt-in diagnostics, lifecycle, motion and contexts | Does not appear in consumer production bundle default |
| Starter gallery | Universal + website/dashboard/editor/game presets | Generate real, independently tested projects |
| Upgrade assistant | Read manifest, propose safe migrations | Reviewable diffs; never silently overwrite edited source |
| Interactive learning | Optional self-paced tutorials/demos | Easy skip/reset; not mandatory for using package |

## Studio experience
Adaptive modular workspace: resizable/collapsible panels, focus views, synchronized config/code editing and live preview; require confirmation before disruptive updates. Browser-local drafts/snapshots (IndexedDB or appropriate fallback), versioned export/import files and safe shareable configuration links. Do not send drafts to an unapproved server or export secrets. Ensure explicit recovery after invalid schema versions. The current configurator supports explicit versioned local save/restore/delete with validation, but not automatic persistence, file import/export, migrations, or generated-code execution.

## Interactive generator
Supports blank minimal template plus curated environment presets; framework starters for Vanilla TS, React, Next.js, Vue, Angular and app scenarios as each is individually validated. Generate runnable new projects and non-destructive *add-to-existing* integrations. Project manifest records generator/sdk/template/schema versions, flags, and upgrade metadata. Readable source is owned by developer; no automatic regeneration overwrite.

## Code/preview isolation
Portal editors render submitted samples only through restrictive isolated execution contexts as appropriate; no privileged arbitrary code execution in docs. Show static safe fallback when execution is unavailable. Performance/compatibility checks cover CSP and supported browsers. A demo is marked functional only if it calls the same public SDK contract as consumers.

## Cross-module consistency
Single schema powers CLI validate, Studio forms, generator and docs; shared token definitions power Theme Studio and runtime; Scenario Lab fixtures feed Playwright regression suite. Distinct portal-only dependencies (Next.js, Monaco, MDX) must never enter the minimal browser package.
