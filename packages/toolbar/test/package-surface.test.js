import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

test("published-style exports include types, assets and isolated optional CLI without mandatory frameworks", async () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), []);
  for (const peer of Object.keys(manifest.peerDependencies)) {
    assert.equal(manifest.peerDependenciesMeta[peer].optional, true);
  }
  for (const [name, entry] of Object.entries(manifest.exports)) {
    assert.equal(typeof entry.types, "string", name);
    assert.equal(typeof entry.import, "string", name);
    await access(new URL(entry.types, root));
    await access(new URL(entry.import, root));
    const source = await readFile(new URL(entry.import, root), "utf8");
    const parsed = ts.createSourceFile(
      entry.import,
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.JS,
    );
    function verifyImports(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        assert.equal(
          node.moduleSpecifier.text.startsWith("node:"),
          false,
          name,
        );
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const specifier = node.arguments[0];
        if (specifier !== undefined && ts.isStringLiteralLike(specifier)) {
          assert.equal(specifier.text.startsWith("node:"), false, name);
        }
      }
      ts.forEachChild(node, verifyImports);
    }
    verifyImports(parsed);
  }
  await access(new URL("dist/toolbar.css", root));
  assert.match(
    await readFile(new URL("dist/LICENSE", root), "utf8"),
    /Apache License/,
  );
  assert.ok(manifest.files.includes("cli"));
  assert.match(
    await readFile(new URL(manifest.bin["moorkyz-toolbar"], root), "utf8"),
    /^#!\/usr\/bin\/env node/,
  );
  const { createTrustedExtensionRegistry } =
    await import("@moorkyz/toolbar/extensions");
  const { generateProject } = await import("@moorkyz/toolbar/generator");
  const { createDockInspector } = await import("@moorkyz/toolbar/inspector");
  assert.equal(typeof createTrustedExtensionRegistry, "function");
  assert.equal(typeof generateProject, "function");
  assert.equal(typeof createDockInspector, "function");
});
