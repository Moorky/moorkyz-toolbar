"use client";

import {
  usePortalSettings,
  type DemoPreset,
  presetActions,
} from "./portal-shell";

const options: ReadonlyArray<{
  readonly id: DemoPreset;
  readonly label: string;
  readonly description: string;
}> = [
  {
    id: "website",
    label: "Website",
    description: "Explore the product story, setup, and Studio roadmap.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Keep core navigation while surfacing the engineering story.",
  },
  {
    id: "editor",
    label: "Editor",
    description: "Bring appearance and documentation closer to the workflow.",
  },
  {
    id: "immersive",
    label: "Immersive",
    description: "Keep the dock compact and link directly to source material.",
  },
];

export function EnvironmentExplorer() {
  const { preset, setPreset } = usePortalSettings();
  const selected = options.find((option) => option.id === preset);
  const actions = presetActions(preset);

  return (
    <div className="environment-demo">
      <div className="environment-picker">
        <div className="environment-picker-heading">
          <span className="eyebrow">SELECT A CONTEXT</span>
          <span className="demo-live">
            <span aria-hidden="true" />
            LIVE SDK UPDATE
          </span>
        </div>
        <div
          className="preset-options"
          role="group"
          aria-label="Toolbar context"
        >
          {options.map((option) => (
            <button
              key={option.id}
              className="preset-option"
              type="button"
              aria-pressed={preset === option.id}
              onClick={() => setPreset(option.id)}
            >
              <span className="preset-index">
                {String(options.indexOf(option) + 1).padStart(2, "0")}
              </span>
              <span>{option.label}</span>
              <span className="preset-check" aria-hidden="true">
                {preset === option.id ? "Selected" : ""}
              </span>
            </button>
          ))}
        </div>
        <p className="preset-description" aria-live="polite">
          {selected?.description}
        </p>
      </div>
      <div className="context-readout">
        <div className="context-readout-top">
          <span>CONFIGURATION PREVIEW</span>
          <span className="context-badge">{selected?.label}</span>
        </div>
        <p>
          Selecting a preset calls <code>toolbar.update()</code> with this
          action set:
        </p>
        <ul aria-label={`${selected?.label} dock actions`}>
          {actions.map((action) => (
            <li key={action.id}>
              <span className="action-symbol" aria-hidden="true">
                ↗
              </span>
              <span>{action.label}</span>
              <code>{action.id}</code>
            </li>
          ))}
        </ul>
        <p className="readout-footnote">
          The host maps every action to an existing section; no app commands or
          permissions are simulated.
        </p>
      </div>
    </div>
  );
}
