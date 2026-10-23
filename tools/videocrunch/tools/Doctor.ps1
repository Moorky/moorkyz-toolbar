#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$failed = $false
foreach ($tool in @(
    @{ Name = 'node'; Arguments = @('--version') },
    @{ Name = 'yt-dlp'; Arguments = @('--version') },
    @{ Name = 'ffmpeg'; Arguments = @('-version') },
    @{ Name = 'ffprobe'; Arguments = @('-version') },
    @{ Name = 'git'; Arguments = @('--version') }
)) {
    $command = Get-Command $tool.Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) {
        Write-Warning "MISSING: $($tool.Name)"
        $failed = $true
        continue
    }
    $version = & $command.Source @($tool.Arguments) | Select-Object -First 1
    if ($LASTEXITCODE -ne 0) { $failed = $true; Write-Warning "FAILED: $($tool.Name)" }
    Write-Host "$($tool.Name): $version"
    Write-Host "  $($command.Source)"
    if ($tool.Name -eq 'node' -and ($version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22)) {
        Write-Warning 'Node.js 22 or newer is required.'
        $failed = $true
    }
}
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host "History: $(Join-Path $env:USERPROFILE '.web-video-crunch\history.json')"
Write-Host "Default output: $(Join-Path $env:USERPROFILE 'Desktop\VideoExports')"
if ($failed) { throw 'Some checks failed. See docs\TROUBLESHOOTING.md.' }
