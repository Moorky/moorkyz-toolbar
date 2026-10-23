# tools.moorkyz.com

A growing catalog of independent tools, with clear setup, readable source and
local-first workspaces. The former SDK and Studio have been removed;
the **Toolbar Builder** is now a small standalone HTML generator, not a framework.

## Tools

- **Toolbar Builder** - compact link editor, live preview, Copy and one-file HTML
  download. No SDK, adapters, service or installation required for the output.
- **VideoCrunch** - optional Windows localhost video downloader/compressor;
  original source bytes remain preserved. Its complete source is included.
- **Directory Cleaner** - filename/relative-path patterns, creation-date bounds
  and file-size thresholds; Keep, Move and Delete (archive only). Available as a
  local service and a standalone script. Preview, then explicitly confirm changes.

Every local script tool has a source hierarchy, console-style viewer, per-file
Copy/Download and a complete ZIP. See the [portal guide](docs/portal/modular-tools.md)
and [Directory Cleaner guide](tools/directory-cleaner/README.md).

## Development

```powershell
pnpm install --frozen-lockfile
pnpm --filter @tools.moorkyz.com/portal dev --hostname 127.0.0.1
pnpm build
pnpm check
pnpm check:source
```

Use Node.js 22+ and the pinned pnpm version. Browser tests use installed
Chromium/Firefox/WebKit; `pnpm exec playwright install` prepares them for development.

Repository management uses `.\tools.moorkyz.com.cmd help` on Windows or
`sh ./tools.moorkyz.com help` on macOS/Linux. See the
[CLI guide](docs/engineering/tools.moorkyz.com-cli.md). The workspace package is
`tools.moorkyz.com`; the portal package is `@tools.moorkyz.com/portal`.

Project links target [Moorky/tools.moorkyz.com](https://github.com/Moorky/tools.moorkyz.com).
The GitHub repository, local checkout/remote, DNS and hosting configuration need
separate updates; this local rename does not modify them. See the
[deployment guide](docs/deployment/coolify.md).

## Explicit local services

```powershell
# Independent terminals, only for tools you want to run:
pnpm tool:videocrunch
pnpm tool:directory-cleaner
# Portal terminal:
$env:TOOLS_MOORKYZ_COM_VIDEOCRUNCH_ENABLED = "1"
$env:TOOLS_MOORKYZ_COM_DIRECTORY_CLEANER_ENABLED = "1"
pnpm --filter @tools.moorkyz.com/portal dev --hostname 127.0.0.1
```

Both connections are **off by default**. Nothing is installed or started by
opening a tool page. Do not expose either native service publicly or reverse-proxy
its operations. No accounts, tenant isolation, hosted storage or telemetry.

## Governance

[AGENTS.md](AGENTS.md), [decisions](docs/decisions/decision-register.md) and
[testing](docs/engineering/testing.md) describe current behavior. Old specifications
remain in Git history; [audits](docs/audits/) remain historical evidence.
No publishing or deployment is authorized by local verification.

The root [Apache-2.0 license](LICENSE) covers first-party project code. The
imported VideoCrunch application's original no-selected-distribution-license
notice remains separate; do not assume it was relicensed. Self-hosted fonts
retain their SIL OFL notices.
