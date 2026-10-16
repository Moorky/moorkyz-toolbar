export interface CapabilityDescriptor<Value> {
  readonly id: string;
  readonly owner: string;
  readonly value: Value;
}

export type CapabilityErrorCode =
  | "CAPABILITY_INVALID_ID"
  | "CAPABILITY_INVALID_OWNER"
  | "CAPABILITY_DUPLICATE"
  | "CAPABILITY_OVERRIDE_DENIED"
  | "CAPABILITY_OWNER_MISMATCH"
  | "CAPABILITY_NOT_FOUND"
  | "CAPABILITY_TRANSACTION_ABORTED";

export interface CapabilityError {
  readonly code: CapabilityErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type CapabilityResult<Value> =
  | {
      readonly ok: true;
      readonly version: number;
      readonly records: readonly CapabilityDescriptor<Value>[];
    }
  | { readonly ok: false; readonly error: CapabilityError };

export interface CapabilityTransaction<Value> {
  register(descriptor: CapabilityDescriptor<Value>): void;
  unregister(id: string, owner: string): void;
}

export interface CapabilityRegistryOptions<Value> {
  readonly authorizeOverride?: (
    current: CapabilityDescriptor<Value>,
    replacement: CapabilityDescriptor<Value>,
  ) => boolean;
}

export interface CapabilityRegistry<Value> {
  readonly version: number;
  get(id: string): CapabilityDescriptor<Value> | undefined;
  list(): readonly CapabilityDescriptor<Value>[];
  transact(
    operation: (transaction: CapabilityTransaction<Value>) => void,
  ): CapabilityResult<Value>;
}

const CAPABILITY_ID_PATTERN = /^([a-z][a-z0-9-]{0,62}):([a-z][a-z0-9-]{0,62})$/;

function failure<Value>(
  code: CapabilityErrorCode,
  message: string,
  cause?: unknown,
): CapabilityResult<Value> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(cause === undefined ? {} : { cause }),
    },
  };
}

function validateDescriptor<Value>(
  descriptor: CapabilityDescriptor<Value>,
): CapabilityError | null {
  if (!CAPABILITY_ID_PATTERN.test(descriptor.id)) {
    return {
      code: "CAPABILITY_INVALID_ID",
      message: "Capability ids must use a valid namespace:name form.",
    };
  }
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(descriptor.owner)) {
    return {
      code: "CAPABILITY_INVALID_OWNER",
      message: "Capability owners must use a valid namespace.",
    };
  }
  return null;
}

function orderedRecords<Value>(
  entries: ReadonlyMap<string, CapabilityDescriptor<Value>>,
): readonly CapabilityDescriptor<Value>[] {
  return Object.freeze(
    Array.from(entries.values()).sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    ),
  );
}

export function createCapabilityRegistry<Value>(
  options: CapabilityRegistryOptions<Value> = {},
): CapabilityRegistry<Value> {
  let entries = new Map<string, CapabilityDescriptor<Value>>();
  let currentVersion = 0;

  return {
    get version() {
      return currentVersion;
    },

    get(id) {
      return entries.get(id);
    },

    list() {
      return orderedRecords(entries);
    },

    transact(operation) {
      const draft = new Map(entries);
      const original = entries;
      const registeredInTransaction = new Set<string>();
      let issue: CapabilityError | null = null;

      const transaction: CapabilityTransaction<Value> = {
        register(descriptor) {
          if (issue !== null) return;
          const validationError = validateDescriptor(descriptor);
          if (validationError !== null) {
            issue = validationError;
            return;
          }
          if (registeredInTransaction.has(descriptor.id)) {
            issue = {
              code: "CAPABILITY_DUPLICATE",
              message: `Capability "${descriptor.id}" is registered more than once in this transaction.`,
            };
            return;
          }
          registeredInTransaction.add(descriptor.id);

          const previous = original.get(descriptor.id);
          const idNamespace = descriptor.id.slice(
            0,
            descriptor.id.indexOf(":"),
          );
          if (previous === undefined && descriptor.owner !== idNamespace) {
            issue = {
              code: "CAPABILITY_INVALID_OWNER",
              message:
                "A new capability must be registered by its own namespace.",
            };
            return;
          }
          if (
            previous !== undefined &&
            previous.owner !== descriptor.owner &&
            (options.authorizeOverride === undefined ||
              options.authorizeOverride(previous, descriptor) !== true)
          ) {
            issue = {
              code: "CAPABILITY_OVERRIDE_DENIED",
              message: `The host did not authorize replacing "${descriptor.id}".`,
            };
            return;
          }
          if (previous === undefined && draft.has(descriptor.id)) {
            issue = {
              code: "CAPABILITY_DUPLICATE",
              message: `Capability "${descriptor.id}" is already staged.`,
            };
            return;
          }

          draft.set(
            descriptor.id,
            Object.freeze({
              id: descriptor.id,
              owner: descriptor.owner,
              value: descriptor.value,
            }),
          );
        },

        unregister(id, owner) {
          if (issue !== null) return;
          const current = draft.get(id);
          if (current === undefined) {
            issue = {
              code: "CAPABILITY_NOT_FOUND",
              message: `Capability "${id}" is not registered.`,
            };
            return;
          }
          if (current.owner !== owner) {
            issue = {
              code: "CAPABILITY_OWNER_MISMATCH",
              message: `Owner "${owner}" cannot unregister "${id}".`,
            };
            return;
          }
          draft.delete(id);
        },
      };

      try {
        operation(transaction);
      } catch (cause) {
        return failure(
          "CAPABILITY_TRANSACTION_ABORTED",
          "Capability transaction was aborted without applying changes.",
          cause,
        );
      }

      if (issue !== null) {
        return { ok: false, error: issue };
      }
      if (
        draft.size !== entries.size ||
        [...draft].some(([id, value]) => entries.get(id) !== value)
      ) {
        entries = draft;
        currentVersion += 1;
      }
      return {
        ok: true,
        version: currentVersion,
        records: orderedRecords(entries),
      };
    },
  };
}
