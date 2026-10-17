import {
  validateConfiguration,
  type ConfigurationDiagnostic,
  type ToolbarConfiguration,
  type ToolbarConfigurationInput,
} from "./configuration.js";
import {
  validateDiscoverySnapshot,
  type DiscoveryDiagnostic,
  type ToolbarDiscoveryHint,
} from "./discovery.js";
import type { AICompletionOutcome, HostAuthorizedAIAdapter } from "./ai.js";
import type {
  PreferenceDiagnostic,
  ToolbarPreferenceStore,
  ToolbarPreferenceValues,
  ToolbarPreferences,
} from "./preferences.js";
import {
  validateNotificationSnapshot,
  type NotificationDiagnostic,
  type ToolbarNotification,
} from "./notifications.js";
import {
  isToolbarConnectivityStatus,
  type ToolbarConnectivityStatus,
} from "./offline.js";
import { createToolbarPreferenceStore } from "./preferences.js";
import {
  createGestureManager,
  type GestureIntent,
  type GestureManager,
} from "./gestures.js";
import type {
  FederatedSearchCoordinator,
  FederatedSearchOutcome,
  ToolbarSearchResult,
} from "./search.js";
import { THEME_NAMES, type ToolbarColorScheme } from "./themes.js";
import {
  validateTaskSnapshot,
  type TaskDiagnostic,
  type ToolbarTask,
} from "./tasks.js";

export interface ToolbarHost {
  readonly dispatchAction?: (actionId: string) => void | Promise<void>;
  readonly onActionError?: (error: unknown, actionId: string) => void;
  readonly preferenceStore?: ToolbarPreferenceStore;
  readonly onPreferenceError?: (diagnostic: PreferenceDiagnostic) => void;
  readonly searchCoordinator?: FederatedSearchCoordinator;
  readonly onSearchResult?: (
    providerId: string,
    resultId: string,
  ) => void | Promise<void>;
  readonly onSearchResultError?: (
    error: unknown,
    providerId: string,
    resultId: string,
  ) => void;
  readonly onSearchError?: (error: unknown, query: string) => void;
  readonly aiAdapter?: HostAuthorizedAIAdapter;
  readonly onAIError?: (error: unknown) => void;
  readonly onGesture?: (intent: GestureIntent) => void;
}

export type ToolbarErrorCode =
  | "INVALID_CONFIGURATION"
  | "INVALID_MOUNT_TARGET"
  | "ALREADY_MOUNTED"
  | "MOUNT_MODE_IMMUTABLE"
  | "DISPOSED"
  | "MOUNT_FAILED"
  | "PREFERENCE_LOAD_FAILED"
  | "CUSTOMIZATION_DISABLED"
  | "PREFERENCE_SAVE_FAILED"
  | "TASKS_DISABLED"
  | "INVALID_TASK_SNAPSHOT"
  | "NOTIFICATIONS_DISABLED"
  | "INVALID_NOTIFICATION_SNAPSHOT"
  | "OFFLINE_DISABLED"
  | "INVALID_CONNECTIVITY_STATUS"
  | "GESTURE_HANDLER_REQUIRED"
  | "DISCOVERY_DISABLED"
  | "INVALID_DISCOVERY_SNAPSHOT";

export interface ToolbarRuntimeError {
  readonly code: ToolbarErrorCode;
  readonly message: string;
  readonly cause?: unknown;
  readonly diagnostics?: readonly ConfigurationDiagnostic[];
  readonly taskDiagnostics?: readonly TaskDiagnostic[];
  readonly notificationDiagnostics?: readonly NotificationDiagnostic[];
  readonly discoveryDiagnostics?: readonly DiscoveryDiagnostic[];
}

export type ToolbarResult =
  | { readonly ok: true; readonly warning?: PreferenceDiagnostic }
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
  updateUserPreferences(preferences: ToolbarPreferenceValues): ToolbarResult;
  updateTasks(snapshot: unknown): ToolbarResult;
  updateNotifications(snapshot: unknown): ToolbarResult;
  updateConnectivityStatus(status: unknown): ToolbarResult;
  updateDiscoveryHints(snapshot: unknown): ToolbarResult;
  collapse(): ToolbarResult;
  expand(): ToolbarResult;
  dispose(): void;
}

type RenderRoot = HTMLElement | ShadowRoot;
type SearchDisplayResult =
  | { readonly kind: "action"; readonly id: string; readonly title: string }
  | { readonly kind: "provider"; readonly result: ToolbarSearchResult };

const MAX_SEARCH_DISPLAY_RESULTS = 50;
const MAX_SEARCH_QUERY = 256;
const MAX_AI_PROMPT = 8_000;

function orderActions(
  actions: ToolbarConfiguration["actions"],
  order: readonly string[],
): ToolbarConfiguration["actions"] {
  const byId = new Map(actions.map((action) => [action.id, action]));
  const ordered: ToolbarConfiguration["actions"][number][] = [];
  for (const id of order) {
    const action = byId.get(id);
    if (action !== undefined) {
      ordered.push(action);
      byId.delete(id);
    }
  }
  for (const action of actions) {
    if (byId.has(action.id)) ordered.push(action);
  }
  return Object.freeze(ordered);
}

function preferenceDiagnosticMessage(issue: PreferenceDiagnostic): string {
  if (
    issue.code === "PREFERENCE_STORAGE_WRITE_FAILED" ||
    issue.code === "PREFERENCE_STORAGE_REMOVE_FAILED" ||
    issue.code === "PREFERENCE_MIGRATION_WRITE_FAILED"
  ) {
    return "Toolbar preferences are active but may not persist between visits.";
  }
  return "Saved toolbar preferences could not be read; current defaults remain active.";
}

function preferenceButtonLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function connectivityLabel(status: ToolbarConnectivityStatus): string {
  if (status === "online") return "Online";
  if (status === "offline") return "Offline";
  return "Connection status unknown";
}

function searchOutcomeMessage(outcome: FederatedSearchOutcome): string {
  if (!outcome.ok) {
    if (outcome.error.code === "SEARCH_DISABLED") {
      return "Search is disabled by host policy.";
    }
    if (outcome.error.code === "SEARCH_CANCELLED") {
      return "Search was cancelled.";
    }
    return "Search is unavailable.";
  }
  if (outcome.diagnostics.length > 0) {
    return "Some search sources were unavailable.";
  }
  return outcome.results.length === 0 ? "No results." : "Search complete.";
}

function aiOutcomeMessage(outcome: AICompletionOutcome): string {
  if (outcome.ok) return "Response ready.";
  if (outcome.error.code === "AI_DISABLED") {
    return "AI is disabled by host policy.";
  }
  if (outcome.error.code === "AI_PERMISSION_DENIED") {
    return "AI use is not authorized.";
  }
  if (outcome.error.code === "AI_CANCELLED") return "AI request was cancelled.";
  if (outcome.error.code === "AI_INVALID_PROMPT") {
    return "Enter a valid prompt.";
  }
  return "AI response is unavailable.";
}

function failure(
  code: ToolbarErrorCode,
  message: string,
  details: {
    cause?: unknown;
    diagnostics?: readonly ConfigurationDiagnostic[];
    taskDiagnostics?: readonly TaskDiagnostic[];
    notificationDiagnostics?: readonly NotificationDiagnostic[];
    discoveryDiagnostics?: readonly DiscoveryDiagnostic[];
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
      ...(details.taskDiagnostics === undefined
        ? {}
        : { taskDiagnostics: details.taskDiagnostics }),
      ...(details.notificationDiagnostics === undefined
        ? {}
        : { notificationDiagnostics: details.notificationDiagnostics }),
      ...(details.discoveryDiagnostics === undefined
        ? {}
        : { discoveryDiagnostics: details.discoveryDiagnostics }),
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
  private preferenceValue: ToolbarPreferences | null = null;
  private pendingPreferenceDiagnostic: PreferenceDiagnostic | null = null;
  private memoryPreferenceStore: ToolbarPreferenceStore | null = null;
  private editing = false;
  private statusKind:
    "action" | "customization" | "preference" | "search" | null = null;
  private taskItems: readonly ToolbarTask[] = Object.freeze([]);
  private taskPanelOpen = false;
  private taskPanelElement: HTMLElement | null = null;
  private taskButtonElement: HTMLButtonElement | null = null;
  private notificationItems: readonly ToolbarNotification[] = Object.freeze([]);
  private notificationPanelOpen = false;
  private notificationPanelElement: HTMLElement | null = null;
  private notificationButtonElement: HTMLButtonElement | null = null;
  private connectivityStatus: ToolbarConnectivityStatus = "unknown";
  private connectivityElement: HTMLSpanElement | null = null;
  private searchPanelOpen = false;
  private searchButtonElement: HTMLButtonElement | null = null;
  private searchPanelElement: HTMLElement | null = null;
  private searchFormElement: HTMLFormElement | null = null;
  private searchInputElement: HTMLInputElement | null = null;
  private searchStatusElement: HTMLParagraphElement | null = null;
  private searchResultsElement: HTMLUListElement | null = null;
  private searchSubmitHandler: ((event: SubmitEvent) => void) | null = null;
  private searchKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private searchResultsClickHandler: ((event: MouseEvent) => void) | null =
    null;
  private searchAbortController: AbortController | null = null;
  private searchRequestVersion = 0;
  private searchResults: readonly SearchDisplayResult[] = Object.freeze([]);
  private aiPanelOpen = false;
  private aiButtonElement: HTMLButtonElement | null = null;
  private aiPanelElement: HTMLElement | null = null;
  private aiFormElement: HTMLFormElement | null = null;
  private aiPromptElement: HTMLTextAreaElement | null = null;
  private aiStatusElement: HTMLParagraphElement | null = null;
  private aiResponseElement: HTMLDivElement | null = null;
  private aiSubmitHandler: ((event: SubmitEvent) => void) | null = null;
  private aiKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private aiAbortController: AbortController | null = null;
  private aiRequestVersion = 0;
  private gestureManager: GestureManager | null = null;
  private discoveryHints: readonly ToolbarDiscoveryHint[] = Object.freeze([]);
  private discoveryPanelOpen = false;
  private discoveryPanelElement: HTMLElement | null = null;
  private discoveryButtonElement: HTMLButtonElement | null = null;

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
    if (
      this.configuration.features.advancedGestures &&
      this.host.onGesture === undefined
    ) {
      return failure(
        "GESTURE_HANDLER_REQUIRED",
        "A host gesture handler is required when advanced gestures are enabled.",
      );
    }

    const preferenceResult = this.loadPreferences();
    if (!preferenceResult.ok) return preferenceResult;

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
      this.syncGestureManager();
      target.appendChild(hostElement);
      this.render();
      return preferenceResult;
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
      theme: hasOwn("theme")
        ? patchValidation.value.theme
        : this.configuration.theme,
      colorScheme: hasOwn("colorScheme")
        ? patchValidation.value.colorScheme
        : this.configuration.colorScheme,
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
    if (
      validation.value.features.advancedGestures &&
      this.host.onGesture === undefined
    ) {
      return failure(
        "GESTURE_HANDLER_REQUIRED",
        "A host gesture handler is required when advanced gestures are enabled.",
      );
    }

    let nextConfiguration = validation.value;
    if (
      this.preferenceValue !== null &&
      validation.value.features.customize &&
      Object.prototype.hasOwnProperty.call(configuration, "actions")
    ) {
      nextConfiguration = Object.freeze({
        ...nextConfiguration,
        actions: orderActions(
          nextConfiguration.actions,
          this.preferenceValue.actionOrder,
        ),
      });
    }
    this.configuration =
      this.isMounted && configuration.renderMode === undefined
        ? Object.freeze({
            ...nextConfiguration,
            renderMode: this.configuration.renderMode,
          })
        : nextConfiguration;
    if (!this.configuration.features.tasks) {
      this.taskItems = Object.freeze([]);
      this.taskPanelOpen = false;
    }
    if (!this.configuration.features.notifications) {
      this.notificationItems = Object.freeze([]);
      this.notificationPanelOpen = false;
    }
    if (!this.configuration.features.offline) {
      this.connectivityStatus = "unknown";
    }
    if (!this.configuration.features.discovery) {
      this.discoveryHints = Object.freeze([]);
      this.discoveryPanelOpen = false;
    }
    if (!this.configuration.features.search) this.resetSearchState();
    if (!this.configuration.features.ai) this.resetAIState();
    if (!this.configuration.features.customize) this.editing = false;
    if (this.isMounted) this.syncGestureManager();
    if (this.toolbarElement !== null) {
      this.render();
    }
    return { ok: true };
  }

  updateUserPreferences(preferences: ToolbarPreferenceValues): ToolbarResult {
    if (this.disposed) {
      return failure(
        "DISPOSED",
        "Preferences cannot be changed on a disposed toolbar.",
      );
    }
    if (!this.configuration.features.customize) {
      return failure(
        "CUSTOMIZATION_DISABLED",
        "Toolbar customization is disabled by configuration.",
      );
    }
    let saved;
    try {
      saved = this.getPreferenceStore().save(preferences);
    } catch (cause) {
      return failure(
        "PREFERENCE_SAVE_FAILED",
        "Toolbar preferences could not be saved.",
        { cause },
      );
    }
    if (!saved.ok) {
      return failure(
        "PREFERENCE_SAVE_FAILED",
        "Toolbar preferences were not changed.",
        { cause: saved.error },
      );
    }
    this.applyPreferences(saved.value);
    if (this.toolbarElement !== null) this.render();
    const warning =
      saved.diagnostic ??
      (this.host.preferenceStore === undefined
        ? {
            code: "PREFERENCE_STORAGE_WRITE_FAILED" as const,
            message:
              "No host persistence adapter is configured; preferences are active for this toolbar instance only.",
          }
        : undefined);
    if (warning !== undefined) {
      this.reportPreferenceDiagnostic(warning);
      return { ok: true, warning };
    }
    return { ok: true };
  }

  updateTasks(snapshot: unknown): ToolbarResult {
    if (this.disposed) {
      return failure(
        "DISPOSED",
        "Tasks cannot be updated on a disposed toolbar.",
      );
    }
    if (!this.configuration.features.tasks) {
      return failure(
        "TASKS_DISABLED",
        "Task Center is disabled by configuration.",
      );
    }
    const validation = validateTaskSnapshot(snapshot);
    if (!validation.ok) {
      return failure("INVALID_TASK_SNAPSHOT", "Task state was not changed.", {
        taskDiagnostics: validation.errors,
      });
    }
    this.taskItems = validation.value;
    this.updateTaskButton();
    this.renderTaskCenter();
    return { ok: true };
  }

  updateNotifications(snapshot: unknown): ToolbarResult {
    if (this.disposed) {
      return failure(
        "DISPOSED",
        "Notifications cannot be updated on a disposed toolbar.",
      );
    }
    if (!this.configuration.features.notifications) {
      return failure(
        "NOTIFICATIONS_DISABLED",
        "Notifications are disabled by configuration.",
      );
    }
    const validation = validateNotificationSnapshot(snapshot);
    if (!validation.ok) {
      return failure(
        "INVALID_NOTIFICATION_SNAPSHOT",
        "Notification state was not changed.",
        { notificationDiagnostics: validation.errors },
      );
    }
    this.notificationItems = validation.value;
    this.updateNotificationButton();
    this.renderNotificationCenter();
    return { ok: true };
  }

  updateConnectivityStatus(status: unknown): ToolbarResult {
    if (this.disposed) {
      return failure(
        "DISPOSED",
        "Connectivity status cannot be updated on a disposed toolbar.",
      );
    }
    if (!this.configuration.features.offline) {
      return failure(
        "OFFLINE_DISABLED",
        "Offline status is disabled by configuration.",
      );
    }
    if (!isToolbarConnectivityStatus(status)) {
      return failure(
        "INVALID_CONNECTIVITY_STATUS",
        "Connectivity status must be unknown, online, or offline.",
      );
    }
    this.connectivityStatus = status;
    if (this.connectivityElement !== null) {
      const label = connectivityLabel(status);
      this.connectivityElement.textContent = label;
      this.connectivityElement.setAttribute(
        "aria-label",
        `Connection status: ${label}`,
      );
      this.connectivityElement.dataset.status = status;
    }
    return { ok: true };
  }

  updateDiscoveryHints(snapshot: unknown): ToolbarResult {
    if (this.disposed) {
      return failure(
        "DISPOSED",
        "Discovery hints cannot be updated after disposal.",
      );
    }
    if (!this.configuration.features.discovery) {
      return failure(
        "DISCOVERY_DISABLED",
        "Progressive discovery is disabled by configuration.",
      );
    }
    const validation = validateDiscoverySnapshot(snapshot);
    if (!validation.ok) {
      return failure(
        "INVALID_DISCOVERY_SNAPSHOT",
        "Discovery hints were not changed.",
        { discoveryDiagnostics: validation.errors },
      );
    }
    this.discoveryHints = validation.value;
    this.renderDiscoveryPanel();
    return { ok: true };
  }

  collapse(): ToolbarResult {
    if (this.disposed) {
      return failure("DISPOSED", "A disposed toolbar cannot be collapsed.");
    }
    if (this.collapsed) return { ok: true };
    this.collapsed = true;
    this.taskPanelOpen = false;
    this.notificationPanelOpen = false;
    this.discoveryPanelOpen = false;
    this.resetSearchState();
    this.resetAIState();
    const persistenceResult = this.persistCurrentPreferences();
    this.render();
    return persistenceResult;
  }

  expand(): ToolbarResult {
    if (this.disposed) {
      return failure("DISPOSED", "A disposed toolbar cannot be expanded.");
    }
    if (!this.collapsed) return { ok: true };
    this.collapsed = false;
    const persistenceResult = this.persistCurrentPreferences();
    this.render();
    return persistenceResult;
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
    this.gestureManager?.dispose();
    this.gestureManager = null;
    this.resetSearchState();
    this.resetAIState();
    this.detachSearchPanelHandlers();
    this.detachAIPanelHandlers();
    this.mountTarget = null;
    this.hostElement = null;
    this.renderRoot = null;
    this.toolbarElement = null;
    this.statusElement = null;
    this.taskPanelElement = null;
    this.taskButtonElement = null;
    this.taskItems = Object.freeze([]);
    this.taskPanelOpen = false;
    this.notificationPanelElement = null;
    this.notificationButtonElement = null;
    this.notificationItems = Object.freeze([]);
    this.notificationPanelOpen = false;
    this.discoveryPanelElement = null;
    this.discoveryButtonElement = null;
    this.discoveryHints = Object.freeze([]);
    this.discoveryPanelOpen = false;
    this.connectivityStatus = "unknown";
    this.connectivityElement = null;
    this.searchButtonElement = null;
    this.searchPanelElement = null;
    this.searchFormElement = null;
    this.searchInputElement = null;
    this.searchStatusElement = null;
    this.searchResultsElement = null;
    this.searchSubmitHandler = null;
    this.searchKeydownHandler = null;
    this.searchResultsClickHandler = null;
    this.searchPanelOpen = false;
    this.searchResults = Object.freeze([]);
    this.aiButtonElement = null;
    this.aiPanelElement = null;
    this.aiFormElement = null;
    this.aiPromptElement = null;
    this.aiStatusElement = null;
    this.aiResponseElement = null;
    this.aiSubmitHandler = null;
    this.aiKeydownHandler = null;
    this.aiPanelOpen = false;
    this.keydownHandler = null;
    this.clickHandler = null;
  }

  private loadPreferences(): ToolbarResult {
    if (
      !this.configuration.features.customize ||
      this.host.preferenceStore === undefined
    ) {
      return { ok: true };
    }

    let snapshot;
    try {
      snapshot = this.host.preferenceStore.load();
    } catch (cause) {
      return failure(
        "PREFERENCE_LOAD_FAILED",
        "Saved toolbar preferences could not be loaded.",
        { cause },
      );
    }
    if (snapshot.diagnostic !== undefined) {
      this.pendingPreferenceDiagnostic = snapshot.diagnostic;
    }
    if (snapshot.hasPreferences) this.applyPreferences(snapshot.value);
    return snapshot.diagnostic === undefined
      ? { ok: true }
      : { ok: true, warning: snapshot.diagnostic };
  }

  private applyPreferences(preferences: ToolbarPreferences): void {
    this.preferenceValue = preferences;
    this.collapsed = preferences.collapsed;
    this.configuration = Object.freeze({
      ...this.configuration,
      theme: preferences.theme,
      colorScheme: preferences.colorScheme,
      actions: orderActions(
        this.configuration.actions,
        preferences.actionOrder,
      ),
    });
  }

  private persistCurrentPreferences(): ToolbarResult {
    if (!this.configuration.features.customize) return { ok: true };
    let saved;
    try {
      saved = this.getPreferenceStore().save({
        theme: this.configuration.theme,
        colorScheme: this.configuration.colorScheme,
        collapsed: this.collapsed,
        actionOrder: this.configuration.actions.map(({ id }) => id),
      });
    } catch (cause) {
      const issue: PreferenceDiagnostic = {
        code: "PREFERENCE_STORAGE_WRITE_FAILED",
        message: "Toolbar preferences could not be saved.",
        cause,
      };
      this.reportPreferenceDiagnostic(issue);
      return { ok: true, warning: issue };
    }
    if (!saved.ok) {
      const issue: PreferenceDiagnostic = saved.error;
      this.reportPreferenceDiagnostic(issue);
      return { ok: true, warning: issue };
    }
    this.preferenceValue = saved.value;
    const warning =
      saved.diagnostic ??
      (this.host.preferenceStore === undefined
        ? {
            code: "PREFERENCE_STORAGE_WRITE_FAILED" as const,
            message:
              "No host persistence adapter is configured; preferences are active for this toolbar instance only.",
          }
        : undefined);
    if (warning !== undefined) {
      this.reportPreferenceDiagnostic(warning);
      return { ok: true, warning };
    }
    return { ok: true };
  }

  private getPreferenceStore(): ToolbarPreferenceStore {
    if (this.host.preferenceStore !== undefined) {
      return this.host.preferenceStore;
    }
    this.memoryPreferenceStore ??=
      createToolbarPreferenceStore("toolbar-session");
    return this.memoryPreferenceStore;
  }

  private reportPreferenceDiagnostic(issue: PreferenceDiagnostic): void {
    if (this.statusElement === null) {
      this.pendingPreferenceDiagnostic = issue;
    } else {
      this.statusElement.textContent = preferenceDiagnosticMessage(issue);
      this.statusElement.hidden = false;
      this.statusKind = "preference";
    }
    this.host.onPreferenceError?.(issue);
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

  private syncGestureManager(): void {
    const toolbar = this.toolbarElement;
    const onGesture = this.host.onGesture;
    if (
      toolbar === null ||
      !this.configuration.features.advancedGestures ||
      onGesture === undefined
    ) {
      this.gestureManager?.dispose();
      this.gestureManager = null;
      return;
    }
    this.gestureManager ??= createGestureManager(toolbar, {
      enabled: true,
      onGesture,
    });
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
    toolbar.dataset.theme = this.configuration.theme;
    toolbar.dataset.colorScheme = this.configuration.colorScheme;
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
    for (const [index, action] of this.configuration.actions.entries()) {
      const item = document.createElement("div");
      item.className = "mzk-toolbar__action-item";
      const button = document.createElement("button");
      button.className = "mzk-toolbar__action";
      button.type = "button";
      button.textContent = action.label;
      button.setAttribute("data-toolbar-control", `action:${action.id}`);
      button.setAttribute("aria-label", action.label);
      button.disabled = this.host.dispatchAction === undefined || this.editing;
      button.tabIndex = -1;
      item.appendChild(button);
      if (this.editing) {
        const moveUp = document.createElement("button");
        moveUp.className = "mzk-toolbar__reorder";
        moveUp.type = "button";
        moveUp.textContent = "↑";
        moveUp.setAttribute("data-toolbar-control", `move-up:${action.id}`);
        moveUp.setAttribute("aria-label", `Move ${action.label} earlier`);
        moveUp.disabled = index === 0;
        moveUp.tabIndex = -1;

        const moveDown = document.createElement("button");
        moveDown.className = "mzk-toolbar__reorder";
        moveDown.type = "button";
        moveDown.textContent = "↓";
        moveDown.setAttribute("data-toolbar-control", `move-down:${action.id}`);
        moveDown.setAttribute("aria-label", `Move ${action.label} later`);
        moveDown.disabled = index === this.configuration.actions.length - 1;
        moveDown.tabIndex = -1;
        item.append(moveUp, moveDown);
      }
      actions.appendChild(item);
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

    const controls: HTMLElement[] = [scrollStart, actionViewport, scrollEnd];
    if (this.configuration.features.search) {
      const searchButton = document.createElement("button");
      searchButton.className = "mzk-toolbar__search";
      searchButton.type = "button";
      searchButton.textContent = "Search";
      searchButton.setAttribute("data-toolbar-control", "search");
      searchButton.setAttribute("aria-expanded", String(this.searchPanelOpen));
      searchButton.tabIndex = -1;
      this.searchButtonElement = searchButton;
      controls.push(searchButton);
    } else {
      this.searchButtonElement = null;
    }
    if (this.configuration.features.ai) {
      const aiButton = document.createElement("button");
      aiButton.className = "mzk-toolbar__ai";
      aiButton.type = "button";
      aiButton.textContent = "AI";
      aiButton.setAttribute("aria-label", "Ask AI");
      aiButton.setAttribute("data-toolbar-control", "ai");
      aiButton.setAttribute("aria-expanded", String(this.aiPanelOpen));
      aiButton.tabIndex = -1;
      this.aiButtonElement = aiButton;
      controls.push(aiButton);
    } else {
      this.aiButtonElement = null;
    }
    if (this.configuration.features.tasks) {
      const tasksButton = document.createElement("button");
      tasksButton.className = "mzk-toolbar__tasks";
      tasksButton.type = "button";
      tasksButton.setAttribute("data-toolbar-control", "tasks");
      tasksButton.setAttribute("aria-expanded", String(this.taskPanelOpen));
      tasksButton.tabIndex = -1;
      this.taskButtonElement = tasksButton;
      controls.push(tasksButton);
    } else {
      this.taskButtonElement = null;
    }
    if (this.configuration.features.notifications) {
      const notificationsButton = document.createElement("button");
      notificationsButton.className = "mzk-toolbar__notifications";
      notificationsButton.type = "button";
      notificationsButton.setAttribute("data-toolbar-control", "notifications");
      notificationsButton.setAttribute(
        "aria-expanded",
        String(this.notificationPanelOpen),
      );
      notificationsButton.tabIndex = -1;
      this.notificationButtonElement = notificationsButton;
      controls.push(notificationsButton);
    } else {
      this.notificationButtonElement = null;
    }
    if (this.configuration.features.discovery) {
      const discoveryButton = document.createElement("button");
      discoveryButton.className = "mzk-toolbar__discovery";
      discoveryButton.type = "button";
      discoveryButton.textContent = "Tips";
      discoveryButton.setAttribute("aria-label", "Tips and guidance");
      discoveryButton.setAttribute("data-toolbar-control", "discovery");
      discoveryButton.setAttribute(
        "aria-expanded",
        String(this.discoveryPanelOpen),
      );
      discoveryButton.tabIndex = -1;
      this.discoveryButtonElement = discoveryButton;
      controls.push(discoveryButton);
    } else {
      this.discoveryButtonElement = null;
    }
    if (this.configuration.features.offline) {
      const status = document.createElement("span");
      status.className = "mzk-toolbar__connectivity";
      status.dataset.status = this.connectivityStatus;
      const label = connectivityLabel(this.connectivityStatus);
      status.textContent = label;
      status.setAttribute("aria-label", `Connection status: ${label}`);
      this.connectivityElement = status;
      controls.push(status);
    } else {
      this.connectivityElement = null;
    }
    if (this.configuration.features.customize) {
      const customizeButton = document.createElement("button");
      customizeButton.className = "mzk-toolbar__customize";
      customizeButton.type = "button";
      customizeButton.textContent = this.editing ? "Done" : "Customize";
      customizeButton.setAttribute("data-toolbar-control", "customize");
      customizeButton.setAttribute(
        "aria-label",
        this.editing ? "Done; finish customizing toolbar" : "Customize toolbar",
      );
      customizeButton.setAttribute("aria-pressed", String(this.editing));
      customizeButton.tabIndex = -1;
      controls.push(customizeButton);

      if (this.editing) {
        const themeButton = document.createElement("button");
        themeButton.type = "button";
        themeButton.textContent = `Theme: ${preferenceButtonLabel(this.configuration.theme)}`;
        themeButton.setAttribute("data-toolbar-control", "cycle-theme");
        themeButton.setAttribute(
          "aria-label",
          `Theme: ${preferenceButtonLabel(this.configuration.theme)}. Change theme`,
        );
        themeButton.tabIndex = -1;
        controls.push(themeButton);

        const schemeButton = document.createElement("button");
        schemeButton.type = "button";
        schemeButton.textContent = `Color: ${preferenceButtonLabel(this.configuration.colorScheme)}`;
        schemeButton.setAttribute("data-toolbar-control", "cycle-color-scheme");
        schemeButton.setAttribute(
          "aria-label",
          `Color: ${preferenceButtonLabel(this.configuration.colorScheme)}. Change color scheme`,
        );
        schemeButton.tabIndex = -1;
        controls.push(schemeButton);
      }
    }
    controls.push(collapseButton);
    toolbar.replaceChildren(...controls);
    if (this.configuration.features.tasks) {
      this.ensureTaskPanel(root, document);
    } else {
      this.taskPanelElement?.remove();
      this.taskPanelElement = null;
    }
    if (this.configuration.features.notifications) {
      this.ensureNotificationPanel(root, document);
    } else {
      this.notificationPanelElement?.remove();
      this.notificationPanelElement = null;
    }
    if (this.configuration.features.discovery) {
      this.ensureDiscoveryPanel(root, document);
    } else {
      this.discoveryPanelElement?.remove();
      this.discoveryPanelElement = null;
    }
    if (this.configuration.features.search) {
      this.ensureSearchPanel(root, document);
    } else {
      this.detachSearchPanelHandlers();
      this.searchPanelElement?.remove();
      this.searchPanelElement = null;
      this.searchFormElement = null;
      this.searchInputElement = null;
      this.searchStatusElement = null;
      this.searchResultsElement = null;
    }
    if (this.configuration.features.ai) {
      this.ensureAIPanel(root, document);
    } else {
      this.detachAIPanelHandlers();
      this.aiPanelElement?.remove();
      this.aiPanelElement = null;
      this.aiFormElement = null;
      this.aiPromptElement = null;
      this.aiStatusElement = null;
      this.aiResponseElement = null;
    }
    this.updateTaskButton();
    this.renderTaskCenter();
    this.updateNotificationButton();
    this.renderNotificationCenter();
    this.updateDiscoveryButton();
    this.renderDiscoveryPanel();
    this.renderSearchPanel();
    this.renderAIPanel();
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
    if (this.pendingPreferenceDiagnostic !== null) {
      const issue = this.pendingPreferenceDiagnostic;
      this.pendingPreferenceDiagnostic = null;
      this.reportPreferenceDiagnostic(issue);
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
    if (control === "search") {
      if (this.searchPanelOpen) {
        this.resetSearchState();
      } else {
        this.taskPanelOpen = false;
        this.notificationPanelOpen = false;
        this.discoveryPanelOpen = false;
        this.resetAIState();
        this.searchPanelOpen = true;
        this.updateTaskButton();
        this.renderTaskCenter();
        this.updateNotificationButton();
        this.renderNotificationCenter();
        this.updateDiscoveryButton();
        this.renderDiscoveryPanel();
        this.updateSearchButton();
        this.renderSearchPanel();
        this.searchInputElement?.focus();
      }
      return;
    }
    if (control === "ai") {
      if (this.aiPanelOpen) {
        this.resetAIState();
      } else {
        this.resetSearchState();
        this.taskPanelOpen = false;
        this.notificationPanelOpen = false;
        this.discoveryPanelOpen = false;
        this.updateTaskButton();
        this.renderTaskCenter();
        this.updateNotificationButton();
        this.renderNotificationCenter();
        this.updateDiscoveryButton();
        this.renderDiscoveryPanel();
        this.aiPanelOpen = true;
        this.updateAIButton();
        this.renderAIPanel();
        this.aiPromptElement?.focus();
      }
      return;
    }
    if (control === "tasks") {
      const willOpen = !this.taskPanelOpen;
      if (willOpen) {
        this.resetSearchState();
        this.resetAIState();
        this.discoveryPanelOpen = false;
      }
      this.taskPanelOpen = !this.taskPanelOpen;
      this.notificationPanelOpen = false;
      this.updateTaskButton();
      this.renderTaskCenter();
      this.updateNotificationButton();
      this.renderNotificationCenter();
      this.updateDiscoveryButton();
      this.renderDiscoveryPanel();
      return;
    }
    if (control === "notifications") {
      const willOpen = !this.notificationPanelOpen;
      if (willOpen) {
        this.resetSearchState();
        this.resetAIState();
        this.discoveryPanelOpen = false;
      }
      this.notificationPanelOpen = !this.notificationPanelOpen;
      this.taskPanelOpen = false;
      this.updateNotificationButton();
      this.renderNotificationCenter();
      this.updateTaskButton();
      this.renderTaskCenter();
      this.updateDiscoveryButton();
      this.renderDiscoveryPanel();
      return;
    }
    if (control === "discovery") {
      const willOpen = !this.discoveryPanelOpen;
      if (willOpen) {
        this.resetSearchState();
        this.resetAIState();
        this.taskPanelOpen = false;
        this.notificationPanelOpen = false;
      }
      this.discoveryPanelOpen = willOpen;
      this.updateSearchButton();
      this.renderSearchPanel();
      this.updateAIButton();
      this.renderAIPanel();
      this.updateTaskButton();
      this.renderTaskCenter();
      this.updateNotificationButton();
      this.renderNotificationCenter();
      this.updateDiscoveryButton();
      this.renderDiscoveryPanel();
      return;
    }
    if (control === "customize") {
      this.editing = !this.editing;
      this.render();
      return;
    }
    if (control === "cycle-theme") {
      const index = THEME_NAMES.indexOf(this.configuration.theme);
      const theme = THEME_NAMES[(index + 1) % THEME_NAMES.length];
      if (theme !== undefined) {
        this.applyUserPreferencePatch({ theme });
      }
      return;
    }
    if (control === "cycle-color-scheme") {
      const schemes: readonly ToolbarColorScheme[] = [
        "system",
        "light",
        "dark",
      ];
      const index = schemes.indexOf(this.configuration.colorScheme);
      const colorScheme = schemes[(index + 1) % schemes.length];
      if (colorScheme !== undefined) {
        this.applyUserPreferencePatch({ colorScheme });
      }
      return;
    }
    if (control?.startsWith("move-up:") === true) {
      this.moveAction(control.slice("move-up:".length), -1);
      return;
    }
    if (control?.startsWith("move-down:") === true) {
      this.moveAction(control.slice("move-down:".length), 1);
      return;
    }
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
    if (this.editing) return;
    const action = this.configuration.actions.find(({ id }) => id === actionId);
    if (action !== undefined) {
      this.dispatchAction(action.id, action.label);
    }
  }

  private applyUserPreferencePatch(
    patch: Partial<ToolbarPreferenceValues>,
  ): void {
    const result = this.updateUserPreferences({
      theme: patch.theme ?? this.configuration.theme,
      colorScheme: patch.colorScheme ?? this.configuration.colorScheme,
      collapsed: patch.collapsed ?? this.collapsed,
      actionOrder:
        patch.actionOrder ?? this.configuration.actions.map(({ id }) => id),
    });
    if (!result.ok) {
      this.showCustomizationFailure();
    }
  }

  private moveAction(actionId: string, offset: -1 | 1): void {
    const actions = [...this.configuration.actions];
    const currentIndex = actions.findIndex(({ id }) => id === actionId);
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= actions.length) {
      return;
    }
    const [action] = actions.splice(currentIndex, 1);
    if (action === undefined) return;
    actions.splice(targetIndex, 0, action);
    this.applyUserPreferencePatch({
      actionOrder: actions.map(({ id }) => id),
    });
  }

  private showCustomizationFailure(): void {
    if (this.statusElement !== null) {
      this.statusElement.textContent =
        "Toolbar preferences could not be changed.";
      this.statusElement.hidden = false;
      this.statusKind = "customization";
    }
  }

  private ensureTaskPanel(root: RenderRoot, document: Document): void {
    if (this.taskPanelElement !== null) return;
    const panel = document.createElement("section");
    panel.className = "mzk-toolbar__task-center";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Task Center");
    panel.setAttribute("aria-live", "polite");
    panel.hidden = true;
    root.insertBefore(panel, this.statusElement);
    this.taskPanelElement = panel;
  }

  private updateTaskButton(): void {
    const button = this.taskButtonElement;
    if (button === null) return;
    const label =
      this.taskItems.length === 0
        ? "Tasks"
        : `Tasks (${this.taskItems.length})`;
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-expanded", String(this.taskPanelOpen));
  }

  private renderTaskCenter(): void {
    const panel = this.taskPanelElement;
    if (panel === null) return;
    panel.hidden = !this.taskPanelOpen;
    panel.dataset.theme = this.configuration.theme;
    panel.dataset.colorScheme = this.configuration.colorScheme;
    panel.replaceChildren();
    if (!this.taskPanelOpen) return;

    const document = panel.ownerDocument;
    const heading = document.createElement("h2");
    heading.textContent = "Task Center";
    panel.appendChild(heading);
    if (this.taskItems.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.textContent = "No tasks to display.";
      panel.appendChild(emptyState);
      return;
    }

    const list = document.createElement("ul");
    for (const task of this.taskItems) {
      const item = document.createElement("li");
      item.className = "mzk-toolbar__task";
      const label = document.createElement("span");
      label.className = "mzk-toolbar__task-label";
      label.textContent = task.label;
      const status = document.createElement("span");
      status.className = "mzk-toolbar__task-status";
      status.textContent = preferenceButtonLabel(task.status);
      item.append(label, status);
      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  private ensureNotificationPanel(root: RenderRoot, document: Document): void {
    if (this.notificationPanelElement !== null) return;
    const panel = document.createElement("section");
    panel.className = "mzk-toolbar__notification-center";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Notifications");
    panel.hidden = true;
    root.insertBefore(panel, this.statusElement);
    this.notificationPanelElement = panel;
  }

  private updateNotificationButton(): void {
    const button = this.notificationButtonElement;
    if (button === null) return;
    const unreadCount = this.notificationItems.filter(
      ({ unread }) => unread,
    ).length;
    const label =
      unreadCount === 0 ? "Notifications" : `Notifications (${unreadCount})`;
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-expanded", String(this.notificationPanelOpen));
  }

  private renderNotificationCenter(): void {
    const panel = this.notificationPanelElement;
    if (panel === null) return;
    panel.hidden = !this.notificationPanelOpen;
    panel.dataset.theme = this.configuration.theme;
    panel.dataset.colorScheme = this.configuration.colorScheme;
    panel.replaceChildren();
    if (!this.notificationPanelOpen) return;

    const document = panel.ownerDocument;
    const heading = document.createElement("h2");
    heading.textContent = "Notifications";
    panel.appendChild(heading);
    if (this.notificationItems.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.textContent = "No notifications.";
      panel.appendChild(emptyState);
      return;
    }

    const list = document.createElement("ul");
    for (const notification of this.notificationItems) {
      const item = document.createElement("li");
      item.className = "mzk-toolbar__notification";
      item.dataset.severity = notification.severity;
      const title = document.createElement("strong");
      title.textContent = notification.title;
      const message = document.createElement("p");
      message.textContent = notification.message;
      const metadata = document.createElement("span");
      metadata.className = "mzk-toolbar__notification-status";
      metadata.textContent = `${preferenceButtonLabel(notification.severity)}${
        notification.unread ? " · Unread" : ""
      }`;
      item.append(title, message, metadata);
      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  private ensureDiscoveryPanel(root: RenderRoot, document: Document): void {
    if (this.discoveryPanelElement !== null) return;
    const panel = document.createElement("section");
    panel.className = "mzk-toolbar__discovery-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Tips and guidance");
    panel.hidden = true;
    root.insertBefore(panel, this.statusElement);
    this.discoveryPanelElement = panel;
  }

  private updateDiscoveryButton(): void {
    this.discoveryButtonElement?.setAttribute(
      "aria-expanded",
      String(this.discoveryPanelOpen),
    );
  }

  private renderDiscoveryPanel(): void {
    const panel = this.discoveryPanelElement;
    if (panel === null) return;
    panel.hidden = !this.discoveryPanelOpen;
    panel.dataset.theme = this.configuration.theme;
    panel.dataset.colorScheme = this.configuration.colorScheme;
    panel.replaceChildren();
    if (!this.discoveryPanelOpen) return;

    const document = panel.ownerDocument;
    const heading = document.createElement("h2");
    heading.textContent = "Tips and guidance";
    panel.appendChild(heading);
    if (this.discoveryHints.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.textContent = "No tips are available.";
      panel.appendChild(emptyState);
      return;
    }

    const list = document.createElement("ul");
    for (const hint of this.discoveryHints) {
      const item = document.createElement("li");
      item.className = "mzk-toolbar__discovery-hint";
      const title = document.createElement("strong");
      title.textContent = hint.title;
      const message = document.createElement("p");
      message.textContent = hint.message;
      item.append(title, message);
      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  private ensureSearchPanel(root: RenderRoot, document: Document): void {
    if (this.searchPanelElement !== null) return;
    const panel = document.createElement("section");
    panel.className = "mzk-toolbar__search-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Search");
    panel.hidden = true;

    const heading = document.createElement("h2");
    heading.textContent = "Search";
    const form = document.createElement("form");
    form.className = "mzk-toolbar__search-form";
    form.setAttribute("role", "search");
    form.setAttribute("aria-label", "Search toolbar and content");
    const label = document.createElement("label");
    label.textContent = "Search toolbar actions and content";
    const input = document.createElement("input");
    input.type = "search";
    input.maxLength = MAX_SEARCH_QUERY;
    input.autocomplete = "off";
    input.setAttribute("data-toolbar-search-input", "");
    label.appendChild(input);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Submit search";
    const status = document.createElement("p");
    status.className = "mzk-toolbar__search-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const results = document.createElement("ul");
    results.className = "mzk-toolbar__search-results";
    form.append(label, submit);
    panel.append(heading, form, status, results);
    root.insertBefore(panel, this.statusElement);

    this.searchPanelElement = panel;
    this.searchFormElement = form;
    this.searchInputElement = input;
    this.searchStatusElement = status;
    this.searchResultsElement = results;
    this.searchSubmitHandler = (event) => {
      event.preventDefault();
      void this.submitSearch();
    };
    this.searchKeydownHandler = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.resetSearchState();
      this.searchButtonElement?.focus();
    };
    this.searchResultsClickHandler = (event) =>
      this.handleSearchResultClick(event);
    form.addEventListener("submit", this.searchSubmitHandler);
    panel.addEventListener("keydown", this.searchKeydownHandler);
    panel.addEventListener("click", this.searchResultsClickHandler);
  }

  private detachSearchPanelHandlers(): void {
    if (this.searchFormElement !== null && this.searchSubmitHandler !== null) {
      this.searchFormElement.removeEventListener(
        "submit",
        this.searchSubmitHandler,
      );
    }
    if (
      this.searchPanelElement !== null &&
      this.searchKeydownHandler !== null
    ) {
      this.searchPanelElement.removeEventListener(
        "keydown",
        this.searchKeydownHandler,
      );
    }
    if (
      this.searchPanelElement !== null &&
      this.searchResultsClickHandler !== null
    ) {
      this.searchPanelElement.removeEventListener(
        "click",
        this.searchResultsClickHandler,
      );
    }
    this.searchSubmitHandler = null;
    this.searchKeydownHandler = null;
    this.searchResultsClickHandler = null;
  }

  private updateSearchButton(): void {
    this.searchButtonElement?.setAttribute(
      "aria-expanded",
      String(this.searchPanelOpen),
    );
  }

  private renderSearchPanel(): void {
    const panel = this.searchPanelElement;
    if (panel === null) return;
    panel.hidden = !this.searchPanelOpen;
    panel.dataset.theme = this.configuration.theme;
    panel.dataset.colorScheme = this.configuration.colorScheme;
    this.updateSearchButton();
    this.renderSearchResults();
  }

  private renderSearchResults(): void {
    const list = this.searchResultsElement;
    if (list === null) return;
    list.replaceChildren();
    for (const [index, result] of this.searchResults.entries()) {
      const item = list.ownerDocument.createElement("li");
      let title: string;
      let summary: string | undefined;
      const isSelectable =
        result.kind === "action"
          ? this.host.dispatchAction !== undefined
          : this.host.onSearchResult !== undefined;
      if (result.kind === "action") {
        title = result.title;
      } else {
        title = result.result.title;
        summary = result.result.summary;
      }

      if (isSelectable) {
        const button = list.ownerDocument.createElement("button");
        button.type = "button";
        button.className = "mzk-toolbar__search-result";
        button.setAttribute("data-search-result-index", String(index));
        button.textContent =
          summary === undefined ? title : `${title}: ${summary}`;
        item.appendChild(button);
      } else {
        const text = list.ownerDocument.createElement("span");
        text.textContent =
          summary === undefined ? title : `${title}: ${summary}`;
        item.appendChild(text);
      }
      list.appendChild(item);
    }
  }

  private cancelSearchRequest(): void {
    this.searchRequestVersion += 1;
    this.searchAbortController?.abort();
    this.searchAbortController = null;
  }

  private resetSearchState(): void {
    this.cancelSearchRequest();
    this.searchPanelOpen = false;
    this.searchResults = Object.freeze([]);
    if (this.searchInputElement !== null) this.searchInputElement.value = "";
    if (this.searchStatusElement !== null) {
      this.searchStatusElement.textContent = "";
    }
    this.updateSearchButton();
    this.renderSearchPanel();
  }

  private async submitSearch(): Promise<void> {
    const input = this.searchInputElement;
    const status = this.searchStatusElement;
    if (
      input === null ||
      status === null ||
      !this.searchPanelOpen ||
      !this.configuration.features.search
    ) {
      return;
    }
    this.cancelSearchRequest();
    const rawQuery = input.value;
    if (rawQuery.trim().length === 0) {
      this.searchResults = Object.freeze([]);
      status.textContent = "Enter a search term.";
      this.renderSearchResults();
      return;
    }
    if (rawQuery.length > MAX_SEARCH_QUERY) {
      this.searchResults = Object.freeze([]);
      status.textContent = "Search query is too long.";
      this.renderSearchResults();
      return;
    }
    const query = rawQuery.trim();
    const version = this.searchRequestVersion;
    const localResults: SearchDisplayResult[] = this.configuration.actions
      .filter(({ id, label }) =>
        `${label} ${id}`.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, MAX_SEARCH_DISPLAY_RESULTS)
      .map(({ id, label }) => ({
        kind: "action" as const,
        id,
        title: label,
      }));
    this.searchResults = Object.freeze(localResults);
    const coordinator = this.host.searchCoordinator;
    if (coordinator === undefined) {
      status.textContent =
        localResults.length === 0
          ? "No results."
          : `${localResults.length} matching toolbar actions.`;
      this.renderSearchResults();
      return;
    }

    const abortController = new AbortController();
    this.searchAbortController = abortController;
    status.textContent = "Searching…";
    this.renderSearchResults();
    try {
      let outcome: FederatedSearchOutcome;
      try {
        outcome = await coordinator.search(query, abortController.signal);
      } catch (cause) {
        if (
          version !== this.searchRequestVersion ||
          abortController.signal.aborted ||
          !this.searchPanelOpen
        ) {
          return;
        }
        status.textContent = "Search could not be completed.";
        this.host.onSearchError?.(cause, query);
        return;
      }
      if (
        version !== this.searchRequestVersion ||
        abortController.signal.aborted ||
        !this.searchPanelOpen
      ) {
        return;
      }
      if (outcome.ok) {
        const providerResults: SearchDisplayResult[] = outcome.results.map(
          (result) => ({
            kind: "provider",
            result,
          }),
        );
        this.searchResults = Object.freeze(
          [...localResults, ...providerResults].slice(
            0,
            MAX_SEARCH_DISPLAY_RESULTS,
          ),
        );
      }
      status.textContent = searchOutcomeMessage(outcome);
      this.renderSearchResults();
      if (!outcome.ok && outcome.error.code !== "SEARCH_CANCELLED") {
        this.host.onSearchError?.(outcome.error, query);
      }
    } finally {
      if (this.searchAbortController === abortController) {
        this.searchAbortController = null;
      }
    }
  }

  private handleSearchResultClick(event: MouseEvent): void {
    const list = this.searchResultsElement;
    if (list === null) return;
    const button = Array.from(
      list.querySelectorAll<HTMLButtonElement>(
        "button[data-search-result-index]",
      ),
    ).find((candidate) => event.composedPath().includes(candidate));
    if (button === undefined || button.disabled) return;
    const index = Number(button.getAttribute("data-search-result-index"));
    if (!Number.isSafeInteger(index) || index < 0) return;
    const result = this.searchResults[index];
    if (result === undefined) return;

    this.resetSearchState();
    this.searchButtonElement?.focus();
    if (result.kind === "action") {
      const action = this.configuration.actions.find(
        ({ id }) => id === result.id,
      );
      if (action !== undefined) this.dispatchAction(action.id, action.label);
      return;
    }
    const callback = this.host.onSearchResult;
    if (callback === undefined) return;
    try {
      void Promise.resolve(
        callback(result.result.providerId, result.result.id),
      ).catch((cause: unknown) =>
        this.reportSearchResultFailure(result.result, cause),
      );
    } catch (cause) {
      this.reportSearchResultFailure(result.result, cause);
    }
  }

  private reportSearchResultFailure(
    result: ToolbarSearchResult,
    cause: unknown,
  ): void {
    if (this.statusElement !== null) {
      this.statusElement.textContent = "Could not open the search result.";
      this.statusElement.hidden = false;
      this.statusKind = "search";
    }
    this.host.onSearchResultError?.(cause, result.providerId, result.id);
  }

  private ensureAIPanel(root: RenderRoot, document: Document): void {
    if (this.aiPanelElement !== null) return;
    const panel = document.createElement("section");
    panel.className = "mzk-toolbar__ai-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "AI assistant");
    panel.hidden = true;

    const heading = document.createElement("h2");
    heading.textContent = "Ask AI";
    const form = document.createElement("form");
    form.className = "mzk-toolbar__ai-form";
    const label = document.createElement("label");
    label.textContent = "Prompt";
    const prompt = document.createElement("textarea");
    prompt.maxLength = MAX_AI_PROMPT;
    prompt.rows = 4;
    prompt.setAttribute("data-toolbar-ai-prompt", "");
    label.appendChild(prompt);
    const disclosure = document.createElement("p");
    disclosure.className = "mzk-toolbar__ai-disclosure";
    disclosure.textContent =
      "Only include information approved by your app for AI processing.";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Generate response";
    submit.disabled = this.host.aiAdapter === undefined;
    const status = document.createElement("p");
    status.className = "mzk-toolbar__ai-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    if (this.host.aiAdapter === undefined) {
      status.textContent = "No host AI provider is configured.";
    }
    const response = document.createElement("div");
    response.className = "mzk-toolbar__ai-response";
    response.setAttribute("aria-live", "polite");
    response.setAttribute("aria-atomic", "true");
    form.append(label, disclosure, submit);
    panel.append(heading, form, status, response);
    root.insertBefore(panel, this.statusElement);

    this.aiPanelElement = panel;
    this.aiFormElement = form;
    this.aiPromptElement = prompt;
    this.aiStatusElement = status;
    this.aiResponseElement = response;
    this.aiSubmitHandler = (event) => {
      event.preventDefault();
      void this.submitAI();
    };
    this.aiKeydownHandler = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.resetAIState();
      this.aiButtonElement?.focus();
    };
    form.addEventListener("submit", this.aiSubmitHandler);
    panel.addEventListener("keydown", this.aiKeydownHandler);
  }

  private detachAIPanelHandlers(): void {
    if (this.aiFormElement !== null && this.aiSubmitHandler !== null) {
      this.aiFormElement.removeEventListener("submit", this.aiSubmitHandler);
    }
    if (this.aiPanelElement !== null && this.aiKeydownHandler !== null) {
      this.aiPanelElement.removeEventListener("keydown", this.aiKeydownHandler);
    }
    this.aiSubmitHandler = null;
    this.aiKeydownHandler = null;
  }

  private updateAIButton(): void {
    this.aiButtonElement?.setAttribute(
      "aria-expanded",
      String(this.aiPanelOpen),
    );
  }

  private renderAIPanel(): void {
    const panel = this.aiPanelElement;
    if (panel === null) return;
    panel.hidden = !this.aiPanelOpen;
    panel.dataset.theme = this.configuration.theme;
    panel.dataset.colorScheme = this.configuration.colorScheme;
    this.updateAIButton();
  }

  private cancelAIRequest(): void {
    this.aiRequestVersion += 1;
    this.aiAbortController?.abort();
    this.aiAbortController = null;
  }

  private resetAIState(): void {
    this.cancelAIRequest();
    this.aiPanelOpen = false;
    if (this.aiPromptElement !== null) this.aiPromptElement.value = "";
    if (this.aiStatusElement !== null) {
      this.aiStatusElement.textContent =
        this.host.aiAdapter === undefined
          ? "No host AI provider is configured."
          : "";
    }
    if (this.aiResponseElement !== null) {
      this.aiResponseElement.textContent = "";
    }
    this.updateAIButton();
    this.renderAIPanel();
  }

  private async submitAI(): Promise<void> {
    const promptElement = this.aiPromptElement;
    const status = this.aiStatusElement;
    const response = this.aiResponseElement;
    if (
      promptElement === null ||
      status === null ||
      response === null ||
      !this.aiPanelOpen ||
      !this.configuration.features.ai
    ) {
      return;
    }
    this.cancelAIRequest();
    const prompt = promptElement.value;
    if (prompt.trim().length === 0 || prompt.length > MAX_AI_PROMPT) {
      status.textContent = "Enter a prompt of 1 to 8,000 characters.";
      response.textContent = "";
      return;
    }
    const adapter = this.host.aiAdapter;
    if (adapter === undefined) {
      status.textContent = "No host AI provider is configured.";
      response.textContent = "";
      return;
    }

    const version = this.aiRequestVersion;
    const abortController = new AbortController();
    this.aiAbortController = abortController;
    status.textContent = "Generating response…";
    response.textContent = "";
    try {
      let outcome: AICompletionOutcome;
      try {
        outcome = await adapter.complete(prompt, abortController.signal);
      } catch (cause) {
        if (
          version !== this.aiRequestVersion ||
          abortController.signal.aborted ||
          !this.aiPanelOpen
        ) {
          return;
        }
        status.textContent = "AI response is unavailable.";
        this.host.onAIError?.(cause);
        return;
      }
      if (
        version !== this.aiRequestVersion ||
        abortController.signal.aborted ||
        !this.aiPanelOpen
      ) {
        return;
      }
      status.textContent = aiOutcomeMessage(outcome);
      if (outcome.ok) {
        response.textContent = outcome.text;
      } else if (
        outcome.error.cause !== undefined ||
        outcome.error.code === "AI_PROVIDER_FAILED"
      ) {
        this.host.onAIError?.(outcome.error);
      }
    } finally {
      if (this.aiAbortController === abortController) {
        this.aiAbortController = null;
      }
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

    if (this.statusElement !== null && this.statusKind === "action") {
      this.statusElement.hidden = true;
      this.statusElement.textContent = "";
      this.statusKind = null;
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
      this.statusKind = "action";
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
