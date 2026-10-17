import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { Window } from "happy-dom";

const moduleRoot = process.env.MOORKYZ_M7_MODULE_ROOT ?? "../dist/";
const adapterUrl = new URL(`${moduleRoot}vue.js`, import.meta.url);
const window = new Window({ url: "http://localhost/" });
const globals = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "SVGElement",
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

// Import runtime-dom only after installing DOM: Vue captures its document once.
const { createApp, defineComponent, h, nextTick, ref, shallowRef } =
  await import("vue");
const { useToolbar } = await import(adapterUrl);

test("Vue adapter imports and renders on the server without browser globals or host work", () => {
  const vueUrl = import.meta.resolve("vue");
  const rendererUrl = import.meta.resolve("@vue/server-renderer");
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    import { createSSRApp, defineComponent, h, ref } from ${JSON.stringify(vueUrl)};
    import { renderToString } from ${JSON.stringify(rendererUrl)};
    import { useToolbar } from ${JSON.stringify(adapterUrl.href)};
    assert.equal("window" in globalThis, false);
    let hostCalls = 0;
    const component = defineComponent({
      setup() {
        const binding = useToolbar(ref(null), {}, { dispatchAction() { hostCalls++; } });
        assert.equal(binding.controller.value, null);
        return () => h("div");
      }
    });
    assert.equal(await renderToString(createSSRApp(component)), "<div></div>");
    assert.equal(hostCalls, 0);
  `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

function mount(t, initial = {}) {
  const root = window.document.createElement("main");
  window.document.body.appendChild(root);
  const configuration = shallowRef({
    actions: [{ id: "home", label: "Home" }],
    ...initial.configuration,
  });
  const host = shallowRef(initial.host ?? {});
  const shown = ref(true);
  let binding;
  const component = defineComponent({
    setup() {
      const target = ref(null);
      binding = useToolbar(target, configuration, host);
      return () => (shown.value ? h("div", { ref: target }) : null);
    },
  });
  const app = createApp(component);
  app.mount(root);
  let mounted = true;
  const dispose = () => {
    if (!mounted) return;
    mounted = false;
    app.unmount();
    root.remove();
  };
  t.after(dispose);
  return {
    root,
    configuration,
    host,
    shown,
    get binding() {
      return binding;
    },
    dispose,
  };
}

test("Vue owns mount/update/host replacement/unmount and native keyboard behavior", async (t) => {
  const calls = [];
  const fixture = mount(t, {
    host: { dispatchAction: (id) => calls.push(id) },
  });
  await nextTick();
  const first = fixture.binding.controller.value;
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
  fixture.configuration.value = { actions: [{ id: "next", label: "Next" }] };
  await nextTick();
  assert.equal(fixture.binding.controller.value, first);
  assert.equal(
    toolbar.querySelector('[data-toolbar-control="action:next"]').textContent,
    "Next",
  );
  fixture.host.value = {};
  await nextTick();
  assert.equal(first.isMounted, false);
  const second = fixture.binding.controller.value;
  assert.notEqual(second, first);
  fixture.shown.value = false;
  await nextTick();
  assert.equal(second.isMounted, false);
  assert.equal(fixture.binding.controller.value, null);
  fixture.shown.value = true;
  await nextTick();
  const third = fixture.binding.controller.value;
  assert.equal(third.isMounted, true);
  fixture.dispose();
  assert.equal(third.isMounted, false);
  assert.equal(fixture.binding.controller.value, null);
});

test("Vue invalid updates are atomic and mount/configuration failures leave no resources", async (t) => {
  const fixture = mount(t);
  await nextTick();
  const controller = fixture.binding.controller.value;
  fixture.configuration.value = { actions: [{ id: "home", label: "" }] };
  await nextTick();
  assert.equal(fixture.binding.controller.value, controller);
  assert.equal(controller.isMounted, true);
  assert.equal(fixture.binding.error.value.code, "INVALID_CONFIGURATION");
  fixture.configuration.value = { features: { advancedGestures: true } };
  fixture.host.value = {};
  await nextTick();
  assert.equal(fixture.binding.controller.value, null);
  assert.equal(fixture.binding.error.value.code, "GESTURE_HANDLER_REQUIRED");
  assert.equal(fixture.root.querySelector(".mzk-toolbar-host"), null);
  fixture.configuration.value = { actions: [{ id: "home", label: "" }] };
  await nextTick();
  assert.equal(fixture.binding.controller.value, null);
  assert.equal(fixture.binding.error.value.code, "INVALID_CONFIGURATION");
  fixture.configuration.value = {};
  await nextTick();
  assert.equal(fixture.binding.controller.value.isMounted, true);
  assert.equal(fixture.binding.error.value, null);
});

test("Vue disabled optional features do not call optional host integrations", async (t) => {
  let calls = 0;
  const fixture = mount(t, {
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
  await nextTick();
  assert.equal(fixture.binding.controller.value.isMounted, true);
  assert.equal(calls, 0);
});
