export interface ContextSnapshot<Value extends object> {
  readonly scopeId: string;
  readonly version: number;
  readonly lineage: readonly string[];
  readonly value: Readonly<Value>;
}

export type ContextErrorCode =
  | "CONTEXT_INVALID_SCOPE_ID"
  | "CONTEXT_INVALID_VALUE"
  | "CONTEXT_ACCESSOR_PROPERTY"
  | "CONTEXT_SCOPE_NOT_FOUND"
  | "CONTEXT_PARENT_NOT_FOUND"
  | "CONTEXT_CYCLE"
  | "CONTEXT_HAS_CHILDREN"
  | "CONTEXT_ROOT_IMMUTABLE";

export interface ContextError {
  readonly code: ContextErrorCode;
  readonly message: string;
}

export type ContextResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ContextError };

export interface ContextResolver<Value extends object> {
  readonly version: number;
  setScope(
    id: string,
    value: Partial<Value>,
    parentId?: string,
  ): ContextResult<number>;
  updateScope(id: string, patch: Partial<Value>): ContextResult<number>;
  removeScope(id: string): ContextResult<number>;
  resolve(id: string): ContextResult<ContextSnapshot<Value>>;
  isCurrent(version: number): boolean;
}

interface StoredScope {
  readonly id: string;
  readonly parentId: string | null;
  readonly value: Readonly<Record<string, unknown>>;
}

const ROOT_SCOPE = "host:root";
const SCOPE_ID_PATTERN = /^[a-z][a-z0-9-]{0,62}:[a-z][a-z0-9-]{0,62}$/;

function copyDataRecord(
  value: unknown,
):
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly error: ContextError } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      error: {
        code: "CONTEXT_INVALID_VALUE",
        message: "Context values must be plain data objects.",
      },
    };
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return {
      ok: false,
      error: {
        code: "CONTEXT_INVALID_VALUE",
        message: "Context values must not inherit from custom prototypes.",
      },
    };
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return {
      ok: false,
      error: {
        code: "CONTEXT_INVALID_VALUE",
        message: "Context values may only contain string keys.",
      },
    };
  }

  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (!("value" in descriptor)) {
      return {
        ok: false,
        error: {
          code: "CONTEXT_ACCESSOR_PROPERTY",
          message: `Context property "${key}" must be a data property.`,
        },
      };
    }
    result[key] = descriptor.value;
  }
  return { ok: true, value: result };
}

export function createContextResolver<Value extends object>(
  defaults: Value,
): ContextResolver<Value> {
  const copiedDefaults = copyDataRecord(defaults);
  if (!copiedDefaults.ok) {
    throw new TypeError(copiedDefaults.error.message);
  }

  let currentVersion = 0;
  const scopes = new Map<string, StoredScope>([
    [
      ROOT_SCOPE,
      Object.freeze({
        id: ROOT_SCOPE,
        parentId: null,
        value: Object.freeze(copiedDefaults.value),
      }),
    ],
  ]);

  function lineageFor(id: string): string[] | null {
    const lineage: string[] = [];
    let current: string | null = id;
    while (current !== null) {
      const scope = scopes.get(current);
      if (scope === undefined) return null;
      lineage.push(current);
      current = scope.parentId;
    }
    return lineage.reverse();
  }

  function failure<Result>(
    code: ContextErrorCode,
    message: string,
  ): ContextResult<Result> {
    return { ok: false, error: { code, message } };
  }

  return {
    get version() {
      return currentVersion;
    },

    setScope(id, value, parentId = ROOT_SCOPE) {
      if (id === ROOT_SCOPE) {
        return failure(
          "CONTEXT_ROOT_IMMUTABLE",
          "The host root context cannot be replaced.",
        );
      }
      if (!SCOPE_ID_PATTERN.test(id)) {
        return failure(
          "CONTEXT_INVALID_SCOPE_ID",
          "Context scopes must use a valid namespace:name id.",
        );
      }
      if (!scopes.has(parentId)) {
        return failure(
          "CONTEXT_PARENT_NOT_FOUND",
          `Parent scope "${parentId}" is not registered.`,
        );
      }

      let ancestor: string | null = parentId;
      while (ancestor !== null) {
        if (ancestor === id) {
          return failure(
            "CONTEXT_CYCLE",
            `Scope "${id}" cannot be its own ancestor.`,
          );
        }
        ancestor = scopes.get(ancestor)?.parentId ?? null;
      }

      const copiedValue = copyDataRecord(value);
      if (!copiedValue.ok) {
        return { ok: false, error: copiedValue.error };
      }

      scopes.set(
        id,
        Object.freeze({
          id,
          parentId,
          value: Object.freeze(copiedValue.value),
        }),
      );
      currentVersion += 1;
      return { ok: true, value: currentVersion };
    },

    updateScope(id, patch) {
      const current = scopes.get(id);
      if (current === undefined) {
        return failure(
          "CONTEXT_SCOPE_NOT_FOUND",
          `Context scope "${id}" is not registered.`,
        );
      }
      const copiedPatch = copyDataRecord(patch);
      if (!copiedPatch.ok) {
        return { ok: false, error: copiedPatch.error };
      }
      scopes.set(
        id,
        Object.freeze({
          ...current,
          value: Object.freeze({
            ...current.value,
            ...copiedPatch.value,
          }),
        }),
      );
      currentVersion += 1;
      return { ok: true, value: currentVersion };
    },

    removeScope(id) {
      if (id === ROOT_SCOPE) {
        return failure(
          "CONTEXT_ROOT_IMMUTABLE",
          "The host root context cannot be removed.",
        );
      }
      const current = scopes.get(id);
      if (current === undefined) {
        return failure(
          "CONTEXT_SCOPE_NOT_FOUND",
          `Context scope "${id}" is not registered.`,
        );
      }
      if (Array.from(scopes.values()).some((scope) => scope.parentId === id)) {
        return failure(
          "CONTEXT_HAS_CHILDREN",
          `Context scope "${id}" still has child scopes.`,
        );
      }
      scopes.delete(id);
      currentVersion += 1;
      return { ok: true, value: currentVersion };
    },

    resolve(id) {
      const lineage = lineageFor(id);
      if (lineage === null) {
        return failure(
          "CONTEXT_SCOPE_NOT_FOUND",
          `Context scope "${id}" is not registered.`,
        );
      }
      const value: Record<string, unknown> = Object.create(null);
      for (const scopeId of lineage) {
        const scope = scopes.get(scopeId);
        if (scope !== undefined) {
          for (const [key, entry] of Object.entries(scope.value)) {
            value[key] = entry;
          }
        }
      }
      return {
        ok: true,
        value: Object.freeze({
          scopeId: id,
          version: currentVersion,
          lineage: Object.freeze(lineage),
          value: Object.freeze(value) as Readonly<Value>,
        }),
      };
    },

    isCurrent(version) {
      return version === currentVersion;
    },
  };
}
