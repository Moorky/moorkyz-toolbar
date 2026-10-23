#requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8765,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'tools\Initialize-WebVideoCrunch.ps1')
$node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'Setup could not locate Node.js. Reopen the launcher after installation finishes.'
}
$arguments = @((Join-Path $PSScriptRoot 'server.js'), '--port', [string]$Port)
if (-not $NoBrowser) { $arguments += '--open' }
& $node.Source @arguments
if ($LASTEXITCODE -ne 0) { throw "The web app exited with code $LASTEXITCODE." }
