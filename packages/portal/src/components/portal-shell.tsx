"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createToolbarPreferenceStore,
  type ToolbarController,
} from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";

const presets = {
  website: [
    { id: "home", label: "Home" },
    { id: "environments", label: "Explore" },
    { id: "quick-start", label: "Get started" },
    { id: "studio", label: "Studio" },
  ],
  dashboard: [
    { id: "home", label: "Home" },
    { id: "engineering", label: "Built for control" },
    { id: "quick-start", label: "Get started" },
    { id: "studio", label: "Studio" },
  ],
  editor: [
    { id: "home", label: "Home" },
    { id: "themes", label: "Appearance" },
    { id: "quick-start", label: "Get started" },
    { id: "docs", label: "Docs" },
  ],
  immersive: [
    { id: "home", label: "Home" },
    { id: "engineering", label: "Capabilities" },
    { id: "quick-start", label: "Get started" },
    { id: "open-source", label: "Source" },
  ],
} as const;

export type DemoPreset = keyof typeof presets;

interface PortalSettings {
  readonly preset: DemoPreset;
  readonly setPreset: (preset: DemoPreset) => void;
  readonly theme: "light" | "dark";
  readonly toggleTheme: () => void;
  readonly themeReady: boolean;
  readonly themeStorageWarning: boolean;
}

const PortalSettingsContext = createContext<PortalSettings | null>(null);

export function usePortalSettings(): PortalSettings {
  const settings = useContext(PortalSettingsContext);
  if (settings === null) {
    throw new Error("Portal settings must be used inside PortalShell.");
  }
  return settings;
}

function ToolbarNavigation({
  preset,
  theme,
}: {
  readonly preset: DemoPreset;
  readonly theme: "light" | "dark";
}) {
  const { toggleTheme } = usePortalSettings();
  const toolbar = useRef<ToolbarController | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configuration = useMemo(
    () => ({
      renderMode: "light" as const,
      label: "Moorkyz Toolbar website navigation",
      features: { search: false },
      actions: presets.website,
    }),
    [],
  );
  const preferenceStore = useMemo(
    () =>
      createToolbarPreferenceStore("portal-navigation", {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
        removeItem: (key) => window.localStorage.removeItem(key),
      }),
    [],
  );

  const dispatchAction = useCallback((actionId: string) => {
    const target = document.getElementById(actionId);
    if (!(target instanceof HTMLElement)) {
      if (
        Object.values(presets).some((actions) =>
          actions.some(({ id }) => id === actionId),
        )
      ) {
        window.location.assign(`/#${encodeURIComponent(actionId)}`);
        return;
      }
      throw new Error(`No portal section is registered for "${actionId}".`);
    }
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    target.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${encodeURIComponent(actionId)}`);
  }, []);

  const onActionError = useCallback((_cause: unknown, actionId: string) => {
    setError(`Could not navigate to the "${actionId}" section.`);
  }, []);
  const onPreferenceError = useCallback(
    (diagnostic: { readonly code: string }) => {
      setError(`Toolbar preferences need attention: ${diagnostic.code}`);
    },
    [],
  );
  const onController = useCallback((instance: ToolbarController | null) => {
    toolbar.current = instance;
  }, []);
  const onMountError = useCallback(
    (mountError: { readonly message: string }) => {
      setError(mountError.message);
    },
    [],
  );
  const host = useMemo(
    () => ({
      dispatchAction,
      preferenceStore,
      onActionError,
      onPreferenceError,
    }),
    [dispatchAction, onActionError, onPreferenceError, preferenceStore],
  );

  useEffect(() => {
    const instance = toolbar.current;
    if (instance === null) return;
    const result = instance.update({
      actions: presets[preset],
      colorScheme: theme,
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
  }, [preset, theme]);

  return (
    <>
      <ToolbarMount
        className="toolbar-mount"
        role="region"
        aria-label="Page navigation toolbar"
        configuration={configuration}
        host={host}
        onController={onController}
        onMountError={onMountError}
        onClickCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[data-toolbar-control="cycle-color-scheme"]')
          ) {
            event.preventDefault();
            event.stopPropagation();
            toggleTheme();
          }
        }}
      />
      {error !== null && (
        <p className="toolbar-error" role="alert">
          The page navigation dock is unavailable: {error}
        </p>
      )}
    </>
  );
}

export function PortalShell({ children }: Readonly<{ children: ReactNode }>) {
  const [preset, setPreset] = useState<DemoPreset>("website");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);
  const [themeStorageWarning, setThemeStorageWarning] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("moorkyz-portal-theme");
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
        document.documentElement.dataset.theme = stored;
      }
    } catch {
      setThemeStorageWarning(true);
    }
    setThemeReady(true);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem("moorkyz-portal-theme", next);
      setThemeStorageWarning(false);
    } catch {
      setThemeStorageWarning(true);
    }
  }, [theme]);

  return (
    <PortalSettingsContext.Provider
      value={{
        preset,
        setPreset,
        theme,
        toggleTheme,
        themeReady,
        themeStorageWarning,
      }}
    >
      {children}
      <ToolbarNavigation preset={preset} theme={theme} />
    </PortalSettingsContext.Provider>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme, themeReady, themeStorageWarning } =
    usePortalSettings();

  return (
    <span className="theme-control">
      <button
        className="theme-toggle"
        type="button"
        aria-label={`${theme}. Switch to ${theme === "light" ? "dark" : "light"} theme`}
        aria-pressed={theme === "dark"}
        disabled={!themeReady}
        onClick={toggleTheme}
      >
        <span aria-hidden="true">{theme === "light" ? "◐" : "☼"}</span>
        <span className="theme-toggle-label">{theme}</span>
      </button>
      {themeStorageWarning && (
        <span className="sr-only" role="status">
          Theme changed for this visit but could not be saved on this device.
        </span>
      )}
    </span>
  );
}

export function presetActions(preset: DemoPreset) {
  return presets[preset];
}
