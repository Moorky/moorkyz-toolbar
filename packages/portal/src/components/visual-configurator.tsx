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
const SAVED_DRAFT_KEY = "moorkyz-toolbar:portal:visual-configurator:v1";
const SAVED_DRAFT_VERSION = 1;

type SavedDraftResult =
  | {
      readonly ok: true;
      readonly draft: ConfiguratorDraft;
      readonly configuration: ToolbarConfigurationInput;
    }
  | { readonly ok: false; readonly message: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(record);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.hasOwn(record, key))
  );
}

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

function parseSavedDraft(raw: string): SavedDraftResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      message:
        "Saved draft is not valid JSON. Your current draft is unchanged.",
    };
  }
  if (
    !isPlainRecord(parsed) ||
    !hasExactKeys(parsed, ["version", "draft"]) ||
    parsed.version !== SAVED_DRAFT_VERSION
  ) {
    return {
      ok: false,
      message:
        "Saved draft has an unsupported format or version. Your current draft is unchanged.",
    };
  }

  const savedDraft = parsed.draft;
  if (
    !isPlainRecord(savedDraft) ||
    !hasExactKeys(savedDraft, [
      "label",
      "actionLabel",
      "theme",
      "colorScheme",
      "placement",
      "search",
    ])
  ) {
    return {
      ok: false,
      message:
        "Saved draft has an unsupported format or version. Your current draft is unchanged.",
    };
  }

  const theme =
    typeof savedDraft.theme === "string"
      ? THEME_NAMES.find((name) => name === savedDraft.theme)
      : undefined;
  const colorScheme =
    typeof savedDraft.colorScheme === "string"
      ? COLOR_SCHEMES.find((scheme) => scheme === savedDraft.colorScheme)
      : undefined;
  const placement =
    typeof savedDraft.placement === "string"
      ? PLACEMENT_MODES.find((mode) => mode === savedDraft.placement)
      : undefined;
  if (
    typeof savedDraft.label !== "string" ||
    typeof savedDraft.actionLabel !== "string" ||
    theme === undefined ||
    colorScheme === undefined ||
    placement === undefined ||
    typeof savedDraft.search !== "boolean"
  ) {
    return {
      ok: false,
      message:
        "Saved draft fields are invalid. Your current draft is unchanged.",
    };
  }

  const draft: ConfiguratorDraft = {
    label: savedDraft.label,
    actionLabel: savedDraft.actionLabel,
    theme,
    colorScheme,
    placement,
    search: savedDraft.search,
  };
  const validation = validateConfiguration(createConfiguration(draft));
  if (!validation.ok) {
    const details = validation.errors
      .map(({ path, message }) => `${path}: ${message}`)
      .join(" ");
    return {
      ok: false,
      message: `Saved draft failed schema validation: ${details} Your current draft is unchanged.`,
    };
  }
  return { ok: true, draft, configuration: validation.value };
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
  const [storageMessage, setStorageMessage] = useState(
    "Drafts are stored only when you choose Save draft locally.",
  );
  const [pendingStorageAction, setPendingStorageAction] = useState<
    "replace" | "delete" | null
  >(null);

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
    setStorageMessage("Unsaved changes are stored only in this page.");
    setPendingStorageAction(null);
  }

  function applyConfiguration() {
    if (!validation.ok) return;
    setAppliedConfiguration(validation.value);
    setPreviewMessage("Validated configuration applied to the live preview.");
  }

  function persistDraftLocally() {
    if (!validation.ok) {
      setStorageMessage("Fix validation errors before saving this draft.");
      return;
    }
    try {
      window.localStorage.setItem(
        SAVED_DRAFT_KEY,
        JSON.stringify({
          version: SAVED_DRAFT_VERSION,
          draft,
        }),
      );
      setStorageMessage("Draft saved in this browser only.");
    } catch {
      setStorageMessage(
        "Could not save the local draft. No data was sent elsewhere.",
      );
    }
    setPendingStorageAction(null);
  }

  function requestSaveDraftLocally() {
    if (!validation.ok) {
      setStorageMessage("Fix validation errors before saving this draft.");
      return;
    }
    let existingDraft: string | null;
    try {
      existingDraft = window.localStorage.getItem(SAVED_DRAFT_KEY);
    } catch {
      setStorageMessage(
        "Could not check for an existing local draft. Your saved draft was not changed.",
      );
      return;
    }
    if (existingDraft !== null) {
      setPendingStorageAction("replace");
      setStorageMessage("A saved draft already exists. Confirm to replace it.");
      return;
    }
    persistDraftLocally();
  }

  function restoreDraftLocally() {
    setPendingStorageAction(null);
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(SAVED_DRAFT_KEY);
    } catch {
      setStorageMessage(
        "Could not read local drafts in this browser. Your current draft is unchanged.",
      );
      return;
    }
    if (raw === null) {
      setStorageMessage("No saved local draft was found.");
      return;
    }
    const restored = parseSavedDraft(raw);
    if (!restored.ok) {
      setStorageMessage(restored.message);
      return;
    }
    setDraft(restored.draft);
    setAppliedConfiguration(restored.configuration);
    setPreviewMessage("Restored a validated local draft to the live preview.");
    setStorageMessage("Draft restored from this browser only.");
  }

  function confirmDeleteDraftLocally() {
    try {
      window.localStorage.removeItem(SAVED_DRAFT_KEY);
      setStorageMessage("Saved local draft deleted.");
    } catch {
      setStorageMessage("Could not delete the local draft in this browser.");
    }
    setPendingStorageAction(null);
  }

  function requestDeleteDraftLocally() {
    let existingDraft: string | null;
    try {
      existingDraft = window.localStorage.getItem(SAVED_DRAFT_KEY);
    } catch {
      setStorageMessage(
        "Could not check for a saved draft in this browser. No data was deleted.",
      );
      return;
    }
    if (existingDraft === null) {
      setStorageMessage("No saved local draft was found.");
      return;
    }
    setPendingStorageAction("delete");
    setStorageMessage("Confirm deleting the saved draft from this browser.");
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
        <div className="configurator-storage-controls">
          {pendingStorageAction === "replace" ? (
            <div className="configurator-storage-confirmation">
              <span>A local draft already exists. Replace it?</span>
              <button
                className="button button-secondary"
                type="button"
                onClick={persistDraftLocally}
              >
                Confirm replace
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setPendingStorageAction(null);
                  setStorageMessage("The existing saved draft was kept.");
                }}
              >
                Keep saved draft
              </button>
            </div>
          ) : (
            <button
              className="button button-secondary"
              type="button"
              disabled={!validation.ok}
              onClick={requestSaveDraftLocally}
            >
              Save draft locally
            </button>
          )}
          <button
            className="button button-secondary"
            type="button"
            onClick={restoreDraftLocally}
          >
            Restore local draft
          </button>
          {pendingStorageAction === "delete" ? (
            <div className="configurator-storage-confirmation">
              <span>Delete the saved draft from this browser?</span>
              <button
                className="button button-secondary"
                type="button"
                onClick={confirmDeleteDraftLocally}
              >
                Confirm delete
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setPendingStorageAction(null);
                  setStorageMessage("The saved draft was kept.");
                }}
              >
                Keep draft
              </button>
            </div>
          ) : (
            <button
              className="button button-secondary"
              type="button"
              onClick={requestDeleteDraftLocally}
            >
              Delete saved draft
            </button>
          )}
        </div>
        <p className="configurator-storage-note">
          Local drafts stay in this browser until deleted. Replacing and
          deleting saved drafts require confirmation; drafts are never uploaded.
        </p>
        <p
          className="configurator-storage-status"
          role="status"
          aria-live="polite"
        >
          {storageMessage}
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
              role="region"
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
