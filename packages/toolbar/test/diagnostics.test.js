import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalDiagnosticsRecorder } from "../dist/index.js";

function recorder(options = {}) {
  return createLocalDiagnosticsRecorder({
    redact: options.redact ?? ((_code, message) => message),
    capacity: options.capacity,
  });
}

test("disabled diagnostics do not inspect input or retain records", () => {
  const diagnostics = recorder();
  let invoked = false;
  const input = Object.defineProperty({}, "code", {
    enumerable: true,
    get() {
      invoked = true;
      return "TASK_FAILED";
    },
  });

  const result = diagnostics.record(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "DIAGNOSTICS_DISABLED");
  assert.equal(invoked, false);
  assert.deepEqual(diagnostics.snapshot(), []);
});

test("enabled diagnostics are redacted, bounded, ordered, and immutable", () => {
  const diagnostics = recorder({
    capacity: 2,
    redact: (_code, message) =>
      message.replace("secret=token", "secret=[redacted]"),
  });
  assert.deepEqual(diagnostics.setEnabled(true), { ok: true });

  const first = diagnostics.record({
    code: "TASK_FAILED",
    severity: "error",
    message: "secret=token",
  });
  diagnostics.record({
    code: "SEARCH_PARTIAL",
    severity: "warning",
    message: "One provider failed.",
  });
  diagnostics.record({
    code: "TASK_COMPLETE",
    severity: "info",
    message: "Task completed.",
  });

  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.value.message, "secret=[redacted]");
  const snapshot = diagnostics.snapshot();
  assert.deepEqual(
    snapshot.map(({ sequence, code }) => [sequence, code]),
    [
      [2, "SEARCH_PARTIAL"],
      [3, "TASK_COMPLETE"],
    ],
  );
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot[0]), true);
});

test("redaction failures and invalid redacted text are surfaced without recording", () => {
  const thrown = recorder({
    redact() {
      throw new Error("redactor failed");
    },
  });
  thrown.setEnabled(true);
  const thrownResult = thrown.record({
    code: "HOST_ERROR",
    severity: "error",
    message: "Sensitive detail",
  });
  assert.equal(thrownResult.ok, false);
  if (!thrownResult.ok) {
    assert.equal(thrownResult.error.code, "DIAGNOSTICS_REDACTION_FAILED");
  }
  assert.deepEqual(thrown.snapshot(), []);

  const invalid = recorder({ redact: () => "x".repeat(501) });
  invalid.setEnabled(true);
  const invalidResult = invalid.record({
    code: "HOST_ERROR",
    severity: "error",
    message: "Sensitive detail",
  });
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.error.code, "DIAGNOSTICS_REDACTION_FAILED");
  }
  assert.deepEqual(invalid.snapshot(), []);
});

test("rejects diagnostic accessors and unknown properties", () => {
  const diagnostics = recorder();
  diagnostics.setEnabled(true);
  let invoked = false;
  const input = Object.defineProperties(
    {
      severity: "warning",
      message: "Host warning",
    },
    {
      code: {
        enumerable: true,
        get() {
          invoked = true;
          return "HOST_WARNING";
        },
      },
    },
  );
  const accessor = diagnostics.record(input);
  assert.equal(accessor.ok, false);
  if (!accessor.ok) {
    assert.equal(accessor.error.code, "DIAGNOSTICS_ACCESSOR");
  }
  assert.equal(invoked, false);

  const unknown = diagnostics.record({
    code: "HOST_WARNING",
    severity: "warning",
    message: "Host warning",
    details: { user: "private" },
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.equal(unknown.error.code, "DIAGNOSTICS_UNKNOWN_PROPERTY");
  }
  assert.deepEqual(diagnostics.snapshot(), []);
});

test("disabling or disposing clears the in-memory diagnostics", () => {
  const diagnostics = recorder();
  diagnostics.setEnabled(true);
  diagnostics.record({
    code: "HOST_ERROR",
    severity: "error",
    message: "redacted",
  });
  assert.equal(diagnostics.snapshot().length, 1);

  assert.deepEqual(diagnostics.setEnabled(false), { ok: true });
  assert.deepEqual(diagnostics.snapshot(), []);
  const disabled = diagnostics.record({
    code: "HOST_ERROR",
    severity: "error",
    message: "not retained",
  });
  assert.equal(disabled.ok, false);

  diagnostics.setEnabled(true);
  diagnostics.record({
    code: "HOST_ERROR",
    severity: "error",
    message: "redacted",
  });
  diagnostics.dispose();
  assert.deepEqual(diagnostics.snapshot(), []);
  const disposed = diagnostics.record({
    code: "HOST_ERROR",
    severity: "error",
    message: "not retained",
  });
  assert.equal(disposed.ok, false);
  if (!disposed.ok) {
    assert.equal(disposed.error.code, "DIAGNOSTICS_DISPOSED");
  }
});

test("bounds recorder capacity and requires an explicit redactor", () => {
  assert.throws(() => createLocalDiagnosticsRecorder({}));
  assert.throws(() =>
    createLocalDiagnosticsRecorder({
      redact: (message) => message,
      capacity: 101,
    }),
  );
});
