export interface ToolbarSearchProvider {
  readonly id: string;
  search(query: string, signal: AbortSignal): unknown | Promise<unknown>;
}

export interface ToolbarSearchResult {
  readonly providerId: string;
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
}

export type SearchDiagnosticCode =
  | "SEARCH_DISABLED"
  | "SEARCH_INVALID_PROVIDER_CONFIG"
  | "SEARCH_INVALID_QUERY"
  | "SEARCH_INVALID_SIGNAL"
  | "SEARCH_CANCELLED"
  | "SEARCH_AUTHORIZATION_FAILED"
  | "SEARCH_PERMISSION_DENIED"
  | "SEARCH_PROVIDER_FAILED"
  | "SEARCH_INVALID_RESULTS";

export interface SearchDiagnostic {
  readonly code: SearchDiagnosticCode;
  readonly providerId?: string;
  readonly message: string;
  readonly cause?: unknown;
}

export type FederatedSearchOutcome =
  | {
      readonly ok: true;
      readonly query: string;
      readonly results: readonly ToolbarSearchResult[];
      readonly diagnostics: readonly SearchDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly error: SearchDiagnostic;
    };

export interface FederatedSearchPolicy {
  readonly isEnabled: () => boolean;
  readonly authorize: (providerId: string, query: string) => boolean;
}

export interface FederatedSearchCoordinator {
  search(query: string, signal: AbortSignal): Promise<FederatedSearchOutcome>;
}

const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]{0,62}:[a-z][a-z0-9-]{0,62}$/;
const RESULT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const PROVIDER_LIMIT = 16;
const RESULT_LIMIT_PER_PROVIDER = 20;
const QUERY_LIMIT = 256;
const RESULT_KEYS = new Set(["id", "title", "summary"]);

type ProviderValidation =
  | { readonly ok: true; readonly providers: readonly ToolbarSearchProvider[] }
  | { readonly ok: false; readonly message: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeProviders(input: unknown): ProviderValidation {
  if (!Array.isArray(input) || input.length > PROVIDER_LIMIT) {
    return {
      ok: false,
      message: `Search providers must be an array of at most ${PROVIDER_LIMIT} entries.`,
    };
  }

  const providers: ToolbarSearchProvider[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const entry = Object.getOwnPropertyDescriptor(input, String(index));
    if (entry === undefined || !("value" in entry)) {
      return {
        ok: false,
        message: "Search provider lists must not contain holes or accessors.",
      };
    }
    const value: unknown = entry.value;
    if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length) {
      return {
        ok: false,
        message: "Each search provider must be a plain data object.",
      };
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Object.keys(descriptors).some(
        (key) => key !== "id" && key !== "search",
      ) ||
      Object.values(descriptors).some((descriptor) => !("value" in descriptor))
    ) {
      return {
        ok: false,
        message:
          "Search providers may contain only data properties id and search.",
      };
    }
    const id = descriptors.id?.value;
    const search = descriptors.search?.value;
    if (
      typeof id !== "string" ||
      !PROVIDER_ID_PATTERN.test(id) ||
      typeof search !== "function" ||
      seen.has(id)
    ) {
      return {
        ok: false,
        message:
          "Search provider ids must be unique and provider functions valid.",
      };
    }
    seen.add(id);
    providers.push(Object.freeze({ id, search }));
  }
  return { ok: true, providers: Object.freeze(providers) };
}

function normalizeProviderResults(
  input: unknown,
  providerId: string,
):
  | { readonly ok: true; readonly results: readonly ToolbarSearchResult[] }
  | { readonly ok: false } {
  if (!Array.isArray(input) || input.length > RESULT_LIMIT_PER_PROVIDER) {
    return { ok: false };
  }
  const results: ToolbarSearchResult[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const entry = Object.getOwnPropertyDescriptor(input, String(index));
    if (
      entry === undefined ||
      !("value" in entry) ||
      !isPlainRecord(entry.value) ||
      Object.getOwnPropertySymbols(entry.value).length > 0
    ) {
      return { ok: false };
    }
    const descriptors = Object.getOwnPropertyDescriptors(entry.value);
    if (
      Object.keys(descriptors).some((key) => !RESULT_KEYS.has(key)) ||
      Object.values(descriptors).some((descriptor) => !("value" in descriptor))
    ) {
      return { ok: false };
    }

    const id = descriptors.id?.value;
    const title = descriptors.title?.value;
    const summary = descriptors.summary?.value;
    if (
      typeof id !== "string" ||
      !RESULT_ID_PATTERN.test(id) ||
      seen.has(id) ||
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.length > 160 ||
      (summary !== undefined &&
        (typeof summary !== "string" || summary.length > 500))
    ) {
      return { ok: false };
    }
    seen.add(id);
    results.push(
      Object.freeze({
        providerId,
        id,
        title,
        ...(summary === undefined ? {} : { summary }),
      }),
    );
  }
  return { ok: true, results: Object.freeze(results) };
}

export function createFederatedSearchCoordinator(
  providers: readonly ToolbarSearchProvider[],
  policy: FederatedSearchPolicy,
): FederatedSearchCoordinator {
  if (
    policy === null ||
    typeof policy !== "object" ||
    typeof policy.isEnabled !== "function" ||
    typeof policy.authorize !== "function"
  ) {
    throw new TypeError(
      "Search requires explicit enabled and host authorization policies.",
    );
  }
  let providerValidation: ProviderValidation | null = null;

  return {
    async search(query, signal) {
      if (
        typeof query !== "string" ||
        query.trim().length === 0 ||
        query.length > QUERY_LIMIT
      ) {
        return {
          ok: false,
          error: {
            code: "SEARCH_INVALID_QUERY",
            message: `Search query must contain 1 to ${QUERY_LIMIT} characters.`,
          },
        };
      }
      if (
        signal === null ||
        typeof signal !== "object" ||
        typeof signal.addEventListener !== "function" ||
        typeof signal.removeEventListener !== "function" ||
        typeof signal.aborted !== "boolean"
      ) {
        return {
          ok: false,
          error: {
            code: "SEARCH_INVALID_SIGNAL",
            message:
              "Search requires an AbortSignal for cooperative cancellation.",
          },
        };
      }
      if (signal.aborted) {
        return {
          ok: false,
          error: {
            code: "SEARCH_CANCELLED",
            message: "Search was cancelled before providers started.",
          },
        };
      }
      let enabled: boolean;
      try {
        enabled = policy.isEnabled();
      } catch (cause) {
        return {
          ok: false,
          error: {
            code: "SEARCH_AUTHORIZATION_FAILED",
            message: "Search feature policy could not be evaluated.",
            cause,
          },
        };
      }
      if (typeof enabled !== "boolean") {
        return {
          ok: false,
          error: {
            code: "SEARCH_AUTHORIZATION_FAILED",
            message: "Search feature policy must return a boolean.",
          },
        };
      }
      if (!enabled) {
        return {
          ok: false,
          error: {
            code: "SEARCH_DISABLED",
            message: "Search is disabled by host configuration.",
          },
        };
      }
      try {
        providerValidation ??= normalizeProviders(providers);
      } catch (cause) {
        return {
          ok: false,
          error: {
            code: "SEARCH_INVALID_PROVIDER_CONFIG",
            message: "Search provider configuration could not be validated.",
            cause,
          },
        };
      }
      if (!providerValidation.ok) {
        return {
          ok: false,
          error: {
            code: "SEARCH_INVALID_PROVIDER_CONFIG",
            message: providerValidation.message,
          },
        };
      }

      const normalizedQuery = query.trim();
      const responses = await Promise.all(
        providerValidation.providers.map(async (provider) => {
          if (signal.aborted) {
            return {
              results: [],
              diagnostic: {
                code: "SEARCH_CANCELLED" as const,
                providerId: provider.id,
                message: "Search was cancelled before this provider started.",
              },
            };
          }
          let authorized: boolean;
          try {
            authorized = policy.authorize(provider.id, normalizedQuery);
          } catch (cause) {
            return {
              results: [],
              diagnostic: {
                code: "SEARCH_AUTHORIZATION_FAILED" as const,
                providerId: provider.id,
                message: "Host authorization failed for this search provider.",
                cause,
              },
            };
          }
          if (typeof authorized !== "boolean") {
            return {
              results: [],
              diagnostic: {
                code: "SEARCH_AUTHORIZATION_FAILED" as const,
                providerId: provider.id,
                message: "Search authorization policy must return a boolean.",
              },
            };
          }
          if (!authorized) {
            return {
              results: [],
              diagnostic: {
                code: "SEARCH_PERMISSION_DENIED" as const,
                providerId: provider.id,
                message: "Host policy denied this search provider.",
              },
            };
          }
          if (signal.aborted) {
            return {
              results: [],
              diagnostic: {
                code: "SEARCH_CANCELLED" as const,
                providerId: provider.id,
                message: "Search was cancelled before this provider started.",
              },
            };
          }

          let rawResults: unknown;
          try {
            rawResults = await provider.search(normalizedQuery, signal);
          } catch (cause) {
            return {
              results: [],
              diagnostic: {
                code: signal.aborted
                  ? ("SEARCH_CANCELLED" as const)
                  : ("SEARCH_PROVIDER_FAILED" as const),
                providerId: provider.id,
                message: signal.aborted
                  ? "Search provider stopped after cancellation."
                  : "Search provider failed.",
                cause,
              },
            };
          }
          let normalizedResults:
            ReturnType<typeof normalizeProviderResults> | undefined;
          try {
            normalizedResults = normalizeProviderResults(
              rawResults,
              provider.id,
            );
          } catch (cause) {
            return {
              results: [],
              diagnostic: {
                code: "SEARCH_INVALID_RESULTS" as const,
                providerId: provider.id,
                message: "Search provider results could not be validated.",
                cause,
              },
            };
          }
          if (!normalizedResults.ok) {
            return {
              results: [],
              diagnostic: {
                code: "SEARCH_INVALID_RESULTS" as const,
                providerId: provider.id,
                message: "Search provider returned invalid result data.",
              },
            };
          }
          return { results: normalizedResults.results };
        }),
      );
      if (signal.aborted) {
        return {
          ok: false,
          error: {
            code: "SEARCH_CANCELLED",
            message: "Search was cancelled before results could be returned.",
          },
        };
      }

      const results: ToolbarSearchResult[] = [];
      const diagnostics: SearchDiagnostic[] = [];
      for (const response of responses) {
        results.push(...response.results);
        if (response.diagnostic !== undefined) {
          diagnostics.push(response.diagnostic);
        }
      }
      return {
        ok: true,
        query: normalizedQuery,
        results: Object.freeze(results),
        diagnostics: Object.freeze(diagnostics),
      };
    },
  };
}
