import {
  FEATURE_DEFAULTS,
  validateConfiguration,
  type ToolbarConfiguration,
} from "@moorkyz/toolbar";

export const PLAYGROUND_STORAGE_KEY = "moorkyz-toolbar:portal:playground:v1";
export const PLAYGROUND_COMMANDS = [
  "add-task",
  "toggle-completed",
  "clear-completed",
] as const;
export const PLAYGROUND_SECTIONS = [
  "Templates",
  "Appearance",
  "Geometry & Position",
  "Actions",
  "Motion & Interaction",
  "Context & Capabilities",
  "Advanced Settings",
  "Code & Export",
] as const;

const initial = validateConfiguration({
  label: "Modern Workspace toolbar",
  renderMode: "light",
  placement: { mode: "container" },
  features: Object.fromEntries(
    Object.keys(FEATURE_DEFAULTS).map((key) => [key, false]),
  ),
  actions: [
    { id: "add-task", label: "New task" },
    { id: "toggle-completed", label: "Show / hide completed" },
    { id: "clear-completed", label: "Clear completed" },
  ],
});
if (!initial.ok) throw new Error("Invalid built-in Playground configuration.");
export const INITIAL_PLAYGROUND_CONFIGURATION = initial.value;

export type PlaygroundValidation =
  | { readonly ok: true; readonly value: ToolbarConfiguration }
  | { readonly ok: false; readonly message: string };

export function validatePlaygroundConfiguration(
  value: unknown,
): PlaygroundValidation {
  const result = validateConfiguration(value);
  if (!result.ok) {
    return {
      ok: false,
      message: result.errors
        .map(({ path, message }) => `${path}: ${message}`)
        .join(" "),
    };
  }
  const config = result.value;
  if (
    config.renderMode !== "light" ||
    config.placement.mode !== "container" ||
    Object.values(config.features).some(Boolean) ||
    config.actions.some(
      ({ id }) => !PLAYGROUND_COMMANDS.some((command) => command === id),
    )
  ) {
    return {
      ok: false,
      message:
        "This slice supports container placement, Light DOM, the three Workspace commands and disabled optional features only. Configuration cannot grant host capabilities.",
    };
  }
  if (
    config.label.length > 100 ||
    config.actions.some(({ label }) => label.length > 80)
  ) {
    return {
      ok: false,
      message:
        "Use at most 100 characters for the toolbar name and 80 for action names.",
    };
  }
  return result;
}

export function parsePlaygroundJSON(
  raw: string,
  saved = false,
): PlaygroundValidation {
  if (raw.length > 65_536 || new TextEncoder().encode(raw).byteLength > 65_536)
    return { ok: false, message: "Configuration exceeds the 64 KiB limit." };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      message:
        "Configuration is not valid JSON. The last valid preview is unchanged.",
    };
  }
  if (saved) {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      !("version" in value) ||
      value.version !== 1 ||
      !("configuration" in value) ||
      Object.keys(value).length !== 2
    ) {
      return {
        ok: false,
        message:
          "Unsupported saved draft format or version. Stored data and the current preview are unchanged.",
      };
    }
    value = value.configuration;
  }
  return validatePlaygroundConfiguration(value);
}
