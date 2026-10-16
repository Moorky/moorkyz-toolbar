import assert from "node:assert/strict";
import { test } from "node:test";
import { TASK_STATUSES, validateTaskSnapshot } from "../dist/index.js";

test("normalizes bounded host task snapshots into immutable data", () => {
  assert.equal(Object.isFrozen(TASK_STATUSES), true);
  const input = [
    { id: "build", label: "Build project", status: "running" },
    { id: "test", label: "Run tests", status: "queued" },
    Object.assign(Object.create(null), {
      id: "deploy",
      label: "Deploy preview",
      status: "completed",
    }),
  ];

  const result = validateTaskSnapshot(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.value.map(({ id, label, status }) => [id, label, status]),
    [
      ["build", "Build project", "running"],
      ["test", "Run tests", "queued"],
      ["deploy", "Deploy preview", "completed"],
    ],
  );
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value[0]), true);
});

test("rejects duplicate ids, unknown fields, invalid statuses, and oversized snapshots", () => {
  const duplicate = validateTaskSnapshot([
    { id: "build", label: "Build", status: "running" },
    { id: "build", label: "Other build", status: "queued" },
  ]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.errors[0].code, "TASKS_DUPLICATE_ID");
  }

  const invalid = validateTaskSnapshot([
    { id: "build", label: "Build", status: "unknown", html: "<img>" },
  ]);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.deepEqual(
      invalid.errors.map(({ code }) => code),
      ["TASKS_UNKNOWN_PROPERTY"],
    );
  }

  const oversized = validateTaskSnapshot(
    Array.from({ length: 101 }, (_, index) => ({
      id: `task-${index}`,
      label: `Task ${index}`,
      status: "queued",
    })),
  );
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.errors[0].code, "TASKS_TOO_MANY");
});

test("does not invoke accessor properties or accept sparse task arrays", () => {
  let invoked = false;
  const item = Object.defineProperties(
    {},
    {
      id: { enumerable: true, value: "task" },
      label: {
        enumerable: true,
        get() {
          invoked = true;
          return "Task";
        },
      },
      status: { enumerable: true, value: "running" },
    },
  );
  const accessor = validateTaskSnapshot([item]);
  assert.equal(accessor.ok, false);
  if (!accessor.ok) assert.equal(accessor.errors[0].code, "TASKS_ACCESSOR");
  assert.equal(invoked, false);

  const sparse = validateTaskSnapshot(new Array(1));
  assert.equal(sparse.ok, false);
  if (!sparse.ok) assert.equal(sparse.errors[0].code, "TASKS_INVALID_ITEM");
});
