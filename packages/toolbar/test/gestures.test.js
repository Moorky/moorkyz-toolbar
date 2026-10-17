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

test("scoped gestures recognize intent without suppressing browser input", (t) => {
  const window = new Window({ url: "http://localhost/" });
  t.after(() => window.close());
  const target = window.document.createElement("div");
  window.document.body.append(target);
  const received = [];
  const manager = createGestureManager(target, {
    enabled: true,
    onGesture: (intent) => received.push(intent),
  });
  t.after(() => manager.dispose());
  const emit = (type, x, y = 100, overrides = {}, element = target) => {
    const event = new window.PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
      ...overrides,
    });
    element.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  };
  emit("pointerdown", 200);
  emit("pointermove", 300);
  emit("pointerup", 300);
  assert.deepEqual(received, [
    { direction: "right", pointerType: "touch", distance: 100 },
  ]);
  emit("pointerdown", 300, 100, { pointerType: "pen" });
  emit("pointerup", 200, 100, { pointerType: "pen" });
  assert.equal(received[1].direction, "left");
  for (const start of [0, window.innerWidth - 1]) {
    emit("pointerdown", start);
    emit("pointerup", start + 100);
  }
  emit("pointerdown", 200);
  emit("pointermove", 210, 200);
  emit("pointerup", 300);
  emit("pointerdown", 200);
  emit("pointercancel", 200);
  emit("pointerup", 300);
  emit("pointerdown", 200, 100, { pointerType: "mouse" });
  emit("pointerup", 300);
  emit("pointerdown", 200);
  emit("pointerup", 220);
  const button = window.document.createElement("button");
  target.append(button);
  emit("pointerdown", 200, 100, {}, button);
  emit("pointerup", 300, 100, {}, button);
  const editable = window.document.createElement("span");
  editable.setAttribute("contenteditable", "true");
  target.append(editable);
  emit("pointerdown", 200, 100, {}, editable);
  emit("pointerup", 300, 100, {}, editable);
  assert.equal(received.length, 2);
  manager.setEnabled(false);
  emit("pointerdown", 200);
  emit("pointerup", 300);
  assert.equal(received.length, 2);
});

test("gesture constructor rejects missing targets and invalid host policies", (t) => {
  const window = new Window();
  t.after(() => window.close());
  assert.throws(
    () => createGestureManager(null, { enabled: true, onGesture() {} }),
    TypeError,
  );
  assert.throws(
    () => createGestureManager(window.document.body, null),
    TypeError,
  );
  assert.throws(
    () => createGestureManager(window.document.body, { enabled: "yes" }),
    TypeError,
  );
});
