export const SPATIAL_ANCHORS = Object.freeze([
  "bottom-center",
  "bottom-start",
  "bottom-end",
  "top-center",
  "top-start",
  "top-end",
] as const);

export type SpatialAnchor = (typeof SPATIAL_ANCHORS)[number];

export interface SpatialInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface SpatialViewport {
  readonly width: number;
  readonly height: number;
  readonly safeArea?: Partial<SpatialInsets>;
}

export interface SpatialDockSize {
  readonly width: number;
  readonly height: number;
}

export interface SpatialRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SpatialZone extends SpatialRect {
  readonly id: string;
}

export interface SpatialPlacement {
  readonly anchor: SpatialAnchor;
  readonly rect: SpatialRect;
}

export type SpatialErrorCode =
  | "SPATIAL_DISABLED"
  | "SPATIAL_INVALID_ZONE"
  | "SPATIAL_DUPLICATE_ZONE"
  | "SPATIAL_ZONE_NOT_FOUND"
  | "SPATIAL_TOO_MANY_ZONES"
  | "SPATIAL_INVALID_VIEWPORT"
  | "SPATIAL_INVALID_DOCK"
  | "SPATIAL_INVALID_ANCHOR"
  | "SPATIAL_NO_SAFE_PLACEMENT";

export interface SpatialError {
  readonly code: SpatialErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type SpatialOutcome<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: SpatialError };

export interface SpatialCoordinator {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
  registerZone(zone: unknown): SpatialOutcome<string>;
  removeZone(id: string): SpatialOutcome<boolean>;
  listZones(): readonly SpatialZone[];
  resolve(
    viewport: unknown,
    dock: unknown,
    preferredAnchor?: SpatialAnchor,
  ): SpatialOutcome<SpatialPlacement>;
}

const MAX_ZONES = 64;
const MAX_DIMENSION = 100_000;
const ZONE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const ZONE_KEYS = new Set(["id", "x", "y", "width", "height"]);
const VIEWPORT_KEYS = new Set(["width", "height", "safeArea"]);
const DOCK_KEYS = new Set(["width", "height"]);
const INSET_KEYS = new Set(["top", "right", "bottom", "left"]);
const COLLISION_GAP = 8;

function failure<Value>(
  code: SpatialErrorCode,
  message: string,
): SpatialOutcome<Value> {
  return { ok: false, error: { code, message } };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copyDataRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length > 0) {
    return null;
  }
  const values: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if (!allowed.has(key) || !("value" in descriptor)) return null;
    values[key] = descriptor.value;
  }
  return values;
}

function isDimension(value: unknown, allowZero: boolean): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= (allowZero ? 0 : Number.MIN_VALUE) &&
    value <= MAX_DIMENSION
  );
}

function normalizeInsets(value: unknown): SpatialInsets | null {
  if (value === undefined) {
    return Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
  }
  const values = copyDataRecord(value, INSET_KEYS);
  if (values === null) return null;
  const top = values.top ?? 0;
  const right = values.right ?? 0;
  const bottom = values.bottom ?? 0;
  const left = values.left ?? 0;
  if (
    !isDimension(top, true) ||
    !isDimension(right, true) ||
    !isDimension(bottom, true) ||
    !isDimension(left, true)
  ) {
    return null;
  }
  return Object.freeze({ top, right, bottom, left });
}

function intersects(left: SpatialRect, right: SpatialRect): boolean {
  return (
    left.x < right.x + right.width + COLLISION_GAP &&
    left.x + left.width + COLLISION_GAP > right.x &&
    left.y < right.y + right.height + COLLISION_GAP &&
    left.y + left.height + COLLISION_GAP > right.y
  );
}

export function createSpatialCoordinator(
  initiallyEnabled = false,
): SpatialCoordinator {
  if (typeof initiallyEnabled !== "boolean") {
    throw new TypeError("Spatial coordination enabled state must be boolean.");
  }
  let active = initiallyEnabled;
  let zones = new Map<string, SpatialZone>();

  return {
    get enabled() {
      return active;
    },

    setEnabled(enabled) {
      if (typeof enabled !== "boolean") {
        throw new TypeError(
          "Spatial coordination enabled state must be boolean.",
        );
      }
      active = enabled;
      if (!enabled) zones = new Map();
    },

    registerZone(input) {
      if (!active) {
        return failure("SPATIAL_DISABLED", "Spatial coordination is disabled.");
      }
      let values: Record<string, unknown> | null;
      try {
        values = copyDataRecord(input, ZONE_KEYS);
      } catch {
        values = null;
      }
      if (values === null) {
        return failure(
          "SPATIAL_INVALID_ZONE",
          "Exclusion zones must be plain objects with only supported data fields.",
        );
      }
      const { id, x, y, width, height } = values;
      if (
        typeof id !== "string" ||
        !ZONE_ID_PATTERN.test(id) ||
        !isDimension(x, true) ||
        !isDimension(y, true) ||
        !isDimension(width, false) ||
        !isDimension(height, false) ||
        x + width > MAX_DIMENSION ||
        y + height > MAX_DIMENSION
      ) {
        return failure(
          "SPATIAL_INVALID_ZONE",
          "Exclusion zone id and geometry are invalid.",
        );
      }
      if (zones.has(id)) {
        return failure(
          "SPATIAL_DUPLICATE_ZONE",
          `Exclusion zone "${id}" is already registered.`,
        );
      }
      if (zones.size >= MAX_ZONES) {
        return failure(
          "SPATIAL_TOO_MANY_ZONES",
          `At most ${MAX_ZONES} exclusion zones may be registered.`,
        );
      }
      const zone = Object.freeze({ id, x, y, width, height });
      zones.set(id, zone);
      return { ok: true, value: id };
    },

    removeZone(id) {
      if (!active) {
        return failure("SPATIAL_DISABLED", "Spatial coordination is disabled.");
      }
      if (typeof id !== "string" || !ZONE_ID_PATTERN.test(id)) {
        return failure("SPATIAL_INVALID_ZONE", "Exclusion zone id is invalid.");
      }
      return { ok: true, value: zones.delete(id) };
    },

    listZones() {
      return Object.freeze(active ? [...zones.values()] : []);
    },

    resolve(viewportInput, dockInput, preferredAnchor = "bottom-center") {
      if (!active) {
        return failure("SPATIAL_DISABLED", "Spatial coordination is disabled.");
      }
      let viewportValues: Record<string, unknown> | null;
      let dockValues: Record<string, unknown> | null;
      let insets: SpatialInsets | null;
      try {
        viewportValues = copyDataRecord(viewportInput, VIEWPORT_KEYS);
        dockValues = copyDataRecord(dockInput, DOCK_KEYS);
        insets =
          viewportValues === null
            ? null
            : normalizeInsets(viewportValues.safeArea);
      } catch {
        return failure(
          "SPATIAL_INVALID_VIEWPORT",
          "Viewport and dock data could not be inspected safely.",
        );
      }
      if (
        viewportValues === null ||
        !isDimension(viewportValues.width, false) ||
        !isDimension(viewportValues.height, false)
      ) {
        return failure(
          "SPATIAL_INVALID_VIEWPORT",
          "Viewport dimensions and insets are invalid.",
        );
      }
      if (
        insets === null ||
        insets.left + insets.right >= viewportValues.width ||
        insets.top + insets.bottom >= viewportValues.height
      ) {
        return failure(
          "SPATIAL_INVALID_VIEWPORT",
          "Viewport safe-area insets exceed the available bounds.",
        );
      }
      if (
        dockValues === null ||
        !isDimension(dockValues.width, false) ||
        !isDimension(dockValues.height, false) ||
        dockValues.width > viewportValues.width - insets.left - insets.right ||
        dockValues.height > viewportValues.height - insets.top - insets.bottom
      ) {
        return failure(
          "SPATIAL_INVALID_DOCK",
          "Dock dimensions do not fit within the safe viewport.",
        );
      }
      if (!SPATIAL_ANCHORS.some((anchor) => anchor === preferredAnchor)) {
        return failure(
          "SPATIAL_INVALID_ANCHOR",
          "Preferred spatial anchor is invalid.",
        );
      }

      const remainingAnchors = SPATIAL_ANCHORS.filter(
        (anchor) => anchor !== preferredAnchor,
      );
      const candidates = [preferredAnchor, ...remainingAnchors];
      for (const anchor of candidates) {
        let x: number;
        if (anchor.endsWith("center")) {
          x =
            insets.left +
            (viewportValues.width -
              insets.left -
              insets.right -
              dockValues.width) /
              2;
        } else if (anchor.endsWith("start")) {
          x = insets.left;
        } else {
          x = viewportValues.width - insets.right - dockValues.width;
        }
        const y = anchor.startsWith("bottom")
          ? viewportValues.height - insets.bottom - dockValues.height
          : insets.top;
        const rect = Object.freeze({
          x,
          y,
          width: dockValues.width,
          height: dockValues.height,
        });
        if (![...zones.values()].some((zone) => intersects(rect, zone))) {
          return { ok: true, value: Object.freeze({ anchor, rect }) };
        }
      }
      return failure(
        "SPATIAL_NO_SAFE_PLACEMENT",
        "No candidate dock anchor avoids all registered exclusion zones.",
      );
    },
  };
}
