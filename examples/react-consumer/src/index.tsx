import { useMemo } from "react";
import type { ToolbarConfigurationInput, ToolbarHost } from "@moorkyz/toolbar";
import { ToolbarMount as ReactToolbarMount } from "@moorkyz/toolbar/react";

interface ToolbarMountProps {
  readonly dispatchAction: (actionId: string) => void | Promise<void>;
}

export function ToolbarMount({ dispatchAction }: ToolbarMountProps) {
  const configuration = useMemo<ToolbarConfigurationInput>(
    () => ({ actions: [{ id: "home", label: "Home" }] }),
    [],
  );
  const host = useMemo<ToolbarHost>(
    () => ({ dispatchAction }),
    [dispatchAction],
  );

  return <ReactToolbarMount configuration={configuration} host={host} />;
}
