"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createBrowserPreferenceStorage,
  createToolbar,
  createToolbarPreferenceStore,
  type ToolbarController,
} from "@moorkyz/toolbar";

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
}

const PortalSettingsContext = createContext<PortalSettings | null>(null);

export function usePortalSettings(): PortalSettings {
  const settings = useContext(PortalSettingsContext);
  if (settings === null) {
    throw new Error("Portal settings must be used inside PortalShell.");
  }
  return settings;
}

function ToolbarNavigation({ preset }: { readonly preset: DemoPreset }) {
  const mountTarget = useRef<HTMLDivElement>(null);
  const toolbar = useRef<ToolbarController | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dispatchAction = useCallback((actionId: string) => {
    const target = document.getElementById(actionId);
    if (!(target instanceof HTMLElement)) {
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

  useEffect(() => {
    const target = mountTarget.current;
    if (target === null) return;

    const preferenceStore = createToolbarPreferenceStore(
      "portal-navigation",
      createBrowserPreferenceStorage(window),
    );
    const instance = createToolbar(
      {
        renderMode: "light",
        label: "Moorkyz Toolbar website navigation",
        features: { search: false },
        actions: presets.website,
      },
      {
        dispatchAction,
        preferenceStore,
        onActionError: (_cause, actionId) => {
          setError(`Could not navigate to the "${actionId}" section.`);
        },
        onPreferenceError: (diagnostic) => {
          setError(`Toolbar preferences need attention: ${diagnostic.code}`);
        },
      },
    );
    const result = instance.mount(target);
    if (!result.ok) {
      setError(result.error.message);
      instance.dispose();
      return;
    }

    toolbar.current = instance;
    return () => {
      instance.dispose();
      if (toolbar.current === instance) toolbar.current = null;
    };
  }, [dispatchAction]);

  useEffect(() => {
    const instance = toolbar.current;
    if (instance === null) return;
    const result = instance.update({ actions: presets[preset] });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
  }, [preset]);

  return (
    <>
      <div
        className="toolbar-mount"
        ref={mountTarget}
        role="region"
        aria-label="Page navigation toolbar"
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

  return (
    <PortalSettingsContext.Provider value={{ preset, setPreset }}>
      {children}
      <ToolbarNavigation preset={preset} />
    </PortalSettingsContext.Provider>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    let storedTheme: string | null = null;
    try {
      storedTheme = window.localStorage.getItem("moorkyz-portal-theme");
    } catch {
      setStorageWarning(true);
    }
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
      document.documentElement.dataset.theme = storedTheme;
    }
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem("moorkyz-portal-theme", nextTheme);
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }

  return (
    <span className="theme-control">
      <button
        className="theme-toggle"
        type="button"
        aria-label={`${theme}. Switch to ${theme === "light" ? "dark" : "light"} theme`}
        aria-pressed={theme === "dark"}
        onClick={toggleTheme}
      >
        <span aria-hidden="true">{theme === "light" ? "◐" : "☼"}</span>
        <span className="theme-toggle-label">{theme}</span>
      </button>
      {storageWarning && (
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
