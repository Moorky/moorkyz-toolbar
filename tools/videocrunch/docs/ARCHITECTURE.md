# Architecture

## Components

```text
Start-WebVideoCrunch.cmd
  -> Start-WebVideoCrunch.ps1
     -> tools/Initialize-WebVideoCrunch.ps1 (check/bootstrap prerequisites)
     -> server.js (Node HTTP server on 127.0.0.1)
        -> public/ (plain browser UI)
        -> PowerShell child process
           -> Get-WebVideoCrunch.ps1
              -> yt-dlp
              -> FFmpeg
```

The browser talks only to the local Node API. Node launches a fixed PowerShell command with user options serialized as JSON in its child environment, never interpolated into code. PowerShell returns an export-directory descriptor using `-ResultPath`. Native stdout/stderr are shown as text in the UI.

## Job lifecycle

1. The UI fetches tool readiness, default output location, and a per-process request token.
2. `POST /api/jobs` validates the request and enforces one running job.
3. The initial job is atomically persisted before its child process starts.
4. The script retrieves HTML when applicable, extracts candidates, and tries yt-dlp against the input then fallback candidates.
5. Each download attempt is isolated in `.downloads/attempt-NN`. A completed source moves unchanged to `original/source.*`.
6. Optional FFmpeg encoding writes only `compressed/video.mp4`. The original is never transcoded or overwritten.
7. The script writes the offline player and a completed/failed manifest. Node reads the descriptor and manifest and persists final history.
8. The UI polls job state/logs. It never invents a numeric completion percentage.

History retains 50 jobs in `%USERPROFILE%\.web-video-crunch\history.json`. Per-job result descriptors are small local files in the same private directory. An app restart marks previously running records interrupted/failed; it does not resume or delete downloads. Export files remain independent of history.

## HTTP surface

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | Readiness, default location, process-local request token |
| `GET /api/jobs` | History summaries |
| `POST /api/jobs` | Start one validated export |
| `GET /api/jobs/:id` | State, manifest summary, bounded live log |
| `GET/HEAD /api/jobs/:id/files/:path` | Allowlisted player, original, derivative, manifest; byte ranges supported |

No arbitrary filesystem browsing, page-source serving, hosted uploads, or remote access is provided. Static UI files are explicitly mapped, and exported paths are checked after realpath resolution. The generated player uses relative URLs and can also open directly from disk without the server.

## Failure semantics

Optional HTML/stream-URL failures are visible warnings. Download/encoding failures fail the export and retain files. Missing prerequisites fail before export creation. History-write failures surface through the API and prevent new jobs. Shutdown stops accepting requests and waits for the running export; forced process termination can still interrupt it.
