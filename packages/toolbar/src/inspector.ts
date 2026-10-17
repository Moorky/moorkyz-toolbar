import type { LocalDiagnosticsRecorder } from "./diagnostics.js";

export function createDockInspector(
  target: HTMLElement,
  recorder: LocalDiagnosticsRecorder,
) {
  let panel: HTMLElement | null = null;
  let output: HTMLPreElement | null = null;
  let disposed = false;
  function refresh(): void {
    if (output === null) return;
    output.textContent = JSON.stringify(recorder.snapshot(), null, 2);
  }
  return {
    setEnabled(enabled: boolean): void {
      if (disposed) throw new Error("A disposed inspector cannot be enabled.");
      if (typeof enabled !== "boolean")
        throw new TypeError("Enabled must be boolean.");
      if (!enabled) {
        panel?.remove();
        panel = null;
        output = null;
        return;
      }
      if (panel === null) {
        const document = target.ownerDocument;
        panel = document.createElement("section");
        panel.setAttribute("aria-label", "Local Dock Inspector");
        const title = document.createElement("h3");
        title.textContent = "Local Dock Inspector";
        output = document.createElement("pre");
        output.tabIndex = 0;
        panel.append(title, output);
        target.append(panel);
      }
      refresh();
    },
    refresh,
    dispose(): void {
      panel?.remove();
      panel = null;
      output = null;
      disposed = true;
    },
  };
}
