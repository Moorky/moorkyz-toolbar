import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: ["packages/portal/src/components/playground-design.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
});
const model = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`
);
const {
  INITIAL_DESIGN,
  STYLES,
  APPLICATIONS,
  applyStyle,
  defaultActions,
  validateDesign,
  parseDesign,
  presentationCSS,
  sdkConfiguration,
  generateDesignProject,
} = model;

test("four applications and ten structural presets validate without granting optional SDK work", () => {
  assert.equal(APPLICATIONS.length, 4);
  assert.equal(STYLES.length, 10);
  const structures = new Set();
  for (const { id } of STYLES) {
    const design = applyStyle(INITIAL_DESIGN, id);
    assert.equal(validateDesign(design).ok, true, id);
    structures.add(presentationCSS(design, "#toolbar", "light"));
    assert.equal(
      Object.values(sdkConfiguration(design, "light").features).some(Boolean),
      false,
    );
  }
  assert.equal(structures.size, 10);
  for (const { id } of APPLICATIONS) assert.equal(defaultActions(id).length, 3);
});

test("design boundaries reject escalation, CSS injection, inaccessible labels and invalid geometry", () => {
  for (const patch of [
    { version: 99 },
    { capabilities: ["admin"] },
    { geometry: { ...INITIAL_DESIGN.geometry, offsetY: -1 } },
    { geometry: { ...INITIAL_DESIGN.geometry, height: 20 } },
    { geometry: { ...INITIAL_DESIGN.geometry, width: 319 } },
    {
      appearance: {
        ...INITIAL_DESIGN.appearance,
        light: {
          ...INITIAL_DESIGN.appearance.light,
          background: "url(https://invalid.test)",
        },
      },
    },
    {
      appearance: {
        ...INITIAL_DESIGN.appearance,
        dark: { ...INITIAL_DESIGN.appearance.dark, foreground: "#20162E" },
      },
    },
    { actions: [{ ...INITIAL_DESIGN.actions[0], command: "delete-host" }] },
    { actions: [{ ...INITIAL_DESIGN.actions[0], id: 'bad"]{}' }] },
    {
      actions: [
        { ...INITIAL_DESIGN.actions[0], accessibleName: "Unrelated name" },
      ],
    },
    { actions: [INITIAL_DESIGN.actions[0], INITIAL_DESIGN.actions[0]] },
  ])
    assert.equal(validateDesign({ ...INITIAL_DESIGN, ...patch }).ok, false);
  assert.equal(parseDesign("{").ok, false);
  assert.equal(parseDesign(" ".repeat(65537)).ok, false);
  assert.equal(parseDesign(JSON.stringify(INITIAL_DESIGN)).ok, true);
});

test("legacy explicit drafts migrate without changing host authority or mutating input", () => {
  const old = {
    version: 1,
    configuration: {
      renderMode: "light",
      placement: { mode: "container" },
      features: Object.fromEntries(
        Object.keys(sdkConfiguration(INITIAL_DESIGN, "light").features).map(
          (key) => [key, false],
        ),
      ),
      actions: [{ id: "add-task", label: "Recovered" }],
    },
  };
  const result = parseDesign(JSON.stringify(old));
  assert.equal(result.ok, true);
  assert.equal(result.value.actions[0].label, "Recovered");
  assert.equal(result.value.actions[0].command, "add-task");
  assert.equal(parseDesign(JSON.stringify({ ...old, version: 999 })).ok, false);
});

test("presentation and generated integration preserve geometry, theme and exact file integrity", async () => {
  const design = {
    ...applyStyle(INITIAL_DESIGN, "faceted"),
    geometry: { ...INITIAL_DESIGN.geometry, offsetY: 0, width: 700 },
  };
  const project = await generateDesignProject(design, "dark");
  assert.equal(project.manifest.configuration.colorScheme, "dark");
  assert.match(
    project.files.find(({ path }) => path === "style.css").content,
    /max\(0px/,
  );
  assert.match(
    project.files.find(({ path }) => path === "app.js").content,
    /present\(target\)/,
  );
  assert.doesNotMatch(
    project.files.find(({ path }) => path === "app.js").content,
    /from "\.\/presentation\.js"|from "\.\/playground\.design\.js"/,
  );
  for (const file of project.files.filter(
    ({ path }) => path !== "moorkyz.manifest.json",
  )) {
    assert.equal(
      project.manifest.integrity[file.path],
      `sha256-${createHash("sha256").update(file.content).digest("hex")}`,
    );
  }
  assert.deepEqual(
    JSON.parse(
      project.files.find(({ path }) => path === "playground.design.json")
        .content,
    ),
    design,
  );
});
