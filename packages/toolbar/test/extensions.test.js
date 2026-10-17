import assert from "node:assert/strict";
import { test } from "node:test";

const moduleRoot = process.env.MOORKYZ_M7_MODULE_ROOT ?? "../dist/";
const { createTrustedExtensionRegistry } = await import(
  new URL(`${moduleRoot}extensions.js`, import.meta.url)
);
const { createExperimentalNamespace } = await import(
  new URL(`${moduleRoot}experimental.js`, import.meta.url)
);

function definition(initialize = () => {}, id = "sample") {
  return {
    manifest: {
      schemaVersion: "1.0",
      id,
      trust: "trusted",
      actions: [{ id: `${id}.open`, label: "Open" }],
    },
    initialize,
  };
}

function registry(options = {}) {
  return createTrustedExtensionRegistry({
    enabled: true,
    authorize: () => true,
    ...options,
  });
}

test("extension and experimental imports are SSR safe and disabled by default", async () => {
  assert.equal("window" in globalThis, false);
  let initialized = 0;
  let policyCalls = 0;
  const input = definition(() => initialized++);
  const disabled = createTrustedExtensionRegistry({
    authorize: () => {
      policyCalls++;
      return true;
    },
  });
  assert.equal(
    (await disabled.register(input)).error.code,
    "EXTENSION_DISABLED",
  );
  assert.deepEqual(disabled.getActions(), []);
  const experimental = createExperimentalNamespace();
  const poisonedOptions = {
    get authorize() {
      throw new Error("Disabled namespace must not read options.");
    },
  };
  const experimentalRegistry =
    experimental.createExtensionRegistry(poisonedOptions);
  assert.equal(
    (await experimentalRegistry.register(input)).error.code,
    "EXTENSION_DISABLED",
  );
  assert.equal(initialized, 0);
  assert.equal(policyCalls, 0);
  assert.equal(experimental.enabled, false);
  assert.ok(Object.isFrozen(experimental));
  disabled.dispose();
  experimentalRegistry.dispose();
});

test("experimental opt-in still requires explicit host authorization", async () => {
  const experimental = createExperimentalNamespace(true);
  const denied = experimental.createExtensionRegistry();
  assert.equal(
    (await denied.register(definition())).error.code,
    "EXTENSION_DENIED",
  );
  denied.dispose();
});

test("registration requires host approval of the extension and every scoped action", async () => {
  let initialized = 0;
  for (const authorize of [
    undefined,
    () => false,
    async () => {
      throw new Error("invalid asynchronous policy");
    },
    () => {
      throw new Error("private host detail");
    },
    (request) => request.operation === "activate",
  ]) {
    const extensions = registry({ authorize });
    const result = await extensions.register(definition(() => initialized++));
    assert.equal(result.error.code, "EXTENSION_DENIED");
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.deepEqual(extensions.getActions(), []);
    extensions.dispose();
  }
  assert.equal(initialized, 0);
});

test("manifests are immutable, scoped data snapshots using the configuration contract", async () => {
  const dispatched = [];
  let scope;
  const extensions = registry({ dispatchAction: (id) => dispatched.push(id) });
  const input = definition((value) => {
    scope = value;
  });
  const result = await extensions.register(input);
  assert.equal(result.ok, true);
  input.manifest.actions[0].label = "Mutated";
  assert.equal(scope.manifest.actions[0].label, "Open");
  assert.ok(Object.isFrozen(scope));
  assert.ok(Object.isFrozen(scope.manifest));
  assert.ok(Object.isFrozen(scope.manifest.actions));
  assert.ok(Object.isFrozen(scope.manifest.actions[0]));
  assert.deepEqual(Object.keys(scope).sort(), [
    "dispatchAction",
    "manifest",
    "onDispose",
    "signal",
  ]);
  assert.ok(Object.isFrozen(extensions.getActions()));
  assert.equal(
    (await scope.dispatchAction("another.open")).error.code,
    "EXTENSION_DENIED",
  );
  assert.equal((await scope.dispatchAction("sample.open")).ok, true);
  assert.equal((await extensions.dispatchAction("sample.open")).ok, true);
  assert.equal(
    (await extensions.dispatchAction("sample.unknown")).error.code,
    "EXTENSION_DENIED",
  );
  assert.equal(
    (await extensions.dispatchAction("host.delete")).error.code,
    "EXTENSION_DENIED",
  );
  assert.deepEqual(dispatched, ["sample.open", "sample.open"]);
  assert.equal(
    (await extensions.register(input)).error.code,
    "EXTENSION_DUPLICATE",
  );
  result.value.dispose();
  result.value.dispose();
  assert.equal(scope.signal.aborted, true);
  assert.deepEqual(extensions.getActions(), []);
  assert.equal(
    (await scope.dispatchAction("sample.open")).error.code,
    "EXTENSION_INACTIVE",
  );
  assert.equal(
    (await extensions.dispatchAction("sample.open")).error.code,
    "EXTENSION_DENIED",
  );
  extensions.dispose();
});

test("invalid executable, accessor, namespace, inaccessible and malformed manifests fail closed", async () => {
  const extensions = registry();
  let getters = 0;
  const invalid = [
    { ...definition().manifest, trust: "untrusted" },
    { ...definition().manifest, schemaVersion: "2.0" },
    {
      ...definition().manifest,
      actions: [{ id: "host.delete", label: "Delete" }],
    },
    { ...definition().manifest, actions: [{ id: "sample.open", label: " " }] },
    {
      ...definition().manifest,
      actions: [{ id: "sample.open", label: "Open", execute() {} }],
    },
    Object.create(definition().manifest),
    {
      ...definition().manifest,
      get id() {
        getters++;
        return "sample";
      },
    },
    {
      ...definition().manifest,
      actions: [
        {
          id: "sample.open",
          get label() {
            getters++;
            return "Open";
          },
        },
      ],
    },
  ];
  for (const manifest of invalid) {
    assert.equal(
      (await extensions.register({ manifest, initialize() {} })).error.code,
      "EXTENSION_INVALID",
    );
  }
  assert.equal(getters, 0);
  extensions.dispose();
});

test("authorization revocation removes actions, aborts pending results and cleans resources", async () => {
  let allowed = true;
  let scope;
  let cleaned = 0;
  let finish;
  const extensions = registry({
    authorize: () => allowed,
    dispatchAction: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const registered = await extensions.register(
    definition((value) => {
      scope = value;
      value.onDispose(() => cleaned++);
    }),
  );
  const pending = scope.dispatchAction("sample.open");
  await Promise.resolve();
  extensions.revoke("sample");
  assert.equal((await pending).error.code, "EXTENSION_INACTIVE");
  finish();
  assert.equal(registered.value.status, "revoked");
  assert.equal(cleaned, 1);
  assert.equal(scope.signal.aborted, true);
  assert.equal(extensions.revoke("sample"), false);
  const next = await extensions.register(
    definition((value) => {
      scope = value;
    }),
  );
  assert.equal(next.ok, true);
  allowed = false;
  assert.deepEqual(extensions.getActions(), []);
  assert.equal(next.value.status, "revoked");
  assert.equal(
    (await scope.dispatchAction("sample.open")).error.code,
    "EXTENSION_INACTIVE",
  );
  extensions.dispose();
});

test("authorization is checked at dispatch time, including the asynchronous handoff", async () => {
  let allowed = true;
  let scope;
  let calls = 0;
  const extensions = registry({
    authorize: () => allowed,
    dispatchAction: () => {
      calls++;
    },
  });
  await extensions.register(
    definition((value) => {
      scope = value;
    }),
  );
  const request = scope.dispatchAction("sample.open");
  allowed = false;
  assert.equal((await request).error.code, "EXTENSION_INACTIVE");
  assert.equal(calls, 0);
  assert.deepEqual(extensions.getActions(), []);
  extensions.dispose();
});

test("initialization faults are redacted and bounded by a persistent circuit breaker", async () => {
  let attempts = 0;
  let cleanups = 0;
  const extensions = registry({ failureLimit: 2 });
  const broken = definition((scope) => {
    attempts++;
    scope.onDispose(() => cleanups++);
    throw new Error("secret");
  });
  for (let index = 0; index < 2; index++) {
    const result = await extensions.register(broken);
    assert.equal(result.error.code, "EXTENSION_FAILED");
    assert.equal(JSON.stringify(result).includes("secret"), false);
  }
  assert.equal(
    (await extensions.register(broken)).error.code,
    "EXTENSION_CIRCUIT_OPEN",
  );
  assert.equal(attempts, 2);
  assert.equal(cleanups, 2);
  assert.deepEqual(extensions.getActions(), []);
  extensions.dispose();
});

test("repeated dispatch failures trip only the offending extension with no automatic retries", async () => {
  let scope;
  let calls = 0;
  let cleaned = 0;
  const extensions = registry({
    failureLimit: 2,
    dispatchAction: () => {
      calls++;
      return Promise.reject(new Error("secret"));
    },
  });
  const broken = await extensions.register(
    definition((value) => {
      scope = value;
      value.onDispose(() => cleaned++);
    }),
  );
  const healthy = await extensions.register(definition(() => {}, "healthy"));
  assert.equal(
    (await scope.dispatchAction("sample.open")).error.code,
    "EXTENSION_FAILED",
  );
  assert.equal((await scope.dispatchAction("sample.open")).ok, false);
  assert.equal(
    (await scope.dispatchAction("sample.open")).error.code,
    "EXTENSION_CIRCUIT_OPEN",
  );
  assert.equal(calls, 2);
  assert.equal(cleaned, 1);
  assert.equal(broken.value.status, "circuit-open");
  assert.equal(healthy.value.status, "active");
  assert.deepEqual(
    extensions.getActions().map((action) => action.id),
    ["healthy.open"],
  );
  assert.equal(
    (await extensions.register(definition())).error.code,
    "EXTENSION_CIRCUIT_OPEN",
  );
  extensions.dispose();
});

test("successful commands reset consecutive failures without replaying failures", async () => {
  let scope;
  let calls = 0;
  const extensions = registry({
    failureLimit: 2,
    dispatchAction: () => {
      calls++;
      if (calls !== 2) throw new Error("fault");
    },
  });
  const result = await extensions.register(
    definition((value) => {
      scope = value;
    }),
  );
  assert.equal((await scope.dispatchAction("sample.open")).ok, false);
  assert.equal((await scope.dispatchAction("sample.open")).ok, true);
  assert.equal((await scope.dispatchAction("sample.open")).ok, false);
  assert.equal(result.value.status, "active");
  assert.equal(calls, 3);
  extensions.dispose();
});

test("disabling during async initialization settles promptly and contains late cleanup", async () => {
  let scope;
  let finish;
  let cleaned = 0;
  const extensions = registry();
  const pending = extensions.register(
    definition(async (value) => {
      scope = value;
      value.onDispose(() => {
        cleaned++;
        throw new Error("cleanup");
      });
      value.onDispose(() => cleaned++);
      await new Promise((resolve) => {
        finish = resolve;
      });
      value.onDispose(() => cleaned++);
      throw new Error("late initialization failure");
    }),
  );
  await Promise.resolve();
  extensions.setEnabled(false);
  assert.equal((await pending).error.code, "EXTENSION_INACTIVE");
  assert.equal(cleaned, 2);
  assert.equal(scope.signal.aborted, true);
  finish();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cleaned, 3);
  assert.deepEqual(extensions.getActions(), []);
  extensions.dispose();
  extensions.dispose();
  extensions.setEnabled(true);
  assert.equal(
    (await extensions.register(definition())).error.code,
    "EXTENSION_DISPOSED",
  );
});

test("cleanup is LIFO, idempotent, bounded and contains synchronous and async faults", async () => {
  const order = [];
  let scope;
  const extensions = registry();
  await extensions.register(
    definition((value) => {
      scope = value;
      value.onDispose(() => order.push(1));
      value.onDispose(() => {
        order.push(2);
        throw new Error("cleanup");
      });
      value.onDispose(async () => {
        order.push(3);
        throw new Error("async cleanup");
      });
    }),
  );
  extensions.dispose();
  extensions.dispose();
  assert.deepEqual(order, [3, 2, 1]);
  assert.equal(
    scope.onDispose(() => order.push(4)).error.code,
    "EXTENSION_INACTIVE",
  );
  assert.deepEqual(order, [3, 2, 1, 4]);
});

test("identity, pending work and cleanup limits prevent unbounded SDK resource retention", async () => {
  let scope;
  let immediateCleanup = 0;
  const extensions = registry({ dispatchAction: () => new Promise(() => {}) });
  await extensions.register(
    definition((value) => {
      scope = value;
      for (let index = 0; index < 64; index++) value.onDispose(() => {});
      assert.equal(
        value.onDispose(() => immediateCleanup++).error.code,
        "EXTENSION_LIMIT",
      );
    }),
  );
  assert.equal(immediateCleanup, 1);
  const pending = Array.from({ length: 16 }, () =>
    scope.dispatchAction("sample.open"),
  );
  assert.equal(
    (await scope.dispatchAction("sample.open")).error.code,
    "EXTENSION_LIMIT",
  );
  extensions.dispose();
  assert.ok((await Promise.all(pending)).every((result) => !result.ok));
  const bounded = registry();
  for (let index = 0; index < 64; index++) {
    const result = await bounded.register(
      definition(() => {}, `extension-${index}`),
    );
    assert.equal(result.ok, true);
    result.value.dispose();
  }
  assert.equal(
    (await bounded.register(definition())).error.code,
    "EXTENSION_LIMIT",
  );
  bounded.dispose();
  assert.throws(() => registry({ failureLimit: 0 }), RangeError);
  assert.throws(() => registry({ failureLimit: 11 }), RangeError);
});

test("malformed definitions and missing host executors are contained without granting behavior", async () => {
  const extensions = registry();
  for (const input of [
    null,
    {},
    { ...definition(), initialize: null },
    new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("malformed input");
        },
      },
    ),
  ]) {
    assert.equal(
      (await extensions.register(input)).error.code,
      "EXTENSION_INVALID",
    );
  }
  let scope;
  await extensions.register(
    definition((value) => {
      scope = value;
    }),
  );
  assert.equal(scope.onDispose(null).error.code, "EXTENSION_INVALID");
  assert.equal(
    (await scope.dispatchAction("sample.open")).error.code,
    "EXTENSION_DENIED",
  );
  assert.equal(
    (await extensions.dispatchAction(null)).error.code,
    "EXTENSION_DENIED",
  );
  extensions.dispose();
});

test("authorization revocation during initialization rolls back actions and cleanup", async () => {
  let allowed = true;
  let finish;
  let cleaned = 0;
  const extensions = registry({ authorize: () => allowed });
  const pending = extensions.register(
    definition(async (scope) => {
      scope.onDispose(() => cleaned++);
      await new Promise((resolve) => {
        finish = resolve;
      });
    }),
  );
  await Promise.resolve();
  allowed = false;
  finish();
  assert.equal((await pending).error.code, "EXTENSION_DENIED");
  assert.deepEqual(extensions.getActions(), []);
  assert.equal(cleaned, 1);
  extensions.dispose();
});

test("authorization changes before and after host execution fail closed", async () => {
  let allowed = true;
  let scope;
  let finish;
  let calls = 0;
  const extensions = registry({
    authorize: () => allowed,
    dispatchAction: () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  await extensions.register(
    definition((value) => {
      scope = value;
    }),
  );
  allowed = false;
  assert.equal(
    (await scope.dispatchAction("sample.open")).error.code,
    "EXTENSION_DENIED",
  );
  assert.equal(calls, 0);
  allowed = true;
  await extensions.register(
    definition((value) => {
      scope = value;
    }),
  );
  const pending = scope.dispatchAction("sample.open");
  await Promise.resolve();
  allowed = false;
  finish();
  assert.equal((await pending).error.code, "EXTENSION_INACTIVE");
  assert.equal(calls, 1);
  assert.deepEqual(extensions.getActions(), []);
  extensions.dispose();
});

test("host disabling during authorization cancels activation and re-enabling never auto-starts", async () => {
  let initialized = 0;
  const extensions = registry({
    authorize: () => {
      extensions.setEnabled(false);
      return true;
    },
  });
  assert.equal(
    (await extensions.register(definition(() => initialized++))).error.code,
    "EXTENSION_INACTIVE",
  );
  extensions.setEnabled(true);
  assert.equal(initialized, 0);
  assert.deepEqual(extensions.getActions(), []);
  extensions.dispose();
});
