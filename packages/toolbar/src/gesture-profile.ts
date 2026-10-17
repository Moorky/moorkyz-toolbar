import type { GestureIntent } from "./gestures.js";

export type GestureActionResult =
  | { readonly ok: true; readonly actionId: string }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          | "GESTURE_DISABLED"
          | "GESTURE_INVALID_PROFILE"
          | "GESTURE_DENIED"
          | "GESTURE_FAILED";
        readonly message: string;
      };
    };

export function createGestureActionProfile(policy: {
  readonly isEnabled: () => boolean;
  readonly actions: Readonly<{ left: string; right: string }>;
  readonly authorize: (actionId: string) => boolean;
  readonly dispatch: (actionId: string) => void | Promise<void>;
}) {
  return {
    async handle(intent: GestureIntent): Promise<GestureActionResult> {
      const fail = (
        code: Extract<GestureActionResult, { ok: false }>["error"]["code"],
        message: string,
      ): GestureActionResult => ({ ok: false, error: { code, message } });
      try {
        if (policy.isEnabled() !== true)
          return fail("GESTURE_DISABLED", "Gesture actions are disabled.");
        if (intent?.direction !== "left" && intent?.direction !== "right")
          return fail("GESTURE_INVALID_PROFILE", "Unknown gesture direction.");
        const actionId = policy.actions[intent.direction];
        if (
          typeof actionId !== "string" ||
          !/^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(actionId)
        ) {
          return fail(
            "GESTURE_INVALID_PROFILE",
            "Gesture actions require valid host action IDs.",
          );
        }
        if (policy.authorize(actionId) !== true)
          return fail("GESTURE_DENIED", "Host denied the gesture action.");
        await policy.dispatch(actionId);
        return { ok: true, actionId };
      } catch {
        return fail(
          "GESTURE_FAILED",
          "Host gesture policy or dispatch failed.",
        );
      }
    },
  };
}
