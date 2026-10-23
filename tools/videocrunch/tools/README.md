# Small maintenance toolkit

This folder contains a few transparent PowerShell helpers, not downloaded executables or vendor binaries.

| Script | Purpose |
|---|---|
| `Initialize-WebVideoCrunch.ps1` | Launcher bootstrap: install only missing Node.js/yt-dlp/FFmpeg through winget, refresh PATH, fail explicitly |
| `Doctor.ps1` | Print tool versions/paths and expected data locations; flag missing/old prerequisites |
| `Verify.ps1` | Parse scripts, check JS syntax, run API/Pester regressions; `-Media` adds real-media integration and `-Browser` adds Playwright/Edge checks |
| `Audit.ps1` | Check npm advisories, including dev dependencies, and scan nonignored source for selected credential patterns |

Run from the repository root:

```powershell
.\tools\Doctor.ps1
.\tools\Verify.ps1 -Media
.\tools\Audit.ps1
```

Verification requires development tools/Pester; normal users do not need them. Audit requires a local Git repository and the committed lockfile. No hooks are installed automatically, and no global policy is changed. Read [audit limitations](../guidelines/AUDITING.md).
