#!/usr/bin/env node
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import {
  basename,
  dirname,
  isAbsolute,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  GENERATOR_MANIFEST,
  GENERATOR_PRESETS,
  GENERATOR_SDK_VERSION,
  GENERATOR_TEMPLATE_VERSION,
  GENERATOR_VERSION,
  generateProject,
  generatorIntegrity,
} from "../dist/generator.js";
import {
  CONFIGURATION_VERSION,
  validateConfiguration,
} from "../dist/configuration.js";

const HELP = `moorkyz-toolbar — optional, local-only consumer CLI

init <new-directory> [--name <name>] [--preset <preset>] [--config <file>]
add <existing-directory> [--directory <new-child>] [--name <name>] [--preset <preset>] [--config <file>]
validate <configuration.json>
doctor [directory]
upgrade <generated-directory> [--apply]
examples
version
help

All commands support --json and --non-interactive (no prompts are ever used).
init/add support --framework vanilla and --dry-run. upgrade previews by default,
supports --dry-run, and writes only with --apply. No installs, fetches, or host
project edits. add creates an isolated starter child, not a framework integration.
Destinations must remain inside the current directory; parent directories must
already exist. Existing destinations and symlinks are rejected. See consumer-cli.md.
`;

class CLIError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new CLIError(code, message, details);
}

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return (
    plain(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function parseArguments(argv) {
  const values = new Set([
    "name",
    "preset",
    "config",
    "directory",
    "framework",
  ]);
  const switches = new Set(["json", "dry-run", "apply", "non-interactive"]);
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const name = argument.slice(2);
    if (
      Object.hasOwn(options, name) ||
      (!values.has(name) && !switches.has(name))
    ) {
      fail("CLI_USAGE", "Unknown or duplicate option.");
    }
    if (switches.has(name)) options[name] = true;
    else {
      const value = argv[++index];
      if (value === undefined || value.startsWith("--"))
        fail("CLI_USAGE", "Missing option value.");
      options[name] = value;
    }
  }
  const command = positional.shift() ?? "help";
  const allowed = new Set(["json", "non-interactive"]);
  if (command === "init" || command === "add") {
    for (const option of ["name", "preset", "config", "framework", "dry-run"])
      allowed.add(option);
    if (command === "add") allowed.add("directory");
  }
  if (command === "upgrade") {
    allowed.add("apply");
    allowed.add("dry-run");
  }
  if (Object.keys(options).some((key) => !allowed.has(key)))
    fail("CLI_USAGE", "Option is not supported for this command.");
  if (options.apply && options["dry-run"])
    fail("CLI_USAGE", "--apply and --dry-run cannot be combined.");
  return { command, positional, options };
}

function leaf(name) {
  return (
    typeof name === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) &&
    !name.endsWith(".") &&
    !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)
  );
}

function inspect(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function assertNoLinks(path) {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const segment of absolute
    .slice(current.length)
    .split(sep)
    .filter(Boolean)) {
    current = resolve(current, segment);
    const entry = inspect(current);
    if (entry?.isSymbolicLink())
      fail("CLI_UNSAFE_PATH", "Symlink paths are not permitted.");
    if (entry && current !== absolute && !entry.isDirectory())
      fail("CLI_UNSAFE_PATH", "A parent is not a directory.");
  }
}

function scopedPath(cwd, input) {
  if (
    typeof input !== "string" ||
    input.includes("\0") ||
    input.split(/[\\/]/).includes("..") ||
    /[<>|"*?]/.test(input) ||
    input.slice(parse(input).root.length).includes(":") ||
    input
      .split(/[\\/]/)
      .some(
        (segment) =>
          segment !== "." &&
          (/[. ]$/.test(segment) ||
            /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(segment)),
      )
  ) {
    fail(
      "CLI_UNSAFE_PATH",
      "Use a local path without traversal or special path syntax.",
    );
  }
  const path = resolve(cwd, input);
  const inside = relative(cwd, path);
  if (isAbsolute(inside) || inside === ".." || inside.startsWith(`..${sep}`))
    fail("CLI_UNSAFE_PATH", "Path must remain inside the working directory.");
  assertNoLinks(path);
  return path;
}

function directory(path) {
  assertNoLinks(path);
  if (!inspect(path)?.isDirectory())
    fail(
      "CLI_DIRECTORY_REQUIRED",
      "An existing ordinary directory is required.",
    );
}

function readText(path) {
  assertNoLinks(path);
  const descriptor = openSync(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const stats = fstatSync(descriptor);
    if (!stats.isFile() || stats.nlink !== 1 || stats.size > 1_048_576) {
      fail(
        "CLI_UNSAFE_FILE",
        "Expected a regular, unlinked file no larger than 1 MiB.",
      );
    }
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        readFileSync(descriptor),
      );
    } catch {
      fail("CLI_UNSAFE_FILE", "Input must contain valid UTF-8 bytes.");
    }
  } finally {
    closeSync(descriptor);
  }
}

function readJSON(path) {
  const text = readText(path);
  try {
    return JSON.parse(text);
  } catch {
    fail(
      "CLI_INVALID_JSON",
      "Input is not valid JSON; no input contents have been printed.",
    );
  }
}

function exclusive(path, content) {
  assertNoLinks(dirname(path));
  const descriptor = openSync(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      (constants.O_NOFOLLOW ?? 0),
    0o644,
  );
  const identity = fstatSync(descriptor);
  let failure;
  try {
    writeFileSync(descriptor, content, "utf8");
  } catch (error) {
    failure = error;
  } finally {
    closeSync(descriptor);
  }
  if (failure) {
    if (sameFile(path, identity)) {
      const actual = readFileSync(path);
      const intended = Buffer.from(content, "utf8");
      if (
        actual.length <= intended.length &&
        actual.equals(intended.subarray(0, actual.length))
      ) {
        unlinkSync(path);
      }
    }
    throw failure;
  }
  return identity;
}

function sameFile(path, identity) {
  const current = inspect(path);
  return (
    current?.isFile() &&
    current.ino === identity.ino &&
    current.dev === identity.dev &&
    !current.isSymbolicLink()
  );
}

function preflightDestination(destination, files) {
  assertNoLinks(destination);
  directory(dirname(destination));
  if (inspect(destination))
    fail(
      "CLI_DESTINATION_EXISTS",
      "Destination already exists; nothing was overwritten.",
    );
  const names = new Set();
  for (const file of files) {
    if (
      !leaf(file.path) ||
      names.has(file.path.toLowerCase()) ||
      typeof file.content !== "string"
    )
      fail(
        "CLI_UNSAFE_PATH",
        "Generated paths must be unique portable filenames.",
      );
    names.add(file.path.toLowerCase());
  }
}

/** All writes are preflighted and exclusive; failed cleanup never removes foreign files. */
export function writeProject(destination, files) {
  preflightDestination(destination, files);
  const created = [];
  let madeRoot = false;
  try {
    mkdirSync(destination);
    madeRoot = true;
    for (const file of files) {
      assertNoLinks(destination);
      const path = resolve(destination, file.path);
      const identity = exclusive(path, file.content);
      created.push({ path, identity, content: file.content });
    }
  } catch (error) {
    for (const file of created.reverse()) {
      if (
        sameFile(file.path, file.identity) &&
        readText(file.path) === file.content
      )
        unlinkSync(file.path);
    }
    if (madeRoot) {
      try {
        rmdirSync(destination);
      } catch {
        /* Keep foreign/concurrently edited files. */
      }
    }
    throw error;
  }
}

function olderOrEqual(value, current) {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) return false;
  const before = value.split(".").map(Number);
  const after = current.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (before[index] !== after[index]) return before[index] < after[index];
  }
  return true;
}

async function loadProject(root) {
  directory(root);
  const manifestPath = resolve(root, GENERATOR_MANIFEST);
  const manifestText = readText(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    fail("CLI_INVALID_MANIFEST", "Manifest is not valid JSON.");
  }
  if (
    !exactKeys(manifest, [
      "manifestVersion",
      "generatorVersion",
      "templateVersion",
      "sdkVersion",
      "schemaVersion",
      "origin",
      "project",
      "configuration",
      "features",
      "integrity",
      "migration",
    ]) ||
    manifest.manifestVersion !== "1.0" ||
    manifest.schemaVersion !== CONFIGURATION_VERSION ||
    !olderOrEqual(manifest.generatorVersion, GENERATOR_VERSION) ||
    !olderOrEqual(manifest.templateVersion, GENERATOR_TEMPLATE_VERSION) ||
    !olderOrEqual(manifest.sdkVersion, GENERATOR_SDK_VERSION) ||
    !exactKeys(manifest.project, ["name", "framework", "preset"]) ||
    !exactKeys(manifest.migration, ["strategy", "sourceOwnership"]) ||
    manifest.migration.strategy !== "review-and-explicit-apply" ||
    manifest.migration.sourceOwnership !== "developer" ||
    !plain(manifest.integrity)
  ) {
    fail(
      "CLI_INVALID_MANIFEST",
      "Manifest is unsupported or malformed; no migration was attempted.",
    );
  }
  const generated = await generateProject({
    ...manifest.project,
    configuration: manifest.configuration,
    origin: manifest.origin,
  });
  if (!generated.ok)
    fail(
      "CLI_INVALID_MANIFEST",
      "Manifest configuration or project metadata is invalid.",
    );
  const expected = generated.value.files.filter(
    (file) => file.path !== GENERATOR_MANIFEST,
  );
  if (
    !exactKeys(
      manifest.integrity,
      expected.map((file) => file.path),
    ) ||
    Object.values(manifest.integrity).some(
      (hash) => typeof hash !== "string" || !/^sha256-[a-f0-9]{64}$/.test(hash),
    ) ||
    !exactKeys(
      manifest.features,
      Object.keys(generated.value.manifest.features),
    ) ||
    Object.entries(generated.value.manifest.features).some(
      ([name, value]) => manifest.features[name] !== value,
    )
  ) {
    fail(
      "CLI_INVALID_MANIFEST",
      "Manifest integrity paths or feature flags are invalid.",
    );
  }
  const originals = new Map([[GENERATOR_MANIFEST, manifestText]]);
  const conflicts = [];
  for (const file of expected) {
    const path = resolve(root, file.path);
    if (!inspect(path)) {
      conflicts.push({ path: file.path, reason: "missing" });
      continue;
    }
    const content = readText(path);
    originals.set(file.path, content);
    if ((await generatorIntegrity(content)) !== manifest.integrity[file.path]) {
      conflicts.push({ path: file.path, reason: "user-modified" });
    }
  }
  const changes = generated.value.files
    .filter((file) => originals.get(file.path) !== file.content)
    .map((file) => ({
      path: file.path,
      kind: "replace",
      // Never print user-modified source; conflict paths alone are enough.
      diff: conflicts.some((conflict) => conflict.path === file.path)
        ? undefined
        : `--- ${file.path}\n+++ ${file.path}\n@@ full file @@\n${(
            originals.get(file.path) ?? ""
          )
            .trimEnd()
            .split("\n")
            .map((line) => `-${line}`)
            .join("\n")}\n${file.content
            .trimEnd()
            .split("\n")
            .map((line) => `+${line}`)
            .join("\n")}\n`,
    }));
  return { project: generated.value, originals, conflicts, changes };
}

async function applyUpgrade(root, plan) {
  if (plan.conflicts.length)
    fail(
      "CLI_UPGRADE_CONFLICT",
      "Edited or missing files prevent applying this upgrade.",
      { conflicts: plan.conflicts },
    );
  if (plan.changes.length === 0) return undefined;
  // Recheck the entire input set immediately before staging, including the manifest.
  for (const [name, content] of plan.originals) {
    if (readText(resolve(root, name)) !== content)
      fail(
        "CLI_UPGRADE_CONFLICT",
        "A project file changed after preview; nothing was applied.",
      );
  }
  const backupName = `.moorkyz-upgrade-${randomUUID()}`;
  const backup = resolve(root, backupName);
  assertNoLinks(root);
  mkdirSync(backup);
  const moves = [];
  try {
    for (const [index, change] of plan.changes.entries()) {
      const file = plan.project.files.find(
        (candidate) => candidate.path === change.path,
      );
      exclusive(resolve(backup, `new-${index}`), file.content);
    }
    for (const [index, change] of plan.changes.entries()) {
      const target = resolve(root, change.path);
      assertNoLinks(target);
      if (readText(target) !== plan.originals.get(change.path))
        fail("CLI_UPGRADE_CONFLICT", "A source changed during apply.");
      const old = resolve(backup, `old-${index}`);
      renameSync(target, old);
      const move = { target, old };
      moves.push(move);
      if (readText(old) !== plan.originals.get(change.path))
        fail("CLI_UPGRADE_CONFLICT", "A source changed during apply.");
      // link is exclusive: a newly created destination is never clobbered.
      linkSync(resolve(backup, `new-${index}`), target);
      move.identity = lstatSync(target);
      unlinkSync(resolve(backup, `new-${index}`));
    }
    return backupName;
  } catch (error) {
    for (const move of moves.reverse()) {
      if (move.identity && sameFile(move.target, move.identity)) {
        const replacement = plan.project.files.find(
          (file) => file.path === basename(move.target),
        );
        if (readFileSync(move.target, "utf8") === replacement.content)
          unlinkSync(move.target);
      }
      if (!inspect(move.target)) {
        linkSync(move.old, move.target);
        unlinkSync(move.old);
      }
    }
    fail(
      "CLI_UPGRADE_ABORTED",
      "Upgrade stopped; originals were restored where safe. Retain the backup directory for recovery.",
      {
        backup: backupName,
        reason: error instanceof CLIError ? error.code : "CLI_IO_ERROR",
      },
    );
  }
}

function arity(positional, minimum, maximum = minimum) {
  if (positional.length < minimum || positional.length > maximum)
    fail("CLI_USAGE", "Wrong number of command arguments; use help.");
}

async function execute(argv, cwd) {
  const { command, positional, options } = parseArguments(argv);
  if (command === "help") {
    arity(positional, 0);
    return { command, help: HELP };
  }
  if (command === "version") {
    arity(positional, 0);
    return {
      command,
      generatorVersion: GENERATOR_VERSION,
      sdkVersion: GENERATOR_SDK_VERSION,
      templateVersion: GENERATOR_TEMPLATE_VERSION,
      schemaVersion: CONFIGURATION_VERSION,
    };
  }
  if (command === "examples") {
    arity(positional, 0);
    return {
      command,
      frameworks: ["vanilla"],
      presets: GENERATOR_PRESETS,
      note: "Presets change demo actions only, never optional feature defaults.",
    };
  }
  if (command === "validate") {
    arity(positional, 1);
    const result = validateConfiguration(
      readJSON(scopedPath(cwd, positional[0])),
    );
    if (!result.ok)
      fail(
        "CLI_INVALID_CONFIGURATION",
        "Configuration failed the shared SDK schema.",
        { diagnostics: result.errors },
      );
    return { command, configuration: result.value };
  }
  if (command === "init" || command === "add") {
    arity(positional, 1);
    let destination = scopedPath(cwd, positional[0]);
    if (command === "add") {
      directory(destination);
      const child = options.directory ?? "toolbar-starter";
      if (!leaf(child))
        fail(
          "CLI_UNSAFE_PATH",
          "--directory must be a single portable directory name.",
        );
      destination = scopedPath(cwd, resolve(destination, child));
    }
    const result = await generateProject({
      name: options.name ?? basename(destination),
      preset: options.preset ?? "universal",
      framework: options.framework ?? "vanilla",
      origin: "cli",
      ...(options.config
        ? { configuration: readJSON(scopedPath(cwd, options.config)) }
        : {}),
    });
    if (!result.ok)
      fail(
        result.error.code,
        result.error.message,
        result.error.diagnostics
          ? { diagnostics: result.error.diagnostics }
          : undefined,
      );
    preflightDestination(destination, result.value.files);
    if (!options["dry-run"]) writeProject(destination, result.value.files);
    return {
      command,
      dryRun: !!options["dry-run"],
      destination: relative(cwd, destination),
      files: result.value.files.map(({ path }) => path),
      manifest: result.value.manifest,
      next: "Run node server.mjs --sdk-path <built-local-sdk> inside the new directory. No packages were installed.",
    };
  }
  if (command === "upgrade") {
    arity(positional, 1);
    const root = scopedPath(cwd, positional[0]);
    const plan = await loadProject(root);
    if (options.apply && plan.conflicts.length)
      fail(
        "CLI_UPGRADE_CONFLICT",
        "Edited or missing files prevent applying this upgrade.",
        { conflicts: plan.conflicts },
      );
    const backup = options.apply ? await applyUpgrade(root, plan) : undefined;
    return {
      command,
      dryRun: !options.apply,
      applied: !!options.apply && plan.changes.length > 0,
      changes: plan.changes,
      conflicts: plan.conflicts,
      ...(backup ? { backup } : {}),
    };
  }
  if (command === "doctor") {
    arity(positional, 0, 1);
    const root = scopedPath(cwd, positional[0] ?? ".");
    directory(root);
    const nodeVersion = process.versions.node.split(".").map(Number);
    const nodeSupported =
      nodeVersion[0] > 22 || (nodeVersion[0] === 22 && nodeVersion[1] >= 18);
    const sdkBuilt = existsSync(
      fileURLToPath(new URL("../dist/index.js", import.meta.url)),
    );
    const hasManifest = !!inspect(resolve(root, GENERATOR_MANIFEST));
    const plan = hasManifest ? await loadProject(root) : undefined;
    if (!nodeSupported || !sdkBuilt || plan?.conflicts.length) {
      fail(
        "CLI_DOCTOR_FAILED",
        "Local checks failed; no network requests or installs were attempted.",
        {
          nodeSupported,
          sdkBuilt,
          conflicts: plan?.conflicts ?? [],
        },
      );
    }
    return {
      command,
      nodeSupported,
      sdkBuilt,
      manifest: hasManifest ? "valid" : "not-present",
      network: "not-used",
      note: "Local structural checks only; not a production, accessibility, or host-authorization certification.",
    };
  }
  fail("CLI_USAGE", "Unknown command; use help.");
}

/** Returns an exit status; stdout contains exactly one result in JSON mode. */
export async function runCLI(argv, io = {}) {
  const cwd = resolve(io.cwd ?? process.cwd());
  const out = io.out ?? ((text) => process.stdout.write(text));
  const err = io.err ?? ((text) => process.stderr.write(text));
  const args = argv.map((argument) =>
    argument === "--help"
      ? "help"
      : argument === "--version"
        ? "version"
        : argument,
  );
  const structured = args.includes("--json");
  try {
    const value = await execute(args, cwd);
    out(
      structured
        ? `${JSON.stringify({ ok: true, ...value })}\n`
        : (value.help ??
            `${JSON.stringify({ ok: true, ...value }, null, 2)}\n`),
    );
    return 0;
  } catch (error) {
    const code =
      error instanceof CLIError
        ? error.code
        : error.code === "EEXIST"
          ? "CLI_DESTINATION_EXISTS"
          : error.code === "ENOENT"
            ? "CLI_NOT_FOUND"
            : "CLI_IO_ERROR";
    const result = {
      ok: false,
      error: {
        code,
        message:
          error instanceof CLIError
            ? error.message
            : "Local operation failed; no input contents have been printed.",
        ...(error instanceof CLIError && error.details
          ? { details: error.details }
          : {}),
      },
    };
    if (structured) out(`${JSON.stringify(result)}\n`);
    else err(`${result.error.code}: ${result.error.message}\n`);
    return code === "CLI_USAGE" ? 2 : 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await runCLI(process.argv.slice(2));
}
