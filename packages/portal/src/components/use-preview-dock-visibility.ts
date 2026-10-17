"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Geometry } from "./playground-design";

export function usePreviewDockVisibility(
  canvas: RefObject<HTMLElement | null>,
  geometry: Geometry,
  fullscreen: boolean,
) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (geometry.position !== "bottom") return;
    const root = canvas.current;
    const footer = root?.querySelector<HTMLElement>(".playground-toolbar");
    const stage = root?.querySelector<HTMLElement>(".playground-stage");
    if (!root || !footer || !stage) return;
    let frame: number | null = null;

    const refresh = () => {
      const toolbar = footer.querySelector<HTMLElement>('[role="toolbar"]');
      if (!toolbar) {
        setVisible(false);
        return;
      }
      const bounds = toolbar.getBoundingClientRect();
      const application = root.getBoundingClientRect();
      const content = stage.getBoundingClientRect();
      const navigation = fullscreen
        ? null
        : document
            .querySelector('.toolbar-mount [role="toolbar"]')
            ?.getBoundingClientRect();
      const bottom = Math.min(
        innerHeight,
        application.bottom,
        content.bottom,
        navigation ? navigation.top - 8 : innerHeight,
      );
      setVisible(
        bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.top >= Math.max(0, application.top, content.top) - 1 &&
          bounds.bottom <= bottom + 1 &&
          bounds.left >= Math.max(0, application.left) - 1 &&
          bounds.right <= Math.min(innerWidth, application.right) + 1,
      );
    };
    function queueRefresh() {
      if (frame === null)
        frame = requestAnimationFrame(() => {
          frame = null;
          refresh();
        });
    }
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(queueRefresh);
    resize?.observe(document.documentElement);
    resize?.observe(footer);
    resize?.observe(stage);
    const changes = new MutationObserver(queueRefresh);
    changes.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", queueRefresh, { passive: true });
    window.addEventListener("scroll", queueRefresh, { passive: true });
    document.addEventListener("visibilitychange", refresh);
    root.addEventListener("load", queueRefresh, true);
    refresh();
    return () => {
      resize?.disconnect();
      changes.disconnect();
      window.removeEventListener("resize", queueRefresh);
      window.removeEventListener("scroll", queueRefresh);
      document.removeEventListener("visibilitychange", refresh);
      root.removeEventListener("load", queueRefresh, true);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [
    canvas,
    fullscreen,
    geometry.position,
    geometry.width,
    geometry.height,
    geometry.offsetX,
    geometry.offsetY,
    geometry.gap,
    geometry.radius,
    geometry.align,
  ]);

  return { visible: geometry.position === "top" || visible, sticky: true };
}
