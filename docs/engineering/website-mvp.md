# Website and functional Playground MVP

Baseline: `e84bc37`; first vertical slice: `02f9601`. This plan implements the
MVP in the product specification, not its advanced-platform phases 4–6.

| Slice | Acceptance | Status |
|---|---|---|
| Foundation | Real SDK Workspace, shared theme, history, local drafts, Vanilla generation | Implemented in `02f9601` |
| Functional Playground | Four applications; ten structural styles; manual light/dark tokens; geometry/edit mode; action editing; validated portable design; autosave recovery | Implemented in `537fb64`, with final recovery/presentation hardening in the website acceptance commit |
| Complete website | Ordered landing sections; local DM fonts; real capability/architecture explorers and search; dedicated working Studio; responsive sheet/fullscreen workspace; footer | Implemented and verified locally |
| Hardening | Full automated gates, executed generated consumers, keyboard/axe, responsive/visual tests, dependency/source/bundle/performance evidence | PASS: 198 Node tests, 183 browser cases, all typechecks/build/lint/format, SDK coverage, dependency/source and bundle checks |
| Acceptance audit | Evidence and known limitations, focused commits, unchanged M10/M11 holds | Recorded in [final MVP audit](../audits/2026-10-17T06-04-23Z-website-mvp-acceptance.md); manual release gates remain on hold |
| Final quality assurance | Independent baseline, rendered route/theme/width matrix, failure/keyboard recovery, performance and contract-preserving corrections | Implemented and verified; 203 Node tests and 243 browser cases. Human/device/container/independent release evidence remains separate. |

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

## Delivered scope and remaining platform work

The approved website/Playground MVP is implemented and has passed its local
automated acceptance. This is **not** completion of every long-term item in the
comprehensive specification. Its advanced phases explicitly remain outside this
MVP: 16+ applications, 40+ styles, multi-project/personal style libraries,
professional geometry/workflow/integration designers, arbitrary code sandboxes,
additional framework generators, extensive learning and cloud/share features.
The UI identifies those as future capabilities instead of advertising fake tools.

Manual screen-reader/touch/device acceptance, independent security/release review,
approved numerical/platform scope, distribution notices and container evidence
are still required under M10. M11 still requires separate release authorization.
No publishing, deployment or production-readiness claim follows from this plan.

The follow-up QA keeps the four-app/ten-style scope unchanged. It makes only the
Playground wider (explicit user confirmation), corrects fullscreen/sheet/focus/
geometry/theme/reflow defects, isolates application drafts, improves export and
generation recovery, defers inactive editor controls, and preserves SDK cleanup
and documented React ownership semantics. See the
[human acceptance checklist](manual-mvp-acceptance.md) for work that cannot be
certified through local headless testing.
Exact final evidence, resolved findings and residual gates are in the
[final quality-assurance audit](../audits/2026-10-17T12-22-25Z-final-mvp-qa.md).
