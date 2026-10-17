import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { Window } from "happy-dom";

const moduleRoot = process.env.MOORKYZ_M7_MODULE_ROOT ?? "../dist/";
const adapterUrl = new URL(`${moduleRoot}angular.js`, import.meta.url);
const window = new Window({ url: "http://localhost/" });
const globals = [
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
];
const previous = new Map(
  globals.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
for (const name of globals) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: window[name],
  });
}
after(() => {
  for (const [name, descriptor] of previous) {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, name);
    else Object.defineProperty(globalThis, name, descriptor);
  }
  window.close();
});

await import("@angular/compiler");
const { Component, provideZonelessChangeDetection, signal } =
  await import("@angular/core");
const { createApplication } = await import("@angular/platform-browser");
const { injectToolbar } = await import(adapterUrl);

test("Angular imports and SSR rendering never mount or call host integrations", () => {
  const coreUrl = import.meta.resolve("@angular/core");
  const browserUrl = import.meta.resolve("@angular/platform-browser");
  const serverUrl = import.meta.resolve("@angular/platform-server");
  const compilerUrl = import.meta.resolve("@angular/compiler");
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import ${JSON.stringify(compilerUrl)};
    import assert from "node:assert/strict";
    import { Component, provideZonelessChangeDetection } from ${JSON.stringify(coreUrl)};
    import { bootstrapApplication } from ${JSON.stringify(browserUrl)};
    import { renderApplication } from ${JSON.stringify(serverUrl)};
    import { injectToolbar } from ${JSON.stringify(adapterUrl.href)};
    assert.equal("window" in globalThis, false);
    let binding;
    let hostCalls = 0;
    class ServerToolbar {
      constructor() {
        binding = injectToolbar(() => ({}), () => ({
          dispatchAction() { hostCalls++; }
        }));
      }
    }
    Component({ selector: "server-toolbar", standalone: true, template: "" })(ServerToolbar);
    const html = await renderApplication(
      (context) => bootstrapApplication(ServerToolbar, {
        providers: [provideZonelessChangeDetection()]
      }, context),
      {
        document: "<server-toolbar></server-toolbar>",
        url: "http://localhost/",
        allowedHosts: ["localhost"]
      }
    );
    assert.equal(html.includes("mzk-toolbar-host"), false);
    assert.equal(binding.controller(), null);
    assert.equal(hostCalls, 0);
  `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

let nextFixtureId = 0;

async function mount(t, initial = {}) {
  const selector = `mzk-angular-test-${++nextFixtureId}`;
  const root = window.document.createElement(selector);
  window.document.body.appendChild(root);
  const configuration = signal({
    actions: [{ id: "home", label: "Home" }],
    ...initial.configuration,
  });
  const host = signal(initial.host ?? {});
  class Consumer {
    constructor() {
      this.binding = injectToolbar(configuration, host);
    }
  }
  Component({ selector, standalone: true, template: "" })(Consumer);
  const app = await createApplication({
    providers: [provideZonelessChangeDetection()],
  });
  const component = app.bootstrap(Consumer, root);
  t.after(() => {
    if (!app.destroyed) app.destroy();
    root.remove();
  });
  await app.whenStable();
  return {
    app,
    root,
    configuration,
    host,
    binding: component.instance.binding,
    async settle() {
      await app.whenStable();
    },
  };
}

test("Angular owns mount, reactive updates, host replacement and destruction", async (t) => {
  const calls = [];
  const fixture = await mount(t, {
    host: { dispatchAction: (id) => calls.push(id) },
  });
  const first = fixture.binding.controller();
  assert.equal(first.isMounted, true);
  const toolbar = fixture.root.querySelector(".mzk-toolbar-host").shadowRoot;
  const action = toolbar.querySelector('[data-toolbar-control="action:home"]');
  action.focus();
  action.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  assert.notEqual(toolbar.activeElement, action);
  action.click();
  await Promise.resolve();
  assert.deepEqual(calls, ["home"]);
  fixture.configuration.set({ actions: [{ id: "next", label: "Next" }] });
  await fixture.settle();
  assert.equal(fixture.binding.controller(), first);
  assert.equal(
    toolbar.querySelector('[data-toolbar-control="action:next"]').textContent,
    "Next",
  );
  fixture.host.set({});
  await fixture.settle();
  assert.equal(first.isMounted, false);
  const second = fixture.binding.controller();
  assert.equal(second.isMounted, true);
  fixture.app.destroy();
  assert.equal(second.isMounted, false);
  assert.equal(fixture.binding.controller(), null);
});

test("Angular mount/configuration failures clean up; invalid updates preserve valid state", async (t) => {
  const fixture = await mount(t);
  const first = fixture.binding.controller();
  fixture.configuration.set({ actions: [{ id: "home", label: "" }] });
  await fixture.settle();
  assert.equal(fixture.binding.controller(), first);
  assert.equal(first.isMounted, true);
  assert.equal(fixture.binding.error().code, "INVALID_CONFIGURATION");
  fixture.configuration.set({ features: { advancedGestures: true } });
  fixture.host.set({});
  await fixture.settle();
  assert.equal(fixture.binding.controller(), null);
  assert.equal(fixture.binding.error().code, "GESTURE_HANDLER_REQUIRED");
  assert.equal(fixture.root.querySelector(".mzk-toolbar-host"), null);
  fixture.configuration.set({ actions: [{ id: "home", label: "" }] });
  await fixture.settle();
  assert.equal(fixture.binding.controller(), null);
  assert.equal(fixture.binding.error().code, "INVALID_CONFIGURATION");
  fixture.configuration.set({});
  await fixture.settle();
  assert.equal(fixture.binding.controller().isMounted, true);
  assert.equal(fixture.binding.error(), null);
});

test("Angular disabled optional features do not invoke optional host integrations", async (t) => {
  let calls = 0;
  const fixture = await mount(t, {
    configuration: {
      features: { ai: false, experimental: false, spatialCoordination: false },
    },
    host: {
      aiAdapter: {
        complete() {
          calls++;
          throw new Error("disabled");
        },
      },
      getSpatialViewport() {
        calls++;
        throw new Error("disabled");
      },
    },
  });
  assert.equal(fixture.binding.controller().isMounted, true);
  assert.equal(calls, 0);
});
