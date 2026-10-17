import {
  validateConfiguration,
  type ToolbarActionDescriptor,
} from "./configuration.js";
import type { ToolbarHost } from "./toolbar.js";

export interface TrustedExtensionManifest {
  readonly schemaVersion: "1.0";
  readonly id: string;
  readonly trust: "trusted";
  readonly actions: readonly ToolbarActionDescriptor[];
}

export type ExtensionErrorCode =
  | "EXTENSION_DISABLED"
  | "EXTENSION_INVALID"
  | "EXTENSION_DUPLICATE"
  | "EXTENSION_LIMIT"
  | "EXTENSION_DENIED"
  | "EXTENSION_INACTIVE"
  | "EXTENSION_FAILED"
  | "EXTENSION_CIRCUIT_OPEN"
  | "EXTENSION_DISPOSED";

export type ExtensionResult<Value = void> =
  | { readonly ok: true; readonly value: Value }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: ExtensionErrorCode;
        readonly message: string;
      };
    };

export interface ExtensionAuthorizationRequest {
  readonly extensionId: string;
  readonly operation: "activate" | "action";
  readonly actionId?: string;
}

export interface TrustedExtensionScope {
  readonly manifest: TrustedExtensionManifest;
  readonly signal: AbortSignal;
  dispatchAction(actionId: string): Promise<ExtensionResult>;
  onDispose(cleanup: () => void): ExtensionResult;
}

export interface TrustedExtensionDefinition {
  readonly manifest: TrustedExtensionManifest;
  readonly initialize: (scope: TrustedExtensionScope) => void | Promise<void>;
}

export type ExtensionStatus =
  "initializing" | "active" | "revoked" | "circuit-open" | "disposed";

export interface TrustedExtensionHandle {
  readonly id: string;
  readonly status: ExtensionStatus;
  dispose(): void;
}

export interface TrustedExtensionRegistryOptions {
  readonly enabled?: boolean;
  readonly failureLimit?: number;
  readonly authorize?: (request: ExtensionAuthorizationRequest) => boolean;
  readonly dispatchAction?: ToolbarHost["dispatchAction"];
}

export interface TrustedExtensionRegistry {
  register(
    definition: TrustedExtensionDefinition,
  ): Promise<ExtensionResult<TrustedExtensionHandle>>;
  getActions(): readonly ToolbarActionDescriptor[];
  dispatchAction(actionId: string): Promise<ExtensionResult>;
  revoke(extensionId: string): boolean;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

function success<Value>(value: Value): ExtensionResult<Value> {
  return Object.freeze({ ok: true, value });
}

function failure<Value = void>(
  code: ExtensionErrorCode,
  message: string,
): ExtensionResult<Value> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, message }),
  });
}

function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every(
      (descriptor) => "value" in descriptor,
    )
  );
}

function snapshotManifest(value: unknown): TrustedExtensionManifest | null {
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) => !["schemaVersion", "id", "trust", "actions"].includes(key),
    ) ||
    value.schemaVersion !== "1.0" ||
    value.trust !== "trusted" ||
    typeof value.id !== "string" ||
    !/^[a-z][a-z0-9-]{0,30}$/.test(value.id) ||
    !Array.isArray(value.actions) ||
    value.actions.length > 64
  ) {
    return null;
  }
  const validated = validateConfiguration({ actions: value.actions });
  if (!validated.ok) return null;
  const actions = validated.value.actions;
  if (
    actions.some(
      (action) =>
        !action.id.startsWith(`${value.id}.`) || action.label.length > 256,
    )
  ) {
    return null;
  }
  return Object.freeze({
    schemaVersion: "1.0",
    id: value.id,
    trust: "trusted",
    actions,
  });
}

interface Entry {
  readonly manifest: TrustedExtensionManifest;
  status: ExtensionStatus;
  readonly abort: AbortController;
  readonly cleanups: Array<() => void>;
  pending: number;
  dispatch: TrustedExtensionScope["dispatchAction"] | null;
}

function cleanupSafely(cleanup: () => void): void {
  try {
    // Also contain accidentally async disposers without waiting indefinitely.
    void Promise.resolve(cleanup()).catch(() => {});
  } catch {
    // One failed disposer must not prevent the remaining resources releasing.
  }
}

export function createTrustedExtensionRegistry(
  options: TrustedExtensionRegistryOptions = {},
): TrustedExtensionRegistry {
  let enabled = options.enabled === true;
  let disposed = false;
  const authorize = options.authorize;
  const dispatchAction = options.dispatchAction;
  const limit = options.failureLimit ?? 3;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new RangeError(
      "Extension failureLimit must be an integer from 1 to 10.",
    );
  }
  const entries = new Map<string, Entry>();
  const failures = new Map<string, number>();

  function stop(entry: Entry, status: ExtensionStatus): void {
    if (entry.abort.signal.aborted) return;
    entry.status = status;
    entry.abort.abort();
    const cleanups = entry.cleanups.splice(0).reverse();
    for (const cleanup of cleanups) cleanupSafely(cleanup);
    entries.delete(entry.manifest.id);
  }

  function allowed(entry: Entry, actionId?: string): boolean {
    try {
      const decision: unknown = authorize?.(
        Object.freeze({
          extensionId: entry.manifest.id,
          operation: actionId === undefined ? "activate" : "action",
          ...(actionId === undefined ? {} : { actionId }),
        }),
      );
      if (typeof decision === "object" && decision !== null) {
        void Promise.resolve(decision).catch(() => {});
      }
      return decision === true;
    } catch {
      return false;
    }
  }

  function authorized(entry: Entry): boolean {
    return (
      allowed(entry) &&
      entry.manifest.actions.every((action) => allowed(entry, action.id))
    );
  }

  function fault(entry: Entry): void {
    const count = (failures.get(entry.manifest.id) ?? 0) + 1;
    failures.set(entry.manifest.id, count);
    if (count >= limit) stop(entry, "circuit-open");
  }

  function inactive(entry: Entry): ExtensionResult {
    return failure(
      entry.status === "circuit-open"
        ? "EXTENSION_CIRCUIT_OPEN"
        : "EXTENSION_INACTIVE",
      "The extension is not active.",
    );
  }

  function active(entry: Entry): boolean {
    return enabled && !disposed && entry.status === "active";
  }

  const registry: TrustedExtensionRegistry = {
    async register(definition) {
      if (disposed) {
        return failure("EXTENSION_DISPOSED", "The registry is disposed.");
      }
      if (!enabled) {
        return failure("EXTENSION_DISABLED", "Extensions are disabled.");
      }
      let manifest: TrustedExtensionManifest | null;
      let initialize: TrustedExtensionDefinition["initialize"];
      try {
        if (
          !record(definition) ||
          typeof definition.initialize !== "function"
        ) {
          return failure("EXTENSION_INVALID", "Invalid trusted extension.");
        }
        manifest = snapshotManifest(definition.manifest);
        initialize = definition.initialize;
      } catch {
        return failure("EXTENSION_INVALID", "Invalid trusted extension.");
      }
      if (manifest === null) {
        return failure(
          "EXTENSION_INVALID",
          "Invalid trusted extension manifest.",
        );
      }
      if (entries.has(manifest.id)) {
        return failure("EXTENSION_DUPLICATE", "The extension is registered.");
      }
      if (!failures.has(manifest.id) && failures.size >= 64) {
        return failure(
          "EXTENSION_LIMIT",
          "The registry identity limit is reached.",
        );
      }
      if ((failures.get(manifest.id) ?? 0) >= limit) {
        return failure(
          "EXTENSION_CIRCUIT_OPEN",
          "The extension circuit is open.",
        );
      }
      const entry: Entry = {
        manifest,
        status: "initializing",
        abort: new AbortController(),
        cleanups: [],
        pending: 0,
        dispatch: null,
      };
      if (!authorized(entry)) {
        return failure("EXTENSION_DENIED", "The host denied this extension.");
      }
      if (!enabled || disposed) {
        return failure("EXTENSION_INACTIVE", "The registry became inactive.");
      }
      failures.set(manifest.id, failures.get(manifest.id) ?? 0);
      entries.set(manifest.id, entry);
      const scope: TrustedExtensionScope = Object.freeze({
        manifest,
        signal: entry.abort.signal,
        onDispose(cleanup: () => void) {
          if (typeof cleanup !== "function") {
            return failure(
              "EXTENSION_INVALID",
              "A cleanup function is required.",
            );
          }
          if (entry.abort.signal.aborted) {
            cleanupSafely(cleanup);
            return inactive(entry);
          }
          if (entry.cleanups.length >= 64) {
            cleanupSafely(cleanup);
            return failure("EXTENSION_LIMIT", "The cleanup limit is reached.");
          }
          entry.cleanups.push(cleanup);
          return success(undefined);
        },
        async dispatchAction(actionId: string) {
          if (!active(entry)) return inactive(entry);
          if (!manifest.actions.some((action) => action.id === actionId)) {
            return failure("EXTENSION_DENIED", "Action is outside this scope.");
          }
          if (!allowed(entry) || !allowed(entry, actionId)) {
            stop(entry, "revoked");
            return failure(
              "EXTENSION_DENIED",
              "Host authorization was revoked.",
            );
          }
          if (!active(entry)) return inactive(entry);
          if (dispatchAction === undefined) {
            return failure(
              "EXTENSION_DENIED",
              "No host action dispatcher exists.",
            );
          }
          if (entry.pending >= 16) {
            return failure(
              "EXTENSION_LIMIT",
              "The pending action limit is reached.",
            );
          }
          entry.pending += 1;
          const signal = entry.abort.signal;
          return new Promise<ExtensionResult>((resolve) => {
            let settled = false;
            const finish = (result: ExtensionResult) => {
              if (settled) return;
              settled = true;
              entry.pending -= 1;
              signal.removeEventListener("abort", aborted);
              resolve(result);
            };
            const aborted = () => finish(inactive(entry));
            signal.addEventListener("abort", aborted, { once: true });
            void Promise.resolve()
              .then(() => {
                if (!active(entry)) return;
                if (!allowed(entry) || !allowed(entry, actionId)) {
                  stop(entry, "revoked");
                  return;
                }
                if (!active(entry)) return;
                return dispatchAction(actionId);
              })
              .then(
                () => {
                  if (!active(entry)) return finish(inactive(entry));
                  if (!allowed(entry) || !allowed(entry, actionId)) {
                    stop(entry, "revoked");
                    return;
                  }
                  if (!active(entry)) return finish(inactive(entry));
                  failures.set(manifest.id, 0);
                  finish(success(undefined));
                },
                () => {
                  if (!active(entry)) return finish(inactive(entry));
                  fault(entry);
                  finish(
                    failure(
                      "EXTENSION_FAILED",
                      "Host action execution failed.",
                    ),
                  );
                },
              );
          });
        },
      });
      entry.dispatch = scope.dispatchAction;
      try {
        const initialized = Promise.resolve().then(() => {
          if (!entry.abort.signal.aborted) return initialize(scope);
        });
        const completed = await new Promise<boolean>((resolve, reject) => {
          const aborted = () => resolve(false);
          entry.abort.signal.addEventListener("abort", aborted, { once: true });
          if (entry.abort.signal.aborted) aborted();
          void initialized.then(
            () => {
              entry.abort.signal.removeEventListener("abort", aborted);
              resolve(!entry.abort.signal.aborted);
            },
            (cause: unknown) => {
              entry.abort.signal.removeEventListener("abort", aborted);
              reject(cause);
            },
          );
        });
        if (!completed || !enabled || disposed) {
          stop(entry, "disposed");
          return failure(
            "EXTENSION_INACTIVE",
            "Extension activation was cancelled.",
          );
        }
        if (!authorized(entry) || entry.abort.signal.aborted) {
          stop(entry, "revoked");
          return failure("EXTENSION_DENIED", "Host authorization was revoked.");
        }
        entry.status = "active";
      } catch {
        fault(entry);
        stop(entry, "disposed");
        return failure("EXTENSION_FAILED", "Extension initialization failed.");
      }
      return success(
        Object.freeze({
          id: manifest.id,
          get status() {
            return entry.status;
          },
          dispose() {
            stop(entry, "disposed");
          },
        }),
      );
    },
    getActions() {
      const actions: ToolbarActionDescriptor[] = [];
      for (const entry of entries.values()) {
        if (!active(entry)) continue;
        if (!authorized(entry)) {
          stop(entry, "revoked");
          continue;
        }
        if (active(entry)) actions.push(...entry.manifest.actions);
      }
      return Object.freeze(
        actions.sort((left, right) =>
          left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
        ),
      );
    },
    async dispatchAction(actionId) {
      const extensionId =
        typeof actionId === "string"
          ? actionId.slice(0, actionId.indexOf("."))
          : "";
      const entry = entries.get(extensionId);
      if (entry?.dispatch === undefined || entry.dispatch === null) {
        return failure(
          "EXTENSION_DENIED",
          "No active extension owns this action.",
        );
      }
      return entry.dispatch(actionId);
    },
    revoke(extensionId) {
      const entry = entries.get(extensionId);
      if (entry === undefined) return false;
      stop(entry, "revoked");
      return true;
    },
    setEnabled(value) {
      if (disposed) return;
      enabled = value === true;
      if (!enabled) {
        for (const entry of [...entries.values()]) stop(entry, "disposed");
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      enabled = false;
      for (const entry of [...entries.values()]) stop(entry, "disposed");
    },
  };
  return Object.freeze(registry);
}
