"use client";

import { useState } from "react";
import { ComponentLab } from "./component-lab";
import { EnvironmentExplorer } from "./environment-explorer";
import { ExtensionStudio } from "./extension-studio";
import { ScenarioLab } from "./scenario-lab";
import { ThemeStudio } from "./theme-studio";
import { HydrationBoundary } from "./hydration-boundary";

const repository = "https://github.com/Moorky/moorkyz-toolbar";
const CAPABILITIES = [
  {
    id: "context",
    name: "Context awareness",
    text: "Deliberate host context changes update the real page-navigation dock. The Playground also demonstrates actual document and board selection.",
    kind: "live",
  },
  {
    id: "actions",
    name: "Actions & commands",
    text: "Use real SDK buttons. The application host receives IDs and retains execution authority.",
    kind: "live",
  },
  {
    id: "responsive",
    name: "Responsive overflow",
    text: "Narrow layouts retain native horizontal scrolling, stable controls and accessible scroll buttons.",
    kind: "live",
  },
  {
    id: "surfaces",
    name: "Search & surfaces",
    text: "Open the real local search surface. No provider or external network is required for the local fixture.",
    kind: "live",
  },
  {
    id: "themes",
    name: "Theme customization",
    text: "Author real SDK tokens, validate text/focus contrast and export versioned palettes.",
    kind: "live",
  },
  {
    id: "extensions",
    name: "Trusted extensions",
    text: "Register a trusted static recipe, revoke its host permission and inspect fault containment. This is not an untrusted-code sandbox.",
    kind: "live",
  },
  {
    id: "authorization",
    name: "Host authorization",
    text: "Simulate host denial, faults, controlled time and deterministic scenario replay against the SDK.",
    kind: "live",
  },
  {
    id: "geometry",
    name: "Geometry & positioning",
    text: "The Playground's geometry controls and explicit Edit Mode change the actual SDK toolbar. Advanced polygon editing is later platform scope.",
    kind: "playground",
  },
  {
    id: "accessibility",
    name: "Keyboard accessibility",
    text: "Use Tab, arrow keys and Escape in real controls. Accessibility cannot be switched off; manual AT acceptance is still a release gate.",
    kind: "live",
  },
  {
    id: "motion",
    name: "Motion & gestures",
    text: "Reduced motion is always respected. The Playground exposes supported presentation transitions; advanced gesture profiles remain explicit SDK integrations.",
    kind: "playground",
  },
  {
    id: "persistence",
    name: "Local persistence",
    text: "Versioned autosave, explicit snapshots, validated recovery and portable JSON are functional in the Playground. No cloud account or automatic sharing.",
    kind: "playground",
  },
  {
    id: "diagnostics",
    name: "Reliability & diagnostics",
    text: "The dedicated workbench includes a local Inspector that acquires resources only after explicit activation.",
    kind: "studio",
  },
] as const;

export function CapabilityExplorer({ nonce }: { readonly nonce: string }) {
  const [selected, setSelected] =
    useState<(typeof CAPABILITIES)[number]["id"]>("context");
  const capability =
    CAPABILITIES.find(({ id }) => id === selected) ?? CAPABILITIES[0];
  return (
    <HydrationBoundary label="Capability explorer">
      <div className="capability-explorer">
        <div
          className="explorer-options"
          role="group"
          aria-label="Capability categories"
        >
          {CAPABILITIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={selected === entry.id}
              onClick={() => setSelected(entry.id)}
            >
              {entry.name}
              <span>
                {entry.kind === "live"
                  ? "Live"
                  : entry.kind === "playground"
                    ? "Playground"
                    : "Studio"}
              </span>
            </button>
          ))}
        </div>
        <div className="explorer-demo" aria-live="polite">
          <h3>{capability.name}</h3>
          <p>{capability.text}</p>
          {selected === "context" ? (
            <EnvironmentExplorer />
          ) : selected === "themes" ? (
            <ThemeStudio nonce={nonce} />
          ) : selected === "extensions" ? (
            <ExtensionStudio />
          ) : selected === "authorization" ? (
            <ScenarioLab />
          ) : capability.kind === "live" ? (
            <ComponentLab
              key={selected}
              initialScenario={
                selected === "responsive"
                  ? "narrow"
                  : selected === "surfaces"
                    ? "search"
                    : "default"
              }
            />
          ) : (
            <a
              className="button button-secondary"
              href={
                capability.kind === "studio"
                  ? "/studio#configurator"
                  : "#playground"
              }
            >
              Open working {capability.kind}
            </a>
          )}
        </div>
      </div>
    </HydrationBoundary>
  );
}

const LAYERS = [
  {
    id: "core",
    title: "SDK Core",
    text: "Framework-neutral configuration, capability registry, deterministic context and command contracts. Browser imports are SSR-safe.",
    code: 'import { validateConfiguration } from "@moorkyz/toolbar";\nconst result = validateConfiguration({ actions: [] });\nif (!result.ok) console.error(result.errors);',
    path: "packages/toolbar/src/index.ts",
  },
  {
    id: "renderer",
    title: "Rendering & layout",
    text: "The DOM controller owns mount/update/dispose, surfaces, native overflow and accessible interactions. Shadow DOM is the default; this portal explicitly uses Light DOM.",
    code: "const mounted = toolbar.mount(document.body);\nif (!mounted.ok) throw new Error(mounted.error.message);\n// On host teardown:\ntoolbar.dispose();",
    path: "packages/toolbar/src/toolbar.ts",
  },
  {
    id: "adapters",
    title: "Framework adapters",
    text: "Optional React, Vue and Angular entry points wrap the same core. React also covers Next.js client boundaries. Adapters are not extra generated starters.",
    code: 'import { ToolbarMount } from "@moorkyz/toolbar/react";\n// configuration and host use the same SDK contracts.',
    path: "examples",
  },
  {
    id: "commands",
    title: "Actions & host authority",
    text: "The host owns permissions and sensitive effects. Typed command policy supports concurrency, cancellation and timeouts; presentation does not grant permission.",
    code: 'import type { ToolbarHost } from "@moorkyz/toolbar";\nconst host: ToolbarHost = {\n  dispatchAction: (id) => console.info("Host action:", id),\n};',
    path: "packages/toolbar/src/commands.ts",
  },
  {
    id: "context",
    title: "Context & capabilities",
    text: "Host-fed context and scoped capability registrations resolve deterministically. Context cannot authorize itself or restore a manually collapsed dock.",
    code: 'import type { ToolbarConfigurationInput } from "@moorkyz/toolbar";\nconst configuration: ToolbarConfigurationInput = {\n  features: { spatialCoordination: false, ai: false },\n};',
    path: "docs/contracts/sdk-and-schema.md",
  },
  {
    id: "extensions",
    title: "Extension boundaries",
    text: "Trusted same-realm extensions have scoped registration, explicit host authorization, failure containment and cleanup. Arbitrary public code execution is unavailable.",
    code: 'import { createTrustedExtensionRegistry }\n  from "@moorkyz/toolbar/extensions";\n// Trusted integration only; not a security sandbox.',
    path: "packages/toolbar/src/extensions.ts",
  },
] as const;
export function ArchitectureExplorer() {
  const [selected, setSelected] =
    useState<(typeof LAYERS)[number]["id"]>("core");
  const layer = LAYERS.find(({ id }) => id === selected) ?? LAYERS[0];
  return (
    <HydrationBoundary label="Architecture explorer">
      <div className="architecture-explorer">
        <div
          className="architecture-layers"
          role="group"
          aria-label="Architecture layers"
        >
          {LAYERS.map((entry) => (
            <button
              type="button"
              key={entry.id}
              aria-pressed={selected === entry.id}
              onClick={() => setSelected(entry.id)}
            >
              {entry.title}
            </button>
          ))}
        </div>
        <article aria-live="polite">
          <h3>{layer.title}</h3>
          <p>{layer.text}</p>
          <pre tabIndex={0} aria-label={`${layer.title} code example`}>
            <code>{layer.code}</code>
          </pre>
          <a
            href={`${repository}/${layer.path === "examples" ? "tree" : "blob"}/master/${layer.path}`}
          >
            Inspect the actual source/contract ↗
          </a>
        </article>
      </div>
    </HydrationBoundary>
  );
}

export function StudioShowcase() {
  const [expanded, setExpanded] = useState(false);
  return (
    <HydrationBoundary label="Development Studio showcase">
      <div className="studio-showcase">
        <p>
          Configuration, components, scenario replay, theme authoring, trusted
          extensions and opt-in local diagnostics are working SDK consumers.
          Arbitrary code execution, professional workflow tooling and additional
          generators are future capabilities.
        </p>
        <div className="workbench-actions">
          <button
            className="button button-secondary"
            type="button"
            aria-expanded={expanded}
            aria-controls="studio-embedded"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Collapse Studio preview" : "Expand Studio preview"}
          </button>
          <a className="button button-primary" href="/studio">
            Open Development Studio ↗
          </a>
        </div>
        <div id="studio-embedded" hidden={!expanded}>
          {expanded && <ComponentLab />}
        </div>
      </div>
    </HydrationBoundary>
  );
}
