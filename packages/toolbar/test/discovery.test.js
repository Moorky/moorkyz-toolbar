import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDiscoverySnapshot } from "../dist/index.js";

test("normalizes bounded discovery hints into immutable data", () => {
  const result = validateDiscoverySnapshot([
    {
      id: "project-search",
      title: "Search this project",
      message: "Use the Search control to find configured actions.",
    },
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value[0]), true);
  assert.equal(result.value[0].title, "Search this project");
});

test("rejects duplicate ids, unknown properties, and too many hints", () => {
  const duplicate = validateDiscoverySnapshot([
    { id: "tip", title: "First", message: "One" },
    { id: "tip", title: "Second", message: "Two" },
  ]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.errors[0].code, "DISCOVERY_DUPLICATE_ID");
  }

  const unknown = validateDiscoverySnapshot([
    {
      id: "tip",
      title: "Tip",
      message: "Body",
      callback: () => {},
    },
  ]);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.equal(unknown.errors[0].code, "DISCOVERY_UNKNOWN_PROPERTY");
  }

  const tooMany = validateDiscoverySnapshot(
    Array.from({ length: 11 }, (_, index) => ({
      id: `tip-${index}`,
      title: `Tip ${index}`,
      message: "Body",
    })),
  );
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) {
    assert.equal(tooMany.errors[0].code, "DISCOVERY_TOO_MANY");
  }
});

test("does not invoke discovery accessors or accept sparse arrays", () => {
  let invoked = false;
  const hint = Object.defineProperties(
    {
      id: "tip",
      message: "Body",
    },
    {
      title: {
        enumerable: true,
        get() {
          invoked = true;
          return "Tip";
        },
      },
    },
  );
  const accessor = validateDiscoverySnapshot([hint]);
  assert.equal(accessor.ok, false);
  if (!accessor.ok) {
    assert.equal(accessor.errors[0].code, "DISCOVERY_ACCESSOR");
  }
  assert.equal(invoked, false);

  const sparse = validateDiscoverySnapshot(new Array(1));
  assert.equal(sparse.ok, false);
  if (!sparse.ok) {
    assert.equal(sparse.errors[0].code, "DISCOVERY_INVALID_HINT");
  }
});
