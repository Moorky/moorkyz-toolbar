# Engineering guidelines

- Prefer built-in Node APIs and small explicit functions over frameworks, build systems, and runtime dependencies.
- Remain compatible with Node.js 22 and Windows PowerShell 5.1. Use `-LiteralPath` for user-derived PowerShell filesystem paths.
- Separate URL paths from Windows filesystem paths. Never pass user values through a shell-generated command string.
- One active export at a time; reject conflicts explicitly rather than accidentally running concurrent encoders.
- Downloaded originals are immutable bytes. Stage attempts separately, move the completed file without transcoding, and record SHA-256 and exact sizes.
- Gate all success states on process exit and real output files/manifest. Warn for optional retrieval failures; fail explicitly for missing required media.
- Keep served files allowlisted and realpath-contained. Never serve arbitrary captured website HTML.
- Keep loops bounded where appropriate, stream media, support byte ranges, and cap in-memory logs.
- Preserve local-first defaults, no telemetry, and no externally loaded frontend assets.
- Add targeted regressions and related docs with every behavior change. Use [the testing guide](../docs/TESTING.md).
