import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  GENERATOR_MANIFEST,
  GENERATOR_PRESETS,
  GENERATOR_SDK_VERSION,
  generateProject,
  generatorIntegrity,
} from "../dist/generator.js";
import {
  FEATURE_DEFAULTS,
  validateConfiguration,
} from "../dist/configuration.js";

test("all presets produce deterministic portable vanilla projects without enabling optional flags", async () => {
  for (const preset of GENERATOR_PRESETS) {
    const result = await generateProject({ name: "local-starter", preset });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const { files, manifest } = result.value;
    assert.deepEqual(manifest.features, FEATURE_DEFAULTS);
    assert.equal(manifest.project.preset, preset);
    assert.equal(manifest.project.framework, "vanilla");
    assert.equal(manifest.origin, "studio");
    assert.equal(manifest.schemaVersion, "1.0");
    assert.equal(manifest.sdkVersion, GENERATOR_SDK_VERSION);
    assert.equal(manifest.generatorVersion, "1.0.0");
    assert.equal(manifest.templateVersion, "1.0.0");
    assert.equal(manifest.migration.sourceOwnership, "developer");
    assert.equal(validateConfiguration(manifest.configuration).ok, true);
    assert.deepEqual(
      await generateProject({ name: "local-starter", preset }),
      result,
    );
    assert.equal(files.length, new Set(files.map(({ path }) => path)).size);
    assert.deepEqual(
      JSON.parse(files.find(({ path }) => path === GENERATOR_MANIFEST).content),
      manifest,
    );
    for (const file of files.filter(
      ({ path }) => path !== GENERATOR_MANIFEST,
    )) {
      assert.match(file.path, /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
      assert.equal(
        manifest.integrity[file.path],
        `sha256-${createHash("sha256").update(file.content, "utf8").digest("hex")}`,
      );
    }
    const packageFile = JSON.parse(
      files.find(({ path }) => path === "package.json").content,
    );
    assert.deepEqual(packageFile.dependencies, {
      "@moorkyz/toolbar": GENERATOR_SDK_VERSION,
    });
    assert.deepEqual(packageFile.scripts, { start: "node server.mjs" });
    assert.match(
      files.find(({ path }) => path === "server.mjs").content,
      /127\.0\.0\.1/,
    );
  }
});

test("uses the shared validator and preserves explicit flags and empty actions", async () => {
  const configuration = {
    features: { ai: true, spatialCoordination: false, offline: true },
    actions: [],
    theme: "midnight",
    label: 'Unicode λ and "</script>" remain data',
  };
  const result = await generateProject({
    name: "custom",
    preset: "game",
    origin: "cli",
    configuration,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.value.manifest.configuration,
    validateConfiguration(configuration).value,
  );
  assert.equal(result.value.manifest.origin, "cli");
  assert.equal(result.value.manifest.features.spatialCoordination, false);
  assert.equal(result.value.manifest.features.offline, true);
  assert.deepEqual(result.value.manifest.configuration.actions, []);
  assert.match(
    result.value.files.find(({ path }) => path === "index.html").content,
    /type="module" src="\.\/app\.js"/,
  );
  assert.doesNotMatch(
    result.value.files.find(({ path }) => path === "index.html").content,
    /Unicode|<\/script>" remain/,
  );
});

test("rejects invalid config, unsupported frameworks/presets and dangerous project names", async () => {
  for (const configuration of [
    null,
    [],
    { features: { ai: "yes" } },
    { schemaVersion: "999" },
    { credentials: { token: "secret-marker" } },
  ]) {
    const result = await generateProject({ name: "invalid", configuration });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "GENERATOR_INVALID_CONFIGURATION");
    assert.doesNotMatch(JSON.stringify(result), /secret-marker/);
  }
  for (const name of [
    "..",
    "../outside",
    "folder\\child",
    "/root",
    "CON",
    "con",
    "aux",
    "nul",
    "com1",
    "name.",
    "-name",
    "Uppercase",
    "x".repeat(64),
  ]) {
    assert.equal((await generateProject({ name })).ok, false, name);
  }
  for (const options of [
    { framework: "react" },
    { preset: "unvalidated" },
    { origin: "https://example.com/?token=secret-marker" },
    { token: "secret-marker" },
  ]) {
    const result = await generateProject({ name: "invalid", ...options });
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /secret-marker/);
  }
});

test("never calls accessors, toJSON, callbacks, or serializes non-portable values", async () => {
  let invoked = 0;
  const getter = Object.defineProperty({}, "configuration", {
    enumerable: true,
    get() {
      invoked += 1;
      return {};
    },
  });
  Object.defineProperty(getter, "name", { enumerable: true, value: "unsafe" });
  const cycle = {};
  cycle.self = cycle;
  const configurations = [
    {
      callback() {
        invoked += 1;
      },
    },
    {
      toJSON() {
        invoked += 1;
        return {};
      },
    },
    Object.defineProperty({}, "label", {
      enumerable: true,
      get() {
        invoked += 1;
        return "unsafe";
      },
    }),
    { label: undefined },
    { label: BigInt(1) },
    { label: Symbol("secret") },
    { label: new Date() },
    { [Symbol("hidden")]: "secret" },
    Object.defineProperty({}, "hidden", { value: "secret" }),
    cycle,
  ];
  assert.equal((await generateProject(getter)).ok, false);
  for (const configuration of configurations) {
    assert.equal(
      (await generateProject({ name: "unsafe", configuration })).ok,
      false,
    );
  }
  assert.equal(invoked, 0);
});

test("SHA-256 is exact for UTF-8 and generation reports unavailable crypto safely", async () => {
  assert.equal(
    await generatorIntegrity("λ\r\n"),
    `sha256-${createHash("sha256").update("λ\r\n").digest("hex")}`,
  );
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });
    const result = await generateProject({ name: "no-crypto" });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "GENERATOR_INTEGRITY_UNAVAILABLE");
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});
