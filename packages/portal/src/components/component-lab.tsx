"use client";

import { useCallback, useMemo, useState } from "react";
import type { ToolbarController } from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";

const scenarios = {
  default: {
    label: "Default",
    description: "A compact action row with manual collapse.",
  },
  narrow: {
    label: "Narrow action row",
    description: "Resize-constrained actions with native scrolling controls.",
  },
  search: {
    label: "Search enabled",
    description: "A user-opened local search panel with host dispatch.",
  },
} as const;

type ComponentScenario = keyof typeof scenarios;
const scenarioIds: readonly ComponentScenario[] = [
  "default",
  "narrow",
  "search",
];

const baseActions = [
  { id: "home", label: "Home" },
  { id: "projects", label: "Projects" },
  { id: "documentation", label: "Documentation" },
  { id: "settings", label: "Settings" },
] as const;

const narrowActions = [
  ...baseActions,
  { id: "support", label: "Support" },
  { id: "activity", label: "Activity" },
  { id: "reports", label: "Reports" },
  { id: "account", label: "Account" },
] as const;

export function ComponentLab() {
  const [scenario, setScenario] = useState<ComponentScenario>("default");
  const [toolbar, setToolbar] = useState<ToolbarController | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState(
    "Choose a scenario, then interact with the real toolbar.",
  );

  const configuration = useMemo(
    () => ({
      label: "Component lab toolbar",
      features: { search: scenario === "search", customize: false },
      actions: scenario === "narrow" ? narrowActions : baseActions,
      placement: { mode: "container" as const },
      renderMode: "light" as const,
    }),
    [scenario],
  );
  const dispatchAction = useCallback((actionId: string) => {
    setStatus(`The host received action "${actionId}".`);
  }, []);
  const host = useMemo(() => ({ dispatchAction }), [dispatchAction]);
  const onController = useCallback((instance: ToolbarController | null) => {
    setToolbar(instance);
    setCollapsed(instance?.isCollapsed ?? false);
  }, []);
  const onMountError = useCallback((error: { readonly message: string }) => {
    setStatus(`Component preview unavailable: ${error.message}`);
  }, []);

  function toggleCollapsed() {
    if (toolbar === null) return;
    const result = toolbar.isCollapsed ? toolbar.expand() : toolbar.collapse();
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setCollapsed(toolbar.isCollapsed);
    setStatus(
      toolbar.isCollapsed
        ? "The preview toolbar is collapsed."
        : "The preview toolbar is expanded.",
    );
  }

  return (
    <div className="component-lab">
      <div
        className="component-lab-scenarios"
        role="group"
        aria-label="Component scenarios"
      >
        {scenarioIds.map((id) => (
          <button
            key={id}
            className="component-lab-scenario"
            type="button"
            aria-pressed={scenario === id}
            onClick={() => setScenario(id)}
          >
            {scenarios[id].label}
          </button>
        ))}
      </div>
      <p className="component-lab-description" aria-live="polite">
        {scenarios[scenario].description}
      </p>
      <div
        className={`component-lab-frame${scenario === "narrow" ? " component-lab-frame--narrow" : ""}`}
      >
        <ToolbarMount
          className="component-lab-mount"
          configuration={configuration}
          host={host}
          onController={onController}
          onMountError={onMountError}
          role="region"
          aria-label="Live component preview"
        />
      </div>
      <div className="component-lab-controls">
        <button
          className="button button-secondary"
          type="button"
          disabled={toolbar === null}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? "Expand preview toolbar" : "Collapse preview toolbar"}
        </button>
        <p className="component-lab-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}
