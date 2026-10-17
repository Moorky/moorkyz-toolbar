"use client";

import { useEffect, useRef, useState } from "react";
import { usePortalSettings } from "./portal-shell";

const repository = "https://github.com/Moorky/moorkyz-toolbar";
export const PORTAL_REFERENCE = [
  {
    title: "Playground",
    text: "Four local applications, ten styles, configuration and export.",
    href: "/#playground",
  },
  {
    title: "Personalized Quick Start",
    text: "Verified Vanilla mount, host actions, disposal and source export.",
    href: "/#quick-start",
  },
  {
    title: "SDK schema and controller",
    text: "createToolbar, validateConfiguration, feature defaults and errors.",
    href: `${repository}/blob/master/docs/contracts/sdk-and-schema.md`,
  },
  {
    title: "Themes and accessibility",
    text: "Tokens, contrast, keyboard, reduced motion and WCAG requirements.",
    href: `${repository}/blob/master/docs/design/interaction-and-visual-system.md`,
  },
  {
    title: "Component Lab",
    text: "Real SDK overflow, collapse and local search states.",
    href: "/studio#component-lab",
  },
  {
    title: "Scenario Lab",
    text: "Host permission, faults, time, viewport, import and replay.",
    href: "/studio#scenario-lab",
  },
  {
    title: "Theme Studio",
    text: "Manual palette authoring, validation and versioned import/export.",
    href: "/studio#theme-studio",
  },
  {
    title: "Extension Studio",
    text: "Trusted recipes, host authorization and revocation.",
    href: "/studio#extension-studio",
  },
  {
    title: "Diagnostics and Inspector",
    text: "Explicit local inspector and validated JSON workbench.",
    href: "/studio#configurator",
  },
  {
    title: "Framework integration fixtures",
    text: "Vanilla, React, Vue and Angular consumers; not framework generators.",
    href: `${repository}/tree/master/examples`,
  },
  {
    title: "Security and host authority",
    text: "Least privilege, data boundaries, trust and optional capabilities.",
    href: `${repository}/blob/master/docs/architecture/security-and-trust.md`,
  },
  {
    title: "M10/M11 release gates",
    text: "Manual device/AT evidence, numerical budgets and release approval.",
    href: `${repository}/blob/master/docs/engineering/release-readiness.md`,
  },
];

export function PortalSearch() {
  const { themeReady } = usePortalSettings();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  function open() {
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.shiftKey ||
        (event.ctrlKey && event.metaKey) ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "k"
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, [contenteditable], .mzk-toolbar, #playground-canvas",
        )
      )
        return;
      event.preventDefault();
      dialog.current?.showModal();
      input.current?.focus();
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = PORTAL_REFERENCE.filter((entry) =>
    terms.every((term) =>
      `${entry.title} ${entry.text}`.toLowerCase().includes(term),
    ),
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="search-trigger"
        aria-label="Search documentation and navigation"
        aria-keyshortcuts="Control+K Meta+K"
        disabled={!themeReady}
        onClick={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            cx="10"
            cy="10"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="m15 15 6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <span className="search-trigger-copy">Search</span>
      </button>
      <dialog
        ref={dialog}
        className="portal-search"
        aria-labelledby="portal-search-heading"
        onClose={() => trigger.current?.focus()}
      >
        <div className="search-heading">
          <h2 id="portal-search-heading">Find your next step.</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            Close search
          </button>
        </div>
        <label htmlFor="portal-query">
          Search documentation and navigation
        </label>
        <input
          ref={input}
          id="portal-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <p>
          Local reference search. Tab through results; Escape closes. Ctrl/Cmd K
          never overrides editors or application inputs.
        </p>
        <ul>
          {results.map((entry) => (
            <li key={entry.title}>
              <a href={entry.href} onClick={() => dialog.current?.close()}>
                <strong>{entry.title}</strong>
                <span>{entry.text}</span>
              </a>
            </li>
          ))}
        </ul>
        {!results.length && (
          <p role="status">
            No matching reference entries. Try “theme”, “permissions” or
            “Vanilla”.
          </p>
        )}
      </dialog>
    </>
  );
}
