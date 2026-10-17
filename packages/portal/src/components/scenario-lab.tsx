"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "./copy-button";
import { HydrationBoundary } from "./hydration-boundary";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import {
  presetActions,
  usePortalSettings,
  type DemoPreset,
} from "./portal-shell";

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
  const { theme: colorScheme } = usePortalSettings();
  const [scenario, setScenario] = useState(INITIAL_SCENARIO);
  const [capturedScenario, setCapturedScenario] =
    useState<ScenarioDraft | null>(null);
  const [importSource, setImportSource] = useState("");
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
      colorScheme,
      features: { search: false, customize: false },
      actions: previewActions,
      placement: { mode: "container" as const },
      renderMode: "light" as const,
    }),
    [previewActions, colorScheme],
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

  function importScenario() {
    let value: unknown;
    try {
      value = JSON.parse(importSource);
    } catch {
      setStatus("Snapshot is not valid JSON; current simulation is unchanged.");
      return;
    }
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1 ||
      !("scenario" in value) ||
      Object.keys(value).length !== 2 ||
      typeof value.scenario !== "object" ||
      value.scenario === null
    ) {
      setStatus("Unsupported snapshot version or shape.");
      return;
    }
    const candidate = value.scenario;
    if (
      Object.keys(candidate).sort().join(",") !==
        "allowActions,context,failOnAction,simulatedMinute,viewport" ||
      !("context" in candidate) ||
      !("viewport" in candidate) ||
      !("simulatedMinute" in candidate) ||
      !("allowActions" in candidate) ||
      !("failOnAction" in candidate)
    ) {
      setStatus("Snapshot scenario fields are invalid.");
      return;
    }
    const context = CONTEXTS.find((entry) => entry === candidate.context);
    const viewport = VIEWPORTS.find((entry) => entry === candidate.viewport);
    if (
      context === undefined ||
      viewport === undefined ||
      typeof candidate.simulatedMinute !== "number" ||
      !Number.isInteger(candidate.simulatedMinute) ||
      candidate.simulatedMinute < 0 ||
      candidate.simulatedMinute > 120 ||
      candidate.simulatedMinute % 5 !== 0 ||
      typeof candidate.allowActions !== "boolean" ||
      typeof candidate.failOnAction !== "boolean"
    ) {
      setStatus("Snapshot scenario values are invalid.");
      return;
    }
    setCapturedScenario({
      context,
      viewport,
      simulatedMinute: candidate.simulatedMinute,
      allowActions: candidate.allowActions,
      failOnAction: candidate.failOnAction,
    });
    setStatus(
      "Validated snapshot imported. Replay explicitly to replace the simulation.",
    );
  }

  return (
    <HydrationBoundary label="Scenario simulation workspace">
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
            {String(Math.floor(scenario.simulatedMinute / 60)).padStart(2, "0")}
            :{String(scenario.simulatedMinute % 60).padStart(2, "0")}
          </label>
          <input
            id="scenario-time"
            type="range"
            min="0"
            max="120"
            step="5"
            value={scenario.simulatedMinute}
            onChange={(event) =>
              updateScenario(
                "simulatedMinute",
                Number(event.currentTarget.value),
              )
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
          <label htmlFor="scenario-import">Import scenario data</label>
          <textarea
            id="scenario-import"
            rows={5}
            maxLength={16000}
            value={importSource}
            onChange={(event) => setImportSource(event.currentTarget.value)}
          />
          <button
            type="button"
            className="button button-secondary"
            onClick={importScenario}
          >
            Import snapshot
          </button>
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
    </HydrationBoundary>
  );
}
