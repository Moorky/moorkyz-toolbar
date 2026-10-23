# Repository operations and deployment audit

| Field | Value |
| --- | --- |
| Project | Moorkyz Tools |
| Date | 2026-10-23 |
| Reviewer | Codex web-projects with shared CLI and client reviewers (self-audit) |
| Branch / baseline | `master` / `2e33aa8922c0d6970a63cc4d757aba4adacb4718` |
| Outcome | PASS WITH EXTERNAL VERIFICATION PENDING |
| Commit | Parent integration owns commits and external changes; this subtask did not commit/push/deploy. |

## Request and implemented behavior

Unified the current repository/package identity as moorkyz-tools and @moorkyz-tools/portal while retaining tools.moorkyz.com as the public hostname. Updated repository links, command filters and identity assertions; preserved generic Toolbar Builder terminology. Hardened action references, timeouts, container-gated deployment and stale-commit detection. Added Dependabot coverage, ignored runtime directories, root docs/audits/HTML entry points and shared CLI app configuration. Identity validation continues to reject retired product identifiers while allowing the common moorkyz command and state directory.

All projects retain stack-appropriate lockfiles and build boundaries. Local `trash/`, `logs/`, `archive/` and `.moorkyz/` exist, are ignored by Git, and are excluded from Docker build contexts. Both requested `READM.html` and conventional `README.html` provide offline entry points. Root `docs/`, `audits/`, `README.md`, editor configuration and security guidance are present.

## Verification

| Check | Result | Exact command / method | Evidence |
| --- | --- | --- | --- |
| Full application gate | PASS | `pnpm check` | Lint, formatting, production build, 47 Node tests, 21 browser tests across Chromium/Firefox/WebKit and portal type checks passed. |
| Real local Directory Cleaner browser gate | PASS | `pnpm test:directory-cleaner:browser` | 6 browser tests across Chromium/Firefox/WebKit passed, including stale-plan rejection and archive-byte preservation in isolated fixtures. |
| Source scan | PASS | `pnpm check:source` | Selected credential and forbidden HTML/eval sink scan passed; this is bounded evidence, not a complete security audit. |
| Dependency audit | PASS | `pnpm audit --audit-level=low` | No known vulnerabilities reported. |
| Final identity/format checks | PASS | `node --test tests/tooling/project-identity.test.js`, `pnpm format:check` | Three identity tests passed after shared CLI distribution; repository formatting passed. |
| Shared storage and deployment client | PASS | `node --test tests/tooling/moorkyz-runtime.node.cjs scripts/deploy-coolify.test.cjs` | 18 storage/runtime + 5 deployment tests; timestamp/calendar validation, ZIP integrity, single/multi-file batches, containment, no-link traversal, failure preservation, log cap, active leases, disk-pressure pruning, API polling, wrong-commit failure and served-image revision checks. |
| Diff whitespace | PASS | `git diff --check` | No whitespace errors. |
| Local Docker execution | NOT RUN | `docker version --format '{{.Server.Version}}'` | Local Linux Docker Engine pipe unavailable. CI contains image build plus root/health HTTP smoke checks. |
| Production deployment / DNS / external metadata | NOT RUN BY THIS SUBTASK | Parent orchestration owns live provider actions | Accepted API triggers alone are not successful deployments; the shared client polls terminal status and public health. |

## Security, compatibility and recovery

CI uses full action commit references, read-only default permissions, credential-free checkout, no pull-request deployment, exact tested-commit verification, bounded waits and a production environment. Required Coolify variables/token and runtime configuration are documented in `docs/deployment/coolify.md`. Keep built-in Git auto-deploy disabled so source changes cannot bypass the CI gates. Existing reviewed patch automation now requires the container gate where present. No new application dependency or automatic major-version upgrade was introduced.

Retention is enforced by cooperating code/maintenance calls; a filesystem directory cannot synchronously reject arbitrary external writes. Canonical logs use `log_yyyy-mm-dd-hh-mm-ss-mmm.log` and compressed archives use the same stem with `.zip`. Active PID leases prevent one cooperating writer from archiving another's live file. Keep recoverable project data out of Git and treat archives as sensitive local data.

Recheck public navigation/source downloads and the compact builder after the hosting rename. Native video/cleanup services stay opt-in and loopback-only. Preserve imported source and font license notices.

Use Coolify deployment history to restore a previously healthy release or revert a source change and pass CI again. This audit does not certify independent security, accessibility, GPU behavior or unexecuted live deployment checks.

## Primary guidance reviewed

- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [Coolify deploy webhooks](https://coolify.io/docs/core/automation/deploy-webhooks)
- Installed Next.js standalone-output guide for Next.js repositories; existing React primary references are recorded in the client audit.

Suggested commit subject: `chore: standardize repository operations and verified Coolify deployment`.
