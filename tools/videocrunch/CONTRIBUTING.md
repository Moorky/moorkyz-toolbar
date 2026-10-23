# Contributing

## Setup and conventions

Use Windows, Node.js 22+, Windows PowerShell 5.1, yt-dlp, and FFmpeg/ffprobe. Launch the app once to bootstrap its runtime tools. Git and Pester are development requirements, not end-user startup requirements.

There is no frontend build step and no npm runtime dependency installation. `npm ci` installs the development-only Playwright browser runner; normal application users do not need it. Keep the code small: built-in Node HTTP/file/process APIs, plain HTML/CSS/JavaScript, and PowerShell. Read [architecture](docs/ARCHITECTURE.md), [engineering guidelines](guidelines/ENGINEERING.md), and [design guidelines](guidelines/DESIGN.md).

## Change workflow

1. Describe the intended behavior and compatibility impact. Use [the idea template](ideas/IDEA-TEMPLATE.md) for larger proposals.
2. Make focused changes. Never overwrite originals or silently turn failures into success.
3. Update directly affected documentation and the changelog.
4. Run `.\tools\Verify.ps1`; use `-Media` for export/encoding changes and `-Browser` for interface/process-integration changes.
5. Run `.\tools\Audit.ps1` and the [manual checklist](guidelines/AUDITING.md).
6. Record actual audit scope, commands, results, and limitations in a dated file under `audits/`.
7. Inspect staged content and ignore rules. Commit only after passing checks; do not include media, secrets, temporary logs, or local state.

The audit's credential scan is intentionally limited and is not a substitute for manual review. Do not publish an exploit or sensitive token in a public issue.

## Pull requests and commits

Use a concise imperative commit title and explain meaningful behavior shifts. Include test evidence and known limitations in PRs. A hosted remote, CI provider, release license, and maintainer identities must be configured by the owner rather than fabricated.

## First-run testing

On a disposable Windows VM, verify the launcher with no Node.js/yt-dlp/FFmpeg installed. Confirm winget prompts, PATH refresh, browser opening, second launch without reinstalling, and clear failures for offline/managed PCs. Do not uninstall tools from a shared developer workstation merely to simulate first use.
