# Contract-first SDK and schema design

> **Proposal, not a finalized or implemented API.** Finalize these shapes during milestone M1 and publish machine-readable schemas/types with contract tests. Illustrative identifiers below are deliberately marked **proposed**.

## Public API design principles
1. **Minimum onboarding:** install package; define actions or host context; mount. No account, backend, CLI, or complex project scaffold needed.
2. **One coherent API:** typed declarative configuration + typed imperative controller; stable subpath exports where useful.
3. **Versioned contracts:** semantic versioning, generated docs tied to versions, schema migrations, deprecation guidance, deterministic validation errors.
4. **Boundary-aware behavior:** host permissions for commands/navigation; capability registry never grants authority itself.
5. **Portable inputs:** serializable configuration for Studio/generator, and non-serializable host callbacks registered through typed adapter hooks. Never serialize credentials or executable functions into share links.

## Candidate interface (illustrative)
```ts
// These symbols are DRAFTS: do not treat them as accepted export names.
interface ToolbarFeatureFlags {
  search: boolean;            // true
  ai: boolean;                // false
  tasks: boolean;             // false
  notifications: boolean;     // false
  discovery: boolean;         // false
  platform: boolean;          // true (base platform responsiveness)
  customize: boolean;         // true
  spatialCoordination: boolean; // false, independent optional module
  offline: boolean;           // false
  diagnostics: boolean;       // false
  advancedGestures: boolean;  // false
  experimental: boolean;     // false
}
interface ToolbarConfiguration {
  schemaVersion: string;
  features?: Partial<ToolbarFeatureFlags>;
  actions?: ReadonlyArray<ActionDescriptor>;
  placement?: PlacementConfig;    // bottom/viewport default
  theme?: ThemeReference;
  host?: HostIntegration;          // callbacks/permissions, never serialized
}
interface ToolbarController {
  mount(target?: HTMLElement): Result<void>;
  update(patch: Partial<ToolbarConfiguration>): Result<void>;
  dispose(): void;
  // registerCapability, executeCommand, openSurface etc. to be specified
}
```

This is a **design seed**, not a claim that these interfaces are ready to compile. Real contract definition must settle sync/async lifecycle return semantics; permission vocabulary; typed generic context; cancellation; lifecycle ownership; error codes; namespaced action identifiers; host adapter boundaries; browser/SSR behavior and schema validation.

## Define before production implementations
| Contract | Consumer / producer | Conditions for approval |
|---|---|---|
| Config schema | Host, CLI, Studio, generator | Version, defaults, canonical normalization, unknown-key policy |
| Controller lifecycle | Host -> core | SSR-safe import, idempotent mount/dispose, instance isolation |
| Capability registry | Extensions -> host/core | Ownership, transactions, policy checks, namespace collision rules |
| Context selector | Host -> core | Typed hierarchical scopes, stale event invalidation, interaction-stability |
| Command schema | Host/controller/extensions | Concurrency, cancellation, timeouts, retries off unless safe and explicit |
| Navigation adapter | Core -> host | Route ownership, URL validation, optional authenticated handoff |
| Surface/focus contract | Core -> renderers | Accessibility state, stack bounds, dismissal policy, error cleanup |
| Input/gesture contract | Host + core + extensions | Shortcut arbitration, touch/pointer intent, reserved browser interactions |
| Mount/placement schema | Renderer/host | viewport/container/fullscreen modes, safe areas, optional exclusion registry |
| Persistence schema | User preferences | Namespaced keys, version migrations, consent, storage fallback |
| Extension manifest | Extension author -> registry | trust level, optional imports, capability grants, cleanup, validation |
| Theme/token schema | Theme Studio + renderer | accessible contrast, safe CSS values, portable versioned files |
| Generator manifest | Studio/CLI -> consumer | compatible SDK/framework/template versions, checksums where appropriate |
| Diagnostic codes | SDK/CLI/Studio | stable code, severity, remediation, safe redaction, no default telemetry |

## Generated project contract
The generator emits a versioned local manifest with generator/template/config-schema/SDK versions, selected feature flags, source origin and migration metadata. The manifest must **not** claim that user-modified files can be safely overwritten. Upgrade assistance defaults to a dry-run/change preview and requires explicit consent to write changes. Do not embed secrets, user data, or authentication tokens.

## CLI contract
Optional Node binary exposed from the **same package**. Proposed commands: `init`, `add`, `validate`, `doctor`, `upgrade`, `examples`, `help`, `version`. `--dry-run`, non-interactive flags, structured output and correct exit codes are required where applicable. CLI modules must not be imported into browser entry points. Avoid silently modifying pre-existing files. Exact commands and flags are formalized via golden tests and docs.

## Compatibility and experimental policy
Stable SDK follows SemVer with documented migrations and deprecations. Explicit experimental namespace or subpath is optional, unmistakably labeled, tested and version-policy documented, and cannot bypass core security/accessibility checks. Never silently promote experimental behavior into stable defaults.

## M1 implemented draft

The workspace now contains an **implemented but unapproved draft** of the first configuration contract in `packages/toolbar/src/index.ts`, including a machine-readable JSON Schema. It is not a stable public API and may change before explicit contract approval. Validator key sets are derived from that schema object so the runtime validator and Studio/CLI consumers can share the same source.

- Schema version is `1.0`; omitted version normalizes to `1.0`, and unsupported versions fail validation.
- Feature defaults follow the approved baseline: `search`, `platform`, and `customize` are enabled; AI, tasks, notifications, discovery, spatial coordination, offline, diagnostics, advanced gestures, and experimental integrations are disabled.
- Unknown properties, non-boolean feature values, invalid render modes, malformed/duplicate action IDs, empty labels, prototype-bearing objects, and accessor properties produce stable diagnostic codes and paths.
- Action descriptors are data-only (`id`, `label`); host behavior and authorization callbacks are not serializable configuration.
- Validation normalizes defaults and returns immutable result data. Importing the contract module has no browser-global access or runtime side effects.
- Vanilla and React consumer fixtures compile against the package; the React example exercises the framework-neutral controller through an effect-owned mount/dispose lifecycle. CLI/Studio schema consumption, dedicated framework adapters, and approved public names are not yet implemented.
- The initial DOM controller now mounts to a host-owned element, uses Shadow DOM by default (Light DOM is opt-in), renders only text nodes and native buttons, dispatches actions only through a host callback, and provides manual collapse/restore, scoped keyboard navigation, atomic partial updates, and disposal. Update patches merge feature overrides and replace action lists only when supplied. Its stylesheet is a same-package asset (no inline styles or external URL).

See [`packages/toolbar/test/configuration.test.js`](../../packages/toolbar/test/configuration.test.js) for executable boundary tests. Feature-key names and diagnostics remain proposals until contract review; approved feature semantics and defaults may not be changed.

## Schema validation gate
Schema definitions must be the shared source for typed validation, Studio controls, CLI validation, generator, reference docs and representative consumer fixtures. The code generator must not independently invent a second config interpretation.
