import {
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
