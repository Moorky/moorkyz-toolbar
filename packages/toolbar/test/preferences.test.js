import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PREFERENCE_SCHEMA_VERSION,
  createBrowserPreferenceStorage,
  createToolbarPreferenceStore,
} from "../dist/index.js";

function storageAdapter(initialValue = null) {
  const values = new Map();
  if (initialValue !== null) values.set("initial", initialValue);
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("namespaces and round-trips explicit preferences through host storage", () => {
  const storage = storageAdapter();
  const store = createToolbarPreferenceStore("portal", storage);
  assert.equal(store.storageKey, "@moorkyz/toolbar/portal/preferences");
  assert.deepEqual(store.load(), {
    value: {
      schemaVersion: PREFERENCE_SCHEMA_VERSION,
      theme: "signature",
      colorScheme: "system",
      collapsed: false,
      actionOrder: [],
    },
    source: "default",
    hasPreferences: false,
  });

  const saved = store.save({
    theme: "midnight",
    colorScheme: "dark",
    collapsed: true,
    actionOrder: ["home", "projects"],
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.source, "storage");

  const reloaded = createToolbarPreferenceStore("portal", storage).load();
  assert.equal(reloaded.source, "storage");
  assert.equal(reloaded.value.theme, "midnight");
  assert.equal(reloaded.value.colorScheme, "dark");
  assert.equal(reloaded.value.collapsed, true);
  assert.deepEqual(reloaded.value.actionOrder, ["home", "projects"]);
});

test("migrates legacy light/dark preferences and persists the current version", () => {
  const storage = storageAdapter(
    JSON.stringify({
      schemaVersion: 0,
      theme: "dark",
      collapsed: true,
      actionOrder: ["home"],
    }),
  );
  const store = createToolbarPreferenceStore("legacy", {
    getItem(key) {
      return storage.values.get(key) ?? storage.values.get("initial") ?? null;
    },
    setItem(key, value) {
      storage.values.set(key, value);
    },
    removeItem(key) {
      storage.values.delete(key);
    },
  });

  const migrated = store.load();
  assert.equal(migrated.value.schemaVersion, PREFERENCE_SCHEMA_VERSION);
  assert.equal(migrated.value.theme, "signature");
  assert.equal(migrated.value.colorScheme, "dark");
  assert.equal(migrated.value.collapsed, true);
  assert.equal(migrated.source, "storage");

  const serialized = storage.values.get(store.storageKey);
  assert.ok(serialized);
  assert.equal(JSON.parse(serialized).schemaVersion, PREFERENCE_SCHEMA_VERSION);
});

test("uses isolated memory fallback and reports storage errors", () => {
  const storage = {
    getItem() {
      throw new Error("storage read denied");
    },
    setItem() {
      throw new Error("storage write denied");
    },
    removeItem() {
      throw new Error("storage remove denied");
    },
  };
  const store = createToolbarPreferenceStore("private-project", storage);

  const loaded = store.load();
  assert.equal(loaded.source, "memory");
  assert.equal(loaded.diagnostic?.code, "PREFERENCE_STORAGE_READ_FAILED");

  const saved = store.save({ collapsed: true });
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.source, "memory");
    assert.equal(saved.diagnostic?.code, "PREFERENCE_STORAGE_WRITE_FAILED");
  }
  assert.equal(store.load().value.collapsed, true);

  const reset = store.reset();
  assert.equal(reset.ok, true);
  if (reset.ok) {
    assert.equal(reset.source, "memory");
    assert.equal(reset.diagnostic?.code, "PREFERENCE_STORAGE_REMOVE_FAILED");
  }
  assert.equal(store.load().value.collapsed, false);
});

test("keeps corrupt stored preferences in memory without erasing evidence", () => {
  const storage = storageAdapter("not-json");
  const store = createToolbarPreferenceStore("corrupt", {
    getItem(key) {
      return storage.values.get(key) ?? storage.values.get("initial") ?? null;
    },
    setItem: storage.setItem,
    removeItem: storage.removeItem,
  });

  const loaded = store.load();
  assert.equal(loaded.source, "memory");
  assert.equal(loaded.diagnostic?.code, "PREFERENCE_INVALID_DATA");
  assert.equal(storage.values.get("initial"), "not-json");
});

test("rejects invalid theme, duplicate action order, unknown keys, and accessors", () => {
  const store = createToolbarPreferenceStore("validation");
  assert.equal(store.save({ theme: "not-a-theme" }).ok, false);
  assert.equal(store.save({ actionOrder: ["home", "home"] }).ok, false);
  assert.equal(store.save({ unknown: true }).ok, false);

  let invoked = false;
  const patch = Object.defineProperty({}, "collapsed", {
    enumerable: true,
    get() {
      invoked = true;
      return true;
    },
  });
  const result = store.save(patch);
  assert.equal(result.ok, false);
  assert.equal(invoked, false);
});

test("requires a stable local namespace", () => {
  assert.throws(() => createToolbarPreferenceStore("../other-app"));
  assert.throws(() => createToolbarPreferenceStore(" "));
});

test("browser storage access is deferred until an explicit adapter operation", () => {
  let accesses = 0;
  const view = Object.defineProperty({}, "localStorage", {
    get() {
      accesses += 1;
      return {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };
    },
  });

  const adapter = createBrowserPreferenceStorage(view);
  assert.equal(accesses, 0);
  assert.equal(adapter.getItem("key"), null);
  assert.equal(accesses, 1);
});
