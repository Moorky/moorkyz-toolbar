export type SurfaceKind = "panel" | "popover" | "dialog";
export type SurfaceDismissReason = "escape" | "outside" | "trigger" | "host";

export interface SurfaceDescriptor<FocusTarget = unknown> {
  readonly id: string;
  readonly kind: SurfaceKind;
  readonly parentId?: string;
  readonly dismissible?: boolean;
  readonly returnFocusTo?: FocusTarget;
}

export interface SurfaceEntry<FocusTarget = unknown> {
  readonly id: string;
  readonly kind: SurfaceKind;
  readonly parentId: string | null;
  readonly dismissible: boolean;
  readonly returnFocusTo: FocusTarget | undefined;
}

export interface SurfaceSnapshot<FocusTarget = unknown> {
  readonly version: number;
  readonly entries: readonly SurfaceEntry<FocusTarget>[];
}

export type SurfaceErrorCode =
  | "SURFACE_INVALID_ID"
  | "SURFACE_INVALID_KIND"
  | "SURFACE_DUPLICATE"
  | "SURFACE_INVALID_PARENT"
  | "SURFACE_DEPTH_LIMIT"
  | "SURFACE_NOT_FOUND"
  | "SURFACE_NOT_TOP"
  | "SURFACE_NOT_DISMISSIBLE";

export interface SurfaceError {
  readonly code: SurfaceErrorCode;
  readonly message: string;
}

export type SurfaceResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: SurfaceError };

export interface ClosedSurface<FocusTarget = unknown> {
  readonly closed: SurfaceEntry<FocusTarget>;
  readonly restoreFocusTo: FocusTarget | undefined;
  readonly snapshot: SurfaceSnapshot<FocusTarget>;
}

export interface SurfaceStack<FocusTarget = unknown> {
  readonly maxDepth: number;
  snapshot(): SurfaceSnapshot<FocusTarget>;
  open(
    descriptor: SurfaceDescriptor<FocusTarget>,
  ): SurfaceResult<SurfaceSnapshot<FocusTarget>>;
  close(
    id: string,
    reason: SurfaceDismissReason,
  ): SurfaceResult<ClosedSurface<FocusTarget>>;
  dismissTop(
    reason: Exclude<SurfaceDismissReason, "host">,
  ): SurfaceResult<ClosedSurface<FocusTarget>>;
}

const SURFACE_ID_PATTERN = /^[a-z][a-z0-9-]{0,62}:[a-z][a-z0-9-]{0,62}$/;

function surfaceFailure<Value>(
  code: SurfaceErrorCode,
  message: string,
): SurfaceResult<Value> {
  return { ok: false, error: { code, message } };
}

export function createSurfaceStack<FocusTarget = unknown>(
  options: {
    readonly maxDepth?: number;
  } = {},
): SurfaceStack<FocusTarget> {
  const maxDepth = options.maxDepth ?? 4;
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new RangeError("Surface stack maxDepth must be a positive integer.");
  }

  let version = 0;
  const entries: SurfaceEntry<FocusTarget>[] = [];

  function snapshot(): SurfaceSnapshot<FocusTarget> {
    return Object.freeze({
      version,
      entries: Object.freeze(entries.slice()),
    });
  }

  function closeTop(
    reason: SurfaceDismissReason,
  ): SurfaceResult<ClosedSurface<FocusTarget>> {
    const top = entries[entries.length - 1];
    if (top === undefined) {
      return surfaceFailure("SURFACE_NOT_FOUND", "There is no open surface.");
    }
    if (reason !== "host" && !top.dismissible) {
      return surfaceFailure(
        "SURFACE_NOT_DISMISSIBLE",
        `Surface "${top.id}" cannot be dismissed by ${reason}.`,
      );
    }

    entries.pop();
    version += 1;
    return {
      ok: true,
      value: {
        closed: top,
        restoreFocusTo: top.returnFocusTo,
        snapshot: snapshot(),
      },
    };
  }

  return {
    maxDepth,

    snapshot,

    open(descriptor) {
      if (!SURFACE_ID_PATTERN.test(descriptor.id)) {
        return surfaceFailure(
          "SURFACE_INVALID_ID",
          "Surface ids must use a valid namespace:name form.",
        );
      }
      if (
        descriptor.kind !== "panel" &&
        descriptor.kind !== "popover" &&
        descriptor.kind !== "dialog"
      ) {
        return surfaceFailure(
          "SURFACE_INVALID_KIND",
          "Surface kind must be a panel, popover, or dialog.",
        );
      }
      if (entries.some(({ id }) => id === descriptor.id)) {
        return surfaceFailure(
          "SURFACE_DUPLICATE",
          `Surface "${descriptor.id}" is already open.`,
        );
      }
      if (entries.length >= maxDepth) {
        return surfaceFailure(
          "SURFACE_DEPTH_LIMIT",
          `Surface stack limit of ${maxDepth} has been reached.`,
        );
      }

      const parent = entries[entries.length - 1];
      if (
        (parent === undefined && descriptor.parentId !== undefined) ||
        (parent !== undefined && descriptor.parentId !== parent.id)
      ) {
        return surfaceFailure(
          "SURFACE_INVALID_PARENT",
          parent === undefined
            ? "A root surface cannot declare a parent."
            : `Nested surfaces must identify "${parent.id}" as their parent.`,
        );
      }

      entries.push(
        Object.freeze({
          id: descriptor.id,
          kind: descriptor.kind,
          parentId: parent?.id ?? null,
          dismissible: descriptor.dismissible ?? true,
          returnFocusTo: descriptor.returnFocusTo,
        }),
      );
      version += 1;
      return { ok: true, value: snapshot() };
    },

    close(id, reason) {
      const top = entries[entries.length - 1];
      if (top === undefined || !entries.some((entry) => entry.id === id)) {
        return surfaceFailure(
          "SURFACE_NOT_FOUND",
          `Surface "${id}" is not open.`,
        );
      }
      if (top.id !== id) {
        return surfaceFailure(
          "SURFACE_NOT_TOP",
          `Surface "${id}" must be closed after its child surfaces.`,
        );
      }
      return closeTop(reason);
    },

    dismissTop(reason) {
      return closeTop(reason);
    },
  };
}
