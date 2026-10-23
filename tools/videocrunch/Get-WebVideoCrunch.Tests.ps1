#requires -Version 5.1
$scriptPath = Join-Path $PSScriptRoot 'Get-WebVideoCrunch.ps1'
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$null, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) {
    throw ($parseErrors.Message -join [Environment]::NewLine)
}
# Load definitions without invoking the command-line entry point.
foreach ($definition in $ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
}, $false)) {
    . ([scriptblock]::Create($definition.Extent.Text))
}
$script:Utf8 = [System.Text.UTF8Encoding]::new($false)

Describe 'Web Video Crunch helpers' {
    It 'accepts only absolute web URLs' {
        Test-WebUri 'https://example.test/watch?v=1' | Should Be $true
        Test-WebUri 'file:///C:/video.mp4' | Should Be $false
        Test-WebUri 'video.mp4' | Should Be $false
        Test-WebUri 'javascript:alert(1)' | Should Be $false
    }

    It 'resolves, decodes, and deduplicates HTML video sources' {
        $html = @'
<base href="/assets/">
<video src="clip.mp4?a=1&amp;b=2"></video>
<source src="clip.mp4?a=1&amp;b=2">
<script>{"hlsUrl":"https:\/\/cdn.example.test\/main.m3u8?a=1\u0026b=2"}</script>
<meta content="//cdn.example.test/other.mp4" property="og:video">
<iframe src="../embed/42"></iframe>
<video src="javascript:alert(1)"></video>
'@
        $links = @(Get-PageCandidates $html ([Uri]'https://example.test/redirected/watch'))
        $links.Count | Should Be 4
        ($links -contains 'https://example.test/assets/clip.mp4?a=1&b=2') | Should Be $true
        ($links -contains 'https://cdn.example.test/main.m3u8?a=1&b=2') | Should Be $true
        ($links -contains 'https://cdn.example.test/other.mp4') | Should Be $true
        ($links -contains 'https://example.test/embed/42') | Should Be $true
    }

    It 'records exact byte counts and SHA-256 digests' {
        $path = Join-Path $TestDrive 'original.mp4'
        [System.IO.File]::WriteAllBytes($path, [byte[]]@(1, 2, 3, 4))
        $entry = Get-ExportFile $path 'original/source.mp4'
        $entry.bytes | Should Be 4
        $entry.sha256 | Should Be (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        $entry.path | Should Be 'original/source.mp4'
    }

    It 'rejects empty media files' {
        $path = Join-Path $TestDrive 'empty.mp4'
        [System.IO.File]::WriteAllBytes($path, [byte[]]@())
        { Get-ExportFile $path 'original/source.mp4' } | Should Throw
    }

    It 'escapes source URLs in the offline player' {
        $path = Join-Path $TestDrive 'index.html'
        Write-VideoPlayer $path 'https://example.test/?q="><script>&b=2' 'original/source.webm' 'compressed/video.mp4'
        $html = [System.IO.File]::ReadAllText($path)
        $html | Should Match 'src="compressed/video.mp4"'
        $html | Should Match '&quot;&gt;&lt;script&gt;&amp;b=2'
        $html | Should Not Match '<script>'
    }

    It 'captures native output and nonzero exit status without hiding stderr' {
        $executable = (Get-Command powershell.exe -CommandType Application).Source
        $result = Invoke-NativeTool $executable @(
            '-NoProfile', '-NonInteractive', '-Command',
            '[Console]::Out.WriteLine(''native output''); [Console]::Error.WriteLine(''expected diagnostic''); exit 7'
        ) -CaptureOutput
        $result.ExitCode | Should Be 7
        ($result.Output -contains 'native output') | Should Be $true
    }

    It 'filters and deduplicates resolved media URLs' {
        Mock Invoke-NativeTool {
            [pscustomobject]@{ ExitCode = 0; Output = @('https://cdn.test/video', 'not a URL', 'https://cdn.test/video') }
        }
        $urls = @(Get-StreamUrls 'yt-dlp.exe' 'https://example.test/video' 'https://example.test/')
        $urls.Count | Should Be 1
        $urls[0] | Should Be 'https://cdn.test/video'
    }

    It 'warns when stream URL resolution fails' {
        Mock Invoke-NativeTool { [pscustomobject]@{ ExitCode = 1; Output = @() } }
        Mock Write-Warning {}
        @(Get-StreamUrls 'yt-dlp.exe' 'https://example.test/video' 'https://example.test/').Count | Should Be 0
        Assert-MockCalled Write-Warning -Times 1 -Exactly
    }
}

Describe 'Web Video Crunch export workflow' {
    BeforeEach {
        $script:downloadCalls = 0
        $script:ffmpegArguments = @()
        Mock Find-Tool { 'C:\mock-tools\' + $Name + '.exe' }
        Mock Get-PageHtml { $null }
        Mock Get-StreamUrls { 'https://cdn.example.test/resolved.mp4?token=temporary' }
        Mock Write-Warning {}
        Mock Invoke-NativeTool {
            if ($Executable -like '*ffmpeg.exe') {
                $script:ffmpegArguments = $ArgumentList
                [System.IO.File]::WriteAllBytes($ArgumentList[-1], [byte[]]@(5, 6))
            }
            else {
                $script:downloadCalls++
                $outputIndex = [Array]::IndexOf($ArgumentList, '--output') + 1
                $reportIndex = [Array]::IndexOf($ArgumentList, '--print-to-file') + 2
                $path = $ArgumentList[$outputIndex].Replace('%(ext)s', 'mp4')
                [System.IO.File]::WriteAllBytes($path, [byte[]]@(1, 2, 3, 4))
                Write-Utf8File $ArgumentList[$reportIndex] $path
            }
            [pscustomobject]@{ ExitCode = 0; Output = @() }
        }
    }

    It 'exports compressed media, local player, stream URLs, and a complete manifest' {
        $directory = Invoke-WebVideoCrunch 'https://example.test/watch' $TestDrive
        $manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
        $manifest.status | Should Be 'completed'
        $manifest.original.bytes | Should Be 4
        $manifest.compressed.bytes | Should Be 2
        $manifest.original.sha256 | Should Be (Get-FileHash (Join-Path $directory $manifest.original.path)).Hash
        $manifest.compression.crf | Should Be 29
        $manifest.attempts.Count | Should Be 1
        $manifest.attempts[0].exitCode | Should Be 0
        $manifest.resolvedStreamUrls.Count | Should Be 1
        Test-Path -LiteralPath (Join-Path $directory 'index.html') | Should Be $true
        Test-Path -LiteralPath (Join-Path $directory 'detected-urls.txt') | Should Be $true
        Get-Content -LiteralPath (Join-Path $directory 'page-url.txt') | Should Be 'https://example.test/watch'
        ($script:ffmpegArguments -contains '-nostdin') | Should Be $true
        ($script:ffmpegArguments -contains '-n') | Should Be $true
    }

    It 'uses the original in the player without invoking compression when skipped' {
        $directory = Invoke-WebVideoCrunch 'https://example.test/clip.webm' $TestDrive -SkipCompression
        $manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
        $manifest.compression.enabled | Should Be $false
        $manifest.compressed | Should BeNullOrEmpty
        $html = Get-Content -LiteralPath (Join-Path $directory 'index.html') -Raw
        $html | Should Match 'src="original/source.mp4"'
        Assert-MockCalled Invoke-NativeTool -Times 0 -Exactly -Scope It -ParameterFilter { $Executable -like '*ffmpeg.exe' }
    }

    It 'uses CRF 23 for Balanced compression' {
        $directory = Invoke-WebVideoCrunch 'https://example.test/watch' $TestDrive -Compression Balanced
        $manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
        $manifest.compression.crf | Should Be 23
        ($script:ffmpegArguments -contains '23') | Should Be $true
    }

    It 'uses CRF 33 and a 1280px width cap for Extreme compression' {
        $directory = Invoke-WebVideoCrunch 'https://example.test/watch' $TestDrive -Compression Extreme
        $manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
        $manifest.compression.crf | Should Be 33
        $manifest.compression.maxWidth | Should Be 1280
        ($script:ffmpegArguments -contains '33') | Should Be $true
        $filterIndex = [Array]::IndexOf($script:ffmpegArguments, '-vf') + 1
        $script:ffmpegArguments[$filterIndex] | Should Match 'min\(1280,iw\*sar\)'
    }

    It 'falls back to detected media while retaining files from the first failed attempt' {
        Mock Get-PageHtml {
            [pscustomobject]@{ Html = '<video src="/clip.mp4"></video>'; Uri = [Uri]'https://example.test/watch' }
        }
        Mock Invoke-NativeTool {
            $script:downloadCalls++
            $outputIndex = [Array]::IndexOf($ArgumentList, '--output') + 1
            $path = $ArgumentList[$outputIndex].Replace('%(ext)s', 'mp4')
            [System.IO.File]::WriteAllBytes($path, [byte[]]@(1, 2, 3, 4))
            if ($script:downloadCalls -eq 1) {
                return [pscustomobject]@{ ExitCode = 1; Output = @() }
            }
            $reportIndex = [Array]::IndexOf($ArgumentList, '--print-to-file') + 2
            Write-Utf8File $ArgumentList[$reportIndex] $path
            [pscustomobject]@{ ExitCode = 0; Output = @() }
        }
        $directory = Invoke-WebVideoCrunch 'https://example.test/watch' $TestDrive -SkipCompression
        $manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
        $manifest.attempts.Count | Should Be 2
        $manifest.attempts[0].exitCode | Should Be 1
        $manifest.attempts[1].url | Should Be 'https://example.test/clip.mp4'
        $manifest.original.path | Should Be 'original/source.mp4'
        Test-Path -LiteralPath (Join-Path $directory '.downloads\attempt-01\source.mp4') | Should Be $true
        $manifest.pageSource.saved | Should Be $true
    }

    It 'continues with the downloader and records a failed HTML request' {
        Mock Get-PageHtml { throw [System.Net.WebException]::new('HTTP 403') }
        $directory = Invoke-WebVideoCrunch 'https://example.test/watch' $TestDrive -SkipCompression
        $manifest = Get-Content -LiteralPath (Join-Path $directory 'manifest.json') -Raw | ConvertFrom-Json
        $manifest.status | Should Be 'completed'
        $manifest.pageSource.error | Should Match '403'
        Assert-MockCalled Write-Warning -Times 1 -Exactly -ParameterFilter { $Message -like '*HTML*' }
    }

    It 'fails explicitly and writes a failed manifest when every download fails' {
        Mock Invoke-NativeTool { [pscustomobject]@{ ExitCode = 9; Output = @() } }
        $root = Join-Path $TestDrive 'download-failure'
        { Invoke-WebVideoCrunch 'https://example.test/watch' $root } | Should Throw 'All 1 download attempts failed'
        $manifestFile = Get-ChildItem -LiteralPath $root -Recurse -Filter manifest.json
        $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
        $manifest.status | Should Be 'failed'
        $manifest.attempts[0].exitCode | Should Be 9
        $manifest.error | Should Match 'download attempts failed'
    }

    It 'does not report success when the downloader creates no file report' {
        Mock Invoke-NativeTool { [pscustomobject]@{ ExitCode = 0; Output = @() } }
        $root = Join-Path $TestDrive 'missing-download'
        { Invoke-WebVideoCrunch 'https://example.test/watch' $root } | Should Throw
        $manifestFile = Get-ChildItem -LiteralPath $root -Recurse -Filter manifest.json
        $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
        $manifest.status | Should Be 'failed'
        $manifest.attempts[0].error | Should Match 'did not report'
    }

    It 'preserves the downloaded original and failed manifest if compression fails' {
        Mock Invoke-NativeTool {
            [pscustomobject]@{ ExitCode = 5; Output = @() }
        } -ParameterFilter { $Executable -like '*ffmpeg.exe' }
        $root = Join-Path $TestDrive 'compression-failure'
        { Invoke-WebVideoCrunch 'https://example.test/watch' $root } | Should Throw 'FFmpeg compression failed'
        $manifestFile = Get-ChildItem -LiteralPath $root -Recurse -Filter manifest.json
        $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw | ConvertFrom-Json
        $manifest.status | Should Be 'failed'
        $original = Join-Path $manifestFile.DirectoryName $manifest.original.path
        (Get-FileHash -LiteralPath $original).Hash | Should Be $manifest.original.sha256
        Test-Path -LiteralPath (Join-Path $manifestFile.DirectoryName 'index.html') | Should Be $false
    }

    It 'creates distinct export folders for repeated runs' {
        $first = Invoke-WebVideoCrunch 'https://example.test/watch' $TestDrive -SkipCompression
        $second = Invoke-WebVideoCrunch 'https://example.test/watch' $TestDrive -SkipCompression
        $first | Should Not Be $second
        Test-Path -LiteralPath $first | Should Be $true
        Test-Path -LiteralPath $second | Should Be $true
    }

    It 'rejects invalid URLs before creating files or invoking tools' {
        { Invoke-WebVideoCrunch 'file:///C:/video.mp4' $TestDrive } | Should Throw 'HTTP or HTTPS'
        Assert-MockCalled Find-Tool -Times 0 -Exactly -Scope It
    }
}
