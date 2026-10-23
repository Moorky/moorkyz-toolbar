#requires -Version 5.1
[CmdletBinding()]
param([switch]$Media, [switch]$Browser)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    $files = @(Get-ChildItem -LiteralPath $root -Filter '*.ps1') +
        @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1')
    foreach ($file in $files) {
        $parseErrors = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$null, [ref]$parseErrors)
        if ($parseErrors.Count -gt 0) { throw "$($file.Name): $($parseErrors.Message -join '; ')" }
    }
    foreach ($file in @('server.js', 'public\app.js', 'test\server.test.js', 'test\media.test.js',
        'test\browser-fixture.js', 'test\browser-teardown.js', 'test\browser\app.spec.js', 'playwright.config.js')) {
        & node --check $file
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $file" }
    }
    & node --test 'test\server.test.js'
    if ($LASTEXITCODE -ne 0) { throw 'Web API tests failed.' }
    $windowsPowerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $previousModulePath = $env:PSModulePath
    try {
        # Let Windows PowerShell resolve its own modules when pnpm inherits a PowerShell 7 environment.
        $env:PSModulePath = $null
        & $windowsPowerShell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command `
            '$ErrorActionPreference = ''Stop''; $r = Invoke-Pester -Script .\Get-WebVideoCrunch.Tests.ps1, .\tools\Initialize-WebVideoCrunch.Tests.ps1 -PassThru; if ($r.FailedCount -gt 0) { exit 1 }'
    }
    finally { $env:PSModulePath = $previousModulePath }
    if ($LASTEXITCODE -ne 0) { throw 'PowerShell regression tests failed.' }
    if ($Media) {
        & node --test 'test\media.test.js'
        if ($LASTEXITCODE -ne 0) { throw 'Real-media integration tests failed.' }
    }
    if ($Browser) {
        & npm.cmd run test:browser
        if ($LASTEXITCODE -ne 0) { throw 'Browser integration tests failed.' }
    }
    Write-Host 'Verification passed.'
}
finally { Pop-Location }
