import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const cases = {
  configuration: 'export { validateConfiguration } from "@moorkyz/toolbar";',
  dock: 'export { createToolbar } from "@moorkyz/toolbar";',
  search:
    'export { createFederatedSearchCoordinator } from "@moorkyz/toolbar";',
  ai: 'export { createHostAuthorizedAIAdapter } from "@moorkyz/toolbar";',
  inspector:
    'export { createDockInspector } from "@moorkyz/toolbar/inspector";',
  generator: 'export { generateProject } from "@moorkyz/toolbar/generator";',
};
const measurements = [];
for (const [name, contents] of Object.entries(cases)) {
  const result = await build({
    stdin: {
      contents,
      resolveDir: fileURLToPath(new URL("../packages/portal", import.meta.url)),
    },
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    metafile: true,
    logLevel: "silent",
  });
  const output = result.outputFiles[0].contents;
  const inputs = [
    ...new Set(
      Object.values(result.metafile.outputs).flatMap((output) =>
        Object.entries(output.inputs)
          .filter(([, contribution]) => contribution.bytesInOutput > 0)
          .map(([path]) => path),
      ),
    ),
  ];
  assert.ok(
    !inputs.some((path) =>
      /node_modules[\\/](?:next|react|@angular|vue)[\\/]|[\\/]cli[\\/]|cli\.(?:ts|mjs)$/.test(
        path,
      ),
    ),
    `${name}: browser isolation`,
  );
  if (name === "configuration") {
    assert.ok(
      !inputs.some((path) =>
        /(?:toolbar|search|ai|diagnostics)\.(?:ts|js)$/.test(path),
      ),
      "Configuration-only consumer must tree-shake optional/runtime modules.",
    );
  }
  measurements.push({
    name,
    minifiedBytes: output.length,
    gzipBytes: gzipSync(output, { level: 9 }).length,
    inputs,
  });
}
console.log(
  JSON.stringify(
    {
      method:
        "esbuild minified ES2022 ESM; gzip level 9; baseline only, budgets require approval",
      measurements,
    },
    null,
    2,
  ),
);
