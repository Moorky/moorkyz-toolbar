import assert from "node:assert/strict";
import { test } from "node:test";
import { createFederatedSearchCoordinator } from "../dist/index.js";

function enabledPolicy(overrides = {}) {
  return {
    isEnabled: () => true,
    authorize: () => true,
    ...overrides,
  };
}

test("federates host providers in stable order and normalizes immutable results", async () => {
  const authorized = [];
  const coordinator = createFederatedSearchCoordinator(
    [
      {
        id: "app:docs",
        search: async (query) => [
          { id: "start", title: `Docs for ${query}`, summary: "Reference" },
        ],
      },
      {
        id: "app:issues",
        search: async () => [{ id: "issue-12", title: "Fix the toolbar" }],
      },
    ],
    enabledPolicy({
      authorize(providerId, query) {
        authorized.push([providerId, query]);
        return true;
      },
    }),
  );
  const controller = new AbortController();

  const result = await coordinator.search("  toolbar  ", controller.signal);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.query, "toolbar");
  assert.deepEqual(
    result.results.map(({ providerId, id, title }) => [providerId, id, title]),
    [
      ["app:docs", "start", "Docs for toolbar"],
      ["app:issues", "issue-12", "Fix the toolbar"],
    ],
  );
  assert.deepEqual(authorized, [
    ["app:docs", "toolbar"],
    ["app:issues", "toolbar"],
  ]);
  assert.equal(Object.isFrozen(result.results), true);
  assert.equal(Object.isFrozen(result.results[0]), true);
});

test("disabled search performs no authorization or provider work", async () => {
  let authorized = 0;
  let called = 0;
  let inspected = 0;
  const provider = Object.defineProperty(
    {
      search: async () => {
        called += 1;
        return [];
      },
    },
    "id",
    {
      enumerable: true,
      get() {
        inspected += 1;
        return "app:private";
      },
    },
  );
  const coordinator = createFederatedSearchCoordinator(
    [provider],
    enabledPolicy({
      isEnabled: () => false,
      authorize: () => {
        authorized += 1;
        return true;
      },
    }),
  );

  const result = await coordinator.search(
    "secret",
    new AbortController().signal,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "SEARCH_DISABLED");
  assert.equal(authorized, 0);
  assert.equal(called, 0);
  assert.equal(inspected, 0);
});

test("denied and failing providers return diagnostics with partial results", async () => {
  const coordinator = createFederatedSearchCoordinator(
    [
      {
        id: "app:public",
        search: async () => [{ id: "one", title: "Public result" }],
      },
      {
        id: "app:private",
        search: async () => {
          throw new Error("provider detail");
        },
      },
      {
        id: "app:broken",
        search: async () => ({ unsafe: true }),
      },
    ],
    enabledPolicy({
      authorize: (providerId) => providerId !== "app:private",
    }),
  );

  const result = await coordinator.search(
    "query",
    new AbortController().signal,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.results.map(({ title }) => title),
    ["Public result"],
  );
  assert.deepEqual(
    result.diagnostics.map(({ code }) => code),
    ["SEARCH_PERMISSION_DENIED", "SEARCH_INVALID_RESULTS"],
  );
});

test("rejects accessor results and invalid query input without invoking getters", async () => {
  let invoked = false;
  const resultItem = Object.defineProperties(
    {},
    {
      id: { enumerable: true, value: "result" },
      title: {
        enumerable: true,
        get() {
          invoked = true;
          return "Result";
        },
      },
    },
  );
  const coordinator = createFederatedSearchCoordinator(
    [{ id: "app:docs", search: async () => [resultItem] }],
    enabledPolicy(),
  );
  const signal = new AbortController().signal;
  const invalidQuery = await coordinator.search("  ", signal);
  assert.equal(invalidQuery.ok, false);
  if (!invalidQuery.ok) {
    assert.equal(invalidQuery.error.code, "SEARCH_INVALID_QUERY");
  }
  const invalidResults = await coordinator.search("query", signal);
  assert.equal(invalidResults.ok, true);
  if (invalidResults.ok) {
    assert.deepEqual(invalidResults.diagnostics, [
      {
        code: "SEARCH_INVALID_RESULTS",
        providerId: "app:docs",
        message: "Search provider returned invalid result data.",
      },
    ]);
  }
  assert.equal(invoked, false);
});

test("requires an AbortSignal and passes cancellation cooperatively to providers", async () => {
  let providerCalled = 0;
  const coordinator = createFederatedSearchCoordinator(
    [
      {
        id: "app:slow",
        search: (_query, signal) =>
          new Promise((resolve, reject) => {
            providerCalled += 1;
            signal.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            );
          }),
      },
    ],
    enabledPolicy(),
  );
  const controller = new AbortController();
  const pending = coordinator.search("query", controller.signal);
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "SEARCH_CANCELLED");
  assert.equal(providerCalled, 1);
});

test("returns diagnostics for malformed provider declarations when enabled", async () => {
  const invalidProviderLists = [
    [
      { id: "app:docs", search: async () => [] },
      { id: "app:docs", search: async () => [] },
    ],
    [{ id: "bad id", search: async () => [] }],
  ];
  for (const providers of invalidProviderLists) {
    const coordinator = createFederatedSearchCoordinator(
      providers,
      enabledPolicy(),
    );
    const result = await coordinator.search(
      "query",
      new AbortController().signal,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "SEARCH_INVALID_PROVIDER_CONFIG");
    }
  }

  const trappedProvider = new Proxy(
    { id: "app:docs", search: async () => [] },
    {
      getPrototypeOf() {
        throw new Error("provider proxy trap");
      },
    },
  );
  const trappedCoordinator = createFederatedSearchCoordinator(
    [trappedProvider],
    enabledPolicy(),
  );
  const trappedResult = await trappedCoordinator.search(
    "query",
    new AbortController().signal,
  );
  assert.equal(trappedResult.ok, false);
  if (!trappedResult.ok) {
    assert.equal(trappedResult.error.code, "SEARCH_INVALID_PROVIDER_CONFIG");
  }
});

test("enforces query, provider, and per-provider result limits", async () => {
  const providers = Array.from({ length: 16 }, (_, index) => ({
    id: `app:provider-${index}`,
    search: async () => [],
  }));
  const bounded = createFederatedSearchCoordinator(providers, enabledPolicy());
  const boundary = await bounded.search(
    "q".repeat(256),
    new AbortController().signal,
  );
  assert.equal(boundary.ok, true);

  const oversizedQuery = await bounded.search(
    "q".repeat(257),
    new AbortController().signal,
  );
  assert.equal(oversizedQuery.ok, false);
  if (!oversizedQuery.ok) {
    assert.equal(oversizedQuery.error.code, "SEARCH_INVALID_QUERY");
  }

  const tooManyProviders = createFederatedSearchCoordinator(
    Array.from({ length: 17 }, (_, index) => ({
      id: `app:provider-${index}`,
      search: async () => [],
    })),
    enabledPolicy(),
  );
  const providerLimit = await tooManyProviders.search(
    "query",
    new AbortController().signal,
  );
  assert.equal(providerLimit.ok, false);
  if (!providerLimit.ok) {
    assert.equal(providerLimit.error.code, "SEARCH_INVALID_PROVIDER_CONFIG");
  }

  const resultLimit = createFederatedSearchCoordinator(
    [
      {
        id: "app:many",
        search: async () =>
          Array.from({ length: 21 }, (_, index) => ({
            id: `result-${index}`,
            title: `Result ${index}`,
          })),
      },
    ],
    enabledPolicy(),
  );
  const tooManyResults = await resultLimit.search(
    "query",
    new AbortController().signal,
  );
  assert.equal(tooManyResults.ok, true);
  if (tooManyResults.ok) {
    assert.equal(tooManyResults.results.length, 0);
    assert.equal(tooManyResults.diagnostics[0].code, "SEARCH_INVALID_RESULTS");
  }

  const exactResultLimit = createFederatedSearchCoordinator(
    [
      {
        id: "app:many",
        search: async () =>
          Array.from({ length: 20 }, (_, index) => ({
            id: `result-${index}`,
            title: `Result ${index}`,
          })),
      },
    ],
    enabledPolicy(),
  );
  const twentyResults = await exactResultLimit.search(
    "query",
    new AbortController().signal,
  );
  assert.equal(twentyResults.ok, true);
  if (twentyResults.ok) assert.equal(twentyResults.results.length, 20);
});
