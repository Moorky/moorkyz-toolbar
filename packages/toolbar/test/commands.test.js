import assert from "node:assert/strict";
import { test } from "node:test";
import { createCommandExecutor } from "../dist/index.js";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const acceptsAnyInput = () => true;

test("registers namespaced commands and denies permissions without host policy", async () => {
  const executor = createCommandExecutor();
  const registered = executor.register({
    id: "project:archive",
    permission: "project:write",
    validateInput: acceptsAnyInput,
    execute: () => "archived",
  });

  assert.equal(registered.ok, true);
  if (!registered.ok) return;
  const result = await registered.value.execute({}, {});
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "COMMAND_PERMISSION_DENIED");
  }
});

test("validates command inputs and rechecks host permission on execution", async () => {
  let allowed = true;
  let executions = 0;
  const executor = createCommandExecutor({
    authorize: (permission) => permission === "project:write" && allowed,
  });
  const registered = executor.register({
    id: "project:update",
    permission: "project:write",
    validateInput: (input) =>
      typeof input === "object" &&
      input !== null &&
      "title" in input &&
      typeof input.title === "string",
    execute: (input) => {
      executions += 1;
      return input.title;
    },
  });
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  const invalid = await registered.value.execute({ title: 1 }, {});
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "COMMAND_INVALID_INPUT");
  assert.equal(executions, 0);

  allowed = false;
  const denied = await registered.value.execute({ title: "new" }, {});
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error.code, "COMMAND_PERMISSION_DENIED");
  assert.equal(executions, 0);
});

test("single-flight shares one in-progress result", async () => {
  const gate = deferred();
  const started = deferred();
  let executions = 0;
  const executor = createCommandExecutor();
  const registered = executor.register({
    id: "app:load",
    concurrency: "single-flight",
    validateInput: acceptsAnyInput,
    execute: async () => {
      executions += 1;
      started.resolve();
      return gate.promise;
    },
  });
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  const first = registered.value.execute({}, {});
  await started.promise;
  const second = registered.value.execute({}, {});
  gate.resolve("loaded");
  assert.deepEqual(await first, { ok: true, value: "loaded" });
  assert.deepEqual(await second, { ok: true, value: "loaded" });
  assert.equal(executions, 1);
});

test("drop rejects overlapping work and replace aborts the prior execution", async () => {
  const dropGate = deferred();
  const dropStarted = deferred();
  const executor = createCommandExecutor();
  const dropCommand = executor.register({
    id: "app:drop",
    concurrency: "drop",
    validateInput: acceptsAnyInput,
    execute: async () => {
      dropStarted.resolve();
      return dropGate.promise;
    },
  });
  assert.equal(dropCommand.ok, true);
  if (!dropCommand.ok) return;
  const firstDrop = dropCommand.value.execute({}, {});
  await dropStarted.promise;
  const dropped = await dropCommand.value.execute({}, {});
  assert.equal(dropped.ok, false);
  if (!dropped.ok) assert.equal(dropped.error.code, "COMMAND_DROPPED");
  dropGate.resolve("done");
  await firstDrop;

  let firstWasAborted = false;
  const firstStarted = deferred();
  const replacement = executor.register({
    id: "app:replace",
    concurrency: "replace",
    validateInput: acceptsAnyInput,
    execute: (input, _context, signal) => {
      if (input === "first") {
        return new Promise((resolve) => {
          firstStarted.resolve();
          signal.addEventListener(
            "abort",
            () => {
              firstWasAborted = true;
              resolve("cooperative cancel");
            },
            { once: true },
          );
        });
      }
      return input;
    },
  });
  assert.equal(replacement.ok, true);
  if (!replacement.ok) return;

  const first = replacement.value.execute("first", {});
  await firstStarted.promise;
  const second = replacement.value.execute("second", {});
  const secondResult = await second;
  assert.equal(firstWasAborted, true);
  assert.deepEqual(await first, {
    ok: false,
    error: {
      code: "COMMAND_REPLACED",
      message: 'Command "app:replace" was replaced by a newer call.',
    },
  });
  assert.deepEqual(secondResult, { ok: true, value: "second" });
});

test("queue serializes calls and rechecks permission when each call starts", async () => {
  const firstGate = deferred();
  const started = [];
  let allowed = true;
  const executor = createCommandExecutor({
    authorize: () => allowed,
  });
  const registered = executor.register({
    id: "app:queue",
    permission: "app:run",
    concurrency: "queue",
    validateInput: acceptsAnyInput,
    execute: async (input) => {
      started.push(input);
      if (input === 1) return firstGate.promise;
      return input;
    },
  });
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  const first = registered.value.execute(1, {});
  const second = registered.value.execute(2, {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [1]);
  allowed = false;
  firstGate.resolve(1);
  assert.deepEqual(await first, { ok: true, value: 1 });
  const denied = await second;
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error.code, "COMMAND_PERMISSION_DENIED");
  assert.deepEqual(started, [1]);
});

test("host cancellation also cancels queued invocations", async () => {
  const started = deferred();
  const executor = createCommandExecutor();
  const registered = executor.register({
    id: "app:queued-cancel",
    concurrency: "queue",
    validateInput: acceptsAnyInput,
    execute: (input, _context, signal) => {
      if (input === 2) return input;
      started.resolve();
      return new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve("stopped"), {
          once: true,
        }),
      );
    },
  });
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  const first = registered.value.execute(1, {});
  await started.promise;
  const queued = registered.value.execute(2, {});
  registered.value.cancel();

  const [firstResult, queuedResult] = await Promise.all([first, queued]);
  assert.equal(firstResult.ok, false);
  assert.equal(queuedResult.ok, false);
  if (!firstResult.ok) {
    assert.equal(firstResult.error.code, "COMMAND_CANCELLED");
  }
  if (!queuedResult.ok) {
    assert.equal(queuedResult.error.code, "COMMAND_CANCELLED");
  }
});

test("timeout and caller cancellation abort cooperative handlers", async () => {
  let timeoutAborted = false;
  const executor = createCommandExecutor();
  const timed = executor.register({
    id: "app:slow",
    timeoutMs: 5,
    validateInput: acceptsAnyInput,
    execute: (_input, _context, signal) =>
      new Promise((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            timeoutAborted = true;
            resolve("cancelled");
          },
          { once: true },
        );
      }),
  });
  assert.equal(timed.ok, true);
  if (!timed.ok) return;
  const timeoutResult = await timed.value.execute({}, {});
  assert.equal(timeoutResult.ok, false);
  if (!timeoutResult.ok) {
    assert.equal(timeoutResult.error.code, "COMMAND_TIMED_OUT");
  }
  assert.equal(timeoutAborted, true);

  const controller = new AbortController();
  const started = deferred();
  const cancelled = executor.register({
    id: "app:cancel",
    validateInput: acceptsAnyInput,
    execute: (_input, _context, signal) => {
      started.resolve();
      return new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve("cancelled"), {
          once: true,
        }),
      );
    },
  });
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  const run = cancelled.value.execute({}, {}, { signal: controller.signal });
  await started.promise;
  controller.abort();
  const cancelResult = await run;
  assert.equal(cancelResult.ok, false);
  if (!cancelResult.ok) {
    assert.equal(cancelResult.error.code, "COMMAND_CANCELLED");
  }
});

test("permission revocation cancels active work immediately", async () => {
  const started = deferred();
  const executor = createCommandExecutor({
    authorize: () => true,
  });
  const registered = executor.register({
    id: "project:publish",
    permission: "project:publish",
    validateInput: acceptsAnyInput,
    execute: (_input, _context, signal) => {
      started.resolve();
      return new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve("stopped"), {
          once: true,
        }),
      );
    },
  });
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  const execution = registered.value.execute({}, {});
  await started.promise;
  assert.equal(executor.revokePermission("project:publish"), 1);
  const result = await execution;
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "COMMAND_PERMISSION_REVOKED");
  }
});

test("handler failures and registration collisions return explicit errors", async () => {
  const executor = createCommandExecutor();
  const unvalidated = executor.register({
    id: "app:unvalidated",
    execute: () => "must not run",
  });
  assert.equal(unvalidated.ok, false);
  if (!unvalidated.ok) {
    assert.equal(unvalidated.error.code, "COMMAND_INVALID_DEFINITION");
  }

  const definition = {
    id: "app:fail",
    validateInput: acceptsAnyInput,
    execute() {
      throw new Error("private failure detail");
    },
  };
  const registered = executor.register(definition);
  assert.equal(registered.ok, true);
  assert.equal(executor.register(definition).ok, false);
  if (!registered.ok) return;

  const result = await registered.value.execute({}, {});
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "COMMAND_EXECUTION_FAILED");
    assert.equal(result.error.cause.message, "private failure detail");
  }

  registered.value.dispose();
  const disposed = await registered.value.execute({}, {});
  assert.equal(disposed.ok, false);
  if (!disposed.ok) assert.equal(disposed.error.code, "COMMAND_DISPOSED");
});
