import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { createLifecycleCoordinator } from "../dist/index.js";

test("suspends and resumes idempotently across visibility and BFCache events", (t) => {
  const window = new Window({ url: "http://localhost/" });
  t.after(() => window.close());
  let visibility = "visible";
  Object.defineProperty(window.document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  const transitions = [];
  const lifecycle = createLifecycleCoordinator(window.document, {
    onSuspend: (reason) => transitions.push(`suspend:${reason}`),
    onResume: (reason) => transitions.push(`resume:${reason}`),
  });
  t.after(() => lifecycle.dispose());

  assert.equal(lifecycle.state, "active");
  visibility = "hidden";
  window.document.dispatchEvent(new window.Event("visibilitychange"));
  lifecycle.reconcile();
  window.dispatchEvent(new window.Event("pagehide"));
  assert.equal(lifecycle.state, "suspended");

  visibility = "visible";
  window.dispatchEvent(new window.Event("pageshow"));
  assert.equal(lifecycle.state, "active");
  assert.deepEqual(transitions, ["suspend:visibility", "resume:pageshow"]);

  window.dispatchEvent(new window.Event("pagehide"));
  assert.equal(lifecycle.state, "suspended");
  lifecycle.dispose();
  window.dispatchEvent(new window.Event("pageshow"));
  assert.equal(lifecycle.state, "disposed");
  assert.deepEqual(transitions, [
    "suspend:visibility",
    "resume:pageshow",
    "suspend:pagehide",
  ]);
});

test("respects hidden state during pageshow until the document becomes visible", (t) => {
  const window = new Window({ url: "http://localhost/" });
  t.after(() => window.close());
  let visibility = "visible";
  Object.defineProperty(window.document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  const transitions = [];
  const lifecycle = createLifecycleCoordinator(window.document, {
    onSuspend: (reason) => transitions.push(`suspend:${reason}`),
    onResume: (reason) => transitions.push(`resume:${reason}`),
  });
  t.after(() => lifecycle.dispose());

  window.dispatchEvent(new window.Event("pagehide"));
  visibility = "hidden";
  window.dispatchEvent(new window.Event("pageshow"));
  assert.equal(lifecycle.state, "suspended");
  assert.deepEqual(transitions, ["suspend:pagehide"]);

  visibility = "visible";
  window.document.dispatchEvent(new window.Event("visibilitychange"));
  assert.equal(lifecycle.state, "active");
  assert.deepEqual(transitions, ["suspend:pagehide", "resume:visibility"]);
});

test("does not install or retain lifecycle handlers after disposal", (t) => {
  const window = new Window({ url: "http://localhost/" });
  t.after(() => window.close());
  let resumes = 0;
  const lifecycle = createLifecycleCoordinator(window.document, {
    onSuspend: () => {},
    onResume: () => {
      resumes += 1;
    },
  });

  lifecycle.dispose();
  lifecycle.dispose();
  window.document.dispatchEvent(new window.Event("visibilitychange"));
  window.dispatchEvent(new window.Event("pageshow"));
  lifecycle.reconcile();
  assert.equal(lifecycle.state, "disposed");
  assert.equal(resumes, 0);
});
