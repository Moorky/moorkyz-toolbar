import {
  validateConfiguration,
  type ConfigurationDiagnostic,
  type ToolbarConfiguration,
  type ToolbarConfigurationInput,
} from "./configuration.js";

export interface ToolbarHost {
  readonly dispatchAction?: (actionId: string) => void | Promise<void>;
  readonly onActionError?: (error: unknown, actionId: string) => void;
}

export type ToolbarErrorCode =
  | "INVALID_CONFIGURATION"
  | "INVALID_MOUNT_TARGET"
  | "ALREADY_MOUNTED"
  | "MOUNT_MODE_IMMUTABLE"
  | "DISPOSED"
  | "MOUNT_FAILED";

export interface ToolbarRuntimeError {
  readonly code: ToolbarErrorCode;
  readonly message: string;
  readonly cause?: unknown;
  readonly diagnostics?: readonly ConfigurationDiagnostic[];
}

export type ToolbarResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ToolbarRuntimeError };

export class ToolbarConfigurationError extends Error {
  readonly diagnostics: readonly ConfigurationDiagnostic[];

  constructor(diagnostics: readonly ConfigurationDiagnostic[]) {
    super("Invalid toolbar configuration.");
    this.name = "ToolbarConfigurationError";
    this.diagnostics = diagnostics;
  }
}

export interface ToolbarController {
  readonly isMounted: boolean;
  readonly isCollapsed: boolean;
  mount(target: HTMLElement): ToolbarResult;
  update(configuration: ToolbarConfigurationInput): ToolbarResult;
  collapse(): ToolbarResult;
  expand(): ToolbarResult;
  dispose(): void;
}

type RenderRoot = HTMLElement | ShadowRoot;

function failure(
  code: ToolbarErrorCode,
  message: string,
  details: {
    cause?: unknown;
    diagnostics?: readonly ConfigurationDiagnostic[];
  } = {},
): ToolbarResult {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details.cause === undefined ? {} : { cause: details.cause }),
      ...(details.diagnostics === undefined
        ? {}
        : { diagnostics: details.diagnostics }),
    },
  };
}

class ToolbarControllerImpl implements ToolbarController {
  private configuration: ToolbarConfiguration;
  private readonly host: ToolbarHost;
  private mountTarget: HTMLElement | null = null;
  private hostElement: HTMLElement | null = null;
  private renderRoot: RenderRoot | null = null;
  private toolbarElement: HTMLDivElement | null = null;
  private statusElement: HTMLDivElement | null = null;
  private actionsElement: HTMLDivElement | null = null;
  private collapsed = false;
  private disposed = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private overflowObserver: ResizeObserver | null = null;
  private overflowWindow: Window | null = null;
  private overflowScrollHandler: (() => void) | null = null;
  private overflowResizeHandler: (() => void) | null = null;

  constructor(configuration: ToolbarConfiguration, host: ToolbarHost) {
    this.configuration = configuration;
    this.host = host;
  }

  get isMounted(): boolean {
    return this.hostElement !== null;
  }

  get isCollapsed(): boolean {
    return this.collapsed;
  }

  mount(target: HTMLElement): ToolbarResult {
    if (this.disposed) {
      return failure("DISPOSED", "A disposed toolbar cannot be mounted.");
    }
    if (this.hostElement !== null) {
      if (target === this.mountTarget) return { ok: true };
      return failure(
        "ALREADY_MOUNTED",
        "This toolbar is already mounted to another target.",
      );
    }
    if (
      target === null ||
      typeof target !== "object" ||
      typeof target.appendChild !== "function" ||
      !target.ownerDocument
    ) {
      return failure(
        "INVALID_MOUNT_TARGET",
        "Mount target must be an element with an owner document.",
      );
    }

    const document = target.ownerDocument;
    const hostElement = document.createElement("div");
    hostElement.className = "mzk-toolbar-host";
    hostElement.dataset.placement = this.configuration.placement.mode;

    try {
      const root =
        this.configuration.renderMode === "shadow"
          ? hostElement.attachShadow({ mode: "open" })
          : hostElement;
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = new URL("./toolbar.css", import.meta.url).href;
      root.appendChild(stylesheet);

      const toolbar = document.createElement("div");
      toolbar.className = "mzk-toolbar";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-orientation", "horizontal");
      toolbar.setAttribute("aria-label", this.configuration.label);
      root.appendChild(toolbar);

      const status = document.createElement("div");
      status.className = "mzk-toolbar__status";
      status.setAttribute("role", "alert");
      status.setAttribute("aria-live", "assertive");
      status.hidden = true;
      root.appendChild(status);

      this.mountTarget = target;
      this.hostElement = hostElement;
      this.renderRoot = root;
      this.toolbarElement = toolbar;
      this.statusElement = status;
      this.keydownHandler = (event) => this.handleKeydown(event);
      this.clickHandler = (event) => this.handleClick(event);
      toolbar.addEventListener("keydown", this.keydownHandler);
      toolbar.addEventListener("click", this.clickHandler);
      target.appendChild(hostElement);
      this.render();
      return { ok: true };
    } catch (cause) {
      hostElement.remove();
      this.clearMountReferences();
      return failure(
        "MOUNT_FAILED",
        "The toolbar could not be mounted in this document.",
        { cause },
      );
    }
  }

  update(configuration: ToolbarConfigurationInput): ToolbarResult {
    if (this.disposed) {
      return failure("DISPOSED", "A disposed toolbar cannot be updated.");
    }

    const patchValidation = validateConfiguration(configuration);
    if (!patchValidation.ok) {
      return failure(
        "INVALID_CONFIGURATION",
        "The toolbar configuration was not changed.",
        { diagnostics: patchValidation.errors },
      );
    }

    const hasOwn = (key: keyof ToolbarConfigurationInput) =>
      Object.prototype.hasOwnProperty.call(configuration, key);
    const mergedConfiguration: ToolbarConfigurationInput = {
      schemaVersion: hasOwn("schemaVersion")
        ? patchValidation.value.schemaVersion
        : this.configuration.schemaVersion,
      features: hasOwn("features")
        ? {
            ...this.configuration.features,
            ...(configuration.features ?? {}),
          }
        : this.configuration.features,
      actions: hasOwn("actions")
        ? patchValidation.value.actions
        : this.configuration.actions,
      placement: hasOwn("placement")
        ? {
            ...this.configuration.placement,
            ...(configuration.placement ?? {}),
          }
        : this.configuration.placement,
      renderMode: hasOwn("renderMode")
        ? patchValidation.value.renderMode
        : this.configuration.renderMode,
      label: hasOwn("label")
        ? patchValidation.value.label
        : this.configuration.label,
    };
    const validation = validateConfiguration(mergedConfiguration);
    if (!validation.ok) {
      return failure(
        "INVALID_CONFIGURATION",
        "The toolbar configuration was not changed.",
        { diagnostics: validation.errors },
      );
    }
    if (
      this.isMounted &&
      configuration.renderMode !== undefined &&
      validation.value.renderMode !== this.configuration.renderMode
    ) {
      return failure(
        "MOUNT_MODE_IMMUTABLE",
        "Render mode cannot change after mounting; create a new toolbar instance.",
      );
    }

    this.configuration =
      this.isMounted && configuration.renderMode === undefined
        ? Object.freeze({
            ...validation.value,
            renderMode: this.configuration.renderMode,
          })
        : validation.value;
    if (this.toolbarElement !== null) {
      this.render();
    }
    return { ok: true };
  }

  collapse(): ToolbarResult {
    if (this.disposed) {
      return failure("DISPOSED", "A disposed toolbar cannot be collapsed.");
    }
    if (this.collapsed) return { ok: true };
    this.collapsed = true;
    this.render();
    return { ok: true };
  }

  expand(): ToolbarResult {
    if (this.disposed) {
      return failure("DISPOSED", "A disposed toolbar cannot be expanded.");
    }
    if (!this.collapsed) return { ok: true };
    this.collapsed = false;
    this.render();
    return { ok: true };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.toolbarElement !== null && this.keydownHandler !== null) {
      this.toolbarElement.removeEventListener("keydown", this.keydownHandler);
    }
    if (this.toolbarElement !== null && this.clickHandler !== null) {
      this.toolbarElement.removeEventListener("click", this.clickHandler);
    }
    this.hostElement?.remove();
    this.clearMountReferences();
  }

  private clearMountReferences(): void {
    this.clearOverflowMonitoring();
    this.mountTarget = null;
    this.hostElement = null;
    this.renderRoot = null;
    this.toolbarElement = null;
    this.statusElement = null;
    this.keydownHandler = null;
    this.clickHandler = null;
  }

  private createScrollButton(
    document: Document,
    direction: "start" | "end",
    glyph: string,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = `mzk-toolbar__scroll mzk-toolbar__scroll--${direction}`;
    button.type = "button";
    button.setAttribute("data-toolbar-control", `scroll-${direction}`);
    button.setAttribute(
      "aria-label",
      `Scroll toolbar actions toward ${direction}`,
    );
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = glyph;
    button.appendChild(icon);
    button.hidden = true;
    button.disabled = true;
    button.tabIndex = -1;
    return button;
  }

  private render(): void {
    const toolbar = this.toolbarElement;
    const root = this.renderRoot;
    if (toolbar === null || root === null) return;

    const document = toolbar.ownerDocument;
    const activeElement =
      "activeElement" in root ? root.activeElement : document.activeElement;
    const focusedControl =
      activeElement !== null && toolbar.contains(activeElement)
        ? activeElement.getAttribute("data-toolbar-control")
        : null;
    this.clearOverflowMonitoring();

    toolbar.setAttribute("aria-label", this.configuration.label);
    toolbar.setAttribute("data-collapsed", String(this.collapsed));
    if (this.hostElement !== null) {
      this.hostElement.dataset.placement = this.configuration.placement.mode;
    }

    const hostElement = this.hostElement;
    const direction =
      hostElement === null
        ? "ltr"
        : (toolbar.ownerDocument.defaultView?.getComputedStyle(hostElement)
            .direction ?? "ltr");
    const scrollStart = this.createScrollButton(
      document,
      "start",
      direction === "rtl" ? "›" : "‹",
    );
    const scrollEnd = this.createScrollButton(
      document,
      "end",
      direction === "rtl" ? "‹" : "›",
    );
    const actionViewport = document.createElement("div");
    actionViewport.className = "mzk-toolbar__action-viewport";
    const fadeStart = document.createElement("span");
    fadeStart.className = "mzk-toolbar__fade mzk-toolbar__fade--start";
    fadeStart.setAttribute("aria-hidden", "true");

    const actions = document.createElement("div");
    actions.className = "mzk-toolbar__actions";
    actions.hidden = this.collapsed;
    for (const action of this.configuration.actions) {
      const button = document.createElement("button");
      button.className = "mzk-toolbar__action";
      button.type = "button";
      button.textContent = action.label;
      button.setAttribute("data-toolbar-control", `action:${action.id}`);
      button.setAttribute("aria-label", action.label);
      button.disabled = this.host.dispatchAction === undefined;
      button.tabIndex = -1;
      actions.appendChild(button);
    }

    const fadeEnd = document.createElement("span");
    fadeEnd.className = "mzk-toolbar__fade mzk-toolbar__fade--end";
    fadeEnd.setAttribute("aria-hidden", "true");
    actionViewport.append(fadeStart, actions, fadeEnd);

    const collapseButton = document.createElement("button");
    collapseButton.className = "mzk-toolbar__collapse";
    collapseButton.type = "button";
    collapseButton.textContent = this.collapsed ? "Restore" : "Collapse";
    collapseButton.setAttribute("data-toolbar-control", "collapse");
    collapseButton.setAttribute(
      "aria-label",
      this.collapsed ? "Restore toolbar" : "Collapse toolbar",
    );
    collapseButton.setAttribute("aria-expanded", String(!this.collapsed));
    collapseButton.tabIndex = -1;

    toolbar.replaceChildren(
      scrollStart,
      actionViewport,
      scrollEnd,
      collapseButton,
    );
    this.actionsElement = actions;
    this.startOverflowMonitoring();
    this.updateOverflowControls();

    const buttons = Array.from(toolbar.querySelectorAll("button")).filter(
      (button) => !button.disabled && button.closest("[hidden]") === null,
    );
    if (buttons.length > 0) buttons[0]!.tabIndex = 0;
    if (focusedControl !== null) {
      const replacement = buttons.find(
        (button) =>
          button.getAttribute("data-toolbar-control") === focusedControl,
      );
      (replacement ?? buttons[0])?.focus();
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    const toolbar = this.toolbarElement;
    if (toolbar === null) return;
    const buttons = Array.from(toolbar.querySelectorAll("button")).filter(
      (button) => !button.disabled && button.closest("[hidden]") === null,
    );
    const currentIndex = buttons.findIndex((button) => button === event.target);
    if (currentIndex < 0) return;

    const hostElement = this.hostElement;
    const direction =
      hostElement === null
        ? "ltr"
        : (toolbar.ownerDocument.defaultView?.getComputedStyle(hostElement)
            .direction ?? "ltr");
    let nextIndex: number | null = null;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = buttons.length - 1;
    } else if (
      event.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight")
    ) {
      nextIndex = (currentIndex + 1) % buttons.length;
    } else if (
      event.key === (direction === "rtl" ? "ArrowRight" : "ArrowLeft")
    ) {
      nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      buttons[nextIndex]?.focus();
    }
  }

  private handleClick(event: MouseEvent): void {
    const toolbar = this.toolbarElement;
    if (toolbar === null) return;

    const button = Array.from(toolbar.querySelectorAll("button")).find(
      (candidate) => event.composedPath().includes(candidate),
    );
    if (
      button === undefined ||
      button.disabled ||
      button.closest("[hidden]") !== null
    ) {
      return;
    }

    const control = button.getAttribute("data-toolbar-control");
    if (control === "scroll-start" || control === "scroll-end") {
      this.scrollActions(control === "scroll-start");
      return;
    }
    if (control === "collapse") {
      if (this.collapsed) {
        this.expand();
      } else {
        this.collapse();
      }
      return;
    }
    if (control?.startsWith("action:") !== true) return;

    const actionId = control.slice("action:".length);
    const action = this.configuration.actions.find(({ id }) => id === actionId);
    if (action !== undefined) {
      this.dispatchAction(action.id, action.label);
    }
  }

  private startOverflowMonitoring(): void {
    const actions = this.actionsElement;
    if (actions === null) return;

    this.overflowScrollHandler = () => this.updateOverflowControls();
    actions.addEventListener("scroll", this.overflowScrollHandler, {
      passive: true,
    });

    const view = actions.ownerDocument.defaultView;
    if (view === null) return;
    const ResizeObserverConstructor = view.ResizeObserver;
    if (ResizeObserverConstructor !== undefined) {
      this.overflowObserver = new ResizeObserverConstructor(() =>
        this.updateOverflowControls(),
      );
      this.overflowObserver.observe(actions);
      if (this.toolbarElement !== null) {
        this.overflowObserver.observe(this.toolbarElement);
      }
    } else {
      this.overflowWindow = view;
      this.overflowResizeHandler = () => this.updateOverflowControls();
      view.addEventListener("resize", this.overflowResizeHandler, {
        passive: true,
      });
    }
  }

  private updateOverflowControls(): void {
    const toolbar = this.toolbarElement;
    const actions = this.actionsElement;
    if (toolbar === null || actions === null) return;

    const start = toolbar.querySelector<HTMLButtonElement>(
      '[data-toolbar-control="scroll-start"]',
    );
    const end = toolbar.querySelector<HTMLButtonElement>(
      '[data-toolbar-control="scroll-end"]',
    );
    if (start === null || end === null) return;

    const overflowing = actions.scrollWidth > actions.clientWidth + 1;
    toolbar.dataset.overflowing = String(overflowing);
    start.hidden = !overflowing;
    end.hidden = !overflowing;
    if (!overflowing) {
      start.disabled = true;
      end.disabled = true;
      toolbar.dataset.overflowStart = "false";
      toolbar.dataset.overflowEnd = "false";
      return;
    }

    const buttons = Array.from(actions.querySelectorAll("button"));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const viewport = actions.getBoundingClientRect();
    const direction =
      actions.ownerDocument.defaultView?.getComputedStyle(actions).direction ??
      "ltr";
    const firstBounds = first?.getBoundingClientRect();
    const lastBounds = last?.getBoundingClientRect();
    const atStart =
      firstBounds === undefined ||
      (direction === "rtl"
        ? firstBounds.right <= viewport.right + 1
        : firstBounds.left >= viewport.left - 1);
    const atEnd =
      lastBounds === undefined ||
      (direction === "rtl"
        ? lastBounds.left >= viewport.left - 1
        : lastBounds.right <= viewport.right + 1);

    start.disabled = atStart;
    end.disabled = atEnd;
    toolbar.dataset.overflowStart = String(!atStart);
    toolbar.dataset.overflowEnd = String(!atEnd);
  }

  private scrollActions(toStart: boolean): void {
    const actions = this.actionsElement;
    if (actions === null) return;
    const buttons = Array.from(actions.querySelectorAll("button"));
    const target = toStart ? buttons[0] : buttons[buttons.length - 1];
    if (target === undefined) return;

    const reducedMotion =
      actions.ownerDocument.defaultView?.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches ?? false;
    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: toStart ? "start" : "end",
    });
  }

  private clearOverflowMonitoring(): void {
    if (this.actionsElement !== null && this.overflowScrollHandler !== null) {
      this.actionsElement.removeEventListener(
        "scroll",
        this.overflowScrollHandler,
      );
    }
    this.overflowObserver?.disconnect();
    if (this.overflowWindow !== null && this.overflowResizeHandler !== null) {
      this.overflowWindow.removeEventListener(
        "resize",
        this.overflowResizeHandler,
      );
    }
    this.actionsElement = null;
    this.overflowObserver = null;
    this.overflowWindow = null;
    this.overflowScrollHandler = null;
    this.overflowResizeHandler = null;
  }

  private dispatchAction(actionId: string, label: string): void {
    const dispatchAction = this.host.dispatchAction;
    if (dispatchAction === undefined) return;

    if (this.statusElement !== null) {
      this.statusElement.hidden = true;
      this.statusElement.textContent = "";
    }

    try {
      void Promise.resolve(dispatchAction(actionId)).catch((cause: unknown) =>
        this.reportActionFailure(actionId, label, cause),
      );
    } catch (cause) {
      this.reportActionFailure(actionId, label, cause);
    }
  }

  private reportActionFailure(
    actionId: string,
    label: string,
    cause: unknown,
  ): void {
    if (this.statusElement !== null) {
      this.statusElement.textContent = `Could not complete ${label}. Try again.`;
      this.statusElement.hidden = false;
    }
    this.host.onActionError?.(cause, actionId);
  }
}

export function createToolbar(
  configuration: ToolbarConfigurationInput = {},
  host: ToolbarHost = {},
): ToolbarController {
  const validation = validateConfiguration(configuration);
  if (!validation.ok) {
    throw new ToolbarConfigurationError(validation.errors);
  }
  return new ToolbarControllerImpl(validation.value, host);
}
