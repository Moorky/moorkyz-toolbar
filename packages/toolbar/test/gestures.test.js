import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { createGestureManager } from "../dist/index.js";

test("installs scoped pointer listeners only when explicitly enabled", (t) => {
  const window = new Window({ url: "http://localhost/" });
  t.after(() => window.close());
  const target = window.document.createElement("div");
  const originalAdd = target.addEventListener.bind(target);
  const originalRemove = target.removeEventListener.bind(target);
  let additions = 0;
  let removals = 0;
  target.addEventListener = (type, ...args) => {
    if (type.startsWith("pointer")) additions += 1;
    return originalAdd(type, ...args);
  };
  target.removeEventListener = (type, ...args) => {
    if (type.startsWith("pointer")) removals += 1;
    return originalRemove(type, ...args);
  };

  const manager = createGestureManager(target, {
    enabled: false,
    onGesture: () => {},
  });
  assert.equal(manager.enabled, false);
  assert.equal(additions, 0);

  manager.setEnabled(true);
  assert.equal(additions, 4);
  manager.setEnabled(false);
  assert.equal(removals, 4);
  manager.dispose();
  manager.dispose();
  assert.equal(removals, 4);
  assert.equal(manager.enabled, false);
});
