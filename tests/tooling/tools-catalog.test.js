import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  TOOLS,
  findTool,
  formatToolDate,
} from "../../packages/portal/src/data/tools.ts";
import { createSourceZip } from "../../scripts/prepare-tool-sources.mjs";

test("tool registry has unique routable slugs and complete, honest detail metadata", () => {
  assert.equal(new Set(TOOLS.map((tool) => tool.slug)).size, TOOLS.length);
  assert.equal(findTool("missing"), undefined);
  assert.equal(findTool("__proto__"), undefined);
  for (const tool of TOOLS) {
    assert.match(tool.slug, /^[a-z][a-z0-9-]*$/);
    assert.equal(findTool(tool.slug), tool);
    for (const key of ["title", "summary", "description", "version"])
      assert.ok(tool[key].length > 0);
    assert.match(tool.updatedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(tool.useCases.length > 0);
    assert.ok(tool.setup.length > 0);
    assert.equal(tool.releaseDate, null);
  }
  assert.equal(formatToolDate("2026-10-23"), "October 23, 2026");
});

test("generated source downloads contain every allowlisted file and exact original ZIP bytes", async () => {
  const tool = findTool("videocrunch");
  const source = JSON.parse(
    await readFile(
      new URL(
        "../../packages/portal/public/tool-sources/videocrunch.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(Object.keys(source), tool.source.files);
  const archive = await readFile(
    new URL(
      "../../packages/portal/public/tool-sources/videocrunch.zip",
      import.meta.url,
    ),
  );
  let offset = 0;
  const names = [];
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    const size = archive.readUInt32LE(offset + 18);
    const nameSize = archive.readUInt16LE(offset + 26);
    const name = archive
      .subarray(offset + 30, offset + 30 + nameSize)
      .toString();
    names.push(name);
    assert.ok(!/node_modules|history\.json|test-results|\.git\//.test(name));
    const original = await readFile(
      new URL(`../../tools/videocrunch/${name}`, import.meta.url),
    );
    const bytes = archive.subarray(
      offset + 30 + nameSize,
      offset + 30 + nameSize + size,
    );
    assert.deepEqual(bytes, original, name);
    assert.equal(source[name], original.toString("utf8"), name);
    offset += 30 + nameSize + size;
  }
  assert.deepEqual(names, tool.source.files);
  assert.equal(archive.readUInt32LE(offset), 0x02014b50);
  assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
  assert.equal(archive.readUInt16LE(archive.length - 12), names.length);
});

test("source ZIP rejects escaping and malformed paths", () => {
  for (const name of [
    "../secret",
    "/absolute",
    "a/../../secret",
    "a\\secret",
    "a//b",
    "./file",
  ]) {
    assert.throws(
      () => createSourceZip([{ name, bytes: Buffer.from("source") }]),
      /Unsafe source path/,
    );
  }
});
