import "@angular/compiler";
import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import type { ToolbarConfigurationInput, ToolbarHost } from "@moorkyz/toolbar";
import { injectToolbar } from "@moorkyz/toolbar/angular";

@Component({
  selector: "mzk-consumer-toolbar",
  standalone: true,
  template: "",
})
export class ConsumerToolbar {
  readonly configuration = signal<ToolbarConfigurationInput>({
    actions: [{ id: "home", label: "Home" }],
  });
  readonly host: ToolbarHost = Object.freeze({
    dispatchAction: (actionId: string) => {
      if (actionId !== "home") throw new Error("Unknown host action.");
    },
  });
  readonly toolbar = injectToolbar(this.configuration, () => this.host);
}

/**
 * The document must contain <mzk-consumer-toolbar>. The host owns its lifetime.
 * JIT/compiler is fixture-only; the adapter itself never imports the compiler.
 */
export async function mountConsumer(): Promise<() => void> {
  const app = await bootstrapApplication(ConsumerToolbar, {
    providers: [provideZonelessChangeDetection()],
  });
  await app.whenStable();
  return () => app.destroy();
}
