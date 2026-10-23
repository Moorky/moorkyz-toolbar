"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./portal-shell";
import { PortalSearch } from "./portal-search";

export function SiteHeader({
  homePath = "/tools/toolbar/playground",
}: {
  readonly homePath?: string;
}) {
  const header = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let previous = window.scrollY;
    function onScroll() {
      const current = window.scrollY;
      if (Math.abs(current - previous) < 8) return;
      setHidden(
        current > previous &&
          current > 96 &&
          !header.current?.contains(document.activeElement),
      );
      previous = current;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={header}
      className="site-header adaptive-header"
      data-hidden={hidden}
      onFocusCapture={() => setHidden(false)}
    >
      <a className="brand" href="/#home">
        <img
          className="header-logo"
          src="/moorkyz-toolbar-logo.png"
          width={112}
          height={56}
          alt=""
        />
        <span>
          <strong>moorkyz</strong> <span className="brand-product">tools</span>
        </span>
      </a>
      <nav className="header-links" aria-label="Main navigation">
        <a href="/#tools">Tools</a>
        <a href={`${homePath}#playground`}>Playground</a>
        <a className="header-aux-link" href="/studio">
          Studio
        </a>
        <a href={`${homePath}#docs`}>Docs</a>
        <a
          href="https://github.com/Moorky/moorkyz-toolbar"
          className="header-aux-link"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <PortalSearch />
        <ThemeToggle />
      </nav>
    </header>
  );
}
