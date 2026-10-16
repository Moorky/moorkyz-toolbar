import {
  createCapabilityRegistry,
  createCommandExecutor,
  createContextResolver,
  createSurfaceStack,
  validateConfiguration,
  type ToolbarConfigurationInput,
} from "@moorkyz/toolbar";

const configuration: ToolbarConfigurationInput = {
  schemaVersion: "1.0",
  features: {
    search: true,
    spatialCoordination: false,
  },
  actions: [{ id: "home", label: "Home" }],
};

const validation = validateConfiguration(configuration);

if (!validation.ok) {
  throw new Error(validation.errors.map(({ code }) => code).join(", "));
}

export const normalizedConfiguration = validation.value;

interface HostContext {
  readonly projectId: string;
  readonly mode: "view" | "edit";
}

interface SaveInput {
  readonly title: string;
}

export function createHostServices(returnFocusTo: HTMLElement) {
  const capabilities = createCapabilityRegistry<{
    readonly save: (input: SaveInput) => Promise<void>;
  }>();
  const registration = capabilities.transact((transaction) => {
    transaction.register({
      id: "host:save",
      owner: "host",
      value: { save: async () => {} },
    });
  });
  if (!registration.ok) throw new Error(registration.error.message);

  const contexts = createContextResolver<HostContext>({
    projectId: "example",
    mode: "view",
  });
  const editorContext = contexts.setScope("example:editor", { mode: "edit" });
  if (!editorContext.ok) throw new Error(editorContext.error.message);

  const commands = createCommandExecutor<HostContext>({
    authorize: (permission, context) =>
      permission === "host:save" && context.mode === "edit",
  });
  const save = commands.register<SaveInput, string>({
    id: "host:save",
    permission: "host:save",
    concurrency: "single-flight",
    validateInput: (input): input is SaveInput =>
      typeof input === "object" &&
      input !== null &&
      "title" in input &&
      typeof input.title === "string",
    execute: (input, context) => `${context.projectId}: ${input.title}`,
  });
  if (!save.ok) throw new Error(save.error.message);

  const surfaces = createSurfaceStack<HTMLElement>();
  const surface = surfaces.open({
    id: "example:editor",
    kind: "panel",
    returnFocusTo,
  });
  if (!surface.ok) throw new Error(surface.error.message);

  return {
    capabilities,
    commands,
    contexts,
    save: save.value,
    surfaces,
  };
}
