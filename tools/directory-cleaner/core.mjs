import fs from "node:fs/promises";
import { constants, createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";

export class CleanerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalized(value) {
  const absolute = path.resolve(value);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

function within(parent, child) {
  const relative = path.relative(normalized(parent), normalized(child));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function localDirectory(value, name) {
  if (
    typeof value !== "string" ||
    !value ||
    !path.isAbsolute(value) ||
    value.startsWith("\\\\") ||
    value.startsWith("//") ||
    value.includes("\0")
  ) {
    throw new CleanerError(
      `${name} must be an absolute local folder, not a network path.`,
    );
  }
  const directory = path.resolve(value);
  if (
    normalized(directory) === normalized(path.parse(directory).root) ||
    normalized(directory) === normalized(os.homedir()) ||
    (process.env.SystemRoot && within(process.env.SystemRoot, directory))
  ) {
    throw new CleanerError(
      `${name} cannot be a filesystem root, home folder or Windows system folder.`,
    );
  }
  return directory;
}

async function noLinks(directory, allowMissing = false) {
  const parsed = path.parse(directory);
  let current = parsed.root;
  for (const part of directory
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (allowMissing && error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new CleanerError(
        `Unsafe folder (link or non-directory): ${current}`,
        409,
      );
  }
}

function dateBound(value, name) {
  if (value === undefined || value === "") return undefined;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new CleanerError(`${name} must be a real YYYY-MM-DD date (UTC).`);
  }
  return value;
}

function sizeBound(value, name) {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0)
    throw new CleanerError(
      `${name} must be a non-negative whole number of bytes.`,
    );
  return value;
}

export function validateConfiguration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new CleanerError("Expected cleaner settings.");
  if (
    Object.keys(input).some(
      (key) =>
        !["version", "sourceDir", "archiveDir", "recursive", "rules"].includes(
          key,
        ),
    ) ||
    input.version !== 1 ||
    typeof input.recursive !== "boolean" ||
    !Array.isArray(input.rules) ||
    input.rules.length === 0 ||
    input.rules.length > 100
  ) {
    throw new CleanerError(
      "Use version 1, a recursive boolean, and between 1 and 100 rules.",
    );
  }
  const sourceDir = localDirectory(input.sourceDir, "Source folder");
  const archiveDir = localDirectory(
    input.archiveDir || path.join(sourceDir, ".directory-cleaner-archive"),
    "Archive folder",
  );
  if (within(archiveDir, sourceDir))
    throw new CleanerError(
      "Archive folder must not equal or contain the source folder.",
    );
  const rules = input.rules.map((rule, index) => {
    const name = `Rule ${index + 1}`;
    if (
      !rule ||
      typeof rule !== "object" ||
      Array.isArray(rule) ||
      Object.keys(rule).some(
        (key) =>
          ![
            "action",
            "pattern",
            "destination",
            "createdBefore",
            "createdAfter",
            "smallerThanBytes",
            "largerThanBytes",
          ].includes(key),
      ) ||
      !["keep", "move", "archive"].includes(rule.action) ||
      typeof rule.pattern !== "string" ||
      rule.pattern.length === 0 ||
      rule.pattern.length > 256 ||
      /[\x00-\x1f]/.test(rule.pattern) ||
      rule.pattern.replaceAll("\\", "/").split("/").includes("..")
    ) {
      throw new CleanerError(
        `${name}: choose Keep, Move or Archive and a non-empty safe wildcard pattern.`,
      );
    }
    const destination =
      rule.action === "move"
        ? localDirectory(rule.destination, `${name} destination`)
        : undefined;
    if (destination && within(destination, sourceDir))
      throw new CleanerError(
        `${name}: move destination must not equal or contain the source.`,
      );
    const createdBefore = dateBound(
      rule.createdBefore,
      `${name} created before`,
    );
    const createdAfter = dateBound(rule.createdAfter, `${name} created after`);
    const smallerThanBytes = sizeBound(
      rule.smallerThanBytes,
      `${name} smaller than`,
    );
    const largerThanBytes = sizeBound(
      rule.largerThanBytes,
      `${name} larger than`,
    );
    if (createdBefore && createdAfter && createdBefore <= createdAfter)
      throw new CleanerError(
        `${name}: creation date bounds cannot overlap or be reversed.`,
      );
    if (
      smallerThanBytes !== undefined &&
      largerThanBytes !== undefined &&
      smallerThanBytes <= largerThanBytes
    )
      throw new CleanerError(
        `${name}: size bounds cannot overlap or be reversed.`,
      );
    return {
      action: rule.action,
      pattern: rule.pattern.replaceAll("\\", "/"),
      ...(destination ? { destination } : {}),
      ...(createdBefore ? { createdBefore } : {}),
      ...(createdAfter ? { createdAfter } : {}),
      ...(smallerThanBytes !== undefined ? { smallerThanBytes } : {}),
      ...(largerThanBytes !== undefined ? { largerThanBytes } : {}),
    };
  });
  return {
    version: 1,
    sourceDir,
    archiveDir,
    recursive: input.recursive,
    rules,
  };
}

function segmentMatches(pattern, text) {
  let previous = new Uint8Array(text.length + 1);
  previous[0] = 1;
  for (const character of pattern) {
    const next = new Uint8Array(text.length + 1);
    if (character === "*") next[0] = previous[0];
    for (let index = 1; index <= text.length; index++) {
      next[index] =
        character === "*"
          ? previous[index] || next[index - 1]
          : previous[index - 1] &&
              (character === "?" || character === text[index - 1])
            ? 1
            : 0;
    }
    previous = next;
  }
  return previous[text.length] === 1;
}

function wildcardMatches(pattern, candidate) {
  const parts = candidate.toLowerCase().split("/");
  let previous = new Uint8Array(parts.length + 1);
  previous[0] = 1;
  for (const segment of pattern.toLowerCase().split("/")) {
    const next = new Uint8Array(parts.length + 1);
    if (segment === "**") next[0] = previous[0];
    for (let index = 1; index <= parts.length; index++) {
      next[index] =
        segment === "**"
          ? previous[index] || next[index - 1]
          : previous[index - 1] && segmentMatches(segment, parts[index - 1])
            ? 1
            : 0;
    }
    previous = next;
  }
  return previous[parts.length] === 1;
}

export function matchesRule(rule, file) {
  const candidate = rule.pattern.includes("/")
    ? file.relativePath
    : path.basename(file.relativePath);
  return (
    wildcardMatches(rule.pattern, candidate) &&
    (!rule.createdBefore ||
      file.createdMs < Date.parse(`${rule.createdBefore}T00:00:00Z`)) &&
    (!rule.createdAfter ||
      file.createdMs > Date.parse(`${rule.createdAfter}T00:00:00Z`)) &&
    (rule.smallerThanBytes === undefined ||
      file.bytes < rule.smallerThanBytes) &&
    (rule.largerThanBytes === undefined || file.bytes > rule.largerThanBytes)
  );
}

function identity(stat) {
  return {
    bytes: stat.size,
    createdMs: stat.birthtimeMs,
    modifiedMs: stat.mtimeMs,
    device: stat.dev,
    inode: stat.ino,
  };
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function canonicalTarget(directory) {
  await noLinks(directory, true);
  let parent = directory;
  const missing = [];
  while (true) {
    try {
      return path.join(await fs.realpath(parent), ...missing.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const next = path.dirname(parent);
      if (next === parent) throw error;
      missing.push(path.basename(parent));
      parent = next;
    }
  }
}

export async function createPlan(input) {
  const initial = validateConfiguration(input);
  await noLinks(initial.sourceDir);
  const sourceDir = localDirectory(
    await fs.realpath(initial.sourceDir),
    "Source folder",
  );
  const archiveDir = await canonicalTarget(initial.archiveDir);
  const rules = await Promise.all(
    initial.rules.map(async (rule) =>
      rule.destination
        ? { ...rule, destination: await canonicalTarget(rule.destination) }
        : rule,
    ),
  );
  const configuration = validateConfiguration({
    ...initial,
    sourceDir,
    archiveDir,
    rules,
  });
  const excluded = [
    configuration.archiveDir,
    ...configuration.rules
      .filter((rule) => rule.action === "move")
      .map((rule) => rule.destination),
  ];
  const entries = [];
  const skipped = [];
  let visited = 0;
  async function walk(directory, depth = 0) {
    if (depth > 64)
      throw new CleanerError(
        "Folder depth exceeds 64. Choose a narrower source.",
      );
    await noLinks(directory);
    const children = await fs.readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const child of children) {
      if (++visited > 10000)
        throw new CleanerError(
          "Preview exceeds 10,000 entries. Choose a narrower source.",
        );
      const absolute = path.join(directory, child.name);
      const relativePath = path
        .relative(sourceDir, absolute)
        .split(path.sep)
        .join("/");
      if (excluded.some((target) => within(target, absolute))) {
        skipped.push({
          relativePath,
          reason: "Archive or move destination excluded",
        });
        continue;
      }
      const stat = await fs.lstat(absolute);
      if (stat.isSymbolicLink()) {
        skipped.push({ relativePath, reason: "Link/junction not followed" });
        continue;
      }
      if (stat.isDirectory()) {
        if (configuration.recursive) await walk(absolute, depth + 1);
        continue;
      }
      if (!stat.isFile()) {
        skipped.push({ relativePath, reason: "Not a regular file" });
        continue;
      }
      const file = { relativePath, ...identity(stat) };
      if (
        configuration.rules.some(
          (rule) =>
            (rule.createdBefore || rule.createdAfter) && stat.birthtimeMs <= 0,
        )
      ) {
        throw new CleanerError(
          `Creation time is unavailable: ${relativePath}. Remove date filters or use a supported filesystem.`,
        );
      }
      const rule =
        configuration.rules.find(
          (entry) => entry.action === "keep" && matchesRule(entry, file),
        ) ??
        configuration.rules.find(
          (entry) => entry.action !== "keep" && matchesRule(entry, file),
        );
      entries.push({
        ...file,
        action: rule?.action ?? "keep",
        reason: rule ? `Matches ${rule.pattern}` : "Unmatched; left untouched",
        ...(rule?.destination ? { destination: rule.destination } : {}),
      });
    }
  }
  await walk(sourceDir);
  return {
    version: 1,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    configuration: { ...configuration, sourceDir },
    entries,
    skipped,
  };
}

async function targetAbsent(target) {
  try {
    await fs.lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new CleanerError(
    `Destination already exists; nothing will be overwritten: ${target}`,
    409,
  );
}

async function movePreserving(source, target, expected) {
  await noLinks(path.dirname(source));
  await noLinks(path.dirname(target));
  const current = await fs.lstat(source);
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    digest(identity(current)) !== digest(expected)
  )
    throw new CleanerError(`Source changed: ${source}`, 409);
  try {
    await fs.link(source, target);
  } catch (error) {
    if (
      error.code !== "EXDEV" &&
      error.code !== "EPERM" &&
      error.code !== "ENOTSUP"
    )
      throw error;
    await fs.copyFile(source, target, constants.COPYFILE_EXCL);
    const [original, preserved] = await Promise.all([
      hashFile(source),
      hashFile(target),
    ]);
    if (original !== preserved)
      throw new CleanerError(
        `Copy verification failed; source retained: ${source}`,
        409,
      );
    await fs.utimes(target, current.atime, current.mtime);
  }
  const after = await fs.lstat(source);
  if (after.isSymbolicLink() || digest(identity(after)) !== digest(expected))
    throw new CleanerError(
      `Source changed during preservation; source and destination retained: ${source}`,
      409,
    );
  await fs.unlink(source);
}

export async function applyPlan(plan, confirmation) {
  if (
    !plan ||
    plan.version !== 1 ||
    typeof plan.id !== "string" ||
    !/^[0-9a-f-]{36}$/.test(plan.id) ||
    confirmation !== `APPLY ${plan.id}` ||
    !Array.isArray(plan.entries) ||
    !Array.isArray(plan.skipped)
  ) {
    throw new CleanerError(
      "Apply requires an intact preview and its exact APPLY confirmation.",
    );
  }
  const current = await createPlan(plan.configuration);
  if (
    digest(current.configuration) !== digest(plan.configuration) ||
    digest(current.entries) !== digest(plan.entries) ||
    digest(current.skipped) !== digest(plan.skipped)
  )
    throw new CleanerError(
      "Preview is stale or modified. Preview again before changing files.",
      409,
    );
  const actions = current.entries.filter((entry) => entry.action !== "keep");
  if (actions.length === 0)
    return {
      status: "completed",
      completed: [],
      failed: [],
      pending: 0,
      receiptPath: null,
    };
  const archiveRun = path.join(current.configuration.archiveDir, plan.id);
  await noLinks(archiveRun, true);
  await targetAbsent(archiveRun);
  const targets = actions.map((entry) => {
    const root =
      entry.action === "archive"
        ? path.join(archiveRun, "files")
        : entry.destination;
    const target = path.join(root, ...entry.relativePath.split("/"));
    if (!within(root, target))
      throw new CleanerError("Invalid relative path in preview.");
    return {
      entry,
      source: path.join(
        current.configuration.sourceDir,
        ...entry.relativePath.split("/"),
      ),
      target,
    };
  });
  const targetPaths = targets
    .map(({ target }) => normalized(target) + path.sep)
    .sort();
  if (
    targetPaths.some(
      (target, index) => index > 0 && target.startsWith(targetPaths[index - 1]),
    )
  ) {
    throw new CleanerError(
      "Move/archive destinations conflict. Choose separate output folders.",
      409,
    );
  }
  for (const { target } of targets) {
    await noLinks(path.dirname(target), true);
    await targetAbsent(target);
  }
  await fs.mkdir(archiveRun, { recursive: true });
  await noLinks(archiveRun);
  const receiptPath = path.join(archiveRun, "receipt.jsonl");
  const receipt = await fs.open(receiptPath, "wx");
  const completed = [];
  const failed = [];
  try {
    await receipt.writeFile(
      `${JSON.stringify({ version: 1, planId: plan.id, sourceDir: current.configuration.sourceDir, actions: targets.map(({ source, target, entry }) => ({ source, target, action: entry.action })) })}\n`,
    );
    await receipt.sync();
    for (const { entry, source, target } of targets) {
      try {
        await noLinks(path.dirname(target), true);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await movePreserving(source, target, {
          bytes: entry.bytes,
          createdMs: entry.createdMs,
          modifiedMs: entry.modifiedMs,
          device: entry.device,
          inode: entry.inode,
        });
        const record = {
          relativePath: entry.relativePath,
          action: entry.action,
          source,
          target,
        };
        await receipt.write(
          `${JSON.stringify({ status: "completed", ...record })}\n`,
        );
        await receipt.sync();
        completed.push(record);
      } catch (error) {
        failed.push({ relativePath: entry.relativePath, error: error.message });
        await receipt.write(
          `${JSON.stringify({ status: "failed", relativePath: entry.relativePath, error: error.message })}\n`,
        );
        await receipt.sync();
        break;
      }
    }
  } finally {
    await receipt.close();
  }
  return {
    status: failed.length
      ? completed.length
        ? "partial"
        : "failed"
      : "completed",
    completed,
    failed,
    pending: actions.length - completed.length - failed.length,
    receiptPath,
  };
}
