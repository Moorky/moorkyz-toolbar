#requires -Version 5.1
<#
.SYNOPSIS
  Locates a video's source on a public web page, downloads it, compresses it,
  and generates a local HTML player and an integrity manifest.
.DESCRIPTION
  Uses yt-dlp (site extractor, HLS, DASH) plus an HTML-source fallback.
  FFmpeg produces a compressed, browser-compatible MP4. Downloaded originals
  are never modified or deleted.
  Use only for media you are authorized to download. Does not bypass DRM.
.EXAMPLE
  .\Get-WebVideoCrunch.ps1 -Url 'https://example.com/watch/123' -OutputDir 'C:\Users\marvi\Desktop\VideoExports'
.EXAMPLE
  .\Get-WebVideoCrunch.ps1 -Url 'https://example.com/video.mp4' -Compression Extreme
.EXAMPLE
  .\Get-WebVideoCrunch.ps1 -Url 'https://example.com/watch/123' -SkipCompression
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$Url,

    [ValidateNotNullOrEmpty()]
    [string]$OutputDir = 'C:\Users\marvi\Desktop\VideoExports',

    [ValidateSet('Balanced', 'Crunch', 'Extreme')]
    [string]$Compression = 'Crunch',

    [switch]$SkipCompression,

    [string]$ResultPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Utf8 = [System.Text.UTF8Encoding]::new($false)

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, $script:Utf8)
}

function Find-Tool {
    param([string]$Name)
    $cmd = Get-Command -Name $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $cmd) {
        throw "Missing tool '$Name'. Install it, then reopen PowerShell."
    }
    return $cmd.Source
}

function ConvertTo-SafeName {
    param([string]$Value)
    $safe = $Value -replace '[^a-zA-Z0-9.-]', '-'
    $safe = $safe.Trim([char[]]@('.', '-'))
    if (-not $safe) { $safe = 'website' }
    if ($safe.Length -gt 65) { $safe = $safe.Substring(0, 65) }
    return $safe
}

function Test-WebUri {
    param([string]$Value)
    $parsed = $null
    return ([Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$parsed) -and
            ($parsed.Scheme -eq 'http' -or $parsed.Scheme -eq 'https'))
}

function Get-PageCandidates {
    param([string]$Html, [Uri]$PageUri)

    $baseUri = $PageUri
    $baseTag = [regex]::Match($Html, '(?is)<base\b[^>]*?\bhref\s*=\s*["''](?<url>[^"'']+)["'']')
    if ($baseTag.Success) {
        $u = $null
        $baseText = [System.Net.WebUtility]::HtmlDecode($baseTag.Groups['url'].Value)
        if ([Uri]::TryCreate($PageUri, $baseText, [ref]$u) -and
            ($u.Scheme -eq 'https' -or $u.Scheme -eq 'http')) { $baseUri = $u }
    }

    $patterns = @(
        '(?is)<(?:video|source)\b[^>]*?\b(?:src|data-src|data-video)\s*=\s*["''](?<url>[^"'']+)["'']',
        '(?is)["''](?:contentUrl|embedUrl|videoUrl|file|hlsUrl)["'']\s*:\s*["''](?<url>[^"'']+)["'']',
        '(?is)(?:href|src)\s*=\s*["''](?<url>[^"'']+\.(?:mp4|m4v|mov|webm|m3u8|mpd)(?:\?[^"'']*)?)["'']',
        '(?is)<iframe\b[^>]*?\bsrc\s*=\s*["''](?<url>[^"'']+)["'']'
    )

    $raw = New-Object 'System.Collections.Generic.List[string]'
    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Html, $pattern)) {
            [void]$raw.Add($match.Groups['url'].Value)
        }
    }

    # OpenGraph / Twitter meta elements; handles either attribute order.
    foreach ($tag in [regex]::Matches($Html, '(?is)<meta\b[^>]*>')) {
        if ($tag.Value -match '(?i)(og:video|twitter:player:stream)') {
            $content = [regex]::Match($tag.Value, '(?is)\bcontent\s*=\s*["''](?<url>[^"'']+)["'']')
            if ($content.Success) { [void]$raw.Add($content.Groups['url'].Value) }
        }
    }

    $links = New-Object 'System.Collections.Generic.List[string]'
    foreach ($item in $raw) {
        $value = [System.Net.WebUtility]::HtmlDecode($item).Trim()
        $value = $value.Replace('\/', '/').Replace('\u0026', '&').Replace('\u003d', '=')
        if ($value -match '^(?i:blob:|data:|javascript:|about:)') { continue }
        $resolved = $null
        if ([Uri]::TryCreate($baseUri, $value, [ref]$resolved)) {
            if ($resolved.Scheme -in @('http','https') -and -not $links.Contains($resolved.AbsoluteUri)) {
                [void]$links.Add($resolved.AbsoluteUri)
            }
        }
    }
    return $links.ToArray()
}

function Invoke-NativeTool {
    param([string]$Executable, [string[]]$ArgumentList, [switch]$CaptureOutput)
    $oldPreference = $ErrorActionPreference
    $lines = New-Object 'System.Collections.Generic.List[string]'
    try {
        # PowerShell 5.1 can treat native stderr lines as ErrorRecords.
        $ErrorActionPreference = 'Continue'
        $PSNativeCommandUseErrorActionPreference = $false
        & $Executable @ArgumentList 2>&1 | ForEach-Object {
            if ($CaptureOutput -and $_ -isnot [System.Management.Automation.ErrorRecord]) {
                [void]$lines.Add([string]$_)
            }
            else {
                $_ | Out-Host
            }
        }
        return [pscustomobject]@{ ExitCode = [int]$LASTEXITCODE; Output = $lines.ToArray() }
    }
    finally { $ErrorActionPreference = $oldPreference }
}

function Get-StreamUrls {
    param([string]$Executable, [string]$Page, [string]$Referer)

    $arguments = @(
        '--ignore-config', '--no-cache-dir', '--no-playlist', '--playlist-items', '1',
        '--get-url', '--referer', $Referer, '--', $Page
    )
    $result = Invoke-NativeTool -Executable $Executable -ArgumentList $arguments -CaptureOutput
    if ($result.ExitCode -ne 0) {
        Write-Warning "Could not resolve stream URLs (yt-dlp exit code $($result.ExitCode)). The download is still available."
        return
    }
    $result.Output | Where-Object { Test-WebUri $_ } | Select-Object -Unique
}

function Get-PageHtml {
    param([Uri]$PageUri)
    $response = $null
    try {
        # Fetch HTML only; direct media URLs must not be buffered as page source.
        $request = [System.Net.HttpWebRequest]::Create($PageUri)
        $request.UserAgent = 'Mozilla/5.0 WebVideoCrunch/1.0'
        $request.Timeout = 30000
        $request.ReadWriteTimeout = 30000
        $request.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor
            [System.Net.DecompressionMethods]::Deflate
        $response = $request.GetResponse()
        if ($response.ContentType -notmatch '(?i)^(?:text/html|application/xhtml\+xml)(?:;|$)') {
            return
        }
        $reader = $null
        try {
            $encoding = [System.Text.Encoding]::UTF8
            if ($response.CharacterSet) {
                $encoding = [System.Text.Encoding]::GetEncoding($response.CharacterSet)
            }
            $reader = [System.IO.StreamReader]::new($response.GetResponseStream(), $encoding, $true)
            return [pscustomobject]@{ Html = $reader.ReadToEnd(); Uri = $response.ResponseUri }
        }
        finally {
            if ($null -ne $reader) { $reader.Dispose() }
        }
    }
    catch [System.Net.WebException] {
        if ($null -ne $_.Exception.Response) { $_.Exception.Response.Dispose() }
        throw
    }
    finally {
        if ($null -ne $response) { $response.Dispose() }
    }
}

function Get-ExportFile {
    param([string]$Path, [string]$RelativePath)
    $file = Get-Item -LiteralPath $Path
    if ($file.PSIsContainer -or $file.Length -eq 0) {
        throw "Expected a nonempty media file at '$Path'."
    }
    return [pscustomobject]@{
        path = $RelativePath
        bytes = $file.Length
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    }
}

function Write-VideoPlayer {
    param([string]$Path, [string]$Page, [string]$OriginalPath, [string]$VideoPath)
    $pageText = [System.Net.WebUtility]::HtmlEncode($Page)
    $originalLink = [System.Net.WebUtility]::HtmlEncode($OriginalPath)
    $videoLink = [System.Net.WebUtility]::HtmlEncode($VideoPath)
    $html = @"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Web Video Crunch - Offline player</title>
<style>
:root { color-scheme: dark; font-family: system-ui, sans-serif; background: #101722; color: #edf2fa; }
body { max-width: 1100px; margin: auto; padding: 32px 20px; }
main { background: #192436; border: 1px solid #30415a; border-radius: 20px; padding: 24px; }
h1 { margin-top: 0; } p { line-height: 1.6; overflow-wrap: anywhere; }
video { width: 100%; max-height: 75vh; border-radius: 12px; background: #000; }
a { color: #96c6ff; } nav { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px; }
.note { color: #becbdf; }
</style>
</head>
<body>
<main>
<h1>Offline video</h1>
<video controls playsinline preload="metadata" src="$videoLink">
Your browser cannot play this video. Use the download links below with a compatible media player.
</video>
<nav><a href="$videoLink" download>Save playback video</a><a href="$originalLink" download>Downloaded original</a><a href="manifest.json">Integrity manifest</a></nav>
<p>Source: <a href="$pageText" target="_blank" rel="noopener noreferrer">$pageText</a></p>
<p class="note">Downloaded originals are preserved. Browser playback depends on codec support, especially when compression is skipped. All playback files are local; no network connection is required.</p>
</main>
</body>
</html>
"@
    Write-Utf8File -Path $Path -Content $html
}

function Invoke-WebVideoCrunch {
    param(
        [string]$Url,
        [string]$OutputDir,
        [ValidateSet('Balanced', 'Crunch', 'Extreme')]
        [string]$Compression = 'Crunch',
        [switch]$SkipCompression,
        [string]$ResultPath
    )

    if (-not (Test-WebUri $Url)) {
        throw 'Url must be an absolute HTTP or HTTPS URL.'
    }
    if ([string]::IsNullOrWhiteSpace($OutputDir)) {
        throw 'OutputDir must not be empty.'
    }
    $downloader = Find-Tool 'yt-dlp'
    $ffmpeg = Find-Tool 'ffmpeg'
    $pageUri = [Uri]$Url
    $outputRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDir)
    $folderName = '{0}-{1}-{2}' -f (ConvertTo-SafeName $pageUri.Host),
        (Get-Date -Format 'yyyyMMdd-HHmmss-fff'), ([Guid]::NewGuid().ToString('N').Substring(0, 8))
    $exportDir = Join-Path $outputRoot $folderName
    $originalDir = Join-Path $exportDir 'original'
    [void](New-Item -ItemType Directory -Path $originalDir -Force)
    Write-Host "Export folder: $exportDir"

    $attempts = New-Object 'System.Collections.Generic.List[object]'
    $manifest = [ordered]@{
        schemaVersion = 1
        status = 'in_progress'
        sourceUrl = $Url
        startedAtUtc = [DateTime]::UtcNow.ToString('o')
        completedAtUtc = $null
        pageSource = [ordered]@{ saved = $false; error = $null }
        detectedUrls = @()
        resolvedStreamUrls = @()
        attempts = @()
        original = $null
        compressed = $null
        compression = [ordered]@{
            enabled = -not [bool]$SkipCompression
            mode = $Compression
            videoCodec = 'libx264'
            crf = $null
            preset = 'slow'
            audioCodec = 'aac'
            audioBitrate = '96k'
            maxWidth = $null
        }
        error = $null
    }
    $manifestPath = Join-Path $exportDir 'manifest.json'
    try {
        if ($ResultPath) {
            Write-Utf8File -Path $ResultPath -Content (@{ exportDir = $exportDir } | ConvertTo-Json)
        }
        Write-Utf8File -Path (Join-Path $exportDir 'page-url.txt') -Content $Url
        Write-Utf8File -Path (Join-Path $exportDir 'detected-urls.txt') -Content ''
        Write-Utf8File -Path (Join-Path $exportDir 'resolved-stream-urls.txt') -Content ''
        $candidates = @()

        try {
            $page = Get-PageHtml -PageUri $pageUri
            if ($null -ne $page) {
                Write-Utf8File -Path (Join-Path $exportDir 'page-source.html') -Content $page.Html
                $manifest.pageSource.saved = $true
                $candidates = @(Get-PageCandidates -Html $page.Html -PageUri $page.Uri)
                $manifest.detectedUrls = $candidates
                Write-Utf8File -Path (Join-Path $exportDir 'detected-urls.txt') -Content ($candidates -join [Environment]::NewLine)
            }
        }
        catch [System.Net.WebException] {
            $manifest.pageSource.error = $_.Exception.Message
            Write-Warning "Could not retrieve page HTML: $($_.Exception.Message). Trying yt-dlp directly."
        }

        $downloadedPath = $null
        $successfulUrl = $null
        $targets = @(@($Url) + $candidates | Select-Object -Unique)
        foreach ($target in $targets) {
            $number = $attempts.Count + 1
            # Failed attempts get separate directories so later downloads cannot overwrite their files.
            $attemptDir = Join-Path (Join-Path $exportDir '.downloads') ('attempt-{0:D2}' -f $number)
            [void](New-Item -ItemType Directory -Path $attemptDir -Force)
            $pathReport = Join-Path $attemptDir 'download-path.txt'
            $arguments = @(
                '--ignore-config', '--no-cache-dir', '--no-playlist', '--playlist-items', '1',
                '--no-overwrites', '--windows-filenames', '--restrict-filenames',
                '--ffmpeg-location', (Split-Path -Parent $ffmpeg),
                '--format', 'bv*+ba/b', '--referer', $Url,
                '--output', (Join-Path $attemptDir 'source.%(ext)s'),
                '--print-to-file', 'after_move:filepath', $pathReport, '--', $target
            )
            Write-Host "Downloading candidate $number : $target"
            $result = Invoke-NativeTool -Executable $downloader -ArgumentList $arguments
            $attempt = [ordered]@{ url = $target; exitCode = $result.ExitCode; error = $null }
            [void]$attempts.Add($attempt)
            if ($result.ExitCode -ne 0) {
                $attempt.error = "yt-dlp exited with code $($result.ExitCode)."
                Write-Warning "$($attempt.error) Trying the next detected candidate, if any."
                continue
            }
            if (-not (Test-Path -LiteralPath $pathReport -PathType Leaf)) {
                $attempt.error = 'yt-dlp did not report a downloaded file.'
                Write-Warning $attempt.error
                continue
            }
            $paths = @(Get-Content -LiteralPath $pathReport -Encoding UTF8 | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            if ($paths.Count -ne 1) {
                $attempt.error = "Expected one downloaded video, but yt-dlp reported $($paths.Count) files."
                Write-Warning $attempt.error
                continue
            }
            $reportedPath = [System.IO.Path]::GetFullPath($paths[0])
            $attemptPrefix = $attemptDir + [System.IO.Path]::DirectorySeparatorChar
            if (-not $reportedPath.StartsWith($attemptPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "yt-dlp reported a file outside the attempt directory: '$reportedPath'."
            }
            if (-not (Test-Path -LiteralPath $reportedPath -PathType Leaf) -or
                (Get-Item -LiteralPath $reportedPath).Length -eq 0) {
                $attempt.error = 'yt-dlp reported a missing or empty media file.'
                Write-Warning $attempt.error
                continue
            }
            $downloadedPath = $reportedPath
            $successfulUrl = $target
            break
        }
        if ($null -eq $downloadedPath) {
            throw "All $($attempts.Count) download attempts failed. See '$manifestPath' and the tool output."
        }

        $sourcePath = Join-Path $originalDir (Split-Path -Leaf $downloadedPath)
        Move-Item -LiteralPath $downloadedPath -Destination $sourcePath
        Remove-Item -LiteralPath $pathReport
        if (@(Get-ChildItem -LiteralPath $attemptDir -Force).Count -eq 0) {
            Remove-Item -LiteralPath $attemptDir
        }
        $downloadsDir = Join-Path $exportDir '.downloads'
        if (@(Get-ChildItem -LiteralPath $downloadsDir -Force).Count -eq 0) {
            Remove-Item -LiteralPath $downloadsDir
        }
        $downloadedPath = $sourcePath
        $originalRelativePath = 'original/{0}' -f (Split-Path -Leaf $downloadedPath)
        $manifest.original = Get-ExportFile -Path $downloadedPath -RelativePath $originalRelativePath
        $manifest.resolvedStreamUrls = @(Get-StreamUrls -Executable $downloader -Page $successfulUrl -Referer $Url)
        Write-Utf8File -Path (Join-Path $exportDir 'resolved-stream-urls.txt') -Content ($manifest.resolvedStreamUrls -join [Environment]::NewLine)
        $playbackPath = $originalRelativePath

        if (-not $SkipCompression) {
            $crf = switch ($Compression) {
                'Balanced' { 23 }
                'Crunch' { 29 }
                'Extreme' { 33 }
            }
            $manifest.compression.crf = $crf
            $compressedDir = Join-Path $exportDir 'compressed'
            [void](New-Item -ItemType Directory -Path $compressedDir)
            $compressedPath = Join-Path $compressedDir 'video.mp4'
            $arguments = @(
                '-hide_banner', '-nostdin', '-n', '-i', $downloadedPath,
                '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
                '-c:v', 'libx264', '-crf', [string]$crf, '-preset', 'slow',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
                '-movflags', '+faststart'
            )
            $filter = "scale=w='max(2,trunc(iw*sar/2)*2)':h='max(2,trunc(ih/2)*2)',setsar=1"
            if ($Compression -eq 'Extreme') {
                $manifest.compression.maxWidth = 1280
                $filter = "scale=w='max(2,trunc(min(1280,iw*sar)/2)*2)':h='max(2,trunc(ih*ow/(iw*sar)/2)*2)',setsar=1"
            }
            $arguments += @('-vf', $filter, $compressedPath)
            Write-Host "Compressing video ($Compression)..."
            $result = Invoke-NativeTool -Executable $ffmpeg -ArgumentList $arguments
            if ($result.ExitCode -ne 0) {
                throw "FFmpeg compression failed with exit code $($result.ExitCode). The original remains at '$downloadedPath'."
            }
            $manifest.compressed = Get-ExportFile -Path $compressedPath -RelativePath 'compressed/video.mp4'
            if ($manifest.compressed.bytes -ge $manifest.original.bytes) {
                Write-Warning 'The compressed video is not smaller than the original. Both files have been preserved.'
            }
            $playbackPath = 'compressed/video.mp4'
        }

        Write-VideoPlayer -Path (Join-Path $exportDir 'index.html') -Page $Url `
            -OriginalPath $originalRelativePath -VideoPath $playbackPath
        $manifest.status = 'completed'
    }
    catch {
        $manifest.status = 'failed'
        $manifest.error = $_.Exception.Message
        Write-Warning "Export failed. Retained files: $exportDir"
        throw
    }
    finally {
        $manifest.attempts = $attempts.ToArray()
        $manifest.completedAtUtc = [DateTime]::UtcNow.ToString('o')
        Write-Utf8File -Path $manifestPath -Content ($manifest | ConvertTo-Json -Depth 10)
    }
    Write-Host "Export complete. Open $(Join-Path $exportDir 'index.html')"
    return $exportDir
}

Invoke-WebVideoCrunch -Url $Url -OutputDir $OutputDir -Compression $Compression `
    -SkipCompression:$SkipCompression -ResultPath $ResultPath