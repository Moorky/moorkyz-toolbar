"use client";

import { useState } from "react";
import { CONFIGURATION_VERSION, FEATURE_DEFAULTS } from "@moorkyz/toolbar";
import { HydrationBoundary } from "./hydration-boundary";

export function VersionedDocs() {
  const [query, setQuery] = useState("");
  const entries = Object.entries(FEATURE_DEFAULTS).filter(([name]) =>
    name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <HydrationBoundary label="Versioned documentation controls">
      <div className="versioned-docs">
        <label htmlFor="docs-version">Documentation version</label>
        <select id="docs-version" defaultValue="0.1.0">
          <option value="0.1.0">
            0.1.0 development preview (schema {CONFIGURATION_VERSION})
          </option>
        </select>
        <p>
          No stable release has been authorized. These are the actual draft SDK
          defaults, not a stable compatibility promise.
        </p>
        <label htmlFor="docs-search">Search feature reference</label>
        <input
          id="docs-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <table>
          <caption>Feature defaults from the package contract</caption>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Default</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, enabled]) => (
              <tr key={name}>
                <th scope="row">
                  <code>{name}</code>
                </th>
                <td>{enabled ? "Enabled" : "Disabled"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p role="status">No matching features.</p>}
        <p>
          Mount with <code>createToolbar(configuration, host)</code>, check the
          structured mount result, then call <code>dispose()</code> on teardown.
          The host owns commands, permissions and navigation.
        </p>
        <p>
          React/Next.js use the optional React entry point. Framework and
          generator recipes are local preview contracts until the compatibility
          and release gates pass.
        </p>
      </div>
    </HydrationBoundary>
  );
}
