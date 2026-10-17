import assert from "node:assert/strict";
import { test } from "node:test";
import { createGestureActionProfile } from "../dist/gesture-profile.js";

test("gesture profile is disabled before intent inspection and rechecks host authority", async () => {
  let enabled = false;
  let allowed = false;
  const calls = [];
  const profile = createGestureActionProfile({
    isEnabled: () => enabled,
    actions: { left: "next", right: "previous" },
    authorize: () => allowed,
    dispatch: (id) => calls.push(id),
  });
  const hostile = new Proxy(
    {},
    {
      get() {
        assert.fail("disabled intent inspected");
      },
    },
  );
  assert.equal((await profile.handle(hostile)).error.code, "GESTURE_DISABLED");
  enabled = true;
  const intent = { direction: "left", pointerType: "touch", distance: 100 };
  assert.equal((await profile.handle(intent)).error.code, "GESTURE_DENIED");
  allowed = true;
  assert.deepEqual(await profile.handle(intent), {
    ok: true,
    actionId: "next",
  });
  allowed = false;
  assert.equal((await profile.handle(intent)).error.code, "GESTURE_DENIED");
  assert.deepEqual(calls, ["next"]);
  assert.equal(
    (await profile.handle({ direction: "up" })).error.code,
    "GESTURE_INVALID_PROFILE",
  );
});

test("invalid profiles and host errors produce structured failures", async () => {
  for (const policy of [
    { actions: { left: "bad:action" }, authorize: () => true, dispatch() {} },
    {
      actions: { left: "next" },
      authorize() {
        throw new Error("host");
      },
      dispatch() {},
    },
    {
      actions: { left: "next" },
      authorize: () => true,
      dispatch() {
        throw new Error("host");
      },
    },
  ]) {
    assert.equal(
      (
        await createGestureActionProfile({
          isEnabled: () => true,
          ...policy,
        }).handle({ direction: "left" })
      ).ok,
      false,
    );
  }
});
