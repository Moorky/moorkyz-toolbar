import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { Window } from "happy-dom";
import { runCLI, writeProject } from "../cli/moorkyz-toolbar.mjs";
import { GENERATOR_MANIFEST, generatorIntegrity } from "../dist/generator.js";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const sdk = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(
  new URL("../cli/moorkyz-toolbar.mjs", import.meta.url),
);

function fixture(t) {
  const root = join(repository, ".moorkyz", `m9-cli-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

async function invoke(cwd, args) {
  let stdout = "";
  let stderr = "";
  const code = await runCLI([...args, "--json", "--non-interactive"], {
    cwd,
    out: (text) => {
      stdout += text;
    },
    err: (text) => {
      stderr += text;
    },
  });
  assert.equal(stderr, "");
  assert.equal(stdout.trim().split("\n").length, 1);
  return { code, value: JSON.parse(stdout) };
}

function snapshot(root) {
  const result = {};
  for (const name of readdirSync(root, { withFileTypes: true })) {
    if (name.isDirectory()) result[name.name] = snapshot(join(root, name.name));
    else result[name.name] = readFileSync(join(root, name.name), "utf8");
  }
  return result;
}

async function init(cwd, name = "starter") {
  const result = await invoke(cwd, ["init", name]);
  assert.equal(result.code, 0, JSON.stringify(result.value));
  return join(cwd, name);
}

function ageManifest(root) {
  const path = join(root, GENERATOR_MANIFEST);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.generatorVersion = "0.9.0";
  manifest.templateVersion = "0.9.0";
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

test("help, version, examples and actual executable have stable structured output", async (t) => {
  const cwd = fixture(t);
  for (const command of [
    "help",
    "version",
    "examples",
    "--help",
    "--version",
  ]) {
    const result = await invoke(cwd, [command]);
    assert.equal(result.code, 0);
    assert.equal(result.value.ok, true);
  }
  assert.deepEqual((await invoke(cwd, ["examples"])).value.frameworks, [
    "vanilla",
  ]);
  const result = spawnSync(process.execPath, [cli, "version", "--json"], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).generatorVersion, "1.0.0");
  const help = spawnSync(process.execPath, [cli], { cwd, encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /init <new-directory>/);
});

test("usage failures are noninteractive and return exit 2, including command-specific flags", async (t) => {
  const cwd = fixture(t);
  for (const args of [
    ["unknown"],
    ["init"],
    ["init", "one", "two"],
    ["version", "--apply"],
    ["init", "one", "--preset"],
    ["init", "one", "--preset", "game", "--preset", "game"],
    ["init", "one", "--wat"],
    ["upgrade", ".", "--apply", "--dry-run"],
    ["doctor", "--dry-run"],
    ["init", "one", "--directory", "two"],
  ]) {
    const result = await invoke(cwd, args);
    assert.equal(result.code, 2, args.join(" "));
    assert.equal(result.value.error.code, "CLI_USAGE");
  }
  assert.deepEqual(readdirSync(cwd), []);
});

test("init and add dry runs preflight without creating any files; add preserves host files", async (t) => {
  const cwd = fixture(t);
  const preview = await invoke(cwd, [
    "init",
    "starter",
    "--preset",
    "dashboard",
    "--dry-run",
  ]);
  assert.equal(preview.code, 0);
  assert.equal(preview.value.dryRun, true);
  assert.deepEqual(readdirSync(cwd), []);
  writeFileSync(
    join(cwd, "package.json"),
    '{"name":"host","scripts":{"keep":"untouched"}}\n',
  );
  const host = readFileSync(join(cwd, "package.json"), "utf8");
  const dryAdd = await invoke(cwd, ["add", ".", "--dry-run"]);
  assert.equal(dryAdd.code, 0);
  assert.deepEqual(readdirSync(cwd), ["package.json"]);
  const added = await invoke(cwd, [
    "add",
    ".",
    "--directory",
    "toolbar-demo",
    "--preset",
    "game",
  ]);
  assert.equal(added.code, 0);
  assert.equal(readFileSync(join(cwd, "package.json"), "utf8"), host);
  assert.equal(existsSync(join(cwd, "toolbar-demo", "node_modules")), false);
  assert.equal(
    existsSync(join(cwd, "toolbar-demo", "package-lock.json")),
    false,
  );
});

test("preexisting files, directories and late duplicate writes are never overwritten", async (t) => {
  const cwd = fixture(t);
  const root = await init(cwd);
  const before = snapshot(root);
  for (const args of [
    ["init", "starter"],
    ["init", "starter", "--dry-run"],
    ["add", ".", "--directory", "starter"],
  ]) {
    const result = await invoke(cwd, args);
    assert.equal(result.code, 1);
    assert.equal(result.value.error.code, "CLI_DESTINATION_EXISTS");
  }
  assert.deepEqual(snapshot(root), before);
  writeFileSync(join(cwd, "occupied"), "developer content");
  assert.equal((await invoke(cwd, ["init", "occupied"])).code, 1);
  assert.equal(
    readFileSync(join(cwd, "occupied"), "utf8"),
    "developer content",
  );
  for (const files of [
    [{ path: "../escape", content: "bad" }],
    [
      { path: "safe", content: "one" },
      { path: "SAFE", content: "two" },
    ],
    [{ path: "aux.txt", content: "bad" }],
  ]) {
    assert.throws(() => writeProject(join(cwd, "unsafe"), files), /portable/);
    assert.equal(existsSync(join(cwd, "unsafe")), false);
  }
});

test("traversal, out-of-scope, alternate stream, missing parent and unsafe child paths fail before writes", async (t) => {
  const cwd = fixture(t);
  for (const path of [
    "../escape",
    "nested/../../escape",
    "nested\\..\\escape",
    "safe:stream",
    resolve(cwd, "safe:stream"),
    "trailing.",
    "trailing ",
    "bad?name",
    dirname(cwd),
  ]) {
    const result = await invoke(cwd, ["init", path]);
    assert.equal(result.code, 1, path);
    assert.equal(result.value.error.code, "CLI_UNSAFE_PATH");
  }
  assert.equal(
    (await invoke(cwd, ["init", "absent/child"])).value.error.code,
    "CLI_DIRECTORY_REQUIRED",
  );
  for (const child of [
    "../escape",
    "folder/name",
    "folder\\name",
    "nul",
    "aux.txt",
  ]) {
    assert.equal(
      (await invoke(cwd, ["add", ".", "--directory", child])).value.error.code,
      "CLI_UNSAFE_PATH",
    );
  }
  assert.deepEqual(readdirSync(cwd), []);
});

test("failed exclusive writes remove only their own partial files and preserve foreign collisions", (t) => {
  const cwd = fixture(t);
  const original = fs.writeFileSync;
  try {
    fs.writeFileSync = (path, content, ...options) => {
      if (content === "second") {
        original(path, "sec", ...options);
        throw new Error("Injected disk failure");
      }
      return original(path, content, ...options);
    };
    syncBuiltinESMExports();
    assert.throws(
      () =>
        writeProject(join(cwd, "partial"), [
          { path: "one.js", content: "first" },
          { path: "two.js", content: "second" },
        ]),
      /Injected disk failure/,
    );
    assert.equal(existsSync(join(cwd, "partial")), false);
  } finally {
    fs.writeFileSync = original;
    syncBuiltinESMExports();
  }
  try {
    fs.writeFileSync = (path, content, ...options) => {
      const result = original(path, content, ...options);
      if (content === "first")
        original(join(cwd, "collision", "two.js"), "foreign");
      return result;
    };
    syncBuiltinESMExports();
    assert.throws(
      () =>
        writeProject(join(cwd, "collision"), [
          { path: "one.js", content: "first" },
          { path: "two.js", content: "second" },
        ]),
      { code: "EEXIST" },
    );
    assert.equal(existsSync(join(cwd, "collision", "one.js")), false);
    assert.equal(
      readFileSync(join(cwd, "collision", "two.js"), "utf8"),
      "foreign",
    );
  } finally {
    fs.writeFileSync = original;
    syncBuiltinESMExports();
  }
});

test("hard-linked and non-UTF-8 configuration inputs fail closed", async (t) => {
  const cwd = fixture(t);
  writeFileSync(join(cwd, "config.json"), "{}");
  linkSync(join(cwd, "config.json"), join(cwd, "alias.json"));
  assert.equal(
    (await invoke(cwd, ["validate", "alias.json"])).value.error.code,
    "CLI_UNSAFE_FILE",
  );
  writeFileSync(join(cwd, "invalid.json"), Buffer.from([0xff]));
  assert.equal(
    (await invoke(cwd, ["validate", "invalid.json"])).value.error.code,
    "CLI_UNSAFE_FILE",
  );
});

test("directory symlinks, destination symlinks and symlinked manifest/source paths fail closed", async (t) => {
  const cwd = fixture(t);
  const real = join(cwd, "real");
  mkdirSync(real);
  const alias = join(cwd, "alias");
  try {
    symlinkSync(real, alias, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error.code === "EPERM")
      return t.skip("Host does not permit symlink fixtures.");
    throw error;
  }
  for (const args of [
    ["init", "alias"],
    ["init", "alias/child"],
    ["add", "alias"],
    ["doctor", "alias"],
  ]) {
    assert.equal((await invoke(cwd, args)).value.error.code, "CLI_UNSAFE_PATH");
  }
  const root = await init(cwd);
  const manifestPath = join(root, GENERATOR_MANIFEST);
  const manifestContent = readFileSync(manifestPath, "utf8");
  rmSync(manifestPath);
  symlinkSync(
    real,
    manifestPath,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(
    (await invoke(cwd, ["upgrade", "starter", "--apply"])).value.error.code,
    "CLI_UNSAFE_PATH",
  );
  rmSync(manifestPath, { recursive: true });
  writeFileSync(manifestPath, manifestContent);
  rmSync(join(root, "app.js"));
  symlinkSync(
    real,
    join(root, "app.js"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(
    (await invoke(cwd, ["upgrade", "starter"])).value.error.code,
    "CLI_UNSAFE_PATH",
  );
  assert.deepEqual(readdirSync(real), []);
});

test("shared validation rejects malformed JSON, secrets, callbacks-as-keys and invalid flags without leaking data", async (t) => {
  const cwd = fixture(t);
  for (const content of [
    '{ "token": "do-not-print"',
    '{"token":"do-not-print"}',
    '{"features":{"ai":"do-not-print"}}',
    '{"dispatchAction":"do-not-print"}',
    "null",
  ]) {
    writeFileSync(join(cwd, "bad.json"), content);
    for (const args of [
      ["validate", "bad.json"],
      ["init", "starter", "--config", "bad.json"],
    ]) {
      const result = await invoke(cwd, args);
      assert.equal(result.code, 1);
      assert.doesNotMatch(JSON.stringify(result), /do-not-print/);
      assert.equal(existsSync(join(cwd, "starter")), false);
    }
  }
  writeFileSync(
    join(cwd, "good.json"),
    '{"features":{"offline":true,"spatialCoordination":false},"actions":[]}',
  );
  const result = await invoke(cwd, ["validate", "good.json"]);
  assert.equal(result.code, 0);
  assert.equal(result.value.configuration.features.offline, true);
  assert.equal(
    (await invoke(cwd, ["init", "valid", "--config", "good.json"])).code,
    0,
  );
  assert.equal(
    (await invoke(cwd, ["init", "react", "--framework", "react"])).code,
    1,
  );
});

test("doctor is local-only and upgrade is a read-only preview until explicit apply", async (t) => {
  const cwd = fixture(t);
  assert.equal((await invoke(cwd, ["doctor"])).code, 0);
  const root = await init(cwd);
  assert.equal(
    (await invoke(cwd, ["doctor", "starter"])).value.manifest,
    "valid",
  );
  const current = await invoke(cwd, ["upgrade", "starter"]);
  assert.equal(current.code, 0);
  assert.deepEqual(current.value.changes, []);
  assert.equal(
    (await invoke(cwd, ["upgrade", "starter", "--apply"])).value.applied,
    false,
  );
  ageManifest(root);
  const before = snapshot(root);
  const preview = await invoke(cwd, ["upgrade", "starter"]);
  assert.equal(preview.code, 0);
  assert.equal(preview.value.dryRun, true);
  assert.equal(preview.value.changes.length, 1);
  assert.match(
    preview.value.changes[0].diff,
    /-"templateVersion": "0.9.0"|\-" {2}"templateVersion": "0.9.0"|\-  "templateVersion": "0.9.0"/,
  );
  assert.deepEqual(snapshot(root), before);
  assert.equal(
    (await invoke(cwd, ["upgrade", "starter", "--dry-run"])).value.applied,
    false,
  );
  const applied = await invoke(cwd, ["upgrade", "starter", "--apply"]);
  assert.equal(applied.code, 0, JSON.stringify(applied.value));
  assert.equal(applied.value.applied, true);
  assert.equal(
    JSON.parse(readFileSync(join(root, GENERATOR_MANIFEST), "utf8"))
      .templateVersion,
    "1.0.0",
  );
  assert.equal(
    readFileSync(join(root, applied.value.backup, "old-0"), "utf8"),
    before[GENERATOR_MANIFEST],
  );
  assert.equal((await invoke(cwd, ["doctor", "starter"])).code, 0);
});

test("upgrades preserve edited and missing developer-owned files, including whitespace-only edits", async (t) => {
  const cwd = fixture(t);
  const root = await init(cwd);
  ageManifest(root);
  writeFileSync(join(root, "app.js"), "// do-not-print: developer secret\n");
  writeFileSync(
    join(root, "style.css"),
    `${readFileSync(join(root, "style.css"), "utf8")} \n`,
  );
  rmSync(join(root, "README.md"));
  const before = snapshot(root);
  const preview = await invoke(cwd, ["upgrade", "starter"]);
  assert.equal(preview.code, 0);
  assert.equal(preview.value.conflicts.length, 3);
  assert.doesNotMatch(JSON.stringify(preview), /do-not-print/);
  const applied = await invoke(cwd, ["upgrade", "starter", "--apply"]);
  assert.equal(applied.code, 1);
  assert.equal(applied.value.error.code, "CLI_UPGRADE_CONFLICT");
  assert.equal((await invoke(cwd, ["doctor", "starter"])).code, 1);
  assert.deepEqual(snapshot(root), before);
});

test("an SDK source upgrade updates pristine package metadata and rolls back safely on injected apply failure", async (t) => {
  const cwd = fixture(t);
  const root = await init(cwd);
  const manifestPath = join(root, GENERATOR_MANIFEST);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const packagePath = join(root, "package.json");
  const packageFile = JSON.parse(readFileSync(packagePath, "utf8"));
  packageFile.dependencies["@moorkyz/toolbar"] = "0.0.9";
  const oldPackage = `${JSON.stringify(packageFile, null, 2)}\n`;
  writeFileSync(packagePath, oldPackage);
  manifest.sdkVersion = "0.0.9";
  manifest.integrity["package.json"] = await generatorIntegrity(oldPackage);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const oldManifest = readFileSync(manifestPath, "utf8");
  const preview = await invoke(cwd, ["upgrade", "starter"]);
  assert.deepEqual(
    preview.value.changes.map(({ path }) => path),
    ["package.json", GENERATOR_MANIFEST],
  );
  const original = fs.linkSync;
  let calls = 0;
  try {
    fs.linkSync = (...args) => {
      calls += 1;
      if (calls === 2) throw new Error("Injected apply collision");
      return original(...args);
    };
    syncBuiltinESMExports();
    const failed = await invoke(cwd, ["upgrade", "starter", "--apply"]);
    assert.equal(failed.code, 1);
    assert.equal(failed.value.error.code, "CLI_UPGRADE_ABORTED");
    assert.equal(readFileSync(packagePath, "utf8"), oldPackage);
    assert.equal(readFileSync(manifestPath, "utf8"), oldManifest);
    assert.equal(
      existsSync(join(root, failed.value.error.details.backup)),
      true,
    );
  } finally {
    fs.linkSync = original;
    syncBuiltinESMExports();
  }
  const applied = await invoke(cwd, ["upgrade", "starter", "--apply"]);
  assert.equal(applied.code, 0);
  assert.equal(
    JSON.parse(readFileSync(packagePath, "utf8")).dependencies[
      "@moorkyz/toolbar"
    ],
    "0.1.0",
  );
  assert.equal((await invoke(cwd, ["doctor", "starter"])).code, 0);
});

test("manifest tampering, traversal and unsupported future versions are rejected without writes", async (t) => {
  const cwd = fixture(t);
  const root = await init(cwd);
  const original = readFileSync(join(root, GENERATOR_MANIFEST), "utf8");
  for (const mutate of [
    (manifest) => {
      manifest.integrity["../outside"] = "sha256-" + "a".repeat(64);
    },
    (manifest) => {
      manifest.integrity["app.js"] = "not-a-hash";
    },
    (manifest) => {
      delete manifest.integrity["app.js"];
    },
    (manifest) => {
      manifest.sdkVersion = "999.0.0";
    },
    (manifest) => {
      manifest.schemaVersion = "999";
    },
    (manifest) => {
      manifest.features.ai = true;
    },
    (manifest) => {
      manifest.configuration.token = "do-not-print";
    },
    (manifest) => {
      manifest.project.framework = "react";
    },
    (manifest) => {
      manifest.origin = "remote";
    },
    (manifest) => {
      manifest.migration.sourceOwnership = "generator";
    },
  ]) {
    const manifest = JSON.parse(original);
    mutate(manifest);
    writeFileSync(join(root, GENERATOR_MANIFEST), JSON.stringify(manifest));
    const before = snapshot(root);
    const result = await invoke(cwd, ["upgrade", "starter", "--apply"]);
    assert.equal(result.code, 1);
    assert.equal(result.value.error.code, "CLI_INVALID_MANIFEST");
    assert.doesNotMatch(JSON.stringify(result), /do-not-print/);
    assert.deepEqual(snapshot(root), before);
  }
});

test("generated vanilla starter runs over HTTP with a built local SDK, mounts, dispatches and disposes", async (t) => {
  const cwd = fixture(t);
  const root = await init(cwd);
  const server = spawn(
    process.execPath,
    ["server.mjs", "--sdk-path", sdk, "--port", "0"],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    const url = await new Promise((done, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Starter readiness timeout")),
        10_000,
      );
      server.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Starter exited ${code}`));
      });
      server.stderr.once("data", (chunk) => {
        clearTimeout(timer);
        reject(new Error(String(chunk)));
      });
      server.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timer);
          done(match[0]);
        }
      });
    });
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(`${url}/vendor/index.js`)).status, 200);
    assert.equal((await fetch(`${url}/vendor/toolbar.css`)).status, 200);
    assert.equal((await fetch(`${url}/package.json`)).status, 404);
    assert.equal(
      (await fetch(`${url}/vendor/%2e%2e%2fpackage.json`)).status,
      404,
    );
    assert.equal((await fetch(`${url}/`, { method: "POST" })).status, 405);
    const html = await (await fetch(url)).text();
    assert.match(html, /type="importmap"/);
    mkdirSync(join(root, "node_modules", "@moorkyz"), { recursive: true });
    symlinkSync(
      sdk,
      join(root, "node_modules", "@moorkyz", "toolbar"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const { mountStarter } = await import(
      pathToFileURL(resolve(root, "app.js")).href
    );
    const window = new Window();
    try {
      window.document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
      const toolbar = mountStarter(window.document);
      assert.equal(toolbar.isMounted, true);
      const buttons = window.document
        .querySelector("#toolbar")
        .firstElementChild.shadowRoot.querySelectorAll("button");
      const welcome = [...buttons].find((button) =>
        button.textContent.includes("Welcome"),
      );
      assert.ok(welcome);
      welcome.click();
      await new Promise((done) => setTimeout(done, 0));
      assert.equal(
        window.document.querySelector("#status").textContent,
        "Selected: welcome",
      );
      toolbar.dispose();
      assert.equal(toolbar.isMounted, false);
      assert.equal(
        window.document.querySelector("#toolbar").childElementCount,
        0,
      );
    } finally {
      await window.happyDOM.close();
    }
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((done) => server.once("exit", done));
      server.kill();
      await exited;
    }
  }
});
