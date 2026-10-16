"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copy code",
}: {
  readonly text: string;
  readonly label?: string;
}) {
  const [message, setMessage] = useState("");

  async function copyText() {
    if (navigator.clipboard === undefined) {
      setMessage("Copy is unavailable in this browser context.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <span className="copy-control">
      <button className="copy-button" type="button" onClick={copyText}>
        {label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
