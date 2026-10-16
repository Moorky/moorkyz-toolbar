export const NOTIFICATION_SEVERITIES = Object.freeze([
  "info",
  "success",
  "warning",
  "error",
] as const);

export type ToolbarNotificationSeverity =
  (typeof NOTIFICATION_SEVERITIES)[number];

export interface ToolbarNotification {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly severity: ToolbarNotificationSeverity;
  readonly unread: boolean;
}

export type NotificationDiagnosticCode =
  | "NOTIFICATIONS_INVALID_TYPE"
  | "NOTIFICATIONS_TOO_MANY"
  | "NOTIFICATIONS_INVALID_ITEM"
  | "NOTIFICATIONS_UNKNOWN_PROPERTY"
  | "NOTIFICATIONS_ACCESSOR"
  | "NOTIFICATIONS_DUPLICATE_ID";

export interface NotificationDiagnostic {
  readonly code: NotificationDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export type NotificationSnapshotValidation =
  | {
      readonly ok: true;
      readonly value: readonly ToolbarNotification[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly NotificationDiagnostic[];
    };

const MAX_NOTIFICATIONS = 50;
const NOTIFICATION_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const NOTIFICATION_KEYS = new Set([
  "id",
  "title",
  "message",
  "severity",
  "unread",
]);

function isSeverity(value: unknown): value is ToolbarNotificationSeverity {
  return NOTIFICATION_SEVERITIES.some((severity) => severity === value);
}

function diagnostic(
  code: NotificationDiagnosticCode,
  path: string,
  message: string,
): NotificationDiagnostic {
  return { code, path, message };
}

export function validateNotificationSnapshot(
  input: unknown,
): NotificationSnapshotValidation {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      errors: [
        diagnostic(
          "NOTIFICATIONS_INVALID_TYPE",
          "",
          "Notification snapshots must be arrays of plain data objects.",
        ),
      ],
    };
  }
  if (input.length > MAX_NOTIFICATIONS) {
    return {
      ok: false,
      errors: [
        diagnostic(
          "NOTIFICATIONS_TOO_MANY",
          "",
          `Notification snapshots may contain at most ${MAX_NOTIFICATIONS} items.`,
        ),
      ],
    };
  }

  const errors: NotificationDiagnostic[] = [];
  const seen = new Set<string>();
  const notifications: ToolbarNotification[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const path = `[${index}]`;
    const entry = Object.getOwnPropertyDescriptor(input, String(index));
    if (entry === undefined || !("value" in entry)) {
      errors.push(
        diagnostic(
          entry === undefined
            ? "NOTIFICATIONS_INVALID_ITEM"
            : "NOTIFICATIONS_ACCESSOR",
          path,
          "Each notification must be an own data value in the snapshot.",
        ),
      );
      continue;
    }
    const notification = entry.value;
    if (
      typeof notification !== "object" ||
      notification === null ||
      Array.isArray(notification) ||
      (Object.getPrototypeOf(notification) !== Object.prototype &&
        Object.getPrototypeOf(notification) !== null) ||
      Object.getOwnPropertySymbols(notification).length > 0
    ) {
      errors.push(
        diagnostic(
          "NOTIFICATIONS_INVALID_ITEM",
          path,
          "Each notification must be a plain data object.",
        ),
      );
      continue;
    }

    const values: Record<string, unknown> = Object.create(null);
    let invalid = false;
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(notification),
    )) {
      if (!NOTIFICATION_KEYS.has(key)) {
        errors.push(
          diagnostic(
            "NOTIFICATIONS_UNKNOWN_PROPERTY",
            `${path}.${key}`,
            `Unknown notification property "${key}".`,
          ),
        );
        invalid = true;
      } else if (!("value" in descriptor)) {
        errors.push(
          diagnostic(
            "NOTIFICATIONS_ACCESSOR",
            `${path}.${key}`,
            "Notification properties must be data properties.",
          ),
        );
        invalid = true;
      } else {
        values[key] = descriptor.value;
      }
    }

    const { id, title, message, severity, unread } = values;
    if (
      invalid ||
      typeof id !== "string" ||
      !NOTIFICATION_ID_PATTERN.test(id) ||
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.length > 120 ||
      typeof message !== "string" ||
      message.length > 500 ||
      !isSeverity(severity) ||
      typeof unread !== "boolean"
    ) {
      if (!invalid) {
        errors.push(
          diagnostic(
            "NOTIFICATIONS_INVALID_ITEM",
            path,
            "Notification id, text, severity, or unread state is invalid.",
          ),
        );
      }
      continue;
    }
    if (seen.has(id)) {
      errors.push(
        diagnostic(
          "NOTIFICATIONS_DUPLICATE_ID",
          `${path}.id`,
          `Notification id "${id}" appears more than once.`,
        ),
      );
      continue;
    }
    seen.add(id);
    notifications.push(Object.freeze({ id, title, message, severity, unread }));
  }

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors) };
  }
  return { ok: true, value: Object.freeze(notifications) };
}
