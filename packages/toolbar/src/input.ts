export interface ShortcutDefinition {
  readonly id: string;
  readonly key: string;
  readonly scope?: string;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  readonly metaKey?: boolean;
  readonly priority?: number;
  readonly execute: (event: KeyboardEvent) => void | Promise<void>;
}

export interface NormalizedShortcut extends ShortcutDefinition {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly priority: number;
}

export type ShortcutErrorCode =
  | "SHORTCUT_INVALID_ID"
  | "SHORTCUT_INVALID_KEY"
  | "SHORTCUT_RESERVED"
  | "SHORTCUT_INVALID_SCOPE"
  | "SHORTCUT_INVALID_PRIORITY"
  | "SHORTCUT_DUPLICATE_ID"
  | "SHORTCUT_AUTHORIZATION_DENIED"
  | "SHORTCUT_AUTHORIZATION_FAILED"
  | "SHORTCUT_MANAGER_DISPOSED";

export interface ShortcutError {
  readonly code: ShortcutErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type ShortcutRegistrationResult =
  | {
      readonly ok: true;
      readonly value: { readonly unregister: () => void };
    }
  | { readonly ok: false; readonly error: ShortcutError };

export interface ShortcutDiagnostic {
  readonly code: "SHORTCUT_CONFLICT" | "SHORTCUT_REVOKED";
  readonly shortcut: string;
  readonly registrations: readonly string[];
}

export interface ShortcutManagerOptions {
  readonly getActiveScope: () => string | undefined;
  readonly authorize: (shortcut: NormalizedShortcut) => boolean;
  readonly onDiagnostic: (diagnostic: ShortcutDiagnostic) => void;
  readonly onError: (error: unknown, shortcutId: string) => void;
}

export interface ShortcutManager {
  readonly size: number;
  register(definition: ShortcutDefinition): ShortcutRegistrationResult;
  dispose(): void;
}

interface RegisteredShortcut {
  readonly definition: NormalizedShortcut;
  readonly combination: string;
}

const NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{0,62}:[a-z][a-z0-9-]{0,62}$/;
const NAMED_KEYS = new Set([
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowup",
  "end",
  "enter",
  "escape",
  "home",
  "page down",
  "page up",
]);
const RESERVED_COMBINATIONS = new Set([
  "ctrl+o",
  "ctrl+p",
  "ctrl+r",
  "ctrl+s",
  "ctrl+shift+c",
  "ctrl+shift+i",
  "ctrl+shift+j",
  "ctrl+shift+n",
  "ctrl+shift+t",
  "ctrl+tab",
  "ctrl+u",
  "ctrl+w",
  "ctrl+shift+tab",
  "ctrl+t",
  "ctrl+n",
  "ctrl+l",
  "alt+arrowleft",
  "alt+arrowright",
  "alt+f4",
  "alt+tab",
  "meta+arrowleft",
  "meta+arrowright",
  "meta+n",
  "meta+o",
  "meta+p",
  "meta+q",
  "meta+r",
  "meta+s",
  "meta+shift+i",
  "meta+shift+j",
  "meta+t",
  "meta+tab",
  "meta+u",
  "meta+w",
]);

function normalizeKey(key: string): string | null {
  if (/^[a-z0-9]$/i.test(key)) return key.toLowerCase();
  const normalized = key.toLowerCase();
  return NAMED_KEYS.has(normalized) ? normalized : null;
}

function combinationOf(shortcut: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
}): string {
  return [
    ...(shortcut.ctrlKey ? ["ctrl"] : []),
    ...(shortcut.altKey ? ["alt"] : []),
    ...(shortcut.metaKey ? ["meta"] : []),
    ...(shortcut.shiftKey ? ["shift"] : []),
    shortcut.key.toLowerCase(),
  ].join("+");
}

function failed(
  code: ShortcutErrorCode,
  message: string,
  cause?: unknown,
): ShortcutRegistrationResult {
  return {
    ok: false,
    error: { code, message, ...(cause === undefined ? {} : { cause }) },
  };
}

function isEditableTarget(event: KeyboardEvent, target: HTMLElement): boolean {
  const view = target.ownerDocument.defaultView;
  const eventTarget = event.target;
  if (view === null || !(eventTarget instanceof view.Element)) return false;
  const tagName = eventTarget.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  return (
    eventTarget instanceof view.HTMLElement &&
    (eventTarget.isContentEditable ||
      eventTarget.closest('[contenteditable="true"]') !== null)
  );
}

export function createShortcutManager(
  target: HTMLElement,
  options: ShortcutManagerOptions,
): ShortcutManager {
  const registrations = new Map<string, RegisteredShortcut>();
  let disposed = false;
  let listening = false;

  const dispatch = (event: KeyboardEvent) => {
    if (
      disposed ||
      event.defaultPrevented ||
      event.repeat ||
      isEditableTarget(event, target)
    ) {
      return;
    }

    const key = normalizeKey(event.key);
    if (key === null) return;
    const combination = combinationOf({
      key,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
    });
    let activeScope: string | undefined;
    try {
      activeScope = options.getActiveScope();
    } catch (cause) {
      options.onError(cause, "host:active-scope");
      return;
    }
    const candidates = Array.from(registrations.values()).filter(
      ({ definition, combination: registered }) =>
        registered === combination &&
        (definition.scope === undefined || definition.scope === activeScope),
    );
    if (candidates.length === 0) return;

    const scoped = candidates.filter(
      ({ definition }) => definition.scope === activeScope,
    );
    const inScope = scoped.length > 0 ? scoped : candidates;
    const highestPriority = Math.max(
      ...inScope.map(({ definition }) => definition.priority),
    );
    const winners = inScope.filter(
      ({ definition }) => definition.priority === highestPriority,
    );
    if (winners.length !== 1) {
      options.onDiagnostic({
        code: "SHORTCUT_CONFLICT",
        shortcut: combination,
        registrations: Object.freeze(
          winners.map(({ definition }) => definition.id).sort(),
        ),
      });
      return;
    }

    const winner = winners[0];
    if (winner === undefined) return;
    let authorized: boolean;
    try {
      authorized = options.authorize(winner.definition);
    } catch (cause) {
      options.onError(cause, winner.definition.id);
      return;
    }
    if (!authorized) {
      options.onDiagnostic({
        code: "SHORTCUT_REVOKED",
        shortcut: combination,
        registrations: Object.freeze([winner.definition.id]),
      });
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    try {
      void Promise.resolve(winner.definition.execute(event)).catch(
        (cause: unknown) => options.onError(cause, winner.definition.id),
      );
    } catch (cause) {
      options.onError(cause, winner.definition.id);
    }
  };

  return {
    get size() {
      return registrations.size;
    },

    register(definition) {
      if (disposed) {
        return failed(
          "SHORTCUT_MANAGER_DISPOSED",
          "Shortcut manager is disposed.",
        );
      }
      if (!NAMESPACE_PATTERN.test(definition.id)) {
        return failed(
          "SHORTCUT_INVALID_ID",
          "Shortcut ids must use a valid namespace:name form.",
        );
      }
      if (registrations.has(definition.id)) {
        return failed(
          "SHORTCUT_DUPLICATE_ID",
          `Shortcut "${definition.id}" is already registered.`,
        );
      }
      const key = normalizeKey(definition.key);
      if (key === null) {
        return failed(
          "SHORTCUT_INVALID_KEY",
          "Shortcut keys must be one alphanumeric or a supported named key.",
        );
      }
      if (
        definition.scope !== undefined &&
        !NAMESPACE_PATTERN.test(definition.scope)
      ) {
        return failed(
          "SHORTCUT_INVALID_SCOPE",
          "Shortcut scopes must use a valid namespace:name form.",
        );
      }
      const modifiers = {
        ctrlKey: definition.ctrlKey ?? false,
        altKey: definition.altKey ?? false,
        shiftKey: definition.shiftKey ?? false,
        metaKey: definition.metaKey ?? false,
      };
      if (!Object.values(modifiers).some(Boolean)) {
        return failed(
          "SHORTCUT_INVALID_KEY",
          "Shortcuts must include at least one explicit modifier.",
        );
      }
      const priority = definition.priority ?? 0;
      if (!Number.isSafeInteger(priority)) {
        return failed(
          "SHORTCUT_INVALID_PRIORITY",
          "Shortcut priority must be a safe integer.",
        );
      }

      const normalized: NormalizedShortcut = Object.freeze({
        ...definition,
        key,
        ...modifiers,
        priority,
      });
      const combination = combinationOf(normalized);
      if (RESERVED_COMBINATIONS.has(combination)) {
        return failed(
          "SHORTCUT_RESERVED",
          `Shortcut "${combination}" is reserved by the browser or operating system.`,
        );
      }

      let authorized: boolean;
      try {
        authorized = options.authorize(normalized);
      } catch (cause) {
        return failed(
          "SHORTCUT_AUTHORIZATION_FAILED",
          `Host authorization failed for "${definition.id}".`,
          cause,
        );
      }
      if (!authorized) {
        return failed(
          "SHORTCUT_AUTHORIZATION_DENIED",
          `Host policy denied "${definition.id}".`,
        );
      }

      const registration = Object.freeze({
        definition: normalized,
        combination,
      });
      registrations.set(definition.id, registration);
      if (!listening) {
        target.addEventListener("keydown", dispatch);
        listening = true;
      }

      let unregistered = false;
      return {
        ok: true,
        value: {
          unregister() {
            if (unregistered) return;
            unregistered = true;
            registrations.delete(definition.id);
            if (registrations.size === 0 && listening) {
              target.removeEventListener("keydown", dispatch);
              listening = false;
            }
          },
        },
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      registrations.clear();
      if (listening) {
        target.removeEventListener("keydown", dispatch);
        listening = false;
      }
    },
  };
}
