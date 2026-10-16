# Visual design, composition, interactions and accessibility

## Product appearance
Minimalist, soft glass, clean modern app-style floating dock at viewport bottom. Light-first styling in portal; optional dark mode. Motion is restrained, non-gimmicky and interruption-safe. Built-in theme families: Signature, Frosted Glass, Midnight, Warm Minimal, High Contrast and Project Adaptive. Themes are versioned token sets; contrast validation is mandatory.

## Composition
- Stable anchors for home/projects/search and contextual/common actions, customized per project. Flexible action slots adapt to context.
- Constraint-based layout, not arbitrary rigid fixed width. Constrain to viewport safe areas; preserve usable touch targets and user-pinned ordering; honor developer host layout constraints when configured.
- Horizontal overflow is *native scrolling* on narrow devices, with subtle gradient fades and conditional accessible chevrons. Do not force every control into a mandatory `More` menu.
- Preserve focus and scroll reachability across resize; avoid moving active controls during ongoing interactions. Critical permission revocations take effect immediately.
- Default fixed bottom center, with user manual collapse that leaves an operable restore handle; never auto-expand.

## Native-first motion
- Macro interactions ~220–350ms, micro ~120–180ms as preliminary design targets; final curves/durations tested, not arbitrary hard-coded universal deadlines.
- CSS/Web Animations API/native compositor features preferred, with lightweight coordinator for geometry/morphing and velocity-aware retargeting.
- On interruption, target latest valid presentation state while keeping typed state engine authoritative. No ghost overlays, stuck focus, or stale event completion.
- Respect `prefers-reduced-motion`; essential state changes occur without nonessential motion.

## Interaction ownership
- Host owns globals by default; toolbar keyboard shortcuts are opt-in and scoped. Reserved browser/OS shortcuts remain untouched. Resolve conflicts by host delegation + focus/surface/context hierarchy; equal-precedence conflicts produce diagnostics rather than arbitrary winners.
- Mouse, touch, pen and trackpad use native behavior first. Gesture recognition is adaptive, with advanced profiles **off by default**. Ordinary vertical page scroll and edge browser gestures may not be hijacked.
- Reordering only through explicit customization mode; long-press menus/right-click respect host policy. Every gesture action has an accessible alternative.
- Panels/popovers/search may morph in-dock or open bounded, contextual surfaces. Manage stacking, dismissal, inert behavior and focus restoration through a single surface controller.

## Accessibility release requirements
- Target **WCAG 2.2 AA** for all supported interactions; keyboard-only use, screen reader support, large text, zoom, reduced motion, visible focus, meaningful names, contrast, target sizing, RTL/bidi and touch cancellation.
- Accessibility cannot be disabled. Severe inaccessible extension contracts are rejected; lesser issues reported with guided remediation.
- Studio includes A11y inspection and guided fixes. Automate axe checks and manual assistive technology validation (automation alone isn't proof of conformance).
- Verify both Shadow DOM and Light DOM mode, overlays, portals, focus, host forms, iframes/fullscreen scenarios and hybrid input interactions.

## Design deliverables
Versioned token schema, component anatomy and state catalogue, motion spec, interaction-state matrix, default themes, responsive/keyboard scenarios, real component gallery and example fixtures. Documentation and implementation visuals should refer to the same components.
