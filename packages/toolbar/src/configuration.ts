export const CONFIGURATION_VERSION = "1.0" as const;

export const FEATURE_DEFAULTS = Object.freeze({
  search: true,
  ai: false,
  tasks: false,
  notifications: false,
  discovery: false,
  platform: true,
  customize: true,
  spatialCoordination: false,
  offline: false,
  diagnostics: false,
  advancedGestures: false,
  experimental: false,
});

const ACTION_ID_PATTERN = "^[A-Za-z][A-Za-z0-9._-]{0,63}$";
const FEATURE_SCHEMA_PROPERTIES = Object.fromEntries(
  Object.entries(FEATURE_DEFAULTS).map(([name, defaultValue]) => [
    name,
    { type: "boolean", default: defaultValue },
  ]),
);

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export const CONFIGURATION_SCHEMA = deepFreeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:moorkyz:toolbar:configuration:1.0",
  type: "object",
  properties: {
    schemaVersion: {
      const: CONFIGURATION_VERSION,
      default: CONFIGURATION_VERSION,
    },
    features: {
      type: "object",
      properties: FEATURE_SCHEMA_PROPERTIES,
      additionalProperties: false,
      default: FEATURE_DEFAULTS,
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "label"],
        properties: {
          id: { type: "string", pattern: ACTION_ID_PATTERN },
          label: { type: "string", minLength: 1, pattern: "\\S" },
        },
        additionalProperties: false,
      },
      default: [],
    },
    renderMode: { enum: ["shadow", "light"], default: "shadow" },
    label: {
      type: "string",
      minLength: 1,
      pattern: "\\S",
      default: "Application toolbar",
    },
  },
  additionalProperties: false,
});

export type FeatureFlags = {
  readonly [Feature in keyof typeof FEATURE_DEFAULTS]: boolean;
};

export type FeatureOverrides = Partial<FeatureFlags>;

export interface ToolbarActionDescriptor {
  readonly id: string;
  readonly label: string;
}

export interface ToolbarConfigurationInput {
  readonly schemaVersion?: string;
  readonly features?: FeatureOverrides;
  readonly actions?: readonly ToolbarActionDescriptor[];
  readonly renderMode?: "shadow" | "light";
  readonly label?: string;
}

export interface ToolbarConfiguration {
  readonly schemaVersion: typeof CONFIGURATION_VERSION;
  readonly features: FeatureFlags;
  readonly actions: readonly ToolbarActionDescriptor[];
  readonly renderMode: "shadow" | "light";
  readonly label: string;
}

export type ConfigurationDiagnosticCode =
  | "CONFIG_INVALID_TYPE"
  | "CONFIG_UNKNOWN_KEY"
  | "CONFIG_ACCESSOR_PROPERTY"
  | "CONFIG_UNSUPPORTED_VERSION"
  | "CONFIG_INVALID_FEATURES"
  | "CONFIG_INVALID_FEATURE"
  | "CONFIG_INVALID_ACTIONS"
  | "CONFIG_INVALID_ACTION"
  | "CONFIG_DUPLICATE_ACTION"
  | "CONFIG_INVALID_RENDER_MODE"
  | "CONFIG_INVALID_LABEL";

export interface ConfigurationDiagnostic {
  readonly code: ConfigurationDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export type ConfigurationValidation =
  | { readonly ok: true; readonly value: ToolbarConfiguration }
  | { readonly ok: false; readonly errors: readonly ConfigurationDiagnostic[] };

const CONFIGURATION_KEYS = new Set(
  Object.keys(CONFIGURATION_SCHEMA.properties),
);
const FEATURE_KEYS = new Set(
  Object.keys(CONFIGURATION_SCHEMA.properties.features.properties),
);
const ACTION_KEYS = new Set(
  Object.keys(CONFIGURATION_SCHEMA.properties.actions.items.properties),
);
const ACTION_ID_PATTERN_RE = new RegExp(ACTION_ID_PATTERN);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function reportUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  errors: ConfigurationDiagnostic[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push({
        code: "CONFIG_UNKNOWN_KEY",
        path: path ? `${path}.${key}` : key,
        message: `Unknown configuration key "${key}".`,
      });
    }
  }
}

function dataProperties(
  value: Record<string, unknown>,
  path: string,
  errors: ConfigurationDiagnostic[],
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if ("value" in descriptor) {
      result[key] = descriptor.value;
    } else {
      errors.push({
        code: "CONFIG_ACCESSOR_PROPERTY",
        path: path ? `${path}.${key}` : key,
        message: "Configuration properties must be plain data properties.",
      });
    }
  }
  return result;
}

function normalizeFeatures(
  value: unknown,
  errors: ConfigurationDiagnostic[],
): FeatureFlags {
  if (value === undefined) {
    return { ...FEATURE_DEFAULTS };
  }
  if (!isPlainRecord(value)) {
    errors.push({
      code: "CONFIG_INVALID_FEATURES",
      path: "features",
      message: "Expected a plain object of boolean feature overrides.",
    });
    return { ...FEATURE_DEFAULTS };
  }

  const safeFeatures = dataProperties(value, "features", errors);
  reportUnknownKeys(safeFeatures, FEATURE_KEYS, "features", errors);
  const features: Record<keyof typeof FEATURE_DEFAULTS, boolean> = {
    ...FEATURE_DEFAULTS,
  };

  for (const [key, enabled] of Object.entries(safeFeatures)) {
    if (!FEATURE_KEYS.has(key)) {
      continue;
    }
    if (typeof enabled !== "boolean") {
      errors.push({
        code: "CONFIG_INVALID_FEATURE",
        path: `features.${key}`,
        message: "Feature overrides must be booleans.",
      });
      continue;
    }
    features[key as keyof typeof FEATURE_DEFAULTS] = enabled;
  }

  return features;
}

function normalizeActions(
  value: unknown,
  errors: ConfigurationDiagnostic[],
): readonly ToolbarActionDescriptor[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push({
      code: "CONFIG_INVALID_ACTIONS",
      path: "actions",
      message: "Expected an array of action descriptors.",
    });
    return [];
  }

  const ids = new Set<string>();
  const actions: ToolbarActionDescriptor[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const path = `actions.${index}`;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor) {
      errors.push({
        code: "CONFIG_INVALID_ACTION",
        path,
        message: "Expected an action descriptor object.",
      });
      continue;
    }
    if (!("value" in descriptor)) {
      errors.push({
        code: "CONFIG_ACCESSOR_PROPERTY",
        path,
        message: "Action entries must be plain data properties.",
      });
      continue;
    }
    const item: unknown = descriptor.value;

    if (!isPlainRecord(item)) {
      errors.push({
        code: "CONFIG_INVALID_ACTION",
        path,
        message: "Expected an action descriptor object.",
      });
      continue;
    }
    const safeItem = dataProperties(item, path, errors);
    reportUnknownKeys(safeItem, ACTION_KEYS, path, errors);

    const { id, label } = safeItem;
    let valid = true;
    if (typeof id !== "string" || !ACTION_ID_PATTERN_RE.test(id)) {
      valid = false;
      errors.push({
        code: "CONFIG_INVALID_ACTION",
        path: `${path}.id`,
        message:
          "Action ids must start with a letter and contain at most 64 safe characters.",
      });
    } else if (ids.has(id)) {
      valid = false;
      errors.push({
        code: "CONFIG_DUPLICATE_ACTION",
        path: `${path}.id`,
        message: `Action id "${id}" is already registered.`,
      });
    }

    if (typeof label !== "string" || label.trim().length === 0) {
      valid = false;
      errors.push({
        code: "CONFIG_INVALID_ACTION",
        path: `${path}.label`,
        message: "Action labels must be non-empty strings.",
      });
    }

    if (valid && typeof id === "string" && typeof label === "string") {
      ids.add(id);
      actions.push(Object.freeze({ id, label }));
    }
  }

  return actions;
}

export function validateConfiguration(input: unknown): ConfigurationValidation {
  if (!isPlainRecord(input)) {
    return {
      ok: false,
      errors: [
        {
          code: "CONFIG_INVALID_TYPE",
          path: "",
          message: "Expected a plain configuration object.",
        },
      ],
    };
  }

  const errors: ConfigurationDiagnostic[] = [];
  const config = dataProperties(input, "", errors);
  reportUnknownKeys(config, CONFIGURATION_KEYS, "", errors);

  const schemaVersion =
    config.schemaVersion === undefined
      ? CONFIGURATION_VERSION
      : config.schemaVersion;
  if (schemaVersion !== CONFIGURATION_VERSION) {
    errors.push({
      code: "CONFIG_UNSUPPORTED_VERSION",
      path: "schemaVersion",
      message: `Only configuration schema ${CONFIGURATION_VERSION} is supported.`,
    });
  }

  const features = normalizeFeatures(config.features, errors);
  const actions = normalizeActions(config.actions, errors);
  const requestedRenderMode =
    config.renderMode === undefined ? "shadow" : config.renderMode;
  let renderMode: "shadow" | "light" = "shadow";
  if (requestedRenderMode === "shadow" || requestedRenderMode === "light") {
    renderMode = requestedRenderMode;
  } else {
    errors.push({
      code: "CONFIG_INVALID_RENDER_MODE",
      path: "renderMode",
      message: 'Render mode must be "shadow" or "light".',
    });
  }

  const requestedLabel =
    config.label === undefined ? "Application toolbar" : config.label;
  let label = "Application toolbar";
  if (typeof requestedLabel === "string" && requestedLabel.trim().length > 0) {
    label = requestedLabel;
  } else {
    errors.push({
      code: "CONFIG_INVALID_LABEL",
      path: "label",
      message: "Toolbar label must be a non-empty string.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors) };
  }

  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: CONFIGURATION_VERSION,
      features: Object.freeze(features),
      actions: Object.freeze(actions),
      renderMode,
      label,
    }),
  };
}
