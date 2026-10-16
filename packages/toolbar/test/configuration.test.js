import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONFIGURATION_SCHEMA,
  CONFIGURATION_VERSION,
  FEATURE_DEFAULTS,
  validateConfiguration,
} from "../dist/index.js";

test("normalizes the documented defaults and round-trips valid overrides", () => {
  const result = validateConfiguration({
    schemaVersion: CONFIGURATION_VERSION,
    features: { ai: true, spatialCoordination: false },
    actions: [{ id: "projects", label: "Projects" }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.features, {
    ...FEATURE_DEFAULTS,
    ai: true,
  });
  assert.equal(result.value.actions[0]?.label, "Projects");
  assert.equal(result.value.renderMode, "shadow");
  assert.equal(result.value.theme, "signature");
  assert.equal(result.value.colorScheme, "system");

  const roundTrip = validateConfiguration(result.value);
  assert.equal(roundTrip.ok, true);
  if (roundTrip.ok) {
    assert.deepEqual(roundTrip.value, result.value);
  }
});

test("keeps independently optional integrations disabled by default", () => {
  const result = validateConfiguration({});

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.features.spatialCoordination, false);
  assert.equal(result.value.features.offline, false);
  assert.equal(result.value.features.ai, false);
  assert.equal(result.value.features.experimental, false);
});

test("normalizes placement defaults and rejects unsupported placement settings", () => {
  const normalized = validateConfiguration({
    placement: { mode: "fullscreen" },
  });
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.deepEqual(normalized.value.placement, {
      mode: "fullscreen",
      anchor: "bottom",
    });
  }

  const invalid = validateConfiguration({
    placement: { mode: "floating", anchor: "top" },
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(
      invalid.errors.some(
        ({ code }) => code === "CONFIG_INVALID_PLACEMENT_MODE",
      ),
    );
    assert.ok(
      invalid.errors.some(
        ({ code }) => code === "CONFIG_INVALID_PLACEMENT_ANCHOR",
      ),
    );
  }
});

test("validates built-in theme names and color schemes", () => {
  const normalized = validateConfiguration({
    theme: "midnight",
    colorScheme: "dark",
  });
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.equal(normalized.value.theme, "midnight");
    assert.equal(normalized.value.colorScheme, "dark");
  }

  const invalid = validateConfiguration({
    theme: "unlisted",
    colorScheme: "sepia",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(
      invalid.errors.some(({ code }) => code === "CONFIG_INVALID_THEME"),
    );
    assert.ok(
      invalid.errors.some(({ code }) => code === "CONFIG_INVALID_COLOR_SCHEME"),
    );
  }
});

test("exports a frozen JSON Schema derived from the normalized feature defaults", () => {
  assert.equal(
    CONFIGURATION_SCHEMA.$schema,
    "https://json-schema.org/draft/2020-12/schema",
  );
  assert.equal(
    CONFIGURATION_SCHEMA.properties.schemaVersion.const,
    CONFIGURATION_VERSION,
  );
  assert.deepEqual(
    CONFIGURATION_SCHEMA.properties.features.default,
    FEATURE_DEFAULTS,
  );
  assert.deepEqual(CONFIGURATION_SCHEMA.properties.placement.default, {
    mode: "viewport",
    anchor: "bottom",
  });
  assert.equal(CONFIGURATION_SCHEMA.properties.theme.default, "signature");
  assert.equal(CONFIGURATION_SCHEMA.properties.colorScheme.default, "system");
  assert.equal(Object.isFrozen(CONFIGURATION_SCHEMA.properties), true);
  assert.equal(
    Object.isFrozen(CONFIGURATION_SCHEMA.properties.features.properties),
    true,
  );
});

test("rejects unknown fields and unsupported schema versions with stable codes", () => {
  const result = validateConfiguration({
    schemaVersion: "2.0",
    unexpected: true,
    features: { spatialCoordination: true, madeUp: false },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.errors.map(({ code, path }) => [code, path]),
    [
      ["CONFIG_UNKNOWN_KEY", "unexpected"],
      ["CONFIG_UNSUPPORTED_VERSION", "schemaVersion"],
      ["CONFIG_UNKNOWN_KEY", "features.madeUp"],
    ],
  );
});

test("rejects invalid booleans, malformed actions, and duplicate ids", () => {
  const result = validateConfiguration({
    features: { ai: "yes" },
    actions: [
      { id: "search", label: "Search" },
      { id: "search", label: "Duplicate" },
      { id: "bad/id", label: "" },
    ],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(
    result.errors.some(({ code }) => code === "CONFIG_INVALID_FEATURE"),
  );
  assert.ok(
    result.errors.some(({ code }) => code === "CONFIG_DUPLICATE_ACTION"),
  );
  assert.ok(result.errors.some(({ code }) => code === "CONFIG_INVALID_ACTION"));
});

test("does not execute accessor properties while validating configuration", () => {
  let executed = false;
  const input = Object.defineProperty({}, "label", {
    enumerable: true,
    get() {
      executed = true;
      return "Unsafe";
    },
  });

  const result = validateConfiguration(input);
  assert.equal(result.ok, false);
  assert.equal(executed, false);
  if (!result.ok) {
    assert.ok(
      result.errors.some(({ code }) => code === "CONFIG_ACCESSOR_PROPERTY"),
    );
  }

  const actions = [];
  Object.defineProperty(actions, "0", {
    configurable: true,
    get() {
      executed = true;
      return { id: "home", label: "Home" };
    },
  });
  actions.length = 1;
  const actionResult = validateConfiguration({ actions });
  assert.equal(actionResult.ok, false);
  assert.equal(executed, false);
});

test("rejects prototype-bearing objects and malformed top-level input", () => {
  assert.equal(validateConfiguration(null).ok, false);
  assert.equal(validateConfiguration([]).ok, false);
  assert.equal(validateConfiguration(Object.create({ ai: true })).ok, false);
  assert.equal(validateConfiguration({ actions: new Array(1) }).ok, false);
});
