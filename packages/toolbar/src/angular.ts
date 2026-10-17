import {
  afterNextRender,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  type Signal,
} from "@angular/core";
import type { ToolbarConfigurationInput } from "./configuration.js";
import {
  createToolbar,
  type ToolbarController,
  type ToolbarHost,
  type ToolbarRuntimeError,
} from "./toolbar.js";

export interface AngularToolbarBinding {
  readonly controller: Signal<ToolbarController | null>;
  readonly error: Signal<ToolbarRuntimeError | null>;
}

const EMPTY_CONFIGURATION: ToolbarConfigurationInput = Object.freeze({});
const EMPTY_HOST: ToolbarHost = Object.freeze({});

/**
 * Call in a component/directive injection context on the toolbar's host element.
 * Angular does not run afterNextRender on the server.
 */
export function injectToolbar(
  configuration: () => ToolbarConfigurationInput = () => EMPTY_CONFIGURATION,
  host: () => ToolbarHost = () => EMPTY_HOST,
): AngularToolbarBinding {
  const element = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroyRef = inject(DestroyRef);
  const controller = signal<ToolbarController | null>(null);
  const error = signal<ToolbarRuntimeError | null>(null);
  let ready = false;
  let destroyed = false;
  let current: ToolbarController | null = null;
  let mountedHost: ToolbarHost | null = null;

  function release() {
    current?.dispose();
    current = null;
    mountedHost = null;
    controller.set(null);
  }

  function synchronize() {
    const nextConfiguration = configuration();
    const nextHost = host();
    if (!ready || destroyed) return;
    error.set(null);
    if (nextHost !== mountedHost) release();
    let candidate: ToolbarController | null = null;
    try {
      if (current !== null) {
        const result = current.update(nextConfiguration);
        if (!result.ok) error.set(result.error);
        return;
      }
      const next = createToolbar(nextConfiguration, nextHost);
      candidate = next;
      const result = next.mount(element.nativeElement);
      if (!result.ok) {
        next.dispose();
        error.set(result.error);
        return;
      }
      current = next;
      mountedHost = nextHost;
      controller.set(next);
    } catch (cause) {
      candidate?.dispose();
      release();
      error.set(
        Object.freeze({
          code: "INVALID_CONFIGURATION",
          message: "The Angular toolbar configuration could not be applied.",
          cause,
        }),
      );
    }
  }

  const watcher = effect(synchronize, { manualCleanup: true });
  const render = afterNextRender(() => {
    ready = true;
    synchronize();
  });
  destroyRef.onDestroy(() => {
    destroyed = true;
    watcher.destroy();
    render.destroy();
    release();
  });

  return Object.freeze({
    controller: controller.asReadonly(),
    error: error.asReadonly(),
  });
}
