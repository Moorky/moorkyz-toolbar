# Moorkyz Tools

A growing catalog of independent tools, with clear setup, readable source and
local-first workspaces. The former toolbar SDK and Studio have been removed;
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
pnpm --filter @moorkyz/portal dev --hostname 127.0.0.1
pnpm build
pnpm check
pnpm check:source
```

Use Node.js 22+ and the pinned pnpm version. Browser tests use installed
Chromium/Firefox/WebKit; `pnpm exec playwright install` prepares them for development.

## Explicit local services

```powershell
# Independent terminals, only for tools you want to run:
pnpm tool:videocrunch
pnpm tool:directory-cleaner
# Portal terminal:
$env:MOORKYZ_VIDEOCRUNCH_ENABLED = "1"
$env:MOORKYZ_DIRECTORY_CLEANER_ENABLED = "1"
pnpm --filter @moorkyz/portal dev --hostname 127.0.0.1
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
