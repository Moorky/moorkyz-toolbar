export const THEME_NAMES = [
  "signature",
  "frosted-glass",
  "midnight",
  "warm-minimal",
  "high-contrast",
  "project-adaptive",
] as const;

export type ToolbarThemeName = (typeof THEME_NAMES)[number];
export type ToolbarColorScheme = "system" | "light" | "dark";

export interface ThemeTokens {
  readonly background: string;
  readonly foreground: string;
  readonly border: string;
  readonly hover: string;
  readonly focus: string;
  readonly accent: string;
}

type MutableThemeTokens = {
  -readonly [Token in keyof ThemeTokens]: ThemeTokens[Token];
};

export const BUILT_IN_THEMES: Readonly<Record<ToolbarThemeName, ThemeTokens>> =
  Object.freeze({
    signature: Object.freeze({
      background: "#FFFFFF",
      foreground: "#172033",
      border: "#D6DAE2",
      hover: "#E9EDF4",
      focus: "#315BD6",
      accent: "#315BD6",
    }),
    "frosted-glass": Object.freeze({
      background: "#F5F7FA",
      foreground: "#172033",
      border: "#D4DCE8",
      hover: "#E8EEF7",
      focus: "#315BD6",
      accent: "#315BD6",
    }),
    midnight: Object.freeze({
      background: "#161C2A",
      foreground: "#F4F6FC",
      border: "#536079",
      hover: "#2B354A",
      focus: "#AFC6FF",
      accent: "#B6C8F5",
    }),
    "warm-minimal": Object.freeze({
      background: "#FFF8EC",
      foreground: "#302317",
      border: "#B9A98C",
      hover: "#EFE2CD",
      focus: "#7D4019",
      accent: "#763E15",
    }),
    "high-contrast": Object.freeze({
      background: "#FFFFFF",
      foreground: "#000000",
      border: "#000000",
      hover: "#DADADA",
      focus: "#005FCC",
      accent: "#0041A8",
    }),
    "project-adaptive": Object.freeze({
      background: "#FFFFFF",
      foreground: "#172033",
      border: "#D6DAE2",
      hover: "#E9EDF4",
      focus: "#315BD6",
      accent: "#315BD6",
    }),
  });

const THEME_TOKEN_KEYS = [
  "background",
  "foreground",
  "border",
  "hover",
  "focus",
  "accent",
] as const;
const THEME_TOKEN_KEY_SET = new Set<string>(THEME_TOKEN_KEYS);
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export type ThemeDiagnosticCode =
  | "THEME_INVALID_TYPE"
  | "THEME_UNKNOWN_TOKEN"
  | "THEME_INVALID_COLOR"
  | "THEME_ACCESSOR"
  | "THEME_TEXT_CONTRAST"
  | "THEME_FOCUS_CONTRAST";

export interface ThemeDiagnostic {
  readonly code: ThemeDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export type ThemeValidation =
  | { readonly ok: true; readonly value: ThemeTokens }
  | { readonly ok: false; readonly errors: readonly ThemeDiagnostic[] };

function luminance(color: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function validateThemeTokens(input: unknown): ThemeValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      errors: [
        {
          code: "THEME_INVALID_TYPE",
          path: "",
          message: "Theme tokens must be a plain data object.",
        },
      ],
    };
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    return {
      ok: false,
      errors: [
        {
          code: "THEME_INVALID_TYPE",
          path: "",
          message: "Theme tokens must not inherit from custom prototypes.",
        },
      ],
    };
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  const errors: ThemeDiagnostic[] = [];
  const values: Partial<MutableThemeTokens> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!THEME_TOKEN_KEY_SET.has(key)) {
      errors.push({
        code: "THEME_UNKNOWN_TOKEN",
        path: key,
        message: `Unknown theme token "${key}".`,
      });
    } else if (!("value" in descriptor)) {
      errors.push({
        code: "THEME_ACCESSOR",
        path: key,
        message: "Theme tokens must be plain data properties.",
      });
    } else if (
      typeof descriptor.value !== "string" ||
      !HEX_COLOR_PATTERN.test(descriptor.value)
    ) {
      errors.push({
        code: "THEME_INVALID_COLOR",
        path: key,
        message: "Theme colors must use #RRGGBB hexadecimal notation.",
      });
    } else {
      switch (key) {
        case "background":
          values.background = descriptor.value;
          break;
        case "foreground":
          values.foreground = descriptor.value;
          break;
        case "border":
          values.border = descriptor.value;
          break;
        case "hover":
          values.hover = descriptor.value;
          break;
        case "focus":
          values.focus = descriptor.value;
          break;
        case "accent":
          values.accent = descriptor.value;
          break;
      }
    }
  }
  for (const key of THEME_TOKEN_KEYS) {
    if (values[key] === undefined) {
      errors.push({
        code: "THEME_INVALID_COLOR",
        path: key,
        message: `Theme token "${key}" is required and must use #RRGGBB hexadecimal notation.`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors) };
  }

  const { background, foreground, border, hover, focus, accent } = values;
  if (
    background === undefined ||
    foreground === undefined ||
    border === undefined ||
    hover === undefined ||
    focus === undefined ||
    accent === undefined
  ) {
    return {
      ok: false,
      errors: Object.freeze([
        ...errors,
        {
          code: "THEME_INVALID_COLOR",
          path: "",
          message: "All theme tokens are required.",
        },
      ]),
    };
  }
  const tokens: ThemeTokens = {
    background,
    foreground,
    border,
    hover,
    focus,
    accent,
  };
  if (contrastRatio(tokens.foreground, tokens.background) < 4.5) {
    errors.push({
      code: "THEME_TEXT_CONTRAST",
      path: "foreground",
      message: "Foreground/background contrast must be at least 4.5:1.",
    });
  }
  if (contrastRatio(tokens.focus, tokens.background) < 3) {
    errors.push({
      code: "THEME_FOCUS_CONTRAST",
      path: "focus",
      message: "Focus/background contrast must be at least 3:1.",
    });
  }

  return errors.length > 0
    ? { ok: false, errors: Object.freeze(errors) }
    : { ok: true, value: Object.freeze({ ...tokens }) };
}
