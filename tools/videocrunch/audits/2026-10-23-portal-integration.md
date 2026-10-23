# Audit: 2026-10-23 - localhost portal integration

## Scope

Self-audit of the complete tracked VideoCrunch source imported into the Moorkyz
tools repository, baseline `15043ff`. The external VideoExports repository was
read-only and remains unchanged. No downloaded media, private history, Git
metadata, dependencies or caches were imported.

The original Windows service, exporter, local job protections, range requests
and source-byte preservation are retained. Asset/API URLs became relative so
both standalone and same-origin portal mounts work. The verification subprocess
clears inherited PowerShell 7 module paths before starting Windows PowerShell.
The portal's opt-in gateway, source hierarchy and generated ZIP are separate
from this application's runtime.

## Executed checks

Commands below were executed from the parent Moorkyz repository.

| Check | Command or method | Result |
|---|---|---|
| Syntax, API and PowerShell verification | `pnpm test:videocrunch` | PASS: JavaScript/PowerShell parsing; 13 Node API tests and 25 Pester tests |
| Real-media preservation | `node --test tools\videocrunch\test\media.test.js` | PASS: 5 tests, covering Balanced, Crunch, Extreme and original-only with synthetic media, original hashes and playable derivative checks |
| Original standalone interface | `pnpm exec playwright test --config tools\videocrunch\playwright.config.js` | PASS: 4 Microsoft Edge tests; navigation, mobile errors, real export, playback, original download, persistent history and explicit failures |
| Integrated local web service | `pnpm test:videocrunch:browser` | PASS: 6 Chromium/Firefox/WebKit cases; real export, playable media, original download, view polling cleanup and connection retry |
| Dependency/credential patterns | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\videocrunch\tools\Audit.ps1` | PASS: zero reported vulnerabilities and no selected credential-pattern findings in the 47 original imported source paths |
| ZIP interoperability | PowerShell `Expand-Archive`, then `Get-FileHash` comparison against the allowlisted originals | PASS: all 47 original imported files extracted byte-for-byte before this audit was added |

## Findings and resolutions

- Windows PowerShell regression tests initially failed because an inherited
  PowerShell 7 module path prevented `Get-FileHash` resolution. Resetting the
  child environment restored native modules; all 25 tests then passed.
- Relative frontend URLs were exercised through the portal's nested path and
  independently through the original standalone root.
- The service still binds to loopback and serializes options into a fixed child
  environment rather than interpolating shell code. The portal does not start
  processes, install native tools, bypass job tokens or serve arbitrary files.
- This audit is included in the explicit source allowlist, making the final
  source bundle 48 files. Generated assets are not committed.

## Limitations and follow-up

No public hosting, authentication, tenant isolation, quotas, hosted storage,
deployment or release is implemented or authorized. The original tool's
no-selected-distribution-license notice remains in force; the parent Toolbar
license must not be assumed to relicense this application.

First-use winget bootstrapping on a clean disposable Windows VM and human
assistive-technology/device certification were NOT RUN. Installed native tools
were not removed from the shared machine. Synthetic media tests are not proof
that every third-party site/codec is supported. The bounded scans are not
independent security certification.
