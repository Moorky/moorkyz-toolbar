/** @typedef {{ label: string, href: string }} ToolbarLink */
/** @typedef {{ items: ToolbarLink[], theme: "light" | "dark", position: "top" | "bottom", accent: string }} ToolbarSettings */

function escape(value) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

/** @param {ToolbarSettings} input */
export function buildToolbar(input) {
  if (
    !input ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 8 ||
    !["light", "dark"].includes(input.theme) ||
    !["top", "bottom"].includes(input.position) ||
    typeof input.accent !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(input.accent)
  ) {
    throw new Error(
      "Use 1-8 links, a light/dark theme, top/bottom position and a six-digit accent color.",
    );
  }
  const items = input.items.map((item) => {
    if (
      !item ||
      typeof item.label !== "string" ||
      !item.label.trim() ||
      item.label.length > 40 ||
      typeof item.href !== "string" ||
      item.href.length === 0 ||
      item.href.length > 512 ||
      /[\x00-\x20\\]/.test(item.href)
    )
      throw new Error(
        "Each link needs a label (1-40 characters) and a URL (1-512 characters, no spaces/backslashes).",
      );
    if (
      !/^#[\w-]+$/.test(item.href) &&
      !(item.href.startsWith("/") && !item.href.startsWith("//"))
    ) {
      let url;
      try {
        url = new URL(item.href);
      } catch {
        throw new Error("Use a #section, /local-path or HTTP(S) link.");
      }
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error(
          "Only HTTP(S) links without embedded credentials are allowed.",
        );
    }
    return { label: item.label.trim(), href: item.href };
  });
  const background = input.theme === "dark" ? "#15121c" : "#ffffff";
  const ink = input.theme === "dark" ? "#f7f4fc" : "#201b2b";
  const css = `.tiny-toolbar{position:fixed;${input.position}:1rem;left:50%;transform:translateX(-50%);display:flex;gap:.35rem;max-width:calc(100% - 2rem);padding:.4rem;overflow-x:auto;background:${background};color:${ink};border:1px solid ${input.accent};border-radius:.8rem;box-shadow:0 6px 24px #0002;font:14px/1.4 system-ui,sans-serif}.tiny-toolbar a{flex:0 0 auto;display:inline-flex;align-items:center;min-height:44px;padding:.4rem .8rem;border-radius:.45rem;color:inherit;text-decoration:none}.tiny-toolbar a:hover{background:${input.theme === "dark" ? "#ffffff15" : "#0000000a"}}.tiny-toolbar a:focus-visible{outline:3px solid currentColor;outline-offset:-3px}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`;
  const html = `<!doctype html>\n<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your toolbar</title><style>${css}.toolbar-example{margin:6rem 1rem;font:16px/1.5 system-ui,sans-serif}</style><body><main class="toolbar-example" id="home"><h1>Your toolbar</h1><p>Replace the example links with your page sections or destinations.</p></main><nav class="tiny-toolbar" aria-label="Custom toolbar">${items.map((item) => `<a href="${escape(item.href)}">${escape(item.label)}</a>`).join("")}</nav></body></html>\n`;
  if (new TextEncoder().encode(html).length > 8192)
    throw new Error(
      "Generated toolbar exceeds 8 KiB. Shorten the links or labels.",
    );
  return { html, css, config: { ...input, items } };
}
