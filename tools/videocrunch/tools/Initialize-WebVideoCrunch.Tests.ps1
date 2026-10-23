#requires -Version 5.1
$scriptPath = Join-Path $PSScriptRoot 'Initialize-WebVideoCrunch.ps1'
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$null, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw ($parseErrors.Message -join '; ') }
foreach ($definition in $ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
}, $false)) {
    . ([scriptblock]::Create($definition.Extent.Text))
}

Describe 'First-run bootstrap' {
    BeforeEach {
        $script:installed = @()
        Mock Update-ToolPath {}
        Mock Get-Command { [pscustomobject]@{ Source = 'winget.exe' } } -ParameterFilter { $Name -eq 'winget' }
        Mock Install-Requirement { $script:installed += $PackageId }
    }

    It 'does not install or require winget when tools already exist' {
        Mock Test-Requirement { $true }
        Initialize-WebVideoCrunch
        Assert-MockCalled Install-Requirement -Times 0 -Exactly -Scope It
        Assert-MockCalled Get-Command -Times 0 -Exactly -Scope It -ParameterFilter { $Name -eq 'winget' }
    }

    It 'installs all missing prerequisites and refreshes PATH' {
        Mock Test-Requirement {
            $id = switch ($Command) {
                'node' { 'OpenJS.NodeJS.LTS' }
                'yt-dlp' { 'yt-dlp.yt-dlp' }
                'ffmpeg' { 'Gyan.FFmpeg' }
            }
            return ($script:installed -contains $id)
        }
        Initialize-WebVideoCrunch
        $script:installed.Count | Should Be 3
        ($script:installed -contains 'OpenJS.NodeJS.LTS') | Should Be $true
        ($script:installed -contains 'yt-dlp.yt-dlp') | Should Be $true
        ($script:installed -contains 'Gyan.FFmpeg') | Should Be $true
        Assert-MockCalled Update-ToolPath -Times 4 -Exactly -Scope It
    }

    It 'installs only missing tools' {
        Mock Test-Requirement { $Command -ne 'ffmpeg' -or $script:installed -contains 'Gyan.FFmpeg' }
        Initialize-WebVideoCrunch
        $script:installed.Count | Should Be 1
        $script:installed[0] | Should Be 'Gyan.FFmpeg'
    }

    It 'explains recovery when winget is unavailable' {
        Mock Test-Requirement { $false }
        Mock Get-Command { $null } -ParameterFilter { $Name -eq 'winget' }
        { Initialize-WebVideoCrunch } | Should Throw 'Windows App Installer'
        Assert-MockCalled Install-Requirement -Times 0 -Exactly -Scope It
    }

    It 'propagates an installation failure rather than continuing startup' {
        Mock Test-Requirement { $false }
        Mock Install-Requirement { throw 'Installer failed' }
        { Initialize-WebVideoCrunch } | Should Throw 'Installer failed'
    }

    It 'fails clearly when an installed tool is still missing from PATH' {
        Mock Test-Requirement { $false }
        { Initialize-WebVideoCrunch } | Should Throw 'not available on PATH'
    }
}
