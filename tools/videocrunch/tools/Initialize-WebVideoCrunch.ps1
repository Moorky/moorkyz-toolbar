#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Update-ToolPath {
    $paths = @(
        [Environment]::GetEnvironmentVariable('Path', 'Machine'),
        [Environment]::GetEnvironmentVariable('Path', 'User'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links'),
        $env:Path
    ) | Where-Object { $_ }
    $env:Path = $paths -join ';'
}

function Test-Requirement {
    param([string]$Command)
    $tool = Get-Command $Command -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $tool) { return $false }
    if ($Command -eq 'node') {
        $version = & $tool.Source --version
        return ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22)
    }
    return $true
}

function Install-Requirement {
    param([string]$Installer, [string]$PackageId)
    & $Installer install --id $PackageId --exact --source winget `
        --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Installation failed for $PackageId (winget exit code $LASTEXITCODE). See docs\TROUBLESHOOTING.md."
    }
}

function Initialize-WebVideoCrunch {
    Update-ToolPath
    $requirements = @(
        @{ Command = 'node'; Id = 'OpenJS.NodeJS.LTS'; Name = 'Node.js 22+' },
        @{ Command = 'yt-dlp'; Id = 'yt-dlp.yt-dlp'; Name = 'yt-dlp' },
        @{ Command = 'ffmpeg'; Id = 'Gyan.FFmpeg'; Name = 'FFmpeg' }
    )
    $missing = @($requirements | Where-Object { -not (Test-Requirement $_.Command) })
    if ($missing.Count -eq 0) {
        Write-Host 'Prerequisites ready: Node.js, yt-dlp, and FFmpeg.'
        return
    }
    $winget = Get-Command winget -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) {
        throw 'Automatic setup needs Windows App Installer (winget). Install/update App Installer from Microsoft Store, then double-click the launcher again. See docs\TROUBLESHOOTING.md for manual setup.'
    }
    Write-Host 'First-run setup: installing missing tools from the winget community catalog.'
    Write-Host 'This needs internet access and accepts the package/source agreements. Windows may request installation approval.'
    foreach ($requirement in $missing) {
        Write-Host "Installing $($requirement.Name)..."
        Install-Requirement -Installer $winget.Source -PackageId $requirement.Id
        Update-ToolPath
        if (-not (Test-Requirement $requirement.Command)) {
            throw "$($requirement.Name) was installed but is not available on PATH. Reopen the launcher; if it still fails, see docs\TROUBLESHOOTING.md."
        }
    }
    Write-Host 'First-run setup complete.'
}

Initialize-WebVideoCrunch
