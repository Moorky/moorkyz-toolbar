export const DIAGNOSTIC_SEVERITIES = Object.freeze([
  "debug",
  "info",
  "warning",
  "error",
] as const);

export type ToolbarDiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];

export interface ToolbarDiagnosticInput {
  readonly code: string;
  readonly severity: ToolbarDiagnosticSeverity;
  readonly message: string;
}

export interface ToolbarDiagnosticRecord extends ToolbarDiagnosticInput {
  readonly sequence: number;
}

export type DiagnosticErrorCode =
  | "DIAGNOSTICS_DISABLED"
  | "DIAGNOSTICS_DISPOSED"
  | "DIAGNOSTICS_INVALID_INPUT"
  | "DIAGNOSTICS_ACCESSOR"
  | "DIAGNOSTICS_UNKNOWN_PROPERTY"
  | "DIAGNOSTICS_REDACTION_FAILED";

export interface DiagnosticError {
  readonly code: DiagnosticErrorCode;
  readonly message: string;
}

export type DiagnosticRecordResult =
  | { readonly ok: true; readonly value: ToolbarDiagnosticRecord }
  | { readonly ok: false; readonly error: DiagnosticError };

export type DiagnosticControlResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DiagnosticError };

export interface LocalDiagnosticsRecorder {
  setEnabled(enabled: boolean): DiagnosticControlResult;
  record(input: unknown): DiagnosticRecordResult;
  snapshot(): readonly ToolbarDiagnosticRecord[];
  clear(): void;
  dispose(): void;
}

export interface LocalDiagnosticsOptions {
  readonly redact: (code: string, message: string) => string;
  readonly capacity?: number;
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const DIAGNOSTIC_KEYS = new Set(["code", "severity", "message"]);
const DEFAULT_CAPACITY = 50;
const MAX_CAPACITY = 100;
const INPUT_MESSAGE_LIMIT = 1_000;
const STORED_MESSAGE_LIMIT = 500;

function isSeverity(value: unknown): value is ToolbarDiagnosticSeverity {
  return DIAGNOSTIC_SEVERITIES.some((severity) => severity === value);
}

function error(
  code: DiagnosticErrorCode,
  message: string,
): { readonly ok: false; readonly error: DiagnosticError } {
  return { ok: false, error: { code, message } };
}

function normalizeInput(
  input: unknown,
):
  | { readonly ok: true; readonly value: ToolbarDiagnosticInput }
  | { readonly ok: false; readonly error: DiagnosticError } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: {
        code: "DIAGNOSTICS_INVALID_INPUT",
        message: "Diagnostic input must be a plain data object.",
      },
    };
  }
  const prototype = Object.getPrototypeOf(input);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.getOwnPropertySymbols(input).length > 0
  ) {
    return {
      ok: false,
      error: {
        code: "DIAGNOSTICS_INVALID_INPUT",
        message: "Diagnostic input must contain only plain string-keyed data.",
      },
    };
  }

  const values: Record<string, unknown> = Object.create(null);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(input),
  )) {
    if (!DIAGNOSTIC_KEYS.has(key)) {
      return {
        ok: false,
        error: {
          code: "DIAGNOSTICS_UNKNOWN_PROPERTY",
          message: `Unknown diagnostic property "${key}".`,
        },
      };
    }
    if (!("value" in descriptor)) {
      return {
        ok: false,
        error: {
          code: "DIAGNOSTICS_ACCESSOR",
          message: `Diagnostic property "${key}" must be a data property.`,
        },
      };
    }
    values[key] = descriptor.value;
  }

  const { code, severity, message } = values;
  if (
    typeof code !== "string" ||
    !CODE_PATTERN.test(code) ||
    !isSeverity(severity) ||
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.length > INPUT_MESSAGE_LIMIT
  ) {
    return {
      ok: false,
      error: {
        code: "DIAGNOSTICS_INVALID_INPUT",
        message: "Diagnostic code, severity, or message is invalid.",
      },
    };
  }
  return {
    ok: true,
    value: { code, severity, message },
  };
}

export function createLocalDiagnosticsRecorder(
  options: LocalDiagnosticsOptions,
): LocalDiagnosticsRecorder {
  if (typeof options?.redact !== "function") {
    throw new TypeError(
      "Local diagnostics require an explicit message redaction function.",
    );
  }
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
    throw new RangeError(
      `Diagnostic capacity must be an integer from 1 to ${MAX_CAPACITY}.`,
    );
  }

  let enabled = false;
  let disposed = false;
  let sequence = 0;
  const records: ToolbarDiagnosticRecord[] = [];

  return {
    setEnabled(value) {
      if (disposed) {
        return error(
          "DIAGNOSTICS_DISPOSED",
          "A disposed diagnostics recorder cannot be enabled.",
        );
      }
      if (typeof value !== "boolean") {
        return error(
          "DIAGNOSTICS_INVALID_INPUT",
          "Diagnostics enabled state must be boolean.",
        );
      }
      enabled = value;
      if (!enabled) {
        records.length = 0;
        sequence = 0;
      }
      return { ok: true };
    },

    record(input) {
      if (disposed) {
        return error(
          "DIAGNOSTICS_DISPOSED",
          "A disposed diagnostics recorder cannot record data.",
        );
      }
      if (!enabled) {
        return error("DIAGNOSTICS_DISABLED", "Local diagnostics are disabled.");
      }
      let normalized: ReturnType<typeof normalizeInput>;
      try {
        normalized = normalizeInput(input);
      } catch {
        return error(
          "DIAGNOSTICS_INVALID_INPUT",
          "Diagnostic input could not be inspected safely.",
        );
      }
      if (!normalized.ok) {
        return { ok: false, error: normalized.error };
      }

      let message: string;
      try {
        message = options.redact(
          normalized.value.code,
          normalized.value.message,
        );
      } catch {
        return error(
          "DIAGNOSTICS_REDACTION_FAILED",
          "Diagnostic message redaction failed; the record was discarded.",
        );
      }
      if (
        typeof message !== "string" ||
        message.trim().length === 0 ||
        message.length > STORED_MESSAGE_LIMIT
      ) {
        return error(
          "DIAGNOSTICS_REDACTION_FAILED",
          "Redacted message is invalid or too long; the record was discarded.",
        );
      }

      const record = Object.freeze({
        ...normalized.value,
        message,
        sequence: ++sequence,
      });
      records.push(record);
      if (records.length > capacity) records.shift();
      return { ok: true, value: record };
    },

    snapshot() {
      return Object.freeze(enabled ? [...records] : []);
    },

    clear() {
      records.length = 0;
      sequence = 0;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      enabled = false;
      records.length = 0;
      sequence = 0;
    },
  };
}
