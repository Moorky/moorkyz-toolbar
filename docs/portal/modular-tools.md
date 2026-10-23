# Modular tools portal

## Approved scope

On 2026-10-23 the user requested a growing tool catalog, complete VideoCrunch
integration, common detail pages, and the live moorkyz.com footer. Follow-up
approval selected a **local web service**, with public hosting, authentication,
multi-user workers and infrastructure off. The live site had no discoverable
footer game; the user explicitly selected its current footer without a game
until a reference is supplied.

The homepage is the catalog. `/tools/toolbar` and `/tools/videocrunch` provide
Title, Release Date, Updated On, Description, Use Cases and Setup. Local script
tools additionally show **Tool immediately after Description**: a file hierarchy,
selectable console-style source, copy/download per file and a complete ZIP.
Neither tool claims a public release date; the integration date is not a release.
The existing SDK experience is preserved at `/tools/toolbar/playground`, and the
Studio remains at `/studio`. Existing external root fragment links need to be
updated to the Playground route; the catalog intentionally replaces the old home.

## Adding tools

1. Register an entry in
   [`tools.ts`](../../packages/portal/src/data/tools.ts). The catalog, detail
   metadata, use cases, setup and local search derive from this registry.
2. For source-based tools, place only distributable source under `tools/<slug>`
   and add an explicit `tools/<slug>.files.json` allowlist. Register the bundle in
   [`prepare-tool-sources.mjs`](../../scripts/prepare-tool-sources.mjs) and
   reference its name/files in the tool definition. Never include local state,
   downloaded files, credentials, Git internals, caches or dependencies.
3. Add a workspace integration only when needed. Metadata-only tools can use the
   shared detail layout; executable workspaces need their own explicit rendering
   branch and authority boundary, rather than executing manifest-supplied code.
4. Add route, accessibility, disabled-path and actual-workspace tests. Update
   `updatedOn` deliberately when the tool changes.

Development and production builds prepare source JSON and deterministic,
uncompressed ZIP files from original bytes. Generated assets are ignored by Git
and copied into the standalone portal's public assets. Selecting a file fetches
only the first-party source bundle; the viewer renders source as text and never
executes it. Clipboard/download failures remain visible and source stays
selectable. A future distribution license must be settled before distributing
VideoCrunch: its original no-selected-license notice is retained and the
Toolbar's Apache-2.0 license must not be assumed to relicense it.

## VideoCrunch localhost service

The complete tracked source from the provided VideoExports project is imported
under [`tools/videocrunch`](../../tools/videocrunch/), without modifying that
external repository. Its exporter, request token, single-job concurrency,
history, original-byte preservation, path allowlists, range responses and fixed
PowerShell invocation are retained. Relative frontend URLs support both the
original standalone app and its portal mount.

On Windows with Node.js 22+, Windows PowerShell 5.1, yt-dlp and FFmpeg installed:

```powershell
# Terminal 1, repository root:
pnpm tool:videocrunch
# Terminal 2, repository root:
$env:MOORKYZ_VIDEOCRUNCH_ENABLED = "1"
pnpm --filter @moorkyz/portal dev --hostname 127.0.0.1
```

For explicit prerequisite bootstrapping, run
`.\tools\videocrunch\Start-WebVideoCrunch.cmd` instead of Terminal 1.
It can install missing native tools through winget; the portal never installs
anything. Missing tools and failed exports are visible in the native workspace.

The portal gateway `/api/local-tools/videocrunch/...` is off unless
`MOORKYZ_VIDEOCRUNCH_ENABLED=1`. The user must also open the workspace before it
connects or polls. Closing/unmounting the iframe stops its frontend work; an
accepted export continues in the independent service. Reconnection errors are
reported with an explicit retry control.

The upstream target is always `127.0.0.1`, default port 8765. If the native service
uses `--port`, set `MOORKYZ_VIDEOCRUNCH_PORT` to the same valid port in the portal
terminal. The gateway rejects non-loopback Host, mismatched Origin, cross-site
requests, unlisted resources/methods, and oversized job bodies. It forwards only
content type, the process-local job token and byte ranges, never credentials or
cookies. Redirects are refused; unavailable upstreams return explicit 502 errors.
Range/stream/download responses are preserved. Native iframe policy allows
same-origin embedding and its existing inline styles; the portal's nonce-based
CSP remains unchanged.

**Not a hosted service:** do not expose either process publicly or reverse-proxy
the connection. Host checks are defense in depth, not multi-user authentication.
There are no accounts, tenant isolation, remote workers, quotas or hosted storage.
The source viewer and setup page remain available when the gateway is off.

## Verification

```powershell
pnpm build
node --test tests\tooling\tools-catalog.test.js tests\tooling\videocrunch-proxy.test.js tests\tooling\download-json.test.js
pnpm exec playwright test 'tools\.spec\.js|website\.spec\.js' --workers=3
pnpm test:videocrunch
pnpm test:videocrunch:browser
```

The separate real-service browser configuration uses isolated synthetic media,
temporary exports/history and loopback fixture ports 8876/8877, with explicit
teardown. It requires the Windows/native prerequisites and runs serially; it is
not a mandatory dependency of the framework-neutral library or standard browser
suite. No third-party video is downloaded for verification.
