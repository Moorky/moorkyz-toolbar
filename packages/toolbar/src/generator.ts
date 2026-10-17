import {
  CONFIGURATION_VERSION,
  validateConfiguration,
  type ConfigurationDiagnostic,
  type ToolbarConfiguration,
} from "./configuration.js";

export const GENERATOR_VERSION = "1.0.0";
export const GENERATOR_TEMPLATE_VERSION = "1.0.0";
export const GENERATOR_SDK_VERSION = "0.1.0";
export const GENERATOR_MANIFEST = "moorkyz.manifest.json";
export const GENERATOR_PRESETS = Object.freeze([
  "universal",
  "website",
  "dashboard",
  "editor",
  "game",
] as const);
export type GeneratorPreset = (typeof GENERATOR_PRESETS)[number];
export type GeneratorOrigin = "cli" | "studio";

export interface GeneratorOptions {
  readonly name: string;
  readonly preset?: GeneratorPreset;
  readonly framework?: "vanilla";
  readonly configuration?: unknown;
  readonly origin?: GeneratorOrigin;
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

export interface GeneratorManifest {
  readonly manifestVersion: "1.0";
  readonly generatorVersion: string;
  readonly templateVersion: string;
  readonly sdkVersion: string;
  readonly schemaVersion: typeof CONFIGURATION_VERSION;
  readonly origin: GeneratorOrigin;
  readonly project: {
    readonly name: string;
    readonly framework: "vanilla";
    readonly preset: GeneratorPreset;
  };
  readonly configuration: ToolbarConfiguration;
  readonly features: ToolbarConfiguration["features"];
  readonly integrity: Readonly<Record<string, string>>;
  readonly migration: {
    readonly strategy: "review-and-explicit-apply";
    readonly sourceOwnership: "developer";
  };
}

export interface GeneratedProject {
  readonly manifest: GeneratorManifest;
  readonly files: readonly GeneratedFile[];
}

export type GeneratorResult =
  | { readonly ok: true; readonly value: GeneratedProject }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          | "GENERATOR_INVALID_OPTIONS"
          | "GENERATOR_INVALID_CONFIGURATION"
          | "GENERATOR_INTEGRITY_UNAVAILABLE";
        readonly message: string;
        readonly diagnostics?: readonly ConfigurationDiagnostic[];
      };
    };

const NAME = /^[a-z][a-z0-9-]{0,62}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const OPTION_KEYS = new Set([
  "name",
  "preset",
  "framework",
  "configuration",
  "origin",
]);

// Inspect descriptors before serialization: getters and toJSON must never run.
function isPortableData(
  value: unknown,
  ancestors = new Set<object>(),
): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== Object.prototype &&
    prototype !== null &&
    prototype !== Array.prototype
  ) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const portable = Object.entries(descriptors).every(([key, descriptor]) => {
    if (Array.isArray(value) && key === "length") return true;
    return (
      descriptor.enumerable &&
      "value" in descriptor &&
      isPortableData(descriptor.value, ancestors)
    );
  });
  ancestors.delete(value);
  return portable;
}

export function isGeneratorPreset(value: unknown): value is GeneratorPreset {
  return GENERATOR_PRESETS.some((preset) => preset === value);
}

/** SHA-256 over the exact UTF-8 bytes written to disk, not a normalized string. */
export async function generatorIntegrity(content: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return `sha256-${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const PRESET_ACTIONS = {
  universal: [{ id: "welcome", label: "Welcome" }],
  website: [
    { id: "pages", label: "Pages" },
    { id: "contact", label: "Contact" },
  ],
  dashboard: [
    { id: "overview", label: "Overview" },
    { id: "reports", label: "Reports" },
  ],
  editor: [
    { id: "document", label: "Document" },
    { id: "preview", label: "Preview" },
  ],
  game: [
    { id: "pause", label: "Pause" },
    { id: "settings", label: "Settings" },
  ],
} as const;

const APP = `import { createToolbar } from "@moorkyz/toolbar";
import configuration from "./toolbar.config.js";

export function mountStarter(document) {
  const target = document.querySelector("#toolbar");
  const status = document.querySelector("#status");
  if (!target || !status) throw new Error("Starter mount elements are missing.");
  const toolbar = createToolbar(configuration, {
    dispatchAction(actionId) {
      // Demo-only presentation; real host commands must enforce authorization.
      status.textContent = "Selected: " + actionId;
    },
  });
  const result = toolbar.mount(target);
  if (!result.ok) {
    toolbar.dispose();
    throw new Error(result.error.message);
  }
  return toolbar;
}

if (typeof document !== "undefined") {
  const toolbar = mountStarter(document);
  globalThis.addEventListener("pagehide", () => toolbar.dispose(), { once: true });
}
`;

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Moorkyz Toolbar starter</title>
    <link rel="stylesheet" href="./style.css">
    <script type="importmap">{"imports":{"@moorkyz/toolbar":"/vendor/index.js"}}</script>
    <script type="module" src="./app.js"></script>
  </head>
  <body>
    <main>
      <h1>Local toolbar starter</h1>
      <p>Host-owned actions; no accounts, remote services, or telemetry.</p>
      <p id="status" role="status">Ready</p>
    </main>
    <div id="toolbar"></div>
  </body>
</html>
`;

const SERVER = `import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
let sdkPath;
let port = 4173;
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const value = args[index + 1];
  if (value === undefined) throw new Error("Missing server option value.");
  if (flag === "--sdk-path") sdkPath = value;
  else if (flag === "--port" && /^\\d+$/.test(value)) port = Number(value);
  else throw new Error("Unknown server option.");
}
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid port.");
// Local source workflow bypasses installation, but requires a built SDK.
const vendor = await realpath(sdkPath
  ? resolve(sdkPath, "dist")
  : dirname(fileURLToPath(import.meta.resolve("@moorkyz/toolbar"))));
await stat(resolve(vendor, "index.js"));
const publicFiles = new Set(["index.html", "app.js", "toolbar.config.js", "style.css"]);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const isVendor = pathname.startsWith("/vendor/");
    const base = isVendor ? vendor : root;
    const name = isVendor ? pathname.slice(8) : pathname === "/" ? "index.html" : pathname.slice(1);
    if ((!isVendor && !publicFiles.has(name)) || (isVendor && ![".js", ".css"].includes(extname(name)))) throw new Error("Not public.");
    const file = await realpath(resolve(base, name));
    const inside = relative(base, file);
    if (isAbsolute(inside) || inside === ".." || inside.startsWith(".." + sep)) throw new Error("Outside root.");
    const content = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)], "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log("Starter: http://127.0.0.1:" + server.address().port);
});
`;

/** Pure-data generation only: no filesystem, network, callbacks, or package install. */
export async function generateProject(
  options: GeneratorOptions,
): Promise<GeneratorResult> {
  if (
    !isPortableData(options) ||
    Array.isArray(options) ||
    options === null ||
    typeof options !== "object" ||
    Object.keys(options).some((key) => !OPTION_KEYS.has(key)) ||
    typeof options.name !== "string" ||
    !NAME.test(options.name) ||
    RESERVED.test(options.name) ||
    (options.framework !== undefined && options.framework !== "vanilla") ||
    (options.origin !== undefined &&
      options.origin !== "cli" &&
      options.origin !== "studio") ||
    (options.preset !== undefined && !isGeneratorPreset(options.preset))
  ) {
    return {
      ok: false,
      error: {
        code: "GENERATOR_INVALID_OPTIONS",
        message:
          "Use a safe lowercase project name, supported preset, vanilla framework, and data-only options.",
      },
    };
  }
  const preset = options.preset ?? "universal";
  const validation = validateConfiguration(
    options.configuration === undefined ? {} : options.configuration,
  );
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: "GENERATOR_INVALID_CONFIGURATION",
        message: "Configuration failed the shared SDK schema.",
        diagnostics: validation.errors,
      },
    };
  }
  const configuration = {
    ...validation.value,
    actions:
      options.configuration !== undefined &&
      Object.hasOwn(options.configuration as object, "actions")
        ? validation.value.actions
        : PRESET_ACTIONS[preset],
  };
  const files: GeneratedFile[] = [
    {
      path: "package.json",
      content: json({
        name: options.name,
        version: "0.0.0",
        private: true,
        type: "module",
        scripts: { start: "node server.mjs" },
        dependencies: { "@moorkyz/toolbar": GENERATOR_SDK_VERSION },
      }),
    },
    { path: "index.html", content: HTML },
    { path: "app.js", content: APP },
    {
      path: "style.css",
      content:
        "body { margin: 0; font: 1rem system-ui, sans-serif; }\nmain { max-width: 60rem; margin: auto; padding: 2rem 1rem 10rem; }\n",
    },
    { path: "toolbar.config.json", content: json(configuration) },
    {
      path: "toolbar.config.js",
      content: `export default ${json(configuration).trimEnd()};\n`,
    },
    { path: "server.mjs", content: SERVER },
    {
      path: "README.md",
      content: `# ${options.name}\n\nValidated vanilla JavaScript starter (${preset} preset).\nRequires Node.js 22.18+ and a modern browser with import maps and ES modules.\n\n## Offline/local SDK\n\nBuild the SDK in its own checkout, then run:\n\n\`\`\`sh\nnode server.mjs --sdk-path /absolute/path/to/packages/toolbar\n\`\`\`\n\nNo install or network access is needed for that workflow. The server binds only to 127.0.0.1.\nFor an already installed SDK, run \`npm start\`. Generation does not install packages.\nIf using a package manager later, install the declared SDK dependency explicitly.\n\nEdit toolbar.config.js for runtime configuration; toolbar.config.json is the original\nportable CLI validation snapshot. Keep them in sync yourself after editing.\nReadable source belongs to you. Keep moorkyz.manifest.json to preview upgrades.\nPresets only supply demo actions: optional feature defaults are unchanged.\nEnabling an integration does not install or authorize a host adapter.\nThe supplied server is a local development helper, not a production deployment server.\nReact/Next.js/Vue/Angular templates are not yet validated or offered.\n`,
    },
  ];
  try {
    const integrity = Object.fromEntries(
      await Promise.all(
        files.map(async (file) => [
          file.path,
          await generatorIntegrity(file.content),
        ]),
      ),
    );
    const manifest: GeneratorManifest = {
      manifestVersion: "1.0",
      generatorVersion: GENERATOR_VERSION,
      templateVersion: GENERATOR_TEMPLATE_VERSION,
      sdkVersion: GENERATOR_SDK_VERSION,
      schemaVersion: CONFIGURATION_VERSION,
      origin: options.origin ?? "studio",
      project: { name: options.name, framework: "vanilla", preset },
      configuration,
      features: configuration.features,
      integrity,
      migration: {
        strategy: "review-and-explicit-apply",
        sourceOwnership: "developer",
      },
    };
    return {
      ok: true,
      value: {
        manifest,
        files: [
          ...files,
          { path: GENERATOR_MANIFEST, content: json(manifest) },
        ],
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "GENERATOR_INTEGRITY_UNAVAILABLE",
        message:
          "SHA-256 generation requires Web Crypto (a secure browser context or Node.js 22.18+).",
      },
    };
  }
}
