import { useEffect, useRef } from "react";
import { createToolbar } from "@moorkyz/toolbar";

interface ToolbarMountProps {
  readonly dispatchAction: (actionId: string) => void | Promise<void>;
}

export function ToolbarMount({ dispatchAction }: ToolbarMountProps) {
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (target.current === null) return;
    const toolbar = createToolbar(
      { actions: [{ id: "home", label: "Home" }] },
      { dispatchAction },
    );
    const mounted = toolbar.mount(target.current);
    if (!mounted.ok) {
      toolbar.dispose();
      throw new Error(mounted.error.message);
    }
    return () => toolbar.dispose();
  }, [dispatchAction]);

  return <div ref={target} />;
}
