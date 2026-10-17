# Human acceptance checklist: website and Playground MVP

These checks remain **NOT RUN by the agent**. Automated axe, browser emulation,
local performance observations and an internal security review do not establish
WCAG conformance, physical-device support or independent release certification.
The [release dossier](release-readiness.md) retains the M10/M11 holds.

## Record the test environment

For each run, record date, source revision, OS/device, browser/version, assistive
technology/version, input method, viewport/zoom/text settings, selected theme,
observed result, defects and reviewer. Final supported versions and numerical
test conditions require approval (V03/V04); the combinations below are proposed
coverage, not an approved compatibility promise.

- [ ] Windows: NVDA with Firefox and Chromium.
- [ ] macOS: VoiceOver with Safari; keyboard-only and trackpad use.
- [ ] iPhone/iPad: VoiceOver with Safari and real on-screen keyboard/rotation.
- [ ] Android: TalkBack with Chrome and real touch/keyboard behavior.
- [ ] Representative low-power hardware and reduced-motion/high-contrast settings.

## Website, navigation and dialogs

- [ ] Navigate every implemented route (`/`, `/studio`, `/contributing`) using only
  keyboard and then the selected screen reader.
- [ ] Verify landmarks/headings, skip link, meaningful control names and complete
  focus order. Adaptive navigation must reveal on focus and never obscure it.
- [ ] Open search by its button and Ctrl/Cmd K. Verify result names, zero results,
  native focus containment, Escape with a nonempty query, and focus restoration.
  Shortcuts inside editors and application inputs must remain host-owned.
- [ ] Check page-dock scrolling/collapse/restore, page anchors and both footer
  tiers. `powered by Moorkyz` must lead to `https://moorkyz.com`.
- [ ] At 200% text and 200%/400% native zoom, confirm reflow, code-only horizontal
  scrolling, usable navigation and visible focus without content loss.

## Playground, templates and editing

- [ ] Use all four applications and all ten styles in light/dark themes, including
  narrow/intermediate widths, large text and safe-area/notched screens.
- [ ] Switch applications with unfinished task/card input. Drafts must remain
  isolated; resetting another application must not clear them.
- [ ] In Document Editor, verify selection announcements, Unicode formatting,
  word count, keyboard selection, length-limit feedback and reset.
- [ ] Verify Analytics filtering/period/sorting through real toolbar commands,
  and select/move/archive/reset Project Board cards.
- [ ] Traverse the one-open-section accordion, template categories/search/
  favorites and the entire Actions editor. Unavailable commands must be
  disabled and understandable without relying on color.
- [ ] Verify token contrast failures, independent light/dark palette buffers,
  live preview, invalid JSON, import confirmation, and last-valid output.
- [ ] Exercise numeric and pointer/keyboard geometry editing. Check top/bottom
  anchor direction, X movement, offsets, Y=0, cancellation and one-step undo.
- [ ] Scroll through the page at intermediate positions: preview and page docks
  must not overlap or hide focus/interaction targets.
- [ ] On real mobile hardware, open/resize/close the settings sheet and code
  view. Background preview controls must not steal keyboard/screen-reader focus.
- [ ] Enter native fullscreen and denied/unsupported fallback; settings, code,
  status feedback and exit must remain available. Verify focus restoration,
  orientation changes, safe areas, keyboard-induced viewport resizing and zoom.

## Reliability and integration

- [ ] Confirm design-only autosave; task, document and board contents must not be
  silently retained. Verify quota/blocked-storage feedback and memory/export use.
- [ ] Recover valid, corrupt and newer-version drafts without silent replacement.
  Cancel replacement/reset/import and verify current design remains unchanged.
- [ ] Interrupt unapplied JSON/color editing using reload/back/close. Verify the
  browser warning and cancellation; deliberately leaving may discard unapplied
  edits, while the last valid saved design remains recoverable.
- [ ] Deny clipboard/download/fullscreen APIs. Feedback must be visible and
  announced, with a usable retry/manual-copy path where available.
- [ ] Generate/export a Vanilla project, save its files in a new directory and
  run the included local server against the built SDK. Verify styling, geometry,
  disabled commands, host dispatch and teardown. This does not certify extra
  framework generators or include the Playground sample applications.
- [ ] In Studio, collapse a preview, then change global theme/custom palettes;
  it must remain collapsed until explicit expansion. Exercise each working lab,
  scenario/authorization/fault state and opt-in Inspector cleanup.

## Remaining release evidence and approvals

- [ ] Independent security/release review, separate from agent self-assessment.
- [ ] Approved platform/version matrix and performance measurement conditions.
- [ ] Field/representative-device assessment of LCP <=2.5s, INP <=200ms and CLS
  <=0.1. Local headless observations are not field Core Web Vitals.
- [ ] Distribution/license/notice review, including separate font OFL notices.
- [ ] Container-engine build/runtime acceptance when a local approved engine is
  available; a CLI without a reachable daemon is insufficient evidence.
- [ ] Explicit M11 authorization before any push/release/publication/deployment/
  signing, paid infrastructure or integration into another Moorkyz application.

A checked item requires recorded observed evidence, not an assumption. Keep
failures open until corrected and retested; do not convert this checklist into
a certification claim.
