import { createApp, defineComponent, h, ref } from "vue";
import type { ToolbarConfigurationInput, ToolbarHost } from "@moorkyz/toolbar";
import { useToolbar } from "@moorkyz/toolbar/vue";

export const ConsumerToolbar = defineComponent({
  name: "ConsumerToolbar",
  setup() {
    const target = ref<HTMLElement | null>(null);
    const configuration = ref<ToolbarConfigurationInput>({
      actions: [{ id: "home", label: "Home" }],
    });
    const host: ToolbarHost = Object.freeze({
      dispatchAction: (actionId: string) => {
        if (actionId !== "home") throw new Error("Unknown host action.");
      },
    });
    const binding = useToolbar(target, configuration, host);

    return () =>
      h("section", { "aria-label": "Vue toolbar consumer" }, [
        h("div", { ref: target }),
        binding.error.value === null
          ? null
          : h("p", { role: "alert" }, binding.error.value.message),
      ]);
  },
});

export function mountConsumer(target: HTMLElement): () => void {
  const app = createApp(ConsumerToolbar);
  app.mount(target);
  return () => app.unmount();
}
