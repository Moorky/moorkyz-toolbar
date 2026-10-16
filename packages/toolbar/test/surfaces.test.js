import assert from "node:assert/strict";
import { test } from "node:test";
import { createSurfaceStack } from "../dist/index.js";

test("bounds and nests named surfaces with deterministic snapshots", () => {
  const stack = createSurfaceStack({ maxDepth: 2 });
  const root = stack.open({
    id: "app:settings",
    kind: "panel",
    returnFocusTo: "settings-button",
  });
  assert.equal(root.ok, true);

  const child = stack.open({
    id: "app:confirm",
    kind: "dialog",
    parentId: "app:settings",
  });
  assert.equal(child.ok, true);
  if (child.ok) {
    assert.deepEqual(
      child.value.entries.map(({ id, parentId }) => [id, parentId]),
      [
        ["app:settings", null],
        ["app:confirm", "app:settings"],
      ],
    );
  }

  const overflow = stack.open({
    id: "app:deep",
    kind: "popover",
    parentId: "app:confirm",
  });
  assert.equal(overflow.ok, false);
  if (!overflow.ok) assert.equal(overflow.error.code, "SURFACE_DEPTH_LIMIT");
});

test("closes only the top surface and returns its focus restoration target", () => {
  const stack = createSurfaceStack();
  stack.open({
    id: "app:panel",
    kind: "panel",
    returnFocusTo: "panel-trigger",
  });
  stack.open({
    id: "app:dialog",
    kind: "dialog",
    parentId: "app:panel",
    returnFocusTo: "dialog-trigger",
  });

  const blocked = stack.close("app:panel", "host");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error.code, "SURFACE_NOT_TOP");

  const closed = stack.dismissTop("escape");
  assert.equal(closed.ok, true);
  if (closed.ok) {
    assert.equal(closed.value.closed.id, "app:dialog");
    assert.equal(closed.value.restoreFocusTo, "dialog-trigger");
    assert.equal(closed.value.snapshot.entries.length, 1);
  }
});

test("honors dismissal policy while allowing explicit host cleanup", () => {
  const stack = createSurfaceStack();
  stack.open({
    id: "app:busy",
    kind: "dialog",
    dismissible: false,
  });

  const escaped = stack.dismissTop("escape");
  assert.equal(escaped.ok, false);
  if (!escaped.ok) assert.equal(escaped.error.code, "SURFACE_NOT_DISMISSIBLE");

  const closed = stack.close("app:busy", "host");
  assert.equal(closed.ok, true);
  assert.equal(stack.snapshot().entries.length, 0);
});

test("rejects invalid hierarchy without changing stack version", () => {
  const stack = createSurfaceStack();
  const version = stack.snapshot().version;
  const invalid = stack.open({
    id: "app:child",
    kind: "popover",
    parentId: "app:missing",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "SURFACE_INVALID_PARENT");
  assert.equal(stack.snapshot().version, version);
});
