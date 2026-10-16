import assert from "node:assert/strict";
import { test } from "node:test";
import { createContextResolver } from "../dist/index.js";

test("resolves child context from root through each ancestor", () => {
  const contexts = createContextResolver({
    project: "default",
    theme: "light",
    density: "comfortable",
  });
  assert.equal(
    contexts.setScope(
      "app:project",
      { project: "alpha", density: "compact" },
      "host:root",
    ).ok,
    true,
  );
  assert.equal(
    contexts.setScope("app:panel", { theme: "dark" }, "app:project").ok,
    true,
  );

  const result = contexts.resolve("app:panel");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    { ...result.value.value },
    {
      project: "alpha",
      theme: "dark",
      density: "compact",
    },
  );
  assert.deepEqual(result.value.lineage, [
    "host:root",
    "app:project",
    "app:panel",
  ]);
  assert.equal(contexts.isCurrent(result.value.version), true);
});

test("rejects cycles and keeps the previous context revision intact", () => {
  const contexts = createContextResolver({ active: true });
  contexts.setScope("app:project", { active: false });
  contexts.setScope("app:panel", { active: true }, "app:project");
  const version = contexts.version;

  const cycle = contexts.setScope("app:project", { active: true }, "app:panel");
  assert.equal(cycle.ok, false);
  if (!cycle.ok) assert.equal(cycle.error.code, "CONTEXT_CYCLE");
  assert.equal(contexts.version, version);
  assert.equal(contexts.resolve("app:project").ok, true);
});

test("updates values atomically and protects the host root and parent scopes", () => {
  const contexts = createContextResolver({ feature: "off" });
  contexts.setScope("app:project", { feature: "on" });
  contexts.setScope("app:panel", { title: "Panel" }, "app:project");
  const before = contexts.resolve("app:panel");

  assert.equal(
    contexts.updateScope("app:project", { feature: "custom" }).ok,
    true,
  );
  assert.equal(contexts.removeScope("app:project").ok, false);
  assert.equal(contexts.removeScope("host:root").ok, false);
  const after = contexts.resolve("app:panel");

  assert.equal(before.ok, true);
  assert.equal(after.ok, true);
  if (before.ok && after.ok) {
    assert.equal(before.value.value.feature, "on");
    assert.equal(after.value.value.feature, "custom");
    assert.equal(contexts.isCurrent(before.value.version), false);
  }
});

test("rejects accessor values without invoking them", () => {
  const contexts = createContextResolver({ safe: true });
  let invoked = false;
  const patch = Object.defineProperty({}, "unsafe", {
    enumerable: true,
    get() {
      invoked = true;
      return true;
    },
  });

  const result = contexts.setScope("app:hostile", patch);
  assert.equal(result.ok, false);
  assert.equal(invoked, false);
  if (!result.ok) assert.equal(result.error.code, "CONTEXT_ACCESSOR_PROPERTY");
});

test("requires existing parents and removes only leaf scopes", () => {
  const contexts = createContextResolver({});
  const missing = contexts.setScope("app:child", {}, "app:missing");
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.error.code, "CONTEXT_PARENT_NOT_FOUND");
  }
  assert.equal(contexts.setScope("app:parent", {}).ok, true);
  assert.equal(contexts.setScope("app:child", {}, "app:parent").ok, true);
  assert.equal(contexts.removeScope("app:child").ok, true);
  assert.equal(contexts.removeScope("app:parent").ok, true);
  assert.equal(contexts.resolve("app:child").ok, false);
});
