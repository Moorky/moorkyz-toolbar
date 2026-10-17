export interface ToolbarDiscoveryHint {
  readonly id: string;
  readonly title: string;
  readonly message: string;
}

export type DiscoveryDiagnosticCode =
  | "DISCOVERY_INVALID_TYPE"
  | "DISCOVERY_TOO_MANY"
  | "DISCOVERY_INVALID_HINT"
  | "DISCOVERY_UNKNOWN_PROPERTY"
  | "DISCOVERY_ACCESSOR"
  | "DISCOVERY_DUPLICATE_ID";

export interface DiscoveryDiagnostic {
  readonly code: DiscoveryDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export type DiscoverySnapshotValidation =
  | {
      readonly ok: true;
      readonly value: readonly ToolbarDiscoveryHint[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly DiscoveryDiagnostic[];
    };

const MAX_HINTS = 10;
const HINT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const HINT_KEYS = new Set(["id", "title", "message"]);

function diagnostic(
  code: DiscoveryDiagnosticCode,
  path: string,
  message: string,
): DiscoveryDiagnostic {
  return { code, path, message };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateDiscoverySnapshot(
  input: unknown,
): DiscoverySnapshotValidation {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      errors: [
        diagnostic(
          "DISCOVERY_INVALID_TYPE",
          "",
          "Discovery hints must be an array of plain data objects.",
        ),
      ],
    };
  }
  if (input.length > MAX_HINTS) {
    return {
      ok: false,
      errors: [
        diagnostic(
          "DISCOVERY_TOO_MANY",
          "",
          `At most ${MAX_HINTS} discovery hints may be supplied.`,
        ),
      ],
    };
  }

  const errors: DiscoveryDiagnostic[] = [];
  const seen = new Set<string>();
  const hints: ToolbarDiscoveryHint[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const path = `[${index}]`;
    const entry = Object.getOwnPropertyDescriptor(input, String(index));
    if (entry === undefined || !("value" in entry)) {
      errors.push(
        diagnostic(
          entry === undefined ? "DISCOVERY_INVALID_HINT" : "DISCOVERY_ACCESSOR",
          path,
          "Each hint must be an own data value in the snapshot.",
        ),
      );
      continue;
    }
    const hint = entry.value;
    if (!isPlainRecord(hint) || Object.getOwnPropertySymbols(hint).length > 0) {
      errors.push(
        diagnostic(
          "DISCOVERY_INVALID_HINT",
          path,
          "Each hint must be a plain data object.",
        ),
      );
      continue;
    }

    const values: Record<string, unknown> = Object.create(null);
    let invalid = false;
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(hint),
    )) {
      if (!HINT_KEYS.has(key)) {
        errors.push(
          diagnostic(
            "DISCOVERY_UNKNOWN_PROPERTY",
            `${path}.${key}`,
            `Unknown hint property "${key}".`,
          ),
        );
        invalid = true;
      } else if (!("value" in descriptor)) {
        errors.push(
          diagnostic(
            "DISCOVERY_ACCESSOR",
            `${path}.${key}`,
            "Hint properties must be data properties.",
          ),
        );
        invalid = true;
      } else {
        values[key] = descriptor.value;
      }
    }

    const { id, title, message } = values;
    if (
      invalid ||
      typeof id !== "string" ||
      !HINT_ID_PATTERN.test(id) ||
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.length > 100 ||
      typeof message !== "string" ||
      message.trim().length === 0 ||
      message.length > 400
    ) {
      if (!invalid) {
        errors.push(
          diagnostic(
            "DISCOVERY_INVALID_HINT",
            path,
            "Hint id, title, or message is invalid.",
          ),
        );
      }
      continue;
    }
    if (seen.has(id)) {
      errors.push(
        diagnostic(
          "DISCOVERY_DUPLICATE_ID",
          `${path}.id`,
          `Hint id "${id}" appears more than once.`,
        ),
      );
      continue;
    }
    seen.add(id);
    hints.push(Object.freeze({ id, title, message }));
  }

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors) };
  }
  return { ok: true, value: Object.freeze(hints) };
}
