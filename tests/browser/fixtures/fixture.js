import { createGestureManager, createToolbar } from "/toolbar/index.js";
import { createShortcutManager } from "/toolbar/input.js";

const target = document.querySelector("#target");
const result = document.querySelector("#action-result");
const toolbar = createToolbar(
  {
    actions: [
      { id: "home", label: "Home" },
      { id: "projects", label: "Projects" },
      { id: "documentation", label: "Documentation" },
      { id: "settings", label: "Settings" },
      { id: "support", label: "Support" },
    ],
  },
  {
    dispatchAction(actionId) {
      result.textContent = actionId;
    },
  },
);

const mounted = toolbar.mount(target);
if (!mounted.ok) {
  throw new Error(mounted.error.message);
}

window.toolbar = toolbar;
window.mountLightToolbar = () => {
  const lightToolbar = createToolbar(
    {
      renderMode: "light",
      label: "Light mode toolbar",
      actions: [{ id: "search", label: "Search" }],
    },
    { dispatchAction: (actionId) => (result.textContent = actionId) },
  );
  const outcome = lightToolbar.mount(document.querySelector("#light-target"));
  if (!outcome.ok) throw new Error(outcome.error.message);
  return lightToolbar;
};
window.mountPlacementToolbar = (mode) => {
  const placementToolbar = createToolbar(
    {
      placement: { mode, anchor: "bottom" },
      label: `${mode} toolbar`,
      actions: [{ id: "home", label: "Home" }],
    },
    { dispatchAction: () => {} },
  );
  const outcome = placementToolbar.mount(
    document.querySelector("#container-target"),
  );
  if (!outcome.ok) throw new Error(outcome.error.message);
  window.placementToolbar = placementToolbar;
};

window.mountTaskToolbar = () => {
  const taskToolbar = createToolbar(
    {
      features: { tasks: true },
      label: "Task Center test toolbar",
    },
    { dispatchAction: () => {} },
  );
  const outcome = taskToolbar.mount(document.querySelector("#task-target"));
  if (!outcome.ok) throw new Error(outcome.error.message);
  window.taskToolbar = taskToolbar;
};

window.mountNotificationsToolbar = () => {
  const notificationToolbar = createToolbar({
    features: { notifications: true },
    label: "Notifications test toolbar",
  });
  const outcome = notificationToolbar.mount(
    document.querySelector("#notification-target"),
  );
  if (!outcome.ok) throw new Error(outcome.error.message);
  window.notificationToolbar = notificationToolbar;
};

window.mountOfflineToolbar = () => {
  const offlineToolbar = createToolbar({
    features: { offline: true },
    label: "Offline status test toolbar",
  });
  const outcome = offlineToolbar.mount(
    document.querySelector("#offline-target"),
  );
  if (!outcome.ok) throw new Error(outcome.error.message);
  window.offlineToolbar = offlineToolbar;
};

window.mountGestureManager = (enabled) => {
  const gestures = [];
  const manager = createGestureManager(
    document.querySelector("#gesture-target"),
    {
      enabled,
      onGesture: (intent) => gestures.push(intent),
    },
  );
  window.gestureManager = manager;
  window.gestureResults = gestures;
};

window.mountIntegratedGestureToolbar = () => {
  window.integratedGestures = [];
  const toolbar = createToolbar(
    {
      features: { advancedGestures: true },
      label: "Integrated gesture toolbar",
    },
    {
      onGesture: (intent) => window.integratedGestures.push(intent),
    },
  );
  const outcome = toolbar.mount(document.querySelector("#gesture-target"));
  if (!outcome.ok) throw new Error(outcome.error.message);
  window.integratedGestureToolbar = toolbar;
};

window.mountAIToolbar = () => {
  window.aiRequests = [];
  const aiToolbar = createToolbar(
    {
      features: { ai: true },
      label: "AI test toolbar",
    },
    {
      aiAdapter: {
        async complete(prompt) {
          window.aiRequests.push(prompt);
          return {
            ok: true,
            text: "<img src=x onerror=alert(1)> AI response",
          };
        },
      },
    },
  );
  const outcome = aiToolbar.mount(document.querySelector("#ai-target"));
  if (!outcome.ok) throw new Error(outcome.error.message);
  window.aiToolbar = aiToolbar;
};

window.mountShortcutManager = () => {
  let activeScope = "app:editor";
  const shortcutManager = createShortcutManager(target, {
    getActiveScope: () => activeScope,
    authorize: (shortcut) => shortcut.scope === activeScope,
    onDiagnostic: () => {},
    onError: (error) => {
      throw error;
    },
  });
  const registration = shortcutManager.register({
    id: "app:search",
    key: "k",
    ctrlKey: true,
    scope: "app:editor",
    execute: () => {
      result.textContent = "shortcut";
    },
  });
  if (!registration.ok) throw new Error(registration.error.message);
  window.shortcutManager = shortcutManager;
  window.setShortcutScope = (scope) => {
    activeScope = scope;
  };
};
