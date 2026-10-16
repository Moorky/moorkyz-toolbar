import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  fileURLToPath(new URL("../../", import.meta.url)),
);
const packageRoot = resolve(repositoryRoot, "packages/toolbar/dist");
const fixtureRoot = resolve(repositoryRoot, "tests/browser/fixtures");
const packageFiles = new Map([
  ["/toolbar/ai.js", "ai.js"],
  ["/toolbar/index.js", "index.js"],
  ["/toolbar/capabilities.js", "capabilities.js"],
  ["/toolbar/commands.js", "commands.js"],
  ["/toolbar/configuration.js", "configuration.js"],
  ["/toolbar/context.js", "context.js"],
  ["/toolbar/diagnostics.js", "diagnostics.js"],
  ["/toolbar/input.js", "input.js"],
  ["/toolbar/input.js", "input.js"],
  ["/toolbar/lifecycle.js", "lifecycle.js"],
  ["/toolbar/notifications.js", "notifications.js"],
  ["/toolbar/offline.js", "offline.js"],
  ["/toolbar/preferences.js", "preferences.js"],
  ["/toolbar/search.js", "search.js"],
  ["/toolbar/spatial.js", "spatial.js"],
  ["/toolbar/surfaces.js", "surfaces.js"],
  ["/toolbar/tasks.js", "tasks.js"],
  ["/toolbar/themes.js", "themes.js"],
  ["/toolbar/toolbar.js", "toolbar.js"],
  ["/toolbar/toolbar.css", "toolbar.css"],
]);
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);
const policy =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  if (path === "/health") {
    response.writeHead(204).end();
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405).end();
    return;
  }

  let file;
  if (path === "/") {
    file = resolve(fixtureRoot, "index.html");
  } else if (path === "/fixture.js") {
    file = resolve(fixtureRoot, "fixture.js");
  } else if (path === "/fixture.css") {
    file = resolve(fixtureRoot, "fixture.css");
  } else if (packageFiles.has(path)) {
    file = resolve(packageRoot, packageFiles.get(path));
  } else {
    response.writeHead(404).end();
    return;
  }

  try {
    const body = await readFile(file);
    const extension = file.slice(file.lastIndexOf("."));
    response.writeHead(200, {
      "Content-Security-Policy": policy,
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500).end("Fixture asset unavailable.");
    process.stderr.write(`${String(error)}\n`);
  }
});

server.listen(4173, "127.0.0.1");
