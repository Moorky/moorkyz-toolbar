import {
  onBeforeUnmount,
  onMounted,
  shallowReadonly,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import type { ToolbarConfigurationInput } from "./configuration.js";
import {
  createToolbar,
  type ToolbarController,
  type ToolbarHost,
  type ToolbarRuntimeError,
} from "./toolbar.js";

export interface VueToolbarBinding {
  readonly controller: Readonly<Ref<ToolbarController | null>>;
  readonly error: Readonly<Ref<ToolbarRuntimeError | null>>;
}

const EMPTY_CONFIGURATION: ToolbarConfigurationInput = Object.freeze({});
const EMPTY_HOST: ToolbarHost = Object.freeze({});

/**
 * Call in setup(). Mounting starts after Vue mounts the host element, never SSR.
 * Replace configuration/host references to update; in-place mutation is ignored.
 */
export function useToolbar(
  target: Readonly<Ref<HTMLElement | null>>,
  configuration: MaybeRefOrGetter<ToolbarConfigurationInput> = EMPTY_CONFIGURATION,
  host: MaybeRefOrGetter<ToolbarHost> = EMPTY_HOST,
): VueToolbarBinding {
  const controller = shallowRef<ToolbarController | null>(null);
  const error = shallowRef<ToolbarRuntimeError | null>(null);
  let stopWatching: (() => void) | undefined;
  let mountedTarget: HTMLElement | null = null;
  let mountedHost: ToolbarHost | null = null;

  function release() {
    controller.value?.dispose();
    controller.value = null;
    mountedTarget = null;
    mountedHost = null;
  }

  onMounted(() => {
    stopWatching = watch(
      [() => target.value, () => toValue(configuration), () => toValue(host)],
      ([element, nextConfiguration, nextHost]) => {
        error.value = null;
        if (element !== mountedTarget || nextHost !== mountedHost) release();
        if (element === null) return;
        let candidate: ToolbarController | null = null;
        try {
          if (controller.value !== null) {
            const result = controller.value.update(nextConfiguration);
            if (!result.ok) error.value = result.error;
            return;
          }
          const next = createToolbar(nextConfiguration, nextHost);
          candidate = next;
          const result = next.mount(element);
          if (!result.ok) {
            next.dispose();
            error.value = result.error;
            return;
          }
          mountedTarget = element;
          mountedHost = nextHost;
          controller.value = next;
        } catch (cause) {
          candidate?.dispose();
          release();
          error.value = Object.freeze({
            code: "INVALID_CONFIGURATION",
            message: "The Vue toolbar configuration could not be applied.",
            cause,
          });
        }
      },
      { immediate: true, flush: "post" },
    );
  });

  onBeforeUnmount(() => {
    stopWatching?.();
    release();
  });

  return Object.freeze({
    controller: shallowReadonly(controller),
    error: shallowReadonly(error),
  });
}
