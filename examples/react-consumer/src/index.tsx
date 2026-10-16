import { useMemo, type ReactNode } from "react";
import { validateConfiguration } from "@moorkyz/toolbar";

export function ToolbarConfigurationPreview(): ReactNode {
  const validation = useMemo(
    () =>
      validateConfiguration({
        features: { search: true, spatialCoordination: false },
      }),
    [],
  );

  if (!validation.ok) {
    return (
      <ul aria-label="Toolbar configuration errors">
        {validation.errors.map(({ code, path }) => (
          <li key={`${code}:${path}`}>
            {code}: {path}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <output aria-label="Toolbar configuration schema version">
      {validation.value.schemaVersion}
    </output>
  );
}
