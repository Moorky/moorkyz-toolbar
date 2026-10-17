export type RecoveryCode =
  | "RECOVERY_DISABLED"
  | "RECOVERY_DISPOSED"
  | "RECOVERY_INVALID_JOB"
  | "RECOVERY_DUPLICATE"
  | "RECOVERY_FULL"
  | "RECOVERY_BUSY"
  | "RECOVERY_OFFLINE"
  | "RECOVERY_DENIED"
  | "RECOVERY_AUTHORIZATION_FAILED"
  | "RECOVERY_CANCELLED"
  | "RECOVERY_FAILED"
  | "RECOVERY_CIRCUIT_OPEN";

export type RecoveryResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: { readonly code: RecoveryCode; readonly message: string };
    };

export interface RecoveryJob {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly safeToRetry: true;
  readonly authorize: (signal: AbortSignal) => boolean | Promise<boolean>;
  readonly execute: (
    idempotencyKey: string,
    signal: AbortSignal,
  ) => void | Promise<void>;
}

export interface RecoveryQueue {
  readonly size: number;
  readonly circuitOpen: boolean;
  setEnabled(enabled: boolean): RecoveryResult;
  enqueue(job: RecoveryJob): RecoveryResult;
  drain(online: boolean): Promise<RecoveryResult>;
  resetCircuit(): RecoveryResult;
  dispose(): void;
}

function failure(code: RecoveryCode, message: string): RecoveryResult {
  return { ok: false, error: { code, message } };
}

// Race cancellation even when a host ignores its signal; do not retain listeners.
async function cancellable<T>(
  work: () => T | Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let onAbort: (() => void) | undefined;
  const cancellation = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return work();
      }),
      cancellation,
    ]);
  } finally {
    if (onAbort !== undefined) signal.removeEventListener("abort", onAbort);
  }
}

/**
 * In-memory only. Hosts explicitly drain; no connectivity listeners, timers,
 * persistence, automatic replay, or default authorization.
 */
export function createRecoveryQueue(
  options: { readonly capacity?: number; readonly maxAttempts?: number } = {},
): RecoveryQueue {
  const capacity = options.capacity ?? 50;
  const maxAttempts = options.maxAttempts ?? 3;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    throw new RangeError("Recovery capacity must be from 1 to 100.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new RangeError("Recovery attempts must be from 1 to 5.");
  }
  let enabled = false;
  let disposed = false;
  let circuitOpen = false;
  let active: AbortController | null = null;
  const pending: { job: RecoveryJob; attempts: number }[] = [];
  const seen = new Set<string>();
  function gate(): RecoveryResult {
    if (disposed) return failure("RECOVERY_DISPOSED", "Recovery is disposed.");
    if (!enabled) return failure("RECOVERY_DISABLED", "Recovery is disabled.");
    return { ok: true };
  }
  function clear(): void {
    active?.abort();
    pending.length = 0;
    seen.clear();
    circuitOpen = false;
  }
  return {
    get size() {
      return pending.length;
    },
    get circuitOpen() {
      return circuitOpen;
    },
    setEnabled(value) {
      if (disposed) return gate();
      if (typeof value !== "boolean") {
        return failure("RECOVERY_INVALID_JOB", "Enabled must be boolean.");
      }
      enabled = value;
      if (!enabled) clear();
      return { ok: true };
    },
    enqueue(job) {
      const allowed = gate();
      if (!allowed.ok) return allowed;
      if (
        !job ||
        typeof job.id !== "string" ||
        !/^[a-z][a-z0-9-]{0,62}:[a-z][a-z0-9-]{0,62}$/.test(job.id) ||
        typeof job.idempotencyKey !== "string" ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(job.idempotencyKey) ||
        job.safeToRetry !== true ||
        typeof job.authorize !== "function" ||
        typeof job.execute !== "function"
      ) {
        return failure(
          "RECOVERY_INVALID_JOB",
          "Jobs require explicit safe retry, identity, authorization and execution.",
        );
      }
      if (seen.has(job.idempotencyKey)) {
        return failure(
          "RECOVERY_DUPLICATE",
          "Idempotency key already admitted.",
        );
      }
      if (seen.size >= capacity) {
        return failure(
          "RECOVERY_FULL",
          "Session capacity reached; disable to clear the session explicitly.",
        );
      }
      seen.add(job.idempotencyKey);
      pending.push({ job: Object.freeze({ ...job }), attempts: 0 });
      return { ok: true };
    },
    async drain(online) {
      const allowed = gate();
      if (!allowed.ok) return allowed;
      if (active !== null)
        return failure("RECOVERY_BUSY", "A drain is active.");
      if (online !== true) {
        return failure(
          "RECOVERY_OFFLINE",
          "Host has not confirmed connectivity.",
        );
      }
      if (circuitOpen) {
        return failure(
          "RECOVERY_CIRCUIT_OPEN",
          "Explicit circuit reset required.",
        );
      }
      const controller = new AbortController();
      active = controller;
      try {
        while (pending.length > 0) {
          const entry = pending[0]!;
          let authorized: boolean;
          try {
            authorized = await cancellable(
              () => entry.job.authorize(controller.signal),
              controller.signal,
            );
          } catch {
            if (controller.signal.aborted) {
              return failure("RECOVERY_CANCELLED", "Recovery was cancelled.");
            }
            pending.shift();
            return failure(
              "RECOVERY_AUTHORIZATION_FAILED",
              "Host authorization failed; the job was removed without retry.",
            );
          }
          if (authorized !== true) {
            pending.shift();
            return failure(
              "RECOVERY_DENIED",
              "Current host authorization denied the job; it was removed.",
            );
          }
          entry.attempts++;
          try {
            await cancellable(
              () =>
                entry.job.execute(entry.job.idempotencyKey, controller.signal),
              controller.signal,
            );
          } catch {
            if (controller.signal.aborted) {
              return failure("RECOVERY_CANCELLED", "Recovery was cancelled.");
            }
            if (entry.attempts >= maxAttempts) {
              pending.shift();
              circuitOpen = true;
            }
            return failure(
              "RECOVERY_FAILED",
              "Host execution failed; only an explicit later drain may retry.",
            );
          }
          pending.shift();
        }
        return { ok: true };
      } finally {
        if (active === controller) active = null;
      }
    },
    resetCircuit() {
      const allowed = gate();
      if (!allowed.ok) return allowed;
      circuitOpen = false;
      return { ok: true };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      enabled = false;
      clear();
    },
  };
}
