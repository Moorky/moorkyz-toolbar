import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  PREFERENCE_SCHEMA_VERSION,
  ToolbarConfigurationError,
  createToolbar,
  createToolbarPreferenceStore,
} from "../dist/index.js";

function fixture(configuration = {}, host = {}) {
  const window = new Window({ url: "http://localhost/" });
  const target = window.document.createElement("main");
  window.document.body.appendChild(target);
  const toolbar = createToolbar(configuration, host);
  return { window, target, toolbar };
}

function disposeFixture(fixture) {
  fixture.toolbar.dispose();
  fixture.window.close();
}

test("module import is SSR-safe and does not need browser globals", () => {
  assert.equal("window" in globalThis, false);
  assert.equal(typeof createToolbar, "function");
});

test("mounts a semantic Shadow DOM toolbar with a local stylesheet", (t) => {
  const current = fixture({
    actions: [
      { id: "home", label: "Home" },
      { id: "projects", label: "Projects" },
    ],
  });
  t.after(() => disposeFixture(current));

  const result = current.toolbar.mount(current.target);
  assert.equal(result.ok, true);
  assert.equal(current.toolbar.isMounted, true);
  assert.equal(current.target.children.length, 1);

  const shadow = current.target.firstElementChild.shadowRoot;
  assert.ok(shadow);
  assert.equal(
    shadow.querySelector('[role="toolbar"]').getAttribute("aria-label"),
    "Application toolbar",
  );
  assert.equal(shadow.querySelectorAll("button").length, 8);
  assert.equal(
    shadow.querySelectorAll('[data-toolbar-control^="action:"][disabled]')
      .length,
    2,
  );
  assert.equal(
    shadow.querySelector('[data-toolbar-control="scroll-start"]').hidden,
    true,
  );
  assert.equal(
    shadow.querySelector('[data-toolbar-control="scroll-end"]').hidden,
    true,
  );
  assert.match(
    shadow.querySelector('link[rel="stylesheet"]').getAttribute("href"),
    /toolbar\.css$/,
  );
  assert.equal(shadow.querySelector("style"), null);
});

test("dispatches configured actions only through the host callback", (t) => {
  const dispatched = [];
  const current = fixture(
    { actions: [{ id: "home", label: "Home" }] },
    { dispatchAction: (id) => dispatched.push(id) },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);

  const action = current.target.firstElementChild.shadowRoot.querySelector(
    '[data-toolbar-control="action:home"]',
  );
  action.click();
  assert.deepEqual(dispatched, ["home"]);
});

test("ignores hidden actions and detached action nodes after disposal", (t) => {
  const dispatched = [];
  const current = fixture(
    { actions: [{ id: "home", label: "Home" }] },
    { dispatchAction: (id) => dispatched.push(id) },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);

  const shadow = current.target.firstElementChild.shadowRoot;
  current.toolbar.collapse();
  const hiddenAction = shadow.querySelector(
    '[data-toolbar-control="action:home"]',
  );
  hiddenAction.click();
  assert.deepEqual(dispatched, []);

  current.toolbar.expand();
  const action = shadow.querySelector('[data-toolbar-control="action:home"]');
  action.click();
  assert.deepEqual(dispatched, ["home"]);

  current.toolbar.dispose();
  action.click();
  assert.deepEqual(dispatched, ["home"]);
});

test("supports toolbar arrow/Home/End keyboard navigation and manual collapse", (t) => {
  const current = fixture(
    {
      actions: [
        { id: "home", label: "Home" },
        { id: "projects", label: "Projects" },
      ],
    },
    { dispatchAction: () => {} },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);

  const shadow = current.target.firstElementChild.shadowRoot;
  const home = shadow.querySelector('[data-toolbar-control="action:home"]');
  const projects = shadow.querySelector(
    '[data-toolbar-control="action:projects"]',
  );
  assert.equal(home.tabIndex, 0);

  home.focus();
  home.dispatchEvent(
    new current.window.KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(shadow.activeElement, projects);

  projects.dispatchEvent(
    new current.window.KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(
    shadow.activeElement.getAttribute("data-toolbar-control"),
    "collapse",
  );

  current.toolbar.collapse();
  const collapsedActions = shadow.querySelector(".mzk-toolbar__actions");
  const restore = shadow.querySelector('[data-toolbar-control="collapse"]');
  assert.equal(collapsedActions.hidden, true);
  assert.equal(restore.getAttribute("aria-expanded"), "false");
  assert.equal(shadow.activeElement, restore);

  restore.click();
  assert.equal(current.toolbar.isCollapsed, false);
  assert.equal(shadow.querySelector(".mzk-toolbar__actions").hidden, false);
});

test("repeated mount and disposal leave no attached DOM nodes", () => {
  const window = new Window({ url: "http://localhost/" });
  const target = window.document.createElement("main");
  window.document.body.appendChild(target);

  for (let index = 0; index < 50; index += 1) {
    const toolbar = createToolbar();
    assert.equal(toolbar.mount(target).ok, true);
    assert.equal(target.children.length, 1);
    toolbar.dispose();
    assert.equal(target.children.length, 0);
  }

  window.close();
});

test("updates are atomic, preserve focused action identity, and lock mount mode", (t) => {
  const current = fixture(
    { actions: [{ id: "home", label: "Home" }] },
    { dispatchAction: () => {} },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);

  const shadow = current.target.firstElementChild.shadowRoot;
  shadow.querySelector('[data-toolbar-control="action:home"]').focus();
  const invalid = current.toolbar.update({
    actions: [{ id: "bad/id", label: "Bad" }],
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    shadow.querySelector('[data-toolbar-control="action:home"]').textContent,
    "Home",
  );

  const modeChange = current.toolbar.update({
    renderMode: "light",
    actions: [{ id: "home", label: "Home" }],
  });
  assert.equal(modeChange.ok, false);
  if (!modeChange.ok)
    assert.equal(modeChange.error.code, "MOUNT_MODE_IMMUTABLE");

  const updated = current.toolbar.update({
    actions: [{ id: "home", label: "Start" }],
  });
  assert.equal(updated.ok, true);
  assert.equal(shadow.activeElement.textContent, "Start");
});

test("reports host action failures with an accessible error and host diagnostic", async (t) => {
  const reported = [];
  const current = fixture(
    { actions: [{ id: "save", label: "Save" }] },
    {
      dispatchAction: async () => {
        throw new Error("sensitive host detail");
      },
      onActionError: (error, id) => reported.push([error.message, id]),
    },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);

  const shadow = current.target.firstElementChild.shadowRoot;
  shadow.querySelector('[data-toolbar-control="action:save"]').click();
  await new Promise((resolve) => setImmediate(resolve));

  const alert = shadow.querySelector('[role="alert"]');
  assert.equal(alert.hidden, false);
  assert.equal(alert.textContent, "Could not complete Save. Try again.");
  assert.deepEqual(reported, [["sensitive host detail", "save"]]);
});

test("supports Light DOM, idempotent mount, and complete disposal", (t) => {
  const current = fixture({ renderMode: "light" });
  t.after(() => disposeFixture(current));

  assert.equal(current.toolbar.mount(current.target).ok, true);
  assert.equal(current.toolbar.mount(current.target).ok, true);
  assert.equal(current.target.children.length, 1);
  const mountHost = current.target.firstElementChild;
  assert.equal(mountHost.dataset.placement, "viewport");
  assert.equal(
    current.target.querySelector('[role="toolbar"]').getAttribute("aria-label"),
    "Application toolbar",
  );
  assert.equal(
    current.toolbar.update({ placement: { mode: "container" } }).ok,
    true,
  );
  assert.equal(mountHost.dataset.placement, "container");
  assert.equal(current.toolbar.update({ label: "Light dock" }).ok, true);
  assert.equal(mountHost.dataset.placement, "container");
  assert.equal(
    current.target.querySelector('[role="toolbar"]').getAttribute("aria-label"),
    "Light dock",
  );
  assert.equal(
    current.toolbar.mount(current.window.document.createElement("main")).ok,
    false,
  );

  current.toolbar.dispose();
  assert.equal(current.target.children.length, 0);
  assert.equal(current.toolbar.isMounted, false);
  assert.equal(current.toolbar.mount(current.target).ok, false);
  assert.equal(current.toolbar.update({}).ok, false);
  current.toolbar.dispose();
});

test("spatial zones are inert when disabled and require a host viewport when enabled", (t) => {
  const disabled = fixture();
  t.after(() => disposeFixture(disabled));
  let inspected = false;
  const hostileZone = Object.defineProperty({}, "id", {
    enumerable: true,
    get() {
      inspected = true;
      return "unsafe";
    },
  });
  const disabledResult = disabled.toolbar.updateSpatialZones([hostileZone]);
  assert.equal(disabledResult.ok, false);
  if (!disabledResult.ok) {
    assert.equal(disabledResult.error.code, "SPATIAL_DISABLED");
  }
  assert.equal(inspected, false);

  const enabled = fixture({ features: { spatialCoordination: true } });
  t.after(() => disposeFixture(enabled));
  const missingViewport = enabled.toolbar.updateSpatialZones([
    { id: "reserved", x: 0, y: 0, width: 20, height: 20 },
  ]);
  assert.equal(missingViewport.ok, false);
  if (!missingViewport.ok) {
    assert.equal(missingViewport.error.code, "SPATIAL_VIEWPORT_REQUIRED");
  }
});

test("spatial placement uses only host zones and cleans resize work when disabled", (t) => {
  let viewportCalls = 0;
  const current = fixture(
    { features: { spatialCoordination: true } },
    {
      getSpatialViewport: () => {
        viewportCalls += 1;
        return {
          width: 1200,
          height: 800,
          safeArea: { top: 12, right: 12, bottom: 12, left: 12 },
        };
      },
    },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);
  const hostElement = current.target.firstElementChild;
  const toolbar = hostElement.shadowRoot.querySelector('[role="toolbar"]');
  toolbar.getBoundingClientRect = () => ({ width: 200, height: 80 });

  const result = current.toolbar.updateSpatialZones([
    { id: "center-dock", x: 500, y: 708, width: 200, height: 80 },
  ]);
  assert.equal(result.ok, true);
  assert.equal(hostElement.dataset.spatialAnchor, "bottom-start");
  assert.equal(viewportCalls, 1);

  current.window.dispatchEvent(new current.window.Event("resize"));
  assert.equal(viewportCalls, 2);
  assert.equal(
    current.toolbar.update({ features: { spatialCoordination: false } }).ok,
    true,
  );
  assert.equal(hostElement.dataset.spatialAnchor, undefined);
  assert.equal(hostElement.dataset.spatialConflict, undefined);
  const callsAfterDisable = viewportCalls;
  current.window.dispatchEvent(new current.window.Event("resize"));
  assert.equal(viewportCalls, callsAfterDisable);
});

test("spatial no-safe-placement is surfaced without forcing an anchor", (t) => {
  const reported = [];
  const current = fixture(
    { features: { spatialCoordination: true } },
    {
      getSpatialViewport: () => ({ width: 1200, height: 800 }),
      onSpatialError: (error) => reported.push(error.code),
    },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);
  const hostElement = current.target.firstElementChild;
  const toolbar = hostElement.shadowRoot.querySelector('[role="toolbar"]');
  toolbar.getBoundingClientRect = () => ({ width: 200, height: 80 });

  assert.equal(
    current.toolbar.updateSpatialZones([
      { id: "center-dock", x: 500, y: 720, width: 200, height: 80 },
    ]).ok,
    true,
  );
  assert.equal(hostElement.dataset.spatialAnchor, "bottom-start");

  const result = current.toolbar.updateSpatialZones([
    { id: "full-frame", x: 0, y: 0, width: 1200, height: 800 },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.spatialWarning.code, "SPATIAL_NO_SAFE_PLACEMENT");
  }
  assert.equal(hostElement.dataset.spatialAnchor, "bottom-start");
  assert.equal(hostElement.dataset.spatialConflict, "true");
  assert.deepEqual(reported, ["SPATIAL_NO_SAFE_PLACEMENT"]);
});

test("spatial resize work is removed on disposal", (t) => {
  let viewportCalls = 0;
  const current = fixture(
    { features: { spatialCoordination: true } },
    {
      getSpatialViewport: () => {
        viewportCalls += 1;
        return { width: 1200, height: 800 };
      },
    },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);
  const toolbar =
    current.target.firstElementChild.shadowRoot.querySelector(
      '[role="toolbar"]',
    );
  toolbar.getBoundingClientRect = () => ({ width: 200, height: 80 });
  assert.equal(
    current.toolbar.updateSpatialZones([
      { id: "reserved", x: 0, y: 0, width: 20, height: 20 },
    ]).ok,
    true,
  );
  const callsBeforeDispose = viewportCalls;
  current.toolbar.dispose();
  current.window.dispatchEvent(new current.window.Event("resize"));
  assert.equal(viewportCalls, callsBeforeDispose);
});

test("rejects invalid construction with machine-readable diagnostics", () => {
  assert.throws(
    () => createToolbar({ features: { spatialCoordination: "yes" } }),
    (error) =>
      error instanceof ToolbarConfigurationError &&
      error.diagnostics.some(({ code }) => code === "CONFIG_INVALID_FEATURE"),
  );
});

test("loads persisted theme, collapse, and action order and saves manual restore", (t) => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const store = createToolbarPreferenceStore("controller", storage);
  assert.equal(
    store.save({
      theme: "midnight",
      colorScheme: "dark",
      collapsed: true,
      actionOrder: ["projects", "home"],
    }).ok,
    true,
  );
  const current = fixture(
    {
      actions: [
        { id: "home", label: "Home" },
        { id: "projects", label: "Projects" },
      ],
    },
    { preferenceStore: createToolbarPreferenceStore("controller", storage) },
  );
  t.after(() => disposeFixture(current));

  const mounted = current.toolbar.mount(current.target);
  assert.equal(mounted.ok, true);
  assert.equal(current.toolbar.isCollapsed, true);
  const shadow = current.target.firstElementChild.shadowRoot;
  const toolbar = shadow.querySelector('[role="toolbar"]');
  assert.equal(toolbar.dataset.theme, "midnight");
  assert.equal(toolbar.dataset.colorScheme, "dark");
  assert.deepEqual(
    Array.from(shadow.querySelectorAll(".mzk-toolbar__action"))
      .map((button) => button.getAttribute("data-toolbar-control"))
      .map((control) => control.slice("action:".length)),
    ["projects", "home"],
  );

  assert.equal(
    current.toolbar.update({ theme: "warm-minimal", colorScheme: "light" }).ok,
    true,
  );
  const restored = current.toolbar.expand();
  assert.equal(restored.ok, true);
  if (restored.ok) assert.equal(restored.warning, undefined);
  const reloaded = createToolbarPreferenceStore("controller", storage).load();
  assert.equal(reloaded.value.collapsed, false);
  assert.equal(reloaded.value.theme, "warm-minimal");
  assert.equal(reloaded.value.colorScheme, "light");
  assert.equal(reloaded.value.schemaVersion, PREFERENCE_SCHEMA_VERSION);
});

test("customization is keyboard-accessible and edit clicks never dispatch host actions", (t) => {
  const dispatched = [];
  const current = fixture(
    {
      actions: [
        { id: "home", label: "Home" },
        { id: "projects", label: "Projects" },
      ],
    },
    { dispatchAction: (id) => dispatched.push(id) },
  );
  t.after(() => disposeFixture(current));
  current.toolbar.mount(current.target);

  const shadow = current.target.firstElementChild.shadowRoot;
  shadow.querySelector('[data-toolbar-control="customize"]').click();
  assert.equal(
    shadow
      .querySelector('[data-toolbar-control="customize"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  shadow.querySelector('[data-toolbar-control="cycle-theme"]').click();
  shadow.querySelector('[data-toolbar-control="move-down:home"]').click();
  assert.equal(
    shadow.querySelector('[role="toolbar"]').dataset.theme,
    "frosted-glass",
  );
  assert.deepEqual(
    Array.from(shadow.querySelectorAll(".mzk-toolbar__action"))
      .map((button) => button.getAttribute("data-toolbar-control"))
      .map((control) => control.slice("action:".length)),
    ["projects", "home"],
  );
  assert.equal(shadow.querySelector('[role="alert"]').hidden, false);

  shadow.querySelector('[data-toolbar-control="action:home"]').click();
  assert.deepEqual(dispatched, []);
  shadow.querySelector('[data-toolbar-control="customize"]').click();
  shadow.querySelector('[data-toolbar-control="action:home"]').click();
  assert.deepEqual(dispatched, ["home"]);
  assert.equal(shadow.querySelector('[role="alert"]').hidden, false);
});

test("disabled customization performs no preference I/O", (t) => {
  let loads = 0;
  let saves = 0;
  const current = fixture(
    {
      features: { customize: false },
    },
    {
      preferenceStore: {
        load() {
          loads += 1;
          throw new Error("should not load");
        },
        save() {
          saves += 1;
          throw new Error("should not save");
        },
      },
    },
  );
  t.after(() => disposeFixture(current));

  assert.equal(current.toolbar.mount(current.target).ok, true);
  assert.equal(current.toolbar.collapse().ok, true);
  assert.equal(current.toolbar.expand().ok, true);
  const update = current.toolbar.updateUserPreferences({
    theme: "midnight",
    colorScheme: "dark",
    collapsed: false,
    actionOrder: [],
  });
  assert.equal(update.ok, false);
  if (!update.ok) assert.equal(update.error.code, "CUSTOMIZATION_DISABLED");
  assert.equal(loads, 0);
  assert.equal(saves, 0);
  assert.equal(
    current.target.firstElementChild.shadowRoot.querySelector(
      '[data-toolbar-control="customize"]',
    ),
    null,
  );
});

test("corrupt preferences remain untouched and produce accessible diagnostics", (t) => {
  const values = new Map([
    ["@moorkyz/toolbar/corrupt/preferences", "not-json"],
  ]);
  const reported = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const current = fixture(
    {},
    {
      preferenceStore: createToolbarPreferenceStore("corrupt", storage),
      onPreferenceError: (issue) => reported.push(issue.code),
    },
  );
  t.after(() => disposeFixture(current));

  const mounted = current.toolbar.mount(current.target);
  assert.equal(mounted.ok, true);
  if (mounted.ok)
    assert.equal(mounted.warning?.code, "PREFERENCE_INVALID_DATA");
  const shadow = current.target.firstElementChild.shadowRoot;
  assert.equal(shadow.querySelector('[role="alert"]').hidden, false);
  assert.equal(values.get("@moorkyz/toolbar/corrupt/preferences"), "not-json");
  assert.deepEqual(reported, ["PREFERENCE_INVALID_DATA"]);
});

test("Task Center presents validated host state and clears it when disabled", (t) => {
  const dispatched = [];
  const current = fixture(
    {
      features: { tasks: true },
      actions: [{ id: "home", label: "Home" }],
    },
    { dispatchAction: (id) => dispatched.push(id) },
  );
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const shadow = current.target.firstElementChild.shadowRoot;
  const initialPanel = shadow.querySelector(".mzk-toolbar__task-center");
  assert.ok(initialPanel);
  assert.equal(initialPanel.hidden, true);
  assert.equal(
    current.toolbar.updateTasks([
      {
        id: "build",
        label: "<img src=x onerror=alert(1)>",
        status: "running",
      },
    ]).ok,
    true,
  );
  shadow.querySelector('[data-toolbar-control="tasks"]').click();
  const panel = shadow.querySelector(".mzk-toolbar__task-center");
  assert.equal(panel.hidden, false);
  assert.equal(
    panel.querySelector(".mzk-toolbar__task-label").textContent,
    "<img src=x onerror=alert(1)>",
  );
  assert.equal(panel.querySelector("img"), null);
  assert.equal(
    shadow.querySelector('[data-toolbar-control="tasks"]').textContent,
    "Tasks (1)",
  );

  const invalid = current.toolbar.updateTasks([
    { id: "build", label: "Build", status: "running" },
    { id: "build", label: "Duplicate", status: "queued" },
  ]);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error.code, "INVALID_TASK_SNAPSHOT");
    assert.equal(invalid.error.taskDiagnostics[0].code, "TASKS_DUPLICATE_ID");
  }
  assert.equal(
    panel.querySelector(".mzk-toolbar__task-label").textContent,
    "<img src=x onerror=alert(1)>",
  );

  assert.equal(current.toolbar.update({ features: { tasks: false } }).ok, true);
  assert.equal(shadow.querySelector('[data-toolbar-control="tasks"]'), null);
  assert.equal(shadow.querySelector(".mzk-toolbar__task-center"), null);
  const disabled = current.toolbar.updateTasks([]);
  assert.equal(disabled.ok, false);
  if (!disabled.ok) assert.equal(disabled.error.code, "TASKS_DISABLED");
  assert.deepEqual(dispatched, []);

  assert.equal(current.toolbar.update({ features: { tasks: true } }).ok, true);
  assert.equal(
    shadow.querySelector('[data-toolbar-control="tasks"]').textContent,
    "Tasks",
  );
  shadow.querySelector('[data-toolbar-control="tasks"]').click();
  assert.equal(
    shadow.querySelector(".mzk-toolbar__task-center").textContent,
    "Task CenterNo tasks to display.",
  );
});

test("disabled Task Center does not inspect or retain task state", (t) => {
  const current = fixture();
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  let invoked = false;
  const hostile = Object.defineProperty([], "0", {
    configurable: true,
    get() {
      invoked = true;
      return { id: "task", label: "Task", status: "running" };
    },
  });
  const result = current.toolbar.updateTasks(hostile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "TASKS_DISABLED");
  assert.equal(invoked, false);
  assert.equal(
    current.target.firstElementChild.shadowRoot.querySelector(
      ".mzk-toolbar__task-center",
    ),
    null,
  );
});

test("notifications are host-fed, safe, manually opened, and cleared when disabled", (t) => {
  const current = fixture({ features: { notifications: true } });
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const shadow = current.target.firstElementChild.shadowRoot;
  let button = shadow.querySelector('[data-toolbar-control="notifications"]');
  const panel = shadow.querySelector(".mzk-toolbar__notification-center");
  assert.ok(button);
  assert.ok(panel);
  assert.equal(panel.hidden, true);

  assert.equal(current.toolbar.collapse().ok, true);
  button = shadow.querySelector('[data-toolbar-control="notifications"]');
  const updated = current.toolbar.updateNotifications([
    {
      id: "build-failed",
      title: "Build failed",
      message: "<img src=x onerror=alert(1)>",
      severity: "error",
      unread: true,
    },
    {
      id: "build-recovered",
      title: "Build recovered",
      message: "The latest build passed.",
      severity: "success",
      unread: false,
    },
  ]);
  assert.equal(updated.ok, true);
  assert.equal(current.toolbar.isCollapsed, true);
  assert.equal(panel.hidden, true);
  assert.equal(button.textContent, "Notifications (1)");
  assert.equal(button.getAttribute("aria-expanded"), "false");

  button.click();
  assert.equal(panel.hidden, false);
  assert.equal(
    panel.querySelector(".mzk-toolbar__notification").querySelector("p")
      .textContent,
    "<img src=x onerror=alert(1)>",
  );
  assert.equal(panel.querySelector("img"), null);

  const invalid = current.toolbar.updateNotifications([
    {
      id: "build-failed",
      title: "No duplicate",
      message: "Invalid update",
      severity: "warning",
      unread: true,
    },
    {
      id: "build-failed",
      title: "Duplicate",
      message: "Must not replace prior snapshot",
      severity: "error",
      unread: true,
    },
  ]);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.error.code, "INVALID_NOTIFICATION_SNAPSHOT");
    assert.equal(
      invalid.error.notificationDiagnostics[0].code,
      "NOTIFICATIONS_DUPLICATE_ID",
    );
  }
  assert.equal(
    panel.querySelector(".mzk-toolbar__notification").querySelector("p")
      .textContent,
    "<img src=x onerror=alert(1)>",
  );

  assert.equal(
    current.toolbar.update({ features: { notifications: false } }).ok,
    true,
  );
  assert.equal(
    shadow.querySelector('[data-toolbar-control="notifications"]'),
    null,
  );
  assert.equal(shadow.querySelector(".mzk-toolbar__notification-center"), null);
  assert.equal(
    current.toolbar.update({ features: { notifications: true } }).ok,
    true,
  );
  assert.equal(
    shadow.querySelector('[data-toolbar-control="notifications"]').textContent,
    "Notifications",
  );
});

test("disabled notifications do not inspect incoming state or create UI", (t) => {
  const current = fixture();
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  let invoked = false;
  const hostile = Object.defineProperty([], "0", {
    configurable: true,
    get() {
      invoked = true;
      return {
        id: "notice",
        title: "Notice",
        message: "Body",
        severity: "info",
        unread: true,
      };
    },
  });
  const result = current.toolbar.updateNotifications(hostile);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "NOTIFICATIONS_DISABLED");
  }
  assert.equal(invoked, false);
  assert.equal(
    current.target.firstElementChild.shadowRoot.querySelector(
      ".mzk-toolbar__notification-center",
    ),
    null,
  );
});

test("offline status is host-fed, optional, and cannot restore a collapsed toolbar", (t) => {
  const current = fixture({ features: { offline: true } });
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const shadow = current.target.firstElementChild.shadowRoot;
  let status = shadow.querySelector(".mzk-toolbar__connectivity");
  assert.ok(status);
  assert.equal(status.textContent, "Connection status unknown");

  assert.equal(current.toolbar.collapse().ok, true);
  status = shadow.querySelector(".mzk-toolbar__connectivity");
  assert.equal(current.toolbar.updateConnectivityStatus("offline").ok, true);
  assert.equal(current.toolbar.isCollapsed, true);
  assert.equal(status.textContent, "Offline");
  assert.equal(status.dataset.status, "offline");
  assert.equal(status.getAttribute("aria-label"), "Connection status: Offline");
  assert.equal(current.toolbar.updateConnectivityStatus("online").ok, true);
  assert.equal(current.toolbar.isCollapsed, true);
  assert.equal(status.textContent, "Online");

  assert.equal(
    current.toolbar.update({ features: { offline: false } }).ok,
    true,
  );
  assert.equal(shadow.querySelector(".mzk-toolbar__connectivity"), null);
  assert.equal(
    current.toolbar.update({ features: { offline: true } }).ok,
    true,
  );
  assert.equal(
    shadow.querySelector(".mzk-toolbar__connectivity").textContent,
    "Connection status unknown",
  );
});

test("disabled offline status rejects before inspecting non-string inputs", (t) => {
  const current = fixture();
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const result = current.toolbar.updateConnectivityStatus({
    toString() {
      throw new Error("must not be read");
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "OFFLINE_DISABLED");
  assert.equal(
    current.target.firstElementChild.shadowRoot.querySelector(
      ".mzk-toolbar__connectivity",
    ),
    null,
  );
});

test("advanced gesture activation requires a host intent handler", (t) => {
  const current = fixture({
    actions: [{ id: "home", label: "Home" }],
  });
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const result = current.toolbar.update({
    features: { advancedGestures: true },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "GESTURE_HANDLER_REQUIRED");
  }
  assert.equal(
    current.toolbar.update({ features: { advancedGestures: false } }).ok,
    true,
  );
  assert.equal(
    current.target.firstElementChild.shadowRoot.querySelector(
      '[data-toolbar-control="action:home"]',
    )?.disabled,
    true,
  );
});

test("search panel combines local actions with host results and selects only through host callbacks", async (t) => {
  const dispatched = [];
  const selectedResults = [];
  const current = fixture(
    {
      actions: [
        { id: "settings", label: "Settings" },
        { id: "home", label: "Home" },
      ],
    },
    {
      dispatchAction: (id) => dispatched.push(id),
      searchCoordinator: {
        async search(query, signal) {
          assert.equal(signal.aborted, false);
          return {
            ok: true,
            query,
            results: [
              {
                providerId: "app:docs",
                id: "guide",
                title: "Search guide",
                summary: "Federated documentation",
              },
            ],
            diagnostics: [],
          };
        },
      },
      onSearchResult: (providerId, resultId) =>
        selectedResults.push([providerId, resultId]),
    },
  );
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const shadow = current.target.firstElementChild.shadowRoot;
  const searchButton = shadow.querySelector('[data-toolbar-control="search"]');
  const panel = shadow.querySelector(".mzk-toolbar__search-panel");
  assert.ok(searchButton);
  assert.ok(panel);
  assert.equal(panel.hidden, true);

  searchButton.click();
  assert.equal(panel.hidden, false);
  const input = panel.querySelector('input[type="search"]');
  input.value = "setting";
  panel.querySelector("form").dispatchEvent(
    new current.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(panel.querySelector("ul").textContent, /Settings/);
  assert.match(panel.querySelector("ul").textContent, /Search guide/);

  panel.querySelector('[data-search-result-index="0"]').click();
  assert.deepEqual(dispatched, ["settings"]);
  assert.equal(panel.hidden, true);
  assert.deepEqual(selectedResults, []);

  searchButton.click();
  input.value = "guide";
  panel.querySelector("form").dispatchEvent(
    new current.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  const providerResult = panel.querySelector('[data-search-result-index="0"]');
  assert.ok(providerResult);
  assert.match(providerResult.textContent, /Federated documentation/);
  providerResult.click();
  assert.deepEqual(selectedResults, [["app:docs", "guide"]]);
});

test("disabling search clears its UI and aborts active provider work", (t) => {
  const signals = [];
  const current = fixture(
    {},
    {
      searchCoordinator: {
        search: (_query, signal) => {
          signals.push(signal);
          return new Promise(() => {});
        },
      },
    },
  );
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const shadow = current.target.firstElementChild.shadowRoot;
  shadow.querySelector('[data-toolbar-control="search"]').click();
  const panel = shadow.querySelector(".mzk-toolbar__search-panel");
  panel.querySelector('input[type="search"]').value = "query";
  panel.querySelector("form").dispatchEvent(
    new current.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, false);

  assert.equal(
    current.toolbar.update({ features: { search: false } }).ok,
    true,
  );
  assert.equal(signals[0].aborted, true);
  assert.equal(shadow.querySelector('[data-toolbar-control="search"]'), null);
  assert.equal(shadow.querySelector(".mzk-toolbar__search-panel"), null);
});

test("progressive discovery is host-fed, user-opened, and skippable", (t) => {
  const current = fixture({ features: { discovery: true } });
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);
  const shadow = current.target.firstElementChild.shadowRoot;
  let button = shadow.querySelector('[data-toolbar-control="discovery"]');
  const panel = shadow.querySelector(".mzk-toolbar__discovery-panel");

  assert.ok(button);
  assert.ok(panel);
  assert.equal(panel.hidden, true);
  assert.equal(
    current.toolbar.updateDiscoveryHints([
      {
        id: "safe-search",
        title: "Find actions",
        message: "<img src=x onerror=alert(1)>",
      },
    ]).ok,
    true,
  );
  assert.equal(panel.hidden, true);
  assert.equal(button.getAttribute("aria-expanded"), "false");

  assert.equal(current.toolbar.collapse().ok, true);
  assert.equal(current.toolbar.isCollapsed, true);
  button = shadow.querySelector('[data-toolbar-control="discovery"]');
  button.click();
  assert.equal(panel.hidden, false);
  assert.equal(current.toolbar.isCollapsed, true);
  assert.equal(
    panel.querySelector(".mzk-toolbar__discovery-hint").querySelector("p")
      .textContent,
    "<img src=x onerror=alert(1)>",
  );
  assert.equal(panel.querySelector("img"), null);

  button.click();
  assert.equal(panel.hidden, true);
  assert.equal(current.toolbar.isCollapsed, true);
  assert.equal(
    current.toolbar.update({ features: { discovery: false } }).ok,
    true,
  );
  assert.equal(shadow.querySelector(".mzk-toolbar__discovery-panel"), null);
  assert.equal(
    current.toolbar.update({ features: { discovery: true } }).ok,
    true,
  );
  assert.equal(
    shadow
      .querySelector('[data-toolbar-control="discovery"]')
      .getAttribute("aria-expanded"),
    "false",
  );
});

test("disabled discovery does not inspect or retain host hints", (t) => {
  const current = fixture();
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);
  let invoked = false;
  const hostile = Object.defineProperty([], "0", {
    configurable: true,
    get() {
      invoked = true;
      return {
        id: "hint",
        title: "Hint",
        message: "Body",
      };
    },
  });

  const result = current.toolbar.updateDiscoveryHints(hostile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "DISCOVERY_DISABLED");
  assert.equal(invoked, false);
  assert.equal(
    current.target.firstElementChild.shadowRoot.querySelector(
      ".mzk-toolbar__discovery-panel",
    ),
    null,
  );
});

test("AI panel runs only on explicit submit and renders host text safely", async (t) => {
  const requests = [];
  const reported = [];
  const current = fixture(
    { features: { ai: true } },
    {
      aiAdapter: {
        async complete(prompt, signal) {
          requests.push([prompt, signal]);
          return { ok: true, text: "<img src=x onerror=alert(1)>" };
        },
      },
      onAIError: (error) => reported.push(error),
    },
  );
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const shadow = current.target.firstElementChild.shadowRoot;
  const button = shadow.querySelector('[data-toolbar-control="ai"]');
  const panel = shadow.querySelector(".mzk-toolbar__ai-panel");
  assert.ok(button);
  assert.ok(panel);
  assert.equal(panel.hidden, true);
  assert.equal(requests.length, 0);

  button.click();
  assert.equal(panel.hidden, false);
  const prompt = panel.querySelector("textarea");
  prompt.value = "  summarize this  ";
  panel.querySelector("form").dispatchEvent(
    new current.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "  summarize this  ");
  const response = panel.querySelector(".mzk-toolbar__ai-response");
  assert.equal(response.textContent, "<img src=x onerror=alert(1)>");
  assert.equal(response.querySelector("img"), null);
  assert.deepEqual(reported, []);

  prompt.dispatchEvent(
    new current.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(panel.hidden, true);
  assert.equal(prompt.value, "");
  assert.equal(response.textContent, "");
});

test("closing the AI panel aborts an active host request", async (t) => {
  let signal;
  const current = fixture(
    { features: { ai: true } },
    {
      aiAdapter: {
        complete(_prompt, activeSignal) {
          signal = activeSignal;
          return new Promise((_resolve, reject) => {
            activeSignal.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            );
          });
        },
      },
    },
  );
  t.after(() => disposeFixture(current));
  assert.equal(current.toolbar.mount(current.target).ok, true);

  const shadow = current.target.firstElementChild.shadowRoot;
  shadow.querySelector('[data-toolbar-control="ai"]').click();
  const panel = shadow.querySelector(".mzk-toolbar__ai-panel");
  panel.querySelector("textarea").value = "a request";
  panel.querySelector("form").dispatchEvent(
    new current.window.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.ok(signal);
  assert.equal(signal.aborted, false);
  shadow.querySelector('[data-toolbar-control="ai"]').click();
  assert.equal(signal.aborted, true);
  assert.equal(panel.hidden, true);
});
