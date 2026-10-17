"use client";

import { useCallback, useMemo, useState } from "react";
import {
  THEME_NAMES,
  validateConfiguration,
  type ToolbarColorPreference,
  type ToolbarConfigurationInput,
  type ToolbarPlacementMode,
  type ToolbarTheme,
} from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import { CopyButton } from "./copy-button";

interface ConfiguratorDraft {
  readonly label: string;
  readonly actionLabel: string;
  readonly theme: ToolbarTheme;
  readonly colorScheme: ToolbarColorPreference;
  readonly placement: ToolbarPlacementMode;
  readonly search: boolean;
}

const INITIAL_DRAFT: ConfiguratorDraft = Object.freeze({
  label: "Preview toolbar",
  actionLabel: "Documentation",
  theme: "signature",
  colorScheme: "system",
  placement: "container",
  search: true,
});

const COLOR_SCHEMES = ["system", "light", "dark"] as const;
const PLACEMENT_MODES = ["viewport", "container", "fullscreen"] as const;

function createConfiguration(
  draft: ConfiguratorDraft,
): ToolbarConfigurationInput {
  return {
    label: draft.label,
    actions: [{ id: "docs", label: draft.actionLabel }],
    features: { search: draft.search, customize: false },
    theme: draft.theme,
    colorScheme: draft.colorScheme,
    placement: { mode: draft.placement },
    renderMode: "light",
  };
}

export function VisualConfigurator() {
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [appliedConfiguration, setAppliedConfiguration] =
    useState<ToolbarConfigurationInput>(() =>
      createConfiguration(INITIAL_DRAFT),
    );
  const [previewMessage, setPreviewMessage] = useState(
    "Apply a valid draft to update the preview.",
  );

  const validation = useMemo(
    () => validateConfiguration(createConfiguration(draft)),
    [draft],
  );
  const generatedCode = validation.ok
    ? `import type { ToolbarConfigurationInput } from "@moorkyz/toolbar";\n\nexport const toolbarConfiguration: ToolbarConfigurationInput = ${JSON.stringify(validation.value, null, 2)};`
    : null;
  const dispatchAction = useCallback((actionId: string) => {
    setPreviewMessage(`The host received action "${actionId}".`);
  }, []);
  const host = useMemo(() => ({ dispatchAction }), [dispatchAction]);
  const onMountError = useCallback((error: { readonly message: string }) => {
    setPreviewMessage(`Preview unavailable: ${error.message}`);
  }, []);

  function updateDraft<Key extends keyof ConfiguratorDraft>(
    key: Key,
    value: ConfiguratorDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyConfiguration() {
    if (!validation.ok) return;
    setAppliedConfiguration(validation.value);
    setPreviewMessage("Validated configuration applied to the live preview.");
  }

  return (
    <div className="configurator-workspace">
      <form
        className="configurator-controls"
        onSubmit={(event) => {
          event.preventDefault();
          applyConfiguration();
        }}
      >
        <div className="configurator-controls-heading">
          <span className="eyebrow">EDIT A SAFE CONFIGURATION</span>
          <p>Fields use the package validator. No code is evaluated.</p>
        </div>

        <label htmlFor="configurator-toolbar-label">Toolbar label</label>
        <input
          id="configurator-toolbar-label"
          maxLength={100}
          value={draft.label}
          onChange={(event) => updateDraft("label", event.currentTarget.value)}
        />

        <label htmlFor="configurator-action-label">Action label</label>
        <input
          id="configurator-action-label"
          maxLength={100}
          value={draft.actionLabel}
          onChange={(event) =>
            updateDraft("actionLabel", event.currentTarget.value)
          }
        />

        <label htmlFor="configurator-theme">Theme</label>
        <select
          id="configurator-theme"
          value={draft.theme}
          onChange={(event) => {
            const theme = THEME_NAMES.find(
              (name) => name === event.currentTarget.value,
            );
            if (theme !== undefined) updateDraft("theme", theme);
          }}
        >
          {THEME_NAMES.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>

        <label htmlFor="configurator-color-scheme">Color scheme</label>
        <select
          id="configurator-color-scheme"
          value={draft.colorScheme}
          onChange={(event) => {
            const colorScheme = COLOR_SCHEMES.find(
              (scheme) => scheme === event.currentTarget.value,
            );
            if (colorScheme !== undefined) {
              updateDraft("colorScheme", colorScheme);
            }
          }}
        >
          {COLOR_SCHEMES.map((scheme) => (
            <option key={scheme} value={scheme}>
              {scheme}
            </option>
          ))}
        </select>

        <label htmlFor="configurator-placement">Placement mode</label>
        <select
          id="configurator-placement"
          value={draft.placement}
          onChange={(event) => {
            const placement = PLACEMENT_MODES.find(
              (mode) => mode === event.currentTarget.value,
            );
            if (placement !== undefined) updateDraft("placement", placement);
          }}
        >
          {PLACEMENT_MODES.map((placement) => (
            <option key={placement} value={placement}>
              {placement}
            </option>
          ))}
        </select>

        <label className="configurator-checkbox">
          <input
            type="checkbox"
            checked={draft.search}
            onChange={(event) =>
              updateDraft("search", event.currentTarget.checked)
            }
          />
          Enable local toolbar search
        </label>

        {!validation.ok && (
          <div className="configurator-validation" role="alert">
            <strong>Fix these validation errors before applying:</strong>
            <ul>
              {validation.errors.map((error) => (
                <li key={`${error.path}:${error.code}`}>
                  {error.path}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="button button-primary configurator-apply"
          type="submit"
          disabled={!validation.ok}
        >
          Apply to live preview
        </button>
        <p className="configurator-status" role="status" aria-live="polite">
          {previewMessage}
        </p>
      </form>

      <div className="configurator-output">
        <div className="configurator-preview">
          <div className="configurator-preview-heading">
            <span>LIVE PREVIEW</span>
            <span>CONTAINER-FRAMED</span>
          </div>
          <div className="configurator-preview-surface">
            <ToolbarMount
              className="configurator-preview-mount"
              configuration={appliedConfiguration}
              host={host}
              onMountError={onMountError}
              aria-label="Live toolbar preview"
            />
          </div>
          <p>
            The preview is confined to this sample frame. The generated
            configuration retains the selected placement mode.
          </p>
        </div>

        <div className="configurator-code">
          <div className="configurator-code-heading">
            <div>
              <span className="code-language">TYPESCRIPT</span>
              <span className="code-filename">toolbar.config.ts</span>
            </div>
            {generatedCode !== null && (
              <CopyButton text={generatedCode} label="Copy configuration" />
            )}
          </div>
          {generatedCode === null ? (
            <p className="configurator-code-invalid">
              A valid configuration is required before code can be generated.
            </p>
          ) : (
            <pre aria-label="Validated toolbar configuration" tabIndex={0}>
              <code>{generatedCode}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
