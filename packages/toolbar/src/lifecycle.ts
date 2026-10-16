export type LifecycleState = "active" | "suspended" | "disposed";

export type LifecycleReason =
  "visibility" | "pagehide" | "pageshow" | "reconcile";

export interface LifecycleCallbacks {
  readonly onSuspend: (reason: LifecycleReason) => void;
  readonly onResume: (reason: LifecycleReason) => void;
}

export interface LifecycleCoordinator {
  readonly state: LifecycleState;
  reconcile(): void;
  dispose(): void;
}

function isDocumentHidden(document: Document): boolean {
  return document.visibilityState !== "visible";
}

export function createLifecycleCoordinator(
  document: Document,
  callbacks: LifecycleCallbacks,
): LifecycleCoordinator {
  if (
    document === null ||
    typeof document !== "object" ||
    typeof document.addEventListener !== "function"
  ) {
    throw new TypeError("Lifecycle coordination requires a host document.");
  }
  if (
    callbacks === null ||
    typeof callbacks !== "object" ||
    typeof callbacks.onSuspend !== "function" ||
    typeof callbacks.onResume !== "function"
  ) {
    throw new TypeError(
      "Lifecycle coordination requires suspend/resume handlers.",
    );
  }

  const view = document.defaultView;
  let documentHidden = isDocumentHidden(document);
  let pageHidden = false;
  let currentState: LifecycleState = documentHidden ? "suspended" : "active";
  let disposed = false;

  function transition(reason: LifecycleReason): void {
    if (disposed) return;
    const nextState: LifecycleState =
      documentHidden || pageHidden ? "suspended" : "active";
    if (nextState === currentState) return;
    currentState = nextState;
    if (nextState === "suspended") {
      callbacks.onSuspend(reason);
    } else {
      callbacks.onResume(reason);
    }
  }

  const onVisibilityChange = () => {
    documentHidden = isDocumentHidden(document);
    transition("visibility");
  };
  const onPageHide = () => {
    pageHidden = true;
    transition("pagehide");
  };
  const onPageShow = () => {
    pageHidden = false;
    documentHidden = isDocumentHidden(document);
    transition("pageshow");
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  view?.addEventListener("pagehide", onPageHide);
  view?.addEventListener("pageshow", onPageShow);

  return {
    get state() {
      return currentState;
    },

    reconcile() {
      if (disposed) return;
      documentHidden = isDocumentHidden(document);
      transition("reconcile");
    },

    dispose() {
      if (disposed) return;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      view?.removeEventListener("pagehide", onPageHide);
      view?.removeEventListener("pageshow", onPageShow);
      disposed = true;
      currentState = "disposed";
    },
  };
}
