"use client";

import { createElement, useEffect, useRef } from "react";
import type { HTMLAttributes } from "react";
import type { ToolbarConfigurationInput } from "./configuration.js";
import {
  createToolbar,
  type ToolbarController,
  type ToolbarHost,
} from "./toolbar.js";

const EMPTY_CONFIGURATION: ToolbarConfigurationInput = Object.freeze({});
const EMPTY_HOST: ToolbarHost = Object.freeze({});

export interface ToolbarMountProps extends HTMLAttributes<HTMLDivElement> {
  readonly configuration?: ToolbarConfigurationInput;
  readonly host?: ToolbarHost;
  readonly onController?: (controller: ToolbarController | null) => void;
}

export function ToolbarMount({
  configuration = EMPTY_CONFIGURATION,
  host = EMPTY_HOST,
  onController,
  ...containerProps
}: ToolbarMountProps) {
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mountTarget = target.current;
    if (mountTarget === null) return;

    const controller = createToolbar(configuration, host);
    const result = controller.mount(mountTarget);
    if (!result.ok) {
      controller.dispose();
      throw new Error(result.error.message, { cause: result.error });
    }

    try {
      onController?.(controller);
    } catch (cause) {
      controller.dispose();
      throw cause;
    }

    return () => {
      try {
        controller.dispose();
      } finally {
        onController?.(null);
      }
    };
  }, [configuration, host, onController]);

  return createElement("div", { ...containerProps, ref: target });
}
