# Web Video Crunch — PowerShell

Analyses a URL, downloads publicly accessible video streams with `yt-dlp`, and creates a local HTML video player plus a compressed H.264 MP4 using FFmpeg. The downloaded video remains untouched.

## Install requirements (Windows PowerShell)

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

Close and reopen PowerShell, then check:

```powershell
yt-dlp --version
ffmpeg -version
```

## Run

Save `Get-WebVideoCrunch.ps1` in your Downloads folder or Desktop, open PowerShell in that folder, and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Get-WebVideoCrunch.ps1 `
  -Url "https://www.youtube.com/watch?v=b2tjnxX8IHU" `
  -OutputDir "C:\Users\marvi\Desktop\VideoExports" `
  -Compression Crunch
```

Or in an existing PowerShell session:

```powershell
.\Get-WebVideoCrunch.ps1 -Url "https://example.com/video-page" -OutputDir "C:\Users\marvi\Desktop\VideoExports"
```

If the file was downloaded and blocked by Windows, you can optionally run `Unblock-File .\Get-WebVideoCrunch.ps1` after inspecting its contents.

The default output directory is `C:\Users\marvi\Desktop\VideoExports`; you can omit `-OutputDir` to use it. Each run creates its own timestamped subfolder there. Both yt-dlp and FFmpeg must be installed, even with `-SkipCompression`, because some downloads require FFmpeg to merge streams. For the one-click web application, see the [main README](README.md).

## Compression modes

| Mode | FFmpeg settings | Outcome |
|---|---|---|
| `Balanced` | libx264, CRF 23, preset slow, AAC 96k | Better quality; generally larger |
| `Crunch` (default) | libx264, CRF 29, preset slow, AAC 96k | Aggressive compression |
| `Extreme` | libx264, CRF 33, preset slow, max width 1280px, AAC 96k | Smaller, visibly more degradation |

`-SkipCompression` downloads without recompressing. If a video is already highly compressed, the new file may be larger. Compression is lossy and the output is not an evidentiary substitute for the downloaded source.

## Output

A new timestamped folder with:

- `page-url.txt` — original page URL
- `page-source.html` — HTML source, when retrievable (not a fully mirrored site)
- `detected-urls.txt` — video/stream/iframe candidates found in HTML
- `resolved-stream-urls.txt` — actual resolved media URLs when yt-dlp can expose them (some links are signed and expire)
- `original/source.*` — unchanged download or container-merged copy (never transcoded by this script)
- `compressed/video.mp4` — compressed derivative (when enabled)
- `index.html` — modern offline HTML5 video player
- `manifest.json` — source, attempts, sizes, SHA-256 checksums, compression details

If the page extractor fails, the script tries video/stream/iframe candidates found in the page HTML. Page retrieval and stream-URL resolution failures produce warnings; downloading may still succeed. A download or compression failure stops the script, records a `failed` status and error in the manifest, and retains any downloaded files. Missing tools or invalid arguments fail before an export folder is created.

Failed attempts are isolated in `.downloads/attempt-NN/` so retries cannot overwrite their files. The completed source is moved unchanged to `original/source.*`; empty successful staging directories are removed. The optional `-ResultPath` parameter writes a UTF-8 JSON descriptor containing `exportDir` for the local web app; it does not change export contents.

## Tests

With Pester 3.4 or 4.x installed, run the offline regression tests in Windows PowerShell:

```powershell
Invoke-Pester .\Get-WebVideoCrunch.Tests.ps1
```

The workflow tests use mock media tools and do not download external videos.

## Limitations

- Only public/authorized downloads: no DRM, password or paywall bypass.
- Some browser-generated players, logins, and anti-bot services will require manual inspection.
- HTML source does not include JavaScript-generated network requests or a complete offline copy of the page.
- Signed stream URLs may contain sensitive, temporary access tokens. Keep your output folder private.
- The script selects a single video, not an entire playlist.
- An HTML5 MP4 player uses H.264 for broad browser support. `-SkipCompression` may leave a format that the HTML viewer cannot play.
- For forensic use, keep the originals from the recording device as well as these downloads. Website downloads alone cannot authenticate content.
