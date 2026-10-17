"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BUILT_IN_THEMES,
  THEME_NAMES,
  contrastRatio,
  validateThemeTokens,
  validateThemeFile,
  type ThemeTokens,
  type ToolbarController,
  type ToolbarThemeName,
} from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import { CopyButton } from "./copy-button";
import { HydrationBoundary } from "./hydration-boundary";

export function ThemeStudio({ nonce }: { readonly nonce: string }) {
  const [theme, setTheme] = useState<ToolbarThemeName>("signature");
  const [status, setStatus] = useState(
    "Built-in themes are previewed locally; no theme is applied to the portal.",
  );
  const [customTokens, setCustomTokens] = useState<ThemeTokens | null>(null);
  const [appliedTokens, setAppliedTokens] = useState<ThemeTokens | null>(null);
  const [importSource, setImportSource] = useState("");
  const tokens = customTokens ?? BUILT_IN_THEMES[theme];
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
  const host = useMemo(
    () => ({ dispatchAction, styleNonce: nonce }),
    [dispatchAction, nonce],
  );
  const onController = useCallback(
    (controller: ToolbarController | null) => {
      if (controller === null || appliedTokens === null) return;
      const result = controller.updateThemeTokens(appliedTokens);
      if (!result.ok) setStatus(result.error.message);
    },
    [appliedTokens],
  );
  const onMountError = useCallback((error: { readonly message: string }) => {
    setStatus(`Theme preview unavailable: ${error.message}`);
  }, []);
  const themeFile = JSON.stringify(
    { version: 1, theme: customTokens === null ? theme : "custom", tokens },
    null,
    2,
  );
  const textContrast = validation.ok
    ? contrastRatio(tokens.foreground, tokens.background)
    : null;
  const focusContrast = validation.ok
    ? contrastRatio(tokens.focus, tokens.background)
    : null;

  return (
    <HydrationBoundary label="Theme authoring workspace">
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
                setCustomTokens(null);
                setAppliedTokens(null);
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
          <fieldset>
            <legend>Custom token authoring</legend>
            {Object.entries(tokens).map(([name, value]) => (
              <label key={name} htmlFor={`custom-token-${name}`}>
                {name}
                <input
                  id={`custom-token-${name}`}
                  value={value}
                  maxLength={7}
                  onChange={(event) => {
                    setCustomTokens({
                      ...tokens,
                      [name]: event.currentTarget.value,
                    });
                  }}
                />
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="button button-secondary"
            disabled={!validation.ok}
            onClick={() => {
              if (!validation.ok) {
                setStatus("Fix token validation before applying.");
                return;
              }
              setAppliedTokens(validation.value);
              setStatus(
                "Validated custom tokens applied with the portal CSP nonce.",
              );
            }}
          >
            Apply custom theme
          </button>
          <label htmlFor="theme-import">Import theme JSON</label>
          <textarea
            id="theme-import"
            value={importSource}
            maxLength={16000}
            onChange={(event) => setImportSource(event.currentTarget.value)}
          />
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(importSource);
              } catch {
                setStatus(
                  "Theme import is not valid JSON; current tokens are unchanged.",
                );
                return;
              }
              const result = validateThemeFile(parsed);
              if (!result.ok) {
                setStatus(result.message);
                return;
              }
              setCustomTokens(result.value.tokens);
              setAppliedTokens(result.value.tokens);
              setStatus("Validated theme imported locally.");
            }}
          >
            Import validated theme
          </button>
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
                onController={onController}
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
              <CopyButton
                text={themeFile}
                label="Copy theme tokens"
                disabled={!validation.ok}
              />
            </div>
            <pre aria-label="Versioned theme token export" tabIndex={0}>
              <code>{themeFile}</code>
            </pre>
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
