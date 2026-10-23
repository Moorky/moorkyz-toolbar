# Testing

## Quick checks

```powershell
.\tools\Verify.ps1
.\tools\Audit.ps1
```

Verification parses all maintained PowerShell scripts, checks JavaScript syntax, runs Node API tests, and runs Pester regression tests in Windows PowerShell 5.1. Windows' bundled Pester 3.4 or compatible 4.x is expected. Pester 5 is not the current test target.

Pester also exercises the first-run bootstrap with simulated missing tools, successful/failed installations, unavailable winget, and PATH-refresh failures. These tests do not install software.

```powershell
npm test
Invoke-Pester .\Get-WebVideoCrunch.Tests.ps1
```

API tests cover validation, request protections, concurrency, persistence/restart, explicit failures, local downloads, file containment, and media byte ranges. Pester tests cover source extraction, manifests/hashes, fallbacks, compression choices, native exit codes, and original preservation with mocked media tools.

## Real-media integration

```powershell
.\tools\Verify.ps1 -Media
# Or only the integration test:
npm run test:media
```

Requires installed yt-dlp, FFmpeg, and ffprobe. Tests generate a synthetic anamorphic video/audio clip and serve it on an ephemeral loopback HTTP port. The real application invokes real PowerShell, yt-dlp, and FFmpeg in Balanced/Crunch/Extreme/original-only modes.

Assertions include unchanged source bytes/SHA-256, exact output hierarchy, H.264/AAC/yuv420p, square pixels and expected dimensions, Extreme's 1280px limit, HTML retrieval, valid manifest sizes, and HTTP ranges. Temporary data is scoped to a dedicated test directory and removed afterward. No external video is downloaded.

## Browser checklist

Automated desktop/mobile browser integration uses Playwright with the installed Microsoft Edge:

```powershell
npm ci
npm run test:browser
# Or combine checks:
.\tools\Verify.ps1 -Media -Browser
```

These development packages are not required for one-click normal startup. The fixture reserves loopback ports 8876/8877, generates a silent synthetic video, and uses isolated temporary history/output. It validates navigation, controls, mobile overflow, real exports, original download, MP4 playback, and failure UI. Screenshots go to ignored `test-results/`. Do not run another service on those fixture ports.

Review additionally:

- Desktop and mobile layout; keyboard navigation and visible focus.
- All three navigation sections, required/invalid URL behavior, save-location expansion.
- Compression options and original-only toggle, correct button state.
- Running job blocks another export, shows real logs, and survives page refresh.
- Completed original/MP4/manifest downloads, offline player, and seeking.
- A larger compressed file is labeled honestly; failures show actionable messages.
- Missing tools, stopped server, and app restart show clear recovery guidance.

## First-use matrix

Test clean-machine prerequisite installation in a disposable Windows VM. Also cover existing tools, offline setup, missing winget, denied UAC, occupied ports, and a second launch without reinstalling. The normal verification suite does not install/uninstall system tools to simulate these conditions.
