import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCapabilityRegistry,
  createCommandExecutor,
  createContextResolver,
  createSurfaceStack,
  validateConfiguration,
} from "../dist/index.js";

test("capability failures are transactional, sorted and preserve authority", () => {
  const registry = createCapabilityRegistry();
  const register = (descriptor) =>
    registry.transact((tx) => tx.register(descriptor));
  assert.equal(
    register({ id: "bad", owner: "host", value: 1 }).error.code,
    "CAPABILITY_INVALID_ID",
  );
  assert.equal(
    register({ id: "host:valid", owner: "Invalid", value: 1 }).error.code,
    "CAPABILITY_INVALID_OWNER",
  );
  assert.equal(
    register({ id: "host:valid", owner: "other", value: 1 }).ok,
    false,
  );
  assert.equal(
    registry.transact((tx) => {
      tx.register({ id: "host:z", owner: "host", value: 1 });
      tx.register({ id: "host:a", owner: "host", value: 2 });
    }).ok,
    true,
  );
  assert.deepEqual(
    registry.list().map((entry) => entry.id),
    ["host:a", "host:z"],
  );
  assert.equal(
    registry.transact((tx) => {
      tx.unregister("host:missing", "host");
      tx.register({ id: "host:new", owner: "host", value: 1 });
      tx.unregister("host:a", "host");
    }).ok,
    false,
  );
  assert.equal(registry.get("host:a").value, 2);
  assert.equal(
    registry.transact((tx) => tx.unregister("host:a", "other")).error.code,
    "CAPABILITY_OWNER_MISMATCH",
  );
  assert.equal(
    registry.transact(() => {
      throw new Error("host failure");
    }).error.code,
    "CAPABILITY_TRANSACTION_ABORTED",
  );
  assert.equal(
    register({ id: "host:a", owner: "other", value: 9 }).error.code,
    "CAPABILITY_OVERRIDE_DENIED",
  );
  const throwing = createCapabilityRegistry({
    authorizeOverride() {
      throw new Error("denied");
    },
  });
  throwing.transact((tx) =>
    tx.register({ id: "host:a", owner: "host", value: 1 }),
  );
  assert.equal(
    throwing.transact((tx) =>
      tx.register({ id: "host:a", owner: "other", value: 2 }),
    ).error.code,
    "CAPABILITY_TRANSACTION_ABORTED",
  );
  const denied = createCapabilityRegistry({ authorizeOverride: () => false });
  denied.transact((tx) =>
    tx.register({ id: "host:a", owner: "host", value: 1 }),
  );
  assert.equal(
    denied.transact((tx) =>
      tx.register({ id: "host:a", owner: "other", value: 2 }),
    ).ok,
    false,
  );
  const version = registry.version;
  assert.equal(registry.transact(() => {}).version, version);
});

test("context malformed records, missing scopes and root changes fail explicitly", () => {
  const malformed = [
    null,
    [],
    1,
    new Date(),
    { [Symbol("value")]: 1 },
    Object.defineProperty({}, "value", {
      get() {
        assert.fail("getter");
      },
    }),
  ];
  for (const value of malformed)
    assert.throws(() => createContextResolver(value), TypeError);
  const resolver = createContextResolver({ value: 1 });
  assert.equal(resolver.version, 0);
  assert.equal(
    resolver.setScope("host:root", {}).error.code,
    "CONTEXT_ROOT_IMMUTABLE",
  );
  assert.equal(
    resolver.setScope("bad", {}).error.code,
    "CONTEXT_INVALID_SCOPE_ID",
  );
  assert.equal(
    resolver.setScope("host:one", {}, "host:missing").error.code,
    "CONTEXT_PARENT_NOT_FOUND",
  );
  assert.equal(resolver.setScope("host:one", null).ok, false);
  assert.equal(
    resolver.updateScope("host:missing", {}).error.code,
    "CONTEXT_SCOPE_NOT_FOUND",
  );
  resolver.setScope("host:one", {});
  assert.equal(resolver.updateScope("host:one", null).ok, false);
  assert.equal(
    resolver.removeScope("host:root").error.code,
    "CONTEXT_ROOT_IMMUTABLE",
  );
  assert.equal(
    resolver.removeScope("host:missing").error.code,
    "CONTEXT_SCOPE_NOT_FOUND",
  );
  assert.equal(
    resolver.resolve("host:missing").error.code,
    "CONTEXT_SCOPE_NOT_FOUND",
  );
  assert.equal(resolver.isCurrent(-1), false);
  assert.equal(resolver.removeScope("host:one").ok, true);
});

test("surface malformed IDs/kinds, missing and protected focus targets are rejected", () => {
  assert.throws(() => createSurfaceStack({ maxDepth: 0 }), RangeError);
  const stack = createSurfaceStack();
  assert.equal(stack.dismissTop("escape").error.code, "SURFACE_NOT_FOUND");
  assert.equal(
    stack.close("host:missing", "host").error.code,
    "SURFACE_NOT_FOUND",
  );
  assert.equal(
    stack.open({ id: "bad", kind: "panel" }).error.code,
    "SURFACE_INVALID_ID",
  );
  assert.equal(
    stack.open({ id: "host:one", kind: "bad" }).error.code,
    "SURFACE_INVALID_KIND",
  );
  assert.equal(
    stack.open({ id: "host:one", kind: "panel", parentId: "host:missing" })
      .error.code,
    "SURFACE_INVALID_PARENT",
  );
  assert.equal(
    stack.open({ id: "host:one", kind: "dialog", dismissible: false }).ok,
    true,
  );
  assert.equal(
    stack.open({ id: "host:one", kind: "panel" }).error.code,
    "SURFACE_DUPLICATE",
  );
  assert.equal(
    stack.dismissTop("outside").error.code,
    "SURFACE_NOT_DISMISSIBLE",
  );
  assert.equal(stack.close("host:one", "host").ok, true);
  assert.equal(stack.open({ id: "host:two", kind: "popover" }).ok, true);
  assert.equal(stack.dismissTop("trigger").ok, true);
});

function definition(overrides = {}) {
  return {
    id: "host:work",
    validateInput: (value) => typeof value === "number",
    execute: (input) => input,
    ...overrides,
  };
}

test("command definition validation and authorization fail closed", async () => {
  const executor = createCommandExecutor();
  for (const overrides of [
    { id: "bad" },
    { execute: undefined },
    { validateInput: undefined },
    { permission: "bad" },
    { timeoutMs: 0 },
    { timeoutMs: Infinity },
    { concurrency: "bad" },
  ])
    assert.equal(executor.register(definition(overrides)).ok, false);
  const secured = executor.register(
    definition({ permission: "host:read" }),
  ).value;
  assert.equal(
    (await secured.execute(1, {})).error.code,
    "COMMAND_PERMISSION_DENIED",
  );
  executor.dispose();
  assert.equal(executor.register(definition()).error.code, "COMMAND_DISPOSED");
  assert.equal((await secured.execute(1, {})).error.code, "COMMAND_DISPOSED");
  for (const authorize of [
    () => false,
    () => {
      throw new Error("host failure");
    },
  ]) {
    const authorized = createCommandExecutor({ authorize });
    const handle = authorized.register(
      definition({ permission: "host:read" }),
    ).value;
    assert.equal((await handle.execute(1, {})).ok, false);
    authorized.dispose();
  }
});

test("command validation, cancellation, removal and errors preserve result shape", async () => {
  const executor = createCommandExecutor();
  const invalid = executor.register(definition()).value;
  assert.equal(
    (await invalid.execute("bad", {})).error.code,
    "COMMAND_INVALID_INPUT",
  );
  invalid.dispose();
  invalid.dispose();
  const throwing = executor.register(
    definition({
      validateInput() {
        throw new Error("validator failure");
      },
    }),
  ).value;
  assert.equal(
    (await throwing.execute(1, {})).error.code,
    "COMMAND_INVALID_INPUT",
  );
  throwing.dispose();
  const failing = executor.register(
    definition({
      execute() {
        throw new Error("synthetic");
      },
    }),
  ).value;
  assert.equal(
    (await failing.execute(1, {})).error.code,
    "COMMAND_EXECUTION_FAILED",
  );
  failing.dispose();
  const signal = AbortSignal.abort();
  const cancelled = executor.register(definition()).value;
  assert.equal(
    (await cancelled.execute(1, {}, { signal })).error.code,
    "COMMAND_CANCELLED",
  );
  assert.equal(executor.cancel("host:missing"), false);
  assert.equal(executor.revokePermission("host:missing"), 0);
  executor.dispose();
  executor.dispose();
});

test("configuration rejects unsupported data and retains prototype-safe normalization", () => {
  for (const value of [
    null,
    [],
    new Date(),
    { [Symbol("x")]: true },
    { actions: [null] },
    { actions: new Array(1) },
  ]) {
    assert.equal(validateConfiguration(value).ok, false);
  }
  for (const property of [
    "features",
    "placement",
    "actions",
    "label",
    "theme",
    "colorScheme",
  ]) {
    assert.equal(
      validateConfiguration(
        Object.defineProperty({}, property, {
          enumerable: true,
          get() {
            assert.fail("accessor");
          },
        }),
      ).ok,
      false,
    );
  }
});
