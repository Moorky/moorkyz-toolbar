"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONFIGURATION_VERSION,
  FEATURE_DEFAULTS,
  createLocalDiagnosticsRecorder,
  createFederatedSearchCoordinator,
  createHostAuthorizedAIAdapter,
  validateConfiguration,
  type ToolbarConfiguration,
  type ToolbarController,
} from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import { createDockInspector } from "@moorkyz/toolbar/inspector";
import { CopyButton } from "./copy-button";
import { HydrationBoundary } from "./hydration-boundary";
import { usePortalSettings } from "./portal-shell";

const initial = validateConfiguration({
  label: "Development Studio toolbar",
  placement: { mode: "container" },
  renderMode: "light",
  features: { search: false, customize: false },
  actions: [{ id: "docs", label: "Documentation" }],
});
if (!initial.ok) throw new Error("Invalid built-in Studio configuration.");
const INITIAL_CONFIGURATION = initial.value;

export function DeveloperWorkbench() {
  const { theme: portalTheme } = usePortalSettings();
  const [configuration, setConfiguration] = useState(INITIAL_CONFIGURATION);
  const liveConfiguration = useMemo(
    () => ({ ...configuration, colorScheme: portalTheme }),
    [configuration, portalTheme],
  );
  const [source, setSource] = useState(
    JSON.stringify(INITIAL_CONFIGURATION, null, 2),
  );
  const [pending, setPending] = useState<ToolbarConfiguration | null>(null);
  const [status, setStatus] = useState(
    "Configuration files contain data only. No JavaScript is evaluated.",
  );
  const [inspectorEnabled, setInspectorEnabled] = useState(false);
  const [focus, setFocus] = useState(false);
  const inspectorTarget = useRef<HTMLDivElement>(null);
  const validation = useMemo(() => {
    try {
      return validateConfiguration(JSON.parse(source));
    } catch {
      return null;
    }
  }, [source]);

  const host = useMemo(
    () => ({
      dispatchAction: (id: string) =>
        setStatus(`Studio host received "${id}".`),
      onGesture: () =>
        setStatus("Gesture intent reported; host did not run a command."),
      ...(configuration.features.search
        ? {
            searchCoordinator: createFederatedSearchCoordinator(
              [
                {
                  id: "studio:fixtures",
                  search: () => [
                    { id: "docs", title: "Local fixture documentation" },
                  ],
                },
              ],
              { isEnabled: () => true, authorize: () => true },
            ),
            onSearchResult: (providerId: string, resultId: string) =>
              setStatus(
                `Synthetic search selection: ${providerId}/${resultId}.`,
              ),
          }
        : {}),
      ...(configuration.features.ai
        ? {
            aiAdapter: createHostAuthorizedAIAdapter(
              { generate: ({ prompt }) => `Local fixture response: ${prompt}` },
              { isEnabled: () => true, authorize: () => true },
            ),
          }
        : {}),
    }),
    [configuration.features.search, configuration.features.ai],
  );
  const onMountError = useCallback((error: { readonly message: string }) => {
    setStatus(`Studio preview unavailable: ${error.message}`);
  }, []);
  const onController = useCallback(
    (controller: ToolbarController | null) => {
      if (controller === null) return;
      const results = [
        ...(configuration.features.tasks
          ? [
              controller.updateTasks([
                {
                  id: "fixture",
                  label: "Synthetic build",
                  status: "completed",
                },
              ]),
            ]
          : []),
        ...(configuration.features.notifications
          ? [
              controller.updateNotifications([
                {
                  id: "fixture",
                  title: "Fixture notification",
                  message: "Local data only",
                  severity: "info",
                  unread: true,
                },
              ]),
            ]
          : []),
        ...(configuration.features.discovery
          ? [
              controller.updateDiscoveryHints([
                {
                  id: "fixture",
                  title: "Keyboard navigation",
                  message:
                    "Use arrow keys in the toolbar. Guidance is optional.",
                },
              ]),
            ]
          : []),
        ...(configuration.features.offline
          ? [controller.updateConnectivityStatus("offline")]
          : []),
      ];
      const failure = results.find((result) => !result.ok);
      if (failure !== undefined && !failure.ok)
        setStatus(failure.error.message);
    },
    [configuration],
  );

  useEffect(() => {
    if (!inspectorEnabled || inspectorTarget.current === null) return;
    const recorder = createLocalDiagnosticsRecorder({
      redact: (code) => `Synthetic Studio event: ${code}`,
    });
    recorder.setEnabled(true);
    const recorded = recorder.record({
      code: "STUDIO_PREVIEW",
      severity: "info",
      message: "Explicit local inspection",
    });
    if (!recorded.ok) throw new Error(recorded.error.message);
    const inspector = createDockInspector(inspectorTarget.current, recorder);
    inspector.setEnabled(true);
    return () => {
      inspector.dispose();
      recorder.dispose();
    };
  }, [inspectorEnabled]);

  function exportFile() {
    if (validation === null || !validation.ok) {
      setStatus("Export rejected: fix configuration validation first.");
      return;
    }
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, configuration: validation.value },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "toolbar.configuration.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus(
      "Versioned configuration downloaded locally; nothing was uploaded.",
    );
  }

  async function importFile(file: File | undefined) {
    if (file === undefined) return;
    if (file.size > 65536) {
      setStatus("Configuration file exceeds 64 KiB.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setStatus("Configuration file could not be read as JSON.");
      return;
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("configuration" in parsed) ||
      Object.keys(parsed).length !== 2
    ) {
      setStatus(
        "Unsupported configuration file; current configuration is unchanged.",
      );
      return;
    }
    const result = validateConfiguration(parsed.configuration);
    if (!result.ok) {
      setStatus(
        result.errors
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(" "),
      );
      return;
    }
    setSource(JSON.stringify(result.value, null, 2));
    setPending(result.value);
    setStatus("Import validated. Confirm before replacing the preview.");
  }

  return (
    <HydrationBoundary label="Full configuration workspace">
      <div className="developer-workbench" data-focus={focus}>
        <button
          type="button"
          className="button button-secondary"
          aria-pressed={focus}
          onClick={() => setFocus(!focus)}
        >
          Focus workspace
        </button>
        <details open>
          <summary>Versioned JSON and visual feature controls</summary>
          <p>
            Schema {CONFIGURATION_VERSION}; edits synchronize with JSON.
            Optional features never imply host authorization.
          </p>
          <fieldset>
            <legend>Independent feature flags</legend>
            {Object.keys(FEATURE_DEFAULTS).map((key) => {
              const feature = key as keyof typeof FEATURE_DEFAULTS;
              return (
                <label key={feature} className="workbench-feature">
                  <input
                    type="checkbox"
                    checked={
                      validation?.ok === true &&
                      validation.value.features[feature]
                    }
                    disabled={validation?.ok !== true}
                    onChange={(event) => {
                      if (validation?.ok !== true) {
                        setStatus("Fix JSON before changing flags.");
                        return;
                      }
                      setSource(
                        JSON.stringify(
                          {
                            ...validation.value,
                            features: {
                              ...validation.value.features,
                              [feature]: event.currentTarget.checked,
                            },
                          },
                          null,
                          2,
                        ),
                      );
                      setPending(null);
                    }}
                  />
                  {feature}
                </label>
              );
            })}
          </fieldset>
          <label htmlFor="workbench-source">Configuration JSON</label>
          <textarea
            id="workbench-source"
            rows={14}
            maxLength={65536}
            spellCheck={false}
            value={source}
            onChange={(event) => {
              setSource(event.currentTarget.value);
              setPending(null);
            }}
          />
          {validation === null ? (
            <p role="alert">Configuration is not valid JSON.</p>
          ) : !validation.ok ? (
            <div role="alert">
              {validation.errors.map((issue) => (
                <p key={`${issue.path}:${issue.code}`}>
                  {issue.path}: {issue.message}
                </p>
              ))}
            </div>
          ) : (
            <p>Configuration schema validation passed.</p>
          )}
          <div className="workbench-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={validation?.ok !== true}
              onClick={() => {
                if (validation?.ok !== true) {
                  setStatus("Configuration is invalid.");
                  return;
                }
                setPending(validation.value);
              }}
            >
              Review configuration
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={validation?.ok !== true}
              onClick={exportFile}
            >
              Download configuration
            </button>
            <CopyButton text={source} label="Copy configuration JSON" />
          </div>
          <label htmlFor="workbench-import">
            Import versioned configuration file
          </label>
          <input
            id="workbench-import"
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void importFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          {pending !== null && (
            <div role="group" aria-label="Confirm preview replacement">
              <p>
                Replace the current preview? Open panels and unsaved preview
                state will reset.
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setConfiguration(pending);
                  setPending(null);
                  setStatus("Validated configuration applied.");
                }}
              >
                Confirm configuration
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setPending(null)}
              >
                Cancel configuration
              </button>
            </div>
          )}
        </details>
        <details open>
          <summary>Live package preview and accessibility checklist</summary>
          <div className="configurator-preview-surface">
            <ToolbarMount
              className="configurator-preview-mount"
              configuration={liveConfiguration}
              host={host}
              onController={onController}
              onMountError={onMountError}
            />
          </div>
          <p>
            Test Tab, arrows, Home/End, Escape, restore, 200% zoom and reduced
            motion. Automated checks are not screen-reader certification.
          </p>
        </details>
        <details>
          <summary>Optional local Dock Inspector</summary>
          <label>
            <input
              type="checkbox"
              checked={inspectorEnabled}
              onChange={(event) =>
                setInspectorEnabled(event.currentTarget.checked)
              }
            />
            Enable redacted synthetic diagnostics
          </label>
          <div ref={inspectorTarget} />
        </details>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </HydrationBoundary>
  );
}
