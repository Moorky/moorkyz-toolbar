# Moorkyz CLI for Local Repository Work

The repository includes a dependency-free Node.js helper for local project lifecycle, package scripts, and task-audit file creation. It is maintainer tooling, not the future public `moorkyz-toolbar` consumer CLI.

## Commands available now

From the repository root in PowerShell:

```powershell
.\moorkyz.cmd help
.\moorkyz.cmd doctor
.\moorkyz.cmd audit "task title"
```

On macOS/Linux, use `sh ./moorkyz`. The `audit` command creates an unfilled report from `docs/audits/TEMPLATE.md`; fill in observed evidence before considering the task complete.

## Commands gated on future scaffolding

The CLI also supports local `start`, `stop`, `restart`, `status`, `logs`, `verify`, `build`, `test`, `lint`, `typecheck`, `security`, and `run` commands. Lifecycle and package-check commands require a root `package.json` containing the requested scripts. This specification repository currently has no package manifest, so those commands are not yet usable here.

Do not add a sample multi-app configuration until the actual workspace paths and scripts are approved and present. Without `moorkyz.config.json`, the helper assumes one package at the repository root.

## Safety

- Run commands from the intended repository root. The helper operates on the current working directory.
- It does not install packages, modify package manifests, deploy, publish, or commit.
- Managed process state and logs live in `.moorkyz/`, which is ignored by `.gitignore`. The helper will stop only verified processes it started; inspect an unverified stale state instead of deleting it blindly.
- `start --prod` runs an existing local production script; it is not deployment.
- No global PowerShell profile installer is included. Use the explicit repository-local launcher.
- `security` is a read-only package advisory check when a compatible package manifest and package manager are available; it does not prove dependencies safe or update them.
