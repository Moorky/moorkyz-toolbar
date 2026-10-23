# Troubleshooting

## Launcher cannot install tools

Automatic setup requires Windows 10/11 with Microsoft Store's **App Installer** providing `winget`, internet access, and permission to install software. Update App Installer, then run the launcher again. Corporate policy/UAC cannot be bypassed.

Manual installation:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id yt-dlp.yt-dlp --exact
winget install --id Gyan.FFmpeg --exact
```

Close/reopen the launcher after manual installation. Confirm versions with `.\tools\Doctor.ps1`. If FFmpeg is installed manually, both `ffmpeg.exe` and `ffprobe.exe` should be on PATH.

## PowerShell blocks a script

After inspecting a trusted download, unblock its files as appropriate. The double-click launcher uses a process-scoped execution-policy bypass; it does not change machine policy. Organization policy may still take precedence.

## Browser does not open / port occupied

Open `http://127.0.0.1:8765` manually. Use the numeric loopback address, not a custom hostname; Host checking is intentional. If another application uses the port:

```powershell
.\Start-WebVideoCrunch.ps1 -Port 8766
```

Do not stop unrelated processes or change the bind address to `0.0.0.0`.

## Video download fails

Read the live log and manifest. Common causes are removed/private videos, expired signed URLs, anti-bot protections, unsupported websites, unavailable formats, or network outages. The app does not bypass restrictions. Update yt-dlp using your package manager and retry with an authorized public URL.

HTML retrieval or resolved-stream-URL warnings do not necessarily mean the media download failed. The completed/failed state is authoritative.

## Compression fails / file is larger

The original remains in `original\source.*`. Ensure FFmpeg provides libx264 and AAC. A larger derivative is possible for already compressed inputs; keep the better file or choose original-only next time. An original MKV/WebM codec may need a desktop media player.

## Interrupted or missing history

Restarting the app marks interrupted records failed; no automatic resume is promised. Downloaded files remain in the chosen output root, including `.downloads` fragments on failure. Finished exports work directly through their `index.html` without history or the server.

History is stored in `%USERPROFILE%\.web-video-crunch\history.json`. If it is corrupt, the app refuses to silently discard it. Stop the app and back up that exact file before renaming it to recover with a new history. Do not delete broad directories.

## Privacy

Do not publish logs, manifests, source HTML, signed URLs, or personal media without reviewing/redacting them. Outputs and local history are not intended to enter Git.
