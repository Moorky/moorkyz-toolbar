"use client";

import { useEffect, useState, type ReactNode } from "react";

export function HydrationBoundary({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <fieldset
      className="studio-hydration-boundary"
      disabled={!ready}
      inert={!ready}
      aria-busy={!ready}
    >
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  );
}
