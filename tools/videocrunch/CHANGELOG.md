# Changelog

## 1.0.0 - 2026-10-22

- Restored the incomplete PowerShell workflow: source discovery, yt-dlp download, FFmpeg compression, offline playback, SHA-256 manifest, explicit failure records.
- Added a localhost-only browser application with compression choices, original-only exports, live logs, persistent 50-entry history, range-enabled playback, and downloads.
- Standardized outputs under `Desktop\VideoExports\<host>-<timestamp>-<id>\original\source.*` and optional `compressed\video.mp4`.
- Added a double-click launcher with automatic winget bootstrap and a charcoal/violet interface with PowerShell-blue logs.
- Added regression/integration tests, prerequisite diagnostics, verification and audit scripts, repository guidelines, and idea/audit templates.
# Portal integration - 2026-10-23

- Imported the complete source into the Moorkyz tools repository without local
  state, media, Git metadata or dependencies.
- Frontend asset/API URLs are now relative, preserving standalone startup while
  supporting the optional same-origin localhost portal gateway.
- The Windows PowerShell test subprocess resets inherited PowerShell 7 module
  paths so native hashing and Pester checks resolve compatible system modules.
- The portal adds source browsing, individual file downloads and a complete ZIP;
  public hosting, accounts and multi-user operation remain unsupported.
