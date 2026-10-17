"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { validateThemeTokens, type ToolbarController } from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import type { GeneratedProject } from "@moorkyz/toolbar/generator";
import { CopyButton } from "./copy-button";
import { usePortalSettings } from "./portal-shell";
import { HydrationBoundary } from "./hydration-boundary";
import {
  PLAYGROUND_SECTIONS,
  PLAYGROUND_STORAGE_KEY,
} from "./playground-model";
import {
  APPLICATIONS,
  AUTOSAVE_KEY,
  COMMANDS,
  DESIGN_KEY,
  ICONS,
  INITIAL_DESIGN,
  STYLES,
  applyStyle,
  decorateToolbar,
  defaultActions,
  generateDesignProject,
  parseDesign,
  presentationCSS,
  sdkConfiguration,
  validateDesign,
  type DesignAction,
  type Geometry,
  type PlaygroundDesign,
} from "./playground-design";
import {
  PlaygroundApplications,
  type ApplicationHost,
} from "./playground-applications";

interface History {
  readonly past: readonly PlaygroundDesign[];
  readonly present: PlaygroundDesign;
  readonly future: readonly PlaygroundDesign[];
}
const initialConfiguration = sdkConfiguration(INITIAL_DESIGN, "light");
type Pending = "save" | "restore" | "reset" | "autosave" | null;

export function FunctionalPlayground({ nonce }: { readonly nonce: string }) {
  const { theme } = usePortalSettings();
  const [history, setHistory] = useState<History>({
    past: [],
    present: INITIAL_DESIGN,
    future: [],
  });
  const [section, setSection] = useState<string | null>("Templates");
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Design autosaves locally. Application contents stay in memory only.",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [ready, setReady] = useState(false);
  const [canAutosave, setCanAutosave] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [allowed, setAllowed] = useState<readonly string[]>(
    COMMANDS.filter(({ application }) => application === "workspace").map(
      ({ id }) => id,
    ),
  );
  const [tab, setTab] = useState<"application" | "style">("application");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState<readonly string[]>([]);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [variant, setVariant] = useState<"light" | "dark">(theme);
  const [tokenDraft, setTokenDraft] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState("toolbar.config.js");
  const [generated, setGenerated] = useState<{
    design: PlaygroundDesign;
    theme: string;
    project: GeneratedProject;
  } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [dragDesign, setDragDesign] = useState<PlaygroundDesign | null>(null);
  const [mobileMode, setMobileMode] = useState<
    "preview" | "customize" | "code"
  >("preview");
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [sheetHeight, setSheetHeight] = useState(65);
  const [focus, setFocus] = useState(false);
  const controller = useRef<ToolbarController | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const application = useRef<ApplicationHost>(null);
  const imported = useRef<PlaygroundDesign | null>(null);
  const drag = useRef<{
    type: "move" | "resize" | "sidebar" | "sheet";
    x: number;
    y: number;
    design: PlaygroundDesign;
    width: number;
    sheet: number;
  } | null>(null);
  const current = history.present;
  const preview = dragDesign ?? current;
  const currentRef = useRef(current);
  currentRef.current = current;
  const configuration = useMemo(
    () => sdkConfiguration(current, theme),
    [current, theme],
  );
  const effectiveConfig = useRef(configuration);
  effectiveConfig.current = configuration;
  const sourceText = source ?? JSON.stringify(current, null, 2);
  const validation = useMemo(() => parseDesign(sourceText), [sourceText]);
  const project =
    generated?.design === current && generated.theme === theme
      ? generated.project
      : null;
  const generatedFile = project?.files.find(
    ({ path }) => path === selectedFile,
  );
  const host = useMemo(
    () => ({
      dispatchAction: (id: string) => {
        const action = currentRef.current.actions.find(
          (entry) => entry.id === id,
        );
        const definition = COMMANDS.find(
          (entry) => entry.id === action?.command,
        );
        if (
          !action?.enabled ||
          definition?.application !== currentRef.current.application ||
          application.current === null
        )
          throw new Error("The application host denied this action.");
        application.current.dispatch(action.command);
      },
      onActionError: (_cause: unknown, id: string) =>
        setError(`The host rejected action "${id}".`),
    }),
    [],
  );
  const onController = useCallback((instance: ToolbarController | null) => {
    controller.current = instance;
    if (instance !== null) {
      const result = instance.update(effectiveConfig.current);
      setError(result.ok ? null : result.error.message);
    }
  }, []);
  const onMountError = useCallback(
    (cause: { readonly message: string }) => setError(cause.message),
    [],
  );
  const onAvailable = useCallback(
    (commands: readonly string[]) => setAllowed(commands),
    [],
  );
  const appStatus = useCallback((message: string) => setStatus(message), []);

  function commit(design: PlaygroundDesign) {
    const valid = validateDesign(design);
    if (!valid.ok) {
      setStatus(valid.message);
      return;
    }
    setHistory((state) =>
      JSON.stringify(state.present) === JSON.stringify(valid.value)
        ? state
        : {
            past: [...state.past.slice(-49), state.present],
            present: valid.value,
            future: [],
          },
    );
    setSource(null);
    setPending(null);
    setTokenDraft(null);
  }
  function patch(value: Partial<PlaygroundDesign>) {
    commit({ ...current, ...value });
  }
  function geometry(value: Partial<Geometry>) {
    patch({ geometry: { ...current.geometry, ...value } });
  }
  function actionPatch(index: number, value: Partial<DesignAction>) {
    patch({
      actions: current.actions.map((entry, i) =>
        i === index ? { ...entry, ...value } : entry,
      ),
    });
  }
  function travel(direction: "undo" | "redo") {
    setHistory((state) => {
      const target = direction === "undo" ? state.past.at(-1) : state.future[0];
      if (!target) return state;
      return direction === "undo"
        ? {
            past: state.past.slice(0, -1),
            present: target,
            future: [state.present, ...state.future],
          }
        : {
            past: [...state.past, state.present],
            present: target,
            future: state.future.slice(1),
          };
    });
    setTokenDraft(null);
    setPending(null);
    setStatus(
      "Design history restored. Application commands are never replayed.",
    );
  }

  useEffect(() => {
    const result = controller.current?.update(configuration);
    if (result) setError(result.ok ? null : result.error.message);
  }, [configuration]);
  useEffect(() => {
    const target = mount.current;
    if (!target) return;
    const present = () => decorateToolbar(target, current, allowed, editMode);
    present();
    const observer = new MutationObserver(present);
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [current, allowed, editMode, configuration]);
  useEffect(() => {
    try {
      const auto = localStorage.getItem(AUTOSAVE_KEY);
      const saved =
        localStorage.getItem(DESIGN_KEY) ??
        localStorage.getItem(PLAYGROUND_STORAGE_KEY);
      if (auto !== null) {
        const parsed = parseDesign(auto);
        if (parsed.ok) {
          setHistory({ past: [], present: parsed.value, future: [] });
          setCanAutosave(true);
          setStatus(
            "Recovered your browser-local autosaved design. Application contents were not stored.",
          );
        } else {
          setRecovery(true);
          setStatus(
            `Autosave needs recovery: ${parsed.message} Choose a recovery action before replacing stored data.`,
          );
        }
      } else setCanAutosave(true);
      if (saved !== null)
        setStatus(
          (message) =>
            `${message} A saved configuration is available through Restore saved.`,
        );
      const prefs = localStorage.getItem(`${DESIGN_KEY}:workspace`);
      if (prefs !== null) {
        const parsed: unknown = JSON.parse(prefs);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "width" in parsed &&
          typeof parsed.width === "number" &&
          parsed.width >= 240 &&
          parsed.width <= 420
        )
          setSidebarWidth(parsed.width);
      }
      const favoriteData = localStorage.getItem(`${DESIGN_KEY}:favorites`);
      if (favoriteData !== null) {
        const parsed: unknown = JSON.parse(favoriteData);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (value) =>
              typeof value === "string" &&
              [...APPLICATIONS, ...STYLES].some(({ id }) => id === value),
          )
        )
          setFavorites(parsed);
        else
          setStatus(
            (message) => `${message} Favorites could not be recovered.`,
          );
      }
    } catch {
      setStatus(
        "Local storage is unavailable or contains unreadable preferences. Work continues in memory; export keeps your design.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !canAutosave) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(current));
    } catch {
      setStatus(
        "Autosave could not be written. Your design remains in memory; export it to keep a copy.",
      );
    }
  }, [current, ready, canAutosave]);
  useEffect(() => {
    if (!ready || !canAutosave) return;
    try {
      localStorage.setItem(
        `${DESIGN_KEY}:workspace`,
        JSON.stringify({ width: sidebarWidth }),
      );
      localStorage.setItem(
        `${DESIGN_KEY}:favorites`,
        JSON.stringify(favorites),
      );
    } catch {
      setStatus(
        "Workspace preferences could not be saved. The design remains available in memory.",
      );
    }
  }, [sidebarWidth, favorites, ready, canAutosave]);
  useEffect(() => {
    let active = true;
    setGenerated(null);
    void generateDesignProject(current, theme)
      .then((project) => {
        if (active) setGenerated({ design: current, theme, project });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Local project generation failed.",
          );
      });
    return () => {
      active = false;
    };
  }, [current, theme]);
  useEffect(() => {
    function changed() {
      setFocus(document.fullscreenElement === workspace.current);
    }
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!focus) return;
    const previous = document.activeElement;
    workspace.current
      ?.querySelector<HTMLButtonElement>(".fullscreen-exit")
      ?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && document.fullscreenElement === null) {
        event.preventDefault();
        setFocus(false);
      }
      if (event.key !== "Tab" || !workspace.current) return;
      const controls = [
        ...workspace.current.querySelectorAll<HTMLElement>(
          "button, a, input, select, textarea, [tabindex]",
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden",
      );
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [focus]);

  function save(replace = false) {
    try {
      if (!replace && localStorage.getItem(DESIGN_KEY) !== null) {
        setPending("save");
        return;
      }
      localStorage.setItem(DESIGN_KEY, JSON.stringify(current));
      setPending(null);
      setStatus(
        "Configuration saved in this browser only. Application contents are not stored.",
      );
    } catch {
      setPending(null);
      setStatus(
        "Could not save configuration. It remains in memory; export a copy.",
      );
    }
  }
  function restore() {
    try {
      const raw =
        localStorage.getItem(DESIGN_KEY) ??
        localStorage.getItem(PLAYGROUND_STORAGE_KEY);
      if (raw === null) {
        setStatus("No saved design exists in this browser.");
        setPending(null);
        return;
      }
      const parsed = parseDesign(raw);
      if (!parsed.ok) {
        setStatus(parsed.message);
        setPending(null);
        return;
      }
      commit(parsed.value);
      setStatus("Saved design restored. Undo returns to your previous design.");
    } catch {
      setPending(null);
      setStatus(
        "Could not read the saved design. Your current design is unchanged.",
      );
    }
  }
  function download(text: string, filename: string) {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setStatus("Export downloaded locally. Nothing was uploaded or executed.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function toggleFullscreen() {
    try {
      if (focus && document.fullscreenElement !== workspace.current) {
        setFocus(false);
        return;
      }
      if (document.fullscreenElement === workspace.current)
        await document.exitFullscreen();
      else if (workspace.current?.requestFullscreen)
        await workspace.current.requestFullscreen();
      else {
        setFocus((value) => !value);
        setStatus(
          "Native fullscreen is unavailable; expanded focus view is active instead.",
        );
      }
    } catch {
      setFocus((value) => !value);
      setStatus(
        "Browser fullscreen was denied. Expanded focus view is available; use Exit fullscreen to close it.",
      );
    }
  }
  function startDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    type: "move" | "resize" | "sidebar" | "sheet",
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      type,
      x: event.clientX,
      y: event.clientY,
      design: current,
      width:
        type === "resize"
          ? (mount.current
              ?.querySelector(".mzk-toolbar")
              ?.getBoundingClientRect().width ?? sidebarWidth)
          : sidebarWidth,
      sheet: sheetHeight,
    };
  }
  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    const clamp = (value: number, min: number, max: number) =>
      Math.round(Math.max(min, Math.min(max, value)));
    if (start.type === "sidebar")
      setSidebarWidth(clamp(start.width + dx, 240, 420));
    else if (start.type === "sheet")
      setSheetHeight(
        clamp(start.sheet - (dy / window.innerHeight) * 100, 35, 85),
      );
    else
      setDragDesign({
        ...start.design,
        geometry: {
          ...start.design.geometry,
          ...(start.type === "move"
            ? {
                offsetX: clamp(start.design.geometry.offsetX + dx, -128, 128),
                offsetY: clamp(start.design.geometry.offsetY - dy, 0, 120),
              }
            : {
                width: clamp(
                  (start.design.geometry.width || start.width) + dx,
                  180,
                  1100,
                ),
              }),
        },
      });
  }
  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragDesign) commit(dragDesign);
    drag.current = null;
    setDragDesign(null);
  }
  const dragEvents = {
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: () => {
      drag.current = null;
      setDragDesign(null);
    },
  };
  const list = tab === "application" ? APPLICATIONS : STYLES;
  const shown = list.filter(
    (entry) =>
      `${entry.name} ${"description" in entry ? entry.description : ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "All" || entry.category === category) &&
      (!favoriteOnly || favorites.includes(entry.id)),
  );
  const colors = current.appearance[variant];
  let colorCandidate = colors;
  let colorError: string | null = null;
  if (tokenDraft !== null) {
    try {
      colorCandidate = JSON.parse(tokenDraft);
    } catch {
      colorError = "Invalid color data.";
    }
    const validated = validateThemeTokens(colorCandidate);
    if (!validated.ok)
      colorError = validated.errors.map(({ message }) => message).join(" ");
  }

  return (
    <HydrationBoundary label="Functional Playground and personalized Quick Start">
      <section
        className="playground-section"
        id="playground"
        tabIndex={-1}
        aria-labelledby="playground-heading"
      >
        <div className="playground-heading">
          <div>
            <p className="eyebrow">FUNCTIONAL PLAYGROUND · SDK 0.1.0 PREVIEW</p>
            <h2 id="playground-heading">Your interface. Your toolbar.</h2>
          </div>
          <span className="status-pill">LOCAL ONLY</span>
        </div>
        <div
          className="playground-utilities"
          aria-label="Playground history and storage"
        >
          <button
            type="button"
            disabled={!history.past.length || source !== null}
            onClick={() => travel("undo")}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!history.future.length || source !== null}
            onClick={() => travel("redo")}
          >
            Redo
          </button>
          <button type="button" onClick={() => setPending("reset")}>
            Reset configuration
          </button>
          <button
            type="button"
            disabled={source !== null}
            onClick={() => save()}
          >
            Save locally
          </button>
          <button type="button" onClick={() => setPending("restore")}>
            Restore saved
          </button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            {focus ? "Exit fullscreen" : "Fullscreen preview"}
          </button>
        </div>
        {pending && (
          <div
            role="group"
            className="playground-confirmation"
            aria-label="Confirm configuration change"
          >
            <p>
              {pending === "save"
                ? "Replace the saved configuration?"
                : pending === "restore"
                  ? "Restore the saved configuration? Undo preserves your current design."
                  : pending === "autosave"
                    ? "Replace unreadable autosave with the current design? Export the unreadable data first if needed."
                    : "Reset this design? Undo preserves your current design."}{" "}
              Unapplied JSON edits will be discarded.
            </p>
            <button
              type="button"
              onClick={() => {
                if (pending === "save") save(true);
                else if (pending === "restore") restore();
                else if (pending === "autosave") {
                  setRecovery(false);
                  setCanAutosave(true);
                  setPending(null);
                } else {
                  commit(INITIAL_DESIGN);
                  setStatus("Defaults restored. Undo is available.");
                }
              }}
            >
              Confirm {pending === "save" ? "replace saved" : pending}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                imported.current = null;
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {recovery && (
          <div
            className="playground-confirmation"
            role="group"
            aria-label="Autosave recovery"
          >
            <p>
              Unreadable or newer autosave is preserved. Export it before
              explicitly replacing it.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  download(
                    localStorage.getItem(AUTOSAVE_KEY) ?? "",
                    "toolbar.unrecovered.json",
                  );
                } catch {
                  setStatus("Could not read the unrecovered autosave.");
                }
              }}
            >
              Export unrecovered data
            </button>
            <button type="button" onClick={() => setPending("autosave")}>
              Use current design for autosave
            </button>
          </div>
        )}
        <div
          className="mobile-workspace-modes"
          aria-label="Mobile workspace view"
        >
          {(["preview", "customize", "code"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={mobileMode === mode}
              onClick={() => {
                setMobileMode(mode);
                if (mode === "code") setSection("Code & Export");
              }}
            >
              {mode}
            </button>
          ))}
        </div>
        <div
          ref={workspace}
          id="playground-workspace"
          className="playground-workspace"
          data-mobile-mode={mobileMode}
          data-focus={focus}
        >
          {focus && (
            <button
              type="button"
              className="fullscreen-exit"
              onClick={() => void toggleFullscreen()}
            >
              Exit fullscreen
            </button>
          )}
          <style
            nonce={nonce}
          >{`#playground-workspace { --sidebar-width:${sidebarWidth}px; --sheet-height:${sheetHeight}svh; }\n${presentationCSS(preview, "#playground-canvas", theme)}`}</style>
          <aside
            className="playground-sidebar"
            aria-label="Playground settings"
          >
            <button
              type="button"
              className="sheet-resize"
              aria-label="Resize settings sheet"
              onPointerDown={(event) => startDrag(event, "sheet")}
              {...dragEvents}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  setSheetHeight((value) =>
                    Math.max(
                      35,
                      Math.min(85, value + (event.key === "ArrowUp" ? 5 : -5)),
                    ),
                  );
                }
              }}
            >
              Resize settings ↕
            </button>
            {PLAYGROUND_SECTIONS.map((name, index) => (
              <div className="playground-accordion" key={name}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={section === name}
                    aria-controls={`playground-panel-${index}`}
                    onClick={() => setSection(section === name ? null : name)}
                  >
                    <span>{name}</span>
                    <span aria-hidden="true">
                      {section === name ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                <div id={`playground-panel-${index}`} hidden={section !== name}>
                  {name === "Templates" && (
                    <>
                      <div
                        className="template-tabs"
                        aria-label="Template library"
                      >
                        <button
                          type="button"
                          aria-pressed={tab === "application"}
                          onClick={() => {
                            setTab("application");
                            setCategory("All");
                          }}
                        >
                          Application
                        </button>
                        <button
                          type="button"
                          aria-pressed={tab === "style"}
                          onClick={() => {
                            setTab("style");
                            setCategory("All");
                          }}
                        >
                          Toolbar Style
                        </button>
                      </div>
                      <label>
                        Search templates
                        <input
                          type="search"
                          value={query}
                          onChange={(event) =>
                            setQuery(event.currentTarget.value)
                          }
                        />
                      </label>
                      <label>
                        Template category
                        <select
                          value={category}
                          onChange={(event) =>
                            setCategory(event.currentTarget.value)
                          }
                        >
                          <option>All</option>
                          {[
                            ...new Set(list.map(({ category }) => category)),
                          ].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={favoriteOnly}
                          onChange={(event) =>
                            setFavoriteOnly(event.currentTarget.checked)
                          }
                        />
                        Favorites only
                      </label>
                      <div className="template-list">
                        {shown.map((entry) => (
                          <div
                            className={`template-card template-${entry.id}`}
                            key={entry.id}
                          >
                            <button
                              type="button"
                              disabled={source !== null}
                              aria-pressed={
                                current.application === entry.id ||
                                current.style === entry.id
                              }
                              onClick={() => {
                                if (tab === "application") {
                                  const target = APPLICATIONS.find(
                                    ({ id }) => id === entry.id,
                                  );
                                  if (!target) return;
                                  const previous = defaultActions(
                                    current.application,
                                  );
                                  const next = defaultActions(target.id);
                                  const actions = current.actions.map(
                                    (action, i) => {
                                      const old = previous.find(
                                        ({ command }) =>
                                          command === action.command,
                                      );
                                      const replacement = next[i];
                                      if (!old || !replacement) return action;
                                      const label =
                                        action.label === old.label
                                          ? replacement.label
                                          : action.label;
                                      return {
                                        ...action,
                                        command: replacement.command,
                                        label,
                                        accessibleName:
                                          action.accessibleName === action.label
                                            ? label
                                            : `${label} — ${action.accessibleName}`,
                                        tooltip:
                                          action.tooltip === old.tooltip
                                            ? replacement.tooltip
                                            : action.tooltip,
                                      };
                                    },
                                  );
                                  commit({
                                    ...current,
                                    application: target.id,
                                    actions,
                                  });
                                  setStatus(
                                    "Application changed. Style is preserved; compatible action slots are rebound to the new host. Undo restores the previous design.",
                                  );
                                } else {
                                  const target = STYLES.find(
                                    ({ id }) => id === entry.id,
                                  );
                                  if (target) {
                                    commit(applyStyle(current, target.id));
                                    setStatus(
                                      "Style applied to geometry/material only. Colors, application and actions are preserved; Undo is available.",
                                    );
                                  }
                                }
                              }}
                            >
                              <span
                                className="template-thumbnail"
                                aria-hidden="true"
                              >
                                {"glyph" in entry ? entry.glyph : "•••"}
                              </span>
                              <strong>{entry.name}</strong>
                              <span>{entry.category}</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`${favorites.includes(entry.id) ? "Unfavorite" : "Favorite"} ${entry.name}`}
                              onClick={() =>
                                setFavorites((value) =>
                                  value.includes(entry.id)
                                    ? value.filter((id) => id !== entry.id)
                                    : [...value, entry.id],
                                )
                              }
                            >
                              {favorites.includes(entry.id) ? "★" : "☆"}
                            </button>
                          </div>
                        ))}
                      </div>
                      {!shown.length && (
                        <p role="status">No matching templates.</p>
                      )}
                    </>
                  )}
                  {name === "Appearance" && (
                    <>
                      <label>
                        Edit theme variant
                        <select
                          value={variant}
                          onChange={(event) => {
                            setVariant(
                              event.currentTarget.value === "dark"
                                ? "dark"
                                : "light",
                            );
                            setTokenDraft(null);
                          }}
                        >
                          <option>light</option>
                          <option>dark</option>
                        </select>
                      </label>
                      <p>
                        Editing a variant does not switch the global theme or
                        overwrite the other variant.
                      </p>
                      {Object.entries(colorCandidate).map(([key, value]) => (
                        <label key={key}>
                          {key}
                          <input
                            aria-label={`${variant} ${key} color`}
                            type="color"
                            value={value}
                            disabled={source !== null}
                            onChange={(event) =>
                              setTokenDraft(
                                JSON.stringify({
                                  ...colorCandidate,
                                  [key]: event.currentTarget.value,
                                }),
                              )
                            }
                          />
                        </label>
                      ))}
                      {colorError && <p role="alert">{colorError}</p>}
                      <button
                        type="button"
                        disabled={
                          source !== null ||
                          tokenDraft === null ||
                          colorError !== null
                        }
                        onClick={() =>
                          patch({
                            appearance: {
                              ...current.appearance,
                              [variant]: colorCandidate,
                            },
                          })
                        }
                      >
                        Apply variant colors
                      </button>
                      {(
                        [
                          "opacity",
                          "blur",
                          "shadow",
                          "borderWidth",
                          "fontSize",
                          "iconSize",
                        ] as const
                      ).map((key) => (
                        <label key={key}>
                          {key}
                          <input
                            type="range"
                            aria-label={`Toolbar ${key}`}
                            min={
                              key === "opacity"
                                ? 90
                                : key === "fontSize" || key === "iconSize"
                                  ? 14
                                  : 0
                            }
                            max={
                              key === "opacity"
                                ? 100
                                : key === "borderWidth"
                                  ? 4
                                  : key === "fontSize"
                                    ? 18
                                    : key === "shadow"
                                      ? 32
                                      : 24
                            }
                            value={current.appearance[key]}
                            disabled={source !== null}
                            onChange={(event) =>
                              patch({
                                appearance: {
                                  ...current.appearance,
                                  [key]: Number(event.currentTarget.value),
                                },
                              })
                            }
                          />
                          <output>{current.appearance[key]}</output>
                        </label>
                      ))}
                    </>
                  )}
                  {name === "Geometry & Position" && (
                    <>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={editMode}
                          onChange={(event) =>
                            setEditMode(event.currentTarget.checked)
                          }
                        />
                        Edit Mode
                      </label>
                      <p>
                        Outside Edit Mode, toolbar actions work normally.
                        Numeric controls and drag handles share the same
                        geometry. Width 0 means intrinsic; Y offset 0 attaches
                        to the bottom.
                      </p>
                      {(
                        [
                          "width",
                          "height",
                          "gap",
                          "radius",
                          "offsetX",
                          "offsetY",
                        ] as const
                      ).map((key) => (
                        <label key={key}>
                          {key}
                          <input
                            type="number"
                            aria-label={`Toolbar ${key}`}
                            min={
                              key === "height"
                                ? 56
                                : key === "offsetX"
                                  ? -128
                                  : 0
                            }
                            max={
                              key === "width"
                                ? 1100
                                : key === "height"
                                  ? 96
                                  : key === "gap"
                                    ? 24
                                    : key === "radius"
                                      ? 48
                                      : key === "offsetX"
                                        ? 128
                                        : 120
                            }
                            value={preview.geometry[key]}
                            disabled={source !== null}
                            onChange={(event) =>
                              geometry({
                                [key]: Number(event.currentTarget.value),
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Position
                        <select
                          value={current.geometry.position}
                          disabled={source !== null}
                          onChange={(event) =>
                            geometry({
                              position:
                                event.currentTarget.value === "top"
                                  ? "top"
                                  : "bottom",
                            })
                          }
                        >
                          <option>bottom</option>
                          <option>top</option>
                        </select>
                      </label>
                      <label>
                        Horizontal alignment
                        <select
                          value={current.geometry.align}
                          disabled={source !== null}
                          onChange={(event) =>
                            geometry({
                              align:
                                event.currentTarget.value === "start"
                                  ? "start"
                                  : event.currentTarget.value === "end"
                                    ? "end"
                                    : "center",
                            })
                          }
                        >
                          <option>start</option>
                          <option>center</option>
                          <option>end</option>
                        </select>
                      </label>
                    </>
                  )}
                  {name === "Actions" && (
                    <>
                      <p>
                        Commands are host-allowlisted. Incompatible commands
                        remain visible but disabled. Groups and arbitrary
                        callbacks are not part of the current SDK action
                        contract.
                      </p>
                      {current.actions.map((action, i) => (
                        <fieldset className="action-editor" key={action.id}>
                          <legend>
                            Action {i + 1} · {action.id}
                          </legend>
                          <label>
                            Label
                            <input
                              aria-label={`Label for ${action.id}`}
                              maxLength={80}
                              value={action.label}
                              disabled={source !== null}
                              onChange={(event) =>
                                actionPatch(i, {
                                  label: event.currentTarget.value,
                                  accessibleName: event.currentTarget.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Accessible name
                            <input
                              value={action.accessibleName}
                              disabled={source !== null}
                              onChange={(event) =>
                                actionPatch(i, {
                                  accessibleName: event.currentTarget.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Tooltip
                            <input
                              value={action.tooltip}
                              disabled={source !== null}
                              onChange={(event) =>
                                actionPatch(i, {
                                  tooltip: event.currentTarget.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Command
                            <select
                              value={action.command}
                              disabled={source !== null}
                              onChange={(event) => {
                                const command = COMMANDS.find(
                                  ({ id }) => id === event.currentTarget.value,
                                );
                                if (command)
                                  actionPatch(i, { command: command.id });
                              }}
                            >
                              {COMMANDS.map(({ id, label, application }) => (
                                <option key={id} value={id}>
                                  {label} · {application}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Icon
                            <select
                              value={action.icon}
                              disabled={source !== null}
                              onChange={(event) => {
                                const icon = (
                                  Object.keys(ICONS) as (keyof typeof ICONS)[]
                                ).find(
                                  (key) => key === event.currentTarget.value,
                                );
                                if (icon) actionPatch(i, { icon });
                              }}
                            >
                              {Object.keys(ICONS).map((key) => (
                                <option key={key}>{key}</option>
                              ))}
                            </select>
                          </label>
                          <label className="inline-check">
                            <input
                              type="checkbox"
                              checked={action.enabled}
                              disabled={source !== null}
                              onChange={(event) =>
                                actionPatch(i, {
                                  enabled: event.currentTarget.checked,
                                })
                              }
                            />
                            Enabled
                          </label>
                          {!allowed.includes(action.command) && (
                            <p>
                              Unavailable in the current application context.
                            </p>
                          )}
                          <div className="action-editor-tools">
                            <button
                              type="button"
                              disabled={source !== null || i === 0}
                              aria-label={`Move ${action.label} earlier`}
                              onClick={() => {
                                const actions = [...current.actions];
                                const [moved] = actions.splice(i, 1);
                                if (moved) {
                                  actions.splice(i - 1, 0, moved);
                                  patch({ actions });
                                }
                              }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={
                                source !== null ||
                                i === current.actions.length - 1
                              }
                              aria-label={`Move ${action.label} later`}
                              onClick={() => {
                                const actions = [...current.actions];
                                const [moved] = actions.splice(i, 1);
                                if (moved) {
                                  actions.splice(i + 1, 0, moved);
                                  patch({ actions });
                                }
                              }}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              disabled={
                                source !== null || current.actions.length >= 12
                              }
                              onClick={() => {
                                let id = 1;
                                while (
                                  current.actions.some(
                                    (entry) => entry.id === `action-${id}`,
                                  )
                                )
                                  id++;
                                patch({
                                  actions: [
                                    ...current.actions,
                                    { ...action, id: `action-${id}` },
                                  ],
                                });
                              }}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              disabled={source !== null}
                              onClick={() =>
                                patch({
                                  actions: current.actions.filter(
                                    (_, index) => index !== i,
                                  ),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </fieldset>
                      ))}
                      <button
                        type="button"
                        disabled={
                          source !== null || current.actions.length >= 12
                        }
                        onClick={() => {
                          let id = 1;
                          while (
                            current.actions.some(
                              (entry) => entry.id === `action-${id}`,
                            )
                          )
                            id++;
                          const action = defaultActions(current.application)[0];
                          if (action)
                            patch({
                              actions: [
                                ...current.actions,
                                { ...action, id: `action-${id}` },
                              ],
                            });
                        }}
                      >
                        Add action
                      </button>
                      <button
                        type="button"
                        disabled={source !== null}
                        onClick={() =>
                          patch({
                            actions: defaultActions(current.application),
                          })
                        }
                      >
                        Restore application actions
                      </button>
                    </>
                  )}
                  {name === "Motion & Interaction" && (
                    <>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={current.motion}
                          disabled={source !== null}
                          onChange={(event) =>
                            patch({ motion: event.currentTarget.checked })
                          }
                        />
                        Restrained toolbar transitions
                      </label>
                      <p>
                        Reduced motion always overrides presentation motion.
                        Keyboard and accessible target sizes cannot be disabled.
                      </p>
                    </>
                  )}
                  {name === "Context & Capabilities" && (
                    <>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={current.contextual}
                          disabled={source !== null}
                          onChange={(event) =>
                            patch({ contextual: event.currentTarget.checked })
                          }
                        />
                        Selection-aware document formatting
                      </label>
                      <p>
                        The Document Editor reports actual text selection. The
                        Board reports its selected card. Host authorization
                        remains authoritative even with context gating disabled.
                        Optional SDK systems and telemetry are not activated.
                      </p>
                    </>
                  )}
                  {name === "Advanced Settings" && (
                    <>
                      <p>
                        Only design/configuration autosaves. Application text,
                        task titles and board contents are not retained. All
                        work stays in this browser.
                      </p>
                      <a href="#versioned-docs">SDK reference</a>
                      <label>
                        Import Playground design
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (!file) return;
                            if (file.size > 65536) {
                              setStatus("Design exceeds 64 KiB.");
                              return;
                            }
                            void file
                              .text()
                              .then((raw) => {
                                const parsed = parseDesign(raw);
                                if (!parsed.ok) {
                                  setStatus(parsed.message);
                                  return;
                                }
                                imported.current = parsed.value;
                                setStatus(
                                  "Valid import ready. Confirm below to replace the current design; Undo is available.",
                                );
                              })
                              .catch(() =>
                                setStatus("Could not read the design file."),
                              );
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!imported.current) {
                            setStatus("Choose a valid design file first.");
                            return;
                          }
                          commit(imported.current);
                          imported.current = null;
                          setStatus(
                            "Validated imported design applied. Undo is available.",
                          );
                        }}
                      >
                        Confirm design import
                      </button>
                    </>
                  )}
                  {name === "Code & Export" && (
                    <>
                      <label>
                        Playground configuration JSON
                        <textarea
                          aria-label="Playground configuration JSON"
                          spellCheck={false}
                          rows={14}
                          maxLength={65536}
                          value={sourceText}
                          onChange={(event) =>
                            setSource(event.currentTarget.value)
                          }
                        />
                      </label>
                      <p className="playground-validation" role="status">
                        {validation.ok
                          ? "SDK schema and Workspace policy validation passed."
                          : validation.message}
                      </p>
                      <button
                        type="button"
                        disabled={!validation.ok || source === null}
                        onClick={() => {
                          if (validation.ok) commit(validation.value);
                        }}
                      >
                        Apply Playground JSON
                      </button>
                      <button
                        type="button"
                        disabled={source === null}
                        onClick={() => setSource(null)}
                      >
                        Discard JSON edits
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          download(
                            JSON.stringify(current, null, 2),
                            "toolbar.playground.design.json",
                          )
                        }
                      >
                        Download design
                      </button>
                      <a href="#quick-start">
                        Personalized Vanilla integration
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </aside>
          <button
            type="button"
            className="sidebar-resize"
            aria-label="Resize settings sidebar"
            onPointerDown={(event) => startDrag(event, "sidebar")}
            {...dragEvents}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                setSidebarWidth((value) =>
                  Math.max(
                    240,
                    Math.min(
                      420,
                      value + (event.key === "ArrowRight" ? 16 : -16),
                    ),
                  ),
                );
              }
            }}
          >
            ⋮
          </button>
          <div
            ref={mount}
            id="playground-canvas"
            className="playground-application"
            data-theme={theme}
          >
            <PlaygroundApplications
              ref={application}
              application={current.application}
              contextual={current.contextual}
              onStatus={appStatus}
              onAvailable={onAvailable}
            />
            {editMode && (
              <div className="geometry-handles">
                <p>Edit Mode · commands paused</p>
                {(["move", "resize"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onPointerDown={(event) => startDrag(event, type)}
                    {...dragEvents}
                    onKeyDown={(event) => {
                      if (
                        ![
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                        ].includes(event.key)
                      )
                        return;
                      event.preventDefault();
                      if (type === "resize")
                        geometry({
                          width: Math.max(
                            180,
                            Math.min(
                              1100,
                              Math.round(
                                current.geometry.width ||
                                  mount.current
                                    ?.querySelector(".mzk-toolbar")
                                    ?.getBoundingClientRect().width ||
                                  400,
                              ) + (event.key === "ArrowLeft" ? -16 : 16),
                            ),
                          ),
                        });
                      else
                        geometry({
                          offsetX: Math.max(
                            -128,
                            Math.min(
                              128,
                              current.geometry.offsetX +
                                (event.key === "ArrowLeft"
                                  ? -8
                                  : event.key === "ArrowRight"
                                    ? 8
                                    : 0),
                            ),
                          ),
                          offsetY: Math.max(
                            0,
                            Math.min(
                              120,
                              current.geometry.offsetY +
                                (event.key === "ArrowUp"
                                  ? 8
                                  : event.key === "ArrowDown"
                                    ? -8
                                    : 0),
                            ),
                          ),
                        });
                    }}
                  >
                    {type === "move" ? "Move toolbar" : "Resize toolbar"}
                  </button>
                ))}
              </div>
            )}
            <ToolbarMount
              className="playground-toolbar"
              configuration={initialConfiguration}
              host={host}
              onController={onController}
              onMountError={onMountError}
            />
          </div>
        </div>
        <p className="playground-status" role="status" aria-live="polite">
          {status}
        </p>
        {source !== null && (
          <p className="playground-hint">
            JSON edits are not applied. Preview, Quick Start, export and
            autosave retain the last valid design.{" "}
            <button
              type="button"
              onClick={() => {
                setSection("Code & Export");
                setMobileMode("code");
              }}
            >
              Return to Code & Export
            </button>
          </p>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
      <section
        className="section-shell personalized-quickstart"
        id="quick-start"
        tabIndex={-1}
        aria-labelledby="personalized-heading"
      >
        <div>
          <p className="eyebrow">PERSONALIZED QUICK START</p>
          <h2 id="personalized-heading">From design to code.</h2>
          <label>
            Verified generator
            <select
              aria-label="Verified integration environment"
              value="vanilla"
              onChange={() =>
                setStatus("Vanilla is the verified generated integration.")
              }
            >
              <option value="vanilla">Vanilla JavaScript · verified</option>
            </select>
          </label>
          <p>
            Configuration, geometry, both theme variants, labels and icons are
            portable. The shared SDK generator supplies the real mount, dispatch
            and cleanup lifecycle. No privileged user code runs here.
          </p>
          <p>
            The SDK is not published. Build it in this checkout with{" "}
            <code>pnpm --filter @moorkyz/toolbar build</code>. Export files into
            a new folder and run{" "}
            <code>
              node server.mjs --sdk-path &lt;absolute SDK package path&gt;
            </code>{" "}
            as described in the generated README.
          </p>
          <p>
            React, Next.js, Vue and Angular have{" "}
            <a href="https://github.com/Moorky/moorkyz-toolbar/tree/master/examples">
              tested consumer fixtures
            </a>
            , not generated starters. Generated sample hosts report action IDs;
            the four mini-applications are not generated.
          </p>
        </div>
        <div className="code-panel">
          <div className="code-panel-header">
            <label htmlFor="playground-file">Vanilla source file</label>
            <select
              id="playground-file"
              value={selectedFile}
              disabled={!project}
              onChange={(event) => setSelectedFile(event.currentTarget.value)}
            >
              {[
                "toolbar.config.js",
                "app.js",
                "style.css",
                "presentation.js",
                "playground.design.json",
                "index.html",
                "README.md",
              ].map((file) => (
                <option key={file}>{file}</option>
              ))}
            </select>
            {generatedFile && (
              <CopyButton
                text={generatedFile.content}
                label="Copy personalized source"
              />
            )}
          </div>
          <pre
            tabIndex={0}
            aria-label="Personalized Vanilla integration source"
          >
            <code>
              {generatedFile?.content ?? "Preparing verified Vanilla source…"}
            </code>
          </pre>
          <div className="workbench-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={!project}
              onClick={() => {
                if (project)
                  download(
                    JSON.stringify({ version: 1, project }, null, 2),
                    "toolbar.playground.vanilla.json",
                  );
              }}
            >
              Export personalized Vanilla project
            </button>
          </div>
          <p className="code-disclaimer">
            Versioned JSON contains all source files and SHA-256 integrity
            metadata, not an installer. Nothing is installed, uploaded or
            executed by export.
          </p>
        </div>
      </section>
    </HydrationBoundary>
  );
}
