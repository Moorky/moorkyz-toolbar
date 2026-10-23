# Audit: 2026-10-22 - local web application and repository setup

## Scope

Completed the truncated video-export script, added a localhost browser application and first-use launcher, standardized the requested export hierarchy, and added project guidance and quality tools.

## Executed checks

| Check | Command or method | Result |
|---|---|---|
| Installed tools | `.\tools\Doctor.ps1` | Passed: Node 22.18.0, yt-dlp 2026.10.21, FFmpeg/ffprobe 9.0.2, Git 2.50.1 |
| Existing-tools launcher bootstrap | Windows PowerShell 5.1 running `tools\Initialize-WebVideoCrunch.ps1` | Passed without reinstalling existing tools |
| Full verification | `.\tools\Verify.ps1 -Media -Browser` | Passed: PowerShell parsing and JavaScript syntax checks |
| API regression tests | Included in full verification | 13 passed; validation, concurrency, history/restart, errors, file access, ranges, and local request protections |
| PowerShell regression tests | Included in full verification, Windows PowerShell 5.1/Pester 3.4 | 25 passed: 19 export/helper tests plus 6 bootstrap scenarios |
| Actual media integration | Included in full verification | All four mode subtests passed: Balanced, Crunch, Extreme, original-only |
| Browser integration | Playwright 1.64.1 using installed Microsoft Edge | 4 passed: desktop controls/navigation, actual silent-video export/download/playback, mobile/error state, failed download |
| Dependency/source audit | `.\tools\Audit.ps1` | No npm vulnerabilities reported; limited credential-pattern scan passed |
| Ignore rules | `git check-ignore` against a timestamped export, `.env`, and `node_modules` | All excluded |
| Documentation links | Checked relative Markdown targets in root/docs/guidelines/ideas/audits/tools | 38 local links passed |
| Staged whitespace | `git diff --cached --check` | Passed |
| Cleanup | Inspected dedicated browser-fixture temporary directories after tests | No fixture directories left |
| Visual inspection | Generated desktop/completed-export/mobile screenshots in ignored `test-results/` | Charcoal/violet workspace, responsive layout without mobile overflow, PowerShell-blue terminal |

Only source, tests, configuration, and documentation were staged for the delivery commit. Browser screenshots are generated development evidence, not committed exports or personal media.

## Findings resolved

- The original script ended inside a function and could not parse. Restored discovery, download, fallback, compression, player, manifests, and explicit failure handling.
- Unified the default root with the confirmed `Desktop\VideoExports` hierarchy. Successful originals are at `original/source.*`; failed attempts remain isolated without overwrites.
- Corrected the local request-token header lookup and added exercised API protections.
- Real-media integration found that a PowerShell 7 parent could pass an incompatible module search path to Windows PowerShell through Node. PowerShell child processes now rebuild their own module path.
- Verified original bytes and SHA-256 against synthetic source media; checked actual H.264/AAC/yuv420p, square pixels, and precise 1280x720 Extreme output for an anamorphic source.
- Restored interrupted history records now have an explicit interruption stage instead of retaining a misleading downloading label.
- Browser automation verified actual playable output, original-file downloads, user-visible errors, and mobile sizing rather than only static markup.
- First-run bootstrap installs only missing prerequisites, refreshes PATH, and propagates missing-winget, installer, and post-install lookup failures. These failure/success branches have simulated tests.

## Manual hardening review

Reviewed the loopback-only listener, Host/Origin/fetch-metadata checks, per-process POST token, validated inputs, fixed PowerShell command with JSON environment parameters, allowlisted/realpath-contained export serving, bounded logs, offline player escaping, and retention of downloaded originals.

Captured external page HTML is not served by the web app. Production runtime has no npm dependencies; Playwright is development-only. No account, telemetry, remote storage, or hosted access was added.

## Limitations

- This is a maintenance/correctness/hardening audit, not an independent vulnerability certification.
- A genuinely clean Windows VM was not available. Actual missing-prerequisite installation, UAC/managed-device policy, offline installer behavior, and a blocked Microsoft Store still need that separate environment.
- No system tools were uninstalled or upgraded on this shared workstation merely to test bootstrap.
- External websites, DRM, logins, anti-bot behavior, and all possible codecs/FFmpeg builds are not certified. Tests use generated, locally served media only.
- Credential scanning matches selected patterns; it cannot prove the absence of all secrets.
- External package provenance and upstream binary vulnerabilities are not certified by the npm audit.
- No distribution license, hosted remote, maintainer email, or CI provider was invented. The owner must select/configure those before public release.
