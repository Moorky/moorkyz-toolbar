# Development Audit: Open the app on start and restart

| Field | Value |
|---|---|
| Audit ID | `2026-10-16T23-14-32Z-open-browser-on-start` |
| Created (UTC) | `2026-10-16T23:14:32Z` |
| Task / issue | Open the configured app URL after `moorkyz start` or `moorkyz restart` |
| Auditor | Codex agent self-review |
| Branch / baseline commit | `master` / `e1e64b3` |
| Final commit | Included with this audit and implementation; see git history |
| Scope reviewed | `moorkyz.cjs`, `docs/engineering/moorkyz-cli.md` |
| Outcome | PUSH REQUESTED; CI VALIDATION PENDING |

## 1. Request and outcome

- Requested behavior: open the selected local app automatically on `start` and `restart`.
- Implemented behavior: use the OS default browser launcher after the managed process is confirmed, including when already running; `start all` opens each URL.
- Acceptance evidence: `node --check moorkyz.cjs` and `git diff --check` passed.
- Intentional exclusions: CI and non-interactive invocations do not launch a browser. No consumer CLI or application code changed.
- Relevant decisions/contracts: this is maintainer CLI behavior only; no public package API changed.

## 2. Change inventory

| Path | Change | Risk |
|---|---|---|
| `moorkyz.cjs` | Add OS browser launching and update help | low |
| `docs/engineering/moorkyz-cli.md` | Document the behavior | low |

## 3. Verification evidence

| Check | Result | Exact command / method | Evidence / notes |
|---|---|---|---|
| Formatting / lint | NOT RUN | - | Repository tests were not requested; the push-triggered workflow will provide repo-level validation |
| Typecheck | N/A | - | Plain JavaScript helper |
| Unit / integration tests | NOT RUN | - | Repository tests were not requested; runtime behavior remains unverified |
| Browser / accessibility | NOT RUN | - | No browser was launched during the change |
| Build / consumer fixture | N/A | - | CLI-only change |
| Security / dependency review | PASS | Diff review | No shell command construction or dependency change |
| Performance (if relevant) | N/A | - | One detached OS opener per selected project |
| `git diff --check` | PASS | `git diff --check` | No whitespace errors |
| JavaScript syntax | PASS | `node --check moorkyz.cjs` | Exited with code 0 |

## 4. Risk and quality review

- Public contract, feature-default, and compatibility impact: no package contract or defaults changed.
- Security, privacy, permissions, and secrets: existing validated URL passed as an argument; no shell execution, secrets, or data movement added.
- Accessibility, keyboard, and reduced motion: N/A; no UI changed.
- Disabled-feature work/resource/network behavior: N/A; no toolbar feature flags changed.
- Error handling, cleanup, and recovery: opener launch failures are reported; the CLI service result is preserved.
- Dependency, performance, and regression exposure: no dependencies; the current heartbeat confirms process supervision, not HTTP readiness.

## 5. Findings and residual risks

| ID | Severity | Finding and evidence | Mitigation / owner | Status |
|---|---|---|---|---|
| AUD-001 | info | A slow app may not be accepting HTTP when the browser opens because startup confirmation is based on the existing heartbeat. | Project owner can reload if observed; consider readiness polling if needed. | Open |

- Known gaps / checks not run: CLI tests and full configured checks were not run because the task did not request verification.
- Required approvals: none for this local CLI change.
- Rollback or recovery: revert the CLI helper and documentation edits.
- Release readiness: CI validation is pending on the requested push.

## 6. Completion record

- This audit is included with the implementation commit at the user's request to publish to `master`.
- Final commit hash: `N/A`
- External action: default-branch push requested by the user.

**Limitations:** This self-audit is not an independent security review, accessibility certification, or release approval.
