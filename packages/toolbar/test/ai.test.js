import assert from "node:assert/strict";
import { test } from "node:test";
import { createHostAuthorizedAIAdapter } from "../dist/index.js";

function enabledPolicy(overrides = {}) {
  return {
    isEnabled: () => true,
    authorize: () => true,
    ...overrides,
  };
}

test("AI provider runs only after host feature gate and authorization", async () => {
  let providerCalls = 0;
  let authorizationCalls = 0;
  let received;
  const adapter = createHostAuthorizedAIAdapter(
    {
      async generate(request) {
        providerCalls += 1;
        received = request;
        return "A plain-text suggestion";
      },
    },
    enabledPolicy({
      authorize() {
        authorizationCalls += 1;
        return true;
      },
    }),
  );
  const controller = new AbortController();

  const result = await adapter.complete(
    "  summarize this  ",
    controller.signal,
  );
  assert.deepEqual(result, { ok: true, text: "A plain-text suggestion" });
  assert.equal(received.prompt, "summarize this");
  assert.equal(received.signal, controller.signal);
  assert.equal(providerCalls, 1);
  assert.equal(authorizationCalls, 1);
});

test("disabled and unauthorized AI do not invoke the provider", async () => {
  let providerCalls = 0;
  let authorizationCalls = 0;
  const provider = {
    async generate() {
      providerCalls += 1;
      return "response";
    },
  };
  const disabled = createHostAuthorizedAIAdapter(
    provider,
    enabledPolicy({
      isEnabled: () => false,
      authorize() {
        authorizationCalls += 1;
        return true;
      },
    }),
  );
  const denied = createHostAuthorizedAIAdapter(
    provider,
    enabledPolicy({
      authorize() {
        authorizationCalls += 1;
        return false;
      },
    }),
  );
  const signal = new AbortController().signal;

  const disabledResult = await disabled.complete("prompt", signal);
  const deniedResult = await denied.complete("prompt", signal);
  assert.equal(disabledResult.ok, false);
  if (!disabledResult.ok) {
    assert.equal(disabledResult.error.code, "AI_DISABLED");
  }
  assert.equal(deniedResult.ok, false);
  if (!deniedResult.ok) {
    assert.equal(deniedResult.error.code, "AI_PERMISSION_DENIED");
  }
  assert.equal(authorizationCalls, 1);
  assert.equal(providerCalls, 0);
});

test("rejects invalid prompts before calling policy or provider", async () => {
  let enabledCalls = 0;
  let providerCalls = 0;
  const adapter = createHostAuthorizedAIAdapter(
    {
      async generate() {
        providerCalls += 1;
        return "response";
      },
    },
    enabledPolicy({
      isEnabled() {
        enabledCalls += 1;
        return true;
      },
    }),
  );
  const result = await adapter.complete(" ", new AbortController().signal);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AI_INVALID_PROMPT");
  assert.equal(enabledCalls, 0);
  assert.equal(providerCalls, 0);
});

test("requires cooperative cancellation and ignores results after abort", async () => {
  let providerCalls = 0;
  const adapter = createHostAuthorizedAIAdapter(
    {
      generate: (_request) =>
        new Promise((_resolve, reject) => {
          providerCalls += 1;
          _request.signal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    },
    enabledPolicy(),
  );
  const controller = new AbortController();
  const pending = adapter.complete("prompt", controller.signal);
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AI_CANCELLED");
  assert.equal(providerCalls, 1);
});

test("rejects non-text and overlong provider responses", async () => {
  const nonText = createHostAuthorizedAIAdapter(
    { generate: async () => ({ html: "<b>unsafe</b>" }) },
    enabledPolicy(),
  );
  const overlong = createHostAuthorizedAIAdapter(
    { generate: async () => "x".repeat(20_001) },
    enabledPolicy(),
  );
  const signal = new AbortController().signal;

  const invalidType = await nonText.complete("prompt", signal);
  const invalidLength = await overlong.complete("prompt", signal);
  assert.equal(invalidType.ok, false);
  assert.equal(invalidLength.ok, false);
  if (!invalidType.ok) {
    assert.equal(invalidType.error.code, "AI_INVALID_RESPONSE");
  }
  if (!invalidLength.ok) {
    assert.equal(invalidLength.error.code, "AI_INVALID_RESPONSE");
  }
});

test("enforces exact prompt and response size bounds", async () => {
  const adapter = createHostAuthorizedAIAdapter(
    { generate: async () => "x".repeat(20_000) },
    enabledPolicy(),
  );
  const boundary = await adapter.complete(
    "p".repeat(8_000),
    new AbortController().signal,
  );
  assert.equal(boundary.ok, true);
  if (boundary.ok) assert.equal(boundary.text.length, 20_000);

  const oversized = await adapter.complete(
    "p".repeat(8_001),
    new AbortController().signal,
  );
  assert.equal(oversized.ok, false);
  if (!oversized.ok) {
    assert.equal(oversized.error.code, "AI_INVALID_PROMPT");
  }
});

test("surfaces provider and policy failures as structured diagnostics", async () => {
  const providerFailure = createHostAuthorizedAIAdapter(
    {
      generate: async () => {
        throw new Error("provider failure");
      },
    },
    enabledPolicy(),
  );
  const policyFailure = createHostAuthorizedAIAdapter(
    { generate: async () => "unused" },
    enabledPolicy({
      authorize() {
        throw new Error("policy failure");
      },
    }),
  );
  const signal = new AbortController().signal;

  const providerResult = await providerFailure.complete("prompt", signal);
  const policyResult = await policyFailure.complete("prompt", signal);
  assert.equal(providerResult.ok, false);
  assert.equal(policyResult.ok, false);
  if (!providerResult.ok) {
    assert.equal(providerResult.error.code, "AI_PROVIDER_FAILED");
  }
  if (!policyResult.ok) {
    assert.equal(policyResult.error.code, "AI_AUTHORIZATION_FAILED");
  }
});
