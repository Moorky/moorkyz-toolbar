export type CommandConcurrency =
  "parallel" | "single-flight" | "drop" | "replace" | "queue";

export interface CommandDefinition<Context, Input, Output> {
  readonly id: string;
  readonly permission?: string;
  readonly concurrency?: CommandConcurrency;
  readonly timeoutMs?: number;
  readonly validateInput: (input: unknown) => input is Input;
  readonly execute: (
    input: Input,
    context: Context,
    signal: AbortSignal,
  ) => Output | Promise<Output>;
}

export interface CommandExecutionOptions {
  readonly signal?: AbortSignal;
}

export type CommandErrorCode =
  | "COMMAND_INVALID_ID"
  | "COMMAND_INVALID_DEFINITION"
  | "COMMAND_DUPLICATE"
  | "COMMAND_UNKNOWN"
  | "COMMAND_PERMISSION_DENIED"
  | "COMMAND_AUTHORIZATION_FAILED"
  | "COMMAND_INVALID_INPUT"
  | "COMMAND_CANCELLED"
  | "COMMAND_PERMISSION_REVOKED"
  | "COMMAND_TIMED_OUT"
  | "COMMAND_REPLACED"
  | "COMMAND_DROPPED"
  | "COMMAND_EXECUTION_FAILED"
  | "COMMAND_DISPOSED";

export interface CommandError {
  readonly code: CommandErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type CommandResult<Output> =
  | { readonly ok: true; readonly value: Output }
  | { readonly ok: false; readonly error: CommandError };

export interface CommandHandle<Input, Context, Output> {
  readonly id: string;
  execute(
    input: Input,
    context: Context,
    options?: CommandExecutionOptions,
  ): Promise<CommandResult<Output>>;
  cancel(): void;
  dispose(): void;
}

export type CommandRegistrationResult<Input, Context, Output> =
  | {
      readonly ok: true;
      readonly value: CommandHandle<Input, Context, Output>;
    }
  | { readonly ok: false; readonly error: CommandError };

export interface CommandHostPolicy<Context> {
  readonly authorize?: (
    permission: string,
    context: Context,
  ) => boolean | Promise<boolean>;
}

export interface CommandExecutor<Context> {
  register<Input, Output>(
    definition: CommandDefinition<Context, Input, Output>,
  ): CommandRegistrationResult<Input, Context, Output>;
  cancel(id: string): boolean;
  revokePermission(permission: string): number;
  dispose(): void;
}

interface ActiveExecution {
  readonly permission: string | undefined;
  abort(code: CommandErrorCode, message: string): void;
}

interface InternalCommand {
  readonly id: string;
  readonly permission: string | undefined;
  cancel(): void;
  revokePermission(permission: string): boolean;
  dispose(): void;
}

const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]{0,62}:[a-z][a-z0-9-]{0,62}$/;

function error(
  code: CommandErrorCode,
  message: string,
  cause?: unknown,
): CommandError {
  return {
    code,
    message,
    ...(cause === undefined ? {} : { cause }),
  };
}

function failed<Output>(
  code: CommandErrorCode,
  message: string,
  cause?: unknown,
): CommandResult<Output> {
  return { ok: false, error: error(code, message, cause) };
}

function isConcurrency(value: unknown): value is CommandConcurrency {
  return (
    value === "parallel" ||
    value === "single-flight" ||
    value === "drop" ||
    value === "replace" ||
    value === "queue"
  );
}

export function createCommandExecutor<Context>(
  hostPolicy: CommandHostPolicy<Context> = {},
): CommandExecutor<Context> {
  const commands = new Map<string, InternalCommand>();
  let disposed = false;

  const executor: CommandExecutor<Context> = {
    register<Input, Output>(
      definition: CommandDefinition<Context, Input, Output>,
    ) {
      if (!COMMAND_ID_PATTERN.test(definition.id)) {
        return {
          ok: false,
          error: error(
            "COMMAND_INVALID_ID",
            "Command ids must use a valid namespace:name form.",
          ),
        };
      }
      if (commands.has(definition.id)) {
        return {
          ok: false,
          error: error(
            "COMMAND_DUPLICATE",
            `Command "${definition.id}" is already registered.`,
          ),
        };
      }
      if (typeof definition.execute !== "function") {
        return {
          ok: false,
          error: error(
            "COMMAND_INVALID_DEFINITION",
            "Command definitions require an execute handler.",
          ),
        };
      }
      if (typeof definition.validateInput !== "function") {
        return {
          ok: false,
          error: error(
            "COMMAND_INVALID_DEFINITION",
            "Command definitions require a runtime input validator.",
          ),
        };
      }
      if (
        definition.permission !== undefined &&
        !COMMAND_ID_PATTERN.test(definition.permission)
      ) {
        return {
          ok: false,
          error: error(
            "COMMAND_INVALID_DEFINITION",
            "Permission ids must use a valid namespace:name form.",
          ),
        };
      }
      if (
        definition.timeoutMs !== undefined &&
        (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0)
      ) {
        return {
          ok: false,
          error: error(
            "COMMAND_INVALID_DEFINITION",
            "Command timeouts must be finite positive numbers.",
          ),
        };
      }
      const concurrency = definition.concurrency ?? "parallel";
      if (!isConcurrency(concurrency)) {
        return {
          ok: false,
          error: error(
            "COMMAND_INVALID_DEFINITION",
            "Command concurrency policy is not supported.",
          ),
        };
      }
      if (disposed) {
        return {
          ok: false,
          error: error("COMMAND_DISPOSED", "Command executor is disposed."),
        };
      }

      let commandDisposed = false;
      let queueTail: Promise<void> = Promise.resolve();
      let singleFlight: Promise<CommandResult<Output>> | null = null;
      let cancellationGeneration = 0;
      let permissionGeneration = 0;
      const active = new Set<ActiveExecution>();

      async function authorize(context: Context): Promise<CommandError | null> {
        const permission = definition.permission;
        if (permission === undefined) return null;
        if (hostPolicy.authorize === undefined) {
          return error(
            "COMMAND_PERMISSION_DENIED",
            `Permission "${permission}" was denied because no host policy is configured.`,
          );
        }
        try {
          return (await hostPolicy.authorize(permission, context))
            ? null
            : error(
                "COMMAND_PERMISSION_DENIED",
                `Host policy denied "${permission}".`,
              );
        } catch (cause) {
          return error(
            "COMMAND_AUTHORIZATION_FAILED",
            `Host authorization failed for "${permission}".`,
            cause,
          );
        }
      }

      function beginExecution(
        input: Input,
        context: Context,
        options: CommandExecutionOptions,
        reauthorize: boolean,
        requestGeneration: number,
        requestPermissionGeneration: number,
      ): Promise<CommandResult<Output>> {
        return (async () => {
          if (disposed || commandDisposed) {
            return failed(
              "COMMAND_DISPOSED",
              `Command "${definition.id}" is disposed.`,
            );
          }
          if (requestGeneration !== cancellationGeneration) {
            return failed(
              "COMMAND_CANCELLED",
              `Command "${definition.id}" was cancelled before execution.`,
            );
          }
          if (
            definition.permission !== undefined &&
            requestPermissionGeneration !== permissionGeneration
          ) {
            return failed(
              "COMMAND_PERMISSION_REVOKED",
              `Permission "${definition.permission}" was revoked before "${definition.id}" started.`,
            );
          }
          if (options.signal?.aborted) {
            return failed(
              "COMMAND_CANCELLED",
              `Command "${definition.id}" was cancelled before execution.`,
            );
          }
          if (reauthorize) {
            const permissionError = await authorize(context);
            if (permissionError !== null) {
              return { ok: false, error: permissionError };
            }
            if (
              requestGeneration !== cancellationGeneration ||
              (definition.permission !== undefined &&
                requestPermissionGeneration !== permissionGeneration)
            ) {
              return failed(
                definition.permission !== undefined
                  ? "COMMAND_PERMISSION_REVOKED"
                  : "COMMAND_CANCELLED",
                `Command "${definition.id}" was cancelled before execution.`,
              );
            }
          }
          try {
            if (!definition.validateInput(input)) {
              return failed(
                "COMMAND_INVALID_INPUT",
                `Input for "${definition.id}" failed validation.`,
              );
            }
          } catch (cause) {
            return failed(
              "COMMAND_INVALID_INPUT",
              `Input validation for "${definition.id}" failed.`,
              cause,
            );
          }

          const controller = new AbortController();
          let abortError: CommandError | null = null;
          const current: ActiveExecution = {
            permission: definition.permission,
            abort(code, message) {
              if (controller.signal.aborted) return;
              abortError = error(code, message);
              controller.abort();
            },
          };
          active.add(current);

          let timeout: ReturnType<typeof setTimeout> | undefined;
          let resolveAbort!: (result: CommandResult<Output>) => void;
          const aborted = new Promise<CommandResult<Output>>((resolve) => {
            resolveAbort = resolve;
          });
          const onAbort = () => {
            resolveAbort({
              ok: false,
              error:
                abortError ??
                error(
                  "COMMAND_CANCELLED",
                  `Command "${definition.id}" was cancelled.`,
                ),
            });
          };
          controller.signal.addEventListener("abort", onAbort, { once: true });

          const onExternalAbort = () =>
            current.abort(
              "COMMAND_CANCELLED",
              `Command "${definition.id}" was cancelled by its caller.`,
            );
          options.signal?.addEventListener("abort", onExternalAbort, {
            once: true,
          });

          if (definition.timeoutMs !== undefined) {
            timeout = setTimeout(
              () =>
                current.abort(
                  "COMMAND_TIMED_OUT",
                  `Command "${definition.id}" exceeded its timeout.`,
                ),
              definition.timeoutMs,
            );
          }

          const execution: Promise<CommandResult<Output>> = Promise.resolve()
            .then(() => definition.execute(input, context, controller.signal))
            .then(
              (value): CommandResult<Output> => ({ ok: true, value }),
              (cause: unknown): CommandResult<Output> =>
                failed<Output>(
                  "COMMAND_EXECUTION_FAILED",
                  `Command "${definition.id}" failed.`,
                  cause,
                ),
            );

          try {
            return await Promise.race([execution, aborted]);
          } finally {
            if (timeout !== undefined) clearTimeout(timeout);
            options.signal?.removeEventListener("abort", onExternalAbort);
            controller.signal.removeEventListener("abort", onAbort);
            active.delete(current);
          }
        })();
      }

      const handle: CommandHandle<Input, Context, Output> = {
        id: definition.id,

        async execute(
          input: Input,
          context: Context,
          options: CommandExecutionOptions = {},
        ) {
          if (disposed || commandDisposed) {
            return failed(
              "COMMAND_DISPOSED",
              `Command "${definition.id}" is disposed.`,
            );
          }

          const requestGeneration = cancellationGeneration;
          const requestPermissionGeneration = permissionGeneration;
          const permissionError = await authorize(context);
          if (permissionError !== null) {
            return { ok: false, error: permissionError };
          }
          if (requestGeneration !== cancellationGeneration) {
            return failed(
              "COMMAND_CANCELLED",
              `Command "${definition.id}" was cancelled before execution.`,
            );
          }
          if (
            definition.permission !== undefined &&
            requestPermissionGeneration !== permissionGeneration
          ) {
            return failed(
              "COMMAND_PERMISSION_REVOKED",
              `Permission "${definition.permission}" was revoked before execution.`,
            );
          }
          if (options.signal?.aborted) {
            return failed(
              "COMMAND_CANCELLED",
              `Command "${definition.id}" was cancelled before execution.`,
            );
          }

          if (concurrency === "single-flight" && singleFlight !== null) {
            return singleFlight;
          }
          if (concurrency === "drop" && active.size > 0) {
            return failed(
              "COMMAND_DROPPED",
              `Command "${definition.id}" was dropped because another call is active.`,
            );
          }
          if (concurrency === "replace") {
            for (const current of active) {
              current.abort(
                "COMMAND_REPLACED",
                `Command "${definition.id}" was replaced by a newer call.`,
              );
            }
          }

          let result: Promise<CommandResult<Output>>;
          if (concurrency === "queue") {
            result = queueTail.then(
              () =>
                beginExecution(
                  input,
                  context,
                  options,
                  true,
                  requestGeneration,
                  requestPermissionGeneration,
                ),
              () =>
                beginExecution(
                  input,
                  context,
                  options,
                  true,
                  requestGeneration,
                  requestPermissionGeneration,
                ),
            );
            queueTail = result.then(
              () => undefined,
              () => undefined,
            );
          } else {
            result = beginExecution(
              input,
              context,
              options,
              false,
              requestGeneration,
              requestPermissionGeneration,
            );
          }

          if (concurrency === "single-flight") {
            singleFlight = result;
            void result.then(() => {
              if (singleFlight === result) singleFlight = null;
            });
          }
          return result;
        },

        cancel() {
          cancellationGeneration += 1;
          for (const current of active) {
            current.abort(
              "COMMAND_CANCELLED",
              `Command "${definition.id}" was cancelled by the host.`,
            );
          }
        },

        dispose() {
          if (commandDisposed) return;
          commandDisposed = true;
          cancellationGeneration += 1;
          for (const current of active) {
            current.abort(
              "COMMAND_DISPOSED",
              `Command "${definition.id}" was disposed.`,
            );
          }
          commands.delete(definition.id);
        },
      };
      Object.freeze(handle);

      const internal: InternalCommand = {
        id: definition.id,
        permission: definition.permission,
        cancel: () => handle.cancel(),
        revokePermission: (permission) => {
          if (definition.permission !== permission) return false;
          permissionGeneration += 1;
          for (const current of active) {
            current.abort(
              "COMMAND_PERMISSION_REVOKED",
              `Permission "${permission}" was revoked while "${definition.id}" was running.`,
            );
          }
          return true;
        },
        dispose: () => handle.dispose(),
      };
      commands.set(definition.id, internal);
      return { ok: true, value: handle };
    },

    cancel(id) {
      const command = commands.get(id);
      if (command === undefined) return false;
      command.cancel();
      return true;
    },

    revokePermission(permission) {
      let revoked = 0;
      for (const command of commands.values()) {
        if (command.revokePermission(permission)) revoked += 1;
      }
      return revoked;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const command of commands.values()) {
        command.dispose();
      }
      commands.clear();
    },
  };
  return executor;
}
