export const TASK_STATUSES = Object.freeze([
  "queued",
  "running",
  "completed",
  "failed",
] as const);

export type ToolbarTaskStatus = (typeof TASK_STATUSES)[number];

export interface ToolbarTask {
  readonly id: string;
  readonly label: string;
  readonly status: ToolbarTaskStatus;
}

export type TaskDiagnosticCode =
  | "TASKS_INVALID_TYPE"
  | "TASKS_TOO_MANY"
  | "TASKS_INVALID_ITEM"
  | "TASKS_UNKNOWN_PROPERTY"
  | "TASKS_ACCESSOR"
  | "TASKS_DUPLICATE_ID";

export interface TaskDiagnostic {
  readonly code: TaskDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export type TaskSnapshotValidation =
  | { readonly ok: true; readonly value: readonly ToolbarTask[] }
  | { readonly ok: false; readonly errors: readonly TaskDiagnostic[] };

const MAX_TASKS = 100;
const TASK_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const TASK_KEYS = new Set(["id", "label", "status"]);

function isTaskStatus(value: unknown): value is ToolbarTaskStatus {
  return TASK_STATUSES.some((status) => status === value);
}

function diagnostic(
  code: TaskDiagnosticCode,
  path: string,
  message: string,
): TaskDiagnostic {
  return { code, path, message };
}

export function validateTaskSnapshot(input: unknown): TaskSnapshotValidation {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      errors: [
        diagnostic(
          "TASKS_INVALID_TYPE",
          "",
          "Task snapshots must be arrays of plain data objects.",
        ),
      ],
    };
  }
  if (input.length > MAX_TASKS) {
    return {
      ok: false,
      errors: [
        diagnostic(
          "TASKS_TOO_MANY",
          "",
          `Task snapshots may contain at most ${MAX_TASKS} items.`,
        ),
      ],
    };
  }

  const errors: TaskDiagnostic[] = [];
  const seen = new Set<string>();
  const tasks: ToolbarTask[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const path = `[${index}]`;
    const entry = Object.getOwnPropertyDescriptor(input, String(index));
    if (entry === undefined || !("value" in entry)) {
      errors.push(
        diagnostic(
          entry === undefined ? "TASKS_INVALID_ITEM" : "TASKS_ACCESSOR",
          path,
          "Each task must be an own data value in the snapshot.",
        ),
      );
      continue;
    }
    const task = entry.value;
    if (
      typeof task !== "object" ||
      task === null ||
      Array.isArray(task) ||
      (Object.getPrototypeOf(task) !== Object.prototype &&
        Object.getPrototypeOf(task) !== null) ||
      Object.getOwnPropertySymbols(task).length > 0
    ) {
      errors.push(
        diagnostic(
          "TASKS_INVALID_ITEM",
          path,
          "Each task must be a plain data object.",
        ),
      );
      continue;
    }

    const values: Record<string, unknown> = Object.create(null);
    let invalid = false;
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(task),
    )) {
      if (!TASK_KEYS.has(key)) {
        errors.push(
          diagnostic(
            "TASKS_UNKNOWN_PROPERTY",
            `${path}.${key}`,
            `Unknown task property "${key}".`,
          ),
        );
        invalid = true;
      } else if (!("value" in descriptor)) {
        errors.push(
          diagnostic(
            "TASKS_ACCESSOR",
            `${path}.${key}`,
            "Task properties must be data properties.",
          ),
        );
        invalid = true;
      } else {
        values[key] = descriptor.value;
      }
    }

    const { id, label, status } = values;
    if (
      invalid ||
      typeof id !== "string" ||
      !TASK_ID_PATTERN.test(id) ||
      typeof label !== "string" ||
      label.trim().length === 0 ||
      label.length > 200 ||
      !isTaskStatus(status)
    ) {
      if (!invalid) {
        errors.push(
          diagnostic(
            "TASKS_INVALID_ITEM",
            path,
            "Task id, label, or status is invalid.",
          ),
        );
      }
      continue;
    }
    if (seen.has(id)) {
      errors.push(
        diagnostic(
          "TASKS_DUPLICATE_ID",
          `${path}.id`,
          `Task id "${id}" appears more than once.`,
        ),
      );
      continue;
    }
    seen.add(id);
    tasks.push(Object.freeze({ id, label, status }));
  }

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors) };
  }
  return { ok: true, value: Object.freeze(tasks) };
}
