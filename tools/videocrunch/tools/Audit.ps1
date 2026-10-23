#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    & npm.cmd audit --audit-level=moderate
    if ($LASTEXITCODE -ne 0) { throw 'Dependency audit failed.' }
    $files = @(& git -c core.quotepath=false ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'Initialize the local Git repository before running the source audit.' }
    $patterns = @(
        'gh[pousr]_[A-Za-z0-9]{30,}',
        'github_pat_[A-Za-z0-9_]{40,}',
        'AKIA[0-9A-Z]{16}',
        '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
    )
    $findings = @()
    foreach ($file in $files) {
        if ([IO.Path]::GetExtension($file) -notin @('.js', '.json', '.ps1', '.md', '.html', '.css', '.cmd', '.yml', '.yaml')) { continue }
        foreach ($match in @(Select-String -LiteralPath $file -Pattern $patterns)) {
            $findings += "$file`:$($match.LineNumber)"
        }
    }
    if ($findings.Count -gt 0) {
        $findings | ForEach-Object { Write-Warning "Possible credential at $_ (value redacted)" }
        throw 'Potential credentials found. Investigate before committing.'
    }
    Write-Host "Source credential-pattern scan passed ($($files.Count) files examined)."
    Write-Host 'This is a limited pattern scan, not a guarantee that secrets or vulnerabilities are absent.'
    Write-Host 'Manual audit checklist: guidelines\AUDITING.md'
}
finally { Pop-Location }
