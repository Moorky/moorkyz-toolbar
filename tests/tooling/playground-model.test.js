import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INITIAL_PLAYGROUND_CONFIGURATION,
  parsePlaygroundJSON,
  validatePlaygroundConfiguration,
} from "../../packages/portal/src/components/playground-model.ts";

test("Playground default passes shared SDK validation with optional work off", () => {
  const config = INITIAL_PLAYGROUND_CONFIGURATION;
  assert.equal(validatePlaygroundConfiguration(config).ok, true);
  assert.equal(Object.values(config.features).some(Boolean), false);
  assert.equal(config.placement.mode, "container");
  assert.equal(config.renderMode, "light");
  assert.deepEqual(
    parsePlaygroundJSON(
      JSON.stringify({ version: 1, configuration: config }),
      true,
    ),
    {
      ok: true,
      value: config,
    },
  );
});

test("Playground rejects corrupt, oversized, future and non-configuration drafts", () => {
  for (const raw of [
    "{",
    "null",
    "[]",
    '{"version":99,"configuration":{}}',
    '{"version":1,"configuration":{},"extra":true}',
    " ".repeat(65_537),
  ])
    assert.equal(parsePlaygroundJSON(raw, true).ok, false, raw.slice(0, 80));
  assert.equal(parsePlaygroundJSON('{"label":""}').ok, false);
  const oversizedUnicode = parsePlaygroundJSON(
    JSON.stringify({ label: "é".repeat(32_769) }),
  );
  assert.equal(oversizedUnicode.ok, false);
  assert.match(oversizedUnicode.message, /64 KiB/);
});

test("Playground imports cannot activate features, escape their container or acquire commands", () => {
  const initial = INITIAL_PLAYGROUND_CONFIGURATION;
  for (const patch of [
    { actions: [{ id: "delete-host-data", label: "Unsafe" }] },
    { features: { ai: true } },
    { features: { spatialCoordination: true } },
    { features: { platform: true } },
    { placement: { mode: "viewport" } },
    { renderMode: "shadow" },
    { label: "x".repeat(101) },
    { actions: [{ id: "add-task", label: "x".repeat(81) }] },
    {
      actions: [
        { id: "add-task", label: "One" },
        { id: "add-task", label: "Two" },
      ],
    },
  ])
    assert.equal(
      validatePlaygroundConfiguration({ ...initial, ...patch }).ok,
      false,
    );
  assert.equal(
    validatePlaygroundConfiguration({
      ...initial,
      actions: [{ id: "add-task", label: "<img src=x>" }],
    }).ok,
    true,
  );
});
