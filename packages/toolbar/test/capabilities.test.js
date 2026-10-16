import assert from "node:assert/strict";
import { test } from "node:test";
import { createCapabilityRegistry } from "../dist/index.js";

test("registers namespaced capabilities transactionally with immutable records", () => {
  const registry = createCapabilityRegistry();
  const result = registry.transact((transaction) => {
    transaction.register({
      id: "host:navigate",
      owner: "host",
      value: { navigate: true },
    });
    transaction.register({
      id: "project:search",
      owner: "project",
      value: { search: true },
    });
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.version, 1);
  assert.deepEqual(
    result.records.map(({ id }) => id),
    ["host:navigate", "project:search"],
  );
  assert.equal(Object.isFrozen(registry.get("host:navigate")), true);
  assert.equal(Object.isFrozen(registry.list()), true);
});

test("aborts all staged writes if a transaction contains an invalid registration", () => {
  const registry = createCapabilityRegistry();
  const result = registry.transact((transaction) => {
    transaction.register({
      id: "host:home",
      owner: "host",
      value: "Home",
    });
    transaction.register({
      id: "Invalid",
      owner: "host",
      value: "Invalid",
    });
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "CAPABILITY_INVALID_ID");
  assert.equal(registry.version, 0);
  assert.equal(registry.get("host:home"), undefined);
});

test("requires host authorization to replace another namespace's capability", () => {
  const existing = {
    id: "host:navigate",
    owner: "host",
    value: "host route",
  };
  const denied = createCapabilityRegistry();
  denied.transact((transaction) => transaction.register(existing));

  const blocked = denied.transact((transaction) =>
    transaction.register({
      id: "host:navigate",
      owner: "host",
      value: "extension route",
    }),
  );
  assert.equal(blocked.ok, true);

  const collision = denied.transact((transaction) =>
    transaction.register({
      id: "host:navigate",
      owner: "extension",
      value: "spoof",
    }),
  );
  assert.equal(collision.ok, false);
  if (!collision.ok) {
    assert.equal(collision.error.code, "CAPABILITY_OVERRIDE_DENIED");
  }

  const registry = createCapabilityRegistry({
    authorizeOverride: (current, replacement) =>
      current.owner === "host" && replacement.owner === "extension",
  });
  registry.transact((transaction) => transaction.register(existing));
  const approved = registry.transact((transaction) =>
    transaction.register({
      id: "host:navigate",
      owner: "extension",
      value: "host replacement",
    }),
  );
  assert.equal(approved.ok, true);
  assert.equal(registry.get("host:navigate")?.owner, "extension");
});

test("rejects duplicate ids inside a transaction and leaves prior state intact", () => {
  const registry = createCapabilityRegistry();
  registry.transact((transaction) =>
    transaction.register({
      id: "app:open",
      owner: "app",
      value: "open",
    }),
  );

  const result = registry.transact((transaction) => {
    transaction.register({
      id: "app:search",
      owner: "app",
      value: "search",
    });
    transaction.register({
      id: "app:search",
      owner: "app",
      value: "replacement",
    });
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "CAPABILITY_DUPLICATE");
  assert.equal(registry.version, 1);
  assert.equal(registry.get("app:search"), undefined);
});

test("only the registered owner may unregister, and callback failures abort", () => {
  const registry = createCapabilityRegistry();
  registry.transact((transaction) =>
    transaction.register({
      id: "host:save",
      owner: "host",
      value: "save",
    }),
  );

  const denied = registry.transact((transaction) =>
    transaction.unregister("host:save", "extension"),
  );
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error.code, "CAPABILITY_OWNER_MISMATCH");

  const thrown = registry.transact(() => {
    throw new Error("transaction callback failed");
  });
  assert.equal(thrown.ok, false);
  if (!thrown.ok) {
    assert.equal(thrown.error.code, "CAPABILITY_TRANSACTION_ABORTED");
  }
  assert.equal(registry.version, 1);
});
