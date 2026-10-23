# Audit checklist

Document every completed delivery with a dated entry in [audits/](../audits/README.md). Record commands actually executed and explicit limitations; "no known finding" is not a certification.

## Automated

- `tools\Doctor.ps1`: required runtime/development executables and versions.
- `tools\Verify.ps1`: PowerShell parsing, JavaScript syntax, API tests, Pester tests.
- `tools\Verify.ps1 -Media`: actual synthetic-media export integration where relevant.
- `tools\Verify.ps1 -Browser`: actual desktop/mobile browser integration where relevant.
- `tools\Audit.ps1`: npm advisories and limited source credential patterns.
- `git diff --check` / staged equivalent: whitespace issues.
- `git status --short` and explicit staged-file inspection: no outputs, secrets, caches, or unrelated files.

## Manual correctness and hardening

- Validate exact export hierarchy, original digest, codecs, sizes, and Extreme width.
- Verify local-only bind, Host/Origin checks, request token, process argument separation, and file containment.
- Confirm range-enabled playback, explicit error propagation, restart behavior, and single-job enforcement.
- Exercise desktop/mobile and keyboard use; inspect missing-tool and failure states.
- Inspect first-run bootstrap: install only missing prerequisites, refresh PATH, propagate failed installers.
- Confirm ignore rules exclude timestamped exports and sensitive local state.

## Release/commit

- Update docs and changelog.
- List unsupported/unperformed checks, particularly fresh-machine installation and external-site behavior.
- Commit verified source only. Do not publish or create a remote without the owner's instruction.
- A security vulnerability review, if required, is separate from these maintenance checks.
