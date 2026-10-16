import {
  THEME_NAMES,
  type ToolbarColorScheme,
  type ToolbarThemeName,
} from "./themes.js";

export const PREFERENCE_SCHEMA_VERSION = 1 as const;

export interface ToolbarPreferences {
  readonly schemaVersion: typeof PREFERENCE_SCHEMA_VERSION;
  readonly theme: ToolbarThemeName;
  readonly colorScheme: ToolbarColorScheme;
  readonly collapsed: boolean;
  readonly actionOrder: readonly string[];
}

export type ToolbarPreferencePatch = Partial<ToolbarPreferenceValues>;

export type ToolbarPreferenceValues = Omit<ToolbarPreferences, "schemaVersion">;

export interface PreferenceStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createBrowserPreferenceStorage(
  view: Pick<Window, "localStorage">,
): PreferenceStorageAdapter {
  return {
    getItem(key) {
      return view.localStorage.getItem(key);
    },
    setItem(key, value) {
      view.localStorage.setItem(key, value);
    },
    removeItem(key) {
      view.localStorage.removeItem(key);
    },
  };
}

export type PreferenceDiagnosticCode =
  | "PREFERENCE_INVALID_NAMESPACE"
  | "PREFERENCE_INVALID_DATA"
  | "PREFERENCE_UNKNOWN_KEY"
  | "PREFERENCE_ACCESSOR"
  | "PREFERENCE_UNSUPPORTED_VERSION"
  | "PREFERENCE_STORAGE_READ_FAILED"
  | "PREFERENCE_STORAGE_WRITE_FAILED"
  | "PREFERENCE_STORAGE_REMOVE_FAILED"
  | "PREFERENCE_MIGRATION_WRITE_FAILED";

export interface PreferenceDiagnostic {
  readonly code: PreferenceDiagnosticCode;
  readonly message: string;
  readonly cause?: unknown;
}

export interface PreferenceSnapshot {
  readonly value: ToolbarPreferences;
  readonly source: "default" | "memory" | "storage";
  readonly hasPreferences: boolean;
  readonly diagnostic?: PreferenceDiagnostic;
}

export type PreferenceWriteResult =
  | {
      readonly ok: true;
      readonly value: ToolbarPreferences;
      readonly source: "memory" | "storage";
      readonly diagnostic?: PreferenceDiagnostic;
    }
  | { readonly ok: false; readonly error: PreferenceDiagnostic };

export interface ToolbarPreferenceStore {
  readonly storageKey: string;
  load(): PreferenceSnapshot;
  save(patch: ToolbarPreferencePatch): PreferenceWriteResult;
  reset(): PreferenceWriteResult;
}

export const DEFAULT_TOOLBAR_PREFERENCES: ToolbarPreferences = Object.freeze({
  schemaVersion: PREFERENCE_SCHEMA_VERSION,
  theme: "signature",
  colorScheme: "system",
  collapsed: false,
  actionOrder: Object.freeze([]),
});

const PREFERENCE_NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/;
const ACTION_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const PREFERENCE_KEYS = new Set([
  "schemaVersion",
  "theme",
  "colorScheme",
  "collapsed",
  "actionOrder",
]);
const PATCH_KEYS = new Set([
  "theme",
  "colorScheme",
  "collapsed",
  "actionOrder",
]);

type PreferenceNormalization =
  | { readonly ok: true; readonly value: ToolbarPreferences }
  | { readonly ok: false; readonly error: PreferenceDiagnostic };

function isThemeName(value: unknown): value is ToolbarThemeName {
  return THEME_NAMES.some((theme) => theme === value);
}

function isColorScheme(value: unknown): value is ToolbarColorScheme {
  return value === "system" || value === "light" || value === "dark";
}

function diagnostic(
  code: PreferenceDiagnosticCode,
  message: string,
  cause?: unknown,
): PreferenceDiagnostic {
  return {
    code,
    message,
    ...(cause === undefined ? {} : { cause }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copyDataProperties(value: Record<string, unknown>): {
  readonly values: Record<string, unknown>;
  readonly error?: PreferenceDiagnostic;
} {
  const values: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (!("value" in descriptor)) {
      return {
        values,
        error: diagnostic(
          "PREFERENCE_ACCESSOR",
          `Preference property "${key}" must be a data property.`,
        ),
      };
    }
    values[key] = descriptor.value;
  }
  return { values };
}

function normalizeActionOrder(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const order: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      !ACTION_ID_PATTERN.test(descriptor.value) ||
      seen.has(descriptor.value)
    ) {
      return null;
    }
    seen.add(descriptor.value);
    order.push(descriptor.value);
  }
  return Object.freeze(order);
}

function normalizeCurrentPreferences(
  input: Record<string, unknown>,
): PreferenceNormalization {
  const copied = copyDataProperties(input);
  if (copied.error !== undefined) {
    return { ok: false, error: copied.error };
  }
  for (const key of Object.keys(copied.values)) {
    if (!PREFERENCE_KEYS.has(key)) {
      return {
        ok: false,
        error: diagnostic(
          "PREFERENCE_UNKNOWN_KEY",
          `Unknown preference property "${key}".`,
        ),
      };
    }
  }

  const values = copied.values;
  const actionOrder = normalizeActionOrder(values.actionOrder);
  if (values.schemaVersion !== PREFERENCE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: diagnostic(
        "PREFERENCE_UNSUPPORTED_VERSION",
        "Stored toolbar preferences use an unsupported schema version.",
      ),
    };
  }

  const theme = values.theme;
  const colorScheme = values.colorScheme;
  const collapsed = values.collapsed;
  if (
    !isThemeName(theme) ||
    !isColorScheme(colorScheme) ||
    typeof collapsed !== "boolean" ||
    actionOrder === null
  ) {
    return {
      ok: false,
      error: diagnostic(
        "PREFERENCE_INVALID_DATA",
        "Stored toolbar preferences do not match the current schema.",
      ),
    };
  }

  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: PREFERENCE_SCHEMA_VERSION,
      theme,
      colorScheme,
      collapsed,
      actionOrder,
    }),
  };
}

function migrateLegacyPreferences(
  input: Record<string, unknown>,
): PreferenceNormalization {
  const copied = copyDataProperties(input);
  if (copied.error !== undefined) {
    return { ok: false, error: copied.error };
  }
  const values = copied.values;
  const allowed = new Set([
    "schemaVersion",
    "theme",
    "collapsed",
    "actionOrder",
  ]);
  if (Object.keys(values).some((key) => !allowed.has(key))) {
    return {
      ok: false,
      error: diagnostic(
        "PREFERENCE_UNKNOWN_KEY",
        "Legacy preference data contains unknown properties.",
      ),
    };
  }
  if (values.schemaVersion !== 0) {
    return {
      ok: false,
      error: diagnostic(
        "PREFERENCE_UNSUPPORTED_VERSION",
        "Stored toolbar preferences use an unsupported schema version.",
      ),
    };
  }

  const actionOrder =
    values.actionOrder === undefined
      ? DEFAULT_TOOLBAR_PREFERENCES.actionOrder
      : normalizeActionOrder(values.actionOrder);
  if (
    (values.collapsed !== undefined && typeof values.collapsed !== "boolean") ||
    actionOrder === null
  ) {
    return {
      ok: false,
      error: diagnostic(
        "PREFERENCE_INVALID_DATA",
        "Legacy preference data cannot be migrated safely.",
      ),
    };
  }

  let theme: ToolbarThemeName = "signature";
  let colorScheme: ToolbarColorScheme = "system";
  if (values.theme === "light" || values.theme === "dark") {
    colorScheme = values.theme;
  } else if (values.theme !== undefined) {
    if (!isThemeName(values.theme)) {
      return {
        ok: false,
        error: diagnostic(
          "PREFERENCE_INVALID_DATA",
          "Legacy theme preference cannot be migrated safely.",
        ),
      };
    }
    theme = values.theme;
  }

  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: PREFERENCE_SCHEMA_VERSION,
      theme,
      colorScheme,
      collapsed:
        typeof values.collapsed === "boolean"
          ? values.collapsed
          : DEFAULT_TOOLBAR_PREFERENCES.collapsed,
      actionOrder,
    }),
  };
}

export function createToolbarPreferenceStore(
  namespace: string,
  storage?: PreferenceStorageAdapter,
): ToolbarPreferenceStore {
  if (!PREFERENCE_NAMESPACE_PATTERN.test(namespace)) {
    throw new TypeError(
      "Preference namespace must be a lowercase, application-local identifier.",
    );
  }

  const storageKey = `@moorkyz/toolbar/${namespace}/preferences`;
  let memory = DEFAULT_TOOLBAR_PREFERENCES;
  let hasPreferences = false;

  function write(value: ToolbarPreferences): PreferenceWriteResult {
    memory = value;
    hasPreferences = true;
    if (storage === undefined) {
      return { ok: true, value, source: "memory" };
    }
    try {
      storage.setItem(storageKey, JSON.stringify(value));
      return { ok: true, value, source: "storage" };
    } catch (cause) {
      return {
        ok: true,
        value,
        source: "memory",
        diagnostic: diagnostic(
          "PREFERENCE_STORAGE_WRITE_FAILED",
          "Preferences were kept in memory because persistent storage is unavailable.",
          cause,
        ),
      };
    }
  }

  return {
    storageKey,

    load() {
      if (storage === undefined) {
        return {
          value: memory,
          source: hasPreferences ? "memory" : "default",
          hasPreferences,
        };
      }

      let serialized: string | null;
      try {
        serialized = storage.getItem(storageKey);
      } catch (cause) {
        return {
          value: memory,
          source: "memory",
          hasPreferences,
          diagnostic: diagnostic(
            "PREFERENCE_STORAGE_READ_FAILED",
            "Preferences could not be read; in-memory values remain active.",
            cause,
          ),
        };
      }
      if (serialized === null) {
        return {
          value: memory,
          source: hasPreferences ? "memory" : "default",
          hasPreferences,
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(serialized) as unknown;
      } catch (cause) {
        return {
          value: memory,
          source: "memory",
          hasPreferences,
          diagnostic: diagnostic(
            "PREFERENCE_INVALID_DATA",
            "Stored preferences are not valid JSON; in-memory values remain active.",
            cause,
          ),
        };
      }
      if (!isRecord(parsed)) {
        return {
          value: memory,
          source: "memory",
          hasPreferences,
          diagnostic: diagnostic(
            "PREFERENCE_INVALID_DATA",
            "Stored preferences must be a plain object.",
          ),
        };
      }

      const normalized =
        parsed.schemaVersion === 0
          ? migrateLegacyPreferences(parsed)
          : normalizeCurrentPreferences(parsed);
      if (!normalized.ok) {
        return {
          value: memory,
          source: "memory",
          hasPreferences,
          diagnostic: normalized.error,
        };
      }

      memory = normalized.value;
      hasPreferences = true;
      if (parsed.schemaVersion === 0) {
        try {
          storage.setItem(storageKey, JSON.stringify(memory));
          return { value: memory, source: "storage", hasPreferences: true };
        } catch (cause) {
          return {
            value: memory,
            source: "memory",
            hasPreferences: true,
            diagnostic: diagnostic(
              "PREFERENCE_MIGRATION_WRITE_FAILED",
              "Legacy preferences were migrated in memory but could not be saved.",
              cause,
            ),
          };
        }
      }
      return { value: memory, source: "storage", hasPreferences: true };
    },

    save(patch) {
      if (!isRecord(patch)) {
        return {
          ok: false,
          error: diagnostic(
            "PREFERENCE_INVALID_DATA",
            "Preference updates must be plain data objects.",
          ),
        };
      }
      const copied = copyDataProperties(patch);
      if (copied.error !== undefined) return { ok: false, error: copied.error };
      for (const key of Object.keys(copied.values)) {
        if (!PATCH_KEYS.has(key)) {
          return {
            ok: false,
            error: diagnostic(
              "PREFERENCE_UNKNOWN_KEY",
              `Unknown preference update "${key}".`,
            ),
          };
        }
      }
      const normalized = normalizeCurrentPreferences({
        ...memory,
        ...copied.values,
        schemaVersion: PREFERENCE_SCHEMA_VERSION,
      });
      if (!normalized.ok) return { ok: false, error: normalized.error };
      return write(normalized.value);
    },

    reset() {
      memory = DEFAULT_TOOLBAR_PREFERENCES;
      hasPreferences = false;
      if (storage === undefined) {
        return { ok: true, value: memory, source: "memory" };
      }
      try {
        storage.removeItem(storageKey);
        return { ok: true, value: memory, source: "storage" };
      } catch (cause) {
        return {
          ok: true,
          value: memory,
          source: "memory",
          diagnostic: diagnostic(
            "PREFERENCE_STORAGE_REMOVE_FAILED",
            "Preferences were reset in memory but could not be removed from storage.",
            cause,
          ),
        };
      }
    },
  };
}
