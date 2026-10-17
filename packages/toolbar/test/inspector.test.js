import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { createDockInspector } from "../dist/inspector.js";
import { createLocalDiagnosticsRecorder } from "../dist/diagnostics.js";

test("inspector allocates no UI until enabled and displays only redacted text", () => {
  const window = new Window();
  const target = window.document.body;
  const recorder = createLocalDiagnosticsRecorder({
    redact: () => "<img src=x> redacted",
  });
  const inspector = createDockInspector(target, recorder);
  assert.equal(target.children.length, 0);
  recorder.setEnabled(true);
  recorder.record({
    code: "HOST_FAILURE",
    severity: "error",
    message: "secret",
  });
  inspector.setEnabled(true);
  assert.equal(target.querySelector("img"), null);
  assert.match(target.textContent, /redacted/);
  assert.doesNotMatch(target.textContent, /secret/);
  inspector.setEnabled(false);
  assert.equal(target.children.length, 0);
  inspector.refresh();
  inspector.dispose();
  assert.throws(() => inspector.setEnabled(true), /disposed/);
  recorder.dispose();
  window.close();
});
