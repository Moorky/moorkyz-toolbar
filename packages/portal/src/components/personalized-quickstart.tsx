"use client";

import { memo, useEffect, useState } from "react";
import type { GeneratedProject } from "@moorkyz/toolbar/generator";
import { CopyButton } from "./copy-button";
import { downloadJSON } from "./download-json";
import {
  generateDesignProject,
  type PlaygroundDesign,
} from "./playground-design";

export const PersonalizedQuickStart = memo(function PersonalizedQuickStart({
  design,
  theme,
  onStatus,
}: {
  readonly design: PlaygroundDesign;
  readonly theme: "light" | "dark";
  readonly onStatus: (message: string) => void;
}) {
  const [selectedFile, setSelectedFile] = useState("toolbar.config.js");
  const [generated, setGenerated] = useState<{
    readonly design: PlaygroundDesign;
    readonly theme: string;
    readonly project: GeneratedProject;
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const project =
    generated?.design === design && generated.theme === theme
      ? generated.project
      : null;
  const selected = project?.files.find(({ path }) => path === selectedFile);

  useEffect(() => {
    let active = true;
    setGenerated(null);
    setGenerationError(null);
    setExportError(null);
    void generateDesignProject(design, theme)
      .then((project) => {
        if (active) setGenerated({ design, theme, project });
      })
      .catch((cause: unknown) => {
        if (active)
          setGenerationError(
            cause instanceof Error
              ? cause.message
              : "Local project generation failed.",
          );
      });
    return () => {
      active = false;
    };
  }, [design, theme, attempt]);

  return (
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
              onStatus("Vanilla is the verified generated integration.")
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
          <code>pnpm --filter @moorkyz/toolbar build</code>. Export files into a
          new folder and run{" "}
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
              "playground.design.json",
              "index.html",
              "README.md",
            ].map((file) => (
              <option key={file}>{file}</option>
            ))}
          </select>
          {selected && (
            <CopyButton
              text={selected.content}
              label="Copy personalized source"
            />
          )}
        </div>
        <pre
          tabIndex={0}
          aria-label="Personalized Vanilla integration source"
          aria-busy={!project && generationError === null}
        >
          <code>
            {selected?.content ??
              (generationError
                ? "Generation unavailable. Retry below; your design is unchanged."
                : "Preparing verified Vanilla source…")}
          </code>
        </pre>
        <div className="workbench-actions">
          <button
            className="button button-primary"
            type="button"
            disabled={!project}
            onClick={() => {
              if (!project) return;
              try {
                downloadJSON(
                  JSON.stringify({ version: 1, project }, null, 2),
                  "toolbar.playground.vanilla.json",
                );
                setExportError(null);
                onStatus(
                  "Export downloaded locally. Nothing was uploaded or executed.",
                );
              } catch {
                const message =
                  "Could not export the project. Your design is unchanged; copy the source files or retry the download.";
                setExportError(message);
                onStatus(message);
              }
            }}
          >
            Export personalized Vanilla project
          </button>
          {generationError && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry Vanilla generation
            </button>
          )}
        </div>
        {generationError && (
          <p className="quickstart-error" role="alert">
            {generationError}
          </p>
        )}
        {exportError && (
          <p className="quickstart-error" role="alert">
            {exportError}
          </p>
        )}
        <p className="code-disclaimer">
          Versioned JSON contains all source files and SHA-256 integrity
          metadata, not an installer. Nothing is installed, uploaded or executed
          by export.
        </p>
      </div>
    </section>
  );
});
