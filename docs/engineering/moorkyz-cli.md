# Moorkyz CLI for Local Repository Work

The repository includes a dependency-free Node.js helper for local project lifecycle, package scripts, and task-audit file creation. It is maintainer tooling, not the future public `moorkyz-toolbar` consumer CLI.

## Commands available now

From the repository root in PowerShell:

```powershell
.\moorkyz.cmd help
.\moorkyz.cmd doctor
.\moorkyz.cmd start
.\moorkyz.cmd status
.\moorkyz.cmd logs
.\moorkyz.cmd stop
.\moorkyz.cmd audit "task title"
```

On macOS/Linux, use `sh ./moorkyz`. The `audit` command creates an unfilled report from `docs/audits/TEMPLATE.md`; fill in observed evidence before considering the task complete.

`moorkyz.config.json` selects `packages/portal` as the default project, using its `dev` script for `start` and its `start` script for `start --prod`. The portal is served at `http://localhost:3000` by default. The production command requires a prior portal build.

The CLI also supports `restart`, `verify`, `build`, `test`, `lint`, `typecheck`, `security`, and `run`. Package-check commands require the selected package to define the requested script.

The workspace configuration is intentionally scoped to the portal. Use the named-project argument only if further projects are later added to this configuration.

## Safety

- Run commands from the intended repository root. The helper operates on the current working directory.
- It does not install packages, modify package manifests, deploy, publish, or commit.
- Managed process state and logs live in `.moorkyz/`, which is ignored by `.gitignore`. The helper will stop only verified processes it started; inspect an unverified stale state instead of deleting it blindly.
- `start --prod` runs an existing local production script; it is not deployment.
- No global PowerShell profile installer is included. Use the explicit repository-local launcher.
- `security` is a read-only package advisory check when a compatible package manifest and package manager are available; it does not prove dependencies safe or update them.
