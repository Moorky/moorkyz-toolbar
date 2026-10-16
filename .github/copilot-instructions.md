# Moorkyz Toolbar — Copilot Instructions

The root [`AGENTS.md`](../AGENTS.md) is the authoritative project contract. Before implementation, inspect it and the relevant decision/specification documents; do not assume this draft repository has application scaffolding, package scripts, or approved public contracts.

## Required working practice

- Follow the source-of-truth order and approval boundaries in `AGENTS.md`.
- Keep changes scoped, preserve approved behavior, and do not introduce a framework, dependency, or public API based on preference.
- Validate using commands that actually exist. Report `PASS`, `FAIL`, `NOT RUN`, or `N/A` accurately; proposed pnpm commands are not usable until implemented.
- For every file-changing agent task, add a filled, task-specific report under `docs/audits/` using `docs/audits/TEMPLATE.md`. Record exact verification evidence, residual risks, and incomplete work.
- After applicable checks pass, create one focused local commit for the task and its audit when repository state permits. Stage only task-owned paths. Do not commit unrelated work or push, merge, publish, deploy, sign, or integrate into another Moorkyz project without separate authorization.
- If the worktree has no commit baseline or contains user-owned untracked changes that prevent a safe scoped commit, preserve them and report the specific blocker; do not initialize Git or stage the entire repository to force a commit.

## Project-specific guardrails

- This is a draft specification for one reusable toolbar package and its portal. Approved decisions and contracts outrank implementation convenience.
- Keep the default core framework-neutral, SSR-safe, accessible, local-first, and free of automatic network activity.
- Optional features must remain inactive and resource-free while disabled; spatial coordination remains off by default.
- The host retains command, navigation, authentication, authorization, and privileged-operation authority.
- Do not introduce telemetry, behavior learning, release automation, or external integration by default.

Read the linked engineering documents from `AGENTS.md` for workflow, coding, testing, security, dependency, and local CLI details. Avoid copying the site repository's Next.js choices or deployment automation into this project.
