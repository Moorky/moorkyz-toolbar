"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const repoRoot = path.resolve(__dirname, "../..");
const cli = path.join(repoRoot, "moorkyz.cjs");
const fixtures = [];

function fixture() {
  const folder = mkdtempSync(path.join(os.tmpdir(), "moorkyz-cli-"));
  fixtures.push(folder);
  return folder;
}

function run(folder, args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: folder,
    encoding: "utf8",
    timeout: 10000,
  });
}

after(() => {
  for (const folder of fixtures.splice(0)) {
    const relative = path.relative(os.tmpdir(), folder);
    if (!relative.startsWith("moorkyz-cli-")) {
      throw new Error(`Refusing to remove unexpected fixture path: ${folder}`);
    }
    rmSync(folder, { recursive: true, force: true });
  }
});

test("help works without package scaffolding", () => {
  const result = run(fixture(), ["help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Moorkyz — reusable project development CLI/);
  assert.match(result.stdout, /moorkyz audit/);
});

test("audit writes a task report and preserves replacement-like title text", () => {
  const folder = fixture();
  const audits = path.join(folder, "docs", "audits");
  mkdirSync(audits, { recursive: true });
  writeFileSync(
    path.join(audits, "TEMPLATE.md"),
    "# {{TASK_NAME}}\n\nCreated: {{DATE_UTC}}\nID: {{AUDIT_ID}}\n",
  );
  const title = "$& and {{DATE_UTC}}";
  const result = run(folder, ["audit", title]);
  assert.equal(result.status, 0, result.stderr);

  const report = readdirSync(audits).find((name) => name !== "TEMPLATE.md");
  assert.ok(report, "expected a generated audit report");
  const contents = readFileSync(path.join(audits, report), "utf8");
  assert.ok(contents.startsWith(`# ${title}\n`));
  assert.match(contents, /Created: \d{4}-\d\d-\d\dT/);
  assert.match(contents, /ID: \d{4}-\d\d-\d\dT/);
});

test("rejects a project path that escapes the repository", () => {
  const folder = fixture();
  const outside = fixture();
  writeFileSync(
    path.join(folder, "moorkyz.config.json"),
    JSON.stringify({ projects: { escape: { cwd: outside } } }),
  );
  const result = run(folder, ["list"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Configured project path escapes repository/);
});
