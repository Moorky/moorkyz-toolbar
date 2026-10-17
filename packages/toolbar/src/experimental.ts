import {
  createTrustedExtensionRegistry,
  type TrustedExtensionRegistry,
  type TrustedExtensionRegistryOptions,
} from "./extensions.js";

export interface ExperimentalNamespace {
  readonly enabled: boolean;
  createExtensionRegistry(
    options?: Omit<TrustedExtensionRegistryOptions, "enabled">,
  ): TrustedExtensionRegistry;
}

/**
 * Unapproved APIs: opt-in does not grant extension authority or change core flags.
 */
export function createExperimentalNamespace(
  enabled = false,
): ExperimentalNamespace {
  const optedIn = enabled === true;
  return Object.freeze({
    enabled: optedIn,
    createExtensionRegistry(
      options: Omit<TrustedExtensionRegistryOptions, "enabled"> = {},
    ) {
      return createTrustedExtensionRegistry({
        ...(optedIn ? options : {}),
        enabled: optedIn,
      });
    },
  });
}
