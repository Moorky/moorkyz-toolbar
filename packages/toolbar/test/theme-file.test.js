import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUILT_IN_THEMES,
  validateThemeFile,
  createToolbar,
} from "../dist/index.js";
import { Window } from "happy-dom";

test("theme files round-trip, reject unknown versions, unsafe tokens and accessors", () => {
  const input = {
    version: 1,
    theme: "custom",
    tokens: BUILT_IN_THEMES.signature,
  };
  assert.equal(validateThemeFile(JSON.parse(JSON.stringify(input))).ok, true);
  assert.equal(validateThemeFile({ ...input, version: 2 }).ok, false);
  assert.equal(
    validateThemeFile({ ...input, secret: "not exported" }).ok,
    false,
  );
  assert.equal(
    validateThemeFile({
      ...input,
      tokens: { ...input.tokens, hover: "#172033" },
    }).ok,
    false,
  );
  assert.equal(
    validateThemeFile(
      Object.defineProperty({}, "tokens", {
        get() {
          assert.fail("getter");
        },
      }),
    ).ok,
    false,
  );
});

test("custom themes require nonce, validate before mutation and clean up scoped styles", () => {
  const window = new Window();
  const noNonce = createToolbar();
  assert.equal(
    noNonce.updateThemeTokens(BUILT_IN_THEMES.signature).error.code,
    "THEME_NONCE_REQUIRED",
  );
  noNonce.dispose();
  const toolbar = createToolbar(
    { renderMode: "light" },
    { styleNonce: "test-nonce" },
  );
  assert.equal(toolbar.updateThemeTokens(BUILT_IN_THEMES.midnight).ok, true);
  assert.equal(toolbar.mount(window.document.body).ok, true);
  const style = window.document.querySelector("style");
  assert.equal(style.nonce, "test-nonce");
  assert.match(style.textContent, /#161C2A/);
  assert.equal(toolbar.updateThemeTokens({}).ok, false);
  assert.match(style.textContent, /#161C2A/);
  assert.equal(toolbar.updateThemeTokens(null).ok, true);
  assert.equal(window.document.querySelector("style"), null);
  toolbar.dispose();
  window.close();
});

test("mounted lifecycle signals host without restoring a collapsed dock and disposes listeners", () => {
  const window = new Window();
  const events = [];
  const toolbar = createToolbar(
    {},
    {
      onSuspend: (reason) => events.push(`suspend:${reason}`),
      onResume: (reason) => events.push(`resume:${reason}`),
    },
  );
  toolbar.mount(window.document.body);
  toolbar.collapse();
  window.dispatchEvent(
    new window.PageTransitionEvent("pagehide", { persisted: true }),
  );
  window.dispatchEvent(
    new window.PageTransitionEvent("pageshow", { persisted: true }),
  );
  assert.deepEqual(events, ["suspend:pagehide", "resume:pageshow"]);
  assert.equal(toolbar.isCollapsed, true);
  toolbar.dispose();
  window.dispatchEvent(new window.PageTransitionEvent("pagehide"));
  assert.equal(events.length, 2);
  window.close();
});
