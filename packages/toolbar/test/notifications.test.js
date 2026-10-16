import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NOTIFICATION_SEVERITIES,
  validateNotificationSnapshot,
} from "../dist/index.js";

test("normalizes bounded host notification snapshots into immutable data", () => {
  assert.equal(Object.isFrozen(NOTIFICATION_SEVERITIES), true);
  const result = validateNotificationSnapshot([
    {
      id: "offline",
      title: "Connection lost",
      message: "Changes remain on this device.",
      severity: "warning",
      unread: true,
    },
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value[0]), true);
  assert.equal(result.value[0].severity, "warning");
  assert.equal(result.value[0].unread, true);
});

test("rejects duplicate ids, unknown fields, and oversized snapshots", () => {
  const duplicate = validateNotificationSnapshot([
    {
      id: "notice",
      title: "First",
      message: "",
      severity: "info",
      unread: true,
    },
    {
      id: "notice",
      title: "Second",
      message: "",
      severity: "error",
      unread: false,
    },
  ]);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.errors[0].code, "NOTIFICATIONS_DUPLICATE_ID");
  }

  const unknown = validateNotificationSnapshot([
    {
      id: "notice",
      title: "Notice",
      message: "",
      severity: "info",
      unread: true,
      html: "<b>unsafe</b>",
    },
  ]);
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.equal(unknown.errors[0].code, "NOTIFICATIONS_UNKNOWN_PROPERTY");
  }

  const oversized = validateNotificationSnapshot(
    Array.from({ length: 51 }, (_, index) => ({
      id: `notice-${index}`,
      title: `Notice ${index}`,
      message: "",
      severity: "info",
      unread: false,
    })),
  );
  assert.equal(oversized.ok, false);
  if (!oversized.ok) {
    assert.equal(oversized.errors[0].code, "NOTIFICATIONS_TOO_MANY");
  }
});

test("does not invoke notification accessors or accept sparse arrays", () => {
  let invoked = false;
  const notification = Object.defineProperties(
    {},
    {
      id: { enumerable: true, value: "notice" },
      title: {
        enumerable: true,
        get() {
          invoked = true;
          return "Notice";
        },
      },
      message: { enumerable: true, value: "" },
      severity: { enumerable: true, value: "info" },
      unread: { enumerable: true, value: true },
    },
  );
  const accessor = validateNotificationSnapshot([notification]);
  assert.equal(accessor.ok, false);
  if (!accessor.ok) {
    assert.equal(accessor.errors[0].code, "NOTIFICATIONS_ACCESSOR");
  }
  assert.equal(invoked, false);

  const sparse = validateNotificationSnapshot(new Array(1));
  assert.equal(sparse.ok, false);
  if (!sparse.ok) {
    assert.equal(sparse.errors[0].code, "NOTIFICATIONS_INVALID_ITEM");
  }
});
