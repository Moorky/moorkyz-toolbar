"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  THEME_NAMES,
  type ToolbarConfiguration,
  type ToolbarController,
} from "@moorkyz/toolbar";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import {
  generateProject,
  type GeneratedProject,
} from "@moorkyz/toolbar/generator";
import { usePortalSettings } from "./portal-shell";
import { CopyButton } from "./copy-button";
import { HydrationBoundary } from "./hydration-boundary";
import {
  INITIAL_PLAYGROUND_CONFIGURATION,
  PLAYGROUND_SECTIONS,
  PLAYGROUND_STORAGE_KEY,
  parsePlaygroundJSON,
  validatePlaygroundConfiguration,
} from "./playground-model";

interface History {
  readonly past: readonly ToolbarConfiguration[];
  readonly present: ToolbarConfiguration;
  readonly future: readonly ToolbarConfiguration[];
}

const INITIAL_TASKS = [
  { id: 1, title: "Explore your new workspace", done: true },
  { id: 2, title: "Make the toolbar your own", done: false },
  { id: 3, title: "Export a local Vanilla starter", done: false },
];

export function FunctionalPlayground() {
  const { theme } = usePortalSettings();
  const [history, setHistory] = useState<History>({
    past: [],
    present: INITIAL_PLAYGROUND_CONFIGURATION,
    future: [],
  });
  const [section, setSection] = useState<string | null>("Templates");
  const [source, setSource] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "restore" | "reset" | null>(
    null,
  );
  const [status, setStatus] = useState(
    "Local sample data. Configuration is saved only when you choose Save locally.",
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [showCompleted, setShowCompleted] = useState(true);
  const [title, setTitle] = useState("");
  const [generated, setGenerated] = useState<{
    readonly configuration: ToolbarConfiguration;
    readonly project: GeneratedProject;
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState("toolbar.config.js");
  const nextTask = useRef(4);
  const taskInput = useRef<HTMLInputElement>(null);
  const controller = useRef<ToolbarController | null>(null);
  const configuration = useMemo(
    () => ({ ...history.present, colorScheme: theme }),
    [history.present, theme],
  );
  const configurationRef = useRef(configuration);
  configurationRef.current = configuration;
  const project =
    generated?.configuration === configuration ? generated.project : null;
  const generatedFile = project?.files.find(
    ({ path }) => path === selectedFile,
  );
  const code = source ?? JSON.stringify(configuration, null, 2);
  const validation = useMemo(() => parsePlaygroundJSON(code), [code]);
  const hasUnappliedSource = source !== null;

  const dispatchAction = useCallback((id: string) => {
    switch (id) {
      case "add-task":
        taskInput.current?.focus();
        setStatus("Enter a task title in the workspace, then choose Add task.");
        break;
      case "toggle-completed":
        setShowCompleted((current) => !current);
        setStatus("Completed task visibility changed by the Workspace host.");
        break;
      case "clear-completed":
        setTasks((current) => current.filter(({ done }) => !done));
        setStatus("Completed sample tasks cleared by the Workspace host.");
        break;
      default:
        throw new Error(`Workspace host does not authorize command "${id}".`);
    }
  }, []);
  const host = useMemo(
    () => ({
      dispatchAction,
      onActionError: (_cause: unknown, id: string) =>
        setPreviewError(`Workspace command "${id}" failed.`),
    }),
    [dispatchAction],
  );
  const onController = useCallback((instance: ToolbarController | null) => {
    controller.current = instance;
    if (instance !== null) {
      const result = instance.update(configurationRef.current);
      setPreviewError(result.ok ? null : result.error.message);
    }
  }, []);
  const onMountError = useCallback(
    (error: { readonly message: string }) => setPreviewError(error.message),
    [],
  );

  useEffect(() => {
    const result = controller.current?.update(configuration);
    if (result !== undefined)
      setPreviewError(result.ok ? null : result.error.message);
  }, [configuration]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PLAYGROUND_STORAGE_KEY);
      if (saved !== null) {
        const result = parsePlaygroundJSON(saved, true);
        setStatus(
          result.ok
            ? "A saved configuration is available. Choose Restore saved to review and recover it."
            : `Saved draft needs recovery: ${result.message}`,
        );
      }
    } catch {
      setStatus(
        "Local storage is unavailable. The workspace still works in memory; use export to keep your configuration.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    setGenerated(null);
    setGenerationError(null);
    void generateProject({
      name: "my-toolbar-workspace",
      framework: "vanilla",
      preset: "universal",
      origin: "studio",
      configuration,
    })
      .then((result) => {
        if (!active) return;
        if (result.ok) setGenerated({ configuration, project: result.value });
        else setGenerationError(result.error.message);
      })
      .catch(() => {
        if (active)
          setGenerationError(
            "Local Vanilla generation failed. Your configuration is unchanged; retry by editing or undoing a configuration change.",
          );
      });
    return () => {
      active = false;
    };
  }, [configuration]);

  function apply(value: ToolbarConfiguration) {
    setHistory((current) =>
      JSON.stringify(current.present) === JSON.stringify(value)
        ? current
        : {
            past: [...current.past.slice(-49), current.present],
            present: value,
            future: [],
          },
    );
    setSource(null);
    setPending(null);
  }

  function patch(value: Partial<ToolbarConfiguration>) {
    const result = validatePlaygroundConfiguration({
      ...history.present,
      ...value,
    });
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    apply(result.value);
  }

  function travel(direction: "undo" | "redo") {
    setHistory((current) => {
      if (direction === "undo") {
        const previous = current.past.at(-1);
        return previous === undefined
          ? current
          : {
              past: current.past.slice(0, -1),
              present: previous,
              future: [current.present, ...current.future],
            };
      }
      const next = current.future[0];
      return next === undefined
        ? current
        : {
            past: [...current.past, current.present],
            present: next,
            future: current.future.slice(1),
          };
    });
    setSource(null);
    setPending(null);
    setStatus(
      "Configuration history restored. Application tasks are not replayed.",
    );
  }

  function save(replace = false) {
    try {
      if (
        !replace &&
        window.localStorage.getItem(PLAYGROUND_STORAGE_KEY) !== null
      ) {
        setPending("save");
        return;
      }
      window.localStorage.setItem(
        PLAYGROUND_STORAGE_KEY,
        JSON.stringify({ version: 1, configuration: history.present }),
      );
      setPending(null);
      setStatus(
        "Configuration saved in this browser only. Sample task contents are not stored.",
      );
    } catch {
      setPending(null);
      setStatus(
        "Could not save configuration. It remains in memory; download an export instead.",
      );
    }
  }

  function restore() {
    try {
      const raw = window.localStorage.getItem(PLAYGROUND_STORAGE_KEY);
      if (raw === null) {
        setStatus("No saved Playground configuration exists in this browser.");
        setPending(null);
        return;
      }
      const result = parsePlaygroundJSON(raw, true);
      if (!result.ok) {
        setStatus(result.message);
        setPending(null);
        return;
      }
      apply(result.value);
      setStatus(
        "Saved configuration restored. Undo returns to your previous configuration.",
      );
    } catch {
      setPending(null);
      setStatus(
        "Could not read the saved configuration. Your current configuration is unchanged.",
      );
    }
  }

  function download() {
    if (project === null) {
      setStatus("A valid generated Vanilla project is required before export.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, project }, null, 2)], {
        type: "application/json",
      }),
    );
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = "toolbar.playground.vanilla.json";
      link.click();
      setStatus(
        "Vanilla project data exported locally. Review the included README; no files were installed or executed.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
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
            <p className="eyebrow">LIVE PLAYGROUND · SDK 0.1.0 PREVIEW</p>
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
            disabled={history.past.length === 0 || hasUnappliedSource}
            onClick={() => travel("undo")}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={history.future.length === 0 || hasUnappliedSource}
            onClick={() => travel("redo")}
          >
            Redo
          </button>
          <button type="button" onClick={() => setPending("reset")}>
            Reset configuration
          </button>
          <button
            type="button"
            disabled={hasUnappliedSource}
            onClick={() => save()}
          >
            Save locally
          </button>
          <button type="button" onClick={() => setPending("restore")}>
            Restore saved
          </button>
        </div>
        {pending !== null && (
          <div
            className="playground-confirmation"
            role="group"
            aria-label="Confirm configuration change"
          >
            <p>
              {pending === "save"
                ? "Replace the saved configuration? This also replaces an unreadable or newer saved draft."
                : pending === "restore"
                  ? "Restore the saved configuration? Current edits can be recovered with Undo; unapplied JSON will be discarded."
                  : "Reset configuration to the built-in defaults? Undo will keep your current configuration; unapplied JSON will be discarded."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (pending === "save") save(true);
                else if (pending === "restore") restore();
                else {
                  apply(INITIAL_PLAYGROUND_CONFIGURATION);
                  setStatus(
                    "Default configuration restored. Undo is available; saved configuration was not deleted.",
                  );
                }
              }}
            >
              Confirm {pending === "save" ? "replace saved" : pending}
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        )}
        <div className="playground-workspace">
          <aside
            className="playground-sidebar"
            aria-label="Playground settings"
          >
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
                      <p className="eyebrow">APPLICATION</p>
                      <div
                        className="playground-template"
                        aria-label="Selected application: Modern Workspace"
                      >
                        <span aria-hidden="true">▤</span>
                        <strong>Modern Workspace</strong>
                        <p>
                          A working local task list. Use the toolbar to change
                          the application, not a screenshot.
                        </p>
                      </div>
                      <p className="eyebrow">TOOLBAR STYLE</p>
                      <p>Minimal Floating Pill · real SDK default</p>
                      <p className="playground-hint">
                        Document Editor, Analytics Dashboard, Project Board and
                        the geometry style library are next-slice capabilities,
                        not available templates yet.
                      </p>
                    </>
                  )}
                  {name === "Appearance" && (
                    <>
                      <label htmlFor="playground-theme">
                        Toolbar token family
                      </label>
                      <select
                        id="playground-theme"
                        value={history.present.theme}
                        disabled={hasUnappliedSource}
                        onChange={(event) => {
                          const selected = THEME_NAMES.find(
                            (value) => value === event.currentTarget.value,
                          );
                          if (selected !== undefined)
                            patch({ theme: selected });
                        }}
                      >
                        {THEME_NAMES.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                      <p>
                        The global theme selects the light/dark variant without
                        replacing this token family.
                      </p>
                      <p className="playground-hint">
                        Manual per-variant colors and structural style presets
                        follow in the style-library slice.
                      </p>
                    </>
                  )}
                  {name === "Geometry & Position" && (
                    <p>
                      The SDK is container-anchored at the bottom of this
                      workspace. Width, offsets, shape editing and direct
                      manipulation are planned for the geometry slice; they are
                      not SDK configuration fields today.
                    </p>
                  )}
                  {name === "Actions" && (
                    <>
                      <p>
                        Rename the three host-owned Workspace commands. Full
                        add/remove/reorder editing follows in the action-editor
                        slice.
                      </p>
                      {history.present.actions.map((action) => (
                        <label key={action.id}>
                          {action.id}
                          <input
                            aria-label={`Label for ${action.id}`}
                            value={action.label}
                            maxLength={80}
                            disabled={hasUnappliedSource}
                            onChange={(event) => {
                              patch({
                                actions: history.present.actions.map((entry) =>
                                  entry.id === action.id
                                    ? {
                                        ...entry,
                                        label: event.currentTarget.value,
                                      }
                                    : entry,
                                ),
                              });
                            }}
                          />
                        </label>
                      ))}
                    </>
                  )}
                  {name === "Motion & Interaction" && (
                    <p>
                      Native SDK keyboard navigation and reduced-motion support
                      are active. Custom motion parameters are not exposed by
                      the current configuration contract.
                    </p>
                  )}
                  {name === "Context & Capabilities" && (
                    <p>
                      The Workspace host owns the task list and allowlists three
                      local commands. Optional SDK systems, including spatial
                      coordination, AI and telemetry, are not activated here.
                    </p>
                  )}
                  {name === "Advanced Settings" && (
                    <>
                      <p>
                        Configuration is schema-validated. Stored drafts are
                        versioned and restored only after confirmation. A broken
                        draft never replaces the working preview.
                      </p>
                      <p>
                        Only configuration is saved; task titles remain in
                        memory. No JavaScript is accepted or evaluated.
                      </p>
                      <a href="#versioned-docs">
                        Read the SDK preview reference
                      </a>
                    </>
                  )}
                  {name === "Code & Export" && (
                    <>
                      <label htmlFor="playground-json">
                        Playground configuration JSON
                      </label>
                      <textarea
                        id="playground-json"
                        spellCheck={false}
                        rows={15}
                        value={code}
                        maxLength={65_536}
                        onChange={(event) =>
                          setSource(event.currentTarget.value)
                        }
                      />
                      <p>
                        The global light/dark selection remains authoritative.
                        Apply replaces configuration only, never host
                        permissions.
                      </p>
                      <p className="playground-validation" role="status">
                        {validation.ok
                          ? "SDK schema and Workspace policy validation passed."
                          : validation.message}
                      </p>
                      <button
                        type="button"
                        disabled={!validation.ok || !hasUnappliedSource}
                        onClick={() => {
                          if (!validation.ok) {
                            setStatus(validation.message);
                            return;
                          }
                          apply(validation.value);
                          setStatus(
                            "Validated configuration applied to the real SDK preview.",
                          );
                        }}
                      >
                        Apply Playground JSON
                      </button>
                      <button
                        type="button"
                        disabled={!hasUnappliedSource}
                        onClick={() => setSource(null)}
                      >
                        Discard JSON edits
                      </button>
                      <a href="#quick-start">
                        View personalized Vanilla code and export
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </aside>
          <div className="playground-application" data-theme={theme}>
            <div className="workspace-app-header">
              <span className="eyebrow">MOORKYZ / PERSONAL WORKSPACE</span>
              <span>Sample project</span>
            </div>
            <div className="workspace-app-content">
              <p className="eyebrow">TODAY&apos;S FOCUS</p>
              <h3>A little room to do good work.</h3>
              <p>
                {tasks.filter(({ done }) => !done).length} open tasks · local
                sample data
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!title.trim()) {
                    setStatus("Enter a task title before adding a task.");
                    return;
                  }
                  if (tasks.length >= 50) {
                    setStatus(
                      "This sample workspace supports up to 50 tasks. Clear completed tasks or reset the sample.",
                    );
                    return;
                  }
                  const task = {
                    id: nextTask.current++,
                    title: title.trim(),
                    done: false,
                  };
                  setTasks((current) => [...current, task]);
                  setTitle("");
                  setStatus(
                    "Task added to this local workspace. Task contents are not persisted.",
                  );
                  taskInput.current?.focus();
                }}
              >
                <label className="sr-only" htmlFor="workspace-task">
                  New task title
                </label>
                <input
                  ref={taskInput}
                  id="workspace-task"
                  placeholder="What needs your attention?"
                  value={title}
                  maxLength={100}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                />
                <button type="submit">Add task</button>
              </form>
              <ul className="workspace-tasks" aria-label="Workspace tasks">
                {tasks
                  .filter(({ done }) => showCompleted || !done)
                  .map((task) => (
                    <li key={task.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() =>
                            setTasks((current) =>
                              current.map((entry) =>
                                entry.id === task.id
                                  ? { ...entry, done: !entry.done }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <span
                          className={task.done ? "task-complete" : undefined}
                        >
                          {task.title}
                        </span>
                      </label>
                      <span>{task.done ? "Done" : "To do"}</span>
                    </li>
                  ))}
              </ul>
              {tasks.filter(({ done }) => showCompleted || !done).length ===
                0 && (
                <p>
                  No tasks in this view. Add a task or show completed tasks.
                </p>
              )}
              <button
                type="button"
                className="workspace-reset"
                onClick={() => {
                  setTasks(INITIAL_TASKS);
                  setShowCompleted(true);
                  setTitle("");
                  nextTask.current = 4;
                  setStatus(
                    "Sample tasks reset. Toolbar configuration is unchanged.",
                  );
                }}
              >
                Reset sample tasks
              </button>
            </div>
            <ToolbarMount
              className="playground-toolbar"
              configuration={INITIAL_PLAYGROUND_CONFIGURATION}
              host={host}
              onController={onController}
              onMountError={onMountError}
            />
            {previewError !== null && (
              <p role="alert">Playground toolbar unavailable: {previewError}</p>
            )}
          </div>
        </div>
        <p className="playground-status" role="status" aria-live="polite">
          {status}
        </p>
        {hasUnappliedSource && (
          <p className="playground-hint">
            JSON edits are not applied. Preview, Quick Start and export retain
            the last valid configuration. Apply or discard JSON edits before
            changing visual controls or using history.{" "}
            <button type="button" onClick={() => setSection("Code & Export")}>
              Return to Code & Export
            </button>
          </p>
        )}
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
          <p>
            The shared SDK generator uses your last applied Playground
            configuration and current theme. Vanilla JavaScript is the verified
            generation target.
          </p>
          <p>
            Generated actions report IDs to a demonstration host; application
            logic stays yours. The starter does not include this task-list
            application.
          </p>
          <p className="playground-hint">
            The package is not published. In this checkout, build the SDK with{" "}
            <code>pnpm --filter @moorkyz/toolbar build</code>. Save exported
            source files into a new folder and follow the generated README for{" "}
            <code>
              node server.mjs --sdk-path &lt;absolute SDK package path&gt;
            </code>
            .
          </p>
          <p>
            React, Next.js, Vue and Angular have consumer fixtures, not
            supported starter generators. M10/M11 release gates remain open.
          </p>
          <a href="#starter-gallery">
            Explore the existing Vanilla starter gallery
          </a>
        </div>
        <div className="code-panel">
          <div className="code-panel-header">
            <label htmlFor="playground-file">Vanilla source file</label>
            <select
              id="playground-file"
              value={selectedFile}
              disabled={project === null}
              onChange={(event) => setSelectedFile(event.currentTarget.value)}
            >
              {["toolbar.config.js", "app.js", "index.html", "README.md"].map(
                (path) => (
                  <option key={path}>{path}</option>
                ),
              )}
            </select>
            {generatedFile !== undefined && (
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
              disabled={project === null}
              onClick={download}
            >
              Export personalized Vanilla project
            </button>
          </div>
          {generationError !== null && <p role="alert">{generationError}</p>}
          <p className="code-disclaimer">
            Export is a versioned JSON file containing all generated source
            files and integrity metadata, not an archive or an installer.
            Nothing runs or uploads.
          </p>
        </div>
      </section>
    </HydrationBoundary>
  );
}
