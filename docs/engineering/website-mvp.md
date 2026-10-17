# Website and functional Playground MVP

Baseline: `e84bc37`; first vertical slice: `02f9601`. This plan implements the
MVP in the product specification, not its advanced-platform phases 4–6.

| Slice | Acceptance | Status |
|---|---|---|
| Foundation | Real SDK Workspace, shared theme, history, local drafts, Vanilla generation | Implemented in `02f9601` |
| Functional Playground | Four applications; ten structural styles; manual light/dark tokens; geometry/edit mode; action editing; validated portable design; autosave recovery | Implemented; 30 three-engine browser cases and 7 model tests pass |
| Complete website | Ordered landing sections; local DM fonts; real capability/architecture explorers and search; dedicated working Studio; responsive sheet/fullscreen workspace; footer | Pending; depends on Playground |
| Hardening | Full automated gates, executed generated consumers, keyboard/axe, responsive/visual tests, dependency/source/bundle/performance evidence | Pending; depends on website |
| Acceptance audit | Evidence and known limitations, focused commits, unchanged M10/M11 holds | Pending; depends on hardening |

## Implementation boundaries

- Preserve public SDK contracts. Portal presentation and template-host contracts
  are private, versioned, validated data, not new SDK configuration keys.
- Reuse the SDK renderer, schema, theme validation and Vanilla generator.
  Additional framework generators and arbitrary code execution remain unavailable.
- Autosave only design/configuration in a separate local namespace. Never retain
  application document/task contents automatically. Preserve unreadable/future
  saved data until an explicit recovery/replacement decision.
- Imported commands cannot grant host authority. Unknown operations are rejected;
  incompatible/context-ineligible operations are visibly disabled.
- Geometry and presentation in exports must match the preview; recompute generated
  file integrity when adding presentation files. Do not pretend a palette is a
  distinct structural style.
- No deployment, publishing, signing, spending or cross-project integration.
  Manual device/assistive-technology acceptance and all existing M10/M11 holds
  remain release gates even after the automated MVP checks pass.

Exact commands, measurements, decisions and remaining work belong in each
slice's task audit. Update this status from actual verification, not UI presence.
