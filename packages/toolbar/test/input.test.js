import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { createShortcutManager } from "../dist/index.js";

function fixture(options = {}) {
  const window = new Window({ url: "http://localhost/" });
  const target = window.document.createElement("div");
  window.document.body.appendChild(target);
  const diagnostics = [];
  const errors = [];
  const manager = createShortcutManager(target, {
    getActiveScope: () => undefined,
    authorize: () => true,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    onError: (error, id) => errors.push([error, id]),
    ...options,
  });
  return { window, target, manager, diagnostics, errors };
}

function dispatch(window, target, key, modifiers = {}) {
  const event = new window.KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

test("shortcut manager attaches only after an authorized registration", (t) => {
  let authorized = false;
  const current = fixture({ authorize: () => authorized });
  t.after(() => current.window.close());

  const denied = current.manager.register({
    id: "app:search",
    key: "k",
    ctrlKey: true,
    execute: () => {},
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) {
    assert.equal(denied.error.code, "SHORTCUT_AUTHORIZATION_DENIED");
  }
  assert.equal(current.manager.size, 0);

  authorized = true;
  const approved = current.manager.register({
    id: "app:search",
    key: "k",
    ctrlKey: true,
    execute: () => {},
  });
  assert.equal(approved.ok, true);
  assert.equal(current.manager.size, 1);
  if (approved.ok) approved.value.unregister();
  assert.equal(current.manager.size, 0);
});

test("active scoped shortcuts win over global registrations", (t) => {
  const current = fixture({ getActiveScope: () => "app:search" });
  t.after(() => current.window.close());
  const called = [];
  const global = current.manager.register({
    id: "host:search",
    key: "k",
    ctrlKey: true,
    execute: () => called.push("global"),
  });
  const scoped = current.manager.register({
    id: "app:search",
    key: "k",
    ctrlKey: true,
    scope: "app:search",
    execute: () => called.push("scoped"),
  });
  assert.equal(global.ok, true);
  assert.equal(scoped.ok, true);

  const event = dispatch(current.window, current.target, "k", {
    ctrlKey: true,
  });
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(called, ["scoped"]);
});

test("equal-precedence conflicts are reported without choosing a winner", (t) => {
  const current = fixture({ getActiveScope: () => "app:editor" });
  t.after(() => current.window.close());
  let called = 0;
  current.manager.register({
    id: "app:first",
    key: "e",
    ctrlKey: true,
    scope: "app:editor",
    priority: 2,
    execute: () => called++,
  });
  current.manager.register({
    id: "app:second",
    key: "e",
    ctrlKey: true,
    scope: "app:editor",
    priority: 2,
    execute: () => called++,
  });

  const event = dispatch(current.window, current.target, "e", {
    ctrlKey: true,
  });
  assert.equal(event.defaultPrevented, false);
  assert.equal(called, 0);
  assert.deepEqual(current.diagnostics, [
    {
      code: "SHORTCUT_CONFLICT",
      shortcut: "ctrl+e",
      registrations: ["app:first", "app:second"],
    },
  ]);
});

test("preserves reserved browser shortcuts, unmodified input, and editable fields", (t) => {
  let called = 0;
  const current = fixture();
  t.after(() => current.window.close());
  const register = current.manager.register({
    id: "app:action",
    key: "w",
    ctrlKey: true,
    execute: () => called++,
  });
  assert.equal(register.ok, false);
  if (!register.ok) assert.equal(register.error.code, "SHORTCUT_RESERVED");

  const other = current.manager.register({
    id: "app:plain",
    key: "k",
    ctrlKey: true,
    execute: () => called++,
  });
  assert.equal(other.ok, true);

  const editable = current.window.document.createElement("input");
  current.target.appendChild(editable);
  const textEvent = dispatch(current.window, editable, "k", {
    ctrlKey: true,
  });
  assert.equal(textEvent.defaultPrevented, false);
  assert.equal(called, 0);

  const plainEvent = dispatch(current.window, current.target, "k");
  assert.equal(plainEvent.defaultPrevented, false);
  assert.equal(called, 0);
});

test("host authorization is rechecked for every key event and unregister cleans up", (t) => {
  let allowed = true;
  let called = 0;
  const current = fixture({ authorize: () => allowed });
  t.after(() => current.window.close());
  const result = current.manager.register({
    id: "app:search",
    key: "k",
    metaKey: true,
    execute: () => called++,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  allowed = false;
  const revoked = dispatch(current.window, current.target, "k", {
    metaKey: true,
  });
  assert.equal(revoked.defaultPrevented, false);
  assert.equal(called, 0);
  assert.equal(current.diagnostics[0]?.code, "SHORTCUT_REVOKED");

  result.value.unregister();
  allowed = true;
  const afterUnregister = dispatch(current.window, current.target, "k", {
    metaKey: true,
  });
  assert.equal(afterUnregister.defaultPrevented, false);
  assert.equal(called, 0);
  assert.equal(current.manager.size, 0);
});

test("surfaces async shortcut handler errors to the host", async (t) => {
  const current = fixture();
  t.after(() => current.window.close());
  const result = current.manager.register({
    id: "app:save",
    key: "k",
    ctrlKey: true,
    execute: async () => {
      throw new Error("save failed");
    },
  });
  assert.equal(result.ok, true);
  dispatch(current.window, current.target, "k", { ctrlKey: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(current.errors[0]?.[0].message, "save failed");
  assert.equal(current.errors[0]?.[1], "app:save");
});
