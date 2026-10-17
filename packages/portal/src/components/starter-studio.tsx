"use client";

import { useState } from "react";
import { generateProject } from "@moorkyz/toolbar/generator";
import { CopyButton } from "./copy-button";
import { HydrationBoundary } from "./hydration-boundary";

const PRESETS = [
  "universal",
  "website",
  "dashboard",
  "editor",
  "game",
] as const;
type GeneratedProject = Extract<
  Awaited<ReturnType<typeof generateProject>>,
  { ok: true }
>["value"];

export function StarterStudio() {
  const [name, setName] = useState("my-toolbar-app");
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>("universal");
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [status, setStatus] = useState(
    "Vanilla starters are generated locally. No install, filesystem write or code execution runs in this page.",
  );
  const [busy, setBusy] = useState(false);
  const selected = project?.files.find((file) => file.path === selectedPath);

  async function generate() {
    setBusy(true);
    try {
      const result = await generateProject({
        name,
        preset,
        framework: "vanilla",
        origin: "studio",
      });
      if (!result.ok) {
        setStatus(result.error.message);
        return;
      }
      setProject(result.value);
      setSelectedPath(result.value.files[0]?.path ?? "");
      setStatus(
        "Versioned starter generated. Review source files; use the consumer CLI for safe directory creation.",
      );
    } catch {
      setStatus("Local starter generation failed. No files were written.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (project === null) {
      setStatus("Generate a valid starter first.");
      return;
    }
    const blob = new Blob([JSON.stringify({ version: 1, project }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "toolbar.starter.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus(
      "Portable project data downloaded. It has not been executed or uploaded.",
    );
  }

  return (
    <HydrationBoundary label="Local starter workspace">
      <div className="starter-studio">
        <label htmlFor="starter-name">Starter project name</label>
        <input
          id="starter-name"
          value={name}
          maxLength={64}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <label htmlFor="starter-preset">Starter preset</label>
        <select
          id="starter-preset"
          value={preset}
          onChange={(event) => {
            const selected = PRESETS.find(
              (entry) => entry === event.currentTarget.value,
            );
            if (selected !== undefined) setPreset(selected);
          }}
        >
          {PRESETS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
        <p>
          Validated generator: Vanilla JavaScript. React, Next.js, Vue and
          Angular adapters have separate consumer recipes; they are not
          advertised as generated starters.
        </p>
        <button
          type="button"
          className="button button-primary"
          disabled={busy}
          onClick={() => {
            void generate();
          }}
        >
          Generate starter
        </button>
        {project !== null && (
          <>
            <button
              type="button"
              className="button button-secondary"
              onClick={download}
            >
              Download starter data
            </button>
            <label htmlFor="starter-file">Generated source file</label>
            <select
              id="starter-file"
              value={selectedPath}
              onChange={(event) => setSelectedPath(event.currentTarget.value)}
            >
              {project.files.map((file) => (
                <option key={file.path} value={file.path}>
                  {file.path}
                </option>
              ))}
            </select>
            {selected !== undefined && (
              <>
                <CopyButton
                  text={selected.content}
                  label="Copy generated file"
                />
                <pre tabIndex={0} aria-label="Generated starter source">
                  <code>{selected.content}</code>
                </pre>
              </>
            )}
            <details>
              <summary>Versioned project manifest</summary>
              <pre tabIndex={0}>
                {JSON.stringify(project.manifest, null, 2)}
              </pre>
            </details>
          </>
        )}
        <p role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </HydrationBoundary>
  );
}
