"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTrustedExtensionRegistry } from "@moorkyz/toolbar/extensions";
import { ToolbarMount } from "@moorkyz/toolbar/react";
import type { ToolbarActionDescriptor } from "@moorkyz/toolbar";
import { validateConfiguration } from "@moorkyz/toolbar";
import { HydrationBoundary } from "./hydration-boundary";

const RECIPE = {
  schemaVersion: "1.0",
  id: "studio",
  trust: "trusted",
  actions: [{ id: "studio.open", label: "Open preview panel" }],
};

export function ExtensionStudio() {
  const [source, setSource] = useState(JSON.stringify(RECIPE, null, 2));
  const [actions, setActions] = useState<readonly ToolbarActionDescriptor[]>(
    [],
  );
  const [authorized, setAuthorized] = useState(true);
  const [fail, setFail] = useState(false);
  const [status, setStatus] = useState(
    "Static trusted recipe only. Arbitrary JavaScript execution is unavailable in this portal.",
  );
  const registry = useRef<ReturnType<
    typeof createTrustedExtensionRegistry
  > | null>(null);
  const allowed = useRef(true);
  const failure = useRef(false);
  const configuration = useMemo(
    () => ({
      label: "Trusted extension preview",
      actions,
      features: { search: false, customize: false },
      placement: { mode: "container" as const },
      renderMode: "light" as const,
    }),
    [actions],
  );
  const dispatchAction = useCallback(async (id: string) => {
    const active = registry.current;
    if (active === null) {
      setStatus("No active extension; register a trusted recipe first.");
      return;
    }
    const result = await active.dispatchAction(id);
    if (registry.current !== active) return;
    if (!result.ok) setStatus(`${result.error.code}: ${result.error.message}`);
    setActions(active.getActions());
  }, []);
  const host = useMemo(() => ({ dispatchAction }), [dispatchAction]);
  const onMountError = useCallback(
    (error: { readonly message: string }) => setStatus(error.message),
    [],
  );
  useEffect(
    () => () => {
      registry.current?.dispose();
      registry.current = null;
    },
    [],
  );

  async function register() {
    let manifest: unknown;
    try {
      manifest = JSON.parse(source);
    } catch {
      setStatus("Manifest is not valid JSON; the active recipe is unchanged.");
      return;
    }
    if (
      typeof manifest !== "object" ||
      manifest === null ||
      Object.keys(manifest).sort().join(",") !==
        "actions,id,schemaVersion,trust" ||
      !("schemaVersion" in manifest) ||
      manifest.schemaVersion !== "1.0" ||
      !("id" in manifest) ||
      manifest.id !== "studio" ||
      !("trust" in manifest) ||
      manifest.trust !== "trusted" ||
      !("actions" in manifest)
    ) {
      setStatus(
        "Only the version 1.0 trusted studio recipe is supported. The active recipe is unchanged.",
      );
      return;
    }
    const validatedActions = validateConfiguration({
      actions: manifest.actions,
    });
    if (!validatedActions.ok) {
      setStatus(
        validatedActions.errors.map((issue) => issue.message).join(" "),
      );
      return;
    }
    const recipe = {
      schemaVersion: "1.0" as const,
      id: "studio",
      trust: "trusted" as const,
      actions: validatedActions.value.actions,
    };
    registry.current?.dispose();
    setActions([]);
    const active = createTrustedExtensionRegistry({
      enabled: true,
      failureLimit: 3,
      authorize: ({ extensionId, operation, actionId }) =>
        allowed.current &&
        extensionId === "studio" &&
        (operation === "activate" || actionId?.startsWith("studio.") === true),
      dispatchAction: (id) => {
        if (!allowed.current || !id.startsWith("studio."))
          throw new Error("Synthetic host denied action.");
        if (failure.current) throw new Error("Synthetic host fault.");
        setStatus(
          `Trusted local recipe requested "${id}". No application command or network ran.`,
        );
      },
    });
    registry.current = active;
    const result = await active.register({ manifest: recipe, initialize() {} });
    if (registry.current !== active) {
      active.dispose();
      return;
    }
    if (!result.ok) {
      active.dispose();
      registry.current = null;
      setStatus(`${result.error.code}: ${result.error.message}`);
      return;
    }
    setActions(active.getActions());
    setStatus("Trusted recipe registered through the actual extension SDK.");
  }

  return (
    <HydrationBoundary label="Trusted extension workspace">
      <div className="extension-studio">
        <p>
          The gallery recipe has a fixed host-authored initializer. Only the
          data manifest is editable. Same-realm trusted code is not a sandbox;
          user-authored code is never evaluated here.
        </p>
        <label htmlFor="extension-manifest">
          Trusted extension manifest JSON
        </label>
        <textarea
          id="extension-manifest"
          rows={10}
          maxLength={16000}
          spellCheck={false}
          value={source}
          onChange={(event) => setSource(event.currentTarget.value)}
        />
        <label className="workbench-feature">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(event) => {
              allowed.current = event.currentTarget.checked;
              setAuthorized(allowed.current);
            }}
          />
          Host authorizes this recipe
        </label>
        <label className="workbench-feature">
          <input
            type="checkbox"
            checked={fail}
            onChange={(event) => {
              failure.current = event.currentTarget.checked;
              setFail(failure.current);
            }}
          />
          Simulate extension host fault
        </label>
        <div className="workbench-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              void register();
            }}
          >
            Register trusted recipe
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              registry.current?.revoke("studio");
              setActions(registry.current?.getActions() ?? []);
              setStatus(
                "Recipe revoked; scoped actions and resources were removed.",
              );
            }}
          >
            Revoke trusted recipe
          </button>
        </div>
        <div className="configurator-preview-surface">
          <ToolbarMount
            className="configurator-preview-mount"
            configuration={configuration}
            host={host}
            onMountError={onMountError}
          />
        </div>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </HydrationBoundary>
  );
}
