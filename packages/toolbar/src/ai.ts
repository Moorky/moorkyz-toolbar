export interface AIProviderRequest {
  readonly prompt: string;
  readonly signal: AbortSignal;
}

export interface AIProvider {
  generate(request: AIProviderRequest): unknown | Promise<unknown>;
}

export interface AIAdapterPolicy {
  readonly isEnabled: () => boolean;
  readonly authorize: () => boolean;
}

export type AIDiagnosticCode =
  | "AI_DISABLED"
  | "AI_PERMISSION_DENIED"
  | "AI_AUTHORIZATION_FAILED"
  | "AI_INVALID_PROMPT"
  | "AI_INVALID_SIGNAL"
  | "AI_CANCELLED"
  | "AI_PROVIDER_FAILED"
  | "AI_INVALID_RESPONSE";

export interface AIDiagnostic {
  readonly code: AIDiagnosticCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type AICompletionOutcome =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: AIDiagnostic };

export interface HostAuthorizedAIAdapter {
  complete(prompt: string, signal: AbortSignal): Promise<AICompletionOutcome>;
}

const PROMPT_LIMIT = 8_000;
const RESPONSE_LIMIT = 20_000;

export function createHostAuthorizedAIAdapter(
  provider: AIProvider,
  policy: AIAdapterPolicy,
): HostAuthorizedAIAdapter {
  if (
    provider === null ||
    typeof provider !== "object" ||
    typeof provider.generate !== "function"
  ) {
    throw new TypeError("AI requires an explicit host-provided generator.");
  }
  if (
    policy === null ||
    typeof policy !== "object" ||
    typeof policy.isEnabled !== "function" ||
    typeof policy.authorize !== "function"
  ) {
    throw new TypeError(
      "AI requires explicit enabled and host authorization policies.",
    );
  }

  return {
    async complete(prompt, signal) {
      if (
        typeof prompt !== "string" ||
        prompt.trim().length === 0 ||
        prompt.length > PROMPT_LIMIT
      ) {
        return {
          ok: false,
          error: {
            code: "AI_INVALID_PROMPT",
            message: `AI prompts must contain 1 to ${PROMPT_LIMIT} characters.`,
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
            code: "AI_INVALID_SIGNAL",
            message: "AI completion requires an AbortSignal.",
          },
        };
      }
      if (signal.aborted) {
        return {
          ok: false,
          error: {
            code: "AI_CANCELLED",
            message: "AI completion was cancelled before authorization.",
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
            code: "AI_AUTHORIZATION_FAILED",
            message: "AI feature policy could not be evaluated.",
            cause,
          },
        };
      }
      if (typeof enabled !== "boolean") {
        return {
          ok: false,
          error: {
            code: "AI_AUTHORIZATION_FAILED",
            message: "AI feature policy must return a boolean.",
          },
        };
      }
      if (!enabled) {
        return {
          ok: false,
          error: {
            code: "AI_DISABLED",
            message: "AI is disabled by host configuration.",
          },
        };
      }

      let authorized: boolean;
      try {
        authorized = policy.authorize();
      } catch (cause) {
        return {
          ok: false,
          error: {
            code: "AI_AUTHORIZATION_FAILED",
            message: "Host authorization failed for AI completion.",
            cause,
          },
        };
      }
      if (typeof authorized !== "boolean") {
        return {
          ok: false,
          error: {
            code: "AI_AUTHORIZATION_FAILED",
            message: "AI authorization policy must return a boolean.",
          },
        };
      }
      if (!authorized) {
        return {
          ok: false,
          error: {
            code: "AI_PERMISSION_DENIED",
            message: "Host policy denied AI completion.",
          },
        };
      }
      if (signal.aborted) {
        return {
          ok: false,
          error: {
            code: "AI_CANCELLED",
            message: "AI completion was cancelled before the provider started.",
          },
        };
      }

      let response: unknown;
      try {
        response = await provider.generate({
          prompt: prompt.trim(),
          signal,
        });
      } catch (cause) {
        return {
          ok: false,
          error: {
            code: signal.aborted ? "AI_CANCELLED" : "AI_PROVIDER_FAILED",
            message: signal.aborted
              ? "AI provider stopped after cancellation."
              : "AI provider failed.",
            cause,
          },
        };
      }
      if (signal.aborted) {
        return {
          ok: false,
          error: {
            code: "AI_CANCELLED",
            message:
              "AI completion was cancelled before results were returned.",
          },
        };
      }
      if (
        typeof response !== "string" ||
        response.trim().length === 0 ||
        response.length > RESPONSE_LIMIT
      ) {
        return {
          ok: false,
          error: {
            code: "AI_INVALID_RESPONSE",
            message: `AI providers must return plain text of at most ${RESPONSE_LIMIT} characters.`,
          },
        };
      }
      return { ok: true, text: response };
    },
  };
}
