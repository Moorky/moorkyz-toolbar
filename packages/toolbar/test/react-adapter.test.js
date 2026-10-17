import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { ToolbarMount } from "@moorkyz/toolbar/react";

function installDOM(window) {
  const names = [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Element",
    "Node",
    "Text",
    "Document",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "MutationObserver",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ];
  const previous = new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );

  for (const name of names) {
    const value = window[name];
    if (value === undefined) continue;
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value:
        name === "getComputedStyle" ||
        name === "requestAnimationFrame" ||
        name === "cancelAnimationFrame"
          ? value.bind(window)
          : value,
    });
  }

  const previousActEnvironment = Object.getOwnPropertyDescriptor(
    globalThis,
    "IS_REACT_ACT_ENVIRONMENT",
  );
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  return () => {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(globalThis, name);
      } else {
        Object.defineProperty(globalThis, name, descriptor);
      }
    }
    if (previousActEnvironment === undefined) {
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    } else {
      Object.defineProperty(
        globalThis,
        "IS_REACT_ACT_ENVIRONMENT",
        previousActEnvironment,
      );
    }
  };
}

test("React host and isolation replacements dispose old ownership without restoring a collapsed dock", async (t) => {
  const window = new Window({ url: "http://localhost/" });
  const restoreDOM = installDOM(window);
  const target = window.document.createElement("main");
  window.document.body.append(target);
  const instances = [];
  const notify = (value) => {
    if (value) instances.push(value);
  };
  const root = createRoot(target);
  t.after(async () => {
    try {
      await act(async () => root.unmount());
    } finally {
      restoreDOM();
      window.close();
    }
  });
  const configuration = {
    renderMode: "light",
    actions: [{ id: "home", label: "Home" }],
  };
  const originalHost = { dispatchAction() {} };
  await act(async () =>
    root.render(
      createElement(ToolbarMount, {
        configuration,
        host: originalHost,
        onController: notify,
      }),
    ),
  );
  const first = instances[0];
  await act(async () => first.collapse());
  const deniedHost = {};
  await act(async () =>
    root.render(
      createElement(ToolbarMount, {
        configuration,
        host: deniedHost,
        onController: notify,
      }),
    ),
  );
  const second = instances.at(-1);
  assert.notEqual(second, first);
  assert.equal(first.isMounted, false);
  assert.equal(second.isCollapsed, true);
  await act(async () =>
    root.render(
      createElement(ToolbarMount, {
        configuration: { ...configuration, renderMode: "shadow" },
        host: deniedHost,
        onController: notify,
      }),
    ),
  );
  const third = instances.at(-1);
  assert.equal(second.isMounted, false);
  assert.equal(third.isCollapsed, true);
  assert.equal(target.querySelectorAll(".mzk-toolbar-host").length, 1);
  await act(async () => third.expand());
  assert.equal(
    target
      .querySelector(".mzk-toolbar-host")
      .shadowRoot.querySelector(".mzk-toolbar__action").disabled,
    true,
  );
});

test("React adapter is importable and renderable without browser globals", () => {
  assert.equal("window" in globalThis, false);
  assert.equal(
    renderToString(
      createElement(ToolbarMount, {
        configuration: { actions: [{ id: "home", label: "Home" }] },
      }),
    ),
    "<div></div>",
  );
});

test("React adapter mounts, forwards the controller, dispatches, and cleans up", async (t) => {
  const window = new Window({ url: "http://localhost/" });
  const restoreDOM = installDOM(window);
  const target = window.document.createElement("main");
  window.document.body.appendChild(target);
  const dispatched = [];
  const controllers = [];
  let activeController = null;
  let root;
  t.after(async () => {
    try {
      if (root !== undefined) {
        await act(async () => root.unmount());
      }
    } finally {
      restoreDOM();
      window.close();
    }
  });

  await act(async () => {
    root = createRoot(target);
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(ToolbarMount, {
          configuration: {
            actions: [{ id: "home", label: "Home" }],
          },
          host: { dispatchAction: (actionId) => dispatched.push(actionId) },
          onController: (controller) => {
            controllers.push(controller);
            activeController = controller;
          },
        }),
      ),
    );
  });

  const controller = activeController;
  assert.ok(controller);
  assert.equal(controller.isMounted, true);
  const action = target
    .querySelector(".mzk-toolbar-host")
    .shadowRoot.querySelector('[data-toolbar-control="action:home"]');
  await act(async () => action.click());
  assert.deepEqual(dispatched, ["home"]);

  await act(async () => root.unmount());
  root = undefined;
  assert.equal(controller.isMounted, false);
  assert.equal(activeController, null);
  assert.equal(controllers.length, 4);
  assert.equal(controllers[0].isMounted, false);
  assert.equal(controllers[1], null);
  assert.equal(controllers[2], controller);
  assert.equal(controllers[3], null);
});

test("React adapter reports mount failures after disposing the controller", async (t) => {
  const window = new Window({ url: "http://localhost/" });
  const restoreDOM = installDOM(window);
  const target = window.document.createElement("main");
  window.document.body.appendChild(target);
  const errors = [];
  let root;
  t.after(async () => {
    try {
      if (root !== undefined) {
        await act(async () => root.unmount());
      }
    } finally {
      restoreDOM();
      window.close();
    }
  });

  await act(async () => {
    root = createRoot(target);
    root.render(
      createElement(ToolbarMount, {
        configuration: { features: { advancedGestures: true } },
        onMountError: (error) => errors.push(error.code),
      }),
    );
  });

  assert.deepEqual(errors, ["GESTURE_HANDLER_REQUIRED"]);
  assert.equal(target.querySelector(".mzk-toolbar-host"), null);
  await act(async () => root.unmount());
  root = undefined;
});

test("React configuration and callback changes retain documented ownership replacement without restoring collapse", async (t) => {
  const window = new Window({ url: "http://localhost/" });
  const restoreDOM = installDOM(window);
  const target = window.document.createElement("main");
  window.document.body.append(target);
  const first = [],
    second = [],
    errors = [];
  const host = { dispatchAction() {} };
  const notifyFirst = (value) => first.push(value);
  const notifySecond = (value) => second.push(value);
  const root = createRoot(target);
  t.after(async () => {
    try {
      await act(async () => root.unmount());
    } finally {
      restoreDOM();
      window.close();
    }
  });
  async function render(configuration, onController) {
    await act(async () =>
      root.render(
        createElement(ToolbarMount, {
          configuration,
          host,
          onController,
          onMountError: (error) => errors.push(error.code),
        }),
      ),
    );
  }
  await render(
    { renderMode: "light", actions: [{ id: "home", label: "Home" }] },
    notifyFirst,
  );
  const instance = first[0];
  await act(async () => instance.collapse());
  await render(
    {
      renderMode: "light",
      colorScheme: "dark",
      actions: [{ id: "home", label: "Home" }],
    },
    notifySecond,
  );
  assert.notEqual(second[0], instance);
  assert.equal(first.at(-1), null);
  assert.equal(instance.isMounted, false);
  assert.equal(second[0].isCollapsed, true);
  assert.equal(
    target.querySelector('[role="toolbar"]').dataset.colorScheme,
    "dark",
  );
  await render({ renderMode: "light", label: "Recovered" }, notifySecond);
  assert.deepEqual(errors, []);
  assert.equal(target.querySelectorAll(".mzk-toolbar__action").length, 0);
  assert.equal(
    target.querySelector('[role="toolbar"]').getAttribute("aria-label"),
    "Recovered",
  );
  assert.equal(second.at(-1).isCollapsed, true);
});
