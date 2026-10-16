# `@moorkyz/toolbar`

**Pre-release implementation draft.** The configuration and controller names in this package are not yet an approved stable public contract. The library and portal are under active development; this package has not been published.

The core is framework-neutral, imports without browser globals, and has no production runtime dependencies.

## Workspace use

Build the package from the repository root:

```sh
pnpm --filter @moorkyz/toolbar build
```

The workspace fixtures in `examples/vanilla-consumer` and `examples/react-consumer` show typed usage. They are not published starter templates.

## Mount a toolbar

```ts
import { createToolbar } from "@moorkyz/toolbar";

const hostRouter = {
  navigate(actionId: string) {
    window.location.hash = actionId;
  },
};

const toolbar = createToolbar(
  {
    actions: [
      { id: "home", label: "Home" },
      { id: "projects", label: "Projects" },
    ],
  },
  {
    dispatchAction(actionId) {
      // Route or execute only through host-owned application code.
      hostRouter.navigate(actionId);
    },
  },
);

const mounted = toolbar.mount(document.body);
if (!mounted.ok) {
  throw new Error(mounted.error.message);
}

// On host teardown:
toolbar.dispose();
```

Mounting defaults to Shadow DOM; set `renderMode: "light"` to opt into scoped class-based Light DOM styling. The controller loads only its same-package CSS asset when mounted, writes labels using text nodes, and never performs network requests to remote services. Actions are disabled unless the host provides `dispatchAction`; navigation and authorization remain host-owned.

`update()` applies a validated partial patch; supplied action lists replace the existing list, while supplied feature flags merge with existing flags. Omitted fields are preserved. A mounted instance cannot switch between Shadow and Light DOM; create a new controller to change modes. Collapse is explicit and does not auto-restore.

Placement defaults to the viewport bottom. `placement: { mode: "container" }` positions relative to the host-provided positioned mount container; `mode: "fullscreen"` positions inside the host's fullscreen root, which the host enters and exits through the Fullscreen API. Narrow action rows retain native horizontal scrolling and expose labeled start/end scroll buttons only when content overflows.

Feature flags and configuration diagnostics are draft contracts. Recognizing a feature flag does not mean that the feature module is implemented or activated. See the repository [implementation status](../../docs/engineering/implementation-status.md) and [SDK/schema contract](../../docs/contracts/sdk-and-schema.md).
