import assert from "node:assert/strict";
import { test } from "node:test";
import { SPATIAL_ANCHORS, createSpatialCoordinator } from "../dist/index.js";

const viewport = {
  width: 1200,
  height: 800,
  safeArea: { top: 10, right: 20, bottom: 30, left: 15 },
};
const dock = { width: 200, height: 80 };

test("spatial coordination is off by default and inspects no disabled input", () => {
  assert.throws(() => createSpatialCoordinator("enabled"));
  const spatial = createSpatialCoordinator();
  assert.equal(Object.isFrozen(SPATIAL_ANCHORS), true);
  let inspected = false;
  const hostileZone = Object.defineProperty({}, "id", {
    enumerable: true,
    get() {
      inspected = true;
      return "keyboard";
    },
  });

  const registered = spatial.registerZone(hostileZone);
  const placement = spatial.resolve(
    Object.defineProperty({}, "width", {
      get() {
        inspected = true;
        return 1000;
      },
    }),
    dock,
  );
  assert.equal(registered.ok, false);
  if (!registered.ok) {
    assert.equal(registered.error.code, "SPATIAL_DISABLED");
  }
  assert.equal(placement.ok, false);
  if (!placement.ok) {
    assert.equal(placement.error.code, "SPATIAL_DISABLED");
  }
  assert.equal(inspected, false);
  assert.deepEqual(spatial.listZones(), []);
});

test("chooses the preferred safe anchor and respects viewport insets", () => {
  const spatial = createSpatialCoordinator(true);
  const result = spatial.resolve(viewport, dock);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.anchor, "bottom-center");
    assert.deepEqual(result.value.rect, {
      x: 497.5,
      y: 690,
      width: 200,
      height: 80,
    });
  }
});

test("avoids host-provided zones and retains the preferred anchor when safe", () => {
  const spatial = createSpatialCoordinator(true);
  assert.equal(
    spatial.registerZone({
      id: "bottom-dock",
      x: 495,
      y: 685,
      width: 210,
      height: 90,
    }).ok,
    true,
  );
  const moved = spatial.resolve(viewport, dock, "bottom-center");
  assert.equal(moved.ok, true);
  if (moved.ok) assert.equal(moved.value.anchor, "bottom-start");

  const stable = spatial.resolve(viewport, dock, "bottom-start");
  assert.equal(stable.ok, true);
  if (stable.ok) assert.equal(stable.value.anchor, "bottom-start");
});

test("returns a structured no-safe-placement result without changing host layout", () => {
  const spatial = createSpatialCoordinator(true);
  assert.equal(
    spatial.registerZone({
      id: "full-frame",
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
    }).ok,
    true,
  );
  const result = spatial.resolve(viewport, dock);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "SPATIAL_NO_SAFE_PLACEMENT");
  }
  assert.equal(viewport.width, 1200);
});

test("returns structured validation failures for hostile viewport objects", () => {
  const spatial = createSpatialCoordinator(true);
  const hostileViewport = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error("viewport proxy trap");
      },
    },
  );
  const result = spatial.resolve(hostileViewport, dock);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "SPATIAL_INVALID_VIEWPORT");
  }
});

test("validates zone geometry atomically and clears registered zones when disabled", () => {
  const spatial = createSpatialCoordinator(true);
  assert.equal(
    spatial.registerZone({
      id: "keyboard",
      x: 0,
      y: 700,
      width: 300,
      height: 100,
    }).ok,
    true,
  );
  assert.equal(
    spatial.registerZone({
      id: "keyboard",
      x: 5,
      y: 5,
      width: 10,
      height: 10,
    }).ok,
    false,
  );
  assert.equal(
    spatial.registerZone({
      id: "invalid",
      x: -1,
      y: 0,
      width: 10,
      height: 10,
    }).ok,
    false,
  );
  assert.equal(spatial.listZones().length, 1);
  spatial.setEnabled(false);
  assert.deepEqual(spatial.listZones(), []);
  assert.equal(spatial.enabled, false);
  spatial.setEnabled(true);
  assert.deepEqual(spatial.listZones(), []);
});

test("bounds exclusion-zone count and rejects accessors without invoking them", () => {
  const spatial = createSpatialCoordinator(true);
  for (let index = 0; index < 64; index += 1) {
    assert.equal(
      spatial.registerZone({
        id: `zone-${index}`,
        x: index,
        y: 0,
        width: 1,
        height: 1,
      }).ok,
      true,
    );
  }
  const limit = spatial.registerZone({
    id: "overflow",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  assert.equal(limit.ok, false);
  if (!limit.ok) assert.equal(limit.error.code, "SPATIAL_TOO_MANY_ZONES");

  let invoked = false;
  const accessorZone = Object.defineProperty(
    {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    },
    "id",
    {
      enumerable: true,
      get() {
        invoked = true;
        return "unsafe";
      },
    },
  );
  const accessor = spatial.registerZone(accessorZone);
  assert.equal(accessor.ok, false);
  assert.equal(invoked, false);
});
