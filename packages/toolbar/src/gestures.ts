export type GestureDirection = "left" | "right";
export type GesturePointerType = "touch" | "pen";

export interface GestureIntent {
  readonly direction: GestureDirection;
  readonly pointerType: GesturePointerType;
  readonly distance: number;
}

export interface GestureManagerOptions {
  readonly enabled: boolean;
  readonly onGesture: (intent: GestureIntent) => void;
}

export interface GestureManager {
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

interface ActivePointer {
  readonly id: number;
  readonly type: GesturePointerType;
  readonly startX: number;
  readonly startY: number;
  readonly target: EventTarget | null;
}

const MIN_DISTANCE = 64;
const DIRECTION_DOMINANCE = 1.5;
const BROWSER_EDGE_WIDTH = 24;
const INTERACTIVE_TAGS = new Set([
  "A",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
]);

function isElementTarget(target: EventTarget | null): target is Element {
  return (
    target !== null &&
    typeof target === "object" &&
    "nodeType" in target &&
    target.nodeType === 1 &&
    "tagName" in target &&
    typeof target.tagName === "string" &&
    "closest" in target &&
    typeof target.closest === "function"
  );
}

function isEditableOrInteractive(target: EventTarget | null): boolean {
  if (!isElementTarget(target)) return false;
  let element: Element | null = target;
  while (element !== null) {
    if (
      INTERACTIVE_TAGS.has(element.tagName) ||
      (element.getAttribute("contenteditable") !== null &&
        element.getAttribute("contenteditable")?.toLowerCase() !== "false")
    ) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

export function createGestureManager(
  target: HTMLElement,
  options: GestureManagerOptions,
): GestureManager {
  if (
    target === null ||
    typeof target !== "object" ||
    typeof target.addEventListener !== "function" ||
    !target.ownerDocument
  ) {
    throw new TypeError("Gesture recognition requires a host-owned element.");
  }
  if (
    options === null ||
    typeof options !== "object" ||
    typeof options.onGesture !== "function" ||
    typeof options.enabled !== "boolean"
  ) {
    throw new TypeError("Gesture recognition requires an explicit policy.");
  }

  const view = target.ownerDocument.defaultView;
  let activePointer: ActivePointer | null = null;
  let enabled = false;
  let disposed = false;

  const onPointerDown = (event: PointerEvent) => {
    if (
      event.defaultPrevented ||
      !event.isPrimary ||
      (event.pointerType !== "touch" && event.pointerType !== "pen") ||
      event.button !== 0 ||
      isEditableOrInteractive(event.target)
    ) {
      return;
    }
    activePointer = {
      id: event.pointerId,
      type: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      target: event.target,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    const pointer = activePointer;
    if (pointer === null || event.pointerId !== pointer.id) return;
    const horizontal = Math.abs(event.clientX - pointer.startX);
    const vertical = Math.abs(event.clientY - pointer.startY);
    if (vertical > horizontal && vertical >= MIN_DISTANCE / 2) {
      activePointer = null;
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const pointer = activePointer;
    activePointer = null;
    if (
      pointer === null ||
      event.pointerId !== pointer.id ||
      event.defaultPrevented ||
      isEditableOrInteractive(pointer.target) ||
      isEditableOrInteractive(event.target) ||
      view === null ||
      view.innerWidth <= 0
    ) {
      return;
    }

    const deltaX = event.clientX - pointer.startX;
    const deltaY = Math.abs(event.clientY - pointer.startY);
    const distance = Math.abs(deltaX);
    if (
      distance < MIN_DISTANCE ||
      distance < deltaY * DIRECTION_DOMINANCE ||
      pointer.startX < BROWSER_EDGE_WIDTH ||
      pointer.startX > view.innerWidth - BROWSER_EDGE_WIDTH
    ) {
      return;
    }
    options.onGesture({
      direction: deltaX < 0 ? "left" : "right",
      pointerType: pointer.type,
      distance,
    });
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (activePointer?.id === event.pointerId) activePointer = null;
  };

  function addListeners(): void {
    target.addEventListener("pointerdown", onPointerDown, { passive: true });
    target.addEventListener("pointermove", onPointerMove, { passive: true });
    target.addEventListener("pointerup", onPointerUp, { passive: true });
    target.addEventListener("pointercancel", onPointerCancel, {
      passive: true,
    });
  }

  function removeListeners(): void {
    target.removeEventListener("pointerdown", onPointerDown);
    target.removeEventListener("pointermove", onPointerMove);
    target.removeEventListener("pointerup", onPointerUp);
    target.removeEventListener("pointercancel", onPointerCancel);
    activePointer = null;
  }

  if (options.enabled) {
    enabled = true;
    addListeners();
  }

  return {
    get enabled() {
      return enabled;
    },

    setEnabled(value) {
      if (disposed) return;
      if (typeof value !== "boolean") {
        throw new TypeError("Gesture enabled state must be boolean.");
      }
      if (value === enabled) return;
      enabled = value;
      if (enabled) addListeners();
      else removeListeners();
    },

    dispose() {
      if (disposed) return;
      if (enabled) removeListeners();
      else activePointer = null;
      enabled = false;
      disposed = true;
    },
  };
}
