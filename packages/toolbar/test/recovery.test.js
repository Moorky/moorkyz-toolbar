import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecoveryQueue } from "../dist/recovery.js";

function job(overrides = {}) {
  return {
    id: "host:refresh",
    idempotencyKey: "refresh-1",
    safeToRetry: true,
    authorize: () => true,
    execute: () => {},
    ...overrides,
  };
}

test("recovery is inert when disabled, offline and disposed", async () => {
  const queue = createRecoveryQueue();
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error("inspected");
      },
    },
  );
  assert.equal(queue.enqueue(hostile).error.code, "RECOVERY_DISABLED");
  assert.equal((await queue.drain(true)).error.code, "RECOVERY_DISABLED");
  queue.setEnabled(true);
  let calls = 0;
  queue.enqueue(job({ execute: () => calls++ }));
  assert.equal((await queue.drain(false)).error.code, "RECOVERY_OFFLINE");
  assert.equal(calls, 0);
  assert.equal((await queue.drain(true)).ok, true);
  assert.equal(calls, 1);
  assert.equal(queue.enqueue(job()).error.code, "RECOVERY_DUPLICATE");
  queue.dispose();
  assert.equal(queue.size, 0);
  assert.equal(queue.setEnabled(true).error.code, "RECOVERY_DISPOSED");
});

test("retries are explicit, bounded, authorized each time and circuit broken", async () => {
  const queue = createRecoveryQueue({ maxAttempts: 2 });
  queue.setEnabled(true);
  let authorizations = 0;
  let attempts = 0;
  queue.enqueue(
    job({
      authorize: () => {
        authorizations++;
        return true;
      },
      execute: () => {
        attempts++;
        throw new Error("synthetic");
      },
    }),
  );
  assert.equal((await queue.drain(true)).error.code, "RECOVERY_FAILED");
  assert.equal(queue.size, 1);
  assert.equal(attempts, 1);
  assert.equal((await queue.drain(true)).error.code, "RECOVERY_FAILED");
  assert.equal(queue.size, 0);
  assert.equal(queue.circuitOpen, true);
  assert.equal(authorizations, 2);
  assert.equal((await queue.drain(true)).error.code, "RECOVERY_CIRCUIT_OPEN");
  assert.equal(queue.resetCircuit().ok, true);
  assert.equal((await queue.drain(true)).ok, true);
});

test("denial and authorization failure never execute or retry", async () => {
  for (const authorize of [
    () => false,
    () => {
      throw new Error("denied");
    },
  ]) {
    const queue = createRecoveryQueue();
    queue.setEnabled(true);
    queue.enqueue(job({ authorize, execute: () => assert.fail("executed") }));
    assert.equal((await queue.drain(true)).ok, false);
    assert.equal(queue.size, 0);
    queue.dispose();
  }
});

test("disable cancels uncooperative hosts and releases queued closures", async () => {
  const queue = createRecoveryQueue();
  queue.setEnabled(true);
  queue.enqueue(job({ authorize: () => new Promise(() => {}) }));
  const draining = queue.drain(true);
  assert.equal((await queue.drain(true)).error.code, "RECOVERY_BUSY");
  queue.setEnabled(false);
  assert.equal((await draining).error.code, "RECOVERY_CANCELLED");
  assert.equal(queue.size, 0);
  queue.setEnabled(true);
  assert.equal(queue.enqueue(job()).ok, true);
  queue.dispose();
});

test("invalid options, unsafe jobs and session capacity are rejected", () => {
  assert.throws(() => createRecoveryQueue({ capacity: 101 }), RangeError);
  assert.throws(() => createRecoveryQueue({ maxAttempts: 0 }), RangeError);
  const queue = createRecoveryQueue({ capacity: 1 });
  queue.setEnabled(true);
  assert.equal(queue.enqueue(job({ safeToRetry: false })).ok, false);
  assert.equal(queue.enqueue(job({ id: "bad" })).ok, false);
  assert.equal(queue.enqueue(job()).ok, true);
  assert.equal(
    queue.enqueue(job({ idempotencyKey: "next" })).error.code,
    "RECOVERY_FULL",
  );
  queue.dispose();
});
