"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "./copy-button";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import { presetActions, type DemoPreset } from "./portal-shell";

type ScenarioViewport = "wide" | "compact";

interface ScenarioDraft {
  readonly context: DemoPreset;
  readonly viewport: ScenarioViewport;
  readonly simulatedMinute: number;
  readonly allowActions: boolean;
  readonly failOnAction: boolean;
}

const INITIAL_SCENARIO: ScenarioDraft = Object.freeze({
  context: "website",
  viewport: "wide",
  simulatedMinute: 0,
  allowActions: true,
  failOnAction: false,
});

const CONTEXTS: readonly DemoPreset[] = [
  "website",
  "dashboard",
  "editor",
  "immersive",
];

const VIEWPORTS: readonly ScenarioViewport[] = ["wide", "compact"];

export function ScenarioLab() {
  const [scenario, setScenario] = useState(INITIAL_SCENARIO);
  const [capturedScenario, setCapturedScenario] =
    useState<ScenarioDraft | null>(null);
  const [status, setStatus] = useState(
    "Adjust the simulation; no host application or network is connected.",
  );
  const scenarioRef = useRef(scenario);
  const previewActions = useMemo(
    () => presetActions(scenario.context),
    [scenario.context],
  );
  const configuration = useMemo(
    () => ({
      label: "Scenario Lab toolbar",
      features: { search: false, customize: false },
      actions: previewActions,
      placement: { mode: "container" as const },
      renderMode: "light" as const,
    }),
    [previewActions],
  );
  const dispatchAction = useCallback((actionId: string) => {
    const activeScenario = scenarioRef.current;
    if (!activeScenario.allowActions) {
      setStatus(
        `Simulated host denied "${actionId}"; no application action was run.`,
      );
      return;
    }
    if (activeScenario.failOnAction) {
      throw new Error(`Simulated host failure for "${actionId}".`);
    }
    setStatus(
      `Simulated host accepted "${actionId}" in ${activeScenario.context} context.`,
    );
  }, []);
  const onActionError = useCallback((_error: unknown, actionId: string) => {
    setStatus(`Simulated host failure for "${actionId}" was reported.`);
  }, []);
  const host = useMemo(
    () => ({ dispatchAction, onActionError }),
    [dispatchAction, onActionError],
  );
  const onMountError = useCallback((error: { readonly message: string }) => {
    setStatus(`Scenario preview unavailable: ${error.message}`);
  }, []);
  const snapshotCode =
    capturedScenario === null
      ? null
      : JSON.stringify({ version: 1, scenario: capturedScenario }, null, 2);

  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  function updateScenario<Key extends keyof ScenarioDraft>(
    key: Key,
    value: ScenarioDraft[Key],
  ) {
    setScenario((current) => ({ ...current, [key]: value }));
  }

  function captureScenario() {
    setCapturedScenario({ ...scenario });
    setStatus("Scenario snapshot captured in this page.");
  }

  function replayScenario() {
    if (capturedScenario === null) return;
    setScenario({ ...capturedScenario });
    scenarioRef.current = capturedScenario;
    setStatus("Captured scenario replayed deterministically.");
  }

  return (
    <div className="scenario-lab">
      <div className="scenario-lab-controls">
        <label htmlFor="scenario-context">Simulated context</label>
        <select
          id="scenario-context"
          value={scenario.context}
          onChange={(event) => {
            const context = CONTEXTS.find(
              (candidate) => candidate === event.currentTarget.value,
            );
            if (context !== undefined) updateScenario("context", context);
          }}
        >
          {CONTEXTS.map((context) => (
            <option key={context} value={context}>
              {context}
            </option>
          ))}
        </select>

        <label htmlFor="scenario-viewport">Simulated viewport</label>
        <select
          id="scenario-viewport"
          value={scenario.viewport}
          onChange={(event) => {
            const viewport = VIEWPORTS.find(
              (candidate) => candidate === event.currentTarget.value,
            );
            if (viewport !== undefined) updateScenario("viewport", viewport);
          }}
        >
          {VIEWPORTS.map((viewport) => (
            <option key={viewport} value={viewport}>
              {viewport}
            </option>
          ))}
        </select>

        <label htmlFor="scenario-time">
          Simulated time:{" "}
          {String(Math.floor(scenario.simulatedMinute / 60)).padStart(2, "0")}:
          {String(scenario.simulatedMinute % 60).padStart(2, "0")}
        </label>
        <input
          id="scenario-time"
          type="range"
          min="0"
          max="120"
          step="5"
          value={scenario.simulatedMinute}
          onChange={(event) =>
            updateScenario("simulatedMinute", Number(event.currentTarget.value))
          }
        />

        <label className="scenario-lab-check">
          <input
            type="checkbox"
            checked={scenario.allowActions}
            onChange={(event) =>
              updateScenario("allowActions", event.currentTarget.checked)
            }
          />
          Host allows navigation
        </label>
        <label className="scenario-lab-check">
          <input
            type="checkbox"
            checked={scenario.failOnAction}
            onChange={(event) =>
              updateScenario("failOnAction", event.currentTarget.checked)
            }
          />
          Simulate host action failure
        </label>

        <div className="scenario-lab-snapshot-controls">
          <button
            className="button button-secondary"
            type="button"
            onClick={captureScenario}
          >
            Capture snapshot
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={capturedScenario === null}
            onClick={replayScenario}
          >
            Replay snapshot
          </button>
          {snapshotCode !== null && (
            <div className="scenario-lab-snapshot">
              <CopyButton text={snapshotCode} label="Copy snapshot JSON" />
              <pre aria-label="Scenario snapshot JSON" tabIndex={0}>
                <code>{snapshotCode}</code>
              </pre>
            </div>
          )}
        </div>
        <p className="scenario-lab-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <div
        className={`scenario-lab-frame${scenario.viewport === "compact" ? " scenario-lab-frame--compact" : ""}`}
      >
        <ToolbarMount
          className="scenario-lab-mount"
          configuration={configuration}
          host={host}
          onMountError={onMountError}
          role="region"
          aria-label="Scenario Lab preview"
        />
      </div>
    </div>
  );
}
