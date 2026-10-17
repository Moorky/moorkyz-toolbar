"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BUILT_IN_THEMES,
  THEME_NAMES,
  contrastRatio,
  validateThemeTokens,
  type ToolbarThemeName,
} from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import { CopyButton } from "./copy-button";

export function ThemeStudio() {
  const [theme, setTheme] = useState<ToolbarThemeName>("signature");
  const [status, setStatus] = useState(
    "Built-in themes are previewed locally; no theme is applied to the portal.",
  );
  const tokens = BUILT_IN_THEMES[theme];
  const validation = useMemo(() => validateThemeTokens(tokens), [tokens]);
  const configuration = useMemo(
    () => ({
      label: `${theme} theme preview`,
      theme,
      colorScheme: "system" as const,
      features: { search: false, customize: false },
      actions: [{ id: "docs", label: "Documentation" }],
      placement: { mode: "container" as const },
      renderMode: "light" as const,
    }),
    [theme],
  );
  const dispatchAction = useCallback((actionId: string) => {
    setStatus(`The local preview received "${actionId}".`);
  }, []);
  const host = useMemo(() => ({ dispatchAction }), [dispatchAction]);
  const onMountError = useCallback((error: { readonly message: string }) => {
    setStatus(`Theme preview unavailable: ${error.message}`);
  }, []);
  const themeFile = JSON.stringify({ version: 1, theme, tokens }, null, 2);
  const textContrast = validation.ok
    ? contrastRatio(tokens.foreground, tokens.background)
    : null;
  const focusContrast = validation.ok
    ? contrastRatio(tokens.focus, tokens.background)
    : null;

  return (
    <div className="theme-studio">
      <div className="theme-studio-controls">
        <label htmlFor="theme-studio-selection">Built-in theme</label>
        <select
          id="theme-studio-selection"
          value={theme}
          onChange={(event) => {
            const selected = THEME_NAMES.find(
              (name) => name === event.currentTarget.value,
            );
            if (selected !== undefined) {
              setTheme(selected);
              setStatus(`Previewing the ${selected} built-in theme.`);
            }
          }}
        >
          {THEME_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <p role="status" aria-live="polite">
          {status}
        </p>
        {validation.ok ? (
          <p className="theme-studio-validation">
            Token validation passed. Text contrast: {textContrast?.toFixed(2)}
            :1; focus contrast: {focusContrast?.toFixed(2)}:1.
          </p>
        ) : (
          <div className="configurator-validation" role="alert">
            {validation.errors.map(({ path, message }) => (
              <p key={`${path}:${message}`}>
                {path}: {message}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="theme-studio-output">
        <div className="theme-studio-preview">
          <div className="configurator-preview-heading">
            <span>BUILT-IN THEME PREVIEW</span>
            <span>{theme}</span>
          </div>
          <div className="configurator-preview-surface">
            <ToolbarMount
              className="configurator-preview-mount"
              configuration={configuration}
              host={host}
              onMountError={onMountError}
              role="region"
              aria-label={`${theme} theme preview`}
            />
          </div>
          <dl className="theme-token-list">
            {Object.entries(tokens).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>
                  <code>{value}</code>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="theme-studio-export">
          <div className="configurator-code-heading">
            <div>
              <span className="code-language">JSON</span>
              <span className="code-filename">theme.tokens.json</span>
            </div>
            <CopyButton text={themeFile} label="Copy theme tokens" />
          </div>
          <pre aria-label="Versioned theme token export" tabIndex={0}>
            <code>{themeFile}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
