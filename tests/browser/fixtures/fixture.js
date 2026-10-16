import { createToolbar } from "/toolbar/index.js";

const target = document.querySelector("#target");
const result = document.querySelector("#action-result");
const toolbar = createToolbar(
  {
    actions: [
      { id: "home", label: "Home" },
      { id: "projects", label: "Projects" },
      { id: "documentation", label: "Documentation" },
      { id: "settings", label: "Settings" },
      { id: "support", label: "Support" },
    ],
  },
  {
    dispatchAction(actionId) {
      result.textContent = actionId;
    },
  },
);

const mounted = toolbar.mount(target);
if (!mounted.ok) {
  throw new Error(mounted.error.message);
}

window.toolbar = toolbar;
window.mountLightToolbar = () => {
  const lightToolbar = createToolbar(
    {
      renderMode: "light",
      label: "Light mode toolbar",
      actions: [{ id: "search", label: "Search" }],
    },
    { dispatchAction: (actionId) => (result.textContent = actionId) },
  );
  const outcome = lightToolbar.mount(document.querySelector("#light-target"));
  if (!outcome.ok) throw new Error(outcome.error.message);
  return lightToolbar;
};
window.mountPlacementToolbar = (mode) => {
  const placementToolbar = createToolbar(
    {
      placement: { mode, anchor: "bottom" },
      label: `${mode} toolbar`,
      actions: [{ id: "home", label: "Home" }],
    },
    { dispatchAction: () => {} },
  );
  const outcome = placementToolbar.mount(
    document.querySelector("#container-target"),
  );
  if (!outcome.ok) throw new Error(outcome.error.message);
  window.placementToolbar = placementToolbar;
};
