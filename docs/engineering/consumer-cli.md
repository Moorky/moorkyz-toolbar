# Optional public consumer CLI and local project generator

M9 implementation is an unapproved draft contract, not release authorization.
The optional consumer binary is `moorkyz-toolbar`, distinct from the repository's
internal `moorkyz start|stop|help` workflow. It has no new dependencies and never
installs packages, fetches templates, sends telemetry, or modifies another repository.

## Supported scope

The shared browser-safe `generateProject` API creates deterministic, independently
runnable **vanilla JavaScript** projects. Universal, website, dashboard, editor, and
game presets supply demo actions only: they never change optional feature defaults.
Explicit configuration overrides pass through the SDK's `validateConfiguration`.
Actions remain host-owned; generated demo handlers only update local status text.
React/Next.js/Vue/Angular generation is rejected rather than advertised as tested.
The optional React adapter exists separately; a browser-ready React starter
toolchain has not been validated by this generator.

Generation returns UTF-8 files and `moorkyz.manifest.json`, containing generator,
template, SDK and schema versions, source origin (`cli` or `studio`), project
metadata, normalized configuration/flags, SHA-256 integrity for every other generated
file, and explicit developer ownership/migration policy. There are no timestamps,
absolute machine paths, credentials, adapter instances, or executable callbacks.
Non-data objects, accessors, symbols, `toJSON`, unknown options/configuration keys,
and callbacks are rejected without execution. Configuration labels are ordinary
exportable text: callers must not put secrets in labels. Integrity detects edits;
it is not a signature or authorization for untrusted manifests.

Studio calls `await generateProject({ name, preset, configuration, origin: "studio" })`
from the generator subpath and offers the returned files for explicit local download.
Generation itself has no filesystem access or side effects. SHA-256 requires Web
Crypto in a secure browser context (including localhost); no Node import is needed.

## Commands

Run the repository implementation with
`node packages\toolbar\cli\moorkyz-toolbar.mjs help` after building the SDK.
After package bin wiring, the same commands are available as `moorkyz-toolbar`:

```text
moorkyz-toolbar init my-app --preset website --dry-run --json
moorkyz-toolbar init my-app --preset website --config toolbar.json
moorkyz-toolbar add existing-app --directory toolbar-starter
moorkyz-toolbar validate my-app/toolbar.config.json --json
moorkyz-toolbar doctor my-app --json
moorkyz-toolbar examples --json
moorkyz-toolbar upgrade my-app --json
moorkyz-toolbar upgrade my-app --apply --json
moorkyz-toolbar version
moorkyz-toolbar help
```

`init` requires a new destination whose parent already exists. `add` creates a new,
isolated child starter under an existing directory; it **does not** edit host source,
package metadata, lockfiles, dependencies, or framework wiring. `--name`, `--preset`,
`--config`, `--framework vanilla`, and `--dry-run` apply to both commands.
`--directory` applies only to `add`, defaults to `toolbar-starter`, and must be a
single portable name. Invalid/unsupported flags are errors, not silently ignored.

All commands support `--json` and `--non-interactive`; none ever prompt.
`--help`/`--version` are aliases for their commands. Exit status is `0` for success
(including a read-only upgrade preview with reported conflicts), `1` for validation,
integrity or filesystem failures, and `2` for usage errors. JSON mode produces
exactly one result on stdout, including errors, with `ok` and stable diagnostic
codes. Non-JSON errors go to stderr. Malformed input contents are not echoed.
Doctor performs local structural/runtime checks only, not a security, accessibility,
permission, production readiness, or external dependency certification.

## Offline/local starter workflow

Requires Node.js 22.18+ and a modern browser with ES modules and import maps.
Generation writes no `node_modules` or lockfile and performs no install.
From inside a generated project, use an already built SDK checkout:

```text
node server.mjs --sdk-path C:\work\moorkyz-toolbar\packages\toolbar
```

The server binds only to `127.0.0.1:4173` (`--port 0` selects an ephemeral port).
It serves the local SDK's compiled browser modules and CSS without a CDN or
bundler. Alternatively, when the declared SDK dependency is already installed,
`npm start` resolves that installed package. Choosing to install dependencies
later is a separate explicit package-manager action. The generated server is a
development helper, not a production server or deployment configuration.

`toolbar.config.js` is the runtime configuration; `toolbar.config.json` is its
original portable validation snapshot. They are intentionally static files,
not an implicit regeneration workflow: developers keep them in sync after edits.
No generated source includes host credentials or serialized adapter callbacks.
Optional flags do not install, authorize, or configure host integrations.

## No-overwrite and upgrades

CLI inputs/destinations must remain inside its current working directory. Traversal
segments, symlinks/junctions (including ancestors), unsafe filenames, hard-linked
input files, and malformed manifests fail closed. A symlinked checkout should be
entered by its real path. Initial generation preflights the complete file set,
rejects any preexisting destination (even empty), and uses exclusive creates.
Cleanup only removes unchanged files created by that invocation.

`upgrade` is a preview by default, reporting full-file diffs for pristine owned
files and paths/reasons for edited or missing files. It never prints edited source
contents. `--dry-run` is explicit preview; combining it with `--apply` is an error.
There is no force/overwrite option. Any missing/edited owned file blocks the whole
apply; the developer must reconcile manually. Unsupported/newer versions or
schema migrations are rejected rather than guessed.

An explicit `--apply` rechecks all source integrity, stages replacements exclusively,
moves pristine originals into a new `.moorkyz-upgrade-<id>` backup directory, and
links replacements into empty destinations without clobbering new collisions.
Failed applies restore originals where safe and retain recovery material.
Successful backups remain for manual review/rollback: inspect `changes` order
against `old-0`, `old-1`, etc., and restore only after checking subsequent edits.
No-op applies create nothing. No source is treated as generator-owned after its
recorded hash changes. There is no automatic deletion or permission escalation.

This is a local developer tool, not a filesystem sandbox. Use trusted local
directories without concurrently running editors/generators or hostile filesystem
writers. Node's portable filesystem APIs cannot atomically lock every ancestor or
provide a cross-process directory-descriptor transaction. Backups are not automatically
pruned, and a process/power failure may require manual recovery from them.

## Package integration boundary

The parent integration must expose the shared generator from the browser-safe
`./generator` subpath (and optionally the main barrel), add the `moorkyz-toolbar`
bin pointing at `cli/moorkyz-toolbar.mjs`, include `cli` in the package file allowlist,
and ensure publication keeps compiled `dist/generator.js` and `dist/configuration.js`.
Never export/import the CLI from a browser entry or compile it into the browser
graph. Keep `GENERATOR_SDK_VERSION` aligned with package version during intentional
version bumps. The CLI directory should be included in lint/packaging verification.
