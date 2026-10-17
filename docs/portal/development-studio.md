# `toolbar.moorkyz.com` — Developer portal and Development Studio

## Current implementation status

### Website/Playground MVP

The landing page now starts with the compact specified hero, an adaptive
keyboard-reachable header using an existing brand asset, and a functional
four-application Playground backed by the actual SDK. Modern Workspace,
Document Editor, Analytics Dashboard and Project Board have real page-local
state and host commands. Ten structurally different styles share a validated
composable design model, separate from the unchanged public SDK schema.

The eight-section accordion includes manual light/dark tokens, contrast-safe
material settings, responsive width/height/gap/radius/position/alignment/offsets,
explicit pointer/keyboard Edit Mode, full supported action operations,
context eligibility and validated JSON/import/export. History is bounded;
invalid edits retain the last valid preview. Design-only autosave is separate
from explicit saved snapshots; application task/document/board contents are
never automatically persisted. Corrupt/newer drafts are preserved until
explicit recovery. Compatible explicit v1 drafts have a validated migration.

The responsive workspace has a resizable desktop sidebar, mobile preview-first
settings sheet and code view, plus browser fullscreen with an explicit focus-view
fallback. The global theme controls all mounted SDK previews; Studio custom
palettes preserve their separate light/dark variants. DM Sans and DM Mono are
self-hosted with their full OFL notices.

Quick Start uses the existing Vanilla generator, adding validated presentation
and recomputed integrity metadata. Export is portable JSON containing source
files, not an installer. Browser tests run the downloaded source through its
actual generated local server and built SDK, including dispatch/disposal.
Additional framework generators and generated mini-applications are not claimed.

The full landing order now includes genuine capability/architecture explorers,
local documentation/navigation search, expandable Studio, documentation, open
source, final CTAs and exact footer branding. Existing labs are retained on
`/studio`, not discarded or duplicated across the landing page. Advanced
professional workflows, arbitrary code execution, personal multi-project
libraries and additional framework generators remain later-platform scope.
M10/M11 holds are unchanged. See the [portal guide](../../packages/portal/README.md)
and [durable MVP plan](../engineering/website-mvp.md) for verification and limits.

### Earlier SDK and Studio milestones

The earlier M6–M11 slice added a full JSON/visual workbench with confirmed,
versioned local file import/export, searchable versioned preview reference,
custom nonce-scoped theme authoring/import/export, validated scenario import,
trusted static extension recipes with permission/fault/revocation demonstrations,
an explicit local Inspector and the shared Vanilla starter generator. Studio
controls are disabled/inert until hydration so early input cannot be discarded.
No arbitrary user JavaScript runs in the privileged portal. The safe static
fallback is deliberate; untrusted-code execution and additional framework
generators are not advertised as implemented. See the
[current evidence and remaining acceptance](../engineering/release-readiness.md).

## Purpose

Deliver an actual product experience, not a marketing mock. The fixed bottom dock on this site **uses the actual `@moorkyz/toolbar` workspace library**. Website navigation, product narrative and context change demonstrate real capabilities. Portal light-first with optional dark mode; refined minimalist canvas and no showy unnecessary motion.

## Information architecture

| Area                 | User value                                         | Production acceptance                                                      |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Product landing      | Live dock, demos, technical story                  | Dock works as actual page navigation and respects context                  |
| Docs/API             | Search, versioned docs and runnable examples       | Latest stable defaults; explicit version selector; doc/API contract parity |
| Getting started      | Minimal install and framework recipes              | Genuine framework-specific and vanilla fixtures pass smoke tests           |
| Visual configurator  | Feature flags, placement, actions, context         | Real-time preview with validated schema; no arbitrary code execution       |
| Component Lab        | Components, states, keyboard/focus tests           | Real components with reproducible state scenarios                          |
| Scenario Lab         | Simulated app, viewport, faults, time, permissions | Deterministic replay/export and regression fixtures                        |
| Theme Design Studio  | Tokens, themes, contrast, custom appearance        | Accessible contrast checks, portable versioned theme files                 |
| Extension Studio     | Typed extension recipes and safe experiments       | Gallery; code execution isolated from privileged portal                    |
| Dock Inspector       | Opt-in diagnostics, lifecycle, motion and contexts | Does not appear in consumer production bundle default                      |
| Starter gallery      | Universal + website/dashboard/editor/game presets  | Generate real, independently tested projects                               |
| Upgrade assistant    | Read manifest, propose safe migrations             | Reviewable diffs; never silently overwrite edited source                   |
| Interactive learning | Optional self-paced tutorials/demos                | Easy skip/reset; not mandatory for using package                           |

## Studio experience

The MVP Playground has resizable/collapsible settings, focus/fullscreen views,
synchronized valid JSON/design updates, live preview, versioned file import/
export and browser-local configuration drafts. Disruptive replacement is
confirmed and undoable. Studio's independent SDK configurator retains its
explicit-save policy. Share links, arbitrary historical migrations and
multi-project libraries remain future work. No drafts go to a server and no
submitted JavaScript executes.

## Interactive generator

The existing generator supports Vanilla JavaScript and curated action presets.
The Playground composes presentation with those generated projects without
changing the SDK generator's public contract or local server allowlist.
React/Next.js/Vue/Angular consumers are maintained fixtures, not generated
starters. Further framework generation is planned only after validation.
Project manifests retain generator/sdk/template/schema versions and exact file
integrity; source belongs to the developer and is never silently overwritten.

## Code/preview isolation

Portal editors render submitted samples only through restrictive isolated execution contexts as appropriate; no privileged arbitrary code execution in docs. Show static safe fallback when execution is unavailable. Performance/compatibility checks cover CSP and supported browsers. A demo is marked functional only if it calls the same public SDK contract as consumers.

## Cross-module consistency

Single schema powers CLI validate, Studio forms, generator and docs; shared token definitions power Theme Studio and runtime; Scenario Lab fixtures feed Playwright regression suite. Distinct portal-only dependencies (Next.js, Monaco, MDX) must never enter the minimal browser package.
