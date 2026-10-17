import {
  BUILT_IN_THEMES,
  FEATURE_DEFAULTS,
  validateConfiguration,
  validateThemeTokens,
  type ThemeTokens,
  type ToolbarConfiguration,
} from "@moorkyz/toolbar";
import {
  GENERATOR_MANIFEST,
  generateProject,
  generatorIntegrity,
  type GeneratedProject,
} from "@moorkyz/toolbar/generator";
import { parsePlaygroundJSON } from "./playground-model";

export const DESIGN_KEY = "moorkyz-toolbar:portal:playground:design:v2";
export const AUTOSAVE_KEY = `${DESIGN_KEY}:autosave`;
export const APPLICATIONS = [
  {
    id: "workspace",
    name: "Modern Workspace",
    category: "Productivity",
    description: "Create tasks, complete work and filter your day.",
    glyph: "▤",
  },
  {
    id: "document",
    name: "Document Editor",
    category: "Writing",
    description: "Edit a real document and format selected text.",
    glyph: "¶",
  },
  {
    id: "analytics",
    name: "Analytics Dashboard",
    category: "Data",
    description: "Change periods, filter segments and sort local data.",
    glyph: "▥",
  },
  {
    id: "board",
    name: "Project Board",
    category: "Productivity",
    description: "Create cards and move selected work through stages.",
    glyph: "▦",
  },
] as const;
export type ApplicationId = (typeof APPLICATIONS)[number]["id"];
export const COMMANDS = [
  { id: "add-task", label: "New task", application: "workspace" },
  {
    id: "toggle-completed",
    label: "Show / hide completed",
    application: "workspace",
  },
  { id: "clear-completed", label: "Clear completed", application: "workspace" },
  { id: "document-heading", label: "Add heading", application: "document" },
  {
    id: "document-uppercase",
    label: "Uppercase selection",
    application: "document",
  },
  { id: "document-count", label: "Count words", application: "document" },
  { id: "analytics-period", label: "Next period", application: "analytics" },
  {
    id: "analytics-filter",
    label: "Filter enterprise",
    application: "analytics",
  },
  { id: "analytics-sort", label: "Sort revenue", application: "analytics" },
  { id: "board-add", label: "New card", application: "board" },
  { id: "board-advance", label: "Advance selected", application: "board" },
  { id: "board-archive", label: "Archive completed", application: "board" },
] as const;
export type CommandId = (typeof COMMANDS)[number]["id"];
export const ICONS = {
  none: "",
  plus: "+",
  document: "¶",
  chart: "▥",
  check: "✓",
  arrow: "→",
  filter: "≡",
  star: "☆",
} as const;
export interface DesignAction {
  readonly id: string;
  readonly label: string;
  readonly command: CommandId;
  readonly icon: keyof typeof ICONS;
  readonly tooltip: string;
  readonly accessibleName: string;
  readonly enabled: boolean;
}
export interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly radius: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly align: "start" | "center" | "end";
  readonly position: "bottom" | "top";
}
export const STYLES = [
  {
    id: "pill",
    name: "Minimal Floating Pill",
    category: "Floating",
    radius: 32,
    height: 60,
    gap: 4,
    width: 0,
  },
  {
    id: "capsule",
    name: "Compact Capsule",
    category: "Floating",
    radius: 24,
    height: 56,
    gap: 0,
    width: 0,
  },
  {
    id: "rectangle",
    name: "Rounded Rectangle",
    category: "Geometric",
    radius: 10,
    height: 64,
    gap: 8,
    width: 0,
  },
  {
    id: "segmented",
    name: "Segmented Dock",
    category: "Modular",
    radius: 14,
    height: 64,
    gap: 12,
    width: 0,
  },
  {
    id: "full",
    name: "Full-Width Bottom Dock",
    category: "Docked",
    radius: 0,
    height: 64,
    gap: 4,
    width: 1100,
  },
  {
    id: "glass",
    name: "Frosted Glass",
    category: "Glass",
    radius: 18,
    height: 68,
    gap: 6,
    width: 0,
  },
  {
    id: "trapezoid",
    name: "Outward Trapezoid",
    category: "Geometric",
    radius: 0,
    height: 68,
    gap: 4,
    width: 0,
  },
  {
    id: "faceted",
    name: "Multi-Faceted Dock",
    category: "Geometric",
    radius: 0,
    height: 64,
    gap: 6,
    width: 0,
  },
  {
    id: "edge",
    name: "Minimal Edge Strip",
    category: "Docked",
    radius: 0,
    height: 56,
    gap: 0,
    width: 1100,
  },
  {
    id: "angular",
    name: "Angular Floating Toolbar",
    category: "Geometric",
    radius: 4,
    height: 60,
    gap: 8,
    width: 0,
  },
] as const;
export type StyleId = (typeof STYLES)[number]["id"];
export interface PlaygroundDesign {
  readonly version: 2;
  readonly application: ApplicationId;
  readonly style: StyleId;
  readonly geometry: Geometry;
  readonly appearance: {
    readonly light: ThemeTokens;
    readonly dark: ThemeTokens;
    readonly opacity: number;
    readonly blur: number;
    readonly shadow: number;
    readonly borderWidth: number;
    readonly fontSize: number;
    readonly iconSize: number;
  };
  readonly actions: readonly DesignAction[];
  readonly motion: boolean;
  readonly contextual: boolean;
}
export type DesignResult =
  | { readonly ok: true; readonly value: PlaygroundDesign }
  | { readonly ok: false; readonly message: string };

export function defaultActions(
  application: ApplicationId,
): readonly DesignAction[] {
  return COMMANDS.filter((command) => command.application === application).map(
    (command) => ({
      id: command.id,
      command: command.id,
      label: command.label,
      icon: "none",
      tooltip: command.label,
      accessibleName: command.label,
      enabled: true,
    }),
  );
}
export const INITIAL_DESIGN: PlaygroundDesign = {
  version: 2,
  application: "workspace",
  style: "pill",
  geometry: {
    width: 0,
    height: 60,
    gap: 4,
    radius: 32,
    offsetX: 0,
    offsetY: 12,
    align: "center",
    position: "bottom",
  },
  appearance: {
    light: {
      background: "#FFFFFF",
      foreground: "#201B2B",
      border: "#C9C2D3",
      hover: "#EEE8F5",
      focus: "#6C35AB",
      accent: "#6C35AB",
    },
    dark: {
      background: "#20162E",
      foreground: "#F7F4FC",
      border: "#756387",
      hover: "#38244E",
      focus: "#BD80FF",
      accent: "#BD80FF",
    },
    opacity: 100,
    blur: 0,
    shadow: 16,
    borderWidth: 1,
    fontSize: 14,
    iconSize: 18,
  },
  actions: defaultActions("workspace"),
  motion: true,
  contextual: true,
};

function record(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function numberIn(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
const shortText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

export function validateDesign(value: unknown): DesignResult {
  const fail = (message: string): DesignResult => ({ ok: false, message });
  if (
    !record(value) ||
    !exact(value, [
      "version",
      "application",
      "style",
      "geometry",
      "appearance",
      "actions",
      "motion",
      "contextual",
    ]) ||
    value.version !== 2
  )
    return fail(
      "Unsupported design format or version. The last valid design is unchanged.",
    );
  const application = APPLICATIONS.find(
    ({ id }) => id === value.application,
  )?.id;
  const style = STYLES.find(({ id }) => id === value.style)?.id;
  const g = value.geometry;
  const a = value.appearance;
  if (!application || !style) return fail("Unknown application or style.");
  if (
    !record(g) ||
    !exact(g, [
      "width",
      "height",
      "gap",
      "radius",
      "offsetX",
      "offsetY",
      "align",
      "position",
    ]) ||
    !numberIn(g.width, 0, 1100) ||
    !numberIn(g.height, 56, 96) ||
    !numberIn(g.gap, 0, 24) ||
    !numberIn(g.radius, 0, 48) ||
    !numberIn(g.offsetX, -128, 128) ||
    !numberIn(g.offsetY, 0, 120) ||
    (g.align !== "start" && g.align !== "center" && g.align !== "end") ||
    (g.position !== "top" && g.position !== "bottom")
  )
    return fail("Geometry is invalid or outside the responsive limits.");
  if (
    !record(a) ||
    !exact(a, [
      "light",
      "dark",
      "opacity",
      "blur",
      "shadow",
      "borderWidth",
      "fontSize",
      "iconSize",
    ]) ||
    !numberIn(a.opacity, 90, 100) ||
    !numberIn(a.blur, 0, 24) ||
    !numberIn(a.shadow, 0, 32) ||
    !numberIn(a.borderWidth, 0, 4) ||
    !numberIn(a.fontSize, 14, 18) ||
    !numberIn(a.iconSize, 14, 24)
  )
    return fail(
      "Appearance is invalid. Opacity stays at least 90% to preserve readable controls.",
    );
  const light = validateThemeTokens(a.light);
  const dark = validateThemeTokens(a.dark);
  if (!light.ok || !dark.ok)
    return fail(
      [...(!light.ok ? light.errors : []), ...(!dark.ok ? dark.errors : [])]
        .map(({ message }) => message)
        .join(" "),
    );
  const opacity = a.opacity;
  for (const tokens of [light.value, dark.value]) {
    for (const backdrop of [0, 255]) {
      const background =
        "#" +
        [1, 3, 5]
          .map((offset) =>
            Math.round(
              (parseInt(tokens.background.slice(offset, offset + 2), 16) *
                opacity) /
                100 +
                backdrop * (1 - opacity / 100),
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
      if (!validateThemeTokens({ ...tokens, background }).ok)
        return fail(
          "Surface opacity would reduce text or focus contrast. Increase opacity or adjust the variant colors.",
        );
    }
  }
  if (!Array.isArray(value.actions) || value.actions.length > 12)
    return fail("Use up to 12 actions.");
  const actions: DesignAction[] = [];
  for (const action of value.actions) {
    if (
      !record(action) ||
      !exact(action, [
        "id",
        "label",
        "command",
        "icon",
        "tooltip",
        "accessibleName",
        "enabled",
      ]) ||
      !shortText(action.id, 64) ||
      !shortText(action.label, 80) ||
      !shortText(action.tooltip, 160) ||
      !shortText(action.accessibleName, 160) ||
      typeof action.enabled !== "boolean" ||
      !action.accessibleName.toLowerCase().includes(action.label.toLowerCase())
    )
      return fail(
        "Action fields must be bounded text; accessible names must include the visible label.",
      );
    const command = COMMANDS.find(({ id }) => id === action.command)?.id;
    const icon = Object.keys(ICONS).find((key) => key === action.icon);
    if (!command || !icon || !Object.hasOwn(ICONS, icon))
      return fail(
        "Unknown command or icon. Imports cannot grant host capabilities.",
      );
    const iconKey = (Object.keys(ICONS) as (keyof typeof ICONS)[]).find(
      (key) => key === icon,
    );
    if (iconKey === undefined) return fail("Unknown icon.");
    actions.push({
      id: action.id,
      label: action.label,
      tooltip: action.tooltip,
      accessibleName: action.accessibleName,
      command,
      icon: iconKey,
      enabled: action.enabled,
    });
  }
  const sdk = validateConfiguration({
    actions: actions.map(({ id, label }) => ({ id, label })),
  });
  if (!sdk.ok) return fail(sdk.errors.map(({ message }) => message).join(" "));
  if (
    typeof value.motion !== "boolean" ||
    typeof value.contextual !== "boolean"
  )
    return fail("Motion and context settings must be booleans.");
  return {
    ok: true,
    value: {
      version: 2,
      application,
      style,
      geometry: {
        width: g.width,
        height: g.height,
        gap: g.gap,
        radius: g.radius,
        offsetX: g.offsetX,
        offsetY: g.offsetY,
        align: g.align,
        position: g.position,
      },
      appearance: {
        light: light.value,
        dark: dark.value,
        opacity: a.opacity,
        blur: a.blur,
        shadow: a.shadow,
        borderWidth: a.borderWidth,
        fontSize: a.fontSize,
        iconSize: a.iconSize,
      },
      actions,
      motion: value.motion,
      contextual: value.contextual,
    },
  };
}

export function parseDesign(raw: string): DesignResult {
  if (raw.length > 65536 || new TextEncoder().encode(raw).byteLength > 65536)
    return { ok: false, message: "Design exceeds 64 KiB." };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      message: "Design is not valid JSON. The last valid preview is unchanged.",
    };
  }
  if (record(value) && value.version === 1) {
    const legacy = parsePlaygroundJSON(raw, true);
    if (!legacy.ok) return legacy;
    return {
      ok: true,
      value: {
        ...INITIAL_DESIGN,
        appearance: {
          ...INITIAL_DESIGN.appearance,
          light: BUILT_IN_THEMES[legacy.value.theme],
        },
        actions: legacy.value.actions.map(({ id, label }) => ({
          id,
          label,
          command:
            id === "toggle-completed"
              ? "toggle-completed"
              : id === "clear-completed"
                ? "clear-completed"
                : "add-task",
          icon: "none",
          tooltip: label,
          accessibleName: label,
          enabled: true,
        })),
      },
    };
  }
  return validateDesign(value);
}
export function sdkConfiguration(
  design: PlaygroundDesign,
  scheme: "light" | "dark",
): ToolbarConfiguration {
  const validation = validateConfiguration({
    renderMode: "light",
    placement: { mode: "container" },
    colorScheme: scheme,
    label: `${APPLICATIONS.find(({ id }) => id === design.application)?.name} toolbar`,
    actions: design.actions.map(({ id, label }) => ({ id, label })),
    features: Object.fromEntries(
      Object.keys(FEATURE_DEFAULTS).map((key) => [key, false]),
    ),
  });
  if (!validation.ok)
    throw new Error(validation.errors.map(({ message }) => message).join(" "));
  return validation.value;
}
export function applyStyle(
  design: PlaygroundDesign,
  id: StyleId,
): PlaygroundDesign {
  const style = STYLES.find((entry) => entry.id === id);
  if (!style) throw new Error("Unknown style.");
  return {
    ...design,
    style: id,
    geometry: {
      ...design.geometry,
      width: style.width,
      radius: style.radius,
      height: style.height,
      gap: style.gap,
      offsetY: id === "full" || id === "edge" ? 0 : design.geometry.offsetY,
    },
    appearance: {
      ...design.appearance,
      blur: id === "glass" ? 20 : 0,
      shadow: id === "edge" ? 0 : 16,
    },
  };
}

export function presentationCSS(
  design: PlaygroundDesign,
  scope: string,
  scheme: "light" | "dark",
): string {
  const { geometry: g, appearance: a } = design;
  const t = a[scheme];
  const selector = `${scope} .mzk-toolbar`;
  const polygon =
    design.style === "trapezoid"
      ? "polygon(4% 0,96% 0,100% 100%,0 100%)"
      : "polygon(14px 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px),0 14px)";
  const shaped = design.style === "trapezoid" || design.style === "faceted";
  return `${scope} .mzk-toolbar-host[data-placement="container"] {
    top: ${g.position === "top" ? `${64 + g.offsetY}px` : "auto"};
    bottom: ${g.position === "bottom" ? `max(${g.offsetY}px, env(safe-area-inset-bottom, 0px))` : "auto"};
    inset-inline-start: ${12 + Math.max(0, g.offsetX)}px;
    inset-inline-end: ${12 + Math.max(0, -g.offsetX)}px;
    padding-inline: 0; justify-content: ${g.align === "start" ? "flex-start" : g.align === "end" ? "flex-end" : "center"};
  }
  ${selector} {
    --mzk-toolbar-background: ${t.background}; --mzk-toolbar-foreground: ${t.foreground};
    --mzk-toolbar-border: ${t.border}; --mzk-toolbar-hover: ${t.hover};
    --mzk-toolbar-focus: ${t.focus}; --mzk-toolbar-disabled: ${t.foreground};
    width: ${g.width === 0 ? "max-content" : `min(100%, ${g.width}px)`};
    max-width: 100%; min-height: ${g.height}px; gap: ${g.gap}px;
    padding: 6px ${shaped ? 24 : 6}px; border-radius: ${g.radius}px;
    border: ${a.borderWidth}px ${design.style === "angular" ? "dashed" : "solid"} ${t.border};
    background: ${shaped ? "transparent" : `color-mix(in srgb, ${t.background} ${a.opacity}%, transparent)`};
    color: ${t.foreground}; backdrop-filter: blur(${a.blur}px);
    box-shadow: 0 ${a.shadow / 2}px ${a.shadow * 2}px #00000026;
    font-family: "DM Sans", system-ui, sans-serif;
    transition-duration: ${design.motion ? 180 : 0}ms; isolation: isolate;
  }
  ${selector} button { min-height: ${Math.max(44, g.height - 14)}px; min-width: 44px; font-size: ${a.fontSize}px; border-radius: ${Math.min(g.radius, 20)}px; }
  ${selector} .mzk-toolbar__actions { gap: ${g.gap}px; }
  ${selector} .mzk-toolbar__action::before { content: attr(data-icon); font-size: ${a.iconSize}px; margin-inline-end: 4px; }
  ${selector} button:focus-visible { outline: 3px solid ${t.focus}; outline-offset: -3px; }
  ${design.style === "segmented" ? `${selector} .mzk-toolbar__action-item { border: 1px solid ${t.border}; border-radius: ${g.radius}px; background: ${t.hover}; }` : ""}
  ${design.style === "edge" ? `${selector} { border-inline: 0; border-bottom: 0; border-top-width: 3px; }` : ""}
  ${shaped ? `${selector}::before { content:""; position:absolute; inset:0; z-index:-1; background:${t.background}; clip-path:${polygon}; }` : ""}
  @media (prefers-reduced-motion: reduce) { ${selector} { transition: none; } }`;
}

export function decorateToolbar(
  root: HTMLElement,
  design: PlaygroundDesign,
  allowed: readonly string[],
  editing = false,
): void {
  for (const action of design.actions) {
    const button = root.querySelector<HTMLButtonElement>(
      `[data-toolbar-control="action:${action.id}"]`,
    );
    if (button === null) continue;
    button.setAttribute("aria-label", action.accessibleName);
    button.dataset.icon = ICONS[action.icon];
    button.disabled =
      editing || !action.enabled || !allowed.includes(action.command);
    button.title = button.disabled
      ? `${action.tooltip} — unavailable in the current host context`
      : action.tooltip;
  }
}

export async function generateDesignProject(
  design: PlaygroundDesign,
  scheme: "light" | "dark",
): Promise<GeneratedProject> {
  const result = validateDesign(design);
  if (!result.ok) throw new Error(result.message);
  const generated = await generateProject({
    name: "my-toolbar-workspace",
    framework: "vanilla",
    origin: "studio",
    configuration: sdkConfiguration(result.value, scheme),
  });
  if (!generated.ok) throw new Error(generated.error.message);
  const allowed = COMMANDS.filter(
    ({ application }) => application === design.application,
  ).map(({ id }) => id);
  const presentation = `import design from "./playground.design.js";
const allowed = ${JSON.stringify(allowed)};
export function present(root) {
  function refresh() {
  for (const action of design.actions) {
    const button = [...root.querySelectorAll("[data-toolbar-control]")].find(button => button.getAttribute("data-toolbar-control") === "action:" + action.id);
    if (!button) continue;
    button.setAttribute("aria-label", action.accessibleName);
    button.title = action.tooltip;
    button.dataset.icon = ${JSON.stringify(ICONS)}[action.icon];
    button.disabled = !action.enabled || !allowed.includes(action.command);
  }
  }
  refresh();
  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList: true, subtree: true });
  globalThis.addEventListener("pagehide", () => observer.disconnect(), { once: true });
}
`;
  const files = generated.value.files
    .filter(({ path }) => path !== GENERATOR_MANIFEST)
    .map((file) => {
      if (file.path === "style.css")
        return {
          ...file,
          content: `${file.content}\n#toolbar { position:relative; min-height:200px; }\n${presentationCSS(design, "#toolbar", scheme)}\n`,
        };
      if (file.path === "app.js")
        return {
          ...file,
          content: `import { present } from "./presentation.js";\n${file.content.replace("  return toolbar;", "  present(target);\n  return toolbar;")}`,
        };
      if (file.path === "README.md")
        return {
          ...file,
          content: `${file.content}\n## Playground design\n\nplayground.design.json is the portable portal design (not the SDK configuration).\nstyle.css and presentation.js reproduce its validated geometry, colors, labels and icons.\nThe starter demonstrates host dispatch; the four Playground sample applications are not included.\nThe host must authorize real commands. Disabled/incompatible commands stay disabled.\nKeep custom presentation files and the integrity manifest when reviewing an upgrade.\n`,
        };
      return file;
    });
  files.push(
    {
      path: "playground.design.json",
      content: JSON.stringify(design, null, 2),
    },
    {
      path: "playground.design.js",
      content: `export default ${JSON.stringify(design, null, 2)};\n`,
    },
    { path: "presentation.js", content: presentation },
  );
  const integrity = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file.path,
        await generatorIntegrity(file.content),
      ]),
    ),
  );
  const manifest = { ...generated.value.manifest, integrity };
  return {
    manifest,
    files: [
      ...files,
      { path: GENERATOR_MANIFEST, content: JSON.stringify(manifest, null, 2) },
    ],
  };
}
